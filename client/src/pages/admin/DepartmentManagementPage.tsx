import { useState } from 'react';
import { Plus, Building2, Edit2, Trash2 } from 'lucide-react';
import {
  useGetDepartmentsQuery,
  useGetDepartmentTreeQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
} from '../../api/rbacApi';
import type { Department, DepartmentTreeNode, PermissionStatus } from '../../types/rbac';
import { usePermission } from '../../context/AuthPermissionContext';

export default function DepartmentManagementPage() {
  const { can } = usePermission();
  const { data: deptsList, isLoading, refetch } = useGetDepartmentsQuery();
  const { data: deptTree } = useGetDepartmentTreeQuery();

  const [createDept] = useCreateDepartmentMutation();
  const [updateDept] = useUpdateDepartmentMutation();
  const [deleteDept] = useDeleteDepartmentMutation();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  const [form, setForm] = useState<{
    name: string;
    code: string;
    description: string;
    parent_id?: number;
    status: PermissionStatus;
  }>({
    name: '',
    code: '',
    description: '',
    parent_id: undefined,
    status: 'ACTIVE',
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createDept(form).unwrap();
      setIsCreateOpen(false);
      setForm({ name: '', code: '', description: '', parent_id: undefined, status: 'ACTIVE' });
      refetch();
    } catch (err: any) {
      alert(err?.data?.detail || 'Failed to create department');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    try {
      await updateDept({ id: editingDept.id, data: form }).unwrap();
      setEditingDept(null);
      refetch();
    } catch (err: any) {
      alert(err?.data?.detail || 'Failed to update department');
    }
  };

  const handleDeleteDepartment = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete department "${name}"?`)) return;
    try {
      await deleteDept(id).unwrap();
      refetch();
    } catch (err: any) {
      alert(err?.data?.detail || 'Failed to delete department');
    }
  };

  const renderTreeNode = (node: DepartmentTreeNode, depth: number = 0) => (
    <div key={node.id} style={{ marginLeft: depth * 20, marginTop: 8 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: '#FFF',
          border: '1px solid #E4EBE1',
          borderRadius: 8,
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        }}
      >
        <Building2 size={18} color="#16C47F" />
        <span style={{ fontWeight: 700, color: '#023020', fontSize: 13.5 }}>{node.name}</span>
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#7A8B80' }}>({node.code})</span>
        <span style={{ marginLeft: 'auto', padding: '2px 8px', background: '#EAF6E8', color: '#04552B', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
          {node.employee_count} Employees
        </span>
      </div>
      {node.children && node.children.map((c) => renderTreeNode(c, depth + 1))}
    </div>
  );

  return (
    <div style={{ width: '100%', padding: '12px 0' }}>
      {/* Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#023020', margin: 0, letterSpacing: -0.3 }}>
            Hierarchical Department Management
          </h1>
          <p style={{ fontSize: 13, color: '#7A8B80', margin: '4px 0 0' }}>
            Configure department hierarchy tree, manager assignments, and employee counts.
          </p>
        </div>
        {can('create', 'departments') && (
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
            <Plus size={18} /> Create Department
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Department Hierarchy Tree Card */}
        <div style={{ background: '#FFFFFF', padding: 20, borderRadius: 14, border: '1px solid #E4EBE1' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800, color: '#023020' }}>Organization Tree</h3>
          {deptTree && deptTree.length > 0 ? (
            deptTree.map((node) => renderTreeNode(node, 0))
          ) : (
            <div style={{ padding: 20, color: '#7A8B80', fontSize: 13 }}>No department hierarchy found.</div>
          )}
        </div>

        {/* Departments List Table */}
        <div className="table-scroll-wrap scroll-touch" style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E4EBE1', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#F8FAF8', borderBottom: '1px solid #E4EBE1', color: '#44584C', fontWeight: 700 }}>
                <th style={{ padding: '12px 16px' }}>Department</th>
                <th style={{ padding: '12px 16px' }}>Code</th>
                <th style={{ padding: '12px 16px' }}>Parent Department</th>
                <th style={{ padding: '12px 16px' }}>Department Head</th>
                <th style={{ padding: '12px 16px' }}>Employees</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#7A8B80' }}>
                    Loading departments...
                  </td>
                </tr>
              ) : deptsList?.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid #F0F4F0' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#023020' }}>{d.name}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#44584C' }}>{d.code}</td>
                  <td style={{ padding: '12px 16px', color: '#04552B' }}>{d.parent_name || 'Root'}</td>
                  <td style={{ padding: '12px 16px', color: '#44584C' }}>{d.head_name || '-'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', background: '#EAF6E8', color: '#04552B', borderRadius: 20, fontWeight: 700, fontSize: 12 }}>
                      {d.employee_count}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      {can('edit', 'departments') && (
                        <button
                          onClick={() => {
                            setEditingDept(d);
                            setForm({ name: d.name, code: d.code, description: d.description || '', parent_id: d.parent_id || undefined, status: d.status });
                          }}
                          title="Edit Department"
                          style={{ padding: 6, borderRadius: 6, border: '1px solid #D8E2D5', background: '#FFF', cursor: 'pointer', color: '#0369A1' }}
                        >
                          <Edit2 size={15} />
                        </button>
                      )}
                      {can('delete', 'departments') && (
                        <button
                          onClick={() => handleDeleteDepartment(d.id, d.name)}
                          title="Delete Department"
                          style={{ padding: 6, borderRadius: 6, border: '1px solid #FCA5A5', background: '#FEF2F2', cursor: 'pointer', color: '#DC2626' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Department Modal */}
      {(isCreateOpen || editingDept) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 480, background: '#FFF', borderRadius: 14, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: '#023020' }}>
              {isCreateOpen ? 'Create Department' : `Edit Department: ${editingDept?.name}`}
            </h3>
            <form onSubmit={isCreateOpen ? handleCreateSubmit : handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#44584C' }}>Department Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#44584C' }}>Department Code *</label>
                <input
                  type="text"
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#44584C' }}>Parent Department</label>
                <select
                  value={form.parent_id || ''}
                  onChange={(e) => setForm({ ...form, parent_id: e.target.value ? Number(e.target.value) : undefined })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13 }}
                >
                  <option value="">None (Top-Level Parent)</option>
                  {deptsList?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button type="button" onClick={() => { setIsCreateOpen(false); setEditingDept(null); }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #D8E2D5', background: '#FFF' }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: '8px 20px', borderRadius: 8, background: '#16C47F', color: '#FFF', fontWeight: 700, border: 'none' }}>
                  Save Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
