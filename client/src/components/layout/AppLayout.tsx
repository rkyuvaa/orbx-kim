import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Box, Button, Drawer, IconButton, useMediaQuery } from '@mui/material';
import { Bell, X } from 'lucide-react';

import { useAppDispatch } from '@/app/hooks';
import { logout } from '@/auth/authSlice';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import NotificationAccessDialog from '@/components/notifications/NotificationAccessDialog';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width:1024px)');
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { isSupported, permission, isSubscribed, subscribe } = usePushNotifications();
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('kim_notif_banner_dismissed') === '1';
  });

  // Automatically ask request for notification access in browser once logged in
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        subscribe();
      } else if (Notification.permission === 'granted' && !isSubscribed) {
        subscribe();
      }
    }
  }, [subscribe, isSubscribed]);

  const handleDismissBanner = () => {
    sessionStorage.setItem('kim_notif_banner_dismissed', '1');
    setBannerDismissed(true);
  };

  const notificationPromptBanner = isSupported && permission === 'default' && !bannerDismissed && (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1.5,
        px: { xs: 2, md: 3 },
        py: 1,
        backgroundColor: '#F0FDF4',
        borderBottom: '1px solid #DCFCE7',
        color: '#166534',
        fontSize: '0.84rem',
        zIndex: 10,
        flexShrink: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Bell size={16} color="#16C47F" />
        <span style={{ fontWeight: 500 }}>
          Enable browser notifications to stay updated on tasks, reminders, and team activity.
        </span>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button
          size="small"
          variant="contained"
          onClick={() => subscribe()}
          sx={{
            backgroundColor: '#16C47F',
            color: '#FFFFFF',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.78rem',
            py: 0.35,
            px: 1.5,
            borderRadius: '6px',
            boxShadow: 'none',
            '&:hover': { backgroundColor: '#13A86B', boxShadow: 'none' },
          }}
        >
          Allow Notifications
        </Button>
        <IconButton size="small" onClick={handleDismissBanner} sx={{ color: '#166534' }}>
          <X size={15} />
        </IconButton>
      </Box>
    </Box>
  );

  // Close mobile drawer on route navigation
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Multi-tab logout synchronization: detect logout or session expiry across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'kim_erp_logout_event' || (e.key === 'auth_token' && !e.newValue)) {
        dispatch(logout());
        navigate('/login', { replace: true });
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [dispatch, navigate]);

  const sidebarContent = (
    <Sidebar
      collapsed={isMobile ? false : collapsed}
      onNavigate={() => isMobile && setDrawerOpen(false)}
      onToggleSidebar={isMobile ? () => setDrawerOpen(false) : () => setCollapsed((c) => !c)}
      isMobile={isMobile}
    />
  );

  const sidebarWidth = collapsed ? 76 : 244;

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--current-sidebar-width',
      `${isMobile ? 0 : sidebarWidth}px`
    );
    return () => {
      document.documentElement.style.setProperty('--current-sidebar-width', '0px');
    };
  }, [sidebarWidth, isMobile]);

  return (
    <div
      style={{
        minHeight: '100vh',
        height: isMobile ? '100dvh' : 'auto',
        maxHeight: isMobile ? '100dvh' : undefined,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        boxSizing: 'border-box',
        overflow: isMobile ? 'hidden' : undefined,
      }}
      className="app-shell"
    >
      {isMobile ? (
        <>
          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            ModalProps={{
              keepMounted: true, // Better mobile open performance
            }}
            sx={{
              '& .MuiDrawer-paper': {
                width: 244,
                maxWidth: '85vw',
                height: '100%',
                maxHeight: '100dvh',
                background: 'var(--sidebar-bg, #141d14)',
                borderRight: '1px solid var(--sidebar-border, rgba(255, 255, 255, 0.08))',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
                overflow: 'hidden',
              },
            }}
          >
            {sidebarContent}
          </Drawer>
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              width: '100%',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <Topbar
              onToggleSidebar={() => setDrawerOpen((prev) => !prev)}
              isMobile={true}
              isSidebarCollapsed={false}
            />
            {notificationPromptBanner}
            <main
              className="app-main"
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                padding: 'max(14px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) max(18px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px))',
                minWidth: 0,
                minHeight: 0,
                width: '100%',
                boxSizing: 'border-box',
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
                overscrollBehaviorY: 'contain',
              }}
            >
              <Outlet />
            </main>
          </div>
        </>
      ) : (
        <>
          {sidebarContent}
          <div
            style={{
              paddingLeft: sidebarWidth,
              transition: 'padding-left 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
              minHeight: '100vh',
              willChange: 'padding-left',
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
            }}
          >
            <Topbar
              onToggleSidebar={() => setCollapsed((c) => !c)}
              isMobile={false}
              isSidebarCollapsed={collapsed}
            />
            {notificationPromptBanner}
            <main
              className="app-main"
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                padding: '16px 24px max(24px, env(safe-area-inset-bottom, 0px))',
                minWidth: 0,
                minHeight: 0,
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <Outlet />
            </main>
          </div>
        </>
      )}
      <NotificationAccessDialog />
    </div>
  );
}
