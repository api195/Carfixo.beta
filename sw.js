// ============================================================
// Carfixo – Service Worker (nur Web-Push)
//
// Bewusst ohne Caching-Strategie: Die App wird bei jedem Aufruf frisch
// geladen. Ein Cache würde hier vor allem dafür sorgen, dass Nutzer nach
// einem Deploy veraltete Stände sehen.
// ============================================================
"use strict";

const APP_PATH = "/app.html";

// Beim Aktivieren sofort die Kontrolle übernehmen, damit ein frisch
// registrierter Worker nicht erst beim nächsten Seitenaufruf greift.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { /* kein JSON */ }

  const title = d.title || "Carfixo";
  const path = d.path ? String(d.path).replace(/^[#/]+/, "") : "";

  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // Meldungen zum selben Vorgang ersetzen sich, statt sich zu stapeln
    tag: d.type ? "carfixo-" + d.type : "carfixo",
    data: { url: APP_PATH + (path ? "#/" + path : "") },
  }));
});

// Klick auf die Meldung: vorhandenen Tab in den Vordergrund holen und dorthin
// navigieren – sonst öffnet jeder Klick ein weiteres Fenster.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || APP_PATH;

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of clients) {
      if (c.url.includes(APP_PATH)) {
        await c.focus();
        if ("navigate" in c) { try { await c.navigate(url); } catch (e) { /* egal */ } }
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
