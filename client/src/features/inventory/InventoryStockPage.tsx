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
import { Package } from 'lucide-react';

import EmptyState from '@/components/ui/EmptyState';
import { ErrorState, PageLoader } from '@/components/ui/PageState';
import { useToast } from '@/components/ui/ToastHost';
import {
  useCreateItemMutation,
  useDeleteItemMutation,
  useListBalancesQuery,
  useListCategoriesQuery,
  useListItemsQuery,
  useListMovesQuery,
  useListStoresQuery,
  useUpdateItemMutation,
} from '@/api/inventoryApi';
import type { InvItem } from '@/types/inventory';

const money = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function InventoryStockPage() {
  const [tab, setTab] = useState(0);
  return (
    <Box sx={{ pb: 6, width: '100%' }}>
      <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#023020', mb: 0.5 }}>Inventory Stock</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Catalogue" />
        <Tab label="Stock by Location" />
        <Tab label="Movement History" />
      </Tabs>
      {tab === 0 && <CatalogueTab />}
      {tab === 1 && <BalancesTab />}
      {tab === 2 && <MovesTab />}
    </Box>
  );
}

function CatalogueTab() {
  const { showToast } = useToast();
  const { data: items = [], isLoading, isError, refetch } = useListItemsQuery({ is_active: true });
  const { data: categories = [] } = useListCategoriesQuery();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InvItem | null>(null);
  const [createItem, { isLoading: saving }] = useCreateItemMutation();
  const [updateItem] = useUpdateItemMutation();
  const [deleteItem] = useDeleteItemMutation();

  const emptyForm = {
    name: '',
    category_id: null as number | null,
    item_type: 'GOODS',
    tracking_mode: 'BY_QUANTITY',
    sales_price: 0,
    sales_tax_pct: 0,
    purchase_price: 0,
    purchase_tax_pct: 0,
    internal_reference: '',
    barcode: '',
    hsn_sac_code: '',
  };
  const [form, setForm] = useState<any>(emptyForm);

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorState onRetry={refetch} />;

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (it: InvItem) => {
    setEditing(it);
    setForm({
      name: it.name,
      category_id: it.category_id,
      item_type: it.item_type || 'GOODS',
      tracking_mode: it.tracking_mode || 'BY_QUANTITY',
      sales_price: it.sales_price ?? 0,
      sales_tax_pct: it.sales_tax_pct ?? 0,
      purchase_price: it.purchase_price ?? 0,
      purchase_tax_pct: it.purchase_tax_pct ?? 0,
      internal_reference: it.internal_reference || '',
      barcode: it.barcode || '',
      hsn_sac_code: it.hsn_sac_code || '',
    });
    setOpen(true);
  };

  const save = async () => {
    try {
      if (editing) {
        await updateItem({ id: editing.id, body: form }).unwrap();
        showToast('Item updated.', 'success');
      } else {
        await createItem(form).unwrap();
        showToast('Item created.', 'success');
      }
      setOpen(false);
    } catch (e: any) {
      showToast(e?.data?.detail || 'Failed to save item.', 'error');
    }
  };

  const remove = async (it: InvItem) => {
    if (!window.confirm(`Delete item ${it.name}?`)) return;
    try {
      await deleteItem(it.id).unwrap();
      showToast('Item deleted.', 'success');
    } catch (e: any) {
      showToast(e?.data?.detail || 'Failed to delete item.', 'error');
    }
  };

  return (
    <Paper variant="outlined" sx={{ borderColor: '#E4EBE1', borderRadius: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #E4EBE1' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#7A8B80', textTransform: 'uppercase', letterSpacing: 0.6 }}>Parts Catalogue</span>
        <Button size="small" variant="contained" onClick={openAdd}>Add Item</Button>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No items yet" hint="Add parts and consumables to start tracking stock." />
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F7FAF6' }}>
                {['SKU', 'Name', 'Type', 'Tracking', 'Current Stock', 'Sales Price', 'Purchase Cost', 'Actions'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, color: '#7A8B80', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} style={{ borderTop: '1px solid #F0F4EE' }}>
                  <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{i.sku}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{i.name}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{i.item_type}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: '#7A8B80' }}>{i.tracking_mode === 'BY_SERIAL_NUMBER' ? 'By Serial Number' : 'By Quantity'}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{i.current_stock_qty}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{money(i.sales_price)}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{money(i.purchase_price)}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button size="small" onClick={() => openEdit(i)}>Edit</Button>
                      <Button size="small" color="error" onClick={() => remove(i)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Edit Item' : 'Add Item'}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, pt: 1 }}>
            <TextField label="Product Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <TextField select label="Category" value={form.category_id ?? ''} onChange={(e) => setForm({ ...form, category_id: e.target.value ? Number(e.target.value) : null })}>
              <MenuItem value="">None</MenuItem>
              {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField select label="Type" value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value })}>
              <MenuItem value="GOODS">Goods</MenuItem>
              <MenuItem value="SERVICE">Service</MenuItem>
            </TextField>
            <TextField select label="Inventory Tracking" value={form.tracking_mode} onChange={(e) => setForm({ ...form, tracking_mode: e.target.value })}>
              <MenuItem value="BY_QUANTITY">By Quantity</MenuItem>
              <MenuItem value="BY_SERIAL_NUMBER">By Serial Number</MenuItem>
            </TextField>
            <TextField label="Current Stock Qty" value={editing ? editing.current_stock_qty : 0} disabled />
            <TextField label="Sales Price" type="number" inputProps={{ step: '0.01' }} value={form.sales_price} onChange={(e) => setForm({ ...form, sales_price: Number(e.target.value) })} />
            <TextField label="Sales Tax %" type="number" inputProps={{ step: '0.01' }} value={form.sales_tax_pct} onChange={(e) => setForm({ ...form, sales_tax_pct: Number(e.target.value) })} />
            <TextField label="Purchase Cost" type="number" inputProps={{ step: '0.01' }} value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })} />
            <TextField label="Purchase Tax %" type="number" inputProps={{ step: '0.01' }} value={form.purchase_tax_pct} onChange={(e) => setForm({ ...form, purchase_tax_pct: Number(e.target.value) })} />
            <TextField label="Internal Reference" value={form.internal_reference} onChange={(e) => setForm({ ...form, internal_reference: e.target.value })} />
            <TextField label="Barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            <TextField label="HSN/SAC Code" value={form.hsn_sac_code} onChange={(e) => setForm({ ...form, hsn_sac_code: e.target.value })} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={saving || !form.name} onClick={save}>Save</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

function BalancesTab() {
  const { data: balances = [], isLoading, isError, refetch } = useListBalancesQuery();
  const { data: items = [] } = useListItemsQuery({ is_active: true });
  const { data: stores = [] } = useListStoresQuery();
  const itemMap = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
  const storeMap = useMemo(() => Object.fromEntries(stores.map((s) => [s.id, s.name])), [stores]);

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorState onRetry={refetch} />;

  const rows = balances.filter((b) => b.qty !== 0);
  return (
    <Paper variant="outlined" sx={{ borderColor: '#E4EBE1', borderRadius: 2 }}>
      {rows.length === 0 ? (
        <EmptyState title="No stock on hand" hint="Approved receipts will populate stock balances." />
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F7FAF6' }}>
                {['Item', 'Store', 'Batch', 'Serial', 'Expiry', 'Qty', 'Avg Cost'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, color: '#7A8B80', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} style={{ borderTop: '1px solid #F0F4EE' }}>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{itemMap[b.item_id]?.name ?? b.item_id}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{storeMap[b.store_id] ?? b.store_id}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{b.batch_no || '-'}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{b.serial_no || '-'}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{b.expiry_date || '-'}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{b.qty}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{money(b.avg_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}
    </Paper>
  );
}

function MovesTab() {
  const { data: moves = [], isLoading, isError, refetch } = useListMovesQuery({ limit: 200 });
  const { data: items = [] } = useListItemsQuery({ is_active: true });
  const itemMap = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <Paper variant="outlined" sx={{ borderColor: '#E4EBE1', borderRadius: 2 }}>
      {moves.length === 0 ? (
        <EmptyState title="No stock movements" hint="Every receipt, issue, transfer and adjustment is recorded here." />
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F7FAF6' }}>
                {['Date', 'Item', 'Type', 'Qty', 'Unit Cost', 'Document'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, color: '#7A8B80', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {moves.map((m) => (
                <tr key={m.id} style={{ borderTop: '1px solid #F0F4EE' }}>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: '#7A8B80' }}>{new Date(m.created_at).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{itemMap[m.item_id]?.name ?? m.item_id}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12 }}>{m.move_type}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: m.qty >= 0 ? '#16C47F' : '#F04438' }}>{m.qty >= 0 ? '+' : ''}{m.qty}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{money(m.unit_cost)}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12 }}>{m.document_no || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}
    </Paper>
  );
}