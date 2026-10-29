import { useState } from 'react';
import { Plus, Shield, Copy, Edit2, Trash2 } from 'lucide-react';
import {
  useGetRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDuplicateRoleMutation,
  useDeleteRoleMutation,
  useGetPermissionsRegistryQuery,
} from '../../api/rbacApi';
import type { PermissionStatus, Role } from '../../types/rbac';

export default function RoleManagementPage() {
  const { data: rolesList, isLoading, refetch } = useGetRolesQuery();
  const { data: registry } = useGetPermissionsRegistryQuery();

  const [createRole] = useCreateRoleMutation();
  const [updateRole] = useUpdateRoleMutation();
  const [duplicateRole] = useDuplicateRoleMutation();
  const [deleteRole] = useDeleteRoleMutation();

  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [duplicateRoleId, setDuplicateRoleId] = useState<number | null>(null);

  // Permission Matrix Selected IDs
  const [selectedPermIds, setSelectedPermIds] = useState<number[]>([]);

  // Form fields
  const [form, setForm] = useState<{
    name: string;
    code: string;
    description: string;
    status: PermissionStatus;
  }>({
    name: '',
    code: '',
    description: '',
    status: 'ACTIVE',
  });

  const [dupForm, setDupForm] = useState({
    new_name: '',
    new_code: '',
    description: '',
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createRole({ ...form, permission_ids: selectedPermIds }).unwrap();
      setIsCreateOpen(false);
      setForm({ name: '', code: '', description: '', status: 'ACTIVE' });
      setSelectedPermIds([]);
      refetch();
    } catch (err: any) {
      alert(err?.data?.detail || 'Failed to create role');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;
    try {
      await updateRole({ id: editingRole.id, data: { ...form, permission_ids: selectedPermIds } }).unwrap();
      setEditingRole(null);
      refetch();
    } catch (err: any) {
      alert(err?.data?.detail || 'Failed to update role');
    }
  };

  const handleDuplicateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!duplicateRoleId) return;
    try {
      await duplicateRole({ id: duplicateRoleId, ...dupForm }).unwrap();
      setDuplicateRoleId(null);
      setDupForm({ new_name: '', new_code: '', description: '' });
      refetch();
    } catch (err: any) {
      alert(err?.data?.detail || 'Failed to duplicate role');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (confirm(`Are you sure you want to delete role ${name}?`)) {
      try {
        await deleteRole(id).unwrap();
        refetch();
      } catch (err: any) {
        alert(err?.data?.detail || 'Failed to delete role');
      }
    }
  };

  const togglePermission = (id: number) => {
    if (selectedPermIds.includes(id)) {
      setSelectedPermIds(selectedPermIds.filter((pid) => pid !== id));
    } else {
      setSelectedPermIds([...selectedPermIds, id]);
    }
  };

  return (
    <div style={{ padding: '16px 0', width: '100%' }}>
      {/* Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#023020', margin: 0, letterSpacing: -0.3 }}>
            Role & Permission Matrix Management
          </h1>
          <p style={{ fontSize: 13, color: '#7A8B80', margin: '4px 0 0' }}>
            Configure dynamic system roles, action matrices, and data scopes without code changes.
          </p>
        </div>
        <button
          onClick={() => {
            setIsCreateOpen(true);
            setSelectedPermIds([]);
          }}
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
          <Plus size={18} /> Create New Role
        </button>
      </div>

      {/* Roles Grid / Table */}
      <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E4EBE1', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#F8FAF8', borderBottom: '1px solid #E4EBE1', color: '#44584C', fontWeight: 700 }}>
              <th style={{ padding: '12px 16px' }}>Role Name</th>
              <th style={{ padding: '12px 16px' }}>Role Code</th>
              <th style={{ padding: '12px 16px' }}>Description</th>
              <th style={{ padding: '12px 16px' }}>Assigned Users</th>
              <th style={{ padding: '12px 16px' }}>Granted Permissions</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#7A8B80' }}>
                  Loading roles...
                </td>
              </tr>
            ) : !rolesList || rolesList.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#7A8B80' }}>
                  No roles registered.
                </td>
              </tr>
            ) : (
              rolesList.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #F0F4F0' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#023020' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Shield size={16} color="#16C47F" /> {r.name}
                      {r.is_system && (
                        <span style={{ fontSize: 10, padding: '2px 6px', background: '#FEF3C7', color: '#B45309', borderRadius: 4, fontWeight: 700 }}>
                          SYSTEM
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#44584C' }}>{r.code}</td>
                  <td style={{ padding: '12px 16px', color: '#7A8B80' }}>{r.description || '-'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', background: '#EAF6E8', color: '#04552B', borderRadius: 20, fontWeight: 700, fontSize: 12 }}>
                      {r.user_count} Users
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', background: '#E0F2FE', color: '#0369A1', borderRadius: 20, fontWeight: 700, fontSize: 12 }}>
                      {r.permission_count} Perms
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: r.status === 'ACTIVE' ? '#DCFCE7' : '#F3F4F6', color: r.status === 'ACTIVE' ? '#15803D' : '#4B5563' }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      <button
                        title="Duplicate Role"
                        onClick={() => {
                          setDuplicateRoleId(r.id);
                          setDupForm({ new_name: `${r.name} (Copy)`, new_code: `${r.code}_copy`, description: r.description || '' });
                        }}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid #D8E2D5', background: '#FFF', cursor: 'pointer', color: '#16C47F' }}
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        title="Edit Matrix"
                        onClick={() => {
                          setEditingRole(r);
                          setForm({ name: r.name, code: r.code, description: r.description || '', status: r.status });
                          setSelectedPermIds(r.permission_ids || []);
                        }}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid #D8E2D5', background: '#FFF', cursor: 'pointer', color: '#0369A1' }}
                      >
                        <Edit2 size={15} />
                      </button>
                      {!r.is_system && (
                        <button
                          title="Delete Role"
                          onClick={() => handleDelete(r.id, r.name)}
                          style={{ padding: 6, borderRadius: 6, border: '1px solid #FCA5A5', background: '#FEF2F2', cursor: 'pointer', color: '#DC2626' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Role Create / Edit Drawer with Dynamic Permission Matrix */}
      {(isCreateOpen || editingRole) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '100%', maxWidth: 780, background: '#FFF', height: '100dvh', maxHeight: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: 24, paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))', boxShadow: '-4px 0 20px rgba(0,0,0,0.15)' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 800, color: '#023020' }}>
              {isCreateOpen ? 'Create Role & Configure Matrix' : `Edit Role: ${editingRole?.name}`}
            </h2>

            <form onSubmit={isCreateOpen ? handleCreateSubmit : handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#44584C' }}>Role Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#44584C' }}>Role Code *</label>
                  <input
                    type="text"
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#44584C' }}>Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13 }}
                />
              </div>

              {/* Permission Matrix */}
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#023020', margin: 0 }}>Dynamic Permission Matrix</h3>
                  <span style={{ fontSize: 12, color: '#16C47F', fontWeight: 700 }}>
                    {selectedPermIds.length} Permissions Selected
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {registry?.map((mod) => (
                    <div key={mod.id} style={{ border: '1px solid #E4EBE1', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ padding: '10px 14px', background: '#F4F7F4', borderBottom: '1px solid #E4EBE1', fontWeight: 700, color: '#04552B', fontSize: 13.5 }}>
                        {mod.name} ({mod.code})
                      </div>
                      <div style={{ padding: 12 }}>
                        {mod.resources.map((res) => (
                          <div key={res.id} style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#023020', marginBottom: 6 }}>{res.name}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                              {res.actions.map((act) => {
                                const permId = act.permission_id || act.id;
                                const isChecked = Boolean(permId && selectedPermIds.includes(permId));
                                return (
                                  <label key={act.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 10px', background: isChecked ? '#EAF6E8' : '#F9FAFB', border: `1px solid ${isChecked ? '#A3E635' : '#E5E7EB'}`, borderRadius: 6, cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => permId && togglePermission(permId)}
                                    />
                                    <span style={{ fontWeight: isChecked ? 700 : 500, color: isChecked ? '#16C47F' : '#4B5563' }}>{act.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button type="button" onClick={() => { setIsCreateOpen(false); setEditingRole(null); }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #D8E2D5', background: '#FFF' }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: '8px 20px', borderRadius: 8, background: '#16C47F', color: '#FFF', fontWeight: 700, border: 'none' }}>
                  Save Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate Role Modal */}
      {duplicateRoleId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 450, background: '#FFF', borderRadius: 14, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: '#023020' }}>Duplicate Role</h3>
            <form onSubmit={handleDuplicateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#44584C' }}>New Role Name *</label>
                <input
                  type="text"
                  required
                  value={dupForm.new_name}
                  onChange={(e) => setDupForm({ ...dupForm, new_name: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#44584C' }}>New Role Code *</label>
                <input
                  type="text"
                  required
                  value={dupForm.new_code}
                  onChange={(e) => setDupForm({ ...dupForm, new_code: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" onClick={() => setDuplicateRoleId(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #D8E2D5', background: '#FFF' }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: '8px 20px', borderRadius: 8, background: '#16C47F', color: '#FFF', fontWeight: 700, border: 'none' }}>
                  Duplicate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
