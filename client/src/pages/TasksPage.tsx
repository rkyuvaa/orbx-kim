import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  CircularProgress,
  Tabs,
  Tab,
  useTheme,
} from '@mui/material';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  UserCheck,
  Briefcase,
  Upload,
} from 'lucide-react';
import UniversalImportModal from '@/components/ui/UniversalImportModal';
import {
  useGetTasksQuery,
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useGetProjectsQuery,
  useGetStatusDefinitionsQuery,
  TaskItem,
  TaskDependencyInfo,
} from '@/api/projectsApi';
import { useUsersQuery } from '@/api/mastersApi';
import { useToast } from '@/components/ui/ToastHost';

import { useAppSelector } from '@/app/hooks';
import TaskListView from '@/components/projects/TaskListView';
import TaskBoardView from '@/components/projects/TaskBoardView';
import TaskDetailPanel from '@/components/projects/TaskDetailPanel';
import TaskBulkActionBar from '@/components/projects/TaskBulkActionBar';

type ActiveView = 'list' | 'board';
type TaskScope = 'my' | 'all';

interface TasksPageProps {
  defaultView?: ActiveView;
  defaultScope?: TaskScope;
}

export default function TasksPage({ defaultView = 'list', defaultScope = 'all' }: TasksPageProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [activeView, setActiveView] = useState<ActiveView>(defaultView);
  const [taskScope, setTaskScope] = useState<TaskScope>(defaultScope);
  const currentUser = useAppSelector((state) => state.auth.user);

  React.useEffect(() => {
    setActiveView(defaultView);
  }, [defaultView]);

  React.useEffect(() => {
    setTaskScope(defaultScope);
  }, [defaultScope]);

  const [searchQ, setSearchQ] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [selectedStatusId, setSelectedStatusId] = useState<number | ''>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('');

  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [selectedDep, setSelectedDep] = useState<TaskDependencyInfo | null>(null);

  const { showToast } = useToast();

  const { data: tasks = [], isLoading, isError, refetch } = useGetTasksQuery({
    project_id: selectedProjectId ? Number(selectedProjectId) : undefined,
    status: selectedStatusId ? String(selectedStatusId) : undefined,
    priority: selectedPriority || undefined,
    q: searchQ || undefined,
    my_tasks_only: taskScope === 'my',
  });

  const { data: projects = [] } = useGetProjectsQuery();
  const { data: statuses = [] } = useGetStatusDefinitionsQuery();
  const { data: users = [] } = useUsersQuery();

  const [createTask, { isLoading: isCreating }] = useCreateTaskMutation();
  const [deleteTask] = useDeleteTaskMutation();

  // Create Task Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<number | ''>('');
  const [priority, setPriority] = useState<'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'>('NORMAL');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState<number | ''>('');
  const [assigneeId, setAssigneeId] = useState<number | ''>('');

  const handleCreateTask = async () => {
    if (!title.trim()) {
      showToast('Task title is mandatory', 'error');
      return;
    }
    try {
      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        project_id: projectId ? Number(projectId) : undefined,
        priority,
        due_date: dueDate || undefined,
        estimated_minutes: estimatedHours ? Number(estimatedHours) * 60 : 0,
        assignees: assigneeId ? [{ user_id: Number(assigneeId) } as any] : (currentUser ? [{ user_id: currentUser.id }] : []),
      } as any).unwrap();
      showToast('Task created successfully', 'success');
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      setProjectId('');
      setDueDate('');
      setEstimatedHours('');
      setAssigneeId('');
    } catch (err: any) {
      showToast(err?.data?.detail?.message || 'Could not create task', 'error');
    }
  };

  const handleDeleteTask = async (id: number) => {
    if (confirm('Are you sure you want to delete this task?')) {
      try {
        await deleteTask(id).unwrap();
        showToast('Task deleted', 'info');
      } catch {
        showToast('Failed to delete task', 'error');
      }
    }
  };

  const handleToggleSelectTask = (id: number) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllTasks = (ids: number[]) => {
    setSelectedTaskIds(ids);
  };

  const handleOpenDetail = (task: TaskItem) => {
    setSelectedTask(task);
    setSelectedDep(null);
    setPanelOpen(true);
  };

  const handleOpenDetailWithDep = (task: TaskItem, dep: TaskDependencyInfo) => {
    setSelectedTask(task);
    setSelectedDep(dep);
    setPanelOpen(true);
  };

  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeProjects = Array.isArray(projects) ? projects : [];

  const filteredTasks = safeTasks; // Use directly since backend is filtering

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', minWidth: 0, px: 0, py: 0.5, boxSizing: 'border-box' }}>
      {/* Top Header & Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F172A' }}>
          {taskScope === 'my' ? 'My Tasks' : 'Tasks'}
        </Typography>

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
              fontWeight: 700,
              px: 2,
              py: 1,
            }}
          >
            Import
          </Button>
          <Button
            variant="contained"
            startIcon={<Plus size={18} />}
            onClick={() => setCreateOpen(true)}
            sx={{
              bgcolor: '#203020',
              '&:hover': { bgcolor: '#2A402A' },
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 700,
              px: 2.5,
              py: 1,
            }}
          >
            New Task
          </Button>
        </Box>
      </Box>

      {/* Scope Toggle, View Switcher & Filters */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', mb: 3, bgcolor: 'background.paper', overflow: 'hidden' }}>
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          {/* Scope Toggle: My Tasks vs Projects Tasks */}
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mr: 0.5 }}>
              Scope:
            </Typography>
            <Button
              variant={taskScope === 'my' ? 'contained' : 'outlined'}
              onClick={() => setTaskScope('my')}
              startIcon={<UserCheck size={16} />}
              sx={{
                bgcolor: taskScope === 'my' ? '#203020' : 'transparent',
                borderColor: taskScope === 'my' ? '#203020' : (isDark ? 'rgba(255,255,255,0.15)' : 'divider'),
                color: taskScope === 'my' ? '#fff' : (isDark ? '#16C47F' : '#203020'),
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 2,
                height: 36,
                '&:hover': {
                  bgcolor: taskScope === 'my' ? '#2A402A' : (isDark ? 'rgba(22, 196, 127,0.08)' : 'rgba(32,48,32,0.08)'),
                  borderColor: isDark ? '#16C47F' : '#203020',
                },
              }}
            >
              My Tasks
            </Button>
            <Button
              variant={taskScope === 'all' ? 'contained' : 'outlined'}
              onClick={() => setTaskScope('all')}
              startIcon={<Briefcase size={16} />}
              sx={{
                bgcolor: taskScope === 'all' ? '#203020' : 'transparent',
                borderColor: taskScope === 'all' ? '#203020' : (isDark ? 'rgba(255,255,255,0.15)' : 'divider'),
                color: taskScope === 'all' ? '#fff' : (isDark ? '#16C47F' : '#203020'),
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 2,
                height: 36,
                '&:hover': {
                  bgcolor: taskScope === 'all' ? '#2A402A' : (isDark ? 'rgba(22, 196, 127,0.08)' : 'rgba(32,48,32,0.08)'),
                  borderColor: isDark ? '#16C47F' : '#203020',
                },
              }}
            >
              Projects Tasks
            </Button>
          </Stack>

          {/* View Switcher: List View (default) & Kanban View only */}
          <Tabs
            value={activeView}
            onChange={(_, val) => setActiveView(val)}
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 700,
                fontSize: 14,
                minHeight: 40,
                color: 'text.secondary',
              },
              '& .Mui-selected': { color: isDark ? '#16C47F' : '#203020' },
              '& .MuiTabs-indicator': { bgcolor: isDark ? '#16C47F' : '#203020', height: 3 },
            }}
          >
            <Tab value="list" label="List View" icon={<List size={16} />} iconPosition="start" />
            <Tab value="board" label="Kanban View" icon={<LayoutGrid size={16} />} iconPosition="start" />
          </Tabs>
        </Box>

        {/* Global Filter Bar (No Cost Center) */}
        <Box sx={{ p: 2, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', bgcolor: 'background.default' }}>
          <TextField
            size="small"
            placeholder="Search by ID, title, description..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            InputProps={{
              startAdornment: <Search size={16} style={{ marginRight: 8, opacity: 0.6 }} />,
            }}
            sx={{ width: { xs: '100%', sm: 280 }, '& .MuiOutlinedInput-root': { bgcolor: 'background.paper', height: 36 } }}
          />

          <Select
            size="small"
            displayEmpty
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value as number)}
            sx={{ width: { xs: '100%', sm: 220 }, height: 36, bgcolor: 'background.paper', fontSize: 13 }}
          >
            <MenuItem value="">All Projects</MenuItem>
            {safeProjects.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </Select>

          <Select
            size="small"
            displayEmpty
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value as string)}
            sx={{ width: { xs: '100%', sm: 160 }, height: 36, bgcolor: 'background.paper', fontSize: 13 }}
          >
            <MenuItem value="">All Priorities</MenuItem>
            <MenuItem value="URGENT">Urgent</MenuItem>
            <MenuItem value="HIGH">High</MenuItem>
            <MenuItem value="NORMAL">Normal</MenuItem>
            <MenuItem value="LOW">Low</MenuItem>
          </Select>
        </Box>
      </Paper>

      {/* Main Content View Container */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress size={40} sx={{ color: isDark ? '#16C47F' : '#203020' }} />
        </Box>
      ) : isError ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography color="error">Failed to load tasks</Typography>
          <Button onClick={() => refetch()} sx={{ mt: 1 }}>Retry</Button>
        </Box>
      ) : (
        <>
          {activeView === 'list' && (
            <TaskListView
              tasks={filteredTasks}
              selectedTaskIds={selectedTaskIds}
              onToggleSelectTask={handleToggleSelectTask}
              onSelectAllTasks={handleSelectAllTasks}
              onOpenTaskDetail={handleOpenDetail}
              onOpenTaskDetailWithDep={handleOpenDetailWithDep}
              onDeleteTask={handleDeleteTask}
            />
          )}

          {activeView === 'board' && (
            <TaskBoardView
              tasks={filteredTasks}
              onOpenTaskDetail={handleOpenDetail}
              onDeleteTask={handleDeleteTask}
              onQuickCreateTask={() => setCreateOpen(true)}
            />
          )}
        </>
      )}

      {/* Detail Drawer */}
      <TaskDetailPanel
        open={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setSelectedDep(null);
        }}
        task={selectedTask}
        initialEditingDep={selectedDep}
      />

      {/* Bulk Action Toolbar */}
      <TaskBulkActionBar
        selectedCount={selectedTaskIds.length}
        selectedTaskIds={selectedTaskIds}
        onClearSelection={() => setSelectedTaskIds([])}
      />

      {/* Create Task Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Create New Task</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Task Title *"
              fullWidth
              size="small"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Server Migration & DB Indexing"
            />

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Project"
                  fullWidth
                  size="small"
                  select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <MenuItem value="">Standalone Task</MenuItem>
                  {safeProjects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Assignee"
                  fullWidth
                  size="small"
                  select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <MenuItem value="">Unassigned</MenuItem>
                  {users.map((u) => (
                    <MenuItem key={u.id} value={u.id}>{u.full_name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Priority"
                  fullWidth
                  size="small"
                  select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                >
                  <MenuItem value="URGENT">Urgent</MenuItem>
                  <MenuItem value="HIGH">High</MenuItem>
                  <MenuItem value="NORMAL">Normal</MenuItem>
                  <MenuItem value="LOW">Low</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Due Date"
                  type="date"
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </Grid>
            </Grid>

            <TextField
              label="Estimated Hours"
              type="number"
              fullWidth
              size="small"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value ? Number(e.target.value) : '')}
            />

            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              size="small"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ color: '#64748B' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateTask}
            disabled={isCreating}
            sx={{ bgcolor: '#203020', '&:hover': { bgcolor: '#2A402A' } }}
          >
            {isCreating ? 'Creating...' : 'Save Task'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Universal Import Modal */}
      <UniversalImportModal
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        title="Import Tasks"
        entityName="Tasks"
        erpFields={[
          { key: 'title', label: 'Task Title', required: true },
          { key: 'project_id', label: 'Project' },
          { key: 'assignee_id', label: 'Assignee' },
          { key: 'priority', label: 'Priority' },
          { key: 'due_date', label: 'Due Date' },
          { key: 'estimated_hours', label: 'Estimated Hours' },
        ]}
        onImport={(mappedRows) => {
          showToast(`Imported ${mappedRows.length} tasks successfully`, 'success');
          refetch();
          return mappedRows.length;
        }}
      />
    </Box>
  );
}
