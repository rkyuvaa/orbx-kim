import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  InputAdornment,
  Grid,
} from '@mui/material';
import {
  Sparkles,
  Layers,
  Clock,
  Shield,
  Plus,
  Eye,
  EyeOff,
  Settings,
  RefreshCw,
  Check,
  Zap,
  Edit2,
} from 'lucide-react';
import {
  expensesApi,
  ExpenseCategory,
  ClaimCycle,
  AIProviderConfig,
  ExpensePolicy,
} from '@/api/expensesApi';
import { useToast } from '@/components/ui/ToastHost';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function ExpenseConfigurationPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);

  // Data states
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [cycles, setCycles] = useState<ClaimCycle[]>([]);
  const [aiProviders, setAiProviders] = useState<AIProviderConfig[]>([]);
  const [policies, setPolicies] = useState<Record<string, string>>({});

  // AI Provider Configuration Modal
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AIProviderConfig | null>(null);
  const [provType, setProvType] = useState<'GOOGLE' | 'NVIDIA' | 'OPENROUTER' | 'KILO' | 'LOCAL'>('GOOGLE');
  const [provLabel, setProvLabel] = useState('');
  const [provModel, setProvModel] = useState('');
  const [provEndpoint, setProvEndpoint] = useState('');
  const [provApiKey, setProvApiKey] = useState('');
  const [provIsDefault, setProvIsDefault] = useState(false);
  const [provIsActive, setProvIsActive] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Category Modal
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catCode, setCatCode] = useState('');
  const [catLimit, setCatLimit] = useState<string>('');
  const [catPeriod, setCatPeriod] = useState('PER_EXPENSE');
  const [catGL, setCatGL] = useState('');

  // Cycle Modal
  const [cycleModalOpen, setCycleModalOpen] = useState(false);
  const [cycleName, setCycleName] = useState('');
  const [cycleFreq, setCycleFreq] = useState('FORTNIGHTLY');
  const [cycleStart, setCycleStart] = useState('');
  const [cycleEnd, setCycleEnd] = useState('');
  const [cycleDue, setCycleDue] = useState('');

  // Cycle Bundler execution state
  const [bundlingNow, setBundlingNow] = useState(false);

  // Approver Candidates & Selection state
  const [approverCandidates, setApproverCandidates] = useState<Array<{ id: number; full_name: string; email: string; role: string }>>([]);
  const [cfoApproverIds, setCfoApproverIds] = useState<number[]>([]);
  const [accountantApproverIds, setAccountantApproverIds] = useState<number[]>([]);
  const [savingApprovers, setSavingApprovers] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [catList, cycList, aiList, polList, candidates] = await Promise.all([
        expensesApi.getCategories().catch(() => []),
        expensesApi.getCycles().catch(() => []),
        expensesApi.getAIProviders().catch(() => []),
        expensesApi.getPolicies().catch(() => []),
        expensesApi.getApproverCandidates().catch(() => []),
      ]);
      setCategories(catList);
      setCycles(cycList);
      setAiProviders(aiList);
      setApproverCandidates(candidates);

      const map: Record<string, string> = {};
      polList.forEach((p) => {
        map[p.policy_key] = p.policy_value;
      });
      setPolicies(map);

      // Parse configured CFO and Accountant user IDs
      if (map.cfo_approver_user_ids) {
        setCfoApproverIds(
          map.cfo_approver_user_ids
            .split(',')
            .map((x) => Number(x.trim()))
            .filter((x) => !isNaN(x) && x > 0)
        );
      }
      if (map.accountant_approver_user_ids) {
        setAccountantApproverIds(
          map.accountant_approver_user_ids
            .split(',')
            .map((x) => Number(x.trim()))
            .filter((x) => !isNaN(x) && x > 0)
        );
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to load configuration data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Open AI Provider Modal for Create or Edit
  const handleOpenProviderModal = (provider?: AIProviderConfig) => {
    setTestResult(null);
    if (provider) {
      setEditingProvider(provider);
      setProvType(provider.provider);
      setProvLabel(provider.label);
      setProvModel(provider.model_name);
      setProvEndpoint(provider.api_endpoint || '');
      setProvApiKey(provider.api_key_override || '');
      setProvIsDefault(provider.is_default);
      setProvIsActive(provider.is_active);
    } else {
      setEditingProvider(null);
      setProvType('GOOGLE');
      setProvLabel('Google Gemini API');
      setProvModel('gemini-2.0-flash');
      setProvEndpoint('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent');
      setProvApiKey('');
      setProvIsDefault(aiProviders.length === 0);
      setProvIsActive(true);
    }
    setProviderModalOpen(true);
  };

  // Preset model helper
  const handleProviderTypeChange = (type: 'GOOGLE' | 'NVIDIA' | 'OPENROUTER' | 'KILO' | 'LOCAL') => {
    setProvType(type);
    if (type === 'GOOGLE') {
      setProvLabel('Google Gemini API');
      setProvModel('gemini-2.0-flash');
      setProvEndpoint('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent');
    } else if (type === 'NVIDIA') {
      setProvLabel('Nvidia NIM');
      setProvModel('meta/llama-3.2-11b-vision-instruct');
      setProvEndpoint('https://integrate.api.nvidia.com/v1/chat/completions');
    } else if (type === 'OPENROUTER') {
      setProvLabel('OpenRouter');
      setProvModel('openrouter/free');
      setProvEndpoint('https://openrouter.ai/api/v1/chat/completions');
    } else if (type === 'KILO') {
      setProvLabel('Kilo AI');
      setProvModel('kilo-vision-1');
      setProvEndpoint('https://api.kilo.ai/v1/chat/completions');
    } else if (type === 'LOCAL') {
      setProvLabel('Local Ollama');
      setProvModel('llama3.2-vision');
      setProvEndpoint('http://localhost:11434/api/generate');
    }
  };

  // Test Connection
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      if (!provApiKey && provType !== 'LOCAL') {
        throw new Error(`API key is required for ${provLabel}. Please enter an API key to test.`);
      }
      const res = await expensesApi.testAIProvider({
        provider: provType,
        model_name: provModel,
        api_endpoint: provEndpoint || null,
        api_key: provApiKey || null,
      });
      if (res.recommended_model && res.recommended_model !== provModel) {
        setProvModel(res.recommended_model);
      }
      setTestResult({
        success: res.success,
        message: res.message,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Connection failed. Please verify API key and endpoint.',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Save AI Provider
  const handleSaveProvider = async () => {
    try {
      if (editingProvider) {
        const updated = await expensesApi.updateAIProvider(editingProvider.id, {
          label: provLabel,
          model_name: provModel,
          api_endpoint: provEndpoint || null,
          api_key_override: provApiKey || null,
          is_default: provIsDefault,
          is_active: provIsActive,
        });
        setAiProviders((prev) =>
          prev.map((p) =>
            p.id === updated.id
              ? updated
              : provIsDefault
              ? { ...p, is_default: false }
              : p
          )
        );
        showToast(`AI Provider "${updated.label}" saved successfully.`, 'success');
      } else {
        const created = await expensesApi.createAIProvider({
          provider: provType,
          label: provLabel,
          model_name: provModel,
          api_endpoint: provEndpoint || null,
          api_key_override: provApiKey || null,
          is_default: provIsDefault,
          is_active: provIsActive,
        });
        setAiProviders((prev) => [
          ...prev.map((p) => (provIsDefault ? { ...p, is_default: false } : p)),
          created,
        ]);
        showToast(`AI Provider "${created.label}" added successfully.`, 'success');
      }
      setProviderModalOpen(false);
    } catch (err: any) {
      showToast(err?.message || 'Failed to save AI Provider settings.', 'error');
    }
  };

  // Make default provider
  const handleMakeDefaultProvider = async (provider: AIProviderConfig) => {
    try {
      await expensesApi.updateAIProvider(provider.id, { is_default: true, is_active: true });
      setAiProviders((prev) =>
        prev.map((p) => ({
          ...p,
          is_default: p.id === provider.id,
        }))
      );
      showToast(`${provider.label} is now active as the primary Vision AI provider.`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to set default provider.', 'error');
    }
  };

  // Save Policy
  const handleUpdatePolicy = async (key: string, value: string) => {
    try {
      await expensesApi.updatePolicy(key, value);
      setPolicies((prev) => ({ ...prev, [key]: value }));
      showToast(`Policy setting saved.`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update policy.', 'error');
    }
  };

  // Save Category
  const handleSaveCategory = async () => {
    if (!catName.trim() || !catCode.trim()) {
      showToast('Category name and code are required.', 'error');
      return;
    }
    try {
      const payload = {
        name: catName.trim(),
        code: catCode.trim().toUpperCase(),
        limit_amount: catLimit ? parseFloat(catLimit) : null,
        limit_period: catPeriod,
        gl_account_code: catGL.trim() || null,
        is_active: true,
      };

      if (editingCategory) {
        const updated = await expensesApi.updateCategory(editingCategory.id, payload);
        setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        showToast('Category updated successfully.', 'success');
      } else {
        const created = await expensesApi.createCategory(payload);
        setCategories((prev) => [...prev, created]);
        showToast('Category created successfully.', 'success');
      }
      setCategoryModalOpen(false);
      setEditingCategory(null);
      setCatName('');
      setCatCode('');
      setCatLimit('');
      setCatGL('');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save category.', 'error');
    }
  };

  // Save Cycle
  const handleSaveCycle = async () => {
    if (!cycleName.trim() || !cycleStart || !cycleEnd || !cycleDue) {
      showToast('Please fill all required cycle fields.', 'error');
      return;
    }
    try {
      const created = await expensesApi.createCycle({
        name: cycleName.trim(),
        frequency: cycleFreq,
        period_start: cycleStart,
        period_end: cycleEnd,
        due_date: cycleDue,
        status: 'OPEN',
        auto_submit_enabled: true,
      });
      setCycles((prev) => [created, ...prev]);
      showToast('Claim cycle created successfully.', 'success');
      setCycleModalOpen(false);
      setCycleName('');
      setCycleStart('');
      setCycleEnd('');
      setCycleDue('');
    } catch (err: any) {
      showToast(err?.message || 'Failed to create claim cycle.', 'error');
    }
  };

  // Calculate prefilled dates based on cycle frequency
  const calculateCycleDates = (freq: string, baseStartDate?: string) => {
    const start = baseStartDate ? new Date(baseStartDate) : new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const sStr = fmt(start);

    const e = new Date(start);
    let namePrefix = '';

    if (freq === 'DAILY') {
      namePrefix = `Daily Cycle - ${start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    } else if (freq === 'TWO_DAYS') {
      e.setDate(e.getDate() + 1);
      namePrefix = `2-Day Cycle (${start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - ${e.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})`;
    } else if (freq === 'THREE_DAYS') {
      e.setDate(e.getDate() + 2);
      namePrefix = `3-Day Cycle (${start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - ${e.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})`;
    } else if (freq === 'WEEKLY') {
      e.setDate(e.getDate() + 6);
      namePrefix = `Weekly Cycle (${start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - ${e.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})`;
    } else if (freq === 'FORTNIGHTLY') {
      e.setDate(e.getDate() + 14);
      namePrefix = `Fortnight Cycle (${start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - ${e.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})`;
    } else if (freq === 'MONTHLY') {
      e.setDate(e.getDate() + 29);
      namePrefix = `Monthly Cycle - ${start.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;
    }

    const eStr = fmt(e);
    return { start: sStr, end: eStr, due: eStr, name: namePrefix };
  };

  // Run Cycle Bundler Now (Test & Immediate Execution)
  const handleRunCycleBundlerNow = async () => {
    setBundlingNow(true);
    try {
      const res = await expensesApi.triggerAutoBundle(true);
      showToast(res.message, res.claims_created && res.claims_created > 0 ? 'success' : 'info');
      loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to trigger cycle bundler.', 'error');
    } finally {
      setBundlingNow(false);
    }
  };

  // Save Approver Roles
  const handleSaveApproverRoles = async () => {
    setSavingApprovers(true);
    try {
      await Promise.all([
        expensesApi.updatePolicy(
          'cfo_approver_user_ids',
          cfoApproverIds.join(','),
          'Designated CFO and Executive Management Approver User IDs'
        ),
        expensesApi.updatePolicy(
          'accountant_approver_user_ids',
          accountantApproverIds.join(','),
          'Designated Accountant and Finance Approver User IDs'
        ),
      ]);
      showToast('Approval roles updated successfully.', 'success');
      loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save approval roles.', 'error');
    } finally {
      setSavingApprovers(false);
    }
  };

  return (
    <Box sx={{ pb: 6 }}>
      {/* Page Header matching KIM-OrbX Standard */}
      <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <Typography sx={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3, color: '#023020' }}>
            Expenses & Claim Configuration
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#7A8B80', mt: 0.5 }}>
            Configure Vision LLM provider credentials, expense categories, claim periods & approval policies.
          </Typography>
        </div>

        <IconButton
          onClick={loadData}
          size="small"
          sx={{ border: '1px solid #E4EBE1', borderRadius: 2 }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </IconButton>
      </Box>

      {/* Standard MUI Navigation Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: '#E4EBE1', mb: 2.5 }}>
        <Tabs
          value={tab}
          onChange={(_, next) => setTab(next)}
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
          <Tab icon={<Sparkles size={16} />} iconPosition="start" label="AI Vision Providers" />
          <Tab icon={<Layers size={16} />} iconPosition="start" label="Expense Categories & Limits" />
          <Tab icon={<Clock size={16} />} iconPosition="start" label="Claim Cycles" />
          <Tab icon={<Shield size={16} />} iconPosition="start" label="Approval Roles & Policies" />
        </Tabs>
      </Box>

      {/* TAB 1: AI VISION PROVIDERS */}
      <CustomTabPanel value={tab} index={0}>
        <Paper variant="outlined" sx={{ p: 3, borderColor: '#E4EBE1', borderRadius: 2.5, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
            <div>
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#023020' }}>
                Vision AI Extractor Engines
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#667085', mt: 0.25 }}>
                Select and configure the model used to read bill receipts and extract amounts, GST taxes, and vendor details.
              </Typography>
            </div>

            <Button
              variant="contained"
              startIcon={<Plus size={16} />}
              onClick={() => handleOpenProviderModal()}
              sx={{
                bgcolor: '#023020',
                '&:hover': { bgcolor: '#2A402A' },
                borderRadius: 2,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Add / Configure Provider
            </Button>
          </Box>

          {(() => {
            const defaultProv = aiProviders.find((p) => p.is_default);
            if (defaultProv && !defaultProv.api_key_override && defaultProv.provider !== 'LOCAL') {
              return (
                <Alert
                  severity="warning"
                  sx={{ mb: 2.5, borderRadius: 2 }}
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => handleOpenProviderModal(defaultProv)}
                      sx={{ fontWeight: 700 }}
                    >
                      Configure Key
                    </Button>
                  }
                >
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                    Default Vision Provider ({defaultProv.label}) requires an API Key
                  </Typography>
                  <Typography sx={{ fontSize: 12 }}>
                    Uploaded bills will not be automatically parsed by AI until a valid API key is entered. Click "Configure Key" to set your API key.
                  </Typography>
                </Alert>
              );
            }
            return null;
          })()}

          <Grid container spacing={2.5}>
            {aiProviders.length === 0 && (
              <Grid item xs={12}>
                <Box
                  sx={{
                    p: 5,
                    textAlign: 'center',
                    border: '1px dashed #CBD5E1',
                    borderRadius: 2,
                    bgcolor: '#F8FAFC',
                  }}
                >
                  <Sparkles size={36} color="#023020" style={{ margin: '0 auto 12px' }} />
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#16231B' }}>
                    No Vision AI Providers Configured
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: '#667085', mt: 0.5, mb: 2 }}>
                    Add a Vision model (Google Gemini, Nvidia NIM, OpenRouter, Kilo, or Ollama) to automatically extract receipts.
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Plus size={16} />}
                    onClick={() => handleOpenProviderModal()}
                    sx={{
                      bgcolor: '#023020',
                      '&:hover': { bgcolor: '#2A402A' },
                      borderRadius: 2,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Add / Configure Provider
                  </Button>
                </Box>
              </Grid>
            )}
            {aiProviders.map((provider) => {
              const isDefault = provider.is_default;
              return (
                <Grid item xs={12} md={6} lg={4} key={provider.id}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      borderColor: isDefault ? '#16C47F' : '#E4EBE1',
                      bgcolor: isDefault ? 'rgba(22, 196, 127, 0.03)' : '#FFFFFF',
                      borderWidth: isDefault ? 2 : 1,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      height: '100%',
                    }}
                  >
                    <div>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#16231B' }}>
                          {provider.label}
                        </Typography>
                        {isDefault ? (
                          <Chip
                            icon={<Check size={12} />}
                            label="Active Default"
                            size="small"
                            sx={{
                              bgcolor: 'rgba(22, 196, 127, 0.15)',
                              color: '#0F766E',
                              fontWeight: 700,
                              fontSize: 11,
                            }}
                          />
                        ) : (
                          <Chip
                            label={provider.is_active ? 'Available' : 'Disabled'}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: 11 }}
                          />
                        )}
                      </Box>

                      <Box sx={{ fontSize: 12, color: '#526356', my: 1.5 }}>
                        <div>
                          <strong>Model:</strong>{' '}
                          <code style={{ fontFamily: 'monospace', color: '#023020', fontWeight: 600 }}>
                            {provider.model_name}
                          </code>
                        </div>
                        <div style={{ marginTop: 4, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          <strong>Endpoint:</strong>{' '}
                          <span style={{ color: '#7A8B80', fontSize: 11 }}>
                            {provider.api_endpoint || 'Default Platform Endpoint'}
                          </span>
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <strong>API Key Status:</strong>{' '}
                          {provider.api_key_override ? (
                            <span style={{ color: '#16A34A', fontWeight: 600 }}>Configured in DB</span>
                          ) : (
                            <span style={{ color: '#667085' }}>Uses .env fallback</span>
                          )}
                        </div>
                      </Box>
                    </div>

                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 2, borderTop: '1px solid #F0F4F0', mt: 2 }}>
                      <Button
                        size="small"
                        startIcon={<Settings size={14} />}
                        onClick={() => handleOpenProviderModal(provider)}
                        sx={{ fontSize: 12, color: '#526356' }}
                      >
                        Configure
                      </Button>

                      {!isDefault && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleMakeDefaultProvider(provider)}
                          sx={{
                            fontSize: 12,
                            borderColor: '#023020',
                            color: '#023020',
                            '&:hover': { borderColor: '#2A402A', bgcolor: 'rgba(2, 48, 32, 0.04)' },
                          }}
                        >
                          Set as Default
                        </Button>
                      )}
                    </Box>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Paper>
      </CustomTabPanel>

      {/* TAB 2: CATEGORIES & LIMITS */}
      <CustomTabPanel value={tab} index={1}>
        <Paper variant="outlined" sx={{ p: 3, borderColor: '#E4EBE1', borderRadius: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
            <div>
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#023020' }}>
                Expense Categories & Spend Limits
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#667085', mt: 0.25 }}>
                Define expense categories with optional policy limits per expense, daily, or monthly.
              </Typography>
            </div>

            <Button
              variant="contained"
              startIcon={<Plus size={16} />}
              onClick={() => {
                setEditingCategory(null);
                setCatName('');
                setCatCode('');
                setCatLimit('');
                setCatGL('');
                setCategoryModalOpen(true);
              }}
              sx={{ bgcolor: '#023020', '&:hover': { bgcolor: '#2A402A' }, borderRadius: 2, fontSize: 13 }}
            >
              Add Category
            </Button>
          </Box>

          <Table sx={{ border: '1px solid #E4EBE1', borderRadius: 2 }}>
            <TableHead sx={{ bgcolor: '#F8FAF8' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#526356' }}>CATEGORY NAME</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#526356' }}>CODE</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#526356' }}>SPEND LIMIT</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#526356' }}>GL ACCOUNT CODE</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#526356', textAlign: 'center' }}>STATUS</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#526356', textAlign: 'right' }}>ACTION</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: 'center', py: 5, color: '#7A8B80' }}>
                    No expense categories configured. Click &quot;Add Category&quot; to create your first category.
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell sx={{ fontWeight: 600, color: '#16231B' }}>{c.name}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{c.code}</TableCell>
                    <TableCell>
                      {c.limit_amount ? (
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          ₹{Number(c.limit_amount).toFixed(2)} ({c.limit_period.toLowerCase()})
                        </span>
                      ) : (
                        <span style={{ color: '#94A3B8', fontStyle: 'italic', fontSize: 12 }}>No Limit</span>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, color: '#526356' }}>
                      {c.gl_account_code || '—'}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Chip label="Active" size="small" sx={{ bgcolor: '#EAF0EA', color: '#023020', fontWeight: 600 }} />
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right' }}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setEditingCategory(c);
                          setCatName(c.name);
                          setCatCode(c.code);
                          setCatLimit(c.limit_amount ? String(c.limit_amount) : '');
                          setCatPeriod(c.limit_period);
                          setCatGL(c.gl_account_code || '');
                          setCategoryModalOpen(true);
                        }}
                      >
                        <Edit2 size={15} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>
      </CustomTabPanel>

      {/* TAB 3: CLAIM CYCLES */}
      <CustomTabPanel value={tab} index={2}>
        <Paper variant="outlined" sx={{ p: 3, borderColor: '#E4EBE1', borderRadius: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
            <div>
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#023020' }}>
                Claim Cycles & Submission Windows
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#667085', mt: 0.25 }}>
                Define cycle frequencies (Daily, 2 Days, 3 Days, Weekly, Fortnightly) for automatic bill bundling.
              </Typography>
            </div>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Button
                variant="outlined"
                startIcon={<Zap size={15} className={bundlingNow ? 'animate-spin' : ''} />}
                onClick={handleRunCycleBundlerNow}
                disabled={bundlingNow}
                sx={{
                  borderColor: '#023020',
                  color: '#023020',
                  '&:hover': { borderColor: '#2A402A', bgcolor: 'rgba(2, 48, 32, 0.04)' },
                  borderRadius: 2,
                  fontSize: 13,
                  fontWeight: 600,
                  textTransform: 'none',
                }}
              >
                {bundlingNow ? 'Bundling...' : 'Run Cycle Bundler Now'}
              </Button>

              <Button
                variant="contained"
                startIcon={<Plus size={16} />}
                onClick={() => {
                  const def = calculateCycleDates('DAILY');
                  setCycleFreq('DAILY');
                  setCycleStart(def.start);
                  setCycleEnd(def.end);
                  setCycleDue(def.due);
                  setCycleName(def.name);
                  setCycleModalOpen(true);
                }}
                sx={{ bgcolor: '#023020', '&:hover': { bgcolor: '#2A402A' }, borderRadius: 2, fontSize: 13 }}
              >
                Configure New Cycle
              </Button>
            </Box>
          </Box>

          <Table sx={{ border: '1px solid #E4EBE1', borderRadius: 2 }}>
            <TableHead sx={{ bgcolor: '#F8FAF8' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#526356' }}>CYCLE NAME</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#526356' }}>FREQUENCY</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#526356' }}>PERIOD START & END</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#526356' }}>DUE DATE</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#526356', textAlign: 'center' }}>STATUS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cycles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: 'center', py: 5, color: '#7A8B80' }}>
                    No claim cycles defined. Click &quot;Configure New Cycle&quot; to establish submission periods.
                  </TableCell>
                </TableRow>
              ) : (
                cycles.map((cyc) => (
                  <TableRow key={cyc.id} hover>
                    <TableCell sx={{ fontWeight: 600, color: '#16231B' }}>{cyc.name}</TableCell>
                    <TableCell>{cyc.frequency}</TableCell>
                    <TableCell>
                      {cyc.period_start} to {cyc.period_end}
                    </TableCell>
                    <TableCell>{cyc.due_date}</TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Chip label={cyc.status} size="small" sx={{ bgcolor: '#EAF0EA', color: '#023020', fontWeight: 600 }} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>
      </CustomTabPanel>

      {/* TAB 4: APPROVAL ROLES & POLICIES */}
      <CustomTabPanel value={tab} index={3}>
        <Paper variant="outlined" sx={{ p: 3, borderColor: '#E4EBE1', borderRadius: 2.5, maxWidth: 840 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#023020', mb: 0.5 }}>
            Approval Hierarchy & Financial Policy Rules
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#667085', mb: 3 }}>
            Configure multi-tier approver roles (CFO and Accountant), cycle auto-submission, and payout reconciliation thresholds.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Section A: Multi-Level Approval Hierarchy */}
            <Paper variant="outlined" sx={{ p: 2.5, borderColor: '#16C47F', bgcolor: '#FAFCFA', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: 15, fontWeight: 800, color: '#023020' }}>
                    Multi-Level Approver Hierarchy Configuration
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#526356', mt: 0.25 }}>
                    Define which team members have authority to review and approve claims at each stage.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSaveApproverRoles}
                  disabled={savingApprovers}
                  sx={{ bgcolor: '#023020', '&:hover': { bgcolor: '#2A402A' }, textTransform: 'none', fontWeight: 600 }}
                >
                  {savingApprovers ? 'Saving...' : 'Save Approver Roles'}
                </Button>
              </Box>

              <Grid container spacing={2}>
                {/* Level 1: Line / Reporting Manager */}
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: '#FFFFFF', borderColor: '#E4EBE1', borderRadius: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip label="Level 1" size="small" sx={{ height: 20, fontSize: 10, bgcolor: '#DCFCE7', color: '#166534', fontWeight: 700 }} />
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#16231B' }}>
                            Line / Reporting Manager
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: 12, color: '#667085', mt: 0.5 }}>
                          Automatically routed based on each employee's configured <strong>Reporting Manager</strong> in User Management. Line Managers approve Stage 1 submitted claims.
                        </Typography>
                      </Box>
                      <Chip label="Configured in Users" size="small" sx={{ bgcolor: '#F0F4F0', color: '#526356', fontSize: 11 }} />
                    </Box>
                  </Paper>
                </Grid>

                {/* Level 2: CFO / Executive Management */}
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: '#FFFFFF', borderColor: '#E4EBE1', borderRadius: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Chip label="Level 2" size="small" sx={{ height: 20, fontSize: 10, bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 700 }} />
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#16231B' }}>
                        CFO / Management Approver(s)
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 12, color: '#667085', mb: 1.5 }}>
                      Select users responsible for Level 2 financial and budget approval. If none selected, defaults to System Admins.
                    </Typography>

                    <FormControl fullWidth size="small" sx={{ mt: 'auto' }}>
                      <InputLabel>Designated CFO Approver(s)</InputLabel>
                      <Select
                        multiple
                        value={cfoApproverIds}
                        label="Designated CFO Approver(s)"
                        onChange={(e) => {
                          const val = e.target.value;
                          setCfoApproverIds(typeof val === 'string' ? val.split(',').map(Number) : (val as number[]));
                        }}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((val) => {
                              const cand = approverCandidates.find((c) => c.id === val);
                              return <Chip key={val} label={cand?.full_name || `User #${val}`} size="small" sx={{ height: 22, fontSize: 11 }} />;
                            })}
                          </Box>
                        )}
                      >
                        {approverCandidates.map((u) => (
                          <MenuItem key={u.id} value={u.id}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                              <span>{u.full_name}</span>
                              <span style={{ fontSize: 11, color: '#94A3B8' }}>{u.role}</span>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Paper>
                </Grid>

                {/* Level 3: Accountant / Finance Officer */}
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: '#FFFFFF', borderColor: '#E4EBE1', borderRadius: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Chip label="Level 3" size="small" sx={{ height: 20, fontSize: 10, bgcolor: '#DBEAFE', color: '#1E40AF', fontWeight: 700 }} />
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#16231B' }}>
                        Accountant / Finance Officer(s)
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 12, color: '#667085', mb: 1.5 }}>
                      Select users responsible for GST/tax check, payout batch creation, and recording bank UTRs. If none selected, defaults to Finance Officers and Admins.
                    </Typography>

                    <FormControl fullWidth size="small" sx={{ mt: 'auto' }}>
                      <InputLabel>Designated Accountant(s)</InputLabel>
                      <Select
                        multiple
                        value={accountantApproverIds}
                        label="Designated Accountant(s)"
                        onChange={(e) => {
                          const val = e.target.value;
                          setAccountantApproverIds(typeof val === 'string' ? val.split(',').map(Number) : (val as number[]));
                        }}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((val) => {
                              const cand = approverCandidates.find((c) => c.id === val);
                              return <Chip key={val} label={cand?.full_name || `User #${val}`} size="small" sx={{ height: 22, fontSize: 11 }} />;
                            })}
                          </Box>
                        )}
                      >
                        {approverCandidates.map((u) => (
                          <MenuItem key={u.id} value={u.id}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                              <span>{u.full_name}</span>
                              <span style={{ fontSize: 11, color: '#94A3B8' }}>{u.role}</span>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Paper>
                </Grid>
              </Grid>
            </Paper>

            {/* Policy 1: Manual Claim Toggle */}
            <Paper variant="outlined" sx={{ p: 2.5, borderColor: '#E4EBE1', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#16231B' }}>
                    Cycle-Based Automatic Claim Submission
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#7A8B80', mt: 0.25 }}>
                    When enabled, all Ready bills are automatically bundled and submitted into claims at cycle close without requiring employee manual intervention.
                  </Typography>
                </div>
                <FormControlLabel
                  control={
                    <Switch
                      checked={policies.manual_claim_submission_enabled !== 'true'}
                      onChange={(e) =>
                        handleUpdatePolicy(
                          'manual_claim_submission_enabled',
                          e.target.checked ? 'false' : 'true'
                        )
                      }
                      color="primary"
                    />
                  }
                  label={
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#023020' }}>
                      {policies.manual_claim_submission_enabled === 'true' ? 'Manual Mode' : 'Auto-Bundling'}
                    </Typography>
                  }
                />
              </Box>
            </Paper>

            {/* Policy 2: Accountant Escalation */}
            <Paper variant="outlined" sx={{ p: 2.5, borderColor: '#E4EBE1', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#16231B' }}>
                    Escalate Unconfirmed Transfers to Accountant Queue
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#7A8B80', mt: 0.25 }}>
                    Elapsed hours after bank transfer UTR is recorded before alerting the accountant to follow up.
                  </Typography>
                </div>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    size="small"
                    type="number"
                    value={policies.accountant_escalation_hours || '72'}
                    onChange={(e) => setPolicies({ ...policies, accountant_escalation_hours: e.target.value })}
                    sx={{ width: 85 }}
                    inputProps={{ style: { textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 } }}
                  />
                  <Typography sx={{ fontSize: 12, color: '#667085' }}>hours</Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleUpdatePolicy('accountant_escalation_hours', policies.accountant_escalation_hours || '72')}
                    sx={{ ml: 1, textTransform: 'none', borderColor: '#023020', color: '#023020' }}
                  >
                    Save
                  </Button>
                </Box>
              </Box>
            </Paper>

            {/* Policy 3: Auto-Reconcile Undisputed Payouts */}
            <Paper variant="outlined" sx={{ p: 2.5, borderColor: '#E4EBE1', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#16231B' }}>
                    Auto-Reconcile Undisputed Payouts
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#7A8B80', mt: 0.25 }}>
                    Days after bank transfer to automatically mark the reimbursement confirmed if no dispute is raised.
                  </Typography>
                </div>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    size="small"
                    type="number"
                    value={policies.auto_reconcile_days || '7'}
                    onChange={(e) => setPolicies({ ...policies, auto_reconcile_days: e.target.value })}
                    sx={{ width: 85 }}
                    inputProps={{ style: { textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 } }}
                  />
                  <Typography sx={{ fontSize: 12, color: '#667085' }}>days</Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleUpdatePolicy('auto_reconcile_days', policies.auto_reconcile_days || '7')}
                    sx={{ ml: 1, textTransform: 'none', borderColor: '#023020', color: '#023020' }}
                  >
                    Save
                  </Button>
                </Box>
              </Box>
            </Paper>

            {/* Policy 4: Maximum Bill Age */}
            <Paper variant="outlined" sx={{ p: 2.5, borderColor: '#E4EBE1', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#16231B' }}>
                    Maximum Allowed Bill Age
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#7A8B80', mt: 0.25 }}>
                    Maximum age in days from invoice date for a receipt to remain eligible for reimbursement.
                  </Typography>
                </div>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    size="small"
                    type="number"
                    value={policies.max_bill_age_days || '90'}
                    onChange={(e) => setPolicies({ ...policies, max_bill_age_days: e.target.value })}
                    sx={{ width: 85 }}
                    inputProps={{ style: { textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 } }}
                  />
                  <Typography sx={{ fontSize: 12, color: '#667085' }}>days</Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleUpdatePolicy('max_bill_age_days', policies.max_bill_age_days || '90')}
                    sx={{ ml: 1, textTransform: 'none', borderColor: '#023020', color: '#023020' }}
                  >
                    Save
                  </Button>
                </Box>
              </Box>
            </Paper>
          </Box>
        </Paper>
      </CustomTabPanel>

      {/* DIALOG 1: CONFIGURE AI PROVIDER */}
      <Dialog open={providerModalOpen} onClose={() => setProviderModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#023020', pb: 1 }}>
          {editingProvider ? `Configure ${editingProvider.label}` : 'Connect Vision AI Provider'}
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <FormControl fullWidth size="small">
            <InputLabel>AI Provider Type</InputLabel>
            <Select
              value={provType}
              label="AI Provider Type"
              onChange={(e) => handleProviderTypeChange(e.target.value as any)}
            >
              <MenuItem value="GOOGLE">Google Gemini API (Gemini 1.5/2.0 Flash)</MenuItem>
              <MenuItem value="NVIDIA">Nvidia NIM (Llama 3.2 Vision / Nemotron)</MenuItem>
              <MenuItem value="OPENROUTER">OpenRouter (Multi-model Vision Gateway)</MenuItem>
              <MenuItem value="KILO">Kilo AI Vision</MenuItem>
              <MenuItem value="LOCAL">Local Ollama (Self-hosted Vision LLM)</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Provider Display Name"
            size="small"
            fullWidth
            value={provLabel}
            onChange={(e) => setProvLabel(e.target.value)}
          />

          <TextField
            label="Model Identifier"
            size="small"
            fullWidth
            value={provModel}
            onChange={(e) => setProvModel(e.target.value)}
            helperText="e.g. gemini-1.5-flash, meta/llama-3.2-11b-vision-instruct, llama3.2-vision"
          />

          <TextField
            label="API Endpoint URL"
            size="small"
            fullWidth
            value={provEndpoint}
            onChange={(e) => setProvEndpoint(e.target.value)}
            helperText="Custom REST or proxy endpoint (optional for standard cloud providers)"
          />

          <TextField
            label="API Key / Secret"
            size="small"
            fullWidth
            type={showApiKey ? 'text' : 'password'}
            value={provApiKey}
            onChange={(e) => setProvApiKey(e.target.value)}
            placeholder="Enter API key or leave blank to use .env variable"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowApiKey(!showApiKey)} edge="end" size="small">
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {testResult && (
            <Alert severity={testResult.success ? 'success' : 'error'} sx={{ fontSize: 12 }}>
              {testResult.message}
            </Alert>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={provIsDefault}
                  onChange={(e) => setProvIsDefault(e.target.checked)}
                  color="primary"
                />
              }
              label={<Typography sx={{ fontSize: 13, fontWeight: 600 }}>Set as Active Default Provider</Typography>}
            />

            <Button
              size="small"
              variant="outlined"
              onClick={handleTestConnection}
              disabled={testingConnection}
              startIcon={testingConnection ? <CircularProgress size={14} /> : <Zap size={14} />}
              sx={{ textTransform: 'none', borderColor: '#023020', color: '#023020' }}
            >
              Test Connection
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setProviderModalOpen(false)} sx={{ color: '#667085' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveProvider}
            sx={{ bgcolor: '#023020', '&:hover': { bgcolor: '#2A402A' } }}
          >
            Save Provider Configuration
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG 2: CATEGORY MODAL */}
      <Dialog open={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#023020', pb: 1 }}>
          {editingCategory ? 'Edit Expense Category' : 'New Expense Category'}
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Category Name *"
            size="small"
            fullWidth
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="e.g. Food & Refreshments"
          />

          <TextField
            label="Category Code *"
            size="small"
            fullWidth
            value={catCode}
            onChange={(e) => setCatCode(e.target.value)}
            placeholder="e.g. FOOD"
          />

          <TextField
            label="Limit Amount (₹)"
            size="small"
            type="number"
            fullWidth
            value={catLimit}
            onChange={(e) => setCatLimit(e.target.value)}
            placeholder="Optional spend cap"
          />

          <FormControl fullWidth size="small">
            <InputLabel>Limit Period</InputLabel>
            <Select value={catPeriod} label="Limit Period" onChange={(e) => setCatPeriod(e.target.value)}>
              <MenuItem value="PER_EXPENSE">Per Expense</MenuItem>
              <MenuItem value="DAILY">Daily Limit</MenuItem>
              <MenuItem value="MONTHLY">Monthly Limit</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="GL Account Code"
            size="small"
            fullWidth
            value={catGL}
            onChange={(e) => setCatGL(e.target.value)}
            placeholder="e.g. 5020-FOOD"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCategoryModalOpen(false)} sx={{ color: '#667085' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveCategory}
            sx={{ bgcolor: '#023020', '&:hover': { bgcolor: '#2A402A' } }}
          >
            Save Category
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG 3: CLAIM CYCLE MODAL */}
      <Dialog open={cycleModalOpen} onClose={() => setCycleModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#023020', pb: 1 }}>Configure Claim Cycle</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Cycle Name *"
            size="small"
            fullWidth
            value={cycleName}
            onChange={(e) => setCycleName(e.target.value)}
            placeholder="e.g. Nov 2026 - Fortnight 2"
          />

          <FormControl fullWidth size="small">
            <InputLabel>Frequency</InputLabel>
            <Select
              value={cycleFreq}
              label="Frequency"
              onChange={(e) => {
                const f = e.target.value;
                setCycleFreq(f);
                if (f !== 'CUSTOM') {
                  const d = calculateCycleDates(f, cycleStart);
                  setCycleStart(d.start);
                  setCycleEnd(d.end);
                  setCycleDue(d.due);
                  setCycleName(d.name);
                }
              }}
            >
              <MenuItem value="DAILY">Daily (1 Day)</MenuItem>
              <MenuItem value="TWO_DAYS">Every 2 Days</MenuItem>
              <MenuItem value="THREE_DAYS">Every 3 Days</MenuItem>
              <MenuItem value="WEEKLY">Weekly (7 Days)</MenuItem>
              <MenuItem value="FORTNIGHTLY">Fortnightly (15 Days)</MenuItem>
              <MenuItem value="MONTHLY">Monthly (30 Days)</MenuItem>
              <MenuItem value="CUSTOM">Custom Range</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Period Start *"
            size="small"
            type="date"
            InputLabelProps={{ shrink: true }}
            fullWidth
            value={cycleStart}
            onChange={(e) => {
              const s = e.target.value;
              setCycleStart(s);
              if (cycleFreq !== 'CUSTOM') {
                const d = calculateCycleDates(cycleFreq, s);
                setCycleEnd(d.end);
                setCycleDue(d.due);
                setCycleName(d.name);
              }
            }}
          />

          <TextField
            label="Period End *"
            size="small"
            type="date"
            InputLabelProps={{ shrink: true }}
            fullWidth
            value={cycleEnd}
            onChange={(e) => setCycleEnd(e.target.value)}
          />

          <TextField
            label="Submission Due Date *"
            size="small"
            type="date"
            InputLabelProps={{ shrink: true }}
            fullWidth
            value={cycleDue}
            onChange={(e) => setCycleDue(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCycleModalOpen(false)} sx={{ color: '#667085' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveCycle}
            sx={{ bgcolor: '#023020', '&:hover': { bgcolor: '#2A402A' } }}
          >
            Create Cycle
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
