import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  useTheme,
} from '@mui/material';
import { History, User, Bot, Clock, Sparkles } from 'lucide-react';
import { PTActivityInfo } from '@/api/personalTasksApi';
import { formatStandardDateTime } from '@/utils/format';

interface PTAuditLogProps {
  activities: PTActivityInfo[];
  isLoading?: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  CREATED: 'Created',
  UPDATED: 'Updated',
  ASSIGNED: 'Assigned',
  ASSIGNMENT_CHANGED: 'Reassigned',
  PROGRESS_UPDATED: 'Progress Updated',
  COMPLETED: 'Completed',
  REOPENED: 'Reopened',
  STATUS_CHANGED: 'Status Changed',
  DELETED: 'Deleted',
  ARCHIVED: 'Archived',
  RESTORED: 'Restored',
  CANCELLED: 'Cancelled',
  TIMER_STARTED: 'Timer Started',
  TIMER_STOPPED: 'Timer Stopped',
  TIME_LOGGED: 'Manual Time Logged',
  REMINDER_SCHEDULED: 'Reminder Scheduled',
  REMINDER_DELETED: 'Reminder Removed',
  REMINDER_SNOOZED: 'Reminder Snoozed',
  LOG_NOTE_ADDED: 'Log Note Added',
};

const FIELD_LABELS: Record<string, string> = {
  assignee_id: 'Assignee',
  progress_percentage: 'Progress',
  status_id: 'Status',
  due_date: 'Due Date',
  cancellation_reason: 'Cancellation Reason',
  log_note: 'Log Note',
  title: 'Title',
  priority: 'Priority',
};

function formatAction(action: string): string {
  return ACTION_LABELS[action] || action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatField(field: string): string {
  return FIELD_LABELS[field] || field.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PTAuditLog({ activities, isLoading }: PTAuditLogProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const getSourceIcon = (source?: string) => {
    switch (source) {
      case 'system':
      case 'recurrence':
        return <Bot size={13} />;
      case 'reminder-engine':
        return <Clock size={13} />;
      case 'workload-adjustment':
        return <Sparkles size={13} />;
      default:
        return <User size={13} />;
    }
  };

  const getSourceColor = (source?: string) => {
    switch (source) {
      case 'system':
        return '#64748B';
      case 'recurrence':
        return '#8B5CF6';
      case 'reminder-engine':
        return '#3B82F6';
      case 'workload-adjustment':
        return '#F59E0B';
      default:
        return '#16C47F';
    }
  };

  if (!isLoading && activities.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: '#94A3B8', py: 4, textAlign: 'center' }}>
        No audit activity recorded yet.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <History size={16} color={isDark ? '#16C47F' : '#203020'} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Audit Trail ({activities.length} Events)
        </Typography>
      </Box>

      {activities.map((act) => {
        const source = act.source || 'user';
        const sourceColor = getSourceColor(source);

        return (
          <Paper
            key={act.id}
            elevation={0}
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              backgroundColor: isDark ? '#181D22' : '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              gap: 0.75,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={formatAction(act.action)}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                  }}
                />
                <Chip
                  icon={getSourceIcon(source)}
                  label={source}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: sourceColor,
                    borderColor: `${sourceColor}40`,
                  }}
                  variant="outlined"
                />
              </Box>

              <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.72rem' }}>
                {formatStandardDateTime(act.created_at)}
              </Typography>
            </Box>

            {act.field_name && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.8rem' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748B' }}>
                  {formatField(act.field_name)}:
                </Typography>
                {act.old_value && (
                  <Typography variant="caption" sx={{ color: '#EF4444', textDecoration: 'line-through' }}>
                    {act.old_value}
                  </Typography>
                )}
                {act.old_value && act.new_value && <span>→</span>}
                {act.new_value && (
                  <Typography variant="caption" sx={{ color: '#16C47F', fontWeight: 600 }}>
                    {act.new_value}
                  </Typography>
                )}
              </Box>
            )}

            {!act.field_name && act.new_value && (
              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                {act.new_value}
              </Typography>
            )}
          </Paper>
        );
      })}
    </Box>
  );
}
