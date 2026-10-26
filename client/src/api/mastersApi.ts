import { baseApi } from './baseApi';

import type {
  ActivityType,
  ActivityTypeInput,
  CrmTabConfig,
  CrmTabFieldConfig,
  CrmTabFieldInput,
  CrmTabInput,
  FinanceCompanyOption,
  StageConfig,
  StageInput,
  StageAutomoveRule,
  StageAutomoveRuleInput,
  UserBrief,
  VehicleModel,
  VehicleModelInput,
  CostCenter,
  Branch,
  CrmDropdownOption,
  CrmDropdownOptionInput,
} from '@/types';

export const mastersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    automoveRules: build.query<StageAutomoveRule[], void>({
      query: () => ({ url: '/masters/automove-rules' }),
      providesTags: ['Stages'],
    }),
    automoveRulesByModule: build.query<StageAutomoveRule[], 'LEAD' | 'OPPORTUNITY'>({
      query: (module) => ({ url: `/masters/automove-rules?module=${module}` }),
      providesTags: ['Stages'],
    }),
    createAutomoveRule: build.mutation<StageAutomoveRule, StageAutomoveRuleInput>({
      query: (body) => ({ url: '/masters/automove-rules', method: 'POST', body }),
      invalidatesTags: ['Stages'],
    }),
    updateAutomoveRule: build.mutation<StageAutomoveRule, { id: number; body: Partial<StageAutomoveRuleInput> }>({
      query: ({ id, body }) => ({ url: `/masters/automove-rules/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Stages'],
    }),
    deleteAutomoveRule: build.mutation<void, number>({
      query: (id) => ({ url: `/masters/automove-rules/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Stages'],
    }),
    vehicleModels: build.query<VehicleModel[], void>({
      query: () => ({ url: '/masters/vehicle-models' }),
      providesTags: ['VehicleModels'],
    }),
    createVehicleModel: build.mutation<VehicleModel, VehicleModelInput>({
      query: (body) => ({ url: '/masters/vehicle-models', method: 'POST', body }),
      invalidatesTags: ['VehicleModels'],
    }),
    updateVehicleModel: build.mutation<VehicleModel, { id: number; body: Partial<VehicleModelInput> }>({
      query: ({ id, body }) => ({ url: `/masters/vehicle-models/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['VehicleModels'],
    }),
    deleteVehicleModel: build.mutation<void, number>({
      query: (id) => ({ url: `/masters/vehicle-models/${id}`, method: 'DELETE' }),
      invalidatesTags: ['VehicleModels'],
    }),
    financeCompanies: build.query<FinanceCompanyOption[], void>({
      query: () => ({ url: '/masters/finance-companies' }),
      providesTags: ['FinanceCompanies'],
    }),
    createFinanceCompany: build.mutation<
      FinanceCompanyOption,
      { name: string; email?: string; contact_number?: string; address?: string }
    >({
      query: (body) => ({ url: '/masters/finance-companies', method: 'POST', body }),
      invalidatesTags: ['FinanceCompanies'],
    }),
    updateFinanceCompany: build.mutation<
      FinanceCompanyOption,
      { id: number; body: { name?: string; email?: string; contact_number?: string; address?: string } }
    >({
      query: ({ id, body }) => ({ url: `/masters/finance-companies/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['FinanceCompanies'],
    }),
    deleteFinanceCompany: build.mutation<void, number>({
      query: (id) => ({ url: `/masters/finance-companies/${id}`, method: 'DELETE' }),
      invalidatesTags: ['FinanceCompanies'],
    }),
    stages: build.query<StageConfig[], void>({
      query: () => ({ url: '/masters/stages' }),
      providesTags: ['Stages'],
    }),
    stagesByModule: build.query<StageConfig[], 'LEAD' | 'OPPORTUNITY'>({
      query: (module) => ({ url: `/masters/stages?module=${module}` }),
      providesTags: ['Stages'],
    }),
    createStage: build.mutation<StageConfig, StageInput>({
      query: (body) => ({ url: '/masters/stages', method: 'POST', body }),
      invalidatesTags: ['Stages'],
    }),
    updateStage: build.mutation<StageConfig, { id: number; body: Partial<StageInput> }>({
      query: ({ id, body }) => ({ url: `/masters/stages/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Stages'],
    }),
    deleteStage: build.mutation<void, number>({
      query: (id) => ({ url: `/masters/stages/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Stages'],
    }),
    activityTypes: build.query<ActivityType[], void>({
      query: () => ({ url: '/masters/activity-types' }),
      providesTags: ['ActivityTypes'],
    }),
    createActivityType: build.mutation<ActivityType, ActivityTypeInput>({
      query: (body) => ({ url: '/masters/activity-types', method: 'POST', body }),
      invalidatesTags: ['ActivityTypes'],
    }),
    updateActivityType: build.mutation<ActivityType, { id: number; body: Partial<ActivityTypeInput> }>({
      query: ({ id, body }) => ({ url: `/masters/activity-types/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['ActivityTypes'],
    }),
    deleteActivityType: build.mutation<void, number>({
      query: (id) => ({ url: `/masters/activity-types/${id}`, method: 'DELETE' }),
      invalidatesTags: ['ActivityTypes'],
    }),
    tabs: build.query<CrmTabConfig[], void>({
      query: () => ({ url: '/masters/tabs' }),
      providesTags: ['Tabs'],
    }),
    tabsByModule: build.query<CrmTabConfig[], 'LEAD' | 'OPPORTUNITY' | string>({
      query: (module) => ({ url: `/masters/tabs?module=${module}` }),
      providesTags: ['Tabs'],
    }),
    createTab: build.mutation<CrmTabConfig, CrmTabInput>({
      query: (body) => ({ url: '/masters/tabs', method: 'POST', body }),
      invalidatesTags: ['Tabs'],
    }),
    updateTab: build.mutation<CrmTabConfig, { id: number; body: Partial<CrmTabInput> }>({
      query: ({ id, body }) => ({ url: `/masters/tabs/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Tabs'],
    }),
    deleteTab: build.mutation<void, number>({
      query: (id) => ({ url: `/masters/tabs/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Tabs'],
    }),
    tabFields: build.query<CrmTabFieldConfig[], number>({
      query: (tabId) => ({ url: `/masters/tabs/${tabId}/fields` }),
      providesTags: ['Tabs'],
    }),
    createTabField: build.mutation<CrmTabFieldConfig, { tabId: number; body: CrmTabFieldInput }>({
      query: ({ tabId, body }) => ({ url: `/masters/tabs/${tabId}/fields`, method: 'POST', body }),
      invalidatesTags: ['Tabs'],
    }),
    updateTabField: build.mutation<CrmTabFieldConfig, { tabId: number; fieldId: number; body: Partial<CrmTabFieldInput> }>({
      query: ({ tabId, fieldId, body }) => ({ url: `/masters/tabs/${tabId}/fields/${fieldId}`, method: 'PATCH', body }),
      invalidatesTags: ['Tabs'],
    }),
    deleteTabField: build.mutation<void, { tabId: number; fieldId: number }>({
      query: ({ tabId, fieldId }) => ({ url: `/masters/tabs/${tabId}/fields/${fieldId}`, method: 'DELETE' }),
      invalidatesTags: ['Tabs'],
    }),
    reorderTabFields: build.mutation<CrmTabFieldConfig[], { tabId: number; fieldIds: number[] }>({
      query: ({ tabId, fieldIds }) => ({ url: `/masters/tabs/${tabId}/fields/reorder`, method: 'POST', body: fieldIds }),
      invalidatesTags: ['Tabs'],
    }),
    users: build.query<UserBrief[], void>({
      query: () => ({ url: '/masters/users' }),
      providesTags: ['Users'],
    }),
    costCenters: build.query<CostCenter[], void>({
      query: () => ({ url: '/masters/cost-centers' }),
      providesTags: ['CostCenters'],
    }),
    branches: build.query<Branch[], void>({
      query: () => ({ url: '/masters/branches' }),
      providesTags: ['Branches'],
    }),
    dropdownOptions: build.query<CrmDropdownOption[], string | void>({
      query: (category) => ({
        url: category ? `/masters/dropdown-options?category=${category}` : '/masters/dropdown-options',
      }),
      providesTags: ['DropdownOptions'],
    }),
    createDropdownOption: build.mutation<CrmDropdownOption, CrmDropdownOptionInput>({
      query: (body) => ({ url: '/masters/dropdown-options', method: 'POST', body }),
      invalidatesTags: ['DropdownOptions'],
    }),
    updateDropdownOption: build.mutation<CrmDropdownOption, { id: number; body: Partial<CrmDropdownOptionInput> }>({
      query: ({ id, body }) => ({ url: `/masters/dropdown-options/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['DropdownOptions'],
    }),
    deleteDropdownOption: build.mutation<void, number>({
      query: (id) => ({ url: `/masters/dropdown-options/${id}`, method: 'DELETE' }),
      invalidatesTags: ['DropdownOptions'],
    }),
  }),
});

export const {
  useAutomoveRulesQuery,
  useAutomoveRulesByModuleQuery,
  useCreateAutomoveRuleMutation,
  useUpdateAutomoveRuleMutation,
  useDeleteAutomoveRuleMutation,
  useVehicleModelsQuery,
  useCreateVehicleModelMutation,
  useUpdateVehicleModelMutation,
  useDeleteVehicleModelMutation,
  useFinanceCompaniesQuery,
  useCreateFinanceCompanyMutation,
  useUpdateFinanceCompanyMutation,
  useDeleteFinanceCompanyMutation,
  useStagesQuery,
  useStagesByModuleQuery,
  useCreateStageMutation,
  useUpdateStageMutation,
  useDeleteStageMutation,
  useActivityTypesQuery,
  useCreateActivityTypeMutation,
  useUpdateActivityTypeMutation,
  useDeleteActivityTypeMutation,
  useTabsQuery,
  useTabsByModuleQuery,
  useCreateTabMutation,
  useUpdateTabMutation,
  useDeleteTabMutation,
  useTabFieldsQuery,
  useCreateTabFieldMutation,
  useUpdateTabFieldMutation,
  useDeleteTabFieldMutation,
  useReorderTabFieldsMutation,
  useUsersQuery,
  useCostCentersQuery,
  useBranchesQuery,
  useDropdownOptionsQuery,
  useCreateDropdownOptionMutation,
  useUpdateDropdownOptionMutation,
  useDeleteDropdownOptionMutation,
} = mastersApi;

