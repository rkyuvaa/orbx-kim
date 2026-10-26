import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { ArrowLeft, CheckCircle2, Clock, Plus, Save, Sparkles } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  useGetApplicationQuery,
  useUpdateApplicationMutation,
  useApplicationActivityQuery,
  usePlannedActivitiesQuery,
  useCreatePlannedActivityMutation,
  useUpdatePlannedActivityMutation,
} from '@/api/applicationsApi';
import {
  useActivityTypesQuery,
  useDropdownOptionsQuery,
  useFinanceCompaniesQuery,
  useStagesByModuleQuery,
  useTabsQuery,
  useTabsByModuleQuery,
  useVehicleModelsQuery,
  useUsersQuery,
} from '@/api/mastersApi';
import { useToast } from '@/components/ui/ToastHost';
import DynamicFieldEngine from '@/components/fields/DynamicFieldEngine';
import DocumentVerificationPanel from '@/components/fields/DocumentVerificationPanel';
import FinalSubmissionPanel from '@/components/fields/FinalSubmissionPanel';
import { formatDate, formatDateTime } from '@/utils/format';

const editSchema = z.object({
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
  vehicle_price: z.coerce.number().optional().default(0),
  down_payment: z.coerce.number().optional().default(0),
  amount: z.coerce.number().optional().default(0),
  finance_company_id: z.string().optional(),
});

type EditForm = z.infer<typeof editSchema>;

const planSchema = z.object({
  activity_type_name: z.string().min(1, 'Select an activity type'),
  subject: z.string().min(2, 'Activity subject/title is required'),
  due_date: z.string().optional(),
  notes: z.string().optional(),
  assigned_to: z.string().optional(),
});

type PlanForm = z.infer<typeof planSchema>;

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const appId = Number(id);

  const { data: lead, isFetching } = useGetApplicationQuery(appId, { skip: !appId });

  const { data: activityLogs = [] } = useApplicationActivityQuery(appId, { skip: !appId });
  const { data: plannedActivities = [] } = usePlannedActivitiesQuery(appId, { skip: !appId });
  const { data: activityTypes = [] } = useActivityTypesQuery();
  const [updateApplication, { isLoading: isUpdating }] = useUpdateApplicationMutation();
  const [createPlannedActivity, { isLoading: creatingPlanned }] = useCreatePlannedActivityMutation();
  const [updatePlannedActivity] = useUpdatePlannedActivityMutation();

  const { data: models = [], isFetching: loadingModels } = useVehicleModelsQuery();
  const { data: companies = [] } = useFinanceCompaniesQuery();
  const { data: users = [] } = useUsersQuery();
  const { data: fuelTypes = [] } = useDropdownOptionsQuery('fuel_type');
  const { data: customerStatuses = [] } = useDropdownOptionsQuery('customer_status');
  const { data: sources = [] } = useDropdownOptionsQuery('lead_source');
  const { data: lostReasons = [] } = useDropdownOptionsQuery('lost_reason');

  const location = useLocation();
  const isOpportunity = lead?.status ? lead.status.toUpperCase() !== 'LEAD' : false;
  const isOppUrl = location.pathname.startsWith('/opportunities');
  const targetModule = (isOpportunity || isOppUrl) ? 'OPPORTUNITY' : 'LEAD';
  const backTarget = (isOpportunity || isOppUrl) ? '/opportunities' : '/leads';
  const backLabel = (isOpportunity || isOppUrl) ? 'Back to Opportunities' : 'Back to Leads';
  const detailTitle = (isOpportunity || isOppUrl) ? 'Opportunity Details' : 'Lead Details';

  const { data: crmTabs = [] } = useTabsByModuleQuery(targetModule);

  const [activeLeadTabCode, setActiveLeadTabCode] = useState<string>('general');
  const [sideTab, setSideTab] = useState(0);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);

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

  const {
    register: registerPlan,
    handleSubmit: handleSubmitPlan,
    reset: resetPlan,
    setValue: setPlanValue,
    watch: watchPlan,
    formState: { errors: planErrors },
  } = useForm<PlanForm>({
    resolver: zodResolver(planSchema),
    defaultValues: { activity_type_name: '', subject: '', due_date: '', notes: '' },
  });

  const modelId = watch('vehicle_model_id');
  const selectedFuelType = watch('fuel_type');
  const selectedCustomerStatus = watch('customer_status');
  const selectedSource = watch('lead_source');
  const selectedAssignedTo = watch('assigned_to');
  const selectedLostReason = watch('lost_reason');

  useEffect(() => {
    if (lead) {
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
        vehicle_price: lead.vehicle_price ?? 0,
        down_payment: lead.down_payment ?? 0,
        amount: lead.amount ?? 0,
        finance_company_id: lead.finance_company_id ? String(lead.finance_company_id) : '',
      });
    }
  }, [lead, reset]);

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
          amount: values.amount || 0,
          status: lead.status,
          vehicle_price: values.vehicle_price || 0,
          down_payment: values.down_payment || 0,
          finance_company_id: values.finance_company_id ? Number(values.finance_company_id) : null,
        } as any,
      }).unwrap();
      showToast(`Lead ${lead.app_no} updated`, 'success');
    } catch (err) {
      const errData = (err as { data?: { detail?: unknown } })?.data;
      let detailMsg = 'Could not update the lead';
      if (typeof errData?.detail === 'string') {
        detailMsg = errData.detail;
      } else if (Array.isArray(errData?.detail)) {
        detailMsg = errData.detail.map((d: { msg?: string }) => d.msg || 'Invalid field').join(', ');
      }
      showToast(detailMsg, 'error');
    }
  };

  const onPlanSubmit = async (values: PlanForm) => {
    if (!lead) return;
    try {
      const matchedType = activityTypes.find((t) => t.name === values.activity_type_name);
      await createPlannedActivity({
        appId: lead.id,
        body: {
          activity_type_id: matchedType?.id ?? null,
          activity_type_name: values.activity_type_name,
          subject: values.subject,
          notes: values.notes,
          due_date: values.due_date ? new Date(values.due_date).toISOString() : null,
          assigned_to: values.assigned_to ? Number(values.assigned_to) : null,
        },
      }).unwrap();
      showToast('Activity planned successfully', 'success');
      resetPlan();
      setPlanDialogOpen(false);
    } catch (err) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      showToast(detail ?? 'Could not plan activity', 'error');
    }
  };

  const markCompleted = async (actId: number) => {
    if (!lead) return;
    try {
      await updatePlannedActivity({
        appId: lead.id,
        actId,
        body: { status: 'COMPLETED' },
      }).unwrap();
      showToast('Activity marked as completed', 'success');
    } catch {
      showToast('Could not update activity status', 'error');
    }
  };

  const { data: oppStages = [] } = useStagesByModuleQuery('OPPORTUNITY');

  const convertToOpportunity = async () => {
    if (!lead) return;
    try {
      const validOppStage = oppStages.find((s) => s.enabled && String(s.status).toUpperCase() !== 'LEAD')?.key || 'applications';
      await updateApplication({
        id: lead.id,
        body: { status: 'APPLICATION', stage_key: validOppStage } as any,
      }).unwrap();
      showToast(`${lead.app_no} moved to Opportunity (${validOppStage.toUpperCase()})`, 'success');
      navigate('/opportunities');
    } catch {
      showToast('Could not convert to opportunity', 'error');
    }
  };

  if (isFetching && !lead) {
    return <div style={{ padding: 24, color: '#7A8B80' }}>Loading details...</div>;
  }

  if (!lead) {
    return (
      <div style={{ padding: 24 }}>
        <Typography variant="h6" color="error">
          Record not found
        </Typography>
        <Button onClick={() => navigate(backTarget)} sx={{ mt: 2 }}>
          {backLabel}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
        <Button
          startIcon={<ArrowLeft size={16} />}
          onClick={() => navigate(backTarget)}
          sx={{ color: '#44584C', textTransform: 'none', fontWeight: 600 }}
        >
          {backLabel}
        </Button>
      </div>

      <div className="two-col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 360px)', gap: 20, alignItems: 'start', maxWidth: '100%' }}>
        <Paper sx={{ border: '1px solid #E4EBE1', borderRadius: '14px', p: 3, minWidth: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3, color: '#023020' }}>
                {lead.app_no}
              </div>
              <div style={{ fontSize: 13, color: '#7A8B80', marginTop: 3 }}>
                {detailTitle}
              </div>
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '4.5px 12px',
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 700,
                background: '#F0F4EE',
                color: '#16C47F',
                border: '1px solid #C2E2BE',
                boxShadow: '0 1px 2px rgba(2, 48, 32, 0.06)',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#16C47F',
                  boxShadow: '0 0 0 2.5px #E6F3EA, 0 0 6px rgba(8, 122, 61, 0.5)',
                  flexShrink: 0,
                }}
              />
              Last updated: {formatDateTime(lead.updated_at)}
            </span>
          </div>

          {/* Dynamic Module Tabs for this Lead - Wraps onto 2nd line when space runs out */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, borderBottom: '1px solid #E4EBE1', pb: 1.5, mb: 3 }}>
            <Button
              size="small"
              variant={activeLeadTabCode === 'general' ? 'contained' : 'outlined'}
              color={activeLeadTabCode === 'general' ? 'primary' : 'inherit'}
              onClick={() => setActiveLeadTabCode('general')}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: 13,
                px: 2,
                py: 0.8,
                boxShadow: activeLeadTabCode === 'general' ? '0 2px 6px rgba(8,122,61,0.2)' : 'none',
              }}
            >
              Lead Details
            </Button>
            {crmTabs
              .filter((t) => t.is_active)
              .map((t) => (
                <Button
                  key={t.code}
                  size="small"
                  variant={activeLeadTabCode === t.code ? 'contained' : 'outlined'}
                  color={activeLeadTabCode === t.code ? 'primary' : 'inherit'}
                  onClick={() => setActiveLeadTabCode(t.code)}
                  sx={{
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 13,
                    px: 2,
                    py: 0.8,
                    boxShadow: activeLeadTabCode === t.code ? '0 2px 6px rgba(8,122,61,0.2)' : 'none',
                  }}
                >
                  {t.name}
                </Button>
              ))}
          </Box>

          {activeLeadTabCode === 'general' ? (
            <form onSubmit={handleSubmit(onSubmit)}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* 1. Customer Name & 2. Phone Number */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="1. Customer Name *"
                    error={Boolean(errors.customer_name)}
                    helperText={errors.customer_name?.message}
                    {...register('customer_name')}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="2. Phone Number *"
                    error={Boolean(errors.customer_phone)}
                    helperText={errors.customer_phone?.message}
                    {...register('customer_phone')}
                  />
                </div>

                {/* 3. Vehicle Number & 4. Customer Vehicle Model */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
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
                      onChange={(e) => setValue('vehicle_model_id', String(e.target.value), { shouldValidate: true })}
                      renderValue={(value) =>
                        value ? models.find((m) => String(m.id) === value)?.name ?? value : '4. Customer Vehicle Model (Select)'
                      }
                      inputProps={{ 'aria-label': 'Vehicle model' }}
                    >
                      <MenuItem value="">
                        <em>4. Customer Vehicle Model (Select)</em>
                      </MenuItem>
                      {loadingModels && <MenuItem disabled>Loading models...</MenuItem>}
                      {!loadingModels && models.length === 0 && (
                        <MenuItem disabled>No models configured — add in Configuration</MenuItem>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
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
                        val ? fuelTypes.find((f) => f.value === val)?.label ?? val : 'Fuel Type (Select)'
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  <div>
                    <Select
                      fullWidth
                      displayEmpty
                      size="small"
                      value={selectedCustomerStatus || ''}
                      onChange={(e) => setValue('customer_status', String(e.target.value))}
                      renderValue={(val) =>
                        val ? customerStatuses.find((s) => s.value === val)?.label ?? val : '6. Customer Status (Select)'
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
                        val ? sources.find((src) => src.value === val)?.label ?? val : 'Source (Select)'
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Created on (Auto-captured)"
                    value={lead.created_at ? formatDateTime(lead.created_at) : '—'}
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
                    value={lead.updated_at ? formatDateTime(lead.updated_at) : '—'}
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
                      val ? lostReasons.find((r) => r.value === val)?.label ?? val : '7. Lost / Lost Reason (Select if applicable)'
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

                {/* Lead Score */}
                <div
                  style={{
                    padding: '8px 12px',
                    background: '#F0F4EE',
                    borderRadius: '8px',
                    border: '1px solid #E4EBE1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: 13, color: '#7A8B80', fontWeight: 600 }}>Lead Score</span>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: '#16C47F',
                      background: '#FFFFFF',
                      padding: '4px 12px',
                      borderRadius: '6px',
                      minWidth: '50px',
                      textAlign: 'center',
                    }}
                  >
                    {lead.lead_score ?? 0}/100
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                {lead.status === 'LEAD' && (
                  <Button
                    variant="outlined"
                    startIcon={<Sparkles size={16} />}
                    disabled={isUpdating}
                    onClick={convertToOpportunity}
                    sx={{
                      borderColor: '#2563EB',
                      color: '#2563EB',
                      textTransform: 'none',
                      fontWeight: 600,
                      '&:hover': { background: '#EFF6FF', borderColor: '#1D4ED8' },
                    }}
                  >
                    Move to Opportunity
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<Save size={16} />}
                  disabled={isUpdating}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          ) : activeLeadTabCode === 'final_submission' || crmTabs.find((t) => t.code === activeLeadTabCode)?.name.toLowerCase().includes('final submission') ? (
            <FinalSubmissionPanel applicationId={lead.id} />
          ) : activeLeadTabCode === 'document_verification' ||
              activeLeadTabCode === 'verification' ||
              activeLeadTabCode === 'document_upload' ||
              crmTabs.find((t) => t.code === activeLeadTabCode)?.name.toLowerCase().includes('verification') ||
              crmTabs.find((t) => t.code === activeLeadTabCode)?.name.toLowerCase().includes('document') ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <DynamicFieldEngine
                tabId={crmTabs.find((t) => t.code === activeLeadTabCode)?.id || 0}
                tabCode={activeLeadTabCode}
                applicationId={lead.id}
                customerName={lead.customer_name}
                currentStageKey={lead.status}
                hideIfEmpty
              />
              <DocumentVerificationPanel applicationId={lead.id} />
            </Box>
          ) : (
            <DynamicFieldEngine
              tabId={crmTabs.find((t) => t.code === activeLeadTabCode)?.id || 0}
              tabCode={activeLeadTabCode}
              applicationId={lead.id}
              customerName={lead.customer_name}
              currentStageKey={lead.status}
            />
          )}
        </Paper>

        <Paper sx={{ border: '1px solid #E4EBE1', borderRadius: '14px', p: 3, minWidth: 0, overflow: 'hidden' }}>
          <Box sx={{ borderBottom: 1, borderColor: '#E4EBE1', mb: 2 }}>
            <Tabs
              value={sideTab}
              onChange={(_, next) => setSideTab(next)}
              textColor="primary"
              indicatorColor="primary"
              sx={{
                '& .MuiTab-root': { textTransform: 'none', fontSize: 13, fontWeight: 600, minWidth: 100 },
              }}
            >
              <Tab label={`Activities (${plannedActivities.length})`} />
              <Tab label={`Change Log (${activityLogs.length})`} />
            </Tabs>
          </Box>

          {sideTab === 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#16231B' }}>Planned Lead Activities</span>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Plus size={14} />}
                  onClick={() => setPlanDialogOpen(true)}
                >
                  Plan Activity
                </Button>
              </div>

              {plannedActivities.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: '#7A8B80', fontSize: 13 }}>
                  No planned activities yet. Click "Plan Activity" to schedule calls, follow-ups or meetings.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {plannedActivities.map((act) => (
                    <div
                      key={act.id}
                      style={{
                        padding: '12px',
                        background: act.status === 'COMPLETED' ? '#F4F9F2' : '#FFFFFF',
                        borderRadius: 8,
                        border: '1px solid #E4EBE1',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Chip
                              label={act.activity_type_name}
                              size="small"
                              sx={{ height: 20, fontSize: 10, fontWeight: 700, background: '#EAF6E8', color: '#04552B' }}
                            />
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#16231B' }}>{act.subject}</span>
                          </div>
                          {act.due_date && (
                            <div style={{ fontSize: 11, color: '#7A8B80', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                              <Clock size={12} /> Due: {formatDate(act.due_date)}
                            </div>
                          )}
                        </div>
                        {act.status === 'COMPLETED' ? (
                          <Chip label="Done" color="success" size="small" sx={{ height: 20, fontSize: 10 }} />
                        ) : (
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<CheckCircle2 size={14} color="#16C47F" />}
                            onClick={() => markCompleted(act.id)}
                            sx={{ textTransform: 'none', fontSize: 11, color: '#16C47F', p: 0 }}
                          >
                            Complete
                          </Button>
                        )}
                      </div>

                      {act.notes && (
                        <div style={{ fontSize: 12, color: '#44584C', marginTop: 4, background: '#F8FAF8', padding: '6px 8px', borderRadius: 4 }}>
                          {act.notes}
                        </div>
                      )}

                      {act.creator_name && (
                        <div style={{ fontSize: 10, color: '#9BA99F', marginTop: 6 }}>
                          Planned by {act.creator_name} on {formatDate(act.created_at)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {sideTab === 1 && (
            <div>
              {activityLogs.length === 0 ? (
                <div style={{ padding: '16px 0', textAlign: 'center', color: '#7A8B80', fontSize: 13 }}>
                  No changes recorded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {activityLogs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: '10px 12px',
                        background: '#F9FBF8',
                        borderRadius: 8,
                        border: '1px solid #E4EBE1',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#16231B' }}>
                          {log.field_name}
                        </div>
                        <div style={{ fontSize: 10, color: '#9BA99F' }}>
                          {formatDate(log.created_at)}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: '#44584C' }}>
                        {log.old_value && (
                          <span style={{ textDecoration: 'line-through', color: '#DC2626' }}>
                            {log.old_value}
                          </span>
                        )}
                        {log.old_value && log.new_value && <span style={{ margin: '0 6px' }}>&rarr;</span>}
                        {log.new_value && (
                          <span style={{ color: '#16C47F', fontWeight: 600 }}>{log.new_value}</span>
                        )}
                      </div>
                      {log.actor_name && (
                        <div style={{ fontSize: 10, color: '#9BA99F', marginTop: 4 }}>
                          by {log.actor_name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Paper>
      </div>

      <Dialog open={planDialogOpen} onClose={() => setPlanDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Plan Lead Activity</DialogTitle>
        <form onSubmit={handleSubmitPlan(onPlanSubmit)}>
          <DialogContent>
            <Select
              fullWidth
              displayEmpty
              size="small"
              value={watchPlan('activity_type_name')}
              onChange={(e) => setPlanValue('activity_type_name', String(e.target.value), { shouldValidate: true })}
              error={Boolean(planErrors.activity_type_name)}
              sx={{ mb: 1.5 }}
              renderValue={(val) => (val ? val : 'Select Activity Type')}
            >
              <MenuItem value="">Select Activity Type</MenuItem>
              {activityTypes.length === 0 && (
                <MenuItem disabled>No activity types configured (add in Configuration)</MenuItem>
              )}
              {activityTypes.map((t) => (
                <MenuItem key={t.id} value={t.name}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
            {planErrors.activity_type_name && (
              <div style={{ fontSize: 11.5, color: '#d32f2f', margin: '-8px 14px 8px' }}>
                {planErrors.activity_type_name.message}
              </div>
            )}

            <TextField
              fullWidth
              label="Subject / Title"
              margin="dense"
              placeholder="e.g. Call customer for documents"
              error={Boolean(planErrors.subject)}
              helperText={planErrors.subject?.message}
              {...registerPlan('subject')}
            />

            <Select
              fullWidth
              displayEmpty
              size="small"
              value={watchPlan('assigned_to') || ''}
              onChange={(e) => setPlanValue('assigned_to', String(e.target.value) || '', { shouldValidate: true })}
              sx={{ mb: 1.5 }}
              renderValue={(val) => (val ? users.find((u) => String(u.id) === val)?.full_name ?? val : 'Assign to (optional)')}
            >
              <MenuItem value="">Assign to (optional - defaults to you)</MenuItem>
              {users.map((u) => (
                <MenuItem key={u.id} value={String(u.id)}>
                  {u.full_name} ({u.role})
                </MenuItem>
              ))}
            </Select>

            <TextField
              fullWidth
              label="Due Date & Time"
              type="datetime-local"
              margin="dense"
              slotProps={{ inputLabel: { shrink: true } }}
              {...registerPlan('due_date')}
            />

            <TextField
              fullWidth
              label="Notes / Instructions"
              margin="dense"
              multiline
              rows={3}
              {...registerPlan('notes')}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPlanDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={creatingPlanned}>
              Plan Activity
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </div>
  );
}
