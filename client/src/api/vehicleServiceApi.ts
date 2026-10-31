import { baseApi } from './baseApi';

import type {
  VSComponentHistory,
  VSComponentReplaceRequest,
  VSComplaint,
  VSComplaintCloseRequest,
  VSComplaintCreate,
  VSComplaintNote,
  VSComplaintUpdate,
  VSDashboardData,
  VSKit,
  VSKitCreate,
  VSKitPdfParsePreview,
  VSKitUpdate,
  VSMaintenanceCreate,
  VSMaintenanceSchedule,
  VSMaintenanceUpdate,
  VSPublicComplaintCreate,
  VSPublicVehicleInfo,
  VSServiceCost,
  VSUniversalComplaintCreate,
  VSVehicle,
  VSVehicleCreate,
  VSVehicleUpdate,
  VSCustomFieldTab,
  VSCustomFieldTabCreate,
  VSCustomFieldTabUpdate,
  VSCustomFieldDefinition,
  VSCustomFieldDefinitionCreate,
  VSCustomFieldDefinitionUpdate,
  VSComplaintCustomFieldValue,
  VSComplaintCustomFieldValueCreate,
  VSComplaintCustomFieldValueBulkSave,
  VSSendOTPRequest,
  VSSendOTPResponse,
  VSVerifyOTPRequest,
  VSVerifyOTPResponse,
} from '@/types/vehicleService';

export const vehicleServiceApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // Kits
    getVSKits: build.query<VSKit[], { search?: string; is_active?: boolean } | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        const p = params || {};
        if (p.search) queryParams.set('search', p.search);
        if (p.is_active !== undefined) queryParams.set('is_active', String(p.is_active));
        const qs = queryParams.toString();
        return { url: `/vehicle-service/kits${qs ? `?${qs}` : ''}` };
      },
      providesTags: ['VSKits'],
    }),
    createVSKit: build.mutation<VSKit, VSKitCreate>({
      query: (body) => ({ url: '/vehicle-service/kits', method: 'POST', body }),
      invalidatesTags: ['VSKits'],
    }),
    updateVSKit: build.mutation<VSKit, { id: number; body: VSKitUpdate }>({
      query: ({ id, body }) => ({ url: `/vehicle-service/kits/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['VSKits'],
    }),
    deleteVSKit: build.mutation<{ success: boolean; message: string }, number>({
      query: (id) => ({ url: `/vehicle-service/kits/${id}`, method: 'DELETE' }),
      invalidatesTags: ['VSKits'],
    }),
    parseVSKitPdf: build.mutation<VSKitPdfParsePreview, FormData>({
      query: (body) => ({
        url: '/vehicle-service/kits/parse-pdf',
        method: 'POST',
        body,
      }),
    }),
    importVSKitPdf: build.mutation<VSKit, FormData>({
      query: (body) => ({
        url: '/vehicle-service/kits/import-pdf',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['VSKits'],
    }),

    // Vehicles
    getVSVehicles: build.query<VSVehicle[], { search?: string; kit_id?: number; is_active?: boolean } | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        const p = params || {};
        if (p.search) queryParams.set('search', p.search);
        if (p.kit_id) queryParams.set('kit_id', String(p.kit_id));
        if (p.is_active !== undefined) queryParams.set('is_active', String(p.is_active));
        const qs = queryParams.toString();
        return { url: `/vehicle-service/vehicles${qs ? `?${qs}` : ''}` };
      },
      providesTags: ['VSVehicles'],
    }),
    getVSVehicle: build.query<VSVehicle, number>({
      query: (id) => ({ url: `/vehicle-service/vehicles/${id}` }),
      providesTags: (_result, _error, id) => [{ type: 'VSVehicles', id }],
    }),
    createVSVehicle: build.mutation<VSVehicle, VSVehicleCreate>({
      query: (body) => ({ url: '/vehicle-service/vehicles', method: 'POST', body }),
      invalidatesTags: ['VSVehicles', 'VSDashboard'],
    }),
    updateVSVehicle: build.mutation<VSVehicle, { id: number; body: VSVehicleUpdate }>({
      query: ({ id, body }) => ({ url: `/vehicle-service/vehicles/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['VSVehicles', 'VSDashboard'],
    }),
    replaceVSComponent: build.mutation<
      VSComponentHistory,
      { vehicleId: number; componentId: number; body: VSComponentReplaceRequest }
    >({
      query: ({ vehicleId, componentId, body }) => ({
        url: `/vehicle-service/vehicles/${vehicleId}/components/${componentId}/replace`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['VSVehicles', 'VSComplaints'],
    }),

    // Complaints / Work Orders
    getVSComplaints: build.query<
      VSComplaint[],
      { status?: string; severity?: string; category?: string; vehicle_id?: number; search?: string } | void
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        const p = params || {};
        if (p.status) queryParams.set('status', p.status);
        if (p.severity) queryParams.set('severity', p.severity);
        if (p.category) queryParams.set('category', p.category);
        if (p.vehicle_id) queryParams.set('vehicle_id', String(p.vehicle_id));
        if (p.search) queryParams.set('search', p.search);
        const qs = queryParams.toString();
        return { url: `/vehicle-service/complaints${qs ? `?${qs}` : ''}` };
      },
      providesTags: ['VSComplaints'],
    }),
    getVSComplaint: build.query<VSComplaint, number>({
      query: (id) => ({ url: `/vehicle-service/complaints/${id}` }),
      providesTags: (_result, _error, id) => [{ type: 'VSComplaints', id }],
    }),
    createVSComplaint: build.mutation<VSComplaint, VSComplaintCreate>({
      query: (body) => ({ url: '/vehicle-service/complaints', method: 'POST', body }),
      invalidatesTags: ['VSComplaints', 'VSVehicles', 'VSDashboard', 'Notifications'],
    }),
    updateVSComplaint: build.mutation<VSComplaint, { id: number; body: VSComplaintUpdate }>({
      query: ({ id, body }) => ({ url: `/vehicle-service/complaints/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['VSComplaints', 'VSVehicles', 'VSDashboard'],
    }),
    addVSComplaintNote: build.mutation<VSComplaintNote, { complaintId: number; note: string }>({
      query: ({ complaintId, note }) => ({
        url: `/vehicle-service/complaints/${complaintId}/notes`,
        method: 'POST',
        body: { note },
      }),
      invalidatesTags: ['VSComplaints'],
    }),
    closeVSComplaint: build.mutation<VSComplaint, { id: number; body: VSComplaintCloseRequest }>({
      query: ({ id, body }) => ({
        url: `/vehicle-service/complaints/${id}/close`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['VSComplaints', 'VSVehicles', 'VSDashboard'],
    }),
        sendVSComplaintOTP: build.mutation<VSSendOTPResponse, { id: number; body: VSSendOTPRequest }>({
          query: ({ id, body }) => ({
            url: `/vehicle-service/complaints/${id}/send-otp`,
            method: 'POST',
            body,
          }),
        }),
        verifyVSComplaintOTP: build.mutation<VSVerifyOTPResponse, { id: number; body: VSVerifyOTPRequest }>({
          query: ({ id, body }) => ({
            url: `/vehicle-service/complaints/${id}/verify-otp`,
            method: 'POST',
            body,
          }),
        }),
        addVSServiceCost: build.mutation<
      VSServiceCost,
      { complaintId: number; body: { item_name: string; quantity: number; unit_price: number } }
    >({
      query: ({ complaintId, body }) => ({
        url: `/vehicle-service/complaints/${complaintId}/costs`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['VSComplaints'],
    }),
    deleteVSComplaint: build.mutation<{ success: boolean; message: string }, number>({
      query: (id) => ({
        url: `/vehicle-service/complaints/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['VSComplaints', 'VSDashboard'],
    }),

    // Maintenance Schedules
    getVSMaintenance: build.query<VSMaintenanceSchedule[], { vehicle_id?: number; status?: string } | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        const p = params || {};
        if (p.vehicle_id) queryParams.set('vehicle_id', String(p.vehicle_id));
        if (p.status) queryParams.set('status', p.status);
        const qs = queryParams.toString();
        return { url: `/vehicle-service/maintenance${qs ? `?${qs}` : ''}` };
      },
      providesTags: ['VSMaintenance'],
    }),
    createVSMaintenance: build.mutation<VSMaintenanceSchedule, VSMaintenanceCreate>({
      query: (body) => ({ url: '/vehicle-service/maintenance', method: 'POST', body }),
      invalidatesTags: ['VSMaintenance', 'VSDashboard'],
    }),
    updateVSMaintenance: build.mutation<VSMaintenanceSchedule, { id: number; body: VSMaintenanceUpdate }>({
      query: ({ id, body }) => ({ url: `/vehicle-service/maintenance/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['VSMaintenance', 'VSDashboard'],
    }),

    // Dashboard
    getVSDashboard: build.query<VSDashboardData, void>({
      query: () => ({ url: '/vehicle-service/dashboard' }),
      providesTags: ['VSDashboard'],
    }),

    // Public QR
    getVSPublicVehicle: build.query<VSPublicVehicleInfo, string>({
      query: (qrToken) => ({ url: `/vehicle-service/public/register/${qrToken}` }),
    }),
    getVSPublicCategories: build.query<{ key: string; label: string }[], void>({
      query: () => ({ url: '/vehicle-service/public/complaint-categories' }),
    }),
    lookupVSPublicVehicle: build.query<VSPublicVehicleInfo | null, string>({
      query: (vehicleNumber) => ({ url: `/vehicle-service/public/lookup?vehicle_number=${encodeURIComponent(vehicleNumber)}` }),
    }),
    submitVSPublicComplaint: build.mutation<VSComplaint, { qrToken: string; body: VSPublicComplaintCreate }>({
      query: ({ qrToken, body }) => ({
        url: `/vehicle-service/public/register/${qrToken}`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['VSComplaints', 'VSDashboard'],
    }),
    submitVSUniversalComplaint: build.mutation<VSComplaint, VSUniversalComplaintCreate>({
      query: (body) => ({
        url: '/vehicle-service/public/universal-register',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['VSComplaints', 'VSDashboard'],
    }),

        // Custom Fields
        getCustomFieldTabs: build.query<VSCustomFieldTab[], { department_id?: string; active_only?: boolean } | void>({
          query: (params) => {
            const queryParams = new URLSearchParams();
            const p = params || {};
            if (p.department_id) queryParams.set('department_id', p.department_id);
            if (p.active_only !== undefined) queryParams.set('active_only', String(p.active_only));
            const qs = queryParams.toString();
            return { url: `/vehicle-service/custom-fields/tabs${qs ? `?${qs}` : ''}` };
          },
          providesTags: ['VSCustomFieldTabs'],
        }),
        createCustomFieldTab: build.mutation<VSCustomFieldTab, VSCustomFieldTabCreate>({
          query: (body) => ({ url: '/vehicle-service/custom-fields/tabs', method: 'POST', body }),
          invalidatesTags: ['VSCustomFieldTabs'],
        }),
        updateCustomFieldTab: build.mutation<VSCustomFieldTab, { id: number; body: VSCustomFieldTabUpdate }>({
          query: ({ id, body }) => ({ url: `/vehicle-service/custom-fields/tabs/${id}`, method: 'PATCH', body }),
          invalidatesTags: ['VSCustomFieldTabs'],
        }),
        deleteCustomFieldTab: build.mutation<{ success: boolean; message: string }, number>({
          query: (id) => ({ url: `/vehicle-service/custom-fields/tabs/${id}`, method: 'DELETE' }),
          invalidatesTags: ['VSCustomFieldTabs'],
        }),

        getCustomFieldDefinitions: build.query<VSCustomFieldDefinition[], { tab_id?: number; department_id?: string; active_only?: boolean } | void>({
          query: (params) => {
            const queryParams = new URLSearchParams();
            const p = params || {};
            if (p.tab_id) queryParams.set('tab_id', String(p.tab_id));
            if (p.department_id) queryParams.set('department_id', p.department_id);
            if (p.active_only !== undefined) queryParams.set('active_only', String(p.active_only));
            const qs = queryParams.toString();
            return { url: `/vehicle-service/custom-fields/definitions${qs ? `?${qs}` : ''}` };
          },
          providesTags: ['VSCustomFieldDefinitions'],
        }),
        getCustomFieldDefinitionsByTab: build.query<VSCustomFieldDefinition[], { tab_id: number; department_id?: string; status?: string }>({
          query: ({ tab_id, department_id, status }) => {
            const queryParams = new URLSearchParams();
            if (department_id) queryParams.set('department_id', department_id);
            if (status) queryParams.set('status', status);
            const qs = queryParams.toString();
            return { url: `/vehicle-service/custom-fields/definitions/by-tab/${tab_id}${qs ? `?${qs}` : ''}` };
          },
          providesTags: ['VSCustomFieldDefinitions'],
        }),
        createCustomFieldDefinition: build.mutation<VSCustomFieldDefinition, VSCustomFieldDefinitionCreate>({
          query: (body) => ({ url: '/vehicle-service/custom-fields/definitions', method: 'POST', body }),
          invalidatesTags: ['VSCustomFieldDefinitions'],
        }),
        updateCustomFieldDefinition: build.mutation<VSCustomFieldDefinition, { field_id: number; body: VSCustomFieldDefinitionUpdate }>({
          query: ({ field_id, body }) => ({ url: `/vehicle-service/custom-fields/definitions/${field_id}`, method: 'PATCH', body }),
          invalidatesTags: ['VSCustomFieldDefinitions'],
        }),
        deleteCustomFieldDefinition: build.mutation<{ success: boolean; message: string }, number>({
          query: (field_id) => ({ url: `/vehicle-service/custom-fields/definitions/${field_id}`, method: 'DELETE' }),
          invalidatesTags: ['VSCustomFieldDefinitions'],
        }),

        getCustomFieldDefinitionsForComplaint: build.query<VSCustomFieldDefinition[], number>({
          query: (complaint_id) => ({ url: `/vehicle-service/custom-fields/definitions/for-complaint/${complaint_id}` }),
          providesTags: ['VSCustomFieldDefinitions'],
        }),

        getCustomFieldValuesForComplaint: build.query<VSComplaintCustomFieldValue[], number>({
          query: (complaint_id) => ({ url: `/vehicle-service/custom-fields/values/complaint/${complaint_id}` }),
          providesTags: ['VSCustomFieldValues'],
        }),
        upsertCustomFieldValuesForComplaint: build.mutation<VSComplaintCustomFieldValue[], { complaint_id: number; body: VSComplaintCustomFieldValueBulkSave }>({
          query: ({ complaint_id, body }) => ({ url: `/vehicle-service/custom-fields/values/complaint/${complaint_id}/bulk`, method: 'POST', body }),
          invalidatesTags: ['VSCustomFieldValues', 'VSComplaints'],
        }),

        uploadCustomFieldFile: build.mutation<{ filename: string; original_name: string; size: number; mime_type: string | null; url: string; preview_url: string | null; uploaded_at: string }, { file: File; field_id: number; complaint_id: number }>({
          query: ({ file, field_id, complaint_id }) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('field_id', String(field_id));
            formData.append('complaint_id', String(complaint_id));
            return {
              url: '/vehicle-service/custom-fields/files/upload',
              method: 'POST',
              body: formData,
            };
          },
        }),
      }),
    });

export const {
  useGetVSKitsQuery,
  useCreateVSKitMutation,
  useUpdateVSKitMutation,
  useDeleteVSKitMutation,
  useParseVSKitPdfMutation,
  useImportVSKitPdfMutation,
  useGetVSVehiclesQuery,
  useGetVSVehicleQuery,
  useCreateVSVehicleMutation,
  useUpdateVSVehicleMutation,
  useReplaceVSComponentMutation,
  useGetVSComplaintsQuery,
  useGetVSComplaintQuery,
  useCreateVSComplaintMutation,
  useUpdateVSComplaintMutation,
  useDeleteVSComplaintMutation,
  useAddVSComplaintNoteMutation,
  useCloseVSComplaintMutation,
  useAddVSServiceCostMutation,
  useGetVSMaintenanceQuery,
  useCreateVSMaintenanceMutation,
  useUpdateVSMaintenanceMutation,
  useGetVSDashboardQuery,
  useGetVSPublicVehicleQuery,
  useGetVSPublicCategoriesQuery,
  useLookupVSPublicVehicleQuery,
  useLazyLookupVSPublicVehicleQuery,
  useSubmitVSPublicComplaintMutation,
  useSubmitVSUniversalComplaintMutation,
  // Custom Fields
  useGetCustomFieldTabsQuery,
  useCreateCustomFieldTabMutation,
  useUpdateCustomFieldTabMutation,
  useDeleteCustomFieldTabMutation,
  useGetCustomFieldDefinitionsQuery,
  useGetCustomFieldDefinitionsByTabQuery,
  useCreateCustomFieldDefinitionMutation,
  useUpdateCustomFieldDefinitionMutation,
  useDeleteCustomFieldDefinitionMutation,
  useGetCustomFieldDefinitionsForComplaintQuery,
  useGetCustomFieldValuesForComplaintQuery,
  useUpsertCustomFieldValuesForComplaintMutation,
  useUploadCustomFieldFileMutation,
    useSendVSComplaintOTPMutation,
    useVerifyVSComplaintOTPMutation,
  } = vehicleServiceApi;
