import React, { useState } from 'react';
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
} from '@mui/material';
import {
  Play,
  Square,
  MoreVertical,
  Calendar,
  Clock,
  AlertCircle,
  Tag as TagIcon,
  Archive,
  Trash2,
  Edit3,
  XCircle,
  RotateCcw,
  ListTree,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { PTTask } from '@/api/personalTasksApi';
import EmptyState from '@/components/ui/EmptyState';
import { formatDate } from '@/utils/format';
import { isPast, isToday, parseISO } from 'date-fns';

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
  onStartTimer: (taskId: number) => void;
  onStopTimer: (taskId: number) => void;
  onCancelTask: (task: PTTask) => void;
  onReopenTask: (taskId: number) => void;
  onArchiveTask: (taskId: number) => void;
  onDeleteTask: (taskId: number) => void;
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
}: PTTaskTableProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTask, setMenuTask] = useState<PTTask | null>(null);

  const handleOpenMenu = (e: React.MouseEvent<HTMLElement>, task: PTTask) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
    setMenuTask(task);
  };

  const handleCloseMenu = () => {
    setMenuAnchorEl(null);
    setMenuTask(null);
  };

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

  const isAllSelected = tasks.length > 0 && selectedIds.length === tasks.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < tasks.length;

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
        overflow: 'hidden',
      }}
    >
      <Table size="small">
        <TableHead
          sx={{
            backgroundColor: isDark ? '#14181C' : '#F8FAF8',
            '& th': {
              fontWeight: 700,
              fontSize: '0.75rem',
              color: isDark ? '#94A3B8' : '#64748B',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              py: 1.5,
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
            <TableCell sx={{ width: 100 }}>ID</TableCell>
            <TableCell>Task</TableCell>
            <TableCell sx={{ width: 110 }}>Priority</TableCell>
            <TableCell sx={{ width: 130 }}>Status</TableCell>
            <TableCell sx={{ width: 130 }}>Due Date</TableCell>
            <TableCell sx={{ width: 120 }}>Est / Act</TableCell>
            <TableCell sx={{ width: 70 }} align="center">Timer</TableCell>
            <TableCell sx={{ width: 50 }} align="right">Actions</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {tasks.map((task) => {
            const isCompleted = task.is_completed;
            const isCancelled = !!task.cancelled_at;
            const isRunningTimer = activeTimerTaskId === task.id;
            const isSelected = selectedIds.includes(task.id);

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

            const isOverEstimate = (task.actual_hours || 0) > (task.estimated_hours || 0) && (task.estimated_hours || 0) > 0;

            return (
              <TableRow
                key={task.id}
                hover
                selected={isSelected}
                onClick={() => onOpenTask(task)}
                sx={{
                  cursor: 'pointer',
                  opacity: isCompleted || isCancelled ? 0.65 : 1,
                  backgroundColor: isRunningTimer
                    ? isDark
                      ? 'rgba(22, 196, 127, 0.08)'
                      : 'rgba(22, 196, 127, 0.06)'
                    : 'inherit',
                  '&:last-child td, &:last-child th': { border: 0 },
                }}
              >
                {onToggleSelect && (
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      size="small"
                      checked={isSelected}
                      onChange={() => onToggleSelect(task.id)}
                    />
                  </TableCell>
                )}

                {/* Complete Toggle */}
                <TableCell padding="none" sx={{ pl: 1 }} onClick={(e) => e.stopPropagation()}>
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

                {/* Title & Tags & Subtask Rollup */}
                <TableCell>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          textDecoration: isCompleted ? 'line-through' : 'none',
                          color: isCompleted
                            ? isDark
                              ? '#94A3B8'
                              : '#64748B'
                            : 'inherit',
                        }}
                      >
                        {task.title}
                      </Typography>

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

                {/* Priority */}
                <TableCell>
                  <Chip
                    label={task.priority}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      backgroundColor: `${getPriorityColor(task.priority)}15`,
                      color: getPriorityColor(task.priority),
                      border: `1px solid ${getPriorityColor(task.priority)}40`,
                    }}
                  />
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Chip
                    label={task.status_name || (isCompleted ? 'Completed' : 'To Do')}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      backgroundColor: task.status_color ? `${task.status_color}20` : '#E2E8F0',
                      color: isDark ? '#FFFFFF' : '#1E293B',
                    }}
                  />
                </TableCell>

                {/* Due Date */}
                <TableCell>
                  {task.due_date ? (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.75,
                        px: 1,
                        py: 0.25,
                        borderRadius: 1.5,
                        backgroundColor: isOverdue
                          ? 'rgba(239, 68, 68, 0.12)'
                          : isDueToday
                          ? 'rgba(249, 115, 22, 0.12)'
                          : 'transparent',
                        color: isOverdue
                          ? '#EF4444'
                          : isDueToday
                          ? '#F97316'
                          : 'inherit',
                        fontWeight: isOverdue || isDueToday ? 700 : 500,
                        fontSize: '0.78rem',
                      }}
                    >
                      <Calendar size={13} />
                      <span>{formatDate(task.due_date)}</span>
                    </Box>
                  ) : (
                    <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                      No date
                    </Typography>
                  )}
                </TableCell>

                {/* Estimated vs Actual Hours */}
                <TableCell>
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: isOverEstimate ? '#EF4444' : 'inherit',
                      }}
                    >
                      {task.actual_hours || 0}h / {task.estimated_hours || 0}h
                    </Typography>
                    {isOverEstimate && (
                      <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#EF4444', fontWeight: 600 }}>
                        Over estimate!
                      </Typography>
                    )}
                  </Box>
                </TableCell>

                {/* Running Timer Toggle */}
                <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                  {isRunningTimer ? (
                    <Tooltip title="Stop timer">
                      <IconButton
                        size="small"
                        onClick={() => onStopTimer(task.id)}
                        sx={{
                          backgroundColor: '#EF444420',
                          color: '#EF4444',
                          '&:hover': { backgroundColor: '#EF444430' },
                        }}
                      >
                        <Square size={14} />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Start timer">
                      <IconButton
                        size="small"
                        onClick={() => onStartTimer(task.id)}
                        disabled={isCompleted || isCancelled}
                        sx={{
                          color: isDark ? '#94A3B8' : '#64748B',
                          '&:hover': { color: '#16C47F' },
                        }}
                      >
                        <Play size={14} />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>

                {/* Actions Menu */}
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  <IconButton size="small" onClick={(e) => handleOpenMenu(e, task)}>
                    <MoreVertical size={16} />
                  </IconButton>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Row Context Menu */}
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
          <ListItemText primary="Edit Details" />
        </MenuItem>

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
              if (menuTask) onCancelTask(menuTask);
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
