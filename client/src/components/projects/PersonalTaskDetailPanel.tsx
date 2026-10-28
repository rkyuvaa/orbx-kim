import React, { useState, useEffect, useRef } from 'react';
import {
  Drawer, Box, Typography, IconButton, TextField, Select, MenuItem, Button, Divider
} from '@mui/material';
import { X, CheckCircle2 } from 'lucide-react';
import { TaskItem, useUpdatePersonalTaskMutation, useGetStatusDefinitionsQuery, useGetTaskTagsQuery } from '@/api/projectsApi';
import { useToast } from '@/components/ui/ToastHost';
import { formatDateTime, formatStandardDateTime } from '@/utils/format';
import Autocomplete from '@mui/material/Autocomplete';
import AutoSaveStatusBadge from '@/components/common/AutoSaveStatusBadge';
import { useAutoSave } from '@/hooks/useAutoSave';

interface PersonalTaskDetailPanelProps {
  open: boolean;
  onClose: () => void;
  task: TaskItem;
}

export default function PersonalTaskDetailPanel({ open, onClose, task }: PersonalTaskDetailPanelProps) {
  const [updateTask] = useUpdatePersonalTaskMutation();
  const { data: statuses = [] } = useGetStatusDefinitionsQuery();
  const { data: taskTags = [] } = useGetTaskTagsQuery();
  const { showToast } = useToast();

  const [title, setTitle] = useState(task.title || '');
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState(task.priority || 'NORMAL');
  const [statusId, setStatusId] = useState<number | ''>(task.status_id || '');
  const [dueDate, setDueDate] = useState(task.due_date || '');
  const [estimatedHours, setEstimatedHours] = useState<number | ''>(task.estimated_hours || '');
  const [isCompleted, setIsCompleted] = useState(task.is_completed || false);
  const [tags, setTags] = useState<string[]>(task.tags_list?.map(t => t.name) || []);
  
  const [reminderAt, setReminderAt] = useState(task.reminder_at ? task.reminder_at.substring(0, 16) : '');
  const [recurrenceType, setRecurrenceType] = useState(task.recurrence_rule?.type || 'None');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(task.recurrence_end_date || '');
  const [editSeries, setEditSeries] = useState(false);

  const editSeriesRef = useRef(editSeries);
  editSeriesRef.current = editSeries;

  const autoSave = useAutoSave<Record<string, any>>({
    initialValues: {
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || 'NORMAL',
      status_id: task.status_id || '',
      due_date: task.due_date || '',
      estimated_hours: task.estimated_hours || '',
      tag_names: task.tags_list?.map(t => t.name) || [],
      reminder_at: task.reminder_at ? task.reminder_at.substring(0, 16) : '',
      recurrence_type: task.recurrence_rule?.type || 'None',
      recurrence_end_date: task.recurrence_end_date || '',
    },
    onSave: async (patch) => {
      const body: Record<string, any> = {
        edit_series: editSeriesRef.current,
      };

      if ('title' in patch) body.title = patch.title;
      if ('description' in patch) body.description = patch.description;
      if ('priority' in patch) body.priority = patch.priority;
      if ('status_id' in patch) body.status_id = patch.status_id ? Number(patch.status_id) : undefined;
      if ('due_date' in patch) body.due_date = patch.due_date || undefined;
      if ('estimated_hours' in patch) body.estimated_hours = patch.estimated_hours ? Number(patch.estimated_hours) : 0;
      if ('tag_names' in patch) body.tag_names = patch.tag_names;
      if ('reminder_at' in patch) body.reminder_at = patch.reminder_at ? new Date(patch.reminder_at).toISOString() : undefined;
      if ('recurrence_type' in patch) {
        body.recurrence_rule = patch.recurrence_type !== 'None' ? { type: patch.recurrence_type } : null;
      }
      if ('recurrence_end_date' in patch) body.recurrence_end_date = patch.recurrence_end_date || undefined;

      await updateTask({
        id: task.id,
        body,
      }).unwrap();
    },
  });

  useEffect(() => {
    if (open && task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'NORMAL');
      setStatusId(task.status_id || '');
      setDueDate(task.due_date || '');
      setEstimatedHours(task.estimated_hours || '');
      setIsCompleted(task.is_completed || false);
      setTags(task.tags_list?.map(t => t.name) || []);
      setReminderAt(task.reminder_at ? task.reminder_at.substring(0, 16) : '');
      setRecurrenceType(task.recurrence_rule?.type || 'None');
      setRecurrenceEndDate(task.recurrence_end_date || '');
      setEditSeries(false);

      autoSave.resetInitialValues({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'NORMAL',
        status_id: task.status_id || '',
        due_date: task.due_date || '',
        estimated_hours: task.estimated_hours || '',
        tag_names: task.tags_list?.map(t => t.name) || [],
        reminder_at: task.reminder_at ? task.reminder_at.substring(0, 16) : '',
        recurrence_type: task.recurrence_rule?.type || 'None',
        recurrence_end_date: task.recurrence_end_date || '',
      });
    }
  }, [open, task.id]);

  const handleClose = async () => {
    await autoSave.flushPending();
    onClose();
  };

  const toggleComplete = async () => {
    const newStatus = !isCompleted;
    setIsCompleted(newStatus);
    try {
      await updateTask({
        id: task.id,
        body: { is_completed: newStatus }
      }).unwrap();
      showToast(newStatus ? 'Task completed!' : 'Task reopened', 'success');
    } catch (err) {
      setIsCompleted(!newStatus);
      showToast('Failed to update task status', 'error');
    }
  };

  return (
    <Drawer anchor="right" open={open} onClose={handleClose} PaperProps={{ sx: { width: { xs: '100%', sm: 500 } } }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        
        {/* Header */}
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <IconButton onClick={toggleComplete} color={isCompleted ? 'success' : 'default'} size="small">
              <CheckCircle2 size={24} />
            </IconButton>
            <Typography variant="h6" sx={{ fontWeight: 700, color: isCompleted ? 'text.secondary' : 'text.primary', textDecoration: isCompleted ? 'line-through' : 'none' }}>
              {task.task_number}
            </Typography>
            <AutoSaveStatusBadge
              status={autoSave.status}
              lastSaved={autoSave.lastSaved}
              errorMessage={autoSave.errorMessage}
              onRetry={autoSave.retry}
            />
          </Box>
          <IconButton onClick={handleClose} size="small"><X size={20} /></IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField
            label="Task Title"
            value={title}
            onChange={e => {
              setTitle(e.target.value);
              autoSave.setPendingField('title', e.target.value);
            }}
            onBlur={() => autoSave.saveField('title', title.trim())}
            fullWidth
            required
            size="small"
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5, display: 'block' }}>Status</Typography>
              <Select
                size="small"
                fullWidth
                value={statusId}
                onChange={e => {
                  const val = e.target.value as number;
                  setStatusId(val);
                  autoSave.saveField('status_id', val);
                }}
                displayEmpty
              >
                {statuses.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </Select>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5, display: 'block' }}>Priority</Typography>
              <Select
                size="small"
                fullWidth
                value={priority}
                onChange={e => {
                  const val = e.target.value as 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
                  setPriority(val);
                  autoSave.saveField('priority', val);
                }}
              >
                <MenuItem value="URGENT">Urgent</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
                <MenuItem value="NORMAL">Normal</MenuItem>
                <MenuItem value="LOW">Low</MenuItem>
              </Select>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField
              label="Due Date"
              type="date"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={dueDate}
              onChange={e => {
                setDueDate(e.target.value);
                autoSave.setPendingField('due_date', e.target.value);
              }}
              onBlur={() => autoSave.saveField('due_date', dueDate)}
            />
            <TextField
              label="Estimated Hours"
              type="number"
              size="small"
              fullWidth
              value={estimatedHours}
              onChange={e => {
                const val = e.target.value ? Number(e.target.value) : '';
                setEstimatedHours(val);
                autoSave.setPendingField('estimated_hours', val);
              }}
              onBlur={() => autoSave.saveField('estimated_hours', estimatedHours)}
            />
          </Box>

          <Autocomplete
            multiple
            freeSolo
            options={taskTags.map(t => t.name)}
            value={tags}
            onChange={(_, newValue) => {
              setTags(newValue);
              autoSave.saveField('tag_names', newValue);
            }}
            renderInput={(params) => <TextField {...params} label="Tags" size="small" />}
            size="small"
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField
              label="Reminder Date & Time"
              type="datetime-local"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={reminderAt}
              onChange={e => {
                setReminderAt(e.target.value);
                autoSave.setPendingField('reminder_at', e.target.value);
              }}
              onBlur={() => autoSave.saveField('reminder_at', reminderAt)}
            />
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5, display: 'block' }}>Recurrence</Typography>
              <Select
                size="small"
                fullWidth
                value={recurrenceType}
                onChange={e => {
                  const val = e.target.value;
                  setRecurrenceType(val);
                  autoSave.saveField('recurrence_type', val);
                }}
              >
                <MenuItem value="None">None</MenuItem>
                <MenuItem value="Daily">Daily</MenuItem>
                <MenuItem value="Weekly">Weekly</MenuItem>
                <MenuItem value="Monthly">Monthly</MenuItem>
                <MenuItem value="Yearly">Yearly</MenuItem>
              </Select>
            </Box>
          </Box>
          
          {recurrenceType !== 'None' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <TextField
                label="Recurrence End Date"
                type="date"
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={recurrenceEndDate}
                onChange={e => {
                  setRecurrenceEndDate(e.target.value);
                  autoSave.setPendingField('recurrence_end_date', e.target.value);
                }}
                onBlur={() => autoSave.saveField('recurrence_end_date', recurrenceEndDate)}
              />
              {(task.recurring_task_id || task.recurrence_rule) && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <input 
                    type="checkbox" 
                    id="editSeries" 
                    checked={editSeries} 
                    onChange={e => setEditSeries(e.target.checked)} 
                  />
                  <Typography variant="body2" component="label" htmlFor="editSeries">
                    Apply updates to entire future series
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          <Divider />

          <TextField
            label="Description & Notes"
            value={description}
            onChange={e => {
              setDescription(e.target.value);
              autoSave.setPendingField('description', e.target.value);
            }}
            onBlur={() => autoSave.saveField('description', description)}
            fullWidth
            multiline
            rows={6}
            size="small"
            placeholder="Add personal notes, checklists, or details here..."
          />

          {task.created_by_name && (
            <Typography variant="caption" color="text.secondary">
              Created by {task.created_by_name} on {formatDateTime(task.created_at)}
            </Typography>
          )}
          {task.completion_date && (
            <Typography variant="caption" color="text.secondary">
              Completed on {formatStandardDateTime(task.completion_date, task.completion_time)}
            </Typography>
          )}

        </Box>

        {/* Footer */}
        <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'flex-end', gap: 1, bgcolor: 'background.default' }}>
          <Button onClick={handleClose} variant="outlined" color="inherit">Close</Button>
        </Box>
      </Box>
    </Drawer>
  );
}
