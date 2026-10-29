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
  Grid,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircle2,
  MapPin,
  MessageSquare,
  Send,
  Zap,
} from 'lucide-react';

import {
  useGetVSPublicVehicleQuery,
  useGetVSPublicCategoriesQuery,
  useSubmitVSPublicComplaintMutation,
  useSubmitVSUniversalComplaintMutation,
} from '@/api/vehicleServiceApi';
import type { VSUniversalComplaintCreate } from '@/types/vehicleService';
import { reverseGeocodeAreaAndCity } from '@/utils/geolocation';
import { AppDropdown } from '@/components/ui/AppDropdown';

const DEFAULT_CATEGORIES = [
  { key: 'BREAKDOWN', label: 'Vehicle Breakdown' },
  { key: 'BATTERY', label: 'Battery / Range Issue' },
  { key: 'MOTOR', label: 'Motor Issue' },
  { key: 'CONTROLLER', label: 'Controller / Throttle' },
  { key: 'CHARGING', label: 'Charging Failure' },
  { key: 'PERFORMANCE', label: 'Speed / Performance' },
  { key: 'OTHER', label: 'Other Issue' },
];

export default function VehicleServiceRegisterPage() {
  const { qrToken } = useParams<{ qrToken: string }>();

  // If accessed via vehicle-specific QR token
  const { data: tokenVehicle } = useGetVSPublicVehicleQuery(qrToken || '', {
    skip: !qrToken,
  });

  // Dynamic complaint categories from Configuration
  const { data: configCategories = [] } = useGetVSPublicCategoriesQuery();
  const categoriesToDisplay = configCategories.length > 0 ? configCategories : DEFAULT_CATEGORIES;

  const [submitUniversal, { isLoading: isSubmittingUniversal }] = useSubmitVSUniversalComplaintMutation();
  const [submitByToken, { isLoading: isSubmittingToken }] = useSubmitVSPublicComplaintMutation();

  const isSubmitting = isSubmittingUniversal || isSubmittingToken;

  // Form Fields
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [reportedBy, setReportedBy] = useState('');
  const [reportedPhone, setReportedPhone] = useState('');
  const [category, setCategory] = useState('BREAKDOWN');
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
      if (!reportedBy) setReportedBy(tokenVehicle.owner_name);
      if (!reportedPhone) setReportedPhone(tokenVehicle.owner_phone);
    }
  }, [tokenVehicle]);

  useEffect(() => {
    if (categoriesToDisplay.length > 0 && !category) {
      setCategory(categoriesToDisplay[0].key);
    }
  }, [categoriesToDisplay, category]);

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
      severity: 'MEDIUM',
      description: desc,
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

  const selectedCategoryLabel =
    categoriesToDisplay.find((c) => c.key === category)?.label || category;

  // Success Screen (Image 2)
  if (submittedComplaintNo) {
    return (
      <Box sx={{ minHeight: '100dvh', bgcolor: '#F8FAF8', py: { xs: 4, sm: 8 } }}>
        <Container maxWidth="sm">
          <Paper
          sx={{
            p: 4,
            textAlign: 'center',
            borderRadius: 4,
            boxShadow: '0 8px 30px rgba(32, 48, 32, 0.08)',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8E2',
          }}
        >
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              bgcolor: '#EAF0EA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
            }}
          >
            <CheckCircle2 size={42} color="#203020" />
          </Box>
          <Typography variant="h5" fontWeight={800} color="#203020" gutterBottom>
            Service Request Registered
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Your complaint has been assigned to the on-call emergency technician team.
          </Typography>

          <Box sx={{ p: 2, bgcolor: '#F3F7F3', border: '1px solid #C9E0C6', borderRadius: 2, mb: 2.5 }}>
            <Typography variant="caption" sx={{ color: '#526356' }} display="block">
              Complaint / Work Order Tracking ID
            </Typography>
            <Typography variant="h5" fontWeight={800} sx={{ color: '#203020', letterSpacing: 0.5 }}>
              {submittedComplaintNo}
            </Typography>
          </Box>

          {/* SMS Notification Banner (Updated text and deep green emerald theme) */}
          <Box
            sx={{
              p: 1.5,
              bgcolor: '#EAF0EA',
              borderRadius: 2,
              border: '1px solid #C9E0C6',
              mb: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 1.2,
            }}
          >
            <MessageSquare size={18} color="#203020" />
            <Typography variant="caption" fontWeight={600} color="#203020" textAlign="left">
              You will receive confirmation and ticket ID by SMS.
            </Typography>
          </Box>

          {/* Vehicle and Category info only (No GPS, No Severity) */}
          <Box sx={{ textAlign: 'left', p: 2, bgcolor: '#F8FAF8', border: '1px solid #E2E8E2', borderRadius: 2, mb: 3 }}>
            <Typography variant="body2" sx={{ mb: 0.8, color: '#16231B' }}>
              <strong>Vehicle Number:</strong> {vehicleNumber.toUpperCase()}
            </Typography>
            <Typography variant="body2" sx={{ color: '#16231B' }}>
              <strong>Category:</strong> {selectedCategoryLabel}
            </Typography>
          </Box>

          <Button
            variant="contained"
            fullWidth
            onClick={() => {
              setSubmittedComplaintNo(null);
              setDescription('');
            }}
            sx={{
              borderRadius: 2.5,
              py: 1.3,
              textTransform: 'none',
              fontWeight: 700,
              bgcolor: '#203020',
              '&:hover': { bgcolor: '#172417' },
            }}
          >
            Register Another Request
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: '#F8FAF8', py: { xs: 2, sm: 6 }, pb: 'max(24px, env(safe-area-inset-bottom, 0px))' }}>
      <Container maxWidth="sm">
        {/* Header (Subtitle removed) */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: '#EAF0EA',
              px: 2,
              py: 0.8,
              borderRadius: 9999,
              mb: 1.5,
            }}
          >
            <Zap size={18} color="#203020" />
            <Typography variant="caption" fontWeight={700} color="#203020">
              EV 3-WHEELER RETROFIT SERVICE
            </Typography>
          </Box>
          <Typography variant="h5" fontWeight={800} color="#203020">
            Register Service Complaint
          </Typography>
        </Box>

        {/* GPS Location Status Card */}
        <Card sx={{ mb: 2.5, borderRadius: 3, border: '1px solid #E2E8E2', boxShadow: 'none', backgroundColor: '#FFFFFF' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: gps ? '#EAF0EA' : '#FEF3C7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MapPin size={16} color={gps ? '#203020' : '#D97706'} />
                </Box>
                <Box>
                  <Typography variant="caption" fontWeight={700} color={gps ? '#203020' : '#D97706'} display="block">
                    {gps ? (gpsAddress || 'GPS Location Captured') : gpsLoading ? 'Detecting Location...' : 'Location Pending'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {gps ? `${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : 'Helps emergency dispatch locate your vehicle'}
                  </Typography>
                </Box>
              </Box>
              <Button
                size="small"
                onClick={captureGps}
                disabled={gpsLoading}
                sx={{ textTransform: 'none', fontSize: 11, color: '#203020', fontWeight: 600 }}
              >
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
        <Paper
          component="form"
          onSubmit={handleSubmit}
          sx={{ p: 3, borderRadius: 3, border: '1px solid #E2E8E2', backgroundColor: '#FFFFFF' }}
        >
          {submitError && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
              {submitError}
            </Alert>
          )}

          {/* Vehicle Registration Number */}
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.8, color: '#16231B' }}>
            Vehicle Registration Number *
          </Typography>
          <TextField
            placeholder="e.g. MH12AB1234"
            size="small"
            required
            fullWidth
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
            helperText="Enter your 3-wheeler auto registration number"
            sx={{
              mb: 2.5,
              '& .MuiOutlinedInput-root.Mui-focused fieldset': {
                borderColor: '#203020',
              },
            }}
          />

          {/* Customer Details */}
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Your Name"
                size="small"
                required
                fullWidth
                value={reportedBy}
                onChange={(e) => setReportedBy(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root.Mui-focused fieldset': {
                    borderColor: '#203020',
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Mobile Number (for SMS)"
                placeholder="10-digit mobile"
                size="small"
                required
                fullWidth
                value={reportedPhone}
                onChange={(e) => setReportedPhone(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root.Mui-focused fieldset': {
                    borderColor: '#203020',
                  },
                }}
              />
            </Grid>
          </Grid>

          {/* Complaint Category Dropdown from Configuration */}
          <Box sx={{ mb: 2.5 }}>
            <AppDropdown
              label="Complaint Category"
              required
              value={category}
              options={categoriesToDisplay.map((cat) => ({
                value: cat.key,
                label: cat.label,
              }))}
              onChange={(val) => setCategory(String(val))}
            />
          </Box>

          {/* Problem Description (Optional) */}
          <TextField
            label="Describe the problem / issue symptoms (Optional)"
            placeholder="e.g. Battery percentage dropped quickly, motor making ticking noise, vehicle stopped near junction..."
            multiline
            rows={3}
            fullWidth
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            sx={{
              mb: 3,
              '& .MuiOutlinedInput-root.Mui-focused fieldset': {
                borderColor: '#203020',
              },
            }}
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
              bgcolor: '#203020',
              '&:hover': { bgcolor: '#172417' },
            }}
          >
            {isSubmitting ? 'Registering & Sending...' : 'Register Complaint & Send'}
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}
