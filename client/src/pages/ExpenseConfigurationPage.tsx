import React, { useState, useEffect } from 'react';
import {
  Settings2,
  Building,
  Layers,
  Cpu,
  Shield,
  Plus,
  Check,
  CheckCircle2,
  AlertCircle,
  X,
  Edit2,
  Save,
  RefreshCw,
  UserCheck,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  expensesApi,
  ExpenseCategory,
  ClaimCycle,
  AIProviderConfig,
  ExpensePolicy,
  BranchItem,
  UserAssignmentItem,
} from '@/api/expensesApi';

export default function ExpenseConfigurationPage() {
  const [activeTab, setActiveTab] = useState<'branches' | 'categories' | 'cycles' | 'ai' | 'policies'>('branches');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data states (Rule: Empty arrays by default)
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [users, setUsers] = useState<UserAssignmentItem[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [cycles, setCycles] = useState<ClaimCycle[]>([]);
  const [aiProviders, setAiProviders] = useState<AIProviderConfig[]>([]);
  const [policies, setPolicies] = useState<Record<string, string>>({});

  // Modals & Forms
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatCode, setNewCatCode] = useState('');
  const [newCatLimit, setNewCatLimit] = useState<number | undefined>(undefined);
  const [newCatPeriod, setNewCatPeriod] = useState('PER_EXPENSE');
  const [newCatGL, setNewCatGL] = useState('');

  const [cycleModalOpen, setCycleModalOpen] = useState(false);
  const [newCycleName, setNewCycleName] = useState('');
  const [newCycleFreq, setNewCycleFreq] = useState('FORTNIGHTLY');
  const [newCycleStart, setNewCycleStart] = useState('');
  const [newCycleEnd, setNewCycleEnd] = useState('');
  const [newCycleDue, setNewCycleDue] = useState('');

  const [userAssignModalOpen, setUserAssignModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<UserAssignmentItem | null>(null);
  const [assignBranchId, setAssignBranchId] = useState<number | undefined>(undefined);
  const [assignManagerId, setAssignManagerId] = useState<number | undefined>(undefined);

  // Auto-clear toast
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [br, us, cat, cyc, ai, pol] = await Promise.all([
        expensesApi.getBranches().catch(() => []),
        expensesApi.getUsersForAssignment().catch(() => []),
        expensesApi.getCategories().catch(() => []),
        expensesApi.getCycles().catch(() => []),
        expensesApi.getAIProviders().catch(() => []),
        expensesApi.getPolicies().catch(() => []),
      ]);
      setBranches(br);
      setUsers(us);
      setCategories(cat);
      setCycles(cyc);
      setAiProviders(ai);

      const polMap: Record<string, string> = {};
      pol.forEach((p) => {
        polMap[p.policy_key] = p.policy_value;
      });
      setPolicies(polMap);
    } catch (err: any) {
      setError(err?.message || 'Failed to load configuration.');
    } finally {
      setLoading(false);
    }
  };

  // Add Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await expensesApi.createCategory({
        name: newCatName.trim(),
        code: newCatCode.trim().toUpperCase(),
        limit_amount: newCatLimit,
        limit_period: newCatPeriod,
        gl_account_code: newCatGL.trim() || undefined,
        is_active: true,
      });
      setCategories([...categories, created]);
      setCategoryModalOpen(false);
      setNewCatName('');
      setNewCatCode('');
      setNewCatLimit(undefined);
      setNewCatGL('');
      setSuccessMsg('Expense category created successfully.');
    } catch (err: any) {
      setError(err?.message || 'Failed to create category.');
    }
  };

  // Add Cycle
  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await expensesApi.createCycle({
        name: newCycleName.trim(),
        frequency: newCycleFreq,
        period_start: newCycleStart,
        period_end: newCycleEnd,
        due_date: newCycleDue,
        status: 'OPEN',
        auto_submit_enabled: true,
      });
      setCycles([created, ...cycles]);
      setCycleModalOpen(false);
      setNewCycleName('');
      setNewCycleStart('');
      setNewCycleEnd('');
      setNewCycleDue('');
      setSuccessMsg('Claim cycle configured successfully.');
    } catch (err: any) {
      setError(err?.message || 'Failed to create cycle.');
    }
  };

  // Assign user branch & line manager
  const handleAssignUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    try {
      await expensesApi.assignUser(targetUser.id, assignBranchId || null, assignManagerId || null);
      setUsers(
        users.map((u) =>
          u.id === targetUser.id
            ? {
                ...u,
                branch_id: assignBranchId || null,
                branch_name: branches.find((b) => b.id === assignBranchId)?.name || null,
                reporting_manager_id: assignManagerId || null,
                reporting_manager_name: users.find((m) => m.id === assignManagerId)?.full_name || null,
              }
            : u
        )
      );
      setUserAssignModalOpen(false);
      setTargetUser(null);
      setSuccessMsg('User branch assignment and reporting manager updated.');
    } catch (err: any) {
      setError(err?.message || 'Failed to update user assignment.');
    }
  };

  // Update AI Provider Default / Active
  const handleSetDefaultProvider = async (providerId: number) => {
    try {
      const updated = await expensesApi.updateAIProvider(providerId, { is_default: true, is_active: true });
      setAiProviders(
        aiProviders.map((p) => ({
          ...p,
          is_default: p.id === providerId,
        }))
      );
      setSuccessMsg(`${updated.label} is now set as the active default Vision AI provider.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to update default provider.');
    }
  };

  // Update Policy
  const handleSavePolicy = async (key: string, value: string) => {
    try {
      await expensesApi.updatePolicy(key, value);
      setPolicies({ ...policies, [key]: value });
      setSuccessMsg(`Policy "${key}" updated successfully.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to update policy.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Expenses Configuration</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage branches, category spend limits, claim cycles, Vision AI providers & approval policies.
          </p>
        </div>

        <button
          onClick={loadAll}
          title="Refresh Settings"
          className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 transition self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('branches')}
            className={`py-3 px-1 font-medium text-sm border-b-2 flex items-center gap-2 transition ${
              activeTab === 'branches'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Building className="w-4 h-4" />
            Branches & Assignments
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`py-3 px-1 font-medium text-sm border-b-2 flex items-center gap-2 transition ${
              activeTab === 'categories'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            Categories & Limits
          </button>

          <button
            onClick={() => setActiveTab('cycles')}
            className={`py-3 px-1 font-medium text-sm border-b-2 flex items-center gap-2 transition ${
              activeTab === 'cycles'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            Claim Cycles
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`py-3 px-1 font-medium text-sm border-b-2 flex items-center gap-2 transition ${
              activeTab === 'ai'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI Vision Providers
          </button>

          <button
            onClick={() => setActiveTab('policies')}
            className={`py-3 px-1 font-medium text-sm border-b-2 flex items-center gap-2 transition ${
              activeTab === 'policies'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Shield className="w-4 h-4" />
            Policies & Automation
          </button>
        </nav>
      </div>

      {/* TAB 1: BRANCHES & ASSIGNMENTS */}
      {activeTab === 'branches' && (
        <div className="space-y-6">
          {/* Branch Master List */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h3 className="text-base font-bold text-slate-900">Registered Branches</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {branches.map((b) => (
                <div key={b.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900">{b.name}</span>
                    <span className="ml-2 px-2 py-0.5 text-xs bg-slate-200 text-slate-700 rounded font-mono">
                      {b.code}
                    </span>
                    <p className="text-xs text-slate-500 mt-1">{b.address || 'India'}</p>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    {users.filter((u) => u.branch_id === b.id).length} users assigned
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* User Assignments Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Employee Branch & Line Manager Mapping</h3>
              <span className="text-xs text-slate-500">Total users: {users.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Assigned Branch</th>
                    <th className="py-3 px-4">Line Manager</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/75 transition">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{u.full_name}</div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded font-medium">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {u.branch_name ? (
                          <span className="font-semibold text-slate-800">{u.branch_name}</span>
                        ) : (
                          <span className="text-slate-400 italic text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {u.reporting_manager_name ? (
                          <span className="text-slate-800 font-medium">{u.reporting_manager_name}</span>
                        ) : (
                          <span className="text-slate-400 italic text-xs">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setTargetUser(u);
                            setAssignBranchId(u.branch_id || undefined);
                            setAssignManagerId(u.reporting_manager_id || undefined);
                            setUserAssignModalOpen(true);
                          }}
                          className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 rounded text-xs font-semibold text-slate-700 transition"
                        >
                          Edit Mapping
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EXPENSE CATEGORIES & LIMITS */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setCategoryModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Expense Category
            </button>
          </div>

          {categories.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
              <Layers className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900">No categories created</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Define categories (e.g. Travel, Food, Fuel, Accommodation) with optional policy spend limits.
              </p>
              <button
                onClick={() => setCategoryModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold"
              >
                Add Category
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Category Name</th>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Policy Spend Limit</th>
                    <th className="py-3 px-4">GL Account Code</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categories.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/75 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                      <td className="py-3 px-4 font-mono text-xs">{c.code}</td>
                      <td className="py-3 px-4">
                        {c.limit_amount ? (
                          <span className="font-mono font-semibold text-slate-800">
                            ₹{Number(c.limit_amount).toFixed(2)} ({c.limit_period.toLowerCase()})
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No limit</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-500">{c.gl_account_code || 'N/A'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CLAIM CYCLES */}
      {activeTab === 'cycles' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setCycleModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Configure New Cycle
            </button>
          </div>

          {cycles.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
              <Clock className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900">No claim cycles defined</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Define weekly, fortnightly, or monthly cycles for automatic bundling of employee expense receipts.
              </p>
              <button
                onClick={() => setCycleModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold"
              >
                Create First Cycle
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cycles.map((cyc) => (
                <div key={cyc.id} className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-base">{cyc.name}</span>
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                      {cyc.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <p>
                      <strong>Frequency:</strong> {cyc.frequency}
                    </p>
                    <p>
                      <strong>Period:</strong> {cyc.period_start} to {cyc.period_end}
                    </p>
                    <p>
                      <strong>Due Date:</strong> {cyc.due_date}
                    </p>
                    <p>
                      <strong>Auto-Submit:</strong> {cyc.auto_submit_enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: AI VISION PROVIDERS */}
      {activeTab === 'ai' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Configure Vision LLM providers for parsing uploaded bills and receipts. Antigravity supports Google Gemini, Nvidia NIM, OpenRouter, Kilo, and Local Ollama.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aiProviders.map((prov) => (
              <div
                key={prov.id}
                className={`p-5 rounded-xl border shadow-sm transition space-y-4 bg-white ${
                  prov.is_default ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">{prov.label}</h4>
                    <span className="text-xs font-mono text-slate-400">{prov.provider}</span>
                  </div>
                  {prov.is_default && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      ACTIVE DEFAULT
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-600 space-y-1.5">
                  <div>
                    <span className="font-semibold text-slate-700">Model:</span>{' '}
                    <span className="font-mono">{prov.model_name}</span>
                  </div>
                  {prov.api_endpoint && (
                    <div className="truncate">
                      <span className="font-semibold text-slate-700">Endpoint:</span>{' '}
                      <span className="font-mono text-slate-500">{prov.api_endpoint}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t flex items-center justify-between">
                  {!prov.is_default ? (
                    <button
                      onClick={() => handleSetDefaultProvider(prov.id)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-lg text-xs font-semibold transition"
                    >
                      Set as Active Default
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Currently Selected
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: POLICIES & AUTOMATION */}
      {activeTab === 'policies' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h3 className="text-base font-bold text-slate-900 border-b pb-3">Automation & Approval Policies</h3>

          {/* Policy 1: Manual Claim Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <p className="font-bold text-sm text-slate-900">Cycle-based Automatic Claim Submission</p>
              <p className="text-xs text-slate-500 mt-0.5">
                When enabled, all Ready bills are automatically bundled and submitted at cycle cutoff without employee manual action.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-700">
                {policies.manual_claim_submission_enabled === 'true' ? 'Manual Mode' : 'Automatic Bundling'}
              </span>
              <button
                onClick={() =>
                  handleSavePolicy(
                    'manual_claim_submission_enabled',
                    policies.manual_claim_submission_enabled === 'true' ? 'false' : 'true'
                  )
                }
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                  policies.manual_claim_submission_enabled === 'true'
                    ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {policies.manual_claim_submission_enabled === 'true' ? 'Switch to Auto' : 'Switch to Manual'}
              </button>
            </div>
          </div>

          {/* Policy 2: Accountant Escalation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <p className="font-bold text-sm text-slate-900">Escalate Unconfirmed Transfers to Accountant Queue</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Hours after bank transfer before triggering reminder notifications to the finance team.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={policies.accountant_escalation_hours || '72'}
                onChange={(e) => setPolicies({ ...policies, accountant_escalation_hours: e.target.value })}
                className="w-20 p-2 border border-slate-300 rounded text-sm font-mono text-center"
              />
              <span className="text-xs text-slate-500">hours</span>
              <button
                onClick={() => handleSavePolicy('accountant_escalation_hours', policies.accountant_escalation_hours || '72')}
                className="px-3 py-1.5 bg-slate-800 text-white rounded text-xs font-semibold"
              >
                Save
              </button>
            </div>
          </div>

          {/* Policy 3: Auto-Reconcile After N Days */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <p className="font-bold text-sm text-slate-900">Auto-Reconcile Undisputed Payouts</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Days after bank transfer to automatically mark confirmed if the claimant does not raise a dispute.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={policies.auto_reconcile_days || '7'}
                onChange={(e) => setPolicies({ ...policies, auto_reconcile_days: e.target.value })}
                className="w-20 p-2 border border-slate-300 rounded text-sm font-mono text-center"
              />
              <span className="text-xs text-slate-500">days</span>
              <button
                onClick={() => handleSavePolicy('auto_reconcile_days', policies.auto_reconcile_days || '7')}
                className="px-3 py-1.5 bg-slate-800 text-white rounded text-xs font-semibold"
              >
                Save
              </button>
            </div>
          </div>

          {/* Policy 4: Maximum Bill Age */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <p className="font-bold text-sm text-slate-900">Maximum Allowed Bill Age</p>
              <p className="text-xs text-slate-500 mt-0.5">Maximum age in days for a bill to be accepted for reimbursement.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={policies.max_bill_age_days || '90'}
                onChange={(e) => setPolicies({ ...policies, max_bill_age_days: e.target.value })}
                className="w-20 p-2 border border-slate-300 rounded text-sm font-mono text-center"
              />
              <span className="text-xs text-slate-500">days</span>
              <button
                onClick={() => handleSavePolicy('max_bill_age_days', policies.max_bill_age_days || '90')}
                className="px-3 py-1.5 bg-slate-800 text-white rounded text-xs font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USER ASSIGNMENT MODAL */}
      {userAssignModalOpen && targetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Assign Branch & Manager</h3>
            <p className="text-xs text-slate-500">
              User: <strong className="text-slate-800">{targetUser.full_name}</strong> ({targetUser.email})
            </p>

            <form onSubmit={handleAssignUserSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company Branch</label>
                <select
                  value={assignBranchId || ''}
                  onChange={(e) => setAssignBranchId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="">-- No Branch --</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reporting Line Manager</label>
                <select
                  value={assignManagerId || ''}
                  onChange={(e) => setAssignManagerId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="">-- No Line Manager --</option>
                  {users
                    .filter((u) => u.id !== targetUser.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} ({m.role})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setUserAssignModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">
                  Save Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CATEGORY MODAL */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">New Expense Category</h3>

            <form onSubmit={handleCreateCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Travel & Conveyance"
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category Code *</label>
                <input
                  type="text"
                  required
                  value={newCatCode}
                  onChange={(e) => setNewCatCode(e.target.value)}
                  placeholder="e.g. TRAVEL"
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Limit Amount (₹)</label>
                  <input
                    type="number"
                    value={newCatLimit || ''}
                    onChange={(e) => setNewCatLimit(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="Optional"
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Limit Period</label>
                  <select
                    value={newCatPeriod}
                    onChange={(e) => setNewCatPeriod(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="PER_EXPENSE">Per Expense</option>
                    <option value="DAILY">Daily</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">GL Account Code</label>
                <input
                  type="text"
                  value={newCatGL}
                  onChange={(e) => setNewCatGL(e.target.value)}
                  placeholder="e.g. 5010-TRAVEL"
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CLAIM CYCLE MODAL */}
      {cycleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Configure Claim Cycle</h3>

            <form onSubmit={handleCreateCycle} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cycle Name *</label>
                <input
                  type="text"
                  required
                  value={newCycleName}
                  onChange={(e) => setNewCycleName(e.target.value)}
                  placeholder="e.g. Nov 2026 - Fortnight 2"
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Frequency</label>
                <select
                  value={newCycleFreq}
                  onChange={(e) => setNewCycleFreq(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="FORTNIGHTLY">Fortnightly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Period Start *</label>
                  <input
                    type="date"
                    required
                    value={newCycleStart}
                    onChange={(e) => setNewCycleStart(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Period End *</label>
                  <input
                    type="date"
                    required
                    value={newCycleEnd}
                    onChange={(e) => setNewCycleEnd(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date *</label>
                <input
                  type="date"
                  required
                  value={newCycleDue}
                  onChange={(e) => setNewCycleDue(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setCycleModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">
                  Save Cycle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
