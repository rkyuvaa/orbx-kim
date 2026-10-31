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
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Autocomplete,
  Avatar,
  CircularProgress,
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
  RotateCcw,
  XCircle,
  Archive,
  Trash2,
  Calendar,
  Plus,
} from 'lucide-react';
import {
  PTTask,
  PTTaskUpdate,
  PersonalReminder,
  PTTaskCreate,
  TaskPriority,
  PTActivityInfo,
  useGetPersonalTagsQuery,
  useGetTaskLogNotesQuery,
  useCreateTaskLogNoteMutation,
} from '@/api/personalTasksApi';
import { TaskTimeEntryInfo } from '@/api/projectsApi';
import PTSubtaskPanel from './PTSubtaskPanel';
import PTTimerWidget from './PTTimerWidget';
import PTAuditLog from './PTAuditLog';
import PTReminderPanel from './PTReminderPanel';
import AutoSaveStatusBadge from '@/components/common/AutoSaveStatusBadge';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useAppSelector } from '@/app/hooks';

const formatDisplayDate = (dateStr?: string, fallback?: string): string => {
  if (dateStr) {
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
      }
    } catch {
      // fallback
    }
  }
  return fallback || dateStr || '';
};

const formatDisplayTime = (dateStr?: string, fallback?: string): string => {
  if (dateStr) {
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${mins}`;
      }
    } catch {
      // fallback
    }
  }
  return fallback || dateStr || '';
};

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
  onDeleteReminder?: (reminderId: number) => Promise<void>;
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
  onDeleteReminder,
}: PTDetailDrawerProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const currentUser = useAppSelector((state) => state.auth.user);

  const { data: existingTags = [] } = useGetPersonalTagsQuery();

  // Task log notes query and mutation
  const { data: logNotes = [], isLoading: isLoadingNotes } = useGetTaskLogNotesQuery(task?.id || 0, {
    skip: !task?.id,
  });
  const [createLogNote, { isLoading: isSubmittingLog }] = useCreateTaskLogNoteMutation();
  const [newLogNote, setNewLogNote] = useState('');

  const [activeTab, setActiveTab] = useState<'details' | 'subtasks' | 'time' | 'audit'>('details');

  // Local form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState<number | ''>('');
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
          start_date: task.start_date ? task.start_date.split('T')[0] : null,
          due_date: task.due_date ? task.due_date.split('T')[0] : null,
          planned_date: task.planned_date ? task.planned_date.split('T')[0] : null,
          estimated_hours: task.estimated_hours || 0,
          tag_names: task.tags_list?.map((t) => t.name) || [],
        }
      : {},
    onSave: async (patch: Record<string, any>) => {
      if (!task) return;
      const sanitized: Record<string, any> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (v === '' && ['start_date', 'due_date', 'planned_date', 'estimated_hours'].includes(k)) {
          sanitized[k] = null;
        } else {
          sanitized[k] = v;
        }
      }
      await onUpdateTask(task.id, sanitized);
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
        start_date: task.start_date ? task.start_date.split('T')[0] : null,
        due_date: task.due_date ? task.due_date.split('T')[0] : null,
        planned_date: task.planned_date ? task.planned_date.split('T')[0] : null,
        estimated_hours: task.estimated_hours || 0,
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

  const handleAddLogNote = async () => {
    if (!newLogNote.trim() || !task) return;
    try {
      await createLogNote({ taskId: task.id, note: newLogNote.trim() }).unwrap();
      setNewLogNote('');
    } catch (err) {
      console.error('Failed to log note:', err);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', md: '72vw', lg: '62vw', xl: '56vw' },
          minWidth: { md: 740 },
          maxWidth: { xs: '100vw', xl: 1100 },
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
          px: 2.5,
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

          {isCompleted && (
            <Chip
              icon={<CheckCircle2 size={13} />}
              label="Completed"
              size="small"
              sx={{
                fontWeight: 600,
                fontSize: '0.74rem',
                backgroundColor: isDark ? 'rgba(22, 196, 127, 0.15)' : 'rgba(22, 196, 127, 0.1)',
                color: '#16C47F',
                border: '1px solid',
                borderColor: 'rgba(22, 196, 127, 0.3)',
              }}
            />
          )}
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

      {/* Drawer Body Container: Two-column layout (50% left, 50% right) on desktop */}
      <Box
        sx={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
        }}
      >
        {/* Left Column (65%): Task Details, Subtasks, Time, Audit Tabs */}
        <Box
          sx={{
            flex: { md: '1 1 65%' },
            width: { xs: '100%', md: '65%' },
            borderRight: { md: '1px solid' },
            borderColor: { md: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
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

          {/* Left Column Scrollable Content */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, sm: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {activeTab === 'details' && (
              <>
                {/* Assignment & Ownership Metadata */}
                {(task.assignee_id || task.created_by) && (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAF8',
                      border: '1px solid',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" sx={{ color: isDark ? '#94A3B8' : '#64748B', fontWeight: 600 }}>
                        Created By:
                      </Typography>
                      <Chip
                        size="small"
                        label={
                          task.created_by_name ||
                          (task.created_by === currentUser?.id ? 'You' : `User #${task.created_by}`)
                        }
                        sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600 }}
                      />
                    </Box>

                    {(task.assignee_name || (task.assignees && task.assignees[0]?.full_name)) && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" sx={{ color: isDark ? '#94A3B8' : '#64748B', fontWeight: 600 }}>
                          Assigned To:
                        </Typography>
                        <Chip
                          size="small"
                          color="primary"
                          variant="outlined"
                          label={task.assignee_name || task.assignees?.[0]?.full_name}
                          sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600 }}
                        />
                      </Box>
                    )}

                    {task.assigned_at && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" sx={{ color: isDark ? '#94A3B8' : '#64748B', fontWeight: 600 }}>
                          Assigned Date:
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: isDark ? '#E2E8F0' : '#1E293B' }}>
                          {format(parseISO(task.assigned_at), 'dd/MM/yyyy, hh:mm a')}
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                )}

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



                {/* Tags Autocomplete */}
                <Autocomplete
                  multiple
                  freeSolo
                  options={existingTags}
                  value={tags}
                  onChange={(_, newTags) => {
                    const normalized = newTags.map((t) => (t.startsWith('#') ? t.slice(1) : t).trim()).filter(Boolean);
                    setTags(normalized);
                    autoSave.saveField('tag_names', normalized);
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
                    <TextField {...params} size="small" label="Tags" placeholder="Select or type #tag" />
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
                  onDeleteReminder={onDeleteReminder}
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
        </Box>

        {/* Right Column (35%): Task Log Notes & Chronological Timeline (reduced horizontally by 30%) */}
        <Box
          sx={{
            flex: { md: '0 0 35%' },
            width: { xs: '100%', md: '35%' },
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            backgroundColor: isDark ? '#11151A' : '#F8FAFC',
          }}
        >
          {/* Header of Log Notes Section */}
          <Box
            sx={{
              p: 2,
              px: 2.5,
              borderBottom: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: isDark ? '#14191F' : '#FFFFFF',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FileText size={17} color="#16C47F" />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.88rem' }}>
                Task Log Notes
              </Typography>
              <Chip
                label={logNotes.length}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  backgroundColor: isDark ? 'rgba(22, 196, 127, 0.15)' : 'rgba(22, 196, 127, 0.12)',
                  color: '#16C47F',
                }}
              />
            </Box>
          </Box>

          {/* Scrollable Container with Capture Box + Timeline */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              p: { xs: 2, sm: 2.5 },
              display: 'flex',
              flexDirection: 'column',
              gap: 2.5,
            }}
          >
            {/* Capture Input Card */}
            <Box
              sx={{
                p: 2,
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                backgroundColor: isDark ? '#181E24' : '#FFFFFF',
                boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
                Record Work Update / Log Note
              </Typography>

              <TextField
                multiline
                minRows={3}
                maxRows={8}
                fullWidth
                size="small"
                placeholder="Enter log note / work update..."
                value={newLogNote}
                onChange={(e) => setNewLogNote(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: isDark ? '#12161A' : '#FAFAFA',
                    fontSize: '0.86rem',
                  },
                }}
              />

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  disabled={!newLogNote.trim() || isSubmittingLog}
                  onClick={handleAddLogNote}
                  startIcon={isSubmittingLog ? <CircularProgress size={14} color="inherit" /> : <Plus size={15} />}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 2,
                    px: 2,
                    backgroundColor: '#16C47F',
                    '&:hover': {
                      backgroundColor: '#13A86B',
                    },
                  }}
                >
                  Log Note
                </Button>
              </Box>
            </Box>

            <Divider sx={{ my: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600, px: 1 }}>
                TIMELINE (NEWEST FIRST)
              </Typography>
            </Divider>

            {/* Timeline Stream */}
            {logNotes.length === 0 ? (
              <Box sx={{ py: 6, px: 2, textAlign: 'center', color: '#94A3B8' }}>
                <Clock size={36} style={{ strokeWidth: 1.5, opacity: 0.4, marginBottom: 8 }} />
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748B' }}>
                  No log notes recorded yet.
                </Typography>
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                  Enter an update above to begin tracking timeline activity.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {logNotes.map((note, idx) => {
                  const empName = note.employee_name || 'Employee';
                  const initials = empName
                    .split(' ')
                    .map((n) => n[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || 'E';

                  return (
                    <Box key={note.id || idx} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                      {/* Timeline Dot / Avatar */}
                      <Avatar
                        src={note.employee_photo || undefined}
                        sx={{
                          width: 32,
                          height: 32,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: isDark ? '#233038' : '#E2E8F0',
                          color: isDark ? '#16C47F' : '#1E293B',
                          border: '2px solid',
                          borderColor: isDark ? 'rgba(22, 196, 127, 0.4)' : '#16C47F',
                          mt: 0.25,
                        }}
                      >
                        {initials}
                      </Avatar>

                      {/* Timeline Card */}
                      <Box
                        sx={{
                          flex: 1,
                          p: 1.75,
                          borderRadius: 2.25,
                          border: '1px solid',
                          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                          backgroundColor: isDark ? '#161B21' : '#FFFFFF',
                          boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
                        }}
                      >
                        {/* Header: Employee Name + Date & Time */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.84rem' }}>
                            {empName}
                          </Typography>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#64748B' }}>
                              <Calendar size={12} />
                              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.74rem' }}>
                                {formatDisplayDate(note.created_at, note.formatted_date)}
                              </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#64748B' }}>
                              <Clock size={12} />
                              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.74rem' }}>
                                {formatDisplayTime(note.created_at, note.formatted_time)}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>

                        {/* Note Content */}
                        <Typography
                          variant="body2"
                          sx={{
                            color: isDark ? '#E2E8F0' : '#334155',
                            fontSize: '0.84rem',
                            lineHeight: 1.55,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {note.note}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Drawer Footer Actions */}
      <Box
        sx={{
          p: 2,
          px: 2.5,
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
