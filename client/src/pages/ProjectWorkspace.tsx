import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  CircularProgress,
  LinearProgress,
  Paper,
  Divider,
  Tooltip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputAdornment,
  useTheme,
} from '@mui/material';
import {
  ArrowLeft,
  Settings,
  Briefcase,
  Users,
  Clock,
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertCircle,
  User,
} from 'lucide-react';
import { useGetProjectQuery, useUpdateProjectMutation } from '@/api/projectsApi';
import { useUsersQuery } from '@/api/mastersApi';
import ProjectTasksList from '@/components/projects/ProjectTasksList';
import ProjectMilestonesList from '@/components/projects/ProjectMilestonesList';
import { formatStandardDateTime, time24To12, time12To24 } from '@/utils/format';
import ProjectTimelineView from '@/components/projects/ProjectTimelineView';
import ProjectTeamView from '@/components/projects/ProjectTeamView';
import AutoSaveStatusBadge from '@/components/common/AutoSaveStatusBadge';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useToast } from '@/components/ui/ToastHost';
import StandardDateInput from '@/components/common/StandardDateInput';

export default function ProjectWorkspace() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');

  const numericId = Number(id);
  const { data: project, isLoading, isError } = useGetProjectQuery(numericId, {
    skip: !numericId,
  });

  const { showToast } = useToast();
  const [updateProject] = useUpdateProjectMutation();
  const { data: users = [] } = useUsersQuery();

  const DEFAULT_PROJECT_CATEGORIES = [
    'Vehicle Customization',
    'Delivery & Payout',
    'Document Operations',
    'General ERP Task',
    'IT & Software',
    'Finance & Audit',
    'Construction & Operations',
  ];

  // Editable Project Form States
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Vehicle Customization');
  const [ownerId, setOwnerId] = useState<number | ''>('');
  const [targetStartDate, setTargetStartDate] = useState('');
  const [targetStartTime, setTargetStartTime] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  const [targetEndTime, setTargetEndTime] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [completionTime, setCompletionTime] = useState('');
  const [budget, setBudget] = useState<number | ''>('');

  const autoSave = useAutoSave({
    onSave: async (patch) => {
      if (!numericId) return;
      return await updateProject({ id: numericId, body: patch }).unwrap();
    },
    onError: (_patch, err) => {
      showToast(err?.data?.detail || 'Failed to auto-save project changes', 'error');
    },
  });

  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setDescription(project.description || '');
      setCategory(project.category || 'Vehicle Customization');
      setOwnerId(project.owner_id ?? '');
      setTargetStartDate(project.target_start_date ? project.target_start_date.split('T')[0] : '');
      setTargetStartTime(project.target_start_time || '');
      setTargetEndDate(project.target_end_date ? project.target_end_date.split('T')[0] : '');
      setTargetEndTime(project.target_end_time || '');
      setCompletionDate(project.completion_date ? project.completion_date.split('T')[0] : '');
      setCompletionTime(project.completion_time || '');
      setBudget(project.budget !== undefined && project.budget !== null ? project.budget : '');
    }
  }, [
    project?.id,
    project?.name,
    project?.description,
    project?.category,
    project?.owner_id,
    project?.target_start_date,
    project?.target_start_time,
    project?.target_end_date,
    project?.target_end_time,
    project?.completion_date,
    project?.completion_time,
    project?.budget,
  ]);

  const hasTasks = Boolean(project?.tasks_count && project.tasks_count.total > 0);

  const projectDurationDisplay = useMemo(() => {
    const s = targetStartDate;
    const e = targetEndDate;
    if (!s || !e) return null;
    const d1 = new Date(s);
    const d2 = new Date(e);
    const diffTime = d2.getTime() - d1.getTime();
    if (diffTime < 0) return '0 Days';
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24)) + 1;
    return `${diffDays} Days`;
  }, [targetStartDate, targetEndDate]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    autoSave.flushPending();
    setTab(newValue);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (isError || !project) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <AlertCircle size={40} color="#DC2626" style={{ marginBottom: 12 }} />
        <Typography variant="h6" color="error">Project not found</Typography>
        <Button variant="outlined" sx={{ mt: 2 }} onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </Box>
    );
  }

  const projectCode = project.code || `PRJ-${project.id}`;
  const totalTasks = project.tasks_count?.total || 0;
  const doneTasks = project.tasks_count?.done || 0;
  const progressPercent = project.progress > 0 ? project.progress : (totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0);

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', minWidth: 0, px: 0, py: 0.5, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 2.5, height: '100%' }}>
      {/* Sticky Header */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'background.default',
          pb: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', flex: 1 }}>
            <IconButton onClick={() => navigate('/projects')} size="small">
              <ArrowLeft size={20} />
            </IconButton>
            <TextField
              variant="standard"
              value={name}
              placeholder="Project Name..."
              onChange={(e) => {
                setName(e.target.value);
                autoSave.registerPendingChange('name', e.target.value.trim(), project.name);
              }}
              onBlur={() => {
                const trimmed = name.trim();
                if (trimmed && trimmed !== project.name) {
                  autoSave.saveField('name', trimmed, project.name);
                } else if (!trimmed) {
                  setName(project.name);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLElement).blur();
              }}
              InputProps={{
                disableUnderline: true,
                sx: {
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  color: 'text.primary',
                  borderRadius: '6px',
                  px: 0.5,
                  py: 0.25,
                  transition: 'background-color 0.15s',
                  '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
                  '&.Mui-focused': { bgcolor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)' },
                },
              }}
              sx={{ minWidth: 240, maxWidth: 450 }}
            />
            <Chip size="small" label={projectCode} variant="outlined" sx={{ fontWeight: 600, fontSize: 12, borderRadius: '6px' }} />
            <AutoSaveStatusBadge
              status={autoSave.status}
              lastSaved={autoSave.lastSaved}
              errorMessage={autoSave.errorMessage}
              onRetry={autoSave.retry}
            />

            {/* Beautiful Solid Green Pill Badges (Button Size & Rounded) */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', ml: { xs: 0, sm: 1 } }}>
              <Chip
                label={`Progress: ${progressPercent}%`}
                sx={{
                  bgcolor: isDark ? 'rgba(22, 196, 127, 0.15)' : '#203020',
                  color: isDark ? '#16C47F' : '#FFFFFF',
                  border: isDark ? '1px solid rgba(22, 196, 127, 0.3)' : 'none',
                  fontWeight: 700,
                  fontSize: 12,
                  height: 32,
                  borderRadius: '9999px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  '& .MuiChip-label': { px: 1.5 },
                }}
              />
              <Chip
                label={`Tasks Completion: ${doneTasks}/${totalTasks}`}
                sx={{
                  bgcolor: isDark ? 'rgba(22, 196, 127, 0.15)' : '#203020',
                  color: isDark ? '#16C47F' : '#FFFFFF',
                  border: isDark ? '1px solid rgba(22, 196, 127, 0.3)' : 'none',
                  fontWeight: 700,
                  fontSize: 12,
                  height: 32,
                  borderRadius: '9999px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  '& .MuiChip-label': { px: 1.5 },
                }}
              />
              <Chip
                label={`Budget Usage: ₹${(project.actual_cost || 0).toLocaleString()} / ₹${(project.budget || 0).toLocaleString()}`}
                sx={{
                  bgcolor: isDark ? 'rgba(22, 196, 127, 0.15)' : '#203020',
                  color: isDark ? '#16C47F' : '#FFFFFF',
                  border: isDark ? '1px solid rgba(22, 196, 127, 0.3)' : 'none',
                  fontWeight: 700,
                  fontSize: 12,
                  height: 32,
                  borderRadius: '9999px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  '& .MuiChip-label': { px: 1.5 },
                }}
              />
            </Box>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Settings size={16} />}
            onClick={() => navigate('/projects/configuration')}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
          >
            Settings
          </Button>
        </Box>

        {/* Workspace Tabs */}
        <Tabs
          value={tab}
          onChange={handleTabChange}
          variant="scrollable"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: 13,
              minHeight: 40,
              py: 1,
            },
            '& .Mui-selected': {
              color: isDark ? '#16C47F' : '#203020',
            },
            '& .MuiTabs-indicator': {
              backgroundColor: isDark ? '#16C47F' : '#203020',
              height: 3,
            },
          }}
        >
          <Tab label="Overview" value="overview" />
          <Tab label="Tasks" value="tasks" />
          <Tab label="Milestones" value="milestones" />
          <Tab label="Timeline (Gantt)" value="timeline" />
          <Tab label="Team" value="team" />
          <Tab label="Expenses" value="expenses" />
        </Tabs>
      </Box>

      {/* Tab Content Area */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* ── OVERVIEW TAB ────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <Grid container spacing={3}>
            {/* Project Summary & Details */}
            <Grid item xs={12} md={8}>
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
                  Project Overview
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    autoSave.registerPendingChange('description', e.target.value.trim(), project.description || '');
                  }}
                  onBlur={() => autoSave.saveField('description', description.trim(), project.description || '')}
                  placeholder="Add detailed description, objectives, and scope for this project..."
                  sx={{ mb: 3, '& .MuiOutlinedInput-root': { fontSize: 14 } }}
                />

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: '6px', border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>CATEGORY</Typography>
                      <Select
                        size="small"
                        fullWidth
                        value={category}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCategory(val);
                          autoSave.saveField('category', val, project.category);
                        }}
                        sx={{ bgcolor: 'background.paper', fontSize: 13, fontWeight: 600 }}
                      >
                        {DEFAULT_PROJECT_CATEGORIES.map((c) => (
                          <MenuItem key={c} value={c}>{c}</MenuItem>
                        ))}
                      </Select>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: '6px', border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>PROJECT OWNER</Typography>
                      <Select
                        size="small"
                        fullWidth
                        displayEmpty
                        value={ownerId}
                        onChange={(e) => {
                          const val = e.target.value === '' ? undefined : Number(e.target.value);
                          setOwnerId(val ?? '');
                          autoSave.saveField('owner_id', val || null, project.owner_id);
                        }}
                        sx={{ bgcolor: 'background.paper', fontSize: 13, fontWeight: 600 }}
                      >
                        <MenuItem value=""><em>Unassigned</em></MenuItem>
                        {users.map((u) => (
                          <MenuItem key={u.id} value={u.id}>
                            {u.full_name || u.email}
                          </MenuItem>
                        ))}
                      </Select>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: '6px', border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                        TARGET START DATE & TIME {hasTasks && <span style={{ fontWeight: 400, opacity: 0.8 }}>(Calculated from Tasks)</span>}
                      </Typography>
                      <Tooltip title={hasTasks ? "Calculated: Earliest Start Date & Time among project tasks" : ""}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <StandardDateInput
                            value={targetStartDate}
                            disabled={hasTasks}
                            onChange={(val) => {
                              if (hasTasks) return;
                              setTargetStartDate(val);
                              autoSave.saveField('target_start_date', val || null, project.target_start_date);
                            }}
                          />
                          <TextField
                            type="time"
                            size="small"
                            disabled={hasTasks}
                            value={time12To24(targetStartTime || '')}
                            onChange={(e) => {
                              if (hasTasks) return;
                              const val = e.target.value ? time24To12(e.target.value) : '';
                              setTargetStartTime(val);
                              autoSave.registerPendingChange('target_start_time', val || null, project.target_start_time);
                            }}
                            onBlur={() => {
                              if (hasTasks) return;
                              autoSave.saveField('target_start_time', targetStartTime || null, project.target_start_time);
                            }}
                            sx={{
                              width: 110,
                              '& .MuiOutlinedInput-root': { height: 36, fontSize: 12, bgcolor: hasTasks ? 'action.hover' : 'background.paper' },
                              '& .MuiInputBase-input': { cursor: hasTasks ? 'default' : 'pointer' },
                            }}
                          />
                        </Box>
                      </Tooltip>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: '6px', border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                        TARGET COMPLETION DATE & TIME {hasTasks && <span style={{ fontWeight: 400, opacity: 0.8 }}>(Calculated from Tasks)</span>}
                      </Typography>
                      <Tooltip title={hasTasks ? "Calculated: Latest Due Date & Time among project tasks" : ""}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <StandardDateInput
                            value={targetEndDate}
                            disabled={hasTasks}
                            onChange={(val) => {
                              if (hasTasks) return;
                              setTargetEndDate(val);
                              autoSave.saveField('target_end_date', val || null, project.target_end_date);
                            }}
                          />
                          <TextField
                            type="time"
                            size="small"
                            disabled={hasTasks}
                            value={time12To24(targetEndTime || '')}
                            onChange={(e) => {
                              if (hasTasks) return;
                              const val = e.target.value ? time24To12(e.target.value) : '';
                              setTargetEndTime(val);
                              autoSave.registerPendingChange('target_end_time', val || null, project.target_end_time);
                            }}
                            onBlur={() => {
                              if (hasTasks) return;
                              autoSave.saveField('target_end_time', targetEndTime || null, project.target_end_time);
                            }}
                            sx={{
                              width: 110,
                              '& .MuiOutlinedInput-root': { height: 36, fontSize: 12, bgcolor: hasTasks ? 'action.hover' : 'background.paper' },
                              '& .MuiInputBase-input': { cursor: hasTasks ? 'default' : 'pointer' },
                            }}
                          />
                        </Box>
                      </Tooltip>
                    </Box>
                  </Grid>

                  {/* Project Duration Card */}
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: '6px', border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                        PROJECT DURATION {hasTasks && <span style={{ fontWeight: 400, opacity: 0.8 }}>(Calculated from Tasks)</span>}
                      </Typography>
                      <Tooltip title={hasTasks ? "Calculated: Duration between earliest start and latest completion of child tasks" : "Estimated Project Duration"}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, py: 0.75, color: projectDurationDisplay ? 'text.primary' : 'text.disabled' }}>
                          {projectDurationDisplay || '—'}
                        </Typography>
                      </Tooltip>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: '6px', border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>ACTUAL COMPLETION DATE & TIME</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <StandardDateInput
                          value={completionDate}
                          onChange={(val) => {
                            setCompletionDate(val);
                            autoSave.saveField('completion_date', val || null, project.completion_date);
                          }}
                        />
                        <TextField
                          type="time"
                          size="small"
                          value={time12To24(completionTime)}
                          onChange={(e) => {
                            const val = e.target.value ? time24To12(e.target.value) : '';
                            setCompletionTime(val);
                            autoSave.registerPendingChange('completion_time', val || null, project.completion_time);
                          }}
                          onBlur={() => autoSave.saveField('completion_time', completionTime || null, project.completion_time)}
                          sx={{ width: 110, '& .MuiOutlinedInput-root': { height: 36, fontSize: 12, bgcolor: 'background.paper' } }}
                        />
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>

              {/* Progress & Milestone Tracking */}
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', mb: 2 }}>
                  Completion Status
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>Overall Project Progress</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: isDark ? '#16C47F' : '#203020' }}>{progressPercent}%</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={progressPercent}
                    sx={{ height: 8, borderRadius: 4, bgcolor: 'divider', '& .MuiLinearProgress-bar': { bgcolor: isDark ? '#16C47F' : '#203020' } }}
                  />
                </Box>
              </Paper>
            </Grid>

            {/* Side Column: Linked Lead & Financial Details */}
            <Grid item xs={12} md={4}>
              {/* Linked CRM Lead Info */}
              {project.lead_customer_name && (
                <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, mb: 3 }}>
                  <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: 700, mb: 1 }}>
                    LINKED CRM APPLICATION
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {project.lead_customer_name}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 2 }}>
                    App No: {project.lead_app_no || 'N/A'}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => navigate(`/leads/${project.lead_id}`)}
                    sx={{ textTransform: 'none', fontSize: 12 }}
                  >
                    View CRM Lead Details
                  </Button>
                </Paper>
              )}

              {/* Financial Breakdown */}
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
                <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: 700, mb: 2 }}>
                  FINANCIAL SUMMARY
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="textSecondary">Total Budget:</Typography>
                    <TextField
                      type="number"
                      size="small"
                      value={budget}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        setBudget(val);
                        autoSave.registerPendingChange('budget', val === '' ? 0 : Number(val), project.budget || 0);
                      }}
                      onBlur={() => autoSave.saveField('budget', budget === '' ? 0 : Number(budget), project.budget || 0)}
                      InputProps={{
                        startAdornment: <InputAdornment position="start"><Typography variant="caption" sx={{ fontWeight: 700 }}>₹</Typography></InputAdornment>,
                      }}
                      sx={{
                        width: 150,
                        '& .MuiOutlinedInput-root': { height: 32, fontSize: 13, fontWeight: 700, bgcolor: 'background.default' },
                        '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                          WebkitAppearance: 'none',
                          margin: 0,
                        },
                        '& input[type=number]': {
                          MozAppearance: 'textfield',
                        },
                      }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="textSecondary">Estimated Cost:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                      ₹{(project.estimated_cost || 0).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="textSecondary">Actual Cost Logged:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: isDark ? '#16C47F' : '#16A34A' }}>
                      ₹{(project.actual_cost || 0).toLocaleString()}
                    </Typography>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>Remaining Budget:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: isDark ? '#16C47F' : '#203020' }}>
                      ₹{Math.max(0, (project.budget || 0) - (project.actual_cost || 0)).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* ── OTHER TABS ─────────────────────────────────────────────────── */}
        {tab === 'tasks' && <ProjectTasksList projectId={id!} />}
        {tab === 'milestones' && <ProjectMilestonesList projectId={id!} />}
        {tab === 'timeline' && <ProjectTimelineView projectId={id!} />}
        {tab === 'team' && <ProjectTeamView projectId={id!} />}

        {tab === 'expenses' && (
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 4, textAlign: 'center' }}>
            <DollarSign size={32} color={isDark ? '#16C47F' : '#203020'} style={{ marginBottom: 8 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>Project Expenses</Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
              Track purchase orders, vendor invoices, and material costs logged against {project.name}.
            </Typography>
          </Paper>
        )}
      </Box>
    </Box>
  );
}
