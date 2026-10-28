export type UserRole =
  | 'SALES_EXECUTIVE'
  | 'FINANCE_OFFICER'
  | 'DELIVERY_TEAM'
  | 'ADMIN';

export type ApplicationStatus =
  | 'LEAD'
  | 'APPLICATION'
  | 'VERIFICATION'
  | 'FINANCE'
  | 'QUERY'
  | 'SANCTIONED'
  | 'DELIVERY'
  | 'DISBURSEMENT'
  | 'COMPLETED'
  | 'REJECTED';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  initials: string;
}

export interface UserBrief {
  id: number;
  full_name: string;
  role: UserRole;
  role_name?: string;
  email: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface KpiValue {
  value: number;
  sub: string;
}

export interface Kpis {
  total_applications: KpiValue;
  doc_pending: KpiValue;
  verification_pending: KpiValue;
  finance_query: KpiValue;
  sanctioned: KpiValue;
  disbursement: KpiValue;
}

export interface PipelineStage {
  key: string;
  status: ApplicationStatus;
  label: string;
  tip: string;
  count: number;
  color?: string | null;
}

export interface RecentApplication {
  id: number;
  app_no: string;
  customer_name: string;
  customer_phone: string;
  vehicle: string;
  amount: number;
  status: ApplicationStatus;
  aging_label: string;
  aging_tone: string;
}

export interface AttentionItem {
  id: number;
  app_no: string;
  customer_name: string;
  issue: string;
  wait_label: string;
  urgent: boolean;
  action: string;
}

export interface WaitingItem {
  id: number;
  app_no: string;
  customer_name: string;
  who: string;
  wait_label: string;
  hot: boolean;
}

export interface FinanceCompany {
  id: number;
  name: string;
  email?: string | null;
  contact_number?: string | null;
  address?: string | null;
  total_apps: number;
  approved: number;
  rejected: number;
  avg_time_days: number;
  bar_pct: number;
}

export interface FinanceCompanyOption {
  id: number;
  name: string;
  email?: string | null;
  contact_number?: string | null;
  address?: string | null;
}

export interface VehicleModel {
  id: number;
  name: string;
  vehicle_price: number;
  down_payment: number;
  loan_amount: number;
  finance_company_id: number | null;
  finance_company_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleModelInput {
  name?: string;
  vehicle_price?: number;
  down_payment?: number;
  loan_amount?: number;
}

export interface StageConfig {
  id: number;
  key: string;
  label: string;
  status?: ApplicationStatus | null;
  order_index: number;
  enabled: boolean;
  color?: string | null;
  module: 'LEAD' | 'OPPORTUNITY';
  created_at: string;
  updated_at: string;
}

export interface StageInput {
  key: string;
  label: string;
  order_index: number;
  enabled: boolean;
  color?: string | null;
  module: 'LEAD' | 'OPPORTUNITY';
}

export interface CrmTabFilter {
  id?: number;
  field: string;
  operator: string;
  value: string;
  logical_operator: string;
}

export interface CrmTabConfig {
  id: number;
  module_id: string;
  name: string;
  code: string;
  description?: string | null;
  icon?: string | null;
  display_order: number;
  is_active: boolean;
  is_default: boolean;
  visibility_type: 'EVERYONE' | 'ROLES' | 'USERS';
  allowed_roles?: string | null;
  stage_ids: number[];
  stage_names?: string[];
  filters?: CrmTabFilter[];
  count: number;
  created_at: string;
  updated_at: string;
}

export interface CrmTabFieldOption {
  label: string;
  value: string;
  default?: boolean;
}

export interface CrmTabFieldConfig {
  id: number;
  tab_id: number;
  name: string;
  label: string;
  field_type: 'text' | 'numeric' | 'date' | 'boolean' | 'toggle' | 'dropdown' | 'file';
  is_required: boolean;
  is_visible: boolean;
  is_readonly: boolean;
  is_searchable: boolean;
  is_filterable: boolean;
  is_sortable: boolean;
  is_archived: boolean;
  display_order: number;
  placeholder?: string | null;
  help_text?: string | null;
  default_value?: string | null;
  options?: CrmTabFieldOption[] | null;
  file_config?: { allowed_extensions?: string[]; max_size_mb?: number } | null;
  field_permissions?: Record<string, { view?: boolean; edit?: boolean; required?: boolean; readonly?: boolean }> | null;
  stage_rules?: Record<string, { visible?: boolean; required?: boolean; readonly?: boolean }> | null;
  dependent_rules?: {
    depends_on_field_id?: number | null;
    depends_on_field_name?: string | null;
    condition?: 'equals' | 'not_equals' | 'is_filled' | 'is_empty' | 'greater_than' | 'less_than';
    value?: string | null;
    action?: 'show' | 'hide' | 'enable' | 'disable' | 'require';
  } | null;
  created_at: string;
  updated_at: string;
}

export interface CrmTabFieldInput {
  name: string;
  label: string;
  field_type: string;
  is_required: boolean;
  is_visible: boolean;
  is_readonly: boolean;
  is_searchable: boolean;
  is_filterable: boolean;
  is_sortable: boolean;
  display_order: number;
  placeholder?: string | null;
  help_text?: string | null;
  default_value?: string | null;
  options?: CrmTabFieldOption[] | null;
  file_config?: { allowed_extensions?: string[]; max_size_mb?: number } | null;
  field_permissions?: Record<string, { view?: boolean; edit?: boolean; required?: boolean; readonly?: boolean }> | null;
  stage_rules?: Record<string, { visible?: boolean; required?: boolean; readonly?: boolean }> | null;
  dependent_rules?: {
    depends_on_field_id?: number | null;
    depends_on_field_name?: string | null;
    condition?: 'equals' | 'not_equals' | 'is_filled' | 'is_empty' | 'greater_than' | 'less_than';
    value?: string | null;
    action?: 'show' | 'hide' | 'enable' | 'disable' | 'require';
  } | null;
}

export interface CrmLeadCustomFieldValue {
  id: number;
  application_id: number;
  field_id: number;
  value?: string | null;
  file_metadata?: {
    file_name: string;
    file_path: string;
    file_size: number;
    mime_type: string;
  } | null;
  quality_score?: number | null;
  quality_analysis?: Record<string, any> | null;
  is_verified: boolean;
  verified_by_id?: number | null;
  verified_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerificationDocument {
  id: number;
  application_id: number;
  field_id: number;
  field_name: string;
  field_label: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  uploaded_at: string;
  quality_score?: number | null;
  quality_analysis?: {
    overall_score: number;
    clarity_score: number;
    readability_score: number;
    completeness_score: number;
    orientation_score: number;
    ocr_extracted_text?: string;
    warning?: string | null;
  } | null;
  is_verified: boolean;
  verified_by_id?: number | null;
  verified_by_name?: string | null;
  verified_at?: string | null;
}

export interface FinalSubmissionSummary {
  leadId: number;
  leadReferenceNumber: string;
  financier: {
    id?: number | null;
    name: string;
    email?: string | null;
  };
  overallStatus: 'Documents Missing' | 'Quality Failed' | 'Pending Verification' | 'Ready to Send' | 'Sent to Financier' | 'Link Expired';
  canSend: boolean;
  blockers: string[];
  counts: {
    total: number;
    mandatory: number;
    uploaded: number;
    pendingUpload: number;
    qualityApproved: number;
    qualityFailed: number;
    verified: number;
    pendingVerification: number;
  };
  documents: {
    id: number;
    name: string;
    type: string;
    mandatory: boolean;
    uploadStatus: 'UPLOADED' | 'PENDING';
    fileName?: string | null;
    qualityStatus: 'GOOD' | 'POOR' | 'NOT_CHECKED' | '-';
    qualityScore?: number | null;
    verifiedBy?: string | null;
    verifiedOn?: string | null;
    fileMetadata?: {
      file_name: string;
      file_path: string;
      file_size?: number;
      mime_type?: string;
    } | null;
  }[];
  lastSend?: {
    status: string;
    sentToName: string;
    sentToEmail: string;
    sentBy?: string | null;
    sentOn: string;
    expiresAt: string;
    accessCount: number;
  } | null;
}

export interface PublicFinancierDocumentView {
  leadReferenceNumber: string;
  financierName: string;
  expiresAt: string;
  documents: {
    id: number;
    name: string;
    type: string;
    fileName: string;
    uploadStatus: string;
    qualityStatus: string;
    qualityScore?: number | null;
    verifiedBy?: string | null;
    verifiedOn?: string | null;
    previewUrl: string;
    downloadUrl: string;
  }[];
}

export interface SmtpSetting {
  smtp_host?: string | null;
  smtp_port: number;
  smtp_security: 'TLS' | 'SSL' | 'NONE';
  smtp_user?: string | null;
  has_password: boolean;
  smtp_from_email?: string | null;
  smtp_from_name: string;
  is_enabled: boolean;
}

export interface SmtpSettingInput {
  smtp_host?: string | null;
  smtp_port: number;
  smtp_security: 'TLS' | 'SSL' | 'NONE';
  smtp_user?: string | null;
  smtp_password?: string | null;
  smtp_from_email?: string | null;
  smtp_from_name: string;
  is_enabled: boolean;
}

export interface CrmTabInput {
  module_id?: string;
  name: string;
  code: string;
  description?: string;
  icon?: string;
  display_order: number;
  is_active: boolean;
  is_default: boolean;
  visibility_type: string;
  allowed_roles?: string;
  stage_ids: number[];
  filters?: Omit<CrmTabFilter, 'id'>[];
}

export interface Activity {
  id: number;
  app_no: string | null;
  actor_name: string;
  action: string;
  created_at: string;
}

export interface ActivityLogEntry {
  id: number;
  application_id: number;
  actor_id: number | null;
  actor_name: string | null;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface NavCounts {
  leads: number;
  applications: number;
  documents: number;
  verification: number;
  finance: number;
  delivery: number;
  disbursement: number;
  notifications: number;
  stages: Record<string, number>;
}

export interface TabCounts {
  all: number;
  mine: number;
  pending: number;
}

export interface DashboardData {
  kpis: Kpis;
  pipeline: PipelineStage[];
  recent_applications: RecentApplication[];
  recent_total: number;
  tab_counts: TabCounts;
  needs_attention: AttentionItem[];
  needs_attention_total: number;
  waiting_on: WaitingItem[];
  waiting_on_total: number;
  finance_companies: FinanceCompany[];
  activities: Activity[];
  nav_counts: NavCounts;
}

export interface ApplicationItem {
  id: number;
  app_no: string;
  customer_name: string;
  customer_phone: string;
  vehicle: string;
  vehicle_number?: string | null;
  vehicle_year?: string | null;
  fuel_type?: string | null;
  customer_status?: string | null;
  coupon_code?: string | null;
  lost_reason?: string | null;
  amount: number;
  status: ApplicationStatus;
  stage_key?: string | null;
  lead_source?: string | null;
  lead_score?: number;
  finance_company_id: number | null;
  finance_company_name: string | null;
  vehicle_model_id: number | null;
  vehicle_price: number | null;
  down_payment: number | null;
  assigned_to: number | null;
  assigned_to_name: string | null;
  created_at: string;
  updated_at: string;
  aging_label: string;
  aging_tone: string;
}

export interface CrmDropdownOption {
  id: number;
  category: string;
  label: string;
  value: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrmDropdownOptionInput {
  category: string;
  label: string;
  value: string;
  order_index?: number;
  is_active?: boolean;
}

export interface ApplicationListResponse {
  items: ApplicationItem[];
  total: number;
  page: number;
  page_size: number;
  tab_counts: TabCounts;
  stage_counts?: Record<string, number>;
}

export interface NotificationItem {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  // Optional fields for planned activity notifications
  planned_activity_id?: number;
  due_date?: string;
}

export interface StageRow {
  id: number;
  app_no: string;
  customer_name: string;
  status: string;
  [key: string]: string | number | null;
}

export interface ReportsSummary {
  pipeline: PipelineStage[];
  finance_companies: FinanceCompany[];
  monthly: { month: string; count: number }[];
}

export interface ActivityType {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityTypeInput {
  name: string;
  description?: string;
  icon?: string;
}

export interface PlannedActivityItem {
  id: number;
  application_id: number;
  activity_type_id: number | null;
  activity_type_name: string;
  subject: string;
  notes: string | null;
  due_date: string | null;
  status: string;
  assigned_to: number | null;
  assignee_name: string | null;
  created_by: number | null;
  creator_name: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface PlannedActivityInput {
  activity_type_id?: number | null;
  activity_type_name: string;
  subject: string;
  notes?: string;
  due_date?: string | null;
  assigned_to?: number | null;
}

export interface StageAutomoveRule {
  id: number;
  name: string;
  module: 'LEAD' | 'OPPORTUNITY';
  trigger_type: 'standard_field' | 'custom_field' | 'document_verification';
  field_name?: string | null;
  field_id?: number | null;
  field_label?: string | null;
  condition_operator: 'is_filled' | 'is_verified' | 'equals' | 'greater_than';
  condition_value?: string | null;
  source_stage_key?: string | null;
  target_status: string;
  target_stage_key?: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface StageAutomoveRuleInput {
  name: string;
  module: 'LEAD' | 'OPPORTUNITY';
  trigger_type: 'standard_field' | 'custom_field' | 'document_verification';
  field_name?: string | null;
  field_id?: number | null;
  condition_operator: 'is_filled' | 'is_verified' | 'equals' | 'greater_than';
  condition_value?: string | null;
  source_stage_key?: string | null;
  target_status: string;
  target_stage_key?: string | null;
  is_enabled: boolean;
}

export interface CostCenter {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  department_id?: number | null;
  department_name?: string | null;
  company_id?: number | null;
  company_name?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: number;
  code: string;
  name: string;
  company_id?: number | null;
  company_name?: string | null;
  address?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentSequence {
  id: number;
  document_type: string;
  name: string;
  description?: string | null;
  prefix: string;
  padding: number;
  next_number: number;
  suffix: string;
  is_active: boolean;
  sample_preview: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentSequenceUpdateInput {
  name?: string;
  description?: string | null;
  prefix?: string;
  padding?: number;
  next_number?: number;
  suffix?: string;
  is_active?: boolean;
}

export interface DocumentSequenceCreateInput {
  document_type: string;
  name: string;
  description?: string | null;
  prefix?: string;
  padding?: number;
  next_number?: number;
  suffix?: string;
  is_active?: boolean;
}


