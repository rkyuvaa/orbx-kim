import { useState } from 'react';
import { Search, Eye, Clock } from 'lucide-react';
import { useGetAuditLogsQuery } from '../../api/rbacApi';
import type { AuditLog } from '../../types/rbac';
import { formatDateTime } from '../../utils/format';

export default function AccessAuditLogPage() {
  const [page] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data: auditData, isLoading } = useGetAuditLogsQuery({
    page,
    page_size: 20,
    search: search || undefined,
    action_type: actionFilter || undefined,
  });

  return (
    <div style={{ padding: '16px 0', width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#023020', margin: 0, letterSpacing: -0.3 }}>
          Access & Security Audit Trail Log
        </h1>
        <p style={{ fontSize: 13, color: '#7A8B80', margin: '4px 0 0' }}>
          Real-time security event tracking for logins, role assignments, user status, and permission updates.
        </p>
      </div>

      {/* Filter Bar */}
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
            placeholder="Search by record ID, resource, value..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #D8E2D5', fontSize: 13, color: '#44584C' }}
        >
          <option value="">All Action Types</option>
          <option value="USER_CREATED">USER_CREATED</option>
          <option value="USER_UPDATED">USER_UPDATED</option>
          <option value="USER_DELETED">USER_DELETED</option>
          <option value="ROLE_CREATED">ROLE_CREATED</option>
          <option value="ROLE_UPDATED">ROLE_UPDATED</option>
          <option value="PERMISSION_CHANGED">PERMISSION_CHANGED</option>
          <option value="LOGIN">LOGIN</option>
          <option value="LOGIN_FAILED">LOGIN_FAILED</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E4EBE1', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#F8FAF8', borderBottom: '1px solid #E4EBE1', color: '#44584C', fontWeight: 700 }}>
              <th style={{ padding: '12px 16px' }}>Timestamp</th>
              <th style={{ padding: '12px 16px' }}>User</th>
              <th style={{ padding: '12px 16px' }}>Action Event</th>
              <th style={{ padding: '12px 16px' }}>Module / Resource</th>
              <th style={{ padding: '12px 16px' }}>Record ID</th>
              <th style={{ padding: '12px 16px' }}>IP Address</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#7A8B80' }}>
                  Loading audit trail...
                </td>
              </tr>
            ) : !auditData?.items || auditData.items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#7A8B80' }}>
                  No security audit records logged.
                </td>
              </tr>
            ) : (
              auditData.items.map((l) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #F0F4F0' }}>
                  <td style={{ padding: '12px 16px', color: '#7A8B80', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} /> {formatDateTime(l.created_at)}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#023020' }}>
                    {l.user_name || 'System'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        background: l.action_type.includes('DELETED') || l.action_type.includes('FAILED') ? '#FEE2E2' : '#EAF6E8',
                        color: l.action_type.includes('DELETED') || l.action_type.includes('FAILED') ? '#DC2626' : '#16C47F',
                      }}
                    >
                      {l.action_type}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#44584C' }}>
                    {l.module} / <strong>{l.resource || '-'}</strong>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#7A8B80' }}>{l.record_id || '-'}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: '#7A8B80' }}>{l.ip_address || '127.0.0.1'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => setSelectedLog(l)}
                      style={{ padding: 6, borderRadius: 6, border: '1px solid #D8E2D5', background: '#FFF', cursor: 'pointer', color: '#16C47F' }}
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* JSON Diff Drawer */}
      {selectedLog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '100%', maxWidth: 540, background: '#FFF', height: '100dvh', maxHeight: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: 24, paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: '#023020' }}>Audit Event Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#7A8B80' }}>Action Event</label>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#16C47F' }}>{selectedLog.action_type}</div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#7A8B80' }}>Previous Value Payload</label>
                <pre style={{ background: '#F8FAF8', padding: 12, borderRadius: 8, fontSize: 12, overflowX: 'auto', border: '1px solid #E4EBE1' }}>
                  {selectedLog.previous_value || 'None'}
                </pre>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#7A8B80' }}>New Value Payload</label>
                <pre style={{ background: '#F8FAF8', padding: 12, borderRadius: 8, fontSize: 12, overflowX: 'auto', border: '1px solid #E4EBE1' }}>
                  {selectedLog.new_value || 'None'}
                </pre>
              </div>

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setSelectedLog(null)} style={{ padding: '8px 20px', borderRadius: 8, background: '#16C47F', color: '#FFF', fontWeight: 700, border: 'none' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
