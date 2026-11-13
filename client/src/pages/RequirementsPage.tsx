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
} from '@mui/material';
import {
  ClipboardList,
  Package,
  Laptop,
  Plus,
  Search,
  Download,
  Trash2,
  Edit3,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  DollarSign,
  X,
} from 'lucide-react';
import { useTableSort } from '../hooks/useTableSort';
import ErpSortHeaderCell from '../components/ui/ErpSortHeaderCell';
import { useToast } from '@/components/ui/ToastHost';
import { formatDate } from '@/utils/format';
import { useAppSelector } from '../app/hooks';
import { RequirementItem, MaterialRequisitionItem } from '@/types/requirements';
import ITRequirementFormModal from '@/components/requirements/ITRequirementFormModal';
import ITRequirementDetailDrawer from '@/components/requirements/ITRequirementDetailDrawer';
import { useDatabaseStoredState } from '@/hooks/useDatabaseStoredState';
import { useGetUsersQuery } from '@/api/rbacApi';
import {
  useGenerateDocumentNumberMutation,
  usePreviewDocumentNumberMutation,
} from '@/api/documentNumberingApi';

export default function RequirementsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const loggedUser = useAppSelector((state) => state.auth.user);

  // Active tab check
  const isIT = location.pathname.includes('/requirements/it');
  const reqType: 'MATERIAL' | 'IT' = isIT ? 'IT' : 'MATERIAL';

  const [requirements, setRequirements] = useDatabaseStoredState<RequirementItem[]>(
    'crm_requirements_items_data',
    [],
  );

  // RBAC users from Settings > Users (auto-fetch department & approver for requester)
  const { data: usersData } = useGetUsersQuery({ page: 1, page_size: 100 });
  const rbacUsers: any[] = usersData?.items || [];
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
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formQuantity, setFormQuantity] = useState<number>(1);
  const [formUnit, setFormUnit] = useState('Pcs');
  const [formUnitCost, setFormUnitCost] = useState<number>(0);
  const [formPriority, setFormPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [formStatus, setFormStatus] = useState<string>('PENDING');
  const [formDepartment, setFormDepartment] = useState('Operations');
  const [formRequestedBy, setFormRequestedBy] = useState('Admin User');
  const [formRequiredByDate, setFormRequiredByDate] = useState(new Date().toISOString().split('T')[0]);
  const [formJustification, setFormJustification] = useState('');
  const [formSpecifications, setFormSpecifications] = useState('');
  const [formVendorSuggestion, setFormVendorSuggestion] = useState('');

  // Material requisition header fields
  const [formRequestNo, setFormRequestNo] = useState('');
  const [formRequestDate, setFormRequestDate] = useState(new Date().toISOString().split('T')[0]);
  const [formRequesterName, setFormRequesterName] = useState('');
  const [formApprover, setFormApprover] = useState('');
  const [formProjectCode, setFormProjectCode] = useState('');
  const [formProjectName, setFormProjectName] = useState('');

  // Material requisition item lines
  const [formItems, setFormItems] = useState<MaterialRequisitionItem[]>([]);

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

  // Auto-populate header fields from auth + RBAC users (Settings > Users)
  const populateHeaderDefaults = useCallback(() => {
    const requesterName = loggedUser?.full_name || '';
    setFormRequesterName(requesterName);
    setFormRequestedBy(requesterName || 'Admin User');
    setFormRequestDate(new Date().toISOString().split('T')[0]);

    // Look up requester in RBAC users to get department & approver (manager)
    const user = rbacUsers.find(
      (e: any) => e.full_name === requesterName || e.email === loggedUser?.email,
    );
    setFormDepartment(user?.primary_department_name || '');
    setFormApprover(user?.reporting_manager_name || '');
  }, [loggedUser, rbacUsers]);

  // Re-populate department & approver when RBAC users data loads asynchronously
  useEffect(() => {
    if (!rbacUsers || rbacUsers.length === 0) return;
    if (!loggedUser) return;
    populateHeaderDefaults();
  }, [rbacUsers, loggedUser, populateHeaderDefaults]);

  // Form Reset for Material
  const resetForm = () => {
    setEditingItem(null);
    setFormTitle('');
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
    setFormItems([]);
  };

  const handleOpenCreate = async () => {
    resetForm();
    setIsCreateOpen(true);
    try {
      const result = await generateDocumentNumber({ document_type: 'material_requisition' }).unwrap();
      setFormRequestNo(result.document_number);
    } catch {
      showError('Failed to generate request number. Please configure document numbering for material_requisition.');
    }
  };

  const handleOpenEdit = (item: RequirementItem) => {
    setEditingItem(item);
    if (!isIT) {
      setFormTitle(item.title);
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
    if (editingItem) {
      setRequirements((prev) =>
        prev.map((r) =>
          r.id === editingItem.id
            ? {
                ...r,
                ...payload,
                status: isDraft ? 'DRAFT' : payload.status || r.status,
              }
            : r,
        ),
      );
      showSuccess(`Updated ${editingItem.id} successfully`);
    } else {
      const prefix = 'REQ-IT';
      const maxId = requirements.reduce((max, r) => {
        if (!r.id.startsWith('REQ-IT')) return max;
        const parts = r.id.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        return !isNaN(num) && num > max ? num : max;
      }, 0);

      const newId = `${prefix}-${maxId + 1}`;
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
      uom: 'Pcs',
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
                title: formTitle.trim(),
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
                request_no: formRequestNo.trim() || undefined,
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
        title: formTitle.trim(),
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
        request_no: formRequestNo.trim() || undefined,
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

  const handleExportCSV = () => {
    if (filteredItems.length === 0) {
      showError('No items available to export');
      return;
    }

    const headers = isIT
      ? ['Request ID', 'Title', 'Type', 'Department', 'Requested By', 'Urgency', 'Preferred Go-Live Date', 'Status', 'Created At']
      : ['ID', 'Type', 'Title', 'Category', 'Quantity', 'Unit', 'Unit Cost', 'Total Cost', 'Priority', 'Status', 'Department', 'Requested By', 'Required By Date'];

    const rows = filteredItems.map((i) =>
      isIT
        ? [
            i.id,
            `"${i.title.replace(/"/g, '""')}"`,
            `"${i.requirement_type || i.category}"`,
            `"${i.department}"`,
            `"${i.requested_by}"`,
            `"${i.urgency || i.priority}"`,
            i.preferred_go_live_date || i.required_by_date,
            i.status,
            i.created_at,
          ]
        : [
            i.id,
            i.type,
            `"${i.title.replace(/"/g, '""')}"`,
            `"${i.category}"`,
            i.quantity,
            i.unit,
            i.estimated_unit_cost,
            i.total_cost,
            i.priority,
            i.status,
            i.department,
            `"${i.requested_by}"`,
            i.required_by_date,
          ],
    );

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${reqType.toLowerCase()}_requirements_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess(`Exported ${filteredItems.length} requisitions to CSV`);
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
            variant="outlined"
            size="small"
            startIcon={<Download size={16} />}
            onClick={handleExportCSV}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, borderColor: 'divider', color: 'text.primary' }}
          >
            Export CSV
          </Button>
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
              <ErpSortHeaderCell variant="mui" field="id" label={isIT ? 'Request ID' : 'Requisition ID'} sortState={sortState} onSort={handleSort} sx={{ py: 1.5 }} />
              <ErpSortHeaderCell variant="mui" field="title" label="Requirement Title" sortState={sortState} onSort={handleSort} />
              <ErpSortHeaderCell variant="mui" field="category" label={isIT ? 'Requirement Type' : 'Category'} sortState={sortState} onSort={handleSort} />
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
              <TableRow key={item.id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelectedDetailItem(item)}>
                <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#04552B' }}>
                  {item.id}
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{item.title}</TableCell>
                <TableCell>
                  <Chip label={item.requirement_type || item.category} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.7rem' }} />
                </TableCell>
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
                  <Tooltip title="View Details">
                    <IconButton size="small" onClick={() => setSelectedDetailItem(item)}>
                      <Eye size={16} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => handleOpenEdit(item)} sx={{ color: '#2563EB' }}>
                      <Edit3 size={16} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => handleDeleteItem(item.id)} sx={{ color: '#DC2626' }}>
                      <Trash2 size={16} />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}

            {/* Clean Empty State Message */}
            {filteredItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 8 }}>
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
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 24px 80px rgba(15, 23, 42, 0.22)',
              overflow: 'hidden',
            },
          }}
        >
          <form onSubmit={handleSaveMaterialRequirement}>
            <Box
              sx={{
                px: { xs: 2.5, sm: 3.5 },
                py: 1.5,
                display: 'flex',
                justifyContent: 'flex-end',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <IconButton
                aria-label="Close requisition form"
                onClick={() => setIsCreateOpen(false)}
                size="small"
                sx={{ color: 'text.secondary' }}
              >
                <X size={19} />
              </IconButton>
            </Box>
            <DialogContent sx={{ px: { xs: 2.5, sm: 3.5 }, py: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Material / Service Request No
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'text.primary', mt: 0.25 }}>
                      {formRequestNo || 'Generating…'}
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Material / Service Request Date"
                    type="date"
                    value={formRequestDate}
                    InputProps={{ readOnly: true }}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'action.hover' } }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Name (Requester)"
                    value={formRequesterName}
                    InputProps={{ readOnly: true }}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'action.hover' } }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Department"
                    value={formDepartment}
                    InputProps={{ readOnly: true }}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'action.hover' } }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Approver (Requester's Manager)"
                    value={formApprover}
                    InputProps={{ readOnly: true }}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'action.hover' } }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Project Code"
                    value={formProjectCode}
                    onChange={(e) => setFormProjectCode(e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Project Name"
                    value={formProjectName}
                    onChange={(e) => setFormProjectName(e.target.value)}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Item Lines
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Add each material / service line item. Amount is calculated as Qty × Rate.
                </Typography>
              </Box>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', mb: 1 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'background.default' }}>
                    <TableRow>
                      <TableCell sx={{ width: 40 }} />
                      <TableCell>Material / Service Code</TableCell>
                      <TableCell>Item &amp; Description</TableCell>
                      <TableCell sx={{ minWidth: 80 }}>Drawing / Specs (Y/N)</TableCell>
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
                              value={row.drawing_specs_yn}
                              onChange={(e) => updateItemField(index, 'drawing_specs_yn', e.target.value as 'Y' | 'N')}
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
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            value={row.uom}
                            onChange={(e) => updateItemField(index, 'uom', e.target.value)}
                            sx={{ m: -1.5 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            value={row.qty}
                            onChange={(e) => updateItemField(index, 'qty', Number(e.target.value || 0))}
                            sx={{ m: -1.5 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            value={row.rate}
                            onChange={(e) => updateItemField(index, 'rate', Number(e.target.value || 0))}
                            sx={{ m: -1.5 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            value={row.budget_amount}
                            onChange={(e) => updateItemField(index, 'budget_amount', Number(e.target.value || 0))}
                            sx={{ m: -1.5 }}
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
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 0.5, mb: 1 }}>
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
            </DialogContent>
            <DialogActions
              sx={{
                px: { xs: 2.5, sm: 3.5 },
                py: 2,
                gap: 1,
                borderTop: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
              }}
            >
              <Button onClick={() => setIsCreateOpen(false)} sx={{ color: 'text.secondary', px: 2 }}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                sx={{
                  bgcolor: '#04552B',
                  '&:hover': { bgcolor: '#034120' },
                  px: 2.5,
                  py: 1,
                  borderRadius: 2,
                  fontWeight: 700,
                  boxShadow: 'none',
                }}
              >
                {editingItem ? 'Save Changes' : 'Submit Requisition'}
              </Button>
            </DialogActions>
          </form>
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
