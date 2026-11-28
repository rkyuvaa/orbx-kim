import { AlertTriangle, Boxes, ClipboardList, Package, Receipt, TrendingUp, Wrench } from 'lucide-react';
import { Box, Chip, Paper, Typography } from '@mui/material';

import KpiCard from '@/components/ui/KpiCard';
import EmptyState from '@/components/ui/EmptyState';
import { ErrorState, PageLoader, PanelHead } from '@/components/ui/PageState';
import { useInventoryDashboardQuery } from '@/api/inventoryApi';

const money = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function InventoryDashboardPage() {
  const { data, isLoading, isError, refetch } = useInventoryDashboardQuery();

  if (isLoading) return <PageLoader />;
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  return (
    <Box sx={{ pb: 6, width: '100%' }}>
      <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#023020', mb: 0.5 }}>
        Inventory Dashboard
      </Typography>
      <Typography sx={{ fontSize: 13, color: '#667085', mb: 3 }}>
        Stock health, purchasing pipeline and parts issued to open service jobs.
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <KpiCard icon={<TrendingUp size={20} />} iconBg="#E7F7EF" iconColor="#16C47F" label="Stock Value" value={money(data.total_stock_value)} sub="Valuation at moving cost" />
        <KpiCard icon={<AlertTriangle size={20} />} iconBg="#FEF3E7" iconColor="#F79009" label="Low Stock" value={data.low_stock.length} sub="At or below reorder level" />
        <KpiCard icon={<Package size={20} />} iconBg="#FDECEC" iconColor="#F04438" label="Out of Stock" value={data.out_of_stock.length} sub="No available balance" />
        <KpiCard icon={<ClipboardList size={20} />} iconBg="#EAF1FE" iconColor="#3B82F6" label="Pending POs" value={data.pending_purchase_orders.length} sub="Awaiting approval" />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2, mb: 2 }}>
        <Paper variant="outlined" sx={{ borderColor: '#E4EBE1', borderRadius: 2, overflow: 'hidden' }}>
          <PanelHead icon={<AlertTriangle size={14} />} title="Low & Out of Stock" />
          {data.low_stock.length === 0 && data.out_of_stock.length === 0 ? (
            <EmptyState title="No stock alerts" hint="All items are above their reorder levels." />
          ) : (
            <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {data.out_of_stock.map((i) => (
                <Row key={`o-${i.item_id}`} sku={i.sku} name={i.name} qty={i.available_qty} tone="error" />
              ))}
              {data.low_stock.map((i) => (
                <Row key={`l-${i.item_id}`} sku={i.sku} name={i.name} qty={i.available_qty} tone="warning" />
              ))}
            </Box>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ borderColor: '#E4EBE1', borderRadius: 2, overflow: 'hidden' }}>
          <PanelHead icon={<Receipt size={14} />} title="Pending Goods Receipts" />
          {data.pending_goods_receipts.length === 0 ? (
            <EmptyState title="No pending receipts" hint="Goods receipts awaiting approval will appear here." />
          ) : (
            <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {data.pending_goods_receipts.map((d) => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#16231B' }}>{d.number}</span>
                  <Chip size="small" label={d.date || ''} sx={{ height: 20, fontSize: 11 }} />
                </div>
              ))}
            </Box>
          )}
        </Paper>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
        <Paper variant="outlined" sx={{ borderColor: '#E4EBE1', borderRadius: 2, overflow: 'hidden' }}>
          <PanelHead icon={<Wrench size={14} />} title="Parts Issued to Open Jobs" />
          {data.issued_to_open_jobs.length === 0 ? (
            <EmptyState title="No parts issued to open jobs" hint="Approved parts issues appear here." />
          ) : (
            <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {data.issued_to_open_jobs.map((j) => (
                <div key={j.issue_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 4px' }}>
                  <span style={{ fontSize: 13, color: '#16231B' }}>
                    {j.complaint_no} · {j.issue_number}
                  </span>
                  <span style={{ fontSize: 12, color: '#7A8B80' }}>{money(j.total_cost)}</span>
                </div>
              ))}
            </Box>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ borderColor: '#E4EBE1', borderRadius: 2, overflow: 'hidden' }}>
          <PanelHead icon={<Boxes size={14} />} title="Recent Stock Movements" />
          {data.recent_movements.length === 0 ? (
            <EmptyState title="No stock movements yet" hint="Receipts, issues and transfers will appear here." />
          ) : (
            <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {data.recent_movements.map((m) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px' }}>
                  <span style={{ fontSize: 13, color: '#16231B' }}>{m.item_name}</span>
                  <span style={{ fontSize: 12, color: m.qty >= 0 ? '#16C47F' : '#F04438', fontWeight: 600 }}>
                    {m.qty >= 0 ? '+' : ''}{m.qty}
                  </span>
                </div>
              ))}
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}

function Row({ sku, name, qty, tone }: { sku: string; name: string; qty: number; tone: 'error' | 'warning' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px' }}>
      <span style={{ fontSize: 13, color: '#16231B' }}>
        {name} <span style={{ color: '#9BA99F', fontSize: 11 }}>({sku})</span>
      </span>
      <Chip size="small" color={tone} label={`${qty} left`} sx={{ height: 20, fontSize: 11 }} />
    </div>
  );
}