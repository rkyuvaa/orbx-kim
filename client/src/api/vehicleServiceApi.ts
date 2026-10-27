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
  VSKitUpdate,
  VSMaintenanceCreate,
  VSMaintenanceSchedule,
  VSMaintenanceUpdate,
  VSPublicComplaintCreate,
  VSPublicVehicleInfo,
  VSServiceCost,
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
        if (params?.search) queryParams.set('search', params.search);
        if (params?.is_active !== undefined) queryParams.set('is_active', String(params.is_active));
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

    // Vehicles
    getVSVehicles: build.query<VSVehicle[], { search?: string; kit_id?: number; is_active?: boolean } | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.search) queryParams.set('search', params.search);
        if (params?.kit_id) queryParams.set('kit_id', String(params.kit_id));
        if (params?.is_active !== undefined) queryParams.set('is_active', String(params.is_active));
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
        if (params?.status) queryParams.set('status', params.status);
        if (params?.severity) queryParams.set('severity', params.severity);
        if (params?.category) queryParams.set('category', params.category);
        if (params?.vehicle_id) queryParams.set('vehicle_id', String(params.vehicle_id));
        if (params?.search) queryParams.set('search', params.search);
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

    // Maintenance Schedules
    getVSMaintenance: build.query<VSMaintenanceSchedule[], { vehicle_id?: number; status?: string } | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.vehicle_id) queryParams.set('vehicle_id', String(params.vehicle_id));
        if (params?.status) queryParams.set('status', params.status);
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
    submitVSPublicComplaint: build.mutation<VSComplaint, { qrToken: string; body: VSPublicComplaintCreate }>({
      query: ({ qrToken, body }) => ({
        url: `/vehicle-service/public/register/${qrToken}`,
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
  useGetVSVehiclesQuery,
  useGetVSVehicleQuery,
  useCreateVSVehicleMutation,
  useUpdateVSVehicleMutation,
  useReplaceVSComponentMutation,
  useGetVSComplaintsQuery,
  useGetVSComplaintQuery,
  useCreateVSComplaintMutation,
  useUpdateVSComplaintMutation,
  useAddVSComplaintNoteMutation,
  useCloseVSComplaintMutation,
  useAddVSServiceCostMutation,
  useGetVSMaintenanceQuery,
  useCreateVSMaintenanceMutation,
  useUpdateVSMaintenanceMutation,
  useGetVSDashboardQuery,
  useGetVSPublicVehicleQuery,
  useSubmitVSPublicComplaintMutation,
} = vehicleServiceApi;
