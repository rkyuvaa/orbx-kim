import { baseApi } from './baseApi';
import type { SmsSetting, SmsSettingInput } from '@/types';

export const smsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSmsSettings: build.query<SmsSetting, void>({
      query: () => ({ url: '/sms-settings' }),
      providesTags: ['SmsSettings'],
    }),
    updateSmsSettings: build.mutation<SmsSetting, SmsSettingInput>({
      query: (body) => ({
        url: '/sms-settings',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['SmsSettings'],
    }),
    testSmsConnection: build.mutation<
      { success: boolean; message: string },
      {
        test_phone: string;
        message?: string;
        template_id?: string | null;
        provider?: string;
        api_url?: string;
        api_method?: string;
        username?: string | null;
        password?: string | null;
        sender_id?: string | null;
        entity_id?: string | null;
      }
    >({
      query: (body) => ({
        url: '/sms-settings/test',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const {
  useGetSmsSettingsQuery,
  useUpdateSmsSettingsMutation,
  useTestSmsConnectionMutation,
} = smsApi;
