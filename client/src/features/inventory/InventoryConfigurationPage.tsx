import { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Tab, Tabs, TextField, Typography } from '@mui/material';

import EmptyState from '@/components/ui/EmptyState';
import { ErrorState, PageLoader } from '@/components/ui/PageState';
import { useToast } from '@/components/ui/ToastHost';
import {
  useCreateBinMutation,
  useCreateBrandMutation,
  useCreateCategoryMutation,
  useCreateLocationMutation,
  useCreateStoreMutation,
  useCreateSupplierMutation,
  useCreateTaxRateMutation,
  useCreateUnitMutation,
  useListBinsQuery,
  useListBrandsQuery,
  useListCategoriesQuery,
  useListLocationsQuery,
  useListStoresQuery,
  useListSuppliersQuery,
  useListTaxRatesQuery,
  useListUnitsQuery,
} from '@/api/inventoryApi';

type Field = { key: string; label: string; type?: string };

export default function InventoryConfigurationPage() {
  const [tab, setTab] = useState(0);

  const stores = useListStoresQuery();
  const locations = useListLocationsQuery();
  const bins = useListBinsQuery();
  const categories = useListCategoriesQuery();
  const units = useListUnitsQuery();
  const brands = useListBrandsQuery();
  const suppliers = useListSuppliersQuery();
  const taxes = useListTaxRatesQuery();

  const createStore = useCreateStoreMutation();
  const createLocation = useCreateLocationMutation();
  const createBin = useCreateBinMutation();
  const createCategory = useCreateCategoryMutation();
  const createUnit = useCreateUnitMutation();
  const createBrand = useCreateBrandMutation();
  const createSupplier = useCreateSupplierMutation();
  const createTax = useCreateTaxRateMutation();

  const tabs = ['Stores', 'Locations', 'Bins', 'Categories', 'Units', 'Brands', 'Suppliers', 'Tax Rates'];

  return (
    <Box sx={{ pb: 6, width: '100%' }}>
      <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#023020', mb: 0.5 }}>Inventory Configuration</Typography>
      <Typography sx={{ fontSize: 13, color: '#667085', mb: 2 }}>
        Stores, locations, bins, categories, units, brands, suppliers and tax settings.
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
        {tabs.map((t) => <Tab key={t} label={t} />)}
      </Tabs>

      {tab === 0 && <GenericPanel title="Stores" query={stores} create={createStore} fields={[{ key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }]} columns={['Name', 'Code']} row={(s: any) => [s.name, s.code]} />}
      {tab === 1 && <GenericPanel title="Locations" query={locations} create={createLocation} fields={[{ key: 'store_id', label: 'Store ID' }, { key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }]} columns={['Store', 'Name', 'Code']} row={(l: any) => [l.store_id, l.name, l.code]} />}
      {tab === 2 && <GenericPanel title="Bins" query={bins} create={createBin} fields={[{ key: 'location_id', label: 'Location ID' }, { key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }]} columns={['Location', 'Name', 'Code']} row={(b: any) => [b.location_id, b.name, b.code]} />}
      {tab === 3 && <GenericPanel title="Categories" query={categories} create={createCategory} fields={[{ key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }]} columns={['Name', 'Code']} row={(c: any) => [c.name, c.code]} />}
      {tab === 4 && <GenericPanel title="Units" query={units} create={createUnit} fields={[{ key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }]} columns={['Name', 'Code']} row={(u: any) => [u.name, u.code]} />}
      {tab === 5 && <GenericPanel title="Brands" query={brands} create={createBrand} fields={[{ key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }]} columns={['Name', 'Code']} row={(b: any) => [b.name, b.code]} />}
      {tab === 6 && <GenericPanel title="Suppliers" query={suppliers} create={createSupplier} fields={[{ key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }, { key: 'contact_name', label: 'Contact' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }, { key: 'gstin', label: 'GSTIN' }]} columns={['Name', 'Code', 'Contact', 'Phone']} row={(s: any) => [s.name, s.code, s.contact_name || '-', s.phone || '-']} />}
      {tab === 7 && <GenericPanel title="Tax Rates" query={taxes} create={createTax} fields={[{ key: 'name', label: 'Name' }, { key: 'rate', label: 'Rate %', type: 'number' }]} columns={['Name', 'Rate %']} row={(t: any) => [t.name, t.rate]} />}
    </Box>
  );
}

function GenericPanel({
  title,
  query,
  create,
  fields,
  columns,
  row,
}: {
  title: string;
  query: any;
  create: any;
  fields: Field[];
  columns: string[];
  row: (item: any) => (string | number)[];
}) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});

  const data: any[] = query.data ?? [];

  const save = async () => {
    try {
      const body: any = { ...form };
      if ('rate' in body) body.rate = Number(body.rate);
      await create(body).unwrap();
      showToast(`${title} saved.`, 'success');
      setOpen(false);
      setForm({});
    } catch (e: any) {
      showToast(e?.data?.detail || 'Failed to save.', 'error');
    }
  };

  return (
    <Paper variant="outlined" sx={{ borderColor: '#E4EBE1', borderRadius: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #E4EBE1' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#7A8B80', textTransform: 'uppercase', letterSpacing: 0.6 }}>{title}</span>
        <Button size="small" variant="contained" onClick={() => setOpen(true)}>Add</Button>
      </div>
      {query.isLoading ? <PageLoader /> : query.isError ? <ErrorState onRetry={query.refetch} /> : data.length === 0 ? (
        <EmptyState title={`No ${title.toLowerCase()} yet`} hint={`Add your first ${title.toLowerCase().replace(/s$/, '')}.`} />
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F7FAF6' }}>
                {columns.map((c) => <th key={c} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, color: '#7A8B80', textTransform: 'uppercase' }}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id} style={{ borderTop: '1px solid #F0F4EE' }}>
                  {row(d).map((c, i) => <td key={i} style={{ padding: '10px 16px', fontSize: 13 }}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add {title.replace(/s$/, '')}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {fields.map((f) => (
              <TextField key={f.key} label={f.label} type={f.type || 'text'} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={create.isLoading} onClick={save}>Save</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}