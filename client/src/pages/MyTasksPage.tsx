import React, { useState, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  Chip,
  Snackbar,
  Alert,
  IconButton,
  CircularProgress,
  useTheme,
} from '@mui/material';
import {
  Search,
  Filter,
  Plus,
  Play,
  Square,
  Sparkles,
  Download,
  RotateCcw,
  Clock,
  X,
} from 'lucide-react';
import {
  useGetPersonalTasksQuery,
  useCreatePersonalTaskMutation,
  useUpdatePersonalTaskMutation,
  useDeletePersonalTaskMutation,
  useArchivePersonalTaskMutation,
  useRestorePersonalTaskMutation,
  useCancelPersonalTaskMutation,
  useReopenPersonalTaskMutation,
  useCreatePersonalSubtaskMutation,
  useGetActiveTimerQuery,
  useStartPersonalTimerMutation,
  useStopPersonalTimerMutation,
  useGetPersonalTimeEntriesQuery,
  useAddPersonalManualTimeEntryMutation,
  useDeletePersonalTimeEntryMutation,
  useGetPersonalWorkloadQuery,
  useGetMyDaySummaryQuery,
  useGetWeeklyReviewQuery,
  useGetPersonalTaskAuditQuery,
  useGetPersonalAuditTimelineQuery,
  useGetPersonalSettingsQuery,
  useUpdatePersonalSettingsMutation,
  useGetPersonalRemindersQuery,
  useCreatePersonalReminderMutation,
  useSnoozePersonalReminderMutation,
  PTTask,
  PTTaskCreate,
  PTTaskUpdate,
  PersonalSettings,
} from '@/api/personalTasksApi';
import { useToast } from '@/components/ui/ToastHost';

import PTSectionNav, { PTSection } from '@/components/personalTasks/PTSectionNav';
import PTQuickCapture from '@/components/personalTasks/PTQuickCapture';
import PTTaskTable from '@/components/personalTasks/PTTaskTable';
import PTDashboard from '@/components/personalTasks/PTDashboard';
import PTDetailDrawer from '@/components/personalTasks/PTDetailDrawer';
import PTWorkloadView from '@/components/personalTasks/PTWorkloadView';
import PTWeeklyWorkloadView from '@/components/personalTasks/PTWeeklyWorkloadView';
import PTCalendarView from '@/components/personalTasks/PTCalendarView';
import PTKanban from '@/components/personalTasks/PTKanban';
import PTActivityTimeline from '@/components/personalTasks/PTActivityTimeline';
import PTTimeReports from '@/components/personalTasks/PTTimeReports';
import PTArchiveView from '@/components/personalTasks/PTArchiveView';
import PTWeeklyReview from '@/components/personalTasks/PTWeeklyReview';
import PTSettingsDrawer from '@/components/personalTasks/PTSettingsDrawer';

export default function MyTasksPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { showToast } = useToast();

  const [activeSection, setActiveSection] = useState<PTSection>('my-day');
  const [selectedTask, setSelectedTask] = useState<PTTask | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Search and Filters
  const [searchQ, setSearchQ] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);

  // 10-Second Undo State
  const [undoToastOpen, setUndoToastOpen] = useState(false);
  const [undoAction, setUndoAction] = useState<{
    label: string;
    undoFn: () => Promise<void>;
  } | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Queries
  const {
    data: tasks = [],
    isLoading: isTasksLoading,
    refetch: refetchTasks,
  } = useGetPersonalTasksQuery({
    include_archived: activeSection === 'archive',
  });

  const { data: myDaySummary, isLoading: isMyDayLoading } = useGetMyDaySummaryQuery();
  const { data: workload, isLoading: isWorkloadLoading } = useGetPersonalWorkloadQuery();
  const { data: weeklyReview, isLoading: isReviewLoading } = useGetWeeklyReviewQuery();
  const { data: activeTimer } = useGetActiveTimerQuery(undefined, {
    pollingInterval: 5000,
  });
  const { data: settings } = useGetPersonalSettingsQuery();
  const { data: auditTimeline = [], isLoading: isTimelineLoading } = useGetPersonalAuditTimelineQuery();

  // Detail Drawer queries
  const selectedTaskId = selectedTask?.id;
  const { data: timeEntries = [] } = useGetPersonalTimeEntriesQuery(selectedTaskId || 0, {
    skip: !selectedTaskId,
  });
  const { data: taskActivities = [] } = useGetPersonalTaskAuditQuery(selectedTaskId || 0, {
    skip: !selectedTaskId,
  });
  const { data: reminders = [] } = useGetPersonalRemindersQuery();

  // Mutations
  const [createTask, { isLoading: isCreating }] = useCreatePersonalTaskMutation();
  const [updateTask] = useUpdatePersonalTaskMutation();
  const [deleteTask] = useDeletePersonalTaskMutation();
  const [archiveTask] = useArchivePersonalTaskMutation();
  const [restoreTask] = useRestorePersonalTaskMutation();
  const [cancelTask] = useCancelPersonalTaskMutation();
  const [reopenTask] = useReopenPersonalTaskMutation();
  const [createSubtask] = useCreatePersonalSubtaskMutation();
  const [startTimer] = useStartPersonalTimerMutation();
  const [stopTimer] = useStopPersonalTimerMutation();
  const [addManualTime] = useAddPersonalManualTimeEntryMutation();
  const [deleteTimeEntry] = useDeletePersonalTimeEntryMutation();
  const [createReminder] = useCreatePersonalReminderMutation();
  const [snoozeReminder] = useSnoozePersonalReminderMutation();
  const [updateSettings] = useUpdatePersonalSettingsMutation();

  // Section Counts
  const overdueCount = useMemo(() => {
    return tasks.filter((t) => {
      if (t.is_completed || t.cancelled_at || !t.due_date) return false;
      const d = new Date(t.due_date).getTime();
      const now = new Date().setHours(0, 0, 0, 0);
      return d < now;
    }).length;
  }, [tasks]);

  const todayCount = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return tasks.filter((t) => {
      if (t.is_completed || t.cancelled_at) return false;
      const planned = t.planned_date ? t.planned_date.split('T')[0] : null;
      const due = t.due_date ? t.due_date.split('T')[0] : null;
      return planned === todayStr || (!planned && due === todayStr);
    }).length;
  }, [tasks]);

  // Section Filtered Tasks
  const displayedTasks = useMemo(() => {
    let list = [...tasks];

    // Search filter
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.task_number.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q))
      );
    }

    // Priority filter
    if (priorityFilter) {
      list = list.filter((t) => t.priority === priorityFilter);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    switch (activeSection) {
      case 'my-day':
        return list.filter((t) => {
          const target = t.planned_date ? t.planned_date.split('T')[0] : t.due_date ? t.due_date.split('T')[0] : null;
          return target === todayStr;
        });

      case 'upcoming':
        return list.filter((t) => {
          if (t.is_completed || t.cancelled_at) return false;
          const target = t.planned_date ? t.planned_date.split('T')[0] : t.due_date ? t.due_date.split('T')[0] : null;
          return target && target > todayStr;
        });

      case 'overdue':
        return list.filter((t) => {
          if (t.is_completed || t.cancelled_at || !t.due_date) return false;
          return t.due_date.split('T')[0] < todayStr;
        });

      case 'completed':
        return list.filter((t) => t.is_completed);

      case 'archive':
        return list.filter((t) => t.is_archived || t.is_deleted);

      default:
        // 'all-tasks' and others
        return list.filter((t) => !t.is_archived && !t.is_deleted);
    }
  }, [tasks, activeSection, searchQ, priorityFilter]);

  // Handlers
  const handleOpenTask = (task: PTTask) => {
    setSelectedTask(task);
    setDrawerOpen(true);
  };

  const handleQuickAdd = async (taskData: PTTaskCreate) => {
    try {
      const res = await createTask(taskData).unwrap();
      showToast(`Task "${res.title}" created.`, 'success');
      refetchTasks();
    } catch {
      showToast('Failed to create task.', 'error');
    }
  };

  const handleToggleComplete = async (task: PTTask) => {
    const nextCompleted = !task.is_completed;
    try {
      await updateTask({ id: task.id, data: { is_completed: nextCompleted } }).unwrap();
      showToast(nextCompleted ? `Completed "${task.title}".` : `Reopened "${task.title}".`, 'success');

      // 10s Undo pattern
      triggerUndoToast(
        nextCompleted ? `Task completed.` : `Task reopened.`,
        async () => {
          await updateTask({ id: task.id, data: { is_completed: !nextCompleted } }).unwrap();
          refetchTasks();
        }
      );

      if (selectedTask?.id === task.id) {
        setSelectedTask({ ...selectedTask, is_completed: nextCompleted });
      }
      refetchTasks();
    } catch {
      showToast('Status update failed.', 'error');
    }
  };

  const handleCancelTask = async (id: number, reason: string) => {
    try {
      await cancelTask({ id, reason }).unwrap();
      showToast('Task cancelled.', 'info');
      setDrawerOpen(false);
      refetchTasks();
    } catch {
      showToast('Failed to cancel task.', 'error');
    }
  };

  const handleReopenTask = async (id: number) => {
    try {
      await reopenTask(id).unwrap();
      showToast('Task reopened.', 'success');
      refetchTasks();
    } catch {
      showToast('Failed to reopen task.', 'error');
    }
  };

  const handleArchiveTask = async (id: number) => {
    try {
      await archiveTask(id).unwrap();
      showToast('Task moved to archive.', 'info');
      setDrawerOpen(false);
      refetchTasks();
    } catch {
      showToast('Failed to archive task.', 'error');
    }
  };

  const handleRestoreTask = async (id: number) => {
    try {
      await restoreTask(id).unwrap();
      showToast('Task restored to active planner.', 'success');
      refetchTasks();
    } catch {
      showToast('Failed to restore task.', 'error');
    }
  };

  const handleDeleteTask = async (id: number) => {
    const taskToDelete = tasks.find((t) => t.id === id);
    try {
      await deleteTask(id).unwrap();
      showToast('Task deleted.', 'info');
      setDrawerOpen(false);

      // 10s Undo pattern
      if (taskToDelete) {
        triggerUndoToast('Task deleted.', async () => {
          await restoreTask(id).unwrap();
          refetchTasks();
        });
      }
      refetchTasks();
    } catch {
      showToast('Failed to delete task.', 'error');
    }
  };

  const handleQuickUpdate = async (id: number, patch: Partial<PTTaskUpdate>) => {
    try {
      await updateTask({ id, data: patch }).unwrap();
      showToast('Task updated.', 'success');
      refetchTasks();
    } catch {
      showToast('Failed to update task.', 'error');
    }
  };

  const triggerUndoToast = (label: string, undoFn: () => Promise<void>) => {
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    setUndoAction({ label, undoFn });
    setUndoToastOpen(true);
    undoTimeoutRef.current = setTimeout(() => {
      setUndoToastOpen(false);
      setUndoAction(null);
    }, 10000);
  };

  const handleExecuteUndo = async () => {
    if (undoAction) {
      await undoAction.undoFn();
      setUndoToastOpen(false);
      setUndoAction(null);
      showToast('Action undone.', 'success');
    }
  };

  // Timer controls
  const handleStartTimer = async (taskId: number, forceSwitch: boolean = false) => {
    try {
      await startTimer({ taskId, forceSwitch }).unwrap();
      showToast('Timer started.', 'success');
    } catch (err: any) {
      if (err?.status === 409) {
        showToast('Another timer is running. Use the task drawer to switch.', 'warning');
      } else {
        showToast('Failed to start timer.', 'error');
      }
    }
  };

  const handleStopTimer = async (taskId: number, description?: string) => {
    try {
      await stopTimer({ taskId, description }).unwrap();
      showToast('Timer stopped and actual hours recorded.', 'success');
      refetchTasks();
    } catch {
      showToast('Failed to stop timer.', 'error');
    }
  };

  const handleExportCsv = () => {
    window.open('/api/v1/tasks/personal/export?format=csv', '_blank');
  };

  const handleExportIcs = () => {
    window.open('/api/v1/tasks/personal/calendar.ics', '_blank');
  };

  // Active Timer Task reference
  const activeTimerTask = useMemo(() => {
    if (!activeTimer) return null;
    return tasks.find((t) => t.id === activeTimer.task_id);
  }, [activeTimer, tasks]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 65px)',
        overflow: 'hidden',
        mx: { xs: '-24px', md: '-24px' },
        mt: { xs: '-20px', md: '-16px' },
        mb: { xs: '-16px', md: '-16px' },
        backgroundColor: isDark ? '#0F1215' : '#F8FAF8',
      }}
    >
      {/* 1. Top Horizontal Tab Nav */}
      <PTSectionNav
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        overdueCount={overdueCount}
        todayCount={todayCount}
        onOpenSettings={() => setSettingsOpen(true)}
        onExportCsv={handleExportCsv}
        onExportIcs={handleExportIcs}
      />

      {/* 2. Main Content Area */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: { xs: 2, md: 3 },
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
        }}
      >
        {/* Sticky Quick Capture Bar */}
        <PTQuickCapture onQuickAdd={handleQuickAdd} isLoading={isCreating} />

        {/* Filters and View Switcher for Table Views */}
        {['all-tasks', 'upcoming', 'overdue', 'completed'].includes(activeSection) && (
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search in view..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} />
                  </InputAdornment>
                ),
              }}
              sx={{ width: 240 }}
            />

            <Select
              size="small"
              displayEmpty
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="">All Priorities</MenuItem>
              <MenuItem value="URGENT">Urgent</MenuItem>
              <MenuItem value="HIGH">High</MenuItem>
              <MenuItem value="NORMAL">Normal</MenuItem>
              <MenuItem value="LOW">Low</MenuItem>
            </Select>

            {(searchQ || priorityFilter) && (
              <Button
                size="small"
                variant="text"
                onClick={() => {
                  setSearchQ('');
                  setPriorityFilter('');
                }}
                sx={{ textTransform: 'none', color: '#64748B' }}
              >
                Clear Filters
              </Button>
            )}
          </Box>
        )}

        {/* Section Dynamic Content */}
        {activeSection === 'my-day' && (
          <PTDashboard
            summary={myDaySummary}
            isLoading={isMyDayLoading}
            activeTimerTaskId={activeTimer?.task_id}
            onOpenTask={handleOpenTask}
            onToggleComplete={handleToggleComplete}
            onStartTimer={handleStartTimer}
            onStopTimer={handleStopTimer}
            onCancelTask={(t) => handleCancelTask(t.id, 'User cancelled from dashboard')}
            onReopenTask={handleReopenTask}
            onArchiveTask={handleArchiveTask}
            onDeleteTask={handleDeleteTask}
            onUpdateTask={handleQuickUpdate}
          />
        )}

        {['all-tasks', 'upcoming', 'overdue', 'completed'].includes(activeSection) && (
          <PTTaskTable
            tasks={displayedTasks}
            isLoading={isTasksLoading}
            emptyTitle={
              activeSection === 'overdue'
                ? 'No Overdue Tasks!'
                : activeSection === 'completed'
                ? 'No Completed Tasks Yet'
                : 'No Tasks Found'
            }
            emptyHint={
              activeSection === 'overdue'
                ? 'All your scheduled commitments are in good standing.'
                : 'Use Quick Capture above to add a new task.'
            }
            activeTimerTaskId={activeTimer?.task_id}
            selectedIds={selectedTaskIds}
            onToggleSelect={(id) => {
              setSelectedTaskIds((prev) =>
                prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
              );
            }}
            onSelectAll={(ids) => setSelectedTaskIds(ids)}
            onOpenTask={handleOpenTask}
            onToggleComplete={handleToggleComplete}
            onStartTimer={handleStartTimer}
            onStopTimer={handleStopTimer}
            onCancelTask={(t) => handleCancelTask(t.id, 'Cancelled by user')}
            onReopenTask={handleReopenTask}
            onArchiveTask={handleArchiveTask}
            onDeleteTask={handleDeleteTask}
            onUpdateTask={handleQuickUpdate}
          />
        )}

        {activeSection === 'workload' && (
          <PTWorkloadView
            workload={workload}
            isLoading={isWorkloadLoading}
            onOpenTask={handleOpenTask}
            onApplyPlanSuggestion={async (adjustments) => {
              for (const adj of adjustments) {
                if (adj.newPlannedDate) {
                  await updateTask({ id: adj.taskId, data: { planned_date: adj.newPlannedDate } });
                }
              }
              showToast('Suggested plan applied.', 'success');
              refetchTasks();
            }}
          />
        )}

        {activeSection === 'weekly-workload' && (
          <PTWeeklyWorkloadView
            workload={workload}
            isLoading={isWorkloadLoading}
            onOpenTask={handleOpenTask}
          />
        )}

        {activeSection === 'calendar' && (
          <PTCalendarView tasks={tasks} onOpenTask={handleOpenTask} />
        )}

        {activeSection === 'kanban' && (
          <PTKanban
            tasks={tasks}
            activeTimerTaskId={activeTimer?.task_id}
            onOpenTask={handleOpenTask}
            onStatusChange={async (t, statusId) => {
              await updateTask({ id: t.id, data: { status_id: Number(statusId) } });
              refetchTasks();
            }}
            onStartTimer={handleStartTimer}
            onStopTimer={handleStopTimer}
          />
        )}

        {activeSection === 'activity' && (
          <PTActivityTimeline activities={auditTimeline} isLoading={isTimelineLoading} />
        )}

        {activeSection === 'time-reports' && (
          <PTTimeReports
            tasks={tasks}
            onExportCsv={handleExportCsv}
            onOpenTask={handleOpenTask}
          />
        )}

        {activeSection === 'archive' && (
          <PTArchiveView
            tasks={displayedTasks}
            isLoading={isTasksLoading}
            onRestoreTask={handleRestoreTask}
            onOpenTask={handleOpenTask}
          />
        )}

        {activeSection === 'weekly-review' && (
          <PTWeeklyReview
            review={weeklyReview}
            isLoading={isReviewLoading}
            onOpenTask={handleOpenTask}
          />
        )}
      </Box>

      {/* 3. Detail Drawer */}
      <PTDetailDrawer
        open={drawerOpen}
        task={selectedTask}
        activeTimer={activeTimer || null}
        timeEntries={timeEntries}
        activities={taskActivities}
        reminders={reminders.filter((r) => r.task_id === selectedTaskId)}
        onClose={() => setDrawerOpen(false)}
        onUpdateTask={async (id, patch) => {
          await updateTask({ id, data: patch }).unwrap();
          refetchTasks();
        }}
        onToggleComplete={handleToggleComplete}
        onCancelTask={handleCancelTask}
        onReopenTask={handleReopenTask}
        onArchiveTask={handleArchiveTask}
        onDeleteTask={handleDeleteTask}
        onAddSubtask={async (sub) => {
          if (!selectedTask) return;
          await createSubtask({ taskId: selectedTask.id, data: sub }).unwrap();
          refetchTasks();
        }}
        onToggleSubtask={async (subId, isCompleted) => {
          await updateTask({ id: subId, data: { is_completed: isCompleted } }).unwrap();
          refetchTasks();
        }}
        onDeleteSubtask={async (subId) => {
          await deleteTask(subId).unwrap();
          refetchTasks();
        }}
        onStartTimer={handleStartTimer}
        onStopTimer={handleStopTimer}
        onAddManualTime={async (data) => {
          if (!selectedTask) return;
          await addManualTime({ taskId: selectedTask.id, data }).unwrap();
          refetchTasks();
        }}
        onDeleteTimeEntry={async (entryId) => {
          await deleteTimeEntry(entryId).unwrap();
          refetchTasks();
        }}
        onCreateReminder={async (reminderType, scheduledAt) => {
          if (!selectedTask) return;
          await createReminder({ taskId: selectedTask.id, reminderType, scheduledAt }).unwrap();
          showToast('Reminder scheduled.', 'success');
        }}
        onSnoozeReminder={async (reminderId, minutes) => {
          await snoozeReminder({ reminderId, minutes }).unwrap();
          showToast(`Snoozed by ${minutes} minutes.`, 'info');
        }}
      />

      {/* 4. Settings Drawer */}
      <PTSettingsDrawer
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSaveSettings={async (patch) => {
          await updateSettings(patch).unwrap();
          showToast('Preferences updated.', 'success');
        }}
      />

      {/* 5. Sticky Running Timer Bar at Bottom (Section 9) */}
      {activeTimer && activeTimerTask && (
        <Paper
          elevation={4}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 28,
            px: 2.5,
            py: 1.25,
            borderRadius: 999,
            backgroundColor: isDark ? '#181D22' : '#203020',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
            border: '1px solid rgba(22, 196, 127, 0.4)',
            zIndex: 1200,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: '#16C47F',
                animation: 'pulse 1.5s infinite',
                '@keyframes pulse': {
                  '0%': { opacity: 0.4 },
                  '50%': { opacity: 1 },
                  '100%': { opacity: 0.4 },
                },
              }}
            />
            <Typography variant="body2" noWrap sx={{ fontWeight: 700, maxWidth: 220 }}>
              {activeTimerTask.title}
            </Typography>
          </Box>

          <Button
            size="small"
            variant="contained"
            color="error"
            startIcon={<Square size={13} />}
            onClick={() => handleStopTimer(activeTimerTask.id)}
            sx={{
              borderRadius: 999,
              height: 28,
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'none',
              px: 1.5,
            }}
          >
            Stop
          </Button>
        </Paper>
      )}

      {/* 6. Undo 10-Second Toast */}
      <Snackbar
        open={undoToastOpen}
        autoHideDuration={10000}
        onClose={() => setUndoToastOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          severity="info"
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<RotateCcw size={14} />}
              onClick={handleExecuteUndo}
              sx={{ fontWeight: 700, textTransform: 'none' }}
            >
              Undo (10s)
            </Button>
          }
          sx={{
            backgroundColor: isDark ? '#1E293B' : '#0F172A',
            color: '#FFFFFF',
            borderRadius: 2,
            boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
          }}
        >
          {undoAction?.label || 'Action completed.'}
        </Alert>
      </Snackbar>
    </Box>
  );
}
