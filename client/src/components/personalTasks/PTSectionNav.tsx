import React, { useState } from 'react';
import {
  Box,
  Typography,
  Badge,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme,
} from '@mui/material';
import {
  Sun,
  CalendarDays,
  ListTodo,
  AlertTriangle,
  CheckCircle2,
  LayoutGrid,
  Calendar,
  BarChart3,
  BarChart2,
  CalendarCheck,
  Clock,
  Activity,
  Archive,
  Settings2,
  Download,
  MoreVertical,
  CalendarRange,
} from 'lucide-react';

export type PTSection =
  | 'my-day'
  | 'upcoming'
  | 'all-tasks'
  | 'overdue'
  | 'completed'
  | 'kanban'
  | 'calendar'
  | 'workload'
  | 'weekly-workload'
  | 'weekly-review'
  | 'time-reports'
  | 'activity'
  | 'archive';

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

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

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
        width: '100%',
        flexShrink: 0,
        backgroundColor: isDark ? '#141A1F' : '#FFFFFF',
        borderBottom: '1px solid',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        px: 0,
        boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.03)',
        zIndex: 5,
      }}
    >
      {/* Scrollable Horizontal Tabs Container */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          flex: 1,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <Box
              key={item.id}
              onClick={() => onSelectSection(item.id)}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              sx={{
                flex: '1 1 0px',
                minWidth: { xs: 68, sm: 72 },
                py: 1.25,
                px: { xs: 0.5, sm: 1 },
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                position: 'relative',
                transition: 'all 0.15s ease',
                backgroundColor: isActive
                  ? isDark
                    ? 'rgba(22, 196, 127, 0.15)'
                    : '#E9FBF3'
                  : 'transparent',
                color: isActive
                  ? '#16C47F'
                  : isDark
                  ? '#94A3B8'
                  : '#64748B',
                '&:hover': {
                  backgroundColor: isActive
                    ? isDark
                      ? 'rgba(22, 196, 127, 0.2)'
                      : '#DEF7EC'
                    : isDark
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(0,0,0,0.03)',
                  color: isActive ? '#16C47F' : isDark ? '#E2E8F0' : '#1E293B',
                },
                ...(isActive && {
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    backgroundColor: '#16C47F',
                    borderRadius: '2px 2px 0 0',
                  },
                }),
              }}
            >
              {item.badge !== undefined && item.badge > 0 ? (
                <Badge
                  badgeContent={item.badge}
                  color={item.badgeColor || 'primary'}
                  sx={{
                    '& .MuiBadge-badge': {
                      fontSize: '0.62rem',
                      height: 15,
                      minWidth: 15,
                      px: 0.4,
                      fontWeight: 700,
                      top: -2,
                      right: -6,
                    },
                  }}
                >
                  <Icon size={19} />
                </Badge>
              ) : (
                <Icon size={19} />
              )}
              <Typography
                variant="caption"
                sx={{
                  mt: 0.5,
                  fontSize: '0.72rem',
                  fontWeight: isActive ? 600 : 500,
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2,
                  textAlign: 'center',
                  color: 'inherit',
                }}
              >
                {item.label}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* Right-aligned Actions: Settings & Export */}
      <Box sx={{ display: 'flex', alignItems: 'center', pl: 1, gap: 0.5, flexShrink: 0 }}>
        <Divider orientation="vertical" flexItem sx={{ my: 1.5, mx: 0.5 }} />

        <Tooltip title="Planner Settings">
          <IconButton
            size="small"
            onClick={onOpenSettings}
            sx={{
              color: isDark ? '#94A3B8' : '#64748B',
              '&:hover': {
                color: isDark ? '#E2E8F0' : '#1E293B',
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              },
            }}
          >
            <Settings2 size={18} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Export & Sync">
          <IconButton
            size="small"
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            sx={{
              color: isDark ? '#94A3B8' : '#64748B',
              '&:hover': {
                color: isDark ? '#E2E8F0' : '#1E293B',
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              },
            }}
          >
            <MoreVertical size={18} />
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onExportCsv();
            }}
          >
            <ListItemIcon>
              <Download size={16} />
            </ListItemIcon>
            <ListItemText primary="Export Tasks (CSV)" primaryTypographyProps={{ fontSize: '0.82rem' }} />
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onExportIcs();
            }}
          >
            <ListItemIcon>
              <CalendarRange size={16} />
            </ListItemIcon>
            <ListItemText primary="Sync Calendar (iCal)" primaryTypographyProps={{ fontSize: '0.82rem' }} />
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}
