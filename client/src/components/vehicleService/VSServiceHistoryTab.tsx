import React, { useState } from 'react';
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
  useGetVSComplaintsQuery,
  useGetVSMaintenanceQuery,
  useGetVSVehiclesQuery,
  useReplaceVSComponentMutation,
} from '@/api/vehicleServiceApi';
import type { VSVehicle, VSVehicleComponent } from '@/types/vehicleService';
import { formatDate, formatDateTime } from '@/utils/format';

export default function VSServiceHistoryTab() {
  const { data: vehicles = [], isLoading: isVehiclesLoading, refetch: refetchVehicles } = useGetVSVehiclesQuery();

  const [selectedVehicleId, setSelectedVehicleId] = useState<number | ''>('');
  const [activeSubTab, setActiveSubTab] = useState<number>(0);

  const selectedVehicle: VSVehicle | undefined = vehicles.find((v) => v.id === selectedVehicleId);

  // Queries for selected vehicle
  const { data: vehicleComplaints = [] } = useGetVSComplaintsQuery(
    { vehicle_id: selectedVehicle ? selectedVehicle.id : undefined },
    { skip: !selectedVehicle },
  );

  const { data: vehicleMaintenance = [] } = useGetVSMaintenanceQuery(
    { vehicle_id: selectedVehicle ? selectedVehicle.id : undefined },
    { skip: !selectedVehicle },
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
    if (!selectedVehicle || !selectedCompForReplace || !newSerial.trim()) {
      alert('Please specify the new serial number.');
      return;
    }

    try {
      await replaceComponent({
        vehicleId: selectedVehicle.id,
        componentId: selectedCompForReplace.id,
        body: {
          new_serial_number: newSerial.trim(),
          replaced_date: new Date().toISOString().slice(0, 10),
          reason: replaceReason.trim() || 'Manual service replacement',
        },
      }).unwrap();

      setSelectedCompForReplace(null);
      refetchVehicles();
    } catch (err: any) {
      alert(err?.data?.detail || 'Failed to replace component serial.');
    }
  };

  // Compile full replacement history across all components in this vehicle
  const allHistory = (selectedVehicle?.components || []).flatMap((c) =>
    (c.history || []).map((h) => ({
      ...h,
      component_label: c.component_label,
      component_type: c.component_type,
    })),
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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

        <div style={{ minWidth: 280 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Select Retrofitted Vehicle</InputLabel>
            <Select
              value={selectedVehicleId}
              label="Select Retrofitted Vehicle"
              onChange={(e) => setSelectedVehicleId(Number(e.target.value))}
            >
              {vehicles.map((v) => (
                <MenuItem key={v.id} value={v.id}>
                  {v.vehicle_number} — {v.owner_name} ({v.kit_number || 'Default Kit'})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
      </div>

      {!selectedVehicle ? (
        <Paper sx={{ py: 12, textAlign: 'center', borderRadius: 3, border: '1px solid #e2e8f0', color: 'text.secondary' }}>
          <History size={56} strokeWidth={1} style={{ margin: '0 auto 16px', color: '#94a3b8' }} />
          <Typography variant="h6" fontWeight={700}>
            Select a Vehicle to View History
          </Typography>
          <Typography variant="body2" sx={{ maxWidth: 460, mx: 'auto', mt: 1 }}>
            Choose an EV retrofitted 3-wheeler from the dropdown above to inspect its active kit components, serial number audit logs, and past work orders.
          </Typography>
        </Paper>
      ) : (
        <Box>
          {/* Vehicle Profile Card */}
          <Paper sx={{ p: 3, mb: 3, borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={7}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                  <Typography variant="h5" fontWeight={900} color="#0f172a">
                    {selectedVehicle.vehicle_number}
                  </Typography>
                  <Chip
                    label={`Kit: ${selectedVehicle.kit_number || 'Standard'}`}
                    color="primary"
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                  <Chip
                    label={selectedVehicle.is_active ? 'Active Fleet' : 'Inactive'}
                    color={selectedVehicle.is_active ? 'success' : 'default'}
                    size="small"
                  />
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Owner Name
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {selectedVehicle.owner_name}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Contact Phone
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {selectedVehicle.owner_phone}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Chassis / Frame No
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {selectedVehicle.chassis_number || '—'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Installation Done On
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {selectedVehicle.retrofit_date ? formatDate(selectedVehicle.retrofit_date) : '—'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Warranty Expiry
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {selectedVehicle.warranty_expiry ? formatDate(selectedVehicle.warranty_expiry) : '—'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Recorded Mileage
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {selectedVehicle.total_mileage_km} KM
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
                    <Button
                      size="small"
                      href={`/vs/register/${selectedVehicle.qr_token}`}
                      target="_blank"
                      rel="noreferrer"
                      sx={{ textTransform: 'none', fontSize: 11 }}
                    >
                      Open Form
                    </Button>
                  </Box>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: '#ffffff', p: 1, borderRadius: 1, border: '1px solid #cbd5e1' }}>
                    {selectedVehicle.qr_token}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    URL: {window.location.origin}/vs/register/{selectedVehicle.qr_token}
                  </Typography>
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
              <Tab label={`Active Kit Components (${selectedVehicle.components?.length || 0})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
              <Tab label={`Component Replacement History (${allHistory.length})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
              <Tab label={`Work Orders & Maintenance (${vehicleComplaints.length + vehicleMaintenance.length})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
            </Tabs>

            <Box sx={{ p: 3 }}>
              {/* TAB 0: Active Components */}
              {activeSubTab === 0 && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight={800}>
                      Currently Fitted Components (Kit: {selectedVehicle.kit_number || 'Default'})
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Each component is tracked with its unique serial number for warranty and failure analysis
                    </Typography>
                  </Box>

                  {!selectedVehicle.components || selectedVehicle.components.length === 0 ? (
                    <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                      <Typography variant="body2">No components registered for this vehicle.</Typography>
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
                          {selectedVehicle.components.map((comp) => (
                            <TableRow key={comp.id} hover>
                              <TableCell sx={{ fontWeight: 700 }}>{comp.component_label}</TableCell>
                              <TableCell>
                                <Chip label={comp.component_type} size="small" variant="outlined" />
                              </TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                                {comp.serial_number}
                              </TableCell>
                              <TableCell>{comp.installed_date || '—'}</TableCell>
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
