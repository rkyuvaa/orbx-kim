import React from 'react';
import { Box, Typography, Divider } from '@mui/material';
import { RequirementItem } from '@/types/requirements';
import { formatDate } from '@/utils/format';
import PrintLayout, { type CompanyConfig } from './PrintLayout';

interface MaterialRequisitionPrintProps {
  item: RequirementItem;
  companyConfig?: CompanyConfig;
}

const COLORS = {
  primary: '#1a1a1a',
  secondary: '#555',
  accent: '#04552B',
  lightBg: '#f8f9fa',
  border: '#e0e0e0',
  headerBg: '#f0f4f0',
};

const labelSx = { display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem', color: COLORS.secondary } as const;

function InfoCell({ label, value, xs = 3 }: { label: string; value?: React.ReactNode; xs?: number }) {
  // Inline styles guarantee the cell width even if CSS-in-JS fails to load.
  return (
    <div style={{ width: `${(xs / 12) * 100}%`, padding: '0 8px', boxSizing: 'border-box' }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', color: COLORS.secondary, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: COLORS.primary }}>{value || '—'}</div>
    </div>
  );
}

export default function MaterialRequisitionPrint({ item, companyConfig }: MaterialRequisitionPrintProps) {
  const materialItems = item.material_items || [];
  const totalAmount = materialItems.reduce((sum, row) => sum + (row.amount || 0), 0);

  const rowStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', margin: '0 -8px' };

  const renderHeaderInfo = () => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ ...rowStyle, marginBottom: 12 }}>
        <InfoCell label="Requester" value={item.requested_by || item.requester_name} />
        <InfoCell label="Department" value={item.department} />
        <InfoCell label="Cost Centre" value={item.cost_centre} />
        <InfoCell label="Approver" value={item.approver} />
      </div>
      <div style={rowStyle}>
        <InfoCell label="Request Date" value={item.request_date ? formatDate(item.request_date) : undefined} />
        <InfoCell label="Required By" value={item.required_by_date ? formatDate(item.required_by_date) : undefined} />
        <InfoCell label="Status" value={<span style={{ fontWeight: 700, color: COLORS.accent, textTransform: 'uppercase' }}>{item.status}</span>} />
      </div>
    </div>
  );

  const thStyle = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`,
    padding: '8px 6px', fontSize: '0.7rem', backgroundColor: COLORS.headerBg, textAlign: 'left', ...extra,
  });
  const tdStyle = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    borderBottom: `1px solid ${COLORS.border}`, padding: '6px', fontSize: '0.75rem', color: COLORS.primary, ...extra,
  });

  const renderItemTable = () => (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
      <thead>
        <tr>
          <th style={{ ...thStyle({ width: '5%' }) }}>S.No</th>
          <th style={{ ...thStyle({ width: '18%' }) }}>Material / Service Code</th>
          <th style={{ ...thStyle({ width: '42%' }) }}>Item Description</th>
          <th style={{ ...thStyle({ width: '10%', textAlign: 'center' }) }}>UOM</th>
          <th style={{ ...thStyle({ width: '8%', textAlign: 'right' }) }}>Qty</th>
          <th style={{ ...thStyle({ width: '8%', textAlign: 'right' }) }}>Rate (₹)</th>
          <th style={{ ...thStyle({ width: '9%', textAlign: 'right' }) }}>Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        {materialItems.map((row, idx) => (
          <tr key={row.s_no} style={{ backgroundColor: idx % 2 === 0 ? COLORS.lightBg : 'transparent' }}>
            <td style={{ ...tdStyle({ color: COLORS.secondary, fontWeight: 600, fontSize: '0.7rem' }) }}>{row.s_no}</td>
            <td style={{ ...tdStyle({ fontWeight: 600 }) }}>{row.material_service_code || '—'}</td>
            <td style={{ ...tdStyle({ fontWeight: 500 }) }}>{row.item_description || '—'}</td>
            <td style={{ ...tdStyle({ textAlign: 'center', color: COLORS.secondary, fontSize: '0.7rem' }) }}>{row.uom}</td>
            <td style={{ ...tdStyle({ textAlign: 'right', fontWeight: 600 }) }}>{row.qty.toLocaleString()}</td>
            <td style={{ ...tdStyle({ textAlign: 'right' }) }}>₹{row.rate?.toLocaleString() || '0'}</td>
            <td style={{ ...tdStyle({ textAlign: 'right', fontWeight: 700, color: COLORS.accent }) }}>₹{row.amount?.toLocaleString() || '0'}</td>
          </tr>
        ))}
        {materialItems.length === 0 && (
          <tr>
            <td colSpan={7} style={{ ...tdStyle({ textAlign: 'center', color: COLORS.secondary, padding: 24, fontSize: '0.8rem' }) }}>
              No item lines added
            </td>
          </tr>
        )}
      </tbody>
      <tfoot>
        <tr style={{ backgroundColor: COLORS.lightBg }}>
          <td colSpan={6} style={{ borderTop: `2px solid ${COLORS.accent}`, borderBottom: `2px solid ${COLORS.accent}`, padding: '8px 6px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700 }}>
            Total Amount
          </td>
          <td style={{ borderTop: `2px solid ${COLORS.accent}`, borderBottom: `2px solid ${COLORS.accent}`, padding: '8px 6px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 700, color: COLORS.accent }}>
            ₹{totalAmount.toLocaleString()}
          </td>
        </tr>
      </tfoot>
    </table>
  );

  const renderJustification = () => (
    <Box sx={{ mt: 2, mb: 2 }}>
      <Typography variant="caption" sx={labelSx}>Justification / Purpose</Typography>
      <Typography variant="body1" sx={{ fontWeight: 500, fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
        {item.justification || '—'}
      </Typography>
    </Box>
  );

  const renderAttachments = () => {
    if (!item.attachments || item.attachments.length === 0) return null;
    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.primary, mb: 1.5, borderBottom: `2px solid ${COLORS.accent}`, pb: 1 }}>
          Attachments
        </Typography>
        {item.attachments.map((att) => (
          <Box key={att.id} sx={{ mb: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.primary, fontSize: '0.75rem' }}>
              {att.name}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Size: {(att.size / 1024).toFixed(1)} KB • {att.uploaded_at ? formatDate(att.uploaded_at) : '—'}
              {att.uploaded_by ? ` by ${att.uploaded_by}` : ''}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <PrintLayout
      title="Material / Service Request"
      subtitle={item.title}
      companyConfig={companyConfig}
      requestNo={item.request_no || item.id}
      requestDate={item.request_date ? formatDate(item.request_date) : undefined}
    >
      {renderHeaderInfo()}
      <Divider sx={{ mb: 2, borderColor: COLORS.accent, borderWidth: 2 }} />
      <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.primary, mb: 1.5, fontSize: '0.95rem' }}>
        Item Details
      </Typography>
      {renderItemTable()}
      {renderJustification()}
      {renderAttachments()}
    </PrintLayout>
  );
}
