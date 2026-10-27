import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  ExternalLink,
  Layers,
  Plus,
  QrCode,
  Settings,
  Trash2,
  Wrench,
  Zap,
} from 'lucide-react';

import { useUsersQuery } from '@/api/mastersApi';
import {
  useCreateVSKitMutation,
  useCreateVSMaintenanceMutation,
  useCreateVSVehicleMutation,
  useGetVSKitsQuery,
  useGetVSMaintenanceQuery,
  useGetVSVehiclesQuery,
  useUpdateVSMaintenanceMutation,
} from '@/api/vehicleServiceApi';
import type {
  VSKit,
  VSKitCreate,
  VSMaintenanceCreate,
  VSVehicle,
  VSVehicleCreate,
} from '@/types/vehicleService';

const DEFAULT_KIT_COMPONENTS = [
  { component_type: 'BATTERY', label: 'Traction Battery Pack', is_required: true },
  { component_type: 'MOTOR', label: 'BLDC Traction Motor', is_required: true },
  { component_type: 'CONTROLLER', label: 'Intelligent Motor Controller', is_required: true },
  { component_type: 'CHARGER', label: 'Onboard Fast Charger', is_required: true },
  { component_type: 'WIRING_HARNESS', label: 'High-Voltage Wiring Harness', is_required: false },
  { component_type: 'DC_CONVERTER', label: 'DC-DC 12V Converter', is_required: false },
  { component_type: 'THROTTLE', label: 'Digital Electronic Throttle', is_required: false },
];

export default function VSConfigurationTab() {
  const [activeTab, setActiveTab] = useState(0);

  // Queries
  const { data: kits = [], isLoading: isKitsLoading, refetch: refetchKits } = useGetVSKitsQuery();
  const { data: vehicles = [], isLoading: isVehiclesLoading, refetch: refetchVehicles } = useGetVSVehiclesQuery();
  const { data: maintenanceList = [], isLoading: isMaintLoading, refetch: refetchMaint } = useGetVSMaintenanceQuery();
  const { data: users = [] } = useUsersQuery();

  // Mutations
  const [createKit, { isLoading: isCreatingKit }] = useCreateVSKitMutation();
  const [createVehicle, { isLoading: isCreatingVehicle }] = useCreateVSVehicleMutation();
  const [createMaintenance, { isLoading: isCreatingMaint }] = useCreateVSMaintenanceMutation();
  const [updateMaintenance] = useUpdateVSMaintenanceMutation();

  // Dialogs
  const [isKitDialogOpen, setIsKitDialogOpen] = useState(false);
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false);
  const [isMaintDialogOpen, setIsMaintDialogOpen] = useState(false);

  // New Kit Form State
  const [kitNumber, setKitNumber] = useState('');
  const [kitName, setKitName] = useState('');
  const [kitDescription, setKitDescription] = useState('');
  const [kitComponentTypes, setKitComponentTypes] = useState(DEFAULT_KIT_COMPONENTS);
  const [kitError, setKitError] = useState<string | null>(null);

  // New Vehicle Form State
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [selectedKitId, setSelectedKitId] = useState<number | ''>('');
  const [retrofitDate, setRetrofitDate] = useState(new Date().toISOString().slice(0, 10));
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerAddress, setOwnerAddress] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [initialMileage, setInitialMileage] = useState(0);
  const [componentSerials, setComponentSerials] = useState<Record<string, string>>({});
  const [vehicleError, setVehicleError] = useState<string | null>(null);

  // New Maintenance Form State
  const [maintVehicleId, setMaintVehicleId] = useState<number | ''>('');
  const [maintTitle, setMaintTitle] = useState('');
  const [maintType, setMaintType] = useState('1,000 KM First Free Inspection');
  const [maintDate, setMaintDate] = useState(new Date().toISOString().slice(0, 10));
  const [maintTechId, setMaintTechId] = useState<number | ''>('');
  const [maintCost, setMaintCost] = useState(0);
  const [maintNotes, setMaintNotes] = useState('');

  // Selected Kit for Vehicle Form
  const selectedKitObj = kits.find((k) => k.id === selectedKitId);

  useEffect(() => {
    if (selectedKitObj) {
      const serialsMap: Record<string, string> = {};
      selectedKitObj.component_types.forEach((ct) => {
        serialsMap[ct.id] = '';
      });
      setComponentSerials(serialsMap);
    }
  }, [selectedKitObj]);

  const handleCreateKitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kitNumber.trim() || !kitName.trim()) {
      setKitError('Please provide Kit Number and Kit Name.');
      return;
    }
    setKitError(null);

    const payload: VSKitCreate = {
      kit_number: kitNumber.trim().toUpperCase(),
      kit_name: kitName.trim(),
      description: kitDescription.trim() || undefined,
      component_types: kitComponentTypes,
    };

    try {
      await createKit(payload).unwrap();
      setIsKitDialogOpen(false);
      setKitNumber('');
      setKitName('');
      setKitDescription('');
      refetchKits();
    } catch (err: any) {
      setKitError(err?.data?.detail || 'Failed to create kit.');
    }
  };

  const handleCreateVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleNumber.trim() || !ownerName.trim() || !ownerPhone.trim()) {
      setVehicleError('Please provide Vehicle Registration No, Owner Name, and Contact Phone.');
      return;
    }
    setVehicleError(null);

    // Build components array from selected kit
    const componentsPayload: VSVehicleCreate['components'] = [];
    if (selectedKitObj) {
      selectedKitObj.component_types.forEach((ct) => {
        const serial = componentSerials[ct.id]?.trim();
        if (serial) {
          componentsPayload.push({
            component_type_id: ct.id,
            component_type: ct.component_type,
            component_label: ct.label,
            serial_number: serial,
            installed_date: retrofitDate || undefined,
          });
        }
      });
    }

    const payload: VSVehicleCreate = {
      vehicle_number: vehicleNumber.trim().toUpperCase(),
      chassis_number: chassisNumber.trim() || undefined,
      kit_id: selectedKitId ? Number(selectedKitId) : undefined,
      retrofit_date: retrofitDate || undefined,
      owner_name: ownerName.trim(),
      owner_phone: ownerPhone.trim(),
      owner_address: ownerAddress.trim() || undefined,
      warranty_expiry: warrantyExpiry || undefined,
      total_mileage_km: Number(initialMileage) || 0,
      components: componentsPayload,
    };

    try {
      await createVehicle(payload).unwrap();
      setIsVehicleDialogOpen(false);
      setVehicleNumber('');
      setChassisNumber('');
      setOwnerName('');
      setOwnerPhone('');
      setOwnerAddress('');
      setSelectedKitId('');
      setComponentSerials({});
      refetchVehicles();
    } catch (err: any) {
      setVehicleError(err?.data?.detail || 'Failed to register vehicle.');
    }
  };

  const handleCreateMaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintVehicleId || !maintTitle.trim() || !maintDate) {
      alert('Please fill all required fields.');
      return;
    }

    const payload: VSMaintenanceCreate = {
      vehicle_id: Number(maintVehicleId),
      title: maintTitle.trim(),
      service_type: maintType,
      scheduled_date: maintDate,
      technician_id: maintTechId ? Number(maintTechId) : undefined,
      cost: Number(maintCost) || 0,
      notes: maintNotes.trim() || undefined,
    };

    try {
      await createMaintenance(payload).unwrap();
      setIsMaintDialogOpen(false);
      setMaintTitle('');
      setMaintNotes('');
      refetchMaint();
    } catch (err: any) {
      alert(err?.data?.detail || 'Failed to schedule maintenance.');
    }
  };

  const handleCompleteMaint = async (id: number) => {
    try {
      await updateMaintenance({
        id,
        body: {
          status: 'COMPLETED',
          completed_date: new Date().toISOString().slice(0, 10),
        },
      }).unwrap();
      refetchMaint();
    } catch (err: any) {
      alert('Failed to mark maintenance completed.');
    }
  };

  return (
    <Box>
      {/* Top Header */}
      <Paper sx={{ p: 2.5, mb: 3, borderRadius: 3, border: '1px solid #e2e8f0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings size={20} color="#2563eb" />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={800}>
              Vehicle Service Master Configuration
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Manage EV retrofitment kits, vehicle registrations, component serial tracking, and QR code assets
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ borderRadius: 3, border: '1px solid #e2e8f0', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          sx={{ px: 2, borderBottom: '1px solid #e2e8f0' }}
        >
          <Tab label={`1. Kit Master (${kits.length})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
          <Tab label={`2. Retrofitted Vehicles (${vehicles.length})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
          <Tab label="3. QR Code Center" sx={{ textTransform: 'none', fontWeight: 700 }} />
          <Tab label={`4. Preventive Maintenance (${maintenanceList.length})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* =================================================================
              SUB-TAB 0: KIT MASTER
          ================================================================== */}
          {activeTab === 0 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={800}>
                    EV Conversion Kit Masters
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Define kit configurations with required components (battery, motor, controller, charger)
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<Plus size={16} />}
                  onClick={() => setIsKitDialogOpen(true)}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                >
                  Create Kit Master
                </Button>
              </Box>

              {kits.length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
                  <Layers size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: '#94a3b8' }} />
                  <Typography variant="subtitle1" fontWeight={700}>
                    No Kit Masters Configured
                  </Typography>
                  <Typography variant="body2" sx={{ maxWidth: 420, mx: 'auto', mt: 1 }}>
                    Click "Create Kit Master" to define the components that make up your 3-wheeler EV conversion kit.
                  </Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        <TableCell sx={{ fontWeight: 700 }}>Kit Number</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Kit Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Defined Components</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {kits.map((kit) => (
                        <TableRow key={kit.id} hover>
                          <TableCell sx={{ fontWeight: 800, color: '#2563eb' }}>
                            {kit.kit_number}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{kit.kit_name}</TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>{kit.description || '—'}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {kit.component_types.map((ct) => (
                                <Chip key={ct.id} label={ct.label} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                              ))}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip label={kit.is_active ? 'Active' : 'Archived'} size="small" color={kit.is_active ? 'success' : 'default'} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {/* =================================================================
              SUB-TAB 1: RETROFITTED VEHICLE MASTER
          ================================================================== */}
          {activeTab === 1 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={800}>
                    Retrofitted EV 3-Wheeler Registry
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Registered vehicles fitted with an EV kit and tracked component serial numbers
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<Plus size={16} />}
                  onClick={() => setIsVehicleDialogOpen(true)}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                >
                  Register Retrofitted Vehicle
                </Button>
              </Box>

              {vehicles.length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
                  <Wrench size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: '#94a3b8' }} />
                  <Typography variant="subtitle1" fontWeight={700}>
                    No Retrofitted Vehicles Registered
                  </Typography>
                  <Typography variant="body2" sx={{ maxWidth: 420, mx: 'auto', mt: 1 }}>
                    Click "Register Retrofitted Vehicle" to add a vehicle, assign its kit, and enter its component serial numbers.
                  </Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        <TableCell sx={{ fontWeight: 700 }}>Vehicle Reg No</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Kit Number</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Owner Details</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Fitted Component Serials</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Retrofit Date</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Warranty Expiry</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {vehicles.map((v) => (
                        <TableRow key={v.id} hover>
                          <TableCell sx={{ fontWeight: 800, color: '#0f172a' }}>
                            {v.vehicle_number}
                          </TableCell>
                          <TableCell>
                            <Chip label={v.kit_number || 'Default Kit'} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" fontWeight={700} display="block">
                              {v.owner_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {v.owner_phone}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {v.components.map((comp) => (
                                <Tooltip key={comp.id} title={`${comp.component_label}: ${comp.serial_number}`}>
                                  <Chip
                                    label={`${comp.component_type.slice(0, 3)}: ${comp.serial_number}`}
                                    size="small"
                                    sx={{ fontSize: 10, height: 22 }}
                                  />
                                </Tooltip>
                              ))}
                            </Box>
                          </TableCell>
                          <TableCell>{v.retrofit_date || '—'}</TableCell>
                          <TableCell>{v.warranty_expiry || '—'}</TableCell>
                          <TableCell>
                            <Chip label={v.is_active ? 'Active' : 'Inactive'} size="small" color={v.is_active ? 'success' : 'default'} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {/* =================================================================
              SUB-TAB 2: QR CODE CENTER
          ================================================================== */}
          {activeTab === 2 && (
            <Box>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" fontWeight={800}>
                  Universal Customer Service QR Code
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  One universal QR code sticker for all customers and retrofitted 3-wheelers. Customers scan this QR to open the instant complaint registration window, enter their vehicle number, name and mobile number.
                </Typography>
              </Box>

              <UniversalQRCard />
            </Box>
          )}

          {/* =================================================================
              SUB-TAB 3: PREVENTIVE MAINTENANCE SCHEDULER
          ================================================================== */}
          {activeTab === 3 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={800}>
                    Preventive Maintenance Schedules
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Mileage and interval based inspection reminders for battery health, wiring checks, and mechanical wear
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<Plus size={16} />}
                  onClick={() => setIsMaintDialogOpen(true)}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                >
                  Schedule Maintenance
                </Button>
              </Box>

              {maintenanceList.length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
                  <Calendar size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: '#94a3b8' }} />
                  <Typography variant="subtitle1" fontWeight={700}>
                    No Maintenance Schedules Found
                  </Typography>
                  <Typography variant="body2" sx={{ maxWidth: 420, mx: 'auto', mt: 1 }}>
                    Schedule preventive battery checks, motor lubrications, or brake inspections for your retrofitted vehicles.
                  </Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        <TableCell sx={{ fontWeight: 700 }}>Vehicle</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Service Title</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Scheduled Date</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Technician</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Cost</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {maintenanceList.map((m) => (
                        <TableRow key={m.id} hover>
                          <TableCell sx={{ fontWeight: 800 }}>{m.vehicle_number || `Vehicle #${m.vehicle_id}`}</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{m.title}</TableCell>
                          <TableCell>{m.service_type}</TableCell>
                          <TableCell>{m.scheduled_date}</TableCell>
                          <TableCell>{m.technician_name || 'Unassigned'}</TableCell>
                          <TableCell>
                            <Chip
                              label={m.status}
                              size="small"
                              color={m.status === 'COMPLETED' ? 'success' : m.status === 'IN_PROGRESS' ? 'primary' : 'warning'}
                              sx={{ fontWeight: 700 }}
                            />
                          </TableCell>
                          <TableCell align="right">₹{m.cost.toFixed(2)}</TableCell>
                          <TableCell align="right">
                            {m.status !== 'COMPLETED' && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="success"
                                onClick={() => handleCompleteMaint(m.id)}
                                sx={{ textTransform: 'none', fontSize: 11, py: 0.2 }}
                              >
                                Mark Completed
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </Box>
      </Paper>

      {/* =====================================================================
          MODAL: CREATE KIT MASTER
      ====================================================================== */}
      <Dialog open={isKitDialogOpen} onClose={() => setIsKitDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Create EV Conversion Kit Master</DialogTitle>
        <DialogContent dividers>
          {kitError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {kitError}
            </Alert>
          )}

          <TextField
            label="Kit Identifier Number *"
            placeholder="e.g. KIT-EV-3W-001"
            size="small"
            fullWidth
            required
            value={kitNumber}
            onChange={(e) => setKitNumber(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Kit Model Name *"
            placeholder="e.g. 60V High-Torque Auto-Rickshaw EV Kit"
            size="small"
            fullWidth
            required
            value={kitName}
            onChange={(e) => setKitName(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Description / Specifications"
            multiline
            rows={2}
            fullWidth
            value={kitDescription}
            onChange={(e) => setKitDescription(e.target.value)}
            sx={{ mb: 3 }}
          />

          <Typography variant="subtitle2" fontWeight={800} gutterBottom>
            Standard Components Included in Kit ({kitComponentTypes.length})
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
            Every retrofitted vehicle using this kit will track individual serial numbers for these components:
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {kitComponentTypes.map((comp, idx) => (
              <Box
                key={idx}
                sx={{
                  p: 1.2,
                  borderRadius: 1.5,
                  bgcolor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box>
                  <Typography variant="body2" fontWeight={700}>
                    {comp.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Type: {comp.component_type} • {comp.is_required ? 'Mandatory' : 'Optional'}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => setKitComponentTypes(kitComponentTypes.filter((_, i) => i !== idx))}
                >
                  <Trash2 size={16} />
                </IconButton>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIsKitDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateKitSubmit}
            disabled={isCreatingKit}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {isCreatingKit ? 'Saving...' : 'Save Kit Master'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* =====================================================================
          MODAL: REGISTER RETROFITTED VEHICLE
      ====================================================================== */}
      <Dialog open={isVehicleDialogOpen} onClose={() => setIsVehicleDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Register Retrofitted Vehicle & Load Kit Components</DialogTitle>
        <DialogContent dividers>
          {vehicleError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {vehicleError}
            </Alert>
          )}

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Vehicle Registration Number *"
                placeholder="e.g. MH12AB1234"
                size="small"
                fullWidth
                required
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Chassis / Frame Number"
                size="small"
                fullWidth
                value={chassisNumber}
                onChange={(e) => setChassisNumber(e.target.value)}
              />
            </Grid>
          </Grid>

          {/* Kit Selector */}
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Assign EV Conversion Kit Master *</InputLabel>
            <Select
              value={selectedKitId}
              label="Assign EV Conversion Kit Master *"
              onChange={(e) => setSelectedKitId(Number(e.target.value))}
            >
              {kits.map((k) => (
                <MenuItem key={k.id} value={k.id}>
                  {k.kit_number} — {k.kit_name} ({k.component_types.length} Components)
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Customer / Owner Details */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Owner / Fleet Operator Name *"
                size="small"
                fullWidth
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Contact Phone *"
                size="small"
                fullWidth
                required
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Retrofit Date"
                type="date"
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={retrofitDate}
                onChange={(e) => setRetrofitDate(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Warranty Expiry"
                type="date"
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={warrantyExpiry}
                onChange={(e) => setWarrantyExpiry(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Initial Mileage (KM)"
                type="number"
                size="small"
                fullWidth
                value={initialMileage}
                onChange={(e) => setInitialMileage(Number(e.target.value))}
              />
            </Grid>
          </Grid>

          {/* COMPONENT SERIAL NUMBER INPUT FIELDS (Dynamic from Kit!) */}
          {selectedKitObj && selectedKitObj.component_types.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc' }}>
              <Typography variant="subtitle2" fontWeight={800} color="#0f172a" gutterBottom>
                Load Component Serial Numbers for this Vehicle's Kit:
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                Enter the unique serial number of each component physically installed in this 3-wheeler:
              </Typography>

              <Grid container spacing={2}>
                {selectedKitObj.component_types.map((ct) => (
                  <Grid item xs={12} sm={6} key={ct.id}>
                    <TextField
                      label={`${ct.label} (Serial No) *`}
                      placeholder={`e.g. SN-${ct.component_type.slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`}
                      size="small"
                      fullWidth
                      required={ct.is_required}
                      value={componentSerials[ct.id] || ''}
                      onChange={(e) =>
                        setComponentSerials({
                          ...componentSerials,
                          [ct.id]: e.target.value,
                        })
                      }
                    />
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIsVehicleDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateVehicleSubmit}
            disabled={isCreatingVehicle}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {isCreatingVehicle ? 'Registering...' : 'Complete Vehicle Registration'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* =====================================================================
          MODAL: SCHEDULE MAINTENANCE
      ====================================================================== */}
      <Dialog open={isMaintDialogOpen} onClose={() => setIsMaintDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Schedule Preventive Maintenance</DialogTitle>
        <DialogContent dividers>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Retrofitted Vehicle *</InputLabel>
            <Select
              value={maintVehicleId}
              label="Retrofitted Vehicle *"
              onChange={(e) => setMaintVehicleId(Number(e.target.value))}
            >
              {vehicles.map((v) => (
                <MenuItem key={v.id} value={v.id}>
                  {v.vehicle_number} — {v.owner_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Service Title *"
            placeholder="e.g. 5,000 KM General Inspection"
            size="small"
            fullWidth
            required
            value={maintTitle}
            onChange={(e) => setMaintTitle(e.target.value)}
            sx={{ mb: 2 }}
          />

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <TextField
                label="Scheduled Date *"
                type="date"
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={maintDate}
                onChange={(e) => setMaintDate(e.target.value)}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Estimated Cost (₹)"
                type="number"
                size="small"
                fullWidth
                value={maintCost}
                onChange={(e) => setMaintCost(Number(e.target.value))}
              />
            </Grid>
          </Grid>

          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Assigned Technician</InputLabel>
            <Select
              value={maintTechId}
              label="Assigned Technician"
              onChange={(e) => setMaintTechId(e.target.value as number | '')}
            >
              <MenuItem value="">
                <em>Unassigned</em>
              </MenuItem>
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.full_name} ({u.role})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Notes / Specific Checklist"
            multiline
            rows={2}
            fullWidth
            value={maintNotes}
            onChange={(e) => setMaintNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIsMaintDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateMaintSubmit}
            disabled={isCreatingMaint}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {isCreatingMaint ? 'Scheduling...' : 'Confirm Schedule'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Sub-component for rendering Universal Customer Service QR Code
function UniversalQRCard() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const registerUrl = `${window.location.origin}/vs/register`;

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, registerUrl, {
        width: 220,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
    }
  }, [registerUrl]);

  const handleDownload = () => {
    if (canvasRef.current) {
      const url = canvasRef.current.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `Universal_Customer_Service_QR_Sticker.png`;
      a.click();
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    printWindow.document.write(`
      <html>
        <head>
          <title>Universal EV Service QR Sticker</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .sticker { border: 2px dashed #0f172a; padding: 24px; border-radius: 16px; text-align: center; max-width: 340px; }
            h2 { margin: 0 0 8px 0; font-size: 18px; color: #0f172a; }
            p { margin: 4px 0; font-size: 13px; color: #475569; }
            img { margin: 12px auto; display: block; }
            .url { font-family: monospace; font-size: 12px; color: #2563eb; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="sticker">
            <h2>⚡ EV 3-WHEELER SERVICE</h2>
            <p>Scan to Register Instant Complaint</p>
            <img src="${dataUrl}" width="220" height="220" />
            <p class="url">${registerUrl}</p>
            <p style="font-size: 11px; margin-top: 8px;">Auto-Rickshaw Retrofit Support & Emergency Dispatch</p>
          </div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Card sx={{ maxWidth: 540, mx: 'auto', borderRadius: 4, border: '1.5px solid #cbd5e1', boxShadow: '0 8px 30px rgba(0,0,0,0.06)', p: 3, textAlign: 'center' }}>
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, bgcolor: '#eff6ff', px: 2, py: 0.8, borderRadius: 9999, mb: 2 }}>
        <Zap size={16} color="#2563eb" />
        <Typography variant="caption" fontWeight={700} color="#2563eb">
          UNIVERSAL FLEET SERVICE STICKER
        </Typography>
      </Box>

      <Typography variant="h6" fontWeight={800} color="#0f172a" gutterBottom>
        Scan to Report EV Service / Breakdown
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, mx: 'auto', mb: 2.5 }}>
        Affix this sticker on the dashboard of all retrofitted 3-wheelers. Drivers scan this QR with any smartphone to enter their vehicle number, mobile number, and register a service request with automatic GPS capture.
      </Typography>

      <Box sx={{ p: 2, bgcolor: '#ffffff', borderRadius: 3, display: 'inline-block', border: '1.5px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.04)', mb: 2 }}>
        <canvas ref={canvasRef} />
      </Box>

      <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: '#f1f5f9', px: 1.5, py: 0.8, borderRadius: 1.5, display: 'block', maxWidth: 360, mx: 'auto', mb: 3, fontWeight: 700, color: '#2563eb' }}>
        {registerUrl}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          startIcon={<Download size={16} />}
          onClick={handleDownload}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }}
        >
          Download Sticker (PNG)
        </Button>
        <Button
          variant="outlined"
          onClick={handlePrint}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Print Sticker
        </Button>
        <Button
          variant="text"
          href="/vs/register"
          target="_blank"
          rel="noreferrer"
          endIcon={<ExternalLink size={14} />}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Test Public URL
        </Button>
      </Box>
    </Card>
  );
}
