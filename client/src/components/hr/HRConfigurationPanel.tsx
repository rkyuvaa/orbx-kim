import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Slider,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Stack,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Sparkles,
  Calendar,
  Clock,
  ShieldCheck,
  RefreshCw,
  Plus,
  Zap,
  Check,
  AlertTriangle,
  FileText,
  Lock,
  Layers,
  BarChart2,
  Trash2,
} from 'lucide-react';
import {
  useGetHRAISettingsQuery,
  useUpdateHRAISettingsMutation,
  useListAIProvidersQuery,
  useUpdateAIProviderMutation,
  useTestAIProviderMutation,
  useGetHRAIUsageSummaryQuery,
  useGetLeavePoliciesQuery,
  useUpdateLeavePoliciesMutation,
  useGetShiftRulesQuery,
  useUpdateShiftRulesMutation,
  AIProviderCard,
} from '@/api/recruitmentApi';
import { useToast } from '@/components/ui/ToastHost';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function SubTabPanel({ children, value, index }: TabPanelProps) {
  return value === index ? <Box sx={{ pt: 2.5 }}>{children}</Box> : null;
}

export default function HRConfigurationPanel() {
  const { showToast } = useToast();
  const [subTab, setSubTab] = useState(0);

  // Queries
  const { data: aiSettings, refetch: refetchAISettings } = useGetHRAISettingsQuery();
  const { data: aiProviders = [], refetch: refetchProviders } = useListAIProvidersQuery();
  const { data: usageSummary } = useGetHRAIUsageSummaryQuery();
  const { data: leavePolicies, refetch: refetchLeaves } = useGetLeavePoliciesQuery();
  const { data: shiftRules, refetch: refetchShifts } = useGetShiftRulesQuery();

  // Mutations
  const [updateAISettings, { isLoading: savingAISettings }] = useUpdateHRAISettingsMutation();
  const [updateAIProvider, { isLoading: savingProvider }] = useUpdateAIProviderMutation();
  const [testAIProvider, { isLoading: testingProvider }] = useTestAIProviderMutation();
  const [updateLeavePolicies, { isLoading: savingLeaves }] = useUpdateLeavePoliciesMutation();
  const [updateShiftRules, { isLoading: savingShifts }] = useUpdateShiftRulesMutation();

  // Local Form States
  const [skillsWeight, setSkillsWeight] = useState(50);
  const [experienceWeight, setExperienceWeight] = useState(30);
  const [educationWeight, setEducationWeight] = useState(20);
  const [autoMatchThreshold, setAutoMatchThreshold] = useState(70);
  const [localAIOnly, setLocalAIOnly] = useState(false);

  // Prompts
  const [indeedPrompt, setIndeedPrompt] = useState('');
  const [resumePrompt, setResumePrompt] = useState('');
  const [matchingPrompt, setMatchingPrompt] = useState('');

  // DLT & Compliance
  const [dltTemplateId, setDltTemplateId] = useState('');
  const [dltHeader, setDltHeader] = useState('');
  const [retentionDays, setRetentionDays] = useState(180);

  // Leaves & Shifts
  const [casualQuota, setCasualQuota] = useState(12);
  const [sickQuota, setSickQuota] = useState(10);
  const [earnedQuota, setEarnedQuota] = useState(15);
  const [shiftStart, setShiftStart] = useState('09:30');
  const [shiftEnd, setShiftEnd] = useState('18:30');
  const [gracePeriod, setGracePeriod] = useState(15);

  // Provider Modal
  const [providerModal, setProviderModal] = useState<{
    open: boolean;
    provider: AIProviderCard | null;
    modelName: string;
    apiKey: string;
    endpoint: string;
  }>({
    open: false,
    provider: null,
    modelName: '',
    apiKey: '',
    endpoint: '',
  });

  const [testStatus, setTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Sync state from queries
  useEffect(() => {
    if (aiSettings) {
      setSkillsWeight(aiSettings.skills_weight || 50);
      setExperienceWeight(aiSettings.experience_weight || 30);
      setEducationWeight(aiSettings.education_weight || 20);
      setAutoMatchThreshold(aiSettings.auto_match_threshold || 70);
      setLocalAIOnly(aiSettings.local_ai_only || false);
      setIndeedPrompt(aiSettings.indeed_prompt_template || '');
      setResumePrompt(aiSettings.resume_ocr_prompt_template || '');
      setMatchingPrompt(aiSettings.candidate_matching_prompt_template || '');
      setDltTemplateId(aiSettings.sms_dlt_template_id || '');
      setDltHeader(aiSettings.sms_dlt_header || '');
      setRetentionDays(aiSettings.data_retention_days || 180);
    }
  }, [aiSettings]);

  useEffect(() => {
    if (leavePolicies) {
      setCasualQuota(leavePolicies.casualLeaveQuota ?? 12);
      setSickQuota(leavePolicies.sickLeaveQuota ?? 10);
      setEarnedQuota(leavePolicies.earnedLeaveQuota ?? 15);
    }
  }, [leavePolicies]);

  useEffect(() => {
    if (shiftRules) {
      setShiftStart(shiftRules.shiftStart || '09:30');
      setShiftEnd(shiftRules.shiftEnd || '18:30');
      setGracePeriod(shiftRules.gracePeriodMins ?? 15);
    }
  }, [shiftRules]);

  const totalWeights = Number(skillsWeight) + Number(experienceWeight) + Number(educationWeight);
  const weightsValid = Math.abs(totalWeights - 100) < 0.1;

  const handleSaveAISettings = async () => {
    if (!weightsValid) {
      showToast(`Weights must sum to 100%. Currently: ${totalWeights}%`, 'error');
      return;
    }
    try {
      await updateAISettings({
        skills_weight: skillsWeight,
        experience_weight: experienceWeight,
        education_weight: educationWeight,
        auto_match_threshold: autoMatchThreshold,
        local_ai_only: localAIOnly,
        indeed_prompt_template: indeedPrompt,
        resume_ocr_prompt_template: resumePrompt,
        candidate_matching_prompt_template: matchingPrompt,
        sms_dlt_template_id: dltTemplateId,
        sms_dlt_header: dltHeader,
        data_retention_days: retentionDays,
      }).unwrap();
      showToast('HR AI Configuration saved successfully', 'success');
    } catch (err: any) {
      showToast(err?.data?.detail || 'Failed to save settings', 'error');
    }
  };

  const handleSaveLeavePolicies = async () => {
    try {
      await updateLeavePolicies({
        casualLeaveQuota: casualQuota,
        sickLeaveQuota: sickQuota,
        earnedLeaveQuota: earnedQuota,
      }).unwrap();
      showToast('Leave Policy Quotas saved successfully', 'success');
    } catch (err: any) {
      showToast('Failed to save leave quotas', 'error');
    }
  };

  const handleSaveShiftRules = async () => {
    try {
      await updateShiftRules({
        shiftStart,
        shiftEnd,
        gracePeriodMins: gracePeriod,
      }).unwrap();
      showToast('Shift & Attendance rules saved successfully', 'success');
    } catch (err: any) {
      showToast('Failed to save shift rules', 'error');
    }
  };

  const handleTestConnection = async (prov: AIProviderCard, rawKey?: string) => {
    setTestStatus(null);
    try {
      const res = await testAIProvider({
        provider: prov.provider,
        model_name: prov.model_name,
        api_endpoint: prov.api_endpoint,
        api_key: rawKey || prov.api_key_override,
      }).unwrap();
      setTestStatus(res);
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'warning');
      }
    } catch (err: any) {
      setTestStatus({ success: false, message: err?.message || 'Connection test failed' });
      showToast('Connection test failed', 'error');
    }
  };

  const handleSaveProviderModal = async () => {
    if (!providerModal.provider) return;
    try {
      await updateAIProvider({
        id: providerModal.provider.id,
        body: {
          model_name: providerModal.modelName,
          api_endpoint: providerModal.endpoint,
          api_key_override: providerModal.apiKey,
        },
      }).unwrap();
      showToast('AI Provider credentials updated', 'success');
      setProviderModal({ open: false, provider: null, modelName: '', apiKey: '', endpoint: '' });
      refetchProviders();
    } catch (err: any) {
      showToast('Failed to update provider', 'error');
    }
  };

  return (
    <Box sx={{ pb: 6 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#023020' }}>
            HR & Recruitment Configuration
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#667085', mt: 0.5 }}>
            Manage the AI Recruitment Engine, deterministic scoring weights, DLT compliance, leave quotas, and shift rules.
          </Typography>
        </div>
        <IconButton
          onClick={() => {
            refetchAISettings();
            refetchProviders();
            refetchLeaves();
            refetchShifts();
            showToast('Configuration refreshed', 'info');
          }}
          size="small"
          sx={{ border: '1px solid #E4EBE1', borderRadius: 2 }}
        >
          <RefreshCw size={16} />
        </IconButton>
      </Box>

      {/* Sub-Tabs Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: '#E4EBE1', mb: 3 }}>
        <Tabs
          value={subTab}
          onChange={(_, next) => setSubTab(next)}
          textColor="primary"
          indicatorColor="primary"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: 13,
              fontWeight: 600,
              minHeight: 44,
            },
          }}
        >
          <Tab icon={<Sparkles size={16} />} iconPosition="start" label="AI Recruitment Engine" />
          <Tab icon={<Calendar size={16} />} iconPosition="start" label="Leave Policy Quotas" />
          <Tab icon={<Clock size={16} />} iconPosition="start" label="Shift & Attendance Rules" />
          <Tab icon={<ShieldCheck size={16} />} iconPosition="start" label="DLT & Compliance Policies" />
        </Tabs>
      </Box>

      {/* SUB-TAB 0: AI RECRUITMENT ENGINE */}
      <SubTabPanel value={subTab} index={0}>
        <Grid container spacing={3}>
          {/* AI Providers Card */}
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 3, borderColor: '#E4EBE1', borderRadius: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <div>
                  <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#023020' }}>
                    Active AI Providers & Fallback Chain
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: '#667085' }}>
                    Configure credentials for Google Gemini, OpenRouter, Nvidia NIM, and Local Ollama.
                  </Typography>
                </div>
                <FormControlLabel
                  control={
                    <Switch
                      checked={localAIOnly}
                      onChange={(e) => setLocalAIOnly(e.target.checked)}
                      color="warning"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Lock size={14} color={localAIOnly ? '#D97706' : '#667085'} />
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: localAIOnly ? '#D97706' : '#2A402A' }}>
                        Local AI Only (Block Cloud Providers)
                      </Typography>
                    </Box>
                  }
                />
              </Box>

              {localAIOnly && (
                <Alert severity="warning" sx={{ mb: 2.5, borderRadius: 2 }}>
                  <strong>Tenant Privacy Active:</strong> All cloud LLM endpoints (Gemini, OpenRouter, Nvidia) are strictly blocked. Resume OCR and rubric evaluations run exclusively on Local Ollama.
                </Alert>
              )}

              {/* Provider List */}
              <Grid container spacing={2}>
                {aiProviders.map((prov) => (
                  <Grid item xs={12} md={6} lg={4} key={prov.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        borderColor: prov.is_default ? '#16C47F' : '#E4EBE1',
                        bgcolor: prov.is_default ? '#F0FDF4' : '#FFFFFF',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#023020' }}>
                          {prov.label}
                        </Typography>
                        {prov.is_default && (
                          <Chip label="Default" size="small" sx={{ bgcolor: '#DCFCE7', color: '#166534', fontWeight: 700 }} />
                        )}
                      </Box>
                      <Typography sx={{ fontSize: 12, color: '#667085', mb: 1 }}>
                        Model: <strong>{prov.model_name}</strong>
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: '#667085', mb: 1.5 }}>
                        API Key: {prov.api_key_override ? <span style={{ fontFamily: 'monospace' }}>{prov.api_key_override}</span> : <span style={{ fontStyle: 'italic' }}>Not Configured</span>}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() =>
                            setProviderModal({
                              open: true,
                              provider: prov,
                              modelName: prov.model_name,
                              apiKey: prov.api_key_override || '',
                              endpoint: prov.api_endpoint || '',
                            })
                          }
                          sx={{ textTransform: 'none', borderRadius: 1.5, fontSize: 12 }}
                        >
                          Configure
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          disabled={testingProvider}
                          onClick={() => handleTestConnection(prov)}
                          sx={{ bgcolor: '#023020', textTransform: 'none', borderRadius: 1.5, fontSize: 12 }}
                        >
                          Test
                        </Button>
                      </Stack>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>

          {/* Scoring Weights & Thresholds */}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 3, borderColor: '#E4EBE1', borderRadius: 2.5, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#023020' }}>
                  Deterministic Scoring Weights
                </Typography>
                <Chip
                  label={`Total: ${totalWeights}%`}
                  color={weightsValid ? 'success' : 'error'}
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
              </Box>
              <Typography sx={{ fontSize: 13, color: '#667085', mb: 2.5 }}>
                Sub-scores are returned by the AI model; the final total is calculated in code using these exact weights. Must sum to exactly 100%.
              </Typography>

              <Box sx={{ mb: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Skills Weight (50%)</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#16C47F' }}>{skillsWeight}%</Typography>
                </Box>
                <Slider
                  value={skillsWeight}
                  onChange={(_, val) => setSkillsWeight(val as number)}
                  min={0}
                  max={100}
                  step={5}
                  sx={{ color: '#16C47F' }}
                />
              </Box>

              <Box sx={{ mb: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Experience Weight (30%)</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#2563EB' }}>{experienceWeight}%</Typography>
                </Box>
                <Slider
                  value={experienceWeight}
                  onChange={(_, val) => setExperienceWeight(val as number)}
                  min={0}
                  max={100}
                  step={5}
                  sx={{ color: '#2563EB' }}
                />
              </Box>

              <Box sx={{ mb: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Education Weight (20%)</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#7C3AED' }}>{educationWeight}%</Typography>
                </Box>
                <Slider
                  value={educationWeight}
                  onChange={(_, val) => setEducationWeight(val as number)}
                  min={0}
                  max={100}
                  step={5}
                  sx={{ color: '#7C3AED' }}
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Passing Match Threshold</Typography>
                  <Typography sx={{ fontSize: 12, color: '#667085' }}>Minimum score to tag candidate as High Match</Typography>
                </div>
                <TextField
                  type="number"
                  size="small"
                  value={autoMatchThreshold}
                  onChange={(e) => setAutoMatchThreshold(Number(e.target.value))}
                  sx={{ width: 90 }}
                  InputProps={{ endAdornment: '%' }}
                />
              </Box>
            </Paper>
          </Grid>

          {/* Usage Log Summary */}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 3, borderColor: '#E4EBE1', borderRadius: 2.5, height: '100%' }}>
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#023020', mb: 1 }}>
                Monthly AI Usage & Token Tracking
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#667085', mb: 3 }}>
                Automated telemetry tracking calls, prompt tokens, and latency for HR AI operations.
              </Typography>

              {usageSummary ? (
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Card variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#F8FAF9' }}>
                      <Typography sx={{ fontSize: 12, color: '#667085' }}>Total AI Calls</Typography>
                      <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#023020' }}>
                        {usageSummary.total_calls}
                      </Typography>
                    </Card>
                  </Grid>
                  <Grid item xs={6}>
                    <Card variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#F8FAF9' }}>
                      <Typography sx={{ fontSize: 12, color: '#667085' }}>Avg Latency</Typography>
                      <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#023020' }}>
                        {usageSummary.avg_latency_ms} ms
                      </Typography>
                    </Card>
                  </Grid>
                  <Grid item xs={6}>
                    <Card variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#F8FAF9' }}>
                      <Typography sx={{ fontSize: 12, color: '#667085' }}>Prompt Tokens</Typography>
                      <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#2A402A' }}>
                        {usageSummary.total_prompt_tokens.toLocaleString()}
                      </Typography>
                    </Card>
                  </Grid>
                  <Grid item xs={6}>
                    <Card variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#F8FAF9' }}>
                      <Typography sx={{ fontSize: 12, color: '#667085' }}>Completion Tokens</Typography>
                      <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#2A402A' }}>
                        {usageSummary.total_completion_tokens.toLocaleString()}
                      </Typography>
                    </Card>
                  </Grid>
                </Grid>
              ) : (
                <Typography sx={{ fontSize: 13, color: '#667085', fontStyle: 'italic' }}>
                  No AI calls logged yet for this billing cycle.
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Action Button */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                variant="contained"
                disabled={savingAISettings || !weightsValid}
                onClick={handleSaveAISettings}
                sx={{ bgcolor: '#16C47F', '&:hover': { bgcolor: '#12A66C' }, textTransform: 'none', borderRadius: 2, px: 3 }}
              >
                Save AI Recruitment Settings
              </Button>
            </Box>
          </Grid>
        </Grid>
      </SubTabPanel>

      {/* SUB-TAB 1: LEAVE POLICY QUOTAS */}
      <SubTabPanel value={subTab} index={1}>
        <Paper variant="outlined" sx={{ p: 3, borderColor: '#E4EBE1', borderRadius: 2.5, maxWidth: 640 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#023020', mb: 1 }}>
            Annual Leave Policy Quotas
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#667085', mb: 3 }}>
            Configure default annual leave allocations per employee. Stored persistently in the database.
          </Typography>

          <Stack spacing={2.5}>
            <TextField
              label="Casual Leave Quota (Days/Year)"
              type="number"
              size="small"
              value={casualQuota}
              onChange={(e) => setCasualQuota(Number(e.target.value))}
            />
            <TextField
              label="Sick Leave Quota (Days/Year)"
              type="number"
              size="small"
              value={sickQuota}
              onChange={(e) => setSickQuota(Number(e.target.value))}
            />
            <TextField
              label="Earned / Privilege Leave Quota (Days/Year)"
              type="number"
              size="small"
              value={earnedQuota}
              onChange={(e) => setEarnedQuota(Number(e.target.value))}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
              <Button
                variant="contained"
                disabled={savingLeaves}
                onClick={handleSaveLeavePolicies}
                sx={{ bgcolor: '#16C47F', '&:hover': { bgcolor: '#12A66C' }, textTransform: 'none', borderRadius: 2 }}
              >
                Save Leave Quotas
              </Button>
            </Box>
          </Stack>
        </Paper>
      </SubTabPanel>

      {/* SUB-TAB 2: SHIFT & ATTENDANCE RULES */}
      <SubTabPanel value={subTab} index={2}>
        <Paper variant="outlined" sx={{ p: 3, borderColor: '#E4EBE1', borderRadius: 2.5, maxWidth: 640 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#023020', mb: 1 }}>
            Shift & Attendance Timings
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#667085', mb: 3 }}>
            Define standard working shift hours and grace period for late mark calculation.
          </Typography>

          <Stack spacing={2.5}>
            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                label="Shift Start Time"
                type="time"
                size="small"
                value={shiftStart}
                onChange={(e) => setShiftStart(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                fullWidth
                label="Shift End Time"
                type="time"
                size="small"
                value={shiftEnd}
                onChange={(e) => setShiftEnd(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
            <TextField
              label="Late Mark Grace Period (Minutes)"
              type="number"
              size="small"
              value={gracePeriod}
              onChange={(e) => setGracePeriod(Number(e.target.value))}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
              <Button
                variant="contained"
                disabled={savingShifts}
                onClick={handleSaveShiftRules}
                sx={{ bgcolor: '#16C47F', '&:hover': { bgcolor: '#12A66C' }, textTransform: 'none', borderRadius: 2 }}
              >
                Save Shift Rules
              </Button>
            </Box>
          </Stack>
        </Paper>
      </SubTabPanel>

      {/* SUB-TAB 3: DLT & COMPLIANCE POLICIES */}
      <SubTabPanel value={subTab} index={3}>
        <Paper variant="outlined" sx={{ p: 3, borderColor: '#E4EBE1', borderRadius: 2.5, maxWidth: 720 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#023020', mb: 1 }}>
            India DLT SMS & DPDP Act 2023 Compliance
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#667085', mb: 3 }}>
            Configure Telecom DLT credentials for Indian transactional SMS and data retention policies.
          </Typography>

          <Stack spacing={2.5}>
            <TextField
              label="DLT Registered Template ID"
              size="small"
              value={dltTemplateId}
              onChange={(e) => setDltTemplateId(e.target.value)}
              helperText="Government approved DLT Template ID for Interview Invitations"
            />
            <TextField
              label="DLT Approved Header / Sender ID"
              size="small"
              value={dltHeader}
              onChange={(e) => setDltHeader(e.target.value)}
              helperText="6-character registered sender header (e.g. ORBXHR)"
            />
            <TextField
              label="Candidate Data Retention Period (Days)"
              type="number"
              size="small"
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              helperText="Resumes and evaluations are automatically flagged for purge after this period (DPDP Act)"
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
              <Button
                variant="contained"
                onClick={handleSaveAISettings}
                sx={{ bgcolor: '#16C47F', '&:hover': { bgcolor: '#12A66C' }, textTransform: 'none', borderRadius: 2 }}
              >
                Save Compliance Policies
              </Button>
            </Box>
          </Stack>
        </Paper>
      </SubTabPanel>

      {/* Modal: Edit AI Provider */}
      <Dialog open={providerModal.open} onClose={() => setProviderModal({ ...providerModal, open: false })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Configure {providerModal.provider?.label}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Model Name"
              size="small"
              value={providerModal.modelName}
              onChange={(e) => setProviderModal({ ...providerModal, modelName: e.target.value })}
            />
            <TextField
              fullWidth
              label="API Endpoint"
              size="small"
              value={providerModal.endpoint}
              onChange={(e) => setProviderModal({ ...providerModal, endpoint: e.target.value })}
            />
            <TextField
              fullWidth
              label="API Key Override (Encrypted at rest)"
              type="password"
              size="small"
              value={providerModal.apiKey}
              onChange={(e) => setProviderModal({ ...providerModal, apiKey: e.target.value })}
              helperText="Keys are encrypted with AES-128 before saving and masked on retrieval."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setProviderModal({ ...providerModal, open: false })}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveProviderModal}
            disabled={savingProvider}
            sx={{ bgcolor: '#16C47F' }}
          >
            Save Credentials
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
