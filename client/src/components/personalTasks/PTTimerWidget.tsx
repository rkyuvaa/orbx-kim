import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Tooltip,
  useTheme,
} from '@mui/material';
import { Play, Square, Plus, Trash2, Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import { TaskTimeEntryInfo } from '@/api/projectsApi';
import { formatStandardDateTime, formatDate } from '@/utils/format';

interface PTTimerWidgetProps {
  taskId: number;
  taskTitle: string;
  estimatedHours: number;
  actualHours: number;
  activeTimer: TaskTimeEntryInfo | null;
  timeEntries: TaskTimeEntryInfo[];
  maxTimerHours?: number;
  onStartTimer: (taskId: number, forceSwitch?: boolean) => Promise<void>;
  onStopTimer: (taskId: number, description?: string) => Promise<void>;
  onAddManualEntry: (data: { duration_minutes: number; description?: string; started_at: string }) => Promise<void>;
  onDeleteEntry: (entryId: number) => Promise<void>;
}

export default function PTTimerWidget({
  taskId,
  taskTitle,
  estimatedHours,
  actualHours,
  activeTimer,
  timeEntries,
  maxTimerHours = 8.0,
  onStartTimer,
  onStopTimer,
  onAddManualEntry,
  onDeleteEntry,
}: PTTimerWidgetProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const isCurrentTaskRunning = activeTimer && activeTimer.task_id === taskId;
  const isOtherTaskRunning = activeTimer && activeTimer.task_id !== taskId;

  // Running elapsed timer seconds
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isCurrentTaskRunning || !activeTimer?.started_at) {
      setElapsedSeconds(0);
      return;
    }

    const calcElapsed = () => {
      const startMs = new Date(activeTimer.started_at).getTime();
      const nowMs = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((nowMs - startMs) / 1000)));
    };

    calcElapsed();
    const interval = setInterval(calcElapsed, 1000);
    return () => clearInterval(interval);
  }, [isCurrentTaskRunning, activeTimer?.started_at]);

  const formatTimerDigits = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const remSecs = secs % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;
  };

  // Switch timer confirmation dialog
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);

  // Stop description dialog
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [stopNote, setStopNote] = useState('');

  // Manual entry dialog
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualMinutes, setManualMinutes] = useState(60);
  const [manualDesc, setManualDesc] = useState('');

  const isExceedingEstimate = actualHours > estimatedHours && estimatedHours > 0;
  const isTimerExceedingMax = elapsedSeconds > maxTimerHours * 3600;

  const handleStart = async () => {
    if (isOtherTaskRunning) {
      setSwitchDialogOpen(true);
    } else {
      await onStartTimer(taskId);
    }
  };

  const handleConfirmSwitch = async () => {
    setSwitchDialogOpen(false);
    await onStartTimer(taskId, true);
  };

  const handleConfirmStop = async () => {
    setStopDialogOpen(false);
    await onStopTimer(taskId, stopNote);
    setStopNote('');
  };

  const handleSaveManual = async () => {
    if (manualMinutes <= 0) return;
    const started = new Date(`${manualDate}T09:00:00Z`).toISOString();
    await onAddManualEntry({
      duration_minutes: manualMinutes,
      description: manualDesc,
      started_at: started,
    });
    setManualDialogOpen(false);
    setManualDesc('');
    setManualMinutes(60);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Timer Controls Box */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: isCurrentTaskRunning
            ? '#16C47F'
            : isDark
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.08)',
          backgroundColor: isDark ? '#14181C' : '#F8FAF8',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600, letterSpacing: '0.08em' }}>
          TIME TRACKER
        </Typography>

        <Typography
          variant="h3"
          sx={{
            fontFamily: 'monospace',
            fontWeight: 800,
            letterSpacing: '0.05em',
            color: isCurrentTaskRunning ? '#16C47F' : isDark ? '#FFFFFF' : '#1E293B',
          }}
        >
          {formatTimerDigits(elapsedSeconds)}
        </Typography>

        {isTimerExceedingMax && (
          <Alert severity="warning" icon={<AlertTriangle size={16} />} sx={{ py: 0.25 }}>
            Timer has exceeded maximum duration ({maxTimerHours}h)!
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {isCurrentTaskRunning ? (
            <Button
              variant="contained"
              color="error"
              size="medium"
              startIcon={<Square size={16} />}
              onClick={() => setStopDialogOpen(true)}
              sx={{ fontWeight: 700, borderRadius: 2, px: 3, textTransform: 'none' }}
            >
              Stop Timer
            </Button>
          ) : (
            <Button
              variant="contained"
              size="medium"
              startIcon={<Play size={16} />}
              onClick={handleStart}
              sx={{
                fontWeight: 700,
                borderRadius: 2,
                px: 3,
                textTransform: 'none',
                backgroundColor: isDark ? '#16C47F' : '#203020',
                color: isDark ? '#000000' : '#FFFFFF',
                '&:hover': { backgroundColor: isDark ? '#14B070' : '#2A402A' },
              }}
            >
              Start Timer
            </Button>
          )}

          <Button
            variant="outlined"
            size="medium"
            startIcon={<Plus size={16} />}
            onClick={() => setManualDialogOpen(true)}
            sx={{ fontWeight: 600, borderRadius: 2, textTransform: 'none' }}
          >
            Log Time Manually
          </Button>
        </Box>
      </Paper>

      {/* Summary KPI Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F1F5F9' }}>
        <Box>
          <Typography variant="caption" sx={{ color: '#64748B' }}>Estimated</Typography>
          <Typography variant="body1" sx={{ fontWeight: 700 }}>{estimatedHours}h</Typography>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ color: '#64748B' }}>Actual</Typography>
          <Typography variant="body1" sx={{ fontWeight: 700, color: isExceedingEstimate ? '#EF4444' : 'inherit' }}>
            {actualHours}h
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ color: '#64748B' }}>Remaining Effort</Typography>
          <Typography variant="body1" sx={{ fontWeight: 700, color: '#16C47F' }}>
            {Math.max(0, estimatedHours - actualHours)}h
          </Typography>
        </Box>
      </Box>

      {/* Warning if actual exceeds estimate */}
      {isExceedingEstimate && (
        <Alert severity="warning" icon={<AlertCircle size={16} />} sx={{ py: 0.5 }}>
          Actual time ({actualHours}h) exceeds estimated effort ({estimatedHours}h).
        </Alert>
      )}

      {/* Time Entries Table */}
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Logged Time Entries ({timeEntries.length})
        </Typography>

        {timeEntries.length === 0 ? (
          <Typography variant="body2" sx={{ color: '#94A3B8', py: 2, textAlign: 'center' }}>
            No time recorded yet.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {timeEntries.map((entry) => (
              <Paper
                key={entry.id}
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {entry.duration_minutes} mins ({(entry.duration_minutes / 60).toFixed(2)}h)
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748B' }}>
                      • {formatDate(entry.started_at)}
                    </Typography>
                  </Box>
                  {entry.description && (
                    <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                      {entry.description}
                    </Typography>
                  )}
                </Box>

                <Tooltip title="Delete Entry">
                  <IconButton
                    size="small"
                    onClick={() => onDeleteEntry(entry.id)}
                    sx={{ color: '#94A3B8', '&:hover': { color: '#EF4444' } }}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </Tooltip>
              </Paper>
            ))}
          </Box>
        )}
      </Box>

      {/* Switch Timer Confirmation Dialog */}
      <Dialog open={switchDialogOpen} onClose={() => setSwitchDialogOpen(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Active Timer Running</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            You already have an active timer running on task #{activeTimer?.task_id}.
            Would you like to stop it and switch to "{taskTitle}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSwitchDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmSwitch} variant="contained" color="primary">
            Switch Timer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Stop Timer Description Dialog */}
      <Dialog open={stopDialogOpen} onClose={() => setStopDialogOpen(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Stop Timer</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Add an optional note describing the work completed during this session:
          </Typography>
          <TextField
            fullWidth
            autoFocus
            size="small"
            placeholder="e.g. Reviewed pricing and drafted response"
            value={stopNote}
            onChange={(e) => setStopNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStopDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmStop} variant="contained" color="error">
            Confirm & Stop
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manual Entry Dialog */}
      <Dialog open={manualDialogOpen} onClose={() => setManualDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Log Time Manually</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Date"
            type="date"
            size="small"
            fullWidth
            value={manualDate}
            onChange={(e) => setManualDate(e.target.value)}
          />
          <TextField
            label="Duration (minutes)"
            type="number"
            size="small"
            fullWidth
            value={manualMinutes}
            onChange={(e) => setManualMinutes(parseInt(e.target.value, 10) || 0)}
            helperText={`= ${(manualMinutes / 60).toFixed(2)} hours`}
          />
          <TextField
            label="Description / Note"
            size="small"
            fullWidth
            multiline
            rows={2}
            value={manualDesc}
            onChange={(e) => setManualDesc(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManualDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveManual} variant="contained">
            Save Log
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
