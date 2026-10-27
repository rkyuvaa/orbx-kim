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
  created_at: string;
  updated_at: string;
  candidate_count: number;
}

export interface CandidateStageHistory {
  id: number;
  candidate_id: number;
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
  uploaded_at: string;
}

export interface Candidate {
  id: number;
  candidate_code: string;
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

  stage_history: CandidateStageHistory[];
  documents: CandidateDocument[];
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

    listCandidates: build.query<
      Candidate[],
      {
        search?: string;
        job_requisition_id?: number;
        department?: string;
        stage?: string;
        candidate_source?: string;
        interview_date?: string;
        joining_date?: string;
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
          if (params.interview_date) searchParams.append('interview_date', params.interview_date);
          if (params.joining_date) searchParams.append('joining_date', params.joining_date);
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

    scheduleInterview: build.mutation<
      Candidate,
      {
        id: number;
        interview_type: string;
        interview_date: string;
        interviewer_panel: string;
        interview_round: string;
        interview_feedback?: string;
        interview_rating?: number;
        interview_remarks?: string;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/hr/recruitment/candidates/${id}/schedule-interview`,
        method: 'POST',
        body,
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

    deleteCandidate: build.mutation<void, number>({
      query: (id) => ({
        url: `/hr/recruitment/candidates/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Candidates', 'RecruitmentKPIs'],
    }),

    updateCandidate: build.mutation<Candidate, { id: number; body: Partial<CandidateCreate> }>({
      query: ({ id, body }) => ({
        url: `/hr/recruitment/candidates/${id}`,
        method: 'PUT',
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
  useListCandidatesQuery,
  useGetCandidateQuery,
  useCreateCandidateMutation,
  useUpdateCandidateMutation,
  useTransitionCandidateStageMutation,
  useResumeCandidateRecruitmentMutation,
  useScheduleInterviewMutation,
  useUpdateCandidateOfferMutation,
  useCreateEmployeeFromCandidateMutation,
  useDeleteCandidateMutation,
} = recruitmentApi;
