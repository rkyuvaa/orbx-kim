import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  Calendar,
  AlertCircle,
  Plus,
  Clock,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { PTTask } from '@/api/personalTasksApi';
import { formatDate } from '@/utils/format';

interface PTKanbanProps {
  tasks: PTTask[];
  activeTimerTaskId?: number | null;
  onOpenTask: (task: PTTask) => void;
  onStatusChange: (task: PTTask, newStatus: string) => void | Promise<void>;
  onStartTimer: (taskId: number) => void;
  onStopTimer: (taskId: number) => void;
  onQuickAdd?: () => void;
}

interface DragState {
  task: PTTask;
  sourceColId: string;
  startPos: { x: number; y: number };
  currentPos: { x: number; y: number };
  offset: { x: number; y: number };
  cardRect: DOMRect;
  isDragging: boolean;
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
  const shouldReduceMotion = useReducedMotion();

  // Optimistic local tasks state
  const [localTasks, setLocalTasks] = useState<PTTask[]>(tasks);

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

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

  const getTasksForColumn = useCallback(
    (colId: string) => {
      return localTasks.filter((t) => {
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
    },
    [localTasks]
  );

  // Drag & Drop Controller
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [targetColumnId, setTargetColumnId] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  // Column DOM references for collision detection
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    task: PTTask,
    sourceColId: string
  ) => {
    // Only primary mouse button or touch
    if (e.button !== 0) return;

    // Don't drag if clicking buttons, links or chips
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('.no-drag')) return;

    const cardEl = e.currentTarget;
    const cardRect = cardEl.getBoundingClientRect();
    const offset = {
      x: e.clientX - cardRect.left,
      y: e.clientY - cardRect.top,
    };

    setDragState({
      task,
      sourceColId,
      startPos: { x: e.clientX, y: e.clientY },
      currentPos: { x: e.clientX, y: e.clientY },
      offset,
      cardRect,
      isDragging: false,
    });
    setTargetColumnId(null);
  };

  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        setDragState((prev) => {
          if (!prev) return null;
          const dist = Math.hypot(e.clientX - prev.startPos.x, e.clientY - prev.startPos.y);
          const isDragging = prev.isDragging || dist >= 5;

          return {
            ...prev,
            currentPos: { x: e.clientX, y: e.clientY },
            isDragging,
          };
        });

        // Detect target column collision
        const curX = e.clientX;
        const curY = e.clientY;
        let foundColId: string | null = null;

        for (const col of columns) {
          const colEl = columnRefs.current[col.id];
          if (colEl) {
            const rect = colEl.getBoundingClientRect();
            if (
              curX >= rect.left - 10 &&
              curX <= rect.right + 10 &&
              curY >= rect.top - 20 &&
              curY <= rect.bottom + 20
            ) {
              foundColId = col.id;
              break;
            }
          }
        }
        setTargetColumnId(foundColId);
      });
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      if (dragState) {
        if (dragState.isDragging) {
          // Card was dragged: drop into target column if valid
          if (targetColumnId && targetColumnId !== dragState.sourceColId) {
            const droppedTask = dragState.task;
            const newCol = targetColumnId;

            // 1. Optimistic update
            setLocalTasks((prev) =>
              prev.map((t) => {
                if (t.id !== droppedTask.id) return t;
                if (newCol === 'completed') {
                  return { ...t, is_completed: true, completed_at: new Date().toISOString() };
                }
                if (newCol === 'cancelled') {
                  return { ...t, cancelled_at: new Date().toISOString() };
                }
                if (newCol === 'onhold') {
                  return { ...t, is_completed: false, blocked_reason: t.blocked_reason || 'On Hold' };
                }
                if (newCol === 'inprogress') {
                  return { ...t, status_id: 2, status_category: 'IN_PROGRESS', is_completed: false, blocked_reason: null, cancelled_at: null };
                }
                // 'todo'
                return { ...t, status_id: 1, status_category: 'NOT_STARTED', is_completed: false, blocked_reason: null, cancelled_at: null };
              })
            );

            // 2. Async API update
            onStatusChange(droppedTask, newCol);
          }
        } else {
          // Less than 5px movement: treat as a normal card click!
          onOpenTask(dragState.task);
        }
      }

      setDragState(null);
      setTargetColumnId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [dragState, targetColumnId, columns, onStatusChange, onOpenTask]);

  const springConfig = shouldReduceMotion
    ? { duration: 0 }
    : { type: 'spring', stiffness: 400, damping: 30, mass: 0.8 };

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        overflowX: 'auto',
        pb: 3,
        pt: 1,
        alignItems: 'flex-start',
        minHeight: 'calc(100vh - 280px)',
        userSelect: dragState?.isDragging ? 'none' : 'auto',
      }}
    >
      {columns.map((col) => {
        const colTasks = getTasksForColumn(col.id);
        const isTarget = targetColumnId === col.id && dragState?.isDragging;
        const isSource = dragState?.sourceColId === col.id && dragState?.isDragging;

        return (
          <Paper
            key={col.id}
            ref={(el) => (columnRefs.current[col.id] = el as HTMLDivElement | null)}
            elevation={0}
            sx={{
              width: 300,
              flexShrink: 0,
              borderRadius: 2.5,
              border: '1.5px solid',
              borderColor: isTarget
                ? '#16C47F'
                : isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.08)',
              backgroundColor: isTarget
                ? isDark
                  ? 'rgba(22, 196, 127, 0.08)'
                  : 'rgba(22, 196, 127, 0.05)'
                : isDark
                ? '#14181C'
                : '#F8FAF8',
              boxShadow: isTarget
                ? '0 0 20px rgba(22, 196, 127, 0.22)'
                : 'none',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              transition: shouldReduceMotion
                ? 'none'
                : 'border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
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
                    transform: isTarget && !shouldReduceMotion ? 'scale(1.15)' : 'scale(1)',
                    transition: 'transform 0.2s ease',
                  }}
                />
              </Box>

              {col.id === 'todo' && onQuickAdd && (
                <IconButton size="small" onClick={onQuickAdd} className="no-drag">
                  <Plus size={16} />
                </IconButton>
              )}
            </Box>

            {/* Target Column Drop Slot Indicator */}
            <AnimatePresence>
              {isTarget && !isSource && (
                <motion.div
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, height: 0, scale: 0.95 }}
                  animate={{ opacity: 1, height: 42, scale: 1 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, scale: 0.95 }}
                  transition={{ duration: 0.18 }}
                  style={{ overflow: 'hidden' }}
                >
                  <Box
                    sx={{
                      height: 38,
                      borderRadius: 2,
                      border: '2px dashed #16C47F',
                      backgroundColor: 'rgba(22, 196, 127, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                    }}
                  >
                    <Sparkles size={14} color="#16C47F" />
                    <Typography
                      variant="caption"
                      sx={{ color: '#16C47F', fontWeight: 700, fontSize: '0.75rem' }}
                    >
                      Drop in {col.label}
                    </Typography>
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Column Cards Container */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                minHeight: 120,
                maxHeight: 'calc(100vh - 330px)',
                overflowY: 'auto',
                pr: 0.5,
              }}
            >
              {colTasks.length === 0 && !isTarget ? (
                <Typography
                  variant="caption"
                  sx={{
                    color: '#94A3B8',
                    py: 4,
                    textAlign: 'center',
                    fontStyle: 'italic',
                  }}
                >
                  No tasks
                </Typography>
              ) : (
                colTasks.map((task) => {
                  const isBeingDragged =
                    dragState?.isDragging && dragState?.task.id === task.id;
                  const isRunningTimer = activeTimerTaskId === task.id;

                  // If this exact card is being dragged, show an animated Ghost Placeholder in its source slot
                  if (isBeingDragged) {
                    return (
                      <motion.div
                        key={`placeholder-${task.id}`}
                        layout="position"
                        transition={springConfig}
                      >
                        <Box
                          sx={{
                            height: dragState.cardRect.height,
                            borderRadius: 2,
                            border: '2px dashed',
                            borderColor: isDark ? 'rgba(22, 196, 127, 0.5)' : '#16C47F80',
                            backgroundColor: isDark
                              ? 'rgba(22, 196, 127, 0.06)'
                              : 'rgba(22, 196, 127, 0.04)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{ color: '#16C47F', fontWeight: 600, fontSize: '0.75rem' }}
                          >
                            Moving...
                          </Typography>
                        </Box>
                      </motion.div>
                    );
                  }

                  return (
                    <motion.div
                      key={task.id}
                      layout="position"
                      transition={springConfig}
                      onPointerDown={(e) => handlePointerDown(e, task, col.id)}
                      style={{ touchAction: 'none' }}
                    >
                      <Paper
                        elevation={0}
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
                          cursor: dragState?.isDragging ? 'grabbing' : 'grab',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                          transition: shouldReduceMotion
                            ? 'none'
                            : 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                          '&:hover': {
                            transform: shouldReduceMotion ? 'none' : 'translateY(-2px)',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
                            borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)',
                          },
                        }}
                      >
                        {/* Header: ID & Priority */}
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

                        {/* Title */}
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            textDecoration: task.is_completed ? 'line-through' : 'none',
                            color: task.is_completed
                              ? isDark
                                ? '#94A3B8'
                                : '#64748B'
                              : 'inherit',
                          }}
                        >
                          {task.title}
                        </Typography>

                        {/* Blocked Reason */}
                        {task.blocked_reason && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#F59E0B', fontSize: '0.72rem' }}>
                            <AlertCircle size={13} />
                            <span>{task.blocked_reason}</span>
                          </Box>
                        )}

                        {/* Subtasks progress */}
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

                        {/* Card Footer: Due Date & Timer */}
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

                          <Box
                            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                            onClick={(e) => e.stopPropagation()}
                            className="no-drag"
                          >
                            <Typography variant="caption" sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B' }}>
                              {task.estimated_hours || 0}h
                            </Typography>
                            {isRunningTimer ? (
                              <IconButton
                                size="small"
                                onClick={() => onStopTimer(task.id)}
                                sx={{ color: '#EF4444' }}
                                title="Stop timer"
                              >
                                <Square size={13} />
                              </IconButton>
                            ) : (
                              <IconButton
                                size="small"
                                disabled={task.is_completed || !!task.cancelled_at}
                                onClick={() => onStartTimer(task.id)}
                                sx={{ color: '#16C47F' }}
                                title="Start timer"
                              >
                                <Play size={13} />
                              </IconButton>
                            )}
                          </Box>
                        </Box>
                      </Paper>
                    </motion.div>
                  );
                })
              )}
            </Box>
          </Paper>
        );
      })}

      {/* Floating Drag Overlay (Lift, Shadow, Scale & Cursor Following) */}
      {dragState?.isDragging &&
        typeof document !== 'undefined' &&
        createPortal(
          <motion.div
            initial={shouldReduceMotion ? false : { scale: 1, y: 0, opacity: 0.95 }}
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : {
                    scale: 1.04,
                    y: -6,
                    rotate: 1,
                    opacity: 1,
                  }
            }
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{
              position: 'fixed',
              left: dragState.currentPos.x - dragState.offset.x,
              top: dragState.currentPos.y - dragState.offset.y,
              width: dragState.cardRect.width,
              pointerEvents: 'none',
              zIndex: 99999,
            }}
          >
            <Paper
              elevation={8}
              sx={{
                p: 1.5,
                borderRadius: 2,
                border: '1.5px solid #16C47F',
                backgroundColor: isDark ? '#1F252B' : '#FFFFFF',
                boxShadow: isDark
                  ? '0 24px 48px rgba(0,0,0,0.55), 0 8px 16px rgba(0,0,0,0.35)'
                  : '0 20px 42px rgba(0,0,0,0.20), 0 8px 16px rgba(0,0,0,0.12)',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                cursor: 'grabbing',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Chip
                  label={dragState.task.task_number}
                  size="small"
                  sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                />
                <Chip
                  label={dragState.task.priority}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: getPriorityColor(dragState.task.priority),
                    backgroundColor: `${getPriorityColor(dragState.task.priority)}15`,
                  }}
                />
              </Box>

              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  textDecoration: dragState.task.is_completed ? 'line-through' : 'none',
                }}
              >
                {dragState.task.title}
              </Typography>

              {dragState.task.blocked_reason && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#F59E0B', fontSize: '0.72rem' }}>
                  <AlertCircle size={13} />
                  <span>{dragState.task.blocked_reason}</span>
                </Box>
              )}

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  pt: 0.5,
                  borderTop: '1px solid',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.72rem', color: '#64748B' }}>
                  <Calendar size={12} />
                  <span>{dragState.task.due_date ? formatDate(dragState.task.due_date) : 'No date'}</span>
                </Box>
                <Typography variant="caption" sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#16C47F' }}>
                  {dragState.task.estimated_hours || 0}h
                </Typography>
              </Box>
            </Paper>
          </motion.div>,
          document.body
        )}
    </Box>
  );
}
