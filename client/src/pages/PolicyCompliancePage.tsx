import React, { useState, useEffect, useMemo } from 'react';
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
  ShieldCheck,
  ClipboardCheck,
  BookOpen,
  CheckCircle2,
  Plus,
  Search,
  Download,
  Trash2,
  Edit3,
  Eye,
  Clock,
  AlertTriangle,
  XCircle,
  FileText,
  Building,
  Award,
  Users,
  ExternalLink,
} from 'lucide-react';
import { useTableSort } from '../hooks/useTableSort';
import ErpSortHeaderCell from '../components/ui/ErpSortHeaderCell';
import { useToast } from '@/components/ui/ToastHost';
import { formatDate } from '@/utils/format';
import { useDatabaseStoredState } from '@/hooks/useDatabaseStoredState';

export interface PolicyComplianceItem {
  id: string; // e.g. POL-1, AUD-1, SOP-1, ACK-1
  section: 'POLICIES' | 'AUDIT' | 'SOPS' | 'ACKNOWLEDGEMENTS';
  title: string;
  category: string;
  code_number: string;
  version: string;
  department: string;
  owner: string;
  effective_date: string;
  review_date?: string;
  status: 'ACTIVE' | 'DRAFT' | 'UNDER_REVIEW' | 'COMPLIANT' | 'NON_COMPLIANT' | 'ARCHIVED';
  description: string;
  document_url?: string;
  score_rating?: string;
  employee_name?: string;
  signed_at?: string;
  created_at: string;
}

export default function PolicyCompliancePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  // Determine active section from route
  const isAudit = location.pathname.includes('/compliance/audit');
  const isSop = location.pathname.includes('/compliance/sops');
  const isAck = location.pathname.includes('/compliance/acknowledgements');

  const activeSection: 'POLICIES' | 'AUDIT' | 'SOPS' | 'ACKNOWLEDGEMENTS' = isAudit
    ? 'AUDIT'
    : isSop
    ? 'SOPS'
    : isAck
    ? 'ACKNOWLEDGEMENTS'
    : 'POLICIES';

  const [items, setItems] = useDatabaseStoredState<PolicyComplianceItem[]>(
    'crm_policy_compliance_items_data',
    [],
  );

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  // Modal & Drawer State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PolicyComplianceItem | null>(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState<PolicyComplianceItem | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formCodeNumber, setFormCodeNumber] = useState('');
  const [formVersion, setFormVersion] = useState('v1.0');
  const [formDepartment, setFormDepartment] = useState('All Departments');
  const [formOwner, setFormOwner] = useState('Compliance Officer');
  const [formEffectiveDate, setFormEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [formReviewDate, setFormReviewDate] = useState('');
  const [formStatus, setFormStatus] = useState<any>('ACTIVE');
  const [formDescription, setFormDescription] = useState('');
  const [formDocumentUrl, setFormDocumentUrl] = useState('');
  const [formScoreRating, setFormScoreRating] = useState('Compliant (100%)');
  const [formEmployeeName, setFormEmployeeName] = useState('Admin User');

  // Categories per section
  const policyCategories = ['Information Security', 'Code of Conduct', 'HR & Employee Benefits', 'Finance & Expenses', 'Health & Safety', 'Data Privacy & GDPR'];
  const auditCategories = ['Internal Audit', 'External Statutory Audit', 'ISO Certification Audit', 'Tax & Financial Compliance', 'IT Security Audit'];
  const sopCategories = ['Operations Workflow', 'Customer Support SOP', 'IT System Maintenance', 'Procurement Process', 'Payroll Processing'];
  const ackCategories = ['Annual Policy Renewal', 'New Joiner Onboarding', 'Information Security Sign-off', 'Ethics & Code of Conduct'];

  const categoryOptions =
    activeSection === 'AUDIT'
      ? auditCategories
      : activeSection === 'SOPS'
      ? sopCategories
      : activeSection === 'ACKNOWLEDGEMENTS'
      ? ackCategories
      : policyCategories;

  // Filter items matching active section & filter criteria
  const sectionFiltered = useMemo(() => {
    return items.filter((i) => i.section === activeSection);
  }, [items, activeSection]);

  const filteredItems = useMemo(() => {
    return sectionFiltered.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchId = item.id.toLowerCase().includes(q);
        const matchCode = item.code_number?.toLowerCase().includes(q) || false;
        const matchDept = item.department.toLowerCase().includes(q);
        const matchOwner = item.owner.toLowerCase().includes(q);
        if (!matchTitle && !matchId && !matchCode && !matchDept && !matchOwner) return false;
      }
      // Status
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      // Category
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      // Department
      if (departmentFilter !== 'ALL' && item.department !== departmentFilter) return false;

      return true;
    });
  }, [sectionFiltered, searchQuery, statusFilter, categoryFilter, departmentFilter]);

  const { sortState, handleSort, sortData } = useTableSort<PolicyComplianceItem>({
    getValue: {
      code_number: (item) => item.code_number || item.id,
      owner_auditor: (item) => item.owner,
    },
  });

  const sortedItems = useMemo(() => sortData(filteredItems), [filteredItems, sortData]);

  // Statistics KPIs
  const totalPoliciesCount = items.filter((i) => i.section === 'POLICIES').length;
  const totalAuditsCount = items.filter((i) => i.section === 'AUDIT').length;
  const totalSopsCount = items.filter((i) => i.section === 'SOPS').length;
  const totalAcksCount = items.filter((i) => i.section === 'ACKNOWLEDGEMENTS').length;

  const activePoliciesCount = items.filter((i) => i.section === 'POLICIES' && i.status === 'ACTIVE').length;
  const compliantAuditsCount = items.filter((i) => i.section === 'AUDIT' && i.status === 'COMPLIANT').length;

  // Reset Form
  const resetForm = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormCategory(categoryOptions[0] || '');
    setFormCodeNumber('');
    setFormVersion('v1.0');
    setFormDepartment('All Departments');
    setFormOwner('Compliance Officer');
    setFormEffectiveDate(new Date().toISOString().split('T')[0]);
    setFormReviewDate('');
    setFormStatus(activeSection === 'AUDIT' ? 'COMPLIANT' : 'ACTIVE');
    setFormDescription('');
    setFormDocumentUrl('');
    setFormScoreRating('Compliant (100%)');
    setFormEmployeeName('Admin User');
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (item: PolicyComplianceItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormCategory(item.category);
    setFormCodeNumber(item.code_number || '');
    setFormVersion(item.version || 'v1.0');
    setFormDepartment(item.department);
    setFormOwner(item.owner);
    setFormEffectiveDate(item.effective_date);
    setFormReviewDate(item.review_date || '');
    setFormStatus(item.status);
    setFormDescription(item.description);
    setFormDocumentUrl(item.document_url || '');
    setFormScoreRating(item.score_rating || '');
    setFormEmployeeName(item.employee_name || 'Admin User');
    setIsCreateOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showError('Please enter a title');
      return;
    }

    if (editingItem) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === editingItem.id
            ? {
                ...i,
                title: formTitle.trim(),
                category: formCategory || categoryOptions[0],
                code_number: formCodeNumber.trim() || `KIM-${activeSection.substring(0, 3)}-${editingItem.id}`,
                version: formVersion.trim() || 'v1.0',
                department: formDepartment,
                owner: formOwner.trim(),
                effective_date: formEffectiveDate,
                review_date: formReviewDate,
                status: formStatus,
                description: formDescription.trim(),
                document_url: formDocumentUrl.trim(),
                score_rating: formScoreRating.trim(),
                employee_name: formEmployeeName.trim(),
              }
            : i,
        ),
      );
      showSuccess(`Updated ${editingItem.id} successfully`);
    } else {
      const prefixMap: Record<string, string> = {
        POLICIES: 'POL',
        AUDIT: 'AUD',
        SOPS: 'SOP',
        ACKNOWLEDGEMENTS: 'ACK',
      };
      const prefix = prefixMap[activeSection] || 'KIM';

      const maxNum = items
        .filter((i) => i.section === activeSection)
        .reduce((max, i) => {
          const parts = i.id.split('-');
          const num = parseInt(parts[parts.length - 1], 10);
          return !isNaN(num) && num > max ? num : max;
        }, 0);

      const newId = `${prefix}-${maxNum + 1}`;
      const newItem: PolicyComplianceItem = {
        id: newId,
        section: activeSection,
        title: formTitle.trim(),
        category: formCategory || categoryOptions[0],
        code_number: formCodeNumber.trim() || `KIM-${prefix}-${maxNum + 1}`,
        version: formVersion.trim() || 'v1.0',
        department: formDepartment,
        owner: formOwner.trim(),
        effective_date: formEffectiveDate,
        review_date: formReviewDate,
        status: formStatus,
        description: formDescription.trim(),
        document_url: formDocumentUrl.trim(),
        score_rating: formScoreRating.trim(),
        employee_name: formEmployeeName.trim(),
        signed_at: activeSection === 'ACKNOWLEDGEMENTS' ? new Date().toISOString() : undefined,
        created_at: new Date().toISOString(),
      };

      setItems((prev) => [newItem, ...prev]);
      showSuccess(`Created record ${newId} successfully`);
    }

    setIsCreateOpen(false);
    resetForm();
  };

  const handleDeleteItem = (id: string) => {
    if (window.confirm(`Are you sure you want to delete record ${id}?`)) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      showSuccess(`Record ${id} deleted`);
      if (selectedDetailItem?.id === id) {
        setSelectedDetailItem(null);
      }
    }
  };

  const handleExportCSV = () => {
    if (filteredItems.length === 0) {
      showError('No records available to export');
      return;
    }

    const headers = ['ID', 'Code', 'Title', 'Category', 'Version', 'Status', 'Department', 'Owner', 'Effective Date', 'Review Date'];
    const rows = filteredItems.map((i) => [
      i.id,
      `"${i.code_number || ''}"`,
      `"${i.title.replace(/"/g, '""')}"`,
      `"${i.category}"`,
      i.version,
      i.status,
      i.department,
      `"${i.owner}"`,
      i.effective_date,
      i.review_date || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `kim_policy_compliance_${activeSection.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess(`Exported ${filteredItems.length} records to CSV`);
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'COMPLIANT':
        return <Chip label={status} size="small" icon={<CheckCircle2 size={12} />} sx={{ bgcolor: '#DCFCE7', color: '#15803D', fontWeight: 700, fontSize: '0.68rem' }} />;
      case 'UNDER_REVIEW':
      case 'DRAFT':
        return <Chip label={status.replace('_', ' ')} size="small" icon={<Clock size={12} />} sx={{ bgcolor: '#DBEAFE', color: '#1D4ED8', fontWeight: 700, fontSize: '0.68rem' }} />;
      case 'NON_COMPLIANT':
        return <Chip label="NON COMPLIANT" size="small" icon={<XCircle size={12} />} sx={{ bgcolor: '#FEE2E2', color: '#B91C1C', fontWeight: 700, fontSize: '0.68rem' }} />;
      case 'ARCHIVED':
        return <Chip label="ARCHIVED" size="small" sx={{ bgcolor: '#F1F5F9', color: '#64748B', fontWeight: 700, fontSize: '0.68rem' }} />;
      default:
        return <Chip label={status} size="small" sx={{ bgcolor: '#FEF3C7', color: '#B45309', fontWeight: 700, fontSize: '0.68rem' }} />;
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', minWidth: 0, px: 0, py: 0.5, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* ── Sub-menu Navigation Tabs ────────────────────────────────────────── */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
          <Button
            variant={activeSection === 'POLICIES' ? 'contained' : 'text'}
            startIcon={<ShieldCheck size={18} />}
            onClick={() => navigate('/compliance/policies')}
            sx={{
              bgcolor: activeSection === 'POLICIES' ? '#04552B' : 'transparent',
              color: activeSection === 'POLICIES' ? '#ffffff' : 'text.secondary',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '13.5px',
              borderRadius: '8px 8px 0 0',
              px: 2,
              py: 0.9,
              '&:hover': { bgcolor: activeSection === 'POLICIES' ? '#034120' : 'action.hover' },
            }}
          >
            Company Policies
          </Button>

          <Button
            variant={activeSection === 'AUDIT' ? 'contained' : 'text'}
            startIcon={<ClipboardCheck size={18} />}
            onClick={() => navigate('/compliance/audit')}
            sx={{
              bgcolor: activeSection === 'AUDIT' ? '#04552B' : 'transparent',
              color: activeSection === 'AUDIT' ? '#ffffff' : 'text.secondary',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '13.5px',
              borderRadius: '8px 8px 0 0',
              px: 2,
              py: 0.9,
              '&:hover': { bgcolor: activeSection === 'AUDIT' ? '#034120' : 'action.hover' },
            }}
          >
            Compliance Audit
          </Button>

          <Button
            variant={activeSection === 'SOPS' ? 'contained' : 'text'}
            startIcon={<BookOpen size={18} />}
            onClick={() => navigate('/compliance/sops')}
            sx={{
              bgcolor: activeSection === 'SOPS' ? '#04552B' : 'transparent',
              color: activeSection === 'SOPS' ? '#ffffff' : 'text.secondary',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '13.5px',
              borderRadius: '8px 8px 0 0',
              px: 2,
              py: 0.9,
              '&:hover': { bgcolor: activeSection === 'SOPS' ? '#034120' : 'action.hover' },
            }}
          >
            SOPs
          </Button>

          <Button
            variant={activeSection === 'ACKNOWLEDGEMENTS' ? 'contained' : 'text'}
            startIcon={<CheckCircle2 size={18} />}
            onClick={() => navigate('/compliance/acknowledgements')}
            sx={{
              bgcolor: activeSection === 'ACKNOWLEDGEMENTS' ? '#04552B' : 'transparent',
              color: activeSection === 'ACKNOWLEDGEMENTS' ? '#ffffff' : 'text.secondary',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '13.5px',
              borderRadius: '8px 8px 0 0',
              px: 2,
              py: 0.9,
              '&:hover': { bgcolor: activeSection === 'ACKNOWLEDGEMENTS' ? '#034120' : 'action.hover' },
            }}
          >
            Acknowledgements
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
            New {activeSection === 'AUDIT' ? 'Audit' : activeSection === 'SOPS' ? 'SOP' : activeSection === 'ACKNOWLEDGEMENTS' ? 'Sign-off' : 'Policy'}
          </Button>
        </Box>
      </Box>

      {/* ── KPI Summary Cards ────────────────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 600, fontSize: 13 }}>
                Company Policies
              </Typography>
              <Box sx={{ p: 0.8, borderRadius: '8px', bgcolor: '#DCFCE7', color: '#15803D' }}>
                <ShieldCheck size={18} />
              </Box>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary' }}>
              {totalPoliciesCount} <Typography component="span" variant="caption" color="textSecondary">({activePoliciesCount} Active)</Typography>
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 600, fontSize: 13 }}>
                Compliance Audits
              </Typography>
              <Box sx={{ p: 0.8, borderRadius: '8px', bgcolor: '#DBEAFE', color: '#1D4ED8' }}>
                <ClipboardCheck size={18} />
              </Box>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#1D4ED8' }}>
              {totalAuditsCount} <Typography component="span" variant="caption" color="textSecondary">({compliantAuditsCount} Compliant)</Typography>
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 600, fontSize: 13 }}>
                Published SOPs
              </Typography>
              <Box sx={{ p: 0.8, borderRadius: '8px', bgcolor: '#FEF3C7', color: '#D97706' }}>
                <BookOpen size={18} />
              </Box>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#D97706' }}>
              {totalSopsCount}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 600, fontSize: 13 }}>
                Acknowledgements
              </Typography>
              <Box sx={{ p: 0.8, borderRadius: '8px', bgcolor: '#F1F5F9', color: '#475569' }}>
                <CheckCircle2 size={18} />
              </Box>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary' }}>
              {totalAcksCount}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* ── Toolbar & Filters ───────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{ p: 2, mb: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by Code, Title, Owner, Department..."
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
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="COMPLIANT">Compliant</MenuItem>
                <MenuItem value="UNDER_REVIEW">Under Review / In Audit</MenuItem>
                <MenuItem value="DRAFT">Draft</MenuItem>
                <MenuItem value="NON_COMPLIANT">Non Compliant</MenuItem>
                <MenuItem value="ARCHIVED">Archived</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4} md={2.5}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select value={categoryFilter} label="Category" onChange={(e) => setCategoryFilter(e.target.value)}>
                <MenuItem value="ALL">All Categories</MenuItem>
                {categoryOptions.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Department</InputLabel>
              <Select value={departmentFilter} label="Department" onChange={(e) => setDepartmentFilter(e.target.value)}>
                <MenuItem value="ALL">All Departments</MenuItem>
                <MenuItem value="All Departments">Company-wide</MenuItem>
                <MenuItem value="IT">IT & Information Security</MenuItem>
                <MenuItem value="HR">HR & Legal</MenuItem>
                <MenuItem value="Finance">Finance & Accounting</MenuItem>
                <MenuItem value="Operations">Operations</MenuItem>
                <MenuItem value="Engineering">Engineering</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* ── Main Data Table ─────────────────────────────────────────────────── */}
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper', flex: 1 }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: 'background.default' }}>
            <TableRow>
              <ErpSortHeaderCell variant="mui" field="code_number" label="Code / ID" sortState={sortState} onSort={handleSort} sx={{ py: 1.5 }} />
              <ErpSortHeaderCell variant="mui" field="title" label="Title" sortState={sortState} onSort={handleSort} />
              <ErpSortHeaderCell variant="mui" field="category" label="Category" sortState={sortState} onSort={handleSort} />
              <ErpSortHeaderCell variant="mui" field="version" label="Version" sortState={sortState} onSort={handleSort} />
              <ErpSortHeaderCell variant="mui" field="department" label="Department" sortState={sortState} onSort={handleSort} />
              <ErpSortHeaderCell variant="mui" field="owner_auditor" label="Owner / Auditor" sortState={sortState} onSort={handleSort} />
              <ErpSortHeaderCell variant="mui" field="effective_date" label="Effective Date" sortState={sortState} onSort={handleSort} />
              <ErpSortHeaderCell variant="mui" field="status" label="Status" sortState={sortState} onSort={handleSort} />
              <ErpSortHeaderCell variant="mui" label="Actions" align="right" sortable={false} />
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedItems.map((item) => (
              <TableRow key={item.id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelectedDetailItem(item)}>
                <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#04552B' }}>
                  {item.code_number || item.id}
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{item.title}</TableCell>
                <TableCell>
                  <Chip label={item.category} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.75rem' }}>{item.version}</TableCell>
                <TableCell>{item.department}</TableCell>
                <TableCell>{item.owner}</TableCell>
                <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(item.effective_date)}</TableCell>
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
                <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
                    <Box sx={{ p: 2, borderRadius: '50%', bgcolor: 'action.hover', color: '#04552B' }}>
                      <ShieldCheck size={36} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                      No {activeSection.toLowerCase()} Records Found
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ maxWidth: 420 }}>
                      There are no policy or compliance records added under this section. Click below to add your first record.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<Plus size={16} />}
                      onClick={handleOpenCreate}
                      sx={{ bgcolor: '#04552B', '&:hover': { bgcolor: '#034120' }, mt: 1, textTransform: 'none', fontWeight: 600 }}
                    >
                      Create Record
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── Create / Edit Modal ───────────────────────────────────────────── */}
      <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSaveItem}>
          <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShieldCheck size={20} color="#04552B" />
            {editingItem ? `Edit Record (${editingItem.id})` : `New ${activeSection.substring(0, 4)} Record`}
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  required
                  size="small"
                  label="Title / Name"
                  placeholder="e.g. Information Security Policy 2026 or ISO 27001 Annual Audit"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Document Code / Ref No."
                  placeholder="e.g. KIM-POL-001"
                  value={formCodeNumber}
                  onChange={(e) => setFormCodeNumber(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select value={formCategory} label="Category" onChange={(e) => setFormCategory(e.target.value)}>
                    {categoryOptions.map((cat) => (
                      <MenuItem key={cat} value={cat}>
                        {cat}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Version"
                  placeholder="e.g. v1.0"
                  value={formVersion}
                  onChange={(e) => setFormVersion(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select value={formStatus} label="Status" onChange={(e) => setFormStatus(e.target.value as any)}>
                    <MenuItem value="ACTIVE">Active / Published</MenuItem>
                    <MenuItem value="COMPLIANT">Compliant</MenuItem>
                    <MenuItem value="UNDER_REVIEW">Under Review / In Audit</MenuItem>
                    <MenuItem value="DRAFT">Draft</MenuItem>
                    <MenuItem value="NON_COMPLIANT">Non Compliant</MenuItem>
                    <MenuItem value="ARCHIVED">Archived</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Department</InputLabel>
                  <Select value={formDepartment} label="Department" onChange={(e) => setFormDepartment(e.target.value)}>
                    <MenuItem value="All Departments">All Departments (Company-wide)</MenuItem>
                    <MenuItem value="IT">IT & Information Security</MenuItem>
                    <MenuItem value="HR">HR & Legal</MenuItem>
                    <MenuItem value="Finance">Finance & Accounting</MenuItem>
                    <MenuItem value="Operations">Operations</MenuItem>
                    <MenuItem value="Engineering">Engineering</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Owner / Auditor"
                  value={formOwner}
                  onChange={(e) => setFormOwner(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="date"
                  size="small"
                  label="Effective Date"
                  InputLabelProps={{ shrink: true }}
                  value={formEffectiveDate}
                  onChange={(e) => setFormEffectiveDate(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="date"
                  size="small"
                  label="Next Review / Audit Date (Optional)"
                  InputLabelProps={{ shrink: true }}
                  value={formReviewDate}
                  onChange={(e) => setFormReviewDate(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Document Link / Reference URL (Optional)"
                  placeholder="https://company.sharepoint.com/policy.pdf"
                  value={formDocumentUrl}
                  onChange={(e) => setFormDocumentUrl(e.target.value)}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  size="small"
                  label="Policy Summary / Audit Scope / Description"
                  placeholder="Provide complete description, requirements, or scope details..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setIsCreateOpen(false)} sx={{ color: 'text.secondary' }}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" sx={{ bgcolor: '#04552B', '&:hover': { bgcolor: '#034120' }, px: 3 }}>
              {editingItem ? 'Save Changes' : 'Create Record'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ── Detail Drawer ─────────────────────────────────────────────────── */}
      <Drawer anchor="right" open={Boolean(selectedDetailItem)} onClose={() => setSelectedDetailItem(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 520 }, p: 3 } }}>
        {selectedDetailItem && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Typography variant="overline" sx={{ fontWeight: 800, color: '#04552B', letterSpacing: 1 }}>
                  {selectedDetailItem.code_number || selectedDetailItem.id} • {selectedDetailItem.section}
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

            <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap' }}>
              {getStatusChip(selectedDetailItem.status)}
              <Chip label={selectedDetailItem.category} size="small" variant="outlined" />
              <Chip label={`Ver: ${selectedDetailItem.version}`} size="small" sx={{ fontFamily: 'monospace' }} />
            </Box>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary">
                  Department
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {selectedDetailItem.department}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary">
                  Owner / Auditor
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {selectedDetailItem.owner}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary">
                  Effective Date
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {formatDate(selectedDetailItem.effective_date)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="textSecondary">
                  Next Review Date
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {selectedDetailItem.review_date ? formatDate(selectedDetailItem.review_date) : 'N/A'}
                </Typography>
              </Grid>
            </Grid>

            {selectedDetailItem.description && (
              <Box sx={{ mb: 2.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Description / Scope
                </Typography>
                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: '8px' }}>
                  <Typography variant="body2">{selectedDetailItem.description}</Typography>
                </Paper>
              </Box>
            )}

            {selectedDetailItem.document_url && (
              <Box sx={{ mb: 2.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Attached Document
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ExternalLink size={16} />}
                  onClick={() => window.open(selectedDetailItem.document_url, '_blank')}
                  sx={{ borderRadius: '8px', textTransform: 'none' }}
                >
                  Open Policy Document
                </Button>
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
                Edit Record
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
    </Box>
  );
}
