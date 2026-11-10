// KIM Push Notifications Service Worker

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    payload = {
      title: 'KIM Notification',
      body: event.data.text(),
    };
  }

  const title = payload.title || 'KIM Notification';
  const targetUrl = payload.url || (payload.data && payload.data.url) || '/notifications';

  const options = {
    body: payload.body || 'You have a new update in KIM',
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: payload.tag || 'kim-update',
    renotify: true,
    data: {
      url: targetUrl,
      timestamp: Date.now(),
    },
    vibrate: [150, 80, 150],
    actions: [
      { action: 'open', title: 'Open in KIM' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a KIM window is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url && client.navigate) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
