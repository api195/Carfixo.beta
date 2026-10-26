// Carfixo – Diagnose Schritt für Schritt und Bilder der Home-Kacheln.
// Vorher:  python3 -m http.server 8000
// Ausführen:  node tests/diagnose.js   (Bildschirmfotos mit SHOTS=ordner)
const { chromium } = require("playwright");
let pass = 0, fail = 0;
const check = (n, ok, i = "") => { console.log(`${ok ? "OK  " : "FAIL"}  ${n}${i ? "  – " + i : ""}`); ok ? pass++ : fail++; };
const SHOTS = process.env.SHOTS;
const shot = (page, name) => SHOTS ? page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }) : null;

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  // Supabase ohne Netz
  await page.route("**/rest/v1/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/auth/v1/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));

  // ---------- Home: Illustrationen ----------
  await page.goto("http://localhost:8000/app.html?appui=1#/home");
  await page.waitForSelector(".hmTile img");
  await page.evaluate(() => Promise.all([...document.querySelectorAll(".hmTile img")].map(i => i.decode().catch(() => {}))));
  const bilder = await page.$$eval(".hmTile img", is => is.map(i => i.naturalWidth));
  check("Home: 8 Kacheln mit geladenem Bild", bilder.length === 8 && bilder.every(w => w > 0), bilder.join(","));
  await shot(page, "home");

  // ---------- Diagnose: Schritte ----------
  await page.goto("http://localhost:8000/app.html?appui=1#/diagnose");
  await page.waitForSelector("#dgWizard");
  const sichtbar = () => page.$$eval(".dgStep", s => s.filter(x => !x.hidden).map(x => x.dataset.step).join(","));
  check("Start: nur Schritt 1 sichtbar", await sichtbar() === "1");
  check("Zurück auf Schritt 1 versteckt", await page.$eval("#dgBack", b => getComputedStyle(b).visibility) === "hidden");
  await shot(page, "diagnose-1");

  await page.click("#dgNext");
  check("Weiter → Schritt 2", await sichtbar() === "2");
  await page.click('#dgLights .chip[data-k="mkl"]');
  check("Warnleuchte wählbar", await page.locator('#dgLights .chip.on').count() === 1);
  check("Zähler am Umschalter", (await page.innerText("#dgCntL")) === "1");
  check("Geräusche erst nach Umschalten sichtbar", await page.isHidden("#dgSounds"));
  await page.click('#dgSwitch div[data-p="dgSounds"]');
  check("Umschalten zeigt Geräusche, blendet Leuchten aus", await page.isVisible("#dgSounds") && await page.isHidden("#dgLights"));
  await page.click('#dgSwitch div[data-p="dgLights"]');
  await shot(page, "diagnose-2");

  await page.click("#dgNext");
  check("Weiter → Schritt 3, Knopf „Ergebnis zeigen“", await sichtbar() === "3" && (await page.innerText("#dgNext")) === "Ergebnis zeigen");
  await shot(page, "diagnose-3");

  await page.click("#dgBack");
  check("Zurück → Schritt 2, Auswahl bleibt", await sichtbar() === "2" && await page.locator('#dgLights .chip.on').count() === 1);
  await page.click('#dgLights .chip[data-k="mkl"]');
  await page.click("#dgNext");

  // Leer abschicken → zurück zu Schritt 1 mit Hinweis
  await page.click("#dgNext");
  check("Ohne Angaben: zurück zu Schritt 1 mit Fehler", await sichtbar() === "1" && await page.isVisible("#dgErr"));

  // Ohne Konto: Ergebnis hinter Registrierung, Eingaben gesichert
  await page.fill("#dgDesc", "Beim Bremsen quietscht es vorne");
  await page.click("#dgNext"); await page.click("#dgNext"); await page.click("#dgNext");
  check("Ohne Konto: Hinweis zur Registrierung", await page.isHidden("#dgWizard") && (await page.innerText("#dgResult")).includes("kostenlos"));
  check("Eingaben für nach dem Login gesichert", (await page.evaluate(() => sessionStorage.getItem("cfx_dg_pending") || "")).includes("quietscht"));

  await page.click("text=Angaben ändern");
  check("„Angaben ändern“: Schritte wieder da, Text bleibt", await page.isVisible("#dgWizard") && await sichtbar() === "1" && await page.inputValue("#dgDesc") === "Beim Bremsen quietscht es vorne");

  // Angemeldet (nachgestellt): Ursachen als einzelne Karten
  await page.evaluate(() => { me = { id: "u1" }; myWorkshop = null; });
  await page.click("#dgNext");
  await page.click('#dgLights .chip[data-k="oel"]');
  await page.click("#dgNext"); await page.click("#dgNext");
  const karten = await page.locator(".dgCause").count();
  check("Ergebnis: Ursachen als Karten", karten >= 2, String(karten));
  check("Rote Leuchte: Sicherheitshinweis", (await page.innerText("#dgResult")).includes("Sicherheitshinweis"));
  check("Ausschreibung mit den Angaben verlinkt", await page.locator('#dgResult a[href^="#/new-request?"]').count() === 1);
  await shot(page, "diagnose-ergebnis");

  // Website (ohne appui) nutzt dieselben Schritte
  // Gesicherte Eingaben von oben würden direkt Schritt 3 öffnen – hier frisch starten
  await page.evaluate(() => sessionStorage.removeItem("cfx_dg_pending"));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("http://localhost:8000/app.html#/diagnose");
  await page.waitForSelector("#dgWizard");
  check("Website: ebenfalls Schritt für Schritt", await sichtbar() === "1");
  await shot(page, "diagnose-website");

  check("Keine JavaScript-Fehler", errs.length === 0, errs.join(" | "));
  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
