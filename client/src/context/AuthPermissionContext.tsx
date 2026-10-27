import React, { createContext, useContext, useMemo } from 'react';
import { useAppSelector } from '../app/hooks';
import { useGetUserEffectivePermissionsQuery } from '../api/rbacApi';

interface AuthPermissionContextType {
  can: (action: string, resource: string) => boolean;
  canAccessRoute: (path: string) => boolean;
  getFirstAccessibleRoute: () => string;
  isSuperAdmin: boolean;
  effectivePermissionsMap: Record<string, boolean>;
  isLoading: boolean;
}

const AuthPermissionContext = createContext<AuthPermissionContextType>({
  can: () => false,
  canAccessRoute: () => false,
  getFirstAccessibleRoute: () => '/login',
  isSuperAdmin: false,
  effectivePermissionsMap: {},
  isLoading: true,
});

export const AuthPermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAppSelector((state) => state.auth.user);
  const userId = user?.id;

  const { data: effectiveData, isLoading } = useGetUserEffectivePermissionsQuery(userId ?? 0, {
    skip: !userId,
    pollingInterval: 10000,
    refetchOnMountOrArgChange: true,
  });

  const isSuperAdmin = useMemo(() => {
    if (!user) return false;
    // Only true super_admin role gets universal wildcard bypass
    if (effectiveData?.roles?.some((r) => r.toLowerCase() === 'super admin' || r.toLowerCase() === 'super_admin')) return true;
    return false;
  }, [user, effectiveData]);

  const { effectivePermissionsMap, modulePermissionsMap } = useMemo(() => {
    if (!effectiveData?.permissions) return { effectivePermissionsMap: {}, modulePermissionsMap: {} };
    const map: Record<string, boolean> = {};
    const modMap: Record<string, boolean> = {};
    for (const p of effectiveData.permissions) {
      if (p.permission_code) {
        map[p.permission_code] = p.granted;
      }
      if (p.resource_code && p.action_code) {
        map[`${p.resource_code}:${p.action_code}`] = p.granted;
      }
      if (p.module_code && p.resource_code && p.action_code) {
        map[`${p.module_code}:${p.resource_code}:${p.action_code}`] = p.granted;
      }
      if (p.module_code && p.granted && p.action_code === 'view') {
        modMap[p.module_code] = true;
      }
    }
    return { effectivePermissionsMap: map, modulePermissionsMap: modMap };
  }, [effectiveData]);

  const can = (action: string, resource: string): boolean => {
    if (!user) return false;
    if (isSuperAdmin) return true;

    // Handle full canonical string passed into action or resource parameter
    if (resource.includes(':')) {
      const parts = resource.split(':');
      if (parts.length === 3) {
        const canonicalKey = `${parts[0]}:${parts[1]}:${parts[2]}`;
        if (canonicalKey in effectivePermissionsMap) return effectivePermissionsMap[canonicalKey];
      }
    }

    const key = `${resource}:${action}`;
    if (key in effectivePermissionsMap) {
      return effectivePermissionsMap[key];
    }
    const altKey = `${action}:${resource}`;
    if (altKey in effectivePermissionsMap) {
      return effectivePermissionsMap[altKey];
    }
    if (resource in effectivePermissionsMap) {
      return effectivePermissionsMap[resource];
    }
    // Module-level access check
    if (action === 'view' && resource in modulePermissionsMap) {
      return modulePermissionsMap[resource];
    }
    return false;
  };

  const canAccessRoute = (path: string): boolean => {
    if (!user) return false;
    if (isSuperAdmin) return true;
    if (path === '/') return getFirstAccessibleRoute() !== '/login';

    if (path === '/plm') return can('view', 'plm');
    if (path.startsWith('/leads')) return can('view', 'leads');
    if (path.startsWith('/customers')) return can('view', 'customers');
    if (path.startsWith('/opportunities')) return can('view', 'opportunities');
    if (path.startsWith('/activities')) return can('view', 'activities');
    if (path === '/configuration') return can('view', 'crm_configuration');
    
    if (path.startsWith('/projects/configuration')) return can('view', 'project_configuration');
    if (path.startsWith('/projects')) return can('view', 'projects');
    if (path.startsWith('/my-tasks')) return can('view', 'my_tasks') || can('view', 'tasks');
    if (path.startsWith('/tasks')) return can('view', 'tasks');

    if (path.startsWith('/vehicle-service')) {
      if (path === '/vehicle-service') return can('view', 'vs_dashboard') || can('view', 'vehicle_service');
      if (path === '/vehicle-service/work-orders') return can('view', 'vs_work_orders') || can('view', 'vehicle_service');
      if (path === '/vehicle-service/service-history') return can('view', 'vs_service_history') || can('view', 'vehicle_service');
      if (path === '/vehicle-service/reports') return can('view', 'vs_reports') || can('view', 'vehicle_service');
      if (path === '/vehicle-service/configuration') return can('view', 'vs_configuration') || can('view', 'vehicle_service');
      return can('view', 'vs_dashboard') || can('view', 'vehicle_service');
    }

    if (path.startsWith('/hr')) {
      if (path === '/hr/recruitment') return can('view', 'hr_recruitment');
      if (path === '/hr/onboarding') return can('view', 'hr_onboarding');
      if (path === '/hr/master') return can('view', 'hr_master');
      if (path === '/hr/attendance') return can('view', 'hr_attendance');
      if (path === '/hr/leave') return can('view', 'hr_leave');
      if (path === '/hr/payroll') return can('view', 'hr_payroll');
      if (path === '/hr/self-service') return can('view', 'hr_self_service');
      if (path === '/hr/reports') return can('view', 'hr_reports');
      if (path === '/hr/configuration') return can('view', 'hr_configuration');
      return can('view', 'hr_master') || can('view', 'hr_recruitment') || can('view', 'hr_onboarding');
    }

    if (path.startsWith('/renewal')) {
      if (path === '/renewal/dashboard' || path === '/renewal') return can('view', 'renewal_dashboard');
      if (path === '/renewal/tracker') return can('view', 'renewal_tracker');
      if (path === '/renewal/reports') return can('view', 'renewal_reports');
      if (path === '/renewal/configuration') return can('view', 'renewal_configuration');
      return can('view', 'renewal_tracker');
    }

    if (path.startsWith('/requirements')) {
      if (path === '/requirements/material') return can('view', 'req_material');
      if (path === '/requirements/it') return can('view', 'req_it');
      return can('view', 'req_material') || can('view', 'req_it');
    }

    if (path.startsWith('/compliance')) {
      if (path === '/compliance/policies') return can('view', 'compliance_policies');
      if (path === '/compliance/audit') return can('view', 'compliance_audit');
      if (path === '/compliance/sops') return can('view', 'compliance_sops');
      if (path === '/compliance/acknowledgements') return can('view', 'compliance_acknowledgements');
      return can('view', 'compliance_policies');
    }

    if (path.startsWith('/admin')) {
      if (path.startsWith('/admin/users')) return can('view', 'users');
      if (path.startsWith('/admin/roles')) return can('view', 'roles');
      if (path.startsWith('/admin/departments')) return can('view', 'departments');
      if (path.startsWith('/admin/audit-logs')) return can('view', 'audit_logs');
      if (path.startsWith('/admin/permissions')) return can('view', 'permissions');
      return can('view', 'users') || can('view', 'roles');
    }

    if (path.startsWith('/reports')) return can('view', 'summary_reports') || can('view', 'crm_reports');
    if (path.startsWith('/notifications')) return can('view', 'notifications');
    if (path.startsWith('/settings')) return can('view', 'settings');

    if (['/documents', '/verification', '/finance', '/sanction', '/delivery', '/disbursement'].includes(path)) {
      return can('view', 'leads') || can('view', 'opportunities') || can('view', 'crm_dashboard');
    }

    // Dynamic framework fallback: match path segments against dynamic permissions matrix
    const segments = path.split('/').filter(Boolean);
    if (segments.length > 0) {
      const topSegment = segments[0];
      const subSegment = segments[1];

      if (subSegment) {
        const compositeKey = `${topSegment}_${subSegment}`;
        if (can('view', compositeKey)) return true;
        if (can('view', subSegment)) return true;
      }

      if (can('view', topSegment)) return true;
      if (can('view', topSegment.replace(/-/g, '_'))) return true;
    }

    return false;
  };

  const getFirstAccessibleRoute = (): string => {
    if (!user) return '/login';
    if (isSuperAdmin || can('view', 'crm_dashboard')) return '/';
    if (can('view', 'my_tasks')) return '/my-tasks';
    if (can('view', 'projects')) return '/projects';
    if (can('view', 'tasks')) return '/tasks';
    if (can('view', 'leads')) return '/leads';
    if (can('view', 'customers')) return '/customers';
    if (can('view', 'opportunities')) return '/opportunities';
    if (can('view', 'activities')) return '/activities';
    if (can('view', 'vs_dashboard') || can('view', 'vehicle_service')) return '/vehicle-service';
    if (can('view', 'hr_master') || can('view', 'hr_recruitment') || can('view', 'hr_leave') || can('view', 'hr_attendance')) return '/hr';
    if (can('view', 'renewal_tracker')) return '/renewal/tracker';
    if (can('view', 'req_material') || can('view', 'req_it')) return '/requirements/material';
    if (can('view', 'compliance_policies')) return '/compliance/policies';
    if (can('view', 'users') || can('view', 'roles')) return '/admin/users';

    // Dynamic framework fallback: first granted view resource
    if (effectiveData?.permissions) {
      for (const p of effectiveData.permissions) {
        if (p.granted && p.action_code === 'view' && p.resource_code) {
          return `/${p.resource_code.replace(/_/g, '-')}`;
        }
      }
    }

    if (can('view', 'notifications')) return '/notifications';
    if (can('view', 'settings')) return '/settings';
    return '/login';
  };

  return (
    <AuthPermissionContext.Provider
      value={{
        can,
        canAccessRoute,
        getFirstAccessibleRoute,
        isSuperAdmin,
        effectivePermissionsMap,
        isLoading,
      }}
    >
      {children}
    </AuthPermissionContext.Provider>
  );
};

export const usePermission = () => useContext(AuthPermissionContext);
