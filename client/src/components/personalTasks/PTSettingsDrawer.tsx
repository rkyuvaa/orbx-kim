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
  useTheme,
} from '@mui/material';
import { X, Settings2, Save } from 'lucide-react';
import { PersonalSettings } from '@/api/personalTasksApi';

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
  const [isSaving, setIsSaving] = useState(false);

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
