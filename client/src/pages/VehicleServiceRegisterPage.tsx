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
  Grid,
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
  CheckCircle2,
  Cpu,
  Gauge,
  HelpCircle,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  Send,
  ShieldAlert,
  User,
  Wrench,
  Zap,
} from 'lucide-react';

import {
  useGetVSPublicVehicleQuery,
  useLazyLookupVSPublicVehicleQuery,
  useSubmitVSPublicComplaintMutation,
  useSubmitVSUniversalComplaintMutation,
} from '@/api/vehicleServiceApi';
import type { VSPublicVehicleInfo, VSUniversalComplaintCreate } from '@/types/vehicleService';
import { reverseGeocodeAreaAndCity } from '@/utils/geolocation';

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
  { key: 'CRITICAL', label: 'Critical (Vehicle Immobility / Emergency)', color: '#dc2626' },
  { key: 'HIGH', label: 'High (Major malfunction, driveable with caution)', color: '#ea580c' },
  { key: 'MEDIUM', label: 'Medium (Minor fault, normal operation possible)', color: '#d97706' },
  { key: 'LOW', label: 'Low (Cosmetic / routine observation)', color: '#16a34a' },
];

export default function VehicleServiceRegisterPage() {
  const { qrToken } = useParams<{ qrToken: string }>();

  // If accessed via legacy vehicle-specific token
  const { data: tokenVehicle } = useGetVSPublicVehicleQuery(qrToken || '', {
    skip: !qrToken,
  });

  const [lookupVehicle, { isLoading: isLookingUp }] = useLazyLookupVSPublicVehicleQuery();
  const [submitUniversal, { isLoading: isSubmittingUniversal }] = useSubmitVSUniversalComplaintMutation();
  const [submitByToken, { isLoading: isSubmittingToken }] = useSubmitVSPublicComplaintMutation();

  const isSubmitting = isSubmittingUniversal || isSubmittingToken;

  // Form Fields
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [verifiedVehicle, setVerifiedVehicle] = useState<VSPublicVehicleInfo | null>(null);
  const [reportedBy, setReportedBy] = useState('');
  const [reportedPhone, setReportedPhone] = useState('');
  const [category, setCategory] = useState('BREAKDOWN');
  const [severity, setSeverity] = useState('MEDIUM');
  const [affectedComponentId, setAffectedComponentId] = useState<number | ''>('');
  const [description, setDescription] = useState('');

  // GPS Coordinates
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAddress, setGpsAddress] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);

  // Submission result state
  const [submittedComplaintNo, setSubmittedComplaintNo] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (tokenVehicle) {
      setVehicleNumber(tokenVehicle.vehicle_number);
      setVerifiedVehicle(tokenVehicle);
      if (!reportedBy) setReportedBy(tokenVehicle.owner_name);
      if (!reportedPhone) setReportedPhone(tokenVehicle.owner_phone);
    }
  }, [tokenVehicle]);

  const captureGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGps({ lat, lng });
        setGpsLoading(false);
        reverseGeocodeAreaAndCity(lat, lng).then((res) => {
          if (res?.formatted) {
            setGpsAddress(res.formatted);
          }
        });
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

  const handleVehicleNumberBlur = async () => {
    const trimmed = vehicleNumber.trim().toUpperCase();
    if (!trimmed || trimmed.length < 3) return;

    try {
      const res = await lookupVehicle(trimmed).unwrap();
      if (res) {
        setVerifiedVehicle(res);
        if (!reportedBy && res.owner_name) setReportedBy(res.owner_name);
        if (!reportedPhone && res.owner_phone) setReportedPhone(res.owner_phone);
      } else {
        setVerifiedVehicle(null);
      }
    } catch {
      setVerifiedVehicle(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleNumber.trim() || !reportedBy.trim() || !reportedPhone.trim()) {
      setSubmitError('Please enter Vehicle Number, Your Name, and Mobile Number.');
      return;
    }

    setSubmitError(null);

    const desc = description.trim() || `${category} issue reported for vehicle ${vehicleNumber.trim().toUpperCase()}`;

    const payload: VSUniversalComplaintCreate = {
      vehicle_number: vehicleNumber.trim().toUpperCase(),
      reported_by: reportedBy.trim(),
      reported_phone: reportedPhone.trim(),
      category,
      severity,
      description: desc,
      affected_component_id: affectedComponentId ? Number(affectedComponentId) : undefined,
      gps_latitude: gps?.lat,
      gps_longitude: gps?.lng,
      gps_address: gpsAddress || undefined,
    };

    try {
      let res;
      if (qrToken) {
        res = await submitByToken({ qrToken, body: payload }).unwrap();
      } else {
        res = await submitUniversal(payload).unwrap();
      }
      setSubmittedComplaintNo(res.complaint_no);
    } catch (err: any) {
      setSubmitError(
        err?.data?.detail || 'Failed to submit complaint. Please check your network connection.',
      );
    }
  };

  if (submittedComplaintNo) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 } }}>
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
            Service Request Registered
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Your complaint has been assigned to the on-call emergency technician team.
          </Typography>

          <Box sx={{ p: 2, bgcolor: '#f1f5f9', borderRadius: 2, mb: 2.5 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Complaint / Work Order Tracking ID
            </Typography>
            <Typography variant="h5" fontWeight={800} color="#2563eb">
              {submittedComplaintNo}
            </Typography>
          </Box>

          {/* SMS Notification Banner */}
          <Box sx={{ p: 1.5, bgcolor: '#eff6ff', borderRadius: 2, border: '1px solid #bfdbfe', mb: 3, display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <MessageSquare size={18} color="#2563eb" />
            <Typography variant="caption" fontWeight={600} color="#1e40af" textAlign="left">
              SMS Confirmation triggered to <strong>{reportedPhone}</strong>. You will receive live status updates.
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'left', p: 2, bgcolor: '#f8fafc', borderRadius: 2, mb: 3 }}>
            <Typography variant="body2" sx={{ mb: 0.8 }}>
              <strong>Vehicle Number:</strong> {vehicleNumber.toUpperCase()}
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.8 }}>
              <strong>Category:</strong> {category}
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.8 }}>
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
            sx={{ borderRadius: 2, py: 1.2, textTransform: 'none', fontWeight: 700 }}
          >
            Register Another Request
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: '#f8fafc', py: { xs: 2, sm: 6 }, pb: 'max(24px, env(safe-area-inset-bottom, 0px))' }}>
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
            Register Service Complaint
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Scan-to-Report service request for your retrofitted EV auto-rickshaw
          </Typography>
        </Box>

        {/* GPS Location Status Card */}
        <Card sx={{ mb: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: gps ? '#dcfce7' : '#fef3c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MapPin size={16} color={gps ? '#16a34a' : '#d97706'} />
                </Box>
                <Box>
                  <Typography variant="caption" fontWeight={700} color={gps ? '#16a34a' : '#d97706'} display="block">
                    {gps ? (gpsAddress || 'GPS Location Captured') : gpsLoading ? 'Detecting Location...' : 'Location Pending'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {gps ? `${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : 'Helps emergency dispatch locate your vehicle'}
                  </Typography>
                </Box>
              </Box>
              <Button size="small" onClick={captureGps} disabled={gpsLoading} sx={{ textTransform: 'none', fontSize: 11 }}>
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
        <Paper component="form" onSubmit={handleSubmit} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0' }}>
          {submitError && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
              {submitError}
            </Alert>
          )}

          {/* Vehicle Registration Number */}
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.8 }}>
            Vehicle Registration Number *
          </Typography>
          <TextField
            placeholder="e.g. MH12AB1234"
            size="small"
            required
            fullWidth
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
            onBlur={handleVehicleNumberBlur}
            helperText="Enter your 3-wheeler auto registration number"
            sx={{ mb: 2 }}
          />

          {/* Verified Vehicle Badge */}
          {verifiedVehicle && (
            <Box sx={{ mb: 2.5, p: 1.5, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircle2 size={16} color="#16a34a" />
                <Typography variant="caption" fontWeight={700} color="#16a34a">
                  Retrofitted Fleet Match: {verifiedVehicle.vehicle_number}
                </Typography>
              </Box>
              <Typography variant="caption" color="#14532d" display="block">
                Registered Owner: {verifiedVehicle.owner_name} ? Kit: {verifiedVehicle.kit_number || 'Standard'}
              </Typography>
            </Box>
          )}

          {/* Customer / Complainant Details */}
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Your Name *"
                size="small"
                required
                fullWidth
                value={reportedBy}
                onChange={(e) => setReportedBy(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Mobile Number (for SMS) *"
                placeholder="10-digit mobile"
                size="small"
                required
                fullWidth
                value={reportedPhone}
                onChange={(e) => setReportedPhone(e.target.value)}
              />
            </Grid>
          </Grid>

          {/* Complaint Category Dropdown */}
          <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
            <InputLabel id="category-select-label">Complaint Category *</InputLabel>
            <Select
              labelId="category-select-label"
              value={category}
              label="Complaint Category *"
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((cat) => (
                <MenuItem key={cat.key} value={cat.key}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: cat.color }} />
                    <Typography variant="body2">{cat.label}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Specific Kit Component (if vehicle verified) */}
          {verifiedVehicle && verifiedVehicle.components && verifiedVehicle.components.length > 0 && (
            <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
              <InputLabel id="comp-label">Affected Kit Component (Optional)</InputLabel>
              <Select
                labelId="comp-label"
                value={affectedComponentId}
                label="Affected Kit Component (Optional)"
                onChange={(e) => setAffectedComponentId(e.target.value as number | '')}
              >
                <MenuItem value="">
                  <em>Not Sure / Overall Vehicle</em>
                </MenuItem>
                {verifiedVehicle.components.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.component_label} (SN: {c.serial_number})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Severity Dropdown */}
          <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
            <InputLabel id="severity-label">Severity / Urgency Level *</InputLabel>
            <Select
              labelId="severity-label"
              value={severity}
              label="Severity / Urgency Level *"
              onChange={(e) => setSeverity(e.target.value)}
            >
              {SEVERITIES.map((s) => (
                <MenuItem key={s.key} value={s.key}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
                    <Typography variant="body2">{s.label}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Problem Description (Optional) */}
          <TextField
            label="Describe the problem / issue symptoms (Optional)"
            placeholder="e.g. Battery percentage dropped quickly, motor making ticking noise, vehicle stopped near junction..."
            multiline
            rows={3}
            fullWidth
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
            {isSubmitting ? 'Registering & Sending...' : 'Register Complaint & Send'}
          </Button>

          <Typography variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mt: 2 }}>
            An SMS confirmation with tracking ID will be triggered to the provided mobile number.
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
