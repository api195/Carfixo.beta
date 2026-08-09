// Carfixo – Web-Push: VAPID-Dekodierung, Service-Worker-Registrierung, Statuslogik.
// Ein echter Push-Dienst wird nicht benoetigt.
// Ausfuehren:  node tests/push.js  (Server auf :8000 muss laufen)
const { chromium } = require("playwright");
const BASE = process.env.CARFIXO_URL || "http://localhost:8000/app.html";
let pass = 0, fail = 0;
const check = (n, ok, i = "") => { console.log(`${ok ? "OK  " : "FAIL"}  ${n}${i ? "  – " + i : ""}`); ok ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));

  await page.goto(BASE + "#/search", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  // VAPID-Schlüssel muss zu einem gültigen P-256-Punkt dekodieren (65 Byte, 0x04)
  const v = await page.evaluate(() => {
    const b = vapidToBytes(CARFIXO.VAPID_PUBLIC_KEY);
    return { len: b.length, first: b[0] };
  });
  check("VAPID dekodiert zu 65 Byte", v.len === 65, "len=" + v.len);
  check("VAPID beginnt mit 0x04 (uncompressed point)", v.first === 4, "0x" + v.first.toString(16));

  // Service Worker registrieren
  const reg = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return { scope: r.scope, active: !!(r.active || r.installing || r.waiting) };
  });
  check("Service Worker registriert", reg.active, reg.scope);

  // Statuslogik ohne erteilte Berechtigung
  const st = await page.evaluate(() => pushStatus());
  check("Status ohne Abo = inaktiv", st === "inaktiv", st);

  // Push-Box im Konto rendert den passenden Text
  const box = await page.evaluate(async () => {
    const d = document.createElement("div"); d.id = "pushBox";
    document.querySelector("main").appendChild(d);
    await renderPushBox();
    return d.innerText;
  });
  check("Push-Box zeigt Aktivieren-Schaltflaeche", /aktivieren/i.test(box), box.split("\n")[0]);

  // Blockierte Berechtigung sauber abbilden
  await ctx.clearPermissions();
  const stBlocked = await page.evaluate(() => {
    Object.defineProperty(Notification, "permission", { get: () => "denied", configurable: true });
    return pushStatus();
  });
  check("Blockierte Berechtigung erkannt", stBlocked === "blockiert", stBlocked);

  const boxBlocked = await page.evaluate(async () => { await renderPushBox(); return document.getElementById("pushBox").innerText; });
  check("Blockiert: kein Aktivieren-Button", !/aktivieren/i.test(boxBlocked) && /blockiert/i.test(boxBlocked));

  // Service Worker: Push-Ereignis verarbeiten (ohne echten Push-Dienst)
  const swOk = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration("/sw.js");
    return !!r && typeof r.pushManager === "object";
  });
  check("pushManager verfuegbar", swOk);

  const real = errs.filter(e => !/Failed to load|net::ERR/i.test(e));
  check("Keine JS-Fehler", real.length === 0, real[0] || "");

  await browser.close();
  console.log(`\nErgebnis: ${pass}/${pass + fail} bestanden`);
  process.exit(fail ? 1 : 0);
})();
