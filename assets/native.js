// ============================================================
// Carfixo – nur in der iPhone-App (Capacitor)
//
// Wird von mobile/build-www.js ausschließlich ins App-Paket eingebunden,
// nie auf carfixo.de. Erwartet die Plugin-Skripte von Capacitor
// (capacitorBrowser, capacitorApp, capacitorStatusBar, capacitorSplashScreen).
// ============================================================
"use strict";
(function () {
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  document.documentElement.classList.add("native");

  const Browser = window.capacitorBrowser && window.capacitorBrowser.Browser;
  const App = window.capacitorApp && window.capacitorApp.App;
  const StatusBar = window.capacitorStatusBar && window.capacitorStatusBar.StatusBar;
  const SplashScreen = window.capacitorSplashScreen && window.capacitorSplashScreen.SplashScreen;
  const Haptics = window.capacitorHaptics && window.capacitorHaptics.Haptics;
  const Bio = window.capacitorCapacitorBiometric && window.capacitorCapacitorBiometric.NativeBiometric;
  const BIO_SERVER = "carfixo.de";

  // Schnittstelle für app.js: Vibration und Face ID. Auf der Website gibt es
  // das Objekt nicht – app.js prüft vorher.
  window.CarfixoNative = {
    haptic(kind) {
      if (!Haptics) return;
      const n = { success: "SUCCESS", warning: "WARNING", error: "ERROR" }[kind];
      (n ? Haptics.notification({ type: n })
         : kind === "select" ? Haptics.selectionChanged()
         : Haptics.impact({ style: kind === "medium" ? "MEDIUM" : "LIGHT" })).catch(() => {});
    },
    async biometryAvailable() {
      if (!Bio) return false;
      try { const r = await Bio.isAvailable(); return !!r.isAvailable; } catch (e) { return false; }
    },
    async verify(reason) {
      if (!Bio) return false;
      try { await Bio.verifyIdentity({ reason, title: "Carfixo" }); return true; } catch (e) { return false; }
    },
    saveLogin: (email, password) => Bio ? Bio.setCredentials({ username: email, password, server: BIO_SERVER }) : Promise.reject(),
    async getLogin() {
      if (!Bio) return null;
      try { const c = await Bio.getCredentials({ server: BIO_SERVER }); return c && c.username ? { email: c.username, password: c.password } : null; }
      catch (e) { return null; }
    },
    // Statusleiste passend zum Design: helle Schrift auf Dunkel, dunkle auf Hell
    statusBar(hell) { if (StatusBar) StatusBar.setStyle({ style: hell ? "LIGHT" : "DARK" }).catch(() => {}); },
    removeLogin: () => Bio ? Bio.deleteCredentials({ server: BIO_SERVER }).catch(() => {}) : Promise.resolve(),
  };

  // Helle Schrift in der Statusleiste – Carfixo ist dunkel.
  if (StatusBar) StatusBar.setStyle({ style: "DARK" }).catch(() => {});
  if (SplashScreen) window.addEventListener("load", () => SplashScreen.hide().catch(() => {}));

  const istExtern = (href) => /^https?:\/\//i.test(href) && !href.startsWith(location.origin);

  // Fremde Seiten im Safari-Fenster über der App öffnen. Ohne das würde
  // WKWebView Links mit target="_blank" still verschlucken.
  if (Browser) {
    window.open = function (url) {
      if (url) Browser.open({ url: new URL(url, location.href).href });
      return null;
    };
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a || e.defaultPrevented) return;
      const href = a.getAttribute("href");
      if (/^(mailto|tel):/i.test(href)) return;            // übernimmt iOS selbst
      if (istExtern(a.href)) {
        e.preventDefault();
        Browser.open({ url: a.href });
      } else if (a.target === "_blank") {
        e.preventDefault();                                // eigene Seite, z. B. legal.html
        location.href = a.href;
      }
    }, true);

    // Zurück aus Stripe (Bezahlen, Konto einrichten): Seite neu laden, damit
    // der neue Zahlungsstand sofort zu sehen ist.
    Browser.addListener("browserFinished", () => {
      if (typeof window.route === "function") window.route();
    });
  }

  // Links aus E-Mails (Universal Links) landen hier, sobald carfixo.de als
  // zugeordnete Domain eingerichtet ist: den Hash übernehmen.
  if (App) {
    // App-Sperre: beim Zurückkehren nach mehr als einer Minute Face ID verlangen
    let weg = 0;
    App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) { weg = Date.now(); return; }
      if (weg && Date.now() - weg > 60000 && typeof window.appLock === "function") window.appLock();
    });
    App.addListener("appUrlOpen", ({ url }) => {
      try {
        const u = new URL(url);
        if (u.hash) location.hash = u.hash;
      } catch (e) { /* unbekanntes Format: ignorieren */ }
    });
  }
})();
