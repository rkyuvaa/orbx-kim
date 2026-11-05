import { Alert, Box, Button, Paper } from '@mui/material';
import { Info } from 'lucide-react';

import {
  useDeliveriesQuery,
  useDisbursementsQuery,
  useDocumentsQuery,
  useFinanceSubmissionsQuery,
  useSanctionsQuery,
  useVerificationsQuery,
} from '@/api/reportsApi';
import EmptyState from '@/components/ui/EmptyState';
import { LoadingRows } from '@/components/ui/PageState';
import { formatDate, initialsOf } from '@/utils/format';
import type { StageRow } from '@/types';

type Section = 'documents' | 'verification' | 'finance' | 'sanction' | 'delivery' | 'disbursement';

const CONFIG: Record<
  Section,
  { title: string; subtitle: string; columns: { key: string; label: string }[] }
> = {
  documents: {
    title: 'Documents',
    subtitle: 'Upload & manage customer documents for every application.',
    columns: [
      { key: 'app_no', label: 'App' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'doc_type', label: 'Document' },
      { key: 'status', label: 'Status' },
      { key: 'uploaded_at', label: 'Uploaded' },
    ],
  },
  verification: {
    title: 'Verification',
    subtitle: 'Review customer KYC and income documents.',
    columns: [
      { key: 'app_no', label: 'App' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'status', label: 'Status' },
      { key: 'notes', label: 'Notes' },
      { key: 'verified_at', label: 'Verified' },
    ],
  },
  finance: {
    title: 'Finance',
    subtitle: 'Submissions, approvals and queries with finance companies.',
    columns: [
      { key: 'app_no', label: 'App' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'status', label: 'Status' },
      { key: 'query_note', label: 'Query note' },
      { key: 'submitted_at', label: 'Submitted' },
    ],
  },
  sanction: {
    title: 'Sanction',
    subtitle: 'Sanctioned loans ready for the next stage.',
    columns: [
      { key: 'app_no', label: 'App' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'status', label: 'Status' },
      { key: 'sanctioned_at', label: 'Sanctioned' },
    ],
  },
  delivery: {
    title: 'Delivery',
    subtitle: 'Vehicle deliveries scheduled and completed.',
    columns: [
      { key: 'app_no', label: 'App' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'status', label: 'Status' },
      { key: 'delivered_at', label: 'Delivered' },
    ],
  },
  disbursement: {
    title: 'Disbursement',
    subtitle: 'UTR entry and disbursement tracking.',
    columns: [
      { key: 'app_no', label: 'App' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'status', label: 'Status' },
      { key: 'utr_no', label: 'UTR' },
      { key: 'disbursed_at', label: 'Disbursed' },
    ],
  },
};

const HOOKS: Record<Section, () => { data?: StageRow[]; isFetching: boolean; isError: boolean; refetch: () => void }> = {
  documents: () => useDocumentsQuery(),
  verification: () => useVerificationsQuery(),
  finance: () => useFinanceSubmissionsQuery(),
  sanction: () => useSanctionsQuery(),
  delivery: () => useDeliveriesQuery(),
  disbursement: () => useDisbursementsQuery(),
};

export default function GenericStagePage({ section }: { section: Section }) {
  const config = CONFIG[section];
  const { data, isFetching, isError, refetch } = HOOKS[section]();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3, color: '#023020' }}>{config.title}</div>
          <div style={{ fontSize: 13, color: '#7A8B80', marginTop: 3 }}>{config.subtitle}</div>
        </div>
      </div>

      <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }} icon={<Info size={16} />}>
        Full CRUD workflows for {config.title.toLowerCase()} arrive in a later phase. Seed data shown below.
      </Alert>

      <Paper sx={{ border: '1px solid #E4EBE1', borderRadius: '14px', overflow: 'hidden' }}>
        <div className="table-scroll-wrap scroll-touch" style={{ overflowX: 'auto', width: '100%' }}>
          {isFetching && !data ? (
            <LoadingRows rows={6} />
          ) : isError ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Button variant="outlined" onClick={refetch}>
                Retry
              </Button>
            </Box>
          ) : !data || data.length === 0 ? (
            <EmptyState title={`No ${config.title.toLowerCase()} yet`} hint="Records will appear here as applications move through the pipeline." />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr>
                  {config.columns.map((col) => (
                    <th
                      key={col.key}
                      style={{
                        background: '#F2FAF0',
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#7A8B80',
                        textTransform: 'uppercase',
                        letterSpacing: 0.6,
                        textAlign: 'left',
                        padding: '10px 16px',
                        borderBottom: '1px solid #E4EBE1',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id}>
                    {config.columns.map((col) => {
                      const value = row[col.key];
                      if (col.key === 'app_no') {
                        return (
                          <td key={col.key} style={{ padding: '11px 16px', borderBottom: '1px solid #F0F4EE' }}>
                            <span className="app-id">{value}</span>
                          </td>
                        );
                      }
                      if (col.key === 'customer_name') {
                        return (
                          <td key={col.key} style={{ padding: '11px 16px', borderBottom: '1px solid #F0F4EE' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: '50%',
                                  background: '#EAF6E8',
                                  color: '#04552B',
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {initialsOf(String(value ?? ''))}
                              </span>
                              <span style={{ fontWeight: 600, color: '#16231B', fontSize: 13 }}>{value}</span>
                            </div>
                          </td>
                        );
                      }
                      if (col.key.endsWith('_at') && value) {
                        return (
                          <td key={col.key} style={{ padding: '11px 16px', borderBottom: '1px solid #F0F4EE', color: '#7A8B80', fontSize: 12 }}>
                            {formatDate(String(value))}
                          </td>
                        );
                      }
                      return (
                        <td
                          key={col.key}
                          style={{
                            padding: '11px 16px',
                            borderBottom: '1px solid #F0F4EE',
                            color: col.key === 'status' ? '#04552B' : '#44584C',
                            fontWeight: col.key === 'status' ? 600 : 400,
                            fontSize: 12,
                          }}
                        >
                          {value || '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Paper>
    </div>
  );
}
