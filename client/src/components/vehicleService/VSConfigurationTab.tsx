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
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
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
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Layers,
  Pencil,
  Plus,
  QrCode,
  Settings,
  Trash2,
  Upload,
  Wrench,
  Zap,
} from 'lucide-react';

import { useAppSelector } from '@/app/hooks';
import { usePermission } from '@/context/AuthPermissionContext';
import { useUsersQuery } from '@/api/mastersApi';
import { useToast } from '@/components/ui/ToastHost';
import { formatDate, formatDateTime } from '@/utils/format';
import DropdownOptionsPanel from '@/features/configuration/DropdownOptionsPanel';
import {
  useCreateVSKitMutation,
  useCreateVSMaintenanceMutation,
  useCreateVSVehicleMutation,
  useDeleteVSKitMutation,
  useGetVSKitsQuery,
  useGetVSMaintenanceQuery,
  useGetVSVehiclesQuery,
  useImportVSKitPdfMutation,
  useParseVSKitPdfMutation,
  useUpdateVSKitMutation,
  useUpdateVSMaintenanceMutation,
} from '@/api/vehicleServiceApi';
import type {
  VSKit,
  VSKitCreate,
  VSKitPdfParsePreview,
  VSKitUpdate,
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

function DdMmYyyyInput({
  label,
  value,
  onChange,
  disabled = false,
  required = false,
  fullWidth = true,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
}) {
  const hiddenDateRef = useRef<HTMLInputElement>(null);

  const toDisplay = (iso: string) => {
    if (!iso) return '';
    const clean = iso.split('T')[0].trim();
    const parts = clean.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return iso;
  };

  const toIso = (formatted: string) => {
    if (!formatted) return '';
    const parts = formatted.trim().split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return formatted;
  };

  const displayVal = toDisplay(value);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw.trim())) {
      onChange(toIso(raw.trim()));
    } else {
      onChange(raw);
    }
  };

  return (
    <Box sx={{ position: 'relative', width: fullWidth ? '100%' : 'auto' }}>
      <TextField
        label={label}
        size="small"
        fullWidth={fullWidth}
        required={required}
        disabled={disabled}
        placeholder="dd/mm/yyyy"
        value={displayVal}
        onChange={handleTextChange}
        InputProps={{
          endAdornment: (
            <IconButton
              size="small"
              disabled={disabled}
              onClick={() => {
                if (hiddenDateRef.current) {
                  if (typeof hiddenDateRef.current.showPicker === 'function') {
                    hiddenDateRef.current.showPicker();
                  } else {
                    hiddenDateRef.current.focus();
                  }
                }
              }}
              sx={{ color: '#64748B' }}
            >
              <Calendar size={16} />
            </IconButton>
          ),
        }}
      />
      <input
        type="date"
        ref={hiddenDateRef}
        value={value ? value.slice(0, 10) : ''}
        onChange={(e) => {
          if (e.target.value) {
            onChange(e.target.value);
          }
        }}
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
          bottom: 0,
          right: 0,
          width: 1,
          height: 1,
        }}
      />
    </Box>
  );
}

export default function VSConfigurationTab() {
  const [activeTab, setActiveTab] = useState(0);

  // Auth & Admin verification
  const currentUser = useAppSelector((state) => state.auth.user);
  const { isSuperAdmin, can } = usePermission();
  const isAdmin =
    isSuperAdmin ||
    currentUser?.role === 'ADMIN' ||
    can('edit', 'kits') ||
    can('edit', 'vehicle_service');

  // Queries
  const { data: kits = [], isLoading: isKitsLoading, refetch: refetchKits } = useGetVSKitsQuery();
  const { data: vehicles = [], isLoading: isVehiclesLoading, refetch: refetchVehicles } = useGetVSVehiclesQuery();
  const { data: maintenanceList = [], isLoading: isMaintLoading, refetch: refetchMaint } = useGetVSMaintenanceQuery();
  const { data: users = [] } = useUsersQuery();

  // Mutations
  const { showToast } = useToast();
  const [createKit, { isLoading: isCreatingKit }] = useCreateVSKitMutation();
  const [updateKit] = useUpdateVSKitMutation();
  const [parsePdf, { isLoading: isParsingPdf }] = useParseVSKitPdfMutation();
  const [importPdf, { isLoading: isImportingPdf }] = useImportVSKitPdfMutation();
  const [createVehicle, { isLoading: isCreatingVehicle }] = useCreateVSVehicleMutation();
  const [createMaintenance, { isLoading: isCreatingMaint }] = useCreateVSMaintenanceMutation();
  const [updateMaintenance] = useUpdateVSMaintenanceMutation();

  // Dialogs
  const [isKitDialogOpen, setIsKitDialogOpen] = useState(false);
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false);
  const [isMaintDialogOpen, setIsMaintDialogOpen] = useState(false);

  // PDF Import State
  const [isPdfImportOpen, setIsPdfImportOpen] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [parsedPdfData, setParsedPdfData] = useState<VSKitPdfParsePreview | null>(null);
  const [importVehicleNumber, setImportVehicleNumber] = useState('');
  const [importCustomerPhone, setImportCustomerPhone] = useState('');
  const [importInstalledOn, setImportInstalledOn] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // View Components Modal
  const [viewingKitComponents, setViewingKitComponents] = useState<VSKit | null>(null);

  // Inline editing of vehicle number on Kit Master
  const [editingKitVehicleId, setEditingKitVehicleId] = useState<number | null>(null);
  const [editingKitVehicleNo, setEditingKitVehicleNo] = useState('');

  // Delete Kit Mutation
  const [deleteKit, { isLoading: isDeletingKit }] = useDeleteVSKitMutation();

  // Edit Kit Modal State (Admin Only)
  const [editingKit, setEditingKit] = useState<VSKit | null>(null);
  const [editKitForm, setEditKitForm] = useState<VSKitUpdate>({
    kit_name: '',
    kit_number: '',
    customer_name: '',
    customer_phone: '',
    vehicle_number: '',
    installed_on: '',
    description: '',
    is_active: true,
  });
  const [editKitComponents, setEditKitComponents] = useState<
    { id?: number; component_type: string; label: string; serial_number: string; is_required: boolean }[]
  >([]);
  const [editKitError, setEditKitError] = useState<string | null>(null);

  // Delete Kit State
  const [deleteKitTarget, setDeleteKitTarget] = useState<VSKit | null>(null);

  // New Kit Form State
  const [kitNumber, setKitNumber] = useState('');
  const [kitName, setKitName] = useState('');
  const [kitCustomerName, setKitCustomerName] = useState('');
  const [kitCustomerPhone, setKitCustomerPhone] = useState('');
  const [kitInstalledOn, setKitInstalledOn] = useState('');
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
      customer_name: kitCustomerName.trim() || undefined,
      customer_phone: kitCustomerPhone.trim() || undefined,
      installed_on: kitInstalledOn || undefined,
      description: kitDescription.trim() || undefined,
      component_types: kitComponentTypes,
    };

    try {
      await createKit(payload).unwrap();
      setIsKitDialogOpen(false);
      setKitNumber('');
      setKitName('');
      setKitCustomerName('');
      setKitCustomerPhone('');
      setKitInstalledOn('');
      setKitDescription('');
      refetchKits();
    } catch (err: any) {
      setKitError(err?.data?.detail || 'Failed to create kit.');
    }
  };

  const handlePdfFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfFile(file);
    setImportError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await parsePdf(formData).unwrap();
      setParsedPdfData(res);
      setImportVehicleNumber(res.vehicle_number || '');
      setImportInstalledOn(res.installed_on || '');
    } catch (err: any) {
      setImportError(err?.data?.detail || 'Failed to parse Kit PDF document.');
    }
  };

  const handleConfirmImportPdf = async () => {
    if (!pdfFile) return;
    const formData = new FormData();
    formData.append('file', pdfFile);
    if (importVehicleNumber.trim()) {
      formData.append('vehicle_number', importVehicleNumber.trim().toUpperCase());
    }
    if (importCustomerPhone.trim()) {
      formData.append('customer_phone', importCustomerPhone.trim());
    }
    if (importInstalledOn) {
      formData.append('installed_on', importInstalledOn);
    }
    try {
      await importPdf(formData).unwrap();
      showToast('Kit and components successfully imported into Kit Master!', 'success');
      setIsPdfImportOpen(false);
      setPdfFile(null);
      setParsedPdfData(null);
      setImportVehicleNumber('');
      setImportCustomerPhone('');
      setImportInstalledOn('');
      refetchKits();
    } catch (err: any) {
      setImportError(err?.data?.detail || 'Failed to import Kit PDF.');
    }
  };

  const handleSaveKitVehicleNumber = async (kitId: number) => {
    try {
      await updateKit({
        id: kitId,
        body: { vehicle_number: editingKitVehicleNo.trim().toUpperCase() || undefined },
      }).unwrap();
      showToast('Vehicle Number updated successfully', 'success');
      setEditingKitVehicleId(null);
      refetchKits();
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to update vehicle number', 'error');
    }
  };

  const handleOpenEditKit = (kit: VSKit) => {
    if (!isAdmin) {
      showToast('Only Admin role can edit Kit Master records and components.', 'error');
      return;
    }
    setEditingKit(kit);
    setEditKitForm({
      kit_name: kit.kit_name,
      kit_number: kit.kit_number,
      customer_name: kit.customer_name || '',
      customer_phone: kit.customer_phone || '',
      vehicle_number: kit.vehicle_number || '',
      installed_on: kit.installed_on || '',
      description: kit.description || '',
      is_active: kit.is_active,
    });
    setEditKitComponents(
      (kit.component_types || []).map((ct) => ({
        id: ct.id,
        component_type: ct.component_type,
        label: ct.label,
        serial_number: ct.serial_number || '',
        is_required: ct.is_required,
      }))
    );
    setEditKitError(null);
  };

  const handleAddEditComponent = () => {
    setEditKitComponents((prev) => [
      ...prev,
      {
        component_type: 'CUSTOM',
        label: '',
        serial_number: '',
        is_required: true,
      },
    ]);
  };

  const handleRemoveEditComponent = (index: number) => {
    setEditKitComponents((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateEditComponent = (index: number, field: string, val: string) => {
    setEditKitComponents((prev) =>
      prev.map((c, idx) => (idx === index ? { ...c, [field]: val } : c))
    );
  };

  const handleSaveEditKit = async () => {
    if (!editingKit) return;
    if (!isAdmin) {
      setEditKitError('Only Admin role can edit Kit Master records and components.');
      return;
    }
    if (!editKitForm.kit_name?.trim() || !editKitForm.kit_number?.trim()) {
      setEditKitError('Kit Name and Kit Number are required.');
      return;
    }

    try {
      await updateKit({
        id: editingKit.id,
        body: {
          kit_name: editKitForm.kit_name.trim(),
          kit_number: editKitForm.kit_number.trim().toUpperCase(),
          customer_name: editKitForm.customer_name?.trim() || undefined,
          customer_phone: editKitForm.customer_phone?.trim() || undefined,
          vehicle_number: editKitForm.vehicle_number?.trim().toUpperCase() || undefined,
          installed_on: editKitForm.installed_on || undefined,
          description: editKitForm.description?.trim() || undefined,
          is_active: editKitForm.is_active,
          component_types: editKitComponents.map((c) => ({
            component_type: c.component_type.trim() || 'CUSTOM',
            label: c.label.trim(),
            serial_number: c.serial_number.trim() || undefined,
            is_required: c.is_required,
          })),
        },
      }).unwrap();
      showToast('Kit Master and component details updated successfully', 'success');
      setEditingKit(null);
      refetchKits();
    } catch (err: any) {
      setEditKitError(err?.data?.detail || 'Failed to update kit master.');
    }
  };

  const handleConfirmDeleteKit = async () => {
    if (!deleteKitTarget) return;
    try {
      await deleteKit(deleteKitTarget.id).unwrap();
      showToast(`Kit '${deleteKitTarget.kit_name}' deleted successfully`, 'success');
      setDeleteKitTarget(null);
      refetchKits();
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to delete kit.', 'error');
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
    <div>
      {/* Top Header matching CRM */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3, color: '#023020' }}>
          Configuration
        </div>
        <div style={{ fontSize: 13, color: '#7A8B80', marginTop: 3 }}>
          Manage EV retrofitment kits, vehicle registrations, component serial tracking, and QR code assets.
        </div>
      </div>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: '#E4EBE1', mb: 2.5 }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          textColor="primary"
          indicatorColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': { textTransform: 'none', fontSize: 13, fontWeight: 600 },
          }}
        >
          <Tab label={`1. Kit Master (${kits.length})`} />
          <Tab label={`2. Retrofitted Vehicles (${vehicles.length})`} />
          <Tab label="3. QR Code Center" />
          <Tab label={`4. Preventive Maintenance (${maintenanceList.length})`} />
          <Tab label="5. Complaint Categories" />
        </Tabs>
      </Box>

      <div>
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Button
                    variant="outlined"
                    startIcon={<Upload size={16} />}
                    onClick={() => {
                      setIsPdfImportOpen(true);
                      setPdfFile(null);
                      setParsedPdfData(null);
                      setImportVehicleNumber('');
                      setImportError(null);
                    }}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 2,
                      borderColor: '#023020',
                      color: '#023020',
                      '&:hover': { borderColor: '#034732', backgroundColor: '#F0FDF4' },
                    }}
                  >
                    Import Kit from PDF
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Plus size={16} />}
                    onClick={() => setIsKitDialogOpen(true)}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: '#023020', '&:hover': { bgcolor: '#034732' } }}
                  >
                    Create Kit Master
                  </Button>
                </Box>
              </Box>

              {kits.length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
                  <Layers size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: '#94a3b8' }} />
                  <Typography variant="subtitle1" fontWeight={700}>
                    No Kit Masters Configured
                  </Typography>
                  <Typography variant="body2" sx={{ maxWidth: 420, mx: 'auto', mt: 1 }}>
                    Click "Create Kit Master" or "Import Kit from PDF" to define the components that make up your 3-wheeler EV conversion kit.
                  </Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        <TableCell sx={{ fontWeight: 700 }}>Vehicle Number (Title)</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Kit Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Kit ID / Lot/Serial</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Customer Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Serialized Components</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Installation Done On</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Created Date</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {kits.map((kit) => (
                        <TableRow key={kit.id} hover>
                          {/* Vehicle Number (Title field - editable) */}
                          <TableCell sx={{ minWidth: 170 }}>
                            {editingKitVehicleId === kit.id ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <TextField
                                  size="small"
                                  placeholder="e.g. KA01AB1234"
                                  value={editingKitVehicleNo}
                                  onChange={(e) => setEditingKitVehicleNo(e.target.value)}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveKitVehicleNumber(kit.id);
                                    if (e.key === 'Escape') setEditingKitVehicleId(null);
                                  }}
                                  sx={{ width: 140, '& .MuiOutlinedInput-input': { py: 0.4, fontSize: 12, fontWeight: 700 } }}
                                />
                                <IconButton size="small" onClick={() => handleSaveKitVehicleNumber(kit.id)} sx={{ color: '#16a34a' }}>
                                  <Check size={14} />
                                </IconButton>
                              </Box>
                            ) : (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                {kit.vehicle_number ? (
                                  <Chip
                                    label={kit.vehicle_number}
                                    color="primary"
                                    size="small"
                                    sx={{ fontWeight: 800, fontSize: 12, backgroundColor: '#023020' }}
                                  />
                                ) : (
                                  <Typography
                                    variant="caption"
                                    sx={{ color: '#94a3b8', fontStyle: 'italic', cursor: 'pointer' }}
                                    onClick={() => {
                                      setEditingKitVehicleId(kit.id);
                                      setEditingKitVehicleNo(kit.vehicle_number || '');
                                    }}
                                  >
                                    + Assign Vehicle No
                                  </Typography>
                                )}
                                <Tooltip title="Edit Vehicle Number">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setEditingKitVehicleId(kit.id);
                                      setEditingKitVehicleNo(kit.vehicle_number || '');
                                    }}
                                    sx={{ color: '#94a3b8', '&:hover': { color: '#023020' } }}
                                  >
                                    <Pencil size={12} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            )}
                          </TableCell>

                          <TableCell sx={{ fontWeight: 700 }}>{kit.kit_name}</TableCell>

                          <TableCell>
                            <Chip
                              label={kit.kit_number}
                              size="small"
                              sx={{
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                fontSize: 12,
                                backgroundColor: '#EFF6FF',
                                color: '#1D4ED8',
                                border: '1px solid #BFDBFE',
                              }}
                            />
                          </TableCell>

                          <TableCell sx={{ fontWeight: 600, color: '#334155' }}>
                            <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{kit.customer_name || '—'}</Typography>
                            {kit.customer_phone && (
                              <Typography variant="caption" sx={{ color: '#64748B', display: 'block', fontSize: 11 }}>
                                {kit.customer_phone}
                              </Typography>
                            )}
                          </TableCell>

                          <TableCell>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<Eye size={12} />}
                              onClick={() => setViewingKitComponents(kit)}
                              sx={{
                                textTransform: 'none',
                                fontSize: 11.5,
                                fontWeight: 600,
                                py: 0.3,
                                px: 1.2,
                                borderRadius: '6px',
                                borderColor: '#E2E8F0',
                                color: '#023020',
                                '&:hover': { borderColor: '#023020', backgroundColor: '#F8FAF8' },
                              }}
                            >
                              {kit.component_types.length} Components
                            </Button>
                          </TableCell>

                          {/* Installation Done On */}
                          <TableCell sx={{ color: '#0F172A', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
                            {kit.installed_on ? formatDate(kit.installed_on) : '—'}
                          </TableCell>

                          {/* Created Date */}
                          <TableCell sx={{ color: '#64748B', fontSize: 12, whiteSpace: 'nowrap' }}>
                            {kit.created_at ? formatDate(kit.created_at) : '—'}
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            <Chip
                              label={kit.is_active ? 'Active' : 'Archived'}
                              size="small"
                              color={kit.is_active ? 'success' : 'default'}
                            />
                          </TableCell>

                          {/* Actions (after status) */}
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                              <Tooltip title={isAdmin ? "Edit Kit Details & Components" : "Only Admin can edit Kit Master"}>
                                <span>
                                  <IconButton
                                    size="small"
                                    disabled={!isAdmin}
                                    onClick={() => handleOpenEditKit(kit)}
                                    sx={{
                                      color: isAdmin ? '#64748B' : '#CBD5E1',
                                      '&:hover': isAdmin ? { color: '#023020', backgroundColor: '#F0FDF4' } : undefined,
                                    }}
                                  >
                                    <Pencil size={15} />
                                  </IconButton>
                                </span>
                              </Tooltip>

                              <Tooltip title="Delete Kit">
                                <IconButton
                                  size="small"
                                  onClick={() => setDeleteKitTarget(kit)}
                                  sx={{ color: '#94A3B8', '&:hover': { color: '#DC2626', backgroundColor: '#FEF2F2' } }}
                                >
                                  <Trash2 size={15} />
                                </IconButton>
                              </Tooltip>
                            </Box>
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
                        <TableCell sx={{ fontWeight: 700 }}>Installation Done On</TableCell>
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
                          <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600, color: '#0F172A' }}>
                            {v.retrofit_date ? formatDate(v.retrofit_date) : '—'}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap', color: '#64748B' }}>
                            {v.warranty_expiry ? formatDate(v.warranty_expiry) : '—'}
                          </TableCell>
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
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{m.scheduled_date ? formatDate(m.scheduled_date) : '—'}</TableCell>
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

          {/* =================================================================
              SUB-TAB 4: COMPLAINT CATEGORIES
          ================================================================== */}
          {activeTab === 4 && (
            <Box sx={{ mt: 1 }}>
              <DropdownOptionsPanel
                category="complaint_category"
                title="Service Complaint Categories"
                singularTitle="Complaint Category"
                description="Configure service complaint categories available for customer reporting and work orders."
                placeholder="e.g. Battery / Range Issue"
              />
            </Box>
          )}
        </div>

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
            label="Kit Identifier Number"
            placeholder="e.g. KIT-EV-3W-001"
            size="small"
            fullWidth
            required
            value={kitNumber}
            onChange={(e) => setKitNumber(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Kit Model Name"
            placeholder="e.g. 60V High-Torque Auto-Rickshaw EV Kit"
            size="small"
            fullWidth
            required
            value={kitName}
            onChange={(e) => setKitName(e.target.value)}
            sx={{ mb: 2 }}
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 2, mb: 2 }}>
            <TextField
              label="Customer Name"
              placeholder="e.g. D PUTTASWAMY"
              size="small"
              fullWidth
              value={kitCustomerName}
              onChange={(e) => setKitCustomerName(e.target.value)}
            />
            <TextField
              label="Contact Number"
              placeholder="e.g. 9876543210"
              size="small"
              fullWidth
              value={kitCustomerPhone}
              onChange={(e) => setKitCustomerPhone(e.target.value)}
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <DdMmYyyyInput
              label="Installation Done On Date"
              value={kitInstalledOn}
              onChange={(val) => setKitInstalledOn(val)}
            />
          </Box>

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
                label="Installation Done On Date"
                type="date"
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={retrofitDate}
                onChange={(e) => setRetrofitDate(e.target.value)}
                helperText={retrofitDate ? `${formatDate(retrofitDate)} (dd/mm/yyyy)` : 'Format: dd/mm/yyyy'}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Warranty Expiry Date"
                type="date"
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={warrantyExpiry}
                onChange={(e) => setWarrantyExpiry(e.target.value)}
                helperText={warrantyExpiry ? `${formatDate(warrantyExpiry)} (dd/mm/yyyy)` : 'Format: dd/mm/yyyy'}
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

      {/* =====================================================================
          IMPORT KIT FROM PDF DIALOG
      ====================================================================== */}
      <Dialog
        open={isPdfImportOpen}
        onClose={() => {
          if (!isImportingPdf && !isParsingPdf) setIsPdfImportOpen(false);
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#023020', display: 'flex', alignItems: 'center', gap: 1 }}>
          <FileText size={20} color="#023020" />
          Import Kit Master from Stock Traceability PDF
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          {importError && (
            <Alert severity="error" sx={{ mb: 2.5 }}>
              {importError}
            </Alert>
          )}

          {/* Top Empty Field for Vehicle Number & Installation Date */}
          <Box sx={{ mb: 2.5, p: 2, bgcolor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#166534', display: 'block', mb: 0.8 }}>
              VEHICLE REGISTRATION NUMBER (TITLE) & INSTALLATION DATE
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  placeholder="e.g. KA01AB1234"
                  label="Vehicle Number (Title)"
                  fullWidth
                  size="small"
                  value={importVehicleNumber}
                  onChange={(e) => setImportVehicleNumber(e.target.value)}
                  sx={{ backgroundColor: '#FFFFFF', borderRadius: '8px' }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  placeholder="e.g. 9876543210"
                  label="Contact Number"
                  fullWidth
                  size="small"
                  value={importCustomerPhone}
                  onChange={(e) => setImportCustomerPhone(e.target.value)}
                  sx={{ backgroundColor: '#FFFFFF', borderRadius: '8px' }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <DdMmYyyyInput
                  label="Installation Done On Date"
                  value={importInstalledOn || ''}
                  onChange={(val) => setImportInstalledOn(val)}
                />
              </Grid>
            </Grid>
          </Box>

          {/* PDF File Selector */}
          <Box
            sx={{
              p: 3,
              border: '2px dashed #CBD5E1',
              borderRadius: '12px',
              textAlign: 'center',
              backgroundColor: '#F8FAF8',
              mb: 2.5,
            }}
          >
            <Upload size={32} color="#023020" style={{ margin: '0 auto 8px' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A', mb: 0.5 }}>
              {pdfFile ? pdfFile.name : 'Select Stock Traceability PDF'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 1.5 }}>
              Automatically skips header, filters rows with Lot/Serial, and skips non-serialized components.
            </Typography>

            <Button
              variant="outlined"
              component="label"
              startIcon={<Upload size={14} />}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: 12.5,
                borderColor: '#023020',
                color: '#023020',
              }}
            >
              Choose PDF File
              <input type="file" hidden accept=".pdf" onChange={handlePdfFileSelect} />
            </Button>
          </Box>

          {isParsingPdf && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, py: 3 }}>
              <CircularProgress size={22} sx={{ color: '#023020' }} />
              <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 600 }}>
                Parsing PDF table and extracting serialized components...
              </Typography>
            </Box>
          )}

          {parsedPdfData && (
            <Box>
              {/* Summary Cards */}
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6} sm={3}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, display: 'block' }}>
                      KIT NAME (PRODUCT)
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F172A' }}>
                      {parsedPdfData.kit_name}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, display: 'block' }}>
                      KIT ID (LOT / SERIAL)
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, fontFamily: 'monospace', color: '#1D4ED8' }}>
                      {parsedPdfData.kit_number}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, display: 'block' }}>
                      CUSTOMER
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F172A' }}>
                      {parsedPdfData.customer_name || '—'}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, display: 'block' }}>
                      INSTALLATION DONE ON
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#15803D' }}>
                      {parsedPdfData.installed_on ? formatDate(parsedPdfData.installed_on) : '—'}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Extraction Metrics */}
              <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                <Chip
                  label={`${parsedPdfData.total_serialized} Serialized Components (Extracted)`}
                  size="small"
                  sx={{ backgroundColor: '#DCFCE7', color: '#15803D', fontWeight: 700 }}
                />
                <Chip
                  label={`${parsedPdfData.total_skipped} Unserialized / Duplicate Items (Skipped)`}
                  size="small"
                  sx={{ backgroundColor: '#F1F5F9', color: '#64748B', fontWeight: 600 }}
                />
              </Box>

              {/* Extracted Preview Table */}
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', display: 'block', mb: 0.8 }}>
                PARSED EXTRACTED PREVIEW (COMPONENTS TO BE SAVED):
              </Typography>
              <TableContainer sx={{ maxHeight: 260, border: '1px solid #E2E8F0', borderRadius: 2 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#F8FAF8' }}>Product</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#F8FAF8' }}>Lot/Serial</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#F8FAF8' }}>Customer / Classification</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {/* First line: Kit Header */}
                    <TableRow sx={{ backgroundColor: '#EFF6FF' }}>
                      <TableCell sx={{ fontWeight: 800, color: '#1E293B' }}>{parsedPdfData.kit_name}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#1D4ED8' }}>
                        {parsedPdfData.kit_number}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#1E293B' }}>
                        {parsedPdfData.customer_name} (Kit Master)
                      </TableCell>
                    </TableRow>

                    {/* Component lines */}
                    {parsedPdfData.components.map((comp, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{comp.label}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', color: '#334155' }}>
                          {comp.serial_number}
                        </TableCell>
                        <TableCell sx={{ color: '#64748B', fontSize: 11 }}>Component</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, px: 3 }}>
          <Button onClick={() => setIsPdfImportOpen(false)} sx={{ textTransform: 'none', color: '#64748B' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmImportPdf}
            disabled={!parsedPdfData || isImportingPdf}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              backgroundColor: '#023020',
              '&:hover': { backgroundColor: '#034732' },
              borderRadius: '8px',
              px: 2.5,
            }}
          >
            {isImportingPdf ? 'Importing...' : 'Confirm & Save to Kit Master'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* =====================================================================
          VIEW KIT COMPONENTS BREAKDOWN DIALOG
      ====================================================================== */}
      {viewingKitComponents && (
        <Dialog
          open={Boolean(viewingKitComponents)}
          onClose={() => setViewingKitComponents(null)}
          maxWidth="md"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          <DialogTitle sx={{ fontWeight: 800, color: '#023020', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6" fontWeight={800}>
                {viewingKitComponents.vehicle_number || viewingKitComponents.kit_name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Kit ID: {viewingKitComponents.kit_number} • Customer: {viewingKitComponents.customer_name || '—'}
              </Typography>
            </Box>
            <Chip
              label={`${viewingKitComponents.component_types.length} Serialized Components`}
              size="small"
              sx={{ fontWeight: 700, backgroundColor: '#DCFCE7', color: '#15803D' }}
            />
          </DialogTitle>
          <DialogContent dividers sx={{ p: 2.5 }}>
            <TableContainer sx={{ maxHeight: 420 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#F8FAF8' }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#F8FAF8' }}>Product</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#F8FAF8' }}>Lot/Serial</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#F8FAF8' }}>Code</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {viewingKitComponents.component_types.map((c, i) => (
                    <TableRow key={c.id} hover>
                      <TableCell sx={{ color: '#64748B', fontSize: 11 }}>{i + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{c.label}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, color: '#1D4ED8' }}>
                        {c.serial_number || '—'}
                      </TableCell>
                      <TableCell sx={{ color: '#64748B', fontSize: 11 }}>{c.component_type}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setViewingKitComponents(null)} sx={{ textTransform: 'none', fontWeight: 600 }}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* =====================================================================
          EDIT KIT MASTER DIALOG (Admin Only)
      ====================================================================== */}
      {editingKit && (
        <Dialog
          open={Boolean(editingKit)}
          onClose={() => setEditingKit(null)}
          maxWidth="md"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
        >
          <DialogTitle sx={{ fontWeight: 800, color: '#023020', fontSize: 17, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              Edit Kit Master: {editingKit.kit_name}
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>
                Admin access: edit all kit master records and tracked component serials
              </Typography>
            </Box>
            <Chip label="Admin Access" size="small" color="primary" sx={{ fontWeight: 700 }} />
          </DialogTitle>
          <DialogContent dividers sx={{ pt: 2 }}>
            {editKitError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {editKitError}
              </Alert>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Vehicle Number (Title) */}
              <TextField
                label="Vehicle Number (Title)"
                size="small"
                fullWidth
                placeholder="e.g. TN66P7023"
                value={editKitForm.vehicle_number || ''}
                onChange={(e) => setEditKitForm((prev) => ({ ...prev, vehicle_number: e.target.value }))}
                helperText="Primary vehicle registration number for this kit"
              />

              {/* Kit Name & Kit Number in 2 columns */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField
                  label="Kit Name"
                  size="small"
                  required
                  fullWidth
                  value={editKitForm.kit_name || ''}
                  onChange={(e) => setEditKitForm((prev) => ({ ...prev, kit_name: e.target.value }))}
                />
                <TextField
                  label="Kit ID / Lot/Serial"
                  size="small"
                  required
                  fullWidth
                  value={editKitForm.kit_number || ''}
                  onChange={(e) => setEditKitForm((prev) => ({ ...prev, kit_number: e.target.value }))}
                />
              </Box>

              {/* Customer Name, Contact Number & Installation Done On Date in 3 columns */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 2 }}>
                <TextField
                  label="Customer Name"
                  size="small"
                  fullWidth
                  placeholder="e.g. R Hari Krishna"
                  value={editKitForm.customer_name || ''}
                  onChange={(e) => setEditKitForm((prev) => ({ ...prev, customer_name: e.target.value }))}
                />
                <TextField
                  label="Contact Number"
                  size="small"
                  fullWidth
                  placeholder="e.g. 9876543210"
                  value={editKitForm.customer_phone || ''}
                  onChange={(e) => setEditKitForm((prev) => ({ ...prev, customer_phone: e.target.value }))}
                />
                <DdMmYyyyInput
                  label="Installation Done On Date"
                  value={editKitForm.installed_on || ''}
                  onChange={(val) => setEditKitForm((prev) => ({ ...prev, installed_on: val }))}
                />
              </Box>

              {/* Description */}
              <TextField
                label="Description"
                size="small"
                fullWidth
                multiline
                rows={2}
                value={editKitForm.description || ''}
                onChange={(e) => setEditKitForm((prev) => ({ ...prev, description: e.target.value }))}
              />

              {/* Active Toggle */}
              <FormControlLabel
                control={
                  <Switch
                    checked={editKitForm.is_active ?? true}
                    onChange={(e) => setEditKitForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                    color="success"
                  />
                }
                label={
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                    Active Kit Configuration
                  </Typography>
                }
              />

              <Divider sx={{ my: 1 }} />

              {/* Component Details Section (Editable by Admin) */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#023020', fontSize: 13.5 }}>
                      Kit Components & Serial Numbers ({editKitComponents.length} items)
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748B' }}>
                      Admin can modify component product names, serial numbers, add new parts, or remove items.
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Plus size={14} />}
                    onClick={handleAddEditComponent}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: 12,
                      borderColor: '#023020',
                      color: '#023020',
                    }}
                  >
                    Add Component
                  </Button>
                </Box>

                <Paper variant="outlined" sx={{ maxHeight: 260, overflowY: 'auto', borderRadius: 2, p: 1 }}>
                  {editKitComponents.length === 0 ? (
                    <Typography variant="caption" sx={{ color: '#94A3B8', p: 2, display: 'block', textAlign: 'center' }}>
                      No components defined. Click "Add Component" to add parts.
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {editKitComponents.map((comp, idx) => (
                        <Box
                          key={idx}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            p: 1,
                            borderRadius: '6px',
                            backgroundColor: '#F8FAF8',
                            border: '1px solid #E2E8E2',
                          }}
                        >
                          <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, width: 22 }}>
                            #{idx + 1}
                          </Typography>
                          <TextField
                            size="small"
                            placeholder="Component Product Name (e.g. [CHA0201F] Bracket)"
                            value={comp.label}
                            onChange={(e) => handleUpdateEditComponent(idx, 'label', e.target.value)}
                            sx={{ flex: 2, '& .MuiOutlinedInput-input': { fontSize: 12.5, py: 0.6 } }}
                          />
                          <TextField
                            size="small"
                            placeholder="Lot / Serial Number"
                            value={comp.serial_number}
                            onChange={(e) => handleUpdateEditComponent(idx, 'serial_number', e.target.value)}
                            sx={{ flex: 1.5, '& .MuiOutlinedInput-input': { fontSize: 12.5, py: 0.6, fontFamily: 'monospace' } }}
                          />
                          <Tooltip title="Remove this component">
                            <IconButton
                              size="small"
                              onClick={() => handleRemoveEditComponent(idx)}
                              sx={{ color: '#94A3B8', '&:hover': { color: '#DC2626' } }}
                            >
                              <Trash2 size={15} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Paper>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setEditingKit(null)} sx={{ textTransform: 'none', color: '#64748B' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveEditKit}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                backgroundColor: '#023020',
                '&:hover': { backgroundColor: '#034732' },
                borderRadius: '8px',
                px: 2.5,
              }}
            >
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* =====================================================================
          DELETE KIT CONFIRMATION DIALOG
      ====================================================================== */}
      {deleteKitTarget && (
        <Dialog
          open={Boolean(deleteKitTarget)}
          onClose={() => setDeleteKitTarget(null)}
          maxWidth="xs"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
        >
          <DialogTitle sx={{ fontWeight: 800, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 1 }}>
            <AlertTriangle size={20} /> Delete Kit Master
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: '#334155', fontSize: 13.5, lineHeight: 1.5 }}>
              Are you sure you want to delete kit <strong>{deleteKitTarget.kit_name}</strong> ({deleteKitTarget.kit_number})?
              This will remove the kit configuration and its {deleteKitTarget.component_types.length} serialized components.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 2.5, pb: 1.5 }}>
            <Button onClick={() => setDeleteKitTarget(null)} sx={{ textTransform: 'none', color: '#64748B' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleConfirmDeleteKit}
              disabled={isDeletingKit}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
            >
              {isDeletingKit ? 'Deleting...' : 'Delete Kit'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
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
