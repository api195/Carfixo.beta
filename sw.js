// ============================================================
// Carfixo – Service Worker (Web-Push)
// ============================================================
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch (_) { d = { title: "Carfixo", body: e.data ? e.data.text() : "" }; }
  const title = d.title || "Carfixo";
  const options = {
    body: d.body || "",
    tag: d.type || "carfixo",
    renotify: true,
    data: { path: d.path || "" },
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const path = (e.notification.data && e.notification.data.path) || "";
  const target = new URL("app.html" + (path ? "#/" + path : ""), self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes("app.html")) {
        await c.focus();
        if (path) c.postMessage({ type: "notif-nav", path });
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
