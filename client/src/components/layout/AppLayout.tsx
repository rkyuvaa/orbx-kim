import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Drawer, useMediaQuery } from '@mui/material';

import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width:1024px)');
  const location = useLocation();

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

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
  }, [sidebarWidth, isMobile]);

  return (
    <div style={{ minHeight: '100vh' }}>
      {isMobile ? (
        <>
          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            sx={{
              '& .MuiDrawer-paper': {
                width: 244,
                background: 'var(--sidebar-bg, #141d14)',
                borderRight: '1px solid var(--sidebar-border, rgba(255, 255, 255, 0.08))',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
              },
            }}
          >
            {sidebarContent}
          </Drawer>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <Topbar onToggleSidebar={() => setDrawerOpen(true)} />
            <main className="app-main" style={{ flex: 1, padding: '20px 24px 16px', minWidth: 0, width: '100%' }}>
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
              boxSizing: 'border-box',
            }}
          >
            <Topbar onToggleSidebar={() => setCollapsed((c) => !c)} />
            <main className="app-main" style={{ flex: 1, padding: '16px 24px', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
              <Outlet />
            </main>
          </div>
        </>
      )}
    </div>
  );
}
