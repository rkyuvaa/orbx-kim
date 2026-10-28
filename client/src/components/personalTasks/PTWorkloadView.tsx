import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Alert,
  AlertTitle,
  LinearProgress,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
} from '@mui/material';
import {
  BarChart3,
  AlertTriangle,
  Clock,
  Sparkles,
  CheckCircle2,
  Calendar,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { WorkloadSummary, PTTask } from '@/api/personalTasksApi';
import KpiCard from '@/components/ui/KpiCard';
import { formatDate } from '@/utils/format';

interface PTWorkloadViewProps {
  workload: WorkloadSummary | undefined;
  isLoading: boolean;
  onOpenTask: (task: PTTask) => void;
  onApplyPlanSuggestion?: (adjustments: Array<{ taskId: number; newPlannedDate: string }>) => Promise<void>;
}

export default function PTWorkloadView({
  workload,
  isLoading,
  onOpenTask,
  onApplyPlanSuggestion,
}: PTWorkloadViewProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [suggestDialogOpen, setSuggestDialogOpen] = useState(false);

  if (isLoading || !workload) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: '#94A3B8' }}>Loading workload analytics...</Typography>
      </Box>
    );
  }

  const {
    today_estimated_hours,
    today_actual_hours,
    today_remaining_hours,
    week_available_hours,
    week_planned_hours,
    week_remaining_hours,
    utilization_pct,
    is_overloaded,
    overloaded_days,
    tasks_at_risk,
    overdue_count,
    overdue_remaining_hours,
    daily_breakdown,
    estimated_vs_actual,
  } = workload;

  // Generate Plan Suggestion (Spreads remaining effort across upcoming working days without auto-applying)
  const suggestedPlan = tasks_at_risk.map((riskTask, index) => {
    // Pick the earliest available non-overloaded working day
    const availableDay = daily_breakdown.find((d) => d.is_working_day && d.remaining_hours < d.available_hours);
    const targetDate = availableDay ? availableDay.date : daily_breakdown[Math.min(index, daily_breakdown.length - 1)]?.date;
    return {
      taskId: riskTask.id,
      title: riskTask.title,
      currentDue: riskTask.due_date,
      suggestedPlannedDate: targetDate,
      remainingHours: riskTask.remaining_hours,
    };
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Top Header & Suggest a Plan CTA */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Workload & Capacity Management
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748B' }}>
            Realistic effort planning respecting working hours, configured days, and holiday schedules.
          </Typography>
        </Box>

        <Button
          variant="outlined"
          startIcon={<Sparkles size={16} />}
          onClick={() => setSuggestDialogOpen(true)}
          disabled={tasks_at_risk.length === 0}
          sx={{
            textTransform: 'none',
            borderRadius: 2,
            fontWeight: 600,
            borderColor: isDark ? '#16C47F' : '#203020',
            color: isDark ? '#16C47F' : '#203020',
          }}
        >
          Suggest Balanced Plan
        </Button>
      </Box>

      {/* Over-capacity warning banner (Informational only per rule 12) */}
      {is_overloaded && (
        <Alert
          severity="warning"
          icon={<ShieldAlert size={20} />}
          sx={{
            borderRadius: 2,
            border: '1px solid rgba(245, 158, 11, 0.4)',
            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.05)',
          }}
        >
          <AlertTitle sx={{ fontWeight: 700 }}>Over-Capacity Notice ({utilization_pct}% Load)</AlertTitle>
          Planned workload exceeds available capacity for the period. System warnings are purely informational; dates will never change automatically.
        </Alert>
      )}

      {/* KPI Cards Strip */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            icon={<BarChart3 size={22} />}
            iconBg="rgba(22, 196, 127, 0.12)"
            iconColor="#16C47F"
            label="Weekly Utilization"
            value={`${utilization_pct}%`}
            sub={`${week_planned_hours}h of ${week_available_hours}h`}
            subTone={utilization_pct > 100 ? 'muted' : 'up'}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            icon={<Clock size={22} />}
            iconBg="rgba(59, 130, 246, 0.12)"
            iconColor="#3B82F6"
            label="Remaining Effort"
            value={`${week_remaining_hours}h`}
            sub="Active tasks load"
            subTone="muted"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            icon={<AlertTriangle size={22} />}
            iconBg="rgba(239, 68, 68, 0.12)"
            iconColor="#EF4444"
            label="Tasks at Risk"
            value={tasks_at_risk.length}
            sub={`${overdue_count} overdue`}
            subTone="muted"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            icon={<CheckCircle2 size={22} />}
            iconBg="rgba(139, 92, 246, 0.12)"
            iconColor="#8B5CF6"
            label="Est. vs Actual"
            value={`${estimated_vs_actual.actual}h`}
            sub={`of ${estimated_vs_actual.estimated}h planned total`}
            subTone="up"
          />
        </Grid>
      </Grid>

      {/* Daily Capacity & Distribution Bars */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          backgroundColor: isDark ? '#181D22' : '#FFFFFF',
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
          7-Day Capacity & Workload Allocation
        </Typography>

        <Grid container spacing={2}>
          {daily_breakdown.map((day) => {
            const isDayOverloaded = day.remaining_hours > day.available_hours && day.available_hours > 0;
            const dayLoadPct = day.available_hours > 0 ? Math.round((day.remaining_hours / day.available_hours) * 100) : 0;

            return (
              <Grid item xs={12} sm={6} md={1.71} key={day.date}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: isDayOverloaded
                      ? '#EF4444'
                      : isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.08)',
                    backgroundColor: isDayOverloaded
                      ? isDark
                        ? 'rgba(239, 68, 68, 0.08)'
                        : 'rgba(239, 68, 68, 0.04)'
                      : isDark
                      ? '#14181C'
                      : '#F8FAF8',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ fontWeight: 800 }}>
                      {day.day_name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.68rem' }}>
                      {day.date.substring(5)}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: isDayOverloaded ? '#EF4444' : 'inherit' }}>
                      {day.remaining_hours}h
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>
                      Capacity: {day.available_hours}h
                    </Typography>
                  </Box>

                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, dayLoadPct)}
                    sx={{
                      height: 5,
                      borderRadius: 2.5,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: isDayOverloaded ? '#EF4444' : dayLoadPct > 80 ? '#F97316' : '#16C47F',
                      },
                    }}
                  />

                  <Typography variant="caption" sx={{ fontSize: '0.68rem', color: '#94A3B8', textAlign: 'center' }}>
                    {day.tasks_count} task{day.tasks_count !== 1 ? 's' : ''}
                  </Typography>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      {/* Tasks at Risk Table */}
      {tasks_at_risk.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'rgba(239, 68, 68, 0.25)',
            backgroundColor: isDark ? '#181D22' : '#FFFFFF',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AlertTriangle size={18} color="#EF4444" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#EF4444' }}>
              Tasks at Risk of Slipping ({tasks_at_risk.length})
            </Typography>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Task</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Remaining Effort</TableCell>
                  <TableCell>Risk Reason</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tasks_at_risk.map((t) => (
                  <TableRow key={t.id} hover sx={{ cursor: 'pointer' }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={t.task_number} size="small" sx={{ fontWeight: 700, height: 20 }} />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.title}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={t.priority} size="small" sx={{ height: 20, fontSize: '0.68rem' }} />
                    </TableCell>
                    <TableCell>{t.due_date ? formatDate(t.due_date) : 'No due date'}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{t.remaining_hours}h</TableCell>
                    <TableCell sx={{ color: '#EF4444', fontSize: '0.8rem', fontWeight: 500 }}>
                      {t.risk_reason}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Suggest a Balanced Plan Dialog (User accepts, edits or rejects - NEVER auto-applied) */}
      <Dialog open={suggestDialogOpen} onClose={() => setSuggestDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Sparkles size={20} color="#16C47F" />
          Proposed Balanced Plan
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            The system suggests spreading remaining effort across upcoming working days with available capacity.
            Review the suggestions below. You can accept, modify, or reject this recommendation:
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {suggestedPlan.map((s) => (
              <Paper
                key={s.taskId}
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid rgba(0,0,0,0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{s.title}</Typography>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>
                    Remaining: {s.remainingHours}h • Due: {s.currentDue ? formatDate(s.currentDue) : 'None'}
                  </Typography>
                </Box>
                <Chip
                  label={`Planned for: ${s.suggestedPlannedDate || 'TBD'}`}
                  color="primary"
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              </Paper>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuggestDialogOpen(false)}>Reject</Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (onApplyPlanSuggestion) {
                await onApplyPlanSuggestion(
                  suggestedPlan.map((s) => ({
                    taskId: s.taskId,
                    newPlannedDate: s.suggestedPlannedDate || '',
                  }))
                );
              }
              setSuggestDialogOpen(false);
            }}
            sx={{
              backgroundColor: isDark ? '#16C47F' : '#203020',
              color: isDark ? '#000000' : '#FFFFFF',
              fontWeight: 600,
            }}
          >
            Accept & Apply Plan
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
