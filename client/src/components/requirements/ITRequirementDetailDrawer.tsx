import React, { useState } from 'react';
import {
  Drawer,
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Button,
  IconButton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
} from '@mui/material';
import {
  Laptop,
  XCircle,
  FileText,
  User,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Download,
  Trash2,
  Edit3,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { RequirementItem, AttachmentFile } from '@/types/requirements';
import { formatDate } from '@/utils/format';

interface ITRequirementDetailDrawerProps {
  item: RequirementItem | null;
  open: boolean;
  onClose: () => void;
  onEdit: (item: RequirementItem) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, newStatus: string, rejectionReason?: string) => void;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  loggedUser: { full_name: string } | null;
}

export default function ITRequirementDetailDrawer({
  item,
  open,
  onClose,
  onEdit,
  onDelete,
  onUpdateStatus,
  canEdit,
  canDelete,
  canApprove,
  loggedUser,
}: ITRequirementDetailDrawerProps) {
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  if (!item) return null;

  // Helper Badge Colors
  const getUrgencyChip = (urgency?: string) => {
    switch (urgency) {
      case 'ASAP':
        return <Chip label="ASAP" size="small" sx={{ bgcolor: '#FEE2E2', color: '#DC2626', fontWeight: 800, fontSize: '0.7rem' }} />;
      case 'Needed within 2 weeks':
        return <Chip label="Within 2 Weeks" size="small" sx={{ bgcolor: '#FEF3C7', color: '#D97706', fontWeight: 800, fontSize: '0.7rem' }} />;
      case 'Needed within 1 month':
        return <Chip label="Within 1 Month" size="small" sx={{ bgcolor: '#DBEAFE', color: '#1D4ED8', fontWeight: 800, fontSize: '0.7rem' }} />;
      default:
        return <Chip label={urgency || 'Can Wait'} size="small" sx={{ bgcolor: '#F1F5F9', color: '#475569', fontWeight: 800, fontSize: '0.7rem' }} />;
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'COMPLETED':
      case 'FULFILLED':
        return <Chip label="COMPLETED" size="small" icon={<CheckCircle2 size={12} />} sx={{ bgcolor: '#DCFCE7', color: '#15803D', fontWeight: 800, fontSize: '0.7rem' }} />;
      case 'SUBMITTED':
      case 'PENDING':
        return <Chip label="SUBMITTED" size="small" icon={<Clock size={12} />} sx={{ bgcolor: '#FEF3C7', color: '#B45309', fontWeight: 800, fontSize: '0.7rem' }} />;
      case 'MANAGER_APPROVAL':
        return <Chip label="MANAGER APPROVAL" size="small" icon={<Clock size={12} />} sx={{ bgcolor: '#DBEAFE', color: '#1D4ED8', fontWeight: 800, fontSize: '0.7rem' }} />;
      case 'IT_MANAGER_REVIEW':
        return <Chip label="IT REVIEW" size="small" icon={<Clock size={12} />} sx={{ bgcolor: '#E0E7FF', color: '#4338CA', fontWeight: 800, fontSize: '0.7rem' }} />;
      case 'DEPT_HEAD_APPROVAL':
        return <Chip label="DEPT HEAD APPROVAL" size="small" icon={<Clock size={12} />} sx={{ bgcolor: '#F3E8FF', color: '#7E22CE', fontWeight: 800, fontSize: '0.7rem' }} />;
      case 'IT_PROCESSING':
        return <Chip label="IT PROCESSING" size="small" icon={<Laptop size={12} />} sx={{ bgcolor: '#CCFBF1', color: '#0F766E', fontWeight: 800, fontSize: '0.7rem' }} />;
      case 'REJECTED':
        return <Chip label="REJECTED" size="small" icon={<XCircle size={12} />} sx={{ bgcolor: '#FEE2E2', color: '#B91C1C', fontWeight: 800, fontSize: '0.7rem' }} />;
      default:
        return <Chip label={status || 'DRAFT'} size="small" sx={{ bgcolor: '#F1F5F9', color: '#64748B', fontWeight: 800, fontSize: '0.7rem' }} />;
    }
  };

  const handleDownload = (file: AttachmentFile) => {
    // Generate text/file blob for download preview
    const blob = new Blob([`Content of ${file.name}`], { type: file.type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', file.name);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRejectSubmit = () => {
    if (!rejectionReasonInput.trim()) return;
    onUpdateStatus(item.id, 'REJECTED', rejectionReasonInput.trim());
    setRejectModalOpen(false);
    setRejectionReasonInput('');
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: { width: { xs: '100%', sm: 600, md: 680 }, p: 3, bgcolor: '#F8FAFC' },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="overline" sx={{ fontWeight: 800, color: '#04552B', letterSpacing: 1 }}>
                  {item.id} • IT REQUIREMENT
                </Typography>
                {getStatusChip(item.status)}
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0F172A' }}>
                {item.title}
              </Typography>
            </Box>
            <IconButton onClick={onClose} size="small">
              <XCircle size={22} color="#64748B" />
            </IconButton>
          </Box>

          <Divider sx={{ mb: 2.5 }} />

          {/* Quick Info Grid */}
          <Paper elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: '10px', bgcolor: '#ffffff', mb: 2.5 }}>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={4}>
                <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>
                  Requester & Designation
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1E293B' }}>
                  {item.requested_by}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {item.requester_designation || 'Staff'}
                </Typography>
              </Grid>

              <Grid item xs={6} sm={4}>
                <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>
                  Department
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1E293B' }}>
                  {item.department}
                </Typography>
              </Grid>

              <Grid item xs={6} sm={4}>
                <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>
                  Requirement Type
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#04552B' }}>
                  {item.requirement_type || item.category}
                </Typography>
              </Grid>

              <Grid item xs={6} sm={4}>
                <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>
                  Urgency
                </Typography>
                <Box sx={{ mt: 0.5 }}>{getUrgencyChip(item.urgency)}</Box>
              </Grid>

              <Grid item xs={6} sm={4}>
                <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>
                  Preferred Go-Live Date
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1E293B' }}>
                  {formatDate(item.preferred_go_live_date || item.required_by_date)}
                </Typography>
              </Grid>

              <Grid item xs={6} sm={4}>
                <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>
                  Date of Request
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1E293B' }}>
                  {formatDate(item.date_of_request || item.created_at)}
                </Typography>
              </Grid>

              {item.affected_users_teams && item.affected_users_teams.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                    Affected Users / Teams
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                    {item.affected_users_teams.map((t) => (
                      <Chip key={t} label={t} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.72rem', bgcolor: '#F1F5F9' }} />
                    ))}
                  </Box>
                </Grid>
              )}
            </Grid>
          </Paper>

          <Box sx={{ overflowY: 'auto', flex: 1, pr: 0.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Business Problem */}
            <Paper elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: '10px', bgcolor: '#ffffff' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F172A', mb: 1 }}>
                2 — BUSINESS PROBLEM / NEED
              </Typography>
              <Typography variant="body2" sx={{ color: '#334155', whitespace: 'pre-wrap', lineHeight: 1.6 }}>
                {item.business_problem || item.justification || 'No business problem specified.'}
              </Typography>
            </Paper>

            {/* Process Flow */}
            <Paper elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: '10px', bgcolor: '#ffffff' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F172A', mb: 1 }}>
                3 — PROCESS FLOW & FLOWCHART
              </Typography>
              <Typography variant="body2" sx={{ color: '#334155', whitespace: 'pre-wrap', lineHeight: 1.6, mb: 1.5 }}>
                {item.step_by_step_flow || item.specifications || 'No process flow detailed.'}
              </Typography>

              {item.flowchart_files && item.flowchart_files.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
                    Attached Flowchart Files ({item.flowchart_files.length})
                  </Typography>
                  {item.flowchart_files.map((file) => (
                    <Paper key={file.id} variant="outlined" sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#F8FAFC', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FileText size={18} color="#04552B" />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{file.name}</Typography>
                          <Typography variant="caption" color="textSecondary">{(file.size / 1024).toFixed(1)} KB</Typography>
                        </Box>
                      </Box>
                      <Button size="small" startIcon={<Download size={14} />} onClick={() => handleDownload(file)} sx={{ textTransform: 'none', color: '#04552B', fontWeight: 600 }}>
                        Download
                      </Button>
                    </Paper>
                  ))}
                </Box>
              )}
            </Paper>

            {/* IT Mock-Up / Preview */}
            <Paper elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: '10px', bgcolor: '#ffffff' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F172A', mb: 1 }}>
                4 — IT MOCK-UP & SCREEN PREVIEW
              </Typography>

              {item.mockup_files && item.mockup_files.length > 0 && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
                    Attached Mock-up Files ({item.mockup_files.length})
                  </Typography>
                  {item.mockup_files.map((file) => (
                    <Paper key={file.id} variant="outlined" sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#F8FAFC', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FileText size={18} color="#04552B" />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{file.name}</Typography>
                          <Typography variant="caption" color="textSecondary">{(file.size / 1024).toFixed(1)} KB</Typography>
                        </Box>
                      </Box>
                      <Button size="small" startIcon={<Download size={14} />} onClick={() => handleDownload(file)} sx={{ textTransform: 'none', color: '#04552B', fontWeight: 600 }}>
                        Download
                      </Button>
                    </Paper>
                  ))}
                </Box>
              )}

              {item.mockup_it_notes && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 700, display: 'block' }}>
                    IT Notes on Mock-up
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#334155' }}>
                    {item.mockup_it_notes}
                  </Typography>
                </Box>
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 700 }}>
                  Mock-up Approved by Requester:
                </Typography>
                <Chip
                  label={item.mockup_approved ? 'Approved (Yes)' : 'Changes Required (No)'}
                  size="small"
                  sx={{
                    bgcolor: item.mockup_approved ? '#DCFCE7' : '#FEE2E2',
                    color: item.mockup_approved ? '#15803D' : '#DC2626',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                  }}
                />
              </Box>

              {item.mockup_feedback && (
                <Box sx={{ mt: 1, p: 1.5, bgcolor: '#FFF1F2', borderRadius: '8px', border: '1px solid #FECDD3' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#991B1B', display: 'block' }}>
                    Requester Feedback:
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#991B1B' }}>
                    {item.mockup_feedback}
                  </Typography>
                </Box>
              )}
            </Paper>

            {/* Additional Requirements & Timeline */}
            <Paper elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: '10px', bgcolor: '#ffffff' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F172A', mb: 1 }}>
                5 — ADDITIONAL REQUIREMENTS & PROJECT TIMELINE
              </Typography>

              {item.additional_requirements && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 700, display: 'block' }}>
                    Additional Requirements
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#334155' }}>
                    {item.additional_requirements}
                  </Typography>
                </Box>
              )}

              {item.project_timeline && (
                <Box>
                  <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 700, display: 'block' }}>
                    Project Timeline & Phases
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#334155', whitespace: 'pre-wrap' }}>
                    {item.project_timeline}
                  </Typography>
                </Box>
              )}
            </Paper>

            {/* Approvals & Sign-off Audit */}
            <Paper elevation={0} sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: '10px', bgcolor: '#ffffff' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F172A', mb: 1.5 }}>
                7 — APPROVALS & SIGN-OFF
              </Typography>

              <Grid container spacing={1.5}>
                <Grid item xs={6} sm={3}>
                  <Paper variant="outlined" sx={{ p: 1, bgcolor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#15803D', display: 'block' }}>
                      A. RAISED BY
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{item.requested_by}</Typography>
                    <Typography variant="caption" color="textSecondary">{formatDate(item.date_of_request || item.created_at)}</Typography>
                  </Paper>
                </Grid>

                <Grid item xs={6} sm={3}>
                  <Paper variant="outlined" sx={{ p: 1, bgcolor: item.status === 'SUBMITTED' ? '#FEF3C7' : '#F8FAFC' }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#334155', display: 'block' }}>
                      B. MANAGER
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.status === 'SUBMITTED' ? 'Pending Approval' : 'Approved'}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={6} sm={3}>
                  <Paper variant="outlined" sx={{ p: 1, bgcolor: item.status === 'MANAGER_APPROVAL' ? '#FEF3C7' : '#F8FAFC' }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#334155', display: 'block' }}>
                      C. IT REVIEW
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.status === 'IT_MANAGER_REVIEW' ? 'In Review' : 'Verified'}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={6} sm={3}>
                  <Paper variant="outlined" sx={{ p: 1, bgcolor: item.status === 'DEPT_HEAD_APPROVAL' ? '#FEF3C7' : '#F8FAFC' }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#334155', display: 'block' }}>
                      D. DEPT HEAD
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.status === 'COMPLETED' ? 'Approved' : 'Pending'}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {item.rejection_reason && (
                <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#FEE2E2', borderRadius: '8px', border: '1px solid #FCA5A5' }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#991B1B', display: 'block' }}>
                    Rejection Reason:
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#991B1B', fontWeight: 600 }}>
                    {item.rejection_reason}
                  </Typography>
                </Box>
              )}
            </Paper>
          </Box>

          {/* Action Bar */}
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {canApprove && item.status !== 'REJECTED' && item.status !== 'COMPLETED' && (
              <>
                <Button
                  variant="contained"
                  color="success"
                  size="small"
                  startIcon={<CheckCircle2 size={16} />}
                  onClick={() => {
                    const nextStageMap: Record<string, string> = {
                      DRAFT: 'SUBMITTED',
                      SUBMITTED: 'MANAGER_APPROVAL',
                      MANAGER_APPROVAL: 'IT_MANAGER_REVIEW',
                      IT_MANAGER_REVIEW: 'DEPT_HEAD_APPROVAL',
                      DEPT_HEAD_APPROVAL: 'IT_PROCESSING',
                      IT_PROCESSING: 'COMPLETED',
                    };
                    const next = nextStageMap[item.status] || 'COMPLETED';
                    onUpdateStatus(item.id, next);
                  }}
                  sx={{ bgcolor: '#04552B', '&:hover': { bgcolor: '#034120' }, textTransform: 'none', fontWeight: 700 }}
                >
                  Advance Approval Stage
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<XCircle size={16} />}
                  onClick={() => setRejectModalOpen(true)}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Reject Request
                </Button>
              </>
            )}

            <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
              {canEdit && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Edit3 size={16} />}
                  onClick={() => {
                    onClose();
                    onEdit(item);
                  }}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Edit
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<Trash2 size={16} />}
                  onClick={() => onDelete(item.id)}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Delete
                </Button>
              )}
            </Box>
          </Box>
        </Box>
      </Drawer>

      {/* Reject Reason Prompt Modal */}
      <Dialog open={rejectModalOpen} onClose={() => setRejectModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#DC2626' }}>
          Reject IT Requirement Request
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 1.5, color: '#475569' }}>
            Please provide a specific reason for rejecting requisition <strong>{item.id}</strong>.
          </Typography>
          <TextField
            fullWidth
            required
            multiline
            rows={3}
            label="Rejection Reason *"
            placeholder="Explain why this request is being rejected..."
            value={rejectionReasonInput}
            onChange={(e) => setRejectionReasonInput(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5 }}>
          <Button onClick={() => setRejectModalOpen(false)} sx={{ color: '#64748B' }}>
            Cancel
          </Button>
          <Button
            onClick={handleRejectSubmit}
            variant="contained"
            color="error"
            disabled={!rejectionReasonInput.trim()}
          >
            Confirm Rejection
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
