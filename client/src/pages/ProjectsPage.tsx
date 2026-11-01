import { useEffect, useState } from 'react';
import {
  Avatar,
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
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  ListItemText,
  OutlinedInput,
  useTheme,
} from '@mui/material';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  FolderPlus,
  ListTodo,
  Plus,
  Search,
  Trash2,
  User,
  AlertCircle,
  Upload,
  Users,
} from 'lucide-react';
import UniversalImportModal from '@/components/ui/UniversalImportModal';
import {
  useGetProjectsQuery,
  useCreateProjectMutation,
  useDeleteProjectMutation,
  ProjectItem,
} from '@/api/projectsApi';
import { useApplicationsQuery } from '@/api/applicationsApi';
import { useUsersQuery } from '@/api/mastersApi';
import { useToast } from '@/components/ui/ToastHost';
import { time24To12, time12To24 } from '@/utils/format';
import { useDatabaseStoredState } from '@/hooks/useDatabaseStoredState';

import { useNavigate } from 'react-router-dom';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [searchQ, setSearchQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const { showToast } = useToast();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const { data: projects = [], isLoading, isError, refetch } = useGetProjectsQuery({ q: searchQ || undefined });
  const { data: leadsData } = useApplicationsQuery({ page: 1, page_size: 100 });
  const { data: users = [] } = useUsersQuery();
  const [createProject, { isLoading: isCreating }] = useCreateProjectMutation();
  const [deleteProject] = useDeleteProjectMutation();

  const DEFAULT_PROJECT_CATEGORIES = [
    'Vehicle Customization',
    'Delivery & Payout',
    'Document Operations',
    'General ERP Task',
    'IT & Software',
    'Finance & Audit',
    'Construction & Operations',
  ];

  const [projectCategories] = useDatabaseStoredState<string[]>(
    'crm_project_categories',
    DEFAULT_PROJECT_CATEGORIES,
  );

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState(DEFAULT_PROJECT_CATEGORIES[0] || '');
  useEffect(() => {
    if (projectCategories.length > 0 && !projectCategories.includes(category)) {
      setCategory(projectCategories[0]);
    }
  }, [category, projectCategories]);
  const [leadId, setLeadId] = useState<number | ''>('');
  const [managerId, setManagerId] = useState<number | ''>('');
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [budget, setBudget] = useState<number | ''>('');
  const [targetStartDate, setTargetStartDate] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  const [targetEndTime, setTargetEndTime] = useState('');
  const [prefix, setPrefix] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) {
      showToast('Project name is required', 'error');
      return;
    }
    try {
      await createProject({
        name: name.trim(),
        category,
        lead_id: leadId ? Number(leadId) : undefined,
        owner_id: managerId ? Number(managerId) : undefined,
        budget: budget ? Number(budget) : 0,
        target_start_date: targetStartDate || undefined,
        target_end_date: targetEndDate || undefined,
        target_end_time: targetEndTime || undefined,
        prefix: prefix.toUpperCase().slice(0, 3),
      } as any).unwrap();
      showToast('Project created successfully', 'success');
      setCreateOpen(false);
      setName('');
      setLeadId('');
      setManagerId('');
      setMemberIds([]);
      setBudget('');
      setTargetStartDate('');
      setTargetEndDate('');
      setTargetEndTime('');
      setPrefix('');
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to create project', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this project?')) {
      try {
        await deleteProject(id).unwrap();
        showToast('Project deleted', 'success');
      } catch {
        showToast('Could not delete project', 'error');
      }
    }
  };

  const totalBudget = projects.reduce((acc, p) => acc + (p.budget || 0), 0);
  const totalCompleted = projects.filter((p) => p.status_id === 4 || p.progress === 100 || p.status_name === 'Completed').length;

  const getStatusInfo = (p: ProjectItem) => {
    const st = p.status_name || (p.status_id === 4 || p.progress === 100 ? 'Completed' : p.status_id === 2 ? 'In Progress' : p.status_id === 3 ? 'On Hold' : 'Planning');
    switch (st) {
      case 'In Progress':
        return { label: 'In Progress', bg: '#E0F2FE', color: '#0369A1' };
      case 'On Hold':
        return { label: 'On Hold', bg: '#FEF3C7', color: '#D97706' };
      case 'Completed':
        return { label: 'Completed', bg: '#DCFCE7', color: '#15803D' };
      default:
        return { label: 'Planning', bg: '#F1F5F9', color: '#475569' };
    }
  };

  const filteredProjects = projects.filter((p) => {
    const stName = getStatusInfo(p).label;
    if (tabValue === 1) return stName === 'In Progress';
    if (tabValue === 2) return stName === 'Planning';
    if (tabValue === 3) return stName === 'On Hold';
    if (tabValue === 4) return stName === 'Completed';
    return true;
  });

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', minWidth: 0, px: 0, py: 0.5, boxSizing: 'border-box' }}>
      {/* Header Action Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2.5 }}>

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<Upload size={18} />}
            onClick={() => setImportDialogOpen(true)}
            sx={{
              borderColor: '#cbd5e1',
              color: '#334155',
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Import
          </Button>
          <Button
            variant="contained"
            startIcon={<Plus size={18} />}
            onClick={() => setCreateOpen(true)}
            sx={{
              backgroundColor: '#203020',
              '&:hover': { backgroundColor: '#2A402A' },
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            New Project
          </Button>
        </Box>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: '12px', bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Box sx={{ p: 1, borderRadius: '8px', backgroundColor: 'action.hover', color: isDark ? '#16C47F' : '#203020' }}>
                <Briefcase size={20} />
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                Total Projects
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
              {projects.length}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: '12px', bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Box sx={{ p: 1, borderRadius: '8px', backgroundColor: 'action.hover', color: '#2563EB' }}>
                <Clock size={20} />
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                In Progress
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
              {projects.filter((p) => p.status_id === 2).length}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: '12px', bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Box sx={{ p: 1, borderRadius: '8px', backgroundColor: 'action.hover', color: '#DB2777' }}>
                <CheckCircle2 size={20} />
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                Completed
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
              {totalCompleted}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: '12px', bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Box sx={{ p: 1, borderRadius: '8px', backgroundColor: 'action.hover', color: '#D97706' }}>
                <ListTodo size={20} />
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                Total Budget
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
              ₹{totalBudget.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Filter Tabs & Search */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', mb: 3, bgcolor: 'background.paper' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Tabs value={tabValue} onChange={(_e, v) => setTabValue(v)}>
            <Tab label={`All (${projects.length})`} />
            <Tab label="In Progress" />
            <Tab label="Planning" />
            <Tab label="On Hold" />
            <Tab label="Completed" />
          </Tabs>

          <TextField
            size="small"
            placeholder="Search projects..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            InputProps={{
              startAdornment: <Search size={16} style={{ marginRight: 8, opacity: 0.7 }} />,
            }}
            sx={{ width: 260, my: 1 }}
          />
        </Box>

        {/* Project Cards Grid */}
        <Box sx={{ p: 3 }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={32} sx={{ color: isDark ? '#16C47F' : '#203020' }} />
            </Box>
          ) : isError ? (
            <Box sx={{ textAlignment: 'center', py: 6 }}>
              <Typography color="error">Failed to load projects</Typography>
              <Button onClick={() => refetch()} sx={{ mt: 1 }}>Retry</Button>
            </Box>
          ) : filteredProjects.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                No projects found matching the selected criteria.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {filteredProjects.map((project) => (
                <Grid item xs={12} md={6} lg={4} key={project.id}>
                  <Card
                    elevation={0}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    sx={{
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: '12px',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      bgcolor: 'background.paper',
                      '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.12)', borderColor: 'text.secondary' },
                    }}
                  >
                    <CardContent sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                        <Chip
                          label={project.category}
                          size="small"
                          sx={{ backgroundColor: 'action.hover', color: 'text.primary', fontWeight: 600, fontSize: '0.75rem' }}
                        />
                        {project.prefix && (
                          <Chip
                            label={project.prefix}
                            size="small"
                            sx={{ backgroundColor: '#E2E8F0', color: '#1E293B', fontWeight: 700, fontSize: '0.75rem', fontFamily: 'monospace' }}
                          />
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {(() => {
                            const stInfo = getStatusInfo(project);
                            return (
                              <Chip
                                label={stInfo.label}
                                size="small"
                                sx={{
                                  backgroundColor: stInfo.bg,
                                  color: stInfo.color,
                                  fontWeight: 700,
                                  fontSize: '0.72rem',
                                }}
                              />
                            );
                          })()}
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }} sx={{ color: '#EF4444' }}>
                            <Trash2 size={16} />
                          </IconButton>
                        </Box>
                      </Box>

                      <Typography variant="h6" sx={{ fontSize: '1.05rem', fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
                        {project.name}
                      </Typography>

                      {project.lead_app_no && (
                        <Typography variant="caption" sx={{ color: '#4ADE80', fontWeight: 600, mb: 1, display: 'block' }}>
                          Ref CRM: {project.lead_app_no} ({project.lead_customer_name || 'Customer'})
                        </Typography>
                      )}

                      <Box sx={{ mt: 'auto', pt: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                            Progress
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>
                            {project.progress}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={project.progress}
                          sx={{ height: 6, borderRadius: 3, backgroundColor: 'divider', '& .MuiLinearProgress-bar': { backgroundColor: '#16C47F' } }}
                        />
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Budget: <strong>₹{project.budget.toLocaleString()}</strong>
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Tasks: <strong>{project.tasks_count?.done || 0}/{project.tasks_count?.total || 0}</strong>
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Paper>

      {/* New Project Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Create New Project</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Project Name *"
              fullWidth
              size="small"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. KIM Electric Scooter Customization"
            />

            <TextField
              label="Category"
              fullWidth
              size="small"
              select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {projectCategories.map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {cat}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Project Manager"
              fullWidth
              size="small"
              select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value ? Number(e.target.value) : '')}
            >
              <MenuItem value="">Select Project Manager...</MenuItem>
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.full_name} ({u.email})
                </MenuItem>
              ))}
            </TextField>

            <FormControl fullWidth size="small">
              <InputLabel id="project-members-label">Project Team Members (Multiple)</InputLabel>
              <Select
                labelId="project-members-label"
                multiple
                value={memberIds}
                onChange={(e) => {
                  const val = e.target.value;
                  setMemberIds(typeof val === 'string' ? val.split(',').map(Number) : val);
                }}
                input={<OutlinedInput label="Project Team Members (Multiple)" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((id) => {
                      const u = users.find((usr) => usr.id === id);
                      return <Chip key={id} label={u?.full_name || `User #${id}`} size="small" />;
                    })}
                  </Box>
                )}
              >
                {users.map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    <Checkbox checked={memberIds.includes(u.id)} />
                    <ListItemText primary={u.full_name} secondary={u.role || u.email} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Task ID Prefix (3 chars)"
              fullWidth
              size="small"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase().slice(0, 3))}
              placeholder="e.g. ARR"
              helperText="e.g. ARR → tasks will be ARR-T1, ARR-T2…"
            />

            <TextField
              label="Budget (INR)"
              type="number"
              fullWidth
              size="small"
              value={budget}
              onChange={(e) => setBudget(e.target.value ? Number(e.target.value) : '')}
            />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Target Start Date"
                  type="date"
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={targetStartDate}
                  onChange={(e) => setTargetStartDate(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Target End Date"
                  type="date"
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={targetEndDate}
                  onChange={(e) => setTargetEndDate(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Target End Time"
                  type="time"
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={time12To24(targetEndTime)}
                  onChange={(e) => setTargetEndTime(e.target.value ? time24To12(e.target.value) : '')}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ color: '#64748B' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={isCreating}
            sx={{ backgroundColor: '#203020', '&:hover': { backgroundColor: '#2A402A' } }}
          >
            {isCreating ? 'Creating...' : 'Create Project'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Universal Import Modal */}
      <UniversalImportModal
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        title="Import Projects"
        entityName="Projects"
        erpFields={[
          { key: 'name', label: 'Project Name', required: true },
          { key: 'category', label: 'Category' },
          { key: 'budget', label: 'Budget' },
          { key: 'start_date', label: 'Start Date' },
          { key: 'end_date', label: 'End Date' },
          { key: 'status', label: 'Status' },
        ]}
        onImport={(mappedRows) => {
          showToast(`Imported ${mappedRows.length} projects successfully`, 'success');
          refetch();
          return mappedRows.length;
        }}
      />
    </Box>
  );
}
