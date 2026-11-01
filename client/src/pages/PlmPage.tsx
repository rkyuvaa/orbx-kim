import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Cpu,
  ShieldCheck,
  Plus,
  Search,
  GitBranch,
  Package,
} from 'lucide-react';
import { useTableSort } from '../hooks/useTableSort';
import ErpSortHeaderCell from '../components/ui/ErpSortHeaderCell';
import { useToast } from '@/components/ui/ToastHost';
import { useDatabaseStoredState } from '@/hooks/useDatabaseStoredState';

interface VehicleModelPLM {
  id: string;
  name: string;
  code: string;
  stage: 'Concept' | 'Prototype' | 'Testing' | 'Mass Production' | 'Phase Out';
  version: string;
  motorRating: string;
  batteryCapacity: string;
  rangeKm: string;
  bomComponentsCount: number;
  unitCostEst: string;
  releaseDate: string;
}

interface BomComponent {
  id: string;
  partNo: string;
  name: string;
  category: 'Powertrain' | 'Battery & BMS' | 'Chassis & Body' | 'Electronics';
  supplier: string;
  unitCost: string;
  stockQty: number;
  compliance: 'Certified' | 'Pending Audit';
}

interface EcoItem {
  id: string;
  title: string;
  modelCode: string;
  priority: 'Critical' | 'Standard' | 'Minor';
  status: 'Draft' | 'Under Review' | 'Approved' | 'Implemented';
  requestedBy: string;
  date: string;
}

export default function PlmPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<number>(0);
  const [models, setModels] = useDatabaseStoredState<VehicleModelPLM[]>('crm_plm_models', []);
  const [boms, setBoms] = useDatabaseStoredState<BomComponent[]>('crm_plm_boms', []);
  const [ecos, setEcos] = useDatabaseStoredState<EcoItem[]>('crm_plm_ecos', []);

  const [searchQuery, setSearchQuery] = useState<string>('');

  // Dialog States
  const [openNewModel, setOpenNewModel] = useState(false);
  const [openNewEco, setOpenNewEco] = useState(false);

  // New Model Form State
  const [newModelName, setNewModelName] = useState('');
  const [newModelCode, setNewModelCode] = useState('');
  const [newModelStage, setNewModelStage] = useState<VehicleModelPLM['stage']>('Concept');
  const [newModelMotor, setNewModelMotor] = useState('1.5 kW Mid Drive');
  const [newModelBattery, setNewModelBattery] = useState('2.8 kWh LFP');

  // New ECO Form State
  const [newEcoTitle, setNewEcoTitle] = useState('');
  const [newEcoModel, setNewEcoModel] = useState(models[0]?.code || '');
  const [newEcoPriority, setNewEcoPriority] = useState<EcoItem['priority']>('Standard');


  const handleCreateModel = () => {
    if (!newModelName.trim() || !newModelCode.trim()) {
      showToast('Please fill in Model Name and Code', 'error');
      return;
    }
    const newMod: VehicleModelPLM = {
      id: `MOD-0${models.length + 1}`,
      name: newModelName.trim(),
      code: newModelCode.trim().toUpperCase(),
      stage: newModelStage,
      version: 'v0.1-Alpha',
      motorRating: newModelMotor,
      batteryCapacity: newModelBattery,
      rangeKm: '95 km/charge',
      bomComponentsCount: 120,
      unitCostEst: '₹85,000',
      releaseDate: 'Q2 2027',
    };
    setModels([...models, newMod]);
    setOpenNewModel(false);
    setNewModelName('');
    setNewModelCode('');
    showToast('New Vehicle Model added to PLM R&D!', 'success');
  };

  const handleCreateEco = () => {
    if (!newEcoTitle.trim()) {
      showToast('Please enter ECO description/title', 'error');
      return;
    }
    const newEcoRec: EcoItem = {
      id: `ECO-2026-${Math.floor(10 + Math.random() * 89)}`,
      title: newEcoTitle.trim(),
      modelCode: newEcoModel,
      priority: newEcoPriority,
      status: 'Under Review',
      requestedBy: 'R&D Department',
      date: '29 Aug 2026',
    };
    setEcos([newEcoRec, ...ecos]);
    setOpenNewEco(false);
    setNewEcoTitle('');
    showToast('Engineering Change Order (ECO) submitted!', 'success');
  };

  const stageColors: Record<VehicleModelPLM['stage'], { bg: string; color: string }> = {
    Concept: { bg: '#EFF6FF', color: '#2563EB' },
    Prototype: { bg: '#F3E8FF', color: '#7C3AED' },
    Testing: { bg: '#FEF3C7', color: '#D97706' },
    'Mass Production': { bg: '#EAF6E8', color: '#16C47F' },
    'Phase Out': { bg: '#FFE4E6', color: '#E11D48' },
  };

  const ecoStatusColors: Record<EcoItem['status'], { bg: string; color: string }> = {
    Draft: { bg: '#F3F4F6', color: '#4B5563' },
    'Under Review': { bg: '#FEF3C7', color: '#D97706' },
    Approved: { bg: '#EFF6FF', color: '#2563EB' },
    Implemented: { bg: '#EAF6E8', color: '#16C47F' },
  };

  const filteredModels = models.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredBoms = boms.filter(
    (b) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.partNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.supplier.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredEcos = ecos.filter(
    (e) =>
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.modelCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { sortState: bomSortState, handleSort: handleBomSort, sortData: sortBoms } = useTableSort<any>();
  const { sortState: ecoSortState, handleSort: handleEcoSort, sortData: sortEcos } = useTableSort<any>();

  const sortedBoms = useMemo(() => sortBoms(filteredBoms), [filteredBoms, sortBoms]);
  const sortedEcos = useMemo(() => sortEcos(filteredEcos), [filteredEcos, sortEcos]);

  return (
    <Box sx={{ pb: 6 }}>
      {/* 1. Page Header Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2.5, gap: 1.5 }}>
        <Button
          variant="outlined"
          startIcon={<GitBranch size={16} />}
          onClick={() => setOpenNewEco(true)}
          sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, borderColor: '#16C47F', color: '#16C47F' }}
        >
          Raise ECO Request
        </Button>
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          onClick={() => setOpenNewModel(true)}
          sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, backgroundColor: '#16C47F', '&:hover': { backgroundColor: '#023020' } }}
        >
          Add New Vehicle Model
        </Button>
      </Box>

      {/* 2. KPI Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5, borderRadius: '14px', border: '1px solid #E4EBE1', background: '#FFFFFF' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#7A8B80', textTransform: 'uppercase' }}>
                Active Vehicle Models
              </Typography>
              <Cpu size={20} color="#16C47F" />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#023020' }}>
              {models.length} Models
            </Typography>
            <Typography variant="caption" sx={{ color: '#16C47F', fontWeight: 600 }}>
              1 in Mass Production
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5, borderRadius: '14px', border: '1px solid #E4EBE1', background: '#FFFFFF' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#7A8B80', textTransform: 'uppercase' }}>
                Pending ECO Requests
              </Typography>
              <GitBranch size={20} color="#D97706" />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#023020' }}>
              {ecos.filter((e) => e.status === 'Under Review').length} Pending
            </Typography>
            <Typography variant="caption" sx={{ color: '#D97706', fontWeight: 600 }}>
              Requires Chief Engineer Signoff
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5, borderRadius: '14px', border: '1px solid #E4EBE1', background: '#FFFFFF' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#7A8B80', textTransform: 'uppercase' }}>
                BOM Parts Configured
              </Typography>
              <Package size={20} color="#2563EB" />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#023020' }}>
              734 Components
            </Typography>
            <Typography variant="caption" sx={{ color: '#2563EB', fontWeight: 600 }}>
              Across 4 Categories
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5, borderRadius: '14px', border: '1px solid #E4EBE1', background: '#FFFFFF' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#7A8B80', textTransform: 'uppercase' }}>
                Quality & AIS Audit
              </Typography>
              <ShieldCheck size={20} color="#059669" />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#023020' }}>
              99.4% Pass
            </Typography>
            <Typography variant="caption" sx={{ color: '#059669', fontWeight: 600 }}>
              AIS-156 & AIS-140 Compliant
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* 3. Navigation Tabs */}
      <Paper sx={{ border: '1px solid #E4EBE1', borderRadius: '14px', p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Tabs value={activeTab} onChange={(_e, v) => setActiveTab(v)} sx={{ minHeight: 40 }}>
            <Tab label={`Models Pipeline (${models.length})`} icon={<Cpu size={16} />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700 }} />
            <Tab label={`Bill of Materials (${boms.length})`} icon={<Package size={16} />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700 }} />
            <Tab label={`ECO Change Orders (${ecos.length})`} icon={<GitBranch size={16} />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700 }} />
          </Tabs>

          <TextField
            size="small"
            placeholder="Search PLM catalog..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <Search size={16} style={{ marginRight: 8, color: '#7A8B80' }} />,
            }}
            sx={{ width: { xs: '100%', sm: 260 } }}
          />
        </Box>
      </Paper>

      {/* 4. Tab 0: Models Grid */}
      {activeTab === 0 && (
        <Grid container spacing={2.5}>
          {filteredModels.map((mod) => {
            const stTheme = stageColors[mod.stage];
            return (
              <Grid item xs={12} md={4} key={mod.id}>
                <Card sx={{ border: '1px solid #E4EBE1', borderRadius: '14px', boxShadow: 'none', transition: 'all 0.2s', '&:hover': { borderColor: '#16C47F', boxShadow: '0 4px 14px rgba(8,122,61,0.08)' } }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                      <div>
                        <Chip label={mod.code} size="small" sx={{ fontWeight: 800, fontSize: 11, background: '#EAF6E8', color: '#16C47F', mb: 0.5 }} />
                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#023020', fontSize: 16 }}>
                          {mod.name}
                        </Typography>
                      </div>
                      <Chip label={mod.stage} size="small" sx={{ fontWeight: 700, background: stTheme.bg, color: stTheme.color }} />
                    </Box>

                    <Typography variant="caption" sx={{ color: '#7A8B80', display: 'block', mb: 2 }}>
                      Rev Version: <strong>{mod.version}</strong> • Target Release: <strong>{mod.releaseDate}</strong>
                    </Typography>

                    <Box sx={{ background: '#F8FAF8', p: 1.5, borderRadius: '8px', mb: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                      <div>
                        <Typography variant="caption" sx={{ color: '#7A8B80', display: 'block' }}>
                          Motor Rating
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#16231B' }}>
                          {mod.motorRating}
                        </Typography>
                      </div>
                      <div>
                        <Typography variant="caption" sx={{ color: '#7A8B80', display: 'block' }}>
                          Battery Spec
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#16231B' }}>
                          {mod.batteryCapacity}
                        </Typography>
                      </div>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1, borderTop: '1px solid #F0F4EF' }}>
                      <Typography variant="caption" sx={{ color: '#44584C', fontWeight: 600 }}>
                        BOM Parts: <strong>{mod.bomComponentsCount} items</strong>
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#16C47F', fontWeight: 800 }}>
                        Est. Cost: {mod.unitCostEst}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* 5. Tab 1: BOM Table */}
      {activeTab === 1 && (
        <Paper sx={{ border: '1px solid #E4EBE1', borderRadius: '14px', overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead sx={{ background: '#F8FAF8' }}>
                <TableRow>
                  <ErpSortHeaderCell variant="mui" field="partNo" label="Part No" sortState={bomSortState} onSort={handleBomSort} sx={{ color: '#023020' }} />
                  <ErpSortHeaderCell variant="mui" field="name" label="Component Name" sortState={bomSortState} onSort={handleBomSort} sx={{ color: '#023020' }} />
                  <ErpSortHeaderCell variant="mui" field="category" label="Category" sortState={bomSortState} onSort={handleBomSort} sx={{ color: '#023020' }} />
                  <ErpSortHeaderCell variant="mui" field="supplier" label="Supplier" sortState={bomSortState} onSort={handleBomSort} sx={{ color: '#023020' }} />
                  <ErpSortHeaderCell variant="mui" field="unitCost" label="Unit Cost" sortState={bomSortState} onSort={handleBomSort} sx={{ color: '#023020' }} />
                  <ErpSortHeaderCell variant="mui" field="stockQty" label="Stock Level" sortState={bomSortState} onSort={handleBomSort} sx={{ color: '#023020' }} />
                  <ErpSortHeaderCell variant="mui" field="compliance" label="Compliance" sortState={bomSortState} onSort={handleBomSort} sx={{ color: '#023020' }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedBoms.map((b) => (
                  <TableRow key={b.id} hover>
                    <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace', color: '#16C47F' }}>{b.partNo}</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#16231B' }}>{b.name}</TableCell>
                    <TableCell><Chip label={b.category} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: 11 }} /></TableCell>
                    <TableCell sx={{ color: '#44584C' }}>{b.supplier}</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#023020' }}>{b.unitCost}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{b.stockQty} units</TableCell>
                    <TableCell>
                      <Chip
                        label={b.compliance}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          background: b.compliance === 'Certified' ? '#EAF6E8' : '#FEF3C7',
                          color: b.compliance === 'Certified' ? '#16C47F' : '#D97706',
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* 6. Tab 2: ECO Table */}
      {activeTab === 2 && (
        <Paper sx={{ border: '1px solid #E4EBE1', borderRadius: '14px', overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead sx={{ background: '#F8FAF8' }}>
                <TableRow>
                  <ErpSortHeaderCell variant="mui" field="id" label="ECO Number" sortState={ecoSortState} onSort={handleEcoSort} sx={{ color: '#023020' }} />
                  <ErpSortHeaderCell variant="mui" field="title" label="Change Request Title" sortState={ecoSortState} onSort={handleEcoSort} sx={{ color: '#023020' }} />
                  <ErpSortHeaderCell variant="mui" field="modelCode" label="Affected Model" sortState={ecoSortState} onSort={handleEcoSort} sx={{ color: '#023020' }} />
                  <ErpSortHeaderCell variant="mui" field="priority" label="Priority" sortState={ecoSortState} onSort={handleEcoSort} sx={{ color: '#023020' }} />
                  <ErpSortHeaderCell variant="mui" field="status" label="Status" sortState={ecoSortState} onSort={handleEcoSort} sx={{ color: '#023020' }} />
                  <ErpSortHeaderCell variant="mui" field="requestedDate" label="Requested Date" sortState={ecoSortState} onSort={handleEcoSort} sx={{ color: '#023020' }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedEcos.map((eco) => {
                  const ecoSt = ecoStatusColors[eco.status];
                  return (
                    <TableRow key={eco.id} hover>
                      <TableCell sx={{ fontWeight: 800, fontFamily: 'monospace', color: '#16C47F' }}>{eco.id}</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#16231B' }}>{eco.title}</TableCell>
                      <TableCell><Chip label={eco.modelCode} size="small" sx={{ fontWeight: 700, background: '#EAF6E8', color: '#16C47F' }} /></TableCell>
                      <TableCell>
                        <Chip
                          label={eco.priority}
                          size="small"
                          sx={{
                            fontWeight: 700,
                            background: eco.priority === 'Critical' ? '#FFE4E6' : '#EFF6FF',
                            color: eco.priority === 'Critical' ? '#E11D48' : '#2563EB',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip label={eco.status} size="small" sx={{ fontWeight: 700, background: ecoSt.bg, color: ecoSt.color }} />
                      </TableCell>
                      <TableCell sx={{ color: '#7A8B80' }}>{eco.date}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* New Model Dialog */}
      <Dialog open={openNewModel} onClose={() => setOpenNewModel(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#023020' }}>Add New Vehicle Model</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Model Name"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                placeholder="e.g. Dhoor P3 Sport"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Model Code"
                value={newModelCode}
                onChange={(e) => setNewModelCode(e.target.value)}
                placeholder="e.g. DHOOR-P3"
              />
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={4}>
              <TextField
                fullWidth
                select
                label="Lifecycle Stage"
                value={newModelStage}
                onChange={(e) => setNewModelStage(e.target.value as any)}
              >
                <MenuItem value="Concept">Concept</MenuItem>
                <MenuItem value="Prototype">Prototype</MenuItem>
                <MenuItem value="Testing">Testing</MenuItem>
                <MenuItem value="Mass Production">Mass Production</MenuItem>
                <MenuItem value="Phase Out">Phase Out</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Motor Spec"
                value={newModelMotor}
                onChange={(e) => setNewModelMotor(e.target.value)}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Battery Spec"
                value={newModelBattery}
                onChange={(e) => setNewModelBattery(e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenNewModel(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateModel} sx={{ backgroundColor: '#16C47F', '&:hover': { backgroundColor: '#023020' } }}>
            Add Model
          </Button>
        </DialogActions>
      </Dialog>

      {/* New ECO Dialog */}
      <Dialog open={openNewEco} onClose={() => setOpenNewEco(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#023020' }}>Raise Engineering Change Order (ECO)</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="ECO Change Title / Description"
            value={newEcoTitle}
            onChange={(e) => setNewEcoTitle(e.target.value)}
            margin="dense"
            placeholder="e.g. Upgrade battery casing seal gasket material"
            sx={{ mb: 2 }}
          />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                select
                label="Affected Model"
                value={newEcoModel}
                onChange={(e) => setNewEcoModel(e.target.value)}
                margin="dense"
              >
                {models.map((m) => (
                  <MenuItem key={m.id} value={m.code}>
                    {m.name} ({m.code})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                select
                label="Priority"
                value={newEcoPriority}
                onChange={(e) => setNewEcoPriority(e.target.value as any)}
                margin="dense"
              >
                <MenuItem value="Critical">Critical</MenuItem>
                <MenuItem value="Standard">Standard</MenuItem>
                <MenuItem value="Minor">Minor</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenNewEco(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateEco} sx={{ backgroundColor: '#16C47F', '&:hover': { backgroundColor: '#023020' } }}>
            Submit ECO
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
