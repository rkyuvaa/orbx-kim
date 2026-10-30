import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Chip,
  Switch,
  IconButton,
  Tabs,
  Tab,
  Divider,
  Alert,
} from '@mui/material';
import { Plus, Trash2, GripVertical, UploadCloud } from 'lucide-react';

type FieldType = 'Text' | 'Number' | 'Date' | 'Timer' | 'User' | 'File' | 'Dropdown';

interface CustomFieldDef {
  id: number;
  key: string;
  label: string;
  type: FieldType;
  tab: string;
  departmentId?: string;
  requiredStatuses: string[];
  options?: string[];
  filterDept?: boolean;
  displayOrder: number;
}

const initialTabs = [
  { id: 'general', name: 'General' },
  { id: 'technical', name: 'Technical Details' },
  { id: 'attachments', name: 'Files & Docs' },
];

const mockFields: CustomFieldDef[] = [
  { id: 1, key: 'work_order_ref', label: 'Work Order Reference', type: 'Text', tab: 'general', requiredStatuses: ['OPEN'], displayOrder: 1 },
  { id: 2, key: 'priority', label: 'Priority', type: 'Dropdown', tab: 'general', options: ['Low','Medium','High','Critical'], requiredStatuses: [], displayOrder: 2 },
  { id: 3, key: 'estimated_minutes', label: 'Estimated Time', type: 'Timer', tab: 'technical', requiredStatuses: ['ACKNOWLEDGED'], displayOrder: 1 },
  { id: 4, key: 'assigned_user', label: 'Assigned Technician', type: 'User', tab: 'general', filterDept: true, requiredStatuses: ['ASSIGNED'], displayOrder: 3 },
  { id: 5, key: 'support_doc', label: 'Support Document', type: 'File', tab: 'attachments', requiredStatuses: [], displayOrder: 1 },
];

export default function CustomFieldsAdminCard() {
  const [fields, setFields] = useState<CustomFieldDef[]>(mockFields);
  const [selectedTab, setSelectedTab] = useState<string>(initialTabs[0].id);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomFieldDef | null>(null);

  const [form, setForm] = useState<Partial<CustomFieldDef>>({
    label: '',
    key: '',
    type: 'Text',
    tab: initialTabs[0].id,
    departmentId: '',
    requiredStatuses: [],
    options: [],
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ label: '', key: '', type: 'Text', tab: selectedTab, departmentId: '', requiredStatuses: [], options: [] });
    setDialogOpen(true);
  };

  const openEdit = (f: CustomFieldDef) => {
    setEditing(f);
    setForm({...f});
    setDialogOpen(true);
  };

  const saveField = () => {
    if (!form.label || !form.key) return;
    if (editing) {
      setFields(fields.map(f => f.id === editing.id ? { ...editing, ...form } as CustomFieldDef : f));
    } else {
      const newField: CustomFieldDef = {
        id: Date.now(),
        key: form.key!,
        label: form.label!,
        type: form.type as FieldType,
        tab: form.tab!,
        departmentId: form.departmentId,
        requiredStatuses: form.requiredStatuses || [],
        options: form.options,
        displayOrder: fields.filter(f=>f.tab===form.tab).length + 1,
      };
      setFields([...fields, newField]);
    }
    setDialogOpen(false);
  };

  const deleteField = (id: number) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const filtered = fields.filter(f => f.tab === selectedTab);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Work Order Custom Fields</Typography>
            <Typography variant="body2" color="textSecondary">Admin-configurable fields for Work Order create/manage screens. Department scoped.</Typography>
          </Box>
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={openCreate} sx={{ bgcolor: '#203020' }}>Add Field</Button>
        </Box>

        <Tabs value={selectedTab} onChange={(_,v)=>setSelectedTab(v)} sx={{ mb: 2 }}>
          {initialTabs.map(t => <Tab key={t.id} label={t.name} value={t.id} />)}
        </Tabs>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell></TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Label</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Key</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Dept</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Required on Status</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map(f => (
              <TableRow key={f.id}>
                <TableCell><IconButton size="small"><GripVertical size={14} /></IconButton></TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{f.label}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{f.key}</TableCell>
                <TableCell><Chip size="small" label={f.type} /></TableCell>
                <TableCell>{f.departmentId ? <Chip size="small" label={f.departmentId} /> : '-'}</TableCell>
                <TableCell>{f.requiredStatuses?.join(', ') || '-'}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={()=>openEdit(f)}>Edit</Button>
                  <IconButton size="small" onClick={()=>deleteField(f.id)}><Trash2 size={14} /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length===0 && (
              <TableRow><TableCell colSpan={7}><Alert severity="info">No fields in this tab. Add your first field.</Alert></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dialogOpen} onClose={()=>setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Field' : 'Add Custom Field'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="Label" value={form.label||''} onChange={e=>setForm({...form,label:e.target.value})} fullWidth size="small" />
          <TextField label="Key (machine name)" value={form.key||''} onChange={e=>setForm({...form,key:e.target.value.toLowerCase().replace(/\s+/g,'_')})} fullWidth size="small" />
          <FormControl fullWidth size="small">
            <InputLabel>Field Type</InputLabel>
            <Select value={form.type||'Text'} label="Field Type" onChange={e=>setForm({...form,type:e.target.value as FieldType})}>
              <MenuItem value="Text">Text</MenuItem>
              <MenuItem value="Number">Number</MenuItem>
              <MenuItem value="Date">Date</MenuItem>
              <MenuItem value="Timer">Timer (HH:MM)</MenuItem>
              <MenuItem value="User">User (dept filtered)</MenuItem>
              <MenuItem value="File">File with preview/download</MenuItem>
              <MenuItem value="Dropdown">Dropdown</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>Tab</InputLabel>
            <Select value={form.tab||''} label="Tab" onChange={e=>setForm({...form,tab:e.target.value})}>
              {initialTabs.map(t=> <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
            </Select>
          </FormControl>

          <TextField label="Department ID (optional)" value={form.departmentId||''} onChange={e=>setForm({...form,departmentId:e.target.value})} fullWidth size="small" helperText="Leave empty for global. Scopes field to department." />

          {form.type==='Dropdown' && (
            <TextField label="Options (comma separated)" value={(form.options||[]).join(',')} onChange={e=>setForm({...form,options:e.target.value.split(',').map(s=>s.trim())})} fullWidth size="small" />
          )}

          <FormControlLabel control={<Switch checked={!!form.filterDept} onChange={e=>setForm({...form,filterDept:e.target.checked})} />} label="Filter User dropdown by department" />

          <Divider />
          <Typography variant="subtitle2">Required on Statuses</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {['OPEN','ACKNOWLEDGED','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED'].map(s => (
              <Chip key={s} label={s} onClick={()=> {
                const req = form.requiredStatuses||[];
                setForm({...form,requiredStatuses: req.includes(s) ? req.filter(x=>x!==s) : [...req,s]});
              }} color={form.requiredStatuses?.includes(s)?'primary':'default'} />
            ))}
          </Box>

          {form.type==='File' && (
            <Alert severity="info" icon={<UploadCloud size={16}/>}>File uploads stored server-side with preview/download links.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveField}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
