/*
 * PhysiQ service worker — notifications only.
 *
 * It deliberately does NOT cache pages or API responses: the app is behind a
 * login and shows live database data, so a stale cache would be wrong (and
 * could leak one account's page to the next person on a shared device).
 *
 * Why a service worker at all? On phones (installed PWA) the only supported
 * way to show a notification is registration.showNotification(), and the
 * worker lets tapping the notification focus or open the app.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/train';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if ('focus' in w) {
          w.navigate(target).catch(() => undefined);
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
