import { baseApi } from './baseApi';

export interface JobRequisition {
  id: number;
  req_code: string;
  job_title: string;
  department: string;
  vacancies: number;
  employment_type: string;
  required_qualification: string;
  required_experience: string;
  skills: string;
  salary_range: string;
  preferred_joining_date?: string | null;
  job_description: string;
  requesting_department: string;
  requester_id?: number | null;
  requester_name: string;
  status: 'Job Requisition' | 'Approval' | 'Approved' | 'Rejected' | 'Closed';
  rejection_reason?: string | null;
  jd_attachment_url?: string | null;
  jd_attachment_name?: string | null;
  extracted_jd_text?: string | null;
  scoring_rubric?: Record<string, any> | null;
  rubric_version: number;
  rubric_generated_at?: string | null;
  created_at: string;
  updated_at: string;
  candidate_count: number;
}

export interface JobPosting {
  id: number;
  requisition_id: number;
  channel: string;
  draft_content: string;
  status: 'DRAFTED' | 'HR_APPROVED' | 'POSTED' | 'EXPIRED' | 'CANCELLED';
  approved_by_id?: number | null;
  approved_at?: string | null;
  external_job_id?: string | null;
  external_post_url?: string | null;
  posted_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateStageHistory {
  id: number;
  candidate_id: number;
  application_id?: number | null;
  previous_stage?: string | null;
  new_stage: string;
  changed_by_id?: number | null;
  changed_by_name: string;
  changed_at: string;
  remarks?: string | null;
}

export interface CandidateDocument {
  id: number;
  candidate_id: number;
  file_name: string;
  file_path: string;
  file_type?: string | null;
  file_hash?: string | null;
  uploaded_at: string;
}

export interface Candidate {
  id: number;
  candidate_code: string;
  job_requisition_id?: number | null;
  name: string;
  mobile: string;
  email: string;
  file_hash?: string | null;
  resume_url?: string | null;
  resume_file_type?: string | null;
  resume_extracted_text?: string | null;
  resume_extraction_status?: string;
  experience: string;
  qualification: string;
  current_company?: string | null;
  current_salary?: string | null;
  expected_salary?: string | null;
  notice_period?: string | null;
  candidate_source: string;
  consent_captured?: boolean;
  consent_timestamp?: string | null;
  is_anonymized?: boolean;
  stage:
    | 'Job Requisition'
    | 'Approval'
    | 'Sourcing'
    | 'Screening'
    | 'Interview'
    | 'Selected'
    | 'Offer & Joining'
    | 'Joined'
    | 'On Hold'
    | 'Rejected';
  previous_stage?: string | null;
  on_hold_reason?: string | null;
  rejection_reason?: string | null;
  ai_match_score?: number | null;
  ai_match_category?: string | null;
  ai_flagged?: boolean;
  ai_flag_reason?: string | null;
  latest_application_id?: number | null;
  interview_type?: string | null;
  interview_date?: string | null;
  interviewer_panel?: string | null;
  interview_round?: string | null;
  interview_feedback?: string | null;
  interview_rating?: number | null;
  interview_remarks?: string | null;
  selected_designation?: string | null;
  selected_department?: string | null;
  proposed_salary?: string | null;
  expected_joining_date?: string | null;
  selected_employment_type?: string | null;
  offer_status?: 'Offer Draft' | 'Offer Released' | 'Offer Accepted' | 'Offer Declined' | null;
  confirmed_joining_date?: string | null;
  is_employee_created: boolean;
  created_employee_id?: number | null;
  joined_date?: string | null;
  job_title?: string | null;
  job_department?: string | null;
  created_at: string;
  updated_at: string;
  stage_history?: CandidateStageHistory[];
  documents?: CandidateDocument[];
}

export interface JobApplication {
  id: number;
  application_no: string;
  candidate_id: number;
  job_requisition_id: number;
  candidate_source: string;
  stage: string;
  previous_stage?: string | null;
  on_hold_reason?: string | null;
  rejection_reason?: string | null;
  ai_evaluation_status: 'PENDING' | 'EVALUATING' | 'EVALUATED' | 'FAILED';
  latest_ai_score?: number | null;
  latest_ai_category?: string | null;
  ai_flagged: boolean;
  ai_flag_reason?: string | null;
  candidate_name?: string;
  candidate_email?: string;
  candidate_mobile?: string;
  candidate_experience?: string;
  candidate_qualification?: string;
  candidate_resume_url?: string;
  job_title?: string;
  job_department?: string;
  selected_designation?: string | null;
  selected_department?: string | null;
  proposed_salary?: string | null;
  expected_joining_date?: string | null;
  offer_status?: string | null;
  confirmed_joining_date?: string | null;
  is_employee_created: boolean;
  created_employee_id?: number | null;
  applied_at: string;
  created_at: string;
  updated_at: string;
}

export interface CandidateAIEvaluation {
  id: number;
  application_id: number;
  rubric_version: number;
  prompt_version: string;
  provider: string;
  model_name: string;
  skills_score: number;
  experience_score: number;
  education_score: number;
  skills_weight: number;
  experience_weight: number;
  education_weight: number;
  total_weighted_score: number;
  fit_category: string;
  explanation: string;
  matched_skills: Array<{ skill: string; evidence: string }>;
  missing_skills: string[];
  knockout_results?: Record<string, any> | null;
  recommendation: string;
  hr_feedback?: 'AGREE' | 'TOO_HIGH' | 'TOO_LOW' | null;
  hr_feedback_notes?: string | null;
  created_at: string;
}

export interface Interview {
  id: number;
  application_id: number;
  round_name: string;
  scheduled_at: string;
  mode: string;
  meeting_link?: string | null;
  location?: string | null;
  panel?: string | null;
  status: 'SCHEDULED' | 'CONFIRMED' | 'RESCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  invite_sent_at?: string | null;
  invite_status?: string | null;
  requester_notified_at?: string | null;
  requester_notify_status?: string | null;
  feedback?: string | null;
  rating?: number | null;
  remarks?: string | null;
  candidate_name?: string;
  job_title?: string;
  created_at: string;
  updated_at: string;
}

export interface HRAISettings {
  skills_weight: number;
  experience_weight: number;
  education_weight: number;
  auto_match_threshold: number;
  local_ai_only: boolean;
  provider_fallback_chain: string[];
  indeed_prompt_template: string;
  resume_ocr_prompt_template: string;
  candidate_matching_prompt_template: string;
  sms_dlt_template_id: string;
  sms_dlt_header: string;
  data_retention_days: number;
}

export interface AIProviderCard {
  id: number;
  provider: 'GOOGLE' | 'NVIDIA' | 'OPENROUTER' | 'KILO' | 'LOCAL';
  label: string;
  model_name: string;
  api_endpoint?: string | null;
  api_key_override?: string | null;
  is_default: boolean;
  is_active: boolean;
}

export interface HRAIUsageSummary {
  total_calls: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  avg_latency_ms: number;
  provider_breakdown: Record<string, number>;
  call_type_breakdown: Record<string, number>;
}

export interface RecruitmentKPIs {
  open_requisitions: number;
  total_candidates: number;
  job_requisition: number;
  approval: number;
  sourcing: number;
  screening: number;
  interviews: number;
  selected: number;
  offers: number;
  joining_pending: number;
  joined: number;
  on_hold: number;
  rejected: number;
  total_applications?: number;
  ai_evaluated_count?: number;
  ai_high_match_count?: number;
}

export interface JobRequisitionCreate {
  job_title: string;
  department: string;
  vacancies: number;
  employment_type: string;
  required_qualification: string;
  required_experience: string;
  skills: string;
  salary_range: string;
  preferred_joining_date?: string | null;
  job_description: string;
  requesting_department: string;
}

export interface CandidateCreate {
  job_requisition_id?: number | null;
  name: string;
  mobile: string;
  email: string;
  resume_url?: string | null;
  experience: string;
  qualification: string;
  current_company?: string | null;
  current_salary?: string | null;
  expected_salary?: string | null;
  notice_period?: string | null;
  candidate_source: string;
  stage?: string;
  consent_captured?: boolean;
}

export interface CandidateStageTransition {
  new_stage: string;
  remarks?: string;
  rejection_reason?: string;
  on_hold_reason?: string;
  interview_type?: string;
  interview_date?: string;
  interviewer_panel?: string;
  interview_round?: string;
  interview_feedback?: string;
  interview_rating?: number;
  selected_designation?: string;
  selected_department?: string;
  proposed_salary?: string;
  expected_joining_date?: string;
  selected_employment_type?: string;
  offer_status?: string;
  confirmed_joining_date?: string;
}

export const recruitmentApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getRecruitmentKPIs: build.query<RecruitmentKPIs, void>({
      query: () => ({ url: '/hr/recruitment/kpis' }),
      providesTags: ['RecruitmentKPIs', 'Candidates', 'JobRequisitions'],
    }),

    listJobRequisitions: build.query<
      JobRequisition[],
      { status_filter?: string; department?: string } | void
    >({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params) {
          if (params.status_filter) searchParams.append('status_filter', params.status_filter);
          if (params.department) searchParams.append('department', params.department);
        }
        return { url: `/hr/recruitment/requisitions?${searchParams.toString()}` };
      },
      providesTags: ['JobRequisitions'],
    }),

    createJobRequisition: build.mutation<JobRequisition, JobRequisitionCreate>({
      query: (body) => ({ url: '/hr/recruitment/requisitions', method: 'POST', body }),
      invalidatesTags: ['JobRequisitions', 'RecruitmentKPIs'],
    }),

    approveOrRejectJobRequisition: build.mutation<
      JobRequisition,
      { id: number; action: 'Approve' | 'Reject'; rejection_reason?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/hr/recruitment/requisitions/${id}/approve-reject`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['JobRequisitions', 'RecruitmentKPIs'],
    }),

    uploadJobDescription: build.mutation<JobRequisition, { id: number; formData: FormData }>({
      query: ({ id, formData }) => ({
        url: `/hr/recruitment/requisitions/${id}/upload-jd`,
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['JobRequisitions'],
    }),

    generateRequisitionRubric: build.mutation<Record<string, any>, number>({
      query: (id) => ({
        url: `/hr/recruitment/requisitions/${id}/generate-rubric`,
        method: 'POST',
      }),
      invalidatesTags: ['JobRequisitions'],
    }),

    listJobPostings: build.query<JobPosting[], number>({
      query: (reqId) => ({ url: `/hr/recruitment/requisitions/${reqId}/postings` }),
      providesTags: ['JobRequisitions'],
    }),

    draftJobPosting: build.mutation<JobPosting, { reqId: number; channel?: string }>({
      query: ({ reqId, channel = 'indeed' }) => ({
        url: `/hr/recruitment/requisitions/${reqId}/postings/draft?channel=${channel}`,
        method: 'POST',
      }),
      invalidatesTags: ['JobRequisitions'],
    }),

    approveJobPosting: build.mutation<JobPosting, number>({
      query: (postingId) => ({
        url: `/hr/recruitment/postings/${postingId}/approve`,
        method: 'PUT',
      }),
      invalidatesTags: ['JobRequisitions'],
    }),

    publishJobPosting: build.mutation<
      JobPosting,
      { postingId: number; external_job_id?: string; external_post_url?: string }
    >({
      query: ({ postingId, ...body }) => ({
        url: `/hr/recruitment/postings/${postingId}/publish`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['JobRequisitions'],
    }),

    listCandidates: build.query<
      Candidate[],
      {
        search?: string;
        job_requisition_id?: number;
        department?: string;
        stage?: string;
        candidate_source?: string;
      } | void
    >({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params) {
          if (params.search) searchParams.append('search', params.search);
          if (params.job_requisition_id) searchParams.append('job_requisition_id', String(params.job_requisition_id));
          if (params.department) searchParams.append('department', params.department);
          if (params.stage) searchParams.append('stage', params.stage);
          if (params.candidate_source) searchParams.append('candidate_source', params.candidate_source);
        }
        return { url: `/hr/recruitment/candidates?${searchParams.toString()}` };
      },
      providesTags: ['Candidates'],
    }),

    getCandidate: build.query<Candidate, number>({
      query: (id) => ({ url: `/hr/recruitment/candidates/${id}` }),
      providesTags: ['Candidates'],
    }),

    createCandidate: build.mutation<Candidate, CandidateCreate>({
      query: (body) => ({ url: '/hr/recruitment/candidates', method: 'POST', body }),
      invalidatesTags: ['Candidates', 'RecruitmentKPIs', 'JobRequisitions'],
    }),

    updateCandidate: build.mutation<Candidate, { id: number; body: Partial<CandidateCreate> }>({
      query: ({ id, body }) => ({
        url: `/hr/recruitment/candidates/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Candidates', 'RecruitmentKPIs'],
    }),

    deleteCandidate: build.mutation<void, number>({
      query: (id) => ({
        url: `/hr/recruitment/candidates/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Candidates', 'RecruitmentKPIs'],
    }),

    uploadAndParseResume: build.mutation<
      {
        file_hash: string;
        resume_url: string;
        resume_file_type: string;
        raw_text: string;
        parsed_candidate: Partial<CandidateCreate>;
        duplicate_candidate?: { candidate_id: number; candidate_code: string; name: string } | null;
      },
      FormData
    >({
      query: (formData) => ({
        url: '/hr/recruitment/candidates/upload-resume-and-parse',
        method: 'POST',
        body: formData,
      }),
    }),

    bulkUploadResumes: build.mutation<
      { total_uploaded: number; processed: number; failed: number; applications: JobApplication[]; errors: string[] },
      FormData
    >({
      query: (formData) => ({
        url: '/hr/recruitment/candidates/bulk-upload',
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['Candidates', 'JobRequisitions', 'RecruitmentKPIs'],
    }),

    // Applications Endpoints
    listJobApplications: build.query<
      JobApplication[],
      {
        job_requisition_id?: number;
        stage?: string;
        candidate_source?: string;
        ai_category?: string;
        ai_flagged?: boolean;
        search?: string;
      } | void
    >({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params) {
          if (params.job_requisition_id) searchParams.append('job_requisition_id', String(params.job_requisition_id));
          if (params.stage) searchParams.append('stage', params.stage);
          if (params.candidate_source) searchParams.append('candidate_source', params.candidate_source);
          if (params.ai_category) searchParams.append('ai_category', params.ai_category);
          if (params.ai_flagged !== undefined) searchParams.append('ai_flagged', String(params.ai_flagged));
          if (params.search) searchParams.append('search', params.search);
        }
        return { url: `/hr/recruitment/applications?${searchParams.toString()}` };
      },
      providesTags: ['Candidates', 'JobRequisitions'],
    }),

    getJobApplication: build.query<JobApplication, number>({
      query: (id) => ({ url: `/hr/recruitment/applications/${id}` }),
      providesTags: ['Candidates'],
    }),

    transitionApplicationStage: build.mutation<
      JobApplication,
      { id: number; body: CandidateStageTransition }
    >({
      query: ({ id, body }) => ({
        url: `/hr/recruitment/applications/${id}/transition-stage`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Candidates', 'RecruitmentKPIs'],
    }),

    evaluateApplicationAI: build.mutation<CandidateAIEvaluation, number>({
      query: (id) => ({
        url: `/hr/recruitment/applications/${id}/evaluate-ai`,
        method: 'POST',
      }),
      invalidatesTags: ['Candidates', 'RecruitmentKPIs'],
    }),

    getApplicationEvaluations: build.query<CandidateAIEvaluation[], number>({
      query: (appId) => ({ url: `/hr/recruitment/applications/${appId}/evaluations` }),
      providesTags: ['Candidates'],
    }),

    evaluateCandidateAI: build.mutation<CandidateAIEvaluation, number>({
      query: (id) => ({
        url: `/hr/recruitment/candidates/${id}/evaluate-ai`,
        method: 'POST',
      }),
      invalidatesTags: ['Candidates', 'RecruitmentKPIs'],
    }),

    getCandidateEvaluations: build.query<CandidateAIEvaluation[], number>({
      query: (candId) => ({ url: `/hr/recruitment/candidates/${candId}/evaluations` }),
      providesTags: ['Candidates'],
    }),

    getCandidateInterviews: build.query<Interview[], number>({
      query: (candId) => ({ url: `/hr/recruitment/candidates/${candId}/interviews` }),
      providesTags: ['Candidates'],
    }),

    submitAIEvaluationFeedback: build.mutation<
      CandidateAIEvaluation,
      { evalId: number; hr_feedback: 'AGREE' | 'TOO_HIGH' | 'TOO_LOW'; hr_feedback_notes?: string }
    >({
      query: ({ evalId, ...body }) => ({
        url: `/hr/recruitment/evaluations/${evalId}/feedback`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Candidates'],
    }),

    // Interviews
    listInterviews: build.query<Interview[], number>({
      query: (appId) => ({ url: `/hr/recruitment/applications/${appId}/interviews` }),
      providesTags: ['Candidates'],
    }),

    scheduleInterview: build.mutation<
      Interview,
      {
        application_id: number;
        round_name: string;
        scheduled_at: string;
        mode?: string;
        meeting_link?: string;
        location?: string;
        panel?: string;
        remarks?: string;
      }
    >({
      query: (body) => ({
        url: '/hr/recruitment/interviews',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Candidates', 'RecruitmentKPIs'],
    }),

    updateInterview: build.mutation<Interview, { id: number; body: Partial<Interview> }>({
      query: ({ id, body }) => ({
        url: `/hr/recruitment/interviews/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Candidates'],
    }),

    // AI Configuration & Settings
    getHRAISettings: build.query<HRAISettings, void>({
      query: () => ({ url: '/hr/recruitment/configuration/ai-settings' }),
      providesTags: ['HRAISettings'],
    }),

    updateHRAISettings: build.mutation<HRAISettings, Partial<HRAISettings>>({
      query: (body) => ({
        url: '/hr/recruitment/configuration/ai-settings',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['HRAISettings'],
    }),

    listAIProviders: build.query<AIProviderCard[], void>({
      query: () => ({ url: '/hr/recruitment/configuration/ai-providers' }),
      providesTags: ['HRAISettings'],
    }),

    updateAIProvider: build.mutation<AIProviderCard, { id: number; body: Partial<AIProviderCard> }>({
      query: ({ id, body }) => ({
        url: `/hr/recruitment/configuration/ai-providers/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['HRAISettings'],
    }),

    testAIProvider: build.mutation<
      { success: boolean; message: string },
      { provider: string; model_name: string; api_endpoint?: string | null; api_key?: string | null }
    >({
      query: (body) => ({
        url: '/hr/recruitment/configuration/ai-providers/test',
        method: 'POST',
        body,
      }),
    }),

    getHRAIUsageSummary: build.query<HRAIUsageSummary, void>({
      query: () => ({ url: '/hr/recruitment/configuration/ai-usage-summary' }),
    }),

    // Leave Policies and Shift Rules
    getLeavePolicies: build.query<{ casualLeaveQuota: number; sickLeaveQuota: number; earnedLeaveQuota: number }, void>({
      query: () => ({ url: '/hr/configuration/leave-policies' }),
      providesTags: ['HRConfig'],
    }),

    updateLeavePolicies: build.mutation<any, { casualLeaveQuota?: number; sickLeaveQuota?: number; earnedLeaveQuota?: number }>({
      query: (body) => ({
        url: '/hr/configuration/leave-policies',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['HRConfig'],
    }),

    getShiftRules: build.query<{ shiftStart: string; shiftEnd: string; gracePeriodMins: number }, void>({
      query: () => ({ url: '/hr/configuration/shift-rules' }),
      providesTags: ['HRConfig'],
    }),

    updateShiftRules: build.mutation<any, { shiftStart?: string; shiftEnd?: string; gracePeriodMins?: number }>({
      query: (body) => ({
        url: '/hr/configuration/shift-rules',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['HRConfig'],
    }),

    updateJobRequisition: build.mutation<JobRequisition, { id: number; body: Partial<JobRequisitionCreate> }>({
      query: ({ id, body }) => ({
        url: `/hr/recruitment/requisitions/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['JobRequisitions', 'RecruitmentKPIs'],
    }),

    deleteJobRequisition: build.mutation<void, number>({
      query: (id) => ({
        url: `/hr/recruitment/requisitions/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['JobRequisitions', 'Candidates', 'RecruitmentKPIs'],
    }),

    transitionCandidateStage: build.mutation<
      Candidate,
      { id: number; body: CandidateStageTransition }
    >({
      query: ({ id, body }) => ({
        url: `/hr/recruitment/candidates/${id}/transition-stage`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Candidates', 'RecruitmentKPIs'],
    }),

    resumeCandidateRecruitment: build.mutation<Candidate, number>({
      query: (id) => ({
        url: `/hr/recruitment/candidates/${id}/resume`,
        method: 'POST',
      }),
      invalidatesTags: ['Candidates', 'RecruitmentKPIs'],
    }),

    updateCandidateOffer: build.mutation<
      Candidate,
      { id: number; offer_status: string; confirmed_joining_date?: string; rejection_reason?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/hr/recruitment/candidates/${id}/update-offer`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Candidates', 'RecruitmentKPIs'],
    }),

    createEmployeeFromCandidate: build.mutation<
      Candidate,
      { id: number; emp_id?: string; designation?: string; department?: string; branch?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/hr/recruitment/candidates/${id}/create-employee`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Candidates', 'RecruitmentKPIs'],
    }),
  }),
});

export const {
  useGetRecruitmentKPIsQuery,
  useListJobRequisitionsQuery,
  useCreateJobRequisitionMutation,
  useUpdateJobRequisitionMutation,
  useDeleteJobRequisitionMutation,
  useApproveOrRejectJobRequisitionMutation,
  useUploadJobDescriptionMutation,
  useGenerateRequisitionRubricMutation,
  useListJobPostingsQuery,
  useDraftJobPostingMutation,
  useApproveJobPostingMutation,
  usePublishJobPostingMutation,
  useListCandidatesQuery,
  useGetCandidateQuery,
  useCreateCandidateMutation,
  useUpdateCandidateMutation,
  useDeleteCandidateMutation,
  useUploadAndParseResumeMutation,
  useBulkUploadResumesMutation,
  useListJobApplicationsQuery,
  useGetJobApplicationQuery,
  useTransitionApplicationStageMutation,
  useEvaluateApplicationAIMutation,
  useGetApplicationEvaluationsQuery,
  useEvaluateCandidateAIMutation,
  useGetCandidateEvaluationsQuery,
  useGetCandidateInterviewsQuery,
  useSubmitAIEvaluationFeedbackMutation,
  useListInterviewsQuery,
  useScheduleInterviewMutation,
  useUpdateInterviewMutation,
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
  useTransitionCandidateStageMutation,
  useResumeCandidateRecruitmentMutation,
  useUpdateCandidateOfferMutation,
  useCreateEmployeeFromCandidateMutation,
} = recruitmentApi;
