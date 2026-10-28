import React from 'react';
import {
  Box,
  Typography,
  Badge,
  Divider,
  Button,
  useTheme,
} from '@mui/material';
import {
  Sun,
  CalendarDays,
  ListTodo,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  BarChart2,
  Calendar,
  LayoutGrid,
  Activity,
  Clock,
  Archive,
  Settings2,
  Download,
  CalendarCheck,
} from 'lucide-react';

export type PTSection =
  | 'my-day'
  | 'upcoming'
  | 'all-tasks'
  | 'overdue'
  | 'completed'
  | 'workload'
  | 'weekly-workload'
  | 'calendar'
  | 'kanban'
  | 'activity'
  | 'time-reports'
  | 'archive'
  | 'weekly-review';

interface PTSectionNavProps {
  activeSection: PTSection;
  onSelectSection: (section: PTSection) => void;
  overdueCount?: number;
  todayCount?: number;
  onOpenSettings: () => void;
  onExportCsv: () => void;
  onExportIcs: () => void;
}

export default function PTSectionNav({
  activeSection,
  onSelectSection,
  overdueCount = 0,
  todayCount = 0,
  onOpenSettings,
  onExportCsv,
  onExportIcs,
}: PTSectionNavProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const navItems: Array<{
    id: PTSection;
    label: string;
    icon: React.ElementType;
    badge?: number;
    badgeColor?: 'error' | 'primary' | 'warning';
  }> = [
    { id: 'my-day', label: 'My Day', icon: Sun, badge: todayCount, badgeColor: 'primary' },
    { id: 'upcoming', label: 'Upcoming', icon: CalendarDays },
    { id: 'all-tasks', label: 'All Tasks', icon: ListTodo },
    { id: 'overdue', label: 'Overdue', icon: AlertTriangle, badge: overdueCount, badgeColor: 'error' },
    { id: 'completed', label: 'Completed', icon: CheckCircle2 },
    { id: 'kanban', label: 'Kanban Board', icon: LayoutGrid },
    { id: 'calendar', label: 'Calendar View', icon: Calendar },
    { id: 'workload', label: 'Workload Overview', icon: BarChart3 },
    { id: 'weekly-workload', label: 'Weekly Workload', icon: BarChart2 },
    { id: 'weekly-review', label: 'Weekly Review', icon: CalendarCheck },
    { id: 'time-reports', label: 'Time Reports', icon: Clock },
    { id: 'activity', label: 'Activity Timeline', icon: Activity },
    { id: 'archive', label: 'Archive', icon: Archive },
  ];

  return (
    <Box
      sx={{
        width: 240,
        flexShrink: 0,
        borderRight: '1px solid',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: isDark ? 'transparent' : '#FAFBF9',
      }}
    >
      <Box>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: isDark ? '#94A3B8' : '#64748B',
            px: 1.5,
            mb: 1,
            display: 'block',
          }}
        >
          Planner Views
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <Box
                key={item.id}
                onClick={() => onSelectSection(item.id)}
                role="button"
                tabIndex={0}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 1.5,
                  py: 1,
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  backgroundColor: isActive
                    ? isDark
                      ? '#16C47F20'
                      : '#203020'
                    : 'transparent',
                  color: isActive
                    ? isDark
                      ? '#16C47F'
                      : '#FFFFFF'
                    : isDark
                    ? '#CBD5E1'
                    : '#334155',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.875rem',
                  '&:hover': {
                    backgroundColor: isActive
                      ? isDark
                        ? '#16C47F25'
                        : '#2A402A'
                      : isDark
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(0,0,0,0.04)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Box>
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge
                    badgeContent={item.badge}
                    color={item.badgeColor || 'primary'}
                    sx={{
                      '& .MuiBadge-badge': {
                        fontSize: '0.72rem',
                        height: 18,
                        minWidth: 18,
                        fontWeight: 700,
                      },
                    }}
                  />
                )}
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Bottom Actions */}
      <Box sx={{ pt: 2 }}>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Settings2 size={16} />}
            onClick={onOpenSettings}
            sx={{
              justifyContent: 'flex-start',
              textTransform: 'none',
              fontSize: '0.8rem',
              borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
              color: isDark ? '#E2E8F0' : '#475569',
            }}
          >
            Planner Settings
          </Button>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="text"
              startIcon={<Download size={14} />}
              onClick={onExportCsv}
              sx={{
                flex: 1,
                textTransform: 'none',
                fontSize: '0.75rem',
                color: isDark ? '#94A3B8' : '#64748B',
                py: 0.5,
              }}
            >
              Export CSV
            </Button>
            <Button
              size="small"
              variant="text"
              startIcon={<Calendar size={14} />}
              onClick={onExportIcs}
              sx={{
                flex: 1,
                textTransform: 'none',
                fontSize: '0.75rem',
                color: isDark ? '#94A3B8' : '#64748B',
                py: 0.5,
              }}
            >
              Sync iCal
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
