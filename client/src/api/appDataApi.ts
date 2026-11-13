import { baseApi } from './baseApi';

export interface AppDataDocument<T = unknown> {
  key: string;
  value: T | null;
  revision: number;
  updated_at: string | null;
}

export const appDataApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAppData: build.query<AppDataDocument, string>({
      query: (key) => ({ url: `/app-data/${encodeURIComponent(key)}` }),
      providesTags: (_result, _error, key) => [{ type: 'AppData', id: key }],
    }),
    putAppData: build.mutation<
      AppDataDocument,
      { key: string; value: unknown; expected_revision: number }
    >({
      query: ({ key, value, expected_revision }) => ({
        url: `/app-data/${encodeURIComponent(key)}`,
        method: 'PUT',
        body: { value, expected_revision },
      }),
      invalidatesTags: (result, _error, { key }) => (result ? [{ type: 'AppData', id: key }] : []),
    }),
  }),
});

export const { useGetAppDataQuery, usePutAppDataMutation } = appDataApi;
