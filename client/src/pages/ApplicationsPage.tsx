import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Avatar, Button, IconButton, InputAdornment, Menu, MenuItem, Paper, Select, TextField } from '@mui/material';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Filter,
  MoreVertical,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';

import { useAppSelector } from '@/app/hooks';
import { useApplicationsQuery, useCreateApplicationMutation, useDeleteApplicationMutation } from '@/api/applicationsApi';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { LoadingRows } from '@/components/ui/PageState';
import { useToast } from '@/components/ui/ToastHost';
import { useTableSort } from '@/hooks/useTableSort';
import ErpSortHeaderCell from '@/components/ui/ErpSortHeaderCell';
import { formatAmount, formatDate, initialsOf } from '@/utils/format';
import type { ApplicationItem, ApplicationStatus } from '@/types';

const PAGE_SIZE = 10;

const STATUS_OPTIONS: { value: ApplicationStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'LEAD', label: 'Lead' },
  { value: 'APPLICATION', label: 'Application' },
  { value: 'VERIFICATION', label: 'Verification' },
  { value: 'FINANCE', label: 'Processing' },
  { value: 'QUERY', label: 'Query' },
  { value: 'SANCTIONED', label: 'Sanctioned' },
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'DISBURSEMENT', label: 'Disbursement' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function ApplicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const selectedStageKey = useAppSelector((state) => state.stageFilter.selectedStageKey);

  const tab = (searchParams.get('tab') ?? 'all') as 'all' | 'mine' | 'pending';
  const [page, setPage] = useState(1);
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [status, setStatus] = useState('');
  const [menuFor, setMenuFor] = useState<ApplicationItem | null>(null);
  const [menuAnchor] = useState<null | HTMLElement>(null);
  const [deleteApplication] = useDeleteApplicationMutation();
  const [createApplication] = useCreateApplicationMutation();

  const stageKey = tab === 'all' && selectedStageKey ? selectedStageKey : undefined;

  const { data, isFetching, isError, refetch } = useApplicationsQuery({
    page,
    page_size: PAGE_SIZE,
    tab,
    q: q || undefined,
    status: status || undefined,
    stage_key: stageKey,
  });

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tabs = data?.tab_counts ?? { all: 0, mine: 0, pending: 0 };

  const { sortState, handleSort, sortData } = useTableSort<ApplicationItem>();
  const sortedItems = useMemo(() => sortData(data?.items ?? []), [data?.items, sortData]);

  const pagesToShow = useMemo(() => {
    const pages: (number | '…')[] = [];
    for (let i = 1; i <= pageCount; i++) {
      if (i === 1 || i === pageCount || Math.abs(i - page) <= 1) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '…') {
        pages.push('…');
      }
    }
    return pages;
  }, [pageCount, page]);

  const setTab = (next: 'all' | 'mine' | 'pending') => {
    setPage(1);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', next);
    if (q.trim()) nextParams.set('q', q.trim());
    else nextParams.delete('q');
    setSearchParams(nextParams, { replace: true });
  };

  const quickCreate = async () => {
    try {
      const app = await createApplication({
        customer_name: 'New Lead',
        customer_phone: '9000000000',
        vehicle: 'Konwert EV Auto',
        amount: 400000,
        status: 'LEAD',
      }).unwrap();
      showToast(`Application ${app.app_no} created`, 'success');
    } catch {
      showToast('Could not create the application', 'error');
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 14,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3, color: '#023020' }}>Applications</div>
          <div style={{ fontSize: 13, color: '#7A8B80', marginTop: 3 }}>
            Search, filter and manage every application in the pipeline.
          </div>
        </div>
        <Button variant="contained" startIcon={<Plus size={16} />} onClick={quickCreate}>
          New Application
        </Button>
      </div>

      <Paper sx={{ border: '1px solid #E4EBE1', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E4EBE1', padding: '0 16px' }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'mine', label: 'Mine' },
            { key: 'pending', label: 'Pending' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as 'all' | 'mine' | 'pending')}
              style={{
                flex: 1,
                padding: '10px 14px',
                border: 'none',
                background: tab === t.key ? '#16C47F' : 'transparent',
                color: tab === t.key ? '#fff' : '#7A8B80',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                borderBottom: tab === t.key ? '2px solid #16C47F' : 'transparent',
              }}
            >
              {t.label} ({tabs[t.key as keyof typeof tabs] ?? 0})
            </button>
          ))}
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid #E4EBE1', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            variant="outlined"
            size="small"
            placeholder="Search applications..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} />
                </InputAdornment>
              ),
            }}
            style={{ minWidth: 220, flex: 1 }}
          />
          <Select
            size="small"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            displayEmpty
            inputProps={{ 'aria-label': 'Filter by status' }}
            style={{ minWidth: 160 }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
          <Button variant="outlined" startIcon={<Filter size={14} />} onClick={refetch} disabled={isFetching}>
            Apply
          </Button>
        </div>

        {isFetching && !data ? (
          <LoadingRows rows={PAGE_SIZE} />
        ) : isError ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#D9534F' }}>
            Could not load applications. Try again.
          </div>
        ) : (
          <>
            <div className="table-scroll-wrap scroll-touch" style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <ErpSortHeaderCell field="app_no" label="Application" sortState={sortState} onSort={handleSort} />
                    <ErpSortHeaderCell field="customer_name" label="Customer" sortState={sortState} onSort={handleSort} />
                    <ErpSortHeaderCell field="vehicle" label="Vehicle" sortState={sortState} onSort={handleSort} />
                    <ErpSortHeaderCell field="amount" label="Amount" align="right" sortState={sortState} onSort={handleSort} />
                    <ErpSortHeaderCell field="finance_company_name" label="Finance" sortState={sortState} onSort={handleSort} />
                    <ErpSortHeaderCell field="status" label="Status" sortState={sortState} onSort={handleSort} />
                    <ErpSortHeaderCell field="updated_at" label="Updated" sortState={sortState} onSort={handleSort} />
                    <ErpSortHeaderCell label="Actions" align="center" sortable={false} />
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((app) => {
                    const isUnassigned = app.assigned_to == null;
                    const urgent = isUnassigned;
                    return (
                      <tr key={app.id} style={{ borderBottom: '1px solid #ECF0ED' }}>
                        <td style={{ padding: '8px 14px', fontSize: 12, color: '#7A8B80' }}>{app.app_no}</td>
                        <td style={{ padding: '8px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar sx={{ width: 26, height: 26, fontSize: 11, bgcolor: urgent ? '#FEF3C6' : '#D1FAE5', color: urgent ? '#92400D' : '#065F46' }}>
                              {initialsOf(app.customer_name)}
                            </Avatar>
                            <span style={{ fontWeight: 500, color: '#16231B' }}>{app.customer_name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '8px 14px', color: '#44584C' }}>{app.vehicle}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', color: '#023020', fontWeight: 600 }}>
                          {formatAmount(app.amount)}
                        </td>
                        <td style={{ padding: '8px 14px', color: '#44584C' }}>{app.finance_company_name ?? <span style={{ color: '#9BA99F' }}>—</span>}</td>
                        <td style={{ padding: '8px 14px' }}><StatusBadge status={app.status} /></td>
                        <td style={{ padding: '8px 14px', fontSize: 12, color: '#7A8B80' }}>{formatDate(app.updated_at)}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                          <IconButton size="small" onClick={() => setMenuFor(app)}><MoreVertical size={16} /></IconButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {data?.items?.length === 0 && <EmptyState title="No applications found" hint="Adjust filters or create a new application." />}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #ECF0ED' }}>
              <div style={{ fontSize: 13, color: '#7A8B80' }}>
                Showing {((page - 1) * PAGE_SIZE) + 1}-{Math.min(page * PAGE_SIZE, total)} of {total}
              </div>
              <div style={{ display: 'flex', gap: 2 }}>
                <Button size="small" variant="outlined" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || isFetching}>
                  <ChevronLeft size={16} />
                </Button>
                {pagesToShow.map((p) =>
                  p === '…' ? (
                    <span key={`…`} style={{ padding: '4px 8px', fontSize: 13, color: '#9BA99F' }}>…</span>
                  ) : (
                    <Button
                      key={p}
                      size="small"
                      variant={p === page ? 'contained' : 'outlined'}
                      onClick={() => setPage(p)}
                      disabled={isFetching}
                      style={{ minWidth: 32 }}
                    >
                      {p}
                    </Button>
                  )
                )}
                <Button size="small" variant="outlined" onClick={() => setPage((p) => p + 1)} disabled={page >= pageCount || isFetching}>
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </>
        )}
      </Paper>

      {menuFor && menuAnchor && (
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuFor)}
          onClose={() => setMenuFor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem
            onClick={async () => {
              await deleteApplication(menuFor.id).unwrap();
              showToast(`Application ${menuFor.app_no} deleted`, 'success');
              setMenuFor(null);
              refetch();
            }}
          >
            <Trash2 size={14} style={{ marginRight: 6 }} />
            Delete
          </MenuItem>
          <MenuItem
            onClick={() => {
              navigator.clipboard.writeText(menuFor.app_no);
              showToast('Copied', 'success');
            }}
          >
            <Copy size={14} style={{ marginRight: 6 }} />
            Copy App No
          </MenuItem>
          <MenuItem
            onClick={() =>
              window.open(`mailto:${menuFor.customer_phone}`, '_blank')
            }
          >
            <Eye size={14} style={{ marginRight: 6 }} />
            Contact
          </MenuItem>
          <MenuItem
            onClick={() =>
              window.open(`tel:${menuFor.customer_phone}`, '_blank')
            }
          >
            <Building2 size={14} style={{ marginRight: 6 }} />
            Call
          </MenuItem>
        </Menu>
      )}
    </div>
  );
}
