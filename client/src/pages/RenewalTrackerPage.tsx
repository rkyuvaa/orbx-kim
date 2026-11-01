import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGetDepartmentsQuery, useGetUsersQuery } from '../api/rbacApi';
import { useBranchesQuery, useUsersQuery } from '../api/mastersApi';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
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
  LinearProgress,
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
  Menu,
} from '@mui/material';
import {
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  Upload,
  Download,
  Pencil,
  Trash2,
  BellRing,
  Mail,
  Sliders,
  FolderCog,
  Code2,
  MoreVertical,
  MapPin,
  Clock,
  Building,
  Send,
} from 'lucide-react';
import { useTableSort } from '../hooks/useTableSort';
import ErpSortHeaderCell from '../components/ui/ErpSortHeaderCell';
import { useTestSmtpConnectionMutation } from '../api/smtpApi';
import { useToast } from '@/components/ui/ToastHost';
import { formatDate } from '@/utils/format';
import { useDatabaseStoredState } from '@/hooks/useDatabaseStoredState';

export interface RenewalItem {
  id: number;
  item_service: string;
  description: string;
  category: string;
  vendor?: string;
  plan?: string;
  department: string;
  branch_location: string;
  start_date: string;
  due_date: string;
  renewal_cycle?: string;
  last_renewed_date: string;
  reminder_days: number;
  renewal_owner: string;
  remarks: string;
  cost?: number;
  amount?: number;
  status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'RENEWED';
}

interface CategoryConfig {
  id: number;
  name: string;
  color: string;
  default_validity_months: number;
  default_reminder_days: number;
  is_active: boolean;
}

interface MailTemplate {
  id: string;
  title: string;
  subject: string;
  body: string;
}

// No demo data rule: starts as empty array []

// No demo data rule: starts as empty array []
const DEFAULT_CATEGORIES: CategoryConfig[] = [];

const DEFAULT_MAIL_TEMPLATES: Record<string, MailTemplate> = {
  reminder: {
    id: 'reminder',
    title: 'Upcoming Renewal Alert (Advance Warning)',
    subject: 'Renewal Reminder: {{item_service}} ({{category}}) due on {{due_date}}',
    body: `Dear {{renewal_owner}},

This is an automated system reminder that the following renewal item is coming due shortly:

Renewal Item / Service: {{item_service}}
Description: {{description}}
Category: {{category}}
Department: {{department}}
Branch / Location: {{branch_location}}
Renewal Due Date: {{due_date}}
Days Remaining: {{days_remaining}} days
Last Renewed Date: {{last_renewed_date}}
Renewal Owner: {{renewal_owner}}

Remarks / Notes:
{{remarks}}

Please initiate the renewal process prior to the due date to avoid service disruption or non-compliance.

Best regards,
Enterprise Renewal Management System`,
  },
  critical: {
    id: 'critical',
    title: 'Urgent Due Alert (Critical Warning)',
    subject: 'URGENT: {{item_service}} due in {{days_remaining}} days!',
    body: `ATTENTION: CRITICAL RENEWAL WARNING

The compliance item "{{item_service}}" is expiring in less than 7 days.

Department: {{department}}
Branch / Location: {{branch_location}}
Renewal Due Date: {{due_date}}
Owner: {{renewal_owner}}

Please process immediately to prevent statutory penalties or operational downtime.

Regards,
Compliance Department`,
  },
  overdue: {
    id: 'overdue',
    title: 'Overdue Expiry Alert (Post Due Date)',
    subject: 'EXPIRED ALERT: {{item_service}} ({{category}}) expired on {{due_date}}',
    body: `NOTICE OF OVERDUE COMPLIANCE ITEM

The renewal for {{item_service}} has EXPIRED on {{due_date}}.

Department: {{department}}
Location: {{branch_location}}
Owner: {{renewal_owner}}

This item is currently flagged as OVERDUE / NON-COMPLIANT. Please complete the renewal and record updated details immediately.

Regards,
Enterprise Admin`,
  },
  renewed: {
    id: 'renewed',
    title: 'Renewal Confirmation Notification',
    subject: 'CONFIRMED: {{item_service}} successfully renewed',
    body: `RENEWAL CONFIRMATION

The renewal process for {{item_service}} has been marked as COMPLETED.

Department: {{department}}
Next Due Date: {{due_date}}
Updated By: {{renewal_owner}}

Thank you for maintaining enterprise compliance standards.`,
  },
};

/** Helper to calculate days remaining dynamically from due_date */
function getDaysRemaining(dueDateStr: string): number {
  if (!dueDateStr) return 0;
  const due = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/** Helper to interpolate dynamic template tags for preview & test dispatch */
function renderTemplateText(templateText: string, sampleItem?: RenewalItem): string {
  if (!templateText) return '';

  let itemService = 'Enterprise Infrastructure License';
  let description = 'Production application hosting SSL & server renewal';
  let category = 'IT & Cloud Services';
  let department = 'IT Operations';
  let branchLocation = 'Headquarters';
  let startDate = '2025-09-15';
  let dueDate = '2026-09-15';
  let daysRemaining = '7';
  let lastRenewedDate = '2025-09-15';
  let renewalOwner = 'IT Manager';
  let remarks = 'Auto-renewal pending approval.';

  if (sampleItem) {
    itemService = sampleItem.item_service || 'N/A';
    description = sampleItem.description && sampleItem.description.trim() ? sampleItem.description.trim() : 'N/A';
    category = sampleItem.category || 'N/A';
    department = sampleItem.department || 'N/A';
    branchLocation = sampleItem.branch_location || 'N/A';
    startDate = sampleItem.start_date || 'N/A';
    dueDate = sampleItem.due_date || 'N/A';
    daysRemaining = getDaysRemaining(sampleItem.due_date).toString();
    lastRenewedDate = sampleItem.last_renewed_date || 'N/A';
    renewalOwner = sampleItem.renewal_owner || 'Unassigned';
    remarks = sampleItem.remarks && sampleItem.remarks.trim() ? sampleItem.remarks.trim() : 'N/A';
  }

  return templateText
    .replace(/\{\{item_service\}\}/g, itemService)
    .replace(/\{\{description\}\}/g, description)
    .replace(/\{\{category\}\}/g, category)
    .replace(/\{\{department\}\}/g, department)
    .replace(/\{\{branch_location\}\}/g, branchLocation)
    .replace(/\{\{start_date\}\}/g, startDate)
    .replace(/\{\{due_date\}\}/g, dueDate)
    .replace(/\{\{days_remaining\}\}/g, daysRemaining)
    .replace(/\{\{last_renewed_date\}\}/g, lastRenewedDate)
    .replace(/\{\{renewal_owner\}\}/g, renewalOwner)
    .replace(/\{\{remarks\}\}/g, remarks);
}

export default function RenewalTrackerPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [branchRecords, setBranchRecords] = useDatabaseStoredState<any[]>('crm_branches_data', []);
  const [employeeRecords] = useDatabaseStoredState<any[]>('crm_employee_master_data', []);

  const [testSmtp, { isLoading: isSendingTestEmail }] = useTestSmtpConnectionMutation();
  const [testMailDialogOpen, setTestMailDialogOpen] = useState(false);
  const [testRecipientEmail, setTestRecipientEmail] = useState('');
  const [testSenderName, setTestSenderName] = useState('Renewal Reminder');
  const [selectedTestItemId, setSelectedTestItemId] = useState<number | 'sample'>('sample');

  const handleSendTestEmailNotification = async () => {
    if (!testRecipientEmail || !testRecipientEmail.includes('@')) {
      showToast('Please enter a valid recipient email address', 'error');
      return;
    }
    try {
      const renderedSubject = renderTemplateText(mailTemplates[selectedTemplateKey]?.subject || '', selectedTestItemObj);
      const renderedBody = renderTemplateText(mailTemplates[selectedTemplateKey]?.body || '', selectedTestItemObj);

      const res = await testSmtp({
        test_email: testRecipientEmail.trim(),
        subject: renderedSubject,
        body: renderedBody,
        smtp_from_name: testSenderName.trim() || 'Renewal Reminder',
      }).unwrap();
      showToast(res.message || `Notification email dispatched to ${testRecipientEmail}`, 'success');
      setTestMailDialogOpen(false);
    } catch (err: any) {
      const detail = err?.data?.detail || 'Failed to dispatch notification email. Please check SMTP settings.';
      showToast(typeof detail === 'string' ? detail : 'Failed to send email', 'error');
    }
  };

  const [renewals, setRenewals] = useDatabaseStoredState<RenewalItem[]>('crm_renewal_items', []);
  const [categories, setCategories] = useDatabaseStoredState<CategoryConfig[]>(
    'crm_renewal_categories',
    DEFAULT_CATEGORIES,
  );
  const [mailTemplates, setMailTemplates] = useDatabaseStoredState<Record<string, MailTemplate>>(
    'crm_renewal_mail_templates',
    DEFAULT_MAIL_TEMPLATES,
  );

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('reminder');

  // 3-Dots Action Menu State
  const [actionMenuAnchor, setActionMenuAnchor] = useState<{ element: HTMLElement; item: RenewalItem } | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Config SubTab State
  const [configSubTab, setConfigSubTab] = useState<'categories' | 'reminders' | 'templates' | 'rules'>('categories');
  const [advanceDaysList, setAdvanceDaysList] = useDatabaseStoredState(
    'crm_renewal_reminder_advance_days_list',
    '60, 30, 15, 7, 1',
  );
  const [emailFrequency, setEmailFrequency] = useDatabaseStoredState(
    'crm_renewal_reminder_email_frequency',
    'DAILY_DIGEST',
  );
  const [autoEscalateOverdue, setAutoEscalateOverdue] = useDatabaseStoredState(
    'crm_renewal_reminder_auto_escalate_overdue',
    true,
  );
  const [enableEmailAlerts, setEnableEmailAlerts] = useDatabaseStoredState(
    'crm_renewal_reminder_enable_email_alerts',
    true,
  );
  const [requireOwner, setRequireOwner] = useDatabaseStoredState(
    'crm_renewal_compliance_require_owner',
    true,
  );
  const [autoCalcNextDue, setAutoCalcNextDue] = useDatabaseStoredState(
    'crm_renewal_compliance_auto_calc_next_due',
    true,
  );
  const [currencySymbol, setCurrencySymbol] = useDatabaseStoredState(
    'crm_renewal_compliance_currency_symbol',
    '₹',
  );

  // Category Modal State
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#2563EB');
  const [catValidityMonths, setCatValidityMonths] = useState(12);
  const [catReminderDays, setCatReminderDays] = useState(30);

  // Item Modal State (Add / Edit Fields)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [itemService, setItemService] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [vendor, setVendor] = useState('');
  const [plan, setPlan] = useState('');
  const [department, setDepartment] = useState<string>('');
  const [branchLocation, setBranchLocation] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [renewalCycle, setRenewalCycle] = useState('Yearly');
  const [lastRenewedDate, setLastRenewedDate] = useState('');
  const [reminderDays, setReminderDays] = useState<number>(30);
  const [renewalOwner, setRenewalOwner] = useState('');
  const [remarks, setRemarks] = useState('');
  const [cost, setCost] = useState<number | ''>('');
  const [amount, setAmount] = useState<number | ''>('');

  // Dynamic Departments from Settings
  const { data: deptsList = [] } = useGetDepartmentsQuery();
  const departmentOptions = useMemo(() => {
    if (deptsList && deptsList.length > 0) {
      return deptsList.filter((d: any) => d.status !== 'INACTIVE').map((d: any) => d.name);
    }
    return [];
  }, [deptsList]);

  // Quick Add Branch Modal State
  const [quickBranchModalOpen, setQuickBranchModalOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchCity, setNewBranchCity] = useState('');
  const [newBranchState, setNewBranchState] = useState('');
  const [newBranchPincode, setNewBranchPincode] = useState('');
  const [newBranchShiftName, setNewBranchShiftName] = useState('General Day Shift');
  const [newBranchShiftStart, setNewBranchShiftStart] = useState('09:00 AM');
  const [newBranchShiftEnd, setNewBranchShiftEnd] = useState('06:00 PM');
  const [newBranchWorkingDays, setNewBranchWorkingDays] = useState('Mon - Sat (6 Days)');

  const handleSaveQuickBranch = () => {
    if (!newBranchName.trim()) {
      showToast('Branch Name is required', 'error');
      return;
    }
    const newBranchObj = {
      id: Date.now(),
      name: newBranchName.trim(),
      code: `BR-${Math.floor(100 + Math.random() * 900)}`,
      type: 'Branch Office' as const,
      address: newBranchAddress.trim(),
      city: newBranchCity.trim(),
      state: newBranchState.trim(),
      pincode: newBranchPincode.trim(),
      shift_name: newBranchShiftName.trim() || 'General Day Shift',
      shift_start_time: newBranchShiftStart.trim() || '09:00 AM',
      shift_end_time: newBranchShiftEnd.trim() || '06:00 PM',
      working_days: newBranchWorkingDays.trim() || 'Mon - Sat (6 Days)',
      manager_name: '',
      phone: '',
      email: '',
      status: 'ACTIVE' as const,
    };

    setBranchRecords((existing) => [newBranchObj, ...existing]);

    setBranchLocation(newBranchObj.name);
    setQuickBranchModalOpen(false);
    setNewBranchName('');
    setNewBranchAddress('');
    setNewBranchCity('');
    setNewBranchState('');
    setNewBranchPincode('');
    showToast(`Branch "${newBranchObj.name}" created and linked successfully!`, 'success');
  };

  // Dynamic Branches Details Map (Name -> { address, city, state, pincode, shift_name, shift_start_time, shift_end_time, working_days })
  const { data: apiBranches = [] } = useBranchesQuery();
  const branchesDataMap = useMemo(() => {
    const map: Record<string, { address?: string; city?: string; state?: string; pincode?: string; shift_name?: string; shift_start_time?: string; shift_end_time?: string; working_days?: string }> = {};

    // 1. From backend API
    if (Array.isArray(apiBranches)) {
      apiBranches.forEach((b: any) => {
        if (b.name) {
          map[b.name] = {
            address: b.address || '',
            city: b.city || '',
            state: b.state || '',
            pincode: b.pincode || '',
            shift_name: b.shift_name || 'General Day Shift',
            shift_start_time: b.shift_start_time || '09:00 AM',
            shift_end_time: b.shift_end_time || '06:00 PM',
            working_days: b.working_days || 'Mon - Sat (6 Days)',
          };
        }
      });
    }

    branchRecords.forEach((branch) => {
      if (branch.name && branch.status !== 'INACTIVE' && branch.is_active !== false) {
        map[branch.name] = {
          address: branch.address || '',
          city: branch.city || '',
          state: branch.state || '',
          pincode: branch.pincode || '',
          shift_name: branch.shift_name || 'General Day Shift',
          shift_start_time: branch.shift_start_time || '09:00 AM',
          shift_end_time: branch.shift_end_time || '06:00 PM',
          working_days: branch.working_days || 'Mon - Sat (6 Days)',
        };
      }
    });

    return map;
  }, [apiBranches, branchRecords]);

  const branchOptions = useMemo(() => {
    return Object.keys(branchesDataMap);
  }, [branchesDataMap]);

  // Dynamic System Users & Employee Master List for Renewal Owner
  const { data: apiUsers = [] } = useUsersQuery();
  const { data: rbacUsersData } = useGetUsersQuery({ page: 1, page_size: 100 });

  // Helper to dynamically resolve email for a given Renewal Owner name
  const resolveOwnerEmail = (ownerName: string): string => {
    if (!ownerName) return 'admin@company.com';
    const searchName = ownerName.trim().toLowerCase();

    // 1. From mastersApi /masters/users
    if (Array.isArray(apiUsers) && apiUsers.length > 0) {
      const found = apiUsers.find((u: any) => {
        const name = (u.full_name || u.name || u.username || '').toLowerCase();
        return name === searchName || name.includes(searchName) || searchName.includes(name);
      });
      if (found?.email) return found.email;
    }

    // 2. From rbacApi /users
    const rbacItems = (rbacUsersData as any)?.items || (Array.isArray(rbacUsersData) ? rbacUsersData : []);
    if (Array.isArray(rbacItems) && rbacItems.length > 0) {
      const found = rbacItems.find((u: any) => {
        const name = (u.full_name || u.name || u.username || '').toLowerCase();
        return name === searchName || name.includes(searchName) || searchName.includes(name);
      });
      if (found?.email) return found.email;
    }

    const employee = employeeRecords.find((record) => {
      const name = (record.full_name || record.name || '').toLowerCase();
      return name === searchName || name.includes(searchName) || searchName.includes(name);
    });
    if (employee?.email) return employee.email;

    // 4. Default fallback email format based on owner's name
    const formatted = searchName.replace(/[^a-z0-9]/g, '.');
    return `${formatted}@company.com`;
  };

  const handleOpenTriggerEmailDialog = (item?: RenewalItem) => {
    if (item) {
      setSelectedTestItemId(item.id);
      setTestRecipientEmail(resolveOwnerEmail(item.renewal_owner));
    } else if (renewals.length > 0) {
      const firstItem = renewals[0];
      setSelectedTestItemId(firstItem.id);
      setTestRecipientEmail(resolveOwnerEmail(firstItem.renewal_owner));
    } else {
      setSelectedTestItemId('sample');
      const authUser = localStorage.getItem('user');
      let defaultEmail = '';
      try {
        if (authUser) defaultEmail = JSON.parse(authUser).email || '';
      } catch {}
      setTestRecipientEmail(defaultEmail || 'admin@company.com');
    }
    setTestMailDialogOpen(true);
  };

  const handleSelectTestItemChange = (val: string | number) => {
    if (val === 'sample') {
      setSelectedTestItemId('sample');
      const authUser = localStorage.getItem('user');
      let defaultEmail = '';
      try {
        if (authUser) defaultEmail = JSON.parse(authUser).email || '';
      } catch {}
      setTestRecipientEmail(defaultEmail || 'admin@company.com');
    } else {
      const numericId = Number(val);
      setSelectedTestItemId(numericId);
      const foundItem = renewals.find((r) => r.id === numericId);
      if (foundItem) {
        setTestRecipientEmail(resolveOwnerEmail(foundItem.renewal_owner));
      }
    }
  };

  const selectedTestItemObj = useMemo(() => {
    if (selectedTestItemId === 'sample') return undefined;
    return renewals.find((r) => r.id === Number(selectedTestItemId));
  }, [selectedTestItemId, renewals]);

  const ownerOptions = useMemo(() => {
    const list: string[] = [];

    // 1. From mastersApi /masters/users
    if (Array.isArray(apiUsers) && apiUsers.length > 0) {
      apiUsers.forEach((u: any) => {
        const name = u.full_name || u.name || u.username;
        if (name && !list.includes(name)) {
          list.push(name);
        }
      });
    }

    // 2. From rbacApi /users
    const rbacItems = (rbacUsersData as any)?.items || (Array.isArray(rbacUsersData) ? rbacUsersData : []);
    if (Array.isArray(rbacItems) && rbacItems.length > 0) {
      rbacItems.forEach((u: any) => {
        const name = u.full_name || u.name || u.username;
        if (name && !list.includes(name)) {
          list.push(name);
        }
      });
    }

    employeeRecords.forEach((employee) => {
      const name = employee.name || employee.full_name;
      if (name && !list.includes(name)) list.push(name);
    });

    return list;
  }, [apiUsers, employeeRecords, rbacUsersData]);



  // Active Tab from URL
  const currentTab = location.pathname.endsWith('/reports')
    ? 'reports'
    : location.pathname.endsWith('/configuration')
    ? 'configuration'
    : 'tracker';

  const handleOpenActionMenu = (event: React.MouseEvent<HTMLElement>, item: RenewalItem) => {
    setActionMenuAnchor({ element: event.currentTarget, item });
  };

  const handleCloseActionMenu = () => {
    setActionMenuAnchor(null);
  };

  const handleOpenModal = (item?: RenewalItem) => {
    const defaultDept = departmentOptions.length > 0 ? departmentOptions[0] : '';
    const defaultBranch = branchOptions.length > 0 ? branchOptions[0] : '';
    const defaultCat = categories.length > 0 ? categories[0].name : '';

    if (item) {
      setEditingId(item.id);
      setItemService(item.item_service);
      setDescription(item.description || '');
      setCategory(item.category || defaultCat);
      setVendor(item.vendor || '');
      setPlan(item.plan || '');
      setDepartment(item.department || defaultDept);
      setBranchLocation(item.branch_location || defaultBranch);
      setStartDate(item.start_date || '');
      setDueDate(item.due_date);
      setRenewalCycle(item.renewal_cycle || 'Yearly');
      setLastRenewedDate(item.last_renewed_date || '');
      setReminderDays(item.reminder_days || 30);
      setRenewalOwner(item.renewal_owner || '');
      setRemarks(item.remarks || '');
      const valAmt = item.amount ?? item.cost ?? '';
      setCost(valAmt);
      setAmount(valAmt);
    } else {
      setEditingId(null);
      setItemService('');
      setDescription('');
      setCategory(defaultCat);
      setVendor('');
      setPlan('');
      setDepartment(defaultDept);
      setBranchLocation(defaultBranch);
      setStartDate(new Date().toISOString().split('T')[0]);
      setDueDate('');
      setRenewalCycle('Yearly');
      setLastRenewedDate('');
      setReminderDays(30);
      setRenewalOwner('');
      setRemarks('');
      setCost('');
      setAmount('');
    }
    setModalOpen(true);
  };


  const handleSaveRenewal = () => {
    if (!itemService.trim() || !dueDate) {
      showToast('Renewal Item / Service name and Renewal Due Date are mandatory', 'error');
      return;
    }

    const daysLeft = getDaysRemaining(dueDate);
    let calculatedStatus: RenewalItem['status'] = 'ACTIVE';
    if (daysLeft < 0) {
      calculatedStatus = 'EXPIRED';
    } else if (daysLeft <= reminderDays) {
      calculatedStatus = 'EXPIRING_SOON';
    }

    const numAmt = amount !== '' ? Number(amount) : (cost !== '' ? Number(cost) : 0);

    if (editingId) {
      setRenewals((prev) =>
        prev.map((r) =>
          r.id === editingId
            ? {
                ...r,
                item_service: itemService.trim(),
                description: description.trim(),
                category,
                vendor: vendor.trim(),
                plan: plan.trim(),
                department,
                branch_location: branchLocation,
                start_date: startDate,
                due_date: dueDate,
                renewal_cycle: renewalCycle,
                last_renewed_date: lastRenewedDate,
                reminder_days: Number(reminderDays),
                renewal_owner: renewalOwner.trim(),
                remarks: remarks.trim(),
                cost: numAmt,
                amount: numAmt,
                status: calculatedStatus,
              }
            : r,
        ),
      );
      showToast('Renewal item updated successfully', 'success');
    } else {
      const newItem: RenewalItem = {
        id: Date.now(),
        item_service: itemService.trim(),
        description: description.trim(),
        category,
        vendor: vendor.trim(),
        plan: plan.trim(),
        department,
        branch_location: branchLocation,
        start_date: startDate || new Date().toISOString().split('T')[0],
        due_date: dueDate,
        renewal_cycle: renewalCycle,
        last_renewed_date: lastRenewedDate || 'N/A',
        reminder_days: Number(reminderDays),
        renewal_owner: renewalOwner.trim() || 'System Admin',
        remarks: remarks.trim(),
        cost: numAmt,
        amount: numAmt,
        status: calculatedStatus,
      };
      setRenewals((prev) => [newItem, ...prev]);
      showToast('New renewal item created successfully', 'success');
    }

    setModalOpen(false);
  };


  const handleMarkRenewed = (id: number) => {
    setRenewals((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const todayStr = new Date().toISOString().split('T')[0];
          const nextDue = new Date(r.due_date || Date.now());
          nextDue.setFullYear(nextDue.getFullYear() + 1);
          return {
            ...r,
            last_renewed_date: todayStr,
            start_date: todayStr,
            due_date: nextDue.toISOString().split('T')[0],
            status: 'RENEWED',
          };
        }
        return r;
      }),
    );
    showToast('Marked as renewed! Updated last renewed date & calculated next due date.', 'success');
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this renewal record?')) {
      setRenewals((prev) => prev.filter((r) => r.id !== id));
      showToast('Renewal record deleted', 'info');
    }
  };

  // Category Modal Handlers
  const handleOpenCatModal = (cat?: CategoryConfig) => {
    if (cat) {
      setEditingCatId(cat.id);
      setCatName(cat.name);
      setCatColor(cat.color);
      setCatValidityMonths(cat.default_validity_months);
      setCatReminderDays(cat.default_reminder_days);
    } else {
      setEditingCatId(null);
      setCatName('');
      setCatColor('#2563EB');
      setCatValidityMonths(12);
      setCatReminderDays(30);
    }
    setCatModalOpen(true);
  };

  const handleSaveCategory = () => {
    if (!catName.trim()) {
      showToast('Category name is mandatory', 'error');
      return;
    }
    if (editingCatId) {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === editingCatId
            ? {
                ...c,
                name: catName.trim(),
                color: catColor,
                default_validity_months: catValidityMonths,
                default_reminder_days: catReminderDays,
              }
            : c,
        ),
      );
      showToast('Renewal category updated', 'success');
    } else {
      const newCat: CategoryConfig = {
        id: Date.now(),
        name: catName.trim(),
        color: catColor,
        default_validity_months: catValidityMonths,
        default_reminder_days: catReminderDays,
        is_active: true,
      };
      setCategories((prev) => [...prev, newCat]);
      showToast('New renewal category added', 'success');
    }
    setCatModalOpen(false);
  };

  const handleToggleCatActive = (id: number) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_active: !c.is_active } : c)),
    );
    showToast('Category status updated', 'info');
  };

  const handleDeleteCat = (id: number) => {
    if (confirm('Are you sure you want to delete this category?')) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
      showToast('Category removed', 'info');
    }
  };

  const getItemEffectiveStatus = (r: RenewalItem): string => {
    if (r.status === 'RENEWED') return 'RENEWED';
    const days = getDaysRemaining(r.due_date);
    if (days < 0) return 'EXPIRED';
    if (days <= (r.reminder_days || 30)) return 'EXPIRING_SOON';
    return 'ACTIVE';
  };

  // Filtered List
  const filteredRenewals = renewals.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      r.item_service.toLowerCase().includes(q) ||
      (r.vendor && r.vendor.toLowerCase().includes(q)) ||
      (r.plan && r.plan.toLowerCase().includes(q)) ||
      (r.description && r.description.toLowerCase().includes(q)) ||
      (r.renewal_owner && r.renewal_owner.toLowerCase().includes(q)) ||
      (r.branch_location && r.branch_location.toLowerCase().includes(q)) ||
      (r.remarks && r.remarks.toLowerCase().includes(q));

    const matchesCategory = categoryFilter === 'ALL' || r.category === categoryFilter;
    const matchesDepartment = departmentFilter === 'ALL' || r.department === departmentFilter;

    const effStatus = getItemEffectiveStatus(r);
    const matchesStatus =
      statusFilter === 'ALL' ||
      r.status === statusFilter ||
      effStatus === statusFilter;

    return matchesSearch && matchesCategory && matchesDepartment && matchesStatus;
  });

  const { sortState: renewalSortState, handleSort: handleRenewalSort, sortData: sortRenewals } = useTableSort<RenewalItem>({
    getValue: {
      days_remaining: (r) => getDaysRemaining(r.due_date),
      amount: (r) => r.amount ?? r.cost ?? 0,
    },
  });

  const { sortState: categorySortState, handleSort: handleCategorySort, sortData: sortCategories } = useTableSort<any>();

  const sortedRenewals = useMemo(() => sortRenewals(filteredRenewals), [filteredRenewals, sortRenewals]);
  const sortedCategories = useMemo(() => sortCategories(categories), [categories, sortCategories]);

  // Metrics
  const totalCount = renewals.length;
  const expiringSoonCount = renewals.filter((r) => getItemEffectiveStatus(r) === 'EXPIRING_SOON').length;
  const expiredCount = renewals.filter((r) => getItemEffectiveStatus(r) === 'EXPIRED').length;
  const activeCount = renewals.filter((r) => getItemEffectiveStatus(r) === 'ACTIVE').length;

  const renderDaysRemainingChip = (dueDateStr: string) => {
    const days = getDaysRemaining(dueDateStr);
    if (days < 0) {
      return (
        <Chip
          label={`${Math.abs(days)}d Overdue`}
          size="small"
          sx={{ bgcolor: '#FEE2E2', color: '#DC2626', fontWeight: 700, borderRadius: '4px', fontSize: 12.5, height: 24 }}
        />
      );
    } else if (days <= 30) {
      return (
        <Chip
          label={`${days}d Left`}
          size="small"
          sx={{ bgcolor: '#FEF3C7', color: '#D97706', fontWeight: 700, borderRadius: '4px', fontSize: 12.5, height: 24 }}
        />
      );
    } else {
      return (
        <Chip
          label={`${days}d Left`}
          size="small"
          sx={{ bgcolor: '#EAF6E8', color: '#04552B', fontWeight: 700, borderRadius: '4px', fontSize: 12.5, height: 24 }}
        />
      );
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', minWidth: 0, px: 0, py: 1.5, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Top Header Row: 3 Status Filter Pills (Left) + Import & New Item Buttons (Right) */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
          mb: 2,
          width: '100%',
        }}
      >
        {/* Left Side: 3 Compact Status Pills */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
          {/* Pill 1: Active & Compliant */}
          <Paper
            elevation={0}
            onClick={() => setStatusFilter((prev) => (prev === 'ACTIVE' ? 'ALL' : 'ACTIVE'))}
            sx={{
              px: 1.5,
              py: 0.8,
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.18s ease-in-out',
              border: '1.5px solid',
              borderColor: statusFilter === 'ACTIVE' ? '#04552B' : '#C8E6C9',
              bgcolor: statusFilter === 'ACTIVE' ? '#04552B' : '#F4FBF7',
              color: statusFilter === 'ACTIVE' ? '#FFFFFF' : '#04552B',
              boxShadow: statusFilter === 'ACTIVE' ? '0 3px 10px rgba(4, 85, 43, 0.2)' : 'none',
              '&:hover': {
                borderColor: '#04552B',
                transform: 'translateY(-1px)',
              },
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <ShieldCheck size={17} color={statusFilter === 'ACTIVE' ? '#FFFFFF' : '#04552B'} />
            <Typography sx={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1 }}>
              Active & Compliant
            </Typography>
            <Box
              sx={{
                px: 1,
                py: 0.2,
                borderRadius: '12px',
                bgcolor: statusFilter === 'ACTIVE' ? 'rgba(255, 255, 255, 0.25)' : '#DCFCE7',
                color: statusFilter === 'ACTIVE' ? '#FFFFFF' : '#15803D',
                fontWeight: 800,
                fontSize: 12.5,
              }}
            >
              {activeCount}
            </Box>
          </Paper>

          {/* Pill 2: Expiring Soon */}
          <Paper
            elevation={0}
            onClick={() => setStatusFilter((prev) => (prev === 'EXPIRING_SOON' ? 'ALL' : 'EXPIRING_SOON'))}
            sx={{
              px: 1.5,
              py: 0.8,
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.18s ease-in-out',
              border: '1.5px solid',
              borderColor: statusFilter === 'EXPIRING_SOON' ? '#D97706' : '#FDE68A',
              bgcolor: statusFilter === 'EXPIRING_SOON' ? '#D97706' : '#FFFDF5',
              color: statusFilter === 'EXPIRING_SOON' ? '#FFFFFF' : '#D97706',
              boxShadow: statusFilter === 'EXPIRING_SOON' ? '0 3px 10px rgba(217, 119, 6, 0.2)' : 'none',
              '&:hover': {
                borderColor: '#D97706',
                transform: 'translateY(-1px)',
              },
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <BellRing size={17} color={statusFilter === 'EXPIRING_SOON' ? '#FFFFFF' : '#D97706'} />
            <Typography sx={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1 }}>
              Expiring Soon (&lt;30d)
            </Typography>
            <Box
              sx={{
                px: 1,
                py: 0.2,
                borderRadius: '12px',
                bgcolor: statusFilter === 'EXPIRING_SOON' ? 'rgba(255, 255, 255, 0.25)' : '#FEF3C7',
                color: statusFilter === 'EXPIRING_SOON' ? '#FFFFFF' : '#B45309',
                fontWeight: 800,
                fontSize: 12.5,
              }}
            >
              {expiringSoonCount}
            </Box>
          </Paper>

          {/* Pill 3: Expired Overdue */}
          <Paper
            elevation={0}
            onClick={() => setStatusFilter((prev) => (prev === 'EXPIRED' ? 'ALL' : 'EXPIRED'))}
            sx={{
              px: 1.5,
              py: 0.8,
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.18s ease-in-out',
              border: '1.5px solid',
              borderColor: statusFilter === 'EXPIRED' ? '#DC2626' : '#FCA5A5',
              bgcolor: statusFilter === 'EXPIRED' ? '#DC2626' : '#FEF2F2',
              color: statusFilter === 'EXPIRED' ? '#FFFFFF' : '#DC2626',
              boxShadow: statusFilter === 'EXPIRED' ? '0 3px 10px rgba(220, 38, 38, 0.2)' : 'none',
              '&:hover': {
                borderColor: '#DC2626',
                transform: 'translateY(-1px)',
              },
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <AlertCircle size={17} color={statusFilter === 'EXPIRED' ? '#FFFFFF' : '#DC2626'} />
            <Typography sx={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1 }}>
              Expired Overdue
            </Typography>
            <Box
              sx={{
                px: 1,
                py: 0.2,
                borderRadius: '12px',
                bgcolor: statusFilter === 'EXPIRED' ? 'rgba(255, 255, 255, 0.25)' : '#FEE2E2',
                color: statusFilter === 'EXPIRED' ? '#FFFFFF' : '#991B1B',
                fontWeight: 800,
                fontSize: 12.5,
              }}
            >
              {expiredCount}
            </Box>
          </Paper>
        </Box>

        {/* Right Side: Action Buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<Upload size={16} />}
            onClick={() => showToast('Import format ready for 12 renewal fields', 'info')}
            sx={{ borderColor: '#cbd5e1', color: '#334155', borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: 15 }}
          >
            Import
          </Button>
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => handleOpenModal()}
            sx={{ backgroundColor: '#04552B', '&:hover': { backgroundColor: '#034120' }, borderRadius: '8px', textTransform: 'none', fontWeight: 700, fontSize: 15 }}
          >
            New Renewal Item / Service
          </Button>
        </Box>
      </Box>

      {/* ── TAB: RENEWAL TRACKER GRID ── */}
      {currentTab === 'tracker' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', maxWidth: 'none' }}>
          {/* Filter Controls Bar */}
          <Paper elevation={0} sx={{ p: 1.5, border: '1px solid #E4EBE1', borderRadius: '12px', bgcolor: '#FFFFFF', width: '100%', boxSizing: 'border-box' }}>
            <Grid container spacing={1.5} alignItems="center">
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search item, description, owner, branch, remarks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={15} color="#7A8B80" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiInputBase-input': { fontSize: 14.5 } }}
                />
              </Grid>

              <Grid item xs={6} sm={2.5}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ fontSize: 14.5 }}>Category</InputLabel>
                  <Select value={categoryFilter} label="Category" onChange={(e) => setCategoryFilter(e.target.value)} sx={{ fontSize: 14.5 }}>
                    <MenuItem value="ALL">All Categories</MenuItem>
                    {categories.map((c) => (
                      <MenuItem key={c.id} value={c.name}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6} sm={2.5}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ fontSize: 14.5 }}>Department</InputLabel>
                  <Select value={departmentFilter} label="Department" onChange={(e) => setDepartmentFilter(e.target.value)} sx={{ fontSize: 14.5 }}>
                    <MenuItem value="ALL">All Departments</MenuItem>
                    {departmentOptions.map((d) => (
                      <MenuItem key={d} value={d}>
                        {d}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6} sm={2}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ fontSize: 14.5 }}>Status</InputLabel>
                  <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)} sx={{ fontSize: 14.5 }}>
                    <MenuItem value="ALL">All Statuses</MenuItem>
                    <MenuItem value="ACTIVE">Active</MenuItem>
                    <MenuItem value="EXPIRING_SOON">Expiring Soon</MenuItem>
                    <MenuItem value="EXPIRED">Expired</MenuItem>
                    <MenuItem value="RENEWED">Renewed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6} sm={1} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('ALL');
                    setDepartmentFilter('ALL');
                    setStatusFilter('ALL');
                  }}
                  sx={{ textTransform: 'none', color: '#7A8B80', borderColor: '#CBD5E1', fontSize: 13.5, px: 1 }}
                >
                  Reset
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {/* Main Revamped Tracker Table */}
          <Paper elevation={0} sx={{ border: '1px solid #E4EBE1', borderRadius: '12px', overflowX: 'auto', width: '100%', boxSizing: 'border-box', bgcolor: '#FFFFFF' }}>
            <Table size="medium" sx={{ width: '100%', tableLayout: 'auto' }}>
              <TableHead sx={{ backgroundColor: '#F8FAF7' }}>
                <TableRow>
                  <ErpSortHeaderCell variant="mui" field="item_service" label="Renewal Item / Service" sortState={renewalSortState} onSort={handleRenewalSort} sx={{ fontSize: 14.5, px: 1.5, py: 1.5, minWidth: 160, width: '18%' }} />
                  <ErpSortHeaderCell variant="mui" field="vendor" label="Vendor" sortState={renewalSortState} onSort={handleRenewalSort} sx={{ fontSize: 14.5, px: 1.5, py: 1.5, minWidth: 100, width: '10%' }} />
                  <ErpSortHeaderCell variant="mui" field="plan" label="Plan" sortState={renewalSortState} onSort={handleRenewalSort} sx={{ fontSize: 14.5, px: 1.5, py: 1.5, minWidth: 100, width: '10%' }} />
                  <ErpSortHeaderCell variant="mui" field="department" label="Department" sortState={renewalSortState} onSort={handleRenewalSort} sx={{ fontSize: 14.5, px: 1.5, py: 1.5, minWidth: 100, width: '9%' }} />
                  <ErpSortHeaderCell variant="mui" field="due_date" label="Due Date" sortState={renewalSortState} onSort={handleRenewalSort} sx={{ fontSize: 14.5, px: 1.5, py: 1.5, minWidth: 100, width: '9%' }} />
                  <ErpSortHeaderCell variant="mui" field="renewal_cycle" label="Renewal Cycle" sortState={renewalSortState} onSort={handleRenewalSort} sx={{ fontSize: 14.5, px: 1.5, py: 1.5, minWidth: 95, width: '8%' }} />
                  <ErpSortHeaderCell variant="mui" field="days_remaining" label="Days Remaining" sortState={renewalSortState} onSort={handleRenewalSort} sx={{ fontSize: 14.5, px: 1.5, py: 1.5, minWidth: 120, width: '10%' }} />
                  <ErpSortHeaderCell variant="mui" field="last_renewed_date" label="Last Renewed Date" sortState={renewalSortState} onSort={handleRenewalSort} sx={{ fontSize: 14.5, px: 1.5, py: 1.5, minWidth: 110, width: '9%' }} />
                  <ErpSortHeaderCell variant="mui" field="amount" label="Amount (₹)" sortState={renewalSortState} onSort={handleRenewalSort} sx={{ fontSize: 14.5, px: 1.5, py: 1.5, minWidth: 90, width: '8%' }} />
                  <ErpSortHeaderCell variant="mui" field="renewal_owner" label="Renewal Owner" sortState={renewalSortState} onSort={handleRenewalSort} sx={{ fontSize: 14.5, px: 1.5, py: 1.5, minWidth: 110, width: '14%' }} />
                  <ErpSortHeaderCell variant="mui" label="Actions" align="center" sortable={false} sx={{ fontSize: 14.5, px: 1, py: 1.5, minWidth: 60, width: '5%' }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedRenewals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 6, color: '#7A8B80' }}>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: '#64748B' }}>
                        No renewal items found. Click 'New Renewal Item / Service' to create a new record.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRenewals.map((r) => {
                    const displayAmt = r.amount ?? r.cost;
                    return (
                      <TableRow key={r.id} hover sx={{ '& td': { px: 1.5, py: 1.2 } }}>
                        <TableCell>
                          <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#16231B' }}>
                            {r.item_service}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 14.5, fontWeight: 600, color: '#334155' }}>
                            {r.vendor || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 14.5, color: '#475569' }}>
                            {r.plan || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 14.5, fontWeight: 600, color: '#334155' }}>
                            {r.department || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ fontSize: 14.5, fontWeight: 700, color: getDaysRemaining(r.due_date) < 0 ? '#DC2626' : '#16231B' }}>
                          {r.due_date ? formatDate(r.due_date) : '—'}
                        </TableCell>
                        <TableCell>
                          <Chip label={r.renewal_cycle || 'Yearly'} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: 13, color: '#04552B', borderColor: '#A7F3D0' }} />
                        </TableCell>
                        <TableCell>{renderDaysRemainingChip(r.due_date)}</TableCell>
                        <TableCell sx={{ fontSize: 14.5, color: '#44584C' }}>{r.last_renewed_date ? formatDate(r.last_renewed_date) : 'N/A'}</TableCell>
                        <TableCell sx={{ fontSize: 14.5, fontWeight: 700, color: '#04552B' }}>
                          {displayAmt ? `₹${Number(displayAmt).toLocaleString('en-IN')}` : '—'}
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 14.5, fontWeight: 600, color: '#04552B' }}>
                            {r.renewal_owner || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton size="small" onClick={(e) => handleOpenActionMenu(e, r)} sx={{ p: 0.8 }}>
                            <MoreVertical size={18} color="#475569" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}

              </TableBody>
            </Table>
          </Paper>
        </Box>
      )}

      {/* 3-Dots Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor?.element}
        open={Boolean(actionMenuAnchor)}
        onClose={handleCloseActionMenu}
        slotProps={{
          paper: {
            sx: {
              border: '1px solid #E4EBE1',
              borderRadius: '8px',
              minWidth: 150,
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            if (actionMenuAnchor) {
              handleOpenTriggerEmailDialog(actionMenuAnchor.item);
            }
            handleCloseActionMenu();
          }}
          sx={{ fontSize: 12.5, fontWeight: 600, color: '#04552B', py: 1 }}
        >
          <Mail size={14} style={{ marginRight: 8 }} />
          Send Email Notification to Owner
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (actionMenuAnchor) handleMarkRenewed(actionMenuAnchor.item.id);
            handleCloseActionMenu();
          }}
          sx={{ fontSize: 12.5, fontWeight: 600, color: '#04552B', py: 1 }}
        >
          <CheckCircle2 size={14} style={{ marginRight: 8 }} />
          Mark Renewed
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (actionMenuAnchor) handleOpenModal(actionMenuAnchor.item);
            handleCloseActionMenu();
          }}
          sx={{ fontSize: 12.5, fontWeight: 600, color: '#2563EB', py: 1 }}
        >
          <Pencil size={14} style={{ marginRight: 8 }} />
          Edit Record
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (actionMenuAnchor) handleDelete(actionMenuAnchor.item.id);
            handleCloseActionMenu();
          }}
          sx={{ fontSize: 12.5, fontWeight: 600, color: '#DC2626', py: 1 }}
        >
          <Trash2 size={14} style={{ marginRight: 8 }} />
          Delete Record
        </MenuItem>
      </Menu>

      {/* ── TAB 3: REPORTS & ANALYTICS ────────────────────────────────────── */}
      {currentTab === 'reports' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', maxWidth: 'none' }}>
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <Paper elevation={0} sx={{ border: '1px solid #E4EBE1', borderRadius: '12px', p: 3, bgcolor: '#FFFFFF' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#023020', mb: 2 }}>
                  Category Renewal Distribution
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {categories.slice(0, 6).map((c) => {
                    const catItems = renewals.filter((r) => r.category === c.name);
                    const pct = totalCount > 0 ? Math.round((catItems.length / totalCount) * 100) : 0;
                    return (
                      <Box key={c.id}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#16231B' }}>{c.name}</Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#023020' }}>
                            {catItems.length} Items ({pct}%)
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: '#F1F5F9',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: c.color || '#04552B',
                            },
                          }}
                        />
                      </Box>
                    );
                  })}
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper elevation={0} sx={{ border: '1px solid #E4EBE1', borderRadius: '12px', p: 3, bgcolor: '#FFFFFF' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#023020', mb: 2 }}>
                  Compliance & Renewal Audit Summary
                </Typography>
                <Box sx={{ p: 2, bgcolor: '#F8FAF7', borderRadius: '10px', border: '1px solid #E4EBE1', mb: 2 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#023020', mb: 0.5 }}>
                    Enterprise Statutory Compliance Rating
                  </Typography>
                  <Typography sx={{ fontSize: 28, fontWeight: 800, color: '#04552B' }}>
                    {totalCount > 0 ? Math.round(((totalCount - expiredCount) / totalCount) * 100) : 100}%
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#7A8B80' }}>
                    Calculated on Active / Valid Items vs Overdue Expiries across all branches.
                  </Typography>
                </Box>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Download size={16} />}
                  onClick={() => showToast('Full 12-Field Renewal Compliance Audit Exported (.CSV)', 'success')}
                  sx={{ textTransform: 'none', fontWeight: 700, borderColor: '#04552B', color: '#04552B' }}
                >
                  Download Full Compliance Audit Report (.CSV)
                </Button>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* ── TAB 4: RENEWAL CONFIGURATION ──────────────────────────────────── */}
      {currentTab === 'configuration' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', maxWidth: 'none' }}>
          <Paper elevation={0} sx={{ border: '1px solid #E4EBE1', borderRadius: '12px', p: 1.5, bgcolor: '#F8FAF7', width: '100%', boxSizing: 'border-box' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant={configSubTab === 'categories' ? 'contained' : 'text'}
                onClick={() => setConfigSubTab('categories')}
                startIcon={<FolderCog size={15} />}
                sx={{
                  backgroundColor: configSubTab === 'categories' ? '#04552B' : 'transparent',
                  color: configSubTab === 'categories' ? '#FFFFFF' : '#44584C',
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: '6px',
                }}
              >
                Categories Config
              </Button>
              <Button
                size="small"
                variant={configSubTab === 'reminders' ? 'contained' : 'text'}
                onClick={() => setConfigSubTab('reminders')}
                startIcon={<BellRing size={15} />}
                sx={{
                  backgroundColor: configSubTab === 'reminders' ? '#04552B' : 'transparent',
                  color: configSubTab === 'reminders' ? '#FFFFFF' : '#44584C',
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: '6px',
                }}
              >
                Reminder Policy & Days
              </Button>
              <Button
                size="small"
                variant={configSubTab === 'templates' ? 'contained' : 'text'}
                onClick={() => setConfigSubTab('templates')}
                startIcon={<Mail size={15} />}
                sx={{
                  backgroundColor: configSubTab === 'templates' ? '#04552B' : 'transparent',
                  color: configSubTab === 'templates' ? '#FFFFFF' : '#44584C',
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: '6px',
                }}
              >
                Mail Notification Templates
              </Button>
              <Button
                size="small"
                variant={configSubTab === 'rules' ? 'contained' : 'text'}
                onClick={() => setConfigSubTab('rules')}
                startIcon={<Sliders size={15} />}
                sx={{
                  backgroundColor: configSubTab === 'rules' ? '#04552B' : 'transparent',
                  color: configSubTab === 'rules' ? '#FFFFFF' : '#44584C',
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: '6px',
                }}
              >
                Compliance Rules & Setup
              </Button>
            </Box>
          </Paper>

          {/* Sub-Tab 1: Categories Configuration */}
          {configSubTab === 'categories' && (
            <Paper elevation={0} sx={{ border: '1px solid #E4EBE1', borderRadius: '12px', p: 3, bgcolor: '#FFFFFF' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#023020' }}>
                    Renewal Category Master
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#667A6D' }}>
                    Configure categories, default validity terms, and advance reminder lead times.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<Plus size={16} />}
                  onClick={() => handleOpenCatModal()}
                  sx={{ backgroundColor: '#04552B', '&:hover': { backgroundColor: '#034120' }, borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
                >
                  Add Category
                </Button>
              </Box>

              <Table size="small">
                <TableHead sx={{ backgroundColor: '#F8FAF7' }}>
                  <TableRow>
                    <ErpSortHeaderCell variant="mui" field="name" label="Category Name" sortState={categorySortState} onSort={handleCategorySort} />
                    <ErpSortHeaderCell variant="mui" field="color" label="Color Badge" sortState={categorySortState} onSort={handleCategorySort} />
                    <ErpSortHeaderCell variant="mui" field="default_validity_months" label="Default Validity (Months)" sortState={categorySortState} onSort={handleCategorySort} />
                    <ErpSortHeaderCell variant="mui" field="default_reminder_days" label="Default Advance Reminder" sortState={categorySortState} onSort={handleCategorySort} />
                    <ErpSortHeaderCell variant="mui" field="is_active" label="Status" sortState={categorySortState} onSort={handleCategorySort} />
                    <ErpSortHeaderCell variant="mui" label="Actions" align="right" sortable={false} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedCategories.map((c) => (
                    <TableRow key={c.id} hover>
                      <TableCell sx={{ fontWeight: 700, color: '#16231B' }}>{c.name}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: c.color }} />
                          <Typography sx={{ fontSize: 12, fontFamily: 'monospace', color: '#64748B' }}>{c.color}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{c.default_validity_months} Months</TableCell>
                      <TableCell sx={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{c.default_reminder_days} Days Before Expiry</TableCell>
                      <TableCell>
                        <Switch size="small" checked={c.is_active} onChange={() => handleToggleCatActive(c.id)} color="success" />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleOpenCatModal(c)} sx={{ color: '#3B82F6' }}>
                          <Pencil size={15} />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteCat(c.id)} sx={{ color: '#EF4444' }}>
                          <Trash2 size={15} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          {/* Sub-Tab 2: Reminder & Notification Policy */}
          {configSubTab === 'reminders' && (
            <Paper elevation={0} sx={{ border: '1px solid #E4EBE1', borderRadius: '12px', p: 3, bgcolor: '#FFFFFF' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#023020', mb: 1 }}>
                Advance Reminder Lead Time & Escalation Policy
              </Typography>
              <Typography variant="body2" sx={{ color: '#667A6D', mb: 3 }}>
                Configure trigger lead times and escalation rules for upcoming or overdue renewals.
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Advance Alert Trigger Days (Comma-separated)"
                    fullWidth
                    size="small"
                    value={advanceDaysList}
                    onChange={(e) => setAdvanceDaysList(e.target.value)}
                    helperText="Triggers advance email alerts at X days prior to due date (e.g. 60, 30, 15, 7, 1)"
                    sx={{ mb: 2.5 }}
                  />

                  <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
                    <InputLabel>Email Notification Frequency</InputLabel>
                    <Select value={emailFrequency} label="Email Notification Frequency" onChange={(e) => setEmailFrequency(e.target.value)}>
                      <MenuItem value="DAILY_DIGEST">Daily Morning Digest (08:00 AM)</MenuItem>
                      <MenuItem value="INSTANT">Instant Alert on Trigger Date</MenuItem>
                      <MenuItem value="WEEKLY_SUMMARY">Weekly Summary (Every Monday)</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControlLabel
                    control={<Switch checked={enableEmailAlerts} onChange={(e) => setEnableEmailAlerts(e.target.checked)} color="success" />}
                    label={<Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#16231B' }}>Enable Automatic SMTP Email Reminders</Typography>}
                    sx={{ mb: 1, display: 'block' }}
                  />

                  <FormControlLabel
                    control={<Switch checked={autoEscalateOverdue} onChange={(e) => setAutoEscalateOverdue(e.target.checked)} color="warning" />}
                    label={<Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#16231B' }}>Auto-escalate Overdue Expiries to Department Head</Typography>}
                    sx={{ display: 'block' }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#F8FAF7', border: '1px solid #E4EBE1', borderRadius: '10px' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#023020', mb: 1 }}>
                      Reminder Escalation Matrix
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: '#667A6D', mb: 2 }}>
                      Automated email notifications triggered based on calculated days remaining:
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box sx={{ p: 1.5, bg: '#FFFFFF', borderRadius: '6px', borderLeft: '4px solid #2563EB' }}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#1E40AF' }}>Reminder Lead Time (e.g., 30 Days)</Typography>
                        <Typography sx={{ fontSize: 11.5, color: '#475569' }}>Notifies Renewal Owner & Department Lead</Typography>
                      </Box>
                      <Box sx={{ p: 1.5, bg: '#FFFFFF', borderRadius: '6px', borderLeft: '4px solid #D97706' }}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#92400E' }}>7 Days Before Renewal Due Date</Typography>
                        <Typography sx={{ fontSize: 11.5, color: '#475569' }}>Escalates to Branch Manager & Procurement</Typography>
                      </Box>
                      <Box sx={{ p: 1.5, bg: '#FFFFFF', borderRadius: '6px', borderLeft: '4px solid #DC2626' }}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#991B1B' }}>Overdue (0 Days / Past Due Date)</Typography>
                        <Typography sx={{ fontSize: 11.5, color: '#475569' }}>Escalates to Operations Head & Legal</Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                <Button
                  variant="contained"
                  onClick={() => {
                    showToast('Reminder Policy Settings Saved', 'success');
                  }}
                  sx={{ backgroundColor: '#04552B', '&:hover': { backgroundColor: '#034120' }, textTransform: 'none', fontWeight: 700 }}
                >
                  Save Reminder Policy
                </Button>
              </Box>
            </Paper>
          )}

          {/* Sub-Tab 3: Mail Templates Manager */}
          {configSubTab === 'templates' && (
            <Paper elevation={0} sx={{ border: '1px solid #E4EBE1', borderRadius: '12px', p: 3, bgcolor: '#FFFFFF' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#023020', mb: 1 }}>
                Email Notification Templates Editor
              </Typography>
              <Typography variant="body2" sx={{ color: '#667A6D', mb: 3 }}>
                Customize automated notification emails for all 12 renewal fields.
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#44584C', mb: 1 }}>
                    Select Template Event
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {Object.values(mailTemplates).map((tmpl) => (
                      <Button
                        key={tmpl.id}
                        variant={selectedTemplateKey === tmpl.id ? 'contained' : 'outlined'}
                        onClick={() => setSelectedTemplateKey(tmpl.id)}
                        sx={{
                          justifyContent: 'flex-start',
                          textAlign: 'left',
                          textTransform: 'none',
                          fontWeight: 600,
                          fontSize: 12.5,
                          p: 1.2,
                          backgroundColor: selectedTemplateKey === tmpl.id ? '#04552B' : '#FFFFFF',
                          borderColor: selectedTemplateKey === tmpl.id ? '#04552B' : '#E4EBE1',
                          color: selectedTemplateKey === tmpl.id ? '#FFFFFF' : '#334155',
                        }}
                      >
                        {tmpl.title}
                      </Button>
                    ))}
                  </Box>

                  <Box sx={{ mt: 3, p: 2, bgcolor: '#F8FAF7', borderRadius: '8px', border: '1px solid #E4EBE1' }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#023020', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Code2 size={15} /> Dynamic Placeholders
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {[
                        '{{item_service}}',
                        '{{description}}',
                        '{{category}}',
                        '{{department}}',
                        '{{branch_location}}',
                        '{{start_date}}',
                        '{{due_date}}',
                        '{{days_remaining}}',
                        '{{last_renewed_date}}',
                        '{{renewal_owner}}',
                        '{{remarks}}',
                      ].map((tag) => (
                        <Chip key={tag} label={tag} size="small" sx={{ fontSize: 10, fontFamily: 'monospace', bgcolor: '#EAF6E8', color: '#04552B' }} />
                      ))}
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} md={8}>
                  {mailTemplates[selectedTemplateKey] && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        label="Email Subject Line"
                        fullWidth
                        size="small"
                        value={mailTemplates[selectedTemplateKey].subject}
                        onChange={(e) =>
                          setMailTemplates((prev) => ({
                            ...prev,
                            [selectedTemplateKey]: { ...prev[selectedTemplateKey], subject: e.target.value },
                          }))
                        }
                      />

                      <TextField
                        label="Email Body Content"
                        fullWidth
                        multiline
                        rows={10}
                        value={mailTemplates[selectedTemplateKey].body}
                        onChange={(e) =>
                          setMailTemplates((prev) => ({
                            ...prev,
                            [selectedTemplateKey]: { ...prev[selectedTemplateKey], body: e.target.value },
                          }))
                        }
                        sx={{ fontFamily: 'monospace', fontSize: 12.5 }}
                      />

                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
                        <Button
                          variant="outlined"
                          startIcon={<Send size={16} />}
                          onClick={() => handleOpenTriggerEmailDialog()}
                          sx={{
                            borderColor: '#04552B',
                            color: '#04552B',
                            '&:hover': { borderColor: '#034120', backgroundColor: '#F0FDF4' },
                            textTransform: 'none',
                            fontWeight: 700,
                          }}
                        >
                          Trigger Test Email
                        </Button>
                        <Button
                          variant="contained"
                          onClick={() => {
                            showToast('Email template saved successfully', 'success');
                          }}
                          sx={{ backgroundColor: '#04552B', '&:hover': { backgroundColor: '#034120' }, textTransform: 'none', fontWeight: 700 }}
                        >
                          Save Email Template
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Grid>
              </Grid>
            </Paper>
          )}

          {/* Sub-Tab 4: Compliance Rules & Setup */}
          {configSubTab === 'rules' && (
            <Paper elevation={0} sx={{ border: '1px solid #E4EBE1', borderRadius: '12px', p: 3, bgcolor: '#FFFFFF' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#023020', mb: 1 }}>
                Compliance Rules & System Setup
              </Typography>
              <Typography variant="body2" sx={{ color: '#667A6D', mb: 3 }}>
                Configure statutory validation rules and auto-calculation logic.
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <FormControlLabel
                      control={<Switch checked={requireOwner} onChange={(e) => setRequireOwner(e.target.checked)} color="success" />}
                      label={<Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#16231B' }}>Require Renewal Owner on Creation</Typography>}
                    />
                    <FormControlLabel
                      control={<Switch checked={autoCalcNextDue} onChange={(e) => setAutoCalcNextDue(e.target.checked)} color="success" />}
                      label={<Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#16231B' }}>Auto-calculate Next Renewal Due Date (+1 Year) on Mark Renewed</Typography>}
                    />
                  </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="Default Currency Symbol"
                    size="small"
                    value={currencySymbol}
                    onChange={(e) => setCurrencySymbol(e.target.value)}
                    sx={{ width: 180, mb: 2 }}
                  />

                  <Paper elevation={0} sx={{ p: 2, bgcolor: '#F8FAF7', border: '1px solid #E4EBE1', borderRadius: '8px' }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#023020', mb: 0.5 }}>
                      Auto-Calculated Days Remaining Active
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: '#667A6D' }}>
                      Days remaining are recalculated dynamically every midnight relative to system clock and Renewal Due Date.
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                <Button
                  variant="contained"
                  onClick={() => {
                    showToast('Compliance rules saved successfully', 'success');
                  }}
                  sx={{ backgroundColor: '#04552B', '&:hover': { backgroundColor: '#034120' }, textTransform: 'none', fontWeight: 700 }}
                >
                  Save Compliance Rules
                </Button>
              </Box>
            </Paper>
          )}
        </Box>
      )}

      {/* ── ITEM MODAL (ADD / EDIT ALL 12 REVAMPED FIELDS) ───────────────────────── */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#023020', borderBottom: '1px solid #E4EBE1' }}>
          {editingId ? 'Edit Renewal Item / Service' : 'New Renewal Item / Service'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, pb: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Section 1: Core Details */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#04552B', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 12 }}>
            1. Core Service & Organization Details
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={8}>
              <TextField
                label="Renewal Item / Service *"
                fullWidth
                required
                size="small"
                value={itemService}
                onChange={(e) => setItemService(e.target.value)}
                placeholder="e.g. Airtel IoT SIM Card P2 or Microsoft 365 Subscription"
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Renewal Category *</InputLabel>
                <Select value={category} label="Renewal Category *" onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((c) => (
                    <MenuItem key={c.id} value={c.name}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Vendor / Provider"
                fullWidth
                size="small"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g. Bharti Airtel, Microsoft, Lucas TVS, Tata Motors"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Plan / Package"
                fullWidth
                size="small"
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                placeholder="e.g. 50GB IoT SIM Plan, Enterprise E5, Comprehensive Insurance"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Department</InputLabel>
                <Select value={department} label="Department" onChange={(e) => setDepartment(e.target.value)}>
                  {departmentOptions.length === 0 ? (
                    <MenuItem value="" disabled>No Departments configured in Settings</MenuItem>
                  ) : (
                    departmentOptions.map((d) => (
                      <MenuItem key={d} value={d}>
                        {d}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Branch / Location</InputLabel>
                <Select value={branchLocation} label="Branch / Location" onChange={(e) => setBranchLocation(e.target.value)}>
                  {branchOptions.length === 0 ? (
                    <MenuItem value="" disabled>No Branches configured in Settings</MenuItem>
                  ) : (
                    branchOptions.map((b) => (
                      <MenuItem key={b} value={b}>
                        {b}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </Grid>


            <Grid item xs={12}>
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={2}
                size="small"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed coverage specs, policy scope, or terms summary..."
              />
            </Grid>
          </Grid>

          <Divider />

          {/* Section 2: Dates & Schedule */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#04552B', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 12 }}>
            2. Schedule, Validity & Auto-Calculations
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Start Date"
                type="date"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={3}>
              <TextField
                label="Renewal Due Date *"
                type="date"
                required
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={3}>
              <TextField
                label="Last Renewed Date"
                type="date"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                value={lastRenewedDate}
                onChange={(e) => setLastRenewedDate(e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Renewal Cycle</InputLabel>
                <Select value={renewalCycle} label="Renewal Cycle" onChange={(e) => setRenewalCycle(e.target.value)}>
                  <MenuItem value="Monthly">Monthly</MenuItem>
                  <MenuItem value="Quarterly">Quarterly</MenuItem>
                  <MenuItem value="Half-Yearly">Half-Yearly</MenuItem>
                  <MenuItem value="Yearly">Yearly</MenuItem>
                  <MenuItem value="Multi-Year">Multi-Year</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Reminder Lead Time (Days)"
                type="number"
                fullWidth
                size="small"
                value={reminderDays}
                onChange={(e) => setReminderDays(Number(e.target.value))}
                helperText="Send advance reminder alert X days before Renewal Due Date"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              {/* Days Remaining Auto-calculated Box Preview */}
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  bgcolor: '#F8FAF7',
                  border: '1px solid #E4EBE1',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  height: '100%',
                }}
              >
                <Box>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#44584C', textTransform: 'uppercase' }}>
                    Days Remaining (Auto-calculated)
                  </Typography>
                  <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#023020', mt: 0.2 }}>
                    {dueDate ? `${getDaysRemaining(dueDate)} Days` : 'Select Due Date'}
                  </Typography>
                </Box>
                {dueDate && renderDaysRemainingChip(dueDate)}
              </Paper>
            </Grid>
          </Grid>

          <Divider />

          {/* Section 3: Ownership & Commercials */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#04552B', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 12 }}>
            3. Ownership, Commercials & Remarks
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Renewal Owner</InputLabel>
                <Select
                  value={renewalOwner}
                  label="Renewal Owner"
                  onChange={(e) => setRenewalOwner(e.target.value)}
                >
                  {renewalOwner && !ownerOptions.includes(renewalOwner) && (
                    <MenuItem value={renewalOwner}>{renewalOwner}</MenuItem>
                  )}
                  {ownerOptions.length === 0 && !renewalOwner ? (
                    <MenuItem value="" disabled>No Users found in System</MenuItem>
                  ) : (
                    ownerOptions.map((u) => (
                      <MenuItem key={u} value={u}>
                        {u}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label={`Amount (${currencySymbol})`}
                type="number"
                fullWidth
                size="small"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : '';
                  setAmount(val);
                  setCost(val);
                }}
                placeholder="e.g. 15000"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Remarks / Notes"
                fullWidth
                multiline
                rows={2}
                size="small"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Vendor contacts, quotation status, approval notes..."
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
            onClick={handleSaveRenewal}
            sx={{ backgroundColor: '#04552B', '&:hover': { backgroundColor: '#034120' }, textTransform: 'none', fontWeight: 700 }}
          >
            Save Renewal Record
          </Button>
        </DialogActions>
      </Dialog>

      {/* Category Modal (Add / Edit Category) */}
      <Dialog open={catModalOpen} onClose={() => setCatModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#023020' }}>
          {editingCatId ? 'Edit Renewal Category' : 'New Renewal Category'}
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Category Name"
            fullWidth
            size="small"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="e.g. Software License"
          />

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                label="Color Hex"
                fullWidth
                size="small"
                value={catColor}
                onChange={(e) => setCatColor(e.target.value)}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Validity (Months)"
                type="number"
                fullWidth
                size="small"
                value={catValidityMonths}
                onChange={(e) => setCatValidityMonths(Number(e.target.value))}
              />
            </Grid>
          </Grid>

          <TextField
            label="Default Reminder Lead Time (Days)"
            type="number"
            fullWidth
            size="small"
            value={catReminderDays}
            onChange={(e) => setCatReminderDays(Number(e.target.value))}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCatModalOpen(false)} sx={{ textTransform: 'none', color: '#7A8B80' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveCategory}
            sx={{ backgroundColor: '#04552B', '&:hover': { backgroundColor: '#034120' }, textTransform: 'none', fontWeight: 700 }}
          >
            Save Category
          </Button>
        </DialogActions>
      </Dialog>
      {/* Quick Add Branch Modal */}
      <Dialog open={quickBranchModalOpen} onClose={() => setQuickBranchModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#023020', borderBottom: '1px solid #E4EBE1', display: 'flex', alignItems: 'center', gap: 1 }}>
          <MapPin size={20} color="#04552B" />
          Add New Branch & Shift Timing
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, pb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" sx={{ color: '#667A6D' }}>
            Enter branch details. This branch will automatically link across Renewal Tracker, Employee Master, and Settings.
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Branch Name *"
                fullWidth
                size="small"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="e.g. Headquarters / Chennai Hub"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Shift Name"
                fullWidth
                size="small"
                value={newBranchShiftName}
                onChange={(e) => setNewBranchShiftName(e.target.value)}
                placeholder="e.g. General Day Shift"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Street Address *"
                fullWidth
                size="small"
                value={newBranchAddress}
                onChange={(e) => setNewBranchAddress(e.target.value)}
                placeholder="Building name, street address..."
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="City"
                fullWidth
                size="small"
                value={newBranchCity}
                onChange={(e) => setNewBranchCity(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="State"
                fullWidth
                size="small"
                value={newBranchState}
                onChange={(e) => setNewBranchState(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Pincode"
                fullWidth
                size="small"
                value={newBranchPincode}
                onChange={(e) => setNewBranchPincode(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Shift Start Time"
                fullWidth
                size="small"
                value={newBranchShiftStart}
                onChange={(e) => setNewBranchShiftStart(e.target.value)}
                placeholder="09:00 AM"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Shift End Time"
                fullWidth
                size="small"
                value={newBranchShiftEnd}
                onChange={(e) => setNewBranchShiftEnd(e.target.value)}
                placeholder="06:00 PM"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Working Days"
                fullWidth
                size="small"
                value={newBranchWorkingDays}
                onChange={(e) => setNewBranchWorkingDays(e.target.value)}
                placeholder="Mon - Sat (6 Days)"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #E4EBE1' }}>
          <Button onClick={() => setQuickBranchModalOpen(false)} sx={{ textTransform: 'none', color: '#7A8B80' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveQuickBranch}
            sx={{ backgroundColor: '#04552B', '&:hover': { backgroundColor: '#034120' }, textTransform: 'none', fontWeight: 700 }}
          >
            Save & Link Branch
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── TRIGGER TEST MAIL DIALOG ────────────────────────────────────────── */}
      <Dialog open={testMailDialogOpen} onClose={() => setTestMailDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#023020', borderBottom: '1px solid #E4EBE1', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Send size={18} color="#04552B" /> Trigger Email Notification to Item Owner
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" sx={{ color: '#475569', mt: 1 }}>
            Send notification email for template: <strong>{mailTemplates[selectedTemplateKey]?.title}</strong>
          </Typography>

          <FormControl fullWidth size="small">
            <InputLabel sx={{ fontSize: 13 }}>Target Renewal Item / Owner</InputLabel>
            <Select
              value={selectedTestItemId}
              label="Target Renewal Item / Owner"
              onChange={(e) => handleSelectTestItemChange(e.target.value)}
              sx={{ fontSize: 13 }}
            >
              <MenuItem value="sample">Sample Demo Item (Default Preview)</MenuItem>
              {renewals.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.item_service} — Owner: {item.renewal_owner || 'Unassigned'} ({resolveOwnerEmail(item.renewal_owner)})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Sender Display Name (Module Name) *"
                fullWidth
                size="small"
                value={testSenderName}
                onChange={(e) => setTestSenderName(e.target.value)}
                placeholder="e.g. Renewal Reminder"
                helperText="Displays as sender name in recipient's inbox."
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Recipient Email Address (Item Owner) *"
                type="email"
                fullWidth
                size="small"
                value={testRecipientEmail}
                onChange={(e) => setTestRecipientEmail(e.target.value)}
                placeholder="e.g. owner@domain.com"
                helperText={selectedTestItemObj ? `Owner: ${selectedTestItemObj.renewal_owner || 'Unassigned'}` : 'Target recipient email.'}
              />
            </Grid>
          </Grid>

          <Box sx={{ p: 2, bgcolor: '#F8FAF7', borderRadius: '8px', border: '1px solid #E4EBE1' }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#023020', mb: 0.5 }}>
              Subject Line Preview:
            </Typography>
            <Typography sx={{ fontSize: 12.5, fontFamily: 'monospace', color: '#04552B', mb: 1.5, p: 1, bgcolor: '#FFFFFF', borderRadius: '4px', border: '1px solid #CBD5E1', fontWeight: 600 }}>
              {renderTemplateText(mailTemplates[selectedTemplateKey]?.subject || '', selectedTestItemObj)}
            </Typography>

            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#023020', mb: 0.5 }}>
              Rendered Body Preview:
            </Typography>
            <Typography sx={{ fontSize: 11.5, fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#334155', p: 1.5, bgcolor: '#FFFFFF', borderRadius: '4px', border: '1px solid #CBD5E1', maxHeight: 180, overflowY: 'auto' }}>
              {renderTemplateText(mailTemplates[selectedTemplateKey]?.body || '', selectedTestItemObj)}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #E4EBE1' }}>
          <Button onClick={() => setTestMailDialogOpen(false)} sx={{ textTransform: 'none', color: '#64748B' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={isSendingTestEmail}
            onClick={handleSendTestEmailNotification}
            startIcon={isSendingTestEmail ? <CircularProgress size={16} color="inherit" /> : <Send size={16} />}
            sx={{ backgroundColor: '#04552B', '&:hover': { backgroundColor: '#034120' }, textTransform: 'none', fontWeight: 700 }}
          >
            {isSendingTestEmail ? 'Sending Email...' : 'Trigger & Send Email'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
