import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  Grid,
  useTheme,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Plus,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
} from 'date-fns';
import { PTTask } from '@/api/personalTasksApi';

interface PTCalendarViewProps {
  tasks: PTTask[];
  onOpenTask: (task: PTTask) => void;
  onQuickAddDate?: (dateStr: string) => void;
}

export default function PTCalendarView({
  tasks,
  onOpenTask,
  onQuickAddDate,
}: PTCalendarViewProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'URGENT':
        return '#EF4444';
      case 'HIGH':
        return '#F97316';
      case 'NORMAL':
        return '#3B82F6';
      default:
        return '#64748B';
    }
  };

  const getTasksForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return tasks.filter((t) => {
      const targetDate = t.planned_date ? t.planned_date.split('T')[0] : t.due_date ? t.due_date.split('T')[0] : null;
      return targetDate === dayStr;
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Month Navigation Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CalendarIcon size={20} color={isDark ? '#16C47F' : '#203020'} />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {format(currentMonth, 'MMMM yyyy')}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setCurrentMonth(new Date())}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            Today
          </Button>
          <IconButton size="small" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft size={18} />
          </IconButton>
          <IconButton size="small" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight size={18} />
          </IconButton>
        </Box>
      </Box>

      {/* Calendar Grid */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          backgroundColor: isDark ? '#181D22' : '#FFFFFF',
          overflow: 'hidden',
        }}
      >
        {/* Days of Week Header */}
        <Grid
          container
          sx={{
            borderBottom: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            backgroundColor: isDark ? '#14181C' : '#F8FAF8',
            py: 1,
          }}
        >
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName) => (
            <Grid item xs={12 / 7} key={dayName} sx={{ textAlign: 'center' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B' }}>
                {dayName}
              </Typography>
            </Grid>
          ))}
        </Grid>

        {/* Days Cells */}
        <Grid container>
          {days.map((day) => {
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isTodayDate = isSameDay(day, new Date());
            const dayTasks = getTasksForDay(day);

            return (
              <Grid
                item
                xs={12 / 7}
                key={day.toISOString()}
                sx={{
                  minHeight: 110,
                  p: 1,
                  borderRight: '1px solid',
                  borderBottom: '1px solid',
                  borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  backgroundColor: !isCurrentMonth
                    ? isDark
                      ? 'rgba(0,0,0,0.2)'
                      : 'rgba(0,0,0,0.02)'
                    : isTodayDate
                    ? isDark
                      ? 'rgba(22, 196, 127, 0.05)'
                      : 'rgba(22, 196, 127, 0.03)'
                    : 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: isTodayDate ? 800 : 600,
                      color: isTodayDate
                        ? '#16C47F'
                        : !isCurrentMonth
                        ? '#94A3B8'
                        : 'inherit',
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isTodayDate ? (isDark ? '#16C47F25' : '#16C47F20') : 'transparent',
                    }}
                  >
                    {format(day, 'd')}
                  </Typography>

                  {dayTasks.length > 0 && (
                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 600 }}>
                      {dayTasks.length} task{dayTasks.length > 1 ? 's' : ''}
                    </Typography>
                  )}
                </Box>

                {/* Day Tasks List */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1 }}>
                  {dayTasks.slice(0, 3).map((t) => (
                    <Paper
                      key={t.id}
                      elevation={0}
                      onClick={() => onOpenTask(t)}
                      sx={{
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 1,
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        borderLeft: `3px solid ${getPriorityColor(t.priority)}`,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                        textDecoration: t.is_completed ? 'line-through' : 'none',
                        opacity: t.is_completed ? 0.6 : 1,
                        '&:hover': {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
                        },
                      }}
                    >
                      {t.title}
                    </Paper>
                  ))}
                  {dayTasks.length > 3 && (
                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#64748B', textAlign: 'center' }}>
                      +{dayTasks.length - 3} more
                    </Typography>
                  )}
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </Paper>
    </Box>
  );
}
