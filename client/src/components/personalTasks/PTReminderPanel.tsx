import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Paper,
  TextField,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import { Bell, Clock, AlertCircle, Plus, Check } from 'lucide-react';
import { PersonalReminder } from '@/api/personalTasksApi';
import { formatStandardDateTime } from '@/utils/format';

interface PTReminderPanelProps {
  taskId: number;
  dueDate?: string | null;
  reminders: PersonalReminder[];
  onCreateReminder: (reminderType: string, scheduledAt: string) => Promise<void>;
  onSnoozeReminder: (reminderId: number, minutes: number) => Promise<void>;
}

export default function PTReminderPanel({
  taskId,
  dueDate,
  reminders,
  onCreateReminder,
  onSnoozeReminder,
}: PTReminderPanelProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [customDateTime, setCustomDateTime] = useState('');

  const handlePreset = async (preset: '1d' | '1h' | 'due') => {
    if (!dueDate) return;
    const due = new Date(`${dueDate}T09:00:00Z`);
    let scheduled: Date;

    if (preset === '1d') {
      scheduled = new Date(due.getTime() - 24 * 3600 * 1000);
    } else if (preset === '1h') {
      scheduled = new Date(due.getTime() - 3600 * 1000);
    } else {
      scheduled = due;
    }

    await onCreateReminder(preset, scheduled.toISOString());
  };

  const handleCustomAdd = async () => {
    if (!customDateTime) return;
    const scheduled = new Date(customDateTime).toISOString();
    await onCreateReminder('custom', scheduled);
    setCustomDateTime('');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Bell size={16} color={isDark ? '#16C47F' : '#203020'} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Scheduled Reminders
        </Typography>
      </Box>

      {/* Presets */}
      <Box>
        <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 1 }}>
          Quick Presets (relative to due date)
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="outlined"
            disabled={!dueDate}
            onClick={() => handlePreset('1d')}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            1 Day Before
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={!dueDate}
            onClick={() => handlePreset('1h')}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            1 Hour Before
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={!dueDate}
            onClick={() => handlePreset('due')}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            At Due Time
          </Button>
        </Box>
        {!dueDate && (
          <Typography variant="caption" sx={{ color: '#F97316', mt: 0.5, display: 'block' }}>
            Set a due date first to enable relative presets.
          </Typography>
        )}
      </Box>

      {/* Custom Picker */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          type="datetime-local"
          size="small"
          fullWidth
          value={customDateTime}
          onChange={(e) => setCustomDateTime(e.target.value)}
          helperText="Or pick exact date and time"
        />
        <Button
          size="small"
          variant="contained"
          disabled={!customDateTime}
          onClick={handleCustomAdd}
          sx={{
            textTransform: 'none',
            borderRadius: 2,
            backgroundColor: isDark ? '#16C47F' : '#203020',
            color: isDark ? '#000000' : '#FFFFFF',
            whiteSpace: 'nowrap',
            mb: 2.5,
          }}
        >
          Schedule
        </Button>
      </Box>

      {/* Existing Reminders List */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {reminders.length === 0 ? (
          <Typography variant="caption" sx={{ color: '#94A3B8', py: 1 }}>
            No reminders scheduled for this task.
          </Typography>
        ) : (
          reminders.map((r) => (
            <Paper
              key={r.id}
              elevation={0}
              sx={{
                p: 1.25,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={r.reminder_type}
                    size="small"
                    sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600 }}
                  />
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {formatStandardDateTime(r.scheduled_at)}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>
                  Status: {r.status}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title="Snooze 15 minutes">
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => onSnoozeReminder(r.id, 15)}
                    sx={{ fontSize: '0.7rem', py: 0.25, minWidth: 'auto' }}
                  >
                    +15m
                  </Button>
                </Tooltip>
                <Tooltip title="Snooze 1 hour">
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => onSnoozeReminder(r.id, 60)}
                    sx={{ fontSize: '0.7rem', py: 0.25, minWidth: 'auto' }}
                  >
                    +1h
                  </Button>
                </Tooltip>
              </Box>
            </Paper>
          ))
        )}
      </Box>
    </Box>
  );
}
