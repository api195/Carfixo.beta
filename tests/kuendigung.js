// Carfixo – Kündigungsbutton (§ 312k BGB) und Zwei-Faktor-Sperre im Admin.
// Ersetzt Supabase-Aufrufe im Browser, läuft daher ohne Backend.
// Ausführen:  node tests/kuendigung.js  (Server auf :8000 muss laufen)
const { chromium } = require("playwright");
const ROOT = (process.env.CARFIXO_URL || "http://localhost:8000/app.html").replace(/app\.html$/, "");
let pass = 0, fail = 0;
const check = (n, ok, i = "") => { console.log(`${ok ? "OK  " : "FAIL"}  ${n}${i ? "  – " + i : ""}`); ok ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const errs = [];

  // ---------- Button auf jeder Seite ----------
  let page = await browser.newPage();
  page.on("pageerror", e => errs.push(String(e)));
  await page.goto(ROOT + "app.html#/search", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const link = page.locator("footer.appFoot a.kuendigen[href='#/kuendigen']");
  check("App: Fußzeile zeigt „Verträge hier kündigen“", (await link.innerText()).trim() === "Verträge hier kündigen");
  await link.click();
  await page.waitForTimeout(400);
  check("Klick führt ohne Anmeldung zum Formular", await page.locator("#kdGo").isVisible());
  check("Schaltfläche heißt „Jetzt kündigen“", (await page.locator("#kdGo").innerText()).trim() === "Jetzt kündigen");

  // ---------- Pflichtfelder ----------
  await page.locator("#kdGo").click();
  check("Leeres Formular wird abgelehnt", await page.locator("#kdErr").isVisible());
  await page.fill("#kdName", "Erika Muster");
  await page.fill("#kdMail", "keine-mail");
  await page.locator("#kdGo").click();
  check("Ungültige E-Mail wird abgelehnt", /E-Mail/i.test(await page.locator("#kdErr").innerText()));

  await page.locator('input[name="kdArt"][value="ausserordentlich"]').check();
  check("Außerordentlich blendet Grund ein", await page.locator("#kdGrund").isVisible());
  await page.locator('input[name="kdWann"][value="datum"]').check();
  check("„Bestimmtes Datum“ blendet Datumsfeld ein", await page.locator("#kdDatum").isVisible());

  // ---------- Erfolgreiche Kündigung ----------
  await page.evaluate(() => {
    window.__rpc = null;
    sb.rpc = async (fn, args) => {
      window.__rpc = { fn, args };
      return { data: { ok: true, id: "11111111-2222-3333-4444-555555555555", received_at: "2026-10-19T08:30:00Z" }, error: null };
    };
  });
  await page.fill("#kdMail", "erika@example.org");
  await page.fill("#kdGrund", "Test");
  const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await page.fill("#kdDatum", morgen);
  await page.locator("#kdGo").click();
  await page.waitForTimeout(400);
  const rpc = await page.evaluate(() => window.__rpc);
  check("RPC submit_cancellation aufgerufen", rpc?.fn === "submit_cancellation");
  check("Daten vollständig übergeben", rpc?.args?.p_email === "erika@example.org" && rpc?.args?.p_kind === "ausserordentlich"
    && rpc?.args?.p_effective === "datum" && rpc?.args?.p_effective_date === morgen, JSON.stringify(rpc?.args));
  const txt = await page.locator("main").innerText();
  check("Bestätigungsseite zeigt Eingangszeitpunkt", /19\.10\.2026|19\. Oktober 2026/.test(txt));
  check("Bestätigungsseite zeigt Vorgangsnummer", txt.includes("11111111-2222-3333-4444-555555555555"));
  check("Bestätigung kann gespeichert werden", /speichern/i.test(txt));

  // ---------- Server nicht erreichbar ----------
  await page.goto(ROOT + "app.html#/search", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.evaluate(() => { location.hash = "#/kuendigen"; });
  await page.waitForTimeout(300);
  await page.evaluate(() => { sb.rpc = async () => ({ data: null, error: { message: "Could not find the function" } }); });
  await page.fill("#kdName", "Erika Muster");
  await page.fill("#kdMail", "erika@example.org");
  await page.locator("#kdGo").click();
  await page.waitForTimeout(300);
  check("Bei Fehler: Ausweg per E-Mail genannt", /info@carfixo\.de/.test(await page.locator("#kdErr").innerText()));
  await page.close();

  // ---------- Startseite und Rechtliches ----------
  page = await browser.newPage();
  await page.goto(ROOT + "index.html", { waitUntil: "domcontentloaded" });
  check("Startseite verlinkt den Kündigungsbutton", await page.locator('a[href="app.html#/kuendigen"]').count() > 0);
  await page.goto(ROOT + "legal.html", { waitUntil: "domcontentloaded" });
  check("Rechtliches verlinkt den Kündigungsbutton", await page.locator('a[href="app.html#/kuendigen"]').count() > 0);
  for (const id of ["impressum", "datenschutz", "agb", "agb-betriebe", "ranking", "bewertungen", "melden", "widerruf", "cookies"]) {
    check(`Rechtliches: Abschnitt #${id} vorhanden`, await page.locator("#" + id).count() === 1);
  }
  await page.close();

  // ---------- Admin: ohne zweiten Faktor kein Zugang ----------
  const adminMit = async (factors, aal) => {
    const p = await browser.newPage();
    p.on("pageerror", e => errs.push(String(e)));
    await p.goto(ROOT + "admin.html", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(800);
    await p.evaluate(({ factors, aal }) => {
      window.__enrolled = false;
      sb.auth.getSession = async () => ({ data: { session: { user: { id: "u1", email: "a@b.de" } } } });
      sb.from = () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "u1", role: "admin" } }) }) }) });
      sb.auth.mfa.getAuthenticatorAssuranceLevel = async () => ({ data: aal });
      sb.auth.mfa.listFactors = async () => ({ data: { totp: factors.filter(f => f.status === "verified"), all: factors } });
      sb.auth.mfa.unenroll = async () => ({ data: {} });
      sb.auth.mfa.enroll = async () => { window.__enrolled = true; return { data: { id: "f-neu", totp: { qr_code: "data:image/svg+xml;utf-8,<svg xmlns='http://www.w3.org/2000/svg'/>", secret: "ABCDEF" } } }; };
      sb.auth.mfa.challengeAndVerify = async ({ code }) => (code === "123456" ? { data: {} } : { error: { message: "invalid" } });
    }, { factors, aal });
    await p.evaluate(() => boot());
    await p.waitForTimeout(300);
    return p;
  };

  page = await adminMit([], { currentLevel: "aal1", nextLevel: "aal1" });
  check("Admin ohne Faktor: Einrichtung mit QR-Code", await page.locator("img[alt^='QR-Code']").isVisible() && await page.evaluate(() => window.__enrolled));
  check("Admin ohne Faktor: keine Admin-Navigation", !(await page.locator('#topNav a[href="#/workshops"]').count()));
  await page.close();

  page = await adminMit([{ id: "f1", status: "verified" }], { currentLevel: "aal1", nextLevel: "aal2" });
  check("Admin mit Faktor: fragt Code ab", await page.locator("#mCode").isVisible() && !(await page.evaluate(() => window.__enrolled)));
  await page.fill("#mCode", "000000");
  await page.locator("#mGo").click();
  await page.waitForTimeout(200);
  check("Falscher Code wird abgelehnt", await page.locator("#mErr").isVisible());
  await page.evaluate(() => { sb.auth.mfa.getAuthenticatorAssuranceLevel = async () => ({ data: { currentLevel: "aal2", nextLevel: "aal2" } }); });
  await page.fill("#mCode", "123 456");
  await page.locator("#mGo").click();
  await page.waitForTimeout(300);
  check("Richtiger Code öffnet den Admin-Bereich", await page.locator('#topNav a[href="#/kuendigungen"]').count() === 1);
  await page.close();

  check("Keine JavaScript-Fehler", errs.length === 0, errs.slice(0, 3).join(" | "));
  await browser.close();
  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
})();
