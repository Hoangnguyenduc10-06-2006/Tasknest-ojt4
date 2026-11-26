/* global self, URL */
self.addEventListener('push', event => {
  let data;
  try { data = event.data?.json(); } catch { return; }
  if (!data?.tag) return;
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/brand/mark.png',
    tag: data.tag,
    data: { path: data.path },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const path = event.notification.data?.path;
  const safePath = typeof path === 'string' && /^\/(?:notifications|messages|team-management|teams|requests|members|projects|tasks|invitations)(?:\/|\?|$)/.test(path)
    ? path : '/notifications';
  const url = new URL(safePath, self.location.origin);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(window => window.url === url.href);
    if (existing) await existing.focus();
    else await self.clients.openWindow(url.href);
  })());
});
