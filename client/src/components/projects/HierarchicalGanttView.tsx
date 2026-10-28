import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Chip,
  Avatar,
  Tooltip,
  CircularProgress,
  TextField,
  MenuItem,
  Select,
  InputAdornment,
  Switch,
  FormControlLabel,
  Popover,
  Divider,
  Alert,
  Grid,
  useTheme,
} from '@mui/material';
import {
  ChevronRight,
  ChevronDown,
  Calendar as CalendarIcon,
  Search,
  Maximize2,
  Plus,
  RefreshCw,
  Lock,
  Network,
  GitBranch,
  Trash2,
  AlertTriangle,
  X,
  Check,
} from 'lucide-react';
import {
  TaskItem,
  TaskDependencyInfo,
  ProjectMilestoneItem,
  useUpdateTaskMutation,
  useAddSubtaskMutation,
  useRescheduleDependenciesMutation,
  useAddDependencyMutation,
  useUpdateDependencyMutation,
  useRemoveDependencyMutation,
} from '@/api/projectsApi';
import { useToast } from '@/components/ui/ToastHost';
import { getTaskIdBadgeStyle, formatDate } from '@/utils/format';

// ─── Constants ────────────────────────────────────────────────────────────────
type TimeScale = 'DAY' | 'WEEK' | 'MONTH';
type DepType = 'FS' | 'SS' | 'FF' | 'SF';

const DEP_COLORS: Record<DepType, string> = {
  FS: '#10B981',
  SS: '#3B82F6',
  FF: '#8B5CF6',
  SF: '#F59E0B',
};

const DEP_LABELS: Record<DepType, string> = {
  FS: 'Finish → Start',
  SS: 'Start → Start',
  FF: 'Finish → Finish',
  SF: 'Start → Finish',
};

const ROW_HEIGHT = 44;

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface TreeNode extends TaskItem {
  depth: number;
  hasChildren: boolean;
  children: TreeNode[];
  computedStartDate?: string;
  computedDueDate?: string;
  isMilestone?: boolean;
  isCritical?: boolean;
}

interface HierarchicalGanttViewProps {
  tasks: TaskItem[];
  milestones?: ProjectMilestoneItem[];
  onOpenTaskDetail: (task: TaskItem) => void;
  isLoading?: boolean;
  projectId?: number;
}

interface DepDrawState {
  fromTaskId: number;
  fromEdge: 'left' | 'right';
  mouseX: number;
  mouseY: number;
  startX: number;
  startY: number;
}

interface DepPopoverState {
  anchorEl: HTMLElement | null;
  existingDep?: TaskDependencyInfo & { fromTaskId: number; toTaskId: number };
  fromTaskId?: number;
  toTaskId?: number;
  detectedType: DepType;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HierarchicalGanttView({
  tasks,
  milestones = [],
  onOpenTaskDetail,
  isLoading = false,
  projectId,
}: HierarchicalGanttViewProps) {
  const { showToast } = useToast();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [updateTask] = useUpdateTaskMutation();
  const [addSubtask] = useAddSubtaskMutation();
  const [rescheduleDependenciesApi] = useRescheduleDependenciesMutation();
  const [addDependency] = useAddDependencyMutation();
  const [updateDependency] = useUpdateDependencyMutation();
  const [removeDependency] = useRemoveDependencyMutation();

  // ── Core State ─────────────────────────────────────────────────────────────
  const [scale, setScale] = useState<TimeScale>('WEEK');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<number, boolean>>({});
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(360);
  const [isResizingLeft, setIsResizingLeft] = useState<boolean>(false);
  const [autoRescheduleDependencies, setAutoRescheduleDependencies] = useState<boolean>(true);
  const [showCriticalPath, setShowCriticalPath] = useState<boolean>(false);

  // ── Inline Subtask State ───────────────────────────────────────────────────
  const [inlineSubtaskParentId, setInlineSubtaskParentId] = useState<number | null>(null);
  const [inlineSubtaskTitle, setInlineSubtaskTitle] = useState('');

  // ── Bar Drag / Resize State ────────────────────────────────────────────────
  const [draggingState, setDraggingState] = useState<{
    taskId: number;
    mode: 'MOVE' | 'RESIZE_LEFT' | 'RESIZE_RIGHT';
    initialMouseX: number;
    initialStartDate: Date;
    initialDueDate: Date;
    currentStartDate: Date;
    currentDueDate: Date;
  } | null>(null);

  // ── Dependency Draw State (rubber-band line) ───────────────────────────────
  const [depDrawState, setDepDrawState] = useState<DepDrawState | null>(null);
  const [hoverConnectorTaskId, setHoverConnectorTaskId] = useState<{ taskId: number; edge: 'left' | 'right' } | null>(null);

  // ── Dependency Popover State ───────────────────────────────────────────────
  const [depPopover, setDepPopover] = useState<DepPopoverState | null>(null);
  const [depPopoverType, setDepPopoverType] = useState<DepType>('FS');
  const [depPopoverLag, setDepPopoverLag] = useState<number>(0);
  const [depPopoverLagHours, setDepPopoverLagHours] = useState<number>(0);
  const [depPopoverLoading, setDepPopoverLoading] = useState(false);
  const [depPopoverError, setDepPopoverError] = useState<string | null>(null);

  // ── Date Range State ───────────────────────────────────────────────────────
  const [baseDate, setBaseDate] = useState<Date>(new Date());

  // ── Scroll Sync Refs ───────────────────────────────────────────────────────
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef<boolean>(false);
  const rightPaneContainerRef = useRef<HTMLDivElement>(null);

  // Auto-expand all top level tasks initially
  useEffect(() => {
    if (tasks.length > 0) {
      const initialMap: Record<number, boolean> = {};
      tasks.forEach((t) => { initialMap[t.id] = true; });
      setExpandedTaskIds((prev) => ({ ...initialMap, ...prev }));
    }
  }, [tasks]);

  // ── Synchronized Vertical Scrolling ───────────────────────────────────────
  const handleLeftScroll = () => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (leftPaneRef.current && rightPaneRef.current) {
      rightPaneRef.current.scrollTop = leftPaneRef.current.scrollTop;
    }
    isSyncingScroll.current = false;
  };

  const handleRightScroll = () => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (leftPaneRef.current && rightPaneRef.current) {
      leftPaneRef.current.scrollTop = rightPaneRef.current.scrollTop;
    }
    isSyncingScroll.current = false;
  };

  // ── Flatten & Build Tree ───────────────────────────────────────────────────
  const allTasksFlat = useMemo(() => {
    const list: TaskItem[] = [];
    const collect = (tList: TaskItem[]) => {
      tList.forEach((t) => {
        list.push(t);
        const children = t.nested_subtasks || t.subtasks || [];
        if (children.length > 0) collect(children);
      });
    };
    collect(tasks);
    return list;
  }, [tasks]);

  const treeData = useMemo(() => {
    const map = new Map<number, TreeNode>();
    const roots: TreeNode[] = [];

    allTasksFlat.forEach((t) => {
      map.set(t.id, { ...t, depth: 0, hasChildren: false, children: [] });
    });

    allTasksFlat.forEach((t) => {
      const node = map.get(t.id)!;
      if (t.parent_task_id && map.has(t.parent_task_id)) {
        const parent = map.get(t.parent_task_id)!;
        parent.hasChildren = true;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    const computeDepthAndBounds = (node: TreeNode, depth: number): { minStart?: string; maxDue?: string } => {
      node.depth = depth;
      node.isMilestone = !!(node.milestone_id || node.title?.toLowerCase().startsWith('milestone:'));
      let minStart = node.start_date;
      let maxDue = node.due_date;

      if (node.children.length > 0) {
        node.hasChildren = true;
        node.children.forEach((child) => {
          const childBounds = computeDepthAndBounds(child, depth + 1);
          if (childBounds.minStart && (!minStart || childBounds.minStart < minStart)) minStart = childBounds.minStart;
          if (childBounds.maxDue && (!maxDue || childBounds.maxDue > maxDue)) maxDue = childBounds.maxDue;
        });
      }
      node.computedStartDate = minStart;
      node.computedDueDate = maxDue;
      return { minStart, maxDue };
    };

    roots.forEach((r) => computeDepthAndBounds(r, 0));
    return roots;
  }, [tasks]);

  // ── Filter & Flatten Visible Nodes ────────────────────────────────────────
  const visibleNodes = useMemo(() => {
    const result: TreeNode[] = [];
    const matchesSearch = (node: TreeNode): boolean => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return !!(
        (node.title && node.title.toLowerCase().includes(q)) ||
        (node.task_number && node.task_number.toLowerCase().includes(q)) ||
        node.children.some((c) => matchesSearch(c))
      );
    };
    const traverse = (nodes: TreeNode[]) => {
      nodes.forEach((node) => {
        const priorityMatch = priorityFilter === 'ALL' || node.priority === priorityFilter;
        if (matchesSearch(node) && priorityMatch) {
          result.push(node);
          if (node.hasChildren && (expandedTaskIds[node.id] || searchQuery.trim())) {
            traverse(node.children);
          }
        }
      });
    };
    traverse(treeData);
    return result;
  }, [treeData, expandedTaskIds, searchQuery, priorityFilter]);

  // ── Critical Path Computation (CPM) ───────────────────────────────────────
  const criticalPathIds = useMemo(() => {
    if (!showCriticalPath) return new Set<number>();
    // Build a simple graph from visible nodes' dependencies
    const nodes = allTasksFlat;
    const durations: Record<number, number> = {};
    const successors: Record<number, number[]> = {};
    const predecessors: Record<number, number[]> = {};
    nodes.forEach((n) => {
      const dur = n.duration_working_days || (n.start_date && n.due_date
        ? Math.max(1, Math.ceil((new Date(n.due_date).getTime() - new Date(n.start_date).getTime()) / 86400000))
        : 1);
      durations[n.id] = dur;
      successors[n.id] = [];
      predecessors[n.id] = [];
    });
    nodes.forEach((n) => {
      (n.dependencies || []).forEach((dep) => {
        if (dep.direction !== 'BLOCKING') {
          const predId = dep.depends_on_task_id;
          if (predId && successors[predId]) {
            successors[predId].push(n.id);
            predecessors[n.id].push(predId);
          }
        }
      });
    });

    // Topological sort
    const visited = new Set<number>();
    const order: number[] = [];
    const visit = (id: number) => {
      if (visited.has(id)) return;
      visited.add(id);
      (predecessors[id] || []).forEach(visit);
      order.push(id);
    };
    nodes.forEach((n) => visit(n.id));

    // Forward pass
    const ES: Record<number, number> = {};
    const EF: Record<number, number> = {};
    order.forEach((id) => {
      const preds = predecessors[id] || [];
      ES[id] = preds.length === 0 ? 0 : Math.max(...preds.map((p) => EF[p] || 0));
      EF[id] = ES[id] + (durations[id] || 1);
    });

    // Project end = max EF
    const projectEnd = Math.max(...Object.values(EF), 0);

    // Backward pass
    const LS: Record<number, number> = {};
    const LF: Record<number, number> = {};
    [...order].reverse().forEach((id) => {
      const succs = successors[id] || [];
      LF[id] = succs.length === 0 ? projectEnd : Math.min(...succs.map((s) => LS[s] ?? projectEnd));
      LS[id] = LF[id] - (durations[id] || 1);
    });

    // Float = LS - ES; zero float = critical
    const critical = new Set<number>();
    nodes.forEach((n) => {
      if ((LS[n.id] - ES[n.id]) <= 0) critical.add(n.id);
    });
    return critical;
  }, [showCriticalPath, allTasksFlat]);

  // ── Timeline Calculation ───────────────────────────────────────────────────
  const { timelineStart, totalColumns, columnWidthPx } = useMemo(() => {
    let minD = new Date(baseDate);
    let maxD = new Date(baseDate);
    let validTaskDates = false;

    tasks.forEach((t) => {
      const s = t.start_date ? new Date(t.start_date) : null;
      const d = t.due_date ? new Date(t.due_date) : null;
      if (s && !isNaN(s.getTime())) { if (!validTaskDates || s < minD) minD = s; validTaskDates = true; }
      if (d && !isNaN(d.getTime())) { if (!validTaskDates || d > maxD) maxD = d; validTaskDates = true; }
    });
    milestones.forEach((m) => {
      const s = m.rollup_start_date ? new Date(m.rollup_start_date) : null;
      const e = m.rollup_end_date ? new Date(m.rollup_end_date) : null;
      if (s && !isNaN(s.getTime()) && s < minD) minD = s;
      if (e && !isNaN(e.getTime()) && e > maxD) maxD = e;
    });

    if (!validTaskDates) {
      minD = new Date(baseDate); minD.setDate(minD.getDate() - 7);
      maxD = new Date(baseDate); maxD.setDate(maxD.getDate() + 21);
    } else {
      minD = new Date(minD); minD.setDate(minD.getDate() - 5);
      maxD = new Date(maxD); maxD.setDate(maxD.getDate() + 14);
    }

    let colWidth = 44;
    let totalCols = 30;

    if (scale === 'DAY') {
      colWidth = 48;
      const diffDays = Math.ceil((maxD.getTime() - minD.getTime()) / (1000 * 3600 * 24));
      totalCols = Math.max(30, diffDays);
    } else if (scale === 'WEEK') {
      colWidth = 140;
      const diffWeeks = Math.ceil((maxD.getTime() - minD.getTime()) / (1000 * 3600 * 24 * 7));
      totalCols = Math.max(12, diffWeeks);
    } else if (scale === 'MONTH') {
      colWidth = 180;
      const diffMonths = (maxD.getFullYear() - minD.getFullYear()) * 12 + (maxD.getMonth() - minD.getMonth()) + 1;
      totalCols = Math.max(12, diffMonths);
    }

    return { timelineStart: minD, timelineEnd: maxD, totalColumns: totalCols, columnWidthPx: colWidth };
  }, [tasks, milestones, baseDate, scale]);

  // ── Date Headers ──────────────────────────────────────────────────────────
  const dateHeaders = useMemo(() => {
    const headers: Array<{ label: string; subLabel: string; date: Date; isWeekend?: boolean }> = [];
    const curr = new Date(timelineStart);

    for (let i = 0; i < totalColumns; i++) {
      if (scale === 'DAY') {
        const d = new Date(curr); d.setDate(d.getDate() + i);
        const dayOfWeek = d.getDay();
        headers.push({
          label: `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()}`,
          subLabel: d.toLocaleDateString('en-US', { month: 'short' }),
          date: d,
          isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        });
      } else if (scale === 'WEEK') {
        const d = new Date(curr); d.setDate(d.getDate() + i * 7);
        const endW = new Date(d); endW.setDate(endW.getDate() + 6);
        headers.push({
          label: `W${getWeekNumber(d)} (${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })})`,
          subLabel: `${d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}`,
          date: d,
        });
      } else if (scale === 'MONTH') {
        const d = new Date(curr.getFullYear(), curr.getMonth() + i, 1);
        headers.push({ label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), subLabel: `${d.getFullYear()}`, date: d });
      }
    }
    return headers;
  }, [timelineStart, totalColumns, scale]);

  // ── Helper: Week Number ────────────────────────────────────────────────────
  function getWeekNumber(d: Date) {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  }

  // ── Auto Fit ─────────────────────────────────────────────────────────────
  const handleAutoFit = () => {
    let minD: Date | null = null;
    tasks.forEach((t) => {
      if (t.start_date) { const d = new Date(t.start_date); if (!minD || d < minD) minD = d; }
    });
    if (minD) { setBaseDate(new Date(minD)); showToast('Fitted schedule to project date bounds 🎯', 'info'); }
  };

  // ── Toggle Expand ─────────────────────────────────────────────────────────
  const toggleNodeExpand = (nodeId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTaskIds((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  // ── Quick Add Subtask ─────────────────────────────────────────────────────
  const handleCreateSubtaskInline = async (parentId: number) => {
    if (!inlineSubtaskTitle.trim()) return;
    try {
      await addSubtask({ taskId: parentId, title: inlineSubtaskTitle.trim() }).unwrap();
      setInlineSubtaskTitle('');
      setInlineSubtaskParentId(null);
      showToast('Subtask created', 'success');
    } catch {
      showToast('Failed to create subtask', 'error');
    }
  };

  // ── Bar Pixel Coordinates ─────────────────────────────────────────────────
  const getBarPixelCoords = useCallback((node: { start_date?: string; due_date?: string; computedStartDate?: string; computedDueDate?: string }) => {
    const sStr = node.start_date || node.computedStartDate;
    const dStr = node.due_date || node.computedDueDate;
    if (!sStr && !dStr) return null;

    const sDate = sStr ? new Date(sStr) : new Date(dStr!);
    const dDate = dStr ? new Date(dStr) : new Date(sStr!);
    const msPerDay = 1000 * 3600 * 24;

    let leftPx = 0, widthPx = 0;

    if (scale === 'DAY') {
      const offsetDays = (sDate.getTime() - timelineStart.getTime()) / msPerDay;
      const durationDays = Math.max(1, (dDate.getTime() - sDate.getTime()) / msPerDay + 1);
      leftPx = offsetDays * columnWidthPx;
      widthPx = durationDays * columnWidthPx;
    } else if (scale === 'WEEK') {
      const offsetWeeks = (sDate.getTime() - timelineStart.getTime()) / (msPerDay * 7);
      const durationWeeks = Math.max(0.2, (dDate.getTime() - sDate.getTime()) / (msPerDay * 7));
      leftPx = offsetWeeks * columnWidthPx;
      widthPx = Math.max(28, durationWeeks * columnWidthPx);
    } else if (scale === 'MONTH') {
      const offsetMonths = (sDate.getFullYear() - timelineStart.getFullYear()) * 12 + (sDate.getMonth() - timelineStart.getMonth()) + sDate.getDate() / 30;
      const durationMonths = Math.max(0.2, (dDate.getTime() - sDate.getTime()) / (msPerDay * 30));
      leftPx = offsetMonths * columnWidthPx;
      widthPx = Math.max(28, durationMonths * columnWidthPx);
    }

    return { leftPx, widthPx, sDate, dDate };
  }, [scale, timelineStart, columnWidthPx]);

  // ── Today Line Pixel Position ─────────────────────────────────────────────
  const todayPx = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const msPerDay = 1000 * 3600 * 24;
    if (scale === 'DAY') return (today.getTime() - timelineStart.getTime()) / msPerDay * columnWidthPx;
    if (scale === 'WEEK') return (today.getTime() - timelineStart.getTime()) / (msPerDay * 7) * columnWidthPx;
    return ((today.getFullYear() - timelineStart.getFullYear()) * 12 + today.getMonth() - timelineStart.getMonth() + today.getDate() / 30) * columnWidthPx;
  }, [scale, timelineStart, columnWidthPx]);

  // ── Bar Drag & Resize Mouse Handlers ─────────────────────────────────────
  const handleMouseDownBar = (node: TreeNode, mode: 'MOVE' | 'RESIZE_LEFT' | 'RESIZE_RIGHT', e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.hasChildren) return;
    const coords = getBarPixelCoords(node);
    if (!coords) return;
    setDraggingState({
      taskId: node.id,
      mode,
      initialMouseX: e.clientX,
      initialStartDate: coords.sDate,
      initialDueDate: coords.dDate,
      currentStartDate: coords.sDate,
      currentDueDate: coords.dDate,
    });
  };

  useEffect(() => {
    if (!draggingState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - draggingState.initialMouseX;
      let daysOffset = 0;
      if (scale === 'DAY') daysOffset = Math.round(deltaX / columnWidthPx);
      else if (scale === 'WEEK') daysOffset = Math.round((deltaX / columnWidthPx) * 7);
      else if (scale === 'MONTH') daysOffset = Math.round((deltaX / columnWidthPx) * 30);

      const newStart = new Date(draggingState.initialStartDate);
      const newDue = new Date(draggingState.initialDueDate);

      if (draggingState.mode === 'MOVE') {
        newStart.setDate(newStart.getDate() + daysOffset);
        newDue.setDate(newDue.getDate() + daysOffset);
      } else if (draggingState.mode === 'RESIZE_LEFT') {
        newStart.setDate(newStart.getDate() + daysOffset);
        if (newStart > newDue) newStart.setTime(newDue.getTime());
      } else if (draggingState.mode === 'RESIZE_RIGHT') {
        newDue.setDate(newDue.getDate() + daysOffset);
        if (newDue < newStart) newDue.setTime(newStart.getTime());
      }

      setDraggingState((prev) => prev ? { ...prev, currentStartDate: newStart, currentDueDate: newDue } : null);
    };

    const handleMouseUp = async () => {
      if (!draggingState) return;
      const sStr = draggingState.currentStartDate.toISOString().split('T')[0];
      const dStr = draggingState.currentDueDate.toISOString().split('T')[0];
      const targetId = draggingState.taskId;
      const diffMs = draggingState.currentDueDate.getTime() - draggingState.initialDueDate.getTime();
      const daysShift = Math.round(diffMs / (1000 * 3600 * 24));

      setDraggingState(null);

      try {
        await updateTask({ id: targetId, body: { start_date: sStr as any, due_date: dStr as any } }).unwrap();
        showToast('Schedule updated ✓', 'success');

        if (autoRescheduleDependencies && daysShift !== 0) {
          await rescheduleDependenciesApi({ taskId: targetId, days_shift: daysShift }).unwrap();
          showToast(`Auto-cascaded ${daysShift > 0 ? '+' : ''}${daysShift} day(s) to successors`, 'info');
        }
      } catch {
        showToast('Failed to save updated schedule dates', 'error');
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [draggingState, scale, columnWidthPx, autoRescheduleDependencies]);

  // ── Dependency Draw (rubber-band) ─────────────────────────────────────────
  const handleDepConnectorMouseDown = (taskId: number, edge: 'left' | 'right', e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDepDrawState({
      fromTaskId: taskId,
      fromEdge: edge,
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: rect.left + rect.width / 2,
      startY: rect.top + rect.height / 2,
    });
  };

  useEffect(() => {
    if (!depDrawState) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDepDrawState((prev) => prev ? { ...prev, mouseX: e.clientX, mouseY: e.clientY } : null);
    };

    const handleMouseUp = () => {
      if (depDrawState && hoverConnectorTaskId && hoverConnectorTaskId.taskId !== depDrawState.fromTaskId) {
        // Determine dep type from edge combo
        let detectedType: DepType = 'FS';
        if (depDrawState.fromEdge === 'right' && hoverConnectorTaskId.edge === 'left') detectedType = 'FS';
        else if (depDrawState.fromEdge === 'left' && hoverConnectorTaskId.edge === 'left') detectedType = 'SS';
        else if (depDrawState.fromEdge === 'right' && hoverConnectorTaskId.edge === 'right') detectedType = 'FF';
        else if (depDrawState.fromEdge === 'left' && hoverConnectorTaskId.edge === 'right') detectedType = 'SF';

        // Open popover to confirm
        const targetEl = document.getElementById(`dep-connector-${hoverConnectorTaskId.taskId}-${hoverConnectorTaskId.edge}`);
        setDepPopoverType(detectedType);
        setDepPopoverLag(0);
        setDepPopoverError(null);
        setDepPopover({
          anchorEl: targetEl || document.body,
          fromTaskId: depDrawState.fromTaskId,
          toTaskId: hoverConnectorTaskId.taskId,
          detectedType,
        });
      }
      setDepDrawState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [depDrawState, hoverConnectorTaskId]);

  // ── Create Dependency ─────────────────────────────────────────────────────
  const handleCreateDep = async () => {
    if (!depPopover?.fromTaskId || !depPopover.toTaskId) return;
    setDepPopoverLoading(true);
    setDepPopoverError(null);
    try {
      await addDependency({
        taskId: depPopover.toTaskId,
        predecessor_task_id: depPopover.fromTaskId,
        dep_type: depPopoverType,
        lag_days: depPopoverLag,
        lag_hours: depPopoverLagHours,
      }).unwrap();
      showToast(`Dependency created: ${depPopoverType}${depPopoverLag ? ` +${depPopoverLag}d` : ''}${depPopoverLagHours ? ` +${depPopoverLagHours}h` : ''}`, 'success');
      setDepPopover(null);
    } catch (err: any) {
      const detail = err?.data?.detail;
      if (detail?.code === 'CROSS_PROJECT_DEPENDENCY') {
        setDepPopoverError('Cannot link tasks from different projects.');
      } else if (typeof detail === 'string') {
        setDepPopoverError(detail);
      } else {
        setDepPopoverError('Failed to create dependency.');
      }
    } finally {
      setDepPopoverLoading(false);
    }
  };

  // ── Update Dependency ─────────────────────────────────────────────────────
  const handleUpdateDep = async () => {
    if (!depPopover?.existingDep) return;
    setDepPopoverLoading(true);
    setDepPopoverError(null);
    try {
      await updateDependency({
        dependencyId: depPopover.existingDep.id,
        dep_type: depPopoverType,
        lag_days: depPopoverLag,
        lag_hours: depPopoverLagHours,
      }).unwrap();
      showToast('Dependency updated', 'success');
      setDepPopover(null);
    } catch {
      setDepPopoverError('Failed to update dependency.');
    } finally {
      setDepPopoverLoading(false);
    }
  };

  // ── Delete Dependency ─────────────────────────────────────────────────────
  const handleDeleteDep = async () => {
    if (!depPopover?.existingDep) return;
    setDepPopoverLoading(true);
    try {
      await removeDependency({ taskId: depPopover.existingDep.task_id, dependencyId: depPopover.existingDep.id }).unwrap();
      showToast('Dependency removed', 'success');
      setDepPopover(null);
    } catch {
      setDepPopoverError('Failed to delete dependency.');
    } finally {
      setDepPopoverLoading(false);
    }
  };

  // ── Dependency Arrow Lines ────────────────────────────────────────────────
  const dependencyLines = useMemo(() => {
    const lines: Array<{
      id: number;
      x1: number; y1: number; x2: number; y2: number;
      depType: DepType;
      dep: TaskDependencyInfo & { fromTaskId: number; toTaskId: number };
      midX: number; midY: number;
    }> = [];

    visibleNodes.forEach((node, nodeIdx) => {
      if (!node.dependencies?.length) return;
      node.dependencies.forEach((dep) => {
        if (dep.direction === 'BLOCKING') return; // Skip (handled by BLOCKED_BY)

        // BLOCKED_BY: node depends on dep.depends_on_task_id (the predecessor)
        const predId = dep.depends_on_task_id || dep.predecessor_task_id;
        if (!predId) return;

        const predNodeIdx = visibleNodes.findIndex((n) => n.id === predId);
        if (predNodeIdx < 0) return;

        const predNode = visibleNodes[predNodeIdx];
        const coordsA = getBarPixelCoords(predNode);
        const coordsB = getBarPixelCoords(node);
        if (!coordsA || !coordsB) return;

        const depType = (dep.dep_type || 'FS') as DepType;
        let x1: number, y1: number, x2: number, y2: number;
        const yA = predNodeIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
        const yB = nodeIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

        if (depType === 'FS') { x1 = coordsA.leftPx + coordsA.widthPx; x2 = coordsB.leftPx; }
        else if (depType === 'SS') { x1 = coordsA.leftPx; x2 = coordsB.leftPx; }
        else if (depType === 'FF') { x1 = coordsA.leftPx + coordsA.widthPx; x2 = coordsB.leftPx + coordsB.widthPx; }
        else { x1 = coordsA.leftPx; x2 = coordsB.leftPx + coordsB.widthPx; }

        y1 = yA; y2 = yB;
        lines.push({
          id: dep.id,
          x1, y1, x2, y2,
          depType,
          dep: { ...dep, fromTaskId: predId, toTaskId: node.id },
          midX: (x1 + x2) / 2,
          midY: (y1 + y2) / 2,
        });
      });
    });

    return lines;
  }, [visibleNodes, scale, timelineStart, columnWidthPx, getBarPixelCoords]);

  // ── Left Panel Resizer ────────────────────────────────────────────────────
  const handleMouseDownResizer = (e: React.MouseEvent) => { e.preventDefault(); setIsResizingLeft(true); };
  useEffect(() => {
    if (!isResizingLeft) return;
    const handleResizeMove = (e: MouseEvent) => setLeftPanelWidth(Math.max(260, Math.min(600, e.clientX - 40)));
    const handleResizeUp = () => setIsResizingLeft(false);
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeUp);
    return () => { window.removeEventListener('mousemove', handleResizeMove); window.removeEventListener('mouseup', handleResizeUp); };
  }, [isResizingLeft]);

  // ── Bar Color ─────────────────────────────────────────────────────────────
  const getBarColor = (node: TreeNode) => {
    if (showCriticalPath && criticalPathIds.has(node.id)) return '#EF4444';
    if (node.hasChildren) return '#334155';
    if (node.priority === 'URGENT') return '#DC2626';
    if (node.priority === 'HIGH') return '#D97706';
    return isDark ? '#16C47F' : '#203020';
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={36} color="primary" />
      </Box>
    );
  }

  // ── Rubber-band SVG overlay coords ───────────────────────────────────────
  const rightPaneRect = rightPaneContainerRef.current?.getBoundingClientRect();
  const rubberStartX = depDrawState && rightPaneRect ? depDrawState.startX - rightPaneRect.left : 0;
  const rubberStartY = depDrawState && rightPaneRect ? depDrawState.startY - rightPaneRect.top : 0;
  const rubberEndX = depDrawState && rightPaneRect ? depDrawState.mouseX - rightPaneRect.left : 0;
  const rubberEndY = depDrawState && rightPaneRect ? depDrawState.mouseY - rightPaneRect.top : 0;

  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', overflow: 'hidden', bgcolor: 'background.paper' }}>

      {/* ── TOOLBAR ──────────────────────────────────────────────────────── */}
      <Box sx={{ p: 1.75, px: 2.5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search size={16} color="#64748B" /></InputAdornment>,
              sx: { height: 34, fontSize: 13, width: 200, bgcolor: 'background.default' },
            }}
          />
          <Select
            size="small"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            sx={{ height: 34, fontSize: 12, minWidth: 120, bgcolor: 'background.default' }}
          >
            <MenuItem value="ALL">All Priorities</MenuItem>
            <MenuItem value="URGENT">🔴 Urgent</MenuItem>
            <MenuItem value="HIGH">🟠 High</MenuItem>
            <MenuItem value="NORMAL">🟢 Normal</MenuItem>
            <MenuItem value="LOW">🔵 Low</MenuItem>
          </Select>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={<Switch size="small" checked={autoRescheduleDependencies} onChange={(e) => setAutoRescheduleDependencies(e.target.checked)} color="success" />}
            label={<Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}><RefreshCw size={11} /> Auto-Cascade</Typography>}
            sx={{ mr: 0 }}
          />

          <Tooltip title="Toggle Critical Path (red = critical)">
            <Button
              size="small"
              variant={showCriticalPath ? 'contained' : 'outlined'}
              onClick={() => setShowCriticalPath((v) => !v)}
              startIcon={<GitBranch size={13} />}
              sx={{ height: 32, fontSize: 11, textTransform: 'none', px: 1.5, ...(showCriticalPath ? { bgcolor: '#EF4444', '&:hover': { bgcolor: '#DC2626' }, color: '#fff' } : {}) }}
            >
              Critical Path
            </Button>
          </Tooltip>

          <Button size="small" variant="outlined" onClick={() => setBaseDate(new Date())} sx={{ height: 32, fontSize: 12, textTransform: 'none', px: 1.5 }}>Today</Button>
          <Button size="small" variant="outlined" onClick={handleAutoFit} startIcon={<Maximize2 size={13} />} sx={{ height: 32, fontSize: 12, textTransform: 'none', px: 1.5 }}>Auto Fit</Button>

          <Box sx={{ display: 'flex', border: '1px solid', borderColor: 'divider', borderRadius: '6px', overflow: 'hidden' }}>
            {(['DAY', 'WEEK', 'MONTH'] as TimeScale[]).map((mode) => (
              <Button
                key={mode}
                size="small"
                onClick={() => setScale(mode)}
                sx={{
                  height: 30,
                  fontSize: 11,
                  px: 1.5,
                  borderRadius: 0,
                  bgcolor: scale === mode ? (isDark ? '#16C47F' : '#203020') : 'transparent',
                  color: scale === mode ? (isDark ? '#0F1215' : '#FFFFFF') : 'text.primary',
                  fontWeight: scale === mode ? 700 : 500,
                  '&:hover': { bgcolor: scale === mode ? (isDark ? '#4AB870' : '#2A402A') : 'action.hover' },
                }}
              >
                {mode}
              </Button>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ── DEP TYPE LEGEND ──────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 0.75, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.default', flexWrap: 'wrap' }}>
        <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600, mr: 0.5 }}>DEPENDENCIES:</Typography>
        {(Object.keys(DEP_COLORS) as DepType[]).map((dt) => (
          <Box key={dt} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 20, height: 2, bgcolor: DEP_COLORS[dt], borderRadius: 1 }} />
            <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary' }}>{dt}</Typography>
          </Box>
        ))}
        <Typography variant="caption" sx={{ fontSize: 10, color: 'text.disabled', ml: 'auto' }}>
          Drag bar-edge connectors to create dependencies · Click arrow to edit
        </Typography>
      </Box>

      {/* ── SPLIT-PANE GANTT ─────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', position: 'relative', height: 'calc(100vh - 320px)', minHeight: 480 }}>

        {/* LEFT PANE: Task Tree */}
        <Box
          ref={leftPaneRef}
          onScroll={handleLeftScroll}
          sx={{ width: leftPanelWidth, minWidth: 260, maxWidth: 600, overflowY: 'auto', overflowX: 'hidden', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', zIndex: 10 }}
        >
          {/* Header */}
          <Box sx={{ height: 48, display: 'flex', alignItems: 'center', px: 2, fontWeight: 700, fontSize: '0.8rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid', borderColor: 'divider', position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 12 }}>
            Task / Deliverable Structure
          </Box>

          {visibleNodes.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="textSecondary">No matching tasks in hierarchy.</Typography>
            </Box>
          ) : (
            visibleNodes.map((node) => {
              const isInlineAdding = inlineSubtaskParentId === node.id;
              const isCritical = showCriticalPath && criticalPathIds.has(node.id);
              return (
                <Box key={node.id}>
                  <Box
                    onClick={() => onOpenTaskDetail(node)}
                    sx={{
                      height: ROW_HEIGHT,
                      display: 'flex',
                      alignItems: 'center',
                      px: 1.5,
                      pl: `${node.depth * 20 + 12}px`,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      cursor: 'pointer',
                      bgcolor: isCritical ? 'rgba(239,68,68,0.06)' : node.depth === 0 ? 'background.paper' : 'action.hover',
                      '&:hover': { bgcolor: isCritical ? 'rgba(239,68,68,0.1)' : 'action.selected' },
                      borderLeft: isCritical ? '3px solid #EF4444' : '3px solid transparent',
                    }}
                  >
                    {node.hasChildren ? (
                      <IconButton size="small" onClick={(e) => toggleNodeExpand(node.id, e)} sx={{ p: 0.25, mr: 0.5 }}>
                        {expandedTaskIds[node.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </IconButton>
                    ) : (
                      <Box sx={{ width: 22 }} />
                    )}

                    {node.isMilestone && <Box sx={{ width: 10, height: 10, bgcolor: '#F59E0B', transform: 'rotate(45deg)', mr: 1, flexShrink: 0 }} />}

                    <Chip
                      label={node.task_number ? node.task_number.replace(/0+([1-9]\d*)$/, '$1') : `TASK-${node.id}`}
                      size="small"
                      sx={{ height: 18, fontSize: '0.65rem', mr: 0.75, ...getTaskIdBadgeStyle(node.depth || 0) }}
                    />

                    <Typography
                      variant="body2"
                      sx={{ fontWeight: node.depth === 0 ? 700 : 500, color: node.is_completed ? 'text.secondary' : 'text.primary', textDecoration: node.is_completed ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, mr: 1, fontSize: '0.8rem' }}
                    >
                      {node.title}
                    </Typography>

                    {node.is_blocked && <Tooltip title="Blocked by dependencies"><Lock size={12} color="#DC2626" /></Tooltip>}

                    <Tooltip title="Add subtask">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setInlineSubtaskParentId(isInlineAdding ? null : node.id); }} sx={{ p: 0.5, opacity: 0.6, '&:hover': { opacity: 1, color: isDark ? '#16C47F' : '#203020' } }}>
                        <Plus size={14} />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {isInlineAdding && (
                    <Box sx={{ p: 1, pl: `${(node.depth + 1) * 20 + 20}px`, display: 'flex', gap: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: isDark ? 'rgba(22, 196, 127, 0.08)' : '#F0FDF4' }}>
                      <TextField
                        size="small" fullWidth placeholder="Subtask name..."
                        value={inlineSubtaskTitle}
                        onChange={(e) => setInlineSubtaskTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateSubtaskInline(node.id)}
                        sx={{ '& .MuiOutlinedInput-root': { height: 32, fontSize: 12, bgcolor: 'background.paper' } }}
                        autoFocus
                      />
                      <Button size="small" variant="contained" onClick={() => handleCreateSubtaskInline(node.id)} sx={{ bgcolor: '#203020', '&:hover': { bgcolor: '#2A402A' }, height: 32, textTransform: 'none', px: 1.5, fontSize: 11 }}>Save</Button>
                    </Box>
                  )}
                </Box>
              );
            })
          )}
        </Box>

        {/* RESIZER DIVIDER */}
        <Box
          onMouseDown={handleMouseDownResizer}
          sx={{ width: 4, cursor: 'col-resize', bgcolor: isResizingLeft ? (isDark ? '#16C47F' : '#203020') : 'divider', transition: 'background-color 0.15s ease', zIndex: 15, '&:hover': { bgcolor: isDark ? '#16C47F' : '#203020' } }}
        />

        {/* RIGHT PANE: Timeline */}
        <Box
          ref={(el: HTMLDivElement | null) => { (rightPaneRef as React.MutableRefObject<HTMLDivElement | null>).current = el; (rightPaneContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el; }}
          onScroll={handleRightScroll}
          sx={{ flex: 1, overflowY: 'auto', overflowX: 'auto', position: 'relative', bgcolor: 'background.default', cursor: depDrawState ? 'crosshair' : 'default' }}
        >
          {/* DATE HEADER GRID */}
          <Box sx={{ height: 48, display: 'flex', position: 'sticky', top: 0, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', zIndex: 12, width: totalColumns * columnWidthPx }}>
            {dateHeaders.map((hdr, idx) => (
              <Box
                key={idx}
                sx={{
                  width: columnWidthPx, minWidth: columnWidthPx, height: '100%',
                  borderRight: '1px solid', borderColor: 'divider',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 0.5,
                  bgcolor: hdr.isWeekend ? 'rgba(148,163,184,0.08)' : 'background.paper',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.72rem', color: hdr.isWeekend ? 'text.disabled' : 'text.primary', lineHeight: 1.1 }}>{hdr.label}</Typography>
                <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{hdr.subLabel}</Typography>
              </Box>
            ))}
          </Box>

          {/* TIMELINE ROWS */}
          <Box sx={{ position: 'relative', width: totalColumns * columnWidthPx }}>
            {/* Background Grid + Weekend Shading */}
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
              {dateHeaders.map((hdr, idx) => (
                <Box
                  key={idx}
                  sx={{
                    width: columnWidthPx, minWidth: columnWidthPx, height: '100%',
                    borderRight: '1px dashed', borderColor: 'divider',
                    bgcolor: hdr.isWeekend ? 'rgba(148,163,184,0.06)' : 'transparent',
                  }}
                />
              ))}
            </Box>

            {/* TODAY LINE */}
            {todayPx > 0 && todayPx < totalColumns * columnWidthPx && (
              <Box
                sx={{
                  position: 'absolute', top: 0, bottom: 0, left: `${todayPx}px`, width: 2,
                  bgcolor: '#EF4444', opacity: 0.8, zIndex: 8, pointerEvents: 'none',
                  '&::before': { content: '"TODAY"', position: 'absolute', top: 4, left: 4, fontSize: 9, fontWeight: 700, color: '#EF4444', whiteSpace: 'nowrap', letterSpacing: '0.05em' },
                }}
              />
            )}

            {/* SVG: DEPENDENCY ARROWS + RUBBER-BAND */}
            <svg
              style={{ position: 'absolute', top: 0, left: 0, width: totalColumns * columnWidthPx, height: Math.max(visibleNodes.length * ROW_HEIGHT, 200), pointerEvents: 'none', zIndex: 7 }}
            >
              <defs>
                {(Object.keys(DEP_COLORS) as DepType[]).map((dt) => (
                  <marker key={dt} id={`arrow-${dt}`} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={DEP_COLORS[dt]} />
                  </marker>
                ))}
                <marker id="arrow-rubber" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#94A3B8" />
                </marker>
              </defs>

              {/* Dependency Arrows */}
              {dependencyLines.map((line) => {
                const color = DEP_COLORS[line.depType] || '#10B981';
                const ctrl = Math.max(25, Math.abs(line.x2 - line.x1) / 2);
                const pathD = `M ${line.x1} ${line.y1} C ${line.x1 + ctrl} ${line.y1}, ${line.x2 - ctrl} ${line.y2}, ${line.x2} ${line.y2}`;
                return (
                  <g key={line.id} style={{ pointerEvents: 'all', cursor: 'pointer' }} onClick={() => {
                    setDepPopoverType((line.dep.dep_type || 'FS') as DepType);
                    setDepPopoverLag(line.dep.lag_days || 0);
                    setDepPopoverLagHours(line.dep.lag_hours || 0);
                    setDepPopoverError(null);
                    setDepPopover({ anchorEl: document.getElementById(`gantt-arrow-hit-${line.id}`) || document.body, existingDep: { ...line.dep, fromTaskId: line.dep.fromTaskId, toTaskId: line.dep.toTaskId }, detectedType: (line.dep.dep_type || 'FS') as DepType });
                  }}>
                    {/* Invisible hit area */}
                    <path id={`gantt-arrow-hit-${line.id}`} d={pathD} fill="none" stroke="transparent" strokeWidth={12} />
                    {/* Visible arrow */}
                    <path d={pathD} fill="none" stroke={color} strokeWidth={1.8} markerEnd={`url(#arrow-${line.depType})`} opacity={0.85} />
                    {/* Type label */}
                    <text x={line.midX} y={line.midY - 5} textAnchor="middle" fontSize={9} fontWeight="700" fill={color} fontFamily="monospace">{line.depType}{line.dep.lag_days ? `+${line.dep.lag_days}d` : ''}{line.dep.lag_hours ? `+${line.dep.lag_hours}h` : ''}</text>
                  </g>
                );
              })}

              {/* Rubber-band line while drawing */}
              {depDrawState && (
                <line
                  x1={rubberStartX} y1={rubberStartY}
                  x2={rubberEndX} y2={rubberEndY}
                  stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="6 3"
                  markerEnd="url(#arrow-rubber)"
                />
              )}
            </svg>

            {/* ROW BARS */}
            {visibleNodes.map((node, _nodeIdx) => {
              const coords = getBarPixelCoords(node);
              const isCurrentlyDragging = draggingState?.taskId === node.id;
              const isCritical = showCriticalPath && criticalPathIds.has(node.id);

              let renderLeft = coords ? coords.leftPx : 0;
              let renderWidth = coords ? coords.widthPx : 0;

              if (isCurrentlyDragging && draggingState) {
                const overrideCoords = getBarPixelCoords({ ...node, start_date: draggingState.currentStartDate.toISOString().split('T')[0], due_date: draggingState.currentDueDate.toISOString().split('T')[0] });
                if (overrideCoords) { renderLeft = overrideCoords.leftPx; renderWidth = overrideCoords.widthPx; }
              }

              const barColor = getBarColor(node);

              return (
                <Box
                  key={node.id}
                  sx={{ height: ROW_HEIGHT, display: 'flex', alignItems: 'center', position: 'relative', borderBottom: '1px solid', borderColor: 'divider' }}
                >
                  {coords ? (
                    <>
                      {/* MILESTONE DIAMOND */}
                      {node.isMilestone ? (
                        <Box
                          sx={{
                            position: 'absolute',
                            left: `${renderLeft + renderWidth / 2 - 10}px`,
                            top: '50%',
                            transform: 'translateY(-50%) rotate(45deg)',
                            width: 20, height: 20,
                            bgcolor: '#F59E0B',
                            boxShadow: '0 2px 6px rgba(245,158,11,0.4)',
                            zIndex: 6,
                            cursor: 'pointer',
                          }}
                          onDoubleClick={() => onOpenTaskDetail(node)}
                        />
                      ) : (
                        <Tooltip
                          title={
                            <Box sx={{ p: 0.5 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{node.title}</Typography>
                              <Typography variant="caption" sx={{ display: 'block' }}>Status: {node.status_name || 'Active'} · Priority: {node.priority}</Typography>
                              <Typography variant="caption" sx={{ display: 'block' }}>Dates: {(node.start_date ? formatDate(node.start_date) : '—')} → {(node.due_date ? formatDate(node.due_date) : '—')}</Typography>
                              <Typography variant="caption" sx={{ display: 'block' }}>Progress: {node.progress_percentage || 0}%</Typography>
                              {isCritical && <Typography variant="caption" sx={{ display: 'block', color: '#EF4444', fontWeight: 700 }}>⚠ Critical Path</Typography>}
                            </Box>
                          }
                          arrow
                        >
                          <Box
                            onMouseDown={(e) => handleMouseDownBar(node, 'MOVE', e)}
                            onDoubleClick={() => onOpenTaskDetail(node)}
                            sx={{
                              position: 'absolute',
                              left: `${renderLeft}px`,
                              width: `${renderWidth}px`,
                              height: node.hasChildren ? 26 : 28,
                              bgcolor: barColor,
                              borderRadius: node.hasChildren ? '3px' : '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              px: 1,
                              color: '#FFFFFF',
                              boxShadow: isCritical ? `0 0 0 2px #EF4444, 0 2px 6px rgba(239,68,68,0.3)` : '0 2px 4px rgba(0,0,0,0.12)',
                              cursor: 'grab',
                              zIndex: 6,
                              userSelect: 'none',
                              transition: isCurrentlyDragging ? 'none' : 'all 0.15s ease',
                              opacity: isCurrentlyDragging ? 0.88 : 1,
                              '&:active': { cursor: node.hasChildren ? 'default' : 'grabbing' },
                            }}
                          >
                            {/* LEFT RESIZE HANDLE + CONNECTOR */}
                            {!node.hasChildren && (
                              <Box
                                sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 10, cursor: 'ew-resize', zIndex: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                onMouseDown={(e) => { e.stopPropagation(); handleMouseDownBar(node, 'RESIZE_LEFT', e); }}
                              >
                                <Box
                                  id={`dep-connector-${node.id}-left`}
                                  onMouseDown={(e) => { e.stopPropagation(); handleDepConnectorMouseDown(node.id, 'left', e); }}
                                  onMouseEnter={() => setHoverConnectorTaskId({ taskId: node.id, edge: 'left' })}
                                  onMouseLeave={() => setHoverConnectorTaskId(null)}
                                  sx={{
                                    width: 10, height: 10, borderRadius: '50%', bgcolor: '#FFFFFF', border: '2px solid rgba(255,255,255,0.5)',
                                    cursor: 'crosshair', zIndex: 9,
                                    transition: 'all 0.1s ease',
                                    opacity: (depDrawState || hoverConnectorTaskId?.taskId === node.id) ? 1 : 0,
                                    '&:hover': { opacity: 1, transform: 'scale(1.3)' },
                                  }}
                                />
                              </Box>
                            )}

                            {/* Progress Fill */}
                            {(node.progress_percentage || 0) > 0 && (
                              <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${node.progress_percentage}%`, bgcolor: 'rgba(255,255,255,0.22)', borderRadius: 'inherit', pointerEvents: 'none' }} />
                            )}

                            {/* Bar Label */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, zIndex: 2, ml: 1, overflow: 'hidden', flex: 1 }}>
                              {node.assignees?.length > 0 && (
                                <Avatar sx={{ width: 18, height: 18, fontSize: 9, bgcolor: 'rgba(255,255,255,0.3)' }}>
                                  {(node.assignees[0] as any).full_name?.[0] || '?'}
                                </Avatar>
                              )}
                              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.68rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#FFFFFF' }}>
                                {node.title}
                              </Typography>
                            </Box>

                            {/* RIGHT RESIZE HANDLE + CONNECTOR */}
                            {!node.hasChildren && (
                              <Box
                                sx={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 10, cursor: 'ew-resize', zIndex: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                onMouseDown={(e) => { e.stopPropagation(); handleMouseDownBar(node, 'RESIZE_RIGHT', e); }}
                              >
                                <Box
                                  id={`dep-connector-${node.id}-right`}
                                  onMouseDown={(e) => { e.stopPropagation(); handleDepConnectorMouseDown(node.id, 'right', e); }}
                                  onMouseEnter={() => setHoverConnectorTaskId({ taskId: node.id, edge: 'right' })}
                                  onMouseLeave={() => setHoverConnectorTaskId(null)}
                                  sx={{
                                    width: 10, height: 10, borderRadius: '50%', bgcolor: '#FFFFFF', border: '2px solid rgba(255,255,255,0.5)',
                                    cursor: 'crosshair', zIndex: 9,
                                    transition: 'all 0.1s ease',
                                    opacity: (depDrawState || hoverConnectorTaskId?.taskId === node.id) ? 1 : 0,
                                    '&:hover': { opacity: 1, transform: 'scale(1.3)' },
                                  }}
                                />
                              </Box>
                            )}
                          </Box>
                        </Tooltip>
                      )}
                    </>
                  ) : (
                    <Typography variant="caption" sx={{ pl: 2, color: 'text.secondary', fontStyle: 'italic', fontSize: '0.7rem' }}>No dates scheduled</Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* ── DEPENDENCY POPOVER ────────────────────────────────────────────── */}
      <Popover
        open={!!depPopover}
        anchorEl={depPopover?.anchorEl || null}
        onClose={() => setDepPopover(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        PaperProps={{ sx: { width: 320, p: 2.5, borderRadius: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' } }}
      >
        {depPopover && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Network size={15} /> {depPopover.existingDep ? 'Edit Dependency' : 'Create Dependency'}
              </Typography>
              <IconButton size="small" onClick={() => setDepPopover(null)}><X size={14} /></IconButton>
            </Box>

            {depPopover.existingDep ? (
              <Box sx={{ mb: 2, p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5, letterSpacing: 0.5 }}>
                  LINKED TASKS (READ-ONLY)
                </Typography>
                <Typography variant="caption" sx={{ fontSize: 11, color: 'text.primary', fontWeight: 600, display: 'block' }}>
                  From: {depPopover.existingDep.predecessor_task_title ? `${depPopover.existingDep.predecessor_task_number || `Task #${depPopover.existingDep.fromTaskId}`} - ${depPopover.existingDep.predecessor_task_title}` : `Task #${depPopover.existingDep.fromTaskId}`}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: 11, color: 'text.primary', fontWeight: 600, display: 'block' }}>
                  To: {depPopover.existingDep.depends_on_task_title ? `${depPopover.existingDep.depends_on_task_number || `Task #${depPopover.existingDep.toTaskId}`} - ${depPopover.existingDep.depends_on_task_title}` : `Task #${depPopover.existingDep.toTaskId}`}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, fontStyle: 'italic', fontSize: 10 }}>
                  Task details cannot be changed here. Only dependency type and lag days are editable.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ mb: 2, p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary' }}>
                  From: Task #{depPopover.fromTaskId} → To: Task #{depPopover.toTaskId}
                </Typography>
              </Box>
            )}

            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5, display: 'block', fontSize: 11 }}>DEPENDENCY TYPE</Typography>
            <Select
              fullWidth
              size="small"
              value={depPopoverType}
              onChange={(e) => setDepPopoverType(e.target.value as DepType)}
              sx={{ mb: 2 }}
            >
              {(Object.keys(DEP_LABELS) as DepType[]).map((dt) => (
                <MenuItem key={dt} value={dt}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: DEP_COLORS[dt] }} />
                    <strong>{dt}</strong>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}> — {DEP_LABELS[dt]}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>

            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5, display: 'block', fontSize: 11 }}>LAG DAYS</Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  value={depPopoverLag}
                  onChange={(e) => setDepPopoverLag(parseInt(e.target.value) || 0)}
                  inputProps={{ min: -30, max: 60 }}
                />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5, display: 'block', fontSize: 11 }}>LAG HOURS</Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  value={depPopoverLagHours}
                  onChange={(e) => setDepPopoverLagHours(parseInt(e.target.value) || 0)}
                  inputProps={{ min: 0, max: 23 }}
                />
              </Grid>
            </Grid>

            {depPopoverError && (
              <Alert severity="error" icon={<AlertTriangle size={14} />} sx={{ mb: 2, py: 0.5, fontSize: 12 }}>{depPopoverError}</Alert>
            )}

            <Divider sx={{ mb: 2 }} />

            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
              {depPopover.existingDep && (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<Trash2 size={13} />}
                  onClick={handleDeleteDep}
                  disabled={depPopoverLoading}
                  sx={{ textTransform: 'none', fontSize: 12 }}
                >
                  Remove
                </Button>
              )}
              <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
                <Button size="small" variant="outlined" onClick={() => setDepPopover(null)} sx={{ textTransform: 'none', fontSize: 12 }}>Cancel</Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={depPopover.existingDep ? handleUpdateDep : handleCreateDep}
                  disabled={depPopoverLoading}
                  startIcon={depPopoverLoading ? <CircularProgress size={12} color="inherit" /> : <Check size={13} />}
                  sx={{ bgcolor: '#203020', '&:hover': { bgcolor: '#2A402A' }, textTransform: 'none', fontSize: 12 }}
                >
                  {depPopover.existingDep ? 'Update' : 'Link Tasks'}
                </Button>
              </Box>
            </Box>
          </>
        )}
      </Popover>
    </Paper>
  );
}
