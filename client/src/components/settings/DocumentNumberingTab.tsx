import React, { useState, useMemo } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Hash,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Info,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

import {
  useGetDocumentSequencesQuery,
  useCreateDocumentSequenceMutation,
  useUpdateDocumentSequenceMutation,
  useDeleteDocumentSequenceMutation,
} from '@/api/documentNumberingApi';
import type {
  DocumentSequence,
  DocumentSequenceCreateInput,
  DocumentSequenceUpdateInput,
} from '@/types';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/ToastHost';

const PROTECTED_TYPES = ['complaint'];

const DATE_TOKENS = [
  { token: '{YYYY}', desc: '4-digit Year (e.g. 2026)' },
  { token: '{YY}', desc: '2-digit Year (e.g. 26)' },
  { token: '{MM}', desc: '2-digit Month (e.g. 10)' },
  { token: '{DD}', desc: '2-digit Day (e.g. 28)' },
  { token: '{YYYYMMDD}', desc: 'Date (e.g. 20261028)' },
  { token: '{YYYYMM}', desc: 'Year-Month (e.g. 202610)' },
];

function resolveClientTokens(str: string): string {
  if (!str) return '';
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const yy = yyyy.slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  return str
    .replace(/\{YYYYMMDD\}/g, `${yyyy}${mm}${dd}`)
    .replace(/\{YYYYMM\}/g, `${yyyy}${mm}`)
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yy)
    .replace(/\{MM\}/g, mm)
    .replace(/\{DD\}/g, dd);
}

function calculatePreview(prefix: string, padding: number, nextNumber: number, suffix: string): string {
  const resolvedPrefix = resolveClientTokens(prefix || '');
  const resolvedSuffix = resolveClientTokens(suffix || '');
  const safePad = Math.max(1, Math.min(12, Number(padding) || 4));
  const safeNum = Math.max(0, Number(nextNumber) || 1);
  const padded = String(safeNum).padStart(safePad, '0');
  return `${resolvedPrefix}${padded}${resolvedSuffix}`;
}

export default function DocumentNumberingTab() {
  const { showToast } = useToast();
  const { data: sequences = [], isLoading, isFetching } = useGetDocumentSequencesQuery();
  const [updateSequence, { isLoading: isUpdating }] = useUpdateDocumentSequenceMutation();
  const [createSequence, { isLoading: isCreating }] = useCreateDocumentSequenceMutation();
  const [deleteSequence, { isLoading: isDeleting }] = useDeleteDocumentSequenceMutation();

  // Edit State
  const [editingItem, setEditingItem] = useState<DocumentSequence | null>(null);
  const [editForm, setEditForm] = useState<DocumentSequenceUpdateInput>({
    name: '',
    description: '',
    prefix: '',
    padding: 4,
    next_number: 1,
    suffix: '',
    is_active: true,
  });

  // Create State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<DocumentSequenceCreateInput>({
    document_type: '',
    name: '',
    description: '',
    prefix: '',
    padding: 4,
    next_number: 1,
    suffix: '',
    is_active: true,
  });

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<DocumentSequence | null>(null);

  const editPreview = useMemo(() => {
    return calculatePreview(
      editForm.prefix || '',
      editForm.padding || 4,
      editForm.next_number || 1,
      editForm.suffix || ''
    );
  }, [editForm.prefix, editForm.padding, editForm.next_number, editForm.suffix]);

  const createPreview = useMemo(() => {
    return calculatePreview(
      createForm.prefix || '',
      createForm.padding || 4,
      createForm.next_number || 1,
      createForm.suffix || ''
    );
  }, [createForm.prefix, createForm.padding, createForm.next_number, createForm.suffix]);

  const handleOpenEdit = (item: DocumentSequence) => {
    setEditingItem(item);
    setEditForm({
      name: item.name,
      description: item.description || '',
      prefix: item.prefix,
      padding: item.padding,
      next_number: item.next_number,
      suffix: item.suffix || '',
      is_active: item.is_active,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      await updateSequence({
        document_type: editingItem.document_type,
        data: editForm,
      }).unwrap();
      showToast(`Document numbering for "${editingItem.name}" updated successfully`, 'success');
      setEditingItem(null);
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to update document numbering sequence', 'error');
    }
  };

  const handleSaveCreate = async () => {
    if (!createForm.document_type.trim()) {
      showToast('Document Type code is required', 'error');
      return;
    }
    if (!createForm.name.trim()) {
      showToast('Document Name is required', 'error');
      return;
    }

    try {
      await createSequence({
        ...createForm,
        document_type: createForm.document_type.trim().toLowerCase(),
        name: createForm.name.trim(),
        prefix: createForm.prefix?.trim() || '',
        suffix: createForm.suffix?.trim() || '',
      }).unwrap();
      showToast('New document sequence created successfully', 'success');
      setCreateDialogOpen(false);
      setCreateForm({
        document_type: '',
        name: '',
        description: '',
        prefix: '',
        padding: 4,
        next_number: 1,
        suffix: '',
        is_active: true,
      });
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to create document sequence', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSequence(deleteTarget.document_type).unwrap();
      showToast(`Sequence "${deleteTarget.name}" deleted successfully`, 'success');
      setDeleteTarget(null);
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to delete sequence', 'error');
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header Card */}
      <Paper
        elevation={0}
        sx={{
          border: '1px solid #E4EBE1',
          borderRadius: '14px',
          p: 2.5,
          backgroundColor: '#FFFFFF',
          mb: 2.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: '10px',
                  backgroundColor: '#F0FDF4',
                  color: '#023020',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #DCFCE7',
                }}
              >
                <Hash size={20} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#023020', fontSize: 18 }}>
                Document Numbering Framework
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: '#667A6D', fontSize: 13.5, maxWidth: 750 }}>
              Centrally configure auto-generated identifier formats, custom prefixes, zero padding lengths,
              and sequence counters for Complaints, Work Orders, and other system records.
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{
              backgroundColor: '#023020',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: 13,
              textTransform: 'none',
              borderRadius: '8px',
              px: 2,
              py: 1,
              '&:hover': { backgroundColor: '#034732' },
            }}
          >
            New Document Sequence
          </Button>
        </Box>
      </Paper>

      {/* Main Table / Content Card */}
      <Paper
        elevation={0}
        sx={{
          border: '1px solid #E4EBE1',
          borderRadius: '14px',
          backgroundColor: '#FFFFFF',
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
            <CircularProgress size={32} sx={{ color: '#023020' }} />
          </Box>
        ) : sequences.length === 0 ? (
          <EmptyState
            title="No document sequences found"
            hint="Click 'New Document Sequence' to configure an automated numbering sequence."
          />
        ) : (
          <TableContainer>
            <Table sx={{ minWidth: 700 }}>
              <TableHead sx={{ backgroundColor: '#F8FAF8' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: '#667A6D', fontSize: 12.5, py: 1.5 }}>
                    DOCUMENT TYPE & NAME
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#667A6D', fontSize: 12.5, py: 1.5 }}>
                    LIVE FORMAT PREVIEW
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#667A6D', fontSize: 12.5, py: 1.5 }}>
                    PREFIX
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#667A6D', fontSize: 12.5, py: 1.5 }}>
                    PADDING
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#667A6D', fontSize: 12.5, py: 1.5 }}>
                    NEXT NUMBER
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#667A6D', fontSize: 12.5, py: 1.5 }}>
                    STATUS
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#667A6D', fontSize: 12.5, py: 1.5 }}>
                    ACTIONS
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sequences.map((seq) => {
                  const isProtected = PROTECTED_TYPES.includes(seq.document_type);
                  return (
                    <TableRow
                      key={seq.id}
                      hover
                      sx={{
                        '&:last-child td, &:last-child th': { border: 0 },
                        borderBottom: '1px solid #E4EBE1',
                      }}
                    >
                      <TableCell sx={{ py: 2 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Typography sx={{ fontWeight: 700, color: '#023020', fontSize: 14 }}>
                            {seq.name}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={seq.document_type}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: 11,
                                fontWeight: 600,
                                fontFamily: 'monospace',
                                backgroundColor: '#F1F5F9',
                                color: '#475569',
                                borderRadius: '4px',
                              }}
                            />
                            {seq.description && (
                              <Typography variant="caption" sx={{ color: '#667A6D', fontSize: 12 }}>
                                {seq.description}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>

                      <TableCell sx={{ py: 2 }}>
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 1,
                            backgroundColor: '#F0FDF4',
                            border: '1px solid #BBF7D0',
                            borderRadius: '6px',
                            px: 1.5,
                            py: 0.5,
                          }}
                        >
                          <Sparkles size={13} color="#16A34A" />
                          <Typography
                            sx={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              fontSize: 13,
                              color: '#15803D',
                              letterSpacing: 0.5,
                            }}
                          >
                            {seq.sample_preview}
                          </Typography>
                        </Box>
                      </TableCell>

                      <TableCell sx={{ py: 2 }}>
                        <Typography sx={{ fontFamily: 'monospace', fontWeight: 600, color: '#334155', fontSize: 13 }}>
                          {seq.prefix || '—'}
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ py: 2 }}>
                        <Typography sx={{ color: '#334155', fontSize: 13 }}>
                          {seq.padding} digits
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ py: 2 }}>
                        <Chip
                          label={seq.next_number}
                          size="small"
                          sx={{
                            fontWeight: 700,
                            fontSize: 12,
                            backgroundColor: '#E2E8F0',
                            color: '#1E293B',
                            borderRadius: '6px',
                          }}
                        />
                      </TableCell>

                      <TableCell sx={{ py: 2 }}>
                        <Chip
                          label={seq.is_active ? 'Active' : 'Inactive'}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            fontSize: 11.5,
                            backgroundColor: seq.is_active ? '#DCFCE7' : '#F1F5F9',
                            color: seq.is_active ? '#15803D' : '#64748B',
                            border: seq.is_active ? '1px solid #BBF7D0' : '1px solid #E2E8F0',
                            borderRadius: '6px',
                          }}
                        />
                      </TableCell>

                      <TableCell align="right" sx={{ py: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Pencil size={13} />}
                            onClick={() => handleOpenEdit(seq)}
                            sx={{
                              textTransform: 'none',
                              fontSize: 12.5,
                              fontWeight: 600,
                              borderColor: '#E4EBE1',
                              color: '#023020',
                              borderRadius: '6px',
                              px: 1.5,
                              py: 0.5,
                              '&:hover': {
                                borderColor: '#023020',
                                backgroundColor: '#F8FAF8',
                              },
                            }}
                          >
                            Configure
                          </Button>

                          {!isProtected && (
                            <Tooltip title="Delete custom sequence">
                              <IconButton
                                size="small"
                                onClick={() => setDeleteTarget(seq)}
                                sx={{ color: '#94A3B8', '&:hover': { color: '#EF4444' } }}
                              >
                                <Trash2 size={15} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Edit Configuration Dialog */}
      <Dialog
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: '16px', p: 1 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#023020', fontSize: 17, pb: 1 }}>
          Configure Document Sequence: {editingItem?.name}
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
            {/* Live Preview Callout */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '10px',
                backgroundColor: '#F0FDF4',
                border: '1px solid #BBF7D0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography variant="caption" sx={{ color: '#166534', fontWeight: 600, display: 'block', mb: 0.3 }}>
                  NEXT GENERATED IDENTIFIER PREVIEW
                </Typography>
                <Typography
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    fontSize: 20,
                    color: '#14532D',
                    letterSpacing: 1,
                  }}
                >
                  {editPreview}
                </Typography>
              </Box>
              <Chip
                icon={<Sparkles size={14} color="#15803D" />}
                label="Live Dynamic Format"
                size="small"
                sx={{
                  backgroundColor: '#DCFCE7',
                  color: '#15803D',
                  fontWeight: 600,
                  fontSize: 11,
                }}
              />
            </Paper>

            {/* Name */}
            <TextField
              label="Document Name"
              size="small"
              fullWidth
              value={editForm.name || ''}
              onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
            />

            {/* Prefix */}
            <Box>
              <TextField
                label="Prefix"
                size="small"
                fullWidth
                value={editForm.prefix || ''}
                onChange={(e) => setEditForm((prev) => ({ ...prev, prefix: e.target.value }))}
                placeholder="e.g. VC- or VC-{YYYYMMDD}-"
                helperText="Fixed text or dynamic date tokens preceding the counter"
              />
              {/* Token quick insert chips */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mt: 1, alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#667A6D', fontSize: 11, fontWeight: 600, mr: 0.5 }}>
                  Date Tokens:
                </Typography>
                {DATE_TOKENS.map((t) => (
                  <Tooltip key={t.token} title={t.desc}>
                    <Chip
                      label={t.token}
                      size="small"
                      clickable
                      onClick={() =>
                        setEditForm((prev) => ({
                          ...prev,
                          prefix: (prev.prefix || '') + t.token,
                        }))
                      }
                      sx={{
                        fontSize: 11,
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        backgroundColor: '#F8FAF8',
                        border: '1px solid #E2E8F0',
                        '&:hover': { backgroundColor: '#E2E8F0' },
                      }}
                    />
                  </Tooltip>
                ))}
              </Box>
            </Box>

            {/* Padding and Next Number in two columns */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Zero Padding (Digits)"
                type="number"
                size="small"
                fullWidth
                inputProps={{ min: 1, max: 12 }}
                value={editForm.padding || 4}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    padding: Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 1)),
                  }))
                }
                helperText="e.g. 4 digits produces '0001'"
              />

              <TextField
                label="Next Sequence Number"
                type="number"
                size="small"
                fullWidth
                inputProps={{ min: 1 }}
                value={editForm.next_number || 1}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    next_number: Math.max(1, parseInt(e.target.value, 10) || 1),
                  }))
                }
                helperText="Counter for next document"
              />
            </Box>

            {/* Suffix */}
            <TextField
              label="Suffix (Optional)"
              size="small"
              fullWidth
              value={editForm.suffix || ''}
              onChange={(e) => setEditForm((prev) => ({ ...prev, suffix: e.target.value }))}
              placeholder="e.g. -IN or /A"
              helperText="Optional characters appended after the sequence number"
            />

            {/* Description */}
            <TextField
              label="Description"
              size="small"
              fullWidth
              multiline
              rows={2}
              value={editForm.description || ''}
              onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
            />

            {/* Active Toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={editForm.is_active ?? true}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  color="success"
                />
              }
              label={
                <Box>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#023020' }}>
                    Active Sequence Generator
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#667A6D', display: 'block' }}>
                    When enabled, newly created documents use this sequence rule.
                  </Typography>
                </Box>
              }
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setEditingItem(null)}
            sx={{ textTransform: 'none', color: '#64748B', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={isUpdating}
            sx={{
              backgroundColor: '#023020',
              color: '#FFFFFF',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: '8px',
              px: 2.5,
              '&:hover': { backgroundColor: '#034732' },
            }}
          >
            {isUpdating ? <CircularProgress size={18} sx={{ color: '#FFFFFF' }} /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create New Sequence Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: '16px', p: 1 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#023020', fontSize: 17, pb: 1 }}>
          Create New Document Sequence
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
            {/* Live Preview Callout */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '10px',
                backgroundColor: '#F0FDF4',
                border: '1px solid #BBF7D0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography variant="caption" sx={{ color: '#166534', fontWeight: 600, display: 'block', mb: 0.3 }}>
                  GENERATED IDENTIFIER PREVIEW
                </Typography>
                <Typography
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    fontSize: 20,
                    color: '#14532D',
                    letterSpacing: 1,
                  }}
                >
                  {createPreview}
                </Typography>
              </Box>
              <Chip
                icon={<Sparkles size={14} color="#15803D" />}
                label="Live Preview"
                size="small"
                sx={{
                  backgroundColor: '#DCFCE7',
                  color: '#15803D',
                  fontWeight: 600,
                  fontSize: 11,
                }}
              />
            </Paper>

            {/* Document Type Code and Name */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Document Type Code"
                size="small"
                required
                fullWidth
                value={createForm.document_type}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    document_type: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
                  }))
                }
                placeholder="e.g. invoice, work_order"
                helperText="Unique system identifier code"
              />

              <TextField
                label="Document Name"
                size="small"
                required
                fullWidth
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Customer Invoice"
                helperText="Human readable title"
              />
            </Box>

            {/* Prefix */}
            <Box>
              <TextField
                label="Prefix"
                size="small"
                fullWidth
                value={createForm.prefix}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, prefix: e.target.value }))}
                placeholder="e.g. INV- or INV-{YYYY}-"
                helperText="Fixed text or date tokens preceding the counter"
              />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mt: 1, alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#667A6D', fontSize: 11, fontWeight: 600, mr: 0.5 }}>
                  Date Tokens:
                </Typography>
                {DATE_TOKENS.map((t) => (
                  <Tooltip key={t.token} title={t.desc}>
                    <Chip
                      label={t.token}
                      size="small"
                      clickable
                      onClick={() =>
                        setCreateForm((prev) => ({
                          ...prev,
                          prefix: (prev.prefix || '') + t.token,
                        }))
                      }
                      sx={{
                        fontSize: 11,
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        backgroundColor: '#F8FAF8',
                        border: '1px solid #E2E8F0',
                        '&:hover': { backgroundColor: '#E2E8F0' },
                      }}
                    />
                  </Tooltip>
                ))}
              </Box>
            </Box>

            {/* Padding and Next Number */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Zero Padding (Digits)"
                type="number"
                size="small"
                fullWidth
                inputProps={{ min: 1, max: 12 }}
                value={createForm.padding}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    padding: Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 1)),
                  }))
                }
                helperText="e.g. 4 digits produces '0001'"
              />

              <TextField
                label="Starting Sequence Number"
                type="number"
                size="small"
                fullWidth
                inputProps={{ min: 1 }}
                value={createForm.next_number}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    next_number: Math.max(1, parseInt(e.target.value, 10) || 1),
                  }))
                }
                helperText="Initial counter value (usually 1)"
              />
            </Box>

            {/* Suffix */}
            <TextField
              label="Suffix (Optional)"
              size="small"
              fullWidth
              value={createForm.suffix}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, suffix: e.target.value }))}
              placeholder="e.g. -IN or /26"
            />

            {/* Description */}
            <TextField
              label="Description"
              size="small"
              fullWidth
              multiline
              rows={2}
              value={createForm.description}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Explain where this numbering sequence is utilized"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setCreateDialogOpen(false)}
            sx={{ textTransform: 'none', color: '#64748B', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveCreate}
            disabled={isCreating}
            sx={{
              backgroundColor: '#023020',
              color: '#FFFFFF',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: '8px',
              px: 2.5,
              '&:hover': { backgroundColor: '#034732' },
            }}
          >
            {isCreating ? <CircularProgress size={18} sx={{ color: '#FFFFFF' }} /> : 'Create Sequence'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertTriangle size={20} /> Delete Document Sequence
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#475569', fontSize: 13.5 }}>
            Are you sure you want to delete the document sequence configuration for{' '}
            <strong>{deleteTarget?.name}</strong> ({deleteTarget?.document_type})?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 1.5 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ textTransform: 'none', color: '#64748B' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
          >
            {isDeleting ? <CircularProgress size={16} sx={{ color: '#FFF' }} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
