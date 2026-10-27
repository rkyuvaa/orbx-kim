import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {
  AlertTriangle,
  BatteryCharging,
  Car,
  CheckCircle2,
  Cpu,
  Gauge,
  HelpCircle,
  MapPin,
  Navigation,
  Phone,
  Send,
  ShieldAlert,
  User,
  Wrench,
  Zap,
} from 'lucide-react';

import { useGetVSPublicVehicleQuery, useSubmitVSPublicComplaintMutation } from '@/api/vehicleServiceApi';
import type { VSPublicComplaintCreate } from '@/types/vehicleService';

const CATEGORIES = [
  { key: 'BREAKDOWN', label: 'Vehicle Breakdown', icon: ShieldAlert, color: '#ef4444' },
  { key: 'BATTERY', label: 'Battery / Range Issue', icon: BatteryCharging, color: '#f59e0b' },
  { key: 'MOTOR', label: 'Motor Issue', icon: Wrench, color: '#3b82f6' },
  { key: 'CONTROLLER', label: 'Controller / Throttle', icon: Cpu, color: '#8b5cf6' },
  { key: 'CHARGING', label: 'Charging Failure', icon: Zap, color: '#ec4899' },
  { key: 'PERFORMANCE', label: 'Speed / Performance', icon: Gauge, color: '#10b981' },
  { key: 'OTHER', label: 'Other Issue', icon: HelpCircle, color: '#6b7280' },
];

const SEVERITIES = [
  { key: 'CRITICAL', label: 'Critical (Vehicle Immobility / Hazard)', color: '#dc2626' },
  { key: 'HIGH', label: 'High (Major malfunction, driveable with caution)', color: '#ea580c' },
  { key: 'MEDIUM', label: 'Medium (Minor fault, normal operation possible)', color: '#d97706' },
  { key: 'LOW', label: 'Low (Cosmetic / routine observation)', color: '#16a34a' },
];

export default function VehicleServiceRegisterPage() {
  const { qrToken } = useParams<{ qrToken: string }>();

  const { data: vehicle, isLoading, error } = useGetVSPublicVehicleQuery(qrToken || '', {
    skip: !qrToken,
  });

  const [submitComplaint, { isLoading: isSubmitting }] = useSubmitVSPublicComplaintMutation();

  const [category, setCategory] = useState<string>('BREAKDOWN');
  const [severity, setSeverity] = useState<string>('MEDIUM');
  const [affectedComponentId, setAffectedComponentId] = useState<number | ''>('');
  const [reportedBy, setReportedBy] = useState<string>('');
  const [reportedPhone, setReportedPhone] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // GPS Coordinates
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);

  // Submission state
  const [submittedComplaintNo, setSubmittedComplaintNo] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (vehicle) {
      if (!reportedBy) setReportedBy(vehicle.owner_name);
      if (!reportedPhone) setReportedPhone(vehicle.owner_phone);
    }
  }, [vehicle]);

  const captureGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      (err) => {
        setGpsError(err.message || 'Unable to retrieve location');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  useEffect(() => {
    captureGps();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrToken) return;

    if (!reportedBy.trim() || !reportedPhone.trim() || !description.trim()) {
      setSubmitError('Please complete all required fields.');
      return;
    }

    setSubmitError(null);

    const payload: VSPublicComplaintCreate = {
      reported_by: reportedBy.trim(),
      reported_phone: reportedPhone.trim(),
      category,
      severity,
      description: description.trim(),
      affected_component_id: affectedComponentId ? Number(affectedComponentId) : undefined,
      gps_latitude: gps?.lat,
      gps_longitude: gps?.lng,
    };

    try {
      const res = await submitComplaint({ qrToken, body: payload }).unwrap();
      setSubmittedComplaintNo(res.complaint_no);
    } catch (err: any) {
      setSubmitError(err?.data?.detail || 'Failed to submit complaint. Please check your connection.');
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f8fafc' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !vehicle) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <AlertTriangle size={56} color="#ef4444" style={{ margin: '0 auto 16px' }} />
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Invalid or Inactive Vehicle QR Code
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The scanned QR code is either expired or not registered in our EV Retrofitment system.
            Please contact support at your local authorized service center.
          </Typography>
        </Paper>
      </Container>
    );
  }

  if (submittedComplaintNo) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 4, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              bgcolor: '#ecfdf5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
            }}
          >
            <CheckCircle2 size={42} color="#10b981" />
          </Box>
          <Typography variant="h5" fontWeight={800} color="#0f172a" gutterBottom>
            Complaint Registered
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Our EV Service & Support team has been instantly notified of your request.
          </Typography>

          <Box sx={{ p: 2, bgcolor: '#f1f5f9', borderRadius: 2, mb: 3 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Work Order / Complaint ID
            </Typography>
            <Typography variant="h6" fontWeight={800} color="#2563eb">
              {submittedComplaintNo}
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'left', p: 2, bgcolor: '#f8fafc', borderRadius: 2, mb: 3 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Vehicle:</strong> {vehicle.vehicle_number}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Category:</strong> {category}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Severity:</strong> {severity}
            </Typography>
            {gps && (
              <Typography variant="body2" color="text.secondary">
                <strong>GPS Recorded:</strong> {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
              </Typography>
            )}
          </Box>

          <Button
            variant="contained"
            fullWidth
            onClick={() => {
              setSubmittedComplaintNo(null);
              setDescription('');
            }}
            sx={{ borderRadius: 2, py: 1.2, textTransform: 'none', fontWeight: 600 }}
          >
            Submit Another Query / Issue
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', py: { xs: 2, sm: 6 } }}>
      <Container maxWidth="sm">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, bgcolor: '#eff6ff', px: 2, py: 0.8, borderRadius: 9999, mb: 1.5 }}>
            <Zap size={18} color="#2563eb" />
            <Typography variant="caption" fontWeight={700} color="#2563eb">
              EV 3-WHEELER RETROFIT SERVICE
            </Typography>
          </Box>
          <Typography variant="h5" fontWeight={800} color="#0f172a">
            Instant Service Complaint
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Scan-to-Report service request for your retrofitted vehicle
          </Typography>
        </Box>

        {/* Vehicle Info Card */}
        <Card sx={{ mb: 3, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Car size={24} color="#0f172a" />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" fontWeight={800}>
                  {vehicle.vehicle_number}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Owner: {vehicle.owner_name} • Kit: {vehicle.kit_number || 'EV-RETRO-STANDARD'}
                </Typography>
              </Box>
            </Box>

            {/* GPS Status */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: gps ? '#f0fdf4' : '#fffbeb', p: 1.2, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MapPin size={16} color={gps ? '#16a34a' : '#d97706'} />
                <Typography variant="caption" fontWeight={600} color={gps ? '#16a34a' : '#d97706'}>
                  {gps ? `GPS: ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : gpsLoading ? 'Detecting location...' : 'Location unavailable'}
                </Typography>
              </Box>
              <Button size="small" onClick={captureGps} disabled={gpsLoading} sx={{ textTransform: 'none', fontSize: 11, p: 0.5 }}>
                {gpsLoading ? 'Locating...' : 'Refresh GPS'}
              </Button>
            </Box>
            {gpsError && (
              <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
                {gpsError} (You can still submit without GPS)
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Complaint Form */}
        <Paper component="form" onSubmit={handleSubmit} sx={{ p: 3, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
          {submitError && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
              {submitError}
            </Alert>
          )}

          {/* Issue Category Selection */}
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
            Select Issue Category *
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, mb: 3 }}>
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.key;
              const IconComp = cat.icon;
              return (
                <Box
                  key={cat.key}
                  onClick={() => setCategory(cat.key)}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    cursor: 'pointer',
                    border: '1.5px solid',
                    borderColor: isSelected ? cat.color : '#e2e8f0',
                    bgcolor: isSelected ? `${cat.color}10` : '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.2,
                    transition: 'all 0.15s ease',
                    '&:hover': { borderColor: cat.color },
                  }}
                >
                  <IconComp size={18} color={cat.color} />
                  <Typography variant="caption" fontWeight={isSelected ? 700 : 500} color="#0f172a">
                    {cat.label}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          {/* Affected Kit Component */}
          {vehicle.components && vehicle.components.length > 0 && (
            <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
              <InputLabel id="component-select-label">Specific Component (Optional)</InputLabel>
              <Select
                labelId="component-select-label"
                value={affectedComponentId}
                label="Specific Component (Optional)"
                onChange={(e) => setAffectedComponentId(e.target.value as number | '')}
              >
                <MenuItem value="">
                  <em>Not sure / Overall Vehicle</em>
                </MenuItem>
                {vehicle.components.map((comp) => (
                  <MenuItem key={comp.id} value={comp.id}>
                    {comp.component_label} (SN: {comp.serial_number})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Severity */}
          <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
            <InputLabel id="severity-select-label">Severity Level *</InputLabel>
            <Select
              labelId="severity-select-label"
              value={severity}
              label="Severity Level *"
              onChange={(e) => setSeverity(e.target.value)}
            >
              {SEVERITIES.map((sev) => (
                <MenuItem key={sev.key} value={sev.key}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: sev.color }} />
                    <Typography variant="body2">{sev.label}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Complainant Details */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2.5 }}>
            <TextField
              label="Your Name *"
              size="small"
              value={reportedBy}
              onChange={(e) => setReportedBy(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Mobile Number *"
              size="small"
              value={reportedPhone}
              onChange={(e) => setReportedPhone(e.target.value)}
              required
              fullWidth
            />
          </Box>

          {/* Description */}
          <TextField
            label="Describe the issue / symptoms *"
            placeholder="e.g. Battery indicator dropped suddenly, motor stops when accelerating, unusual sound near controller..."
            multiline
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            fullWidth
            sx={{ mb: 3 }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <Send size={18} />}
            sx={{
              py: 1.4,
              borderRadius: 2.5,
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '1rem',
              bgcolor: '#2563eb',
              '&:hover': { bgcolor: '#1d4ed8' },
            }}
          >
            {isSubmitting ? 'Registering Complaint...' : 'Submit Service Request'}
          </Button>

          <Typography variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mt: 2 }}>
            Your GPS coordinates & vehicle kit info will be sent to the on-call emergency dispatch team.
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
