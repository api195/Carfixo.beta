// Carfixo – Online-Zahlung (Stripe Connect) in der App.
// Ersetzt sb.functions.invoke im Browser, läuft daher ohne Backend und ohne Stripe.
// Ausführen:  node tests/zahlung.js  (Server auf :8000 muss laufen)
const { chromium } = require("playwright");
const BASE = process.env.CARFIXO_URL || "http://localhost:8000/app.html";
let pass = 0, fail = 0;
const check = (n, ok, i = "") => { console.log(`${ok ? "OK  " : "FAIL"}  ${n}${i ? "  – " + i : ""}`); ok ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  // Weiterleitung zur Bezahlseite abfangen statt wirklich zu Stripe zu gehen
  await page.route("https://checkout.stripe.test/**", r => r.fulfill({ status: 200, contentType: "text/html", body: "<h1>Stripe-Bezahlseite</h1>" }));

  await page.goto(BASE + "#/search", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  // ---------- Zahlungsbox beim Kunden ----------
  const box = (bk, w, due) => page.evaluate(([bk, w, due]) => {
    const d = document.createElement("div"); d.innerHTML = payBoxHtml(bk, w, due); return d.innerText;
  }, [bk, w, due]);
  const basis = { id: "b1", total_price: 100, status: "ready_for_pickup", payment_status: "none", refunded_amount: 0 };
  let t = await box(basis, { name: "Werkstatt A", online_payment: false }, 100);
  check("Ohne Stripe beim Betrieb: keine Online-Zahlung angeboten", t.trim() === "");
  t = await box(basis, { name: "Werkstatt A", online_payment: true }, 130);
  check("Abholbereit + Stripe: Bezahlknopf mit Gesamtbetrag", /Jetzt online bezahlen/.test(t) && /130\s?€/.test(t), t.replace(/\s+/g, " ").slice(0, 90));
  check("Hinweis auf Zusatzarbeiten im Betrag", /Zusatzarbeiten/.test(t));
  t = await box({ ...basis, status: "in_progress" }, { online_payment: true }, 100);
  check("Vor Fertigmeldung: kein Bezahlknopf, nur Hinweis", !/Jetzt online bezahlen/.test(t) && /abholbereit/.test(t));
  t = await box({ ...basis, payment_status: "payment_paid", paid_amount: 130, paid_at: "2026-10-21T10:00:00Z" }, { online_payment: true }, 130);
  check("Bezahlt: Bestätigung statt Knopf", /Online bezahlt/.test(t) && !/Jetzt online bezahlen/.test(t));
  t = await box({ ...basis, payment_status: "payment_pending" }, { online_payment: true }, 100);
  check("Lastschrift in Bearbeitung: Hinweis", /bearbeitet/.test(t));
  t = await box({ ...basis, payment_status: "payment_failed" }, { online_payment: true }, 100);
  check("Fehlgeschlagen: erneut versuchen möglich", /fehlgeschlagen/.test(t) && /Jetzt online bezahlen/.test(t));
  t = await box({ ...basis, status: "cancelled" }, { online_payment: true }, 100);
  check("Storniert und unbezahlt: nichts anzeigen", t.trim() === "");

  // ---------- Klick auf "Jetzt online bezahlen" ----------
  await page.evaluate(() => {
    window.__calls = [];
    Object.defineProperty(sb, "functions", { configurable: true, value: { invoke: async (name, { body }) => {
      window.__calls.push({ name, body });
      if (body.action === "checkout") return { data: { url: "https://checkout.stripe.test/c/pay_1" }, error: null };
      return { data: {}, error: null };
    } } });
  });
  await page.evaluate(() => {
    document.querySelector("main").innerHTML = `<div id="bx">${payBoxHtml({ id: "b9", total_price: 80, status: "completed", payment_status: "none" }, { name: "W", online_payment: true }, 80)}</div>`;
  });
  await Promise.all([page.waitForURL(/checkout\.stripe\.test/, { timeout: 5000 }).catch(() => {}), page.click("#bx button")]);
  check("Bezahlknopf leitet zur Stripe-Bezahlseite weiter", page.url().includes("checkout.stripe.test"), page.url());

  // ---------- Fehlertext aus der Funktion wird angezeigt ----------
  await page.goto(BASE + "#/search", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const fehler = await page.evaluate(async () => {
    Object.defineProperty(sb, "functions", { configurable: true, value: { invoke: async () => ({ data: null, error: { context: new Response(JSON.stringify({ error: "Diese Werkstatt nimmt keine Online-Zahlung an." }), { status: 409 }) } }) } });
    return (await stripeCall("checkout", { booking_id: "x" })).error;
  });
  check("Deutsche Fehlermeldung der Funktion kommt an", fehler === "Diese Werkstatt nimmt keine Online-Zahlung an.", fehler);
  const netz = await page.evaluate(async () => {
    Object.defineProperty(sb, "functions", { configurable: true, value: { invoke: async () => ({ data: null, error: { context: null } }) } });
    return (await stripeCall("status")).error;
  });
  check("Netzwerkfehler: verständlicher Ersatztext", /Stripe/.test(netz || ""), netz);

  // ---------- Betriebsprofil: Stripe-Karte ----------
  const karte = (antwort) => page.evaluate(async (antwort) => {
    Object.defineProperty(sb, "functions", { configurable: true, value: { invoke: async () => ({ data: antwort, error: null }) } });
    document.querySelector("main").innerHTML = '<div id="payCard"></div>';
    await loadPayCard();
    return { text: document.getElementById("payCard").innerText, knopf: !!document.getElementById("payConnect") };
  }, antwort);
  let k = await karte({ configured: false });
  check("Ohne Stripe-Schlüssel: „Bald verfügbar“, kein Knopf", /Bald verfügbar/.test(k.text) && !k.knopf);
  k = await karte({ configured: true, workshop: true, connected: false, verified: false });
  check("Unverifizierter Betrieb: kein Verbinden möglich", /verifiziert/.test(k.text) && !k.knopf);
  k = await karte({ configured: true, workshop: true, connected: false, verified: true });
  check("Verifizierter Betrieb: „Mit Stripe verbinden“", k.knopf && /Mit Stripe verbinden/.test(k.text));
  check("Hinweis: keine Provision für Carfixo", /keine Provision/.test(k.text));
  k = await karte({ configured: true, workshop: true, connected: true, verified: true, charges_enabled: false, details_submitted: false });
  check("Einrichtung unvollständig: „Einrichtung fortsetzen“", k.knopf && /fortsetzen/.test(k.text));
  k = await karte({ configured: true, workshop: true, connected: true, verified: true, charges_enabled: true, payouts_enabled: true });
  check("Aktiv: Bestätigung, kein Verbinden-Knopf", /Aktiv/.test(k.text) && !k.knopf);
  k = await karte({ configured: true, workshop: false });
  check("Teammitglied: Hinweis auf Inhaber", /Inhaber/.test(k.text));

  // ---------- Buchen ohne Testzahlung ----------
  const ck = await page.evaluate(() => {
    window._offers = [{ id: "o1", total_price: 119, is_fixed_price: true, line_items: [], workshops: { name: "W", online_payment: true } }];
    openCheckout("o1", "r1");
    return document.getElementById("modalHost").innerText;
  });
  check("Buchen: kein „Testmodus“ mehr", !/Testmodus|Testbuchung/.test(ck));
  check("Buchen: Hinweis „bezahlt wird nach der Reparatur“", /nach der Reparatur/.test(ck) && /online/.test(ck));
  await page.evaluate(() => closeModal());

  // ---------- Rückkehr von Stripe ----------
  await page.goto(BASE.replace(/#.*$/, "") + "?zahlung=abbruch#/search", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  check("Abbruch: Hinweis „nichts berechnet“", /nichts berechnet/.test(await page.locator("#toast").innerText()));
  check("Parameter wird aus der Adresse entfernt", !page.url().includes("zahlung="), page.url());
  check("Route bleibt erhalten", page.url().endsWith("#/search"));

  check("Keine JavaScript-Fehler", errs.length === 0, errs.slice(0, 3).join(" | "));
  await browser.close();
  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
})();
