import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Button,
  useTheme,
} from '@mui/material';
import { CalendarCheck, CheckCircle2, AlertTriangle, Clock, Sparkles } from 'lucide-react';
import { WeeklyReview, PTTask } from '@/api/personalTasksApi';
import KpiCard from '@/components/ui/KpiCard';
import PTTaskTable from './PTTaskTable';

interface PTWeeklyReviewProps {
  review: WeeklyReview | undefined;
  isLoading: boolean;
  onOpenTask: (task: PTTask) => void;
}

export default function PTWeeklyReview({ review, isLoading, onOpenTask }: PTWeeklyReviewProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (isLoading || !review) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: '#94A3B8' }}>Loading weekly review...</Typography>
      </Box>
    );
  }

  const {
    week_start,
    week_end,
    completed_count,
    completed_tasks,
    slipped_count,
    slipped_tasks,
    total_hours_logged,
    estimate_accuracy_pct,
    hours_by_tag,
    ai_summary_draft,
  } = review;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Weekly Review ({week_start} to {week_end})
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748B' }}>
          Evaluate performance, slipped commitments, and estimation calibration for the past cycle.
        </Typography>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            icon={<CheckCircle2 size={22} />}
            iconBg="rgba(22, 196, 127, 0.12)"
            iconColor="#16C47F"
            label="Completed Work"
            value={completed_count}
            sub="Finished tasks this week"
            subTone="up"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            icon={<AlertTriangle size={22} />}
            iconBg="rgba(239, 68, 68, 0.12)"
            iconColor="#EF4444"
            label="Slipped Tasks"
            value={slipped_count}
            sub="Missed target due date"
            subTone={slipped_count > 0 ? 'muted' : 'up'}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            icon={<Clock size={22} />}
            iconBg="rgba(59, 130, 246, 0.12)"
            iconColor="#3B82F6"
            label="Total Logged"
            value={`${total_hours_logged}h`}
            sub="Focused work time"
            subTone="up"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            icon={<Sparkles size={22} />}
            iconBg="rgba(139, 92, 246, 0.12)"
            iconColor="#8B5CF6"
            label="Estimate Accuracy"
            value={`${estimate_accuracy_pct}%`}
            sub="Effort calibration"
            subTone="up"
          />
        </Grid>
      </Grid>

      {/* AI Summary Draft Box */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: isDark ? 'rgba(22, 196, 127, 0.3)' : 'rgba(32, 48, 32, 0.2)',
          backgroundColor: isDark ? 'rgba(22, 196, 127, 0.05)' : 'rgba(32, 48, 32, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Sparkles size={18} color="#16C47F" />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Automated Weekly Summary Draft
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
          {ai_summary_draft}
        </Typography>
      </Paper>

      {/* Slipped Tasks Section */}
      {slipped_tasks.length > 0 && (
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#EF4444', mb: 1.5 }}>
            Slipped Tasks Requiring Rescheduling ({slipped_tasks.length})
          </Typography>
          <PTTaskTable
            tasks={slipped_tasks}
            onOpenTask={onOpenTask}
            onToggleComplete={() => {}}
            onStartTimer={() => {}}
            onStopTimer={() => {}}
            onCancelTask={() => {}}
            onReopenTask={() => {}}
            onArchiveTask={() => {}}
            onDeleteTask={() => {}}
          />
        </Box>
      )}

      {/* Completed Tasks Section */}
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#16C47F', mb: 1.5 }}>
          Completed Work ({completed_tasks.length})
        </Typography>
        <PTTaskTable
          tasks={completed_tasks}
          onOpenTask={onOpenTask}
          onToggleComplete={() => {}}
          onStartTimer={() => {}}
          onStopTimer={() => {}}
          onCancelTask={() => {}}
          onReopenTask={() => {}}
          onArchiveTask={() => {}}
          onDeleteTask={() => {}}
        />
      </Box>
    </Box>
  );
}
