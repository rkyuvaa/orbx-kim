import { useEffect, useState, useCallback } from 'react';
import {
  useGetPushPublicKeyQuery,
  useGetPushStatusQuery,
  useSubscribePushMutation,
  useUnsubscribePushMutation,
  useTestPushMutation,
} from '@/api/pushApi';

function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isBrowserSubscribed, setIsBrowserSubscribed] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: keyData } = useGetPushPublicKeyQuery();
  const { data: statusData, refetch: refetchStatus } = useGetPushStatusQuery();
  const [subscribeMutation] = useSubscribePushMutation();
  const [unsubscribeMutation] = useUnsubscribePushMutation();
  const [testPushMutation, { isLoading: isTesting }] = useTestPushMutation();

  // Register service worker and check support
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);

    if (!supported) {
      setPermission('unsupported');
      return;
    }

    setPermission(Notification.permission);

    // Register service worker
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        return registration.pushManager.getSubscription();
      })
      .then((subscription) => {
        setIsBrowserSubscribed(!!subscription);
      })
      .catch((err) => {
        console.warn('Failed to register KIM service worker:', err);
      });
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setActionError('Push notifications are not supported by this browser.');
      return false;
    }

    setIsProcessing(true);
    setActionError(null);

    try {
      const currentPerm = await Notification.requestPermission();
      setPermission(currentPerm);

      if (currentPerm !== 'granted') {
        setActionError('Notification permission was not granted.');
        setIsProcessing(false);
        return false;
      }

      const vapidPublicKey = keyData?.public_key;
      if (!vapidPublicKey) {
        setActionError('Unable to load push server public key.');
        setIsProcessing(false);
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const applicationServerKey = urlB64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as any,
        });
      }

      const jsonSub = subscription.toJSON();
      if (!jsonSub.endpoint || !jsonSub.keys?.p256dh || !jsonSub.keys?.auth) {
        throw new Error('Incomplete push subscription data returned by browser.');
      }

      await subscribeMutation({
        endpoint: jsonSub.endpoint,
        keys: {
          p256dh: jsonSub.keys.p256dh,
          auth: jsonSub.keys.auth,
        },
        user_agent: navigator.userAgent,
      }).unwrap();

      setIsBrowserSubscribed(true);
      await refetchStatus();
      setIsProcessing(false);
      return true;
    } catch (err: any) {
      console.error('Push notification subscription error:', err);
      setActionError(err?.message || 'Failed to enable push notifications.');
      setIsProcessing(false);
      return false;
    }
  }, [isSupported, keyData, subscribeMutation, refetchStatus]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return false;

    setIsProcessing(true);
    setActionError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await unsubscribeMutation({ endpoint: subscription.endpoint }).unwrap();
        await subscription.unsubscribe();
      }

      setIsBrowserSubscribed(false);
      await refetchStatus();
      setIsProcessing(false);
      return true;
    } catch (err: any) {
      console.error('Push notification unsubscribe error:', err);
      setActionError(err?.message || 'Failed to disable push notifications.');
      setIsProcessing(false);
      return false;
    }
  }, [isSupported, unsubscribeMutation, refetchStatus]);

  const sendTest = useCallback(async () => {
    try {
      return await testPushMutation().unwrap();
    } catch (err: any) {
      throw err;
    }
  }, [testPushMutation]);

  return {
    isSupported,
    permission,
    isSubscribed: isBrowserSubscribed,
    subscriptionCount: statusData?.subscription_count ?? 0,
    isProcessing,
    isTesting,
    actionError,
    subscribe,
    unsubscribe,
    sendTest,
  };
}
