import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  TextField,
  Select,
  MenuItem,
  Button,
  Tabs,
  Tab,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Autocomplete,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  X,
  CheckCircle2,
  Circle,
  Clock,
  ListTree,
  History,
  FileText,
  AlertTriangle,
  RotateCcw,
  XCircle,
  Archive,
  Trash2,
  Calendar,
} from 'lucide-react';
import {
  PTTask,
  PTTaskUpdate,
  PersonalReminder,
  PTTaskCreate,
  TaskPriority,
  PTActivityInfo,
} from '@/api/personalTasksApi';
import { TaskTimeEntryInfo } from '@/api/projectsApi';
import PTSubtaskPanel from './PTSubtaskPanel';
import PTTimerWidget from './PTTimerWidget';
import PTAuditLog from './PTAuditLog';
import PTReminderPanel from './PTReminderPanel';
import AutoSaveStatusBadge from '@/components/common/AutoSaveStatusBadge';
import { useAutoSave } from '@/hooks/useAutoSave';

interface PTDetailDrawerProps {
  open: boolean;
  task: PTTask | null;
  activeTimer: TaskTimeEntryInfo | null;
  timeEntries: TaskTimeEntryInfo[];
  activities: PTActivityInfo[];
  reminders: PersonalReminder[];
  onClose: () => void;
  onUpdateTask: (id: number, patch: PTTaskUpdate) => Promise<void>;
  onToggleComplete: (task: PTTask) => void;
  onCancelTask: (id: number, reason: string) => Promise<void>;
  onReopenTask: (id: number) => Promise<void>;
  onArchiveTask: (id: number) => Promise<void>;
  onDeleteTask: (id: number) => Promise<void>;
  onAddSubtask: (subtask: PTTaskCreate) => Promise<void>;
  onToggleSubtask: (subtaskId: number, isCompleted: boolean) => Promise<void>;
  onDeleteSubtask: (subtaskId: number) => Promise<void>;
  onStartTimer: (taskId: number, forceSwitch?: boolean) => Promise<void>;
  onStopTimer: (taskId: number, description?: string) => Promise<void>;
  onAddManualTime: (data: { duration_minutes: number; description?: string; started_at: string }) => Promise<void>;
  onDeleteTimeEntry: (entryId: number) => Promise<void>;
  onCreateReminder: (reminderType: string, scheduledAt: string) => Promise<void>;
  onSnoozeReminder: (reminderId: number, minutes: number) => Promise<void>;
}

export default function PTDetailDrawer({
  open,
  task,
  activeTimer,
  timeEntries,
  activities,
  reminders,
  onClose,
  onUpdateTask,
  onToggleComplete,
  onCancelTask,
  onReopenTask,
  onArchiveTask,
  onDeleteTask,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onStartTimer,
  onStopTimer,
  onAddManualTime,
  onDeleteTimeEntry,
  onCreateReminder,
  onSnoozeReminder,
}: PTDetailDrawerProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [activeTab, setActiveTab] = useState<'details' | 'subtasks' | 'time' | 'audit'>('details');

  // Local form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState<number | ''>('');
  const [blockedReason, setBlockedReason] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [recurrencePattern, setRecurrencePattern] = useState<string>('none');

  // Cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  const autoSave = useAutoSave<Record<string, any>>({
    initialValues: task
      ? {
          title: task.title || '',
          description: task.description || '',
          priority: task.priority || 'NORMAL',
          start_date: task.start_date || '',
          due_date: task.due_date || '',
          planned_date: task.planned_date || '',
          estimated_hours: task.estimated_hours || '',
          blocked_reason: task.blocked_reason || '',
          tag_names: task.tags_list?.map((t) => t.name) || [],
        }
      : {},
    onSave: async (patch: Record<string, any>) => {
      if (!task) return;
      await onUpdateTask(task.id, patch);
    },
  });

  // Sync state on task prop change
  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'NORMAL');
      setStartDate(task.start_date ? task.start_date.split('T')[0] : '');
      setDueDate(task.due_date ? task.due_date.split('T')[0] : '');
      setPlannedDate(task.planned_date ? task.planned_date.split('T')[0] : '');
      setEstimatedHours(task.estimated_hours || '');
      setBlockedReason(task.blocked_reason || '');
      setTags(task.tags_list ? task.tags_list.map((t) => t.name) : []);
      if (task.recurrence_rule && typeof task.recurrence_rule === 'object') {
        setRecurrencePattern(task.recurrence_rule.pattern || 'none');
      } else {
        setRecurrencePattern('none');
      }

      autoSave.resetInitialValues({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'NORMAL',
        start_date: task.start_date || '',
        due_date: task.due_date || '',
        planned_date: task.planned_date || '',
        estimated_hours: task.estimated_hours || '',
        blocked_reason: task.blocked_reason || '',
        tag_names: task.tags_list?.map((t) => t.name) || [],
      });
    }
  }, [task?.id]);

  if (!task) return null;

  const isCompleted = task.is_completed;
  const isCancelled = !!task.cancelled_at;

  const handleClose = async () => {
    await autoSave.flushPending();
    onClose();
  };

  const handleConfirmCancel = async () => {
    if (!cancellationReason.trim()) return;
    await onCancelTask(task.id, cancellationReason.trim());
    setCancelDialogOpen(false);
    setCancellationReason('');
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 520 },
          maxWidth: '100vw',
          height: '100%',
          maxHeight: '100dvh',
          backgroundColor: isDark ? '#14181C' : '#FFFFFF',
          p: 0,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Drawer Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton
            size="small"
            onClick={() => onToggleComplete(task)}
            sx={{ color: isCompleted ? '#16C47F' : '#94A3B8' }}
          >
            {isCompleted ? <CheckCircle2 size={20} /> : <Circle size={20} />}
          </IconButton>

          <Chip
            label={task.task_number}
            size="small"
            sx={{ fontWeight: 700, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }}
          />

          <AutoSaveStatusBadge
            status={autoSave.status}
            lastSaved={autoSave.lastSaved}
            errorMessage={autoSave.errorMessage}
            onRetry={autoSave.retry}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isCancelled || isCompleted ? (
            <Button
              size="small"
              variant="outlined"
              color="success"
              startIcon={<RotateCcw size={14} />}
              onClick={() => onReopenTask(task.id)}
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              Reopen
            </Button>
          ) : (
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={<XCircle size={14} />}
              onClick={() => setCancelDialogOpen(true)}
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              Cancel
            </Button>
          )}

          <IconButton size="small" onClick={handleClose}>
            <X size={18} />
          </IconButton>
        </Box>
      </Box>

      {/* Navigation Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, val) => setActiveTab(val)}
        variant="fullWidth"
        sx={{
          borderBottom: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          minHeight: 44,
          '& .MuiTab-root': {
            minHeight: 44,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.82rem',
          },
        }}
      >
        <Tab icon={<FileText size={15} />} iconPosition="start" label="Details" value="details" />
        <Tab
          icon={<ListTree size={15} />}
          iconPosition="start"
          label={`Subtasks (${task.subtask_count || 0})`}
          value="subtasks"
        />
        <Tab icon={<Clock size={15} />} iconPosition="start" label="Time" value="time" />
        <Tab icon={<History size={15} />} iconPosition="start" label="Audit" value="audit" />
      </Tabs>

      {/* Drawer Body */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {activeTab === 'details' && (
          <>
            {/* Title */}
            <TextField
              label="Task Title"
              fullWidth
              size="small"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                autoSave.setPendingField('title', e.target.value);
              }}
              onBlur={() => autoSave.saveField('title', title.trim())}
            />

            {/* Priority & Estimated Hours */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 0.5 }}>
                  Priority
                </Typography>
                <Select
                  fullWidth
                  size="small"
                  value={priority}
                  onChange={(e) => {
                    const p = e.target.value as TaskPriority;
                    setPriority(p);
                    autoSave.saveField('priority', p);
                  }}
                >
                  <MenuItem value="URGENT">Urgent</MenuItem>
                  <MenuItem value="HIGH">High</MenuItem>
                  <MenuItem value="NORMAL">Normal</MenuItem>
                  <MenuItem value="LOW">Low</MenuItem>
                </Select>
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 0.5 }}>
                  Estimated Hours
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  placeholder="e.g. 2.5"
                  value={estimatedHours}
                  onChange={(e) => {
                    const v = e.target.value === '' ? '' : parseFloat(e.target.value);
                    setEstimatedHours(v);
                    autoSave.setPendingField('estimated_hours', v);
                  }}
                  onBlur={() => autoSave.saveField('estimated_hours', estimatedHours === '' ? 0 : estimatedHours)}
                />
              </Box>
            </Box>

            {/* Dates Row: Start, Planned, Due */}
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 0.5 }}>
                  Start Date
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    autoSave.setPendingField('start_date', e.target.value);
                  }}
                  onBlur={() => autoSave.saveField('start_date', startDate || null)}
                />
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 0.5 }}>
                  Planned Date
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  value={plannedDate}
                  onChange={(e) => {
                    setPlannedDate(e.target.value);
                    autoSave.setPendingField('planned_date', e.target.value);
                  }}
                  onBlur={() => autoSave.saveField('planned_date', plannedDate || null)}
                />
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 0.5 }}>
                  Due Date
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    autoSave.setPendingField('due_date', e.target.value);
                  }}
                  onBlur={() => autoSave.saveField('due_date', dueDate || null)}
                />
              </Box>
            </Box>

            {/* Blocked / Waiting On Reason */}
            <TextField
              label="Blocked / On Hold Reason (optional)"
              fullWidth
              size="small"
              placeholder="e.g. Waiting on client response for logo assets"
              value={blockedReason}
              onChange={(e) => {
                setBlockedReason(e.target.value);
                autoSave.setPendingField('blocked_reason', e.target.value);
              }}
              onBlur={() => autoSave.saveField('blocked_reason', blockedReason)}
            />

            {/* Tags Autocomplete */}
            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={tags}
              onChange={(_, newTags) => {
                setTags(newTags);
                autoSave.saveField('tag_names', newTags);
              }}
              renderTags={(val, getTagProps) =>
                val.map((option, index) => (
                  <Chip
                    size="small"
                    label={`#${option}`}
                    {...getTagProps({ index })}
                    key={option}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField {...params} size="small" label="Tags" placeholder="Add #tag and press Enter" />
              )}
            />

            {/* Recurrence Rule */}
            <Box>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 0.5 }}>
                Recurrence Rule
              </Typography>
              <Select
                fullWidth
                size="small"
                value={recurrencePattern}
                onChange={(e) => {
                  const pat = e.target.value;
                  setRecurrencePattern(pat);
                  autoSave.saveField(
                    'recurrence_rule',
                    pat === 'none' ? null : { pattern: pat, interval: 1, mode: 'after-completion' }
                  );
                }}
              >
                <MenuItem value="none">No Recurrence (Single Task)</MenuItem>
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
              </Select>
            </Box>

            {/* Description */}
            <TextField
              label="Description / Notes"
              fullWidth
              multiline
              rows={4}
              size="small"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                autoSave.setPendingField('description', e.target.value);
              }}
              onBlur={() => autoSave.saveField('description', description)}
            />

            <Divider />

            {/* Reminders Section */}
            <PTReminderPanel
              taskId={task.id}
              dueDate={task.due_date}
              reminders={reminders}
              onCreateReminder={onCreateReminder}
              onSnoozeReminder={onSnoozeReminder}
            />
          </>
        )}

        {activeTab === 'subtasks' && (
          <PTSubtaskPanel
            task={task}
            onAddSubtask={onAddSubtask}
            onToggleSubtask={onToggleSubtask}
            onDeleteSubtask={onDeleteSubtask}
            onToggleFollowDue={async (enabled) => {
              await onUpdateTask(task.id, { parent_due_follows_subtasks: enabled });
            }}
          />
        )}

        {activeTab === 'time' && (
          <PTTimerWidget
            taskId={task.id}
            taskTitle={task.title}
            estimatedHours={task.estimated_hours || 0}
            actualHours={task.actual_hours || 0}
            activeTimer={activeTimer}
            timeEntries={timeEntries}
            onStartTimer={onStartTimer}
            onStopTimer={onStopTimer}
            onAddManualEntry={onAddManualTime}
            onDeleteEntry={onDeleteTimeEntry}
          />
        )}

        {activeTab === 'audit' && (
          <PTAuditLog activities={activities} />
        )}
      </Box>

      {/* Drawer Footer Actions */}
      <Box
        sx={{
          p: 2,
          pb: 'max(16px, env(safe-area-inset-bottom, 0px))',
          borderTop: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            color="inherit"
            startIcon={<Archive size={15} />}
            onClick={() => onArchiveTask(task.id)}
            sx={{ textTransform: 'none' }}
          >
            Archive
          </Button>

          <Button
            size="small"
            color="error"
            startIcon={<Trash2 size={15} />}
            onClick={() => onDeleteTask(task.id)}
            sx={{ textTransform: 'none' }}
          >
            Delete
          </Button>
        </Box>

        <Button variant="outlined" size="small" onClick={handleClose} sx={{ textTransform: 'none' }}>
          Close
        </Button>
      </Box>

      {/* Cancel Task Reason Prompt Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Cancel Task</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Per task governance rules, a cancellation reason is required before cancelling:
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="e.g. Project scope changed / No longer needed"
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>Back</Button>
          <Button
            onClick={handleConfirmCancel}
            variant="contained"
            color="warning"
            disabled={!cancellationReason.trim()}
          >
            Confirm Cancellation
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
}
