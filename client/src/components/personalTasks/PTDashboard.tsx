import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Alert,
  AlertTitle,
  Paper,
  Button,
  Chip,
  useTheme,
} from '@mui/material';
import {
  Sun,
  AlertTriangle,
  Clock,
  CheckCircle2,
  AlertCircle,
  CalendarCheck,
  ShieldAlert,
} from 'lucide-react';
import KpiCard from '@/components/ui/KpiCard';
import PTTaskTable from './PTTaskTable';
import { PTTask, MyDaySummary, PTTaskUpdate } from '@/api/personalTasksApi';

interface PTDashboardProps {
  summary: MyDaySummary | undefined;
  isLoading: boolean;
  activeTimerTaskId?: number | null;
  onOpenTask: (task: PTTask) => void;
  onToggleComplete: (task: PTTask) => void;
  onStartTimer: (taskId: number) => void;
  onStopTimer: (taskId: number) => void;
  onCancelTask: (task: PTTask) => void;
  onReopenTask: (taskId: number) => void;
  onArchiveTask: (taskId: number) => void;
  onDeleteTask: (taskId: number) => void;
  onUpdateTask?: (id: number, data: Partial<PTTaskUpdate>) => Promise<void> | void;
}

export default function PTDashboard({
  summary,
  isLoading,
  activeTimerTaskId,
  onOpenTask,
  onToggleComplete,
  onStartTimer,
  onStopTimer,
  onCancelTask,
  onReopenTask,
  onArchiveTask,
  onDeleteTask,
  onUpdateTask,
}: PTDashboardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const todayTasks = summary?.today_tasks || [];
  const overdueTasks = summary?.overdue_tasks || [];
  const todayEst = summary?.today_total_estimated_hours || 0;
  const todayAct = summary?.today_actual_hours || 0;
  const todayRem = summary?.today_remaining_hours || 0;
  const overdueCount = overdueTasks.length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* KPI Metric Cards */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            icon={<Sun size={22} />}
            iconBg="rgba(245, 158, 11, 0.12)"
            iconColor="#F59E0B"
            label="Due Today"
            value={todayTasks.length}
            sub={`${todayEst} hrs planned`}
            subTone="muted"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            icon={<AlertTriangle size={22} />}
            iconBg="rgba(239, 68, 68, 0.12)"
            iconColor="#EF4444"
            label="Overdue Tasks"
            value={overdueCount}
            sub={overdueCount > 0 ? "Requires resolution" : "All on schedule"}
            subTone={overdueCount > 0 ? "muted" : "up"}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            icon={<Clock size={22} />}
            iconBg="rgba(59, 130, 246, 0.12)"
            iconColor="#3B82F6"
            label="Remaining Effort"
            value={`${todayRem}h`}
            sub="Effort remaining today"
            subTone="muted"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            icon={<CheckCircle2 size={22} />}
            iconBg="rgba(22, 196, 127, 0.12)"
            iconColor="#16C47F"
            label="Logged Today"
            value={`${todayAct}h`}
            sub={`${summary?.today_completed_count || 0} tasks completed`}
            subTone="up"
          />
        </Grid>
      </Grid>

      {/* Overdue Warning Callout (Overdue tasks stay visible until resolved per rule 9) */}
      {overdueCount > 0 && (
        <Alert
          severity="error"
          icon={<ShieldAlert size={20} />}
          sx={{
            borderRadius: 2,
            border: '1px solid rgba(239, 68, 68, 0.3)',
            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)',
          }}
        >
          <AlertTitle sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
            {overdueCount} Overdue Task{overdueCount > 1 ? 's' : ''} Require Immediate Attention
          </AlertTitle>
          Per scheduling rules, overdue tasks remain visible in your planner until completed, rescheduled, or cancelled.
        </Alert>
      )}

      {/* Overdue Section */}
      {overdueCount > 0 && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AlertTriangle size={18} color="#EF4444" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#EF4444' }}>
                Overdue Tasks ({overdueCount})
              </Typography>
            </Box>
          </Box>
          <PTTaskTable
            tasks={overdueTasks}
            isLoading={isLoading}
            activeTimerTaskId={activeTimerTaskId}
            onOpenTask={onOpenTask}
            onToggleComplete={onToggleComplete}
            onStartTimer={onStartTimer}
            onStopTimer={onStopTimer}
            onCancelTask={onCancelTask}
            onReopenTask={onReopenTask}
            onArchiveTask={onArchiveTask}
            onDeleteTask={onDeleteTask}
            onUpdateTask={onUpdateTask}
          />
        </Box>
      )}

      {/* Today's Tasks Section */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Sun size={18} color={isDark ? '#16C47F' : '#203020'} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Today's Agenda ({todayTasks.length})
            </Typography>
          </Box>
        </Box>
        <PTTaskTable
          tasks={todayTasks}
          isLoading={isLoading}
          emptyTitle="Your Day is Clear"
          emptyHint="No tasks scheduled for today. Use Quick Capture above to add a task!"
          activeTimerTaskId={activeTimerTaskId}
          onOpenTask={onOpenTask}
          onToggleComplete={onToggleComplete}
          onStartTimer={onStartTimer}
          onStopTimer={onStopTimer}
          onCancelTask={onCancelTask}
          onReopenTask={onReopenTask}
          onArchiveTask={onArchiveTask}
          onDeleteTask={onDeleteTask}
        />
      </Box>
    </Box>
  );
}
