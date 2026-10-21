// Carfixo – Widerrufsbutton: „Vertrag widerrufen“ -> „Widerruf bestätigen“ -> Eingangsbestätigung.
// Ersetzt Supabase-Aufrufe im Browser, läuft daher ohne Backend.
// Ausführen:  node tests/widerruf.js  (Server auf :8000 muss laufen)
const { chromium } = require("playwright");
const ROOT = (process.env.CARFIXO_URL || "http://localhost:8000/app.html").replace(/app\.html.*$/, "");
let pass = 0, fail = 0;
const check = (n, ok, i = "") => { console.log(`${ok ? "OK  " : "FAIL"}  ${n}${i ? "  – " + i : ""}`); ok ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));

  // ---------- Erreichbarkeit ----------
  await page.goto(ROOT + "app.html#/search", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  check("App-Fußzeile: „Vertrag widerrufen“", await page.locator('footer.appFoot a[href="#/widerrufen"]').innerText() === "Vertrag widerrufen");
  await page.click('footer.appFoot a[href="#/widerrufen"]');
  await page.waitForTimeout(300);
  check("Formular ohne Anmeldung erreichbar", await page.locator("#wdGo").isVisible());
  check("Schaltfläche heißt „Widerruf bestätigen“", (await page.locator("#wdGo").innerText()).trim() === "Widerruf bestätigen");

  // ---------- Vorbelegte Auftragsnummer aus der Buchung ----------
  await page.evaluate(() => { location.hash = "#/widerrufen/CFX-1004"; });
  await page.waitForTimeout(300);
  check("Auftragsnummer aus dem Link vorbelegt", await page.inputValue("#wdNr") === "CFX-1004");

  // ---------- Pflichtfelder ----------
  await page.locator("#wdGo").click();
  check("Ohne Namen abgelehnt", (await page.locator("#wdErr").innerText()).includes("Namen"));
  await page.fill("#wdName", "Erika Muster");
  await page.fill("#wdMail", "kaputt");
  await page.locator("#wdGo").click();
  check("Ungültige E-Mail abgelehnt", (await page.locator("#wdErr").innerText()).includes("E-Mail"));

  // ---------- Erfolgreicher Widerruf ----------
  await page.evaluate(() => {
    window.__rpc = null;
    sb.rpc = async (fn, args) => { window.__rpc = { fn, args };
      return { data: { id: "aaaaaaaa-1111-2222-3333-444444444444", received_at: "2026-10-21T15:00:00Z", zugeordnet: true, betrieb: "Werkstatt A" }, error: null }; };
  });
  await page.fill("#wdMail", "erika@example.org");
  await page.fill("#wdNote", "Bitte Geld zurück");
  await page.locator("#wdGo").click();
  await page.waitForTimeout(300);
  const rpc = await page.evaluate(() => window.__rpc);
  check("submit_withdrawal mit allen Angaben", rpc?.fn === "submit_withdrawal" && rpc.args.p_booking_no === "CFX-1004" && rpc.args.p_note === "Bitte Geld zurück", JSON.stringify(rpc?.args));
  const txt = await page.locator("main").innerText();
  check("Bestätigung mit Datum und Uhrzeit", /21\. Oktober 2026/.test(txt) && /Uhr/.test(txt));
  check("Bestätigung nennt Vertragspartner", txt.includes("Werkstatt A"));
  check("Bestätigung speichern/drucken möglich", /speichern/i.test(txt) && /Drucken/.test(txt));

  // ---------- Nicht zugeordnet ----------
  await page.evaluate(() => { location.hash = "#/widerrufen"; });
  await page.waitForTimeout(300);
  await page.evaluate(() => { sb.rpc = async () => ({ data: { id: "b", received_at: "2026-10-21T15:00:00Z", zugeordnet: false, betrieb: null }, error: null }); });
  await page.fill("#wdName", "Max"); await page.fill("#wdMail", "max@example.org"); await page.fill("#wdNr", "XYZ-1");
  await page.locator("#wdGo").click();
  await page.waitForTimeout(300);
  check("Nicht zuordenbar: ehrlicher Hinweis", (await page.locator("main").innerText()).includes("nicht sofort zuordnen"));

  // ---------- Server nicht erreichbar ----------
  await page.evaluate(() => vWiderrufen());
  await page.waitForTimeout(300);
  await page.evaluate(() => { sb.rpc = async () => ({ data: null, error: { message: "Could not find the function" } }); });
  await page.fill("#wdName", "Max"); await page.fill("#wdMail", "max@example.org"); await page.fill("#wdNr", "CFX-1");
  await page.locator("#wdGo").click();
  await page.waitForTimeout(200);
  check("Fehler: Ausweg per E-Mail", (await page.locator("#wdErr").innerText()).includes("info@carfixo.de"));

  // ---------- Startseite und Rechtliches ----------
  await page.goto(ROOT + "index.html", { waitUntil: "domcontentloaded" });
  check("Startseite verlinkt „Vertrag widerrufen“", await page.locator('a[href="app.html#/widerrufen"]').count() > 0);
  await page.goto(ROOT + "legal.html", { waitUntil: "domcontentloaded" });
  check("Rechtliches verlinkt „Vertrag widerrufen“", await page.locator('a[href="app.html#/widerrufen"]').count() >= 2);
  check("„Gesponsert“ nur noch als künftiger Hinweis", (await page.locator("main").innerText()).match(/Gesponsert/g)?.length === 1);

  check("Keine JavaScript-Fehler", errs.length === 0, errs.slice(0, 3).join(" | "));
  await browser.close();
  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
})();
