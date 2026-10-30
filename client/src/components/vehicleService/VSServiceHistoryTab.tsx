import React, { useState, useMemo } from 'react';
import {
  Alert,
  Autocomplete,
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
  Rating,
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
  BatteryCharging,
  CheckCircle2,
  Clock,
  Cpu,
  History,
  MapPin,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  Wrench,
  Zap,
} from 'lucide-react';

import {
  useCreateVSVehicleMutation,
  useGetVSComplaintsQuery,
  useGetVSKitsQuery,
  useGetVSMaintenanceQuery,
  useGetVSVehiclesQuery,
  useReplaceVSComponentMutation,
} from '@/api/vehicleServiceApi';
import type { VSKit, VSVehicle, VSVehicleComponent } from '@/types/vehicleService';
import { useToast } from '@/components/ui/ToastHost';
import { formatDate, formatDateTime } from '@/utils/format';

export default function VSServiceHistoryTab() {
  const { showToast } = useToast();
  const { data: kits = [], isLoading: isKitsLoading } = useGetVSKitsQuery();
  const { data: vehicles = [], isLoading: isVehiclesLoading, refetch: refetchVehicles } = useGetVSVehiclesQuery();
  const [createVehicle] = useCreateVSVehicleMutation();

  const [selectedKitId, setSelectedKitId] = useState<number | ''>('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | ''>('');
  const [activeSubTab, setActiveSubTab] = useState<number>(0);
  const [kitSearchInput, setKitSearchInput] = useState('');

  const selectedKit: VSKit | undefined = kits.find((k) => k.id === selectedKitId);
  const matchingVehicle: VSVehicle | undefined = vehicles.find(
    (v) =>
      selectedKit &&
      (v.kit_id === selectedKit.id ||
        (selectedKit.vehicle_number &&
          v.vehicle_number.toUpperCase() === selectedKit.vehicle_number.toUpperCase()))
  );
  const effectiveVehicle: VSVehicle | undefined =
    matchingVehicle || (selectedVehicleId ? vehicles.find((v) => v.id === selectedVehicleId) : undefined);

  // Queries for selected vehicle / kit
  const vehicleIdForQuery = effectiveVehicle?.id;
  const { data: vehicleComplaints = [] } = useGetVSComplaintsQuery(
    { vehicle_id: vehicleIdForQuery },
    { skip: !vehicleIdForQuery },
  );

  const { data: vehicleMaintenance = [] } = useGetVSMaintenanceQuery(
    { vehicle_id: vehicleIdForQuery },
    { skip: !vehicleIdForQuery },
  );

  const [replaceComponent, { isLoading: isReplacing }] = useReplaceVSComponentMutation();

  // Replacement dialog
  const [selectedCompForReplace, setSelectedCompForReplace] = useState<VSVehicleComponent | null>(null);
  const [newSerial, setNewSerial] = useState('');
  const [replaceReason, setReplaceReason] = useState('');

  const handleOpenReplace = (comp: VSVehicleComponent) => {
    setSelectedCompForReplace(comp);
    setNewSerial('');
    setReplaceReason('');
  };

  const handleConfirmReplace = async () => {
    if ((!effectiveVehicle && !selectedKit) || !selectedCompForReplace || !newSerial.trim()) {
      showToast('Please specify the new serial number.', 'error');
      return;
    }

    try {
      let targetVehicleId = effectiveVehicle?.id;
      if (!targetVehicleId && selectedKit) {
        // Auto-create vehicle in registry for this kit
        const newVeh = await createVehicle({
          vehicle_number: (selectedKit.vehicle_number || selectedKit.kit_number).trim().toUpperCase(),
          kit_id: selectedKit.id,
          owner_name: selectedKit.customer_name || 'Customer',
          owner_phone: '0000000000',
          retrofit_date: selectedKit.installed_on || undefined,
          components: selectedKit.component_types.map((ct) => ({
            component_type_id: ct.id,
            component_type: ct.component_type,
            component_label: ct.label,
            serial_number: ct.serial_number || `${ct.component_type}-SN`,
            installed_date: selectedKit.installed_on || undefined,
          })),
        }).unwrap();
        targetVehicleId = newVeh.id;
        refetchVehicles();
      }

      if (targetVehicleId) {
        await replaceComponent({
          vehicleId: targetVehicleId,
          componentId: selectedCompForReplace.id,
          body: {
            new_serial_number: newSerial.trim().toUpperCase(),
            replaced_date: new Date().toISOString().slice(0, 10),
            reason: replaceReason.trim() || 'Manual service replacement',
          },
        }).unwrap();
      }

      showToast('Component serial replaced successfully', 'success');
      setSelectedCompForReplace(null);
      refetchVehicles();
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to replace component serial.', 'error');
    }
  };

  const activeComponents = useMemo(() => {
    if (effectiveVehicle?.components && effectiveVehicle.components.length > 0) {
      return effectiveVehicle.components;
    }
    if (selectedKit?.component_types && selectedKit.component_types.length > 0) {
      return selectedKit.component_types.map((ct) => ({
        id: ct.id,
        vehicle_id: effectiveVehicle?.id || 0,
        component_type_id: ct.id,
        component_type: ct.component_type,
        component_label: ct.label,
        serial_number: ct.serial_number || '—',
        installed_date: selectedKit.installed_on,
        is_active: true,
        created_at: ct.created_at,
        updated_at: ct.created_at,
        history: [],
      })) as VSVehicleComponent[];
    }
    return [];
  }, [effectiveVehicle, selectedKit]);

  // Compile full replacement history across all components in this vehicle
  const allHistory = (effectiveVehicle?.components || []).flatMap((c) =>
    (c.history || []).map((h) => ({
      ...h,
      component_label: c.component_label,
      component_type: c.component_type,
    })),
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Build Autocomplete options — only shown when input has ≥4 characters
  type KitOption = { id: number; label: string };
  const kitOptions = useMemo<KitOption[]>(() => {
    const q = kitSearchInput.trim().toLowerCase();
    if (q.length < 4) return [];
    return kits
      .filter((k) => {
        const vehicleNum = (k.vehicle_number || '').toLowerCase();
        const customerName = (k.customer_name || '').toLowerCase();
        const kitName = (k.kit_name || '').toLowerCase();
        const kitNumber = (k.kit_number || '').toLowerCase();
        return (
          vehicleNum.includes(q) ||
          customerName.includes(q) ||
          kitName.includes(q) ||
          kitNumber.includes(q)
        );
      })
      .map((k) => ({
        id: k.id,
        label: `${k.vehicle_number ? `${k.vehicle_number} — ` : ''}${k.kit_name} (${k.kit_number})${k.customer_name ? ` — ${k.customer_name}` : ''}`,
      }));
  }, [kits, kitSearchInput]);

  const selectedKitOption = useMemo<KitOption | null>(() => {
    if (!selectedKitId) return null;
    const fromOptions = kitOptions.find((o) => o.id === selectedKitId);
    if (fromOptions) return fromOptions;
    // Fall back to building from kits list so the value persists after selection
    const k = kits.find((k) => k.id === selectedKitId);
    if (!k) return null;
    return {
      id: k.id,
      label: `${k.vehicle_number ? `${k.vehicle_number} — ` : ''}${k.kit_name} (${k.kit_number})${k.customer_name ? ` — ${k.customer_name}` : ''}`,
    };
  }, [selectedKitId, kitOptions, kits]);

  const handleKitSelect = (option: KitOption | null) => {
    const kid = option ? option.id : '';
    setSelectedKitId(kid);
    const matchedVeh = vehicles.find(
      (v) =>
        kid &&
        (v.kit_id === kid ||
          (kits.find((k) => k.id === kid)?.vehicle_number &&
            v.vehicle_number.toUpperCase() ===
              kits.find((k) => k.id === kid)?.vehicle_number?.toUpperCase()))
    );
    setSelectedVehicleId(matchedVeh ? matchedVeh.id : '');
  };

  return (
    <div>
      {/* Header matching CRM */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3, color: '#023020' }}>
            Vehicle Service & Component History
          </div>
          <div style={{ fontSize: 13, color: '#7A8B80', marginTop: 3 }}>
            Track full life-cycle history, kit component serials, and parts replacements.
          </div>
        </div>

        <div style={{ minWidth: 320 }}>
          <Autocomplete<KitOption>
            options={kitOptions}
            getOptionLabel={(opt) => opt.label}
            isOptionEqualToValue={(opt, val) => opt.id === val.id}
            value={selectedKitOption}
            inputValue={kitSearchInput}
            onInputChange={(_e, val, reason) => {
              if (reason !== 'reset') setKitSearchInput(val);
            }}
            onChange={(_e, val) => {
              handleKitSelect(val);
              if (val) setKitSearchInput(val.label);
            }}
            filterOptions={(opts) => opts}
            noOptionsText={
              kitSearchInput.trim().length < 4
                ? 'Type at least 4 characters to search'
                : 'No matching vehicle / kit found'
            }
            loading={isKitsLoading}
            clearOnBlur={false}
            blurOnSelect
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                label="Search Vehicle / Kit"
                placeholder="Type vehicle number or name (min. 4 chars)"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {isKitsLoading ? <CircularProgress size={16} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    fontSize: 13,
                    '& fieldset': { borderColor: '#E2E8E2' },
                    '&:hover fieldset': { borderColor: '#023020' },
                    '&.Mui-focused fieldset': { borderColor: '#023020', borderWidth: '1.5px' },
                  },
                  '& .MuiInputLabel-root': { fontSize: 13, fontWeight: 600, color: '#526356' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#023020' },
                }}
              />
            )}
            renderOption={(props, opt) => (
              <li {...props} key={opt.id}>
                <Typography sx={{ fontSize: 13 }}>{opt.label}</Typography>
              </li>
            )}
            slotProps={{
              paper: {
                sx: {
                  borderRadius: '8px',
                  border: '1px solid #E2E8E2',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  mt: 0.5,
                  '& .MuiAutocomplete-listbox': { py: 0.5 },
                  '& .MuiAutocomplete-option': { fontSize: 13, py: 1, px: 1.5 },
                },
              },
            }}
          />
        </div>
      </div>

      {!selectedKit && !effectiveVehicle ? (
        <Paper sx={{ py: 12, textAlign: 'center', borderRadius: 3, border: '1px solid #e2e8f0', color: 'text.secondary' }}>
          <History size={56} strokeWidth={1} style={{ margin: '0 auto 16px', color: '#94a3b8' }} />
          <Typography variant="h6" fontWeight={700}>
            Select a Vehicle / Kit to View History
          </Typography>
          <Typography variant="body2" sx={{ maxWidth: 460, mx: 'auto', mt: 1 }}>
            Search by vehicle number or customer name (minimum 4 characters) to inspect its tracked component serial numbers, replacement audit trail, and service history.
          </Typography>
        </Paper>
      ) : (
        <Box>
          {/* Vehicle Profile Card */}
          <Paper sx={{ p: 3, mb: 3, borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={7}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
                  <Typography variant="h5" fontWeight={900} color="#0f172a">
                    {selectedKit?.vehicle_number || effectiveVehicle?.vehicle_number || selectedKit?.kit_name || 'Vehicle'}
                  </Typography>
                  <Chip
                    label={`Kit: ${selectedKit?.kit_number || effectiveVehicle?.kit_number || 'Standard'}`}
                    color="primary"
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                  <Chip
                    label={selectedKit ? (selectedKit.is_active ? 'Active Kit' : 'Archived') : (effectiveVehicle?.is_active ? 'Active Fleet' : 'Inactive')}
                    color={(selectedKit ? selectedKit.is_active : effectiveVehicle?.is_active) ? 'success' : 'default'}
                    size="small"
                  />
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Customer / Owner
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {selectedKit?.customer_name || effectiveVehicle?.owner_name || '—'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Contact Phone
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {effectiveVehicle?.owner_phone || '—'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Chassis / Frame No
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {effectiveVehicle?.chassis_number || '—'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Installation Done On
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {selectedKit?.installed_on ? formatDate(selectedKit.installed_on) : effectiveVehicle?.retrofit_date ? formatDate(effectiveVehicle.retrofit_date) : '—'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Warranty Expiry
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {effectiveVehicle?.warranty_expiry ? formatDate(effectiveVehicle.warranty_expiry) : '—'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Recorded Mileage
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {effectiveVehicle?.total_mileage_km || 0} KM
                    </Typography>
                  </Grid>
                </Grid>
              </Grid>

              <Grid item xs={12} md={5}>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: '#f8fafc',
                    borderRadius: 2,
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary">
                      QR REGISTRATION TOKEN
                    </Typography>
                    {effectiveVehicle?.qr_token && (
                      <Button
                        size="small"
                        href={`/vs/register/${effectiveVehicle.qr_token}`}
                        target="_blank"
                        rel="noreferrer"
                        sx={{ textTransform: 'none', fontSize: 11 }}
                      >
                        Open Form
                      </Button>
                    )}
                  </Box>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: '#ffffff', p: 1, borderRadius: 1, border: '1px solid #cbd5e1' }}>
                    {effectiveVehicle?.qr_token || 'Available once vehicle is assigned'}
                  </Typography>
                  {effectiveVehicle?.qr_token && (
                    <Typography variant="caption" color="text.secondary">
                      URL: {window.location.origin}/vs/register/{effectiveVehicle.qr_token}
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Sub-Tabs */}
          <Paper sx={{ borderRadius: 3, border: '1px solid #e2e8f0', mb: 3 }}>
            <Tabs
              value={activeSubTab}
              onChange={(_, val) => setActiveSubTab(val)}
              sx={{ px: 2, borderBottom: '1px solid #e2e8f0' }}
            >
              <Tab label={`Active Kit Components (${activeComponents.length})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
              <Tab label={`Component Replacement History (${allHistory.length})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
              <Tab label={`Work Orders & Maintenance (${vehicleComplaints.length + vehicleMaintenance.length})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
            </Tabs>

            <Box sx={{ p: 3 }}>
              {/* TAB 0: Active Components */}
              {activeSubTab === 0 && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight={800}>
                      Currently Fitted Components (Kit: {selectedKit?.kit_number || effectiveVehicle?.kit_number || 'Default'})
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Each component is tracked with its unique serial number for warranty and failure analysis
                    </Typography>
                  </Box>

                  {activeComponents.length === 0 ? (
                    <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                      <Typography variant="body2">No components registered for this kit / vehicle.</Typography>
                    </Box>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 700 }}>Component</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Active Serial Number</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Installed Date</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Replacement Count</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {activeComponents.map((comp) => (
                            <TableRow key={comp.id} hover>
                              <TableCell sx={{ fontWeight: 700 }}>{comp.component_label}</TableCell>
                              <TableCell>
                                <Chip label={comp.component_type} size="small" variant="outlined" />
                              </TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                                {comp.serial_number}
                              </TableCell>
                              <TableCell>{comp.installed_date ? formatDate(comp.installed_date) : '—'}</TableCell>
                              <TableCell>
                                <Chip
                                  label={`${comp.history?.length || 0} replaced`}
                                  size="small"
                                  color={comp.history && comp.history.length > 0 ? 'warning' : 'default'}
                                  variant="outlined"
                                  sx={{ fontSize: 11 }}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => handleOpenReplace(comp)}
                                  sx={{ textTransform: 'none', fontSize: 11 }}
                                >
                                  Replace Serial
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}

              {/* TAB 1: Replacement History Audit Trail */}
              {activeSubTab === 1 && (
                <Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight={800}>
                      Full Component Replacement Audit Trail
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Historical log of all components replaced on this vehicle, including retired serial numbers and reasons
                    </Typography>
                  </Box>

                  {allHistory.length === 0 ? (
                    <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                      <CheckCircle2 size={40} color="#10b981" style={{ margin: '0 auto 12px' }} />
                      <Typography variant="subtitle2" fontWeight={700}>
                        Zero Component Replacements
                      </Typography>
                      <Typography variant="caption">
                        All original kit components are operating without replacement.
                      </Typography>
                    </Box>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 700 }}>Component</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Old Serial Number</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>New Serial Number</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Replaced Date</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Replaced By</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Reason / Diagnosis</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {allHistory.map((h) => (
                            <TableRow key={h.id} hover>
                              <TableCell sx={{ fontWeight: 700 }}>{h.component_label}</TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', color: '#ef4444', textDecoration: 'line-through' }}>
                                {h.old_serial_number}
                              </TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', color: '#16a34a', fontWeight: 700 }}>
                                {h.new_serial_number}
                              </TableCell>
                              <TableCell>{h.replaced_date ? formatDate(h.replaced_date) : '—'}</TableCell>
                              <TableCell>{h.replaced_by_name || 'Service Team'}</TableCell>
                              <TableCell>{h.reason || 'Component failed / worn'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}

              {/* TAB 2: Work Orders & Maintenance */}
              {activeSubTab === 2 && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2 }}>
                    Past Complaints & Work Orders
                  </Typography>

                  {vehicleComplaints.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                      No service complaints logged for this vehicle.
                    </Typography>
                  ) : (
                    <TableContainer sx={{ mb: 4 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 700 }}>Complaint ID</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Severity</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Affected Component</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Resolution Summary</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {vehicleComplaints.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell sx={{ fontWeight: 700, color: '#2563eb' }}>{c.complaint_no}</TableCell>
                              <TableCell>{c.category}</TableCell>
                              <TableCell>
                                <Chip label={c.severity} size="small" />
                              </TableCell>
                              <TableCell>
                                <Chip label={c.status} size="small" />
                              </TableCell>
                              <TableCell>{c.affected_component_label || '—'}</TableCell>
                              <TableCell>{c.resolution_summary || '—'}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(c.created_at)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2 }}>
                    Preventive Maintenance History
                  </Typography>

                  {vehicleMaintenance.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No preventive maintenance scheduled for this vehicle.
                    </Typography>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 700 }}>Title / Service Type</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Scheduled Date</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Completed Date</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Technician</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Cost</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {vehicleMaintenance.map((m) => (
                            <TableRow key={m.id}>
                              <TableCell sx={{ fontWeight: 700 }}>
                                {m.title} ({m.service_type})
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{m.scheduled_date ? formatDate(m.scheduled_date) : '—'}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{m.completed_date ? formatDate(m.completed_date) : '—'}</TableCell>
                              <TableCell>
                                <Chip label={m.status} size="small" />
                              </TableCell>
                              <TableCell>{m.technician_name || '—'}</TableCell>
                              <TableCell align="right">₹{m.cost.toFixed(2)}</TableCell>
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
        </Box>
      )}

      {/* Replace Component Modal */}
      <Dialog open={Boolean(selectedCompForReplace)} onClose={() => setSelectedCompForReplace(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          Replace Component Serial
        </DialogTitle>
        <DialogContent dividers>
          {selectedCompForReplace && (
            <Box>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                Component: <strong>{selectedCompForReplace.component_label}</strong>
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Current Active Serial: <strong>{selectedCompForReplace.serial_number}</strong>
              </Typography>

              <TextField
                label="New Component Serial Number *"
                size="small"
                fullWidth
                required
                value={newSerial}
                onChange={(e) => setNewSerial(e.target.value)}
                sx={{ mb: 2 }}
              />

              <TextField
                label="Reason / Notes"
                size="small"
                fullWidth
                multiline
                rows={2}
                value={replaceReason}
                onChange={(e) => setReplaceReason(e.target.value)}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSelectedCompForReplace(null)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmReplace}
            disabled={isReplacing}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {isReplacing ? 'Replacing...' : 'Save Replacement'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
