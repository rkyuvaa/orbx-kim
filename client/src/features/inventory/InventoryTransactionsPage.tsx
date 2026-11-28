import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Plus } from 'lucide-react';

import EmptyState from '@/components/ui/EmptyState';
import { ErrorState, PageLoader } from '@/components/ui/PageState';
import { useToast } from '@/components/ui/ToastHost';
import {
  useApproveAdjustmentMutation,
  useApproveGoodsReceiptMutation,
  useApproveIssueMutation,
  useApprovePurchaseOrderMutation,
  useApprovePurchaseRequestMutation,
  useApproveReturnMutation,
  useApproveTransferMutation,
  useCancelAdjustmentMutation,
  useCancelGoodsReceiptMutation,
  useCancelIssueMutation,
  useCancelPurchaseOrderMutation,
  useCancelPurchaseRequestMutation,
  useCancelReturnMutation,
  useCancelTransferMutation,
  useCreateAdjustmentMutation,
  useCreateGoodsReceiptMutation,
  useCreateIssueMutation,
  useCreatePurchaseOrderMutation,
  useCreatePurchaseRequestMutation,
  useCreateReturnMutation,
  useCreateTransferMutation,
  useListAdjustmentsQuery,
  useListBinsQuery,
  useListGoodsReceiptsQuery,
  useListIssuesQuery,
  useListItemsQuery,
  useListLocationsQuery,
  useListPurchaseOrdersQuery,
  useListPurchaseRequestsQuery,
  useListReturnsQuery,
  useListStoresQuery,
  useListSuppliersQuery,
  useListTransfersQuery,
  useSubmitAdjustmentMutation,
  useSubmitGoodsReceiptMutation,
  useSubmitIssueMutation,
  useSubmitPurchaseOrderMutation,
  useSubmitPurchaseRequestMutation,
  useSubmitReturnMutation,
  useSubmitTransferMutation,
} from '@/api/inventoryApi';
import type { InvDocStatus } from '@/types/inventory';

const money = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const TABS = [
  { key: 'pr', label: 'Purchase Requests' },
  { key: 'po', label: 'Purchase Orders' },
  { key: 'gr', label: 'Goods Receipts' },
  { key: 'issue', label: 'Parts Issues' },
  { key: 'return', label: 'Returns' },
  { key: 'transfer', label: 'Transfers' },
  { key: 'adjustment', label: 'Adjustments' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function InventoryTransactionsPage() {
  const [tab, setTab] = useState<TabKey>('gr');
  const [createOpen, setCreateOpen] = useState(false);

  const pr = useListPurchaseRequestsQuery();
  const po = useListPurchaseOrdersQuery();
  const gr = useListGoodsReceiptsQuery();
  const issue = useListIssuesQuery();
  const ret = useListReturnsQuery();
  const transfer = useListTransfersQuery();
  const adj = useListAdjustmentsQuery();

  const current = { pr, po, gr, issue, return: ret, transfer, adjustment: adj }[tab];

  return (
    <Box sx={{ p: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#023020' }}>Inventory Transactions</Typography>
        <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
          New {TABS.find((t) => t.key === tab)?.label.replace(/s$/, '')}
        </Button>
      </div>
      <Typography sx={{ fontSize: 13, color: '#667085', mb: 2 }}>
        Every transaction requires approval before it posts stock. Only approved documents affect balances.
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
        {TABS.map((t) => <Tab key={t.key} value={t.key} label={t.label} />)}
      </Tabs>

      {current.isLoading ? <PageLoader /> : current.isError ? <ErrorState onRetry={current.refetch} /> : (
        <DocList tab={tab} data={current.data as any[]} />
      )}

      {createOpen && <CreateDocDialog tab={tab} onClose={() => setCreateOpen(false)} />}
    </Box>
  );
}

function StatusChip({ status }: { status: InvDocStatus }) {
  const color: any = { DRAFT: 'default', PENDING_APPROVAL: 'warning', APPROVED: 'success', CANCELLED: 'error' }[status] || 'default';
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: { DRAFT: '#EEF2F0', PENDING_APPROVAL: '#FEF3E7', APPROVED: '#E7F7EF', CANCELLED: '#FDECEC' }[status], color: { DRAFT: '#667085', PENDING_APPROVAL: '#B54708', APPROVED: '#067647', CANCELLED: '#B42318' }[status] }}>{status.replace('_', ' ')}</span>;
}

function numberField(tab: TabKey, d: any): string {
  return ({ pr: d.pr_number, po: d.po_number, gr: d.gr_number, issue: d.issue_number, return: d.return_number, transfer: d.transfer_number, adjustment: d.adj_number } as any)[tab];
}
function dateField(tab: TabKey, d: any): string | null {
  return ({ pr: null, po: d.expected_date, gr: d.receipt_date, issue: d.issue_date, return: d.return_date, transfer: d.transfer_date, adjustment: d.adj_date } as any)[tab];
}

function DocList({ tab, data }: { tab: TabKey; data: any[] }) {
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<number | null>(null);

  const submit = {
    pr: useSubmitPurchaseRequestMutation(), po: useSubmitPurchaseOrderMutation(), gr: useSubmitGoodsReceiptMutation(),
    issue: useSubmitIssueMutation(), return: useSubmitReturnMutation(), transfer: useSubmitTransferMutation(), adjustment: useSubmitAdjustmentMutation(),
  }[tab];
  const approve = {
    pr: useApprovePurchaseRequestMutation(), po: useApprovePurchaseOrderMutation(), gr: useApproveGoodsReceiptMutation(),
    issue: useApproveIssueMutation(), return: useApproveReturnMutation(), transfer: useApproveTransferMutation(), adjustment: useApproveAdjustmentMutation(),
  }[tab];
  const cancel = {
    pr: useCancelPurchaseRequestMutation(), po: useCancelPurchaseOrderMutation(), gr: useCancelGoodsReceiptMutation(),
    issue: useCancelIssueMutation(), return: useCancelReturnMutation(), transfer: useCancelTransferMutation(), adjustment: useCancelAdjustmentMutation(),
  }[tab];

  if (data.length === 0) {
    return <EmptyState title="No transactions yet" hint="Create a transaction to get started." />;
  }

  const run = async (fn: any, id: number, label: string) => {
    setBusyId(id);
    try {
      await fn(id).unwrap();
      showToast(`${label} successful.`, 'success');
    } catch (e: any) {
      showToast(e?.data?.detail || `${label} failed.`, 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Paper variant="outlined" sx={{ borderColor: '#E4EBE1', borderRadius: 2, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#F7FAF6' }}>
            {['Number', 'Date', 'Status', 'Actions'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, color: '#7A8B80', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => {
            const editable = d.status === 'DRAFT' || d.status === 'PENDING_APPROVAL';
            return (
              <tr key={d.id} style={{ borderTop: '1px solid #F0F4EE' }}>
                <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{numberField(tab, d)}</td>
                <td style={{ padding: '10px 16px', fontSize: 12, color: '#7A8B80' }}>{dateField(tab, d) || '-'}</td>
                <td style={{ padding: '10px 16px' }}><StatusChip status={d.status} /></td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {d.status === 'DRAFT' && <Button size="small" disabled={busyId === d.id} onClick={() => run(submit[0], d.id, 'Submitted')}>Submit</Button>}
                    {editable && <Button size="small" variant="contained" disabled={busyId === d.id} onClick={() => run(approve[0], d.id, 'Approved')}>Approve</Button>}
                    {editable && <Button size="small" color="error" disabled={busyId === d.id} onClick={() => run(cancel[0], d.id, 'Cancelled')}>Cancel</Button>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Create dialog
// ---------------------------------------------------------------------------
function CreateDocDialog({ tab, onClose }: { tab: TabKey; onClose: () => void }) {
  const { showToast } = useToast();
  const { data: items = [] } = useListItemsQuery({ is_active: true });
  const { data: suppliers = [] } = useListSuppliersQuery();
  const { data: stores = [] } = useListStoresQuery();
  const { data: locations = [] } = useListLocationsQuery();
  const { data: bins = [] } = useListBinsQuery();

  const createMut = {
    pr: useCreatePurchaseRequestMutation(), po: useCreatePurchaseOrderMutation(), gr: useCreateGoodsReceiptMutation(),
    issue: useCreateIssueMutation(), return: useCreateReturnMutation(), transfer: useCreateTransferMutation(), adjustment: useCreateAdjustmentMutation(),
  }[tab];

  const today = new Date().toISOString().slice(0, 10);
  const [header, setHeader] = useState<any>({ date: today, supplier_id: '', complaint_id: '', from_store_id: '', to_store_id: '', return_type: 'FROM_JOB', adjustment_type: 'DAMAGE', reason: '' });
  const [lines, setLines] = useState<any[]>([emptyLine()]);

  function emptyLine() {
    return { item_id: '', qty: 1, batch_no: '', serial_no: '', unit_cost: 0, store_id: '', location_id: '', bin_id: '', from_location_id: '', from_bin_id: '', to_location_id: '', to_bin_id: '' };
  }

  const setLine = (idx: number, patch: any) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const buildBody = () => {
    const baseLines = lines.map((l) => {
      const o: any = { item_id: Number(l.item_id), qty: Number(l.qty), batch_no: l.batch_no || '', serial_no: l.serial_no || '' };
      if (tab === 'gr' || tab === 'adjustment') { o.unit_cost = Number(l.unit_cost); o.store_id = Number(l.store_id); o.location_id = Number(l.location_id); o.bin_id = Number(l.bin_id); }
      if (tab === 'gr') o.expiry_date = null;
      if (tab === 'issue' || tab === 'return') { o.store_id = Number(l.store_id); o.location_id = Number(l.location_id); o.bin_id = Number(l.bin_id); }
      if (tab === 'transfer') { o.from_location_id = Number(l.from_location_id); o.from_bin_id = Number(l.from_bin_id); o.to_location_id = Number(l.to_location_id); o.to_bin_id = Number(l.to_bin_id); }
      return o;
    });
    if (tab === 'pr') return { supplier_id: header.supplier_id ? Number(header.supplier_id) : null, lines: baseLines.map((l) => ({ item_id: l.item_id, qty: l.qty, est_unit_price: 0 })) };
    if (tab === 'po') return { supplier_id: Number(header.supplier_id), expected_date: header.date || null, lines: baseLines.map((l) => ({ item_id: l.item_id, qty: l.qty, unit_price: 0 })) };
    if (tab === 'gr') return { supplier_id: Number(header.supplier_id), receipt_date: header.date, lines: baseLines };
    if (tab === 'issue') return { complaint_id: Number(header.complaint_id), issue_date: header.date, lines: baseLines };
    if (tab === 'return') return { return_type: header.return_type, return_date: header.date, lines: baseLines };
    if (tab === 'transfer') return { from_store_id: Number(header.from_store_id), to_store_id: Number(header.to_store_id), transfer_date: header.date, lines: baseLines };
    return { adjustment_type: header.adjustment_type, reason: header.reason || null, adj_date: header.date, lines: baseLines };
  };

  const save = async () => {
    try {
      await createMut[0](buildBody()).unwrap();
      showToast('Transaction created.', 'success');
      onClose();
    } catch (e: any) {
      showToast(e?.data?.detail || 'Failed to create transaction.', 'error');
    }
  };

  const needsSupplier = tab === 'po' || tab === 'gr' || tab === 'pr';
  const storeLocBin = tab === 'gr' || tab === 'issue' || tab === 'return' || tab === 'adjustment';
  const showCost = tab === 'gr' || tab === 'adjustment';

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>New {TABS.find((t) => t.key === tab)?.label.replace(/s$/, '')}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, pt: 1 }}>
          {needsSupplier && (
            <TextField select label="Supplier" value={header.supplier_id} onChange={(e) => setHeader({ ...header, supplier_id: e.target.value })}>
              {suppliers.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
          )}
          {tab === 'issue' && (
            <TextField label="Service Job (Complaint ID)" value={header.complaint_id} onChange={(e) => setHeader({ ...header, complaint_id: e.target.value })} />
          )}
          {tab === 'return' && (
            <TextField select label="Return Type" value={header.return_type} onChange={(e) => setHeader({ ...header, return_type: e.target.value })}>
              <MenuItem value="FROM_JOB">From Job</MenuItem>
              <MenuItem value="TO_SUPPLIER">To Supplier</MenuItem>
            </TextField>
          )}
          {tab === 'adjustment' && (
            <TextField select label="Adjustment Type" value={header.adjustment_type} onChange={(e) => setHeader({ ...header, adjustment_type: e.target.value })}>
              <MenuItem value="DAMAGE">Damage</MenuItem>
              <MenuItem value="WRITE_OFF">Write Off</MenuItem>
              <MenuItem value="COUNT">Count</MenuItem>
              <MenuItem value="OTHER">Other</MenuItem>
            </TextField>
          )}
          {tab === 'transfer' ? (
            <>
              <TextField select label="From Store" value={header.from_store_id} onChange={(e) => setHeader({ ...header, from_store_id: e.target.value })}>
                {stores.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </TextField>
              <TextField select label="To Store" value={header.to_store_id} onChange={(e) => setHeader({ ...header, to_store_id: e.target.value })}>
                {stores.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </TextField>
            </>
          ) : tab !== 'pr' && tab !== 'po' ? (
            <TextField label={tab === 'gr' ? 'Receipt Date' : tab === 'issue' ? 'Issue Date' : tab === 'return' ? 'Return Date' : 'Date'} type="date" value={header.date} onChange={(e) => setHeader({ ...header, date: e.target.value })} InputLabelProps={{ shrink: true }} />
          ) : null}
          {tab === 'adjustment' && (
            <TextField label="Reason" value={header.reason} onChange={(e) => setHeader({ ...header, reason: e.target.value })} />
          )}
        </Box>

        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#7A8B80', textTransform: 'uppercase', mt: 2, mb: 1 }}>Lines</Typography>
        {lines.map((l, idx) => (
          <Box key={idx} sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 1.5, mb: 1.5, alignItems: 'center' }}>
            <TextField select size="small" label="Item" value={l.item_id} onChange={(e) => setLine(idx, { item_id: e.target.value })}>
              {items.map((i) => <MenuItem key={i.id} value={i.id}>{i.name} ({i.sku})</MenuItem>)}
            </TextField>
            <TextField size="small" label="Qty" type="number" value={l.qty} onChange={(e) => setLine(idx, { qty: e.target.value })} />
            {showCost && <TextField size="small" label="Unit Cost" type="number" value={l.unit_cost} onChange={(e) => setLine(idx, { unit_cost: e.target.value })} />}
            {storeLocBin && (
              <TextField select size="small" label="Store" value={l.store_id} onChange={(e) => setLine(idx, { store_id: e.target.value })}>
                {stores.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </TextField>
            )}
            {tab === 'transfer' && (
              <>
                <TextField select size="small" label="From Loc" value={l.from_location_id} onChange={(e) => setLine(idx, { from_location_id: e.target.value })}>
                  {locations.map((loc) => <MenuItem key={loc.id} value={loc.id}>{loc.name}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="To Loc" value={l.to_location_id} onChange={(e) => setLine(idx, { to_location_id: e.target.value })}>
                  {locations.map((loc) => <MenuItem key={loc.id} value={loc.id}>{loc.name}</MenuItem>)}
                </TextField>
              </>
            )}
            {storeLocBin && (
              <>
                <TextField select size="small" label="Location" value={l.location_id} onChange={(e) => setLine(idx, { location_id: e.target.value })}>
                  {locations.map((loc) => <MenuItem key={loc.id} value={loc.id}>{loc.name}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Bin" value={l.bin_id} onChange={(e) => setLine(idx, { bin_id: e.target.value })}>
                  {bins.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                </TextField>
              </>
            )}
            <Button size="small" color="error" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>Remove</Button>
          </Box>
        ))}
        <Button size="small" startIcon={<Plus size={14} />} onClick={() => setLines((prev) => [...prev, emptyLine()])}>Add Line</Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={createMut[1].isLoading} onClick={save}>Create</Button>
      </DialogActions>
    </Dialog>
  );
}