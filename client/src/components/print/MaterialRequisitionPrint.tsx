import React from 'react';
import { Box, Typography, Divider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
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
const valueSx = { fontWeight: 600, fontSize: '0.8rem', color: COLORS.primary } as const;

function InfoCell({ label, value, xs = 3 }: { label: string; value?: React.ReactNode; xs?: number }) {
  return (
    <Box sx={{ width: `${(xs / 12) * 100}%`, px: 1 }}>
      <Typography variant="caption" sx={labelSx}>{label}</Typography>
      <Typography variant="body1" sx={valueSx}>{value || '—'}</Typography>
    </Box>
  );
}

export default function MaterialRequisitionPrint({ item, companyConfig }: MaterialRequisitionPrintProps) {
  const materialItems = item.material_items || [];
  const totalAmount = materialItems.reduce((sum, row) => sum + (row.amount || 0), 0);

  const renderHeaderInfo = () => (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', mx: -1, mb: 1.5 }}>
        <InfoCell label="Requester" value={item.requested_by || item.requester_name} />
        <InfoCell label="Department" value={item.department} />
        <InfoCell label="Cost Centre" value={item.cost_centre} />
        <InfoCell label="Approver" value={item.approver} />
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', mx: -1 }}>
        <InfoCell label="Request Date" value={item.request_date ? formatDate(item.request_date) : undefined} />
        <InfoCell label="Required By" value={item.required_by_date ? formatDate(item.required_by_date) : undefined} />
        <InfoCell label="Status" value={<span style={{ fontWeight: 700, color: COLORS.accent, textTransform: 'uppercase' }}>{item.status}</span>} />
      </Box>
    </Box>
  );

  const renderItemTable = () => (
    <TableContainer sx={{ mb: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ backgroundColor: COLORS.headerBg }}>
            <TableCell sx={{ width: '5%', fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem' }}>S.No</TableCell>
            <TableCell sx={{ width: '18%', fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem' }}>Material / Service Code</TableCell>
            <TableCell sx={{ width: '42%', fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem' }}>Item Description</TableCell>
            <TableCell sx={{ width: '10%', fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem', textAlign: 'center' }}>UOM</TableCell>
            <TableCell sx={{ width: '8%', fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem', textAlign: 'right' }}>Qty</TableCell>
            <TableCell sx={{ width: '8%', fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem', textAlign: 'right' }}>Rate (₹)</TableCell>
            <TableCell sx={{ width: '9%', fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem', textAlign: 'right' }}>Amount (₹)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {materialItems.map((row) => (
            <TableRow key={row.s_no} sx={{ '&:nth-of-type(odd)': { backgroundColor: COLORS.lightBg } }}>
              <TableCell sx={{ fontWeight: 600, color: COLORS.secondary, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.7rem' }}>{row.s_no}</TableCell>
              <TableCell sx={{ fontWeight: 600, color: COLORS.primary, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.75rem' }}>{row.material_service_code || '—'}</TableCell>
              <TableCell sx={{ fontWeight: 500, color: COLORS.primary, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.75rem' }}>{row.item_description || '—'}</TableCell>
              <TableCell sx={{ textAlign: 'center', color: COLORS.secondary, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.7rem' }}>{row.uom}</TableCell>
              <TableCell sx={{ textAlign: 'right', fontWeight: 600, color: COLORS.primary, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.75rem' }}>{row.qty.toLocaleString()}</TableCell>
              <TableCell sx={{ textAlign: 'right', color: COLORS.primary, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.75rem' }}>₹{row.rate?.toLocaleString() || '0'}</TableCell>
              <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: COLORS.accent, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.75rem' }}>₹{row.amount?.toLocaleString() || '0'}</TableCell>
            </TableRow>
          ))}
          {materialItems.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} sx={{ textAlign: 'center', color: COLORS.secondary, py: 3, fontSize: '0.8rem' }}>
                No item lines added
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableHead>
          <TableRow sx={{ backgroundColor: COLORS.lightBg, fontWeight: 700 }}>
            <TableCell colSpan={6} sx={{ borderTop: `2px solid ${COLORS.accent}`, borderBottom: `2px solid ${COLORS.accent}`, py: 1, textAlign: 'right', fontSize: '0.8rem' }}>
              Total Amount
            </TableCell>
            <TableCell sx={{ borderTop: `2px solid ${COLORS.accent}`, borderBottom: `2px solid ${COLORS.accent}`, py: 1, textAlign: 'right', fontSize: '0.85rem', color: COLORS.accent }}>
              ₹{totalAmount.toLocaleString()}
            </TableCell>
          </TableRow>
        </TableHead>
      </Table>
    </TableContainer>
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
