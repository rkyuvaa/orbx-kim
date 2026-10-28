import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Checkbox,
  LinearProgress,
  Button,
  FormControlLabel,
  Switch,
  Paper,
  Tooltip,
  useTheme,
} from '@mui/material';
import { Plus, Trash2, CheckCircle2, Circle, Calendar, ListTree } from 'lucide-react';
import { PTTask, PTTaskCreate } from '@/api/personalTasksApi';
import { formatDate } from '@/utils/format';

interface PTSubtaskPanelProps {
  task: PTTask;
  onAddSubtask: (subtask: PTTaskCreate) => Promise<void>;
  onToggleSubtask: (subtaskId: number, isCompleted: boolean) => Promise<void>;
  onDeleteSubtask: (subtaskId: number) => Promise<void>;
  onToggleFollowDue: (enabled: boolean) => Promise<void>;
}

export default function PTSubtaskPanel({
  task,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onToggleFollowDue,
}: PTSubtaskPanelProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subtasks = task.nested_subtasks || [];
  const completedCount = subtasks.filter((s) => s.is_completed).length;
  const totalCount = subtasks.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setIsSubmitting(true);
      await onAddSubtask({
        title: newTitle.trim(),
        due_date: newDueDate || undefined,
        parent_task_id: task.id,
      });
      setNewTitle('');
      setNewDueDate('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Progress Header */}
      <Box sx={{ p: 2, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAF8' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ListTree size={16} color={isDark ? '#16C47F' : '#203020'} />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Subtasks ({completedCount}/{totalCount} Completed)
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#16C47F' }}>
            {progress}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 6,
            borderRadius: 3,
            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            '& .MuiLinearProgress-bar': { backgroundColor: '#16C47F' },
          }}
        />

        <Box sx={{ mt: 1.5 }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={task.parent_due_follows_subtasks ?? true}
                onChange={(e) => onToggleFollowDue(e.target.checked)}
              />
            }
            label={
              <Typography variant="caption" sx={{ color: isDark ? '#94A3B8' : '#64748B' }}>
                Parent due date automatically follows latest subtask due date
              </Typography>
            }
          />
        </Box>
      </Box>

      {/* Subtasks List */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {subtasks.length === 0 ? (
          <Typography variant="body2" sx={{ color: '#94A3B8', py: 2, textAlign: 'center' }}>
            No subtasks yet. Add checklists or smaller milestones below.
          </Typography>
        ) : (
          subtasks.map((sub) => (
            <Paper
              key={sub.id}
              elevation={0}
              sx={{
                p: 1.25,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: isDark ? '#181D22' : '#FFFFFF',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flex: 1, minWidth: 0 }}>
                <IconButton
                  size="small"
                  onClick={() => onToggleSubtask(sub.id, !sub.is_completed)}
                  sx={{ color: sub.is_completed ? '#16C47F' : '#94A3B8' }}
                >
                  {sub.is_completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                </IconButton>
                <Typography
                  variant="body2"
                  sx={{
                    textDecoration: sub.is_completed ? 'line-through' : 'none',
                    color: sub.is_completed ? '#94A3B8' : 'inherit',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {sub.title}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {sub.due_date && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.72rem', color: '#64748B' }}>
                    <Calendar size={12} />
                    <span>{formatDate(sub.due_date)}</span>
                  </Box>
                )}
                <Tooltip title="Delete Subtask">
                  <IconButton
                    size="small"
                    onClick={() => onDeleteSubtask(sub.id)}
                    sx={{ color: '#94A3B8', '&:hover': { color: '#EF4444' } }}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Paper>
          ))
        )}
      </Box>

      {/* Add Subtask Form */}
      <form onSubmit={handleAdd}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Add subtask title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <TextField
            type="date"
            size="small"
            sx={{ width: 145 }}
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={!newTitle.trim() || isSubmitting}
            sx={{
              textTransform: 'none',
              backgroundColor: isDark ? '#16C47F' : '#203020',
              color: isDark ? '#000000' : '#FFFFFF',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            Add
          </Button>
        </Box>
      </form>
    </Box>
  );
}
