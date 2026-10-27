import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Chip, Paper, Tab, Tabs, Typography } from '@mui/material';
import {
  BarChart3,
  Car,
  History,
  LayoutDashboard,
  Settings2,
  Wrench,
} from 'lucide-react';

import VSDashboardTab from '@/components/vehicleService/VSDashboardTab';
import VSWorkOrdersTab from '@/components/vehicleService/VSWorkOrdersTab';
import VSServiceHistoryTab from '@/components/vehicleService/VSServiceHistoryTab';
import VSReportsTab from '@/components/vehicleService/VSReportsTab';
import VSConfigurationTab from '@/components/vehicleService/VSConfigurationTab';

const TAB_ROUTES = [
  { path: '/vehicle-service', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/vehicle-service/work-orders', label: 'Work Orders', icon: Wrench },
  { path: '/vehicle-service/service-history', label: 'Service History', icon: History },
  { path: '/vehicle-service/reports', label: 'Reports & Analytics', icon: BarChart3 },
  { path: '/vehicle-service/configuration', label: 'Configuration & Masters', icon: Settings2 },
];

export default function VehicleServicePage() {
  const location = useLocation();
  const navigate = useNavigate();

  const getCurrentTabIndex = () => {
    const path = location.pathname;
    if (path.includes('/work-orders')) return 1;
    if (path.includes('/service-history')) return 2;
    if (path.includes('/reports')) return 3;
    if (path.includes('/configuration')) return 4;
    return 0;
  };

  const currentTab = getCurrentTabIndex();

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    navigate(TAB_ROUTES[newValue].path);
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Module Title Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2.5,
              bgcolor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Car size={26} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={800} color="#0f172a">
              Vehicle Service Management
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Retrofit 3-Wheeler EV Service, Kit Component Diagnostics & Dispatch
            </Typography>
          </Box>
        </Box>
        <Chip
          label="EV Retrofitment Service"
          color="primary"
          variant="outlined"
          sx={{ fontWeight: 700, borderRadius: 2 }}
        />
      </Box>

      {/* Navigation Sub-Tabs Bar */}
      <Paper sx={{ mb: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 2,
            '& .MuiTab-root': {
              minHeight: 52,
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.875rem',
            },
          }}
        >
          {TAB_ROUTES.map((item, index) => {
            const IconComp = item.icon;
            return (
              <Tab
                key={index}
                icon={<IconComp size={18} />}
                iconPosition="start"
                label={item.label}
              />
            );
          })}
        </Tabs>
      </Paper>

      {/* Render Active View */}
      {currentTab === 0 && <VSDashboardTab />}
      {currentTab === 1 && <VSWorkOrdersTab />}
      {currentTab === 2 && <VSServiceHistoryTab />}
      {currentTab === 3 && <VSReportsTab />}
      {currentTab === 4 && <VSConfigurationTab />}
    </Box>
  );
}
