import React from 'react';
import { Box, Typography, Divider, Grid, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { RequirementItem, AttachmentFile } from '@/types/requirements';
import { formatDate } from '@/utils/format';
import PrintLayout, { type CompanyConfig } from './PrintLayout';

interface ITRequirementPrintProps {
  item: RequirementItem;
  companyConfig?: CompanyConfig;
}

const COLORS = {
  primary: '#1a1a1a',
  secondary: '#555',
  accent: '#1e3a8a', // Blue for IT
  lightBg: '#f0f4ff',
  border: '#d0d9e8',
  headerBg: '#e8edf7',
};

const getUrgencyLabel = (urgency?: string) => {
  switch (urgency) {
    case 'ASAP':
      return 'ASAP (Immediate)';
    case 'Needed within 2 weeks':
      return 'Within 2 Weeks';
    case 'Needed within 1 month':
      return 'Within 1 Month';
    default:
      return urgency || 'Can Wait';
  }
};

const getRequirementTypeLabel = (type?: string, other?: string) => {
  if (type === 'Other' && other) return other;
  return type || '—';
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'COMPLETED':
    case 'FULFILLED':
      return '#15803D';
    case 'REJECTED':
      return '#B91C1C';
    case 'SUBMITTED':
    case 'PENDING':
      return '#B45309';
    case 'MANAGER_APPROVAL':
      return '#1D4ED8';
    case 'IT_MANAGER_REVIEW':
      return '#4338CA';
    case 'DEPT_HEAD_APPROVAL':
      return '#7E22CE';
    case 'IT_PROCESSING':
      return '#0F766E';
    default:
      return COLORS.primary;
  }
};

export default function ITRequirementPrint({ item, companyConfig }: ITRequirementPrintProps) {
  const renderHeaderInfo = () => (
    <Grid container spacing={2} sx={{ mb: 2 }}>
      <Grid item xs={6}>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Request No
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 700, fontFamily: 'monospace', color: COLORS.accent }}>
          {item.request_no || item.id || '—'}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Request Date
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {item.date_of_request ? formatDate(item.date_of_request) : (item.request_date ? formatDate(item.request_date) : '—')}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Requested By
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {item.requester_name || item.requested_by || '—'}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Designation
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {item.requester_designation || '—'}
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
        <Typography variant="body1" sx={{ fontWeight: 700, color: getStatusColor(item.status), textTransform: 'uppercase' }}>
          {item.status.replace(/_/g, ' ')}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Requirement Type
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {getRequirementTypeLabel(item.requirement_type, item.other_requirement_type)}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Urgency
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {getUrgencyLabel(item.urgency)}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Preferred Go-Live
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {item.preferred_go_live_date ? formatDate(item.preferred_go_live_date) : '—'}
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
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {item.priority || '—'}
        </Typography>
      </Grid>
      {item.project_timeline && (
        <Grid item xs={6}>
          <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
            Project Timeline
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {item.project_timeline}
          </Typography>
        </Grid>
      )}
      <Grid item xs={12}>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Business Problem / Opportunity
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 500, whiteSpace: 'pre-wrap' }}>
          {item.business_problem || '—'}
        </Typography>
      </Grid>
      {item.affected_users_teams && item.affected_users_teams.length > 0 && (
        <Grid item xs={12}>
          <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
            Affected Users / Teams
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {item.affected_users_teams.join(', ')}
          </Typography>
        </Grid>
      )}
      {item.step_by_step_flow && (
        <Grid item xs={12}>
          <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
            Step-by-Step Flow
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.8rem', backgroundColor: COLORS.lightBg, p: 1.5, borderRadius: 1 }}>
            {item.step_by_step_flow}
          </Typography>
        </Grid>
      )}
      {item.has_further_requirements && item.additional_requirements && (
        <Grid item xs={12}>
          <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.2, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
            Additional Requirements
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500, whiteSpace: 'pre-wrap' }}>
            {item.additional_requirements}
          </Typography>
        </Grid>
      )}
    </Grid>
  );

  const renderMockupSection = () => {
    const hasMockupFiles = item.mockup_files && item.mockup_files.length > 0;
    const hasFlowchartFiles = item.flowchart_files && item.flowchart_files.length > 0;
    
    if (!hasMockupFiles && !hasFlowchartFiles && !item.has_flowchart && item.mockup_it_notes === undefined) {
      return null;
    }

    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.primary, mb: 1.5, borderBottom: `2px solid ${COLORS.accent}`, pb: 1 }}>
          Design & Mockups
        </Typography>
        <Grid container spacing={2}>
          {hasMockupFiles && (
            <Grid item xs={6}>
              <Paper sx={{ p: 2, border: `1px solid ${COLORS.border}`, borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: COLORS.accent, mb: 1, display: 'block' }}>
                  Mockup Files ({item.mockup_files!.length})
                </Typography>
                <Grid container spacing={1}>
                  {item.mockup_files!.map((file: AttachmentFile) => (
                    <Grid item xs={12} key={file.id}>
                      <Box sx={{ p: 1, backgroundColor: COLORS.lightBg, borderRadius: 1, border: `1px solid ${COLORS.border}` }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.primary }}>
                          {file.name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          Size: {(file.size / 1024).toFixed(1)} KB • {file.type}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          Uploaded: {file.uploaded_at ? formatDate(file.uploaded_at) : '—'}
                          {file.uploaded_by ? ` by ${file.uploaded_by}` : ''}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
                {item.mockup_it_notes && (
                  <Box sx={{ mt: 1.5 }}>
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
                      IT Notes
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', backgroundColor: COLORS.lightBg, p: 1, borderRadius: 1 }}>
                      {item.mockup_it_notes}
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          )}
          {(hasFlowchartFiles || item.has_flowchart) && (
            <Grid item xs={6}>
              <Paper sx={{ p: 2, border: `1px solid ${COLORS.border}`, borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: COLORS.accent, mb: 1, display: 'block' }}>
                  Flowchart
                </Typography>
                {hasFlowchartFiles && (
                  <Grid container spacing={1}>
                    {item.flowchart_files!.map((file: AttachmentFile) => (
                      <Grid item xs={12} key={file.id}>
                        <Box sx={{ p: 1, backgroundColor: COLORS.lightBg, borderRadius: 1, border: `1px solid ${COLORS.border}` }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.primary }}>
                            {file.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            Size: {(file.size / 1024).toFixed(1)} KB • {file.type}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            Uploaded: {file.uploaded_at ? formatDate(file.uploaded_at) : '—'}
                            {file.uploaded_by ? ` by ${file.uploaded_by}` : ''}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                )}
                {!hasFlowchartFiles && item.has_flowchart && (
                  <Typography variant="body2" sx={{ color: COLORS.secondary, fontStyle: 'italic' }}>
                    Flowchart indicated but no files attached
                  </Typography>
                )}
              </Paper>
            </Grid>
          )}
          {item.mockup_approved !== undefined && (
            <Grid item xs={12}>
              <Paper sx={{ p: 2, border: `1px solid ${COLORS.border}`, borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: COLORS.accent, mb: 1, display: 'block' }}>
                  Mockup Approval Status
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: item.mockup_approved ? '#15803D' : '#B91C1C' }}>
                      {item.mockup_approved ? '✓ APPROVED' : '✗ NOT APPROVED'}
                    </Typography>
                  </Grid>
                  {item.mockup_feedback && (
                    <Grid item xs={12}>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
                        Feedback
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', backgroundColor: COLORS.lightBg, p: 1, borderRadius: 1 }}>
                        {item.mockup_feedback}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </Grid>
          )}
        </Grid>
      </Box>
    );
  };

  const renderApprovalHistory = () => {
    if (!item.approval_history || item.approval_history.length === 0) return null;
    
    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.primary, mb: 1.5, borderBottom: `2px solid ${COLORS.accent}`, pb: 1 }}>
          Approval History
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: COLORS.headerBg }}>
                <TableCell sx={{ fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem' }}>Stage</TableCell>
                <TableCell sx={{ fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem' }}>Approver</TableCell>
                <TableCell sx={{ fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem' }}>Designation</TableCell>
                <TableCell sx={{ fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem', textAlign: 'center' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem' }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700, color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, py: 1, fontSize: '0.7rem' }}>Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {item.approval_history!.map((stage, index) => (
                <TableRow key={index} sx={{ '&:nth-of-type(odd)': { backgroundColor: COLORS.lightBg } }}>
                  <TableCell sx={{ fontWeight: 600, color: COLORS.primary, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.75rem' }}>
                    {stage.title}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 500, color: COLORS.primary, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.75rem' }}>
                    {stage.approver_name}
                  </TableCell>
                  <TableCell sx={{ color: COLORS.secondary, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.7rem' }}>
                    {stage.approver_designation || '—'}
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center', borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.7rem' }}>
                                      <Typography variant="body2" sx={{
                      fontWeight: 700,
                      color: stage.status === 'APPROVED' ? '#15803D' :
                            stage.status === 'REJECTED' ? '#B91C1C' :
                            stage.status === 'PENDING' ? '#B45309' : '#64748B',
                      }}>
                        {stage.status}
                                        </Typography>
                  </TableCell>
                  <TableCell sx={{ color: COLORS.secondary, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.7rem' }}>
                    {stage.date ? formatDate(stage.date) : '—'}
                  </TableCell>
                  <TableCell sx={{ color: COLORS.secondary, borderBottom: `1px solid ${COLORS.border}`, py: 0.75, fontSize: '0.7rem' }}>
                    {stage.notes || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

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

  const renderSignatures = () => (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.primary, mb: 2, borderBottom: `2px solid ${COLORS.accent}`, pb: 1 }}>
        Authorizations
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, textAlign: 'center', border: `1px solid ${COLORS.border}`, borderRadius: 2 }}>
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600, textTransform: 'uppercase' }}>
              Requested By
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.primary }}>
              {item.requester_name || item.requested_by || '—'}
            </Typography>
            <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
              {item.requester_designation || '—'}
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
              Signature
            </Typography>
            <Box sx={{ height: 40, borderBottom: `1px dashed ${COLORS.border}` }} />
            <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
              Date: {item.date_of_request ? formatDate(item.date_of_request) : (item.request_date ? formatDate(item.request_date) : '—')}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, textAlign: 'center', border: `1px solid ${COLORS.border}`, borderRadius: 2 }}>
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600, textTransform: 'uppercase' }}>
              Recommended By (Manager)
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.primary }}>
              {item.approver || '—'}
            </Typography>
            <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
              Department Head / Manager
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
              Signature
            </Typography>
            <Box sx={{ height: 40, borderBottom: `1px dashed ${COLORS.border}` }} />
            <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
              Date: —
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, textAlign: 'center', border: `1px solid ${COLORS.border}`, borderRadius: 2 }}>
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600, textTransform: 'uppercase' }}>
              Approved By (IT Head)
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.primary }}>
              —
            </Typography>
            <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
              IT Manager / Head
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
              Signature
            </Typography>
            <Box sx={{ height: 40, borderBottom: `1px dashed ${COLORS.border}` }} />
            <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
              Date: —
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <PrintLayout
      title="IT Requirement"
      subtitle={item.title}
        companyConfig={companyConfig}
    >
      {renderHeaderInfo()}
      {renderMockupSection()}
      {renderApprovalHistory()}
      {renderAttachments()}
      {renderSignatures()}
    </PrintLayout>
  );
}