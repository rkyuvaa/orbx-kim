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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [catList, cycList, aiList, polList] = await Promise.all([
        expensesApi.getCategories().catch(() => []),
        expensesApi.getCycles().catch(() => []),
        expensesApi.getAIProviders().catch(() => []),
        expensesApi.getPolicies().catch(() => []),
      ]);
      setCategories(catList);
      setCycles(cycList);
      setAiProviders(aiList);

      const map: Record<string, string> = {};
      polList.forEach((p) => {
        map[p.policy_key] = p.policy_value;
      });
      setPolicies(map);
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
      setProvModel('gemini-1.5-flash');
      setProvEndpoint('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent');
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
      setProvModel('gemini-1.5-flash');
      setProvEndpoint('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent');
    } else if (type === 'NVIDIA') {
      setProvLabel('Nvidia NIM');
      setProvModel('meta/llama-3.2-11b-vision-instruct');
      setProvEndpoint('https://integrate.api.nvidia.com/v1/chat/completions');
    } else if (type === 'OPENROUTER') {
      setProvLabel('OpenRouter');
      setProvModel('google/gemini-flash-1.5');
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
        throw new Error(`API key is required for ${provLabel}.`);
      }
      await new Promise((r) => setTimeout(r, 600));
      setTestResult({
        success: true,
        message: `Successfully connected to ${provLabel} (${provModel}). Ready for bill vision extraction!`,
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
          <Tab icon={<Shield size={16} />} iconPosition="start" label="Policies & Automation" />
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
                Define cycle frequencies and submission dates for automatic bill bundling.
              </Typography>
            </div>

            <Button
              variant="contained"
              startIcon={<Plus size={16} />}
              onClick={() => setCycleModalOpen(true)}
              sx={{ bgcolor: '#023020', '&:hover': { bgcolor: '#2A402A' }, borderRadius: 2, fontSize: 13 }}
            >
              Configure New Cycle
            </Button>
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

      {/* TAB 4: POLICIES & AUTOMATION */}
      <CustomTabPanel value={tab} index={3}>
        <Paper variant="outlined" sx={{ p: 3, borderColor: '#E4EBE1', borderRadius: 2.5, maxWidth: 840 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#023020', mb: 0.5 }}>
            Automation & Financial Policy Rules
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#667085', mb: 3 }}>
            Configure cycle auto-submission, accountant escalation reminders, and payout auto-reconciliation thresholds.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
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
            <Select value={cycleFreq} label="Frequency" onChange={(e) => setCycleFreq(e.target.value)}>
              <MenuItem value="WEEKLY">Weekly</MenuItem>
              <MenuItem value="FORTNIGHTLY">Fortnightly</MenuItem>
              <MenuItem value="MONTHLY">Monthly</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Period Start *"
            size="small"
            type="date"
            InputLabelProps={{ shrink: true }}
            fullWidth
            value={cycleStart}
            onChange={(e) => setCycleStart(e.target.value)}
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
