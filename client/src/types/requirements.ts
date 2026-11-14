export type RequirementType = 'MATERIAL' | 'IT';

export type ITRequirementCategory = 
  | 'New Feature / Module'
  | 'Enhancement / Change'
  | 'Bug Fix'
  | 'Hardware / Device'
  | 'Access / Permission'
  | 'Other';

export type ITUrgencyLevel = 
  | 'Can wait'
  | 'Needed within 1 month'
  | 'Needed within 2 weeks'
  | 'ASAP';

export type ITRequirementStatus = 
  | 'DRAFT'
  | 'SUBMITTED'
  | 'MANAGER_APPROVAL'
  | 'IT_MANAGER_REVIEW'
  | 'DEPT_HEAD_APPROVAL'
  | 'IT_PROCESSING'
  | 'COMPLETED'
  | 'REJECTED';

export interface AttachmentFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploaded_at: string;
  uploaded_by?: string;
  data_url?: string;
}

export interface ApprovalStage {
  stage: 'RAISED_BY' | 'MANAGER' | 'IT_MANAGER' | 'DEPT_HEAD';
  title: string;
  approver_name: string;
  approver_designation?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_STARTED';
  date?: string;
  signature?: string;
  notes?: string;
}

export interface MaterialRequisitionItem {
  s_no: number;
  material_service_code: string;
  item_description: string;
  drawing_specs_yn: 'Y' | 'N';
  hsn_sac: string;
  uom: string;
  qty: number;
  rate: number;
  budget_amount: number;
  amount: number;
  remarks: string;
}

export interface RequirementItem {
  id: string; // e.g. REQ-MAT-1 or REQ-IT-1
  type: RequirementType;
  title: string;
  category: string;
  quantity: number;
  unit: string;
  estimated_unit_cost: number;
  total_cost: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: string; // Compatible with both Material & IT statuses
  department: string;
  requested_by: string;
  required_by_date: string;
  justification: string;
  specifications: string;
  vendor_suggestion?: string;
  created_at: string;

  // Material Requisition header fields
  request_no?: string;
  request_date?: string;
  requester_name?: string;
  approver?: string;
  project_code?: string;
  project_name?: string;
  material_items?: MaterialRequisitionItem[];
  attachments?: AttachmentFile[];

  // Extended IT Requirement fields
  requester_designation?: string;
  date_of_request?: string;
  requirement_type?: ITRequirementCategory;
  other_requirement_type?: string;
  business_problem?: string;
  affected_users_teams?: string[];
  urgency?: ITUrgencyLevel;
  preferred_go_live_date?: string;
  step_by_step_flow?: string;
  has_flowchart?: boolean;
  flowchart_files?: AttachmentFile[];
  mockup_files?: AttachmentFile[];
  mockup_it_notes?: string;
  mockup_approved?: boolean;
  mockup_feedback?: string;
  has_further_requirements?: boolean;
  additional_requirements?: string;
  project_timeline?: string;
  approval_history?: ApprovalStage[];
  rejection_reason?: string;
  current_approval_stage?: string;
}
