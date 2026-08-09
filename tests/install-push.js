// Carfixo – Installationshinweis und Push-Status je Plattform.
// Simuliert iPhone (Safari + installierte PWA) sowie Android/Chrome.
// Ausfuehren:  node tests/install-push.js  (Server auf :8000 muss laufen)
const { chromium, devices } = require("playwright");
const BASE = process.env.CARFIXO_URL || "http://localhost:8000/app.html";
let pass = 0, fail = 0;
const check = (n, ok, i = "") => { console.log(`${ok ? "OK  " : "FAIL"}  ${n}${i ? "  – " + i : ""}`); ok ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

  // ---------- Fall 1: iPhone in Safari (nicht installiert) ----------
  let ctx = await browser.newContext(devices["iPhone 13"]);
  let page = await ctx.newPage();
  await page.addInitScript(() => {
    // Safari auf iOS kennt PushManager nicht
    delete window.PushManager;
    Object.defineProperty(window.navigator, "standalone", { get: () => false, configurable: true });
  });
  await page.goto(BASE + "#/search", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  check("iPhone erkannt", await page.evaluate(() => isIOS()));
  check("iPhone/Safari: nicht als App erkannt", !(await page.evaluate(() => isStandalone())));
  check("Zustand = ios_manuell", (await page.evaluate(() => installState())) === "ios_manuell");

  let st = await page.evaluate(() => pushStatus());
  check("Push-Status = installation_noetig", st === "installation_noetig", st);

  // Karte muss die Anleitung zeigen, nicht nur "nicht verfuegbar"
  const karte = await page.evaluate(async () => {
    const d = document.createElement("div"); d.id = "pushBox";
    document.querySelector("main").appendChild(d);
    await renderPushBox();
    return { text: d.innerText, schritte: d.querySelectorAll("ol li").length };
  });
  check("Karte nennt Installation als Voraussetzung", /Installation nötig/i.test(karte.text), karte.text.split("\n")[0]);
  check("Karte zeigt die vier Schritte", karte.schritte === 4, "Schritte: " + karte.schritte);
  check("Karte erwähnt keine Sackgasse", !/Nicht verfügbar/i.test(karte.text));

  // Banner erscheint und laesst sich dauerhaft ausblenden
  await page.evaluate(() => { localStorage.removeItem("cfx_install_hidden"); renderInstallBanner(); });
  await page.waitForTimeout(300);
  check("Installationshinweis erscheint", await page.locator("#installBanner").count() === 1);
  check("Hinweis nennt den iPhone-Grund",
    /iPhone/i.test(await page.locator("#installBanner").innerText()));

  await page.click("#ibGo"); await page.waitForTimeout(300);
  check("Anleitung oeffnet sich", /Zum Home-Bildschirm/i.test(await page.locator("#modalHost").innerText()));
  await page.evaluate(() => closeModal());

  await page.click("#ibNo"); await page.waitForTimeout(200);
  check("Hinweis laesst sich schliessen", await page.locator("#installBanner").count() === 0);
  await page.evaluate(() => renderInstallBanner());
  await page.waitForTimeout(200);
  check("Geschlossener Hinweis bleibt weg", await page.locator("#installBanner").count() === 0);
  await ctx.close();

  // ---------- Fall 2: iPhone, als App installiert ----------
  ctx = await browser.newContext(devices["iPhone 13"]);
  page = await ctx.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "standalone", { get: () => true, configurable: true });
  });
  await page.goto(BASE + "#/search", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  check("Installierte App wird erkannt", await page.evaluate(() => isStandalone()));
  check("Installiert: kein Hinweis mehr",
    (await page.evaluate(() => installState())) === "installiert");
  st = await page.evaluate(() => pushStatus());
  check("Installiert: Push nutzbar", st === "inaktiv" || st === "aktiv", st);
  await ctx.close();

  // ---------- Fall 3: Android/Chrome (direkt installierbar) ----------
  ctx = await browser.newContext(devices["Pixel 5"]);
  page = await ctx.newPage();
  await page.goto(BASE + "#/search", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  // Chrome liefert beforeinstallprompt – hier nachgestellt
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt");
    e.prompt = () => { window.__prompted = true; };
    Object.defineProperty(e, "userChoice", { get: () => Promise.resolve({ outcome: "accepted" }) });
    window.dispatchEvent(e);
  });
  await page.waitForTimeout(300);
  check("Android: Zustand = installierbar",
    (await page.evaluate(() => installState())) === "installierbar");
  check("Android: Schaltflaeche heisst Installieren",
    /Installieren/.test(await page.locator("#ibGo").innerText()));
  await page.click("#ibGo"); await page.waitForTimeout(300);
  check("Android: echter Installationsdialog wird ausgeloest",
    await page.evaluate(() => window.__prompted === true));
  check("Android: Push auch ohne Installation nutzbar",
    ["inaktiv", "aktiv"].includes(await page.evaluate(() => pushStatus())));
  await ctx.close();

  await browser.close();
  console.log(`\nErgebnis: ${pass}/${pass + fail} bestanden`);
  process.exit(fail ? 1 : 0);
})();
