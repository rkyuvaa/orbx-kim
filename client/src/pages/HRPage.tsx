import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  FormControl,
  InputLabel,
  LinearProgress,
  Alert,
  Divider,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  Users,
  Plus,
  Search,
  Clock,
  DollarSign,
  TrendingUp,
  Calendar,
  Trash2,
  Check,
  X as XIcon,
  UserPlus,
  UserCheck,
  FileText,
  Settings2,
  BarChart3,
  Download,
  Filter,
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  User,
  Building,
  Mail,
  Phone,
  LogOut,
  Upload,
} from 'lucide-react';
import { useTableSort } from '../hooks/useTableSort';
import ErpSortHeaderCell from '../components/ui/ErpSortHeaderCell';
import UniversalImportModal from '@/components/ui/UniversalImportModal';
import { useToast } from '@/components/ui/ToastHost';
import { useDatabaseStoredState } from '@/hooks/useDatabaseStoredState';
import {
  useListAttendanceQuery,
  useCreateAttendanceMutation,
  useDeleteAttendanceMutation,
  useListLeaveRequestsQuery,
  useCreateLeaveRequestMutation,
  useApproveLeaveRequestMutation,
  useRejectLeaveRequestMutation,
  useListPayrollQuery,
  useCreatePayrollRecordMutation,
  useUpdatePayrollRecordMutation,
  useListPerformanceReviewsQuery,
  type Attendance,
  type LeaveRequest,
  type PayrollRecord,
} from '@/api/hrApi';
import { useGetUsersQuery } from '@/api/rbacApi';
import EmployeeMaster from '@/components/hr/EmployeeMaster';
import RecruitmentManagement from '@/components/hr/RecruitmentManagement';
import { formatDate, formatDateTime } from '@/utils/format';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`hr-tabpanel-${index}`}
      aria-labelledby={`hr-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 1, px: 0 }}>{children}</Box>}
    </div>
  );
}

const HR_NAV_ITEMS = [
  { key: 'recruitment', label: 'Recruitment', path: '/hr/recruitment', icon: UserPlus },
  { key: 'onboarding', label: 'Employee On/off boarding', path: '/hr/onboarding', icon: UserPlus },
  { key: 'master', label: 'Employee Master', path: '/hr/master', icon: Users },
  { key: 'attendance', label: 'Attendance', path: '/hr/attendance', icon: Clock },
  { key: 'leave', label: 'Leave Management', path: '/hr/leave', icon: Calendar },
  { key: 'payroll', label: 'Payroll', path: '/hr/payroll', icon: DollarSign },
  { key: 'self-service', label: 'Self Service', path: '/hr/self-service', icon: UserCheck },
  { key: 'reports', label: 'Reports', path: '/hr/reports', icon: BarChart3 },
  { key: 'configuration', label: 'HR Configuration', path: '/hr/configuration', icon: Settings2 },
];

export default function HRPage() {
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active tab based on current URL path
  const currentTab = HR_NAV_ITEMS.findIndex(
    (item) =>
      location.pathname.startsWith(item.path) ||
      (item.key === 'master' && (location.pathname.startsWith('/hr/management') || location.pathname.startsWith('/hr/employees')))
  );
  const tabValue = currentTab >= 0 ? currentTab : 0;

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    navigate(HR_NAV_ITEMS[newValue].path);
  };

  // RTK Query hooks
  const { data: attendanceRecords = [], isLoading: attendanceLoading, error: attendanceError } = useListAttendanceQuery();
  const { data: leaveRequests = [], isLoading: leaveLoading, error: leaveError } = useListLeaveRequestsQuery();
  const { data: payrollRecords = [], isLoading: payrollLoading, error: payrollError } = useListPayrollQuery();
  const { data: performanceReviews = [], isLoading: perfLoading } = useListPerformanceReviewsQuery();
  const { data: usersData, isLoading: usersLoading } = useGetUsersQuery({ page: 1, page_size: 100 });
  const usersList = usersData?.items || [];

  // Mutations
  const [createAttendance] = useCreateAttendanceMutation();
  const [deleteAttendance] = useDeleteAttendanceMutation();
  const [createLeave] = useCreateLeaveRequestMutation();
  const [approveLeave] = useApproveLeaveRequestMutation();
  const [rejectLeave] = useRejectLeaveRequestMutation();
  const [createPayroll] = useCreatePayrollRecordMutation();
  const [updatePayroll] = useUpdatePayrollRecordMutation();

  // Local State & Dialogs
  const [attendanceDialog, setAttendanceDialog] = useState(false);
  const [leaveDialog, setLeaveDialog] = useState(false);
  const [payrollDialog, setPayrollDialog] = useState(false);
  const [onboardingDialog, setOnboardingDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Form states
  const [attendanceForm, setAttendanceForm] = useState({
    user_id: 1,
    attendance_date: new Date().toISOString().split('T')[0],
    check_in_time: '',
    check_out_time: '',
    status: 'PRESENT' as const,
    notes: '',
  });

  const [leaveForm, setLeaveForm] = useState({
    user_id: 1,
    leave_type: 'CASUAL' as const,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    reason: '',
  });

  const [payrollForm, setPayrollForm] = useState({
    user_id: 1,
    payroll_month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`,
    base_salary: 50000,
    allowances: 10000,
    deductions: 5000,
    remarks: 'Monthly salary disbursement',
  });

  const [onboardingForm, setOnboardingForm] = useState({
    candidate_name: '',
    email: '',
    department: '',
    role: '',
    join_date: '',
    type: 'ONBOARDING' as 'ONBOARDING' | 'OFFBOARDING',
  });

  const [onboardingList, setOnboardingList] = useDatabaseStoredState<any[]>(
    'crm_hr_onboarding',
    [],
  );

  // HR Configuration state
  const DEFAULT_HR_CONFIG = {
    casualLeaveQuota: 12,
    sickLeaveQuota: 10,
    earnedLeaveQuota: 15,
    shiftStart: '09:00',
    shiftEnd: '18:00',
    gracePeriodMins: 15,
    pfContributionPct: 12,
    hraPct: 40,
    autoApproveLeave: false,
    notifyHrOnLeave: true,
  };

  const [configState, setConfigState] = useDatabaseStoredState('crm_hr_config', DEFAULT_HR_CONFIG);

  const { sortState: attendanceSortState, handleSort: handleAttendanceSort, sortData: sortAttendance } = useTableSort<any>();
  const { sortState: leaveSortState, handleSort: handleLeaveSort, sortData: sortLeave } = useTableSort<any>();

  const sortedAttendanceRecords = useMemo(() => sortAttendance(attendanceRecords), [attendanceRecords, sortAttendance]);
  const sortedLeaveRequests = useMemo(() => sortLeave(leaveRequests), [leaveRequests, sortLeave]);

  // Handlers
  const handleSaveAttendance = async () => {
    try {
      await createAttendance({
        ...attendanceForm,
        check_in_time: attendanceForm.check_in_time || null,
        check_out_time: attendanceForm.check_out_time || null,
      }).unwrap();
      showToast('Attendance record created successfully', 'success');
      setAttendanceDialog(false);
    } catch {
      showToast('Failed to save attendance record', 'error');
    }
  };

  const handleSaveLeave = async () => {
    try {
      if (!leaveForm.reason) {
        showToast('Please provide a reason for the leave', 'error');
        return;
      }
      await createLeave(leaveForm).unwrap();
      showToast('Leave request submitted successfully', 'success');
      setLeaveDialog(false);
    } catch {
      showToast('Failed to submit leave request', 'error');
    }
  };

  const handleSavePayroll = async () => {
    try {
      await createPayroll(payrollForm).unwrap();
      showToast('Payroll record created successfully', 'success');
      setPayrollDialog(false);
    } catch {
      showToast('Failed to create payroll record', 'error');
    }
  };

  const handleSaveOnboarding = () => {
    if (!onboardingForm.candidate_name || !onboardingForm.email) {
      showToast('Please enter candidate details', 'error');
      return;
    }
    const newItem = {
      id: Date.now(),
      name: onboardingForm.candidate_name,
      email: onboardingForm.email,
      role: onboardingForm.role,
      dept: onboardingForm.department,
      type: onboardingForm.type,
      joinDate: onboardingForm.join_date,
      stage: onboardingForm.type === 'ONBOARDING' ? 'Documentation' : 'Exit Interview',
      progress: 20,
      status: 'In Progress',
    };
    setOnboardingList([newItem, ...onboardingList]);
    showToast(`${onboardingForm.type === 'ONBOARDING' ? 'Onboarding' : 'Offboarding'} process initiated`, 'success');
    setOnboardingDialog(false);
  };

  const handleDeleteAttendance = async (id: number) => {
    try {
      await deleteAttendance(id).unwrap();
      showToast('Attendance record deleted', 'success');
    } catch {
      showToast('Failed to delete attendance', 'error');
    }
  };

  const handleApproveLeave = async (id: number) => {
    try {
      await approveLeave({ id, approved_by_id: 1 }).unwrap();
      showToast('Leave request approved', 'success');
    } catch {
      showToast('Failed to approve leave', 'error');
    }
  };

  const handleRejectLeave = async (id: number) => {
    try {
      await rejectLeave({ id, rejection_reason: 'Request denied by HR' }).unwrap();
      showToast('Leave request rejected', 'success');
    } catch {
      showToast('Failed to reject leave', 'error');
    }
  };

  const handleUpdatePayrollStatus = async (id: number, status: 'PROCESSED' | 'PAID') => {
    try {
      await updatePayroll({ id, body: { status } }).unwrap();
      showToast(`Payroll record marked as ${status}`, 'success');
    } catch {
      showToast('Failed to update payroll status', 'error');
    }
  };

  // Filtering users for Employee Management
  const filteredUsers = usersList.filter((user: any) => {
    const nameStr = user?.full_name || user?.name || '';
    const emailStr = user?.email || '';
    const query = (searchTerm || '').toLowerCase();
    const matchesSearch =
      nameStr.toLowerCase().includes(query) ||
      emailStr.toLowerCase().includes(query);
    const matchesDept = departmentFilter === 'All' || user?.department?.name === departmentFilter || user?.departments?.[0]?.name === departmentFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <Box sx={{ width: '100%' }}>
      {/* Top Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2 }}>
        <Stack direction="row" spacing={1.5}>
          {HR_NAV_ITEMS[tabValue]?.key === 'onboarding' && (
            <>
              <Button
                variant="outlined"
                startIcon={<Upload size={18} />}
                onClick={() => setImportDialog(true)}
                sx={{ borderColor: '#cbd5e1', color: '#334155', textTransform: 'none', borderRadius: 2 }}
              >
                Import
              </Button>
              <Button
                variant="contained"
                startIcon={<Plus size={18} />}
                onClick={() => navigate('/hr/onboarding/new')}
                sx={{ bgcolor: '#16C47F', '&:hover': { bgcolor: '#12A66C' }, textTransform: 'none', borderRadius: 2 }}
              >
                New On/Offboarding
              </Button>
            </>
          )}
          {HR_NAV_ITEMS[tabValue]?.key === 'attendance' && (
            <>
              <Button
                variant="outlined"
                startIcon={<Upload size={18} />}
                onClick={() => setImportDialog(true)}
                sx={{ borderColor: '#cbd5e1', color: '#334155', textTransform: 'none', borderRadius: 2 }}
              >
                Import
              </Button>
              <Button
                variant="contained"
                startIcon={<Plus size={18} />}
                onClick={() => setAttendanceDialog(true)}
                sx={{ bgcolor: '#16C47F', '&:hover': { bgcolor: '#12A66C' }, textTransform: 'none', borderRadius: 2 }}
              >
                Log Attendance
              </Button>
            </>
          )}
          {HR_NAV_ITEMS[tabValue]?.key === 'leave' && (
            <>
              <Button
                variant="outlined"
                startIcon={<Upload size={18} />}
                onClick={() => setImportDialog(true)}
                sx={{ borderColor: '#cbd5e1', color: '#334155', textTransform: 'none', borderRadius: 2 }}
              >
                Import
              </Button>
              <Button
                variant="contained"
                startIcon={<Plus size={18} />}
                onClick={() => setLeaveDialog(true)}
                sx={{ bgcolor: '#16C47F', '&:hover': { bgcolor: '#12A66C' }, textTransform: 'none', borderRadius: 2 }}
              >
                New Leave Request
              </Button>
            </>
          )}
          {HR_NAV_ITEMS[tabValue]?.key === 'payroll' && (
            <>
              <Button
                variant="outlined"
                startIcon={<Upload size={18} />}
                onClick={() => setImportDialog(true)}
                sx={{ borderColor: '#cbd5e1', color: '#334155', textTransform: 'none', borderRadius: 2 }}
              >
                Import
              </Button>
              <Button
                variant="contained"
                startIcon={<Plus size={18} />}
                onClick={() => setPayrollDialog(true)}
                sx={{ bgcolor: '#16C47F', '&:hover': { bgcolor: '#12A66C' }, textTransform: 'none', borderRadius: 2 }}
              >
                Generate Payroll
              </Button>
            </>
          )}
        </Stack>
      </Box>

      {/* Content Region */}
      <Box sx={{ width: '100%' }}>

        {/* 0. Recruitment Tab */}
        <TabPanel value={tabValue} index={0}>
          <RecruitmentManagement />
        </TabPanel>

        {/* 1. Employee On/off boarding Tab */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 2, borderColor: '#e2e8f0' }}>
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>ACTIVE ONBOARDING</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#0f172a', mt: 0.5 }}>
                    {onboardingList.filter(o => o.type === 'ONBOARDING' && o.status === 'In Progress').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 2, borderColor: '#e2e8f0' }}>
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>PENDING OFFBOARDING</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#d97706', mt: 0.5 }}>
                    {onboardingList.filter(o => o.type === 'OFFBOARDING' && o.status === 'In Progress').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 2, borderColor: '#e2e8f0' }}>
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>COMPLETED THIS MONTH</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#16C47F', mt: 0.5 }}>
                    {onboardingList.filter(o => o.status === 'Completed').length + 3}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 2, borderColor: '#e2e8f0' }}>
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>DOCUMENTATION PENDING</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#2563eb', mt: 0.5 }}>
                    2 Candidates
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table>
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Candidate / Employee</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Role & Dept</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Target Date</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Current Stage</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Progress</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {onboardingList.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 34, height: 34, bgcolor: item.type === 'ONBOARDING' ? '#16C47F' : '#d97706', fontSize: 14 }}>
                          {item.name.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.name}</Typography>
                          <Typography variant="caption" sx={{ color: '#64748b' }}>{item.email}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.type}
                        size="small"
                        sx={{
                          bgcolor: item.type === 'ONBOARDING' ? '#ecfdf5' : '#fffbebb',
                          color: item.type === 'ONBOARDING' ? '#047857' : '#b45309',
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.role}</Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>{item.dept}</Typography>
                    </TableCell>
                    <TableCell>{item.joinDate ? formatDate(item.joinDate) : '-'}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{item.stage}</Typography>
                    </TableCell>
                    <TableCell sx={{ width: 140 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={item.progress}
                          sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#16C47F' } }}
                        />
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>{item.progress}%</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.status}
                        size="small"
                        color={item.status === 'Completed' ? 'success' : 'warning'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setOnboardingList(
                            onboardingList.map((o) =>
                              o.id === item.id ? { ...o, progress: 100, status: 'Completed', stage: 'Completed' } : o
                            )
                          );
                          showToast('Process marked as completed', 'success');
                        }}
                        disabled={item.status === 'Completed'}
                        sx={{ textTransform: 'none', borderRadius: 1.5 }}
                      >
                        Advance Step
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* 2. Employee Master Tab */}
        <TabPanel value={tabValue} index={2}>
          <EmployeeMaster />
        </TabPanel>

        {/* 3. Attendance Tab */}
        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>TOTAL RECORDS</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#0f172a', mt: 0.5 }}>{attendanceRecords.length}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>PRESENT TODAY</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#16C47F', mt: 0.5 }}>
                    {attendanceRecords.filter((a) => a.status === 'PRESENT').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>LATE ARRIVALS</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#d97706', mt: 0.5 }}>
                    {attendanceRecords.filter((a) => a.status === 'LATE').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>ON LEAVE</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#2563eb', mt: 0.5 }}>
                    {attendanceRecords.filter((a) => a.status === 'LEAVE').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {attendanceLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          ) : attendanceError ? (
            <Alert severity="error">Failed to load attendance records</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table>
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <ErpSortHeaderCell variant="mui" field="user_name" label="Employee" sortState={attendanceSortState} onSort={handleAttendanceSort} />
                    <ErpSortHeaderCell variant="mui" field="attendance_date" label="Date" sortState={attendanceSortState} onSort={handleAttendanceSort} />
                    <ErpSortHeaderCell variant="mui" field="check_in_time" label="Check In" sortState={attendanceSortState} onSort={handleAttendanceSort} />
                    <ErpSortHeaderCell variant="mui" field="check_out_time" label="Check Out" sortState={attendanceSortState} onSort={handleAttendanceSort} />
                    <ErpSortHeaderCell variant="mui" field="hours_worked" label="Hours Worked" sortState={attendanceSortState} onSort={handleAttendanceSort} />
                    <ErpSortHeaderCell variant="mui" field="status" label="Status" sortState={attendanceSortState} onSort={handleAttendanceSort} />
                    <ErpSortHeaderCell variant="mui" label="Actions" align="right" sortable={false} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedAttendanceRecords.map((record) => (
                    <TableRow key={record.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{record.user_name}</TableCell>
                      <TableCell>{record.attendance_date ? formatDate(record.attendance_date) : '-'}</TableCell>
                      <TableCell>{record.check_in_time || '-'}</TableCell>
                      <TableCell>{record.check_out_time || '-'}</TableCell>
                      <TableCell>{record.hours_worked ? `${record.hours_worked.toFixed(1)} hrs` : '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={record.status}
                          size="small"
                          sx={{
                            bgcolor: record.status === 'PRESENT' ? '#ecfdf5' : record.status === 'LATE' ? '#fffbebb' : '#fef2f2',
                            color: record.status === 'PRESENT' ? '#047857' : record.status === 'LATE' ? '#b45309' : '#dc2626',
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleDeleteAttendance(record.id)}>
                          <Trash2 size={16} style={{ color: '#dc2626' }} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* 4. Leave Management Tab */}
        <TabPanel value={tabValue} index={4}>
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>PENDING REQUESTS</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#d97706', mt: 0.5 }}>
                    {leaveRequests.filter(l => l.status === 'PENDING').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>APPROVED LEAVES</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#16C47F', mt: 0.5 }}>
                    {leaveRequests.filter(l => l.status === 'APPROVED').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>REJECTED</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#dc2626', mt: 0.5 }}>
                    {leaveRequests.filter(l => l.status === 'REJECTED').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>TOTAL APPLICATIONS</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#0f172a', mt: 0.5 }}>
                    {leaveRequests.length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {leaveLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          ) : leaveError ? (
            <Alert severity="error">Failed to load leave requests</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table>
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <ErpSortHeaderCell variant="mui" field="user_name" label="Employee" sortState={leaveSortState} onSort={handleLeaveSort} />
                    <ErpSortHeaderCell variant="mui" field="leave_type" label="Type" sortState={leaveSortState} onSort={handleLeaveSort} />
                    <ErpSortHeaderCell variant="mui" field="start_date" label="Start Date" sortState={leaveSortState} onSort={handleLeaveSort} />
                    <ErpSortHeaderCell variant="mui" field="end_date" label="End Date" sortState={leaveSortState} onSort={handleLeaveSort} />
                    <ErpSortHeaderCell variant="mui" field="reason" label="Reason" sortState={leaveSortState} onSort={handleLeaveSort} />
                    <ErpSortHeaderCell variant="mui" field="status" label="Status" sortState={leaveSortState} onSort={handleLeaveSort} />
                    <ErpSortHeaderCell variant="mui" label="Actions" align="right" sortable={false} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedLeaveRequests.map((leave) => (
                    <TableRow key={leave.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{leave.user_name}</TableCell>
                      <TableCell><Chip label={leave.leave_type} size="small" variant="outlined" /></TableCell>
                      <TableCell>{leave.start_date ? formatDate(leave.start_date) : '-'}</TableCell>
                      <TableCell>{leave.end_date ? formatDate(leave.end_date) : '-'}</TableCell>
                      <TableCell>{leave.reason}</TableCell>
                      <TableCell>
                        <Chip
                          label={leave.status}
                          size="small"
                          sx={{
                            bgcolor: leave.status === 'APPROVED' ? '#ecfdf5' : leave.status === 'PENDING' ? '#fffbebb' : '#fef2f2',
                            color: leave.status === 'APPROVED' ? '#047857' : leave.status === 'PENDING' ? '#b45309' : '#dc2626',
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {leave.status === 'PENDING' && (
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <IconButton size="small" onClick={() => handleApproveLeave(leave.id)} sx={{ color: '#047857' }}>
                              <Check size={18} />
                            </IconButton>
                            <IconButton size="small" onClick={() => handleRejectLeave(leave.id)} sx={{ color: '#dc2626' }}>
                              <XIcon size={18} />
                            </IconButton>
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* 5. Payroll Tab */}
        <TabPanel value={tabValue} index={5}>
          {payrollLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          ) : payrollError ? (
            <Alert severity="error">Failed to load payroll records</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table>
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Employee</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Payroll Month</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Base Salary</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Allowances</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Deductions</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Net Salary</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payrollRecords.map((record) => (
                    <TableRow key={record.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{record.user_name}</TableCell>
                      <TableCell>{record.payroll_month}</TableCell>
                      <TableCell align="right">₹{record.base_salary.toLocaleString()}</TableCell>
                      <TableCell align="right">₹{record.allowances.toLocaleString()}</TableCell>
                      <TableCell align="right">₹{record.deductions.toLocaleString()}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#16C47F' }}>
                        ₹{record.net_salary.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={record.status}
                          size="small"
                          sx={{
                            bgcolor: record.status === 'PAID' ? '#ecfdf5' : '#fffbebb',
                            color: record.status === 'PAID' ? '#047857' : '#b45309',
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {record.status !== 'PAID' && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleUpdatePayrollStatus(record.id, 'PAID')}
                            sx={{ textTransform: 'none', borderRadius: 1.5, borderColor: '#16C47F', color: '#16C47F' }}
                          >
                            Mark Paid
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* 6. Self Service Tab */}
        <TabPanel value={tabValue} index={6}>
          <Grid container spacing={3}>
            {/* User Profile Card */}
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Avatar sx={{ width: 72, height: 72, bgcolor: '#16C47F', margin: '0 auto', mb: 2, fontSize: 28, fontWeight: 700 }}>
                    ME
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Employee Self-Service Portal</Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>Senior Software Engineer • Engineering</Typography>
                  <Chip label="EMP-10482" size="small" sx={{ mb: 3, fontWeight: 600 }} />

                  <Divider sx={{ my: 2 }} />

                  <Stack spacing={1.5} textAlign="left">
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>Manager:</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>Sarah Conner</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>Leave Balance:</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: '#16C47F' }}>18 Days Available</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>Attendance (This Month):</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>96%</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            {/* Quick Actions & Recent Requests */}
            <Grid item xs={12} md={8}>
              <Card variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Quick Actions</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<Clock size={18} />}
                        onClick={() => showToast('Clocked in successfully at ' + formatDateTime(new Date()), 'success')}
                        sx={{ bgcolor: '#16C47F', py: 1.5, textTransform: 'none', borderRadius: 2 }}
                      >
                        Clock In Now
                      </Button>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<Calendar size={18} />}
                        onClick={() => setLeaveDialog(true)}
                        sx={{ py: 1.5, textTransform: 'none', borderRadius: 2, borderColor: '#16C47F', color: '#16C47F' }}
                      >
                        Request Leave
                      </Button>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<FileText size={18} />}
                        onClick={() => showToast('Downloading latest payslip PDF...', 'info')}
                        sx={{ py: 1.5, textTransform: 'none', borderRadius: 2 }}
                      >
                        Download Payslip
                      </Button>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>My Recent Applications</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Duration</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Reason</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow hover>
                          <TableCell><Chip label="CASUAL" size="small" variant="outlined" /></TableCell>
                          <TableCell>2026-09-10 to 2026-09-12</TableCell>
                          <TableCell>Personal work</TableCell>
                          <TableCell><Chip label="APPROVED" size="small" color="success" /></TableCell>
                        </TableRow>
                        <TableRow hover>
                          <TableCell><Chip label="SICK" size="small" variant="outlined" /></TableCell>
                          <TableCell>2026-08-15 to 2026-08-16</TableCell>
                          <TableCell>Fever & Rest</TableCell>
                          <TableCell><Chip label="APPROVED" size="small" color="success" /></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* 7. Reports Tab */}
        <TabPanel value={tabValue} index={7}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>HR Analytics & Reports</Typography>
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                startIcon={<Download size={18} />}
                onClick={() => showToast('Exporting HR PDF Report...', 'info')}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                Export PDF
              </Button>
              <Button
                variant="outlined"
                startIcon={<Download size={18} />}
                onClick={() => showToast('Exporting HR CSV Data...', 'info')}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                Export CSV
              </Button>
            </Stack>
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Attendance Summary</Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>Monthly average attendance and punctuality metrics</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: '#16C47F' }}>94.2%</Typography>
                    <Typography variant="body2" sx={{ color: '#16C47F', fontWeight: 600 }}>+2.1% from last month</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={94.2} sx={{ height: 8, borderRadius: 4, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#16C47F' } }} />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Payroll Expenditure</Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>Total salary discursed this month</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: '#0f172a' }}>₹42,50,000</Typography>
                    <Typography variant="body2" sx={{ color: '#64748b' }}>Across 85 Employees</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={78} sx={{ height: 8, borderRadius: 4, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#2563eb' } }} />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* 8. HR Configuration Tab */}
        <TabPanel value={tabValue} index={8}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>HR Configuration & Policies</Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Leave Policy Quotas (Annual)</Typography>
                  <TextField
                    label="Casual Leave Quota (Days)"
                    type="number"
                    size="small"
                    value={configState.casualLeaveQuota}
                    onChange={(e) => setConfigState({ ...configState, casualLeaveQuota: parseInt(e.target.value) || 0 })}
                  />
                  <TextField
                    label="Sick Leave Quota (Days)"
                    type="number"
                    size="small"
                    value={configState.sickLeaveQuota}
                    onChange={(e) => setConfigState({ ...configState, sickLeaveQuota: parseInt(e.target.value) || 0 })}
                  />
                  <TextField
                    label="Earned Leave Quota (Days)"
                    type="number"
                    size="small"
                    value={configState.earnedLeaveQuota}
                    onChange={(e) => setConfigState({ ...configState, earnedLeaveQuota: parseInt(e.target.value) || 0 })}
                  />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Shift & Attendance Rules</Typography>
                  <Stack direction="row" spacing={2}>
                    <TextField
                      fullWidth
                      label="Shift Start Time"
                      type="time"
                      size="small"
                      value={configState.shiftStart}
                      onChange={(e) => setConfigState({ ...configState, shiftStart: e.target.value })}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      fullWidth
                      label="Shift End Time"
                      type="time"
                      size="small"
                      value={configState.shiftEnd}
                      onChange={(e) => setConfigState({ ...configState, shiftEnd: e.target.value })}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Stack>
                  <TextField
                    label="Late Mark Grace Period (Minutes)"
                    type="number"
                    size="small"
                    value={configState.gracePeriodMins}
                    onChange={(e) => setConfigState({ ...configState, gracePeriodMins: parseInt(e.target.value) || 0 })}
                  />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setConfigState(DEFAULT_HR_CONFIG);
                    showToast('Configuration reset to defaults', 'info');
                  }}
                  sx={{ textTransform: 'none', borderRadius: 2 }}
                >
                  Reset Defaults
                </Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    showToast('HR Configuration updated successfully', 'success');
                  }}
                  sx={{ bgcolor: '#16C47F', textTransform: 'none', borderRadius: 2 }}
                >
                  Save Settings
                </Button>
              </Box>
            </Grid>
          </Grid>
        </TabPanel>
      </Box>

      {/* Dialog: Log Attendance */}
      <Dialog open={attendanceDialog} onClose={() => setAttendanceDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Log Attendance Record</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Employee ID"
            type="number"
            value={attendanceForm.user_id}
            onChange={(e) => setAttendanceForm({ ...attendanceForm, user_id: parseInt(e.target.value) || 1 })}
            margin="normal"
            size="small"
          />
          <TextField
            fullWidth
            label="Date"
            type="date"
            value={attendanceForm.attendance_date}
            onChange={(e) => setAttendanceForm({ ...attendanceForm, attendance_date: e.target.value })}
            margin="normal"
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            label="Check In Time"
            type="time"
            value={attendanceForm.check_in_time}
            onChange={(e) => setAttendanceForm({ ...attendanceForm, check_in_time: e.target.value })}
            margin="normal"
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            label="Check Out Time"
            type="time"
            value={attendanceForm.check_out_time}
            onChange={(e) => setAttendanceForm({ ...attendanceForm, check_out_time: e.target.value })}
            margin="normal"
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <FormControl fullWidth margin="normal" size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={attendanceForm.status}
              label="Status"
              onChange={(e) => setAttendanceForm({ ...attendanceForm, status: e.target.value as any })}
            >
              <MenuItem value="PRESENT">Present</MenuItem>
              <MenuItem value="ABSENT">Absent</MenuItem>
              <MenuItem value="LATE">Late</MenuItem>
              <MenuItem value="LEAVE">Leave</MenuItem>
              <MenuItem value="HALF_DAY">Half Day</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAttendanceDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveAttendance} variant="contained" sx={{ bgcolor: '#16C47F' }}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Leave Request */}
      <Dialog open={leaveDialog} onClose={() => setLeaveDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Submit Leave Request</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <FormControl fullWidth margin="normal" size="small">
            <InputLabel>Leave Type</InputLabel>
            <Select
              value={leaveForm.leave_type}
              label="Leave Type"
              onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value as any })}
            >
              <MenuItem value="CASUAL">Casual Leave</MenuItem>
              <MenuItem value="SICK">Sick Leave</MenuItem>
              <MenuItem value="EARNED">Earned Leave</MenuItem>
              <MenuItem value="UNPAID">Unpaid Leave</MenuItem>
              <MenuItem value="MATERNITY">Maternity Leave</MenuItem>
              <MenuItem value="PATERNITY">Paternity Leave</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Start Date"
            type="date"
            value={leaveForm.start_date}
            onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
            margin="normal"
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            label="End Date"
            type="date"
            value={leaveForm.end_date}
            onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
            margin="normal"
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            label="Reason for Leave"
            multiline
            rows={3}
            value={leaveForm.reason}
            onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
            margin="normal"
            size="small"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setLeaveDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveLeave} variant="contained" sx={{ bgcolor: '#16C47F' }}>Submit Request</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Payroll Record */}
      <Dialog open={payrollDialog} onClose={() => setPayrollDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Generate Payroll Record</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Employee ID"
            type="number"
            value={payrollForm.user_id}
            onChange={(e) => setPayrollForm({ ...payrollForm, user_id: parseInt(e.target.value) || 1 })}
            margin="normal"
            size="small"
          />
          <TextField
            fullWidth
            label="Payroll Month"
            type="date"
            value={payrollForm.payroll_month}
            onChange={(e) => setPayrollForm({ ...payrollForm, payroll_month: e.target.value })}
            margin="normal"
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            label="Base Salary (₹)"
            type="number"
            value={payrollForm.base_salary}
            onChange={(e) => setPayrollForm({ ...payrollForm, base_salary: parseFloat(e.target.value) || 0 })}
            margin="normal"
            size="small"
          />
          <TextField
            fullWidth
            label="Allowances (₹)"
            type="number"
            value={payrollForm.allowances}
            onChange={(e) => setPayrollForm({ ...payrollForm, allowances: parseFloat(e.target.value) || 0 })}
            margin="normal"
            size="small"
          />
          <TextField
            fullWidth
            label="Deductions (₹)"
            type="number"
            value={payrollForm.deductions}
            onChange={(e) => setPayrollForm({ ...payrollForm, deductions: parseFloat(e.target.value) || 0 })}
            margin="normal"
            size="small"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPayrollDialog(false)}>Cancel</Button>
          <Button onClick={handleSavePayroll} variant="contained" sx={{ bgcolor: '#16C47F' }}>Generate</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Onboarding / Offboarding */}
      <Dialog open={onboardingDialog} onClose={() => setOnboardingDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Initiate On/Offboarding</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <FormControl fullWidth margin="normal" size="small">
            <InputLabel>Process Type</InputLabel>
            <Select
              value={onboardingForm.type}
              label="Process Type"
              onChange={(e) => setOnboardingForm({ ...onboardingForm, type: e.target.value as any })}
            >
              <MenuItem value="ONBOARDING">Employee Onboarding</MenuItem>
              <MenuItem value="OFFBOARDING">Employee Offboarding</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Candidate / Employee Name"
            value={onboardingForm.candidate_name}
            onChange={(e) => setOnboardingForm({ ...onboardingForm, candidate_name: e.target.value })}
            margin="normal"
            size="small"
          />
          <TextField
            fullWidth
            label="Email Address"
            type="email"
            value={onboardingForm.email}
            onChange={(e) => setOnboardingForm({ ...onboardingForm, email: e.target.value })}
            margin="normal"
            size="small"
          />
          <TextField
            fullWidth
            label="Role / Designation"
            value={onboardingForm.role}
            onChange={(e) => setOnboardingForm({ ...onboardingForm, role: e.target.value })}
            margin="normal"
            size="small"
          />
          <TextField
            fullWidth
            label="Target Date"
            type="date"
            value={onboardingForm.join_date}
            onChange={(e) => setOnboardingForm({ ...onboardingForm, join_date: e.target.value })}
            margin="normal"
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOnboardingDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveOnboarding} variant="contained" sx={{ bgcolor: '#16C47F' }}>Initiate Process</Button>
        </DialogActions>
      </Dialog>

      {/* Universal HR Import Modal */}
      <UniversalImportModal
        open={importDialog}
        onClose={() => setImportDialog(false)}
        title={`Import HR Data (${HR_NAV_ITEMS[tabValue]?.label || 'HR'})`}
        entityName={HR_NAV_ITEMS[tabValue]?.label || 'HR Records'}
        erpFields={[
          { key: 'emp_id', label: 'Employee ID', required: true },
          { key: 'name', label: 'Employee Name', required: true },
          { key: 'date', label: 'Date' },
          { key: 'status', label: 'Status' },
          { key: 'notes', label: 'Notes / Remarks' },
          { key: 'amount', label: 'Amount' },
        ]}
        onImport={(mappedRows) => {
          showToast(`Imported ${mappedRows.length} records successfully`, 'success');
          return mappedRows.length;
        }}
      />
    </Box>
  );
}
