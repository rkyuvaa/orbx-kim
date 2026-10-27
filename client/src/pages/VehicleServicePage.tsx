import React from 'react';
import { useLocation } from 'react-router-dom';
import { Box } from '@mui/material';

import VSDashboardTab from '@/components/vehicleService/VSDashboardTab';
import VSWorkOrdersTab from '@/components/vehicleService/VSWorkOrdersTab';
import VSServiceHistoryTab from '@/components/vehicleService/VSServiceHistoryTab';
import VSReportsTab from '@/components/vehicleService/VSReportsTab';
import VSConfigurationTab from '@/components/vehicleService/VSConfigurationTab';

export default function VehicleServicePage() {
  const location = useLocation();

  const renderContent = () => {
    const path = location.pathname;
    if (path.includes('/work-orders')) return <VSWorkOrdersTab />;
    if (path.includes('/service-history')) return <VSServiceHistoryTab />;
    if (path.includes('/reports')) return <VSReportsTab />;
    if (path.includes('/configuration')) return <VSConfigurationTab />;
    return <VSDashboardTab />;
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', minWidth: 0, px: { xs: 2, sm: 3 }, py: 2, boxSizing: 'border-box' }}>
      {renderContent()}
    </Box>
  );
}
