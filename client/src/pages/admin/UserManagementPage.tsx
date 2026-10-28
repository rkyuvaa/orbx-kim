import { useState } from 'react';
import {
  Search,
  Plus,
  Shield,
  Edit2,
  Trash2,
  MoreVertical,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Menu, MenuItem, Divider } from '@mui/material';
import {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useGetRolesQuery,
  useGetDepartmentsQuery,
} from '../../api/rbacApi';
import type { UserDetail } from '../../types/rbac';
import EffectiveAccessModal from './EffectiveAccessModal';
import { formatDateTime, initialsOf } from '../../utils/format';

function getErrorMessage(err: any): string {
  if (!err) return 'An unexpected error occurred';
  if (typeof err?.data?.detail === 'string') return err.data.detail;
  if (Array.isArray(err?.data?.detail)) {
    return err.data.detail
      .map((e: any) => `${e.loc ? e.loc.filter((x: string) => x !== 'body').join('.') + ': ' : ''}${e.msg}`)
      .join('\n');
  }
  if (typeof err?.data?.message === 'string') return err.data.message;
  if (typeof err?.message === 'string') return err.message;
  return 'Failed to save user';
}

export default function UserManagementPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<number | undefined>();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [inspectUserId, setInspectUserId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ anchorEl: HTMLElement; user: UserDetail } | null>(null);

  const handleOpenMenu = (e: React.MouseEvent<HTMLElement>, user: UserDetail) => {
    e.stopPropagation();
    setMenuAnchor({ anchorEl: e.currentTarget, user });
  };

  const handleCloseMenu = () => {
    setMenuAnchor(null);
  };

  const handleOpenEdit = (u: UserDetail) => {
    setSelectedUser(u);
    const assignedRoleIds = u.assigned_roles?.map((r) => r.id) || [];
    const primaryRole = (u.assigned_roles as any)?.find((r: any) => r.is_primary) || u.assigned_roles?.[0];
    setEditForm({
      full_name: u.full_name,
      email: u.email,
      username: u.username || '',
      mobile: u.mobile || '',
      employee_id: u.employee_id || '',
      designation: u.designation || '',
      status: u.status,
      primary_role: primaryRole?.code || (typeof u.role === 'string' ? u.role : (u.role as any)?.value),
      primary_role_id: primaryRole?.id || assignedRoleIds[0],
      primary_department_id: u.primary_department_id || undefined,
      reporting_manager_id: u.reporting_manager_id || undefined,
      force_password_change: u.force_password_change || false,
      role_ids: assignedRoleIds,
      department_ids: u.departments?.map((d) => d.id) || [],
      password: '',
    });
    setShowResetPassword(false);
  };

  const handleToggleStatus = async (user: UserDetail) => {
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const actionLabel = nextStatus === 'INACTIVE' ? 'mark as inactive' : 'mark as active';
    if (confirm(`Are you sure you want to ${actionLabel} user ${user.full_name}?`)) {
      try {
        await updateUser({ id: user.id, data: { status: nextStatus } as any }).unwrap();
        refetch();
      } catch (err: any) {
        alert(getErrorMessage(err));
      }
    }
  };
  const [editTab, setEditTab] = useState<'profile' | 'account' | 'roles' | 'department' | 'permissions' | 'activity'>('profile');

  // API Queries
  const { data: usersData, isLoading, refetch } = useGetUsersQuery({
    page,
    page_size: pageSize,
    search: search || undefined,
    department_id: deptFilter,
    user_status: statusFilter || undefined,
  });

  const { data: rolesList } = useGetRolesQuery();
  const { data: deptsList } = useGetDepartmentsQuery();

  const [createUser] = useCreateUserMutation();
  const [updateUser] = useUpdateUserMutation();
  const [deleteUser] = useDeleteUserMutation();

  // Create Form State
  const [createForm, setCreateForm] = useState({
    full_name: '',
    email: '',
    password: '',
    designation: '',
    primary_role: undefined as string | undefined,
    primary_role_id: undefined as number | undefined,
    role_ids: [] as number[],
    department_ids: [] as number[],
    primary_department_id: undefined as number | undefined,
    reporting_manager_id: undefined as number | undefined,
    status: 'ACTIVE' as const,
    force_password_change: false,
  });

  // Edit Form State
  const [editForm, setEditForm] = useState<Partial<UserDetail> & { password?: string; role_ids?: number[]; department_ids?: number[]; primary_role?: string; primary_role_id?: number }>({});

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const primaryRoleObj = rolesList?.find((r) => r.id === createForm.primary_role_id) || rolesList?.find((r) => createForm.role_ids.includes(r.id));
      const payload = {
        ...createForm,
        full_name: createForm.full_name.trim(),
        email: createForm.email.trim(),
        username: createForm.email.trim().toLowerCase(),
        designation: createForm.designation.trim() || undefined,
        primary_role: primaryRoleObj?.code || primaryRoleObj?.name || undefined,
        department_ids: createForm.department_ids.filter((id) => Boolean(id) && !isNaN(id)),
        role_ids: createForm.role_ids.filter((id) => Boolean(id) && !isNaN(id)),
        primary_department_id: createForm.primary_department_id || undefined,
        reporting_manager_id: createForm.reporting_manager_id || undefined,
      };

      await createUser(payload as any).unwrap();
      setIsCreateOpen(false);
      setCreateForm({
        full_name: '',
        email: '',
        password: '',
        designation: '',
        primary_role: undefined,
        primary_role_id: undefined,
        role_ids: [],
        department_ids: [],
        primary_department_id: undefined,
        reporting_manager_id: undefined,
        status: 'ACTIVE',
        force_password_change: false,
      });
      refetch();
    } catch (err: any) {
      alert(getErrorMessage(err));
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const primaryRoleObj = rolesList?.find((r) => r.id === editForm.primary_role_id) || rolesList?.find((r) => editForm.role_ids?.includes(r.id));
      const payload: any = {
        full_name: editForm.full_name?.trim(),
        email: editForm.email?.trim(),
        username: editForm.username?.trim() || undefined,
        mobile: editForm.mobile?.trim() || undefined,
        employee_id: editForm.employee_id?.trim() || undefined,
        designation: editForm.designation?.trim() || undefined,
        status: editForm.status,
        primary_role: primaryRoleObj?.code || primaryRoleObj?.name || undefined,
        primary_department_id: editForm.primary_department_id || undefined,
        reporting_manager_id: editForm.reporting_manager_id || undefined,
        force_password_change: editForm.force_password_change ?? false,
        department_ids: editForm.department_ids?.filter((id) => Boolean(id) && !isNaN(id)),
        role_ids: editForm.role_ids?.filter((id) => Boolean(id) && !isNaN(id)),
      };

      if (editForm.password && editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }

      await updateUser({ id: selectedUser.id, data: payload }).unwrap();
      setSelectedUser(null);
      refetch();
    } catch (err: any) {
      alert(getErrorMessage(err));
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (confirm(`Are you sure you want to delete user ${name}? This action cannot be undone.`)) {
      try {
        await deleteUser(id).unwrap();
        refetch();
      } catch (err: any) {
        alert(err?.data?.detail || 'Failed to delete user');
      }
    }
  };

  return (
    <div style={{ padding: '16px 0', width: '100%' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#023020', margin: 0, letterSpacing: -0.3 }}>
            User Management
          </h1>
          <p style={{ fontSize: 13, color: '#7A8B80', margin: '4px 0 0' }}>
            Manage organization users, credentials, role assignments, and department mappings.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            background: '#16C47F',
            color: '#FFFFFF',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 13.5,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(8, 122, 61, 0.25)',
          }}
        >
          <Plus size={18} /> Create New User
        </button>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          background: '#FFFFFF',
          padding: 16,
          borderRadius: 12,
          border: '1px solid #E4EBE1',
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search size={16} color="#7A8B80" style={{ position: 'absolute', left: 12, top: 11 }} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: 8,
              border: '1px solid #D8E2D5',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>

        <select
          value={deptFilter || ''}
          onChange={(e) => { setDeptFilter(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13, color: '#44584C' }}
        >
          <option value="">All Departments</option>
          {deptsList?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13, color: '#44584C' }}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="LOCKED">Locked</option>
        </select>
      </div>

      {/* Users Data Table */}
      <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E4EBE1', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#F8FAF8', borderBottom: '1px solid #E4EBE1', color: '#44584C', fontWeight: 700 }}>
              <th style={{ padding: '12px 16px' }}>User</th>
              <th style={{ padding: '12px 16px' }}>Department</th>
              <th style={{ padding: '12px 16px' }}>Designation</th>
              <th style={{ padding: '12px 16px' }}>Roles</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Last Login</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#7A8B80' }}>
                  Loading users...
                </td>
              </tr>
            ) : !usersData?.items || usersData.items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#7A8B80' }}>
                  No users found matching filter criteria.
                </td>
              </tr>
            ) : (
              usersData.items.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #F0F4F0' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          background: '#16C47F',
                          color: '#FFF',
                          fontWeight: 700,
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {initialsOf(u.full_name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#023020' }}>{u.full_name}</div>
                        <div style={{ fontSize: 11, color: '#7A8B80' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  
                  <td style={{ padding: '12px 16px', color: '#04552B', fontWeight: 600 }}>{u.primary_department_name || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#44584C' }}>{u.designation || '-'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                      {u.assigned_roles && u.assigned_roles.length > 0 ? (
                        u.assigned_roles.map((r, idx) => (
                          <span
                            key={r.id}
                            style={{
                              padding: '3px 9px',
                              background: idx === 0 ? '#EAF6E8' : '#F0F4F8',
                              color: idx === 0 ? '#04552B' : '#334155',
                              border: idx === 0 ? '1px solid #A3E635' : '1px solid #CBD5E1',
                              borderRadius: 14,
                              fontSize: 11,
                              fontWeight: idx === 0 ? 700 : 500,
                            }}
                          >
                            {r.name}
                            {idx === 0 && <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.8 }}>★</span>}
                          </span>
                        ))
                      ) : (
                        <span style={{ padding: '3px 9px', background: '#EAF6E8', color: '#04552B', borderRadius: 14, fontSize: 11, fontWeight: 700 }}>
                          {u.role}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '3px 9px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        background: u.status === 'ACTIVE' ? '#DCFCE7' : u.status === 'LOCKED' ? '#FEF3C7' : '#F3F4F6',
                        color: u.status === 'ACTIVE' ? '#15803D' : u.status === 'LOCKED' ? '#B45309' : '#4B5563',
                      }}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#7A8B80' }}>
                    {u.last_login_at ? formatDateTime(u.last_login_at) : 'Never'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <button
                        title="Actions"
                        onClick={(e) => handleOpenMenu(e, u)}
                        style={{
                          padding: 6,
                          borderRadius: 6,
                          border: '1px solid #D8E2D5',
                          background: '#FFF',
                          cursor: 'pointer',
                          color: '#44584C',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#F0FDF4'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#FFF'; }}
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {usersData && usersData.total > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginTop: 16,
            padding: '12px 16px',
            background: '#FFFFFF',
            borderRadius: 10,
            border: '1px solid #E4EBE1',
            fontSize: 13,
            color: '#44584C',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>
              Showing <strong>{((page - 1) * pageSize) + 1}</strong>–
              <strong>{Math.min(page * pageSize, usersData.total)}</strong> of{' '}
              <strong>{usersData.total}</strong> users
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#7A8B80' }}>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid #D8E2D5',
                  fontSize: 12,
                  color: '#44584C',
                  background: '#FFF',
                  cursor: 'pointer',
                }}
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #D8E2D5',
                background: page <= 1 ? '#F9FAFB' : '#FFF',
                color: page <= 1 ? '#9CA3AF' : '#1F2937',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <ChevronLeft size={14} /> Previous
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {Array.from({ length: usersData.pages || 1 }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === usersData.pages || Math.abs(p - page) <= 2)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev && p - prev > 1;
                  return (
                    <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {showEllipsis && <span style={{ padding: '0 4px', color: '#9CA3AF' }}>...</span>}
                      <button
                        type="button"
                        onClick={() => setPage(p)}
                        style={{
                          minWidth: 32,
                          height: 32,
                          padding: '0 6px',
                          borderRadius: 6,
                          border: p === page ? '1px solid #16C47F' : '1px solid #D8E2D5',
                          background: p === page ? '#16C47F' : '#FFF',
                          color: p === page ? '#FFF' : '#44584C',
                          fontWeight: p === page ? 700 : 500,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        {p}
                      </button>
                    </span>
                  );
                })}
            </div>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(usersData.pages || 1, p + 1))}
              disabled={page >= (usersData.pages || 1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #D8E2D5',
                background: page >= (usersData.pages || 1) ? '#F9FAFB' : '#FFF',
                color: page >= (usersData.pages || 1) ? '#9CA3AF' : '#1F2937',
                cursor: page >= (usersData.pages || 1) ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 3-Dot Actions Menu */}
      <Menu
        anchorEl={menuAnchor?.anchorEl}
        open={Boolean(menuAnchor)}
        onClose={handleCloseMenu}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          elevation: 4,
          sx: {
            borderRadius: '10px',
            minWidth: 220,
            py: 0.5,
            border: '1px solid #E5E7EB',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          },
        }}
      >
        <MenuItem
          onClick={() => {
            if (menuAnchor) handleOpenEdit(menuAnchor.user);
            handleCloseMenu();
          }}
          sx={{ fontSize: 13, gap: 1.5, py: 1 }}
        >
          <Edit2 size={15} color="#0369A1" />
          <span>Edit</span>
        </MenuItem>

        <MenuItem
          onClick={() => {
            if (menuAnchor) setInspectUserId(menuAnchor.user.id);
            handleCloseMenu();
          }}
          sx={{ fontSize: 13, gap: 1.5, py: 1 }}
        >
          <Shield size={15} color="#16C47F" />
          <span>Effective Access Inspection</span>
        </MenuItem>

        <MenuItem
          onClick={() => {
            if (menuAnchor) handleToggleStatus(menuAnchor.user);
            handleCloseMenu();
          }}
          sx={{ fontSize: 13, gap: 1.5, py: 1 }}
        >
          {menuAnchor?.user.status === 'ACTIVE' ? (
            <>
              <UserX size={15} color="#D97706" />
              <span>Inactive</span>
            </>
          ) : (
            <>
              <UserCheck size={15} color="#059669" />
              <span>Active</span>
            </>
          )}
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        <MenuItem
          onClick={() => {
            if (menuAnchor) handleDelete(menuAnchor.user.id, menuAnchor.user.full_name);
            handleCloseMenu();
          }}
          sx={{ fontSize: 13, gap: 1.5, py: 1, color: '#DC2626' }}
        >
          <Trash2 size={15} color="#DC2626" />
          <span>Delete</span>
        </MenuItem>
      </Menu>

      {/* Effective Access Inspector Modal */}
      {inspectUserId && (
        <EffectiveAccessModal
          userId={inspectUserId}
          userName={usersData?.items?.find((u) => u.id === inspectUserId)?.full_name || 'User'}
          onClose={() => setInspectUserId(null)}
        />
      )}

      {/* Create User Drawer Modal */}
      {isCreateOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '100%', maxWidth: 540, background: '#FFF', height: '100vh', overflowY: 'auto', padding: 24, boxShadow: '-4px 0 20px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 800, color: '#023020' }}>Create New User</h2>
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#44584C' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#44584C' }}>Email Address *</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#44584C' }}>Password *</label>
                <input
                  type="password"
                  required
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#44584C' }}>Primary Role</label>
                <select
                  value={createForm.primary_role_id || ''}
                  onChange={(e) => {
                    const rId = Number(e.target.value);
                    setCreateForm({
                      ...createForm,
                      primary_role_id: rId || undefined,
                      role_ids: rId ? [rId] : [],
                    });
                  }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13 }}
                >
                  <option value="">Select Role</option>
                  {rolesList?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#44584C' }}>Department</label>
                <select
                  onChange={(e) => setCreateForm({ ...createForm, department_ids: [Number(e.target.value)], primary_department_id: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13 }}
                >
                  <option value="">Select Department</option>
                  {deptsList?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button type="button" onClick={() => setIsCreateOpen(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #D8E2D5', background: '#FFF' }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: '8px 20px', borderRadius: 8, background: '#16C47F', color: '#FFF', fontWeight: 700, border: 'none' }}>
                  Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User 6-Tab Drawer Modal */}
      {selectedUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '100%', maxWidth: 650, background: '#FFF', height: '100vh', overflowY: 'auto', padding: 24, boxShadow: '-4px 0 20px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#023020' }}>Edit User: {selectedUser.full_name}</h2>
                <div style={{ fontSize: 12, color: '#7A8B80' }}>ID: {selectedUser.id} | {selectedUser.email}</div>
              </div>
              <button onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#7A8B80' }}>
                ✕
              </button>
            </div>

            {/* 6 Tabs Header */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E4EBE1', marginBottom: 20, gap: 4 }}>
              {(['profile', 'account', 'roles', 'department', 'permissions', 'activity'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setEditTab(tab)}
                  style={{
                    padding: '8px 14px',
                    border: 'none',
                    background: 'transparent',
                    borderBottom: editTab === tab ? '2px solid #16C47F' : 'none',
                    fontWeight: editTab === tab ? 700 : 500,
                    color: editTab === tab ? '#16C47F' : '#7A8B80',
                    fontSize: 13,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* TAB 1: PROFILE */}
              {editTab === 'profile' && (
                <>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#44584C' }}>Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editForm.full_name || ''}
                      onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#44584C' }}>Email Address *</label>
                    <input
                      type="email"
                      required
                      value={editForm.email || ''}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13 }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#44584C' }}>Designation</label>
                      <input
                        type="text"
                        value={editForm.designation || ''}
                        onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#44584C' }}>Reporting Manager</label>
                      <select
                        value={editForm.reporting_manager_id || ''}
                        onChange={(e) => setEditForm({ ...editForm, reporting_manager_id: e.target.value ? Number(e.target.value) : undefined })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13 }}
                      >
                        <option value="">None (Top Level)</option>
                        {usersData?.items
                          ?.filter((u) => u.id !== selectedUser.id)
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.full_name} ({u.role})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: ACCOUNT */}
              {editTab === 'account' && (
                <>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#44584C' }}>Account Status</label>
                    <select
                      value={editForm.status || 'ACTIVE'}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13 }}
                    >
                      <option value="ACTIVE">Active (Can Log In)</option>
                      <option value="INACTIVE">Inactive (Disabled)</option>
                      <option value="LOCKED">Locked (Failed Logins)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#44584C' }}>Reset Password (Leave blank to keep existing)</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type={showResetPassword ? 'text' : 'password'}
                        placeholder="Enter new password..."
                        value={editForm.password || ''}
                        onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                        style={{ width: '100%', padding: '8px 36px 8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword(!showResetPassword)}
                        style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#7A8B80', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        title={showResetPassword ? "Hide password" : "Show password"}
                      >
                        {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 6 }}>
                    <input
                      type="checkbox"
                      checked={editForm.force_password_change || false}
                      onChange={(e) => setEditForm({ ...editForm, force_password_change: e.target.checked })}
                    />
                    <span style={{ fontWeight: 600, color: '#023020' }}>Require password change on next login</span>
                  </label>

                  <div style={{ marginTop: 14, padding: 14, background: '#F8FAF8', borderRadius: 10, border: '1px solid #E4EBE1', fontSize: 12, color: '#44584C' }}>
                    <div style={{ fontWeight: 700, color: '#023020', marginBottom: 4 }}>Account Statistics</div>
                    <div>Last Login: {selectedUser.last_login_at ? formatDateTime(selectedUser.last_login_at) : 'Never'}</div>
                    <div>Account Created: {formatDateTime(selectedUser.created_at)}</div>
                    <div>Failed Login Attempts: {selectedUser.failed_login_attempts || 0}</div>
                  </div>
                </>
              )}

              {/* TAB 3: ROLES */}
              {editTab === 'roles' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#023020' }}>Assigned System Roles</div>
                      <div style={{ fontSize: 11, color: '#7A8B80' }}>Select dynamic roles for this user and designate one as Primary.</div>
                    </div>
                    {editForm.role_ids && editForm.role_ids.length > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#16C47F', background: '#EAF6E8', padding: '3px 10px', borderRadius: 12 }}>
                        {editForm.role_ids.length} Selected
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
                    {rolesList?.map((r) => {
                      const isChecked = editForm.role_ids?.includes(r.id);
                      const isPrimary = (editForm.primary_role_id === r.id) || (!editForm.primary_role_id && editForm.role_ids?.[0] === r.id);
                      return (
                        <div
                          key={r.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            background: isChecked ? '#F0FAF0' : '#F9FAFB',
                            border: `1.5px solid ${isChecked ? '#16C47F' : '#E5E7EB'}`,
                            borderRadius: 10,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1 }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const current = editForm.role_ids || [];
                                if (e.target.checked) {
                                  const next = [...current, r.id];
                                  setEditForm({
                                    ...editForm,
                                    role_ids: next,
                                    primary_role_id: editForm.primary_role_id || r.id,
                                  });
                                } else {
                                  const next = current.filter((id) => id !== r.id);
                                  setEditForm({
                                    ...editForm,
                                    role_ids: next,
                                    primary_role_id: editForm.primary_role_id === r.id ? (next[0] || undefined) : editForm.primary_role_id,
                                  });
                                }
                              }}
                              style={{ width: 17, height: 17, accentColor: '#16C47F', cursor: 'pointer' }}
                            />
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 700, color: '#023020', fontSize: 13.5 }}>{r.name}</span>
                                {r.is_system && (
                                  <span style={{ fontSize: 10, padding: '1px 6px', background: '#FEF3C7', color: '#B45309', borderRadius: 4, fontWeight: 700 }}>
                                    SYSTEM
                                  </span>
                                )}
                              </div>
                              <div style={{ color: '#7A8B80', fontSize: 11, marginTop: 2 }}>{r.description || r.code}</div>
                            </div>
                          </label>

                          {isChecked && (
                            <button
                              type="button"
                              onClick={() => setEditForm({ ...editForm, primary_role_id: r.id })}
                              style={{
                                padding: '4px 12px',
                                borderRadius: 20,
                                fontSize: 11,
                                fontWeight: 700,
                                border: isPrimary ? '1px solid #16C47F' : '1px solid #D8E2D5',
                                background: isPrimary ? '#16C47F' : '#FFFFFF',
                                color: isPrimary ? '#FFFFFF' : '#44584C',
                                cursor: 'pointer',
                              }}
                            >
                              {isPrimary ? '★ Primary Role' : 'Set as Primary'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 4: DEPARTMENT */}
              {editTab === 'department' && (
                <>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#44584C' }}>Primary Department</label>
                    <select
                      value={editForm.primary_department_id || editForm.department_ids?.[0] || ''}
                      onChange={(e) => {
                        const depId = Number(e.target.value);
                        setEditForm({ ...editForm, primary_department_id: depId, department_ids: [depId] });
                      }}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13 }}
                    >
                      <option value="">Select Department</option>
                      {deptsList?.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* TAB 5: PERMISSIONS */}
              {editTab === 'permissions' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#023020' }}>Effective Authorization Breakdown</h4>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#7A8B80' }}>Inspect combined role permissions and direct overrides.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspectUserId(selectedUser.id)}
                      style={{ padding: '8px 14px', background: '#16C47F', color: '#FFF', borderRadius: 8, fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Shield size={16} /> Open Inspector
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 6: ACTIVITY */}
              {editTab === 'activity' && (
                <div>
                  <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#023020' }}>Audit Event Activity Log</h4>
                  <div style={{ padding: 16, background: '#F8FAF8', borderRadius: 10, border: '1px solid #E4EBE1', fontSize: 12, color: '#44584C' }}>
                    <div>User Account Created: {formatDateTime(selectedUser.created_at)}</div>
                    <div>Last System Login: {selectedUser.last_login_at ? formatDateTime(selectedUser.last_login_at) : 'Never'}</div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button type="button" onClick={() => setSelectedUser(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #D8E2D5', background: '#FFF' }}>
                  Close
                </button>
                <button type="submit" style={{ padding: '8px 20px', borderRadius: 8, background: '#16C47F', color: '#FFF', fontWeight: 700, border: 'none' }}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
