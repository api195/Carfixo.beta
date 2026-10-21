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
    App.addListener("appUrlOpen", ({ url }) => {
      try {
        const u = new URL(url);
        if (u.hash) location.hash = u.hash;
      } catch (e) { /* unbekanntes Format: ignorieren */ }
    });
  }
})();
