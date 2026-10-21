// Carfixo – Betriebsprofil in Reitern und eigener Bestätigungsdialog.
// Ersetzt Supabase-Aufrufe im Browser, läuft daher ohne Backend.
// Ausführen:  node tests/profil.js  (Server auf :8000 muss laufen)
const { chromium, devices } = require("playwright");
const BASE = process.env.CARFIXO_URL || "http://localhost:8000/app.html";
let pass = 0, fail = 0;
const check = (n, ok, i = "") => { console.log(`${ok ? "OK  " : "FAIL"}  ${n}${i ? "  – " + i : ""}`); ok ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await (await browser.newContext(devices["iPhone 13"])).newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  await page.goto(BASE + "#/search", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  await page.evaluate(() => {
    me = { id: "u1", email: "w@test.de" }; myProfile = { id: "u1", role: "workshop_owner" };
    myWorkshop = { id: "w1", name: "Testwerkstatt", is_verified: true, categories: ["reparatur"], phone: "", street: "Teststr. 1",
      district: "Nippes", opening_hours: {}, online_payment: true };
    const leer = { data: [], error: null };
    const q = new Proxy({}, { get: (t, k) => k === "then" ? (r) => r(leer) : () => q });
    sb.from = () => q;
    Object.defineProperty(sb, "functions", { configurable: true, value: { invoke: async () => ({ data: { configured: false }, error: null }) } });
  });
  await page.evaluate(() => vWsProfile());
  await page.waitForTimeout(400);
  const sichtbar = () => page.evaluate(() => [...document.querySelectorAll("#profPanes .pCard")].filter(c => !c.hidden).map(c => c.querySelector(".tt").textContent));

  // ---------- Reiter ----------
  check("Sechs Reiter vorhanden", await page.locator(".pTabs [data-ptab]").count() === 6);
  check("Start: nur „Allgemein“ sichtbar", JSON.stringify(await sichtbar()) === JSON.stringify(["Stammdaten", "Adresse & Standort"]), JSON.stringify(await sichtbar()));
  const punkte = await page.evaluate(() => [...document.querySelectorAll(".pTabs .pDot")].map(d => d.parentElement.dataset.ptab));
  check("Punkte markieren Lücken (Telefon, Zeiten, Bilder)", JSON.stringify(punkte) === JSON.stringify(["allg", "zeiten", "bilder"]), JSON.stringify(punkte));
  check("Fortschritt wird angezeigt", /Profil zu \d+ % vollständig/.test(await page.locator(".profFort").innerText()));
  await page.click('[data-ptab="leist"]');
  check("Reiter „Leistungen“ zeigt Kategorien, Leistungen, Marken", (await sichtbar()).length === 3);
  await page.click('[data-ptab="zahl"]');
  check("Reiter „Zahlungen“ zeigt Stripe und Premium", (await sichtbar()).includes("Online-Zahlungen"));
  check("Bei Zahlungen keine Speichern-Leiste", await page.evaluate(() => $("pSaveBar").hidden));
  check("Alle Eingabefelder bleiben im DOM (Speichern nimmt alles mit)", await page.evaluate(() => !!$("pName") && !!$("pStreet") && !!$("pNextFree")));

  // ---------- Fehler führt zum richtigen Reiter ----------
  await page.click('[data-ptab="allg"]');
  await page.evaluate(() => { profCats.length = 0; $("pSave").click(); });
  await page.waitForTimeout(200);
  check("Fehlende Kategorie öffnet „Leistungen“", await page.evaluate(() => profTab) === "leist");
  check("Fehlermeldung sichtbar", (await page.locator("#pErr").innerText()).includes("Kategorie"));

  // ---------- Rückkehr von Stripe öffnet den Zahlungs-Reiter ----------
  await page.goto(BASE.replace(/#.*$/, "") + "?stripe=zurueck#/search", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  check("Nach Stripe-Rückkehr ist „Zahlungen“ vorgewählt", await page.evaluate(() => profTab) === "zahl");

  // ---------- Bestätigungsdialog ----------
  let r = page.evaluate(() => frage("Text", { titel: "Auftrag abschließen?", ja: "Ja, abschließen" }));
  await page.waitForTimeout(200);
  check("Dialog im Carfixo-Design statt Browserfenster", await page.locator(".dlg .dlgBox h2").innerText() === "Auftrag abschließen?");
  await page.click('.dlg [data-a="1"]');
  check("„Ja“ liefert true", (await r) === true);
  r = page.evaluate(() => frage("Text"));
  await page.waitForTimeout(200);
  await page.keyboard.press("Escape");
  check("Escape bricht ab", (await r) === false);
  check("Dialog ist danach entfernt", await page.locator(".dlg").count() === 0);
  check("Kein window.confirm mehr im Code", !(await page.evaluate(() => fetch("assets/app.js").then(r => r.text()).then(t => /[^.\w]confirm\(/.test(t)))));

  check("Keine JavaScript-Fehler", errs.length === 0, errs.slice(0, 3).join(" | "));
  await browser.close();
  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
})();
