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
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Rating,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BatteryCharging,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  ExternalLink,
  Filter,
  History,
  MapPin,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Sliders,
  User,
  Wrench,
  Zap,
} from 'lucide-react';

import { useUsersQuery } from '@/api/mastersApi';
import { AppDropdown } from '@/components/ui/AppDropdown';
import {
  useAddVSComplaintNoteMutation,
  useAddVSServiceCostMutation,
  useCloseVSComplaintMutation,
  useCreateVSComplaintMutation,
  useGetVSComplaintsQuery,
  useGetVSVehiclesQuery,
  useReplaceVSComponentMutation,
  useUpdateVSComplaintMutation,
} from '@/api/vehicleServiceApi';
import type {
  VSComplaint,
  VSComplaintCloseRequest,
  VSComplaintCreate,
  VSVehicle,
} from '@/types/vehicleService';

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#f59e0b',
  LOW: '#10b981',
};

const STATUS_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  OPEN: 'error',
  ACKNOWLEDGED: 'warning',
  ASSIGNED: 'info',
  IN_PROGRESS: 'primary',
  RESOLVED: 'success',
  CLOSED: 'default',
};

export default function VSWorkOrdersTab() {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Queries
  const { data: complaints = [], isLoading, refetch } = useGetVSComplaintsQuery({
    search: search || undefined,
    severity: severityFilter || undefined,
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
  });

  const { data: vehicles = [] } = useGetVSVehiclesQuery();
  const { data: users = [] } = useUsersQuery();

  // Mutations
  const [createComplaint, { isLoading: isCreating }] = useCreateVSComplaintMutation();
  const [updateComplaint, { isLoading: isUpdating }] = useUpdateVSComplaintMutation();
  const [addNote, { isLoading: isAddingNote }] = useAddVSComplaintNoteMutation();
  const [closeComplaint, { isLoading: isClosing }] = useCloseVSComplaintMutation();
  const [replaceComponent, { isLoading: isReplacing }] = useReplaceVSComponentMutation();
  const [addCost, { isLoading: isAddingCost }] = useAddVSServiceCostMutation();

  // Dialog states
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<VSComplaint | null>(null);

  // New Complaint Form
  const [newVehicleId, setNewVehicleId] = useState<number | ''>('');
  const [newComponentId, setNewComponentId] = useState<number | ''>('');
  const [newReportedBy, setNewReportedBy] = useState('');
  const [newReportedPhone, setNewReportedPhone] = useState('');
  const [newCategory, setNewCategory] = useState('BREAKDOWN');
  const [newSeverity, setNewSeverity] = useState('MEDIUM');
  const [newDescription, setNewDescription] = useState('');
  const [newAssignedTo, setNewAssignedTo] = useState<number | ''>('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Timeline note state
  const [newNoteText, setNewNoteText] = useState('');

  // Close Complaint Dialog state
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [closeResolutionSummary, setCloseResolutionSummary] = useState('');
  const [closeRating, setCloseRating] = useState<number | null>(5);
  const [closeFeedbackComment, setCloseFeedbackComment] = useState('');

  // Component Replacement inside Complaint Dialog
  const [isReplaceDialogOpen, setIsReplaceDialogOpen] = useState(false);
  const [replaceComponentId, setReplaceComponentId] = useState<number | ''>('');
  const [replaceNewSerial, setReplaceNewSerial] = useState('');
  const [replaceReason, setReplaceReason] = useState('');

  // Service Cost state
  const [costItemName, setCostItemName] = useState('');
  const [costQty, setCostQty] = useState(1);
  const [costUnitPrice, setCostUnitPrice] = useState<number | ''>('');

  const selectedVehicleObj: VSVehicle | undefined = vehicles.find((v) => v.id === newVehicleId);

  const handleOpenNewDialog = () => {
    setNewVehicleId('');
    setNewComponentId('');
    setNewReportedBy('');
    setNewReportedPhone('');
    setNewCategory('BREAKDOWN');
    setNewSeverity('MEDIUM');
    setNewDescription('');
    setNewAssignedTo('');
    setCreateError(null);
    setIsNewDialogOpen(true);
  };

  const handleSelectVehicleInForm = (vid: number) => {
    setNewVehicleId(vid);
    setNewComponentId('');
    const v = vehicles.find((veh) => veh.id === vid);
    if (v) {
      setNewReportedBy(v.owner_name);
      setNewReportedPhone(v.owner_phone);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicleId || !newReportedBy || !newReportedPhone || !newDescription) {
      setCreateError('Please fill all mandatory fields.');
      return;
    }
    setCreateError(null);

    const payload: VSComplaintCreate = {
      vehicle_id: Number(newVehicleId),
      affected_component_id: newComponentId ? Number(newComponentId) : undefined,
      reported_by: newReportedBy.trim(),
      reported_phone: newReportedPhone.trim(),
      category: newCategory,
      severity: newSeverity,
      description: newDescription.trim(),
      assigned_to_id: newAssignedTo ? Number(newAssignedTo) : undefined,
    };

    try {
      await createComplaint(payload).unwrap();
      setIsNewDialogOpen(false);
      refetch();
    } catch (err: any) {
      setCreateError(err?.data?.detail || 'Failed to create work order.');
    }
  };

  const handleUpdateStatus = async (complaintId: number, nextStatus: string) => {
    try {
      const updated = await updateComplaint({ id: complaintId, body: { status: nextStatus } }).unwrap();
      setSelectedComplaint(updated);
      refetch();
    } catch (err: any) {
      alert(err?.data?.detail || 'Failed to update status.');
    }
  };

  const handleAssignUser = async (complaintId: number, userId: number) => {
    try {
      const updated = await updateComplaint({ id: complaintId, body: { assigned_to_id: userId } }).unwrap();
      setSelectedComplaint(updated);
      refetch();
    } catch (err: any) {
      alert(err?.data?.detail || 'Failed to assign technician.');
    }
  };

  const handleAddNote = async () => {
    if (!selectedComplaint || !newNoteText.trim()) return;
    try {
      await addNote({ complaintId: selectedComplaint.id, note: newNoteText.trim() }).unwrap();
      setNewNoteText('');
      const updated = await updateComplaint({ id: selectedComplaint.id, body: {} }).unwrap();
      setSelectedComplaint(updated);
      refetch();
    } catch (err: any) {
      alert('Failed to add note.');
    }
  };

  const handleCloseSubmit = async () => {
    if (!selectedComplaint || !closeResolutionSummary.trim()) {
      alert('Please enter a resolution summary.');
      return;
    }

    const payload: VSComplaintCloseRequest = {
      resolution_summary: closeResolutionSummary.trim(),
      rating: closeRating || undefined,
      feedback_comment: closeFeedbackComment.trim() || undefined,
    };

    try {
      const res = await closeComplaint({ id: selectedComplaint.id, body: payload }).unwrap();
      setSelectedComplaint(res);
      setIsCloseDialogOpen(false);
      refetch();
    } catch (err: any) {
      alert(err?.data?.detail || 'Failed to close work order.');
    }
  };

  const handleReplaceComponentSubmit = async () => {
    if (!selectedComplaint || !replaceComponentId || !replaceNewSerial.trim()) {
      alert('Please select component and specify new serial number.');
      return;
    }

    try {
      await replaceComponent({
        vehicleId: selectedComplaint.vehicle_id,
        componentId: Number(replaceComponentId),
        body: {
          new_serial_number: replaceNewSerial.trim(),
          replaced_date: new Date().toISOString().slice(0, 10),
          reason: replaceReason.trim() || `Replaced during Work Order #${selectedComplaint.complaint_no}`,
          complaint_id: selectedComplaint.id,
        },
      }).unwrap();

      setIsReplaceDialogOpen(false);
      setReplaceComponentId('');
      setReplaceNewSerial('');
      setReplaceReason('');

      // Refresh complaint
      const updated = await updateComplaint({ id: selectedComplaint.id, body: {} }).unwrap();
      setSelectedComplaint(updated);
      refetch();
    } catch (err: any) {
      alert(err?.data?.detail || 'Failed to record component replacement.');
    }
  };

  const handleAddCostSubmit = async () => {
    if (!selectedComplaint || !costItemName.trim() || !costUnitPrice) {
      alert('Please enter part/labor name and unit price.');
      return;
    }

    try {
      await addCost({
        complaintId: selectedComplaint.id,
        body: {
          item_name: costItemName.trim(),
          quantity: costQty,
          unit_price: Number(costUnitPrice),
        },
      }).unwrap();

      setCostItemName('');
      setCostQty(1);
      setCostUnitPrice('');

      // Refresh complaint
      const updated = await updateComplaint({ id: selectedComplaint.id, body: {} }).unwrap();
      setSelectedComplaint(updated);
    } catch (err: any) {
      alert('Failed to add cost item.');
    }
  };

  return (
    <div>
      {/* Header matching CRM */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3, color: '#023020' }}>
              Work Orders & Service Complaints
            </span>
            <Chip label={`${complaints.length} Total`} size="small" sx={{ fontWeight: 700 }} />
          </div>
          <div style={{ fontSize: 13, color: '#7A8B80', marginTop: 3 }}>
            Manage incoming breakdown alerts, customer complaints, and technician dispatch.
          </div>
        </div>

        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          onClick={handleOpenNewDialog}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 700,
            bgcolor: '#2563eb',
            '&:hover': { bgcolor: '#1d4ed8' },
          }}
        >
          Create Work Order
        </Button>
      </div>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2.5, borderRadius: 2.5, border: '1px solid #E4EBE1' }}>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} sm={6} md={3.5}>
            <TextField
              size="small"
              placeholder="Search by ID, Vehicle, Owner..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} color="#94a3b8" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid item xs={6} sm={3} md={2}>
            <AppDropdown
              label="Severity"
              value={severityFilter}
              emptyLabel="All Severities"
              allowEmpty
              options={[
                { value: 'CRITICAL', label: '🔴 Critical' },
                { value: 'HIGH', label: '🟠 High' },
                { value: 'MEDIUM', label: '🟡 Medium' },
                { value: 'LOW', label: '🟢 Low' },
              ]}
              onChange={(val) => setSeverityFilter(val)}
            />
          </Grid>

          <Grid item xs={6} sm={3} md={2.5}>
            <AppDropdown
              label="Status"
              value={statusFilter}
              emptyLabel="All Statuses"
              allowEmpty
              options={[
                { value: 'OPEN', label: 'Open' },
                { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
                { value: 'ASSIGNED', label: 'Assigned' },
                { value: 'IN_PROGRESS', label: 'In Progress' },
                { value: 'RESOLVED', label: 'Resolved' },
                { value: 'CLOSED', label: 'Closed' },
              ]}
              onChange={(val) => setStatusFilter(val)}
            />
          </Grid>

          <Grid item xs={6} sm={3} md={2.5}>
            <AppDropdown
              label="Category"
              value={categoryFilter}
              emptyLabel="All Categories"
              allowEmpty
              options={[
                { value: 'BREAKDOWN', label: 'Breakdown' },
                { value: 'BATTERY', label: 'Battery / Range' },
                { value: 'MOTOR', label: 'Motor' },
                { value: 'CONTROLLER', label: 'Controller' },
                { value: 'CHARGING', label: 'Charging' },
                { value: 'PERFORMANCE', label: 'Performance' },
                { value: 'OTHER', label: 'Other' },
              ]}
              onChange={(val) => setCategoryFilter(val)}
            />
          </Grid>

          <Grid item xs={6} sm={3} md={1.5}>
            <Button
              variant="outlined"
              size="small"
              fullWidth
              onClick={() => {
                setSearch('');
                setSeverityFilter('');
                setStatusFilter('');
                setCategoryFilter('');
              }}
              sx={{ textTransform: 'none', height: 40 }}
            >
              Reset
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Complaints Table */}
      <Paper sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            <CircularProgress />
          </Box>
        ) : complaints.length === 0 ? (
          <Box sx={{ py: 10, textAlign: 'center', color: 'text.secondary' }}>
            <Wrench size={48} strokeWidth={1.2} style={{ margin: '0 auto 16px', color: '#94a3b8' }} />
            <Typography variant="h6" fontWeight={700}>
              No Work Orders Found
            </Typography>
            <Typography variant="body2" sx={{ maxWidth: 420, mx: 'auto', mt: 1 }}>
              No service complaints match your current filters. Click "Create Work Order" or scan vehicle QR code to register a complaint.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Complaint ID</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Vehicle & Owner</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Affected Component</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Severity</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Assigned To</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Created At</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {complaints.map((c) => (
                  <TableRow
                    key={c.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setSelectedComplaint(c)}
                  >
                    <TableCell sx={{ fontWeight: 800, color: '#2563eb' }}>
                      {c.complaint_no}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>
                        {c.vehicle_number || `Vehicle #${c.vehicle_id}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {c.owner_name} ({c.owner_phone})
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {c.affected_component_label ? (
                        <Box>
                          <Typography variant="caption" fontWeight={600} display="block">
                            {c.affected_component_label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            SN: {c.affected_component_serial}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          General / Unspecified
                        </Typography>
                      )}
                    </TableCell>
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
                      <Chip
                        label={c.status}
                        size="small"
                        color={STATUS_COLORS[c.status] || 'default'}
                        sx={{ fontWeight: 600, fontSize: 11 }}
                      />
                    </TableCell>
                    <TableCell>
                      {c.assigned_to_name ? (
                        <Typography variant="caption" fontWeight={600}>
                          {c.assigned_to_name}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary" fontStyle="italic">
                          Unassigned
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.gps_latitude && c.gps_longitude ? (
                        <Tooltip title={`Coordinates: ${c.gps_latitude.toFixed(4)}, ${c.gps_longitude.toFixed(4)}`}>
                          <Chip
                            icon={<MapPin size={12} />}
                            label="GPS"
                            size="small"
                            color="info"
                            variant="outlined"
                            sx={{ height: 22, fontSize: 10 }}
                          />
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(c.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedComplaint(c);
                        }}
                        sx={{ textTransform: 'none', fontSize: 11, py: 0.3 }}
                      >
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* =====================================================================
          NEW WORK ORDER DIALOG
      ====================================================================== */}
      <Dialog open={isNewDialogOpen} onClose={() => setIsNewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Create New Work Order</DialogTitle>
        <DialogContent dividers>
          {createError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {createError}
            </Alert>
          )}

          {/* Vehicle Selector */}
          <Box sx={{ mb: 2 }}>
            <AppDropdown
              label="Retrofitted Vehicle *"
              value={newVehicleId}
              placeholder="Select vehicle"
              required
              options={vehicles.map((v) => ({
                value: v.id,
                label: `${v.vehicle_number} — ${v.owner_name} (Kit: ${v.kit_number || 'Default'})`,
              }))}
              onChange={(val) => handleSelectVehicleInForm(Number(val))}
            />
          </Box>

          {/* Component in Kit Selector */}
          {selectedVehicleObj && selectedVehicleObj.components && selectedVehicleObj.components.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <AppDropdown
                label="Affected Component from Kit"
                value={newComponentId}
                emptyLabel="General Vehicle / Non-Component Issue"
                allowEmpty
                options={selectedVehicleObj.components.map((comp) => ({
                  value: comp.id,
                  label: `${comp.component_label} (Serial: ${comp.serial_number})`,
                }))}
                onChange={(val) => setNewComponentId(val as number | '')}
              />
            </Box>
          )}

          {/* Complainant Details */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <TextField
                label="Reporter Name *"
                size="small"
                fullWidth
                value={newReportedBy}
                onChange={(e) => setNewReportedBy(e.target.value)}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Reporter Phone *"
                size="small"
                fullWidth
                value={newReportedPhone}
                onChange={(e) => setNewReportedPhone(e.target.value)}
              />
            </Grid>
          </Grid>

          {/* Category & Severity */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <AppDropdown
                label="Category *"
                value={newCategory}
                options={[
                  { value: 'BREAKDOWN', label: 'Breakdown' },
                  { value: 'BATTERY', label: 'Battery / Range' },
                  { value: 'MOTOR', label: 'Motor' },
                  { value: 'CONTROLLER', label: 'Controller' },
                  { value: 'CHARGING', label: 'Charging' },
                  { value: 'PERFORMANCE', label: 'Performance' },
                  { value: 'OTHER', label: 'Other' },
                ]}
                onChange={(val) => setNewCategory(String(val))}
              />
            </Grid>
            <Grid item xs={6}>
              <AppDropdown
                label="Severity *"
                value={newSeverity}
                options={[
                  { value: 'CRITICAL', label: '🔴 Critical' },
                  { value: 'HIGH', label: '🟠 High' },
                  { value: 'MEDIUM', label: '🟡 Medium' },
                  { value: 'LOW', label: '🟢 Low' },
                ]}
                onChange={(val) => setNewSeverity(String(val))}
              />
            </Grid>
          </Grid>

          {/* Assignee */}
          <Box sx={{ mb: 2 }}>
            <AppDropdown
              label="Assign Technician / Service Officer"
              value={newAssignedTo}
              emptyLabel="Leave Unassigned"
              allowEmpty
              options={users.map((u) => ({
                value: u.id,
                label: `${u.full_name} (${u.role})`,
              }))}
              onChange={(val) => setNewAssignedTo(val as number | '')}
            />
          </Box>

          {/* Description */}
          <TextField
            label="Problem Description *"
            multiline
            rows={3}
            fullWidth
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIsNewDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateSubmit}
            disabled={isCreating}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {isCreating ? 'Creating...' : 'Create Work Order'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* =====================================================================
          COMPLAINT DETAIL & MANAGEMENT DIALOG
      ====================================================================== */}
      {selectedComplaint && (
        <Dialog
          open={Boolean(selectedComplaint)}
          onClose={() => setSelectedComplaint(null)}
          maxWidth={false}
          fullWidth
          sx={{
            '& .MuiBackdrop-root': {
              left: { xs: 0, md: 'var(--current-sidebar-width, 244px)' },
            },
            '& .MuiDialog-container': {
              pl: { xs: 0, md: 'calc(var(--current-sidebar-width, 244px) + 16px)' },
              pr: { xs: 0, md: '16px' },
              justifyContent: 'center',
              alignItems: 'center',
            },
          }}
          PaperProps={{
            sx: {
              width: '100%',
              maxWidth: '100%',
              height: { xs: 'auto', md: '92vh' },
              maxHeight: '94vh',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#FFFFFF',
              m: 0,
            },
          }}
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1.5, px: 3, pt: 2.5 }}>
            <Box>
              <Typography variant="h6" fontWeight={800} color="#023020">
                Work Order: {selectedComplaint.complaint_no}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Registered via {selectedComplaint.registered_via} on{' '}
                {new Date(selectedComplaint.created_at).toLocaleString()}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip
                label={selectedComplaint.severity}
                sx={{
                  bgcolor: `${SEVERITY_COLORS[selectedComplaint.severity]}20`,
                  color: SEVERITY_COLORS[selectedComplaint.severity],
                  fontWeight: 800,
                }}
              />
              <Chip
                label={selectedComplaint.status}
                color={STATUS_COLORS[selectedComplaint.status] || 'default'}
                sx={{ fontWeight: 800 }}
              />
            </Box>
          </DialogTitle>

          <DialogContent
            dividers
            sx={{
              p: { xs: 2, md: 3 },
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              gap: 3,
              overflow: { xs: 'auto', md: 'hidden' },
              flex: 1,
            }}
          >
            {/* LEFT SIDE: Work Order Form & Details (~73%) */}
            <Box
              sx={{
                flex: { xs: '1 1 100%', md: '1 1 73%' },
                minWidth: 0,
                overflowY: { xs: 'visible', md: 'auto' },
                pr: { xs: 0, md: 1 },
                display: 'flex',
                flexDirection: 'column',
                gap: 2.5,
              }}
            >
              {/* Action Bar (Workflow status transitions) */}
              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Workflow Actions:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {selectedComplaint.status === 'OPEN' && (
                    <Button
                      size="small"
                      variant="contained"
                      color="warning"
                      onClick={() => handleUpdateStatus(selectedComplaint.id, 'ACKNOWLEDGED')}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      Acknowledge
                    </Button>
                  )}

                  {(selectedComplaint.status === 'OPEN' || selectedComplaint.status === 'ACKNOWLEDGED') && (
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      onClick={() => handleUpdateStatus(selectedComplaint.id, 'IN_PROGRESS')}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      Start Service (In Progress)
                    </Button>
                  )}

                  {selectedComplaint.status === 'IN_PROGRESS' && (
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      onClick={() => handleUpdateStatus(selectedComplaint.id, 'RESOLVED')}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      Mark Resolved
                    </Button>
                  )}

                  {selectedComplaint.status === 'RESOLVED' && (
                    <Button
                      size="small"
                      variant="contained"
                      color="inherit"
                      onClick={() => {
                        setCloseResolutionSummary(selectedComplaint.resolution_summary || '');
                        setIsCloseDialogOpen(true);
                      }}
                      sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0f172a', color: '#fff', '&:hover': { bgcolor: '#1e293b' } }}
                    >
                      Close Work Order & Feedback
                    </Button>
                  )}
                </Box>
              </Box>

              <Grid container spacing={2.5}>
                {/* Vehicle & Customer Info */}
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" gutterBottom>
                      VEHICLE & CUSTOMER DETAILS
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={800} color="#0f172a">
                      {selectedComplaint.vehicle_number}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      <strong>Owner:</strong> {selectedComplaint.owner_name}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Contact:</strong> {selectedComplaint.owner_phone}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Reported By:</strong> {selectedComplaint.reported_by} ({selectedComplaint.reported_phone})
                    </Typography>

                    {selectedComplaint.gps_latitude && selectedComplaint.gps_longitude && (
                      <Box sx={{ mt: 1.5, p: 1, bgcolor: '#eff6ff', borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <MapPin size={16} color="#2563eb" />
                          <Typography variant="caption" fontWeight={600} color="#1d4ed8">
                            GPS: {selectedComplaint.gps_latitude.toFixed(4)}, {selectedComplaint.gps_longitude.toFixed(4)}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          href={`https://www.google.com/maps?q=${selectedComplaint.gps_latitude},${selectedComplaint.gps_longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          endIcon={<ExternalLink size={12} />}
                          sx={{ fontSize: 11, textTransform: 'none', p: 0.5 }}
                        >
                          Map
                        </Button>
                      </Box>
                    )}
                  </Paper>
                </Grid>

                {/* Component & Assignment Info */}
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" gutterBottom>
                      COMPONENT LINKAGE & TECHNICIAN
                    </Typography>

                    {selectedComplaint.affected_component_label ? (
                      <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5 }}>
                        <Typography variant="subtitle2" fontWeight={700}>
                          {selectedComplaint.affected_component_label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Active Serial Number: <strong>{selectedComplaint.affected_component_serial}</strong>
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setReplaceComponentId(selectedComplaint.affected_component_id || '');
                            setReplaceNewSerial('');
                            setReplaceReason('');
                            setIsReplaceDialogOpen(true);
                          }}
                          sx={{ mt: 1, textTransform: 'none', fontSize: 11, py: 0.3 }}
                        >
                          Replace This Component Serial
                        </Button>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        No specific component tied to this issue.
                      </Typography>
                    )}

                    {/* Technician Assignment */}
                    <AppDropdown
                      label="Assigned Technician"
                      value={selectedComplaint.assigned_to_id || ''}
                      emptyLabel="Unassigned"
                      allowEmpty
                      options={users.map((u) => ({
                        value: u.id,
                        label: `${u.full_name} (${u.role})`,
                      }))}
                      onChange={(val) => handleAssignUser(selectedComplaint.id, Number(val))}
                    />
                  </Paper>
                </Grid>
              </Grid>

              {/* Description */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" gutterBottom>
                  ISSUE DESCRIPTION
                </Typography>
                <Typography variant="body1">
                  {selectedComplaint.description}
                </Typography>
                {selectedComplaint.resolution_summary && (
                  <Box sx={{ mt: 2, p: 1.5, bgcolor: '#ecfdf5', borderRadius: 1.5, border: '1px solid #a7f3d0' }}>
                    <Typography variant="caption" fontWeight={700} color="#065f46" display="block">
                      RESOLUTION SUMMARY
                    </Typography>
                    <Typography variant="body2" color="#047857">
                      {selectedComplaint.resolution_summary}
                    </Typography>
                  </Box>
                )}
              </Paper>

              {/* Customer Feedback if closed */}
              {selectedComplaint.feedback && (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#fefce8', borderColor: '#fef08a' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700} color="#854d0e">
                      Customer Satisfaction Feedback
                    </Typography>
                    <Rating value={selectedComplaint.feedback.rating} readOnly size="small" />
                  </Box>
                  {selectedComplaint.feedback.comment && (
                    <Typography variant="body2" color="#713f12">
                      "{selectedComplaint.feedback.comment}"
                    </Typography>
                  )}
                </Paper>
              )}

              {/* Service Costs Section */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" gutterBottom>
                  SERVICE & REPLACEMENT COSTS
                </Typography>
                {selectedComplaint.costs && selectedComplaint.costs.length > 0 ? (
                  <Table size="small" sx={{ mb: 2 }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        <TableCell sx={{ fontWeight: 700 }}>Item / Part Description</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Qty</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Unit Price</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Total Price</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedComplaint.costs.map((cost) => (
                        <TableRow key={cost.id}>
                          <TableCell>{cost.item_name}</TableCell>
                          <TableCell>{cost.quantity}</TableCell>
                          <TableCell>₹{cost.unit_price.toFixed(2)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>₹{cost.total_price.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    No itemized parts or labor costs added to this work order.
                  </Typography>
                )}

                {/* Add Cost Item */}
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  <TextField
                    label="Part / Labor Item"
                    size="small"
                    value={costItemName}
                    onChange={(e) => setCostItemName(e.target.value)}
                    sx={{ flex: 2, minWidth: 160 }}
                  />
                  <TextField
                    label="Qty"
                    type="number"
                    size="small"
                    value={costQty}
                    onChange={(e) => setCostQty(Math.max(1, Number(e.target.value)))}
                    sx={{ width: 80 }}
                  />
                  <TextField
                    label="Unit Price (₹)"
                    type="number"
                    size="small"
                    value={costUnitPrice}
                    onChange={(e) => setCostUnitPrice(e.target.value ? Number(e.target.value) : '')}
                    sx={{ width: 120 }}
                  />
                  <Button
                    variant="outlined"
                    onClick={handleAddCostSubmit}
                    disabled={isAddingCost}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    Add Cost
                  </Button>
                </Box>
              </Paper>
            </Box>

            {/* RIGHT SIDE: Changelog & Activity Logs (~27%) */}
            <Paper
              variant="outlined"
              sx={{
                flex: { xs: '1 1 100%', md: '0 0 27%' },
                width: { xs: '100%', md: '27%' },
                minWidth: { xs: '100%', md: 260 },
                maxWidth: { md: 340 },
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '12px',
                borderColor: '#E4EBE1',
                backgroundColor: '#FAFBF9',
                p: 2,
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '7px',
                      backgroundColor: '#E8F5E9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#023020',
                    }}
                  >
                    <History size={15} />
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#023020', fontSize: 13 }}>
                    Changelog
                  </Typography>
                </Box>
                <Chip
                  label={`${selectedComplaint.notes?.length || 0}`}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    fontSize: 10.5,
                    backgroundColor: '#E8F5E9',
                    color: '#1B5E20',
                    border: '1px solid #C8E6C9',
                    height: 20,
                  }}
                />
              </Box>

              {/* Add Note / Quick Log Box */}
              <Box sx={{ mb: 1.5, p: 1, backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E4EBE1' }}>
                <TextField
                  placeholder="Add note or update..."
                  size="small"
                  multiline
                  rows={2}
                  fullWidth
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      fontSize: 12,
                      p: 0.8,
                      backgroundColor: '#F8FAF8',
                    },
                  }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: 0.8 }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleAddNote}
                    disabled={isAddingNote || !newNoteText.trim()}
                    startIcon={<Send size={12} />}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: 11.5,
                      backgroundColor: '#023020',
                      '&:hover': { backgroundColor: '#034732' },
                      px: 1.5,
                      py: 0.3,
                      borderRadius: '5px',
                    }}
                  >
                    Post Note
                  </Button>
                </Box>
              </Box>

              <Divider sx={{ mb: 1.5, borderColor: '#E4EBE1' }} />

              {/* Scrollable Logs Stream */}
              <Box
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.2,
                  pr: 0.5,
                  maxHeight: { xs: 350, md: 'none' },
                }}
              >
                {selectedComplaint.notes && selectedComplaint.notes.length > 0 ? (
                  selectedComplaint.notes.map((n) => (
                    <Box
                      key={n.id}
                      sx={{
                        p: 1.2,
                        borderRadius: '6px',
                        backgroundColor: n.is_status_change ? '#F1F5F9' : '#FFFFFF',
                        border: n.is_status_change ? '1px solid #CBD5E1' : '1px solid #E4EBE1',
                        borderLeft: n.is_status_change ? '3px solid #2563EB' : '3px solid #023020',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5, flexWrap: 'wrap', gap: 0.3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {n.is_status_change ? (
                            <Clock size={11} color="#2563EB" />
                          ) : (
                            <User size={11} color="#023020" />
                          )}
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#0F172A', fontSize: 11 }}>
                            {n.author_name}
                          </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ color: '#64748B', fontSize: 10 }}>
                          {new Date(n.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </Typography>
                      </Box>
                      {n.is_status_change && (
                        <Box sx={{ mb: 0.5 }}>
                          <Chip
                            label="Status Change"
                            size="small"
                            sx={{
                              height: 16,
                              fontSize: 9.5,
                              fontWeight: 700,
                              backgroundColor: '#DBEAFE',
                              color: '#1D4ED8',
                              px: 0.3,
                            }}
                          />
                        </Box>
                      )}
                      <Typography variant="body2" sx={{ color: '#1E293B', fontSize: 11.5, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                        {n.note}
                      </Typography>
                    </Box>
                  ))
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4, color: '#667A6D' }}>
                    <MessageSquare size={24} color="#94A3B8" style={{ margin: '0 auto 6px' }} />
                    <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 600 }}>
                      No logs recorded yet
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: 10.5 }}>
                      Status updates and remarks will appear here
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          </DialogContent>

          <DialogActions sx={{ p: 2, px: 3, borderTop: '1px solid #E4EBE1' }}>
            <Button
              onClick={() => setSelectedComplaint(null)}
              variant="outlined"
              sx={{ textTransform: 'none', fontWeight: 600, borderColor: '#E4EBE1', color: '#64748B' }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* =====================================================================
          CLOSE WORK ORDER & FEEDBACK MODAL
      ====================================================================== */}
      <Dialog open={isCloseDialogOpen} onClose={() => setIsCloseDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Complete & Close Work Order</DialogTitle>
        <DialogContent dividers>
          <TextField
            label="Resolution Summary *"
            placeholder="Describe repairs conducted, components replaced, tests verified..."
            multiline
            rows={3}
            fullWidth
            required
            value={closeResolutionSummary}
            onChange={(e) => setCloseResolutionSummary(e.target.value)}
            sx={{ mb: 3 }}
          />

          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            Customer Satisfaction Rating
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Rating
              value={closeRating}
              onChange={(_, val) => setCloseRating(val)}
              size="large"
            />
            <Typography variant="caption" color="text.secondary">
              ({closeRating} of 5 Stars)
            </Typography>
          </Box>

          <TextField
            label="Customer Feedback / Voice of Customer Remarks"
            multiline
            rows={2}
            fullWidth
            value={closeFeedbackComment}
            onChange={(e) => setCloseFeedbackComment(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIsCloseDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleCloseSubmit}
            disabled={isClosing}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {isClosing ? 'Closing...' : 'Confirm Closure'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* =====================================================================
          REPLACE COMPONENT SERIAL MODAL
      ====================================================================== */}
      <Dialog open={isReplaceDialogOpen} onClose={() => setIsReplaceDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Replace Component Serial</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Record the installation of a new component replacing the faulty part. The old serial will be archived in the component audit trail.
          </Typography>

          <TextField
            label="New Serial Number *"
            size="small"
            fullWidth
            required
            value={replaceNewSerial}
            onChange={(e) => setReplaceNewSerial(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Reason for Replacement"
            placeholder="e.g. Cell degradation, burnt mosfet, casing crack..."
            size="small"
            fullWidth
            value={replaceReason}
            onChange={(e) => setReplaceReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIsReplaceDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleReplaceComponentSubmit}
            disabled={isReplacing}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {isReplacing ? 'Saving...' : 'Confirm Replacement'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
