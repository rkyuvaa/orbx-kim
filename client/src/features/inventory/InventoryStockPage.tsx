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
  useListBalancesQuery,
  useListBrandsQuery,
  useListCategoriesQuery,
  useListItemsQuery,
  useListMovesQuery,
  useListStoresQuery,
  useListSuppliersQuery,
  useListTaxRatesQuery,
  useListUnitsQuery,
} from '@/api/inventoryApi';

const money = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function InventoryStockPage() {
  const [tab, setTab] = useState(0);
  return (
    <Box sx={{ p: 3 }}>
      <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#023020', mb: 0.5 }}>Inventory Stock</Typography>
      <Typography sx={{ fontSize: 13, color: '#667085', mb: 2 }}>
        Parts & consumables catalogue, stock by location/bin and movement history.
      </Typography>
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
  const { data: units = [] } = useListUnitsQuery();
  const { data: brands = [] } = useListBrandsQuery();
  const { data: suppliers = [] } = useListSuppliersQuery();
  const { data: taxes = [] } = useListTaxRatesQuery();
  const [open, setOpen] = useState(false);
  const [createItem, { isLoading: saving }] = useCreateItemMutation();

  const [form, setForm] = useState<any>({ sku: '', name: '', reorder_level: 0, reorder_qty: 0, purchase_price: 0 });

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorState onRetry={refetch} />;

  const save = async () => {
    try {
      await createItem(form).unwrap();
      showToast('Item created.', 'success');
      setOpen(false);
      setForm({ sku: '', name: '', reorder_level: 0, reorder_qty: 0, purchase_price: 0 });
    } catch (e: any) {
      showToast(e?.data?.detail || 'Failed to create item.', 'error');
    }
  };

  return (
    <Paper variant="outlined" sx={{ borderColor: '#E4EBE1', borderRadius: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #E4EBE1' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#7A8B80', textTransform: 'uppercase', letterSpacing: 0.6 }}>Parts Catalogue</span>
        <Button size="small" variant="contained" onClick={() => setOpen(true)}>Add Item</Button>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No items yet" hint="Add parts and consumables to start tracking stock." />
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F7FAF6' }}>
                {['SKU', 'Name', 'Reorder', 'Price'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, color: '#7A8B80', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} style={{ borderTop: '1px solid #F0F4EE' }}>
                  <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{i.sku}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{i.name}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{i.reorder_level}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{money(i.purchase_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Item</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, pt: 1 }}>
            <TextField label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <TextField select label="Category" value={form.category_id ?? ''} onChange={(e) => setForm({ ...form, category_id: e.target.value || null })}>
              <MenuItem value="">None</MenuItem>
              {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField select label="Unit" value={form.unit_id ?? ''} onChange={(e) => setForm({ ...form, unit_id: e.target.value || null })}>
              <MenuItem value="">None</MenuItem>
              {units.map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
            </TextField>
            <TextField select label="Brand" value={form.brand_id ?? ''} onChange={(e) => setForm({ ...form, brand_id: e.target.value || null })}>
              <MenuItem value="">None</MenuItem>
              {brands.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
            </TextField>
            <TextField select label="Default Supplier" value={form.default_supplier_id ?? ''} onChange={(e) => setForm({ ...form, default_supplier_id: e.target.value || null })}>
              <MenuItem value="">None</MenuItem>
              {suppliers.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
            <TextField select label="Tax" value={form.tax_rate_id ?? ''} onChange={(e) => setForm({ ...form, tax_rate_id: e.target.value || null })}>
              <MenuItem value="">None</MenuItem>
              {taxes.map((t) => <MenuItem key={t.id} value={t.id}>{t.name} ({t.rate}%)</MenuItem>)}
            </TextField>
            <TextField label="Purchase Price" type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })} />
            <TextField label="Reorder Level" type="number" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: Number(e.target.value) })} />
            <TextField label="Reorder Qty" type="number" value={form.reorder_qty} onChange={(e) => setForm({ ...form, reorder_qty: Number(e.target.value) })} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={saving || !form.sku || !form.name} onClick={save}>Save</Button>
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