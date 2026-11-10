import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  TextField,
  Button,
  FormControlLabel,
  Checkbox,
  Switch,
  Divider,
  Select,
  MenuItem,
  Chip,
  useTheme,
} from '@mui/material';
import { X, Settings2, Save, Bell, Send, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PersonalSettings } from '@/api/personalTasksApi';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface PTSettingsDrawerProps {
  open: boolean;
  settings: PersonalSettings | undefined;
  onClose: () => void;
  onSaveSettings: (patch: Partial<PersonalSettings>) => Promise<void>;
}

export default function PTSettingsDrawer({
  open,
  settings,
  onClose,
  onSaveSettings,
}: PTSettingsDrawerProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [workingHours, setWorkingHours] = useState(8.0);
  const [workingDays, setWorkingDays] = useState<string[]>(['MON', 'TUE', 'WED', 'THU', 'FRI']);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [digestTime, setDigestTime] = useState('07:30');
  const [maxTimerHours, setMaxTimerHours] = useState(8.0);
  const [autoStopTimer, setAutoStopTimer] = useState(true);
  const [reminderPresets, setReminderPresets] = useState('1d,1h,due');
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [pushTaskAssigned, setPushTaskAssigned] = useState(true);
  const [pushTaskDueToday, setPushTaskDueToday] = useState(true);
  const [pushLogNoteUpdate, setPushLogNoteUpdate] = useState(true);
  const [pushTaskCompleted, setPushTaskCompleted] = useState(true);
  const [pushTaskComments, setPushTaskComments] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const {
    isSupported: isPushSupported,
    permission: pushPermission,
    isSubscribed: isPushSubscribed,
    isProcessing: isPushProcessing,
    isTesting: isPushTesting,
    subscribe: subscribePush,
    sendTest: sendTestPush,
  } = usePushNotifications();

  const isPushDenied = pushPermission === 'denied';

  const handleSendTestPush = async () => {
    try {
      await sendTestPush();
    } catch (e) {
      console.warn('Failed to send test push:', e);
    }
  };

  useEffect(() => {
    if (settings) {
      setTimezone(settings.timezone || 'Asia/Kolkata');
      setWorkingHours(settings.working_hours_per_day || 8.0);
      setWorkingDays(
        settings.working_days
          ? settings.working_days.split(',').map((d) => d.trim().toUpperCase())
          : ['MON', 'TUE', 'WED', 'THU', 'FRI']
      );
      setQuietStart(settings.quiet_hours_start || '22:00');
      setQuietEnd(settings.quiet_hours_end || '07:00');
      setDigestTime(settings.digest_time || '07:30');
      setMaxTimerHours(settings.max_timer_hours || 8.0);
      setAutoStopTimer(settings.auto_stop_timer_at_eod ?? true);
      setReminderPresets(settings.default_reminder_presets || '1d,1h,due');
      setEmailNotificationsEnabled(settings.email_notifications_enabled ?? true);
      setPushTaskAssigned(settings.push_task_assigned ?? true);
      setPushTaskDueToday(settings.push_task_due_today ?? true);
      setPushLogNoteUpdate(settings.push_log_note_update ?? true);
      setPushTaskCompleted(settings.push_task_completed ?? true);
      setPushTaskComments(settings.push_task_comments ?? true);
    }
  }, [settings]);

  const toggleDay = (day: string) => {
    if (workingDays.includes(day)) {
      setWorkingDays(workingDays.filter((d) => d !== day));
    } else {
      setWorkingDays([...workingDays, day]);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSaveSettings({
        timezone,
        working_hours_per_day: workingHours,
        working_days: workingDays.join(','),
        quiet_hours_start: quietStart,
        quiet_hours_end: quietEnd,
        digest_time: digestTime,
        max_timer_hours: maxTimerHours,
        auto_stop_timer_at_eod: autoStopTimer,
        default_reminder_presets: reminderPresets,
        email_notifications_enabled: emailNotificationsEnabled,
        push_task_assigned: pushTaskAssigned,
        push_task_due_today: pushTaskDueToday,
        push_log_note_update: pushLogNoteUpdate,
        push_task_completed: pushTaskCompleted,
        push_task_comments: pushTaskComments,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const daysList = [
    { id: 'MON', label: 'Mon' },
    { id: 'TUE', label: 'Tue' },
    { id: 'WED', label: 'Wed' },
    { id: 'THU', label: 'Thu' },
    { id: 'FRI', label: 'Fri' },
    { id: 'SAT', label: 'Sat' },
    { id: 'SUN', label: 'Sun' },
  ];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 440 },
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
      <Box
        sx={{
          p: 2.5,
          borderBottom: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Settings2 size={18} color={isDark ? '#16C47F' : '#203020'} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Planner Settings
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </Box>

      <Box sx={{ p: 3, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Working Hours & Timezone */}
        <Box>
          <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
            Workload & Capacity
          </Typography>
          <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Daily Working Hours"
              type="number"
              size="small"
              fullWidth
              value={workingHours}
              onChange={(e) => setWorkingHours(parseFloat(e.target.value) || 0)}
              helperText="Available hours used to compute daily capacity and utilization %"
            />

            <Box>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 1 }}>
                Configured Working Days
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {daysList.map((d) => {
                  const isChecked = workingDays.includes(d.id);
                  return (
                    <Button
                      key={d.id}
                      size="small"
                      variant={isChecked ? 'contained' : 'outlined'}
                      onClick={() => toggleDay(d.id)}
                      sx={{
                        minWidth: 46,
                        textTransform: 'none',
                        borderRadius: 1.5,
                        backgroundColor: isChecked ? (isDark ? '#16C47F' : '#203020') : 'transparent',
                        color: isChecked ? (isDark ? '#000000' : '#FFFFFF') : 'inherit',
                      }}
                    >
                      {d.label}
                    </Button>
                  );
                })}
              </Box>
            </Box>

            <TextField
              label="Timezone"
              size="small"
              fullWidth
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              helperText="All dates/reminders are stored in UTC and rendered in this timezone"
            />
          </Box>
        </Box>

        <Divider />

        {/* Time Tracking Guardrails */}
        <Box>
          <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
            Time Tracking Safeguards
          </Typography>
          <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Max Stopwatch Timer Hours"
              type="number"
              size="small"
              fullWidth
              value={maxTimerHours}
              onChange={(e) => setMaxTimerHours(parseFloat(e.target.value) || 0)}
              helperText="Warns user when a continuous timer session exceeds this duration"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={autoStopTimer}
                  onChange={(e) => setAutoStopTimer(e.target.checked)}
                />
              }
              label={
                <Typography variant="body2">
                  Auto-stop active timer at end of working day
                </Typography>
              }
            />
          </Box>
        </Box>

        <Divider />

        {/* Reminders & Notifications */}
        <Box>
          <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
            Reminders & Quiet Hours
          </Typography>
          <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField
                label="Quiet Hours Start"
                type="time"
                size="small"
                fullWidth
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
              />
              <TextField
                label="Quiet Hours End"
                type="time"
                size="small"
                fullWidth
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
              />
            </Box>

            <TextField
              label="Daily Digest Time"
              type="time"
              size="small"
              fullWidth
              value={digestTime}
              onChange={(e) => setDigestTime(e.target.value)}
              helperText="Morning summary time for scheduled tasks"
            />

            <Box
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={emailNotificationsEnabled}
                    onChange={(e) => setEmailNotificationsEnabled(e.target.checked)}
                    color="success"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Task Assignment Email Alerts
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
                      Receive an instant email notification whenever someone assigns or delegates a task to you.
                    </Typography>
                  </Box>
                }
                sx={{ m: 0, alignItems: 'flex-start', gap: 1 }}
              />
            </Box>
          </Box>
        </Box>

        <Divider />

        {/* Push Notification Preferences */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              Push Notification Preferences
            </Typography>
            {isPushSubscribed ? (
              <Chip
                size="small"
                icon={<CheckCircle2 size={12} color="#15803D" />}
                label="Active on Device"
                sx={{
                  bgcolor: isDark ? 'rgba(21, 128, 61, 0.2)' : '#DCFCE7',
                  color: isDark ? '#4ADE80' : '#15803D',
                  fontWeight: 600,
                  fontSize: 10.5,
                  height: 20,
                }}
              />
            ) : isPushDenied ? (
              <Chip
                size="small"
                icon={<AlertTriangle size={12} color="#D97706" />}
                label="Blocked in Browser"
                sx={{
                  bgcolor: isDark ? 'rgba(217, 119, 6, 0.2)' : '#FEF3C7',
                  color: isDark ? '#FBBF24' : '#B45309',
                  fontWeight: 600,
                  fontSize: 10.5,
                  height: 20,
                }}
              />
            ) : (
              <Chip
                size="small"
                label="Push Inactive"
                sx={{
                  bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                  color: '#94A3B8',
                  fontWeight: 500,
                  fontSize: 10.5,
                  height: 20,
                }}
              />
            )}
          </Box>

          {!isPushSubscribed && !isPushDenied && isPushSupported && (
            <Box
              sx={{
                mb: 2,
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: isDark ? 'rgba(4, 85, 43, 0.15)' : '#F0FDF4',
                border: '1px solid',
                borderColor: isDark ? 'rgba(4, 85, 43, 0.3)' : '#BBF7D0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
              }}
            >
              <Typography variant="caption" sx={{ color: isDark ? '#86EFAC' : '#166534', fontWeight: 500 }}>
                Desktop alerts are not yet enabled for this device.
              </Typography>
              <Button
                size="small"
                variant="contained"
                onClick={subscribePush}
                disabled={isPushProcessing}
                startIcon={<Bell size={13} />}
                sx={{
                  textTransform: 'none',
                  fontSize: 11.5,
                  py: 0.4,
                  px: 1.2,
                  bgcolor: '#04552B',
                  '&:hover': { bgcolor: '#02381B' },
                }}
              >
                {isPushProcessing ? 'Enabling...' : 'Enable Now'}
              </Button>
            </Box>
          )}

          {isPushSubscribed && (
            <Box sx={{ mb: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                size="small"
                variant="outlined"
                onClick={handleSendTestPush}
                disabled={isPushTesting}
                startIcon={<Send size={12} />}
                sx={{
                  textTransform: 'none',
                  fontSize: 11,
                  py: 0.25,
                  px: 1,
                  borderColor: isDark ? '#334155' : '#CBD5E1',
                  color: isDark ? '#94A3B8' : '#475569',
                }}
              >
                {isPushTesting ? 'Sending test...' : 'Send Test Notification'}
              </Button>
            </Box>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {/* Toggle 1: Task Assigned */}
            <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={pushTaskAssigned}
                    onChange={(e) => setPushTaskAssigned(e.target.checked)}
                    color="success"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Task Assigned Notifications
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
                      Receive instant push notifications when someone assigns or delegates a task to you.
                    </Typography>
                  </Box>
                }
                sx={{ m: 0, alignItems: 'flex-start', gap: 1 }}
              />
            </Box>

            {/* Toggle 2: Task Due Today */}
            <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={pushTaskDueToday}
                    onChange={(e) => setPushTaskDueToday(e.target.checked)}
                    color="success"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Task Due Today
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
                      Receive push notifications for tasks that are due today or scheduled for reminder.
                    </Typography>
                  </Box>
                }
                sx={{ m: 0, alignItems: 'flex-start', gap: 1 }}
              />
            </Box>

            {/* Toggle 3: Assigner Update Log Note */}
            <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={pushLogNoteUpdate}
                    onChange={(e) => setPushLogNoteUpdate(e.target.checked)}
                    color="success"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Assigner Update the Log Note
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
                      Receive push notifications when an assigner or assignee posts a new log note.
                    </Typography>
                  </Box>
                }
                sx={{ m: 0, alignItems: 'flex-start', gap: 1 }}
              />
            </Box>

            {/* Toggle 4: Assigned Task Completed */}
            <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={pushTaskCompleted}
                    onChange={(e) => setPushTaskCompleted(e.target.checked)}
                    color="success"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Assigned Task Completed
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
                      Receive push notifications when a task you assigned to a colleague is marked completed.
                    </Typography>
                  </Box>
                }
                sx={{ m: 0, alignItems: 'flex-start', gap: 1 }}
              />
            </Box>

            {/* Toggle 5: Task Comments */}
            <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={pushTaskComments}
                    onChange={(e) => setPushTaskComments(e.target.checked)}
                    color="success"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Task Comments & Mentions
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
                      Receive push notifications when someone comments on your task or mentions you.
                    </Typography>
                  </Box>
                }
                sx={{ m: 0, alignItems: 'flex-start', gap: 1 }}
              />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          p: 2,
          pb: 'max(16px, env(safe-area-inset-bottom, 0px))',
          borderTop: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1.5,
        }}
      >
        <Button variant="outlined" size="small" onClick={onClose} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<Save size={15} />}
          disabled={isSaving}
          onClick={handleSave}
          sx={{
            textTransform: 'none',
            borderRadius: 2,
            backgroundColor: isDark ? '#16C47F' : '#203020',
            color: isDark ? '#000000' : '#FFFFFF',
            fontWeight: 600,
          }}
        >
          Save Preferences
        </Button>
      </Box>
    </Drawer>
  );
}
