import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  AlertTriangle,
  BatteryCharging,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  Gauge,
  HelpCircle,
  Lightbulb,
  Printer,
  ShieldAlert,
  ShieldCheck,
  Star,
  TrendingUp,
  Wrench,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useGetVSComplaintsQuery, useGetVSDashboardQuery, useGetVSVehiclesQuery } from '@/api/vehicleServiceApi';

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
  const { data: vehicles = [] } = useGetVSVehiclesQuery();

  if (isDashboardLoading || isComplaintsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
        <CircularProgress />
      </Box>
    );
  }

  const kpis = dashboard?.kpis || {
    total_vehicles: 0,
    open_complaints: 0,
    critical_alerts: 0,
    pending_maintenance: 0,
    resolved_this_month: 0,
    avg_resolution_hours: 0,
  };

  const byCategory = dashboard?.by_category || [];
  const bySeverity = dashboard?.by_severity || [];
  const anomalies = dashboard?.anomalies || [];

  // Calculate Average Rating
  const ratedComplaints = complaints.filter((c) => c.feedback && c.feedback.rating);
  const avgRating =
    ratedComplaints.length > 0
      ? (
          ratedComplaints.reduce((acc, c) => acc + (c.feedback?.rating || 0), 0) /
          ratedComplaints.length
        ).toFixed(1)
      : 'N/A';

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
          <div style={{ fontSize: 13, color: '#7A8B80', marginTop: 3 }}>
            Comprehensive reliability indicators, failure diagnostics, and customer education guidelines.
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

      {/* Summary KPI Cards */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                TOTAL WORK ORDERS LOGGED
              </Typography>
              <Typography variant="h4" fontWeight={900} color="#0f172a" sx={{ my: 0.5 }}>
                {complaints.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Across {vehicles.length} retrofitted units
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                AVERAGE RESOLUTION TIME
              </Typography>
              <Typography variant="h4" fontWeight={900} color="#0284c7" sx={{ my: 0.5 }}>
                {kpis.avg_resolution_hours} Hours
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Intake to successful closure
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                CUSTOMER SATISFACTION (CSAT)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 0.5 }}>
                <Typography variant="h4" fontWeight={900} color="#eab308">
                  {avgRating}
                </Typography>
                <Star size={24} fill="#eab308" color="#eab308" />
              </Box>
              <Typography variant="caption" color="text.secondary">
                Based on {ratedComplaints.length} rated resolutions
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                RELIABILITY ANOMALIES
              </Typography>
              <Typography variant="h4" fontWeight={900} color={anomalies.length > 0 ? '#ef4444' : '#10b981'} sx={{ my: 0.5 }}>
                {anomalies.length} Flagged
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Vehicles with 3+ recurring issues
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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

      {/* Customer Education & Misuse Prevention Section */}
      <Paper sx={{ p: 3, mb: 4, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fbfcfd' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <BookOpen size={22} color="#2563eb" />
          <Box>
            <Typography variant="subtitle1" fontWeight={800}>
              Driver Education, Safety & Misuse Prevention Guidelines
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Standards broadcasted to auto-rickshaw drivers and retrofitted fleet operators
            </Typography>
          </Box>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ p: 2, borderRadius: 2, height: '100%', border: '1px solid #e2e8f0' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <BatteryCharging size={18} color="#f59e0b" />
                <Typography variant="subtitle2" fontWeight={700}>
                  Battery Charging Protocol
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" display="block">
                • Always charge using approved high-stability chargers.<br />
                • Do not discharge below 10% SOC to protect cell health.<br />
                • Avoid charging immediately after heavy uphill hauling under direct sun.
              </Typography>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ p: 2, borderRadius: 2, height: '100%', border: '1px solid #e2e8f0' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Gauge size={18} color="#3b82f6" />
                <Typography variant="subtitle2" fontWeight={700}>
                  Motor & Controller Load
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" display="block">
                • Respect permissible gross passenger vehicle weight (400 kg max).<br />
                • Gradual acceleration prevents high-amp spikes on the MOSFETs.<br />
                • Stop immediately if the controller warning light flashes.
              </Typography>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ p: 2, borderRadius: 2, height: '100%', border: '1px solid #e2e8f0' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <ShieldCheck size={18} color="#10b981" />
                <Typography variant="subtitle2" fontWeight={700}>
                  Water Fording & Monsoon
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" display="block">
                • IP67 enclosures protect the battery and motor against splashes.<br />
                • Do not submerge vehicle in standing flood water above hub level.<br />
                • Inspect wiring harness boots after high-pressure washing.
              </Typography>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ p: 2, borderRadius: 2, height: '100%', border: '1px solid #e2e8f0' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Zap size={18} color="#8b5cf6" />
                <Typography variant="subtitle2" fontWeight={700}>
                  QR Diagnostic Assistance
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" display="block">
                • Drivers can scan the dashboard QR code in seconds.<br />
                • GPS coordinates immediately dispatch the closest roadside tech.<br />
                • Avoid third-party roadside wiring bypasses.
              </Typography>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    </div>
  );
}
