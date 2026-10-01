// LifeOS Background Service Worker for Closed-App Web Push Notifications

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'LifeOS Reminder', body: event.data.text() };
    }
  }

  const title = data.title || 'LifeOS Reminder';
  const options = {
    body: data.body || 'Maintain your rhythm and focus today.',
    icon: data.icon || '/favicon.svg',
    badge: data.badge || '/favicon.svg',
    tag: data.tag || `lifeos-notif-${Date.now()}`,
    data: {
      url: data.url || '/today',
      goalId: data.goalId,
      timestamp: data.timestamp || Date.now(),
    },
    requireInteraction: true,
    vibrate: [200, 100, 200],
    actions: data.actions || [
      { action: 'open', title: 'Open LifeOS' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  if (action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/today';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If there's an existing open tab, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // If no tab is open, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
