import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  Tab,
  Tabs,
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
    FileText,
    Filter,
    History,
    Image,
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
  Upload,
  User,
  Wrench,
  X,
  Zap,
  Calendar,
  CheckSquare,
  Timer,
  Gauge,
  FileImage,
  FileQuestion,
  Edit2,
  Eye,
  Trash2 as TrashIcon,
} from 'lucide-react';

import { useAppSelector } from '@/app/hooks';
import { usePermission } from '@/context/AuthPermissionContext';
import { useToast } from '@/components/ui/ToastHost';
import { useUsersQuery } from '@/api/mastersApi';
import { AppDropdown } from '@/components/ui/AppDropdown';
import { LocationDisplay, formatNoteLocation, useResolvedAddress } from '@/utils/geolocation';
import { formatDate, formatDateTime } from '@/utils/format';

function formatDuration(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  if (diffMs < 0) return '—';
  const totalMins = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatServiceElapsed(startedAt: string | null, endedAt: string | null, serviceHours: number | null, now: number): string {
  const elapsedMs = startedAt && !endedAt
    ? Math.max(0, now - new Date(startedAt).getTime())
    : serviceHours !== null
      ? serviceHours * 60 * 60 * 1000
      : startedAt && endedAt
        ? Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime())
        : null;
  if (elapsedMs === null || !Number.isFinite(elapsedMs)) return '—';

  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

// Status-based required field validation
function getRequiredFieldsForStatus(fields: VSCustomFieldDefinition[], status: string): VSCustomFieldDefinition[] {
  return fields.filter((field) => {
    if (!field.is_required) return false;
    // If field has status-specific required rules, check them
    if (field.required_by_status) {
      return field.required_by_status[status] === true;
    }
    // Default: required for all statuses
    return true;
  });
}

function validateRequiredFields(values: Record<string, any>, requiredFields: VSCustomFieldDefinition[]): string[] {
  const errors: string[] = [];
  requiredFields.forEach((field) => {
    const value = values[String(field.id)];
    if (value === undefined || value === null || value === '') {
      errors.push(`${field.label} is required`);
    }
  });
  return errors;
}

// OTP Countdown Component
function OTPCountdown({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const updateTimer = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return <span>{timeLeft}</span>;
}

// Custom Field Renderer Component
interface CustomFieldRendererProps {
  field: VSCustomFieldDefinition;
  value: any;
  onChange: (fieldId: number, value: any) => void;
  users: { id: number; full_name: string; department?: string }[];
  uploadFile: (file: File) => Promise<any>;
  disabled?: boolean;
}

function CustomFieldRenderer({ field, value, onChange, users, uploadFile, disabled = false }: CustomFieldRendererProps) {
  const [filePreview, setFilePreview] = useState<{ previewUrl: string | null; originalName: string; mimeType: string | null } | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const result = await uploadFile(file);
      onChange(field.id, result.filename); // Store filename as value
      setFilePreview({
        previewUrl: result.preview_url || result.url,
        originalName: result.original_name,
        mimeType: result.mime_type,
      });
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = () => {
    if (filePreview?.previewUrl) {
      const link = document.createElement('a');
      link.href = filePreview.previewUrl;
      link.download = filePreview.originalName || 'file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handlePreview = () => {
    if (filePreview?.previewUrl) {
      window.open(filePreview.previewUrl, '_blank');
    }
  };

  const isImage = filePreview?.mimeType?.startsWith('image/') || false;
  const isPdf = filePreview?.mimeType === 'application/pdf' || filePreview?.originalName?.toLowerCase().endsWith('.pdf');

  const handleValueChange = (newValue: any) => {
    onChange(field.id, newValue);
  };

  // Timer field: HH:MM format
  if (field.field_type === 'timer') {
    return (
      <TextField
        label={field.label}
        placeholder={field.placeholder || 'HH:MM'}
        value={value || ''}
        onChange={(e) => handleValueChange(e.target.value)}
        fullWidth
        size="small"
        disabled={disabled || field.is_readonly}
        inputProps={{
          pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$',
          maxLength: 5,
        }}
        helperText={field.help_text}
        sx={{ '& .MuiOutlinedInput-root': { fontSize: 12.5 } }}
      />
    );
  }

  // Number field
  if (field.field_type === 'number') {
    return (
      <TextField
        label={field.label}
        placeholder={field.placeholder}
        type="number"
        value={value || ''}
        onChange={(e) => handleValueChange(e.target.value)}
        fullWidth
        size="small"
        disabled={disabled || field.is_readonly}
        helperText={field.help_text}
        sx={{ '& .MuiOutlinedInput-root': { fontSize: 12.5 } }}
      />
    );
  }

  // Date field
  if (field.field_type === 'date') {
    return (
      <TextField
        label={field.label}
        type="date"
        value={value || ''}
        onChange={(e) => handleValueChange(e.target.value)}
        fullWidth
        size="small"
        disabled={disabled || field.is_readonly}
        helperText={field.help_text}
        InputLabelProps={{ shrink: true }}
        sx={{ '& .MuiOutlinedInput-root': { fontSize: 12.5 } }}
      />
    );
  }

  // User dropdown (filtered by department)
  if (field.field_type === 'user') {
    const filterByDept = field.user_config?.filter_by_department;
    const deptField = field.user_config?.department_field;
    // For now, show all users. Department filtering would need the user's department
    const filteredUsers = users; // In real implementation, filter by department
    
    return (
      <AppDropdown
        label={field.label}
        value={value || ''}
        emptyLabel="Select user"
        allowEmpty={!field.is_required}
        options={filteredUsers.map((u) => ({ value: String(u.id), label: u.full_name }))}
        onChange={(val) => handleValueChange(val ? Number(val) : '')}
        disabled={disabled || field.is_readonly}
        helperText={field.help_text}
        size="small"
      />
    );
  }

  // Dropdown field
  if (field.field_type === 'dropdown') {
    const options = field.options || [];
    return (
      <AppDropdown
        label={field.label}
        value={value || ''}
        emptyLabel={field.placeholder || 'Select option'}
        allowEmpty={!field.is_required}
        options={options.map((opt) => ({ value: opt.value, label: opt.label }))}
        onChange={(val) => handleValueChange(val)}
        disabled={disabled || field.is_readonly}
        helperText={field.help_text}
        size="small"
      />
    );
  }

  // File field
  if (field.field_type === 'file') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <input
          type="file"
          accept={field.file_config?.allowed_extensions?.join(',') || '*'}
          onChange={handleFileUpload}
          disabled={disabled || field.is_readonly || uploading}
          style={{ display: 'none' }}
          id={`custom-field-file-${field.id}`}
        />
        <Button
          variant="outlined"
          size="small"
          startIcon={uploading ? <CircularProgress size={16} /> : <Upload size={16} />}
          onClick={() => document.getElementById(`custom-field-file-${field.id}`)?.click()}
          disabled={disabled || field.is_readonly || uploading}
          fullWidth
        >
          {uploading ? 'Uploading...' : 'Select File'}
        </Button>
        {filePreview && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {/* Image Preview */}
              {isImage && (
                <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, overflow: 'hidden', maxWidth: 300 }}>
                  <img 
                    src={filePreview.previewUrl} 
                    alt={filePreview.originalName} 
                    style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
                    onClick={handlePreview}
                  />
                </Box>
              )}
            
              {/* PDF Preview */}
              {isPdf && (
                <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, overflow: 'hidden', maxWidth: 500 }}>
                  <iframe 
                    src={`${filePreview.previewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                    style={{ width: '100%', height: '400px', border: 'none', display: 'block' }}
                    title={filePreview.originalName}
                  />
                </Box>
              )}
            
              {/* File info and actions */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1, flexWrap: 'wrap' }}>
                {isImage ? <Image size={16} color="primary" /> : isPdf ? <FileText size={16} color="primary" /> : <FileText size={16} color="primary" />}
                <Typography variant="body2" color="primary" sx={{ flex: 1, cursor: 'pointer', minWidth: 0 }} onClick={handlePreview} noWrap>
                  {filePreview.originalName}
                </Typography>
                <IconButton size="small" onClick={handleDownload} aria-label="Download" disabled={disabled || field.is_readonly}>
                  <Download size={16} />
                </IconButton>
                <IconButton size="small" onClick={() => { setFilePreview(null); onChange(field.id, ''); }} aria-label="Remove" disabled={disabled || field.is_readonly}>
                  <X size={14} />
                </IconButton>
              </Box>
            </Box>
          )}
          {field.help_text && <Typography variant="caption" color="text.secondary">{field.help_text}</Typography>}
        </Box>
      );
    }

  // Default text field
  return (
    <TextField
      label={field.label}
      placeholder={field.placeholder}
      value={value || ''}
      onChange={(e) => handleValueChange(e.target.value)}
      fullWidth
      size="small"
      multiline={field.field_type === 'textarea'}
      rows={field.field_type === 'textarea' ? 3 : 1}
      disabled={disabled || field.is_readonly}
      helperText={field.help_text}
      sx={{ '& .MuiOutlinedInput-root': { fontSize: 12.5 } }}
    />
  );
}

import {
  useAddVSComplaintNoteMutation,
  useCloseVSComplaintMutation,
  useCreateVSComplaintMutation,
  useCreateVSTechnicianAdviceMutation,
  useDeleteVSTechnicianAdviceMutation,
  useDeleteVSComplaintMutation,
  useGetVSTechnicianAdviceQuery,
  useGetVSComplaintsQuery,
  useGetVSKitsQuery,
  useGetVSVehiclesQuery,
  useReplaceVSComponentMutation,
  useUpdateVSComplaintMutation,
  useUpdateVSTechnicianAdviceMutation,
  useSendVSComplaintOTPMutation,
  useVerifyVSComplaintOTPMutation,
  useUploadInitialChecklistMutation,
  useUploadMasterChecklistMutation,
  useUploadComplaints8DMutation,
  useUploadVehicleImagesMutation,
  // Custom Fields
    useGetCustomFieldDefinitionsQuery,
    useGetCustomFieldDefinitionsForComplaintQuery,
    useGetCustomFieldValuesForComplaintQuery,
    useUpsertCustomFieldValuesForComplaintMutation,
    useUploadCustomFieldFileMutation,
  } from '@/api/vehicleServiceApi';
import type {
  VSComplaint,
  VSComplaintCloseRequest,
  VSComplaintCreate,
  VSComplaintUpdate,
  VSKit,
  VSVehicle,
  VSCustomFieldDefinition,
  VSComplaintCustomFieldValue,
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
  const [updateComplaint] = useUpdateVSComplaintMutation();
  const [deleteComplaint, { isLoading: isDeletingComplaint }] = useDeleteVSComplaintMutation();
  const [addNote, { isLoading: isAddingNote }] = useAddVSComplaintNoteMutation();
  const [closeComplaint, { isLoading: isClosing }] = useCloseVSComplaintMutation();
  const [replaceComponent, { isLoading: isReplacing }] = useReplaceVSComponentMutation();
  const [createTechnicianAdvice, { isLoading: isCreatingAdvice }] = useCreateVSTechnicianAdviceMutation();
  const [updateTechnicianAdvice, { isLoading: isUpdatingAdvice }] = useUpdateVSTechnicianAdviceMutation();
  const [deleteTechnicianAdvice] = useDeleteVSTechnicianAdviceMutation();
    const [sendOTP, { isLoading: isSendingOTP }] = useSendVSComplaintOTPMutation();
    const [verifyOTP, { isLoading: isVerifyingOTP }] = useVerifyVSComplaintOTPMutation();
        const [uploadInitialChecklist] = useUploadInitialChecklistMutation();
        const [uploadMasterChecklist] = useUploadMasterChecklistMutation();
        const [uploadComplaints8D] = useUploadComplaints8DMutation();
        const [uploadVehicleImages] = useUploadVehicleImagesMutation();

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
  const [selectedWorkOrderTab, setSelectedWorkOrderTab] = useState(0);
  const [newAdviceIssue, setNewAdviceIssue] = useState('');
  const [editingAdviceId, setEditingAdviceId] = useState<number | null>(null);
  const [editingAdviceIssue, setEditingAdviceIssue] = useState('');
  const {
    data: technicianAdvice = [],
    isLoading: isAdviceLoading,
    isError: isAdviceError,
  } = useGetVSTechnicianAdviceQuery(selectedComplaint?.id ?? 0, { skip: !selectedComplaint });
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

    // OTP Verification state
    const [isOTPDialogOpen, setIsOTPDialogOpen] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [otpSending, setOtpSending] = useState(false);
    const [otpVerifying, setOtpVerifying] = useState(false);
    const [otpExpiresAt, setOtpExpiresAt] = useState<string | null>(null);
    const [otpError, setOtpError] = useState<string | null>(null);

      // Custom Fields state
    const [newCustomFieldValues, setNewCustomFieldValues] = useState<Record<string, any>>({});
    const [manageCustomFieldValues, setManageCustomFieldValues] = useState<Record<string, any>>({});

    // Service Workflow state
    const [estDeliveryDate, setEstDeliveryDate] = useState<string | ''>('');
    const [canDataCollected, setCanDataCollected] = useState(false);
    const [technicianRemarks, setTechnicianRemarks] = useState('');
    const [odometerReading, setOdometerReading] = useState<number | ''>('');
    const [serviceType, setServiceType] = useState<'FREE' | 'GENERAL' | 'PAID'>('GENERAL');
    const [timerRunning, setTimerRunning] = useState(false);
    const [timerStartTime, setTimerStartTime] = useState<Date | null>(null);
    const [serviceHours, setServiceHours] = useState<number | null>(null);
    const [timerNow, setTimerNow] = useState(Date.now());
    const [workflowDirty, setWorkflowDirty] = useState(false);
    const [workflowAutoSaveStatus, setWorkflowAutoSaveStatus] = useState<'saved' | 'unsaved' | 'saving' | 'error'>('saved');
    const [customFieldsDirty, setCustomFieldsDirty] = useState(false);
    const [customFieldsAutoSaveStatus, setCustomFieldsAutoSaveStatus] = useState<'saved' | 'unsaved' | 'saving' | 'error'>('saved');
    const workflowRevisionRef = useRef(0);
    const customFieldsRevisionRef = useRef(0);
    const workflowSaveChainRef = useRef<Promise<boolean>>(Promise.resolve(true));
    const customFieldsSaveChainRef = useRef<Promise<boolean>>(Promise.resolve(true));
    const workflowSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const customFieldsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const initializedComplaintIdRef = useRef<number | null>(null);
    const loadedCustomFieldsComplaintIdRef = useRef<number | null>(null);

    // File upload states
    const [initialChecklistFile, setInitialChecklistFile] = useState<File | null>(null);
    const [masterChecklistFile, setMasterChecklistFile] = useState<File | null>(null);
    const [complaints8dFile, setComplaints8dFile] = useState<File | null>(null);
    const [vehicleImagesFiles, setVehicleImagesFiles] = useState<File[]>([]);
    const [uploadingInitialChecklist, setUploadingInitialChecklist] = useState(false);
    const [uploadingMasterChecklist, setUploadingMasterChecklist] = useState(false);
    const [uploadingComplaints8d, setUploadingComplaints8d] = useState(false);
    const [uploadingVehicleImages, setUploadingVehicleImages] = useState(false);

    // Component Replacement inside Complaint Dialog
  const [isReplaceDialogOpen, setIsReplaceDialogOpen] = useState(false);
  const [replaceComponentId, setReplaceComponentId] = useState<number | ''>('');
  const [replaceNewSerial, setReplaceNewSerial] = useState('');
  const [replaceReason, setReplaceReason] = useState('');

  const selectedVehicleObj: VSVehicle | undefined = vehicles.find((v) => v.id === newVehicleId);

  useEffect(() => {
    if (!timerRunning) return;
    const intervalId = setInterval(() => setTimerNow(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, [timerRunning]);

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

      // Validate required custom fields for OPEN status
      const requiredFields = getRequiredFieldsForStatus(newCustomFields, 'OPEN');
      const validationErrors = validateRequiredFields(newCustomFieldValues, requiredFields);
      if (validationErrors.length > 0) {
        setCreateError(validationErrors.join('; '));
        return;
      }

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
      
        // Save custom field values for new complaint
        if (Object.keys(newCustomFieldValues).length > 0) {
          try {
            await upsertCustomFieldValuesForComplaint({
                      complaint_id: created.id,
                      body: {
                        values: Object.entries(newCustomFieldValues).map(([field_id, value]) => ({
                          field_id: Number(field_id),
                          value: String(value),
                        })),
                      },
                    }).unwrap();
                  } catch (err) {
                    console.error('Failed to save custom field values:', err);
                  }
                }
      
        setIsNewDialogOpen(false);
        refetch();
      } catch (err: any) {
        setCreateError(err?.data?.detail || 'Failed to create work order.');
      }
    };

    // Custom Fields: Fetch definitions and values for Create dialog
        // Use general definitions endpoint (not complaint-specific since complaint doesn't exist yet)
        const { data: newCustomFields = [] } = useGetCustomFieldDefinitionsQuery({
          active_only: true
        });
        const [uploadCustomFieldFileMutation] = useUploadCustomFieldFileMutation();
        const uploadCustomFieldFile = async (file: File) => {
          // For create dialog, we don't have a complaint_id yet, use 0 as placeholder
          // The backend should handle this appropriately (might need adjustment)
          const result = await uploadCustomFieldFileMutation({ file, field_id: 0, complaint_id: 0 }).unwrap();
          return result;
        };

        // Custom Fields: Fetch definitions and values for Manage dialog
        const { data: manageCustomFields = [] } = useGetCustomFieldDefinitionsForComplaintQuery(
          selectedComplaint?.id || 0,
          { skip: !selectedComplaint }
        );
    const { currentData: manageCustomFieldValuesData, isSuccess: manageCustomFieldValuesLoaded } = useGetCustomFieldValuesForComplaintQuery(
      selectedComplaint?.id || 0,
      { skip: !selectedComplaint }
    );
        const [uploadCustomFieldFileMutationManage] = useUploadCustomFieldFileMutation();
        const uploadCustomFieldFileManage = async (file: File, fieldId: number) => {
          if (!selectedComplaint) return;
          const result = await uploadCustomFieldFileMutationManage({ file, field_id: fieldId, complaint_id: selectedComplaint.id }).unwrap();
          return result;
        };
        const [upsertCustomFieldValuesForComplaint] = useUpsertCustomFieldValuesForComplaintMutation();

    // Sync fetched values to local state for Manage dialog
    React.useEffect(() => {
      if (
        !selectedComplaint
        || !manageCustomFieldValuesLoaded
        || !manageCustomFieldValuesData
        || loadedCustomFieldsComplaintIdRef.current === selectedComplaint.id
      ) return;
      const valuesMap: Record<string, any> = {};
      manageCustomFieldValuesData.forEach((v) => {
        valuesMap[String(v.field_id)] = v.value;
      });
      setManageCustomFieldValues(valuesMap);
      loadedCustomFieldsComplaintIdRef.current = selectedComplaint.id;
    }, [selectedComplaint?.id, manageCustomFieldValuesData, manageCustomFieldValuesLoaded]);

    const markWorkflowDirty = () => {
      workflowRevisionRef.current += 1;
      setWorkflowDirty(true);
      setWorkflowAutoSaveStatus('unsaved');
    };

    const markCustomFieldsDirty = () => {
      customFieldsRevisionRef.current += 1;
      setCustomFieldsDirty(true);
      setCustomFieldsAutoSaveStatus('unsaved');
    };

    const buildWorkflowPayload = useCallback((): VSComplaintUpdate => ({
      est_delivery_date: estDeliveryDate || null,
      can_data_collected: canDataCollected,
      technician_remarks: technicianRemarks.trim() || null,
      odometer_reading: odometerReading !== '' ? Number(odometerReading) : null,
      service_type: serviceType,
    }), [estDeliveryDate, canDataCollected, technicianRemarks, odometerReading, serviceType]);

    const queueWorkflowSave = useCallback((complaintId: number, payload: VSComplaintUpdate, revision: number) => {
      const save = async (): Promise<boolean> => {
        setWorkflowAutoSaveStatus('saving');
        try {
          await updateComplaint({ id: complaintId, body: payload }).unwrap();
          if (workflowRevisionRef.current === revision) {
            setWorkflowDirty(false);
            setWorkflowAutoSaveStatus('saved');
          }
          return true;
        } catch (err: any) {
          if (workflowRevisionRef.current === revision) {
            setWorkflowAutoSaveStatus('error');
            showToast(err?.data?.detail || 'Failed to automatically save workflow details.', 'error');
          }
          return false;
        }
      };

      const queuedSave = workflowSaveChainRef.current.then(save, save);
      workflowSaveChainRef.current = queuedSave;
      return queuedSave;
    }, [updateComplaint, showToast]);

    const queueCustomFieldsSave = useCallback((
      complaintId: number,
      valuesSnapshot: Record<string, any>,
      revision: number,
    ) => {
      const save = async (): Promise<boolean> => {
        setCustomFieldsAutoSaveStatus('saving');
        try {
          await upsertCustomFieldValuesForComplaint({
            complaint_id: complaintId,
            body: {
              values: Object.entries(valuesSnapshot).map(([field_id, value]) => ({
                field_id: Number(field_id),
                value: value === null || value === undefined ? null : String(value),
              })),
            },
          }).unwrap();
          if (customFieldsRevisionRef.current === revision) {
            setCustomFieldsDirty(false);
            setCustomFieldsAutoSaveStatus('saved');
          }
          return true;
        } catch (err: any) {
          if (customFieldsRevisionRef.current === revision) {
            setCustomFieldsAutoSaveStatus('error');
            showToast(err?.data?.detail || 'Failed to automatically save custom fields.', 'error');
          }
          return false;
        }
      };

      const queuedSave = customFieldsSaveChainRef.current.then(save, save);
      customFieldsSaveChainRef.current = queuedSave;
      return queuedSave;
    }, [upsertCustomFieldValuesForComplaint, showToast]);

    React.useEffect(() => {
      if (!selectedComplaint || !workflowDirty) return;

      const complaintId = selectedComplaint.id;
      const revision = workflowRevisionRef.current;
      const payload = buildWorkflowPayload();
      const timer = setTimeout(() => {
        workflowSaveTimerRef.current = null;
        void queueWorkflowSave(complaintId, payload, revision);
      }, 650);
      workflowSaveTimerRef.current = timer;

      return () => {
        clearTimeout(timer);
        if (workflowSaveTimerRef.current === timer) workflowSaveTimerRef.current = null;
      };
    }, [selectedComplaint?.id, workflowDirty, buildWorkflowPayload, queueWorkflowSave]);

    React.useEffect(() => {
      if (!selectedComplaint || !customFieldsDirty) return;

      const complaintId = selectedComplaint.id;
      const revision = customFieldsRevisionRef.current;
      const valuesSnapshot = manageCustomFieldValues;
      const timer = setTimeout(() => {
        customFieldsSaveTimerRef.current = null;
        void queueCustomFieldsSave(complaintId, valuesSnapshot, revision);
      }, 650);
      customFieldsSaveTimerRef.current = timer;

      return () => {
        clearTimeout(timer);
        if (customFieldsSaveTimerRef.current === timer) customFieldsSaveTimerRef.current = null;
      };
    }, [selectedComplaint?.id, customFieldsDirty, manageCustomFieldValues, queueCustomFieldsSave]);

    const flushAutoSaves = async (complaintId: number) => {
      if (workflowSaveTimerRef.current) {
        clearTimeout(workflowSaveTimerRef.current);
        workflowSaveTimerRef.current = null;
      }
      if (customFieldsSaveTimerRef.current) {
        clearTimeout(customFieldsSaveTimerRef.current);
        customFieldsSaveTimerRef.current = null;
      }

      const pendingSaves: Promise<boolean>[] = [];
      if (workflowDirty) {
        pendingSaves.push(queueWorkflowSave(
          complaintId,
          buildWorkflowPayload(),
          workflowRevisionRef.current,
        ));
      }
      if (customFieldsDirty) {
        pendingSaves.push(queueCustomFieldsSave(
          complaintId,
          manageCustomFieldValues,
          customFieldsRevisionRef.current,
        ));
      }
      const results = await Promise.all(pendingSaves);
      return results.every(Boolean);
    };

    const handleUpdateStatus = async (complaintId: number, nextStatus: string) => {
    // Validate required custom fields for the next status
    const requiredFields = getRequiredFieldsForStatus(manageCustomFields, nextStatus);
    const validationErrors = validateRequiredFields(manageCustomFieldValues, requiredFields);
    if (validationErrors.length > 0) {
      showToast(`Cannot change status: ${validationErrors.join('; ')}`, 'warning');
      return;
    }
    if (!(await flushAutoSaves(complaintId))) return;

    const payload: VSComplaintUpdate = {
      status: nextStatus,
      est_delivery_date: estDeliveryDate || undefined,
      can_data_collected: canDataCollected,
      technician_remarks: technicianRemarks.trim() || undefined,
      odometer_reading: odometerReading ? Number(odometerReading) : undefined,
      service_type: serviceType,
      service_hours: serviceHours,
    };

    try {
      const updated = await updateComplaint({ id: complaintId, body: payload }).unwrap();
      setSelectedComplaint(updated);
      showToast(`Work order status updated to ${nextStatus}`, 'success');
      refetch();
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to update status.', 'error');
    }
  };

  const handleAssignUser = async (complaintId: number, userId: number) => {
    try {
      const updated = await updateComplaint({ id: complaintId, body: { assigned_to_id: userId } }).unwrap();
      setSelectedComplaint(updated);
      showToast('Technician assigned successfully.', 'success');
      refetch();
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to assign technician.', 'error');
    }
  };

  const handleAddNote = async () => {
    if (!selectedComplaint || !newNoteText.trim()) return;
    try {
      await addNote({ complaintId: selectedComplaint.id, note: newNoteText.trim() }).unwrap();
      setNewNoteText('');
      const updated = await updateComplaint({ id: selectedComplaint.id, body: {} }).unwrap();
      setSelectedComplaint(updated);
      showToast('Note added to changelog.', 'success');
      refetch();
    } catch (err: any) {
      showToast('Failed to add note.', 'error');
    }
  };

  const handleCloseSubmit = async () => {
    if (!selectedComplaint) return;
    if (timerRunning || (selectedComplaint.timer_started_at && !selectedComplaint.timer_ended_at)) {
      showToast('Stop the service timer before closing this work order.', 'warning');
      return;
    }

    // Validate required custom fields for CLOSED status
    const requiredFields = getRequiredFieldsForStatus(manageCustomFields, 'CLOSED');
    const validationErrors = validateRequiredFields(manageCustomFieldValues, requiredFields);
    if (validationErrors.length > 0) {
      showToast(`Cannot close work order: ${validationErrors.join('; ')}`, 'warning');
      return;
    }
    if (!(await flushAutoSaves(selectedComplaint.id))) return;

    // Send OTP first
    setOtpSending(true);
    setOtpError(null);
    try {
      const response = await sendOTP({ id: selectedComplaint.id, body: {} }).unwrap();
      if (response.expires_at) {
        setOtpExpiresAt(response.expires_at);
      }
      setIsCloseDialogOpen(false);
      setIsOTPDialogOpen(true);
      setOtpCode('');
      showToast('OTP sent to customer phone.', 'success');
    } catch (err: any) {
      setOtpError(err?.data?.detail || 'Failed to send OTP. Please try again.');
      showToast(err?.data?.detail || 'Failed to send OTP.', 'error');
    } finally {
      setOtpSending(false);
    }
  };

  const handleOTPSubmit = async () => {
    if (timerRunning || (selectedComplaint?.timer_started_at && !selectedComplaint.timer_ended_at)) {
      setOtpError('Stop the service timer before closing this work order.');
      return;
    }
    if (!selectedComplaint || !otpCode.trim()) {
      setOtpError('Please enter the OTP code.');
      return;
    }

    if (otpCode.length !== 6) {
      setOtpError('OTP must be 6 digits.');
      return;
    }

    setOtpVerifying(true);
    setOtpError(null);
    try {
      await verifyOTP({ id: selectedComplaint.id, body: { otp_code: otpCode.trim() } }).unwrap();

      const payload: VSComplaintCloseRequest = {
        resolution_summary: closeResolutionSummary.trim() || undefined,
        rating: closeRating || undefined,
        feedback_comment: closeFeedbackComment.trim() || undefined,
      };

      const res = await closeComplaint({ id: selectedComplaint.id, body: payload }).unwrap();
      setSelectedComplaint(res);
      setIsOTPDialogOpen(false);
      setOtpCode('');
      setOtpExpiresAt(null);
      showToast('Work order closed successfully with verified OTP!', 'success');
      refetch();
    } catch (err: any) {
      setOtpError(err?.data?.detail || 'Invalid OTP. Please try again.');
      showToast(err?.data?.detail || 'Invalid OTP.', 'error');
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleResendOTP = async () => {
    if (!selectedComplaint) return;
    setOtpSending(true);
    setOtpError(null);
    try {
      const response = await sendOTP({ id: selectedComplaint.id, body: {} }).unwrap();
      if (response.expires_at) {
        setOtpExpiresAt(response.expires_at);
      }
      setOtpCode('');
      showToast('A new OTP has been sent.', 'success');
    } catch (err: any) {
      setOtpError(err?.data?.detail || 'Failed to resend OTP. Please try again.');
      showToast(err?.data?.detail || 'Failed to resend OTP.', 'error');
    } finally {
      setOtpSending(false);
    }
  };

  const handleReplaceComponentSubmit = async () => {
    if (!selectedComplaint || !replaceComponentId || !replaceNewSerial.trim()) {
      showToast('Please select component and specify new serial number.', 'warning');
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
      showToast('Component replaced successfully.', 'success');
      refetch();
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to record component replacement.', 'error');
    }
  };

  // =====================================================================
  // Service Workflow Handlers
  // =====================================================================

  const handleCreateAdvice = async () => {
    if (!selectedComplaint) return;
    const issue = newAdviceIssue.trim();
    if (!issue) return;
    try {
      await createTechnicianAdvice({
        complaintId: selectedComplaint.id,
        issue_to_resolve: issue,
      }).unwrap();
      setNewAdviceIssue('');
      showToast('Technician advice added.', 'success');
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to add technician advice.', 'error');
    }
  };

  const handleUpdateAdvice = async (adviceId: number) => {
    if (!selectedComplaint) return;
    const issue = editingAdviceIssue.trim();
    if (!issue) return;
    try {
      await updateTechnicianAdvice({
        complaintId: selectedComplaint.id,
        id: adviceId,
        issue_to_resolve: issue,
      }).unwrap();
      setEditingAdviceId(null);
      setEditingAdviceIssue('');
      showToast('Technician advice updated.', 'success');
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to update technician advice.', 'error');
    }
  };

  const handleDeleteAdvice = async (adviceId: number) => {
    if (!selectedComplaint || !window.confirm('Delete this technician advice entry?')) return;
    try {
      await deleteTechnicianAdvice({ complaintId: selectedComplaint.id, id: adviceId }).unwrap();
      showToast('Technician advice deleted.', 'success');
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to delete technician advice.', 'error');
    }
  };

  const handleTimerStart = async () => {
    if (!selectedComplaint) return;
  
    const now = new Date();
    setTimerStartTime(now);
    setTimerRunning(true);

    // Update backend
    const payload: VSComplaintUpdate = {
      timer_started_at: now.toISOString(),
      timer_ended_at: null,
      service_hours: 0,
    };
    try {
      const updated = await updateComplaint({ id: selectedComplaint.id, body: payload }).unwrap();
      setSelectedComplaint(updated);
    } catch (err: any) {
      setTimerRunning(false);
      setTimerStartTime(null);
      console.error('Failed to start timer:', err);
      showToast(err?.data?.detail || 'Failed to start service timer.', 'error');
    }
  };

  const handleTimerStop = async () => {
    if (!selectedComplaint || !timerStartTime) return;

    const now = new Date();
    const elapsedHours = (now.getTime() - timerStartTime.getTime()) / 1000 / 60 / 60;
    const finalHours = Number(elapsedHours.toFixed(2));

    setTimerRunning(false);
    setServiceHours(finalHours);
    setTimerStartTime(null);

    // Update backend
    const payload: VSComplaintUpdate = {
      timer_ended_at: now.toISOString(),
      service_hours: finalHours,
    };
    try {
      const updated = await updateComplaint({ id: selectedComplaint.id, body: payload }).unwrap();
      setSelectedComplaint(updated);
      showToast(`Service timer stopped. Recorded: ${finalHours} hrs`, 'info');
      refetch();
    } catch (err: any) {
      setTimerRunning(true);
      setTimerStartTime(new Date(selectedComplaint.timer_started_at || timerStartTime.toISOString()));
      console.error('Failed to stop timer:', err);
      showToast(err?.data?.detail || 'Failed to stop service timer.', 'error');
    }
  };

  const handleInitialChecklistUpload = async (file: File) => {
    if (!selectedComplaint) return;
    setUploadingInitialChecklist(true);
    try {
      const { url } = await uploadInitialChecklist({ complaintId: selectedComplaint.id, file }).unwrap();
      setSelectedComplaint((current) =>
        current?.id === selectedComplaint.id
          ? { ...current, initial_checklist_url: url }
          : current,
      );
      setInitialChecklistFile(null);
      showToast('Initial Checklist uploaded successfully.', 'success');
      refetch();
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to upload Initial Checklist.', 'error');
    } finally {
      setUploadingInitialChecklist(false);
    }
  };

  const handleMasterChecklistUpload = async (file: File) => {
    if (!selectedComplaint) return;
    setUploadingMasterChecklist(true);
    try {
      const { url } = await uploadMasterChecklist({ complaintId: selectedComplaint.id, file }).unwrap();
      setSelectedComplaint((current) =>
        current?.id === selectedComplaint.id
          ? { ...current, master_checklist_url: url }
          : current,
      );
      setMasterChecklistFile(null);
      showToast('Master Checklist uploaded successfully.', 'success');
      refetch();
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to upload Master Checklist.', 'error');
    } finally {
      setUploadingMasterChecklist(false);
    }
  };

  const handleComplaints8DUpload = async (file: File) => {
    if (!selectedComplaint) return;
    setUploadingComplaints8d(true);
    try {
      const { url } = await uploadComplaints8D({ complaintId: selectedComplaint.id, file }).unwrap();
      setSelectedComplaint((current) =>
        current?.id === selectedComplaint.id
          ? { ...current, complaints_8d_url: url }
          : current,
      );
      setComplaints8dFile(null);
      showToast('Complaints 8D Report uploaded successfully.', 'success');
      refetch();
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to upload Complaints 8D Report.', 'error');
    } finally {
      setUploadingComplaints8d(false);
    }
  };

  const handleVehicleImagesUpload = async (files: File[]) => {
    if (!selectedComplaint) return;
    setUploadingVehicleImages(true);
    try {
      const { urls } = await uploadVehicleImages({ complaintId: selectedComplaint.id, files }).unwrap();
      const existingImages = selectedComplaint.vehicle_images
        ? JSON.parse(selectedComplaint.vehicle_images)
        : [];
      setSelectedComplaint((current) =>
        current?.id === selectedComplaint.id
          ? { ...current, vehicle_images: JSON.stringify([...existingImages, ...urls]) }
          : current,
      );
      setVehicleImagesFiles([]);
      showToast(`${files.length} vehicle image(s) uploaded successfully.`, 'success');
      refetch();
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to upload Vehicle Images.', 'error');
    } finally {
      setUploadingVehicleImages(false);
    }
  };

  const handleDeleteVehicleImage = async (imageUrl: string) => {
    if (!selectedComplaint) return;
    try {
      const currentImages = selectedComplaint.vehicle_images ? JSON.parse(selectedComplaint.vehicle_images) : [];
      const updatedImages = currentImages.filter((img: string) => img !== imageUrl);
      
      const payload: VSComplaintUpdate = {
        vehicle_images: JSON.stringify(updatedImages),
      };
      const updated = await updateComplaint({ id: selectedComplaint.id, body: payload }).unwrap();
      setSelectedComplaint(updated);
      showToast('Image removed.', 'success');
      refetch();
    } catch (err: any) {
      showToast('Failed to delete image.', 'error');
    }
  };

  const handleDeleteDocument = async (field: 'initial_checklist_url' | 'master_checklist_url' | 'complaints_8d_url') => {
    if (!selectedComplaint) return;
    try {
      const payload: VSComplaintUpdate = {
        [field]: null,
      };
      const updated = await updateComplaint({ id: selectedComplaint.id, body: payload }).unwrap();
      setSelectedComplaint(updated);
      showToast('Document removed.', 'success');
      refetch();
    } catch (err: any) {
      showToast('Failed to delete document.', 'error');
    }
  };

  // Load service workflow data when complaint is selected
  React.useEffect(() => {
    const complaintId = selectedComplaint?.id ?? null;
    if (initializedComplaintIdRef.current === complaintId) return;
    initializedComplaintIdRef.current = complaintId;
    setSelectedWorkOrderTab(0);
    workflowRevisionRef.current += 1;
    customFieldsRevisionRef.current += 1;
    setWorkflowDirty(false);
    setWorkflowAutoSaveStatus('saved');
    setCustomFieldsDirty(false);
    setCustomFieldsAutoSaveStatus('saved');
    if (complaintId === null) {
      loadedCustomFieldsComplaintIdRef.current = null;
      setManageCustomFieldValues({});
    } else if (loadedCustomFieldsComplaintIdRef.current !== complaintId) {
      setManageCustomFieldValues({});
    }

    if (selectedComplaint) {
      setEstDeliveryDate(selectedComplaint.est_delivery_date || '');
      setCanDataCollected(selectedComplaint.can_data_collected ?? false);
      setTechnicianRemarks(selectedComplaint.technician_remarks || '');
      setOdometerReading(selectedComplaint.odometer_reading ?? '');
      setServiceType(selectedComplaint.service_type || 'GENERAL');
      setTimerRunning(!!selectedComplaint.timer_started_at && !selectedComplaint.timer_ended_at);
      setServiceHours(selectedComplaint.service_hours ?? null);
      setInitialChecklistFile(null);
      setMasterChecklistFile(null);
      setComplaints8dFile(null);
      setVehicleImagesFiles([]);
      
      setTimerStartTime(
        selectedComplaint.timer_started_at && !selectedComplaint.timer_ended_at
          ? new Date(selectedComplaint.timer_started_at)
          : null,
      );
    } else {
      setEstDeliveryDate('');
      setCanDataCollected(false);
      setTechnicianRemarks('');
      setOdometerReading('');
      setServiceType('GENERAL');
      setTimerRunning(false);
      setTimerStartTime(null);
      setServiceHours(null);
      setInitialChecklistFile(null);
      setMasterChecklistFile(null);
      setComplaints8dFile(null);
      setVehicleImagesFiles([]);
    }
  }, [selectedComplaint]);

  const handleCloseSelectedComplaint = async () => {
    if (!selectedComplaint) return;
    if (!(await flushAutoSaves(selectedComplaint.id))) return;
    setSelectedComplaint(null);
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
                  <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Severity</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Assigned To</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Created At</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Duration</TableCell>
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
                    <TableCell>
                      <Typography variant="caption" sx={{ whiteSpace: 'nowrap', fontWeight: 600, color: '#023020' }}>
                        {formatDuration(c.created_at)}
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
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5, flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#166534' }}>
                    {selectedKit.vehicle_number || selectedKit.kit_name}
                  </Typography>
                  <Chip
                    label={selectedKit.kit_number}
                    size="small"
                    sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11, backgroundColor: '#DCFCE7', color: '#15803D' }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
                  <Typography variant="caption" sx={{ color: '#334155' }}>
                    Customer: <strong>{selectedKit.customer_name || '—'}</strong>
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#334155' }}>
                    Installed on: <strong>{
                      (() => {
                        const kitDate =
                          selectedKit.installed_on ||
                          selectedVehicleObj?.retrofit_date ||
                          vehicles.find(
                            (v) =>
                              v.kit_id === selectedKit.id ||
                              (selectedKit.vehicle_number &&
                                v.vehicle_number.toUpperCase() === selectedKit.vehicle_number.toUpperCase())
                          )?.retrofit_date;
                        return kitDate ? formatDate(kitDate) : '—';
                      })()
                    }</strong>
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

                        {/* Custom Fields for Create Dialog */}
                                    {newCustomFields.length > 0 ? (
                          <Box sx={{ mt: 1 }}>
                            <Divider sx={{ mb: 1.5, borderColor: '#E4EBE1' }} />
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#023020', fontSize: 13 }}>
                              Custom Fields
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              {newCustomFields.map((field) => (
                                <CustomFieldRenderer
                                  key={field.id}
                                  field={field}
                                  value={newCustomFieldValues[String(field.id)]}
                                  onChange={(fieldId, value) => setNewCustomFieldValues(prev => ({ ...prev, [String(fieldId)]: value }))}
                                  users={users}
                                  uploadFile={uploadCustomFieldFile}
                                />
                              ))}
                            </Box>
                          </Box>
                                    ) : (
                                      <Box sx={{ mt: 1 }}>
                                        <Divider sx={{ mb: 1.5, borderColor: '#E4EBE1' }} />
                                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#023020', fontSize: 13 }}>
                                          Custom Fields
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ py: 2 }}>
                                          No custom fields configured for OPEN status in your department.
                                        </Typography>
                                      </Box>
                                    )}
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
          onClose={() => { void handleCloseSelectedComplaint(); }}
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
              overflow: 'hidden',
              overscrollBehavior: 'contain',
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
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
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
              {selectedComplaint.status === 'CLOSED' && selectedComplaint.feedback && (
                <Rating value={selectedComplaint.feedback.rating} readOnly size="small" aria-label="Customer satisfaction rating" />
              )}
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
              overscrollBehavior: 'contain',
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* LEFT SIDE: Work Order Form & Details (~73%) */}
            <Box
              sx={{
                flex: { xs: '1 1 100%', md: '1 1 73%' },
                minWidth: 0,
                overflowY: { xs: 'visible', md: 'auto' },
                overscrollBehavior: 'contain',
                minHeight: 0,
                pr: { xs: 0, md: 1 },
                display: 'flex',
                flexDirection: 'column',
                gap: 2.5,
              }}
            >

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
                      Assign Technician
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
                      <Box sx={{ mb: 2 }} />
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

                    <Box
                      sx={{
                        mt: 1.25,
                        p: 1.25,
                        border: '1px solid #E4EBE1',
                        borderRadius: 1.5,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: 1,
                      }}
                    >
                      {[
                        {
                          label: 'Start Time',
                          value: selectedComplaint.timer_started_at
                            ? formatDateTime(selectedComplaint.timer_started_at)
                            : 'Not started',
                        },
                        {
                          label: 'End Time',
                          value: selectedComplaint.timer_ended_at
                            ? formatDateTime(selectedComplaint.timer_ended_at)
                            : selectedComplaint.timer_started_at
                              ? 'In progress'
                              : '—',
                        },
                        {
                          label: 'Total Time',
                          value: formatServiceElapsed(
                            selectedComplaint.timer_started_at ?? null,
                            selectedComplaint.timer_ended_at ?? null,
                            selectedComplaint.service_hours ?? null,
                            timerNow,
                          ),
                        },
                      ].map((item) => (
                        <Box key={item.label} sx={{ minWidth: 0 }}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {item.label}
                          </Typography>
                          <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
                            {item.value}
                          </Typography>
                        </Box>
                      ))}
                    </Box>

                    {/* Quick Action buttons below Assigned Technician */}
                    {(selectedComplaint.status === 'OPEN' || selectedComplaint.status === 'ACKNOWLEDGED') && (
                      <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {selectedComplaint.status === 'OPEN' && (
                          <Button
                            size="small"
                            variant="contained"
                            color="warning"
                            onClick={() => handleUpdateStatus(selectedComplaint.id, 'ACKNOWLEDGED')}
                            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
                          >
                            Acknowledge
                          </Button>
                        )}
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          onClick={() => handleUpdateStatus(selectedComplaint.id, 'IN_PROGRESS')}
                          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
                        >
                          Start Service
                        </Button>
                      </Box>
                    )}
                  </Paper>
                </Grid>
              </Grid>

              <Tabs
                value={selectedWorkOrderTab}
                onChange={(_, value: number) => setSelectedWorkOrderTab(value)}
                aria-label="Work order sections"
                sx={{
                  minHeight: 40,
                  borderBottom: '1px solid #E4EBE1',
                  '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 700 },
                }}
              >
                <Tab label="Service Workflow" id="work-order-tab-0" aria-controls="work-order-panel-0" />
                <Tab label="Issue Matrix" id="work-order-tab-1" aria-controls="work-order-panel-1" />
                <Tab label="Technician Advice" id="work-order-tab-2" aria-controls="work-order-panel-2" />
              </Tabs>

              {selectedWorkOrderTab === 1 && (
                <Box role="tabpanel" id="work-order-panel-1" aria-labelledby="work-order-tab-1" />
              )}

              {selectedWorkOrderTab === 2 && (
                <Box role="tabpanel" id="work-order-panel-2" aria-labelledby="work-order-tab-2" sx={{ pt: 2 }}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight={800} color="#023020">
                      TECHNICIAN ADVICE
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Record the issues the technician needs to resolve for this work order.
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2.5 }}>
                    <TextField
                      label="Issue to Resolve"
                      value={newAdviceIssue}
                      onChange={(event) => setNewAdviceIssue(event.target.value)}
                      fullWidth
                      multiline
                      minRows={2}
                      inputProps={{ maxLength: 2000 }}
                      disabled={isCreatingAdvice}
                    />
                    <Button
                      variant="contained"
                      startIcon={isCreatingAdvice ? <CircularProgress size={16} color="inherit" /> : <Plus size={16} />}
                      onClick={handleCreateAdvice}
                      disabled={!newAdviceIssue.trim() || isCreatingAdvice}
                      sx={{ minWidth: 120, mt: 0.5, textTransform: 'none', fontWeight: 700 }}
                    >
                      Add Issue
                    </Button>
                  </Box>
                  {isAdviceError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      Could not load technician advice for this work order.
                    </Alert>
                  )}
                  {isAdviceLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                      <CircularProgress size={28} />
                    </Box>
                  ) : technicianAdvice.length === 0 ? (
                    <Box sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}>
                      <Typography variant="subtitle1" fontWeight={700}>No technician advice added</Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Add an issue above to start the list for this work order.
                      </Typography>
                    </Box>
                  ) : (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700, width: 140 }}>Serial Number</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Issue to Resolve</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, width: 120 }}>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {technicianAdvice.map((advice) => (
                            <TableRow key={advice.id}>
                              <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                                {advice.serial_number}
                              </TableCell>
                              <TableCell>
                                {editingAdviceId === advice.id ? (
                                  <TextField
                                    value={editingAdviceIssue}
                                    onChange={(event) => setEditingAdviceIssue(event.target.value)}
                                    fullWidth
                                    multiline
                                    size="small"
                                    inputProps={{ maxLength: 2000 }}
                                  />
                                ) : advice.issue_to_resolve}
                              </TableCell>
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                {editingAdviceId === advice.id ? (
                                  <>
                                    <Button
                                      size="small"
                                      onClick={() => handleUpdateAdvice(advice.id)}
                                      disabled={!editingAdviceIssue.trim() || isUpdatingAdvice}
                                      sx={{ textTransform: 'none' }}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      size="small"
                                      onClick={() => {
                                        setEditingAdviceId(null);
                                        setEditingAdviceIssue('');
                                      }}
                                      sx={{ textTransform: 'none' }}
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Tooltip title="Edit issue">
                                      <IconButton
                                        size="small"
                                        aria-label="Edit issue"
                                        onClick={() => {
                                          setEditingAdviceId(advice.id);
                                          setEditingAdviceIssue(advice.issue_to_resolve);
                                        }}
                                      >
                                        <Edit2 size={16} />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete issue">
                                      <IconButton
                                        size="small"
                                        aria-label="Delete issue"
                                        onClick={() => handleDeleteAdvice(advice.id)}
                                      >
                                        <TrashIcon size={16} />
                                      </IconButton>
                                    </Tooltip>
                                  </>
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

              {selectedWorkOrderTab === 0 && (
                <Box role="tabpanel" id="work-order-panel-0" aria-labelledby="work-order-tab-0" sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* Service Workflow Section */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, border: '1px solid #E4EBE1' }}>
                              <Typography variant="subtitle2" fontWeight={800} color="#023020" sx={{ mb: 1.5, lineHeight: 1.3 }}>
                                SERVICE WORKFLOW
                              </Typography>
                
                              {/* Row 1: Delivery date, service type, odometer and timer */}
                              <Grid container spacing={2}>
                                <Grid item xs={12} sm={6} md={3}>
                                  <TextField
                                    label="Estimated Delivery Date"
                                    type="date"
                                    size="small"
                                    fullWidth
                                    value={estDeliveryDate}
                                    onChange={(e) => {
                                      setEstDeliveryDate(e.target.value);
                                      markWorkflowDirty();
                                    }}
                                    InputLabelProps={{ shrink: true }}
                                    InputProps={{
                                      startAdornment: (
                                        <InputAdornment position="start">
                                          <Calendar color="action" fontSize="small" />
                                        </InputAdornment>
                                      ),
                                    }}
                                    sx={{ '& .MuiOutlinedInput-root': { fontSize: 12.5 } }}
                                  />
                                </Grid>
                  
                                <Grid item xs={12} sm={6} md={3}>
                                  <AppDropdown
                                    label="Service Type"
                                    value={serviceType}
                                    emptyLabel="Select Type"
                                    options={[
                                      { value: 'FREE', label: 'Free Service' },
                                      { value: 'GENERAL', label: 'General Service' },
                                      { value: 'PAID', label: 'Paid Service' },
                                    ]}
                                    onChange={(val) => {
                                      setServiceType(val as 'FREE' | 'GENERAL' | 'PAID');
                                      markWorkflowDirty();
                                    }}
                                    size="small"
                                  />
                                </Grid>
                  
                                <Grid item xs={12} sm={6} md={3}>
                                  <TextField
                                    label="Odometer Reading (km)"
                                    type="number"
                                    size="small"
                                    fullWidth
                                    value={odometerReading}
                                    onChange={(e) => {
                                      setOdometerReading(e.target.value === '' ? '' : Number(e.target.value));
                                      markWorkflowDirty();
                                    }}
                                    InputLabelProps={{ shrink: true }}
                                    InputProps={{
                                      startAdornment: (
                                        <InputAdornment position="start">
                                          <Gauge color="action" fontSize="small" />
                                        </InputAdornment>
                                      ),
                                    }}
                                    sx={{ '& .MuiOutlinedInput-root': { fontSize: 12.5 } }}
                                  />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                  <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, alignItems: 'center', height: '100%' }}>
                                    <Button
                                      variant="contained"
                                      color={timerRunning ? 'error' : 'success'}
                                      startIcon={<Timer />}
                                      onClick={timerRunning ? handleTimerStop : handleTimerStart}
                                      size="small"
                                      sx={{ textTransform: 'none', fontWeight: 700, minHeight: 40 }}
                                    >
                                      {timerRunning ? 'Stop Timer' : 'Start Timer'}
                                    </Button>
                                  </Box>
                                </Grid>
                              </Grid>

                              {/* Row 2: CAN Data Collected */}
                              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                                <Grid item xs={12}>
                                  <FormControl component="fieldset" sx={{ mt: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <input
                                        type="checkbox"
                                        checked={canDataCollected}
                                        onChange={(e) => {
                                          setCanDataCollected(e.target.checked);
                                          markWorkflowDirty();
                                        }}
                                        style={{ width: 18, height: 18, accentColor: '#023020' }}
                                      />
                                      <Typography variant="body2" fontWeight={600} color="#0f172a">
                                        CAN Data Collected
                                      </Typography>
                                      <Tooltip title="Indicates if CAN bus data was collected during service">
                                        <CheckSquare color="action" fontSize="small" />
                                      </Tooltip>
                                    </Box>
                                  </FormControl>
                                </Grid>
                              </Grid>

                              {/* Row 3: Technician service notes */}
                              <TextField
                                label="Technician's Service Notes"
                                multiline
                                rows={2}
                                size="small"
                                fullWidth
                                placeholder="Record service observations, work performed, or recommendations..."
                                value={technicianRemarks}
                                onChange={(e) => {
                                  setTechnicianRemarks(e.target.value);
                                  markWorkflowDirty();
                                }}
                                sx={{ mt: 1.5, '& .MuiOutlinedInput-root': { fontSize: 12.5 } }}
                              />

                              {/* Row 4: Document Uploads */}
                              <Divider sx={{ my: 2, borderColor: '#E4EBE1' }} />
                              <Typography variant="subtitle2" fontWeight={700} color="#0f172a" gutterBottom>
                                Documents & Reports
                              </Typography>
                
                              <Grid container spacing={2}>
                                {/* Initial Checklist */}
                                <Grid item xs={12} sm={6} md={3}>
                                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, height: '100%', border: initialChecklistFile || selectedComplaint?.initial_checklist_url ? '1px solid #023020' : '1px solid #E4EBE1' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <FileText color="#023020" fontSize={20} />
                                        <Typography variant="body2" fontWeight={700} color="#023020">
                                          Initial Check List
                                        </Typography>
                                      </Box>
                                      {selectedComplaint?.initial_checklist_url && !uploadingInitialChecklist && (
                                        <Tooltip title="Delete document">
                                          <IconButton
                                            size="small"
                                            onClick={() => handleDeleteDocument('initial_checklist_url')}
                                            sx={{ color: '#ef4444', '&:hover': { bgcolor: '#fef2f2' } }}
                                          >
                                            <TrashIcon fontSize={14} />
                                          </IconButton>
                                        </Tooltip>
                                      )}
                                    </Box>
                                    {selectedComplaint?.initial_checklist_url && (
                                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
                                        <Typography variant="caption" color="text.secondary" display="block">
                                          Uploaded: {selectedComplaint.initial_checklist_url.split('/').pop()}
                                        </Typography>
                                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<Eye fontSize={12} />}
                                            onClick={() => window.open(selectedComplaint!.initial_checklist_url!, '_blank')}
                                            disabled={uploadingInitialChecklist}
                                          >
                                            View
                                          </Button>
                                          <Button
                                            variant="contained"
                                            color="primary"
                                            size="small"
                                            startIcon={uploadingInitialChecklist ? <CircularProgress size={14} color="inherit" /> : <Upload fontSize={14} />}
                                            onClick={() => document.getElementById('initial-checklist-upload')?.click()}
                                            disabled={uploadingInitialChecklist}
                                            sx={{ flex: '1 1 88px', minWidth: 84, px: 1, whiteSpace: 'nowrap' }}
                                          >
                                            {uploadingInitialChecklist ? 'Uploading...' : 'Replace'}
                                          </Button>
                                        </Box>
                                      </Box>
                                    )}
                                    <input
                                      type="file"
                                      accept=".pdf,.png,.jpg,.jpeg"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        e.target.value = '';
                                        if (file) {
                                          setInitialChecklistFile(file);
                                          handleInitialChecklistUpload(file);
                                        }
                                      }}
                                      disabled={uploadingInitialChecklist}
                                      style={{ display: 'none' }}
                                      id="initial-checklist-upload"
                                    />
                                    {!selectedComplaint?.initial_checklist_url && <Button
                                      variant={initialChecklistFile || selectedComplaint?.initial_checklist_url ? 'contained' : 'outlined'}
                                      color="primary"
                                      size="small"
                                      startIcon={uploadingInitialChecklist ? <CircularProgress size={16} /> : <Upload fontSize={16} />}
                                      onClick={() => document.getElementById('initial-checklist-upload')?.click()}
                                      disabled={uploadingInitialChecklist}
                                      fullWidth
                                    >
                                      {uploadingInitialChecklist ? 'Uploading...' : 'Upload'}
                                    </Button>}
                                  </Paper>
                                </Grid>

                                {/* Master Checklist */}
                                <Grid item xs={12} sm={6} md={3}>
                                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, height: '100%', border: masterChecklistFile || selectedComplaint?.master_checklist_url ? '1px solid #023020' : '1px solid #E4EBE1' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <FileText color="#023020" fontSize={20} />
                                        <Typography variant="body2" fontWeight={700} color="#023020">
                                          Master Check List
                                        </Typography>
                                      </Box>
                                      {selectedComplaint?.master_checklist_url && !uploadingMasterChecklist && (
                                        <Tooltip title="Delete document">
                                          <IconButton
                                            size="small"
                                            onClick={() => handleDeleteDocument('master_checklist_url')}
                                            sx={{ color: '#ef4444', '&:hover': { bgcolor: '#fef2f2' } }}
                                          >
                                            <TrashIcon fontSize={14} />
                                          </IconButton>
                                        </Tooltip>
                                      )}
                                    </Box>
                                    {selectedComplaint?.master_checklist_url && (
                                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
                                        <Typography variant="caption" color="text.secondary" display="block">
                                          Uploaded: {selectedComplaint.master_checklist_url.split('/').pop()}
                                        </Typography>
                                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<Eye fontSize={12} />}
                                            onClick={() => window.open(selectedComplaint!.master_checklist_url!, '_blank')}
                                            disabled={uploadingMasterChecklist}
                                          >
                                            View
                                          </Button>
                                          <Button
                                            variant="contained"
                                            color="primary"
                                            size="small"
                                            startIcon={uploadingMasterChecklist ? <CircularProgress size={14} color="inherit" /> : <Upload fontSize={14} />}
                                            onClick={() => document.getElementById('master-checklist-upload')?.click()}
                                            disabled={uploadingMasterChecklist}
                                            sx={{ flex: '1 1 88px', minWidth: 84, px: 1, whiteSpace: 'nowrap' }}
                                          >
                                            {uploadingMasterChecklist ? 'Uploading...' : 'Replace'}
                                          </Button>
                                        </Box>
                                      </Box>
                                    )}
                                    <input
                                      type="file"
                                      accept=".pdf,.png,.jpg,.jpeg"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        e.target.value = '';
                                        if (file) {
                                          setMasterChecklistFile(file);
                                          handleMasterChecklistUpload(file);
                                        }
                                      }}
                                      disabled={uploadingMasterChecklist}
                                      style={{ display: 'none' }}
                                      id="master-checklist-upload"
                                    />
                                    {!selectedComplaint?.master_checklist_url && <Button
                                      variant={masterChecklistFile || selectedComplaint?.master_checklist_url ? 'contained' : 'outlined'}
                                      color="primary"
                                      size="small"
                                      startIcon={uploadingMasterChecklist ? <CircularProgress size={16} /> : <Upload fontSize={16} />}
                                      onClick={() => document.getElementById('master-checklist-upload')?.click()}
                                      disabled={uploadingMasterChecklist}
                                      fullWidth
                                    >
                                      {uploadingMasterChecklist ? 'Uploading...' : 'Upload'}
                                    </Button>}
                                  </Paper>
                                </Grid>

                                {/* Complaints 8D Report */}
                                <Grid item xs={12} sm={6} md={3}>
                                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, height: '100%', border: complaints8dFile || selectedComplaint?.complaints_8d_url ? '1px solid #023020' : '1px solid #E4EBE1' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <FileQuestion color="#023020" fontSize={20} />
                                        <Typography variant="body2" fontWeight={700} color="#023020">
                                          Complaints 8D
                                        </Typography>
                                      </Box>
                                      {selectedComplaint?.complaints_8d_url && !uploadingComplaints8d && (
                                        <Tooltip title="Delete document">
                                          <IconButton
                                            size="small"
                                            onClick={() => handleDeleteDocument('complaints_8d_url')}
                                            sx={{ color: '#ef4444', '&:hover': { bgcolor: '#fef2f2' } }}
                                          >
                                            <TrashIcon fontSize={14} />
                                          </IconButton>
                                        </Tooltip>
                                      )}
                                    </Box>
                                    {selectedComplaint?.complaints_8d_url && (
                                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
                                        <Typography variant="caption" color="text.secondary" display="block">
                                          Uploaded: {selectedComplaint.complaints_8d_url.split('/').pop()}
                                        </Typography>
                                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<Eye fontSize={12} />}
                                            onClick={() => window.open(selectedComplaint!.complaints_8d_url!, '_blank')}
                                            disabled={uploadingComplaints8d}
                                          >
                                            View
                                          </Button>
                                          <Button
                                            variant="contained"
                                            color="primary"
                                            size="small"
                                            startIcon={uploadingComplaints8d ? <CircularProgress size={14} color="inherit" /> : <Upload fontSize={14} />}
                                            onClick={() => document.getElementById('complaints-8d-upload')?.click()}
                                            disabled={uploadingComplaints8d}
                                            sx={{ flex: '1 1 88px', minWidth: 84, px: 1, whiteSpace: 'nowrap' }}
                                          >
                                            {uploadingComplaints8d ? 'Uploading...' : 'Replace'}
                                          </Button>
                                        </Box>
                                      </Box>
                                    )}
                                    <input
                                      type="file"
                                      accept=".pdf,.png,.jpg,.jpeg"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        e.target.value = '';
                                        if (file) {
                                          setComplaints8dFile(file);
                                          handleComplaints8DUpload(file);
                                        }
                                      }}
                                      disabled={uploadingComplaints8d}
                                      style={{ display: 'none' }}
                                      id="complaints-8d-upload"
                                    />
                                    {!selectedComplaint?.complaints_8d_url && <Button
                                      variant={complaints8dFile || selectedComplaint?.complaints_8d_url ? 'contained' : 'outlined'}
                                      color="primary"
                                      size="small"
                                      startIcon={uploadingComplaints8d ? <CircularProgress size={16} /> : <Upload fontSize={16} />}
                                      onClick={() => document.getElementById('complaints-8d-upload')?.click()}
                                      disabled={uploadingComplaints8d}
                                      fullWidth
                                    >
                                      {uploadingComplaints8d ? 'Uploading...' : 'Upload'}
                                    </Button>}
                                  </Paper>
                                </Grid>

                                {/* Vehicle Images */}
                                <Grid item xs={12} sm={6} md={3}>
                                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, height: '100%', border: vehicleImagesFiles.length > 0 || (selectedComplaint?.vehicle_images && JSON.parse(selectedComplaint.vehicle_images).length > 0) ? '1px solid #023020' : '1px solid #E4EBE1' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <FileImage color="#023020" fontSize={20} />
                                        <Typography variant="body2" fontWeight={700} color="#023020">
                                          Vehicle Images
                                        </Typography>
                                      </Box>
                                    </Box>
                      
                                    {/* Existing Images */}
                                    {(() => {
                                      try {
                                        const images = selectedComplaint?.vehicle_images ? JSON.parse(selectedComplaint.vehicle_images) : [];
                                        if (images.length > 0) {
                                          return (
                                            <Box sx={{ mb: 1 }}>
                                              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                                Existing Images ({images.length})
                                              </Typography>
                                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                                {images.map((imgUrl: string, idx: number) => (
                                                  <Box key={idx} sx={{ position: 'relative', width: 80, height: 80, borderRadius: 1, overflow: 'hidden', border: '1px solid #E4EBE1' }}>
                                                    <img
                                                      src={imgUrl}
                                                      alt={`Vehicle image ${idx + 1}`}
                                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                      onClick={() => window.open(imgUrl, '_blank')}
                                                    />
                                                    <IconButton
                                                      size="small"
                                                      onClick={() => handleDeleteVehicleImage(imgUrl)}
                                                      sx={{
                                                        position: 'absolute',
                                                        top: 2,
                                                        right: 2,
                                                        bgcolor: 'rgba(239, 68, 68, 0.9)',
                                                        color: 'white',
                                                        '&:hover': { bgcolor: 'rgba(220, 38, 38, 1)' },
                                                      }}
                                                    >
                                                      <X fontSize={12} />
                                                    </IconButton>
                                                  </Box>
                                                ))}
                                              </Box>
                                            </Box>
                                          );
                                        }
                                        return null;
                                      } catch {
                                        return null;
                                      }
                                    })()}

                                    {/* New Images Preview */}
                                    {vehicleImagesFiles.length > 0 && (
                                      <Box sx={{ mb: 1 }}>
                                        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                          New Images ({vehicleImagesFiles.length})
                                        </Typography>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                          {vehicleImagesFiles.map((file, idx) => (
                                            <Box key={idx} sx={{ position: 'relative', width: 80, height: 80, borderRadius: 1, overflow: 'hidden', border: '1px solid #E4EBE1' }}>
                                              <img
                                                src={URL.createObjectURL(file)}
                                                alt={`New image ${idx + 1}`}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                              />
                                              <IconButton
                                                size="small"
                                                onClick={() => setVehicleImagesFiles(prev => prev.filter((_, i) => i !== idx))}
                                                sx={{
                                                  position: 'absolute',
                                                  top: 2,
                                                  right: 2,
                                                  bgcolor: 'rgba(239, 68, 68, 0.9)',
                                                  color: 'white',
                                                  '&:hover': { bgcolor: 'rgba(220, 38, 38, 1)' },
                                                }}
                                              >
                                                <X fontSize={12} />
                                              </IconButton>
                                            </Box>
                                          ))}
                                        </Box>
                                      </Box>
                                    )}

                                    <input
                                      type="file"
                                      accept=".jpg,.jpeg,.png"
                                      multiple
                                      onChange={(e) => {
                                        const files = Array.from(e.target.files || []);
                                        e.target.value = '';
                                        if (files.length > 0) {
                                          setVehicleImagesFiles(prev => [...prev, ...files]);
                                        }
                                      }}
                                      disabled={uploadingVehicleImages}
                                      style={{ display: 'none' }}
                                      id="vehicle-images-upload"
                                    />
                                    <Button
                                      variant={vehicleImagesFiles.length > 0 ? 'contained' : 'outlined'}
                                      color="primary"
                                      size="small"
                                      startIcon={uploadingVehicleImages ? <CircularProgress size={16} /> : <Upload fontSize={16} />}
                                      onClick={() => {
                                        if (vehicleImagesFiles.length > 0) {
                                          handleVehicleImagesUpload(vehicleImagesFiles);
                                        } else {
                                          document.getElementById('vehicle-images-upload')?.click();
                                        }
                                      }}
                                      disabled={uploadingVehicleImages}
                                      fullWidth
                                    >
                                      {uploadingVehicleImages
                                        ? 'Uploading...'
                                        : vehicleImagesFiles.length > 0
                                          ? `Upload ${vehicleImagesFiles.length} Image${vehicleImagesFiles.length === 1 ? '' : 's'}`
                                          : 'Choose Images'}
                                    </Button>
                                  </Paper>
                                </Grid>
                              </Grid>
                            </Paper>
                </Box>
              )}

                          </Box>

            {/* RIGHT SIDE: Changelog & Activity Logs (~27%) */}
            <Paper
              variant="outlined"
              sx={{
                flex: { xs: '1 1 100%', md: '0 0 27%' },
                width: { xs: '100%', md: '27%' },
                minWidth: { xs: '100%', md: 260 },
                maxWidth: { md: 340 },
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '12px',
                borderColor: '#E4EBE1',
                backgroundColor: '#FAFBF9',
                p: 2,
                overflow: 'hidden',
                overscrollBehavior: 'contain',
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
                  overscrollBehavior: 'contain',
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

                    <DialogActions
                      sx={{
                        p: 2,
                        px: 3,
                        borderTop: '1px solid #E4EBE1',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 1.5,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography variant="caption" role="status" sx={{ color: workflowAutoSaveStatus === 'error' ? '#b91c1c' : '#64748b' }}>
                          {workflowAutoSaveStatus === 'saving' ? 'Saving workflow...' :
                            workflowAutoSaveStatus === 'unsaved' ? 'Workflow changes will save automatically' :
                              workflowAutoSaveStatus === 'error' ? 'Workflow auto-save failed' : 'Workflow saved'}
                        </Typography>
                        {manageCustomFields.length > 0 && (
                          <Typography variant="caption" role="status" sx={{ color: customFieldsAutoSaveStatus === 'error' ? '#b91c1c' : '#64748b' }}>
                            {customFieldsAutoSaveStatus === 'saving' ? 'Saving custom fields...' :
                              customFieldsAutoSaveStatus === 'unsaved' ? 'Custom fields will save automatically' :
                                customFieldsAutoSaveStatus === 'error' ? 'Custom field auto-save failed' : 'Custom fields saved'}
                          </Typography>
                        )}
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        {selectedComplaint.status === 'IN_PROGRESS' && (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={() => handleUpdateStatus(selectedComplaint.id, 'RESOLVED')}
                            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
                          >
                            Mark Resolved
                          </Button>
                        )}

                        {selectedComplaint.status === 'RESOLVED' && (
                          <>
                            {(timerRunning || (selectedComplaint.timer_started_at && !selectedComplaint.timer_ended_at)) && (
                              <Typography variant="caption" role="status" color="error">
                                Stop the timer before closing
                              </Typography>
                            )}
                            <Button
                              size="small"
                              variant="contained"
                              disabled={timerRunning || Boolean(selectedComplaint.timer_started_at && !selectedComplaint.timer_ended_at)}
                              onClick={() => {
                                setCloseResolutionSummary(selectedComplaint.resolution_summary || '');
                                setIsCloseDialogOpen(true);
                              }}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                bgcolor: '#023020',
                                color: '#fff',
                                borderRadius: '8px',
                                '&:hover': { bgcolor: '#034732' },
                              }}
                            >
                              Close Work Order
                            </Button>
                          </>
                        )}

                        <Button
                          onClick={() => { void handleCloseSelectedComplaint(); }}
                          variant="outlined"
                          sx={{ textTransform: 'none', fontWeight: 600, borderColor: '#CBD5E1', color: '#64748B', borderRadius: '8px' }}
                        >
                          Close
                        </Button>
                      </Box>
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
            label="Resolution Summary (Optional)"
            placeholder="Describe repairs conducted, components replaced, tests verified..."
            multiline
            rows={3}
            fullWidth
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
                    disabled={isClosing || isSendingOTP}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
                    {isClosing ? 'Closing...' : isSendingOTP ? 'Sending OTP...' : 'Confirm Closure'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* =====================================================================
                  OTP VERIFICATION MODAL
      ====================================================================== */}
              <Dialog open={isOTPDialogOpen} onClose={() => { setIsOTPDialogOpen(false); setOtpCode(''); setOtpError(null); setOtpExpiresAt(null); }} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShieldAlert size={20} color="#023020" />
                  Verify OTP to Close Work Order
                </DialogTitle>
                <DialogContent dividers>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    A 6-digit OTP has been sent to the customer's registered phone number. Please enter it below to confirm work order closure.
                  </Typography>
          
                  {otpError && (
                    <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>
                      {otpError}
                    </Alert>
                  )}

                  <Box sx={{ display: 'flex', gap: 1, mb: 2, justifyContent: 'center' }}>
                    {[...Array(6)].map((_, i) => (
                      <TextField
                        key={i}
                        value={otpCode[i] || ''}
                        onPaste={(e) => {
                          const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                          if (paste) {
                            setOtpCode(paste);
                            e.preventDefault();
                          }
                        }}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          if (val.length <= 1) {
                            setOtpCode(prev => prev.slice(0, i) + val + prev.slice(i + 1));
                            if (val && i < 5) {
                              // Auto-focus next input
                              const nextInput = document.querySelector(`input[data-otp-index="${i + 1}"]`);
                              (nextInput as HTMLInputElement)?.focus();
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !otpCode[i] && i > 0) {
                            const prevInput = document.querySelector(`input[data-otp-index="${i - 1}"]`);
                            (prevInput as HTMLInputElement)?.focus();
                          }
                        }}
                        inputProps={{
                          maxLength: 1,
                          'data-otp-index': i,
                          style: { textAlign: 'center', fontSize: 24, fontWeight: 700 },
                        }}
                        size="small"
                        sx={{
                          width: 48,
                          height: 56,
                          '& .MuiOutlinedInput-root': {
                            padding: 0,
                            '& input': { textAlign: 'center' },
                          },
                        }}
                      />
                    ))}
                  </Box>

                  {otpExpiresAt && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
                      <Clock size={16} color="#f59e0b" />
                      <Typography variant="caption" sx={{ fontWeight: 600, color: '#92400e' }}>
                        OTP expires in: <OTPCountdown expiresAt={otpExpiresAt} />
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
                    <Button
                      variant="contained"
                      color="success"
                      fullWidth
                      onClick={handleOTPSubmit}
                      disabled={otpVerifying || otpCode.length !== 6}
                      sx={{ textTransform: 'none', fontWeight: 700, py: 1 }}
                    >
                      {otpVerifying ? 'Verifying...' : 'Verify & Close Work Order'}
                    </Button>
                    <Button
                      variant="outlined"
                      fullWidth
                      onClick={handleResendOTP}
                      disabled={otpSending}
                      sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                      {otpSending ? 'Sending...' : 'Resend OTP'}
                    </Button>
                  </Box>
                </DialogContent>
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
