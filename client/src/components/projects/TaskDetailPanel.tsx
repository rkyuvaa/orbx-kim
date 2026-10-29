import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  IconButton,
  Typography,
  Divider,
  Grid,
  Chip,
  Avatar,
  AvatarGroup,
  TextField,
  Button,
  LinearProgress,
  CircularProgress,
  Paper,
  Select,
  MenuItem,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Menu,
  InputAdornment,
  Autocomplete,
  useTheme,
} from '@mui/material';
import {
  X,
  Clock,
  Calendar,
  CheckSquare,
  ListTree,
  MessageSquare,
  Paperclip,
  Lock,
  FileText,
  UploadCloud,
  Trash2,
  Play,
  Square,
  Send,
  Edit2,
  Check,
  UserPlus,
  Tag as TagIcon,
  Activity as ActivityIcon,
  Plus,
  ArrowRight,
  Search,
  Link2,
  MoreVertical,
  AlertTriangle,
} from 'lucide-react';
import {
  TaskItem,
  TaskDependencyInfo,
  useToggleSubtaskMutation,
  useAddSubtaskMutation,
  useDeleteSubtaskMutation,
  useUpdateTaskMutation,
  useLogTimeMutation,
  useAddCommentMutation,
  useGetTaskCommentsQuery,
  useGetTaskAttachmentsQuery,
  useAddTaskAttachmentMutation,
  useDeleteTaskAttachmentMutation,
  useGetCustomFieldDefinitionsQuery,
  useGetTaskCustomFieldsQuery,
  useSaveTaskCustomFieldMutation,
  useStartTimerMutation,
  useStopTimerMutation,
  useAddChecklistMutation,
  useAddChecklistItemMutation,
  useToggleChecklistItemMutation,
  useConvertChecklistItemToSubtaskMutation,
  useAddFollowerMutation,
  useRemoveFollowerMutation,
  useAddDependencyMutation,
  useUpdateDependencyMutation,
  useRemoveDependencyMutation,
  useGetTaskQuery,
  useGetTasksQuery,
  useGetStatusDefinitionsQuery,
  useGetCalendarConfigQuery,
  useGetProjectMilestonesQuery,
  useGetProjectTaskListsQuery,
  useConvertSubtaskToTaskMutation,
  useConvertTaskToSubtaskMutation,
  useAutoAdjustTaskDateMutation,
  useGetTaskTagsQuery,
} from '@/api/projectsApi';
import { useUsersQuery, useCostCentersQuery } from '@/api/mastersApi';
import { useToast } from '@/components/ui/ToastHost';
import { time24To12, time12To24, getTaskIdBadgeStyle, formatDate, formatDateTime } from '@/utils/format';
import AutoSaveStatusBadge from '@/components/common/AutoSaveStatusBadge';
import { useAutoSave } from '@/hooks/useAutoSave';

interface TaskDetailPanelProps {
  open: boolean;
  onClose: () => void;
  task: TaskItem | null;
  initialEditingDep?: TaskDependencyInfo | null;
}

export default function TaskDetailPanel({ open, onClose, task, initialEditingDep }: TaskDetailPanelProps) {
  const [commentText, setCommentText] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Editable Title & Description State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Editable Date & Time State
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [completionTime, setCompletionTime] = useState('');
  const [duration, setDuration] = useState<number | ''>(1);
  const [durationHours, setDurationHours] = useState<number | ''>(0);
  const [reminderAt, setReminderAt] = useState('');
  const [recurrenceType, setRecurrenceType] = useState('None');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [editSeries, setEditSeries] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [estimatedCost, setEstimatedCost] = useState<number | ''>('');
  const [actualCost, setActualCost] = useState<number | ''>('');
  const [estimatedHours, setEstimatedHours] = useState<number | ''>('');

  // Checklist State
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [newChecklistItemTitles, setNewChecklistItemTitles] = useState<Record<number, string>>({});

  // Dependency Dialog & Warning State
  const [isAddDepDialogOpen, setIsAddDepDialogOpen] = useState(false);
  const [editingDep, setEditingDep] = useState<TaskDependencyInfo | null>(null);
  const [editDepType, setEditDepType] = useState<'FS' | 'SS' | 'FF' | 'SF'>('FS');
  const [editDepLagDays, setEditDepLagDays] = useState<number>(0);
  const [editDepLagHours, setEditDepLagHours] = useState<number>(0);
  const [depDirection, setDepDirection] = useState<'BLOCKING' | 'BLOCKED_BY'>('BLOCKED_BY');
  const [depSearchQuery, setDepSearchQuery] = useState('');
  const [depRelType, setDepRelType] = useState<'FS' | 'SS' | 'FF' | 'SF'>('FS');
  const [depLagDays, setDepLagDays] = useState<number>(0);
  const [depLagHours, setDepLagHours] = useState<number>(0);
  const [blockedWarning, setBlockedWarning] = useState<{
    open: boolean;
    targetStatusId?: number;
    targetIsCompleted?: boolean;
    blockingTasks: string[];
  }>({ open: false, blockingTasks: [] });

  // Dependency State
  const [depTaskId, setDepTaskId] = useState<number | ''>('');
  const [depType, setDepType] = useState<'BLOCKS' | 'BLOCKED_BY' | 'WAITING_ON'>('BLOCKED_BY');

  // Stopwatch Timer State
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Custom Field editing state
  const [editingFieldId, setEditingFieldId] = useState<number | null>(null);
  const [editFieldValue, setEditFieldValue] = useState('');

  const { showToast } = useToast();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [toggleSubtask] = useToggleSubtaskMutation();
  const [addSubtask, { isLoading: isAddingSubtask }] = useAddSubtaskMutation();
  const [deleteSubtask] = useDeleteSubtaskMutation();
  const [updateTask] = useUpdateTaskMutation();
  const [logTime] = useLogTimeMutation();
  const [addComment, { isLoading: isAddingComment }] = useAddCommentMutation();

  const [startTimerApi] = useStartTimerMutation();
  const [stopTimerApi] = useStopTimerMutation();

  const [addChecklistApi] = useAddChecklistMutation();
  const [addChecklistItemApi] = useAddChecklistItemMutation();
  const [toggleChecklistItemApi] = useToggleChecklistItemMutation();
  const [convertChecklistItemApi] = useConvertChecklistItemToSubtaskMutation();

  const [addFollowerApi] = useAddFollowerMutation();
  const [removeFollowerApi] = useRemoveFollowerMutation();

  const [addDependencyApi] = useAddDependencyMutation();
  const [updateDependencyApi, { isLoading: isUpdatingDep }] = useUpdateDependencyMutation();
  const [removeDependencyApi] = useRemoveDependencyMutation();
  const [autoAdjustTaskDateApi, { isLoading: isAutoAdjusting }] = useAutoAdjustTaskDateMutation();

  const { data: users = [] } = useUsersQuery();
  const { data: costCenters = [] } = useCostCentersQuery();

  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);

  useEffect(() => {
    if (task) {
      setActiveTaskId(task.id);
    }
  }, [task?.id]);

  useEffect(() => {
    if (initialEditingDep) {
      handleOpenEditDep(initialEditingDep);
    }
  }, [initialEditingDep]);

  const currentTaskId = activeTaskId || task?.id || 0;
  const { data: liveTask } = useGetTaskQuery(currentTaskId, { skip: !currentTaskId });
  const currentTask = liveTask || task;
  const targetProjectId = currentTask?.project_id ? Number(currentTask.project_id) : undefined;
  const { data: searchTasksResult = [] } = useGetTasksQuery(
    { q: depSearchQuery, project_id: targetProjectId, include_subtasks: true },
    { skip: !isAddDepDialogOpen }
  );
  const { data: statuses = [] } = useGetStatusDefinitionsQuery();
  const { data: taskTags = [] } = useGetTaskTagsQuery();
  const { data: projectMilestones = [] } = useGetProjectMilestonesQuery(currentTask?.project_id || 0, {
    skip: !currentTask?.project_id,
  });
  const { data: projectTaskLists = [] } = useGetProjectTaskListsQuery(currentTask?.project_id || 0, {
    skip: !currentTask?.project_id,
  });
  const availableTaskLists = projectTaskLists.filter(
    (tl) => !currentTask?.milestone_id || tl.milestone_id === currentTask.milestone_id
  );
  const { data: calendarConfig } = useGetCalendarConfigQuery();
  const dailyWorkingHours = calendarConfig?.daily_working_hours ?? 9;

  const handleConfirmOverrideCompletion = async () => {
    try {
      if (blockedWarning.targetStatusId) {
        await updateTask({
          id: currentTaskId,
          body: { status_id: blockedWarning.targetStatusId, override_dependencies: true },
        }).unwrap();
      } else if (blockedWarning.targetIsCompleted !== undefined) {
        await updateTask({
          id: currentTaskId,
          body: { is_completed: blockedWarning.targetIsCompleted, override_dependencies: true },
        }).unwrap();
      }
      showToast('Completed task overriding dependencies', 'warning');
      setBlockedWarning({ open: false, blockingTasks: [] });
    } catch {
      showToast('Failed to complete task', 'error');
    }
  };

  const { data: comments = [] } = useGetTaskCommentsQuery(currentTaskId, { skip: !currentTaskId });
  const { data: attachments = [], isLoading: isLoadingAttachments } = useGetTaskAttachmentsQuery(currentTaskId, { skip: !currentTaskId });
  const [addTaskAttachment] = useAddTaskAttachmentMutation();
  const [deleteTaskAttachment] = useDeleteTaskAttachmentMutation();

  const { data: customDefs = [] } = useGetCustomFieldDefinitionsQuery();
  const { data: customValues = [] } = useGetTaskCustomFieldsQuery(currentTaskId, { skip: !currentTaskId });
  const [saveCustomField] = useSaveTaskCustomFieldMutation();

  // Populate local title, description and dates on task change
  useEffect(() => {
    if (currentTask) {
      // Sanitize date: if year < 1900, treat as empty (corrupted DB value e.g. year 0002)
      const sanitizeDate = (raw: string | null | undefined): string => {
        if (!raw) return '';
        const d = raw.split('T')[0].split(' ')[0]; // YYYY-MM-DD
        const year = parseInt(d.split('-')[0] || '0', 10);
        return year >= 1900 ? d : '';
      };

      setTitle(currentTask.title || '');
      setDescription(currentTask.description || '');
      setStartDate(sanitizeDate(currentTask.start_date));
      setStartTime(currentTask.start_time || '');
      setDueDate(sanitizeDate(currentTask.due_date));
      setDueTime(currentTask.due_time || '');
      setCompletionDate(sanitizeDate(currentTask.completion_date));
      setCompletionTime(currentTask.completion_time || '');
      setDuration(currentTask.duration_working_days ?? 1);
      setDurationHours(currentTask.duration_working_hours ?? 0);
      
      setTags(currentTask.tags_list?.map(t => t.name) || []);
      setReminderAt(currentTask.reminder_at ? currentTask.reminder_at.substring(0,16) : '');
      setRecurrenceType(currentTask.recurrence_rule?.type || 'None');
      setRecurrenceEndDate(sanitizeDate(currentTask.recurrence_end_date));
      setEditSeries(false);

      setEstimatedCost(currentTask.estimated_cost !== undefined && currentTask.estimated_cost !== null ? currentTask.estimated_cost : '');
      setActualCost(currentTask.actual_cost !== undefined && currentTask.actual_cost !== null ? currentTask.actual_cost : '');
      setEstimatedHours(currentTask.estimated_hours !== undefined && currentTask.estimated_hours !== null ? currentTask.estimated_hours : '');
    }
  }, [
    currentTask?.id,
    currentTask?.title,
    currentTask?.description,
    currentTask?.start_date,
    currentTask?.start_time,
    currentTask?.due_date,
    currentTask?.due_time,
    currentTask?.completion_date,
    currentTask?.completion_time,
    currentTask?.duration_working_days,
    currentTask?.duration_working_hours,
    currentTask?.tags_list,
    currentTask?.reminder_at,
    currentTask?.recurrence_rule,
    currentTask?.recurrence_end_date,
    currentTask?.estimated_cost,
    currentTask?.actual_cost,
    currentTask?.estimated_hours,
  ]);

  const autoSave = useAutoSave({
    onSave: async (patch) => {
      if (!currentTaskId) return;
      return await updateTask({ id: currentTaskId, body: patch }).unwrap();
    },
    onError: (_patch, err) => {
      showToast(err?.data?.detail || 'Failed to save changes', 'error');
    },
  });


  // Timer Tick Effect
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  if (!task) return null;

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTitleBlur = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(currentTask?.title || '');
      return;
    }
    await autoSave.saveField('title', trimmed, currentTask?.title);
  };

  const handleDescriptionBlur = async () => {
    await autoSave.saveField('description', description.trim(), currentTask?.description || '');
  };

  const handleToggleTimer = async () => {
    if (!isTimerRunning) {
      try {
        await startTimerApi(task.id).unwrap();
        setIsTimerRunning(true);
        showToast('Stopwatch timer started ⏱️', 'info');
      } catch {
        showToast('Could not start timer', 'error');
      }
    } else {
      try {
        await stopTimerApi({ taskId: task.id, description: `Stopwatch session: ${formatTimer(timerSeconds)}` }).unwrap();
        setIsTimerRunning(false);
        setTimerSeconds(0);
        showToast('Timer stopped & work logged!', 'success');
      } catch {
        showToast('Could not stop timer', 'error');
      }
    }
  };

  const handleStatusChange = async (statusId: number) => {
    await autoSave.saveField('status_id', statusId, currentTask?.status_id);
  };

  const handleMilestoneChange = async (milestoneId: number | '') => {
    await autoSave.saveMultiple(
      { milestone_id: milestoneId ? Number(milestoneId) : null, task_list_id: null },
      { milestone_id: currentTask?.milestone_id ?? null, task_list_id: currentTask?.task_list_id ?? null }
    );
  };

  const handleTaskListChange = async (taskListId: number | '') => {
    await autoSave.saveField('task_list_id', taskListId ? Number(taskListId) : null, currentTask?.task_list_id ?? null);
  };

  const handlePriorityChange = async (priority: string) => {
    await autoSave.saveField('priority', priority, currentTask?.priority);
  };

  const handleStartDateChange = async (d: string) => {
    const cleanDate = d ? d.split('T')[0].split(' ')[0] : '';
    setStartDate(cleanDate);
    await autoSave.saveField('start_date', cleanDate || null, currentTask?.start_date ? currentTask.start_date.split('T')[0] : null);
  };

  const handleStartTimeBlur = async () => {
    await autoSave.saveField('start_time', startTime || null, currentTask?.start_time || null);
  };

  const handleDueDateChange = async (d: string) => {
    const cleanDate = d ? d.split('T')[0].split(' ')[0] : '';
    setDueDate(cleanDate);
    await autoSave.saveField('due_date', cleanDate || null, currentTask?.due_date ? currentTask.due_date.split('T')[0] : null);
  };

  const handleDueTimeBlur = async () => {
    await autoSave.saveField('due_time', dueTime || null, currentTask?.due_time || null);
  };

  const handleCompletionDateChange = async (d: string) => {
    const cleanDate = d ? d.split('T')[0].split(' ')[0] : '';
    setCompletionDate(cleanDate);
    await autoSave.saveField('completion_date', cleanDate || null, currentTask?.completion_date ? currentTask.completion_date.split('T')[0] : null);
  };

  const handleCompletionTimeBlur = async () => {
    await autoSave.saveField('completion_time', completionTime || null, currentTask?.completion_time || null);
  };

  const handleDurationChange = async (days: number, hours: number) => {
    if (!currentTaskId) return;
    if (hours >= dailyWorkingHours) {
      const extraDays = Math.floor(hours / dailyWorkingHours);
      hours = hours % dailyWorkingHours;
      days += extraDays;
    }
    if (days === 0 && hours === 0) days = 1;
    setDuration(days);
    setDurationHours(hours);
    await autoSave.saveMultiple(
      { duration_working_days: days, duration_working_hours: hours },
      { duration_working_days: currentTask?.duration_working_days ?? 1, duration_working_hours: currentTask?.duration_working_hours ?? 0 }
    );
  };

  const handleTagsChange = async (newTags: string[]) => {
    setTags(newTags);
    const currentTags = currentTask?.tags_list?.map(t => t.name) || [];
    await autoSave.saveField('tag_names', newTags, currentTags);
  };

  const handleReminderBlur = async () => {
    const reminderIso = reminderAt ? new Date(reminderAt).toISOString() : null;
    await autoSave.saveField('reminder_at', reminderIso, currentTask?.reminder_at || null);
  };

  const handleRecurrenceTypeChange = async (val: string) => {
    setRecurrenceType(val);
    await autoSave.saveMultiple(
      { recurrence_rule: val !== 'None' ? { type: val } : null, edit_series: editSeries },
      { recurrence_rule: currentTask?.recurrence_rule ?? null, edit_series: false }
    );
  };

  const handleRecurrenceEndDateChange = async (d: string) => {
    setRecurrenceEndDate(d);
    await autoSave.saveMultiple(
      { recurrence_end_date: d || null, edit_series: editSeries },
      { recurrence_end_date: currentTask?.recurrence_end_date || null, edit_series: false }
    );
  };

  const handleAutoAdjustDate = async () => {
    if (!currentTaskId) return;
    try {
      await autoAdjustTaskDateApi(currentTaskId).unwrap();
      showToast('Dates automatically adjusted to resolve conflict', 'success');
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to auto adjust date', 'error');
    }
  };

  const handleEstimatedHoursBlur = async () => {
    const val = estimatedHours === '' ? 0 : Number(estimatedHours);
    await autoSave.saveMultiple(
      { estimated_hours: val, estimated_minutes: Math.round(val * 60) },
      { estimated_hours: currentTask?.estimated_hours ?? 0, estimated_minutes: currentTask?.estimated_minutes ?? 0 }
    );
  };

  const handleEstimatedCostBlur = async () => {
    const val = estimatedCost === '' ? 0 : Number(estimatedCost);
    await autoSave.saveField('estimated_cost', val, currentTask?.estimated_cost ?? 0);
  };

  const handleActualCostBlur = async () => {
    const val = actualCost === '' ? 0 : Number(actualCost);
    await autoSave.saveField('actual_cost', val, currentTask?.actual_cost ?? 0);
  };

  const handleCostCenterChange = async (ccId: number | '') => {
    await autoSave.saveField('cost_center_id', ccId || null, currentTask?.cost_center_id ?? null);
  };

  const handleAssigneeChange = async (selectedUserIds: number[]) => {
    const currentIds = (currentTask?.assignees || []).map(a => a.user_id || a.id);
    await autoSave.saveField('assignee_ids', selectedUserIds, currentIds);
  };

  const handleFollowerChange = async (selectedUserIds: number[]) => {
    const currentIds = (currentTask?.followers || []).map(f => f.user_id || f.id);
    await autoSave.saveField('follower_ids', selectedUserIds, currentIds);
  };

  const handleCustomFieldBlur = async (fieldId: number) => {
    const currentVal = customValues.find(v => v.field_id === fieldId)?.value || '';
    if (editFieldValue.trim() === currentVal.trim()) {
      setEditingFieldId(null);
      return;
    }
    autoSave.setStatus('saving');
    try {
      await saveCustomField({ taskId: currentTaskId, field_id: fieldId, value: editFieldValue.trim() }).unwrap();
      autoSave.setStatus('saved');
      setEditingFieldId(null);
    } catch (err: any) {
      autoSave.setStatus('error');
      showToast(err?.data?.detail || 'Failed to save custom field', 'error');
    }
  };

  const handleToggleSubtask = async (subtaskId: number) => {
    try {
      await toggleSubtask(subtaskId).unwrap();
    } catch {
      showToast('Failed to update subtask', 'error');
    }
  };

  const handleDeleteSubtask = async (subtaskId: number) => {
    try {
      await deleteSubtask(subtaskId).unwrap();
      showToast('Subtask deleted', 'info');
    } catch {
      showToast('Failed to delete subtask', 'error');
    }
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    try {
      await addSubtask({
        taskId: currentTaskId,
        title: newSubtaskTitle.trim(),
      }).unwrap();
      setNewSubtaskTitle('');
      showToast('Subtask added', 'success');
    } catch {
      showToast('Failed to add subtask', 'error');
    }
  };

  const handleAddChecklist = async () => {
    if (!newChecklistTitle.trim()) return;
    try {
      await addChecklistApi({ taskId: currentTaskId, title: newChecklistTitle.trim() }).unwrap();
      setNewChecklistTitle('');
      showToast('Checklist created', 'success');
    } catch {
      showToast('Failed to create checklist', 'error');
    }
  };

  const handleAddChecklistItem = async (checklistId: number) => {
    const itemTitle = newChecklistItemTitles[checklistId];
    if (!itemTitle || !itemTitle.trim()) return;
    try {
      await addChecklistItemApi({ taskId: currentTaskId, checklistId, title: itemTitle.trim() }).unwrap();
      setNewChecklistItemTitles((prev) => ({ ...prev, [checklistId]: '' }));
      showToast('Item added to checklist', 'success');
    } catch {
      showToast('Failed to add checklist item', 'error');
    }
  };

  const handleToggleChecklistItem = async (itemId: number) => {
    try {
      await toggleChecklistItemApi({ taskId: currentTaskId, itemId }).unwrap();
    } catch {
      showToast('Failed to toggle item', 'error');
    }
  };

  const handleConvertChecklistItemToSubtask = async (itemId: number) => {
    try {
      await convertChecklistItemApi({ taskId: currentTaskId, itemId }).unwrap();
      showToast('Converted checklist item to subtask!', 'success');
    } catch {
      showToast('Failed to convert to subtask', 'error');
    }
  };

  const handleAddDependency = async () => {
    if (!depTaskId) return;
    try {
      await addDependencyApi({
        taskId: currentTaskId,
        depends_on_task_id: Number(depTaskId),
        dependency_type: depType,
      }).unwrap();
      setDepTaskId('');
      showToast('Dependency added', 'success');
    } catch (err: any) {
      showToast(err?.data?.detail?.message || 'Could not add dependency (anti-circular rule enforced)', 'error');
    }
  };

  const handleRemoveDependency = async (depId: number) => {
    try {
      await removeDependencyApi({ taskId: currentTaskId, dependencyId: depId }).unwrap();
      showToast('Dependency removed', 'info');
    } catch {
      showToast('Failed to remove dependency', 'error');
    }
  };

  const handleOpenEditDep = (dep: TaskDependencyInfo) => {
    setEditingDep(dep);
    const resolvedType = (dep.dep_type || 'FS').toUpperCase();
    setEditDepType((['FS', 'SS', 'FF', 'SF'].includes(resolvedType) ? resolvedType : 'FS') as 'FS' | 'SS' | 'FF' | 'SF');
    setEditDepLagDays(dep.lag_days ?? 0);
    setEditDepLagHours(dep.lag_hours ?? 0);
  };

  const handleUpdateDependency = async () => {
    if (!editingDep) return;
    if (editDepLagHours >= dailyWorkingHours) {
      showToast(`Lag hours (${editDepLagHours}h) must be less than daily working hours (${dailyWorkingHours}h)`, 'error');
      return;
    }
    try {
      await updateDependencyApi({
        dependencyId: editingDep.id,
        dep_type: editDepType,
        lag_days: Number(editDepLagDays) || 0,
        lag_hours: Number(editDepLagHours) || 0,
      }).unwrap();
      showToast('Dependency updated successfully', 'success');
      setEditingDep(null);
      if (initialEditingDep) {
        onClose();
      }
    } catch (err: any) {
      showToast(err?.data?.detail?.message || err?.data?.detail || 'Failed to update dependency', 'error');
    }
  };

  const formatDepChipLabel = (dep: TaskDependencyInfo) => {
    const type = dep.dep_type || 'FS';
    const d = dep.lag_days ? (dep.lag_days > 0 ? `+${dep.lag_days}d` : `${dep.lag_days}d`) : '';
    const h = dep.lag_hours ? (dep.lag_hours > 0 ? `+${dep.lag_hours}h` : `${dep.lag_hours}h`) : '';
    const lagStr = [d, h].filter(Boolean).join(' ');
    return lagStr ? `${type} ${lagStr}` : type;
  };

  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    try {
      await addComment({
        taskId: currentTaskId,
        content: commentText.trim(),
      }).unwrap();
      setCommentText('');
      showToast('Comment posted with @mention notifications', 'success');
    } catch {
      showToast('Failed to post comment', 'error');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileSizeFormatted = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
        try {
          await addTaskAttachment({
            taskId: currentTaskId,
            filename: file.name,
            file_size: fileSizeFormatted,
          }).unwrap();
          showToast(`Attached ${file.name}`, 'success');
        } catch {
          showToast(`Failed to attach ${file.name}`, 'error');
        }
      }
    }
  };

  const handleRemoveAttachment = async (id: number) => {
    try {
      await deleteTaskAttachment(id).unwrap();
      showToast('Attachment removed', 'info');
    } catch {
      showToast('Failed to remove attachment', 'error');
    }
  };

  const handleSaveCustomField = async (fieldId: number) => {
    try {
      await saveCustomField({
        taskId: currentTaskId,
        field_id: fieldId,
        value: editFieldValue.trim() || undefined,
      }).unwrap();
      showToast('Custom field saved', 'success');
      setEditingFieldId(null);
      setEditFieldValue('');
    } catch {
      showToast('Failed to save custom field value', 'error');
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 680, md: 940 }, p: 0, bgcolor: 'background.default' },
      }}
    >
      {/* Header Toolbar */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {currentTask?.parent_task_id && (
            <Button
              size="small"
              startIcon={<ArrowRight style={{ transform: 'rotate(180deg)' }} size={13} />}
              onClick={() => setActiveTaskId(currentTask.parent_task_id!)}
              sx={{
                textTransform: 'none',
                fontSize: 12,
                py: 0.25,
                px: 1,
                color: isDark ? '#16C47F' : '#203020',
                fontWeight: 700,
                bgcolor: isDark ? 'rgba(22, 196, 127, 0.12)' : 'rgba(32, 48, 32, 0.08)',
                '&:hover': {
                  bgcolor: isDark ? 'rgba(22, 196, 127, 0.2)' : 'rgba(32, 48, 32, 0.14)',
                },
              }}
            >
              Parent Task
            </Button>
          )}
          <Chip
            label={currentTask?.task_number ? currentTask.task_number.replace(/0+([1-9]\d*)$/, '$1') : `TASK-${currentTask?.id}`}
            size="small"
            sx={{ ...getTaskIdBadgeStyle(currentTask) }}
          />
          <Chip
            label={currentTask?.priority || 'NORMAL'}
            size="small"
            sx={{
              bgcolor: currentTask?.priority === 'URGENT' ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2') : currentTask?.priority === 'HIGH' ? (isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7') : (isDark ? 'rgba(22, 196, 127, 0.15)' : '#203020'),
              color: currentTask?.priority === 'URGENT' ? '#EF4444' : currentTask?.priority === 'HIGH' ? '#F59E0B' : (isDark ? '#16C47F' : '#FFFFFF'),
              fontWeight: 700,
            }}
          />
          <AutoSaveStatusBadge
            status={autoSave.status}
            lastSaved={autoSave.lastSaved}
            errorMessage={autoSave.errorMessage}
            onRetry={autoSave.retry}
          />
        </Box>

        {/* Stopwatch Timer Widget */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Paper
            variant="outlined"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 0.5,
              borderRadius: '20px',
              bgcolor: isTimerRunning ? (isDark ? 'rgba(22, 196, 127, 0.12)' : '#F0FDF4') : 'background.paper',
              borderColor: isTimerRunning ? (isDark ? '#16C47F' : '#203020') : 'divider',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace', color: isTimerRunning ? (isDark ? '#16C47F' : '#203020') : 'text.primary' }}>
              {formatTimer(timerSeconds)}
            </Typography>
            <Button
              size="small"
              variant={isTimerRunning ? 'contained' : 'outlined'}
              color={isTimerRunning ? 'error' : 'primary'}
              startIcon={isTimerRunning ? <Square size={12} /> : <Play size={12} />}
              onClick={handleToggleTimer}
              sx={{ height: 24, fontSize: 11, textTransform: 'none', px: 1 }}
            >
              {isTimerRunning ? 'Stop & Log' : 'Start Timer'}
            </Button>
          </Paper>

          <IconButton size="small" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </Box>
      </Box>

      {/* Panel Body */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, height: { xs: 'auto', md: 'calc(100dvh - 65px)' }, minHeight: 0 }}>
        {/* Left Column (Details, Subtasks, Checklists, Comments) */}
        <Box sx={{ flex: 1, p: 3, overflowY: 'auto', bgcolor: 'background.paper' }}>
          {/* Editable Title */}
          <TextField
            fullWidth
            variant="standard"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Task title..."
            InputProps={{
              disableUnderline: true,
              sx: { fontSize: '1.4rem', fontWeight: 700, color: 'text.primary', mb: 2 },
            }}
          />

          {/* Dependency Conflict Banner */}
          {currentTask?.dependency_conflict?.has_conflict && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                mb: 3,
                borderRadius: '8px',
                bgcolor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : '#EF4444',
                boxShadow: '0 1px 3px rgba(239,68,68,0.1)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <AlertTriangle size={20} color="#DC2626" style={{ marginTop: 2, flexShrink: 0 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: isDark ? '#FCA5A5' : '#991B1B' }}>
                    {currentTask.dependency_conflict.conflict_message}
                  </Typography>
                  <Typography variant="caption" sx={{ color: isDark ? '#F87171' : '#B91C1C', display: 'block', mt: 0.5 }}>
                    Recommended Start Date: <strong>{formatDate(currentTask.dependency_conflict.recommended_start_date)}</strong>
                  </Typography>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={handleAutoAdjustDate}
                    disabled={isAutoAdjusting}
                    sx={{
                      mt: 1.5,
                      bgcolor: '#DC2626',
                      '&:hover': { bgcolor: '#991B1B' },
                      textTransform: 'none',
                      fontSize: 12,
                      fontWeight: 700,
                      px: 2,
                    }}
                  >
                    {isAutoAdjusting ? 'Adjusting...' : 'Auto Adjust Date'}
                  </Button>
                </Box>
              </Box>
            </Paper>
          )}

          {/* Rich Description */}
          <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
            DESCRIPTION
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            placeholder="Add detailed task description, scope, requirements, markdown links..."
            sx={{ mb: 3, '& .MuiOutlinedInput-root': { fontSize: 14 } }}
          />

          <Divider sx={{ mb: 3 }} />

          {/* ── SUBTASKS (ClickUp Nested 3 Levels) ───────────────────── */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ListTree size={18} color={isDark ? '#16C47F' : '#203020'} />
                <Typography variant="h6" sx={{ fontSize: '1.05rem', fontWeight: 700 }}>
                  Subtasks & Work Breakdown
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                {currentTask.completed_subtask_count || 0} / {currentTask.subtask_count || 0} Completed ({currentTask.progress_percentage || 0}%)
              </Typography>
            </Box>

            <LinearProgress
              variant="determinate"
              value={currentTask.progress_percentage || 0}
              sx={{ mb: 2, height: 6, borderRadius: 3, bgcolor: 'divider', '& .MuiLinearProgress-bar': { bgcolor: isDark ? '#16C47F' : '#203020' } }}
            />

            {((currentTask as any).nested_subtasks || currentTask.subtasks || []).length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                {((currentTask as any).nested_subtasks || currentTask.subtasks || []).map((sub: any) => (
                  <Paper
                    key={sub.id}
                    variant="outlined"
                    sx={{
                      p: 1.25,
                      px: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderRadius: '8px',
                      bgcolor: sub.is_completed ? 'action.hover' : 'background.default',
                      transition: 'all 0.15s ease',
                      '&:hover': { bgcolor: 'action.hover', borderColor: isDark ? '#16C47F' : '#203020' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, overflow: 'hidden' }}>
                      <input
                        type="checkbox"
                        checked={sub.is_completed}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleSubtask(sub.id);
                        }}
                        style={{ cursor: 'pointer', width: 17, height: 17, accentColor: isDark ? '#16C47F' : '#203020' }}
                      />
                      <Chip
                        label={sub.task_number ? sub.task_number.replace(/0+([1-9]\d*)$/, '$1') : `TASK-${sub.id}`}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.65rem',
                          ...getTaskIdBadgeStyle(currentTask?.parent_task_id ? 2 : 1),
                        }}
                      />
                      <Typography
                        variant="body2"
                        onClick={() => setActiveTaskId(sub.id)}
                        sx={{
                          cursor: 'pointer',
                          fontWeight: sub.is_completed ? 400 : 600,
                          textDecoration: sub.is_completed ? 'line-through' : 'none',
                          color: sub.is_completed ? 'text.secondary' : 'text.primary',
                          transition: 'color 0.15s ease',
                          '&:hover': { color: isDark ? '#16C47F' : '#203020', textDecoration: 'underline' },
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {sub.title}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {sub.priority && (
                        <Chip
                          label={sub.priority}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            bgcolor: sub.priority === 'URGENT' ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2') : sub.priority === 'HIGH' ? (isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7') : 'action.hover',
                            color: sub.priority === 'URGENT' ? '#EF4444' : sub.priority === 'HIGH' ? '#F59E0B' : 'text.secondary',
                          }}
                        />
                      )}
                      <Tooltip title="Open subtask">
                        <IconButton size="small" onClick={() => setActiveTaskId(sub.id)}>
                          <ArrowRight size={15} color={isDark ? '#16C47F' : '#203020'} />
                        </IconButton>
                      </Tooltip>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDeleteSubtask(sub.id); }}>
                        <Trash2 size={15} color="#DC2626" />
                      </IconButton>
                    </Box>
                  </Paper>
                ))}
              </Box>
            )}

            {/* Quick Add Subtask */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="+ Add subtask title..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                sx={{ '& .MuiOutlinedInput-root': { height: 36, fontSize: 13 } }}
              />
              <Button
                variant="contained"
                size="small"
                onClick={handleAddSubtask}
                disabled={isAddingSubtask}
                sx={{ bgcolor: '#203020', '&:hover': { bgcolor: '#2A402A' }, textTransform: 'none', px: 2, color: '#fff' }}
              >
                Add Subtask
              </Button>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* ── CHECKLISTS ────────────────────────────────────────── */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckSquare size={18} color="#2563EB" />
                <Typography variant="h6" sx={{ fontSize: '1.05rem', fontWeight: 700 }}>
                  Checklists
                </Typography>
              </Box>
            </Box>

            {currentTask?.checklists && currentTask.checklists.length > 0 ? (
              currentTask.checklists.map((chk) => (
                <Paper key={chk.id} variant="outlined" sx={{ p: 2, mb: 2, borderRadius: '8px', bgcolor: 'background.default' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    {chk.title}
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                    {chk.items.map((item) => (
                      <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <input
                            type="checkbox"
                            checked={item.is_completed}
                            onChange={() => handleToggleChecklistItem(item.id)}
                            style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#2563EB' }}
                          />
                          <Typography
                            variant="body2"
                            sx={{ textDecoration: item.is_completed ? 'line-through' : 'none', color: item.is_completed ? 'text.secondary' : 'text.primary' }}
                          >
                            {item.title}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          onClick={() => handleConvertChecklistItemToSubtask(item.id)}
                          sx={{ fontSize: 10, textTransform: 'none' }}
                        >
                          Convert to Subtask
                        </Button>
                      </Box>
                    ))}
                  </Box>

                  {/* Add Checklist Item */}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="+ Add checklist item..."
                      value={newChecklistItemTitles[chk.id] || ''}
                      onChange={(e) => setNewChecklistItemTitles((prev) => ({ ...prev, [chk.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItem(chk.id)}
                      sx={{ '& .MuiOutlinedInput-root': { height: 32, fontSize: 12 } }}
                    />
                    <Button size="small" variant="outlined" onClick={() => handleAddChecklistItem(chk.id)}>
                      Add Item
                    </Button>
                  </Box>
                </Paper>
              ))
            ) : (
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                No checklists added to this task.
              </Typography>
            )}

            {/* Create Checklist */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="+ Create new checklist title..."
                value={newChecklistTitle}
                onChange={(e) => setNewChecklistTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddChecklist()}
                sx={{ '& .MuiOutlinedInput-root': { height: 34, fontSize: 13 } }}
              />
              <Button variant="outlined" size="small" onClick={handleAddChecklist} sx={{ textTransform: 'none' }}>
                Add Checklist
              </Button>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* ── DEPENDENCIES & RELATIONSHIPS ───────────────────────── */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Lock size={18} color="#D97706" /> Task Dependencies & Relationships
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Plus size={14} />}
                onClick={() => setIsAddDepDialogOpen(true)}
                sx={{ textTransform: 'none', height: 30, fontSize: 12, borderColor: '#D97706', color: '#D97706' }}
              >
                Add Dependency
              </Button>
            </Box>

            {/* BLOCKING SECTION */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1, letterSpacing: 0.5 }}>
                BLOCKING (Tasks blocked by this task)
              </Typography>
              {((currentTask?.dependents && currentTask.dependents.length > 0) ? currentTask.dependents : (currentTask?.dependencies || []).filter((d) => d.direction === 'BLOCKING')).length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {((currentTask?.dependents && currentTask.dependents.length > 0) ? currentTask.dependents : (currentTask?.dependencies || []).filter((d) => d.direction === 'BLOCKING')).map((dep) => (
                    <Paper
                      key={dep.id}
                      variant="outlined"
                      sx={{ p: 1.25, px: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '8px', bgcolor: 'background.default' }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Chip label="BLOCKING" size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#FEF3C7', color: '#D97706' }} />
                        <Chip label={dep.depends_on_task_number ? dep.depends_on_task_number.replace(/0+([1-9]\d*)$/, '$1') : `TASK-${dep.depends_on_task_id}`} size="small" sx={{ height: 18, fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700 }} />
                        <Typography
                          variant="body2"
                          onClick={() => setActiveTaskId(dep.depends_on_task_id)}
                          sx={{ cursor: 'pointer', fontWeight: 600, color: 'text.primary', transition: 'color 0.15s ease', '&:hover': { color: isDark ? '#16C47F' : '#203020', textDecoration: 'underline' } }}
                        >
                          {dep.depends_on_task_title}
                        </Typography>
                        <Tooltip title="Click to edit dependency type & lag">
                          <Chip
                            label={formatDepChipLabel(dep)}
                            size="small"
                            onClick={() => handleOpenEditDep(dep)}
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              cursor: 'pointer',
                              fontWeight: 600,
                              bgcolor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
                              color: isDark ? '#FBBF24' : '#92400E',
                              border: '1px solid',
                              borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A',
                              '&:hover': { bgcolor: isDark ? 'rgba(245, 158, 11, 0.25)' : '#FDE68A' },
                            }}
                          />
                        </Tooltip>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {dep.depends_on_status_name && (
                          <Chip label={dep.depends_on_status_name} size="small" sx={{ height: 18, fontSize: '0.6rem' }} />
                        )}
                        <Tooltip title="Edit dependency type & lag days">
                          <IconButton size="small" onClick={() => handleOpenEditDep(dep)}>
                            <Edit2 size={14} color="#D97706" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remove dependency">
                          <IconButton size="small" onClick={() => handleRemoveDependency(dep.id)}>
                            <Trash2 size={14} color="#DC2626" />
                          </IconButton>
                        </Tooltip>
                        </Box>
                    </Paper>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="textSecondary" sx={{ fontSize: 13, fontStyle: 'italic', pl: 1 }}>
                  No tasks are blocked by this task.
                </Typography>
              )}
            </Box>

            {/* BLOCKED BY SECTION */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1, letterSpacing: 0.5 }}>
                BLOCKED BY (Tasks blocking this task)
              </Typography>
              {currentTask?.dependencies && currentTask.dependencies.filter((d) => d.direction !== 'BLOCKING').length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {currentTask.dependencies.filter((d) => d.direction !== 'BLOCKING').map((dep) => (
                    <Paper
                      key={dep.id}
                      variant="outlined"
                      sx={{
                        p: 1.25,
                        px: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderRadius: '8px',
                        bgcolor: dep.depends_on_is_completed ? (isDark ? 'rgba(22, 196, 127, 0.1)' : '#F0FDF4') : (isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2'),
                        borderColor: dep.depends_on_is_completed ? (isDark ? 'rgba(22, 196, 127, 0.25)' : '#BBF7D0') : (isDark ? 'rgba(239, 68, 68, 0.25)' : '#FECACA'),
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Chip
                          label={dep.depends_on_is_completed ? 'SATISFIED' : 'WAITING ON'}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            bgcolor: dep.depends_on_is_completed ? (isDark ? 'rgba(22, 196, 127, 0.2)' : '#DCFCE7') : (isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2'),
                            color: dep.depends_on_is_completed ? (isDark ? '#16C47F' : '#166534') : '#DC2626',
                          }}
                        />
                        <Chip label={dep.depends_on_task_number ? dep.depends_on_task_number.replace(/0+([1-9]\d*)$/, '$1') : `TASK-${dep.depends_on_task_id}`} size="small" sx={{ height: 18, fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700 }} />
                        <Typography
                          variant="body2"
                          onClick={() => setActiveTaskId(dep.depends_on_task_id)}
                          sx={{ cursor: 'pointer', fontWeight: 600, color: 'text.primary', transition: 'color 0.15s ease', '&:hover': { color: isDark ? '#16C47F' : '#203020', textDecoration: 'underline' } }}
                        >
                          {dep.depends_on_task_title}
                        </Typography>
                        <Tooltip title="Click to edit dependency type & lag">
                          <Chip
                            label={formatDepChipLabel(dep)}
                            size="small"
                            onClick={() => handleOpenEditDep(dep)}
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              cursor: 'pointer',
                              fontWeight: 600,
                              bgcolor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#E0F2FE',
                              color: isDark ? '#38BDF8' : '#0369A1',
                              border: '1px solid',
                              borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : '#BAE6FD',
                              '&:hover': { bgcolor: isDark ? 'rgba(56, 189, 248, 0.25)' : '#BAE6FD' },
                            }}
                          />
                        </Tooltip>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {dep.depends_on_status_name && (
                          <Chip label={dep.depends_on_status_name} size="small" sx={{ height: 18, fontSize: '0.6rem' }} />
                        )}
                        <Tooltip title="Edit dependency type & lag days">
                          <IconButton size="small" onClick={() => handleOpenEditDep(dep)}>
                            <Edit2 size={14} color="#D97706" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remove dependency">
                          <IconButton size="small" onClick={() => handleRemoveDependency(dep.id)}>
                            <Trash2 size={14} color="#DC2626" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="textSecondary" sx={{ fontSize: 13, fontStyle: 'italic', pl: 1 }}>
                  This task is not blocked by any tasks.
                </Typography>
              )}
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* ── ATTACHMENTS ───────────────────────────────────────── */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="h6" sx={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Paperclip size={18} color="#2563EB" /> File Attachments ({attachments.length})
              </Typography>
              <Button variant="outlined" size="small" component="label" startIcon={<UploadCloud size={14} />}>
                Upload File
                <input type="file" hidden multiple onChange={handleFileUpload} />
              </Button>
            </Box>

            {attachments.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {attachments.map((file) => (
                  <Paper key={file.id} variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <FileText size={18} color={isDark ? '#16C47F' : '#203020'} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{file.filename}</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => handleRemoveAttachment(file.id)}>
                      <Trash2 size={15} color="#DC2626" />
                    </IconButton>
                  </Paper>
                ))}
              </Box>
            )}
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* ── ACTIVITY & COMMENTS ───────────────────────────────── */}
          <Box>
            <Typography variant="h6" sx={{ fontSize: '1.05rem', fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <MessageSquare size={18} color="#64748B" /> Comments & Immutable Audit Log
            </Typography>

            <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: isDark ? '#2A402A' : '#203020', fontSize: 13, fontWeight: 700 }}>A</Avatar>
              <TextField
                fullWidth
                size="small"
                placeholder="Write comment with @mentions..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handlePostComment()}
                multiline
                rows={2}
              />
              <IconButton onClick={handlePostComment} disabled={isAddingComment || !commentText.trim()} sx={{ bgcolor: '#203020', '&:hover': { bgcolor: '#2A402A' }, color: '#FFF' }}>
                <Send size={16} />
              </IconButton>
            </Box>

            {/* Comments Timeline */}
            {comments.map((c) => (
              <Box key={c.id} sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: '#64748B' }}>{c.user_name?.charAt(0) || 'U'}</Avatar>
                <Paper variant="outlined" sx={{ p: 1.5, flex: 1, borderRadius: '8px', bgcolor: 'background.default' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 12 }}>{c.user_name || 'User'}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.primary', mt: 0.5 }}>{c.content}</Typography>
                </Paper>
              </Box>
            ))}

            {/* Immutable Audit Log */}
            {currentTask?.activities && currentTask.activities.length > 0 && (
              <Box sx={{ mt: 3, pt: 2, borderTop: '1px dashed', borderColor: 'divider' }}>
                <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
                  AUDIT TIMELINE
                </Typography>
                {currentTask.activities.map((act) => (
                  <Box key={act.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                    <ActivityIcon size={13} color="#64748B" />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      <strong>{act.actor_name}</strong>: {act.description || act.action_type} ({formatDateTime(act.created_at)})
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>

        {/* Right Column (Master Data Properties) */}
        <Box sx={{ width: { xs: '100%', md: 300 }, p: 3, borderLeft: { md: '1px solid' }, borderColor: 'divider', bgcolor: 'background.default' }}>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 2, textTransform: 'uppercase', fontWeight: 700, fontSize: '0.7rem' }}>
            Work Item Properties
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Status Selector */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
                Status
              </Typography>
              <Select
                size="small"
                fullWidth
                value={currentTask.status_id || ''}
                onChange={(e) => handleStatusChange(Number(e.target.value))}
                displayEmpty
                sx={{ height: 36, fontSize: 13, bgcolor: 'background.paper' }}
              >
                <MenuItem value=""><em>Select Status</em></MenuItem>
                {(statuses as any[]).map((st) => (
                  <MenuItem key={st.id} value={st.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: st.color || '#64748B' }} />
                      {st.name}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </Box>

            {/* Milestone Selector */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
                Milestone
              </Typography>
              <Select
                size="small"
                fullWidth
                value={currentTask.milestone_id || ''}
                onChange={(e) => handleMilestoneChange(e.target.value as any)}
                displayEmpty
                sx={{ height: 36, fontSize: 13, bgcolor: 'background.paper' }}
              >
                <MenuItem value=""><em>No Milestone (Unassigned)</em></MenuItem>
                {projectMilestones.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    🚩 {m.title}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            {/* Task List Selector */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
                Task List
              </Typography>
              <Select
                size="small"
                fullWidth
                value={currentTask.task_list_id || ''}
                onChange={(e) => handleTaskListChange(e.target.value as any)}
                displayEmpty
                sx={{ height: 36, fontSize: 13, bgcolor: 'background.paper' }}
              >
                <MenuItem value=""><em>None (Directly under Milestone)</em></MenuItem>
                {availableTaskLists.map((tl) => (
                  <MenuItem key={tl.id} value={tl.id}>
                    📁 {tl.name}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            {/* Priority Selector */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
                Priority
              </Typography>
              <Select
                size="small"
                fullWidth
                value={currentTask.priority || 'NORMAL'}
                onChange={(e) => handlePriorityChange(e.target.value)}
                sx={{ height: 36, fontSize: 13, bgcolor: 'background.paper' }}
              >
                <MenuItem value="URGENT">🔴 URGENT</MenuItem>
                <MenuItem value="HIGH">🟠 HIGH</MenuItem>
                <MenuItem value="NORMAL">🟢 NORMAL</MenuItem>
                <MenuItem value="LOW">🔵 LOW</MenuItem>
              </Select>
            </Box>

            {/* Start Date & Time */}
            {(() => {
              const isParentTask = Boolean(currentTask.is_parent || (currentTask.subtask_count && currentTask.subtask_count > 0));
              return (
                <>
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
                        Start Date {isParentTask && <span style={{ fontWeight: 400, opacity: 0.8 }}>(Calculated)</span>} {currentTask.start_date_locked && <Tooltip title="Locked by dependencies"><span><Lock size={12} color="#D97706" style={{ marginLeft: 4 }} /></span></Tooltip>}
                      </Typography>
                      <Tooltip title={isParentTask ? "Calculated: Earliest Start Date calculated from child tasks" : ""}>
                        <TextField
                          type="date"
                          size="small"
                          fullWidth
                          value={startDate}
                          disabled={isParentTask || currentTask.start_date_locked}
                          onChange={(e) => {
                            if (isParentTask) return;
                            handleStartDateChange(e.target.value);
                          }}
                          InputLabelProps={{ shrink: true }}
                          inputProps={{ min: '1900-01-01', max: '2100-12-31' }}
                          sx={{
                            '& .MuiOutlinedInput-root': { height: 36, fontSize: 12, bgcolor: isParentTask ? 'action.hover' : 'background.paper' },
                            '& .MuiInputBase-input': { cursor: isParentTask ? 'default' : 'pointer' },
                          }}
                        />
                      </Tooltip>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
                        Start Time {isParentTask && <span style={{ fontWeight: 400, opacity: 0.8 }}>(Calculated)</span>}
                      </Typography>
                      <Tooltip title={isParentTask ? "Calculated: Start Time from earliest child task" : ""}>
                        <TextField
                          type="time"
                          size="small"
                          fullWidth
                          disabled={isParentTask}
                          value={time12To24(startTime || '09:00 AM')}
                          onChange={(e) => {
                            if (isParentTask) return;
                            const val = e.target.value ? time24To12(e.target.value) : '';
                            setStartTime(val);
                            autoSave.registerPendingChange('start_time', val || null, currentTask?.start_time || null);
                          }}
                          onBlur={() => {
                            if (isParentTask) return;
                            handleStartTimeBlur();
                          }}
                          InputLabelProps={{ shrink: true }}
                          sx={{
                            '& .MuiOutlinedInput-root': { height: 36, fontSize: 12, bgcolor: isParentTask ? 'action.hover' : 'background.paper' },
                            '& .MuiInputBase-input': { cursor: isParentTask ? 'default' : 'pointer' },
                          }}
                        />
                      </Tooltip>
                    </Grid>
                  </Grid>

                  {/* Due Date & Time */}
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
                        Due Date {isParentTask && <span style={{ fontWeight: 400, opacity: 0.8 }}>(Calculated)</span>} {currentTask.end_date_locked && <Tooltip title="Locked by dependencies"><span><Lock size={12} color="#D97706" style={{ marginLeft: 4 }} /></span></Tooltip>}
                      </Typography>
                      <Tooltip title={isParentTask ? "Calculated: Latest Due Date calculated from child tasks" : ""}>
                        <TextField
                          type="date"
                          size="small"
                          fullWidth
                          value={dueDate}
                          disabled={isParentTask || currentTask.end_date_locked}
                          onChange={(e) => {
                            if (isParentTask) return;
                            handleDueDateChange(e.target.value);
                          }}
                          InputLabelProps={{ shrink: true }}
                          inputProps={{ min: '1900-01-01', max: '2100-12-31' }}
                          sx={{
                            '& .MuiOutlinedInput-root': { height: 36, fontSize: 12, bgcolor: isParentTask ? 'action.hover' : 'background.paper' },
                            '& .MuiInputBase-input': { cursor: isParentTask ? 'default' : 'pointer' },
                          }}
                        />
                      </Tooltip>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
                        Due Time {isParentTask && <span style={{ fontWeight: 400, opacity: 0.8 }}>(Calculated)</span>}
                      </Typography>
                      <Tooltip title={isParentTask ? "Calculated: Due Time from latest child task" : ""}>
                        <TextField
                          type="time"
                          size="small"
                          fullWidth
                          disabled={isParentTask}
                          value={time12To24(dueTime || '05:00 PM')}
                          onChange={(e) => {
                            if (isParentTask) return;
                            const val = e.target.value ? time24To12(e.target.value) : '';
                            setDueTime(val);
                            autoSave.registerPendingChange('due_time', val || null, currentTask?.due_time || null);
                          }}
                          onBlur={() => {
                            if (isParentTask) return;
                            handleDueTimeBlur();
                          }}
                          InputLabelProps={{ shrink: true }}
                          sx={{
                            '& .MuiOutlinedInput-root': { height: 36, fontSize: 12, bgcolor: isParentTask ? 'action.hover' : 'background.paper' },
                            '& .MuiInputBase-input': { cursor: isParentTask ? 'default' : 'pointer' },
                          }}
                        />
                      </Tooltip>
                    </Grid>
                  </Grid>

                  {/* Completion Date & Time (if set or completed) */}
                  {(currentTask.is_completed || completionDate || currentTask.completion_date) && (
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
                          Completion Date {isParentTask && <span style={{ fontWeight: 400, opacity: 0.8 }}>(Calculated)</span>}
                        </Typography>
                        <TextField
                          type="date"
                          size="small"
                          fullWidth
                          disabled={isParentTask}
                          value={completionDate}
                          onChange={(e) => {
                            if (isParentTask) return;
                            handleCompletionDateChange(e.target.value);
                          }}
                          InputLabelProps={{ shrink: true }}
                          sx={{
                            '& .MuiOutlinedInput-root': { height: 36, fontSize: 12, bgcolor: isParentTask ? 'action.hover' : 'background.paper' },
                            '& .MuiInputBase-input': { cursor: isParentTask ? 'default' : 'pointer' },
                          }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
                          Completion Time {isParentTask && <span style={{ fontWeight: 400, opacity: 0.8 }}>(Calculated)</span>}
                        </Typography>
                        <TextField
                          type="time"
                          size="small"
                          fullWidth
                          disabled={isParentTask}
                          value={time12To24(completionTime || '05:00 PM')}
                          onChange={(e) => {
                            if (isParentTask) return;
                            const val = e.target.value ? time24To12(e.target.value) : '';
                            setCompletionTime(val);
                            autoSave.registerPendingChange('completion_time', val || null, currentTask?.completion_time || null);
                          }}
                          onBlur={() => {
                            if (isParentTask) return;
                            handleCompletionTimeBlur();
                          }}
                          InputLabelProps={{ shrink: true }}
                          sx={{
                            '& .MuiOutlinedInput-root': { height: 36, fontSize: 12, bgcolor: isParentTask ? 'action.hover' : 'background.paper' },
                            '& .MuiInputBase-input': { cursor: isParentTask ? 'default' : 'pointer' },
                          }}
                        />
                      </Grid>
                    </Grid>
                  )}

                  {/* Duration Display & Edit */}
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
                      Duration ({isParentTask ? 'Calendar Days' : 'Working Days + Hours'})
                    </Typography>
                    {isParentTask ? (
                      <Tooltip title="Calculated: Working duration between earliest start and latest due of child tasks">
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, py: 0.75 }}>
                          {currentTask.duration_working_days || 0} CD (Parent Rollup)
                        </Typography>
                      </Tooltip>
                    ) : (
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <TextField
                            type="number"
                            size="small"
                            fullWidth
                            value={duration}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setDuration(val);
                              autoSave.registerPendingChange(
                                'duration_working_days',
                                val === '' ? 1 : val,
                                currentTask?.duration_working_days ?? 1
                              );
                            }}
                            onBlur={() => {
                              let d = typeof duration === 'number' ? duration : (duration === '' ? 1 : 0);
                              let h = typeof durationHours === 'number' ? durationHours : 0;
                              if (d < 0) d = 0;
                              if (h < 0) h = 0;
                              if (d === 0 && h === 0) {
                                d = 1;
                              }
                              setDuration(d);
                              setDurationHours(h);
                              handleDurationChange(d, h);
                            }}
                            onKeyDown={(e: any) => {
                              if (e.key === 'Enter') e.target.blur();
                            }}
                            InputProps={{
                              endAdornment: <InputAdornment position="end">Days</InputAdornment>,
                            }}
                            inputProps={{ min: 0 }}
                            sx={{
                              '& .MuiOutlinedInput-root': { height: 36, fontSize: 13, bgcolor: 'background.paper' },
                              '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
                              '& input[type=number]': { MozAppearance: 'textfield' },
                            }}
                          />
                        </Grid>
                        <Grid item xs={6}>
                          <TextField
                            type="number"
                            size="small"
                            fullWidth
                            value={durationHours}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setDurationHours(val);
                              autoSave.registerPendingChange(
                                'duration_working_hours',
                                val === '' ? 0 : val,
                                currentTask?.duration_working_hours ?? 0
                              );
                            }}
                            onBlur={() => {
                              let d = typeof duration === 'number' ? duration : (duration === '' ? 1 : 0);
                              let h = typeof durationHours === 'number' ? durationHours : 0;
                              if (d < 0) d = 0;
                              if (h < 0) h = 0;
                              if (h >= dailyWorkingHours) {
                                const extraDays = Math.floor(h / dailyWorkingHours);
                                h = h % dailyWorkingHours;
                                d += extraDays;
                              }
                              if (d === 0 && h === 0) {
                                d = 1;
                              }
                              setDuration(d);
                              setDurationHours(h);
                              handleDurationChange(d, h);
                            }}
                            onKeyDown={(e: any) => {
                              if (e.key === 'Enter') e.target.blur();
                            }}
                            InputProps={{
                              endAdornment: <InputAdornment position="end">Hours</InputAdornment>,
                            }}
                            inputProps={{ min: 0 }}
                            sx={{
                              '& .MuiOutlinedInput-root': { height: 36, fontSize: 13, bgcolor: 'background.paper' },
                              '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
                              '& input[type=number]': { MozAppearance: 'textfield' },
                            }}
                          />
                        </Grid>
                      </Grid>
                    )}
                  </Box>
                </>
              );
            })()}

            <Autocomplete
              multiple
              freeSolo
              options={taskTags.map(t => t.name)}
              value={tags}
              onChange={(_, newValue) => handleTagsChange(newValue)}
              renderInput={(params) => <TextField {...params} label="Tags" size="small" />}
              size="small"
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
                  Reminder
                </Typography>
                <TextField
                  type="datetime-local"
                  size="small"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={reminderAt}
                  onChange={(e) => {
                    setReminderAt(e.target.value);
                    autoSave.registerPendingChange('reminder_at', e.target.value ? new Date(e.target.value).toISOString() : null, currentTask?.reminder_at || null);
                  }}
                  onBlur={handleReminderBlur}
                  sx={{ '& .MuiOutlinedInput-root': { height: 36, fontSize: 12, bgcolor: 'background.paper' } }}
                />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
                  Recurrence
                </Typography>
                <Select
                  size="small"
                  fullWidth
                  value={recurrenceType}
                  onChange={e => handleRecurrenceTypeChange(e.target.value)}
                  sx={{ height: 36, fontSize: 12, bgcolor: 'background.paper' }}
                >
                  <MenuItem value="None">None</MenuItem>
                  <MenuItem value="Daily">Daily</MenuItem>
                  <MenuItem value="Weekly">Weekly</MenuItem>
                  <MenuItem value="Monthly">Monthly</MenuItem>
                  <MenuItem value="Yearly">Yearly</MenuItem>
                </Select>
              </Box>
            </Box>
            
            {recurrenceType !== 'None' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
                    Recurrence End Date
                  </Typography>
                  <TextField
                    type="date"
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={recurrenceEndDate}
                    onChange={e => handleRecurrenceEndDateChange(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { height: 36, fontSize: 12, bgcolor: 'background.paper' } }}
                  />
                </Box>
                {(currentTask.recurring_task_id || currentTask.recurrence_rule) && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <input 
                      type="checkbox" 
                      id="editSeriesMain" 
                      checked={editSeries} 
                      onChange={e => setEditSeries(e.target.checked)} 
                    />
                    <Typography variant="caption" component="label" htmlFor="editSeriesMain">
                      Apply updates to entire future series
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            {/* Financials */}
            <Grid container spacing={1}>
              <Grid item xs={4}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
                  Est. Cost (₹)
                </Typography>
                <TextField
                  type="number"
                  size="small"
                  fullWidth
                  value={estimatedCost}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    setEstimatedCost(val);
                    autoSave.registerPendingChange('estimated_cost', val === '' ? 0 : Number(val), currentTask?.estimated_cost ?? 0);
                  }}
                  onBlur={handleEstimatedCostBlur}
                  sx={{
                    '& .MuiOutlinedInput-root': { height: 36, fontSize: 13, bgcolor: 'background.paper' },
                    '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                      WebkitAppearance: 'none',
                      margin: 0,
                    },
                    '& input[type=number]': {
                      MozAppearance: 'textfield',
                    },
                  }}
                />
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
                  Actual Cost (₹)
                </Typography>
                <TextField
                  type="number"
                  size="small"
                  fullWidth
                  value={actualCost}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    setActualCost(val);
                    autoSave.registerPendingChange('actual_cost', val === '' ? 0 : Number(val), currentTask?.actual_cost ?? 0);
                  }}
                  onBlur={handleActualCostBlur}
                  sx={{
                    '& .MuiOutlinedInput-root': { height: 36, fontSize: 13, bgcolor: 'background.paper' },
                    '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                      WebkitAppearance: 'none',
                      margin: 0,
                    },
                    '& input[type=number]': {
                      MozAppearance: 'textfield',
                    },
                  }}
                />
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
                  Variance (₹)
                </Typography>
                <Box sx={{ height: 36, display: 'flex', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: ((currentTask.estimated_cost || 0) - (currentTask.actual_cost || 0)) < 0 ? '#DC2626' : (isDark ? '#16C47F' : '#16A34A') }}>
                    ₹{((currentTask.estimated_cost || 0) - (currentTask.actual_cost || 0)).toLocaleString('en-IN')}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {/* Estimated Time */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
                Estimated Hours
              </Typography>
              <TextField
                type="number"
                size="small"
                fullWidth
                placeholder="e.g. 8.0"
                value={estimatedHours}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Number(e.target.value);
                  setEstimatedHours(val);
                  autoSave.registerPendingChange('estimated_hours', val === '' ? 0 : Number(val), currentTask?.estimated_hours ?? 0);
                }}
                onBlur={handleEstimatedHoursBlur}
                sx={{
                  '& .MuiOutlinedInput-root': { height: 36, fontSize: 13, bgcolor: 'background.paper' },
                  '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                    WebkitAppearance: 'none',
                    margin: 0,
                  },
                  '& input[type=number]': {
                    MozAppearance: 'textfield',
                  },
                }}
              />
            </Box>

            {/* Cost Center Master Selector */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Cost Center (Master Data)
              </Typography>
              <Select
                size="small"
                fullWidth
                value={currentTask.cost_center_id || ''}
                onChange={(e) => handleCostCenterChange(e.target.value ? Number(e.target.value) : '')}
                displayEmpty
                sx={{ height: 36, fontSize: 13, bgcolor: 'background.paper' }}
              >
                <MenuItem value=""><em>None Selected</em></MenuItem>
                {costCenters.map((cc) => (
                  <MenuItem key={cc.id} value={cc.id}>
                    {cc.code} - {cc.name}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            {/* Assignees */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
                Assignees
              </Typography>
              <Select
                multiple
                size="small"
                fullWidth
                displayEmpty
                value={(currentTask?.assignees || []).map((a) => a.user_id || a.id)}
                onChange={(e) => {
                  const vals = typeof e.target.value === 'string' ? e.target.value.split(',').map(Number) : (e.target.value as number[]);
                  handleAssigneeChange(vals);
                }}
                renderValue={(selected) => {
                  if (!selected || selected.length === 0) {
                    return <Typography variant="body2" color="textSecondary">Select Assignees...</Typography>;
                  }
                  return (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((uid) => {
                        const u = (users as any[]).find((usr) => usr.id === uid) || (currentTask?.assignees || []).find((a) => (a.user_id || a.id) === uid);
                        const name = u ? (u.full_name || u.username || 'User') : `User ${uid}`;
                        return (
                          <Chip
                            key={uid}
                            avatar={<Avatar sx={{ width: 18, height: 18, fontSize: 10 }}>{(name || 'U').charAt(0)}</Avatar>}
                            label={name}
                            size="small"
                            sx={{ height: 22, fontSize: 11 }}
                          />
                        );
                      })}
                    </Box>
                  );
                }}
                sx={{ bgcolor: 'background.paper', borderRadius: '8px', minHeight: 36 }}
              >
                {(users as any[]).map((u) => (
                  <MenuItem key={u.id} value={u.id} sx={{ fontSize: 13 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: 11, mr: 1 }}>{(u.full_name || u.username || 'U').charAt(0)}</Avatar>
                    {u.full_name || u.username}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            {/* Followers / Watchers */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
                Followers / Watchers
              </Typography>
              <Select
                multiple
                size="small"
                fullWidth
                displayEmpty
                value={(currentTask?.followers || []).map((f) => f.user_id || f.id)}
                onChange={(e) => {
                  const vals = typeof e.target.value === 'string' ? e.target.value.split(',').map(Number) : (e.target.value as number[]);
                  handleFollowerChange(vals);
                }}
                renderValue={(selected) => {
                  if (!selected || selected.length === 0) {
                    return <Typography variant="body2" color="textSecondary">Select Followers...</Typography>;
                  }
                  return (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((uid) => {
                        const u = (users as any[]).find((usr) => usr.id === uid) || (currentTask?.followers || []).find((f) => (f.user_id || f.id) === uid);
                        const name = u ? (u.full_name || u.username || 'Follower') : `User ${uid}`;
                        return (
                          <Chip
                            key={uid}
                            label={name}
                            size="small"
                            variant="outlined"
                            sx={{ height: 22, fontSize: 11 }}
                          />
                        );
                      })}
                    </Box>
                  );
                }}
                sx={{ bgcolor: 'background.paper', borderRadius: '8px', minHeight: 36 }}
              >
                {(users as any[]).map((u) => (
                  <MenuItem key={u.id} value={u.id} sx={{ fontSize: 13 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: 11, mr: 1 }}>{(u.full_name || u.username || 'U').charAt(0)}</Avatar>
                    {u.full_name || u.username}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            {/* Custom Fields */}
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 700, fontSize: '0.7rem' }}>
              Custom Fields
            </Typography>
            {customDefs.map((def) => {
              const valObj = customValues.find((v) => v.field_id === def.id);
              const isEditing = editingFieldId === def.id;

              return (
                <Box key={def.id}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{def.label}</Typography>
                  {isEditing ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <TextField
                        size="small"
                        autoFocus
                        value={editFieldValue}
                        onChange={(e) => setEditFieldValue(e.target.value)}
                        onBlur={() => handleCustomFieldBlur(def.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCustomFieldBlur(def.id);
                        }}
                      />
                      <IconButton size="small" onClick={() => handleCustomFieldBlur(def.id)}><Check size={16} /></IconButton>
                    </Box>
                  ) : (
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', py: 0.5 }}
                      onClick={() => { setEditingFieldId(def.id); setEditFieldValue(valObj?.value || ''); }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{valObj?.value || 'Click to edit...'}</Typography>
                      <IconButton size="small">
                        <Edit2 size={13} />
                      </IconButton>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* ── ADD DEPENDENCY SEARCH MODAL ───────────────────────── */}
      <Dialog
        open={isAddDepDialogOpen}
        onClose={() => setIsAddDepDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Lock size={20} color="#D97706" /> Add Task Dependency
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Select the target task to add as a predecessor dependency:
          </Typography>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                DEPENDENCY TYPE
              </Typography>
              <Select
                fullWidth
                size="small"
                value={depRelType}
                onChange={(e) => setDepRelType(e.target.value as any)}
              >
                <MenuItem value="FS">Finish to Start (FS)</MenuItem>
                <MenuItem value="SS">Start to Start (SS)</MenuItem>
                <MenuItem value="FF">Finish to Finish (FF)</MenuItem>
                <MenuItem value="SF">Start to Finish (SF)</MenuItem>
              </Select>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                LAG DAYS
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                value={depLagDays}
                onChange={(e) => setDepLagDays(Number(e.target.value))}
                placeholder="0"
                helperText="Days"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                LAG HOURS
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                value={depLagHours}
                onChange={(e) => setDepLagHours(Number(e.target.value))}
                placeholder="0"
                inputProps={{ min: 0, max: Math.max(0, dailyWorkingHours - 0.01) }}
                helperText={`0 to <${dailyWorkingHours}h`}
              />
            </Grid>
          </Grid>

          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
            SEARCH TARGET TASK
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by Task ID (e.g. TASK-4) or Task Title..."
            value={depSearchQuery}
            onChange={(e) => setDepSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />

          <Box sx={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {searchTasksResult
              .filter((t: any) => {
                if (!t || !currentTask) return false;
                if (t.id === currentTask.id) return false;
                if (targetProjectId && t.project_id && Number(t.project_id) !== targetProjectId) return false;
                if (t.parent_task_id === currentTask.id) return false;
                if (currentTask.parent_task_id === t.id) return false;
                const existingDepIds = (currentTask.dependencies || []).map((d: any) => d.depends_on_task_id || d.predecessor_task_id);
                if (existingDepIds.includes(t.id)) return false;
                return true;
              })
              .map((t: any) => (
              <Paper
                key={t.id}
                variant="outlined"
                onClick={async () => {
                  if (depLagHours >= dailyWorkingHours) {
                    showToast(`Lag hours (${depLagHours}h) must be less than daily working hours (${dailyWorkingHours}h)`, 'error');
                    return;
                  }
                  try {
                    await addDependencyApi({
                      taskId: currentTask.id,
                      depends_on_task_id: t.id,
                      direction: 'BLOCKED_BY',
                      dep_type: depRelType,
                      lag_days: Number(depLagDays) || 0,
                      lag_hours: Number(depLagHours) || 0,
                    }).unwrap();
                    showToast('Dependency created successfully', 'success');
                    setIsAddDepDialogOpen(false);
                    setDepSearchQuery('');
                  } catch (err: any) {
                    showToast(err?.data?.detail?.message || err?.data?.detail || 'Failed to create dependency', 'error');
                  }
                }}
                sx={{
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  '&:hover': { bgcolor: 'action.hover', borderColor: isDark ? '#16C47F' : '#203020' },
                }}
              >
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label={t.task_number ? t.task_number.replace(/0+([1-9]\d*)$/, '$1') : `TASK-${t.id}`} size="small" sx={{ height: 18, fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700 }} />
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {t.title}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: 11 }}>
                    {t.project_name || 'General Project'} • {t.assignee_name || 'Unassigned'} • Due: {t.due_date ? formatDate(t.due_date) : 'No Date'}
                  </Typography>
                </Box>
                <Chip
                  label={t.priority || 'NORMAL'}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    bgcolor: t.priority === 'URGENT' ? '#FEE2E2' : t.priority === 'HIGH' ? '#FEF3C7' : '#F1F5F9',
                    color: t.priority === 'URGENT' ? '#DC2626' : t.priority === 'HIGH' ? '#D97706' : '#475569',
                  }}
                />
              </Paper>
            ))}
            {searchTasksResult.filter((t: any) => {
              if (!t || !currentTask) return false;
              if (t.id === currentTask.id) return false;
              if (t.parent_task_id === currentTask.id) return false;
              if (currentTask.parent_task_id === t.id) return false;
              const existingDepIds = (currentTask.dependencies || []).map((d: any) => d.depends_on_task_id || d.predecessor_task_id);
              if (existingDepIds.includes(t.id)) return false;
              return true;
            }).length === 0 && (
              <Typography variant="body2" color="textSecondary" align="center" sx={{ py: 3 }}>
                No matching valid tasks found for dependency.
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddDepDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* ── EDIT DEPENDENCY DIALOG ───────────────────────────── */}
      <Dialog
        open={Boolean(editingDep)}
        onClose={() => {
          setEditingDep(null);
          if (initialEditingDep) onClose();
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Lock size={20} color="#D97706" /> Edit Task Dependency
        </DialogTitle>
        <DialogContent dividers>
          {editingDep && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* Linked Task Details (Read-only) */}
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: '8px',
                  bgcolor: 'action.hover',
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 0.5 }}>
                    LINKED TASK (READ-ONLY)
                  </Typography>
                  <Chip
                    label={editingDep.direction === 'BLOCKING' ? 'BLOCKING SUCCESSOR' : 'PREDECESSOR'}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      bgcolor: editingDep.direction === 'BLOCKING' ? '#FEF3C7' : '#DCFCE7',
                      color: editingDep.direction === 'BLOCKING' ? '#D97706' : '#166534',
                    }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip
                    label={editingDep.depends_on_task_number ? editingDep.depends_on_task_number.replace(/0+([1-9]\d*)$/, '$1') : `TASK-${editingDep.depends_on_task_id}`}
                    size="small"
                    sx={{ height: 20, fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 700 }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {editingDep.depends_on_task_title || editingDep.predecessor_task_title || 'Untitled Task'}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', display: 'block', fontSize: '0.75rem' }}>
                  Task details cannot be changed from dependency settings. Only dependency type and lag days are editable.
                </Typography>
              </Paper>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                    DEPENDENCY TYPE
                  </Typography>
                  <Select
                    fullWidth
                    size="small"
                    value={editDepType}
                    onChange={(e) => setEditDepType(e.target.value as 'FS' | 'SS' | 'FF' | 'SF')}
                  >
                    <MenuItem value="FS">
                      <Box sx={{ py: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>Finish to Start (FS)</Typography>
                        <Typography variant="caption" color="textSecondary" sx={{ fontSize: 11, display: 'block' }}>Successor starts after predecessor finishes</Typography>
                      </Box>
                    </MenuItem>
                    <MenuItem value="SS">
                      <Box sx={{ py: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>Start to Start (SS)</Typography>
                        <Typography variant="caption" color="textSecondary" sx={{ fontSize: 11, display: 'block' }}>Successor starts after predecessor starts</Typography>
                      </Box>
                    </MenuItem>
                    <MenuItem value="FF">
                      <Box sx={{ py: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>Finish to Finish (FF)</Typography>
                        <Typography variant="caption" color="textSecondary" sx={{ fontSize: 11, display: 'block' }}>Successor finishes after predecessor finishes</Typography>
                      </Box>
                    </MenuItem>
                    <MenuItem value="SF">
                      <Box sx={{ py: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>Start to Finish (SF)</Typography>
                        <Typography variant="caption" color="textSecondary" sx={{ fontSize: 11, display: 'block' }}>Successor finishes after predecessor starts</Typography>
                      </Box>
                    </MenuItem>
                  </Select>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                    LAG DAYS
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    value={editDepLagDays}
                    onChange={(e) => setEditDepLagDays(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    helperText="Days"
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                    LAG HOURS
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    value={editDepLagHours}
                    onChange={(e) => setEditDepLagHours(Number(e.target.value) || 0)}
                    placeholder="0"
                    inputProps={{ min: 0, max: Math.max(0, dailyWorkingHours - 0.01) }}
                    helperText={`0 to <${dailyWorkingHours}h`}
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => {
              setEditingDep(null);
              if (initialEditingDep) onClose();
            }}
            sx={{ textTransform: 'none', color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateDependency}
            disabled={isUpdatingDep}
            startIcon={isUpdatingDep ? <CircularProgress size={14} color="inherit" /> : <Check size={14} />}
            sx={{ bgcolor: '#203020', '&:hover': { bgcolor: '#2A402A' }, textTransform: 'none', px: 2.5, color: '#fff' }}
          >
            {isUpdatingDep ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── BLOCKED TASK WARNING DIALOG ───────────────────────── */}
      <Dialog
        open={blockedWarning.open}
        onClose={() => setBlockedWarning({ open: false, blockingTasks: [] })}
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertTriangle size={22} color="#DC2626" /> Warning: Task is Blocked
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2, color: 'text.primary' }}>
            This task is currently blocked by incomplete tasks:
          </DialogContentText>
          <Box sx={{ bgcolor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2', p: 1.5, borderRadius: '8px', border: '1px solid', borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA', mb: 2 }}>
            {blockedWarning.blockingTasks.map((tn) => (
              <Typography key={tn} variant="body2" sx={{ fontWeight: 700, color: isDark ? '#FCA5A5' : '#991B1B', fontFamily: 'monospace' }}>
                • {tn}
              </Typography>
            ))}
          </Box>
          <DialogContentText fontSize={13}>
            Completing this task before its prerequisites may break your project schedule. Are you sure you want to complete it anyway?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setBlockedWarning({ open: false, blockingTasks: [] })} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleConfirmOverrideCompletion} variant="contained" color="error" sx={{ textTransform: 'none' }}>
            Complete Anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
}
