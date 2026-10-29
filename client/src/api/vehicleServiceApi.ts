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
  useLookupVSPublicVehicleQuery,
  useLazyLookupVSPublicVehicleQuery,
  useSubmitVSPublicComplaintMutation,
  useSubmitVSUniversalComplaintMutation,
} = vehicleServiceApi;
