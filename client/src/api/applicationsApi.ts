import { baseApi } from './baseApi';

import type {
  ActivityLogEntry,
  ApplicationItem,
  ApplicationListResponse,
  CrmLeadCustomFieldValue,
  FinalSubmissionSummary,
  PlannedActivityInput,
  PlannedActivityItem,
  PublicFinancierDocumentView,
  VerificationDocument,
} from '@/types';

export interface ApplicationFilters {
  page?: number;
  page_size?: number;
  scope?: 'all' | 'recent';
  tab?: 'all' | 'mine' | 'pending';
  q?: string;
  status?: string;
  finance_company_id?: number;
  date_from?: string;
  date_to?: string;
  stage_key?: string;
  module?: string;
}

export interface NewApplication {
  customer_name: string;
  customer_phone: string;
  vehicle?: string;
  vehicle_number?: string | null;
  vehicle_year?: string | null;
  fuel_type?: string | null;
  customer_status?: string | null;
  coupon_code?: string | null;
  lost_reason?: string | null;
  lead_source?: string | null;
  assigned_to?: number | null;
  amount?: number;
  status?: string;
  stage_key?: string | null;
  vehicle_model_id?: number | null;
  vehicle_price?: number;
  down_payment?: number;
  finance_company_id?: number | null;
}

export const applicationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    applications: build.query<ApplicationListResponse, ApplicationFilters>({
      query: (filters) => ({ url: '/applications', params: filters }),
      providesTags: ['Applications'],
    }),
    getApplication: build.query<ApplicationItem, number>({
      query: (id) => ({ url: `/applications/${id}` }),
      providesTags: (_res, _err, id) => [{ type: 'Applications', id }],
    }),
    createApplication: build.mutation<ApplicationItem, NewApplication>({
      query: (body) => ({ url: '/applications', method: 'POST', body }),
      invalidatesTags: ['Applications', 'Dashboard'],
    }),
    updateApplication: build.mutation<ApplicationItem, { id: number; body: Partial<NewApplication> }>({
      query: ({ id, body }) => ({ url: `/applications/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_res, _err, { id }) => ['Applications', 'Dashboard', { type: 'Applications', id }],
    }),
    deleteApplication: build.mutation<void, number>({
      query: (id) => ({ url: `/applications/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Applications', 'Dashboard'],
    }),
    applicationActivity: build.query<ActivityLogEntry[], number>({
      query: (id) => ({ url: `/applications/${id}/activity` }),
      providesTags: (_result, _err, id) => [{ type: 'Applications', id }],
    }),
    plannedActivities: build.query<PlannedActivityItem[], number>({
      query: (appId) => ({ url: `/applications/${appId}/planned-activities` }),
      providesTags: (_res, _err, appId) => [{ type: 'PlannedActivities', id: appId }],
    }),
    createPlannedActivity: build.mutation<PlannedActivityItem, { appId: number; body: PlannedActivityInput }>({
      query: ({ appId, body }) => ({
        url: `/applications/${appId}/planned-activities`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, { appId }) => [
        { type: 'PlannedActivities', id: appId },
        { type: 'Applications', id: appId },
        'Notifications',
      ],
    }),
    updatePlannedActivity: build.mutation<
      PlannedActivityItem,
      { appId: number; actId: number; body: Partial<PlannedActivityInput & { status?: string }> }
    >({
      query: ({ appId, actId, body }) => ({
        url: `/applications/${appId}/planned-activities/${actId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_res, _err, { appId }) => [
        { type: 'PlannedActivities', id: appId },
        { type: 'Applications', id: appId },
        'Notifications',
      ],
    }),
    customFieldValues: build.query<CrmLeadCustomFieldValue[], number>({
      query: (appId) => ({ url: `/applications/${appId}/custom-fields` }),
      providesTags: (_res, _err, appId) => [{ type: 'Applications', id: appId }],
    }),
    saveCustomFieldValues: build.mutation<
      CrmLeadCustomFieldValue[],
      { appId: number; body: Array<{ field_id: number; value?: string | null; file_metadata?: any }> }
    >({
      query: ({ appId, body }) => ({
        url: `/applications/${appId}/custom-fields`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, { appId }) => [{ type: 'Applications', id: appId }],
    }),
    verificationDocuments: build.query<VerificationDocument[], number>({
      query: (id) => ({ url: `/applications/${id}/verification-documents` }),
      providesTags: (_res, _err, id) => [{ type: 'Applications', id }],
    }),
    toggleVerifyDocument: build.mutation<
      VerificationDocument,
      { appId: number; valId: number; isVerified: boolean }
    >({
      query: ({ appId, valId, isVerified }) => ({
        url: `/applications/${appId}/verification-documents/${valId}/toggle-verify`,
        method: 'POST',
        body: { is_verified: isVerified },
      }),
      invalidatesTags: (_res, _err, { appId }) => [{ type: 'Applications', id: appId }],
    }),
    finalSubmission: build.query<FinalSubmissionSummary, number>({
      query: (id) => ({ url: `/applications/${id}/final-submission` }),
      providesTags: (_res, _err, id) => [{ type: 'Applications', id }],
    }),
    sendToFinancier: build.mutation<
      { success: boolean; message: string; sentTo: string; expiresAt: string },
      { appId: number; confirm?: boolean }
    >({
      query: ({ appId, confirm = true }) => ({
        url: `/applications/${appId}/final-submission/send-to-financier`,
        method: 'POST',
        body: { confirm },
      }),
      invalidatesTags: (_res, _err, { appId }) => [{ type: 'Applications', id: appId }],
    }),
    publicFinancierDocumentView: build.query<PublicFinancierDocumentView, string>({
      query: (token) => ({ url: `/public/financier/documents/${token}` }),
    }),
    bulkAssignLeads: build.mutation<
      { message: string; count: number },
      { application_ids: number[]; assigned_to: number }
    >({
      query: (body) => ({
        url: '/applications/bulk/assign',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Applications', 'Dashboard'],
    }),
    bulkChangeStatus: build.mutation<
      { message: string; count: number },
      { application_ids: number[]; status: string }
    >({
      query: (body) => ({
        url: '/applications/bulk/status',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Applications', 'Dashboard'],
    }),
    bulkDeleteLeads: build.mutation<
      { message: string; count: number },
      { application_ids: number[] }
    >({
      query: (body) => ({
        url: '/applications/bulk/delete',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Applications', 'Dashboard'],
    }),
  }),
});

export const {
  useApplicationsQuery,
  useGetApplicationQuery,
  useCreateApplicationMutation,
  useUpdateApplicationMutation,
  useDeleteApplicationMutation,
  useApplicationActivityQuery,
  usePlannedActivitiesQuery,
  useCreatePlannedActivityMutation,
  useUpdatePlannedActivityMutation,
  useCustomFieldValuesQuery,
  useSaveCustomFieldValuesMutation,
  useVerificationDocumentsQuery,
  useToggleVerifyDocumentMutation,
  useFinalSubmissionQuery,
  useSendToFinancierMutation,
  usePublicFinancierDocumentViewQuery,
  useBulkAssignLeadsMutation,
  useBulkChangeStatusMutation,
  useBulkDeleteLeadsMutation,
} = applicationsApi;
