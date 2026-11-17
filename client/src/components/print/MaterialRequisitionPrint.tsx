import React from 'react';
import { Box, Typography, Divider, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { RequirementItem, MaterialRequisitionItem } from '@/types/requirements';
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

export default function MaterialRequisitionPrint({ item, companyConfig }: MaterialRequisitionPrintProps) {
  const materialItems = item.material_items || [];
  const totalAmount = materialItems.reduce((sum, row) => sum + (row.amount || 0), 0);

  const renderHeaderInfo = () => (
    <Grid container spacing={2} sx={{ mb: 2 }}>
      <Grid item xs={6}>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Request No
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 700, fontFamily: 'monospace', color: COLORS.accent }}>
          {item.request_no || '—'}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Request Date
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {item.request_date ? formatDate(item.request_date) : '—'}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Requested By
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {item.requested_by || item.requester_name || '—'}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Approver
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {item.approver || '—'}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Department
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {item.department || '—'}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Status
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 700, color: COLORS.accent, textTransform: 'uppercase' }}>
          {item.status}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Project Code
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {item.project_code || '—'}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Project Name
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {item.project_name || '—'}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Cost Centre
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {item.cost_centre || '—'}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Category
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {item.category || '—'}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Priority
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {item.priority || '—'}
        </Typography>
      </Grid>
      <Grid item xs={12}>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Justification / Purpose
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 500, whiteSpace: 'pre-wrap' }}>
          {item.justification || '—'}
        </Typography>
      </Grid>
      {item.specifications && (
        <Grid item xs={12}>
          <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
            Specifications
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500, whiteSpace: 'pre-wrap' }}>
            {item.specifications}
          </Typography>
        </Grid>
      )}
    </Grid>
  );

  const renderItemTable = () => (
    <TableContainer sx={{ mb: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ backgroundColor: COLORS.headerBg }}>
            <TableCell sx={{ width: '4%', fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem' }}>S.No</TableCell>
            <TableCell sx={{ width: '14%', fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem' }}>Material / Service Code</TableCell>
            <TableCell sx={{ width: '25%', fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem' }}>Item Description</TableCell>
            <TableCell sx={{ width: '8%', fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem', textAlign: 'center' }}>Drawing / Specs</TableCell>
            <TableCell sx={{ width: '8%', fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem' }}>HSN / SAC</TableCell>
            <TableCell sx={{ width: '6%', fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem', textAlign: 'center' }}>UOM</TableCell>
            <TableCell sx={{ width: '7%', fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem', textAlign: 'right' }}>Qty</TableCell>
            <TableCell sx={{ width: '9%', fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem', textAlign: 'right' }}>Rate (₹)</TableCell>
            <TableCell sx={{ width: '10%', fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem', textAlign: 'right' }}>Budget Amount (₹)</TableCell>
            <TableCell sx={{ width: '10%', fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem', textAlign: 'right' }}>Amount (₹)</TableCell>
            <TableCell sx={{ width: '8%', fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem' }}>Remarks</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {materialItems.map((row) => (
            <TableRow key={row.s_no} sx={{ '&:nth-of-type(odd)': { backgroundColor: COLORS.lightBg } }}>
              <TableCell sx={{ width: '4%', fontWeight: 600, color: COLORS.secondary, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.7rem' }}>{row.s_no}</TableCell>
              <TableCell sx={{ width: '14%', fontWeight: 600, color: COLORS.primary, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.75rem' }}>{row.material_service_code || '—'}</TableCell>
              <TableCell sx={{ width: '25%', fontWeight: 500, color: COLORS.primary, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.75rem' }}>{row.item_description}</TableCell>
              <TableCell sx={{ width: '8%', textAlign: 'center', color: COLORS.secondary, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.7rem' }}>{row.drawing_specs_yn}</TableCell>
              <TableCell sx={{ width: '8%', color: COLORS.secondary, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.7rem' }}>{row.hsn_sac || '—'}</TableCell>
              <TableCell sx={{ width: '6%', textAlign: 'center', color: COLORS.secondary, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.7rem' }}>{row.uom}</TableCell>
              <TableCell sx={{ width: '7%', textAlign: 'right', fontWeight: 600, color: COLORS.primary, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.75rem' }}>{row.qty.toLocaleString()}</TableCell>
              <TableCell sx={{ width: '9%', textAlign: 'right', color: COLORS.primary, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.75rem' }}>₹{row.rate?.toLocaleString() || '0'}</TableCell>
              <TableCell sx={{ width: '10%', textAlign: 'right', color: COLORS.primary, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.75rem' }}>₹{row.budget_amount?.toLocaleString() || '0'}</TableCell>
              <TableCell sx={{ width: '10%', textAlign: 'right', fontWeight: 700, color: COLORS.accent, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.75rem' }}>₹{row.amount?.toLocaleString() || '0'}</TableCell>
              <TableCell sx={{ width: '8%', color: COLORS.secondary, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.7rem' }}>{row.remarks || '—'}</TableCell>
            </TableRow>
          ))}
          {materialItems.length === 0 && (
            <TableRow>
              <TableCell colSpan={11} sx={{ textAlign: 'center', color: COLORS.secondary, py: 3, fontSize: '0.8rem' }}>
                No item lines added
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableHead>
          <TableRow sx={{ backgroundColor: COLORS.lightBg, fontWeight: 700 }}>
            <TableCell colSpan={9} sx={{ borderTop: `2px solid ${COLORS.accent}`, borderBottom: `2px solid ${COLORS.accent}`, py: 1, textAlign: 'right', fontSize: '0.8rem' }}>
              Total Amount
            </TableCell>
            <TableCell sx={{ borderTop: `2px solid ${COLORS.accent}`, borderBottom: `2px solid ${COLORS.accent}`, py: 1, textAlign: 'right', fontSize: '0.85rem', color: COLORS.accent }}>
              ₹{totalAmount.toLocaleString()}
            </TableCell>
            <TableCell sx={{ borderTop: `2px solid ${COLORS.accent}`, borderBottom: `2px solid ${COLORS.accent}`, py: 1 }} />
          </TableRow>
        </TableHead>
      </Table>
    </TableContainer>
  );

  const renderApprovalSection = () => (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.primary, mb: 2, borderBottom: `2px solid ${COLORS.accent}`, pb: 1 }}>
        Approval Workflow
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, textAlign: 'center', border: `1px solid ${COLORS.border}`, borderRadius: 2 }}>
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600, textTransform: 'uppercase' }}>
              Requested By
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.primary }}>
              {item.requested_by || item.requester_name || '—'}
            </Typography>
            <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
              Date: {item.request_date ? formatDate(item.request_date) : '—'}
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
              Signature
            </Typography>
            <Box sx={{ height: 40, borderBottom: `1px dashed ${COLORS.border}` }} />
          </Paper>
        </Grid>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, textAlign: 'center', border: `1px solid ${COLORS.border}`, borderRadius: 2 }}>
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600, textTransform: 'uppercase' }}>
              Approved By
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.primary }}>
              {item.approver || '—'}
            </Typography>
            <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
                          Date: {item.request_date ? formatDate(item.request_date) : '—'}
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
              Signature
            </Typography>
            <Box sx={{ height: 40, borderBottom: `1px dashed ${COLORS.border}` }} />
          </Paper>
        </Grid>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, textAlign: 'center', border: `1px solid ${COLORS.border}`, borderRadius: 2 }}>
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600, textTransform: 'uppercase' }}>
              Authorized By
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.primary }}>
              {item.project_name ? 'Project Head' : '—'}
            </Typography>
            <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
              Date: —
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
              Signature
            </Typography>
            <Box sx={{ height: 40, borderBottom: `1px dashed ${COLORS.border}` }} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );

  const renderAttachments = () => {
    if (!item.attachments || item.attachments.length === 0) return null;
    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.primary, mb: 1.5, borderBottom: `2px solid ${COLORS.accent}`, pb: 1 }}>
          Attachments
        </Typography>
        <Grid container spacing={1}>
          {item.attachments.map((att) => (
            <Grid item xs={6} key={att.id}>
              <Paper sx={{ p: 1.5, border: `1px solid ${COLORS.border}`, borderRadius: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.primary }}>
                  {att.name}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Size: {(att.size / 1024).toFixed(1)} KB • {att.type}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Uploaded: {att.uploaded_at ? formatDate(att.uploaded_at) : '—'}
                  {att.uploaded_by ? ` by ${att.uploaded_by}` : ''}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
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
      <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.primary, mb: 1.5 }}>
        Item Details
      </Typography>
      {renderItemTable()}
      {renderApprovalSection()}
      {renderAttachments()}
    </PrintLayout>
  );
}