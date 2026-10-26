// Carfixo – App-Ausbau Ende-zu-Ende gegen die echte Datenbank (Testkonten)
// Kunde bucht Festpreis-Termin, Betrieb ändert Status, Kunde sieht es live,
// Schnellantwort im Chat, am Ende wird die Buchung storniert.
// Vorher:  python3 -m http.server 8000
// Ausführen:  CFX_KUNDE_PW=… CFX_WERKSTATT_PW=… node tests/ausbau-e2e.js   (SHOTS=ordner für Bilder)
const { chromium } = require("playwright");
let pass = 0, fail = 0;
const check = (n, ok, i = "") => { console.log(`${ok ? "OK  " : "FAIL"}  ${n}${i ? "  – " + i : ""}`); ok ? pass++ : fail++; };
const SHOTS = process.env.SHOTS;
const BASE = "http://localhost:8000/app.html?appui=1";
const WS_ID = "eb4794fc-0f54-4eca-bb47-ac84a301f265";   // Carfixo Testwerkstatt
if (!process.env.CFX_KUNDE_PW || !process.env.CFX_WERKSTATT_PW) { console.log("Passwörter fehlen (CFX_KUNDE_PW, CFX_WERKSTATT_PW)."); process.exit(2); }

async function login(page, email, pw) {
  await page.goto(BASE + "#/login");
  await page.waitForSelector("#lEmail");
  await page.fill("#lEmail", email); await page.fill("#lPass", pw); await page.click("#lGo");
  await page.waitForFunction(() => !location.hash.includes("login"), null, { timeout: 15000 });
}

(async () => {
  const browser = await chromium.launch();
  const kunde = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const ws = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  for (const p of [kunde, ws]) p.on("pageerror", e => errs.push(String(e)));

  // ---------- Kunde: Home und Buchung ----------
  await login(kunde, "test-kunde@carfixo-test.de", process.env.CFX_KUNDE_PW);
  // Reste abgebrochener Läufe stornieren, damit Termine frei bleiben
  await kunde.evaluate(async (w) => sb.from("bookings").update({ status: "cancelled", cancelled_by: "customer", cancel_reason: "Test" })
    .eq("workshop_id", w).not("status", "in", "(completed,cancelled)"), WS_ID);
  let bkId = null;
  try {
  await kunde.goto(BASE + "#/home");
  await kunde.waitForSelector("#hmFest .hmFp", { timeout: 15000 }).catch(() => {});
  check("Home: Reihe „Sofort buchen“ mit Festpreisen", (await kunde.locator("#hmFest .hmFp").count()) >= 3);
  if (SHOTS) await kunde.screenshot({ path: SHOTS + "/e2e-home.png", fullPage: true });

  await kunde.goto(BASE + "#/workshop/" + WS_ID);
  await kunde.waitForSelector("#fpBox .fpBook", { timeout: 15000 });
  check("Werkstattprofil: Festpreise buchbar", await kunde.locator("#fpBox .fpBook:not([disabled])").count() === 3);
  await kunde.locator("#fpBox .fpBook", { hasText: "Ölwechsel" }).click();
  await kunde.waitForSelector(".slotBtn", { timeout: 15000 });
  check("Terminwahl zeigt freie Zeiten", await kunde.locator(".slotBtn").count() > 0);
  await kunde.locator(".slotBtn").first().click();
  if (SHOTS) await kunde.screenshot({ path: SHOTS + "/e2e-terminwahl.png" });
  await kunde.click("#twGo");
  await kunde.waitForFunction(() => location.hash.startsWith("#/request/"), null, { timeout: 15000 });
  const reqId = kunde.url().split("#/request/")[1];
  await kunde.waitForSelector("#bookingBox .terminRow", { timeout: 15000 });
  check("Buchung angelegt, Status „Termin bestätigt“", (await kunde.innerText("#bookingBox")).includes("Termin bestätigt"));
  check("Kalender- und Routen-Knopf da", await kunde.locator("#bookingBox .terminRow a").count() === 2);
  const kal = await kunde.getAttribute("#bookingBox .terminRow a", "href");
  check("Kalender-Link zeigt auf /api/termin", /\/api\/termin\?t=/.test(kal), kal);
  bkId = await kunde.evaluate(async (r) => (await sb.from("bookings").select("id, offers!inner(request_id)").eq("offers.request_id", r).single()).data.id, reqId);

  // ---------- Betrieb ----------
  await login(ws, "test-werkstatt@carfixo-test.de", process.env.CFX_WERKSTATT_PW);
  await ws.goto(BASE + "#/ws/dashboard");
  await ws.waitForSelector(".tabbar a");
  check("Betrieb: eigene Tabs in der App", (await ws.$$eval(".tabbar a", as => as.map(a => a.innerText.trim()).join("|"))) === "Start|Anfragen|Aufträge|Kalender|Konto");
  await ws.goto(BASE + "#/ws/profile"); await ws.waitForSelector('[data-ptab="fest"]');
  await ws.evaluate(() => zeigeProfTab("fest")); await ws.waitForSelector("#fpList .fpRow", { timeout: 10000 });
  check("Betrieb: Festpreise im Profil", await ws.locator("#fpList .fpRow").count() === 3);

  // Status ändern -> Kunde sieht es live
  await ws.evaluate(async (id) => sb.from("bookings").update({ status: "vehicle_received" }).eq("id", id), bkId);
  const live = await kunde.waitForFunction(() => document.querySelector("#toast")?.textContent.includes("Neuer Status"), null, { timeout: 15000 }).then(() => true).catch(() => false);
  check("Kunde sieht Statuswechsel live", live);
  await kunde.waitForFunction(() => document.querySelector("#bookingBox")?.innerText.includes("Fahrzeug angenommen"), null, { timeout: 10000 }).catch(() => {});
  check("Auftrag zeigt „Fahrzeug angenommen“", (await kunde.innerText("#bookingBox")).includes("Fahrzeug angenommen"));

  // Schnellantwort im Chat
  await ws.goto(BASE + "#/ws/lead/" + reqId);
  await ws.waitForSelector("#msgQuick .chip", { timeout: 15000 });
  await ws.locator("#msgQuick .chip").nth(3).click();   // "Wir haben mit der Arbeit begonnen."
  const nachricht = await kunde.waitForFunction(() => document.querySelector("#msgs")?.innerText.includes("Wir haben mit der Arbeit begonnen"), null, { timeout: 15000 }).then(() => true).catch(() => false);
  check("Schnellantwort kommt beim Kunden an", nachricht);
  if (SHOTS) await kunde.screenshot({ path: SHOTS + "/e2e-auftrag.png", fullPage: true });

  // Home zeigt den laufenden Auftrag live
  await kunde.goto(BASE + "#/home");
  await kunde.waitForSelector("#hmLive .hmSteps", { timeout: 15000 }).catch(() => {});
  check("Home: laufender Auftrag mit Schritten", await kunde.locator("#hmLive .hmSteps i.done").count() >= 1);
  if (SHOTS) await kunde.screenshot({ path: SHOTS + "/e2e-home-live.png" });

  } catch (e) { check("Ablauf ohne Abbruch", false, String(e).split("\n")[0]); }
  finally {
    // Aufräumen: stornieren
    if (bkId) {
      const { error } = await kunde.evaluate(async (id) => sb.from("bookings").update({ status: "cancelled", cancelled_by: "customer", cancel_reason: "Test" }).eq("id", id), bkId);
      check("Buchung storniert (Aufräumen)", !error, error && error.message);
    }
  }

  check("Keine JavaScript-Fehler", errs.length === 0, errs.join(" | "));
  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
