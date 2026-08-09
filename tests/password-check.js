// Carfixo – Prüfung auf geleakte Passwörter (Ersatz für das Supabase-Pro-Feature).
// Simuliert die HaveIBeenPwned-Antwort, laeuft daher ohne Internetzugang.
// Ausfuehren:  node tests/password-check.js  (Server auf :8000 muss laufen)
const { chromium } = require("playwright");
let pass=0, fail=0;
const check=(n,ok,i="")=>{console.log(`${ok?"OK  ":"FAIL"}  ${n}${i?"  – "+i:""}`); ok?pass++:fail++;};
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage();
  await p.goto((process.env.CARFIXO_URL || "http://localhost:8000/app.html") + "#/register", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);

  // HIBP ist aus der Sandbox nicht erreichbar -> Antwort simulieren
  await p.evaluate(() => {
    window.__calls = [];
    const echt = window.fetch;
    window.fetch = async (url, opts) => {
      if (String(url).includes("pwnedpasswords.com")) {
        window.__calls.push({ url: String(url), padding: opts?.headers?.["Add-Padding"] });
        // SHA-1("Passwort123") -> Suffix in die Antwort legen
        const h = window.__hash.slice(5);
        return { ok: true, text: async () => `${h}:12345\r\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:3` };
      }
      return echt(url, opts);
    };
  });

  // Hash des Testpassworts im Seitenkontext berechnen
  await p.evaluate(async () => {
    const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode("Passwort123"));
    window.__hash = [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,"0")).join("").toUpperCase();
  });

  const kurz = await p.evaluate(() => validateNewPassword("abc1"));
  check("Zu kurzes Passwort abgelehnt", /8 Zeichen/.test(kurz||""), kurz);

  const nurBuchst = await p.evaluate(() => validateNewPassword("abcdefghij"));
  check("Ohne Ziffer abgelehnt", /Ziffer/.test(nurBuchst||""), nurBuchst);

  const geleakt = await p.evaluate(() => validateNewPassword("Passwort123"));
  check("Geleaktes Passwort abgelehnt", /Datenlecks/.test(geleakt||""), (geleakt||"").slice(0,60));

  const anzahl = await p.evaluate(() => window.__hash ? null : null);
  const call = await p.evaluate(() => window.__calls[0]);
  check("Nur 5 Hash-Zeichen uebertragen", /range\/[0-9A-F]{5}$/.test(call.url), call.url);
  check("Add-Padding gesetzt", call.padding === "true");

  // Unauffaelliges Passwort: Suffix nicht in der Liste
  await p.evaluate(() => { window.__hash = "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"; });
  const ok = await p.evaluate(() => validateNewPassword("Zufall9Wort77"));
  check("Unauffaelliges Passwort akzeptiert", ok === null, String(ok));

  // Netzwerkfehler darf nicht aussperren
  await p.evaluate(() => { window.fetch = async () => { throw new Error("offline"); }; });
  const offline = await p.evaluate(() => validateNewPassword("Zufall9Wort77"));
  check("Bei API-Ausfall nicht blockiert", offline === null, String(offline));

  await b.close();
  console.log(`\nErgebnis: ${pass}/${pass+fail} bestanden`);
  process.exit(fail?1:0);
})();
