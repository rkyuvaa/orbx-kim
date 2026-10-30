import { useEffect, useState } from 'react';
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  TextField,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { useAppSelector } from '@/app/hooks';
import { usePermission } from '@/context/AuthPermissionContext';
import {
  useCreateDropdownOptionMutation,
  useDeleteDropdownOptionMutation,
  useDropdownOptionsQuery,
  useUpdateDropdownOptionMutation,
} from '@/api/mastersApi';
import EmptyState from '@/components/ui/EmptyState';
import { LoadingRows } from '@/components/ui/PageState';
import { useToast } from '@/components/ui/ToastHost';
import type { CrmDropdownOption } from '@/types';

const optionSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  value: z.string().optional(),
  order_index: z.coerce.number().default(0),
});

type OptionFormValues = z.infer<typeof optionSchema>;

interface DropdownOptionsPanelProps {
  category: string;
  title: string;
  singularTitle: string;
  description: string;
  placeholder?: string;
}

export default function DropdownOptionsPanel({
  category,
  title,
  singularTitle,
  description,
  placeholder = 'e.g. Standard',
}: DropdownOptionsPanelProps) {
  const { can, isSuperAdmin } = usePermission();
  const isAdmin = isSuperAdmin || can('edit', 'crm_configuration') || can('create', 'crm_configuration');
  const { data: options = [], isFetching, isError, refetch } = useDropdownOptionsQuery(category);
  const [createOption, { isLoading: creating }] = useCreateDropdownOptionMutation();
  const [updateOption, { isLoading: updating }] = useUpdateDropdownOptionMutation();
  const [deleteOption] = useDeleteDropdownOptionMutation();
  const { showToast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CrmDropdownOption | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CrmDropdownOption | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OptionFormValues>({
    resolver: zodResolver(optionSchema),
    defaultValues: { label: '', value: '', order_index: 0 },
  });

  const watchLabel = watch('label');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      reset({
        label: editing.label,
        value: editing.value,
        order_index: editing.order_index,
      });
    } else {
      reset({ label: '', value: '', order_index: options.length + 1 });
    }
  }, [editing, reset, options.length]);

  const openCreate = () => {
    setEditing(null);
    reset({ label: '', value: '', order_index: options.length + 1 });
    setDialogOpen(true);
  };

  const openEdit = (opt: CrmDropdownOption) => {
    setEditing(opt);
    reset({
      label: opt.label,
      value: opt.value,
      order_index: opt.order_index,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: OptionFormValues) => {
    const rawVal = values.value?.trim() || values.label.trim().toLowerCase().replace(/\s+/g, '_');
    try {
      if (editing) {
        await updateOption({
          id: editing.id,
          body: {
            label: values.label.trim(),
            value: rawVal,
            order_index: Number(values.order_index) || 0,
          },
        }).unwrap();
        showToast(`${singularTitle} updated`, 'success');
      } else {
        await createOption({
          category,
          label: values.label.trim(),
          value: rawVal,
          order_index: Number(values.order_index) || 0,
        }).unwrap();
        showToast(`${singularTitle} created`, 'success');
      }
      setDialogOpen(false);
      reset();
    } catch (err: any) {
      const detail = err?.data?.detail;
      showToast(detail ?? `Could not save ${singularTitle.toLowerCase()}`, 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteOption(deleteTarget.id).unwrap();
      showToast(`${deleteTarget.label} deleted`, 'success');
    } catch (err: any) {
      const detail = err?.data?.detail;
      showToast(detail ?? `Could not delete ${singularTitle.toLowerCase()}`, 'error');
    }
    setDeleteTarget(null);
  };

  return (
    <>
      <Paper sx={{ border: '1px solid #E4EBE1', borderRadius: '14px', overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            padding: '13px 16px',
            borderBottom: '1px solid #E4EBE1',
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#16231B' }}>{title}</div>
            <div style={{ fontSize: 12, color: '#7A8B80', marginTop: 2 }}>{description}</div>
          </div>
          {isAdmin && (
            <Button variant="contained" size="small" startIcon={<Plus size={16} />} onClick={openCreate}>
              Add {singularTitle}
            </Button>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          {isFetching && options.length === 0 ? (
            <LoadingRows rows={4} />
          ) : isError ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <Button variant="outlined" onClick={() => refetch()}>
                Retry loading {title.toLowerCase()}
              </Button>
            </div>
          ) : options.length === 0 ? (
            <EmptyState
              title={`No ${title.toLowerCase()} yet`}
              hint={isAdmin ? `Click 'Add ${singularTitle}' to configure options used in Lead capture.` : `Contact an admin to configure ${title.toLowerCase()}.`}
            />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr>
                  {['Display Label', 'Option Value / Key', 'Order', 'Status', ...(isAdmin ? ['Actions'] : [])].map((h) => (
                    <th
                      key={h}
                      style={{
                        background: '#F2FAF0',
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#7A8B80',
                        textTransform: 'uppercase',
                        letterSpacing: 0.6,
                        textAlign: 'left',
                        padding: '10px 16px',
                        borderBottom: '1px solid #E4EBE1',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {options.map((opt) => (
                  <tr key={opt.id}>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F0F4EE', fontWeight: 600, color: '#16231B' }}>
                      {opt.label}
                    </td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F0F4EE', color: '#44584C', fontFamily: 'monospace', fontSize: 12 }}>
                      {opt.value}
                    </td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F0F4EE', color: '#44584C' }}>
                      {opt.order_index}
                    </td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F0F4EE' }}>
                      <Chip
                        size="small"
                        label={opt.is_active ? 'Active' : 'Inactive'}
                        sx={{
                          height: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          bgcolor: opt.is_active ? '#EAF8ED' : '#F4F4F4',
                          color: opt.is_active ? '#15803D' : '#64748B',
                        }}
                      />
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F0F4EE', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                          <IconButton size="small" aria-label={`Edit ${opt.label}`} onClick={() => openEdit(opt)}>
                            <Pencil size={15} />
                          </IconButton>
                          <IconButton size="small" aria-label={`Delete ${opt.label}`} onClick={() => setDeleteTarget(opt)}>
                            <Trash2 size={15} color="#DC2626" />
                          </IconButton>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Paper>

      {/* Add / Edit Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        fullWidth 
        maxWidth="xs"
        PaperProps={{
          sx: {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            maxHeight: 'calc(100vh - 64px)',
            overflow: 'auto',
            zIndex: 1300,
            width: 'calc(100% - 32px)',
            maxWidth: '450px !important'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editing ? `Edit ${singularTitle}` : `Add ${singularTitle}`}
        </DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <TextField
              fullWidth
              label="Display Label"
              placeholder={placeholder}
              margin="dense"
              error={Boolean(errors.label)}
              helperText={errors.label?.message}
              {...register('label')}
            />
            <TextField
              fullWidth
              label="Option Key / Code (optional)"
              placeholder={watchLabel ? watchLabel.toLowerCase().replace(/\s+/g, '_') : 'auto_generated'}
              margin="dense"
              helperText="Internal value stored in database; auto-generated if left empty."
              {...register('value')}
            />
            <TextField
              fullWidth
              label="Display Order"
              type="number"
              margin="dense"
              {...register('order_index')}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={creating || updating}>
              {editing ? 'Save Changes' : `Add ${singularTitle}`}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog 
        open={Boolean(deleteTarget)} 
        onClose={() => setDeleteTarget(null)} 
        maxWidth="xs" 
        fullWidth
        PaperProps={{
          sx: {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            maxHeight: 'calc(100vh - 64px)',
            overflow: 'auto',
            zIndex: 1300,
            width: 'calc(100% - 32px)',
            maxWidth: '400px !important'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete {singularTitle.toLowerCase()}?</DialogTitle>
        <DialogContent>
          Are you sure you want to delete &quot;{deleteTarget?.label}&quot;? Existing leads with this option will keep their captured text.
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
