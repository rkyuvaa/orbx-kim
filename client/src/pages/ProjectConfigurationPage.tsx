import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Chip,
  InputAdornment,
  Grid,
  useTheme,
} from '@mui/material';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  Sliders,
  FileCode2,
  CheckSquare,
  FolderCog,
  Zap,
  CalendarDays,
  Network,
  RefreshCw,
} from 'lucide-react';
import { useTableSort } from '../hooks/useTableSort';
import ErpSortHeaderCell from '../components/ui/ErpSortHeaderCell';
import { useDatabaseStoredState } from '@/hooks/useDatabaseStoredState';
import {
  useGetStatusDefinitionsQuery,
  useCreateStatusDefinitionMutation,
  useUpdateStatusDefinitionMutation,
  useDeleteStatusDefinitionMutation,
  useGetCustomFieldDefinitionsQuery,
  useCreateCustomFieldDefinitionMutation,
  useUpdateCustomFieldDefinitionMutation,
  useDeleteCustomFieldDefinitionMutation,
  useGetCalendarConfigQuery,
  useAddHolidayMutation,
  useDeleteHolidayMutation,
  useSetWeeklyOffMutation,
  useUpdateCalendarWorkingHoursMutation,
  useGetProjectPmSettingsQuery,
  useUpdateProjectPmSettingsMutation,
  StatusDefinitionItem,
  CustomFieldDefinitionItem,
} from '@/api/projectsApi';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '@/components/ui/ToastHost';
import { formatStandardDateTime, formatDate } from '@/utils/format';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2.5 }}>{children}</Box>}
    </div>
  );
}

export default function ProjectConfigurationPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(0);
  const [searchParams] = useSearchParams();
  const configProjectId = Number(searchParams.get('projectId') || '0');

  // RTK Query Hooks
  const { data: statusDefs = [], isLoading: isLoadingStatuses } = useGetStatusDefinitionsQuery();
  const { data: customFieldDefs = [], isLoading: isLoadingFields } = useGetCustomFieldDefinitionsQuery();

  const [createStatus] = useCreateStatusDefinitionMutation();
  const [updateStatus] = useUpdateStatusDefinitionMutation();
  const [deleteStatus] = useDeleteStatusDefinitionMutation();

  const [createCustomField] = useCreateCustomFieldDefinitionMutation();
  const [updateCustomField] = useUpdateCustomFieldDefinitionMutation();
  const [deleteCustomField] = useDeleteCustomFieldDefinitionMutation();

  // PM Settings
  const { data: pmSettings } = useGetProjectPmSettingsQuery(configProjectId, { skip: !configProjectId });
  const [updatePmSettings, { isLoading: savingPmSettings }] = useUpdateProjectPmSettingsMutation();
  const [pmDepType, setPmDepType] = useState<'FS'|'SS'|'FF'|'SF'>('FS');
  const [pmAutoShift, setPmAutoShift] = useState(true);
  const [pmPromptReschedule, setPmPromptReschedule] = useState(false);

  useEffect(() => {
    if (pmSettings) {
      setPmDepType(pmSettings.default_dep_type);
      setPmAutoShift(pmSettings.auto_shift_successors);
      setPmPromptReschedule(pmSettings.prompt_on_reschedule);
    }
  }, [pmSettings]);

  // Search Filters
  const [statusSearch, setStatusSearch] = useState('');
  const [fieldSearch, setFieldSearch] = useState('');

  // --- Status Modal State ---
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<StatusDefinitionItem | null>(null);
  const [statusName, setStatusName] = useState('');
  const [statusColor, setStatusColor] = useState('#2563EB');
  const [statusIsTerminal, setStatusIsTerminal] = useState(false);
  const [statusIsCompletedType, setStatusIsCompletedType] = useState(false);
  const [statusExcludeFromTotals, setStatusExcludeFromTotals] = useState(false);
  const [statusIsDefaultOnCreate, setStatusIsDefaultOnCreate] = useState(false);
  const [statusDisplayOrder, setStatusDisplayOrder] = useState<number>(0);
  const [submittingStatus, setSubmittingStatus] = useState(false);

  // Delete Status Confirmation Modal State
  const [deleteStatusModalOpen, setDeleteStatusModalOpen] = useState(false);
  const [statusToDelete, setStatusToDelete] = useState<StatusDefinitionItem | null>(null);
  const [deletingStatus, setDeletingStatus] = useState(false);

  // --- Custom Field Modal State ---
  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinitionItem | null>(null);
  const [fieldKeyName, setFieldKeyName] = useState('');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldAppliesTo, setFieldAppliesTo] = useState<'Task' | 'Project' | 'Both'>('Task');
  const [fieldType, setFieldType] = useState<string>('Text');
  const [fieldOptions, setFieldOptions] = useState('');
  const [fieldIsRequired, setFieldIsRequired] = useState(false);
  const [fieldIsActive, setFieldIsActive] = useState(true);
  const [fieldDisplayOrder, setFieldDisplayOrder] = useState<number>(0);
  const [submittingField, setSubmittingField] = useState(false);

  // Delete Custom Field Confirmation Modal State
  const [deleteFieldModalOpen, setDeleteFieldModalOpen] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<CustomFieldDefinitionItem | null>(null);
  const [deletingField, setDeletingField] = useState(false);

  // --- Calendar State ---
  const { data: calendarConfig, isLoading: isLoadingCalendar } = useGetCalendarConfigQuery();
  const [addHoliday] = useAddHolidayMutation();
  const [deleteHoliday] = useDeleteHolidayMutation();
  const [setWeeklyOff] = useSetWeeklyOffMutation();
  const [updateWorkingHours, { isLoading: isSavingHours }] = useUpdateCalendarWorkingHoursMutation();

  const [holidayDate, setHolidayDate] = useState('');
  const [holidayDesc, setHolidayDesc] = useState('');
  const [holidayRecurs, setHolidayRecurs] = useState(false);

  const [workStartTime, setWorkStartTime] = useState('09:00');
  const [workEndTime, setWorkEndTime] = useState('18:00');

  useEffect(() => {
    if (calendarConfig?.work_start_time) {
      setWorkStartTime(calendarConfig.work_start_time);
    }
    if (calendarConfig?.work_end_time) {
      setWorkEndTime(calendarConfig.work_end_time);
    }
  }, [calendarConfig]);

  // --- Task Settings State ---
  const DEFAULT_TASK_SETTINGS = {
    defaultStatusId: 1,
    defaultPriority: 'NORMAL',
    allowTaskAssignment: true,
    allowTaskReassignment: true,
    requireDueDate: false,
    allowAttachments: true,
    enableTaskComments: true,
    enableTaskDependencies: true,
    defaultTaskView: 'List',
  };

  const [taskSettings, setTaskSettings] = useDatabaseStoredState(
    'crm_task_configuration_settings',
    DEFAULT_TASK_SETTINGS,
  );

  // --- Project Settings State ---
  const DEFAULT_PROJECT_SETTINGS = {
    defaultProjectStatus: 'Active',
    projectCodePrefix: 'PRJ-',
    projectNumbering: 'Auto',
    requireProjectManager: true,
    requireStartDate: true,
    requireEndDate: false,
    allowProjectArchiving: true,
    enableProjectBudget: true,
    enableProjectDocuments: true,
  };

  const [projectSettings, setProjectSettings] = useDatabaseStoredState(
    'crm_project_configuration_settings',
    DEFAULT_PROJECT_SETTINGS,
  );

  // Default fallback data if API returns empty
  const defaultStatuses: StatusDefinitionItem[] = [
    { id: 1, name: 'To Do', color: '#64748B', display_order: 1, is_terminal: false, is_completed_type: false, exclude_from_active_totals: false, is_default_on_create: true },
    { id: 2, name: 'In Progress', color: '#2563EB', display_order: 2, is_terminal: false, is_completed_type: false, exclude_from_active_totals: false, is_default_on_create: false },
    { id: 3, name: 'In Review', color: '#D97706', display_order: 3, is_terminal: false, is_completed_type: false, exclude_from_active_totals: false, is_default_on_create: false },
    { id: 4, name: 'Done', color: '#16A34A', display_order: 4, is_terminal: true, is_completed_type: true, exclude_from_active_totals: true, is_default_on_create: false },
    { id: 5, name: 'Blocked', color: '#DC2626', display_order: 5, is_terminal: false, is_completed_type: false, exclude_from_active_totals: false, is_default_on_create: false },
  ];

  const defaultCustomFields: CustomFieldDefinitionItem[] = [
    { id: 1, name: 'cost_center', label: 'Cost Center', field_type: 'Text', is_required: false, display_order: 1 },
    { id: 2, name: 'risk_level', label: 'Risk Level', field_type: 'Select', is_required: true, display_order: 2, options: 'Low,Medium,High,Critical' },
  ];

  const displayStatuses = statusDefs.length > 0 ? statusDefs : defaultStatuses;
  const displayCustomFields = customFieldDefs.length > 0 ? customFieldDefs : defaultCustomFields;

  // Filtered Statuses
  const filteredStatuses = displayStatuses.filter(s =>
    s.name.toLowerCase().includes(statusSearch.toLowerCase()) ||
    s.color.toLowerCase().includes(statusSearch.toLowerCase())
  );

  // Filtered Custom Fields
  const filteredCustomFields = displayCustomFields.filter(f =>
    f.name.toLowerCase().includes(fieldSearch.toLowerCase()) ||
    f.label.toLowerCase().includes(fieldSearch.toLowerCase())
  );

  const { sortState: statusSortState, handleSort: handleStatusSort, sortData: sortStatuses } = useTableSort<StatusDefinitionItem>();
  const { sortState: fieldSortState, handleSort: handleFieldSort, sortData: sortFields } = useTableSort<CustomFieldDefinitionItem>();

  const sortedStatuses = useMemo(() => sortStatuses(filteredStatuses), [filteredStatuses, sortStatuses]);
  const sortedCustomFields = useMemo(() => sortFields(filteredCustomFields), [filteredCustomFields, sortFields]);

  // --- Handlers: Status ---
  const handleOpenStatusModal = (statusItem?: StatusDefinitionItem) => {
    if (statusItem) {
      setEditingStatus(statusItem);
      setStatusName(statusItem.name);
      setStatusColor(statusItem.color);
      setStatusIsTerminal(statusItem.is_terminal);
      setStatusIsCompletedType(statusItem.is_completed_type || false);
      setStatusExcludeFromTotals(statusItem.exclude_from_active_totals || false);
      setStatusIsDefaultOnCreate(statusItem.is_default_on_create || false);
      setStatusDisplayOrder(statusItem.display_order);
    } else {
      setEditingStatus(null);
      setStatusName('');
      setStatusColor('#2563EB');
      setStatusIsTerminal(false);
      setStatusIsCompletedType(false);
      setStatusExcludeFromTotals(false);
      setStatusIsDefaultOnCreate(false);
      setStatusDisplayOrder(displayStatuses.length + 1);
    }
    setStatusModalOpen(true);
  };

  const handleSaveStatus = async () => {
    if (!statusName.trim()) {
      toast.showError('Status name is required');
      return;
    }
    try {
      setSubmittingStatus(true);
      if (editingStatus) {
        await updateStatus({
          id: editingStatus.id,
          body: {
            name: statusName.trim(),
            color: statusColor,
            is_terminal: statusIsTerminal,
            is_completed_type: statusIsCompletedType,
            exclude_from_active_totals: statusExcludeFromTotals,
            is_default_on_create: statusIsDefaultOnCreate,
            display_order: Number(statusDisplayOrder),
          },
        }).unwrap();
        toast.showSuccess(`Workflow status "${statusName}" updated successfully!`);
      } else {
        await createStatus({
          name: statusName.trim(),
          color: statusColor,
          is_terminal: statusIsTerminal,
          is_completed_type: statusIsCompletedType,
          exclude_from_active_totals: statusExcludeFromTotals,
          is_default_on_create: statusIsDefaultOnCreate,
          display_order: Number(statusDisplayOrder),
        }).unwrap();
        toast.showSuccess(`Workflow status "${statusName}" created successfully!`);
      }
      setStatusModalOpen(false);
    } catch (err: any) {
      toast.showError(err?.data?.detail || 'Failed to save status definition');
    } finally {
      setSubmittingStatus(false);
    }
  };

  const handleDeleteStatusClick = (statusItem: StatusDefinitionItem) => {
    setStatusToDelete(statusItem);
    setDeleteStatusModalOpen(true);
  };

  const handleConfirmDeleteStatus = async () => {
    if (!statusToDelete) return;
    try {
      setDeletingStatus(true);
      await deleteStatus(statusToDelete.id).unwrap();
      toast.showSuccess(`Status "${statusToDelete.name}" deleted successfully.`);
      setDeleteStatusModalOpen(false);
      setStatusToDelete(null);
    } catch (err: any) {
      toast.showError(err?.data?.detail || `Cannot delete status "${statusToDelete.name}". It may be currently assigned to tasks.`);
    } finally {
      setDeletingStatus(false);
    }
  };

  // --- Handlers: Custom Fields ---
  const handleOpenFieldModal = (fieldItem?: CustomFieldDefinitionItem) => {
    if (fieldItem) {
      setEditingField(fieldItem);
      setFieldKeyName(fieldItem.name);
      setFieldLabel(fieldItem.label);
      setFieldType(fieldItem.field_type || 'Text');
      setFieldOptions(fieldItem.options || '');
      setFieldIsRequired(fieldItem.is_required);
      setFieldIsActive(true);
      setFieldDisplayOrder(fieldItem.display_order);
    } else {
      setEditingField(null);
      setFieldKeyName('');
      setFieldLabel('');
      setFieldAppliesTo('Task');
      setFieldType('Text');
      setFieldOptions('');
      setFieldIsRequired(false);
      setFieldIsActive(true);
      setFieldDisplayOrder(displayCustomFields.length + 1);
    }
    setFieldModalOpen(true);
  };

  const handleSaveCustomField = async () => {
    if (!fieldKeyName.trim() || !fieldLabel.trim()) {
      toast.showError('Key name and display label are required');
      return;
    }
    try {
      setSubmittingField(true);
      const payload = {
        name: fieldKeyName.trim().toLowerCase().replace(/\s+/g, '_'),
        label: fieldLabel.trim(),
        field_type: fieldType,
        options: fieldOptions.trim() ? fieldOptions.trim() : undefined,
        is_required: fieldIsRequired,
        display_order: Number(fieldDisplayOrder),
      };

      if (editingField) {
        await updateCustomField({ id: editingField.id, body: payload as any }).unwrap();
        toast.showSuccess(`Custom field "${fieldLabel}" updated successfully!`);
      } else {
        await createCustomField(payload as any).unwrap();
        toast.showSuccess(`Custom field "${fieldLabel}" created successfully!`);
      }
      setFieldModalOpen(false);
    } catch (err: any) {
      toast.showError(err?.data?.detail || 'Failed to save custom field definition');
    } finally {
      setSubmittingField(false);
    }
  };

  const handleDeleteFieldClick = (fieldItem: CustomFieldDefinitionItem) => {
    setFieldToDelete(fieldItem);
    setDeleteFieldModalOpen(true);
  };

  const handleConfirmDeleteField = async () => {
    if (!fieldToDelete) return;
    try {
      setDeletingField(true);
      await deleteCustomField(fieldToDelete.id).unwrap();
      toast.showSuccess(`Custom field "${fieldToDelete.label}" deleted.`);
      setDeleteFieldModalOpen(false);
      setFieldToDelete(null);
    } catch (err: any) {
      toast.showError(err?.data?.detail || 'Failed to delete custom field.');
    } finally {
      setDeletingField(false);
    }
  };

  // Save Settings Handlers
  const handleSaveTaskSettings = () => {
    toast.showSuccess('Task configuration settings saved successfully!');
  };

  const DEFAULT_PROJECT_CATEGORIES = [
    'Vehicle Customization',
    'Delivery & Payout',
    'Document Operations',
    'General ERP Task',
    'IT & Software',
    'Finance & Audit',
    'Construction & Operations',
  ];

  const [projectCategories, setProjectCategories] = useDatabaseStoredState<string[]>(
    'crm_project_categories',
    DEFAULT_PROJECT_CATEGORIES,
  );
  const [newCategoryInput, setNewCategoryInput] = useState('');

  const handleSaveProjectSettings = () => {
    toast.showSuccess('Project configuration parameters & categories saved successfully!');
  };

  const handleSavePmSettings = async () => {
    if (!configProjectId) {
      toast.showError('Select a specific project from query parameters to save PM settings (e.g. ?projectId=1).');
      return;
    }
    try {
      await updatePmSettings({
        projectId: configProjectId,
        body: {
          default_dep_type: pmDepType,
          auto_shift_successors: pmAutoShift,
          prompt_on_reschedule: pmPromptReschedule,
        },
      }).unwrap();
      toast.showSuccess('Project PM scheduling preferences updated successfully!');
    } catch (err: any) {
      toast.showError(err?.data?.detail || 'Failed to save PM settings');
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', minWidth: 0, px: 0, py: 0.5, boxSizing: 'border-box' }}>


      {/* ── Main ERP Workspace Container ─────────────────────────────────── */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden', bgcolor: 'background.paper' }}>
        {/* Horizontal Navigation Tabs */}
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.default', px: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(_, val) => setActiveTab(val)}
            sx={{
              minHeight: 44,
              '& .MuiTab-root': {
                minHeight: 44,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '13px',
                color: 'text.secondary',
                py: 1,
                px: 2.5,
                '&.Mui-selected': { color: 'primary.main', fontWeight: 700 },
              },
              '& .MuiTabs-indicator': { backgroundColor: isDark ? '#16C47F' : '#203020', height: 3 },
            }}
          >
            <Tab icon={<Sliders size={15} />} iconPosition="start" label="1. Workflow Statuses" />
            <Tab icon={<FileCode2 size={15} />} iconPosition="start" label="2. Custom Fields" />
            <Tab icon={<CheckSquare size={15} />} iconPosition="start" label="3. Task Settings" />
            <Tab icon={<FolderCog size={15} />} iconPosition="start" label="4. Project Settings" />
            <Tab icon={<Zap size={15} />} iconPosition="start" label="5. Automations Rules" />
            <Tab icon={<CalendarDays size={15} />} iconPosition="start" label="6. Working Calendar" />
            <Tab icon={<Network size={15} />} iconPosition="start" label="7. PM Scheduling" />
          </Tabs>
        </Box>

        <Box sx={{ p: 3 }}>
          {/* ────────────────────────────────────────────────────────────────
              TAB 1: WORKFLOW STATUSES
          ──────────────────────────────────────────────────────────────── */}
          <CustomTabPanel value={activeTab} index={0}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '16px' }}>
                  Workflow Statuses
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ fontSize: '13px' }}>
                  Configure task and project workflow statuses.
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <TextField
                  placeholder="Search status..."
                  size="small"
                  value={statusSearch}
                  onChange={(e) => setStatusSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={14} color="#94A3B8" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ width: 220, '& .MuiOutlinedInput-root': { height: 32, fontSize: 13 } }}
                />
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Plus size={15} />}
                  onClick={() => handleOpenStatusModal()}
                  sx={{ bgcolor: '#203020', '&:hover': { bgcolor: '#2A402A' }, height: 32, textTransform: 'none', fontSize: 13, fontWeight: 600 }}
                >
                  Add Status
                </Button>
              </Box>
            </Box>

            {isLoadingStatuses ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={28} /></Box>
            ) : (
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '6px', overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'background.default' }}>
                    <TableRow>
                      <ErpSortHeaderCell variant="mui" field="id" label="ID" sortState={statusSortState} onSort={handleStatusSort} sx={{ fontSize: 12, width: 60 }} />
                      <ErpSortHeaderCell variant="mui" field="name" label="Status Name" sortState={statusSortState} onSort={handleStatusSort} sx={{ fontSize: 12 }} />
                      <ErpSortHeaderCell variant="mui" field="color" label="Color" sortState={statusSortState} onSort={handleStatusSort} sx={{ fontSize: 12 }} />
                      <ErpSortHeaderCell variant="mui" field="is_terminal" label="Terminal" sortState={statusSortState} onSort={handleStatusSort} sx={{ fontSize: 12 }} />
                      <ErpSortHeaderCell variant="mui" field="display_order" label="Sort Order" sortState={statusSortState} onSort={handleStatusSort} sx={{ fontSize: 12 }} />
                      <ErpSortHeaderCell variant="mui" label="Actions" align="right" sortable={false} sx={{ fontSize: 12, width: 100 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedStatuses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary', fontSize: 13 }}>
                          No workflow statuses found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedStatuses.map((s) => (
                        <TableRow key={s.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                          <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{s.id}</TableCell>
                          <TableCell sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>{s.name}</TableCell>
                          <TableCell sx={{ fontSize: 13 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: s.color, flexShrink: 0 }} />
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary' }}>
                                {s.color}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ fontSize: 13 }}>
                            {s.is_terminal ? <Chip label="Yes" size="small" color="primary" sx={{ height: 20, fontSize: 11 }} /> : 'No'}
                          </TableCell>
                          <TableCell sx={{ fontSize: 13 }}>{s.display_order}</TableCell>
                          <TableCell align="right">
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => handleOpenStatusModal(s)}><Pencil size={15} /></IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" color="error" onClick={() => handleDeleteStatusClick(s)}><Trash2 size={15} /></IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Paper>
            )}
          </CustomTabPanel>

          {/* ────────────────────────────────────────────────────────────────
              TAB 2: CUSTOM FIELDS
          ──────────────────────────────────────────────────────────────── */}
          <CustomTabPanel value={activeTab} index={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '16px' }}>
                  Custom Fields
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ fontSize: '13px' }}>
                  Manage dynamic custom attributes for projects and tasks.
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <TextField
                  placeholder="Search field..."
                  size="small"
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={14} color="#94A3B8" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ width: 220, '& .MuiOutlinedInput-root': { height: 32, fontSize: 13 } }}
                />
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Plus size={15} />}
                  onClick={() => handleOpenFieldModal()}
                  sx={{ bgcolor: '#203020', '&:hover': { bgcolor: '#2A402A' }, height: 32, textTransform: 'none', fontSize: 13, fontWeight: 600 }}
                >
                  Add Custom Field
                </Button>
              </Box>
            </Box>

            {isLoadingFields ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={28} /></Box>
            ) : (
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '6px', overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'background.default' }}>
                    <TableRow>
                      <ErpSortHeaderCell variant="mui" field="name" label="Field Name / Key" sortState={fieldSortState} onSort={handleFieldSort} sx={{ fontSize: 12 }} />
                      <ErpSortHeaderCell variant="mui" field="label" label="Display Label" sortState={fieldSortState} onSort={handleFieldSort} sx={{ fontSize: 12 }} />
                      <ErpSortHeaderCell variant="mui" field="entity_type" label="Applies To" sortState={fieldSortState} onSort={handleFieldSort} sx={{ fontSize: 12 }} />
                      <ErpSortHeaderCell variant="mui" field="field_type" label="Field Type" sortState={fieldSortState} onSort={handleFieldSort} sx={{ fontSize: 12 }} />
                      <ErpSortHeaderCell variant="mui" field="is_required" label="Required" sortState={fieldSortState} onSort={handleFieldSort} sx={{ fontSize: 12 }} />
                      <ErpSortHeaderCell variant="mui" field="is_active" label="Status" sortState={fieldSortState} onSort={handleFieldSort} sx={{ fontSize: 12 }} />
                      <ErpSortHeaderCell variant="mui" label="Actions" align="right" sortable={false} sx={{ fontSize: 12, width: 100 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedCustomFields.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary', fontSize: 13 }}>
                          No custom field definitions found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCustomFields.map((f) => (
                        <TableRow key={f.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.primary', fontWeight: 600 }}>
                            {f.name}
                          </TableCell>
                          <TableCell sx={{ fontSize: 13, color: 'text.primary', fontWeight: 600 }}>{f.label}</TableCell>
                          <TableCell sx={{ fontSize: 13 }}>
                            <Chip size="small" label="Task" sx={{ height: 20, fontSize: 11, bgcolor: 'action.hover', color: 'text.primary' }} />
                          </TableCell>
                          <TableCell sx={{ fontSize: 13 }}>
                            <Chip size="small" label={f.field_type} sx={{ height: 20, fontSize: 11, textTransform: 'capitalize', bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }} />
                          </TableCell>
                          <TableCell sx={{ fontSize: 13, color: f.is_required ? '#DC2626' : 'text.secondary', fontWeight: f.is_required ? 600 : 400 }}>
                            {f.is_required ? 'Yes' : 'No'}
                          </TableCell>
                          <TableCell sx={{ fontSize: 13 }}>
                            <Chip size="small" label="Active" sx={{ height: 20, fontSize: 11, bgcolor: 'action.selected', color: '#16A34A', fontWeight: 600 }} />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => handleOpenFieldModal(f)} sx={{ color: 'text.secondary', p: 0.5 }}>
                                <Pencil size={15} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" onClick={() => handleDeleteFieldClick(f)} sx={{ color: '#EF4444', p: 0.5, ml: 0.5 }}>
                                <Trash2 size={15} />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Paper>
            )}
          </CustomTabPanel>

          {/* ────────────────────────────────────────────────────────────────
              TAB 3: TASK SETTINGS
          ──────────────────────────────────────────────────────────────── */}
          <CustomTabPanel value={activeTab} index={2}>
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '16px' }}>
                Task Settings
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ fontSize: '13px' }}>
                Global system configuration and rules for task management.
              </Typography>
            </Box>

            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '6px', p: 3, bgcolor: 'background.default' }}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ fontSize: 13 }}>Default Task Status</InputLabel>
                    <Select
                      value={taskSettings.defaultStatusId}
                      label="Default Task Status"
                      onChange={(e) => setTaskSettings({ ...taskSettings, defaultStatusId: Number(e.target.value) })}
                      sx={{ fontSize: 13 }}
                    >
                      {displayStatuses.map((s) => (
                        <MenuItem key={s.id} value={s.id} sx={{ fontSize: 13 }}>
                          {s.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ fontSize: 13 }}>Default Task Priority</InputLabel>
                    <Select
                      value={taskSettings.defaultPriority}
                      label="Default Task Priority"
                      onChange={(e) => setTaskSettings({ ...taskSettings, defaultPriority: e.target.value })}
                      sx={{ fontSize: 13 }}
                    >
                      <MenuItem value="LOW" sx={{ fontSize: 13 }}>Low</MenuItem>
                      <MenuItem value="NORMAL" sx={{ fontSize: 13 }}>Normal</MenuItem>
                      <MenuItem value="HIGH" sx={{ fontSize: 13 }}>High</MenuItem>
                      <MenuItem value="URGENT" sx={{ fontSize: 13 }}>Urgent</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ fontSize: 13 }}>Default Task View</InputLabel>
                    <Select
                      value={taskSettings.defaultTaskView}
                      label="Default Task View"
                      onChange={(e) => setTaskSettings({ ...taskSettings, defaultTaskView: e.target.value })}
                      sx={{ fontSize: 13 }}
                    >
                      <MenuItem value="List" sx={{ fontSize: 13 }}>List View</MenuItem>
                      <MenuItem value="Board" sx={{ fontSize: 13 }}>Kanban Board</MenuItem>
                      <MenuItem value="Calendar" sx={{ fontSize: 13 }}>Calendar View</MenuItem>
                      <MenuItem value="Gantt" sx={{ fontSize: 13 }}>Gantt Timeline</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={taskSettings.requireDueDate}
                        onChange={(e) => setTaskSettings({ ...taskSettings, requireDueDate: e.target.checked })}
                        size="small"
                        color="success"
                      />
                    }
                    label={<Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary' }}>Require Due Date on Task Creation</Typography>}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={taskSettings.allowTaskAssignment}
                        onChange={(e) => setTaskSettings({ ...taskSettings, allowTaskAssignment: e.target.checked })}
                        size="small"
                        color="success"
                      />
                    }
                    label={<Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary' }}>Allow User Task Assignment</Typography>}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={taskSettings.allowTaskReassignment}
                        onChange={(e) => setTaskSettings({ ...taskSettings, allowTaskReassignment: e.target.checked })}
                        size="small"
                        color="success"
                      />
                    }
                    label={<Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary' }}>Allow Task Reassignment</Typography>}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={taskSettings.enableTaskComments}
                        onChange={(e) => setTaskSettings({ ...taskSettings, enableTaskComments: e.target.checked })}
                        size="small"
                        color="success"
                      />
                    }
                    label={<Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary' }}>Enable Task Activity Comments</Typography>}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={taskSettings.enableTaskDependencies}
                        onChange={(e) => setTaskSettings({ ...taskSettings, enableTaskDependencies: e.target.checked })}
                        size="small"
                        color="success"
                      />
                    }
                    label={<Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary' }}>Enable Task Dependencies</Typography>}
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  onClick={handleSaveTaskSettings}
                  sx={{ bgcolor: '#203020', '&:hover': { bgcolor: '#2A402A' }, textTransform: 'none', fontSize: 13, fontWeight: 600 }}
                >
                  Save Task Settings
                </Button>
              </Box>
            </Paper>
          </CustomTabPanel>

          {/* ────────────────────────────────────────────────────────────────
              TAB 4: PROJECT SETTINGS
          ──────────────────────────────────────────────────────────────── */}
          <CustomTabPanel value={activeTab} index={3}>
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '16px' }}>
                Project Settings
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ fontSize: '13px' }}>
                Global system rules and default parameters for projects.
              </Typography>
            </Box>

            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '6px', p: 3, bgcolor: 'background.default' }}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Project Code Prefix"
                    fullWidth
                    size="small"
                    value={projectSettings.projectCodePrefix}
                    onChange={(e) => setProjectSettings({ ...projectSettings, projectCodePrefix: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { fontSize: 13 } }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ fontSize: 13 }}>Project Numbering Mode</InputLabel>
                    <Select
                      value={projectSettings.projectNumbering}
                      label="Project Numbering Mode"
                      onChange={(e) => setProjectSettings({ ...projectSettings, projectNumbering: e.target.value })}
                      sx={{ fontSize: 13 }}
                    >
                      <MenuItem value="Auto" sx={{ fontSize: 13 }}>Auto Sequence (PRJ-0001)</MenuItem>
                      <MenuItem value="Manual" sx={{ fontSize: 13 }}>Manual Entry</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={projectSettings.requireProjectManager}
                        onChange={(e) => setProjectSettings({ ...projectSettings, requireProjectManager: e.target.checked })}
                        size="small"
                        color="success"
                      />
                    }
                    label={<Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary' }}>Require Project Manager / Owner</Typography>}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={projectSettings.requireStartDate}
                        onChange={(e) => setProjectSettings({ ...projectSettings, requireStartDate: e.target.checked })}
                        size="small"
                        color="success"
                      />
                    }
                    label={<Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary' }}>Require Target Start Date</Typography>}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={projectSettings.enableProjectBudget}
                        onChange={(e) => setProjectSettings({ ...projectSettings, enableProjectBudget: e.target.checked })}
                        size="small"
                        color="success"
                      />
                    }
                    label={<Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary' }}>Enable Financial Budget Tracking</Typography>}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ mt: 1, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
                      Configured Project Categories
                    </Typography>
                    <Typography variant="caption" color="textSecondary" sx={{ mb: 2, display: 'block' }}>
                      These categories appear when creating and organizing project workspaces across the ERP.
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'center' }}>
                      <TextField
                        size="small"
                        placeholder="Enter new category name..."
                        value={newCategoryInput}
                        onChange={(e) => setNewCategoryInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (!newCategoryInput.trim()) return;
                            if (projectCategories.includes(newCategoryInput.trim())) {
                              toast.showError('Category already exists');
                              return;
                            }
                            const updated = [...projectCategories, newCategoryInput.trim()];
                            setProjectCategories(updated);
                            setNewCategoryInput('');
                            toast.showSuccess(`Added category "${newCategoryInput.trim()}"`);
                          }
                        }}
                        sx={{ width: 280, '& .MuiOutlinedInput-root': { height: 36, fontSize: 13 } }}
                      />
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<Plus size={14} />}
                        onClick={() => {
                          if (!newCategoryInput.trim()) return;
                          if (projectCategories.includes(newCategoryInput.trim())) {
                            toast.showError('Category already exists');
                            return;
                          }
                          const updated = [...projectCategories, newCategoryInput.trim()];
                          setProjectCategories(updated);
                          setNewCategoryInput('');
                          toast.showSuccess(`Added category "${newCategoryInput.trim()}"`);
                        }}
                        sx={{ bgcolor: '#203020', '&:hover': { bgcolor: '#2A402A' }, textTransform: 'none', fontSize: 13, height: 36 }}
                      >
                        Add Category
                      </Button>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {projectCategories.map((cat) => (
                        <Chip
                          key={cat}
                          label={cat}
                          onDelete={() => {
                            const updated = projectCategories.filter((c) => c !== cat);
                            setProjectCategories(updated);
                            toast.showSuccess(`Removed category "${cat}"`);
                          }}
                          variant="outlined"
                          size="small"
                          sx={{ fontWeight: 600, fontSize: 12, bgcolor: 'background.paper', borderColor: isDark ? '#16C47F' : '#203020', color: isDark ? '#16C47F' : '#203020' }}
                        />
                      ))}
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={projectSettings.enableProjectDocuments}
                        onChange={(e) => setProjectSettings({ ...projectSettings, enableProjectDocuments: e.target.checked })}
                        size="small"
                        color="success"
                      />
                    }
                    label={<Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary' }}>Enable Project Document Storage</Typography>}
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  onClick={handleSaveProjectSettings}
                  sx={{ bgcolor: '#203020', '&:hover': { bgcolor: '#2A402A' }, textTransform: 'none', fontSize: 13, fontWeight: 600 }}
                >
                  Save Project Settings
                </Button>
              </Box>
            </Paper>
          </CustomTabPanel>

          {/* ────────────────────────────────────────────────────────────────
              TAB 5: AUTOMATIONS RULES ENGINE
             ──────────────────────────────────────────────────────────────── */}
          <CustomTabPanel value={activeTab} index={4}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '16px' }}>
                ClickUp Automations Engine
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ fontSize: '13px' }}>
                Set automatic triggers and actions when task statuses, priorities, or checklists change.
              </Typography>
            </Box>

            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '6px', p: 3, bgcolor: 'background.default' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  {
                    id: 1,
                    trigger: "When Task Status becomes 'Done'",
                    action: "Automatically set project progress & notify Project Manager",
                    active: true,
                  },
                  {
                    id: 2,
                    trigger: "When Task Priority is set to 'Urgent'",
                    action: "Flag Red icon 🚩 and send immediate high-priority alert",
                    active: true,
                  },
                  {
                    id: 3,
                    trigger: "When all Checklist subtasks are completed",
                    action: "Automatically update status to 'In Review'",
                    active: true,
                  },
                  {
                    id: 4,
                    trigger: "When Target Due Date passes without completion",
                    action: "Auto-mark task status as 'Blocked'",
                    active: false,
                  },
                ].map((rule) => (
                  <Paper
                    key={rule.id}
                    variant="outlined"
                    sx={{
                      p: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'space-between',
                      borderRadius: '8px',
                      bgcolor: 'background.paper',
                      borderColor: 'divider',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Zap size={20} color={isDark ? '#16C47F' : '#203020'} />
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                          {rule.trigger}
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ fontSize: 13 }}>
                          ⚡ Action: {rule.action}
                        </Typography>
                      </Box>
                    </Box>

                    <Switch
                      defaultChecked={rule.active}
                      color="success"
                      onChange={(e) => {
                        toast.showSuccess(`Automation rule ${e.target.checked ? 'enabled' : 'disabled'}`);
                      }}
                    />
                  </Paper>
                ))}
              </Box>
            </Paper>
          </CustomTabPanel>

          {/* ────────────────────────────────────────────────────────────────
              TAB 6: WORKING CALENDAR
             ──────────────────────────────────────────────────────────────── */}
          <CustomTabPanel value={activeTab} index={5}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '16px' }}>
                Working Calendar
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ fontSize: '13px' }}>
                Configure daily working hours, weekly off days, and company holidays.
              </Typography>
            </Box>

            {/* Daily Working Hours */}
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '6px', p: 3, mb: 3, bgcolor: 'background.default' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Daily Working Hours</Typography>
                  <Typography variant="caption" color="textSecondary">
                    Working window used by the exact date-time dependency scheduling engine.
                  </Typography>
                </Box>
                <Chip
                  label={`${calendarConfig?.daily_working_hours ?? 9} working hrs / day`}
                  color="success"
                  variant="outlined"
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  type="time"
                  label="Start Time"
                  value={workStartTime}
                  onChange={(e) => setWorkStartTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 140 }}
                />
                <Typography sx={{ color: 'text.secondary', fontWeight: 600 }}>to</Typography>
                <TextField
                  size="small"
                  type="time"
                  label="End Time"
                  value={workEndTime}
                  onChange={(e) => setWorkEndTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 140 }}
                />
                <Button
                  variant="contained"
                  disabled={isSavingHours}
                  onClick={async () => {
                    try {
                      await updateWorkingHours({ work_start_time: workStartTime, work_end_time: workEndTime }).unwrap();
                      toast.showSuccess('Daily working hours updated successfully');
                    } catch (err: any) {
                      toast.showError(err?.data?.detail || 'Failed to update daily working hours');
                    }
                  }}
                  sx={{ bgcolor: '#203020', '&:hover': { bgcolor: '#2A402A' }, textTransform: 'none', fontWeight: 600, fontSize: 13 }}
                >
                  {isSavingHours ? 'Saving...' : 'Save Hours'}
                </Button>
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '6px', p: 3, mb: 3, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Weekly Off Days</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {[
                  { name: 'Mon', dow: 1 },
                  { name: 'Tue', dow: 2 },
                  { name: 'Wed', dow: 3 },
                  { name: 'Thu', dow: 4 },
                  { name: 'Fri', dow: 5 },
                  { name: 'Sat', dow: 6 },
                  { name: 'Sun', dow: 0 },
                ].map(({ name, dow }) => {
                  const isOff = calendarConfig?.weekly_off_days?.includes(dow) ?? false;
                  return (
                    <Chip
                      key={name}
                      label={name}
                      onClick={async () => {
                        const current = calendarConfig?.weekly_off_days || [];
                        const next = isOff ? current.filter((d) => d !== dow) : [...current, dow];
                        try {
                          await setWeeklyOff({ day_of_week_list: next }).unwrap();
                          toast.showSuccess(`${name} configured as ${isOff ? 'Working Day' : 'Weekly Off'}`);
                        } catch {
                          toast.showError('Failed to update weekly off day');
                        }
                      }}
                      color={isOff ? 'error' : 'default'}
                      variant={isOff ? 'filled' : 'outlined'}
                      sx={{ fontWeight: 600, cursor: 'pointer', minWidth: 50, justifyContent: 'center' }}
                    />
                  );
                })}
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '6px', p: 3, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Company Holidays</Typography>
              
              <Box sx={{ display: 'flex', gap: 1.5, mb: 3, alignItems: 'center' }}>
                <TextField size="small" type="date" value={holidayDate} onChange={e => setHolidayDate(e.target.value)} InputLabelProps={{ shrink: true }} label="Date" sx={{ width: 150 }} />
                <TextField size="small" value={holidayDesc} onChange={e => setHolidayDesc(e.target.value)} placeholder="Holiday Description..." sx={{ flex: 1 }} />
                <FormControlLabel control={<Switch size="small" checked={holidayRecurs} onChange={e => setHolidayRecurs(e.target.checked)} />} label="Recurs Yearly" />
                <Button variant="contained" onClick={async () => {
                  if(!holidayDate || !holidayDesc) return;
                  await addHoliday({ holiday_date: holidayDate, description: holidayDesc, recurs_yearly: holidayRecurs });
                  setHolidayDate(''); setHolidayDesc(''); setHolidayRecurs(false);
                }} sx={{ bgcolor: '#203020', '&:hover': { bgcolor: '#2A402A' }, textTransform: 'none' }}>Add</Button>
              </Box>

              <Table size="small">
                <TableHead sx={{ bgcolor: 'background.paper' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Recurs Yearly</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {calendarConfig?.holidays?.map((h: any) => (
                    <TableRow key={h.id}>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{formatDate(h.holiday_date)}</TableCell>
                      <TableCell>{h.description}</TableCell>
                      <TableCell>{h.recurs_yearly ? 'Yes' : 'No'}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" color="error" onClick={() => deleteHoliday(h.id)}><Trash2 size={16} /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!calendarConfig?.holidays?.length && (
                    <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>No holidays added.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          </CustomTabPanel>

          {/* ────────────────────────────────────────────────────────────────
              TAB 7: PM SCHEDULING & DEPENDENCIES
          ──────────────────────────────────────────────────────────────── */}
          <CustomTabPanel value={activeTab} index={6}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '16px' }}>
                  Project Management & Dependency Scheduling Settings
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ fontSize: '13px' }}>
                  Configure automatic dependency shift logic, default dependency relation types, and prompt behavior.
                </Typography>
              </Box>
              <Button
                variant="contained"
                onClick={handleSavePmSettings}
                disabled={savingPmSettings}
                sx={{ textTransform: 'none', fontWeight: 600, fontSize: 13, bgcolor: '#203020', '&:hover': { bgcolor: '#2A402A' } }}
              >
                {savingPmSettings ? 'Saving...' : 'Save PM Settings'}
              </Button>
            </Box>

            <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '6px' }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ fontSize: 13 }}>Default Dependency Type</InputLabel>
                    <Select
                      value={pmDepType}
                      label="Default Dependency Type"
                      onChange={(e) => setPmDepType(e.target.value as any)}
                      sx={{ fontSize: 13 }}
                    >
                      <MenuItem value="FS" sx={{ fontSize: 13 }}>Finish-to-Start (FS) — Default</MenuItem>
                      <MenuItem value="SS" sx={{ fontSize: 13 }}>Start-to-Start (SS)</MenuItem>
                      <MenuItem value="FF" sx={{ fontSize: 13 }}>Finish-to-Finish (FF)</MenuItem>
                      <MenuItem value="SF" sx={{ fontSize: 13 }}>Start-to-Finish (SF)</MenuItem>
                    </Select>
                  </FormControl>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                    When dragging between tasks or adding dependencies, this type will be chosen by default.
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={pmAutoShift}
                        onChange={(e) => setPmAutoShift(e.target.checked)}
                        color="success"
                      />
                    }
                    label={
                      <Box>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>
                          Auto-shift Successor Tasks on Reschedule
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Automatically push dependent tasks forward when a predecessor's end date is delayed, taking into account working calendar & holidays.
                        </Typography>
                      </Box>
                    }
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={pmPromptReschedule}
                        onChange={(e) => setPmPromptReschedule(e.target.checked)}
                        color="success"
                      />
                    }
                    label={
                      <Box>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>
                          Prompt Confirmation before Rescheduling Successors
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Display a preview dialog showing affected tasks and date changes before executing cascade updates.
                        </Typography>
                      </Box>
                    }
                  />
                </Grid>
              </Grid>
            </Paper>
          </CustomTabPanel>
        </Box>
      </Paper>

      {/* ── MODAL: Add / Edit Workflow Status ───────────────────────────── */}
      <Dialog open={statusModalOpen} onClose={() => setStatusModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>
          {editingStatus ? 'Edit Workflow Status' : 'Add Workflow Status'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Status Name"
            fullWidth
            size="small"
            value={statusName}
            onChange={(e) => setStatusName(e.target.value)}
            placeholder="e.g. In Review"
            sx={{ '& .MuiOutlinedInput-root': { fontSize: 13 } }}
          />

          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <TextField
              label="Badge Color (Hex)"
              fullWidth
              size="small"
              value={statusColor}
              onChange={(e) => setStatusColor(e.target.value)}
              placeholder="#2563EB"
              sx={{ '& .MuiOutlinedInput-root': { fontSize: 13 } }}
            />
            <input
              type="color"
              value={statusColor}
              onChange={(e) => setStatusColor(e.target.value)}
              style={{ width: 38, height: 38, border: '1px solid #CBD5E1', borderRadius: 4, cursor: 'pointer', padding: 0 }}
            />
          </Box>

          {/* Color Preview Badge */}
          <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Badge Preview:</Typography>
            <Chip
              size="small"
              label={statusName || 'Status Preview'}
              sx={{ bgcolor: statusColor, color: '#FFFFFF', fontWeight: 600, fontSize: 11 }}
            />
          </Box>

          <TextField
            label="Sort Order"
            type="number"
            fullWidth
            size="small"
            value={statusDisplayOrder}
            onChange={(e) => setStatusDisplayOrder(Number(e.target.value))}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: 13 } }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={statusIsTerminal}
                onChange={(e) => setStatusIsTerminal(e.target.checked)}
                size="small"
                color="success"
              />
            }
            label={<Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary' }}>Terminal / Completed State?</Typography>}
          />
          <FormControlLabel
            control={<Switch checked={statusIsCompletedType} onChange={(e) => setStatusIsCompletedType(e.target.checked)} size="small" color="success" />}
            label={<Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary' }}>Is Completed Type?</Typography>}
          />
          <FormControlLabel
            control={<Switch checked={statusExcludeFromTotals} onChange={(e) => setStatusExcludeFromTotals(e.target.checked)} size="small" color="success" />}
            label={<Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary' }}>Exclude from Active Totals?</Typography>}
          />
          <FormControlLabel
            control={<Switch checked={statusIsDefaultOnCreate} onChange={(e) => setStatusIsDefaultOnCreate(e.target.checked)} size="small" color="success" />}
            label={<Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary' }}>Default on Create?</Typography>}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setStatusModalOpen(false)} disabled={submittingStatus} sx={{ textTransform: 'none', fontSize: 13 }}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveStatus}
            variant="contained"
            disabled={submittingStatus}
            sx={{ bgcolor: '#203020', '&:hover': { bgcolor: '#2A402A' }, textTransform: 'none', fontSize: 13, fontWeight: 600 }}
          >
            {submittingStatus ? 'Saving...' : 'Save Status'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── MODAL: Delete Status Confirmation ───────────────────────────── */}
      <Dialog open={deleteStatusModalOpen} onClose={() => setDeleteStatusModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16, color: '#DC2626' }}>
          Confirm Delete Status
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: '#334155', fontSize: 13 }}>
            Are you sure you want to delete the status <strong>"{statusToDelete?.name}"</strong>?
          </Typography>
          <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
            If this status is currently assigned to tasks or projects, deletion will be blocked to ensure data integrity.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteStatusModalOpen(false)} disabled={deletingStatus} sx={{ textTransform: 'none', fontSize: 13 }}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDeleteStatus}
            variant="contained"
            color="error"
            disabled={deletingStatus}
            sx={{ textTransform: 'none', fontSize: 13, fontWeight: 600 }}
          >
            {deletingStatus ? 'Deleting...' : 'Delete Status'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── MODAL: Add / Edit Custom Field ───────────────────────────────── */}
      <Dialog open={fieldModalOpen} onClose={() => setFieldModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>
          {editingField ? 'Edit Custom Field' : 'Add Custom Field'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Display Label"
            fullWidth
            size="small"
            value={fieldLabel}
            onChange={(e) => {
              setFieldLabel(e.target.value);
              if (!fieldKeyName) {
                setFieldKeyName(e.target.value.toLowerCase().replace(/\s+/g, '_'));
              }
            }}
            placeholder="e.g. Cost Center"
            sx={{ '& .MuiOutlinedInput-root': { fontSize: 13 } }}
          />

          <TextField
            label="Key Name (Database Key)"
            fullWidth
            size="small"
            value={fieldKeyName}
            onChange={(e) => setFieldKeyName(e.target.value)}
            placeholder="e.g. cost_center"
            sx={{ '& .MuiOutlinedInput-root': { fontSize: 13 } }}
          />

          <FormControl fullWidth size="small">
            <InputLabel sx={{ fontSize: 13 }}>Applies To</InputLabel>
            <Select
              value={fieldAppliesTo}
              label="Applies To"
              onChange={(e) => setFieldAppliesTo(e.target.value as any)}
              sx={{ fontSize: 13 }}
            >
              <MenuItem value="Task" sx={{ fontSize: 13 }}>Task</MenuItem>
              <MenuItem value="Project" sx={{ fontSize: 13 }}>Project</MenuItem>
              <MenuItem value="Both" sx={{ fontSize: 13 }}>Both (Task & Project)</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel sx={{ fontSize: 13 }}>Field Type</InputLabel>
            <Select
              value={fieldType}
              label="Field Type"
              onChange={(e) => setFieldType(e.target.value)}
              sx={{ fontSize: 13 }}
            >
              <MenuItem value="Text" sx={{ fontSize: 13 }}>Text</MenuItem>
              <MenuItem value="Number" sx={{ fontSize: 13 }}>Number</MenuItem>
              <MenuItem value="Date" sx={{ fontSize: 13 }}>Date</MenuItem>
              <MenuItem value="Select" sx={{ fontSize: 13 }}>Select Dropdown</MenuItem>
              <MenuItem value="Multi Select" sx={{ fontSize: 13 }}>Multi Select</MenuItem>
              <MenuItem value="Checkbox" sx={{ fontSize: 13 }}>Checkbox</MenuItem>
              <MenuItem value="Currency" sx={{ fontSize: 13 }}>Currency</MenuItem>
            </Select>
          </FormControl>

          {(fieldType === 'Select' || fieldType === 'Multi Select') && (
            <TextField
              label="Options (comma separated)"
              fullWidth
              size="small"
              value={fieldOptions}
              onChange={(e) => setFieldOptions(e.target.value)}
              placeholder="Low, Medium, High, Critical"
              sx={{ '& .MuiOutlinedInput-root': { fontSize: 13 } }}
            />
          )}

          <TextField
            label="Sort Order"
            type="number"
            fullWidth
            size="small"
            value={fieldDisplayOrder}
            onChange={(e) => setFieldDisplayOrder(Number(e.target.value))}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: 13 } }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={fieldIsRequired}
                onChange={(e) => setFieldIsRequired(e.target.checked)}
                size="small"
                color="success"
              />
            }
            label={<Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary' }}>Required Field?</Typography>}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFieldModalOpen(false)} disabled={submittingField} sx={{ textTransform: 'none', fontSize: 13 }}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveCustomField}
            variant="contained"
            disabled={submittingField}
            sx={{ bgcolor: '#203020', '&:hover': { bgcolor: '#2A402A' }, textTransform: 'none', fontSize: 13, fontWeight: 600 }}
          >
            {submittingField ? 'Saving...' : 'Save Field'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── MODAL: Delete Custom Field Confirmation ─────────────────────── */}
      <Dialog open={deleteFieldModalOpen} onClose={() => setDeleteFieldModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16, color: '#DC2626' }}>
          Confirm Delete Custom Field
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: '#334155', fontSize: 13 }}>
            Are you sure you want to delete the custom field <strong>"{fieldToDelete?.label}"</strong>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteFieldModalOpen(false)} disabled={deletingField} sx={{ textTransform: 'none', fontSize: 13 }}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDeleteField}
            variant="contained"
            color="error"
            disabled={deletingField}
            sx={{ textTransform: 'none', fontSize: 13, fontWeight: 600 }}
          >
            {deletingField ? 'Deleting...' : 'Delete Field'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
