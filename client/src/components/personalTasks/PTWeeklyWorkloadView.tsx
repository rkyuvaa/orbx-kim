import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  LinearProgress,
  useTheme,
} from '@mui/material';
import { Calendar, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { WorkloadSummary, PTTask } from '@/api/personalTasksApi';

interface PTWeeklyWorkloadViewProps {
  workload: WorkloadSummary | undefined;
  isLoading: boolean;
  onOpenTask: (task: PTTask) => void;
}

export default function PTWeeklyWorkloadView({
  workload,
  isLoading,
  onOpenTask,
}: PTWeeklyWorkloadViewProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (isLoading || !workload) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: '#94A3B8' }}>Loading weekly workload breakdown...</Typography>
      </Box>
    );
  }

  const { daily_breakdown, week_available_hours, week_planned_hours, utilization_pct } = workload;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Weekly Workload Distribution
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748B' }}>
          Total Capacity: {week_available_hours}h | Planned Effort: {week_planned_hours}h | Utilization: {utilization_pct}%
        </Typography>
      </Box>

      {/* Days Grid */}
      <Grid container spacing={2}>
        {daily_breakdown.map((day) => {
          const isOverloaded = day.remaining_hours > day.available_hours && day.available_hours > 0;
          const pct = day.available_hours > 0 ? Math.round((day.remaining_hours / day.available_hours) * 100) : 0;

          return (
            <Grid item xs={12} md={6} lg={4} key={day.date}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 2.5,
                  border: '1px solid',
                  borderColor: isOverloaded
                    ? '#EF4444'
                    : isDark
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(0,0,0,0.06)',
                  backgroundColor: isDark ? '#181D22' : '#FFFFFF',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      {day.day_name} ({day.date})
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748B' }}>
                      {day.is_working_day ? 'Working Day' : 'Weekend'} {day.is_holiday ? '• Holiday' : ''}
                    </Typography>
                  </Box>

                  <Chip
                    label={`${day.remaining_hours}h / ${day.available_hours}h`}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      backgroundColor: isOverloaded ? 'rgba(239, 68, 68, 0.15)' : 'rgba(22, 196, 127, 0.15)',
                      color: isOverloaded ? '#EF4444' : '#16C47F',
                    }}
                  />
                </Box>

                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, pct)}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: isOverloaded ? '#EF4444' : pct > 80 ? '#F97316' : '#16C47F',
                    },
                  }}
                />

                {/* Day's Tasks */}
                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {day.tasks.length === 0 ? (
                    <Typography variant="caption" sx={{ color: '#94A3B8', fontStyle: 'italic', py: 1 }}>
                      No tasks allocated to this day.
                    </Typography>
                  ) : (
                    day.tasks.map((t) => (
                      <Paper
                        key={t.id}
                        elevation={0}
                        onClick={() => onOpenTask(t)}
                        sx={{
                          p: 1,
                          borderRadius: 1.5,
                          border: '1px solid',
                          borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                          backgroundColor: isDark ? '#14181C' : '#F8FAF8',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          '&:hover': {
                            borderColor: isDark ? '#16C47F' : '#203020',
                          },
                        }}
                      >
                        <Box sx={{ minWidth: 0, flex: 1, pr: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              fontSize: '0.8rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {t.title}
                          </Typography>
                        </Box>
                        <Chip
                          label={`${t.estimated_hours}h`}
                          size="small"
                          sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                        />
                      </Paper>
                    ))
                  )}
                </Box>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
