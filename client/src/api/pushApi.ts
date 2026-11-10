import { baseApi } from './baseApi';

export interface PushStatus {
  is_subscribed: boolean;
  subscription_count: number;
}

export interface PushPublicKeyResponse {
  public_key: string;
}

export interface PushSubscribePayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  user_agent?: string;
}

export interface PushTestResult {
  success: boolean;
  delivered: number;
  message: string;
}

export const pushApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPushPublicKey: build.query<PushPublicKeyResponse, void>({
      query: () => '/push/public-key',
    }),
    getPushStatus: build.query<PushStatus, void>({
      query: () => '/push/status',
      providesTags: ['PushNotifications'],
    }),
    subscribePush: build.mutation<{ message: string }, PushSubscribePayload>({
      query: (body) => ({
        url: '/push/subscribe',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['PushNotifications'],
    }),
    unsubscribePush: build.mutation<{ message: string }, { endpoint: string }>({
      query: (body) => ({
        url: '/push/unsubscribe',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['PushNotifications'],
    }),
    testPush: build.mutation<PushTestResult, void>({
      query: () => ({
        url: '/push/test',
        method: 'POST',
      }),
    }),
  }),
});

export const {
  useGetPushPublicKeyQuery,
  useGetPushStatusQuery,
  useSubscribePushMutation,
  useUnsubscribePushMutation,
  useTestPushMutation,
} = pushApi;
