import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  LinearProgress,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Play,
  Square,
  MoreVertical,
  Calendar,
  Clock,
  ListTree,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { PTTask } from '@/api/personalTasksApi';
import { formatDate } from '@/utils/format';

interface PTKanbanProps {
  tasks: PTTask[];
  activeTimerTaskId?: number | null;
  onOpenTask: (task: PTTask) => void;
  onStatusChange: (task: PTTask, newStatus: string) => void;
  onStartTimer: (taskId: number) => void;
  onStopTimer: (taskId: number) => void;
  onQuickAdd?: () => void;
}

export default function PTKanban({
  tasks,
  activeTimerTaskId,
  onOpenTask,
  onStatusChange,
  onStartTimer,
  onStopTimer,
  onQuickAdd,
}: PTKanbanProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const columns: Array<{ id: string; label: string; color: string }> = [
    { id: 'todo', label: 'To Do', color: '#64748B' },
    { id: 'inprogress', label: 'In Progress', color: '#3B82F6' },
    { id: 'onhold', label: 'On Hold', color: '#F59E0B' },
    { id: 'completed', label: 'Completed', color: '#16C47F' },
    { id: 'cancelled', label: 'Cancelled', color: '#EF4444' },
  ];

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'URGENT':
        return '#EF4444';
      case 'HIGH':
        return '#F97316';
      case 'NORMAL':
        return '#3B82F6';
      default:
        return '#64748B';
    }
  };

  const getTasksForColumn = (colId: string) => {
    return tasks.filter((t) => {
      if (colId === 'completed') return t.is_completed;
      if (colId === 'cancelled') return !!t.cancelled_at;
      if (colId === 'onhold') return !!t.blocked_reason && !t.is_completed;
      if (colId === 'inprogress') {
        const cat = (t.status_category || '').toUpperCase();
        return (cat === 'ACTIVE' || cat === 'IN_PROGRESS') && !t.is_completed && !t.blocked_reason;
      }
      // 'todo'
      return !t.is_completed && !t.cancelled_at && !t.blocked_reason && (t.status_category === 'NOT_STARTED' || !t.status_category);
    });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        overflowX: 'auto',
        pb: 2,
        alignItems: 'flex-start',
        minHeight: 'calc(100vh - 280px)',
      }}
    >
      {columns.map((col) => {
        const colTasks = getTasksForColumn(col.id);

        return (
          <Paper
            key={col.id}
            elevation={0}
            sx={{
              width: 300,
              flexShrink: 0,
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              backgroundColor: isDark ? '#14181C' : '#F8FAF8',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            {/* Column Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    backgroundColor: col.color,
                  }}
                />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {col.label}
                </Typography>
                <Chip
                  label={colTasks.length}
                  size="small"
                  sx={{
                    height: 20,
                    minWidth: 20,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                  }}
                />
              </Box>

              {col.id === 'todo' && onQuickAdd && (
                <IconButton size="small" onClick={onQuickAdd}>
                  <Plus size={16} />
                </IconButton>
              )}
            </Box>

            {/* Column Cards */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {colTasks.length === 0 ? (
                <Typography variant="caption" sx={{ color: '#94A3B8', py: 3, textAlign: 'center', fontStyle: 'italic' }}>
                  No tasks
                </Typography>
              ) : (
                colTasks.map((task) => {
                  const isRunningTimer = activeTimerTaskId === task.id;

                  return (
                    <Paper
                      key={task.id}
                      elevation={0}
                      onClick={() => onOpenTask(task)}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: isRunningTimer
                          ? '#16C47F'
                          : isDark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.06)',
                        backgroundColor: isDark ? '#181D22' : '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        transition: 'transform 0.1s, box-shadow 0.1s',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Chip
                          label={task.task_number}
                          size="small"
                          sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                        />
                        <Chip
                          label={task.priority}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            color: getPriorityColor(task.priority),
                            backgroundColor: `${getPriorityColor(task.priority)}15`,
                          }}
                        />
                      </Box>

                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          textDecoration: task.is_completed ? 'line-through' : 'none',
                        }}
                      >
                        {task.title}
                      </Typography>

                      {task.blocked_reason && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#F59E0B', fontSize: '0.72rem' }}>
                          <AlertCircle size={13} />
                          <span>{task.blocked_reason}</span>
                        </Box>
                      )}

                      {task.subtask_count > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={task.progress_percentage || 0}
                            sx={{ flex: 1, height: 4, borderRadius: 2 }}
                          />
                          <Typography variant="caption" sx={{ fontSize: '0.68rem', color: '#64748B' }}>
                            {task.completed_subtask_count}/{task.subtask_count}
                          </Typography>
                        </Box>
                      )}

                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          pt: 0.5,
                          borderTop: '1px solid',
                          borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.72rem', color: '#64748B' }}>
                          <Calendar size={12} />
                          <span>{task.due_date ? formatDate(task.due_date) : 'No date'}</span>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                          <Typography variant="caption" sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B' }}>
                            {task.estimated_hours || 0}h
                          </Typography>
                          {isRunningTimer ? (
                            <IconButton size="small" onClick={() => onStopTimer(task.id)} sx={{ color: '#EF4444' }}>
                              <Square size={13} />
                            </IconButton>
                          ) : (
                            <IconButton
                              size="small"
                              disabled={task.is_completed || !!task.cancelled_at}
                              onClick={() => onStartTimer(task.id)}
                              sx={{ color: '#16C47F' }}
                            >
                              <Play size={13} />
                            </IconButton>
                          )}
                        </Box>
                      </Box>
                    </Paper>
                  );
                })
              )}
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
}
