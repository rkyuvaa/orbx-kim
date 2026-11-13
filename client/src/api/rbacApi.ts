import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { logout } from '@/auth/authSlice';
import type {
  Action,
  Department,
  DepartmentTreeNode,
  EffectiveAccessSummary,
  Module,
  PaginatedAuditLogs,
  PaginatedUsers,
  Role,
  UserDetail,
} from '../types/rbac';

import { baseQueryWithReauth, baseApi } from './baseApi';

const rawRbacQuery = fetchBaseQuery({
  baseUrl: '/api/v1/admin',
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as any)?.auth?.token || localStorage.getItem('access_token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

const rbacQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  return baseQueryWithReauth(
    typeof args === 'string' ? `admin${args.startsWith('/') ? '' : '/'}${args}` : { ...args, url: `admin${args.url.startsWith('/') ? '' : '/'}${args.url}` },
    api,
    extraOptions,
  );
};

export const rbacApi = createApi({
  reducerPath: 'rbacApi',
  baseQuery: rbacQueryWithReauth,
  tagTypes: ['Users', 'Roles', 'Departments', 'Permissions', 'AuditLogs', 'EffectiveAccess'],
  endpoints: (builder) => ({
    // Users
    getUsers: builder.query<
      PaginatedUsers,
      {
        page?: number;
        page_size?: number;
        search?: string;
        department_id?: number;
        role_code?: string;
        user_status?: string;
        designation?: string;
      }
    >({
      query: (params) => ({ url: '/users', params }),
      providesTags: ['Users'],
    }),

    getAllUsers: builder.query<UserDetail[], void>({
      query: () => ({ url: '/users', params: { page: 1, page_size: 100 } }),
      transformResponse: (res: { items: UserDetail[] }) => res?.items || [],
      providesTags: ['Users'],
    }),

    getUserDetail: builder.query<UserDetail, number>({
      query: (id) => `/users/${id}`,
      providesTags: (_res, _err, id) => [{ type: 'Users', id }],
    }),

    createUser: builder.mutation<UserDetail, Partial<UserDetail> & { password?: string; role_ids?: number[]; department_ids?: number[] }>({
      query: (body) => ({
        url: '/users',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Users'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(baseApi.util.invalidateTags(['Users']));
        } catch {}
      },
    }),

    updateUser: builder.mutation<UserDetail, { id: number; data: Partial<UserDetail> & { password?: string; role_ids?: number[]; department_ids?: number[] } }>({
      query: ({ id, data }) => ({
        url: `/users/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_res, _err, { id }) => [{ type: 'Users', id }, 'Users'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(baseApi.util.invalidateTags(['Users']));
        } catch {}
      },
    }),

    deleteUser: builder.mutation<void, number>({
      query: (id) => ({
        url: `/users/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Users'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(baseApi.util.invalidateTags(['Users']));
        } catch {}
      },
    }),

    getUserEffectivePermissions: builder.query<EffectiveAccessSummary, number>({
      query: (id) => `/users/${id}/effective-permissions`,
      providesTags: (_res, _err, id) => [{ type: 'EffectiveAccess', id }],
    }),

    updateUserPermissionOverride: builder.mutation<void, { user_id: number; permission_id: number; granted: boolean; reason?: string }>({
      query: ({ user_id, ...body }) => ({
        url: `/users/${user_id}/permissions`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, { user_id }) => [{ type: 'EffectiveAccess', id: user_id }, 'Users'],
    }),

    // Roles
    getRoles: builder.query<Role[], void>({
      query: () => '/roles',
      providesTags: ['Roles'],
    }),

    createRole: builder.mutation<Role, Partial<Role> & { permission_ids?: number[] }>({
      query: (body) => ({
        url: '/roles',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Roles'],
    }),

    updateRole: builder.mutation<Role, { id: number; data: Partial<Role> & { permission_ids?: number[] } }>({
      query: ({ id, data }) => ({
        url: `/roles/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Roles', 'Users', 'EffectiveAccess'],
    }),

    duplicateRole: builder.mutation<Role, { id: number; new_name: string; new_code: string; description?: string }>({
      query: ({ id, ...body }) => ({
        url: `/roles/${id}/duplicate`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Roles'],
    }),

    deleteRole: builder.mutation<void, number>({
      query: (id) => ({
        url: `/roles/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Roles'],
    }),

    // Departments
    getDepartments: builder.query<Department[], void>({
      query: () => '/departments',
      providesTags: ['Departments'],
    }),

    getDepartmentTree: builder.query<DepartmentTreeNode[], void>({
      query: () => '/departments/tree',
      providesTags: ['Departments'],
    }),

    createDepartment: builder.mutation<Department, Partial<Department>>({
      query: (body) => ({
        url: '/departments',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Departments'],
    }),

    updateDepartment: builder.mutation<Department, { id: number; data: Partial<Department> }>({
      query: ({ id, data }) => ({
        url: `/departments/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Departments'],
    }),

    deleteDepartment: builder.mutation<void, number>({
      query: (id) => ({
        url: `/departments/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Departments'],
    }),

    // Permissions & Audit Logs
    getPermissionsRegistry: builder.query<Module[], void>({
      query: () => '/permissions',
      providesTags: ['Permissions'],
    }),

    createCustomAction: builder.mutation<Action, { resource_id: number; action_name: string; action_code: string; description?: string }>({
      query: (body) => ({
        url: '/permissions/custom-action',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Permissions'],
    }),

    getAuditLogs: builder.query<
      PaginatedAuditLogs,
      {
        page?: number;
        page_size?: number;
        search?: string;
        action_type?: string;
        user_id?: number;
        module?: string;
      }
    >({
      query: (params) => ({ url: '/audit-logs', params }),
      providesTags: ['AuditLogs'],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetAllUsersQuery,
  useGetUserDetailQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useGetUserEffectivePermissionsQuery,
  useUpdateUserPermissionOverrideMutation,
  useGetRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDuplicateRoleMutation,
  useDeleteRoleMutation,
  useGetDepartmentsQuery,
  useGetDepartmentTreeQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  useGetPermissionsRegistryQuery,
  useCreateCustomActionMutation,
  useGetAuditLogsQuery,
} = rbacApi;
