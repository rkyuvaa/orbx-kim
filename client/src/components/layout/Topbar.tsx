import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Divider, IconButton, Menu, MenuItem, Tooltip, useMediaQuery } from '@mui/material';
import { Bell, ChevronDown, ChevronRight, LogOut, Menu as MenuIcon, User as UserIcon, Sun, Moon } from 'lucide-react';

import { useAppSelector } from '@/app/hooks';
import { useDashboardQuery } from '@/api/dashboardApi';
import { useLogoutMutation } from '@/api/authApi';
import { initialsOf } from '@/utils/format';
import { logout } from '@/auth/authSlice';
import { useAppDispatch } from '@/app/hooks';
import { useThemeMode } from '@/context/ThemeModeContext';

const BREADCRUMBS: Record<string, [string, string]> = {
  '/': ['Dashboard', 'Overview'],
  '/leads': ['CRM', 'Leads'],
  '/opportunities': ['CRM', 'Opportunities'],
  '/projects': ['Projects', 'All Projects'],
  '/tasks': ['Task', 'All Tasks'],
  '/my-tasks': ['Project & Task', 'My Task'],
  '/plm': ['PLM', 'Product Lifecycle Management'],
  '/applications': ['Applications', 'All Applications'],
  '/documents': ['Documents', 'Upload & Manage'],
  '/verification': ['Verification', 'Pending Review'],
  '/finance': ['Finance', 'Finance Processing'],
  '/sanction': ['Sanction', 'Sanction Details'],
  '/delivery': ['Delivery', 'Vehicle Delivery'],
  '/disbursement': ['Disbursement', 'UTR Entry'],
  '/reports': ['Reports', 'Analytics & Reports'],
  '/notifications': ['Notifications', 'Inbox'],
  '/settings': ['Settings', 'System Settings'],
};

interface TopbarProps {
  onToggleSidebar: () => void;
  isMobile?: boolean;
  isSidebarCollapsed?: boolean;
}

export default function Topbar({ onToggleSidebar, isMobile, isSidebarCollapsed }: TopbarProps) {
  const { mode, toggleThemeMode } = useThemeMode();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { data: dashboard } = useDashboardQuery();
  const [doLogout] = useLogoutMutation();

  const isScreenMobile = useMediaQuery('(max-width:1024px)');
  const isEffectiveMobile = isMobile !== undefined ? isMobile : isScreenMobile;
  const isSmallMobile = useMediaQuery('(max-width:600px)');
  const isTablet = useMediaQuery('(max-width:900px)');

  const crumb = BREADCRUMBS[location.pathname] ?? BREADCRUMBS[`/${location.pathname.split('/')[1]}`] ?? [
    'KIM ERP',
    'Version 2.0',
  ];
  const unread = dashboard?.nav_counts.notifications ?? 0;

  const handleLogout = async () => {
    setAnchorEl(null);
    try {
      await doLogout();
    } catch {
      // cookie may already be gone
    }
    try {
      localStorage.setItem('kim_erp_logout_event', Date.now().toString());
    } catch {
      // storage unavailable
    }
    dispatch(logout());
    navigate('/login', { replace: true });
  };

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        height: isSmallMobile ? 52 : 58,
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: mode === 'dark' ? '#15191E' : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: mode === 'dark' ? '1px solid #262E36' : '1px solid #E2E8E2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: isSmallMobile ? 8 : 14,
        paddingLeft: isSmallMobile ? 'max(10px, env(safe-area-inset-left, 0px))' : 'max(20px, env(safe-area-inset-left, 0px))',
        paddingRight: isSmallMobile ? 'max(10px, env(safe-area-inset-right, 0px))' : 'max(20px, env(safe-area-inset-right, 0px))',
        flexShrink: 0,
        transition: 'background-color 0.18s ease, border-color 0.18s ease',
      }}
    >
      {/* Navigation toggle button: Drawer toggle on mobile/tablet only (hidden on desktop to avoid duplicate toggle) */}
      {isEffectiveMobile && (
        <Tooltip title="Toggle Navigation Menu" arrow>
          <IconButton
            onClick={onToggleSidebar}
            aria-label="Toggle navigation drawer"
            sx={{
              border: mode === 'dark' ? '1px solid #262E36' : '1px solid #E2E8E2',
              borderRadius: 2,
              p: 1,
              color: mode === 'dark' ? '#F3F5F7' : '#16231B',
              transition: 'all 0.15s ease',
              display: 'inline-flex',
              flexShrink: 0,
              '&:hover': { background: mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(32, 48, 32, 0.04)' },
            }}
          >
            <MenuIcon size={19} />
          </IconButton>
        </Tooltip>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
        {!isTablet && (
          <span style={{ fontSize: 13, color: mode === 'dark' ? '#94A3B8' : '#7A8B80', fontWeight: 500, whiteSpace: 'nowrap' }}>
            {crumb[0]}
          </span>
        )}
        {!isTablet && <ChevronRight size={14} color={mode === 'dark' ? '#64748B' : '#9BA99F'} style={{ flexShrink: 0 }} />}
        <span
          style={{
            fontSize: isSmallMobile ? 12.5 : 13.5,
            fontWeight: 700,
            color: mode === 'dark' ? '#F3F5F7' : '#16231B',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {crumb[1]}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: isSmallMobile ? 6 : 10, flexShrink: 0, marginLeft: 'auto' }}>
        <Tooltip title={mode === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"} arrow>
          <IconButton
            onClick={toggleThemeMode}
            aria-label="Toggle theme mode"
            sx={{
              border: mode === 'dark' ? '1px solid #262E36' : '1px solid #E2E8E2',
              borderRadius: 2,
              p: 1,
              color: mode === 'dark' ? '#F3F5F7' : '#16231B',
              transition: 'all 0.15s ease',
              '&:hover': { background: mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(32, 48, 32, 0.04)' },
            }}
          >
            {mode === 'dark' ? <Sun size={18} color="#F59E0B" /> : <Moon size={18} color="#64748B" />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Notifications" arrow>
          <IconButton
            onClick={() => navigate('/notifications')}
            aria-label="Notifications"
            sx={{
              border: mode === 'dark' ? '1px solid #262E36' : '1px solid #E2E8E2',
              borderRadius: 2,
              position: 'relative',
              p: 1,
              color: mode === 'dark' ? '#F3F5F7' : '#16231B',
              transition: 'all 0.15s ease',
              '&:hover': { background: mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(32, 48, 32, 0.04)' },
            }}
          >
            <Bell size={18} />
            {unread > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 5,
                  right: 6,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#C2410C',
                  border: '2px solid #fff',
                }}
              />
            )}
          </IconButton>
        </Tooltip>

        <button
          type="button"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-label="Account menu"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: isSmallMobile ? 4 : 8,
            padding: isSmallMobile ? '3px 6px' : '4px 10px 4px 5px',
            borderRadius: 24,
            border: mode === 'dark' ? '1px solid #262E36' : '1px solid #E2E8E2',
            background: mode === 'dark' ? '#181D22' : '#FFFFFF',
            color: mode === 'dark' ? '#F3F5F7' : '#16231B',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s ease',
          }}
        >
          <Avatar sx={{ width: 26, height: 26, bgcolor: '#203020', color: '#FFFFFF', fontSize: 11, fontWeight: 700 }}>
            {user ? user.initials || initialsOf(user.full_name) : '?'}
          </Avatar>
          {!isSmallMobile && (
            <span style={{ fontSize: 13, fontWeight: 600, color: mode === 'dark' ? '#F3F5F7' : '#16231B' }}>
              {user?.full_name}
            </span>
          )}
          <ChevronDown size={14} color={mode === 'dark' ? '#94A3B8' : '#7A8B80'} />
        </button>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          slotProps={{
            paper: {
              sx: {
                bgcolor: mode === 'dark' ? '#1A2027' : '#FFFFFF',
                borderColor: mode === 'dark' ? '#262E36' : '#E2E8E2',
                color: mode === 'dark' ? '#F3F5F7' : '#16231B',
                border: '1px solid',
              },
            },
          }}
        >
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              navigate('/settings');
            }}
          >
            <UserIcon size={15} style={{ marginRight: 9 }} />
            My Profile
          </MenuItem>
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              navigate('/notifications');
            }}
          >
            <Bell size={15} style={{ marginRight: 9 }} />
            Notifications
          </MenuItem>
          <Divider sx={{ borderColor: mode === 'dark' ? '#262E36' : undefined }} />
          <MenuItem onClick={handleLogout}>
            <LogOut size={15} style={{ marginRight: 9 }} />
            Logout
          </MenuItem>
        </Menu>
      </div>
    </header>
  );
}

