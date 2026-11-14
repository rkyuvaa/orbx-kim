import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Tooltip,
  Drawer,
  Divider,
  Menu,
} from '@mui/material';
import {
  ClipboardList,
  Package,
  Laptop,
  Plus,
  Search,
  Trash2,
  Edit3,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  DollarSign,
  X,
  MoreVertical,
  Paperclip,
} from 'lucide-react';
import { useTableSort } from '../hooks/useTableSort';
import ErpSortHeaderCell from '../components/ui/ErpSortHeaderCell';
import { useToast } from '@/components/ui/ToastHost';
import { formatDate } from '@/utils/format';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { RequirementItem, MaterialRequisitionItem, AttachmentFile } from '@/types/requirements';
import ITRequirementFormModal from '@/components/requirements/ITRequirementFormModal';
import ITRequirementDetailDrawer from '@/components/requirements/ITRequirementDetailDrawer';import { useDatabaseStoredState } from '@/hooks/useDatabaseStoredState';
import {
  useGenerateDocumentNumberMutation,
  usePreviewDocumentNumberMutation,
} from '@/api/documentNumberingApi';
import { useDropdownOptionsQuery } from '@/api/mastersApi';
import { useMeQuery } from '@/api/authApi';
import { useGetAllUsersQuery } from '@/api/rbacApi';
import { setUser } from '../auth/authSlice';
import StandardDateInput from '@/components/common/StandardDateInput';

const numberFieldSx = {
  m: -1.5,
  '& input[type=number]': { MozAppearance: 'textfield' },
  '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
    WebkitAppearance: 'none',
    margin: 0,
  },
};

// Helper Badge Colors
const getPriorityChip = (priority: string) => {
  switch (priority) {
    case 'CRITICAL':
      return <Chip label="CRITICAL" size="small" sx={{ bgcolor: '#FEE2E2', color: '#DC2626', fontWeight: 700, fontSize: '0.65rem' }} />;
    case 'HIGH':
      return <Chip label="HIGH" size="small" sx={{ bgcolor: '#FFEDD5', color: '#EA580C', fontWeight: 700, fontSize: '0.65rem' }} />;
    case 'MEDIUM':
      return <Chip label="MEDIUM" size="small" sx={{ bgcolor: '#FEF3C7', color: '#D97706', fontWeight: 700, fontSize: '0.65rem' }} />;
    default:
      return <Chip label="LOW" size="small" sx={{ bgcolor: '#F1F5F9', color: '#475569', fontWeight: 700, fontSize: '0.65rem' }} />;
  }
};

const getStatusChip = (status: string) => {
  switch (status) {
    case 'FULFILLED':
    case 'COMPLETED':
      return <Chip label="COMPLETED" size="small" icon={<CheckCircle2 size={12} />} sx={{ bgcolor: '#DCFCE7', color: '#15803D', fontWeight: 700, fontSize: '0.68rem' }} />;
    case 'APPROVED':
      return <Chip label="APPROVED" size="small" sx={{ bgcolor: '#DBEAFE', color: '#1D4ED8', fontWeight: 700, fontSize: '0.68rem' }} />;
    case 'SUBMITTED':
      return <Chip label="SUBMITTED" size="small" icon={<Clock size={12} />} sx={{ bgcolor: '#FEF3C7', color: '#B45309', fontWeight: 700, fontSize: '0.68rem' }} />;
    case 'MANAGER_APPROVAL':
      return <Chip label="MANAGER APPROVAL" size="small" icon={<Clock size={12} />} sx={{ bgcolor: '#DBEAFE', color: '#1D4ED8', fontWeight: 700, fontSize: '0.68rem' }} />;
    case 'IT_MANAGER_REVIEW':
      return <Chip label="IT REVIEW" size="small" icon={<Clock size={12} />} sx={{ bgcolor: '#E0E7FF', color: '#4338CA', fontWeight: 700, fontSize: '0.68rem' }} />;
    case 'DEPT_HEAD_APPROVAL':
      return <Chip label="DEPT APPROVAL" size="small" icon={<Clock size={12} />} sx={{ bgcolor: '#F3E8FF', color: '#7E22CE', fontWeight: 700, fontSize: '0.68rem' }} />;
    case 'IT_PROCESSING':
      return <Chip label="IT PROCESSING" size="small" icon={<Laptop size={12} />} sx={{ bgcolor: '#CCFBF1', color: '#0F766E', fontWeight: 700, fontSize: '0.68rem' }} />;
    case 'REJECTED':
      return <Chip label="REJECTED" size="small" icon={<XCircle size={12} />} sx={{ bgcolor: '#FEE2E2', color: '#B91C1C', fontWeight: 700, fontSize: '0.68rem' }} />;
    case 'DRAFT':
      return <Chip label="DRAFT" size="small" sx={{ bgcolor: '#F1F5F9', color: '#64748B', fontWeight: 700, fontSize: '0.68rem' }} />;
    default:
      return <Chip label="PENDING" size="small" icon={<AlertTriangle size={12} />} sx={{ bgcolor: '#FEF3C7', color: '#B45309', fontWeight: 700, fontSize: '0.68rem' }} />;
  }
};

// ── Requirement table row component (extracts useState so hooks stay valid) ──
interface RequirementRowProps {
  item: RequirementItem;
  isIT: boolean;
  setSelectedDetailItem: (item: RequirementItem | null) => void;
  handleOpenEdit: (item: RequirementItem) => void;
  handleDeleteItem: (id: string) => void;
}

function RequirementRow({ item, isIT, setSelectedDetailItem, handleOpenEdit, handleDeleteItem }: RequirementRowProps) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => setAnchorEl(null);
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleOpenEdit(item);
    handleMenuClose();
  };
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleDeleteItem(item.id);
    handleMenuClose();
  };
  const handleView = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDetailItem(item);
    handleMenuClose();
  };

  return (
    <TableRow key={item.id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelectedDetailItem(item)}>
      <TableCell sx={{ fontWeight: 600 }}>{item.title}</TableCell>
      <TableCell sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>{item.requester_name || item.requested_by || '-'}</TableCell>
      {!isIT && (
        <TableCell sx={{ fontWeight: 600 }}>
          {item.quantity} {item.unit}
        </TableCell>
      )}
      {!isIT && (
        <TableCell sx={{ fontWeight: 700 }}>
          ₹{(item.total_cost || 0).toLocaleString()}
        </TableCell>
      )}
      <TableCell>{item.department}</TableCell>
      <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(item.preferred_go_live_date || item.required_by_date)}</TableCell>
      <TableCell>{item.urgency ? <Chip label={item.urgency} size="small" variant="outlined" /> : getPriorityChip(item.priority)}</TableCell>
      <TableCell>{getStatusChip(item.status)}</TableCell>
      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
        <IconButton size="small" onClick={handleMenuOpen} sx={{ color: 'text.secondary' }}>
          <MoreVertical size={16} />
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleMenuClose}
          PaperProps={{ sx: { borderRadius: 2, border: '1px solid', borderColor: 'divider' } }}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem onClick={handleView} dense sx={{ py: 1, fontSize: '0.8rem' }}>
            <Box sx={{ mr: 1, display: 'inline-flex' }}><Eye size={14} /></Box> View
          </MenuItem>
          <MenuItem onClick={handleEdit} dense sx={{ py: 1, fontSize: '0.8rem', color: '#2563EB' }}>
            <Box sx={{ mr: 1, display: 'inline-flex' }}><Edit3 size={14} /></Box> Edit
          </MenuItem>
          <MenuItem onClick={handleDelete} dense sx={{ py: 1, fontSize: '0.8rem', color: '#DC2626' }}>
            <Box sx={{ mr: 1, display: 'inline-flex' }}><Trash2 size={14} /></Box> Delete
          </MenuItem>
        </Menu>
      </TableCell>
    </TableRow>
  );
}

export default function RequirementsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const loggedUser = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const { data: meUser } = useMeQuery();
  const { data: allUsers = [], isLoading: usersLoading } = useGetAllUsersQuery();
  const { data: configuredUoms = [], isLoading: uomsLoading } =
    useDropdownOptionsQuery('unit_of_measure');
  const uomOptions = useMemo(
    () => configuredUoms.filter((option) => option.is_active),
    [configuredUoms],
  );

  // Build a lookup map of user id -> full name for reporting manager resolution
  const userNameMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const u of allUsers) {
      if (u.id != null) map.set(u.id, u.full_name || '');
    }
    return map;
  }, [allUsers]);
  const currentUserRecord = useMemo(
    () => allUsers.find((user) => user.id === loggedUser?.id),
    [allUsers, loggedUser?.id],
  );

  // Sync fresh user from /auth/me (includes department & manager name) into Redux
  useEffect(() => {
    if (meUser) {
      dispatch(setUser(meUser));
    }
  }, [meUser, dispatch]);

  // Auto-populate header fields from logged-in user (Settings > Users / RBAC profile)
  const populateHeaderDefaults = useCallback(() => {
    const requesterName = loggedUser?.full_name || '';
    setFormRequesterName(requesterName);
    setFormRequestedBy(requesterName || 'Admin User');
    setFormRequestDate(new Date().toISOString().split('T')[0]);

    // Prefer the user-list profile, then fall back to the authenticated profile.
    setFormDepartment(
      currentUserRecord?.primary_department_name ||
      loggedUser?.primary_department_name ||
      '',
    );

    // Resolve the manager id from the logged-in user's row first, then /auth/me.
    const managerId =
      currentUserRecord?.reporting_manager_id ?? loggedUser?.reporting_manager_id;
    const managerName =
      (managerId != null ? userNameMap.get(managerId) : '') ||
      currentUserRecord?.reporting_manager_name ||
      loggedUser?.reporting_manager_name ||
      '';
    setFormApprover(managerName);
  }, [currentUserRecord, loggedUser, userNameMap]);

  // Auto-populate header fields when loggedUser changes (department & manager from /auth/me)
  useEffect(() => {
    populateHeaderDefaults();
  }, [loggedUser, populateHeaderDefaults]);

  // Active tab check
  const isIT = location.pathname.includes('/requirements/it');
  const reqType: 'MATERIAL' | 'IT' = isIT ? 'IT' : 'MATERIAL';

  const [requirements, setRequirements] = useDatabaseStoredState<RequirementItem[]>(
    'crm_requirements_items_data',
    [],
  );

  const [generateDocumentNumber] = useGenerateDocumentNumberMutation();
  const [previewDocumentNumber] = usePreviewDocumentNumberMutation();

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  // Modal & Drawer State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RequirementItem | null>(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState<RequirementItem | null>(null);

  // Legacy Material Form State
  const [formCategory, setFormCategory] = useState('');
  const [formQuantity, setFormQuantity] = useState<number>(1);
  const [formUnit, setFormUnit] = useState('Nos');
  const [formUnitCost, setFormUnitCost] = useState<number>(0);
  const [formPriority, setFormPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [formStatus, setFormStatus] = useState<string>('PENDING');
  const [formDepartment, setFormDepartment] = useState('Operations');
  const [formRequestedBy, setFormRequestedBy] = useState('Admin User');
  const [formRequiredByDate, setFormRequiredByDate] = useState(new Date().toISOString().split('T')[0]);
  const [formJustification, setFormJustification] = useState('');
  const [formSpecifications, setFormSpecifications] = useState('');
  const [formVendorSuggestion, setFormVendorSuggestion] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Material requisition header fields
  const [formRequestNo, setFormRequestNo] = useState('');
  const [formRequestDate, setFormRequestDate] = useState(new Date().toISOString().split('T')[0]);
  const [formRequesterName, setFormRequesterName] = useState('');
  const [formApprover, setFormApprover] = useState('');
  const [formProjectCode, setFormProjectCode] = useState('');
  const [formProjectName, setFormProjectName] = useState('');

  // Material requisition item lines
  const [formItems, setFormItems] = useState<MaterialRequisitionItem[]>([]);
  const [formAttachments, setFormAttachments] = useState<AttachmentFile[]>([]);

  // Categories list
  const materialCategories = ['Raw Materials', 'Consumables', 'Safety Equipment', 'Tools & Machinery', 'Office Supplies', 'Packaging'];
  const itCategories = ['New Feature / Module', 'Enhancement / Change', 'Bug Fix', 'Hardware / Device', 'Access / Permission', 'Other'];
  const categoryOptions = reqType === 'IT' ? itCategories : materialCategories;

  // Filter items matching active type & criteria
  const typeFiltered = useMemo(() => {
    return requirements.filter((item) => item.type === reqType);
  }, [requirements, reqType]);

  const filteredItems = useMemo(() => {
    return typeFiltered.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchId = item.id.toLowerCase().includes(q);
        const matchDept = item.department.toLowerCase().includes(q);
        const matchCat = (item.category || '').toLowerCase().includes(q);
        const matchReq = (item.requested_by || '').toLowerCase().includes(q);
        if (!matchTitle && !matchId && !matchDept && !matchCat && !matchReq) return false;
      }
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && item.priority !== priorityFilter) return false;
      if (departmentFilter !== 'ALL' && item.department !== departmentFilter) return false;

      return true;
    });
  }, [typeFiltered, searchQuery, statusFilter, priorityFilter, departmentFilter]);

  const { sortState, handleSort, sortData } = useTableSort<RequirementItem>();
  const sortedItems = useMemo(() => sortData(filteredItems), [filteredItems, sortData]);

  // Statistics KPIs
  const totalCount = typeFiltered.length;
  const pendingCount = typeFiltered.filter((i) => i.status === 'PENDING' || i.status === 'DRAFT' || i.status === 'SUBMITTED' || i.status === 'MANAGER_APPROVAL').length;
  const approvedCount = typeFiltered.filter((i) => i.status === 'APPROVED' || i.status === 'IN_PROCUREMENT' || i.status === 'IT_PROCESSING' || i.status === 'IT_MANAGER_REVIEW' || i.status === 'DEPT_HEAD_APPROVAL').length;
  const fulfilledCount = typeFiltered.filter((i) => i.status === 'FULFILLED' || i.status === 'COMPLETED').length;
  const totalCostEstimate = typeFiltered.reduce((acc, curr) => acc + (curr.total_cost || 0), 0);

  // Form Reset for Material
  const resetForm = () => {
    setEditingItem(null);
    setFormCategory(categoryOptions[0] || '');
    setFormQuantity(1);
    setFormUnit('Pcs');
    setFormUnitCost(0);
    setFormPriority('MEDIUM');
    setFormStatus('PENDING');
    populateHeaderDefaults();
    setFormRequiredByDate(new Date().toISOString().split('T')[0]);
    setFormJustification('');
    setFormSpecifications('');
    setFormVendorSuggestion('');
    setFormProjectCode('');
    setFormProjectName('');
    setFormRequestNo('');
    setFormNotes('');
    setFormAttachments([]);
    setFormItems([]);
  };

  const handleOpenCreate = async () => {
    resetForm();
    setIsCreateOpen(true);
    const documentType = isIT ? 'it_requirement' : 'mr';
    try {
      const result = await generateDocumentNumber({ document_type: documentType }).unwrap();
      setFormRequestNo(result.document_number);
    } catch {
      showError(`Failed to generate request number. Please configure document numbering for ${documentType}.`);
    }
  };

  const handleOpenEdit = (item: RequirementItem) => {
    setEditingItem(item);
    if (!isIT) {
      setFormCategory(item.category);
      setFormQuantity(item.quantity);
      setFormUnit(item.unit);
      setFormUnitCost(item.estimated_unit_cost);
      setFormPriority(item.priority);
      setFormStatus(item.status);
      setFormDepartment(item.department);
      setFormRequestedBy(item.requested_by);
      setFormRequiredByDate(item.required_by_date);
      setFormJustification(item.justification);
      setFormSpecifications(item.specifications);
      setFormVendorSuggestion(item.vendor_suggestion || '');
      setFormRequestNo(item.request_no || '');
      setFormRequestDate(item.request_date || new Date().toISOString().split('T')[0]);
      setFormRequesterName(item.requester_name || '');
      setFormApprover(item.approver || '');
      setFormProjectCode(item.project_code || '');
      setFormProjectName(item.project_name || '');
      setFormItems(item.material_items || []);
    }
    setIsCreateOpen(true);
  };

  // Save IT Requirement from modal
  const handleSaveITRequirement = (payload: Partial<RequirementItem>, isDraft: boolean) => {
    const requestNo = formRequestNo.trim() || `REQ-IT-${requirements.length + 1}`;
    if (editingItem) {
      setRequirements((prev) =>
        prev.map((r) =>
          r.id === editingItem.id
            ? {
                ...r,
                ...payload,
                request_no: requestNo,
                title: payload.title || r.title,
                status: isDraft ? 'DRAFT' : payload.status || r.status,
              }
            : r,
        ),
      );
      showSuccess(`Updated ${editingItem.id} successfully`);
    } else {
      const newId = requestNo;
      const newItem: RequirementItem = {
        id: newId,
        type: 'IT',
        title: payload.title || 'Untitled Request',
        category: payload.category || 'New Feature / Module',
        quantity: 1,
        unit: 'System Request',
        estimated_unit_cost: 0,
        total_cost: 0,
        priority: payload.priority || 'MEDIUM',
        status: isDraft ? 'DRAFT' : payload.status || 'SUBMITTED',
        department: payload.department || 'Operations',
        requested_by: payload.requested_by || loggedUser?.full_name || 'Admin User',
        required_by_date: payload.required_by_date || new Date().toISOString().split('T')[0],
        justification: payload.justification || '',
        specifications: payload.specifications || '',
        request_no: requestNo,
        created_at: new Date().toISOString(),
        ...payload,
      };

      setRequirements((prev) => [newItem, ...prev]);
      showSuccess(`${isDraft ? 'Saved draft' : 'Created request'} ${newId} successfully`);
    }

    setIsCreateOpen(false);
    setEditingItem(null);
  };

  // Material requisition item line helpers
  const addItemRow = () => {
    const nextSNo = formItems.length + 1;
    const newRow: MaterialRequisitionItem = {
      s_no: nextSNo,
      material_service_code: '',
      item_description: '',
      drawing_specs_yn: 'N',
      hsn_sac: '',
      uom: 'Nos',
      qty: 1,
      rate: 0,
      budget_amount: 0,
      amount: 0,
      remarks: '',
    };
    setFormItems([...formItems, newRow]);
  };

  const removeItemRow = (index: number) => {
    const next = formItems.filter((_, i) => i !== index).map((row, i) => ({ ...row, s_no: i + 1 }));
    setFormItems(next);
  };

  // Attachment upload handler
  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newAttachments: AttachmentFile[] = Array.from(files).map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      size: f.size,
      type: f.type,
      uploaded_at: new Date().toISOString(),
      uploaded_by: 'Current User',
    }));
    setFormAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const updateItemField = (index: number, field: keyof MaterialRequisitionItem, value: any) => {
    const next = [...formItems];
    const row = { ...next[index], [field]: value };
    // Recalculate amount when qty/rate changes
    if (field === 'qty' || field === 'rate') {
      row.amount = Number(row.qty) * Number(row.rate);
    }
    next[index] = row;
    setFormItems(next);
  };

  const totalItemsAmount = formItems.reduce((acc, row) => acc + (row.amount || 0), 0);

  // Save Material Requirement from standard dialog
  const handleSaveMaterialRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formItems.length === 0) {
      showError('Please add at least one item line');
      return;
    }

    const requestNo = formRequestNo.trim();
    if (!requestNo) {
      showError('Request number is not available yet. Please wait or reopen the form.');
      return;
    }

    const calculatedTotal = formQuantity * formUnitCost;

    if (editingItem) {
      setRequirements((prev) =>
        prev.map((r) =>
          r.id === editingItem.id
            ? {
                ...r,
                title: requestNo,
                category: formCategory || categoryOptions[0],
                quantity: Number(formQuantity),
                unit: formUnit.trim(),
                estimated_unit_cost: Number(formUnitCost),
                total_cost: calculatedTotal,
                priority: formPriority,
                status: formStatus,
                department: formDepartment,
                requested_by: formRequestedBy.trim(),
                required_by_date: formRequiredByDate,
                justification: formJustification.trim(),
                specifications: formSpecifications.trim(),
                vendor_suggestion: formVendorSuggestion.trim(),
                request_no: requestNo,
                request_date: formRequestDate,
                requester_name: formRequesterName,
                approver: formApprover,
                project_code: formProjectCode.trim() || undefined,
                project_name: formProjectName.trim() || undefined,
                material_items: formItems,
              }
            : r,
        ),
      );
      showSuccess(`Updated ${editingItem.id} successfully`);
    } else {
      const prefix = 'REQ-MAT';
      const maxId = requirements.reduce((max, r) => {
        if (!r.id.startsWith('REQ-MAT')) return max;
        const parts = r.id.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        return !isNaN(num) && num > max ? num : max;
      }, 0);

      const newId = `${prefix}-${maxId + 1}`;
      const newItem: RequirementItem = {
        id: newId,
        type: 'MATERIAL',
        title: requestNo,
        category: formCategory || categoryOptions[0],
        quantity: Number(formQuantity),
        unit: formUnit.trim(),
        estimated_unit_cost: Number(formUnitCost),
        total_cost: calculatedTotal,
        priority: formPriority,
        status: formStatus,
        department: formDepartment,
        requested_by: formRequestedBy.trim(),
        required_by_date: formRequiredByDate,
        justification: formJustification.trim(),
        specifications: formSpecifications.trim(),
        vendor_suggestion: formVendorSuggestion.trim(),
        request_no: requestNo,
        request_date: formRequestDate,
        requester_name: formRequesterName,
        approver: formApprover,
        project_code: formProjectCode.trim() || undefined,
        project_name: formProjectName.trim() || undefined,
        material_items: formItems,
        created_at: new Date().toISOString(),
      };

      setRequirements((prev) => [newItem, ...prev]);
      showSuccess(`Created requisition ${newId} successfully`);
    }

    setIsCreateOpen(false);
    resetForm();
  };

  const handleDeleteItem = (id: string) => {
    if (window.confirm(`Are you sure you want to delete requisition ${id}?`)) {
      setRequirements((prev) => prev.filter((item) => item.id !== id));
      showSuccess(`Requisition ${id} deleted`);
      if (selectedDetailItem?.id === id) {
        setSelectedDetailItem(null);
      }
    }
  };

  const handleUpdateStatus = (id: string, newStatus: string, rejectionReason?: string) => {
    setRequirements((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: newStatus,
              rejection_reason: rejectionReason || r.rejection_reason,
            }
          : r,
      ),
    );
    if (selectedDetailItem?.id === id) {
      setSelectedDetailItem((prev) =>
        prev
          ? {
              ...prev,
              status: newStatus,
              rejection_reason: rejectionReason || prev.rejection_reason,
            }
          : null,
      );
    }
    showSuccess(`Updated ${id} status to ${newStatus.replace('_', ' ')}`);
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', minWidth: 0, px: 0, py: 0.5, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* ── Sub-menu Navigation Tabs ────────────────────────────────────────── */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant={!isIT ? 'contained' : 'text'}
            startIcon={<Package size={18} />}
            onClick={() => navigate('/requirements/material')}
            sx={{
              bgcolor: !isIT ? '#04552B' : 'transparent',
              color: !isIT ? '#ffffff' : 'text.secondary',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '14px',
              borderRadius: '8px 8px 0 0',
              px: 2.5,
              py: 1,
              '&:hover': { bgcolor: !isIT ? '#034120' : 'action.hover' },
            }}
          >
            Material Requirement
          </Button>

          <Button
            variant={isIT ? 'contained' : 'text'}
            startIcon={<Laptop size={18} />}
            onClick={() => navigate('/requirements/it')}
            sx={{
              bgcolor: isIT ? '#04552B' : 'transparent',
              color: isIT ? '#ffffff' : 'text.secondary',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '14px',
              borderRadius: '8px 8px 0 0',
              px: 2.5,
              py: 1,
              '&:hover': { bgcolor: isIT ? '#034120' : 'action.hover' },
            }}
          >
            IT Requirement
          </Button>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<Plus size={16} />}
            onClick={handleOpenCreate}
            sx={{ bgcolor: '#04552B', '&:hover': { bgcolor: '#034120' }, borderRadius: '8px', textTransform: 'none', fontWeight: 600, px: 2 }}
          >
            {isIT ? 'New Request' : 'New Requisition'}
          </Button>
        </Box>
      </Box>

      {/* ── KPI Stat Cards ──────────────────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 600, fontSize: 13 }}>
                {isIT ? 'Total Requests' : 'Total Requisitions'}
              </Typography>
              <Box sx={{ p: 0.8, borderRadius: '8px', bgcolor: '#F1F5F9', color: '#475569' }}>
                <ClipboardList size={18} />
              </Box>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary' }}>
              {totalCount}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 600, fontSize: 13 }}>
                Pending / Draft
              </Typography>
              <Box sx={{ p: 0.8, borderRadius: '8px', bgcolor: '#FEF3C7', color: '#D97706' }}>
                <Clock size={18} />
              </Box>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#D97706' }}>
              {pendingCount}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 600, fontSize: 13 }}>
                {isIT ? 'In Processing / Review' : 'Approved / Procuring'}
              </Typography>
              <Box sx={{ p: 0.8, borderRadius: '8px', bgcolor: '#DBEAFE', color: '#1D4ED8' }}>
                <CheckCircle2 size={18} />
              </Box>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#1D4ED8' }}>
              {approvedCount}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 600, fontSize: 13 }}>
                {isIT ? 'Completed Requests' : 'Est. Total Investment'}
              </Typography>
              <Box sx={{ p: 0.8, borderRadius: '8px', bgcolor: '#DCFCE7', color: '#15803D' }}>
                {isIT ? <CheckCircle2 size={18} /> : <DollarSign size={18} />}
              </Box>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#15803D' }}>
              {isIT ? fulfilledCount : `₹${totalCostEstimate.toLocaleString()}`}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* ── Toolbar & Filter Controls ────────────────────────────────────────── */}
      <Paper elevation={0} sx={{ p: 2, mb: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder={`Search ${reqType.toLowerCase()} requests by Title, ID, Department...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} color="#64748B" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid item xs={12} sm={4} md={2.5}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                <MenuItem value="ALL">All Statuses</MenuItem>
                <MenuItem value="DRAFT">Draft</MenuItem>
                <MenuItem value="SUBMITTED">Submitted</MenuItem>
                <MenuItem value="MANAGER_APPROVAL">Manager Approval</MenuItem>
                <MenuItem value="IT_MANAGER_REVIEW">IT Manager Review</MenuItem>
                <MenuItem value="DEPT_HEAD_APPROVAL">Dept Head Approval</MenuItem>
                <MenuItem value="IT_PROCESSING">IT Processing</MenuItem>
                <MenuItem value="COMPLETED">Completed</MenuItem>
                <MenuItem value="REJECTED">Rejected</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4} md={2.5}>
            <FormControl fullWidth size="small">
              <InputLabel>{isIT ? 'Urgency / Priority' : 'Priority'}</InputLabel>
              <Select value={priorityFilter} label="Priority" onChange={(e) => setPriorityFilter(e.target.value)}>
                <MenuItem value="ALL">All Priorities</MenuItem>
                <MenuItem value="CRITICAL">ASAP / Critical</MenuItem>
                <MenuItem value="HIGH">High / Within 2 Weeks</MenuItem>
                <MenuItem value="MEDIUM">Medium / Within 1 Month</MenuItem>
                <MenuItem value="LOW">Low / Can Wait</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Department</InputLabel>
              <Select value={departmentFilter} label="Department" onChange={(e) => setDepartmentFilter(e.target.value)}>
                <MenuItem value="ALL">All Departments</MenuItem>
                <MenuItem value="Operations">Operations</MenuItem>
                <MenuItem value="IT">IT & Infrastructure</MenuItem>
                <MenuItem value="Engineering">Engineering</MenuItem>
                <MenuItem value="Finance">Finance</MenuItem>
                <MenuItem value="HR">HR & Admin</MenuItem>
                <MenuItem value="Sales">Sales & Marketing</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* ── Main Data Table / Empty State ───────────────────────────────────── */}
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper', flex: 1 }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: 'background.default' }}>
            <TableRow>
              <ErpSortHeaderCell variant="mui" field="title" label="Requirement Title" sortState={sortState} onSort={handleSort} sx={{ py: 1.5 }} />
              <ErpSortHeaderCell variant="mui" field="requester_name" label="Requester Name" sortState={sortState} onSort={handleSort} />
              {!isIT && <ErpSortHeaderCell variant="mui" field="quantity" label="Qty & Unit" sortState={sortState} onSort={handleSort} />}
              {!isIT && <ErpSortHeaderCell variant="mui" field="total_cost" label="Est. Cost (₹)" sortState={sortState} onSort={handleSort} />}
              <ErpSortHeaderCell variant="mui" field="department" label="Department" sortState={sortState} onSort={handleSort} />
              <ErpSortHeaderCell variant="mui" field="required_by_date" label={isIT ? 'Preferred Go-Live' : 'Required By'} sortState={sortState} onSort={handleSort} />
              <ErpSortHeaderCell variant="mui" field="priority" label={isIT ? 'Urgency' : 'Priority'} sortState={sortState} onSort={handleSort} />
              <ErpSortHeaderCell variant="mui" field="status" label="Status" sortState={sortState} onSort={handleSort} />
              <ErpSortHeaderCell variant="mui" label="Actions" align="right" sortable={false} />
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedItems.map((item) => (
              <RequirementRow
                key={item.id}
                item={item}
                isIT={isIT}
                setSelectedDetailItem={setSelectedDetailItem}
                handleOpenEdit={handleOpenEdit}
                handleDeleteItem={handleDeleteItem}
              />
            ))}

            {/* Clean Empty State Message */}
            {filteredItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
                    <Box sx={{ p: 2, borderRadius: '50%', bgcolor: 'action.hover', color: '#04552B' }}>
                      {reqType === 'IT' ? <Laptop size={36} /> : <Package size={36} />}
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                      No {reqType === 'IT' ? 'IT' : 'Material'} Requisitions Found
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ maxWidth: 420 }}>
                      There are no {reqType.toLowerCase()} requirements raised matching your filters. Click below to add your first request.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<Plus size={16} />}
                      onClick={handleOpenCreate}
                      sx={{ bgcolor: '#04552B', '&:hover': { bgcolor: '#034120' }, mt: 1, textTransform: 'none', fontWeight: 600 }}
                    >
                      {reqType === 'IT' ? 'Create IT Request' : 'Create Requisition'}
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── IT Requirement Request Modal (When active tab is IT) ───────────── */}
      {isIT && (
        <ITRequirementFormModal
          open={isCreateOpen}
          onClose={() => {
            setIsCreateOpen(false);
            setEditingItem(null);
          }}
          onSave={handleSaveITRequirement}
          editingItem={editingItem}
          currentUser={{
            name: loggedUser?.full_name || 'Admin User',
            designation: loggedUser?.role || 'Manager',
            department: 'Operations',
          }}
        />
      )}

      {/* ── IT Requirement Detail Drawer (When active tab is IT) ──────────── */}
      {isIT && (
        <ITRequirementDetailDrawer
          item={selectedDetailItem}
          open={Boolean(selectedDetailItem)}
          onClose={() => setSelectedDetailItem(null)}
          onEdit={handleOpenEdit}
          onDelete={handleDeleteItem}
          onUpdateStatus={handleUpdateStatus}
        />
      )}

      {/* ── Legacy Material Requirement Modal (When active tab is Material) ── */}
      {!isIT && (
        <Dialog
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          maxWidth="xl"
          sx={{
            '& .MuiDialog-container': {
              alignItems: 'center',
              justifyContent: 'center',
            },
          }}
          PaperProps={{
            sx: {
              width: '100%',
              maxWidth: { xs: '100%', sm: 1150 },
              m: { xs: 1, sm: 2 },
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 24px 80px rgba(15, 23, 42, 0.22)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            },
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <form onSubmit={handleSaveMaterialRequirement}>
              <Box
              sx={{
                px: { xs: 2.5, sm: 3.5 },
                py: 1.5,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid',
                borderColor: 'divider',
                flexShrink: 0,
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Material / Service Request No
                </Typography>
                <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 700 }}>
                  {formRequestNo || 'Generating…'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  onClick={() => setIsCreateOpen(false)}
                  size="small"
                  sx={{ color: 'text.secondary', px: 1.5 }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  size="small"
                  sx={{
                    bgcolor: '#04552B',
                    '&:hover': { bgcolor: '#034120' },
                    px: 2,
                    py: 0.75,
                    borderRadius: 2,
                    fontWeight: 700,
                    boxShadow: 'none',
                    textTransform: 'none',
                  }}
                >
                  {editingItem ? 'Save Changes' : 'Submit Requisition'}
                </Button>
              </Box>
            </Box>
            <DialogContent
              sx={{
                px: { xs: 2.5, sm: 3.5 },
                py: 2.5,
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 2.5,
              }}
            >
              <Grid container spacing={2}>
                {/* Both date fields together in same row, matching styling */}
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Material / Service Request Date
                    </Typography>
                    <Box
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        height: 40,
                        px: 1.25,
                        display: 'flex',
                        alignItems: 'center',
                        '&:hover': { borderColor: 'text.primary' },
                      }}
                    >
                      <StandardDateInput
                        value={formRequestDate}
                        onChange={(value) => setFormRequestDate(value || '')}
                        placeholder="dd-mm-yyyy"
                        sx={{ width: '100%', py: 0 }}
                      />
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Requested Date
                    </Typography>
                    <Box
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        height: 40,
                        px: 1.25,
                        display: 'flex',
                        alignItems: 'center',
                        '&:hover': { borderColor: 'text.primary' },
                      }}
                    >
                      <StandardDateInput
                        value={formRequiredByDate}
                        onChange={(value) => setFormRequiredByDate(value || '')}
                        placeholder="dd-mm-yyyy"
                        sx={{ width: '100%', py: 0 }}
                      />
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Name (Requester)"
                    value={formRequesterName}
                    InputProps={{ readOnly: true }}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'action.hover' } }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Department"
                    value={formDepartment}
                    InputProps={{ readOnly: true }}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'action.hover' } }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Approver (Requester's Manager)"
                    value={formApprover}
                    InputProps={{ readOnly: true }}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'action.hover' } }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Project Code"
                    value={formProjectCode}
                    onChange={(e) => setFormProjectCode(e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Project Name"
                    value={formProjectName}
                    onChange={(e) => setFormProjectName(e.target.value)}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 1 }} />
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Item Lines
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Add each material / service line item. Amount is calculated as Qty × Rate.
                </Typography>
              </Box>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', mb: 1, flexShrink: 0 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'background.default' }}>
                    <TableRow>
                      <TableCell sx={{ width: 40 }} />
                      <TableCell>Material / Service Code</TableCell>
                      <TableCell>Item &amp; Description</TableCell>
                      <TableCell sx={{ minWidth: 75, maxWidth: 95, whiteSpace: 'normal', lineHeight: 1.1 }}>
                        Data Sheet*
                      </TableCell>
                      <TableCell sx={{ minWidth: 70 }}>HSN / SAC</TableCell>
                      <TableCell sx={{ minWidth: 60 }}>UOM</TableCell>
                      <TableCell sx={{ minWidth: 60 }}>Qty</TableCell>
                      <TableCell sx={{ minWidth: 70 }}>Rate (₹)</TableCell>
                      <TableCell sx={{ minWidth: 80 }}>Budget Amount (₹)</TableCell>
                      <TableCell sx={{ minWidth: 70 }}>Amount (₹)</TableCell>
                      <TableCell>Remarks</TableCell>
                      <TableCell align="right" sx={{ width: 52 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {formItems.map((row, index) => (
                      <TableRow key={index} sx={{ '&:last-child td, &:last-child th': { borderBottom: 0 } }}>
                        <TableCell sx={{ fontWeight: 700, color: '#64748B' }}>{row.s_no}</TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            value={row.material_service_code}
                            onChange={(e) => updateItemField(index, 'material_service_code', e.target.value)}
                            sx={{ m: -1.5 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            value={row.item_description}
                            onChange={(e) => updateItemField(index, 'item_description', e.target.value)}
                            sx={{ m: -1.5 }}
                          />
                        </TableCell>
                        <TableCell>
                          <FormControl fullWidth size="small" sx={{ m: -1.5 }}>
                            <Select
                              value={row.drawing_specs_yn === 'Y' ? 'Yes' : 'No'}
                              onChange={(e) => updateItemField(index, 'drawing_specs_yn', (e.target.value === 'Yes' ? 'Y' : 'N') as 'Y' | 'N')}
                              displayEmpty
                            >
                              <MenuItem value="Y">Yes</MenuItem>
                              <MenuItem value="N">No</MenuItem>
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            value={row.hsn_sac}
                            onChange={(e) => updateItemField(index, 'hsn_sac', e.target.value)}
                            sx={{ m: -1.5 }}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 70, maxWidth: 90 }}>
                          <FormControl fullWidth size="small" sx={{ m: -1.5, minWidth: 60 }}>
                            <Select
                              value={uomOptions.some((option) => option.value === row.uom) ? row.uom : 'Nos'}
                              disabled={uomsLoading || uomOptions.length === 0}
                              displayEmpty
                              renderValue={(value) =>
                                value || (uomsLoading ? 'Loading…' : 'Configure UOM')
                              }
                              onChange={(e) => updateItemField(index, 'uom', e.target.value)}
                              sx={{ '& .MuiSelect-select': { minWidth: 60, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' } }}
                            >
                              {uomOptions.map((option) => (
                                <MenuItem key={option.id} value={option.value}>
                                  {option.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            value={row.qty}
                            onChange={(e) => updateItemField(index, 'qty', Number(e.target.value || 0))}
                            sx={numberFieldSx}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            value={row.rate}
                            onChange={(e) => updateItemField(index, 'rate', Number(e.target.value || 0))}
                            sx={numberFieldSx}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            value={row.budget_amount}
                            onChange={(e) => updateItemField(index, 'budget_amount', Number(e.target.value || 0))}
                            sx={numberFieldSx}
                          />
                        </TableCell>
                        <TableCell
                          sx={{ fontWeight: 700, color: '#04552B' }}
                        >
                          ₹{(row.amount || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            value={row.remarks}
                            onChange={(e) => updateItemField(index, 'remarks', e.target.value)}
                            sx={{ m: -1.5 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => removeItemRow(index)}
                            sx={{ color: '#DC2626', p: 0.5 }}
                            title="Remove row"
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 0.5, mb: 1, flexShrink: 0 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Plus size={14} />}
                  onClick={addItemRow}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Add Item Line
                </Button>
                {formItems.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.4, ml: 1 }}>
                    Total: ₹{totalItemsAmount.toLocaleString()}
                  </Typography>
                )}
              </Box>

              {/* Notes / Purpose + Attachment */}
              <Grid container spacing={2} sx={{ mb: 1 }}>
                <Grid item xs={12} md={8}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
                      Notes / Purpose
                    </Typography>
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    rows={2}
                    label="Notes / Purpose"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
                      Attachment
                    </Typography>
                  </Box>
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, height: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: 'pointer', '&:hover': { borderColor: '#04552B', bgcolor: '#f0fdf4' } }}>
                    <Paperclip size={20} color="#04552B" />
                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', fontWeight: 600 }}>
                      Add Attachment
                    </Typography>
                    <input type="file" hidden accept="image/*,.pdf,.doc,.docx" onChange={handleAttachmentUpload} />
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
          </form>
          </Box>
        </Dialog>
      )}

      {/* ── Legacy Material Detail Drawer (When active tab is Material) ────── */}
      {!isIT && (
        <Drawer anchor="right" open={Boolean(selectedDetailItem)} onClose={() => setSelectedDetailItem(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 520 }, p: 3 } }}>
          {selectedDetailItem && (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Typography variant="overline" sx={{ fontWeight: 800, color: '#04552B', letterSpacing: 1 }}>
                    {selectedDetailItem.id} • MATERIAL REQUISITION
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                    {selectedDetailItem.title}
                  </Typography>
                </Box>
                <IconButton onClick={() => setSelectedDetailItem(null)} size="small">
                  <XCircle size={20} />
                </IconButton>
              </Box>

              <Divider sx={{ mb: 2.5 }} />

              <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
                {getStatusChip(selectedDetailItem.status)}
                {getPriorityChip(selectedDetailItem.priority)}
                <Chip label={selectedDetailItem.category} size="small" variant="outlined" />
              </Box>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Quantity</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {selectedDetailItem.quantity} {selectedDetailItem.unit}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Est. Total Cost</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#15803D' }}>
                    ₹{(selectedDetailItem.total_cost || 0).toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Request No</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                    {selectedDetailItem.request_no || '—'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Request Date</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{formatDate(selectedDetailItem.request_date)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Department</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{selectedDetailItem.department}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Requested By</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{selectedDetailItem.requested_by}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Approver</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{selectedDetailItem.approver || '—'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Project Code / Name</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {selectedDetailItem.project_code || '—'}{selectedDetailItem.project_name ? ` • ${selectedDetailItem.project_name}` : ''}
                  </Typography>
                </Grid>
              </Grid>

              {selectedDetailItem.material_items && selectedDetailItem.material_items.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="textSecondary" sx={{ mb: 1 }}>
                    Item Lines
                  </Typography>
                  <Table size="small">
                    <TableBody>
                      {selectedDetailItem.material_items.map((row) => (
                        <TableRow key={row.s_no} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                          <TableCell sx={{ width: 40, fontWeight: 700, color: '#64748B' }}>{row.s_no}</TableCell>
                          <TableCell sx={{ fontWeight: 600, minWidth: 120 }}>{row.item_description}</TableCell>
                          <TableCell sx={{ minWidth: 70 }}>{row.qty} {row.uom}</TableCell>
                          <TableCell sx={{ minWidth: 70 }}>₹{(row.rate || 0).toLocaleString()}</TableCell>
                          <TableCell sx={{ minWidth: 70, fontWeight: 700, color: '#04552B' }}>
                            ₹{(row.amount || 0).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}

              <Box sx={{ mt: 'auto', pt: 2, display: 'flex', gap: 1.5 }}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Edit3 size={16} />}
                  onClick={() => {
                    const item = selectedDetailItem;
                    setSelectedDetailItem(null);
                    handleOpenEdit(item);
                  }}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
                >
                  Edit Requisition
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  fullWidth
                  startIcon={<Trash2 size={16} />}
                  onClick={() => handleDeleteItem(selectedDetailItem.id)}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
                >
                  Delete
                </Button>
              </Box>
            </Box>
          )}
        </Drawer>
      )}
    </Box>
  );
}
