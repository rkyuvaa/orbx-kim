import { useState } from 'react';
import { Box, Paper, Tab, Tabs } from '@mui/material';
import {
  Mail,
  Database,
  Users as UsersIcon,
  Shield,
  Building2,
  KeyRound,
  ShieldAlert,
  MapPin,
  Hash,
} from 'lucide-react';

import { useAppSelector } from '@/app/hooks';
import { usePermission } from '@/context/AuthPermissionContext';
import MailServerConfigCard from '@/components/settings/MailServerConfigCard';
import SystemBackupCard from '@/components/settings/SystemBackupCard';
import DocumentNumberingTab from '@/components/settings/DocumentNumberingTab';
import UserManagementPage from '@/pages/admin/UserManagementPage';
import RoleManagementPage from '@/pages/admin/RoleManagementPage';
import DepartmentManagementPage from '@/pages/admin/DepartmentManagementPage';
import BranchManagementPage from '@/pages/admin/BranchManagementPage';
import PermissionRegistryPage from '@/pages/admin/PermissionRegistryPage';
import AccessAuditLogPage from '@/pages/admin/AccessAuditLogPage';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2.5 }}>{children}</Box>}
    </div>
  );
}

export default function SettingsPage() {
  const user = useAppSelector((state) => state.auth.user);
  const { can, isSuperAdmin } = usePermission();
  const [activeTab, setActiveTab] = useState(0);
  const [userRoleSubTab, setUserRoleSubTab] = useState(0);

  const canUsers = isSuperAdmin || can('view', 'users') || can('view', 'roles');
  const canDepts = isSuperAdmin || can('view', 'departments');
  const canBranches = isSuperAdmin || can('view', 'departments');
  const canBackup = isSuperAdmin;

  const tabs: { key: string; label: string; icon: React.ReactNode }[] = [];

  if (canUsers) {
    tabs.push({ key: 'users', label: 'Users & Roles', icon: <UsersIcon size={16} /> });
  }
  if (canDepts) {
    tabs.push({ key: 'depts', label: 'Departments', icon: <Building2 size={16} /> });
  }
  if (canBranches) {
    tabs.push({ key: 'branches', label: 'Branches', icon: <MapPin size={16} /> });
  }
  tabs.push({ key: 'numbering', label: 'Document Numbering', icon: <Hash size={16} /> });
  tabs.push({ key: 'mail', label: 'Mail Server (SMTP)', icon: <Mail size={16} /> });
  if (canBackup) {
    tabs.push({ key: 'backup', label: 'System Data Backup', icon: <Database size={16} /> });
  }

  const subtabs: { key: string; label: string; icon: React.ReactNode }[] = [];
  if (isSuperAdmin || can('view', 'users')) {
    subtabs.push({ key: 'users', label: 'Users Management', icon: <UsersIcon size={15} /> });
  }
  if (isSuperAdmin || can('view', 'roles')) {
    subtabs.push({ key: 'roles', label: 'Roles & Access', icon: <Shield size={15} /> });
  }
  if (isSuperAdmin || can('view', 'permissions')) {
    subtabs.push({ key: 'permissions', label: 'Permission Matrix', icon: <KeyRound size={15} /> });
  }
  if (isSuperAdmin || can('view', 'audit_logs')) {
    subtabs.push({ key: 'audit_logs', label: 'Access Audit Logs', icon: <ShieldAlert size={15} /> });
  }

  const currentTabKey = tabs[activeTab]?.key || 'mail';
  const currentSubTabKey = subtabs[userRoleSubTab]?.key || subtabs[0]?.key || 'users';

  return (
    <Box sx={{ width: '100%' }}>
      {/* ERP Style Navigation Tabs */}
      <Paper
        elevation={0}
        sx={{
          border: '1px solid #E4EBE1',
          borderRadius: '12px',
          backgroundColor: '#FFFFFF',
          px: 2,
          pt: 1,
          mb: 1,
        }}
      >
        <Tabs
          value={activeTab < tabs.length ? activeTab : 0}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 44,
            '& .MuiTab-root': {
              minHeight: 44,
              textTransform: 'none',
              fontWeight: 700,
              fontSize: 13.5,
              color: '#667A6D',
              mr: 1,
              px: 2,
              borderRadius: '8px 8px 0 0',
              '&.Mui-selected': {
                color: '#023020',
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#023020',
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
          }}
        >
          {tabs.map((t, idx) => (
            <Tab key={t.key} icon={t.icon as any} iconPosition="start" label={t.label} id={`settings-tab-${idx}`} />
          ))}
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      {tabs.map((t, idx) => (
        <CustomTabPanel key={t.key} value={activeTab} index={idx}>
          {t.key === 'users' && (
            <Paper elevation={0} sx={{ border: '1px solid #E4EBE1', borderRadius: '14px', p: 2, background: '#FFFFFF' }}>
              {subtabs.length > 1 && (
                <Tabs
                  value={userRoleSubTab < subtabs.length ? userRoleSubTab : 0}
                  onChange={(_, val) => setUserRoleSubTab(val)}
                  sx={{
                    borderBottom: 1,
                    borderColor: '#E4EBE1',
                    mb: 2,
                    '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, fontSize: 13 },
                  }}
                >
                  {subtabs.map((st) => (
                    <Tab key={st.key} icon={st.icon as any} iconPosition="start" label={st.label} />
                  ))}
                </Tabs>
              )}
              {currentSubTabKey === 'users' && <UserManagementPage />}
              {currentSubTabKey === 'roles' && <RoleManagementPage />}
              {currentSubTabKey === 'permissions' && <PermissionRegistryPage />}
              {currentSubTabKey === 'audit_logs' && <AccessAuditLogPage />}
            </Paper>
          )}

          {t.key === 'depts' && (
            <Paper elevation={0} sx={{ border: '1px solid #E4EBE1', borderRadius: '14px', p: 2, background: '#FFFFFF' }}>
              <DepartmentManagementPage />
            </Paper>
          )}

          {t.key === 'branches' && (
            <Paper elevation={0} sx={{ border: '1px solid #E4EBE1', borderRadius: '14px', p: 2, background: '#FFFFFF' }}>
              <BranchManagementPage />
            </Paper>
          )}

          {t.key === 'numbering' && <DocumentNumberingTab />}

          {t.key === 'mail' && <MailServerConfigCard />}

          {t.key === 'backup' && <SystemBackupCard />}
        </CustomTabPanel>
      ))}
    </Box>
  );
}
