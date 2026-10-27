import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';

import { ToastProvider } from '@/components/ui/ToastHost';
import AppLayout from '@/components/layout/AppLayout';
import RequireAuth from '@/auth/RequireAuth';

import { AuthPermissionProvider, usePermission } from '@/context/AuthPermissionContext';
import { useLocation } from 'react-router-dom';
import AccessDeniedPage from '@/pages/AccessDeniedPage';

import LoginPage from '@/pages/LoginPage';
import LeadsPage from '@/pages/LeadsPage';
import LeadDetailPage from '@/pages/LeadDetailPage';
import HRPage from '@/pages/HRPage';
import EmployeeOnboardingPage from '@/pages/EmployeeOnboardingPage';
import PlmPage from '@/pages/PlmPage';
import ProjectsPage from '@/pages/ProjectsPage';
import ProjectWorkspace from '@/pages/ProjectWorkspace';
import ProjectConfigurationPage from '@/pages/ProjectConfigurationPage';
import TasksPage from '@/pages/TasksPage';
import MyTasksPage from '@/pages/MyTasksPage';
import RenewalTrackerPage from '@/pages/RenewalTrackerPage';
import VehicleServicePage from '@/pages/VehicleServicePage';
import RequirementsPage from '@/pages/RequirementsPage';
import PolicyCompliancePage from '@/pages/PolicyCompliancePage';
import GenericStagePage from '@/pages/GenericStagePage';
import ReportsPage from '@/pages/ReportsPage';
import NotificationsPage from '@/pages/NotificationsPage';
import SettingsPage from '@/pages/SettingsPage';
import ConfigurationPage from '@/pages/ConfigurationPage';
import DashboardPage from '@/features/dashboard/DashboardPage';
import PublicFinancierDocumentView from '@/pages/PublicFinancierDocumentView';
import VehicleServiceRegisterPage from '@/pages/VehicleServiceRegisterPage';

// Admin RBAC Pages
const UserManagementPage = lazy(() => import('@/pages/admin/UserManagementPage'));
const RoleManagementPage = lazy(() => import('@/pages/admin/RoleManagementPage'));
const DepartmentManagementPage = lazy(() => import('@/pages/admin/DepartmentManagementPage'));
const PermissionRegistryPage = lazy(() => import('@/pages/admin/PermissionRegistryPage'));
const AccessAuditLogPage = lazy(() => import('@/pages/admin/AccessAuditLogPage'));

function RouteFallback() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
      <CircularProgress size={28} />
    </Box>
  );
}

function DefaultLandingRoute() {
  const { can, getFirstAccessibleRoute, isLoading } = usePermission();

  if (isLoading) {
    return <RouteFallback />;
  }

  if (can('view', 'crm_dashboard')) {
    return <DashboardPage />;
  }

  const target = getFirstAccessibleRoute();
  if (target === '/') {
    return <DashboardPage />;
  }
  return <Navigate to={target} replace />;
}

function RequirePermission({ children }: { children: React.ReactNode }) {
  const { canAccessRoute, isLoading } = usePermission();
  const location = useLocation();

  if (isLoading) {
    return <RouteFallback />;
  }

  if (!canAccessRoute(location.pathname)) {
    return <AccessDeniedPage />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthPermissionProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/financier/documents-view/:token" element={<PublicFinancierDocumentView />} />
              <Route path="/vs/register" element={<VehicleServiceRegisterPage />} />
              <Route path="/vs/register/:qrToken" element={<VehicleServiceRegisterPage />} />
              <Route
                element={
                  <RequireAuth>
                    <RequirePermission>
                      <AppLayout />
                    </RequirePermission>
                  </RequireAuth>
                }
              >
                <Route path="/" element={<DefaultLandingRoute />} />
                <Route path="/leads" element={<LeadsPage />} />
                <Route path="/leads/:id" element={<LeadDetailPage />} />
                <Route path="/opportunities" element={<LeadsPage />} />
                <Route path="/opportunities/:id" element={<LeadDetailPage />} />
                <Route path="/customers" element={<LeadsPage />} />
                <Route path="/customers/:id" element={<LeadDetailPage />} />
                <Route path="/activities" element={<LeadsPage />} />
                <Route path="/hr/onboarding/new" element={<EmployeeOnboardingPage />} />
                <Route path="/hr" element={<HRPage />} />
                <Route path="/hr/*" element={<HRPage />} />
                <Route path="/plm" element={<PlmPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/projects/configuration" element={<ProjectConfigurationPage />} />
                <Route path="/projects/:id" element={<ProjectWorkspace />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/my-tasks" element={<MyTasksPage />} />
                
                {/* Renewal Tracker */}
                <Route path="/renewal" element={<Navigate to="/renewal/tracker" replace />} />
                
                {/* Vehicle Service */}
                <Route path="/vehicle-service" element={<VehicleServicePage />} />
                <Route path="/vehicle-service/work-orders" element={<VehicleServicePage />} />
                <Route path="/vehicle-service/service-history" element={<VehicleServicePage />} />
                <Route path="/vehicle-service/reports" element={<VehicleServicePage />} />
                <Route path="/vehicle-service/configuration" element={<VehicleServicePage />} />
                <Route path="/renewal/dashboard" element={<Navigate to="/renewal/tracker" replace />} />
                <Route path="/renewal/tracker" element={<RenewalTrackerPage />} />
                <Route path="/renewal/reports" element={<RenewalTrackerPage />} />
                <Route path="/renewal/configuration" element={<RenewalTrackerPage />} />
                
                {/* Requirements Management */}
                <Route path="/requirements" element={<Navigate to="/requirements/material" replace />} />
                <Route path="/requirements/material" element={<RequirementsPage />} />
                <Route path="/requirements/it" element={<RequirementsPage />} />
                
                {/* KIM - Policy & Compliance */}
                <Route path="/compliance" element={<Navigate to="/compliance/policies" replace />} />
                <Route path="/compliance/policies" element={<PolicyCompliancePage />} />
                <Route path="/compliance/audit" element={<PolicyCompliancePage />} />
                <Route path="/compliance/sops" element={<PolicyCompliancePage />} />
                <Route path="/compliance/acknowledgements" element={<PolicyCompliancePage />} />
                
                {/* Administration / Access Control */}
                <Route path="/admin/users" element={<UserManagementPage />} />
                <Route path="/admin/roles" element={<RoleManagementPage />} />
                <Route path="/admin/departments" element={<DepartmentManagementPage />} />
                <Route path="/admin/permissions" element={<PermissionRegistryPage />} />
                <Route path="/admin/audit-logs" element={<AccessAuditLogPage />} />

                <Route path="/documents" element={<GenericStagePage section="documents" />} />
                <Route path="/verification" element={<GenericStagePage section="verification" />} />
                <Route path="/finance" element={<GenericStagePage section="finance" />} />
                <Route path="/sanction" element={<GenericStagePage section="sanction" />} />
                <Route path="/delivery" element={<GenericStagePage section="delivery" />} />
                <Route path="/disbursement" element={<GenericStagePage section="disbursement" />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/configuration" element={<ConfigurationPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </AuthPermissionProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
