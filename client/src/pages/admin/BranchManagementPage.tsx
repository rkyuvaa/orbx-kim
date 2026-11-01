import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Chip,
  IconButton,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  InputAdornment,
  Tooltip,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import {
  Plus,
  Search,
  MapPin,
  Clock,
  Building,
  Pencil,
  Trash2,
  Phone,
  Mail,
  User,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { useToast } from '@/components/ui/ToastHost';
import { useDatabaseStoredState } from '@/hooks/useDatabaseStoredState';

export interface Branch {
  id: number;
  name: string;
  code: string;
  type: 'Headquarters' | 'Regional Hub' | 'Branch Office' | 'Depot / Yard';
  address: string;
  city: string;
  state: string;
  pincode: string;
  shift_name: string;
  shift_start_time: string;
  shift_end_time: string;
  working_days: string;
  manager_name: string;
  phone: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export default function BranchManagementPage() {
  const { showToast } = useToast();
  const [branches, setBranches] = useDatabaseStoredState<Branch[]>('crm_branches_data', []);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<Branch['type']>('Branch Office');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');
  const [shiftName, setShiftName] = useState('General Day Shift');
  const [shiftStartTime, setShiftStartTime] = useState('09:00 AM');
  const [shiftEndTime, setShiftEndTime] = useState('06:00 PM');
  const [workingDays, setWorkingDays] = useState('Mon - Sat (6 Days)');
  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  const handleOpenModal = (branch?: Branch) => {
    if (branch) {
      setEditingId(branch.id);
      setName(branch.name);
      setCode(branch.code);
      setType(branch.type);
      setAddress(branch.address);
      setCity(branch.city);
      setStateName(branch.state);
      setPincode(branch.pincode);
      setShiftName(branch.shift_name);
      setShiftStartTime(branch.shift_start_time);
      setShiftEndTime(branch.shift_end_time);
      setWorkingDays(branch.working_days);
      setManagerName(branch.manager_name);
      setPhone(branch.phone);
      setEmail(branch.email);
      setStatus(branch.status);
    } else {
      setEditingId(null);
      setName('');
      setCode(`BR-${Math.floor(100 + Math.random() * 900)}`);
      setType('Branch Office');
      setAddress('');
      setCity('');
      setStateName('');
      setPincode('');
      setShiftName('General Day Shift');
      setShiftStartTime('09:00 AM');
      setShiftEndTime('06:00 PM');
      setWorkingDays('Mon - Sat (6 Days)');
      setManagerName('');
      setPhone('');
      setEmail('');
      setStatus('ACTIVE');
    }
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!name.trim() || !code.trim() || !address.trim()) {
      showToast('Branch Name, Branch Code, and Address are required', 'error');
      return;
    }

    if (editingId) {
      setBranches((prev) =>
        prev.map((b) =>
          b.id === editingId
            ? {
                ...b,
                name: name.trim(),
                code: code.trim(),
                type,
                address: address.trim(),
                city: city.trim(),
                state: stateName.trim(),
                pincode: pincode.trim(),
                shift_name: shiftName.trim(),
                shift_start_time: shiftStartTime.trim(),
                shift_end_time: shiftEndTime.trim(),
                working_days: workingDays.trim(),
                manager_name: managerName.trim(),
                phone: phone.trim(),
                email: email.trim(),
                status,
              }
            : b,
        ),
      );
      showToast('Branch details updated successfully', 'success');
    } else {
      const newBranch: Branch = {
        id: Date.now(),
        name: name.trim(),
        code: code.trim(),
        type,
        address: address.trim(),
        city: city.trim(),
        state: stateName.trim(),
        pincode: pincode.trim(),
        shift_name: shiftName.trim() || 'General Day Shift',
        shift_start_time: shiftStartTime.trim() || '09:00 AM',
        shift_end_time: shiftEndTime.trim() || '06:00 PM',
        working_days: workingDays.trim() || 'Mon - Sat (6 Days)',
        manager_name: managerName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        status,
      };
      setBranches((prev) => [newBranch, ...prev]);
      showToast('New branch created successfully', 'success');
    }
    setModalOpen(false);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this branch?')) {
      setBranches((prev) => prev.filter((b) => b.id !== id));
      showToast('Branch record removed', 'info');
    }
  };

  const handleToggleStatus = (id: number) => {
    setBranches((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: b.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : b)),
    );
    showToast('Branch status toggled', 'info');
  };

  const filteredBranches = branches.filter((b) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      b.name.toLowerCase().includes(q) ||
      b.code.toLowerCase().includes(q) ||
      b.address.toLowerCase().includes(q) ||
      b.city.toLowerCase().includes(q) ||
      b.manager_name.toLowerCase().includes(q);

    const matchesType = typeFilter === 'ALL' || b.type === typeFilter;
    return matchesQuery && matchesType;
  });

  return (
    <Box sx={{ width: '100%' }}>
      {/* Top Header & Overview Cards */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#023020' }}>
            Enterprise Branch & Shift Location Management
          </Typography>
          <Typography variant="body2" sx={{ color: '#667A6D' }}>
            Configure branch locations, full street addresses, shift timings, working days, and local contact officers.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Plus size={18} />}
          onClick={() => handleOpenModal()}
          sx={{ backgroundColor: '#04552B', '&:hover': { backgroundColor: '#034120' }, borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
        >
          Add New Branch
        </Button>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #E4EBE1', borderRadius: '12px', bgcolor: '#FFFFFF' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Box sx={{ p: 1, borderRadius: '8px', backgroundColor: '#EAF6E8', color: '#04552B' }}>
                <MapPin size={20} />
              </Box>
              <Typography variant="body2" sx={{ color: '#7A8B80', fontWeight: 600 }}>
                Total Active Branches
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#023020' }}>
              {branches.filter((b) => b.status === 'ACTIVE').length}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #E4EBE1', borderRadius: '12px', bgcolor: '#FFFFFF' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Box sx={{ p: 1, borderRadius: '8px', backgroundColor: '#FEF3C7', color: '#D97706' }}>
                <Clock size={20} />
              </Box>
              <Typography variant="body2" sx={{ color: '#7A8B80', fontWeight: 600 }}>
                Shift Coverage Types
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#D97706' }}>
              {Array.from(new Set(branches.map((b) => b.shift_name))).length} Shifts
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #E4EBE1', borderRadius: '12px', bgcolor: '#FFFFFF' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Box sx={{ p: 1, borderRadius: '8px', backgroundColor: '#DCFCE7', color: '#15803D' }}>
                <Building size={20} />
              </Box>
              <Typography variant="body2" sx={{ color: '#7A8B80', fontWeight: 600 }}>
                Logistics Hubs & Yards
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#15803D' }}>
              {branches.filter((b) => b.type === 'Regional Hub' || b.type === 'Depot / Yard').length} Locations
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Filter Bar */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid #E4EBE1', borderRadius: '12px', mb: 3, bgcolor: '#FFFFFF' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={7}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by branch name, code, address, city, or manager..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} color="#7A8B80" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid item xs={6} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Branch Type</InputLabel>
              <Select value={typeFilter} label="Branch Type" onChange={(e) => setTypeFilter(e.target.value)}>
                <MenuItem value="ALL">All Branch Types</MenuItem>
                <MenuItem value="Headquarters">Headquarters</MenuItem>
                <MenuItem value="Regional Hub">Regional Hub</MenuItem>
                <MenuItem value="Branch Office">Branch Office</MenuItem>
                <MenuItem value="Depot / Yard">Depot / Yard</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={6} sm={2} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('ALL');
              }}
              sx={{ textTransform: 'none', color: '#7A8B80', borderColor: '#CBD5E1' }}
            >
              Reset
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Branches Table */}
      <Paper elevation={0} sx={{ border: '1px solid #E4EBE1', borderRadius: '12px', overflowX: 'auto', bgcolor: '#FFFFFF' }}>
        <Table sx={{ minWidth: 1250, tableLayout: 'auto' }}>
          <TableHead sx={{ backgroundColor: '#F8FAF7' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, color: '#44584C', minWidth: 200 }}>Branch Name & Code</TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#44584C', minWidth: 140 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#44584C', minWidth: 260 }}>Full Address & City</TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#44584C', minWidth: 220 }}>Shift Timing & Working Days</TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#44584C', minWidth: 180 }}>Branch Contact Person</TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#44584C', minWidth: 100 }}>Status</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: '#44584C', minWidth: 100 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredBranches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6, color: '#7A8B80' }}>
                  No branches match the search criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredBranches.map((b) => (
                <TableRow key={b.id} hover>
                  <TableCell>
                    <Typography sx={{ fontWeight: 700, fontSize: 13.5, color: '#16231B' }}>{b.name}</Typography>
                    <Chip label={b.code} size="small" sx={{ fontSize: 10.5, fontWeight: 700, fontFamily: 'monospace', bgcolor: '#EAF6E8', color: '#04552B', mt: 0.3 }} />
                  </TableCell>
                  <TableCell>
                    <Chip label={b.type} size="small" sx={{ fontSize: 11, fontWeight: 600, bgcolor: '#F1F5F9' }} />
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 12.5, color: '#334155', fontWeight: 500 }}>{b.address}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: '#7A8B80', mt: 0.2 }}>
                      {b.city}, {b.state} - {b.pincode}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.3 }}>
                      <Clock size={14} color="#04552B" />
                      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#023020' }}>
                        {b.shift_name} ({b.shift_start_time} - {b.shift_end_time})
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <Calendar size={13} color="#7A8B80" />
                      <Typography sx={{ fontSize: 11.5, color: '#64748B' }}>{b.working_days}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#16231B' }}>{b.manager_name || 'N/A'}</Typography>
                    <Typography sx={{ fontSize: 11, color: '#44584C' }}>{b.phone}</Typography>
                    <Typography sx={{ fontSize: 11, color: '#7A8B80' }}>{b.email}</Typography>
                  </TableCell>
                  <TableCell>
                    <Switch
                      size="small"
                      checked={b.status === 'ACTIVE'}
                      onChange={() => handleToggleStatus(b.id)}
                      color="success"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpenModal(b)} sx={{ color: '#3B82F6' }}>
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(b.id)} sx={{ color: '#EF4444' }}>
                      <Trash2 size={16} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Add / Edit Branch Dialog */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#023020', borderBottom: '1px solid #E4EBE1' }}>
          {editingId ? 'Edit Branch Location & Shift' : 'Add New Branch Location'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, pb: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Section 1: Basic Info */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#04552B', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 12 }}>
            1. Branch & Type Details
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Branch Name"
                fullWidth
                required
                size="small"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bangalore Corporate HQ"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                label="Branch Code"
                fullWidth
                required
                size="small"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. BLR-HQ"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Branch Type</InputLabel>
                <Select value={type} label="Branch Type" onChange={(e) => setType(e.target.value as any)}>
                  <MenuItem value="Headquarters">Headquarters</MenuItem>
                  <MenuItem value="Regional Hub">Regional Hub</MenuItem>
                  <MenuItem value="Branch Office">Branch Office</MenuItem>
                  <MenuItem value="Depot / Yard">Depot / Yard</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Divider />

          {/* Section 2: Full Address */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#04552B', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 12 }}>
            2. Address & Location Details
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Full Street Address"
                fullWidth
                required
                multiline
                rows={2}
                size="small"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Building name, street number, industrial park, area..."
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="City"
                fullWidth
                size="small"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Bangalore"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="State"
                fullWidth
                size="small"
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                placeholder="e.g. Karnataka"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Pincode / Postal Code"
                fullWidth
                size="small"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="e.g. 560100"
              />
            </Grid>
          </Grid>

          <Divider />

          {/* Section 3: Shift Timing & Working Schedule */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#04552B', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 12 }}>
            3. Shift Timing & Working Schedule
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Shift Name"
                fullWidth
                size="small"
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
                placeholder="e.g. General Day Shift or 24/7 Operations"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                label="Shift Start Time"
                fullWidth
                size="small"
                value={shiftStartTime}
                onChange={(e) => setShiftStartTime(e.target.value)}
                placeholder="e.g. 09:00 AM"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                label="Shift End Time"
                fullWidth
                size="small"
                value={shiftEndTime}
                onChange={(e) => setShiftEndTime(e.target.value)}
                placeholder="e.g. 06:00 PM"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Working Days Schedule"
                fullWidth
                size="small"
                value={workingDays}
                onChange={(e) => setWorkingDays(e.target.value)}
                placeholder="e.g. Mon - Sat (6 Days) or Mon - Sun (24/7 Shifts)"
              />
            </Grid>
          </Grid>

          <Divider />

          {/* Section 4: Contact Officer */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#04552B', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 12 }}>
            4. Branch Contact Officer & Status
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Branch Manager / Contact Person"
                fullWidth
                size="small"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder="e.g. Rajesh Kumar"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Contact Phone"
                fullWidth
                size="small"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 80 2852 9900"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Contact Email"
                fullWidth
                size="small"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. blr.hq@kimfinance.com"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #E4EBE1' }}>
          <Button onClick={() => setModalOpen(false)} sx={{ textTransform: 'none', color: '#7A8B80' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            sx={{ backgroundColor: '#04552B', '&:hover': { backgroundColor: '#034120' }, textTransform: 'none', fontWeight: 700 }}
          >
            Save Branch Record
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
