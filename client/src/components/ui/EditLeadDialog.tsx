import { useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useUpdateApplicationMutation } from '@/api/applicationsApi';
import {
  useDropdownOptionsQuery,
  useUsersQuery,
  useVehicleModelsQuery,
} from '@/api/mastersApi';
import { useToast } from '@/components/ui/ToastHost';
import { formatDate } from '@/utils/format';
import type { ApplicationItem } from '@/types';

export const editSchema = z.object({
  customer_name: z.string().min(2, 'Customer name is required'),
  customer_phone: z.string().min(8, 'Valid phone number required').max(20),
  vehicle_number: z.string().optional(),
  vehicle_model_id: z.string().optional(),
  vehicle_year: z.string().optional(),
  fuel_type: z.string().optional(),
  customer_status: z.string().optional(),
  lead_source: z.string().optional(),
  coupon_code: z.string().optional(),
  assigned_to: z.string().optional(),
  lost_reason: z.string().optional(),
});

export type EditForm = z.infer<typeof editSchema>;

interface EditLeadDialogProps {
  open: boolean;
  onClose: () => void;
  lead: ApplicationItem | null;
}

export default function EditLeadDialog({ open, onClose, lead }: EditLeadDialogProps) {
  const [updateApplication, { isLoading }] = useUpdateApplicationMutation();

  const { data: models = [], isFetching: loadingModels } = useVehicleModelsQuery();
  const { data: fuelTypes = [] } = useDropdownOptionsQuery('fuel_type');
  const { data: customerStatuses = [] } = useDropdownOptionsQuery('customer_status');
  const { data: sources = [] } = useDropdownOptionsQuery('lead_source');
  const { data: lostReasons = [] } = useDropdownOptionsQuery('lost_reason');
  const { data: users = [] } = useUsersQuery();

  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });

  const modelId = watch('vehicle_model_id');
  const selectedFuelType = watch('fuel_type');
  const selectedCustomerStatus = watch('customer_status');
  const selectedSource = watch('lead_source');
  const selectedAssignedTo = watch('assigned_to');
  const selectedLostReason = watch('lost_reason');

  useEffect(() => {
    if (!lead || !open) {
      reset();
      return;
    }

    reset({
      customer_name: lead.customer_name || '',
      customer_phone: lead.customer_phone || '',
      vehicle_number: lead.vehicle_number || '',
      vehicle_model_id: lead.vehicle_model_id ? String(lead.vehicle_model_id) : '',
      vehicle_year: lead.vehicle_year || '',
      fuel_type: lead.fuel_type || '',
      customer_status: lead.customer_status || '',
      lead_source: lead.lead_source || '',
      coupon_code: lead.coupon_code || '',
      assigned_to: lead.assigned_to ? String(lead.assigned_to) : '',
      lost_reason: lead.lost_reason || '',
    });
  }, [lead, open, reset]);

  const selectedModel = models.find((m) => String(m.id) === modelId);

  const onSubmit = async (values: EditForm) => {
    if (!lead) return;
    try {
      await updateApplication({
        id: lead.id,
        body: {
          customer_name: values.customer_name,
          customer_phone: values.customer_phone,
          vehicle: selectedModel?.name ?? lead.vehicle,
          vehicle_number: values.vehicle_number?.trim() || null,
          vehicle_model_id: values.vehicle_model_id ? Number(values.vehicle_model_id) : null,
          vehicle_year: values.vehicle_year?.trim() || null,
          fuel_type: values.fuel_type || null,
          customer_status: values.customer_status || null,
          lead_source: values.lead_source || null,
          coupon_code: values.coupon_code?.trim() || null,
          assigned_to: values.assigned_to ? Number(values.assigned_to) : null,
          lost_reason: values.lost_reason || null,
        },
      }).unwrap();
      showToast(`Lead ${lead.app_no} updated successfully`, 'success');
      reset();
      onClose();
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: unknown } })?.data?.detail;
      const errorMsg =
        typeof detail === 'string'
          ? detail
          : typeof detail === 'object' && detail !== null
          ? JSON.stringify(detail)
          : 'Could not update the lead';
      showToast(errorMsg, 'error');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Edit Lead ({lead?.app_no})</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={{ pt: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 1. Customer Name & 2. Phone Number */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <TextField
                fullWidth
                size="small"
                label="1. Customer Name *"
                placeholder="Enter customer full name"
                error={Boolean(errors.customer_name)}
                helperText={errors.customer_name?.message}
                {...register('customer_name')}
              />
              <TextField
                fullWidth
                size="small"
                label="2. Phone Number *"
                placeholder="Enter 10-digit mobile number"
                error={Boolean(errors.customer_phone)}
                helperText={errors.customer_phone?.message}
                {...register('customer_phone')}
              />
            </div>

            {/* 3. Vehicle Number & 4. Customer Vehicle Model */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <TextField
                fullWidth
                size="small"
                label="3. Vehicle Number"
                placeholder="e.g. MH 02 AB 1234"
                {...register('vehicle_number')}
              />
              <div>
                <Select
                  fullWidth
                  displayEmpty
                  size="small"
                  value={modelId || ''}
                  onChange={(e) => setValue('vehicle_model_id', String(e.target.value))}
                  renderValue={(val) =>
                    val
                      ? models.find((m) => String(m.id) === val)?.name ?? val
                      : '4. Customer Vehicle Model (Select)'
                  }
                >
                  <MenuItem value="">
                    <em>4. Customer Vehicle Model (Select)</em>
                  </MenuItem>
                  {loadingModels && <MenuItem disabled>Loading models…</MenuItem>}
                  {!loadingModels && models.length === 0 && (
                    <MenuItem disabled>No models configured — add in CRM Configuration</MenuItem>
                  )}
                  {models.map((m) => (
                    <MenuItem key={m.id} value={String(m.id)}>
                      {m.name}
                    </MenuItem>
                  ))}
                </Select>
              </div>
            </div>

            {/* 5. Vehicle Year & Fuel Type */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <TextField
                fullWidth
                size="small"
                label="5. Vehicle Year"
                placeholder="e.g. 2024"
                {...register('vehicle_year')}
              />
              <div>
                <Select
                  fullWidth
                  displayEmpty
                  size="small"
                  value={selectedFuelType || ''}
                  onChange={(e) => setValue('fuel_type', String(e.target.value))}
                  renderValue={(val) =>
                    val
                      ? fuelTypes.find((f) => f.value === val)?.label ?? val
                      : 'Fuel Type (Select)'
                  }
                >
                  <MenuItem value="">
                    <em>Fuel Type (Select)</em>
                  </MenuItem>
                  {fuelTypes.length === 0 && (
                    <MenuItem disabled>No fuel types configured — add in Configuration</MenuItem>
                  )}
                  {fuelTypes.map((f) => (
                    <MenuItem key={f.id} value={f.value}>
                      {f.label}
                    </MenuItem>
                  ))}
                </Select>
              </div>
            </div>

            {/* 6. Customer Status & Source */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Select
                  fullWidth
                  displayEmpty
                  size="small"
                  value={selectedCustomerStatus || ''}
                  onChange={(e) => setValue('customer_status', String(e.target.value))}
                  renderValue={(val) =>
                    val
                      ? customerStatuses.find((s) => s.value === val)?.label ?? val
                      : '6. Customer Status (Select)'
                  }
                >
                  <MenuItem value="">
                    <em>6. Customer Status (Select)</em>
                  </MenuItem>
                  {customerStatuses.length === 0 && (
                    <MenuItem disabled>No customer statuses configured — add in Configuration</MenuItem>
                  )}
                  {customerStatuses.map((s) => (
                    <MenuItem key={s.id} value={s.value}>
                      {s.label}
                    </MenuItem>
                  ))}
                </Select>
              </div>
              <div>
                <Select
                  fullWidth
                  displayEmpty
                  size="small"
                  value={selectedSource || ''}
                  onChange={(e) => setValue('lead_source', String(e.target.value))}
                  renderValue={(val) =>
                    val
                      ? sources.find((src) => src.value === val)?.label ?? val
                      : 'Source (Select)'
                  }
                >
                  <MenuItem value="">
                    <em>Source (Select)</em>
                  </MenuItem>
                  {sources.length === 0 && (
                    <MenuItem disabled>No sources configured — add in Configuration</MenuItem>
                  )}
                  {sources.map((src) => (
                    <MenuItem key={src.id} value={src.value}>
                      {src.label}
                    </MenuItem>
                  ))}
                </Select>
              </div>
            </div>

            {/* Coupon Code & Responsible */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <TextField
                fullWidth
                size="small"
                label="Coupon Code"
                placeholder="e.g. PROMO2026"
                {...register('coupon_code')}
              />
              <div>
                <Select
                  fullWidth
                  displayEmpty
                  size="small"
                  value={selectedAssignedTo || ''}
                  onChange={(e) => setValue('assigned_to', String(e.target.value))}
                  renderValue={(val) => {
                    if (!val) return 'Responsible (Select User)';
                    const matched = users.find((u) => String(u.id) === val);
                    return matched ? `${matched.full_name} (${matched.role})` : val;
                  }}
                >
                  <MenuItem value="">
                    <em>Responsible (Select User)</em>
                  </MenuItem>
                  {users.map((u) => (
                    <MenuItem key={u.id} value={String(u.id)}>
                      {u.full_name} ({u.role})
                    </MenuItem>
                  ))}
                </Select>
              </div>
            </div>

            {/* Created on & Last updated on (Auto-captured, non-editable) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <TextField
                fullWidth
                size="small"
                label="Created on (Auto-captured)"
                value={lead?.created_at ? formatDate(lead.created_at) : '—'}
                disabled
                slotProps={{
                  input: {
                    readOnly: true,
                    sx: { bgcolor: '#F8FAF7', color: '#55655B' },
                  },
                }}
              />
              <TextField
                fullWidth
                size="small"
                label="Last updated on (Auto-captured)"
                value={lead?.updated_at ? formatDate(lead.updated_at) : '—'}
                disabled
                slotProps={{
                  input: {
                    readOnly: true,
                    sx: { bgcolor: '#F8FAF7', color: '#55655B' },
                  },
                }}
              />
            </div>

            {/* 7. Lost / Lost Reason */}
            <div>
              <Select
                fullWidth
                displayEmpty
                size="small"
                value={selectedLostReason || ''}
                onChange={(e) => setValue('lost_reason', String(e.target.value))}
                renderValue={(val) =>
                  val
                    ? lostReasons.find((r) => r.value === val)?.label ?? val
                    : '7. Lost / Lost Reason (Select if applicable)'
                }
              >
                <MenuItem value="">
                  <em>7. Lost / Lost Reason (Select if applicable)</em>
                </MenuItem>
                {lostReasons.length === 0 && (
                  <MenuItem disabled>No lost reasons configured — add in Configuration</MenuItem>
                )}
                {lostReasons.map((r) => (
                  <MenuItem key={r.id} value={r.value}>
                    {r.label}
                  </MenuItem>
                ))}
              </Select>
            </div>
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isLoading}>
            Save Changes
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
  );
}
