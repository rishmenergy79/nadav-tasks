// Service worker מינימלי: שומר את מעטפת האפליקציה בלבד
const PREFIX = 'nadav-tasks-shell-';
const CACHE = PREFIX + 'v9';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// רשת קודם, מטמון כגיבוי – רק לקבצי המעטפת מאותו מקור
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok && (req.mode === 'navigate' || SHELL.some((p) => url.pathname.endsWith(p.replace('./', '/'))))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});

// תזכורות: הצגת התראה שמגיעה מהשרת
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'תזכורת', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'תזכורת למשימה', {
    body: d.body || '',
    tag: d.tag || 'task',
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 150, 300, 150, 600],
    icon: 'icon.svg',
    badge: 'icon.svg',
    dir: 'rtl',
    lang: 'he',
    data: { taskId: d.taskId || null },
  }));
});

// לחיצה על התראה: פתיחת האפליקציה ישירות על המשימה
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const id = e.notification.data && e.notification.data.taskId;
  const url = new URL(id ? './?task=' + encodeURIComponent(id) : './', self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) {
        await c.focus();
        if (id) c.postMessage({ openTask: id });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
