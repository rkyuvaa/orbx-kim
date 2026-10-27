import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip as MuiTooltip,
  Typography,
} from '@mui/material';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Bell,
  BellOff,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
  Volume2,
  VolumeX,
  Wrench,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useGetVSDashboardQuery, useUpdateVSComplaintMutation } from '@/api/vehicleServiceApi';
import { audioAlarm } from './VSAudioAlarm';

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#f59e0b',
  LOW: '#10b981',
};

const CATEGORY_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#6b7280'];

export default function VSDashboardTab() {
  const navigate = useNavigate();
  const { data: dashboard, isLoading, refetch } = useGetVSDashboardQuery(undefined, {
    pollingInterval: 10000,
  });

  const [updateComplaint] = useUpdateVSComplaintMutation();
  const [isMuted, setIsMuted] = useState<boolean>(audioAlarm.getIsMuted());

  const criticalCount = dashboard?.kpis?.critical_alerts || 0;

  useEffect(() => {
    if (criticalCount > 0 && !isMuted) {
      audioAlarm.startLoop(4000);
    } else {
      audioAlarm.stopLoop();
    }

    return () => {
      audioAlarm.stopLoop();
    };
  }, [criticalCount, isMuted]);

  const handleToggleMute = () => {
    const muted = audioAlarm.toggleMute();
    setIsMuted(muted);
  };

  const handleQuickAcknowledge = async (id: number) => {
    await updateComplaint({ id, body: { status: 'ACKNOWLEDGED' } });
    refetch();
  };

  if (isLoading) {
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
  const recentComplaints = dashboard?.recent_complaints || [];

  return (
    <Box>
      {/* Critical Alarm Banner */}
      {criticalCount > 0 && (
        <Paper
          sx={{
            p: 2.5,
            mb: 3,
            borderRadius: 3,
            bgcolor: '#fef2f2',
            border: '2px solid #ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
            boxShadow: '0 8px 24px rgba(239,68,68,0.18)',
            animation: 'pulse 2s infinite',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: '#ef4444',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertOctagon size={28} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={800} color="#b91c1c">
                🚨 CRITICAL ISSUE ALERT ({criticalCount} Urgent Complaint{criticalCount > 1 ? 's' : ''})
              </Typography>
              <Typography variant="body2" color="#7f1d1d">
                Immediate response required. Audible siren active to alert dispatchers.
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleToggleMute}
              startIcon={isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              sx={{
                borderColor: '#ef4444',
                color: '#b91c1c',
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': { bgcolor: '#fee2e2' },
              }}
            >
              {isMuted ? 'Unmute Siren' : 'Mute Siren'}
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => navigate('/vehicle-service/work-orders?severity=CRITICAL')}
              sx={{
                bgcolor: '#dc2626',
                color: '#fff',
                textTransform: 'none',
                fontWeight: 700,
                '&:hover': { bgcolor: '#b91c1c' },
              }}
            >
              View Critical Work Orders
            </Button>
          </Box>
        </Paper>
      )}

      {/* KPI Cards Grid */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  RETROFITTED FLEET
                </Typography>
                <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#eff6ff', color: '#2563eb' }}>
                  <Car size={18} />
                </Box>
              </Box>
              <Typography variant="h4" fontWeight={800} color="#0f172a">
                {kpis.total_vehicles}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Active 3W EV units
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  OPEN COMPLAINTS
                </Typography>
                <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#fffbeb', color: '#d97706' }}>
                  <Wrench size={18} />
                </Box>
              </Box>
              <Typography variant="h4" fontWeight={800} color={kpis.open_complaints > 0 ? '#d97706' : '#0f172a'}>
                {kpis.open_complaints}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Awaiting resolution
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card
            sx={{
              borderRadius: 3,
              border: kpis.critical_alerts > 0 ? '2px solid #ef4444' : '1px solid #e2e8f0',
              bgcolor: kpis.critical_alerts > 0 ? '#fff5f5' : '#ffffff',
              height: '100%',
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" fontWeight={700} color={kpis.critical_alerts > 0 ? '#b91c1c' : 'text.secondary'}>
                  CRITICAL ALERTS
                </Typography>
                <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#fef2f2', color: '#dc2626' }}>
                  <AlertTriangle size={18} />
                </Box>
              </Box>
              <Typography variant="h4" fontWeight={800} color={kpis.critical_alerts > 0 ? '#dc2626' : '#0f172a'}>
                {kpis.critical_alerts}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                High urgency breakdowns
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  PENDING SERVICE
                </Typography>
                <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#f5f3ff', color: '#7c3aed' }}>
                  <Calendar size={18} />
                </Box>
              </Box>
              <Typography variant="h4" fontWeight={800} color="#0f172a">
                {kpis.pending_maintenance}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Preventive schedules
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  RESOLVED (MONTH)
                </Typography>
                <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#ecfdf5', color: '#059669' }}>
                  <CheckCircle2 size={18} />
                </Box>
              </Box>
              <Typography variant="h4" fontWeight={800} color="#059669">
                {kpis.resolved_this_month}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Closed work orders
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  AVG RESOLUTION
                </Typography>
                <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#ecfeff', color: '#0891b2' }}>
                  <Clock size={18} />
                </Box>
              </Box>
              <Typography variant="h4" fontWeight={800} color="#0f172a">
                {kpis.avg_resolution_hours}h
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Turnaround duration
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Anomalies and Misuse Alerts */}
      {anomalies.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShieldAlert size={20} color="#f59e0b" />
            Detected Anomalies & Repeated Failures
          </Typography>
          <Grid container spacing={2}>
            {anomalies.map((anom, idx) => (
              <Grid item xs={12} md={6} key={idx}>
                <Paper
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    bgcolor: '#fffbeb',
                    border: '1px solid #fde68a',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.5,
                  }}
                >
                  <AlertTriangle size={20} color="#d97706" style={{ marginTop: 2, flexShrink: 0 }} />
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="subtitle2" fontWeight={800} color="#92400e">
                        {anom.vehicle_number}
                      </Typography>
                      <Chip label={`${anom.complaints_count}x ${anom.category}`} size="small" sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 700 }} />
                    </Box>
                    <Typography variant="body2" color="#78350f">
                      {anom.message}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Visual Analytics Charts */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', height: 350 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Complaints by Category
            </Typography>
            {byCategory.length === 0 ? (
              <Box sx={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">No complaint records logged yet</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={270}>
                <BarChart data={byCategory} margin={{ top: 15, right: 20, left: 0, bottom: 20 }}>
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip />
                  <Bar dataKey="count" name="Complaints" radius={[4, 4, 0, 0]}>
                    {byCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', height: 350 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Severity Breakdown
            </Typography>
            {bySeverity.length === 0 ? (
              <Box sx={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">No complaint records logged yet</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={270}>
                <PieChart>
                  <Pie
                    data={bySeverity}
                    dataKey="count"
                    nameKey="severity"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    label={(entry) => `${entry.severity}: ${entry.count}`}
                  >
                    {bySeverity.map((entry, index) => (
                      <Cell key={`sev-cell-${index}`} fill={SEVERITY_COLORS[entry.severity] || '#6b7280'} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Complaints Table */}
      <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={800}>
              Live Complaint Feed
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Latest incoming complaints registered via QR code or manual intake
            </Typography>
          </Box>
          <Button
            size="small"
            endIcon={<ArrowRight size={16} />}
            onClick={() => navigate('/vehicle-service/work-orders')}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            All Work Orders
          </Button>
        </Box>

        {recentComplaints.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
            <Wrench size={40} strokeWidth={1.2} style={{ margin: '0 auto 12px' }} />
            <Typography variant="subtitle2" fontWeight={600}>
              No Service Complaints Logged
            </Typography>
            <Typography variant="caption">
              When drivers or customers scan the vehicle QR code or call in, work orders appear here instantly.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Complaint ID</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Vehicle</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Severity</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Reported By</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Registered Via</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentComplaints.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell sx={{ fontWeight: 700, color: '#2563eb' }}>
                      {c.complaint_no}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{c.vehicle_number || `Vehicle #${c.vehicle_id}`}</TableCell>
                    <TableCell>
                      <Chip label={c.category} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={c.severity}
                        size="small"
                        sx={{
                          bgcolor: `${SEVERITY_COLORS[c.severity]}15`,
                          color: SEVERITY_COLORS[c.severity],
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip label={c.status} size="small" sx={{ fontSize: 11 }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" fontWeight={600} display="block">
                        {c.reported_by}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {c.reported_phone}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={c.registered_via}
                        size="small"
                        color={c.registered_via === 'QR' ? 'primary' : 'default'}
                        variant={c.registered_via === 'QR' ? 'filled' : 'outlined'}
                        sx={{ fontSize: 10, height: 20 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {c.status === 'OPEN' && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleQuickAcknowledge(c.id)}
                          sx={{ textTransform: 'none', fontSize: 11, py: 0.2 }}
                        >
                          Acknowledge
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
