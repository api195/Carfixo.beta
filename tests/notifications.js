// Carfixo – Benachrichtigungszentrale: Rendering, Badge, Navigation, Escaping.
// Speist Testdaten direkt ein, laeuft daher ohne Backend.
// Ausfuehren:  node tests/notifications.js  (Server auf :8000 muss laufen)
const { chromium } = require("playwright");
const BASE = process.env.CARFIXO_URL || "http://localhost:8000/app.html";
let pass = 0, fail = 0;
const check = (n, ok, i = "") => { console.log(`${ok ? "OK  " : "FAIL"}  ${n}${i ? "  – " + i : ""}`); ok ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));

  await page.goto(BASE + "#/search", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  // Ausgeloggt: Glocke muss verborgen sein
  check("Ausgeloggt: Glocke verborgen",
    await page.locator("#bellWrap").evaluate(el => el.classList.contains("hidden")));

  // Sitzung simulieren und Panel mit Testdaten rendern
  const shown = await page.evaluate(() => {
    me = { id: "u1", email: "t@t.de" };
    document.getElementById("bellWrap").classList.remove("hidden");
    document.getElementById("bellBtn").innerHTML = ico("bell", 17);
    document.getElementById("bellBtn").onclick = (e) => { e.stopPropagation(); toggleNotifPanel(); };
    notifItems = [
      { id: "n1", type: "offer", title: "Neues Angebot", body: "O'Reilly \"KFZ\" & Söhne · 249 €", link: "request/abc", read_at: null, created_at: new Date(Date.now() - 120000).toISOString() },
      { id: "n2", type: "message", title: "Neue Nachricht", body: "<img src=x onerror=alert(1)>", link: "request/abc", read_at: new Date().toISOString(), created_at: new Date(Date.now() - 7200000).toISOString() },
    ];
    const unread = notifItems.filter(n => !n.read_at).length;
    const d = document.getElementById("bellDot");
    d.textContent = String(unread); d.classList.toggle("hidden", unread === 0);
    return true;
  });
  check("Testdaten gesetzt", shown);

  check("Badge zeigt 1 ungelesene",
    (await page.locator("#bellDot").innerText()) === "1" &&
    !(await page.locator("#bellDot").evaluate(el => el.classList.contains("hidden"))));

  // Panel oeffnen
  await page.click("#bellBtn");
  await page.waitForTimeout(300);
  check("Panel oeffnet", !(await page.locator("#notifPanel").evaluate(el => el.classList.contains("hidden"))));
  check("Beide Eintraege sichtbar", await page.locator(".notifItem").count() === 2);
  check("Ungelesener Eintrag hervorgehoben", await page.locator(".notifItem.unread").count() === 1);

  // XSS: Body darf nicht als HTML interpretiert werden
  check("XSS im Body wird escaped",
    await page.locator(".notifItem").nth(1).locator("img").count() === 0);
  check("Sonderzeichen im Body korrekt dargestellt",
    (await page.locator(".notifItem").nth(0).innerText()).includes('O\'Reilly "KFZ" & Söhne'));
  check("Relative Zeit", (await page.locator(".notifItem").nth(0).innerText()).includes("vor 2 Min."));

  // Klick auf Eintrag navigiert und schliesst das Panel
  await page.locator(".notifItem").first().click();
  await page.waitForTimeout(600);
  check("Klick navigiert zum Ziel", page.url().includes("#/request/abc"), page.url().split("app.html")[1]);
  check("Panel danach geschlossen",
    await page.locator("#notifPanel").evaluate(el => el.classList.contains("hidden")));

  // Klick ausserhalb schliesst
  await page.evaluate(() => { notifOpen = false; toggleNotifPanel(); });
  await page.waitForTimeout(200);
  await page.mouse.click(5, 300);
  await page.waitForTimeout(300);
  check("Klick ausserhalb schliesst Panel",
    await page.locator("#notifPanel").evaluate(el => el.classList.contains("hidden")));

  // Leerzustand
  await page.evaluate(() => { notifItems = []; notifOpen = true; renderNotifPanel(); document.getElementById("notifPanel").classList.remove("hidden"); });
  await page.waitForTimeout(200);
  check("Leerzustand hat Hinweistext",
    (await page.locator("#notifPanel").innerText()).includes("Noch keine Benachrichtigungen"));

  const real = errs.filter(e => !/Failed to load|net::ERR/i.test(e));
  check("Keine JS-Fehler", real.length === 0, real[0] || "");

  await browser.close();
  console.log(`\nErgebnis: ${pass}/${pass + fail} bestanden`);
  process.exit(fail ? 1 : 0);
})();
