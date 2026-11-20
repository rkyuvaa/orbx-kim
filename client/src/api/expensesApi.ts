const API_BASE = '/api/v1/expenses';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getAuthHeadersMultipart(): HeadersInit {
  const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Types
export interface Bill {
  id: number;
  bill_number: string | null;
  bill_date: string | null;
  supplier_name: string | null;
  category_id: number | null;
  category_name: string | null;
  uploaded_by_id: number;
  uploaded_by_name: string | null;
  branch_id: number | null;
  branch_name: string | null;
  claim_id: number | null;
  source_file_path: string;
  source_mime: string;
  source_hash: string | null;
  taxable_amount: number;
  cgst_pct: number;
  cgst_amount: number;
  sgst_pct: number;
  sgst_amount: number;
  igst_pct: number;
  igst_amount: number;
  gst_total: number;
  total_amount: number;
  extraction_status: 'PROCESSING' | 'EXTRACTED' | 'NEEDS_REVIEW' | 'FAILED' | 'READY';
  extraction_confidence: number;
  extraction_raw: any;
  is_duplicate: boolean;
  duplicate_of_bill_id: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Claim {
  id: number;
  claim_no: string;
  employee_user_id: number;
  employee_name: string | null;
  employee_email: string | null;
  branch_id: number | null;
  branch_name: string | null;
  claim_cycle_id: number | null;
  cycle_name: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'LINE_MANAGER_APPROVED' | 'CFO_APPROVED' | 'ACCOUNTANT_APPROVED' | 'REJECTED' | 'PAID';
  total_amount: number;
  submitted_at: string | null;
  line_manager_id: number | null;
  line_manager_name: string | null;
  line_manager_action_at: string | null;
  cfo_id: number | null;
  cfo_name: string | null;
  cfo_action_at: string | null;
  accountant_id: number | null;
  accountant_name: string | null;
  accountant_action_at: string | null;
  rejection_reason: string | null;
  bills_count: number;
  created_at: string;
  updated_at: string;
  bills?: Bill[];
  status_history?: ClaimStatusHistory[];
}

export interface ClaimStatusHistory {
  id: number;
  from_status: string;
  to_status: string;
  actor_user_id: number | null;
  actor_name: string | null;
  note: string | null;
  created_at: string;
}

export interface PayoutEmployeeStatus {
  id: number;
  payout_id: number;
  employee_user_id: number;
  employee_name: string | null;
  amount: number;
  status: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'DISPUTED' | 'AUTO_RECONCILED';
  confirmed_at: string | null;
  confirmation_method: string | null;
  notes: string | null;
  reminder_count: number;
  last_reminder_at: string | null;
  created_at: string;
}

export interface Payout {
  id: number;
  batch_no: string;
  created_by_id: number;
  created_by_name: string | null;
  status: 'PENDING_TRANSFER' | 'TRANSFERRED' | 'CONFIRMED';
  total_amount: number;
  claim_count: number;
  payment_date: string | null;
  utr_number: string | null;
  bank_ref: string | null;
  notes: string | null;
  transferred_at: string | null;
  created_at: string;
  employee_statuses: PayoutEmployeeStatus[];
}

export interface ExpenseCategory {
  id: number;
  name: string;
  code: string;
  description: string | null;
  limit_amount: number | null;
  limit_period: string;
  gl_account_code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClaimCycle {
  id: number;
  name: string;
  frequency: string;
  period_start: string;
  period_end: string;
  due_date: string;
  status: string;
  auto_submit_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIProviderConfig {
  id: number;
  provider: 'GOOGLE' | 'NVIDIA' | 'OPENROUTER' | 'KILO' | 'LOCAL';
  label: string;
  model_name: string;
  api_endpoint: string | null;
  api_key_env_var: string | null;
  api_key_override: string | null;
  is_default: boolean;
  is_active: boolean;
  config_json: any;
  created_at: string;
  updated_at: string;
}

export interface ExpensePolicy {
  id: number;
  policy_key: string;
  policy_value: string;
  description: string | null;
  data_type: string;
}

export interface BranchItem {
  id: number;
  code: string;
  name: string;
  address: string | null;
}

export interface UserAssignmentItem {
  id: number;
  email: string;
  full_name: string;
  role: string;
  branch_id: number | null;
  branch_name: string | null;
  reporting_manager_id: number | null;
  reporting_manager_name: string | null;
}

// API Methods
export const expensesApi = {
  // Bills
  async getMyBills(status?: string): Promise<Bill[]> {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await fetch(`${API_BASE}/bills/my-bills${q}`, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getAllBills(branchId?: number): Promise<Bill[]> {
    const q = branchId ? `?branch_id=${branchId}` : '';
    const res = await fetch(`${API_BASE}/bills/all${q}`, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async uploadBill(file: File, categoryId?: number, notes?: string): Promise<Bill> {
    const formData = new FormData();
    formData.append('file', file);
    if (categoryId) formData.append('category_id', String(categoryId));
    if (notes) formData.append('notes', notes);

    const res = await fetch(`${API_BASE}/bills/upload`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeadersMultipart(),
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateBill(billId: number, data: Partial<Bill>): Promise<Bill> {
    const res = await fetch(`${API_BASE}/bills/${billId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async confirmBillReady(billId: number): Promise<Bill> {
    const res = await fetch(`${API_BASE}/bills/${billId}/confirm`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async reExtractBill(billId: number): Promise<Bill> {
    const res = await fetch(`${API_BASE}/bills/${billId}/re-extract`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const errText = await res.text();
      try {
        const parsed = JSON.parse(errText);
        throw new Error(parsed.detail || errText);
      } catch (e: any) {
        throw new Error(e.message || errText);
      }
    }
    return res.json();
  },

  async deleteBill(billId: number): Promise<void> {
    const res = await fetch(`${API_BASE}/bills/${billId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
  },

  getFileUrl(billId: number): string {
    const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
    return `${API_BASE}/files/${billId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },

  // Claims
  async getMyClaims(): Promise<Claim[]> {
    const res = await fetch(`${API_BASE}/claims/my-claims`, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getAllClaims(status?: string, branchId?: number): Promise<Claim[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (branchId) params.append('branch_id', String(branchId));
    const res = await fetch(`${API_BASE}/claims/all?${params.toString()}`, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getClaimDetail(claimId: number): Promise<Claim> {
    const res = await fetch(`${API_BASE}/claims/${claimId}`, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async submitClaimManual(billIds: number[], cycleId?: number, notes?: string): Promise<Claim> {
    const res = await fetch(`${API_BASE}/claims/submit-manual`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify({ bill_ids: billIds, cycle_id: cycleId, notes }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async triggerAutoBundle(force: boolean = true): Promise<{ message: string; claim_ids: number[]; claims_created?: number }> {
    const res = await fetch(`${API_BASE}/claims/trigger-auto-bundle?force=${force}`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getApproverCandidates(): Promise<Array<{ id: number; full_name: string; email: string; role: string }>> {
    const res = await fetch(`${API_BASE}/approvers/candidates`, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getPendingApprovals(): Promise<Claim[]> {
    const res = await fetch(`${API_BASE}/claims/approvals/pending`, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async approveClaim(claimId: number, note?: string): Promise<Claim> {
    const res = await fetch(`${API_BASE}/claims/${claimId}/approve`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify({ note }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async rejectClaim(claimId: number, reason: string): Promise<Claim> {
    const res = await fetch(`${API_BASE}/claims/${claimId}/reject`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Payouts
  async getPayouts(): Promise<Payout[]> {
    const res = await fetch(`${API_BASE}/payouts`, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createPayoutBatch(claimIds: number[], notes?: string): Promise<Payout> {
    const res = await fetch(`${API_BASE}/payouts/create-batch`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify({ claim_ids: claimIds, notes }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async recordPayoutTransfer(
    payoutId: number,
    utrNumber: string,
    paymentDate: string,
    bankRef?: string,
    notes?: string
  ): Promise<Payout> {
    const res = await fetch(`${API_BASE}/payouts/${payoutId}/record-transfer`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        utr_number: utrNumber,
        payment_date: paymentDate,
        bank_ref: bankRef,
        notes,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getMyConfirmations(): Promise<PayoutEmployeeStatus[]> {
    const res = await fetch(`${API_BASE}/payouts/my-confirmations`, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async confirmReceipt(payoutId: number, notes?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/payouts/${payoutId}/confirm-receipt`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) throw new Error(await res.text());
  },

  async runFollowup(): Promise<{ escalated_reminders: number; auto_reconciled: number }> {
    const res = await fetch(`${API_BASE}/payouts/run-followup`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Configuration
  async getCategories(): Promise<ExpenseCategory[]> {
    const res = await fetch(`${API_BASE}/configuration/categories`, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createCategory(data: Partial<ExpenseCategory>): Promise<ExpenseCategory> {
    const res = await fetch(`${API_BASE}/configuration/categories`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateCategory(categoryId: number, data: Partial<ExpenseCategory>): Promise<ExpenseCategory> {
    const res = await fetch(`${API_BASE}/configuration/categories/${categoryId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getCycles(): Promise<ClaimCycle[]> {
    const res = await fetch(`${API_BASE}/configuration/cycles`, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createCycle(data: Partial<ClaimCycle>): Promise<ClaimCycle> {
    const res = await fetch(`${API_BASE}/configuration/cycles`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateCycle(cycleId: number, data: Partial<ClaimCycle>): Promise<ClaimCycle> {
    const res = await fetch(`${API_BASE}/configuration/cycles/${cycleId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getAIProviders(): Promise<AIProviderConfig[]> {
    const res = await fetch(`${API_BASE}/configuration/ai-providers`, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createAIProvider(data: Partial<AIProviderConfig>): Promise<AIProviderConfig> {
    const res = await fetch(`${API_BASE}/configuration/ai-providers`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateAIProvider(providerId: number, data: Partial<AIProviderConfig>): Promise<AIProviderConfig> {
    const res = await fetch(`${API_BASE}/configuration/ai-providers/${providerId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async testAIProvider(data: {
    provider: string;
    model_name: string;
    api_endpoint?: string | null;
    api_key?: string | null;
  }): Promise<{ success: boolean; message: string; recommended_model?: string | null }> {
    const res = await fetch(`${API_BASE}/configuration/ai-providers/test`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getPolicies(): Promise<ExpensePolicy[]> {
    const res = await fetch(`${API_BASE}/configuration/policies`, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updatePolicy(key: string, value: string, description?: string): Promise<ExpensePolicy> {
    const res = await fetch(`${API_BASE}/configuration/policies/${key}`, {
      method: 'PUT',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify({ policy_value: value, description }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getBranches(): Promise<BranchItem[]> {
    const res = await fetch(`${API_BASE}/configuration/branches`, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createBranch(code: string, name: string, address?: string): Promise<BranchItem> {
    const formData = new FormData();
    formData.append('code', code);
    formData.append('name', name);
    if (address) formData.append('address', address);

    const res = await fetch(`${API_BASE}/configuration/branches/create`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeadersMultipart(),
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getUsersForAssignment(): Promise<UserAssignmentItem[]> {
    const res = await fetch(`${API_BASE}/configuration/users`, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async assignUser(userId: number, branchId: number | null, reportingManagerId: number | null): Promise<void> {
    const res = await fetch(`${API_BASE}/configuration/branches/assign-user`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        user_id: userId,
        branch_id: branchId,
        reporting_manager_id: reportingManagerId,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
  },
};
