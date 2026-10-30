import React, { useState, useEffect } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  useTheme,
  TablePagination,
  Popover,
  TextField,
  Button,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  MoreVertical,
  Calendar,
  AlertCircle,
  Archive,
  Trash2,
  Edit3,
  XCircle,
  RotateCcw,
  ListTree,
  CheckCircle2,
  Circle,
  Check,
  X,
  ChevronDown,
  Play,
  Square,
} from 'lucide-react';
import { PTTask, TaskPriority, PTTaskUpdate } from '@/api/personalTasksApi';
import EmptyState from '@/components/ui/EmptyState';
import { formatDate } from '@/utils/format';
import { isPast, isToday, parseISO, addDays, format } from 'date-fns';

interface PTTaskTableProps {
  tasks: PTTask[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  activeTimerTaskId?: number | null;
  selectedIds?: number[];
  onToggleSelect?: (id: number) => void;
  onSelectAll?: (ids: number[]) => void;
  onOpenTask: (task: PTTask) => void;
  onToggleComplete: (task: PTTask) => void;
  onStartTimer?: (taskId: number) => void;
  onStopTimer?: (taskId: number) => void;
  onCancelTask: (task: PTTask) => void;
  onReopenTask: (taskId: number) => void;
  onArchiveTask: (taskId: number) => void;
  onDeleteTask: (taskId: number) => void;
  onUpdateTask?: (id: number, data: Partial<PTTaskUpdate>) => Promise<void> | void;
}

export default function PTTaskTable({
  tasks,
  isLoading,
  emptyTitle = 'No Tasks Found',
  emptyHint = 'Tasks created or planned will appear here.',
  activeTimerTaskId,
  selectedIds = [],
  onToggleSelect,
  onSelectAll,
  onOpenTask,
  onToggleComplete,
  onStartTimer,
  onStopTimer,
  onCancelTask,
  onReopenTask,
  onArchiveTask,
  onDeleteTask,
  onUpdateTask,
}: PTTaskTableProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Pagination state (defaults to 25 rows per page)
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    if (page > 0 && page * rowsPerPage >= tasks.length) {
      setPage(0);
    }
  }, [tasks.length, page, rowsPerPage]);

  // Context Actions Menu
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTask, setMenuTask] = useState<PTTask | null>(null);

  // Inline Title Editing
  const [editingTitleTaskId, setEditingTitleTaskId] = useState<number | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState<string>('');

  // Inline Priority Menu
  const [priorityAnchor, setPriorityAnchor] = useState<{ el: HTMLElement; task: PTTask } | null>(null);

  // Inline Status Menu
  const [statusAnchor, setStatusAnchor] = useState<{ el: HTMLElement; task: PTTask } | null>(null);

  // Inline Due Date Popover
  const [dueDateAnchor, setDueDateAnchor] = useState<{ el: HTMLElement; task: PTTask } | null>(null);
  const [dueDateValue, setDueDateValue] = useState<string>('');

  // Cancellation Reason Dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelingTask, setCancelingTask] = useState<PTTask | null>(null);
  const [cancelReasonText, setCancelReasonText] = useState('Cancelled by user');

  // Blocked / On Hold Reason Dialog
  const [holdDialogOpen, setHoldDialogOpen] = useState(false);
  const [holdingTask, setHoldingTask] = useState<PTTask | null>(null);
  const [holdReasonText, setHoldReasonText] = useState('');

  // Actions menu handlers
  const handleOpenMenu = (e: React.MouseEvent<HTMLElement>, task: PTTask) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
    setMenuTask(task);
  };

  const handleCloseMenu = () => {
    setMenuAnchorEl(null);
    setMenuTask(null);
  };

  // Priority helpers
  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'URGENT':
        return '#EF4444';
      case 'HIGH':
        return '#F97316';
      case 'NORMAL':
        return '#3B82F6';
      case 'LOW':
        return '#64748B';
      default:
        return '#64748B';
    }
  };

  const handleSelectPriority = async (priority: TaskPriority) => {
    if (!priorityAnchor || !onUpdateTask) return;
    const taskId = priorityAnchor.task.id;
    setPriorityAnchor(null);
    await onUpdateTask(taskId, { priority });
  };

  // Status handlers
  const handleSelectStatus = async (statusType: 'todo' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled') => {
    if (!statusAnchor) return;
    const task = statusAnchor.task;
    setStatusAnchor(null);

    if (statusType === 'completed') {
      if (!task.is_completed) {
        onToggleComplete(task);
      }
      return;
    }

    if (statusType === 'cancelled') {
      setCancelingTask(task);
      setCancelReasonText(task.cancellation_reason || 'Cancelled by user');
      setCancelDialogOpen(true);
      return;
    }

    if (statusType === 'on_hold') {
      setHoldingTask(task);
      setHoldReasonText(task.blocked_reason || '');
      setHoldDialogOpen(true);
      return;
    }

    if (!onUpdateTask) return;

    if (statusType === 'todo') {
      if (task.is_completed) {
        onToggleComplete(task);
      } else {
        await onUpdateTask(task.id, {
          status_id: 1,
          is_completed: false,
          blocked_reason: null,
        });
      }
    } else if (statusType === 'in_progress') {
      await onUpdateTask(task.id, {
        status_id: 2,
        is_completed: false,
        blocked_reason: null,
      });
    }
  };

  // Inline Title Save
  const handleSaveTitle = async (taskId: number) => {
    if (editingTitleValue.trim() && onUpdateTask) {
      await onUpdateTask(taskId, { title: editingTitleValue.trim() });
    }
    setEditingTitleTaskId(null);
  };

  // Inline Due Date Save
  const handleSaveDueDate = async (dateStr: string | null) => {
    if (!dueDateAnchor || !onUpdateTask) return;
    const taskId = dueDateAnchor.task.id;
    setDueDateAnchor(null);
    await onUpdateTask(taskId, { due_date: dateStr || undefined });
  };

  const isAllSelected = tasks.length > 0 && selectedIds.length === tasks.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < tasks.length;

  const paginatedTasks = tasks.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (!isLoading && tasks.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 6,
          textAlign: 'center',
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          backgroundColor: isDark ? '#181D22' : '#FFFFFF',
        }}
      >
        <EmptyState title={emptyTitle} hint={emptyHint} />
      </Paper>
    );
  }

  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        backgroundColor: isDark ? '#181D22' : '#FFFFFF',
        overflowX: 'auto',
        overflowY: 'visible',
      }}
    >
      <Table size="small" stickyHeader>
        <TableHead
          sx={{
            '& th': {
              fontWeight: 700,
              fontSize: '0.75rem',
              color: isDark ? '#94A3B8' : '#64748B',
              backgroundColor: isDark ? '#14181C' : '#F8FAF8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              py: 1.5,
              borderBottom: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            },
          }}
        >
          <TableRow>
            {onToggleSelect && (
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  checked={isAllSelected}
                  indeterminate={isSomeSelected}
                  onChange={(e) => {
                    if (onSelectAll) {
                      onSelectAll(e.target.checked ? tasks.map((t) => t.id) : []);
                    }
                  }}
                />
              </TableCell>
            )}
            <TableCell sx={{ width: 40 }}></TableCell>
            <TableCell sx={{ width: 110 }}>ID</TableCell>
            <TableCell>Task</TableCell>
            <TableCell sx={{ width: 130 }}>Priority</TableCell>
            <TableCell sx={{ width: 150 }}>Status</TableCell>
            <TableCell sx={{ width: 150 }}>Due Date</TableCell>
            <TableCell sx={{ width: 50 }} align="right">Actions</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {paginatedTasks.map((task) => {
            const isCompleted = task.is_completed;
            const isCancelled = !!task.cancelled_at;
            const isRunningTimer = activeTimerTaskId === task.id;

            const displayStatus = isCompleted
              ? { name: 'Completed', color: '#16C47F' }
              : isCancelled
                ? { name: 'Cancelled', color: '#EF4444' }
                : task.blocked_reason
                  ? { name: 'On Hold', color: '#D97706' }
                  : {
                      name: task.status_name && task.status_name.toLowerCase() !== 'done'
                        ? task.status_name
                        : (task.status_name?.toLowerCase() === 'done' ? 'Completed' : 'To Do'),
                      color: task.status_color || '#64748B',
                    };
            const isSelected = selectedIds.includes(task.id);
            const isEditingTitle = editingTitleTaskId === task.id;

            // Due Date Calculation
            let isOverdue = false;
            let isDueToday = false;
            if (task.due_date && !isCompleted && !isCancelled) {
              try {
                const parsedDate = parseISO(task.due_date);
                isOverdue = isPast(parsedDate) && !isToday(parsedDate);
                isDueToday = isToday(parsedDate);
              } catch {
                // Ignore parse errors
              }
            }

            return (
              <TableRow
                key={task.id}
                hover
                selected={isSelected}
                sx={{
                  opacity: isCompleted || isCancelled ? 0.65 : 1,
                  backgroundColor: isRunningTimer
                    ? isDark
                      ? 'rgba(22, 196, 127, 0.08)'
                      : 'rgba(22, 196, 127, 0.06)'
                    : 'inherit',
                  '&:last-child td, &:last-child th': { border: 0 },
                }}
              >
                {/* Selection Checkbox */}
                {onToggleSelect && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={isSelected}
                      onChange={() => onToggleSelect(task.id)}
                    />
                  </TableCell>
                )}

                {/* Complete / Reopen Toggle */}
                <TableCell padding="none" sx={{ pl: 1 }}>
                  <IconButton
                    size="small"
                    onClick={() => onToggleComplete(task)}
                    sx={{
                      color: isCompleted
                        ? '#16C47F'
                        : isDark
                        ? '#64748B'
                        : '#94A3B8',
                      '&:hover': {
                        color: isCompleted ? '#DC2626' : '#16C47F',
                      },
                    }}
                  >
                    {isCompleted ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </IconButton>
                </TableCell>

                {/* Task Number */}
                <TableCell>
                  <Chip
                    label={task.task_number}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
                    }}
                  />
                </TableCell>

                {/* Title & Tags & Subtask Rollup (ONLY clicking task name opens sidepane) */}
                <TableCell>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {isEditingTitle ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TextField
                          size="small"
                          autoFocus
                          value={editingTitleValue}
                          onChange={(e) => setEditingTitleValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveTitle(task.id);
                            if (e.key === 'Escape') setEditingTitleTaskId(null);
                          }}
                          sx={{
                            flex: 1,
                            '.MuiInputBase-input': {
                              py: 0.5,
                              px: 1,
                              fontSize: '0.85rem',
                              fontWeight: 600,
                            },
                          }}
                        />
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleSaveTitle(task.id)}
                        >
                          <Check size={16} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => setEditingTitleTaskId(null)}
                        >
                          <X size={16} />
                        </IconButton>
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          '&:hover .task-edit-btn': { opacity: 1 },
                        }}
                      >
                        <Typography
                          variant="body2"
                          onClick={() => onOpenTask(task)}
                          title="Click to open task details"
                          sx={{
                            fontWeight: 600,
                            cursor: 'pointer',
                            textDecoration: isCompleted ? 'line-through' : 'none',
                            color: isCompleted
                              ? isDark
                                ? '#94A3B8'
                                : '#64748B'
                              : 'inherit',
                            transition: 'color 0.15s ease',
                            '&:hover': {
                              color: '#16C47F',
                              textDecoration: isCompleted ? 'line-through' : 'underline',
                            },
                          }}
                        >
                          {task.title}
                        </Typography>

                        {/* Inline quick title edit pencil */}
                        {onUpdateTask && (
                          <IconButton
                            className="task-edit-btn"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTitleTaskId(task.id);
                              setEditingTitleValue(task.title);
                            }}
                            title="Edit task title inline"
                            sx={{
                              opacity: 0,
                              p: 0.25,
                              transition: 'opacity 0.2s',
                              color: isDark ? '#94A3B8' : '#64748B',
                              '&:hover': { color: '#16C47F' },
                            }}
                          >
                            <Edit3 size={13} />
                          </IconButton>
                        )}

                        {isCancelled && (
                          <Chip
                            label="Cancelled"
                            size="small"
                            color="error"
                            sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                          />
                        )}

                        {task.blocked_reason && (
                          <Tooltip title={`Blocked: ${task.blocked_reason}`}>
                            <Chip
                              icon={<AlertCircle size={11} />}
                              label="On Hold"
                              size="small"
                              color="warning"
                              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600 }}
                            />
                          </Tooltip>
                        )}
                      </Box>
                    )}

                    {/* Subtask progress if any */}
                    {task.subtask_count > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: 180 }}>
                        <ListTree size={12} color={isDark ? '#94A3B8' : '#64748B'} />
                        <LinearProgress
                          variant="determinate"
                          value={task.progress_percentage || 0}
                          sx={{ flex: 1, height: 4, borderRadius: 2 }}
                        />
                        <Typography variant="caption" sx={{ fontSize: '0.68rem', color: isDark ? '#94A3B8' : '#64748B' }}>
                          {task.completed_subtask_count}/{task.subtask_count}
                        </Typography>
                      </Box>
                    )}

                    {/* Tags */}
                    {task.tags_list && task.tags_list.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {task.tags_list.map((tag) => (
                          <Chip
                            key={tag.id}
                            label={`#${tag.name}`}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              backgroundColor: `${tag.color || '#3B82F6'}15`,
                              color: tag.color || '#3B82F6',
                              borderColor: `${tag.color || '#3B82F6'}30`,
                            }}
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
                </TableCell>

                {/* Priority (Direct Editable Menu) */}
                <TableCell>
                  <Tooltip title="Click to change priority">
                    <Chip
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <span>{task.priority}</span>
                          <ChevronDown size={11} />
                        </Box>
                      }
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPriorityAnchor({ el: e.currentTarget, task });
                      }}
                      sx={{
                        cursor: 'pointer',
                        height: 24,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        backgroundColor: `${getPriorityColor(task.priority)}15`,
                        color: getPriorityColor(task.priority),
                        border: `1px solid ${getPriorityColor(task.priority)}40`,
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          backgroundColor: `${getPriorityColor(task.priority)}28`,
                          borderColor: getPriorityColor(task.priority),
                        },
                      }}
                    />
                  </Tooltip>
                </TableCell>

                {/* Status (Direct Editable Menu) */}
                <TableCell>
                  <Tooltip title="Click to change status">
                    <Chip
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <span>{displayStatus.name}</span>
                          <ChevronDown size={11} />
                        </Box>
                      }
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusAnchor({ el: e.currentTarget, task });
                      }}
                      sx={{
                        cursor: 'pointer',
                        height: 24,
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        backgroundColor: `${displayStatus.color}20`,
                        color: displayStatus.color,
                        border: `1px solid ${displayStatus.color}40`,
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          border: `1px solid ${displayStatus.color}`,
                          backgroundColor: `${displayStatus.color}30`,
                        },
                      }}
                    />
                  </Tooltip>
                </TableCell>

                {/* Due Date / Completion Date & Time */}
                <TableCell>
                  {isCompleted ? (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.75,
                        px: 1,
                        py: 0.35,
                        borderRadius: 1.5,
                        backgroundColor: isDark ? 'rgba(22, 196, 127, 0.12)' : 'rgba(22, 196, 127, 0.08)',
                        color: '#16C47F',
                        fontWeight: 600,
                        fontSize: '0.78rem',
                      }}
                    >
                      <CheckCircle2 size={13} />
                      <span>
                        {formatDate(task.completion_date || task.completed_at || task.due_date)}{' '}
                        {task.completion_time || (task.completed_at ? format(parseISO(task.completed_at), 'hh:mm a') : '')}
                      </span>
                    </Box>
                  ) : (
                    <Tooltip title="Click to change due date">
                      <Box
                        onClick={(e) => {
                          e.stopPropagation();
                          setDueDateAnchor({ el: e.currentTarget, task });
                          setDueDateValue(task.due_date ? task.due_date.split('T')[0] : '');
                        }}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.75,
                          px: 1,
                          py: 0.35,
                          borderRadius: 1.5,
                          cursor: 'pointer',
                          border: '1px dashed transparent',
                          backgroundColor: isOverdue
                            ? 'rgba(239, 68, 68, 0.12)'
                            : isDueToday
                            ? 'rgba(249, 115, 22, 0.12)'
                            : isDark
                            ? 'rgba(255,255,255,0.04)'
                            : 'rgba(0,0,0,0.04)',
                          color: isOverdue
                            ? '#EF4444'
                            : isDueToday
                            ? '#F97316'
                            : 'inherit',
                          fontWeight: isOverdue || isDueToday ? 700 : 500,
                          fontSize: '0.78rem',
                          transition: 'all 0.15s ease',
                          '&:hover': {
                            border: '1px dashed',
                            borderColor: '#16C47F',
                            backgroundColor: isDark ? 'rgba(22, 196, 127, 0.08)' : 'rgba(22, 196, 127, 0.06)',
                          },
                        }}
                      >
                        <Calendar size={13} />
                        <span>{task.due_date ? formatDate(task.due_date) : 'Set date'}</span>
                      </Box>
                    </Tooltip>
                  )}
                </TableCell>

                {/* Actions Menu */}
                <TableCell align="right">
                  <IconButton size="small" onClick={(e) => handleOpenMenu(e, task)}>
                    <MoreVertical size={16} />
                  </IconButton>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Pagination Bar */}
      <TablePagination
        rowsPerPageOptions={[10, 25, 50, 100, 200]}
        component="div"
        count={tasks.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        labelRowsPerPage="Rows per page:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} of ${count}`}
        sx={{
          borderTop: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          color: isDark ? '#94A3B8' : '#64748B',
          '.MuiTablePagination-toolbar': {
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            px: { xs: 1, sm: 2 },
            gap: { xs: 0.5, sm: 1 },
          },
          '.MuiTablePagination-select': {
            fontSize: '0.8rem',
          },
        }}
      />

      {/* 1. Priority Dropdown Menu */}
      <Menu
        anchorEl={priorityAnchor?.el}
        open={Boolean(priorityAnchor)}
        onClose={() => setPriorityAnchor(null)}
        PaperProps={{
          sx: {
            minWidth: 150,
            borderRadius: 2,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          },
        }}
      >
        <MenuItem onClick={() => handleSelectPriority('URGENT')}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#EF4444', mr: 1.5 }} />
          <ListItemText primary="Urgent" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }} />
        </MenuItem>
        <MenuItem onClick={() => handleSelectPriority('HIGH')}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#F97316', mr: 1.5 }} />
          <ListItemText primary="High" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }} />
        </MenuItem>
        <MenuItem onClick={() => handleSelectPriority('NORMAL')}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#3B82F6', mr: 1.5 }} />
          <ListItemText primary="Normal" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }} />
        </MenuItem>
        <MenuItem onClick={() => handleSelectPriority('LOW')}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#64748B', mr: 1.5 }} />
          <ListItemText primary="Low" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }} />
        </MenuItem>
      </Menu>

      {/* 2. Status Dropdown Menu */}
      <Menu
        anchorEl={statusAnchor?.el}
        open={Boolean(statusAnchor)}
        onClose={() => setStatusAnchor(null)}
        PaperProps={{
          sx: {
            minWidth: 160,
            borderRadius: 2,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          },
        }}
      >
        <MenuItem onClick={() => handleSelectStatus('todo')}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#64748B', mr: 1.5 }} />
          <ListItemText primary="To Do" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }} />
        </MenuItem>
        <MenuItem onClick={() => handleSelectStatus('in_progress')}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#2563EB', mr: 1.5 }} />
          <ListItemText primary="In Progress" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }} />
        </MenuItem>
        <MenuItem onClick={() => handleSelectStatus('on_hold')}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#D97706', mr: 1.5 }} />
          <ListItemText primary="On Hold..." primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }} />
        </MenuItem>
        <MenuItem onClick={() => handleSelectStatus('completed')}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#16C47F', mr: 1.5 }} />
          <ListItemText primary="Completed" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }} />
        </MenuItem>
        <MenuItem onClick={() => handleSelectStatus('cancelled')}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#EF4444', mr: 1.5 }} />
          <ListItemText primary="Cancelled..." primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600, color: '#EF4444' }} />
        </MenuItem>
      </Menu>

      {/* 3. Due Date Popover */}
      <Popover
        anchorEl={dueDateAnchor?.el}
        open={Boolean(dueDateAnchor)}
        onClose={() => setDueDateAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            p: 2,
            width: 260,
            borderRadius: 2,
            boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          },
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Set Due Date
        </Typography>

        {/* Quick presets */}
        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => handleSaveDueDate(format(new Date(), 'yyyy-MM-dd'))}
            sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25 }}
          >
            Today
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => handleSaveDueDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}
            sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25 }}
          >
            Tomorrow
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => handleSaveDueDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'))}
            sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25 }}
          >
            +7 Days
          </Button>
        </Stack>

        <TextField
          type="date"
          fullWidth
          size="small"
          value={dueDateValue}
          onChange={(e) => setDueDateValue(e.target.value)}
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            size="small"
            color="error"
            onClick={() => handleSaveDueDate(null)}
            sx={{ textTransform: 'none', fontSize: '0.78rem' }}
          >
            Clear
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => handleSaveDueDate(dueDateValue)}
            sx={{
              textTransform: 'none',
              backgroundColor: '#16C47F',
              '&:hover': { backgroundColor: '#13A86B' },
            }}
          >
            Save
          </Button>
        </Box>
      </Popover>

      {/* 4. Cancellation Reason Dialog */}
      <Dialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Cancel Task</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5, color: isDark ? '#94A3B8' : '#64748B' }}>
            Provide a reason for cancelling "{cancelingTask?.title}":
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="e.g. Deprecated, duplicate, no longer needed"
            value={cancelReasonText}
            onChange={(e) => setCancelReasonText(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCancelDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Back
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (cancelingTask) {
                onCancelTask({
                  ...cancelingTask,
                  cancellation_reason: cancelReasonText.trim() || 'Cancelled by user',
                });
              }
              setCancelDialogOpen(false);
            }}
            sx={{ textTransform: 'none' }}
          >
            Confirm Cancellation
          </Button>
        </DialogActions>
      </Dialog>

      {/* 5. Blocked / On Hold Reason Dialog */}
      <Dialog
        open={holdDialogOpen}
        onClose={() => setHoldDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Put Task On Hold</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5, color: isDark ? '#94A3B8' : '#64748B' }}>
            Provide what is blocking "{holdingTask?.title}":
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="e.g. Waiting on client feedback, pending vendor approval"
            value={holdReasonText}
            onChange={(e) => setHoldReasonText(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setHoldDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Back
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={async () => {
              if (holdingTask && onUpdateTask) {
                await onUpdateTask(holdingTask.id, {
                  status_id: 5,
                  blocked_reason: holdReasonText.trim() || 'Blocked / On Hold',
                });
              }
              setHoldDialogOpen(false);
            }}
            sx={{ textTransform: 'none' }}
          >
            Put On Hold
          </Button>
        </DialogActions>
      </Dialog>

      {/* 6. Row Context Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleCloseMenu}
        PaperProps={{
          sx: {
            minWidth: 170,
            borderRadius: 2,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          },
        }}
      >
        <MenuItem
          onClick={() => {
            if (menuTask) onOpenTask(menuTask);
            handleCloseMenu();
          }}
        >
          <ListItemIcon>
            <Edit3 size={15} />
          </ListItemIcon>
          <ListItemText primary="Open Details" />
        </MenuItem>

        {/* Timer start / stop from action menu */}
        {menuTask && onStartTimer && onStopTimer && (
          activeTimerTaskId === menuTask.id ? (
            <MenuItem
              onClick={() => {
                onStopTimer(menuTask.id);
                handleCloseMenu();
              }}
              sx={{ color: '#EF4444' }}
            >
              <ListItemIcon>
                <Square size={15} color="#EF4444" />
              </ListItemIcon>
              <ListItemText primary="Stop Timer" />
            </MenuItem>
          ) : (
            <MenuItem
              onClick={() => {
                onStartTimer(menuTask.id);
                handleCloseMenu();
              }}
              disabled={menuTask.is_completed || !!menuTask.cancelled_at}
            >
              <ListItemIcon>
                <Play size={15} color="#16C47F" />
              </ListItemIcon>
              <ListItemText primary="Start Timer" />
            </MenuItem>
          )
        )}

        {menuTask?.cancelled_at || menuTask?.is_completed ? (
          <MenuItem
            onClick={() => {
              if (menuTask) onReopenTask(menuTask.id);
              handleCloseMenu();
            }}
          >
            <ListItemIcon>
              <RotateCcw size={15} color="#16C47F" />
            </ListItemIcon>
            <ListItemText primary="Reopen Task" />
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => {
              if (menuTask) {
                setCancelingTask(menuTask);
                setCancelReasonText('Cancelled by user');
                setCancelDialogOpen(true);
              }
              handleCloseMenu();
            }}
          >
            <ListItemIcon>
              <XCircle size={15} color="#F97316" />
            </ListItemIcon>
            <ListItemText primary="Cancel Task..." />
          </MenuItem>
        )}

        <MenuItem
          onClick={() => {
            if (menuTask) onArchiveTask(menuTask.id);
            handleCloseMenu();
          }}
        >
          <ListItemIcon>
            <Archive size={15} />
          </ListItemIcon>
          <ListItemText primary="Archive Task" />
        </MenuItem>

        <MenuItem
          onClick={() => {
            if (menuTask) onDeleteTask(menuTask.id);
            handleCloseMenu();
          }}
          sx={{ color: '#EF4444' }}
        >
          <ListItemIcon>
            <Trash2 size={15} color="#EF4444" />
          </ListItemIcon>
          <ListItemText primary="Delete" />
        </MenuItem>
      </Menu>
    </TableContainer>
  );
}
