// ============================================================
// Carfixo – Smoke-Test (Routing, Auth-Ansichten, Handler-Escaping)
//
// Ausführen:
//   python3 -m http.server 8000          # in einem zweiten Terminal
//   npm i playwright && node tests/smoke.js
//
// Prüft bewusst nur das, was ohne Backend funktioniert: Routing,
// Rendering und Escaping. Datengetriebene Inhalte (Werkstattliste,
// Login) brauchen eine erreichbare Supabase-Instanz.
// ============================================================
const { chromium } = require("playwright");
const BASE = process.env.CARFIXO_URL || "http://localhost:8000/app.html";

const results = [];
function check(name, ok, info = "") {
  results.push({ name, ok, info });
  console.log(`${ok ? "OK  " : "FAIL"}  ${name}${info ? "  – " + info : ""}`);
}

(async () => {
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  // Wichtig: page.goto auf dieselbe Basis-URL mit nur anderem Fragment loest
  // KEINEN Dokument-Reload aus – der Startup-Code liefe dann nicht erneut.
  // Deshalb immer ueber about:blank gehen, wenn ein echter Load noetig ist.
  const goto = async (hash) => {
    await page.goto("about:blank");
    await page.goto(BASE + hash, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
  };

  // 1) App startet und rendert die Suche
  await goto("#/search");
  check("App startet, Suche rendert",
    (await page.locator("h1").first().innerText()).includes("Werkstatt-Suche"));

  // Hinweis: Supabase ist aus dieser Sandbox nicht erreichbar (Proxy),
  // datengetriebene Inhalte koennen hier nicht geprueft werden.

  // 2) Login zeigt den neuen "Passwort vergessen?"-Link
  await goto("#/login");
  const forgotLink = page.locator('a[href="#/forgot"]');
  check("Login: 'Passwort vergessen?'-Link vorhanden", await forgotLink.count() === 1);

  // 3) Link führt zur Forgot-Ansicht
  await forgotLink.click();
  await page.waitForTimeout(600);
  check("Forgot-Ansicht erreichbar",
    (await page.locator("h1").first().innerText()).includes("Passwort zurücksetzen"));

  // 4) Leere Eingabe wird abgefangen
  await page.click("#fpGo");
  await page.waitForTimeout(400);
  check("Forgot: leere E-Mail wird abgefangen",
    (await page.locator("#fpErr").innerText()).includes("E-Mail"));

  // 5) reset-password ohne Session -> "Link abgelaufen" statt Absturz
  await goto("#/reset-password");
  check("Reset ohne Session zeigt 'Link abgelaufen'",
    (await page.locator("h1").first().innerText()).includes("Link abgelaufen"));

  // 6) Ungültiger Recovery-Hash landet nicht in einer kaputten Route
  await goto("#error=access_denied&error_description=Email+link+is+invalid+or+has+expired");
  check("Abgelaufener Link -> #/forgot", page.url().includes("#/forgot"), page.url().split("app.html")[1]);

  // 7) Recovery-Hash wird als Route erkannt und Token aus der URL entfernt
  await goto("#access_token=dummy&refresh_token=dummy&expires_in=3600&type=recovery");
  const u = page.url();
  check("Recovery-Hash -> #/reset-password", u.includes("#/reset-password"), u.split("app.html")[1]);
  check("Token nicht mehr in der URL", !u.includes("access_token"));

  // 8) Weitere Kernrouten rendern ohne Absturz
  for (const [hash, expect] of [["#/teile", "Teile-Marktplatz"], ["#/diagnose", "KI-Diagnose"], ["#/notfall", "Notfallmodus"]]) {
    await goto(hash);
    check(`Route ${hash} rendert`,
      (await page.locator("h1").first().innerText()).includes(expect));
  }

  // 9) jsArg im echten Browser: Handler mit Apostroph/Quote im Namen muss
  //    aufrufbar bleiben und den Wert unveraendert durchreichen.
  await goto("#/search");
  const jsArgOk = await page.evaluate(() => {
    const namen = ["O'Reilly KFZ", 'Auto "Pro" GmbH', "');alert(1);//", "Müller & Söhne"];
    window.__got = [];
    window.__probe = (v) => window.__got.push(v);
    const host = document.createElement("div");
    host.innerHTML = namen.map(n => `<button onclick="__probe(${jsArg(n)})"></button>`).join("");
    document.body.appendChild(host);
    host.querySelectorAll("button").forEach(b => b.click());
    host.remove();
    return JSON.stringify(window.__got) === JSON.stringify(namen);
  });
  check("jsArg: Handler mit Apostroph/Quotes/Injection intakt", jsArgOk);

  // Gegenprobe: die alte Variante (esc in JS-String) waere zerbrochen
  const altBrach = await page.evaluate(() => {
    const host = document.createElement("div");
    window.__old = 0;
    window.__probe2 = () => window.__old++;
    host.innerHTML = `<button onclick="__probe2('${esc("O'Reilly KFZ")}')"></button>`;
    document.body.appendChild(host);
    try { host.querySelector("button").click(); } catch (e) { /* Syntaxfehler */ }
    host.remove();
    return window.__old === 0; // Handler kam nicht durch
  });
  check("Gegenprobe: alte esc()-Variante war tatsaechlich defekt", altBrach);

  console.log("\n--- JS-Fehler auf allen Seiten ---");
  const real = errors.filter(e =>
    !/favicon|manifest|net::ERR_/i.test(e) &&
    // Der Syntaxfehler stammt aus der Gegenprobe oben und ist beabsichtigt:
    // er belegt, dass die alte esc()-Variante den Handler zerbrochen hat.
    !/missing \) after argument list/i.test(e) &&
    // Ohne erreichbares Supabase schlagen die Datenabrufe fehl – hier erwartet.
    !/Failed to load resource/i.test(e));
  if (real.length === 0) console.log("keine");
  else real.slice(0, 12).forEach(e => console.log("  " + e.slice(0, 220)));
  check("Keine unerwarteten JS-Fehler", real.length === 0, real.length ? real.length + " Fehler" : "");

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\nErgebnis: ${results.length - failed.length}/${results.length} bestanden`);
  process.exit(failed.length ? 1 : 0);
})();
