import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Drawer, useMediaQuery } from '@mui/material';

import { useAppDispatch } from '@/app/hooks';
import { logout } from '@/auth/authSlice';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width:1024px)');
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

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
        height: 'auto',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        boxSizing: 'border-box',
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
            }}
          >
            <Topbar
              onToggleSidebar={() => setDrawerOpen((prev) => !prev)}
              isMobile={true}
              isSidebarCollapsed={false}
            />
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
    </div>
  );
}
