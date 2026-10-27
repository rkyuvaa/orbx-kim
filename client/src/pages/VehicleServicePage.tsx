import React from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { Car } from 'lucide-react';

export default function VehicleServicePage() {
  const location = useLocation();

  const getSection = () => {
    const path = location.pathname;
    if (path.includes('/work-orders')) return 'work_orders';
    if (path.includes('/service-history')) return 'service_history';
    if (path.includes('/reports')) return 'reports';
    if (path.includes('/configuration')) return 'configuration';
    return 'dashboard';
  };

  const section = getSection();

  const sectionLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    work_orders: 'Work Orders',
    service_history: 'Service History',
    reports: 'Reports',
    configuration: 'Configuration',
  };

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4 }}>
        <Car size={28} />
        <Typography variant="h5" fontWeight={700}>
          Vehicle Service — {sectionLabels[section]}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 12,
          color: 'text.secondary',
        }}
      >
        <Car size={56} strokeWidth={1} />
        <Typography variant="h6" mt={3} fontWeight={500}>
          No {sectionLabels[section]} yet
        </Typography>
        <Typography variant="body2" mt={1}>
          This section is under development. Your data will appear here once added.
        </Typography>
      </Box>
    </Box>
  );
}
