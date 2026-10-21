// Carfixo – App-Paket für das iPhone (mobile/www) im simulierten Capacitor.
// Ahmt die Brücke von iOS nach (window.webkit.messageHandlers.bridge) und
// zeichnet auf, welche nativen Plugins die Seite aufruft.
// Vorher:  (cd mobile && npm install && npm run build)
// Ausführen:  node tests/app-ios.js   (startet selbst einen Server auf :8001)
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
const check = (n, ok, i = "") => { console.log(`${ok ? "OK  " : "FAIL"}  ${n}${i ? "  – " + i : ""}`); ok ? pass++ : fail++; };

const WWW = path.join(__dirname, "..", "mobile", "www");
const TYPEN = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const f = path.join(WWW, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"));
  if (!f.startsWith(WWW) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end(); }
  res.setHeader("Content-Type", TYPEN[path.extname(f)] || "application/octet-stream");
  fs.createReadStream(f).pipe(res);
}).listen(8001);

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  await page.addInitScript(() => {
    window.__nativ = [];
    window.webkit = { messageHandlers: { bridge: { postMessage: (m) => window.__nativ.push(m) } } };
    // So meldet die echte Brücke ihre Plugins an; Aufrufe landen in __nativ.
    const m = (...n) => n.map(name => ({ name, rtype: name === "addListener" ? "callback" : "promise" }));
    window.Capacitor = {
      isNativePlatform: () => true, getPlatform: () => "ios",
      PluginHeaders: [
        { name: "Browser", methods: m("open", "close", "addListener", "removeAllListeners") },
        { name: "App", methods: m("addListener", "removeAllListeners") },
        { name: "StatusBar", methods: m("setStyle") },
        { name: "SplashScreen", methods: m("hide") },
      ],
      nativePromise: (pluginId, methodName, options) => { window.__nativ.push({ pluginId, methodName, options }); return Promise.resolve(); },
      nativeCallback: (pluginId, methodName, options) => { window.__nativ.push({ pluginId, methodName, options }); return "cb"; },
    };
  });
  const api = [];
  await page.route("https://carfixo.de/api/**", r => { api.push(r.request().url()); r.fulfill({ status: 200, contentType: "application/json", body: '{"found":false}' }); });

  // ---------- Start ----------
  await page.goto("http://localhost:8001/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  check("index.html leitet in die App weiter", page.url().includes("/app.html#/search"), page.url());
  check("App erkennt sich als iPhone-App", await page.evaluate(() => NATIVE && API === "https://carfixo.de"));
  const nativ = await page.evaluate(() => window.__nativ.map(x => x.pluginId + "." + x.methodName));
  check("Statusleiste hell, Startbild ausgeblendet", nativ.includes("StatusBar.setStyle") && nativ.includes("SplashScreen.hide"), nativ.join(" "));
  check("Rückkehr aus Stripe wird beobachtet", nativ.includes("Browser.addListener"));
  check("Markierung html.native gesetzt", await page.evaluate(() => document.documentElement.classList.contains("native")));
  check("Kein Hinweis „Als App installieren“", await page.locator("#installBanner").count() === 0);
  check("Logo führt zur Suche statt zur Website", await page.locator("a.logo").getAttribute("href") === "app.html#/search");
  check("Keine Google-Karte (Browser-Key gilt nur für carfixo.de)", !(await page.evaluate(() => [...document.scripts].some(s => s.src.includes("maps.googleapis.com")))));

  // ---------- Serverabrufe mit voller Adresse ----------
  await page.evaluate(() => fetch(API + "/api/geocode?q=Köln"));
  check("Adresssuche geht an https://carfixo.de/api", api.some(u => u.startsWith("https://carfixo.de/api/geocode")), api.join(" "));
  check("Passwort-Link zeigt auf carfixo.de", await page.evaluate(() => appAdresse()) === "https://carfixo.de/app.html");

  // ---------- Fremde Seiten im Safari-Fenster ----------
  const browserAufrufe = () => page.evaluate(() => window.__nativ.filter(m => m.pluginId === "Browser" && m.methodName === "open").map(m => m.options.url));
  await page.evaluate(() => oeffneExtern("https://checkout.stripe.com/c/pay/test"));
  await page.waitForTimeout(100);
  check("Stripe öffnet im Safari-Fenster, App bleibt", (await browserAufrufe()).includes("https://checkout.stripe.com/c/pay/test") && page.url().includes("localhost:8001"));
  await page.evaluate(() => window.open("https://example.org/rechnung.pdf"));
  await page.waitForTimeout(100);
  check("window.open (Rechnung) öffnet im Safari-Fenster", (await browserAufrufe()).includes("https://example.org/rechnung.pdf"));
  await page.evaluate(() => { const a = document.createElement("a"); a.href = "https://www.google.com/maps/dir/?api=1"; a.target = "_blank"; a.textContent = "x"; document.body.appendChild(a); a.click(); });
  await page.waitForTimeout(100);
  check("Externer Link mit target=_blank öffnet im Safari-Fenster", (await browserAufrufe()).includes("https://www.google.com/maps/dir/?api=1") && page.url().includes("localhost:8001"));

  // ---------- Push ----------
  check("Push-Hinweis: kommt mit dem nächsten Update", await page.evaluate(async () => (await pushStatus()) === "app_bald"));

  // ---------- Rechtliches in der App ----------
  await page.goto("http://localhost:8001/legal.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  check("Rechtliches lädt im App-Paket", (await page.locator("main").innerText()).includes("Impressum"));
  check("Widerruf-Link führt in die App", await page.locator('a[href="app.html#/widerrufen"]').count() > 0);

  check("Keine JavaScript-Fehler", errs.length === 0, errs.slice(0, 3).join(" | "));
  await browser.close();
  server.close();
  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
})();
