import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Autocomplete,
  Avatar,
  useTheme,
  Alert,
} from '@mui/material';
import { X, UserPlus, Calendar, Clock, AlertCircle } from 'lucide-react';
import { useUsersQuery } from '@/api/mastersApi';
import { useAssignPersonalTaskMutation, TaskPriority } from '@/api/personalTasksApi';
import { useAppSelector } from '@/app/hooks';

interface PTAssignTaskModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PTAssignTaskModal({ open, onClose, onSuccess }: PTAssignTaskModalProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const currentUser = useAppSelector((state) => state.auth.user);

  // Masters: registered users
  const { data: users = [], isLoading: isLoadingUsers } = useUsersQuery();
  const [assignPersonalTask, { isLoading: isAssigning }] = useAssignPersonalTaskMutation();

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Registered users list: exclude current user by default or keep all
  const assignableUsers = React.useMemo(() => {
    return users.filter((u) => u.id !== currentUser?.id);
  }, [users, currentUser?.id]);

  const handleReset = () => {
    setTitle('');
    setDescription('');
    setAssigneeId(null);
    setPriority('NORMAL');
    setStartDate(new Date().toISOString().split('T')[0]);
    setDueDate('');
    setEstimatedHours('');
    setErrorMsg(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isAssigning || isSubmitting) return;
    handleReset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isAssigning) return;

    if (!title.trim()) {
      setErrorMsg('Please enter a task title');
      return;
    }
    if (!assigneeId) {
      setErrorMsg('Please select a registered user to assign the task to');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      await assignPersonalTask({
        title: title.trim(),
        description: description.trim() || undefined,
        assignee_id: assigneeId,
        priority,
        start_date: startDate || undefined,
        due_date: dueDate || undefined,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : 0,
      }).unwrap();

      handleReset();
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Failed to assign task:', err);
      setErrorMsg(err?.data?.detail || 'Failed to assign task. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedUser = users.find((u) => u.id === assigneeId) || null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
          backgroundImage: 'none',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          p: 0.5,
        },
      }}
    >
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1.5,
            pt: 2,
            px: 3,
            borderBottom: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2,
                backgroundColor: isDark ? 'rgba(22, 196, 127, 0.15)' : 'rgba(22, 196, 127, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#16C47F',
              }}
            >
              <UserPlus size={20} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.2 }}>
                Assign Task
              </Typography>
              <Typography variant="caption" sx={{ color: isDark ? '#94A3B8' : '#64748B' }}>
                Delegate a task to another registered user with full activity logging
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={handleClose} disabled={isSubmitting || isAssigning}>
            <X size={18} />
          </IconButton>
        </DialogTitle>

        {/* Content */}
        <DialogContent sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {errorMsg && (
            <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => setErrorMsg(null)}>
              {errorMsg}
            </Alert>
          )}

          {/* Task Title */}
          <TextField
            autoFocus
            label="Task Title *"
            fullWidth
            size="small"
            placeholder="e.g. Prepare quarterly vehicle compliance report"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSubmitting || isAssigning}
            required
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />

          {/* Assign To (Autocomplete User Selection) */}
          <Autocomplete
            options={assignableUsers}
            loading={isLoadingUsers}
            getOptionLabel={(option) => `${option.full_name} (${option.role_name || option.role || 'Member'})`}
            value={selectedUser}
            onChange={(_, val) => setAssigneeId(val ? val.id : null)}
            isOptionEqualToValue={(option, val) => option.id === val.id}
            renderOption={(props, option) => (
              <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
                <Avatar
                  sx={{
                    width: 30,
                    height: 30,
                    fontSize: '0.8rem',
                    bgcolor: isDark ? '#16C47F' : '#203020',
                    color: '#FFFFFF',
                  }}
                >
                  {option.full_name.charAt(0).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {option.full_name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>
                    {option.role_name || option.role} {option.email ? `• ${option.email}` : ''}
                  </Typography>
                </Box>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Assign To *"
                size="small"
                placeholder="Search registered user..."
                required
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {isLoadingUsers ? <CircularProgress color="inherit" size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
              />
            )}
          />

          {/* Task Description */}
          <TextField
            label="Task Description"
            fullWidth
            multiline
            rows={3}
            placeholder="Provide context, deliverables, requirements, or links..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting || isAssigning}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />

          {/* Priority & Estimated Hours Row */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="assign-priority-label">Priority</InputLabel>
              <Select
                labelId="assign-priority-label"
                label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                disabled={isSubmitting || isAssigning}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="LOW">Low</MenuItem>
                <MenuItem value="NORMAL">Normal</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
                <MenuItem value="URGENT">Urgent</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Estimated Hours"
              fullWidth
              size="small"
              type="number"
              placeholder="e.g. 2.5"
              inputProps={{ min: 0, step: 0.5 }}
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              disabled={isSubmitting || isAssigning}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />
          </Box>

          {/* Start Date & Due Date Row */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Start Date"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={isSubmitting || isAssigning}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />

            <TextField
              label="Due Date"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={isSubmitting || isAssigning}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />
          </Box>
        </DialogContent>

        {/* Actions */}
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            borderTop: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1.5,
          }}
        >
          <Button
            onClick={handleClose}
            disabled={isSubmitting || isAssigning}
            variant="outlined"
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              px: 2.5,
              borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
              color: isDark ? '#E2E8F0' : '#475569',
            }}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="contained"
            disabled={!title.trim() || !assigneeId || isSubmitting || isAssigning}
            startIcon={
              isSubmitting || isAssigning ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <UserPlus size={16} />
              )
            }
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              backgroundColor: isDark ? '#16C47F' : '#203020',
              color: isDark ? '#000000' : '#FFFFFF',
              '&:hover': {
                backgroundColor: isDark ? '#14B070' : '#2A402A',
              },
            }}
          >
            {isSubmitting || isAssigning ? 'Assigning...' : 'Assign Task'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
