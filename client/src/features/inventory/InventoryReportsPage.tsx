import { Box, Paper, Tab, Tabs, Typography } from '@mui/material';

import EmptyState from '@/components/ui/EmptyState';
import { ErrorState, PageLoader } from '@/components/ui/PageState';
import {
  useReportLowStockQuery,
  useReportNonMovingQuery,
  useReportPurchaseHistoryQuery,
  useReportReturnsAdjustmentsQuery,
  useReportUsageQuery,
  useReportValuationQuery,
} from '@/api/inventoryApi';
import { useState } from 'react';

const money = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function InventoryReportsPage() {
  const [tab, setTab] = useState(0);
  return (
    <Box sx={{ pb: 6, width: '100%' }}>
      <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#023020', mb: 0.5 }}>Inventory Reports</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
        <Tab label="Valuation" />
        <Tab label="Low Stock" />
        <Tab label="Non-Moving" />
        <Tab label="Parts Usage" />
        <Tab label="Purchase History" />
        <Tab label="Returns & Adjustments" />
      </Tabs>
      {tab === 0 && <ValuationReport />}
      {tab === 1 && <LowStockReport />}
      {tab === 2 && <NonMovingReport />}
      {tab === 3 && <UsageReport />}
      {tab === 4 && <PurchaseHistoryReport />}
      {tab === 5 && <ReturnsAdjustmentsReport />}
    </Box>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <Paper variant="outlined" sx={{ borderColor: '#E4EBE1', borderRadius: 2, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#F7FAF6' }}>
            {headers.map((h) => <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, color: '#7A8B80', textTransform: 'uppercase' }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: '1px solid #F0F4EE' }}>
              {r.map((c, j) => <td key={j} style={{ padding: '10px 16px', fontSize: 13 }}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </Paper>
  );
}

function ValuationReport() {
  const { data = [], isLoading, isError, refetch } = useReportValuationQuery();
  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorState onRetry={refetch} />;
  if (data.length === 0) return <EmptyState title="No stock to value" hint="Approved receipts build stock value." />;
  const total = data.reduce((s, r) => s + r.total_value, 0);
  return (
    <Box>
      <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#023020', mb: 1 }}>Total Stock Value: {money(total)}</Typography>
      <Table headers={['SKU', 'Name', 'Qty', 'Avg Cost', 'Value']} rows={data.map((r) => [r.sku, r.name, r.qty, money(r.avg_cost), money(r.total_value)])} />
    </Box>
  );
}

function LowStockReport() {
  const { data = [], isLoading, isError, refetch } = useReportLowStockQuery();
  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorState onRetry={refetch} />;
  if (data.length === 0) return <EmptyState title="No low-stock items" hint="All items are above reorder level." />;
  return <Table headers={['SKU', 'Name', 'Available', 'Reorder Level', 'Reorder Qty']} rows={data.map((r) => [r.sku, r.name, r.available_qty, r.reorder_level, r.reorder_qty])} />;
}

function NonMovingReport() {
  const { data = [], isLoading, isError, refetch } = useReportNonMovingQuery({ days: 90 });
  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorState onRetry={refetch} />;
  if (data.length === 0) return <EmptyState title="No non-moving items" hint="All stocked items moved within 90 days." />;
  return <Table headers={['SKU', 'Name', 'Qty', 'Last Move']} rows={data.map((r) => [r.sku, r.name, r.qty, r.last_move_date ? new Date(r.last_move_date).toLocaleDateString('en-IN') : 'Never'])} />;
}

function UsageReport() {
  const { data = [], isLoading, isError, refetch } = useReportUsageQuery();
  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorState onRetry={refetch} />;
  if (data.length === 0) return <EmptyState title="No parts usage" hint="Approved parts issues appear here." />;
  return <Table headers={['SKU', 'Name', 'Qty Used', 'Total Cost']} rows={data.map((r) => [r.sku, r.name, r.qty, money(r.total_cost)])} />;
}

function PurchaseHistoryReport() {
  const { data = [], isLoading, isError, refetch } = useReportPurchaseHistoryQuery();
  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorState onRetry={refetch} />;
  if (data.length === 0) return <EmptyState title="No purchase history" hint="Approved goods receipts appear here." />;
  return <Table headers={['GR Number', 'Supplier', 'Date', 'Lines']} rows={data.map((r) => [r.gr_number, r.supplier_id, r.receipt_date, r.lines.length])} />;
}

function ReturnsAdjustmentsReport() {
  const { data = [], isLoading, isError, refetch } = useReportReturnsAdjustmentsQuery();
  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorState onRetry={refetch} />;
  if (data.length === 0) return <EmptyState title="No returns or adjustments" hint="Approved returns and adjustments appear here." />;
  return <Table headers={['Type', 'Number', 'Detail', 'Date']} rows={data.map((r: any) => [r.type, r.number, r.return_type || r.adjustment_type, r.date || '-'])} />;
}