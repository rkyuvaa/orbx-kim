import React, { useState, useMemo } from 'react';
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
  Menu,
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
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Download,
  ExternalLink,
  Filter,
  History,
  MapPin,
  MessageSquare,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Sliders,
  Trash2,
  User,
  Wrench,
  X,
  Zap,
} from 'lucide-react';

import { useAppSelector } from '@/app/hooks';
import { usePermission } from '@/context/AuthPermissionContext';
import { useToast } from '@/components/ui/ToastHost';
import { useUsersQuery } from '@/api/mastersApi';
import { AppDropdown } from '@/components/ui/AppDropdown';
import { LocationDisplay, formatNoteLocation, useResolvedAddress } from '@/utils/geolocation';
import { formatDate, formatDateTime } from '@/utils/format';
import {
  useAddVSComplaintNoteMutation,
  useAddVSServiceCostMutation,
  useCloseVSComplaintMutation,
  useCreateVSComplaintMutation,
  useDeleteVSComplaintMutation,
  useGetVSComplaintsQuery,
  useGetVSKitsQuery,
  useGetVSVehiclesQuery,
  useReplaceVSComponentMutation,
  useUpdateVSComplaintMutation,
} from '@/api/vehicleServiceApi';
import type {
  VSComplaint,
  VSComplaintCloseRequest,
  VSComplaintCreate,
  VSKit,
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

const WORKFLOW_STATUS_STAGES = [
  { key: 'OPEN', label: 'OPEN', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', tip: 'Newly registered complaints awaiting acknowledgement' },
  { key: 'ACKNOWLEDGED', label: 'ACKNOWLEDGED', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', tip: 'Verified and acknowledged complaints' },
  { key: 'ASSIGNED', label: 'ASSIGNED', color: '#0891B2', bg: '#CFFAFE', border: '#A5F3FC', tip: 'Assigned to service technician' },
  { key: 'IN_PROGRESS', label: 'IN PROGRESS', color: '#7C3AED', bg: '#F3E8FF', border: '#DDD6FE', tip: 'Under active repair or diagnostic check' },
  { key: 'RESOLVED', label: 'RESOLVED', color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', tip: 'Repairs completed, pending final closure' },
  { key: 'CLOSED', label: 'CLOSED', color: '#475569', bg: '#F8FAFC', border: '#CBD5E1', tip: 'Closed work orders with customer feedback' },
];

export default function VSWorkOrdersTab() {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Unfiltered complaints for status pipeline counts
  const { data: allComplaints = [] } = useGetVSComplaintsQuery({});

  // Filtered complaints for table
  const { data: complaints = [], isLoading, refetch } = useGetVSComplaintsQuery({
    search: search || undefined,
    severity: severityFilter || undefined,
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
  });

  const { data: vehicles = [] } = useGetVSVehiclesQuery();
  const { data: kits = [] } = useGetVSKitsQuery();
  const { data: users = [] } = useUsersQuery();

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      OPEN: 0,
      ACKNOWLEDGED: 0,
      ASSIGNED: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CLOSED: 0,
    };
    allComplaints.forEach((c) => {
      if (counts[c.status] !== undefined) {
        counts[c.status]++;
      }
    });
    return counts;
  }, [allComplaints]);

  const handlePillClick = (statusKey: string) => {
    if (statusFilter === statusKey) {
      setStatusFilter('');
    } else {
      setStatusFilter(statusKey);
    }
  };

  const { isSuperAdmin, can } = usePermission();
  const currentUser = useAppSelector((state) => state.auth.user);
  const canDeleteWorkOrder =
    isSuperAdmin ||
    currentUser?.role === 'ADMIN' ||
    can('delete', 'complaints') ||
    can('delete', 'vehicle_service');

  const { showToast } = useToast();

  // Mutations
  const [createComplaint, { isLoading: isCreating }] = useCreateVSComplaintMutation();
  const [updateComplaint, { isLoading: isUpdating }] = useUpdateVSComplaintMutation();
  const [deleteComplaint, { isLoading: isDeletingComplaint }] = useDeleteVSComplaintMutation();
  const [addNote, { isLoading: isAddingNote }] = useAddVSComplaintNoteMutation();
  const [closeComplaint, { isLoading: isClosing }] = useCloseVSComplaintMutation();
  const [replaceComponent, { isLoading: isReplacing }] = useReplaceVSComponentMutation();
  const [addCost, { isLoading: isAddingCost }] = useAddVSServiceCostMutation();

  // 3-dot Action Menu state
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [actionTargetComplaint, setActionTargetComplaint] = useState<VSComplaint | null>(null);

  const handleOpenActionMenu = (e: React.MouseEvent<HTMLElement>, complaint: VSComplaint) => {
    e.stopPropagation();
    setActionMenuAnchor(e.currentTarget);
    setActionTargetComplaint(complaint);
  };

  const handleCloseActionMenu = () => {
    setActionMenuAnchor(null);
    setActionTargetComplaint(null);
  };

  // Delete Work Order state
  const [deleteTargetComplaint, setDeleteTargetComplaint] = useState<VSComplaint | null>(null);

  const handleConfirmDeleteComplaint = async () => {
    if (!deleteTargetComplaint) return;
    try {
      await deleteComplaint(deleteTargetComplaint.id).unwrap();
      showToast(`Work Order '${deleteTargetComplaint.complaint_no}' deleted successfully`, 'success');
      setDeleteTargetComplaint(null);
      refetch();
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to delete work order.', 'error');
    }
  };

  // Dialog states
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<VSComplaint | null>(null);
  const complaintAddress = useResolvedAddress(
    selectedComplaint?.gps_latitude,
    selectedComplaint?.gps_longitude,
    selectedComplaint?.gps_address,
  );

  // New Complaint Form
  const [vehicleSearchText, setVehicleSearchText] = useState('');
  const [selectedKit, setSelectedKit] = useState<VSKit | null>(null);
  const [isVehicleMenuOpen, setIsVehicleMenuOpen] = useState(false);
  const [newVehicleId, setNewVehicleId] = useState<number | ''>('');
  const [newComponentId, setNewComponentId] = useState<number | ''>('');
  const [newReportedBy, setNewReportedBy] = useState('');
  const [newReportedPhone, setNewReportedPhone] = useState('');
  const [newCategory, setNewCategory] = useState('BREAKDOWN');
  const [newSeverity, setNewSeverity] = useState('MEDIUM');
  const [newDescription, setNewDescription] = useState('');
  const [newAssignedTo, setNewAssignedTo] = useState<number | ''>('');
  const [newInitialNote, setNewInitialNote] = useState('');
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

  const searchTrimmed = vehicleSearchText.trim();
  const hasMinDigits = searchTrimmed.length >= 4;

  const matchedKits = useMemo(() => {
    if (!hasMinDigits) return [];
    const q = searchTrimmed.toLowerCase();
    return kits.filter((k) => {
      const vNo = (k.vehicle_number || '').toLowerCase();
      const kNo = (k.kit_number || '').toLowerCase();
      const kName = (k.kit_name || '').toLowerCase();
      const cust = (k.customer_name || '').toLowerCase();
      return vNo.includes(q) || kNo.includes(q) || kName.includes(q) || cust.includes(q);
    });
  }, [kits, searchTrimmed, hasMinDigits]);

  const availableComponents = useMemo(() => {
    if (selectedKit?.component_types && selectedKit.component_types.length > 0) {
      return selectedKit.component_types.map((ct) => ({
        id: ct.id,
        label: ct.serial_number ? `${ct.label} (Serial: ${ct.serial_number})` : ct.label,
        serial_number: ct.serial_number,
      }));
    }
    if (selectedVehicleObj?.components && selectedVehicleObj.components.length > 0) {
      return selectedVehicleObj.components.map((c) => ({
        id: c.id,
        label: `${c.component_label} (Serial: ${c.serial_number})`,
        serial_number: c.serial_number,
      }));
    }
    return [];
  }, [selectedKit, selectedVehicleObj]);

  const handleOpenNewDialog = () => {
    setVehicleSearchText('');
    setSelectedKit(null);
    setIsVehicleMenuOpen(false);
    setNewVehicleId('');
    setNewComponentId('');
    setNewReportedBy('');
    setNewReportedPhone('');
    setNewCategory('BREAKDOWN');
    setNewSeverity('MEDIUM');
    setNewDescription('');
    setNewAssignedTo('');
    setNewInitialNote('');
    setCreateError(null);
    setIsNewDialogOpen(true);
  };

  const handleSelectKitInForm = (k: VSKit) => {
    setSelectedKit(k);
    setVehicleSearchText(k.vehicle_number ? `${k.vehicle_number} — ${k.kit_name}` : `${k.kit_name} (${k.kit_number})`);
    setIsVehicleMenuOpen(false);
    setNewComponentId('');

    // Pre-fill reporter name with customer name
    if (k.customer_name) {
      setNewReportedBy(k.customer_name);
    }

    // Check if vehicle exists for kit to sync phone/id
    const matchedVeh = vehicles.find((v) => v.kit_id === k.id || (k.vehicle_number && v.vehicle_number.toUpperCase() === k.vehicle_number.toUpperCase()));
    if (matchedVeh) {
      setNewVehicleId(matchedVeh.id);
      if (matchedVeh.owner_phone && !newReportedPhone) {
        setNewReportedPhone(matchedVeh.owner_phone);
      }
    } else {
      setNewVehicleId('');
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicleId && !selectedKit) {
      setCreateError('Please search and select a vehicle/kit from KIT Master.');
      return;
    }
    setCreateError(null);

    const reporter = newReportedBy.trim() || selectedKit?.customer_name || 'Customer';
    const phone = newReportedPhone.trim() || '0000000000';
    const desc =
      newDescription.trim() ||
      `${newCategory} issue reported for ${selectedKit?.vehicle_number || selectedKit?.kit_name || 'Vehicle'}`;

    const payload: VSComplaintCreate = {
      kit_id: selectedKit?.id,
      vehicle_id: newVehicleId ? Number(newVehicleId) : undefined,
      vehicle_number: selectedKit?.vehicle_number || selectedVehicleObj?.vehicle_number || undefined,
      affected_component_id: newComponentId ? Number(newComponentId) : undefined,
      reported_by: reporter,
      reported_phone: phone,
      category: newCategory,
      severity: newSeverity,
      description: desc,
      assigned_to_id: newAssignedTo ? Number(newAssignedTo) : undefined,
    };

    try {
      const created = await createComplaint(payload).unwrap();
      if (newInitialNote.trim()) {
        try {
          await addNote({ complaintId: created.id, note: newInitialNote.trim() }).unwrap();
        } catch {
          // Non-blocking note
        }
      }
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
      {/* Top Header: Status Pipeline Pills (matching CRM) & Create Work Order */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
          mb: 2,
        }}
      >
        {/* Status Pipeline Pills */}
        <Box sx={{ overflowX: 'auto', py: 0.5, flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 'max-content', gap: 0 }}>
            {WORKFLOW_STATUS_STAGES.map((stage, i) => {
              const isSelected = statusFilter === stage.key;
              const count = statusCounts[stage.key] || 0;

              return (
                <Box key={stage.key} sx={{ display: 'flex', alignItems: 'center' }}>
                  <Tooltip title={stage.tip} placement="top" arrow>
                    <Box
                      component="button"
                      type="button"
                      onClick={() => handlePillClick(stage.key)}
                      sx={{
                        width: 122,
                        height: 66,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 0.4,
                        border: '1.5px solid',
                        borderColor: isSelected ? stage.color : stage.border,
                        borderRadius: '11px',
                        padding: '4px 4px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? `${stage.color}18` : stage.bg,
                        boxShadow: isSelected
                          ? `0 4px 14px ${stage.color}33`
                          : '0 1px 3px rgba(0, 0, 0, 0.04)',
                        transition: 'all 0.15s ease',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                        flexShrink: 0,
                        '&:hover': {
                          borderColor: stage.color,
                          transform: 'translateY(-2px)',
                          boxShadow: `0 4px 12px ${stage.color}26`,
                        },
                      }}
                    >
                      {/* Rounded white background badge for count */}
                      <Box
                        sx={{
                          minWidth: 34,
                          height: 25,
                          padding: '0 8px',
                          borderRadius: 13,
                          backgroundColor: '#FFFFFF',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
                          border: `1px solid ${stage.color}25`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography
                          component="span"
                          sx={{
                            fontSize: 15,
                            fontWeight: 800,
                            color: stage.color,
                            letterSpacing: '-0.3px',
                            lineHeight: 1,
                          }}
                        >
                          {count}
                        </Typography>
                      </Box>

                      {/* Stage Label */}
                      <Typography
                        sx={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: stage.color,
                          textAlign: 'center',
                          textTransform: 'uppercase',
                          letterSpacing: 0.3,
                          lineHeight: 1,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {stage.label}
                      </Typography>
                    </Box>
                  </Tooltip>

                  {i < WORKFLOW_STATUS_STAGES.length - 1 && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#9BA99F',
                        width: 20,
                        flexShrink: 0,
                      }}
                    >
                      <ChevronRight size={15} />
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>

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
            px: 2.2,
            py: 1,
            boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
            flexShrink: 0,
          }}
        >
          Create Work Order
        </Button>
      </Box>

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
                      <LocationDisplay
                        lat={c.gps_latitude}
                        lng={c.gps_longitude}
                        address={c.gps_address}
                        variant="table"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        {formatDateTime(c.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      <IconButton
                        size="small"
                        onClick={(e) => handleOpenActionMenu(e, c)}
                        sx={{
                          color: '#64748B',
                          borderRadius: '8px',
                          border: '1px solid #E2E8E2',
                          p: 0.6,
                          '&:hover': {
                            color: '#023020',
                            backgroundColor: '#F0FDF4',
                            borderColor: '#023020',
                          },
                        }}
                      >
                        <MoreVertical size={16} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* 3-dot Row Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleCloseActionMenu}
        PaperProps={{
          sx: {
            minWidth: 175,
            borderRadius: '10px',
            border: '1px solid #E2E8E2',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            py: 0.5,
          },
        }}
      >
        <MenuItem
          onClick={() => {
            if (actionTargetComplaint) {
              setSelectedComplaint(actionTargetComplaint);
            }
            handleCloseActionMenu();
          }}
          sx={{ display: 'flex', alignItems: 'center', gap: 1.2, py: 1, fontSize: 13, fontWeight: 600, color: '#0F172A' }}
        >
          <Wrench size={15} color="#023020" />
          Manage Work Order
        </MenuItem>

        {canDeleteWorkOrder && (
          <MenuItem
            onClick={() => {
              if (actionTargetComplaint) {
                setDeleteTargetComplaint(actionTargetComplaint);
              }
              handleCloseActionMenu();
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.2,
              py: 1,
              fontSize: 13,
              fontWeight: 600,
              color: '#DC2626',
              '&:hover': {
                backgroundColor: '#FEF2F2',
              },
            }}
          >
            <Trash2 size={15} color="#DC2626" />
            Delete Work Order
          </MenuItem>
        )}
      </Menu>

      {/* Delete Work Order Confirmation Dialog */}
      {deleteTargetComplaint && (
        <Dialog
          open={Boolean(deleteTargetComplaint)}
          onClose={() => setDeleteTargetComplaint(null)}
          maxWidth="xs"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
        >
          <DialogTitle sx={{ fontWeight: 800, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 1 }}>
            <AlertTriangle size={20} /> Delete Work Order
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: '#334155', fontSize: 13.5, lineHeight: 1.5 }}>
              Are you sure you want to permanently delete Work Order <strong>{deleteTargetComplaint.complaint_no}</strong> for vehicle <strong>{deleteTargetComplaint.vehicle_number || 'Vehicle'}</strong>?
              This will remove all associated logs, technician notes, and service cost records.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 2.5, pb: 1.5 }}>
            <Button onClick={() => setDeleteTargetComplaint(null)} sx={{ textTransform: 'none', color: '#64748B' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleConfirmDeleteComplaint}
              disabled={isDeletingComplaint}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
            >
              {isDeletingComplaint ? 'Deleting...' : 'Delete Work Order'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* =====================================================================
          NEW WORK ORDER DIALOG (Same size & layout as Manage dialog)
      ====================================================================== */}
      <Dialog
        open={isNewDialogOpen}
        onClose={() => setIsNewDialogOpen(false)}
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
              Create New Work Order
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Search vehicle from KIT Master, specify reporter & problem details, and tag affected components.
            </Typography>
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
          {/* LEFT SIDE: Work Order Fields (~68%) */}
          <Box
            sx={{
              flex: { xs: '1 1 100%', md: '1 1 68%' },
              minWidth: 0,
              overflowY: { xs: 'visible', md: 'auto' },
              pr: { xs: 0, md: 1 },
              display: 'flex',
              flexDirection: 'column',
              gap: 2.5,
            }}
          >
            {createError && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                {createError}
              </Alert>
            )}

            {/* Retrofitted Vehicle Search from KIT Master (Min 4 digits required) */}
            <Box sx={{ position: 'relative' }}>
              <TextField
                label="Retrofitted Vehicle (from KIT Master)"
                placeholder="Type at least 4 digits to search (e.g. TN66, KIM1, 7023)..."
                fullWidth
                size="small"
                required
                value={vehicleSearchText}
                onChange={(e) => {
                  setVehicleSearchText(e.target.value);
                  setIsVehicleMenuOpen(true);
                  if (selectedKit) {
                    setSelectedKit(null);
                    setNewComponentId('');
                  }
                }}
                onFocus={() => {
                  if (vehicleSearchText.trim().length >= 4) {
                    setIsVehicleMenuOpen(true);
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={16} color="#64748B" />
                    </InputAdornment>
                  ),
                  endAdornment: vehicleSearchText ? (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setVehicleSearchText('');
                          setSelectedKit(null);
                          setNewComponentId('');
                          setIsVehicleMenuOpen(false);
                        }}
                      >
                        <X size={14} />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
                helperText={
                  !hasMinDigits
                    ? 'Type at least 4 digits/characters to view matching records from KIT Master.'
                    : `${matchedKits.length} matching record(s) found in KIT Master.`
                }
              />

              {/* Matched Results Floating Menu (Only if >= 4 digits entered) */}
              {isVehicleMenuOpen && hasMinDigits && (
                <Paper
                  elevation={4}
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 1400,
                    maxHeight: 250,
                    overflowY: 'auto',
                    borderRadius: '8px',
                    border: '1px solid #E2E8E2',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    mt: 0.5,
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  {matchedKits.length > 0 ? (
                    matchedKits.map((k) => (
                      <Box
                        key={k.id}
                        onClick={() => handleSelectKitInForm(k)}
                        sx={{
                          p: 1.5,
                          cursor: 'pointer',
                          borderBottom: '1px solid #F1F5F9',
                          '&:hover': {
                            backgroundColor: '#F0FDF4',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.4 }}>
                          <Typography sx={{ fontWeight: 800, color: '#0F172A', fontSize: 13.5 }}>
                            {k.vehicle_number || '[No Vehicle No Assigned]'}
                          </Typography>
                          <Chip
                            label={k.kit_name}
                            size="small"
                            sx={{ height: 20, fontSize: 11, fontWeight: 700, backgroundColor: '#E2E8F0' }}
                          />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#1D4ED8', fontWeight: 600 }}>
                            ID: {k.kit_number}
                          </Typography>
                          {k.customer_name && (
                            <Typography variant="caption" sx={{ color: '#334155', fontWeight: 600 }}>
                              Customer: {k.customer_name}
                            </Typography>
                          )}
                          {k.installed_on && (
                            <Typography variant="caption" sx={{ color: '#166534', fontWeight: 600 }}>
                              Installed: {formatDate(k.installed_on)}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ))
                  ) : (
                    <Box sx={{ p: 2, textAlign: 'center', color: '#64748B' }}>
                      <Typography variant="body2" sx={{ fontSize: 12.5 }}>
                        No matching records found in KIT Master for <strong>"{searchTrimmed}"</strong>.
                      </Typography>
                    </Box>
                  )}
                </Paper>
              )}
            </Box>

            {/* Selected Kit Master Info Card */}
            {selectedKit && (
              <Box sx={{ p: 1.5, bgcolor: '#F0FDF4', borderRadius: '8px', border: '1px solid #BBF7D0' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5, flexWrap: 'gap', gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#166534' }}>
                    {selectedKit.vehicle_number || selectedKit.kit_name}
                  </Typography>
                  <Chip
                    label={selectedKit.kit_number}
                    size="small"
                    sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11, backgroundColor: '#DCFCE7', color: '#15803D' }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  {selectedKit.customer_name && (
                    <Typography variant="caption" sx={{ color: '#334155' }}>
                      Customer: <strong>{selectedKit.customer_name}</strong>
                    </Typography>
                  )}
                  {selectedKit.installed_on && (
                    <Typography variant="caption" sx={{ color: '#166534' }}>
                      Installation Done On: <strong>{formatDate(selectedKit.installed_on)}</strong>
                    </Typography>
                  )}
                  <Typography variant="caption" sx={{ color: '#64748B' }}>
                    {availableComponents.length} component(s) tracked
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Complainant Details */}
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Reporter Name"
                  size="small"
                  fullWidth
                  value={newReportedBy}
                  onChange={(e) => setNewReportedBy(e.target.value)}
                  placeholder="Owner / Driver name"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Reporter Phone"
                  size="small"
                  fullWidth
                  value={newReportedPhone}
                  onChange={(e) => setNewReportedPhone(e.target.value)}
                  placeholder="Contact phone"
                />
              </Grid>
            </Grid>

            {/* Category & Severity */}
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <AppDropdown
                  label="Category"
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
                  label="Severity"
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

            {/* Description */}
            <TextField
              label="Problem Description"
              placeholder="Describe issue, symptoms, or observation (optional - defaults to category issue)"
              multiline
              rows={3}
              fullWidth
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </Box>

          {/* RIGHT SIDE: Kit Components & Intake Log (~32%) */}
          <Paper
            variant="outlined"
            sx={{
              flex: { xs: '1 1 100%', md: '0 0 32%' },
              width: { xs: '100%', md: '32%' },
              minWidth: { xs: '100%', md: 280 },
              maxWidth: { md: 360 },
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
                  <Cpu size={15} />
                </Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#023020', fontSize: 13 }}>
                  Kit Components
                </Typography>
              </Box>
              <Chip
                label={`${availableComponents.length} items`}
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

            <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 1 }}>
              Click any component below to tag it as the affected part for this work order:
            </Typography>

            {/* Scrollable Components List */}
            <Box
              sx={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                pr: 0.5,
                maxHeight: 280,
                mb: 2,
              }}
            >
              {availableComponents.length > 0 ? (
                availableComponents.map((comp) => {
                  const isSelected = newComponentId === comp.id;
                  return (
                    <Box
                      key={comp.id}
                      onClick={() => setNewComponentId(isSelected ? '' : comp.id)}
                      sx={{
                        p: 1.2,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#F0FDF4' : '#FFFFFF',
                        border: isSelected ? '1.5px solid #16A34A' : '1px solid #E2E8E2',
                        borderLeft: isSelected ? '3.5px solid #16A34A' : '1px solid #E2E8E2',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        transition: 'all 0.12s ease',
                        '&:hover': {
                          backgroundColor: isSelected ? '#DCFCE7' : '#F8FAF8',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.3 }}>
                        <Typography sx={{ fontWeight: isSelected ? 800 : 600, color: isSelected ? '#166534' : '#0F172A', fontSize: 12 }}>
                          {comp.label}
                        </Typography>
                        {isSelected && <Check size={14} color="#16A34A" />}
                      </Box>
                      {comp.serial_number && (
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#1D4ED8', fontSize: 11 }}>
                          SN: {comp.serial_number}
                        </Typography>
                      )}
                    </Box>
                  );
                })
              ) : (
                <Box sx={{ textAlign: 'center', py: 4, color: '#667A6D' }}>
                  <Cpu size={24} color="#94A3B8" style={{ margin: '0 auto 6px' }} />
                  <Typography variant="caption" sx={{ fontSize: 11.5, fontWeight: 600, display: 'block' }}>
                    Select a Kit above to view components
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: 10.5 }}>
                    Tracked serial numbers will appear here
                  </Typography>
                </Box>
              )}
            </Box>

            <Divider sx={{ mb: 1.5, borderColor: '#E4EBE1' }} />

            {/* Intake Remark / Initial Log */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 }}>
                <History size={14} color="#023020" />
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#023020', fontSize: 12 }}>
                  Intake Note & Log
                </Typography>
              </Box>
              <TextField
                placeholder="Add arrival observation, intake note, or initial remark..."
                size="small"
                multiline
                rows={2}
                fullWidth
                value={newInitialNote}
                onChange={(e) => setNewInitialNote(e.target.value)}
                sx={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '6px',
                  '& .MuiOutlinedInput-root': { fontSize: 11.5 },
                }}
              />
              <Typography variant="caption" sx={{ color: '#64748B', fontSize: 10.5, display: 'block', mt: 0.5 }}>
                Will be captured in the work order changelog upon creation.
              </Typography>
            </Box>
          </Paper>
        </DialogContent>

        <DialogActions sx={{ p: 2, px: 3, borderTop: '1px solid #E4EBE1' }}>
          <Button onClick={() => setIsNewDialogOpen(false)} sx={{ textTransform: 'none', color: '#64748B' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateSubmit}
            disabled={isCreating}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              backgroundColor: '#023020',
              '&:hover': { backgroundColor: '#034732' },
              borderRadius: '8px',
              px: 3,
            }}
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
                {formatDateTime(selectedComplaint.created_at)}
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
                    {(() => {
                      const veh = vehicles.find((v) => v.id === selectedComplaint.vehicle_id);
                      if (veh?.retrofit_date) {
                        return (
                          <Typography variant="body2">
                            <strong>Installation Done On:</strong> {formatDate(veh.retrofit_date)}
                          </Typography>
                        );
                      }
                      return null;
                    })()}
                    <Typography variant="body2">
                      <strong>Reported By:</strong> {selectedComplaint.reported_by} ({selectedComplaint.reported_phone})
                    </Typography>

                    <Box sx={{ mt: 1.5 }}>
                      <LocationDisplay
                        lat={selectedComplaint.gps_latitude}
                        lng={selectedComplaint.gps_longitude}
                        address={selectedComplaint.gps_address}
                        variant="card"
                        showMapLink
                      />
                    </Box>
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
              <Box sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
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
                {complaintAddress && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                    <MapPin size={11} color="#2563EB" style={{ flexShrink: 0 }} />
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#1D4ED8',
                        fontWeight: 600,
                        fontSize: 11,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {complaintAddress}
                    </Typography>
                  </Box>
                )}
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
                          {formatDateTime(n.created_at)}
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
                        {formatNoteLocation(n.note, complaintAddress)}
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
