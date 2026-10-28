import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  useTheme,
} from '@mui/material';
import { Activity, Clock, User, Bot, Sparkles } from 'lucide-react';
import { PTActivityInfo } from '@/api/personalTasksApi';
import { formatStandardDateTime } from '@/utils/format';

interface PTActivityTimelineProps {
  activities: PTActivityInfo[];
  isLoading: boolean;
}

export default function PTActivityTimeline({ activities, isLoading }: PTActivityTimelineProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!isLoading && activities.length === 0) {
    return (
      <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 2.5 }}>
        <Typography variant="body1" sx={{ color: '#94A3B8' }}>No activity records found.</Typography>
      </Paper>
    );
  }

  const getSourceColor = (source?: string) => {
    switch (source) {
      case 'system':
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Activity Timeline
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748B' }}>
          Append-only historical audit trail across all personal tasks and system actions.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {activities.map((act) => {
          const source = act.source || 'user';
          const color = getSourceColor(source);

          return (
            <Paper
              key={act.id}
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                backgroundColor: isDark ? '#181D22' : '#FFFFFF',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip
                  label={act.action}
                  size="small"
                  sx={{ fontWeight: 700, minWidth: 100, height: 24, fontSize: '0.72rem' }}
                />

                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {act.new_value || act.action}
                  </Typography>
                  {act.field_name && (
                    <Typography variant="caption" sx={{ color: '#64748B' }}>
                      Field: {act.field_name} {act.old_value ? `(was "${act.old_value}")` : ''}
                    </Typography>
                  )}
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Chip
                  label={source}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    color: color,
                    borderColor: `${color}40`,
                  }}
                  variant="outlined"
                />
                <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.75rem' }}>
                  {formatStandardDateTime(act.created_at)}
                </Typography>
              </Box>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}
