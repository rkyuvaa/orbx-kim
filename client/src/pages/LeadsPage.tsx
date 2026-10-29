import { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Select,
  TablePagination,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import {
  Plus,
  Trash2,
  Edit,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  List,
  LayoutGrid,
  Calendar,
  Clock,
  Sparkles,
  CheckSquare,
  XCircle,
  Upload,
  Search,
  X,
} from 'lucide-react';
import UniversalImportModal from '@/components/ui/UniversalImportModal';
import { useTableSort } from '@/hooks/useTableSort';
import ErpSortHeaderCell from '@/components/ui/ErpSortHeaderCell';

import {
  useApplicationsQuery,
  useDeleteApplicationMutation,
  useUpdateApplicationMutation,
  useBulkAssignLeadsMutation,
  useBulkChangeStatusMutation,
  useBulkDeleteLeadsMutation,
} from '@/api/applicationsApi';
import { useDashboardQuery } from '@/api/dashboardApi';
import { useStagesByModuleQuery, useUsersQuery } from '@/api/mastersApi';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import NewApplicationDialog from '@/components/ui/NewApplicationDialog';
import Pipeline from '@/components/ui/Pipeline';
import { LoadingRows } from '@/components/ui/PageState';
import { formatAmount, formatDate, statusMeta } from '@/utils/format';
import { useToast } from '@/components/ui/ToastHost';
import type { ApplicationItem, ApplicationStatus, PipelineStage } from '@/types';

const LEAD_TABLE_COLUMNS: { field?: string; label: string; sortable?: boolean; align?: 'left' | 'center' | 'right' }[] = [
  { field: 'customer_name', label: 'Customer', sortable: true },
  { field: 'vehicle', label: 'Vehicle', sortable: true },
  { field: 'amount', label: 'Amount', sortable: true },
  { field: 'status', label: 'Status', sortable: true },
  { field: 'aging', label: 'Aging', sortable: true },
  { field: 'created_at', label: 'Created', sortable: true },
  { field: 'updated_at', label: 'Updated On', sortable: true },
  { label: 'Actions', sortable: false, align: 'left' },
];

const OPPORTUNITY_TABLE_COLUMNS: { field?: string; label: string; sortable?: boolean; align?: 'left' | 'center' | 'right' }[] = [
  { field: 'app_no', label: 'App ID', sortable: true },
  { field: 'customer_name', label: 'Customer', sortable: true },
  { field: 'vehicle', label: 'Vehicle', sortable: true },
  { field: 'amount', label: 'Amount', sortable: true },
  { field: 'status', label: 'Status', sortable: true },
  { field: 'aging', label: 'Aging', sortable: true },
  { field: 'created_at', label: 'Created', sortable: true },
  { field: 'updated_at', label: 'Updated On', sortable: true },
  { label: 'Actions', sortable: false, align: 'left' },
];

export default function LeadsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isOpportunityModule = location.pathname.startsWith('/opportunities');
  const detailPrefix = isOpportunityModule ? '/opportunities' : '/leads';
  const isOpportunityRoute = location.pathname === '/opportunities';
  const currentModule = isOpportunityRoute ? 'OPPORTUNITY' : 'LEAD';
  const tableColumns = isOpportunityRoute ? OPPORTUNITY_TABLE_COLUMNS : LEAD_TABLE_COLUMNS;
  const [searchParams] = useSearchParams();
  const searchQ = searchParams.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(searchQ);

  useEffect(() => {
    setSearchInput(searchQ);
  }, [searchQ]);

  const [selectedStageKey, setSelectedStageKey] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  const [draggedAppId, setDraggedAppId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'assign' | 'status' | 'delete' | null>(null);
  const [bulkAssigneeId, setBulkAssigneeId] = useState<number | null>(null);
  const [bulkStatusValue, setBulkStatusValue] = useState<string>('');

  const queryParams = {
    page: page + 1,
    page_size: rowsPerPage,
    q: searchQ || undefined,
    module: currentModule,
  };

  const { data, isFetching, isError, refetch } = useApplicationsQuery(queryParams);
  const { data: dashboard } = useDashboardQuery();
  const { data: moduleStages = [] } = useStagesByModuleQuery(currentModule);
  const { data: users = [] } = useUsersQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [createOppOpen, setCreateOppOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<ApplicationItem | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [deleteApplication] = useDeleteApplicationMutation();
  const [updateApplication] = useUpdateApplicationMutation();
  const [bulkAssignLeads, { isLoading: assigningLeads }] = useBulkAssignLeadsMutation();
  const [bulkChangeStatus, { isLoading: changingStatus }] = useBulkChangeStatusMutation();
  const [bulkDeleteLeads, { isLoading: deletingLeads }] = useBulkDeleteLeadsMutation();
  const { showToast } = useToast();

  const isLeadStageKey = (key: string, status?: string | null) => {
    if (status === 'LEAD') return true;
    const k = key.toLowerCase();
    return ['new', 'contacted', 'interested', 'not-interested', 'not_interested', 'qualified', 'lead', 'leads'].includes(k);
  };

  const isAppInStage = (app: ApplicationItem, stage: PipelineStage, idx: number, isOpportunity: boolean) => {
    const appStatusUpper = app.status ? String(app.status).toUpperCase() : '';
    const appStageKeyLower = app.stage_key ? app.stage_key.toLowerCase().trim() : '';
    const stageKeyLower = stage.key ? stage.key.toLowerCase().trim() : '';
    const stageStatusUpper = stage.status ? String(stage.status).toUpperCase() : '';

    if (!isOpportunity && appStatusUpper !== 'LEAD' && !['new', 'contacted', 'interested', 'not_interested', 'not-interested', 'qualified', 'lead', 'leads'].includes(appStageKeyLower)) {
      return false;
    }
    if (isOpportunity && appStatusUpper === 'LEAD' && ['new', 'contacted', 'interested', 'not_interested', 'not-interested', 'qualified', 'lead', 'leads'].includes(appStageKeyLower)) {
      return false;
    }

    if (appStageKeyLower && appStageKeyLower === stageKeyLower) {
      return true;
    }

    const keyAliases: Record<string, string[]> = {
      new: ['new', 'lead', 'leads', 'all_leads', 'new_lead'],
      contacted: ['contacted', 'contact'],
      interested: ['interested'],
      not_interested: ['not_interested', 'not-interested', 'disqualified'],
      qualified: ['qualified'],

      new_opportunity: ['new_opportunity', 'new-opportunity', 'application', 'applications', 'all_opportunities'],
      document_upload: ['document_upload', 'doc_upload', 'upload_documents'],
      document_verification: ['document_verification', 'doc_verification', 'verification'],
      final_submission: ['final_submission', 'submission'],
      finance_approval: ['finance_approval', 'finance', 'query'],
      loan_sanctioned: ['loan_sanctioned', 'sanctioned', 'sanction'],
      disbursement: ['disbursement', 'disburse', 'delivery'],
      completed: ['completed', 'closed'],
    };

    const aliasesForStage = keyAliases[stageKeyLower] || [];
    if (appStageKeyLower && aliasesForStage.includes(appStageKeyLower)) {
      return true;
    }

    if (stageStatusUpper && stageStatusUpper !== 'APPLICATION' && stageStatusUpper !== 'LEAD') {
      if (appStatusUpper === stageStatusUpper) return true;
    }

    if (idx === 0) {
      if (!isOpportunity && (appStatusUpper === 'LEAD' || appStageKeyLower === 'new' || appStageKeyLower === 'leads' || !appStageKeyLower)) {
        return true;
      }
      if (isOpportunity && (appStatusUpper === 'APPLICATION' || appStageKeyLower === 'applications' || appStageKeyLower === 'new_opportunity' || !appStageKeyLower)) {
        return true;
      }
    }

    return false;
  };

  const pipelineStages: PipelineStage[] = useMemo(() => {
    let stagesForModule = moduleStages.filter((s) => {
      if (!s.enabled) return false;
      if (s.module) return s.module.toUpperCase() === currentModule;
      const isLead = isLeadStageKey(s.key, s.status);
      return currentModule === 'LEAD' ? isLead : !isLead;
    });

    if (stagesForModule.length === 0 && dashboard?.pipeline) {
      stagesForModule = dashboard.pipeline.filter((s) => {
        const isLead = isLeadStageKey(s.key, s.status);
        return currentModule === 'LEAD' ? isLead : !isLead;
      }) as any;
    }

    return stagesForModule.map((s, idx) => {
      const keyLower = s.key?.toLowerCase().trim() || '';
      const statusLower = (s.status ? String(s.status) : '').toLowerCase().trim();

      let count = 0;
      if (data?.stage_counts && data.stage_counts[keyLower] !== undefined) {
        count = data.stage_counts[keyLower];
      } else if (
        data?.stage_counts &&
        statusLower &&
        !['application', 'lead'].includes(statusLower) &&
        data.stage_counts[statusLower] !== undefined
      ) {
        count = data.stage_counts[statusLower];
      } else {
        count = (data?.items ?? []).filter((app) => isAppInStage(app, s as any, idx, isOpportunityRoute)).length;
      }

      return {
        key: s.key,
        status: (s.status ?? (isOpportunityRoute ? 'APPLICATION' : 'LEAD')) as ApplicationStatus,
        label: s.label,
        tip: `${s.label} (${count})`,
        count,
        color: s.color,
      };
    });
  }, [moduleStages, dashboard?.pipeline, data?.stage_counts, data?.items, currentModule, isOpportunityRoute]);

  const kanbanColumns = useMemo(() => {
    return pipelineStages.map((col) => {
      const meta = statusMeta(col.status as ApplicationStatus);
      const color = col.color || meta.dot || '#16C47F';
      return {
        key: col.key,
        status: col.status as ApplicationStatus,
        label: col.label,
        color,
        bg: `${color}0A`,
        border: color,
        badgeBg: `${color}18`,
        badgeColor: color,
      };
    });
  }, [pipelineStages]);

  // Filter rows based on route, selected stage, and search query
  const allRows = data?.items ?? [];
  const rows = allRows.filter((app) => {
    const appStatusUpper = app.status ? String(app.status).toUpperCase() : '';
    if (!isOpportunityRoute && appStatusUpper !== 'LEAD') {
      return false;
    }
    if (isOpportunityRoute && appStatusUpper === 'LEAD') {
      return false;
    }

    if (selectedStageKey) {
      const selectedObj = pipelineStages.find((s) => s.key === selectedStageKey);
      const selectedIdx = pipelineStages.findIndex((s) => s.key === selectedStageKey);
      if (selectedObj && !isAppInStage(app, selectedObj, selectedIdx, isOpportunityRoute)) {
        return false;
      }
    }

    if (searchQ) {
      const qLower = searchQ.trim().toLowerCase();
      const matchNo = app.app_no?.toLowerCase().includes(qLower);
      const matchName = app.customer_name?.toLowerCase().includes(qLower);
      const matchPhone = app.customer_phone?.toLowerCase().includes(qLower);
      const matchVehicle = app.vehicle?.toLowerCase().includes(qLower);
      const matchStatus = app.status?.toLowerCase().includes(qLower);
      if (!matchNo && !matchName && !matchPhone && !matchVehicle && !matchStatus) return false;
    }

    return true;
  });

  const { sortState, handleSort, sortData } = useTableSort<ApplicationItem>({
    getValue: {
      aging: (app) => app.created_at,
    },
  });

  const sortedRows = useMemo(() => sortData(rows), [rows, sortData]);

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleStageChange = async (app: ApplicationItem, newStageKey: string, newStatus?: ApplicationStatus) => {
    if (app.stage_key === newStageKey) return;
    try {
      const body: any = { stage_key: newStageKey };
      if (newStatus) body.status = newStatus;
      await updateApplication({ id: app.id, body }).unwrap();
      showToast(`Moved ${app.app_no} to ${newStageKey.toUpperCase()}`, 'success');
    } catch {
      showToast(`Failed to update stage for ${app.app_no}`, 'error');
    }
  };

  const handleDrop = (targetStageKey: string, targetStatus?: ApplicationStatus) => {
    if (!draggedAppId) return;
    const targetApp = rows.find((a) => a.id === draggedAppId);
    if (targetApp) {
      handleStageChange(targetApp, targetStageKey, targetStatus);
    }
    setDraggedAppId(null);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  };

  const handleSelectRow = (id: number) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const handleBulkAction = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      showToast('Please select at least one lead', 'warning');
      return;
    }

    try {
      if (bulkActionType === 'assign' && bulkAssigneeId) {
        await bulkAssignLeads({ application_ids: ids, assigned_to: bulkAssigneeId }).unwrap();
        showToast(`Assigned ${ids.length} leads`, 'success');
      } else if (bulkActionType === 'status' && bulkStatusValue) {
        await bulkChangeStatus({ application_ids: ids, status: bulkStatusValue }).unwrap();
        showToast(`Updated status for ${ids.length} leads`, 'success');
      } else if (bulkActionType === 'delete') {
        await bulkDeleteLeads({ application_ids: ids }).unwrap();
        showToast(`Deleted ${ids.length} leads`, 'success');
      }
      setSelectedIds(new Set());
      setBulkActionDialogOpen(false);
      setBulkActionType(null);
      refetch();
    } catch (err) {
      const errMsg = (err as { data?: { detail?: string } })?.data?.detail || 'Bulk operation failed';
      showToast(errMsg, 'error');
    }
  };

  return (
    <div>
      {/* 1. Full-width Stage Pills row */}
      <div style={{ marginBottom: 12 }}>
        <Pipeline
          stages={pipelineStages}
          selectedStageKey={selectedStageKey}
          onStageClick={(stage) => {
            setSelectedStageKey((prev) => (prev === stage.key ? undefined : stage.key));
          }}
        />
      </div>

      {/* 2. Action row below stage pills */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260, maxWidth: 440 }}>
          <TextField
            size="small"
            fullWidth
            placeholder={isOpportunityRoute ? "Search Opportunities (App ID, Customer, Phone, Vehicle)..." : "Search Leads (App ID, Customer, Phone, Vehicle)..."}
            value={searchInput}
            onChange={(e) => {
              const val = e.target.value;
              setSearchInput(val);
              const params = new URLSearchParams(searchParams);
              if (val.trim()) {
                params.set('q', val);
              } else {
                params.delete('q');
              }
              navigate(`${location.pathname}?${params.toString()}`, { replace: true });
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} color="#64748B" />
                </InputAdornment>
              ),
              endAdornment: searchInput ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSearchInput('');
                      const params = new URLSearchParams(searchParams);
                      params.delete('q');
                      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
                    }}
                  >
                    <X size={14} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{
              bgcolor: '#ffffff',
              borderRadius: '8px',
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px',
                fontSize: '13px',
                height: 38,
              },
            }}
          />

          {selectedIds.size > 0 && !isOpportunityRoute && (
            <Chip
              icon={<CheckSquare size={16} />}
              label={`${selectedIds.size} selected`}
              size="small"
              onDelete={() => setSelectedIds(new Set())}
              color="primary"
              sx={{ fontSize: 11, fontWeight: 600, borderRadius: '6px' }}
            />
          )}
          {selectedStageKey && (
            <Chip
              label={`Filtered by: ${pipelineStages.find((s) => s.key === selectedStageKey)?.label ?? selectedStageKey}`}
              size="small"
              onDelete={() => setSelectedStageKey(undefined)}
              color="primary"
              variant="outlined"
              sx={{ fontSize: 11, fontWeight: 600, borderRadius: '6px' }}
            />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {selectedIds.size > 0 && !isOpportunityRoute && (
            <>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Edit size={14} />}
                onClick={() => {
                  setBulkActionType('assign');
                  setBulkActionDialogOpen(true);
                }}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Assign
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setBulkActionType('status');
                  setBulkActionDialogOpen(true);
                }}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Change Status
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<Trash2 size={14} />}
                onClick={() => {
                  setBulkActionType('delete');
                  setBulkActionDialogOpen(true);
                }}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Delete
              </Button>
            </>
          )}

          {/* View Switcher: List vs Kanban */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_e, val) => val && setViewMode(val)}
            size="small"
            sx={{
              background: '#F0F4EE',
              borderRadius: '10px',
              p: '2px',
              border: '1px solid #E4EBE1',
              '& .MuiToggleButton-root': {
                border: 'none',
                borderRadius: '8px',
                px: 1.5,
                py: 0.5,
                fontSize: 12,
                fontWeight: 600,
                color: '#526658',
                textTransform: 'none',
                gap: '6px',
                '&.Mui-selected': {
                  background: '#FFFFFF',
                  color: '#16C47F',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                },
              },
            }}
          >
            <ToggleButton value="list">
              <List size={15} />
              List
            </ToggleButton>
            <ToggleButton value="kanban">
              <LayoutGrid size={15} />
              Kanban
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            variant="outlined"
            startIcon={<Upload size={16} />}
            onClick={() => setImportDialogOpen(true)}
            sx={{ height: 38, borderRadius: '10px', px: 2, borderColor: '#cbd5e1', color: '#334155', textTransform: 'none', fontWeight: 600 }}
          >
            Import
          </Button>

          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => setCreateOpen(true)}
            sx={{ height: 38, borderRadius: '10px', px: 2.5 }}
          >
            New Lead
          </Button>

          <Button
            variant="outlined"
            startIcon={<Sparkles size={16} />}
            onClick={() => setCreateOppOpen(true)}
            sx={{
              height: 38,
              borderRadius: '10px',
              px: 2,
              borderColor: '#2563EB',
              color: '#2563EB',
              fontWeight: 600,
              '&:hover': {
                borderColor: '#1D4ED8',
                background: 'rgba(37, 99, 235, 0.04)',
              },
            }}
          >
            + Opportunity
          </Button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <Paper sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              {isOpportunityRoute ? 'All Opportunities' : 'All Records'} ({rows.length})
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconButton
                size="small"
                aria-label="Previous page"
                onClick={() => handleChangePage(null, Math.max(0, page - 1))}
                disabled={page === 0}
                sx={{ color: page === 0 ? 'var(--text-muted)' : 'text.primary' }}
              >
                <ChevronLeft size={18} />
              </IconButton>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 60, textAlign: 'center' }}>
                Page {page + 1} of {Math.ceil((data?.total ?? 0) / rowsPerPage) || 1}
              </span>
              <IconButton
                size="small"
                aria-label="Next page"
                onClick={() => handleChangePage(null, Math.min(Math.ceil((data?.total ?? 0) / rowsPerPage) - 1, page + 1))}
                disabled={page >= Math.ceil((data?.total ?? 0) / rowsPerPage) - 1}
                sx={{ color: page >= Math.ceil((data?.total ?? 0) / rowsPerPage) - 1 ? 'var(--text-muted)' : 'text.primary' }}
              >
                <ChevronRight size={18} />
              </IconButton>
            </div>
          </div>
          <div className="scroll-touch" style={{ overflowX: 'auto' }}>
            {isFetching && !data ? (
              <LoadingRows rows={8} />
            ) : isError ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <Button variant="outlined" onClick={refetch}>
                  {isOpportunityRoute ? 'Retry loading opportunities' : 'Retry loading leads'}
                </Button>
              </div>
            ) : rows.length === 0 ? (
              <EmptyState
                title={isOpportunityRoute ? 'No opportunities found' : 'No leads found'}
                hint={
                  searchQ
                    ? `No results for "${searchQ}".`
                    : isOpportunityRoute
                    ? 'Opportunities will appear here as they are created or converted.'
                    : 'Leads will appear here as they are captured.'
                }
              />
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
                  <thead>
                    <tr>
                      {!isOpportunityRoute && (
                        <th
                          style={{
                            background: 'var(--primary-lighter)',
                            fontSize: 10,
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: 0.6,
                            textAlign: 'center',
                            padding: '10px 8px',
                            borderBottom: '1px solid var(--border)',
                            whiteSpace: 'nowrap',
                            width: '40px',
                          }}
                        >
                          <Checkbox
                            size="small"
                            checked={selectedIds.size === rows.length && rows.length > 0}
                            indeterminate={selectedIds.size > 0 && selectedIds.size < rows.length}
                            onChange={handleSelectAll}
                          />
                        </th>
                      )}
                      {tableColumns.map((col) => (
                        <ErpSortHeaderCell
                          key={col.label}
                          field={col.field}
                          label={col.label}
                          sortState={sortState}
                          onSort={handleSort}
                          sortable={col.sortable}
                          align={col.align}
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((app) => (
                      <tr
                        key={app.id}
                        onClick={() => !isOpportunityRoute && navigate(`${detailPrefix}/${app.id}`)}
                        style={{ cursor: isOpportunityRoute ? 'default' : 'pointer', transition: 'background 0.15s ease' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--primary-light)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {!isOpportunityRoute && (
                          <td style={{ padding: '11px 8px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                            <Checkbox
                              size="small"
                              checked={selectedIds.has(app.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSelectRow(app.id);
                              }}
                            />
                          </td>
                        )}
                        {isOpportunityRoute && (
                          <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)' }}>
                            <span className="app-id">{app.app_no}</span>
                          </td>
                        )}
                        <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)' }}>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>{app.customer_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{app.customer_phone}</div>
                          </div>
                        </td>
                        <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', color: 'var(--text-soft)' }}>{app.vehicle}</td>
                        <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, color: 'var(--text)' }}>
                          {formatAmount(app.amount)}
                        </td>
                        <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)' }}>
                          <StatusBadge status={app.status} />
                        </td>
                        <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', color: 'var(--text-soft)', fontSize: 12 }}>
                          {app.aging_label}
                        </td>
                        <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12 }}>
                          {formatDate(app.created_at)}
                        </td>
                        <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12 }}>
                          {formatDate(app.updated_at)}
                        </td>
                        <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                          <IconButton
                            size="small"
                            aria-label={`More actions for ${app.app_no}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuFor(app);
                              setMenuAnchor(e.currentTarget);
                            }}
                          >
                            <MoreVertical size={16} />
                          </IconButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <TablePagination
                  rowsPerPageOptions={[10, 20, 50]}
                  component="div"
                  count={data?.total ?? 0}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  labelDisplayedRows={({ from, to, count }) => `${from}–${to} of ${count}`}
                  labelRowsPerPage="Rows per page:"
                  SelectProps={{ size: 'small' }}
                />
              </>
            )}
          </div>
        </Paper>
      ) : (
        /* KANBAN VIEW */
        <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
          {isFetching && !data ? (
            <LoadingRows rows={4} />
          ) : isError ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <Button variant="outlined" onClick={refetch}>
                {isOpportunityRoute ? 'Retry loading opportunities' : 'Retry loading leads'}
              </Button>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: 14,
                minWidth: 'max-content',
                alignItems: 'flex-start',
                padding: '4px 2px',
              }}
            >
              {kanbanColumns.map((col) => {
                const colApps = rows.filter((app) => {
                  const colIdx = pipelineStages.findIndex((s) => s.key === col.key);
                  const stageObj = pipelineStages.find((s) => s.key === col.key);
                  return isAppInStage(app, (stageObj || col) as any, colIdx >= 0 ? colIdx : 0, isOpportunityRoute);
                });

                return (
                  <div
                    key={col.key}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(col.key, col.status)}
                    style={{
                      width: 280,
                      flexShrink: 0,
                      background: col.bg,
                      borderRadius: 14,
                      border: '1px solid #E4EBE1',
                      borderTop: `4px solid ${col.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      maxHeight: 'calc(100dvh - 220px)',
                      minHeight: 460,
                      WebkitOverflowScrolling: 'touch',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                    }}
                  >
                    {/* Column Header */}
                    <div
                      style={{
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid rgba(0,0,0,0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: col.color,
                          }}
                        />
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#16231B' }}>{col.label}</span>
                      </div>
                      <span
                        style={{
                          background: col.badgeBg,
                          color: col.badgeColor,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 12,
                        }}
                      >
                        {colApps.length}
                      </span>
                    </div>

                    {/* Column Body / Cards List */}
                    <div
                      className="scroll-touch"
                      style={{
                        padding: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        overflowY: 'auto',
                        flex: 1,
                      }}
                    >
                      {colApps.length === 0 ? (
                        <div
                          style={{
                            padding: '30px 10px',
                            textAlign: 'center',
                            color: '#9BA99F',
                            fontSize: 12,
                            border: '1px dashed #D5E0D2',
                            borderRadius: 10,
                            margin: '8px 0',
                          }}
                        >
                          {isOpportunityRoute ? `No opportunities in ${col.label}` : `No leads in ${col.label}`}
                        </div>
                      ) : (
                        colApps.map((app) => (
                          <Paper
                            key={app.id}
                            draggable
                            onDragStart={() => setDraggedAppId(app.id)}
                            onClick={() => navigate(`${detailPrefix}/${app.id}`)}
                            sx={{
                              p: 1.5,
                              borderRadius: '12px',
                              border: '1px solid #E2E8E0',
                              cursor: 'grab',
                              transition: 'all 0.2s ease',
                              background: '#FFFFFF',
                              '&:hover': {
                                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                transform: 'translateY(-2px)',
                                borderColor: col.border,
                              },
                            }}
                          >
                            {/* Card Top: App ID & Aging */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: 12.5, color: '#16C47F' }}>
                                {isOpportunityRoute ? app.app_no : (app.vehicle || 'Lead')}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Tooltip title="Aging duration">
                                  <span
                                    style={{
                                      fontSize: 10.5,
                                      fontWeight: 600,
                                      color: '#526658',
                                      background: '#F0F4EE',
                                      padding: '1px 6px',
                                      borderRadius: 4,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                    }}
                                  >
                                    <Clock size={10} />
                                    {app.aging_label}
                                  </span>
                                </Tooltip>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuFor(app);
                                    setMenuAnchor(e.currentTarget);
                                  }}
                                  sx={{ p: 0.3 }}
                                >
                                  <MoreVertical size={14} color="#7A8B80" />
                                </IconButton>
                              </div>
                            </div>

                            {/* Customer info */}
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#16231B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {app.customer_name}
                              </div>
                              <div style={{ fontSize: 11, color: '#7A8B80' }}>{app.customer_phone}</div>
                            </div>

                            {/* Vehicle & Amount */}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: '#F7F9F6',
                                padding: '6px 8px',
                                borderRadius: 8,
                                marginBottom: 8,
                                fontSize: 11.5,
                              }}
                            >
                              <span style={{ color: '#44584C', fontWeight: 500 }}>{app.vehicle}</span>
                              <span style={{ fontWeight: 700, color: '#16231B' }}>{formatAmount(app.amount)}</span>
                            </div>

                            {/* Created & Updated dates */}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: 10.5,
                                color: '#7A8B80',
                                paddingTop: '4px',
                                borderTop: '1px dashed #EAF0E9',
                              }}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Calendar size={10} /> Created: {formatDate(app.created_at)}
                              </span>
                              <span>Updated: {formatDate(app.updated_at)}</span>
                            </div>
                          </Paper>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Quick menu for delete / edit / convert */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => {
          setMenuAnchor(null);
          setMenuFor(null);
        }}
      >

        <MenuItem
          onClick={async () => {
            if (!menuFor) return;
            try {
              await deleteApplication(menuFor.id).unwrap();
              showToast(`Lead ${menuFor.app_no} deleted`, 'success');
            } catch {
              showToast('Could not delete the lead', 'error');
            }
            setMenuAnchor(null);
            setMenuFor(null);
          }}
          sx={{ color: '#DC2626' }}
        >
          <Trash2 size={15} style={{ marginRight: 9 }} /> Delete
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuFor) {
              navigate(`${detailPrefix}/${menuFor.id}`);
            }
            setMenuAnchor(null);
            setMenuFor(null);
          }}
          sx={{ color: '#1976D2' }}
        >
          <Edit size={15} style={{ marginRight: 9 }} /> Edit
        </MenuItem>
      </Menu>

      <NewApplicationDialog title="New Lead" open={createOpen} onClose={() => setCreateOpen(false)} />
      <NewApplicationDialog
        title="New Opportunity"
        submitLabel="Create Opportunity"
        initialStatus="APPLICATION"
        open={createOppOpen}
        onClose={() => setCreateOppOpen(false)}
      />

      {/* Bulk Action Dialog */}
      <Dialog open={bulkActionDialogOpen} onClose={() => setBulkActionDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#023020' }}>
          {bulkActionType === 'assign' && 'Assign Leads'}
          {bulkActionType === 'status' && 'Change Lead Status'}
          {bulkActionType === 'delete' && 'Delete Leads'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {bulkActionType === 'assign' && (
            <div>
              <div style={{ fontSize: 13, color: '#44584C', marginBottom: 12, fontWeight: 600 }}>
                Assign {selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''} to:
              </div>
              <Select
                fullWidth
                displayEmpty
                value={bulkAssigneeId || ''}
                onChange={(e) => setBulkAssigneeId(Number(e.target.value))}
                renderValue={(value) => (value ? users.find((u) => u.id === value)?.full_name ?? 'Select user' : 'Select user')}
              >
                <MenuItem value="">Select user</MenuItem>
                {users.map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </MenuItem>
                ))}
              </Select>
            </div>
          )}
          {bulkActionType === 'status' && (
            <div>
              <div style={{ fontSize: 13, color: '#44584C', marginBottom: 12, fontWeight: 600 }}>
                Change status for {selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''} to:
              </div>
              <Select
                fullWidth
                displayEmpty
                value={bulkStatusValue}
                onChange={(e) => setBulkStatusValue(e.target.value)}
                renderValue={(value) => (value ? value : 'Select status')}
              >
                <MenuItem value="">Select status</MenuItem>
                <MenuItem value="LEAD">Lead</MenuItem>
                <MenuItem value="APPLICATION">Application</MenuItem>
                <MenuItem value="VERIFICATION">Verification</MenuItem>
                <MenuItem value="FINANCE">Finance</MenuItem>
                <MenuItem value="REJECTED">Rejected</MenuItem>
              </Select>
            </div>
          )}
          {bulkActionType === 'delete' && (
            <div style={{ padding: '12px', background: '#FEF2F2', borderRadius: 8, border: '1px solid #FCE4EC' }}>
              <div style={{ fontSize: 13, color: '#C62828', fontWeight: 700, marginBottom: 8 }}>
                ⚠️ Warning
              </div>
              <div style={{ fontSize: 12, color: '#D32F2F' }}>
                This will permanently delete {selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''}. This action cannot be undone.
              </div>
            </div>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setBulkActionDialogOpen(false)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color={bulkActionType === 'delete' ? 'error' : 'primary'}
            onClick={handleBulkAction}
            disabled={
              (bulkActionType === 'assign' && !bulkAssigneeId) ||
              (bulkActionType === 'status' && !bulkStatusValue) ||
              assigningLeads ||
              changingStatus ||
              deletingLeads
            }
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {assigningLeads || changingStatus || deletingLeads ? 'Processing...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Universal Import Modal */}
      <UniversalImportModal
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        title={isOpportunityRoute ? 'Import Opportunities' : 'Import Leads'}
        entityName={isOpportunityRoute ? 'Opportunities' : 'Leads'}
        erpFields={[
          { key: 'customer_name', label: 'Customer Name', required: true },
          { key: 'phone', label: 'Mobile Number', required: true },
          { key: 'vehicle_model', label: 'Vehicle Model' },
          { key: 'loan_amount', label: 'Loan Amount' },
          { key: 'city', label: 'City' },
          { key: 'status', label: 'Status' },
        ]}
        onImport={(mappedRows) => {
          showToast(`Imported ${mappedRows.length} ${isOpportunityRoute ? 'opportunities' : 'leads'} successfully`, 'success');
          refetch();
          return mappedRows.length;
        }}
      />
    </div>
  );
}
