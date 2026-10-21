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
  check("Start: nur „Allgemein“ sichtbar", JSON.stringify(await sichtbar()) === JSON.stringify(["Stammdaten", "Adresse & Standort", "Google-Eintrag"]), JSON.stringify(await sichtbar()));
  const punkte = await page.evaluate(() => [...document.querySelectorAll(".pTabs .pDot")].map(d => d.parentElement.dataset.ptab));
  check("Punkte markieren Lücken (Telefon, Zeiten, Bilder)", JSON.stringify(punkte) === JSON.stringify(["allg", "zeiten", "bilder"]), JSON.stringify(punkte));
  check("Fortschritt wird angezeigt", /Profil zu \d+ % vollständig/.test(await page.locator(".profFort").innerText()));
  await page.click('[data-ptab="leist"]');
  check("Reiter „Leistungen“ zeigt Kategorien, Leistungen, Marken", (await sichtbar()).length === 3);
  await page.click('[data-ptab="zahl"]');
  check("Reiter „Zahlungen“ zeigt Stripe und Premium", (await sichtbar()).includes("Online-Zahlungen"));
  check("Bei Zahlungen keine Speichern-Leiste", await page.evaluate(() => $("pSaveBar").hidden));
  check("Alle Eingabefelder bleiben im DOM (Speichern nimmt alles mit)", await page.evaluate(() => !!$("pName") && !!$("pStreet") && !!$("pNextFree")));

  // ---------- Google-Eintrag verknüpfen ----------
  check("Reiter „Allgemein“ enthält Google-Eintrag", await page.evaluate(() => { zeigeProfTab("allg"); return !!$("pGoogle") && !$("pGoogle").closest(".pCard").hidden; }));
  check("Suchfeld mit Name und Ort vorbelegt", await page.inputValue("#gSuche") === "Testwerkstatt");
  await page.evaluate(() => {
    window.__fetch = window.fetch;
    window.fetch = async (u) => u.startsWith("/api/google-place?suche=")
      ? new Response(JSON.stringify({ treffer: [{ id: "ChIJtreffer000001", name: "Testwerkstatt GmbH", adresse: "Köln", sterne: 4.6, anzahl: 230 }] }))
      : window.__fetch(u);
    window.__update = null;
    sb.from = () => ({ update: (o) => { window.__update = o; return { eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: { ...myWorkshop, ...o, google_place_confirmed: false }, error: null }) }) }) }; } });
  });
  await page.click("#gGo");
  await page.waitForTimeout(300);
  check("Treffer werden angezeigt", (await page.locator(".gTreffer").innerText()).includes("Testwerkstatt GmbH"));
  await page.click(".gTreffer [data-place]");
  await page.waitForTimeout(300);
  check("Auswahl speichert die Place-ID", await page.evaluate(() => window.__update?.google_place_id) === "ChIJtreffer000001");
  check("Hinweis: wartet auf Bestätigung", (await page.locator("#pGoogle").innerText()).includes("prüft noch"));

  // ---------- Fehler führt zum richtigen Reiter ----------
  await page.click('[data-ptab="allg"]');
  await page.evaluate(() => { profCats.length = 0; $("pSave").click(); });
  await page.waitForTimeout(200);
  check("Fehlende Kategorie öffnet „Leistungen“", await page.evaluate(() => profTab) === "leist");
  check("Fehlermeldung sichtbar", (await page.locator("#pErr").innerText()).includes("Kategorie"));

  // ---------- Google-Sterne und -Fotos im öffentlichen Profil ----------
  const g = await page.evaluate(async () => {
    main.innerHTML = '<div id="gStars"></div><div id="gBox" hidden></div>';
    window.fetch = async () => new Response(JSON.stringify({ sterne: 4.6, anzahl: 1234, link: "https://maps.google.com/?cid=1",
      fotos: [{ name: "places/ChIJx/photos/a", autoren: [{ name: "Max" }] }, { name: "places/ChIJx/photos/b", autoren: [] }] }));
    await ladeGoogle({ google_place_id: "ChIJx", google_place_confirmed: false });
    const vorher = $("gStars").innerHTML;
    await ladeGoogle({ google_place_id: "ChIJx", google_place_confirmed: true });
    return { vorher, sterne: $("gStars").textContent.replace(/\s+/g, " "), fotos: $("gBox").querySelectorAll("img").length, sichtbar: !$("gBox").hidden, text: $("gBox").innerText,
      src: $("gBox").querySelector("img").getAttribute("src") };
  });
  check("Unbestätigt: nichts von Google", g.vorher === "");
  check("Google-Sterne klar gekennzeichnet", /4,6.*bei Google.*1\.234 Bewertungen/.test(g.sterne), g.sterne);
  check("Fotos werden angezeigt", g.sichtbar && g.fotos === 2);
  check("Fotos über eigenen Server (keine IP an Google)", g.src.startsWith("/api/google-place?foto="));
  check("Urheber genannt", g.text.includes("Max"));

  // ---------- Platzhalter-Logos ----------
  const farben = await page.evaluate(() => [avStil("Autohaus Müller"), avStil("Reifen Schmidt"), avStil("Autohaus Müller")]);
  check("Platzhalter: verschiedene Betriebe, verschiedene Farben", farben[0] !== farben[1]);
  check("Platzhalter: gleicher Name, gleiche Farbe", farben[0] === farben[2]);

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
