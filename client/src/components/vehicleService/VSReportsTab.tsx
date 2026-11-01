import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Typography,
} from '@mui/material';
import { Printer } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useGetVSComplaintsQuery, useGetVSDashboardQuery } from '@/api/vehicleServiceApi';

const CATEGORY_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#6b7280'];
const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#f59e0b',
  LOW: '#10b981',
};

export default function VSReportsTab() {
  const { data: dashboard, isLoading: isDashboardLoading } = useGetVSDashboardQuery();
  const { data: complaints = [], isLoading: isComplaintsLoading } = useGetVSComplaintsQuery();

  if (isDashboardLoading || isComplaintsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
        <CircularProgress />
      </Box>
    );
  }

  const byCategory = dashboard?.by_category || [];

  // Component breakdown: how often each component type failed
  const componentFailureCounts: Record<string, number> = {};
  complaints.forEach((c) => {
    if (c.affected_component_label) {
      componentFailureCounts[c.affected_component_label] =
        (componentFailureCounts[c.affected_component_label] || 0) + 1;
    }
  });

  const componentFailureData = Object.entries(componentFailureCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      {/* Header matching CRM */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3, color: '#023020' }}>
            Reports & Analytics
          </div>
        </div>

        <Button
          variant="outlined"
          startIcon={<Printer size={16} />}
          onClick={handlePrint}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Print Service Report
        </Button>
      </div>

      {/* Visual Analytics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', height: 360 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Issue Frequency by Category
            </Typography>
            {byCategory.length === 0 ? (
              <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">No data logged yet</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byCategory} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip />
                  <Bar dataKey="count" name="Complaints" radius={[4, 4, 0, 0]}>
                    {byCategory.map((_, index) => (
                      <Cell key={`cat-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', height: 360 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Component Replacement & Failure Distribution
            </Typography>
            {componentFailureData.length === 0 ? (
              <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">No component failures logged</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={componentFailureData} layout="vertical" margin={{ top: 10, right: 20, left: 40, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                  <RechartsTooltip />
                  <Bar dataKey="count" name="Failure Count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}
