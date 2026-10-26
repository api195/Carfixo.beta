// ============================================================
// Carfixo App – SPA (Kunde + Werkstatt)
// ============================================================
"use strict";

const sb = window.supabase.createClient(CARFIXO.SUPABASE_URL, CARFIXO.SUPABASE_KEY);
let me = null, myProfile = null, myWorkshop = null;
let rtChannels = [];

const $ = (id) => document.getElementById(id);
const main = $("main");

// ---------- iPhone-App (Capacitor) ----------
// In der App liegen die Seiten im App-Paket (capacitor://localhost). Alles,
// was auf unseren Server zeigt – /api, Links in E-Mails, Rücksprung von
// Stripe –, braucht dort die volle Adresse. Im Browser bleibt alles relativ.
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const SITE = "https://carfixo.de";
const API = NATIVE ? SITE : "";
const appAdresse = () => NATIVE ? SITE + "/app.html" : location.origin + location.pathname;
// Fremde Seiten (Stripe, Google Maps, PDFs) öffnet die App in einem Safari-
// Fenster über der App, statt die App selbst wegzunavigieren.
// Eigene Oberfläche für die App (Startseite, schwebende Tab-Leiste, randlos).
// Im Browser zur Vorschau mit app.html?appui=1 – die Website bleibt wie sie ist.
const APP_UI = NATIVE || /[?&]appui=1\b/.test(location.search);
if (APP_UI) document.documentElement.classList.add("appui");
function oeffneExtern(url) {
  if (NATIVE && window.capacitorBrowser) return window.capacitorBrowser.Browser.open({ url });
  location.href = url;
}

// ---------- UI-Helfer ----------
let toastTimer = null;
function toast(msg) {
  if (/✓/.test(msg)) haptic("success");
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}
function showErr(el, msg) { haptic("error"); if (el) { el.textContent = msg; el.style.display = "block"; } else toast(msg); }
function openModal(html) {
  $("modalHost").innerHTML = `<div class="modal" onclick="if(event.target===this)closeModal()"><div class="modalBox">${html}</div></div>`;
}
function closeModal() { $("modalHost").innerHTML = ""; }
// Eigener Bestätigungsdialog statt window.confirm: passt zum Design, sieht in der
// installierten App nicht nach Systemfenster aus und liegt über einem offenen Modal.
function frage(text, { titel = "Bist du sicher?", ja = "Bestätigen", nein = "Abbrechen", gefahr = false } = {}) {
  return new Promise((resolve) => {
    const dlg = document.createElement("div");
    dlg.className = "modal dlg";
    dlg.setAttribute("role", "alertdialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.innerHTML = `<div class="modalBox dlgBox">
      <h2>${esc(titel)}</h2>
      <p class="mm">${esc(text)}</p>
      <div class="btnRow"><button class="btn ${gefahr ? "red" : "green"}" data-a="1">${esc(ja)}</button>
      <button class="btn ghost" data-a="0">${esc(nein)}</button></div></div>`;
    const taste = (e) => { if (e.key === "Escape") fertig(false); };
    const fertig = (v) => { dlg.remove(); document.removeEventListener("keydown", taste); resolve(v); };
    dlg.onclick = (e) => {
      if (e.target === dlg) return fertig(false);
      const b = e.target.closest("[data-a]");
      if (b) fertig(b.dataset.a === "1");
    };
    document.addEventListener("keydown", taste);
    document.body.appendChild(dlg);
    dlg.querySelector('[data-a="1"]').focus();
  });
}
function cleanRT() { rtChannels.forEach(c => { try { sb.removeChannel(c); } catch (e) {} }); rtChannels = []; }
// Platzhalter-Logo: Jede Werkstatt bekommt aus ihrem Namen eine eigene Farbe,
// damit Listen ohne hochgeladene Logos nicht einförmig aussehen.
function avStil(name) {
  let h = 0;
  for (const c of String(name || "?")) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `background:linear-gradient(135deg,hsl(${h} 75% 50% / .55),hsl(${(h + 50) % 360} 80% 45% / .18));color:hsl(${h} 95% 84%);`;
}
function initials(s) { return (s || "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join(""); }
function opt(ph, list, sel) {
  return `<option value="">${esc(ph)}</option>` + list.map(x =>
    `<option value="${esc(x)}" ${String(x) === String(sel ?? "") ? "selected" : ""}>${esc(x)}</option>`).join("");
}
function priceLevelTxt(n) { return n ? "€".repeat(n) : ""; }

// ============================================================
// Router
// ============================================================
const routes = {
  "login": vLogin, "register": vRegister,
  "forgot": vForgot, "reset-password": vResetPassword,
  "search": vSearch, "workshop": vWorkshopProfile, "new-request": vNewRequest,
  "diagnose": vDiagnose, "notfall": vNotfall, "vergleich": vCompare,
  "requests": vRequests, "request": vRequestDetail, "teile": vPartsMarket,
  "vehicles": vVehicles, "vehicle": vVehicleRecord, "reminders": vReminders, "account": vAccount,
  "ws/dashboard": vWsDashboard, "ws/leads": vWsLeads, "ws/lead": vWsLead,
  "ws/jobs": vWsJobs, "ws/calendar": vWsCalendar, "ws/profile": vWsProfile,
  "ws/parts": vWsParts, "ws/stats": vWsStats, "ws/archive": vWsArchive,
  "kuendigen": vKuendigen, "widerrufen": vWiderrufen, "home": vHome,
};
const CUSTOMER_NAV = [["search", "search", "Suche"], ["diagnose", "robot", "Diagnose"], ["teile", "puzzle", "Teile"], ["requests", "megaphone", "Aufträge"], ["vehicles", "car", "Fahrzeuge"]];
const WS_NAV = [["ws/dashboard", "gauge", "Dashboard"], ["ws/leads", "megaphone", "Anfragen"], ["ws/jobs", "box", "Aufträge"], ["ws/parts", "puzzle", "Teile"], ["ws/calendar", "calendar", "Kalender"], ["ws/profile", "shop", "Profil"]];
const ANON_NAV = [["search", "search", "Suche"], ["diagnose", "robot", "Diagnose"], ["teile", "puzzle", "Teile"], ["notfall", "alert", "Notfall"]];
// App: Home vorne, höchstens fünf Tabs (mit Login/Konto). Notfall, Aufträge
// und Fahrzeuge sind über die Startseite erreichbar.
const APP_NAV = [["home", "home", "Home"], ["search", "search", "Suche"], ["diagnose", "robot", "Diagnose"], ["teile", "puzzle", "Teile"]];

function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [pathPart, queryPart] = h.split("?");
  const segs = pathPart.split("/").filter(Boolean);
  const query = {};
  // decodeURIComponent wirft bei kaputten %-Folgen ("?q=50%"). Ungefangen
  // bliebe die App dann dauerhaft auf "Lade Carfixo…" stehen.
  const dec = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };
  (queryPart || "").split("&").forEach(kv => { const [k, v] = kv.split("="); if (k) query[k] = dec(v || ""); });
  let name = segs[0] || "", param = segs[1] || null;
  if (name === "ws" && segs[1]) { name = "ws/" + segs[1]; param = segs[2] || null; }
  return { name, param, query };
}
function go(path) { location.hash = "#/" + path; }

// ============================================================
// KÜNDIGUNG (§ 312k BGB)
// Die Schaltfläche "Verträge hier kündigen" muss ständig verfügbar und
// leicht erreichbar sein – also ohne Anmeldung. Wer eingeloggt ist, bekommt
// Name und E-Mail vorausgefüllt. Angenommen wird über submit_cancellation()
// (prüft, bremst Missbrauch, liefert den Zugangszeitpunkt). Die Bestätigung
// in Textform verschickt notify-dispatch an die angegebene Adresse.
// ============================================================
const KUENDIGUNG_VERTRAG = {
  kundenkonto: "Nutzungsvertrag (Kundenkonto)",
  betriebskonto: "Plattformvertrag (Betriebskonto)",
  premium_kunde: "Premium für Kunden",
  premium_betrieb: "Premium für Betriebe",
};
const KUENDIGUNG_KONTAKT = "info@carfixo.de";

function vKuendigen() {
  const istBetrieb = myProfile?.role === "workshop_owner" || myProfile?.role === "workshop_staff";
  const vorwahl = istBetrieb ? "betriebskonto" : "kundenkonto";
  main.innerHTML = `
  <div class="pageHead"><div><h1>Verträge hier kündigen</h1>
    <div class="sub">Hier kannst du jeden Vertrag mit Carfixo kündigen – ohne Anmeldung. Du bekommst sofort eine Bestätigung.</div></div></div>
  <div class="card" style="max-width:640px">
    <div class="label">Dein Name</div>
    <input id="kdName" autocomplete="name" value="${esc(myProfile?.full_name || "")}" aria-label="Dein Name">
    <div class="label">E-Mail-Adresse deines Kontos</div>
    <input id="kdMail" type="email" autocomplete="email" value="${esc(me?.email || "")}" aria-label="E-Mail-Adresse">
    <p class="mm" style="font-size:12px;margin-top:4px">An diese Adresse schicken wir die Bestätigung. Daran erkennen wir auch, welches Konto gemeint ist.</p>

    <div class="label">Welchen Vertrag kündigst du?</div>
    <select id="kdVertrag" aria-label="Vertrag">
      ${Object.entries(KUENDIGUNG_VERTRAG).map(([k, v]) => `<option value="${k}" ${k === vorwahl ? "selected" : ""}>${v}</option>`).join("")}
    </select>
    <div class="label">Angabe zum Vertrag <span class="mm" style="font-weight:400">(optional)</span></div>
    <input id="kdRef" placeholder="z. B. Name deines Betriebs" aria-label="Angabe zum Vertrag" value="${esc(istBetrieb ? (myWorkshop?.name || "") : "")}">

    <div class="label">Art der Kündigung</div>
    <label class="inline"><input type="radio" name="kdArt" value="ordentlich" checked> Ordentliche Kündigung</label>
    <label class="inline"><input type="radio" name="kdArt" value="ausserordentlich"> Außerordentliche (fristlose) Kündigung</label>
    <div id="kdGrundBox" class="hidden">
      <div class="label">Grund der außerordentlichen Kündigung</div>
      <textarea id="kdGrund" rows="3" aria-label="Kündigungsgrund" maxlength="2000"></textarea>
    </div>

    <div class="label">Zu wann soll der Vertrag enden?</div>
    <label class="inline"><input type="radio" name="kdWann" value="naechstmoeglich" checked> Zum nächstmöglichen Zeitpunkt</label>
    <label class="inline"><input type="radio" name="kdWann" value="datum"> Zu einem bestimmten Datum</label>
    <input id="kdDatum" type="date" class="hidden" aria-label="Gewünschtes Enddatum" min="${new Date().toISOString().slice(0, 10)}">

    <div class="err" id="kdErr"></div>
    <button class="btn wide" style="margin-top:18px" id="kdGo">Jetzt kündigen</button>
    <p class="mm" style="font-size:11.5px;margin-top:10px">Mit „Jetzt kündigen“ erklärst du die Kündigung verbindlich.
      Kostenlose Leistungen enden mit der Bearbeitung, spätestens nach zwei Werktagen.</p>
  </div>`;

  const art = () => document.querySelector('input[name="kdArt"]:checked').value;
  const wann = () => document.querySelector('input[name="kdWann"]:checked').value;
  document.querySelectorAll('input[name="kdArt"]').forEach(r => r.onchange = () => $("kdGrundBox").classList.toggle("hidden", art() !== "ausserordentlich"));
  document.querySelectorAll('input[name="kdWann"]').forEach(r => r.onchange = () => $("kdDatum").classList.toggle("hidden", wann() !== "datum"));

  $("kdGo").onclick = async () => {
    const err = $("kdErr"); err.style.display = "none";
    const name = $("kdName").value.trim(), mail = $("kdMail").value.trim();
    if (name.length < 2) return showErr(err, "Bitte gib deinen Namen an.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return showErr(err, "Bitte gib eine gültige E-Mail-Adresse an.");
    if (art() === "ausserordentlich" && !$("kdGrund").value.trim()) return showErr(err, "Bitte nenne den Grund der außerordentlichen Kündigung.");
    if (wann() === "datum" && !$("kdDatum").value) return showErr(err, "Bitte wähle das gewünschte Enddatum.");

    const eingabe = {
      p_full_name: name, p_email: mail, p_contract: $("kdVertrag").value, p_contract_ref: $("kdRef").value.trim() || null,
      p_kind: art(), p_reason: art() === "ausserordentlich" ? $("kdGrund").value.trim() : null,
      p_effective: wann(), p_effective_date: wann() === "datum" ? $("kdDatum").value : null,
    };
    $("kdGo").disabled = true; $("kdGo").textContent = "Wird übermittelt…";
    const { data, error } = await sb.rpc("submit_cancellation", eingabe);
    $("kdGo").disabled = false; $("kdGo").textContent = "Jetzt kündigen";
    if (error) {
      // Fehlt die Funktion (Migration noch nicht eingespielt) oder ist das
      // Netz weg, darf die Kündigung nicht einfach verloren gehen.
      const technisch = /function|schema cache|fetch|network|load failed/i.test(error.message || "");
      return showErr(err, technisch
        ? `Die Kündigung konnte gerade nicht übermittelt werden. Bitte versuche es gleich noch einmal oder kündige per E-Mail an ${KUENDIGUNG_KONTAKT}.`
        : error.message);
    }
    kuendigungBestaetigt({ ...eingabe, id: data.id, received_at: data.received_at });
  };
}

// Bestätigungsseite: § 312k Abs. 3 verlangt, dass man die Erklärung mit Datum
// und Uhrzeit dauerhaft speichern kann – daher Herunterladen und Drucken.
function kuendigungBestaetigt(k) {
  const zugang = new Date(k.received_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "long", timeStyle: "medium" });
  const ende = k.p_effective === "datum"
    ? `zum ${new Date(k.p_effective_date + "T12:00:00").toLocaleDateString("de-DE", { dateStyle: "long" })} – frühestens zum nächstmöglichen Zeitpunkt`
    : "zum nächstmöglichen Zeitpunkt";
  const zeilen = [
    ["Name", k.p_full_name], ["E-Mail", k.p_email],
    ["Vertrag", KUENDIGUNG_VERTRAG[k.p_contract]],
    ...(k.p_contract_ref ? [["Angabe zum Vertrag", k.p_contract_ref]] : []),
    ["Art der Kündigung", k.p_kind === "ausserordentlich" ? "außerordentlich (fristlos)" : "ordentlich"],
    ...(k.p_reason ? [["Kündigungsgrund", k.p_reason]] : []),
    ["Beendigung", ende], ["Eingegangen am", zugang + " Uhr"], ["Vorgangsnummer", k.id],
  ];
  main.innerHTML = `
  <div class="pageHead"><div><h1>Deine Kündigung ist eingegangen</h1>
    <div class="sub">Eine Bestätigung haben wir gerade an <b>${esc(k.p_email)}</b> geschickt.</div></div></div>
  <div class="card" style="max-width:640px" id="kdBeleg">
    ${zeilen.map(([a, b]) => `<div class="offerLine"><span>${esc(a)}</span><span style="text-align:right">${esc(b)}</span></div>`).join("")}
    <p class="mm" style="font-size:12px;margin-top:12px">Erklärt durch Betätigen der Schaltfläche „Jetzt kündigen“ auf carfixo.de.</p>
    <div class="btnRow" style="margin-top:14px">
      <button class="btn ghost sm" id="kdSave">Bestätigung speichern</button>
      <button class="btn ghost sm" onclick="window.print()">Drucken</button>
    </div>
  </div>
  <p class="mm" style="margin-top:12px;font-size:12px">Keine E-Mail bekommen? Sieh im Spam-Ordner nach oder schreib uns an ${KUENDIGUNG_KONTAKT} – nenne dabei die Vorgangsnummer.</p>`;
  $("kdSave").onclick = () => {
    const text = "Carfixo – Eingangsbestätigung Kündigung\n\n"
      + zeilen.map(([a, b]) => `${a}: ${b}`).join("\n")
      + "\n\nErklärt durch Betätigen der Schaltfläche „Jetzt kündigen“ auf carfixo.de.\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    a.download = `carfixo-kuendigung-${String(k.id).slice(0, 8)}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
  };
}

// ============================================================
// WIDERRUF (Widerrufsbutton, Pflicht seit 19.06.2026)
// Zwei Schritte wie vorgeschrieben: "Vertrag widerrufen" (Fußzeile, Buchung)
// führt hierher, die Erklärung gilt erst mit "Widerruf bestätigen".
// Vertragspartner ist der Betrieb – Carfixo nimmt die Erklärung an, leitet
// sie weiter und bestätigt den Eingang (submit_withdrawal, notify-dispatch).
// ============================================================
const WIDERRUF_TAGE = 14;
function vWiderrufen(bookingNo) {
  main.innerHTML = `
  <div class="pageHead"><div><h1>Vertrag widerrufen</h1>
    <div class="sub">Hier widerrufst du einen Auftrag, den du über Carfixo bei einem Betrieb gebucht hast. Du bekommst sofort eine Eingangsbestätigung.</div></div></div>
  <div class="card" style="max-width:640px">
    <div class="label">Dein Name</div>
    <input id="wdName" autocomplete="name" value="${esc(myProfile?.full_name || "")}" aria-label="Dein Name">
    <div class="label">E-Mail-Adresse deines Kontos</div>
    <input id="wdMail" type="email" autocomplete="email" value="${esc(me?.email || "")}" aria-label="E-Mail-Adresse">
    <div class="label">Auftragsnummer</div>
    <input id="wdNr" placeholder="z. B. CFX-1004" value="${esc(bookingNo || "")}" autocapitalize="characters" aria-label="Auftragsnummer">
    <p class="mm" style="font-size:12px;margin-top:4px">Steht in deiner Buchung unter „Aufträge“ und in der Buchungsbestätigung.</p>
    <div class="label">Nachricht an den Betrieb <span class="mm" style="font-weight:400">(optional)</span></div>
    <textarea id="wdNote" rows="3" maxlength="2000" aria-label="Nachricht an den Betrieb"></textarea>
    <div class="err" id="wdErr"></div>
    <button class="btn wide" style="margin-top:18px" id="wdGo">Widerruf bestätigen</button>
    <p class="mm" style="font-size:11.5px;margin-top:10px">Mit „Widerruf bestätigen“ erklärst du den Widerruf des Vertrags mit dem Betrieb.
      Ob er wirksam ist – etwa wenn die Arbeit auf deinen Wunsch schon vor Ablauf der Frist begonnen hat –, klärt der Betrieb mit dir.</p>
  </div>`;
  $("wdGo").onclick = async () => {
    const err = $("wdErr"); err.style.display = "none";
    const eingabe = {
      p_full_name: $("wdName").value.trim(), p_email: $("wdMail").value.trim(),
      p_booking_no: $("wdNr").value.trim(), p_note: $("wdNote").value.trim() || null,
    };
    if (eingabe.p_full_name.length < 2) return showErr(err, "Bitte gib deinen Namen an.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(eingabe.p_email)) return showErr(err, "Bitte gib eine gültige E-Mail-Adresse an.");
    if (eingabe.p_booking_no.length < 3) return showErr(err, "Bitte gib die Auftragsnummer an.");
    $("wdGo").disabled = true; $("wdGo").textContent = "Wird übermittelt…";
    const { data, error } = await sb.rpc("submit_withdrawal", eingabe);
    $("wdGo").disabled = false; $("wdGo").textContent = "Widerruf bestätigen";
    if (error) {
      const technisch = /function|schema cache|fetch|network|load failed/i.test(error.message || "");
      return showErr(err, technisch
        ? `Der Widerruf konnte gerade nicht übermittelt werden. Bitte versuche es gleich noch einmal oder schreib an ${KUENDIGUNG_KONTAKT}.`
        : error.message);
    }
    widerrufBestaetigt({ ...eingabe, ...data });
  };
}
function widerrufBestaetigt(w) {
  const zugang = new Date(w.received_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "long", timeStyle: "medium" });
  const zeilen = [
    ["Name", w.p_full_name], ["E-Mail", w.p_email], ["Auftrag", w.p_booking_no.toUpperCase()],
    ...(w.betrieb ? [["Vertragspartner", w.betrieb]] : []),
    ...(w.p_note ? [["Nachricht", w.p_note]] : []),
    ["Eingegangen am", zugang + " Uhr"], ["Vorgangsnummer", w.id],
  ];
  main.innerHTML = `
  <div class="pageHead"><div><h1>Dein Widerruf ist eingegangen</h1>
    <div class="sub">Eine Bestätigung haben wir gerade an <b>${esc(w.p_email)}</b> geschickt.</div></div></div>
  <div class="card" style="max-width:640px">
    ${zeilen.map(([a, b]) => `<div class="offerLine"><span>${esc(a)}</span><span style="text-align:right">${esc(b)}</span></div>`).join("")}
    <p class="mm" style="font-size:12.5px;margin-top:12px">${w.zugeordnet
      ? `Wir haben den Widerruf an ${esc(w.betrieb || "den Betrieb")} weitergeleitet. Der Betrieb meldet sich zur Rückabwicklung, z. B. zur Erstattung bereits gezahlter Beträge.`
      : "Wir konnten den Auftrag nicht sofort zuordnen und melden uns bei dir."}</p>
    <div class="btnRow" style="margin-top:14px">
      <button class="btn ghost sm" id="wdSave">Bestätigung speichern</button>
      <button class="btn ghost sm" onclick="window.print()">Drucken</button>
    </div>
  </div>`;
  $("wdSave").onclick = () => {
    const text = "Carfixo – Eingangsbestätigung Widerruf\n\n" + zeilen.map(([a, b]) => `${a}: ${b}`).join("\n")
      + "\n\nErklärt durch Betätigen der Schaltfläche „Widerruf bestätigen“ auf carfixo.de.\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    a.download = `carfixo-widerruf-${String(w.id).slice(0, 8)}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
  };
}

// Unbekannte Adresse: sagen, was passiert ist, statt still auf die Suche
// umzuleiten – sonst hält man einen veralteten oder vertippten Link für
// einen Fehler der Suche.
function vNotFound() {
  main.innerHTML = `<div class="empty" style="padding:48px 20px">
    <div class="e">${ico("search", 40)}</div>
    <b style="font-size:18px">Diese Seite gibt es nicht</b>
    <p class="mm" style="margin-top:8px">Vielleicht ist der Link veraltet oder vertippt.</p>
    <div class="btnRow" style="justify-content:center;margin-top:16px">
      <a class="btn" href="#/search">Zur Werkstatt-Suche</a>
      <a class="btn ghost" href="index.html">Zur Startseite</a>
    </div>
  </div>`;
}

async function route() {
  cleanRT();
  const { name, param, query } = parseHash();
  window.scrollTo(0, 0);
  if (!name) {
    if (myProfile?.role === "workshop_owner" || myProfile?.role === "workshop_staff") return go("ws/dashboard");
    return go(APP_UI ? "home" : "search");
  }
  document.body.dataset.route = name;
  if (APP_UI) { main.classList.remove("pgIn"); void main.offsetWidth; main.classList.add("pgIn"); }
  const view = routes[name] || vNotFound;
  renderNav(name);
  try { await view(param, query); mountFilterSheet(); } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="warn">Fehler beim Laden: ${esc(e.message || e)}</div>`;
  }
}

function renderNav(active) {
  const isWs = myProfile?.role === "workshop_owner" || myProfile?.role === "workshop_staff";
  const items = isWs ? WS_NAV : APP_UI ? APP_NAV : me ? CUSTOMER_NAV : ANON_NAV;
  const nav = items.map(([r, ic, label]) =>
    `<a href="#/${r}" class="${active === r ? "on" : ""}">${label}</a>`).join("");
  $("topNav").innerHTML = nav + (me
    ? ""
    : `<a href="#/login" class="${active === "login" ? "on" : ""}">Anmelden</a><a href="#/register" class="${active === "register" ? "on" : ""}" style="color:var(--blue2)">Registrieren</a>`);
  $("tabbar").innerHTML = items.map(([r, ic, label]) =>
    `<a href="#/${r}" class="${active === r ? "on" : ""}"><span class="ti">${ico(ic, 22)}</span>${label}</a>`).join("") +
    `<a href="#/${me ? "account" : "login"}" class="${active === "account" || active === "login" ? "on" : ""}"><span class="ti">${ico("user", 22)}</span>${me ? "Konto" : "Login"}</a>`;
  const av = $("avatarBtn"); if (av) av.setAttribute("aria-label", "Konto");
  if (me) {
    av.classList.remove("hidden");
    av.textContent = initials(myProfile?.full_name || me.email);
    av.onclick = () => go("account");
  } else av.classList.add("hidden");
}

/* ------------------------------------------------------------------
   Filterschublade auf dem Handy
   Auf schmalen Bildschirmen steht die Filterspalte sonst als lange Liste
   vor den Ergebnissen. Hier bekommt sie einen festen Öffner über den
   Ergebnissen und liegt ansonsten als Schublade am unteren Rand.
   Wird nach jedem Seitenaufbau aufgerufen und räumt vorher auf.
------------------------------------------------------------------ */
function setFilterSheet(open) {
  const box = document.querySelector(".filterBox");
  const back = $("sheetBack"), btn = $("mFilterOpen");
  if (!box || !back) return;
  box.classList.toggle("open", open);
  back.classList.toggle("show", open);
  document.body.classList.toggle("sheetOpen", open);
  if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  if (!open) box.scrollTop = 0;
}

function updateFilterCount(n) {
  const el = $("mFilterCount");
  if (!el) return;
  el.textContent = n;
  el.hidden = !n;
}

function mountFilterSheet() {
  // App: Karten-Knopf festhalten – er sitzt evtl. schon in der alten Leiste
  const karte = APP_UI ? $("mapToggle") : null;
  // Reste der vorigen Seite entfernen – sonst bleibt die Sperre am Body hängen
  $("mFilterBar")?.remove();
  $("sheetBack")?.remove();
  document.body.classList.remove("sheetOpen");

  const box = document.querySelector(".filterBox");
  if (!box) return;
  box.classList.remove("open");

  const grid = box.parentElement;
  const bar = document.createElement("div");
  bar.id = "mFilterBar";
  bar.className = "mFilterBar";
  bar.innerHTML = `<button class="btn ghost sm" type="button" id="mFilterOpen" aria-expanded="false">
    ${ico("gear", 16)} Filter &amp; Umkreis <span class="fCount" id="mFilterCount" hidden></span></button>`;
  grid.parentNode.insertBefore(bar, grid);
  // App: Karte als zweiter Chip neben dem Filter statt eigener Knopfzeile
  if (karte) { bar.appendChild(karte); $("mapToggleWrap")?.remove(); }

  const back = document.createElement("div");
  back.id = "sheetBack";
  back.className = "sheetBack";
  back.addEventListener("click", () => setFilterSheet(false));
  document.body.appendChild(back);

  if (!box.querySelector(".sheetDone")) {
    const done = document.createElement("button");
    done.type = "button";
    done.className = "btn wide sheetDone";
    done.textContent = "Ergebnisse anzeigen";
    done.addEventListener("click", () => setFilterSheet(false));
    box.appendChild(done);
  }

  $("mFilterOpen").addEventListener("click", () => setFilterSheet(true));
  renderActiveFilters();
}

// Escape schließt die Schublade – gleiche Erwartung wie bei den Dialogen
document.addEventListener("keydown", e => { if (e.key === "Escape") setFilterSheet(false); });

async function loadSession() {
  const { data: { session } } = await sb.auth.getSession();
  me = session?.user || null;
  myProfile = null; myWorkshop = null;
  if (me) {
    const { data: p } = await sb.from("profiles").select("*").eq("id", me.id).maybeSingle();
    myProfile = p;
    // Muss abgewartet werden: verknüpft eingeladene Team-Mitglieder mit ihrem
    // Betrieb. Ohne await ist workshop_members beim ersten Login noch leer und
    // der Betrieb fehlt beim ersten Rendern (Race Condition).
    await sb.rpc("claim_membership");
    if (p && (p.role === "workshop_owner" || p.role === "workshop_staff")) {
      const { data: w } = await sb.from("workshops").select("*").eq("owner_id", me.id).maybeSingle();
      myWorkshop = w;
    }
    if (!myWorkshop) {
      const { data: m } = await sb.from("workshop_members").select("workshop_id, member_role, active").eq("user_id", me.id).eq("active", true).maybeSingle();
      if (m) {
        const { data: w2 } = await sb.from("workshops").select("*").eq("id", m.workshop_id).maybeSingle();
        if (w2) { myWorkshop = w2; myWorkshop._member_role = m.member_role; }
      }
    }
  }
  // Glocke an den Sitzungszustand angleichen (bewusst ohne await – die
  // Benachrichtigungen sollen den Seitenaufbau nicht verzögern).
  if (me) initNotifications(); else stopNotifications();
}
function requireAuth() {
  if (!me) { toast("Bitte zuerst anmelden."); go("login"); return false; }
  return true;
}
// Login-/Registrierungs-Gate mit Rücksprung: nach erfolgreicher Anmeldung landet
// der Nutzer wieder dort, wo er weitermachen wollte (CHECK24-Prinzip).
function authGate(next, toLogin) {
  if (next) sessionStorage.setItem("cfx_after_auth", next);
  go(toLogin ? "login" : "register");
}
function afterAuth(def) {
  const t = sessionStorage.getItem("cfx_after_auth");
  if (t) { sessionStorage.removeItem("cfx_after_auth"); return t; }
  return def;
}

// ============================================================
// AUTH
// ============================================================
async function vLogin() {
  main.innerHTML = `
  <div class="authWrap"><div class="authCard">
    <h1>Willkommen zurück</h1>
    <p class="mm" style="margin-top:6px">Melde dich mit deinem Carfixo-Konto an.</p>
    <div class="label">E-Mail</div>
    <input id="lEmail" type="email" placeholder="du@beispiel.de" autocapitalize="off">
    <div class="label">Passwort</div>
    <input id="lPass" type="password" placeholder="••••••••">
    <p class="mm" style="margin-top:8px;text-align:right"><a href="#/forgot" style="color:var(--blue2);font-weight:700">Passwort vergessen?</a></p>
    <button class="btn wide" style="margin-top:14px" id="lGo">Anmelden</button>
    <div class="err" id="lErr"></div>
    <p class="mm" style="margin-top:16px;text-align:center">Noch kein Konto? <a href="#/register" style="color:var(--blue2);font-weight:700">Jetzt registrieren</a></p>
  </div></div>`;
  $("lPass").onkeydown = (e) => { if (e.key === "Enter") $("lGo").click(); };
  faceIdLoginKnopf();
  $("lGo").onclick = async () => {
    const err = $("lErr"); err.style.display = "none";
    const email = $("lEmail").value.trim(), pass = $("lPass").value;
    // Ohne diese Pruefung geht eine sinnlose Anfrage raus und der Nutzer sieht
    // Supabases englische Antwort statt eines brauchbaren Hinweises.
    if (!email || !pass) return showErr(err, "Bitte E-Mail und Passwort ausfüllen.");
    $("lGo").disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    $("lGo").disabled = false;
    if (error) return showErr(err, authFehler(error));
    await loadSession();
    toast("Angemeldet ✓");
    await faceIdAnbieten(email, pass);
    go(afterAuth(""));
  };
}

// ---------- Auth-Fehler in verständliches Deutsch übersetzen ----------
// Supabase antwortet auf Englisch und oft technisch ("Invalid login
// credentials", "Email not confirmed"). Ungefiltert durchgereicht ist das für
// Nutzer wertlos. Verglichen wird auf Teilstrings, weil der genaue Wortlaut
// je nach Supabase-Version schwankt.
function authFehler(error) {
  const roh = String((error && error.message) || "");
  const m = roh.toLowerCase();
  const treffer = [
    ["invalid login credentials",        "E-Mail oder Passwort falsch."],
    ["email not confirmed",              "Bitte bestätige zuerst den Link in deiner Registrierungs-E-Mail."],
    ["user already registered",          "Für diese E-Mail gibt es bereits ein Konto. Melde dich stattdessen an."],
    ["already been registered",          "Für diese E-Mail gibt es bereits ein Konto. Melde dich stattdessen an."],
    ["unable to validate email",         "Diese E-Mail-Adresse sieht nicht gültig aus."],
    ["invalid format",                   "Diese E-Mail-Adresse sieht nicht gültig aus."],
    ["should be different",              "Das neue Passwort muss sich vom bisherigen unterscheiden."],
    ["token has expired",                "Der Link ist abgelaufen. Fordere bitte einen neuen an."],
    ["is invalid or has expired",        "Der Link ist abgelaufen. Fordere bitte einen neuen an."],
    ["rate limit",                       "Zu viele Versuche. Bitte warte ein paar Minuten."],
    ["for security purposes",            "Zu viele Versuche. Bitte warte ein paar Minuten."],
    ["signups not allowed",              "Registrierungen sind derzeit nicht möglich."],
    ["failed to fetch",                  "Keine Verbindung zum Server. Prüfe deine Internetverbindung."],
    ["networkerror",                     "Keine Verbindung zum Server. Prüfe deine Internetverbindung."],
    ["load failed",                      "Keine Verbindung zum Server. Prüfe deine Internetverbindung."],
  ].find(([schluessel]) => m.includes(schluessel));
  // Unbekanntes lieber im Original zeigen als verschlucken – sonst steht der
  // Nutzer ohne jeden Anhaltspunkt da und wir sehen im Support nichts.
  return treffer ? treffer[1] : (roh || "Unbekannter Fehler. Bitte später erneut versuchen.");
}

// ---------- Prüfung auf geleakte Passwörter ----------
// Ersetzt das kostenpflichtige Supabase-Feature. Genutzt wird dieselbe Quelle
// (HaveIBeenPwned), aber direkt über deren öffentliche API.
//
// Das Passwort verlässt das Gerät dabei NICHT: Es wird lokal als SHA-1 gehasht,
// und nur die ersten fünf Zeichen des Hashes werden angefragt (k-Anonymity).
// Zurück kommen alle passenden Endungen, verglichen wird wieder lokal.
// Der Header Add-Padding hält die Antwortgröße konstant, damit sich aus ihr
// nichts ableiten lässt.
//
// Liefert: Trefferzahl (>0 = kompromittiert), 0 = unauffällig,
//          null = Prüfung nicht möglich (dann bewusst nicht blockieren).
async function passwordLeakCount(pw) {
  try {
    if (!window.crypto?.subtle) return null;   // nur über HTTPS verfügbar
    const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(pw));
    const hash = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const res = await fetch("https://api.pwnedpasswords.com/range/" + hash.slice(0, 5),
      { headers: { "Add-Padding": "true" } });
    if (!res.ok) return null;
    const suffix = hash.slice(5);
    for (const line of (await res.text()).split("\n")) {
      const [s, count] = line.trim().split(":");
      if (s === suffix) return parseInt(count, 10) || 1;
    }
    return 0;
  } catch (e) {
    return null;   // Netzwerkproblem darf niemanden aussperren
  }
}
// Gemeinsame Passwortprüfung für Registrierung und Zurücksetzen.
// Gibt eine Fehlermeldung zurück oder null, wenn alles in Ordnung ist.
async function validateNewPassword(pw) {
  if (pw.length < 8) return "Das Passwort braucht mindestens 8 Zeichen.";
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw))
    return "Bitte mindestens einen Buchstaben und eine Ziffer verwenden.";
  const leaks = await passwordLeakCount(pw);
  if (leaks > 0)
    return `Dieses Passwort taucht in bekannten Datenlecks auf (${leaks.toLocaleString("de-DE")}×). Bitte wähle ein anderes.`;
  return null;
}

// ---------- Passwort vergessen ----------
async function vForgot() {
  main.innerHTML = `
  <div class="authWrap"><div class="authCard">
    <h1>Passwort zurücksetzen</h1>
    <p class="mm" style="margin-top:6px">Trage deine E-Mail-Adresse ein – wir schicken dir einen Link, mit dem du ein neues Passwort vergeben kannst.</p>
    <div class="label">E-Mail</div>
    <input id="fpEmail" type="email" placeholder="du@beispiel.de" autocapitalize="off">
    <button class="btn wide" style="margin-top:18px" id="fpGo">Link anfordern</button>
    <div class="err" id="fpErr"></div>
    <div id="fpDone"></div>
    <p class="mm" style="margin-top:16px;text-align:center"><a href="#/login" style="color:var(--blue2);font-weight:700">Zurück zur Anmeldung</a></p>
  </div></div>`;
  $("fpEmail").onkeydown = (e) => { if (e.key === "Enter") $("fpGo").click(); };
  $("fpGo").onclick = async () => {
    const err = $("fpErr"); err.style.display = "none";
    const email = $("fpEmail").value.trim();
    if (!email) return showErr(err, "Bitte deine E-Mail-Adresse eingeben.");
    $("fpGo").disabled = true; $("fpGo").textContent = "Wird gesendet…";
    // Ziel ist app.html ohne Hash – der Recovery-Hash von Supabase wird beim
    // Start erkannt und in die Route #/reset-password überführt.
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: appAdresse(),
    });
    $("fpGo").disabled = false; $("fpGo").textContent = "Link anfordern";
    // Bewusst immer dieselbe Rückmeldung: sonst liesse sich herausfinden,
    // welche E-Mail-Adressen bei Carfixo registriert sind.
    if (error && !/rate|limit|seconds/i.test(error.message)) console.error(error);
    if (error && /rate|limit|seconds/i.test(error.message)) return showErr(err, "Zu viele Versuche – bitte warte einen Moment.");
    $("fpDone").innerHTML = `<div class="okBox" style="margin-top:14px">Wenn ein Konto zu <b>${esc(email)}</b> existiert, ist die E-Mail unterwegs. Schau auch im Spam-Ordner nach – der Link ist eine Stunde gültig.</div>`;
  };
}

// ---------- Neues Passwort setzen (nach Klick auf den Recovery-Link) ----------
async function vResetPassword() {
  if (!me) {
    main.innerHTML = `
    <div class="authWrap"><div class="authCard">
      <h1>Link abgelaufen</h1>
      <p class="mm" style="margin-top:8px">Dieser Link ist ungültig oder abgelaufen. Fordere einen neuen an.</p>
      <button class="btn wide" style="margin-top:16px" onclick="go('forgot')">Neuen Link anfordern</button>
    </div></div>`;
    return;
  }
  main.innerHTML = `
  <div class="authWrap"><div class="authCard">
    <h1>Neues Passwort vergeben</h1>
    <p class="mm" style="margin-top:6px">Für <b>${esc(me.email)}</b>. Mindestens 8 Zeichen.</p>
    <div class="label">Neues Passwort</div>
    <input id="rpPass" type="password" placeholder="••••••••">
    <div class="label">Wiederholen</div>
    <input id="rpPass2" type="password" placeholder="••••••••">
    <button class="btn wide" style="margin-top:18px" id="rpGo">Passwort speichern</button>
    <div class="err" id="rpErr"></div>
  </div></div>`;
  $("rpPass2").onkeydown = (e) => { if (e.key === "Enter") $("rpGo").click(); };
  $("rpGo").onclick = async () => {
    const err = $("rpErr"); err.style.display = "none";
    const pw = $("rpPass").value, pw2 = $("rpPass2").value;
    if (pw !== pw2) return showErr(err, "Die beiden Passwörter stimmen nicht überein.");
    $("rpGo").disabled = true; $("rpGo").textContent = "Passwort wird geprüft…";
    const pwProblem = await validateNewPassword(pw);
    if (pwProblem) { $("rpGo").disabled = false; $("rpGo").textContent = "Passwort speichern"; return showErr(err, pwProblem); }
    $("rpGo").textContent = "Wird gespeichert…";
    const { error } = await sb.auth.updateUser({ password: pw });
    $("rpGo").disabled = false; $("rpGo").textContent = "Passwort speichern";
    if (error) return showErr(err, authFehler(error));
    await loadSession();
    toast("Passwort geändert ✓");
    go(myWorkshop ? "ws/dashboard" : "search");
  };
}

let regRole = "customer";
async function vRegister() {
  regRole = "customer";
  main.innerHTML = `
  <div class="authWrap"><div class="authCard">
    <h1>Konto erstellen</h1>
    <div class="label">Ich bin …</div>
    <div class="roleGrid">
      <div class="roleCard on" id="rcCust" onclick="pickRole('customer')">
        <div class="re"></div><div class="rn">Kunde</div>
        <div class="rm">Ich suche Werkstätten &amp; Services für mein Auto</div>
      </div>
      <div class="roleCard" id="rcWs" onclick="pickRole('workshop')">
        <div class="re"></div><div class="rn">Betrieb</div>
        <div class="rm">Werkstatt, Tuning, Aufbereitung oder Prüfstelle</div>
      </div>
    </div>
    <div id="wsNameBox" class="hidden">
      <div class="label">Name des Betriebs</div>
      <input id="rCompany" placeholder="z.B. Muster KFZ GmbH">
    </div>
    <div class="label">Dein Name</div>
    <input id="rName" placeholder="Vor- und Nachname">
    <div class="label">E-Mail</div>
    <input id="rEmail" type="email" placeholder="du@beispiel.de" autocapitalize="off">
    <div class="label">Passwort (min. 8 Zeichen)</div>
    <input id="rPass" type="password" placeholder="••••••••">
    <button class="btn wide" style="margin-top:18px" id="rGo">Kostenlos registrieren</button>
    <div class="err" id="rErr"></div>
    <p class="mm" style="margin-top:16px;text-align:center">Schon ein Konto? <a href="#/login" style="color:var(--blue2);font-weight:700">Anmelden</a></p>
  </div></div>`;
  $("rGo").onclick = doRegister;
}
function pickRole(r) {
  regRole = r;
  $("rcCust").classList.toggle("on", r === "customer");
  $("rcWs").classList.toggle("on", r === "workshop");
  $("wsNameBox").classList.toggle("hidden", r !== "workshop");
}
async function doRegister() {
  const err = $("rErr"); err.style.display = "none";
  const email = $("rEmail").value.trim(), pass = $("rPass").value, name = $("rName").value.trim();
  const company = regRole === "workshop" ? $("rCompany").value.trim() : null;
  if (!email || !pass) return showErr(err, "Bitte E-Mail und Passwort ausfüllen.");
  if (regRole === "workshop" && !company) return showErr(err, "Bitte den Namen deines Betriebs angeben.");
  $("rGo").disabled = true;
  $("rGo").textContent = "Passwort wird geprüft…";
  const pwProblem = await validateNewPassword(pass);
  $("rGo").textContent = "Kostenlos registrieren";
  if (pwProblem) { $("rGo").disabled = false; return showErr(err, pwProblem); }
  // Ohne emailRedirectTo landet man nach der Bestätigung auf der Startseite
  // (der Site-URL) statt in der App – und muss sich von dort erst durchklicken.
  const { data, error } = await sb.auth.signUp({
    email, password: pass,
    options: { data: { full_name: name }, emailRedirectTo: NATIVE ? SITE + "/app.html" : location.origin + "/app.html" },
  });
  $("rGo").disabled = false;
  if (error) return showErr(err, authFehler(error));
  if (!data.session) {
    main.innerHTML = `<div class="authWrap"><div class="authCard" style="text-align:center">
      <div style="font-size:42px"></div>
      <h1 style="margin-top:10px">Fast geschafft!</h1>
      <p class="mm" style="margin-top:10px">Wir haben dir eine Bestätigungs-E-Mail an <b>${esc(email)}</b> geschickt. Klicke auf den Link darin und melde dich dann an.${company ? "<br><br>Dein Betrieb wird beim ersten Login angelegt – trage danach dein Profil ein." : ""}</p>
      <button class="btn wide" style="margin-top:16px" onclick="go('login')">Zum Login</button>
    </div></div>`;
    if (company) localStorage.setItem("cfx_pending_ws", company);
    return;
  }
  await loadSession();
  if (regRole === "workshop") {
    await createWorkshopForMe(company);
    toast("Konto erstellt ✓ – vervollständige jetzt dein Betriebsprofil.");
    go("ws/profile");
  } else {
    toast("Willkommen bei Carfixo ✓");
    go(afterAuth("search"));
  }
}
async function createWorkshopForMe(name) {
  const { error } = await sb.from("workshops").insert({ owner_id: me.id, name, categories: [] });
  if (error && !String(error.message).includes("duplicate")) toast("Betrieb konnte nicht angelegt werden: " + error.message);
  await loadSession();
}

async function signOut() {
  cleanRT();
  stopNotifications();
  await sb.auth.signOut();
  me = null; myProfile = null; myWorkshop = null;
  toast("Abgemeldet.");
  go("search");
}

// ============================================================
// SUCHE (öffentlich) – Standort / Adresse / Radius
// ============================================================
let searchState = {
  q: "", world: "", cat: "", service: "", brand: "", radius: 25,
  openNow: false, pickup: false, replacement: false, mobile: false,
  minRating: 0, sort: "rating", shown: 12,
};
let searchOrigin = null, searchOriginLabel = "";   // [lat,lng] – Standort des Kunden
// Labels, die kein eingebbarer Ort sind – sie gehören nicht ins Adressfeld zurück
const PSEUDO_LOC_LABELS = ["Dein Standort", "Karten-Position"];
let allWorkshops = null, searchMap = null, compareSet = [];

// ============================================================
// HOME (nur in der App)
// Aufbau nach Uber und CHECK24: große Frage mit Suchfeld, Kacheln für die
// häufigsten Leistungen, der laufende Auftrag wie eine Fahrt im Blick,
// dann Vergleichen, Garage und Top-Betriebe in der Nähe.
// Kachelbilder wie bei Uber: kleine 3D-Renderings einzelner Gegenstände,
// alle aus derselben Szene (tools/kacheln/, Nachweis in docs/bildnachweise.md).
// ============================================================
const HOME_TILES = [
  ["reparatur", "Reparatur", "#4D8DFF"], ["inspektion", "Inspektion", "#38BDF8"],
  ["reifen", "Reifen", "#A78BFF"], ["tuev", "TÜV", "#2BD58A"],
  ["pflege", "Pflege", "#FFB020"], ["karosserie", "Karosserie", "#FF7A59"],
  ["klima", "Klima", "#5EEAD4"], ["tuning", "Tuning", "#F472B6"],
];

function hmGruss() {
  const h = new Date().getHours();
  const name = (myProfile?.full_name || "").trim().split(/\s+/)[0];
  const gruss = h < 11 ? "Guten Morgen" : h < 18 ? "Hallo" : "Guten Abend";
  return name ? `${gruss}, ${esc(name)}` : gruss;
}

async function vHome() {
  const kunde = me && !myWorkshop;
  main.innerHTML = `
  <section class="hm">
    <div class="hmHi">${hmGruss()}</div>
    <h1 class="hmTitle">Was braucht<br>dein Auto?</h1>

    <form class="hmSearch" id="hmSearch" role="search">
      <span class="hmSearchIco">${ico("search", 20)}</span>
      <input id="hmQ" placeholder="Leistung oder Werkstatt" enterkeyhint="search" autocomplete="off" aria-label="Suche">
      <button class="hmGo" type="submit" aria-label="Suchen">${ico("chev", 20)}</button>
    </form>

    <div class="hmTiles">
      ${HOME_TILES.map(([k, label, farbe]) => `<a class="hmTile" href="#/search?cat=${k}" style="--c:${farbe}">
        <span class="hmTileImg"><img src="assets/img/kategorien/${k}.webp" alt="" loading="lazy" decoding="async"></span><span>${label}</span></a>`).join("")}
    </div>

    <div id="hmLive"></div>
    <div id="hmFest"></div>

    <a class="hmPromo" href="#/${kunde ? "new-request" : me ? "search" : "register"}">
      <div class="hmPromoTxt">
        <span class="hmKicker">Kostenlos vergleichen</span>
        <b>Angebote einholen,<br>günstigsten wählen</b>
        <span class="hmPromoBtn">${kunde ? "Anfrage starten" : me ? "Betriebe ansehen" : "Jetzt loslegen"} ${ico("chev", 16)}</span>
      </div>
      <span class="hmPromoArt">${ico("euro", 64)}</span>
    </a>

    <div class="hmQuick">
      <a class="hmQ" href="#/diagnose"><span class="hmQIco" style="--c:#A78BFF">${ico("robot", 22)}</span>
        <b>Diagnose</b><span>Was hat mein Auto?</span></a>
      <a class="hmQ hmQRed" href="#/notfall"><span class="hmQIco" style="--c:#FF5C5C">${ico("alert", 22)}</span>
        <b>Notfall</b><span>Panne? Hilfe in der Nähe</span></a>
      <a class="hmQ" href="#/teile"><span class="hmQIco" style="--c:#38BDF8">${ico("puzzle", 22)}</span>
        <b>Teile</b><span>Kaufen & einbauen lassen</span></a>
    </div>

    <div id="hmGarage"></div>

    <div class="hmSec"><h2>Top in deiner Nähe</h2><a href="#/search">Alle ${ico("chev", 14)}</a></div>
    <div class="hmRail" id="hmTop">${'<div class="hmWs sk"></div>'.repeat(3)}</div>

    <div class="hmTrust">
      <div>${ico("shield", 20)}<span>Geprüfte Betriebe</span></div>
      <div>${ico("star", 20)}<span>Echte Bewertungen</span></div>
      <div>${ico("euro", 20)}<span>Kostenlos für dich</span></div>
    </div>
  </section>`;

  $("hmSearch").onsubmit = (e) => {
    e.preventDefault();
    const q = $("hmQ").value.trim();
    go(q ? "search?q=" + encodeURIComponent(q) : "search");
  };

  const top = (async () => {
    if (!allWorkshops) {
      const { data } = await sb.from("workshops").select("*").eq("is_verified", true).order("rating_avg", { ascending: false }).limit(200);
      allWorkshops = data || [];
    }
    const box = $("hmTop");
    if (!box) return;
    const liste = allWorkshops.slice().sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0)).slice(0, 8);
    box.innerHTML = liste.length ? liste.map(ws => `<a class="hmWs" href="#/workshop/${ws.id}">
      <div class="wsAv" style="${ws.logo_url ? `background-image:url('${esc(ws.logo_url)}');background-size:cover;background-position:center;color:transparent` : avStil(ws.name)}">${esc(initials(ws.name))}</div>
      <b>${esc(ws.name)}</b>
      <span class="hmWsMeta">${ico("star", 13)} ${ws.rating_avg > 0 ? Number(ws.rating_avg).toLocaleString("de-DE") : "Neu"} · ${esc(ws.district || ws.city || "")}</span>
      ${ws.is_demo ? '<span class="badge b-blue">Beispielbetrieb</span>' : ""}
    </a>`).join("") : `<div class="mm">Noch keine Betriebe in deiner Nähe.</div>`;
  })();

  const fest = hmFestpreise();
  if (kunde) await Promise.all([top, fest, hmLive(), hmGarage()]);
  else await Promise.all([top, fest]);
}

// Laufender Auftrag – wie eine Fahrt bei Uber: Status und Fortschritt
async function hmLive() {
  const [{ data: bks }, { data: reqs }] = await Promise.all([
    sb.from("bookings").select("id,status,booking_no,offers(request_id)").eq("customer_id", me.id)
      .not("status", "in", "(completed,cancelled)").order("created_at", { ascending: false }).limit(1),
    sb.from("requests").select("id,title,category,status,offers(count)").eq("customer_id", me.id)
      .eq("status", "open").order("created_at", { ascending: false }).limit(1),
  ]);
  const box = $("hmLive");
  if (!box) return;
  const bk = bks?.[0], r = reqs?.[0];
  if (bk && BK_STATUS[bk.status]) {
    const schritt = Math.max(0, BK_FLOW.indexOf(bk.status));
    const anteil = Math.round(((schritt + 1) / BK_FLOW.length) * 100);
    const ziel = bk.offers?.request_id ? `request/${bk.offers.request_id}` : "requests";
    box.innerHTML = `<a class="hmLive" href="#/${ziel}">
      <div class="hmLiveTop"><span class="hmPulse"></span><span class="hmKicker">Dein Auftrag ${esc(bk.booking_no || "")}</span></div>
      <b>${BK_STATUS[bk.status][0]}</b>
      <div class="hmBar"><i style="width:${anteil}%"></i></div>
      <span class="mm">Tippen für Details ${ico("chev", 13)}</span></a>`;
  } else if (r) {
    const n = r.offers?.[0]?.count || 0;
    box.innerHTML = `<a class="hmLive" href="#/request/${r.id}">
      <div class="hmLiveTop"><span class="hmPulse"></span><span class="hmKicker">Deine Anfrage</span></div>
      <b>${esc(r.title)}</b>
      <span class="mm">${n ? `${n} Angebot${n > 1 ? "e" : ""} zum Vergleichen` : "Betriebe schauen sich deine Anfrage an"} ${ico("chev", 13)}</span></a>`;
  }
}

// Garage: Fahrzeuge mit TÜV-Hinweis, plus "Meine Aufträge"
async function hmGarage() {
  const { data: autos } = await sb.from("vehicles").select("id,make,model,license_plate,tuev_until").eq("owner_id", me.id).order("created_at");
  const box = $("hmGarage");
  if (!box) return;
  const bald = (d) => d && new Date(d) < new Date(Date.now() + 60 * 864e5);
  box.innerHTML = `<div class="hmSec"><h2>Meine Garage</h2><a href="#/requests">Meine Aufträge ${ico("chev", 14)}</a></div>
    <div class="hmRail">
      ${(autos || []).map(v => `<a class="hmCar" href="#/vehicle/${v.id}">
        <span class="hmCarIco">${ico("car", 26)}</span>
        <b>${esc(v.make || "")} ${esc(v.model || "")}</b>
        <span class="mm">${esc(v.license_plate || "")}</span>
        ${v.tuev_until ? `<span class="badge ${bald(v.tuev_until) ? "b-gold" : "b-grey"}">TÜV ${fmtDate(v.tuev_until)}</span>` : ""}
      </a>`).join("")}
      <a class="hmCar hmCarAdd" href="#/vehicles"><span class="hmCarIco">${ico("plus", 26)}</span><b>Fahrzeug</b><span class="mm">hinzufügen</span></a>
    </div>`;
}

async function vSearch(_p, query) {
  // Deep-Links von der Startseite: #/search?q=…&cat=…&world=…&loc=…
  if (query) {
    if (query.q !== undefined) searchState.q = query.q;
    if (query.cat && CATS[query.cat]) { searchState.cat = query.cat; searchState.world = ""; }
    if (query.world && WORLDS.some(w => w.key === query.world)) searchState.world = query.world;
  }
  const pendingLoc = query?.loc || "";
  searchMap = null; // Karte wird beim Einblenden neu initialisiert
  const s = searchState;
  main.innerHTML = `
  <div class="pageHead">
    <div><h1>Werkstatt-Suche</h1>
    <div class="sub">Werkstätten, Tuning, Aufbereitung und Prüfstellen in deiner Nähe – nach Entfernung, Leistung und Bewertung gefiltert.</div></div>
    ${me && !myWorkshop ? `<div class="right"><a class="btn sm" href="#/new-request">＋ Ausschreibung</a></div>` : ""}
  </div>

  <div class="card" style="margin-bottom:14px;padding:8px 8px 8px 18px;display:flex;align-items:center;gap:10px">
    <span style="font-size:18px"></span>
    <input id="fQ" value="${esc(s.q || "")}" placeholder="Leistung oder Betrieb suchen…"
      style="border:none;background:none;font-size:16px;padding:12px 0" autocomplete="off">
    ${s.q ? `<button class="btn ghost sm" id="fQClear" style="flex:0 0 auto" aria-label="Suche zurücksetzen">✕</button>` : ""}
  </div>

  <div class="card diagPromo" style="margin-bottom:16px;border-color:rgba(124,92,255,.35);background:linear-gradient(120deg,rgba(124,92,255,.1),var(--panel))">
    <div class="cardHead">
      <div class="ico icoPurple" style="width:48px;height:48px;font-size:22px">${ico("robot", 22)}</div>
      <div style="flex:1"><div class="tt">Nicht sicher, was dein Auto hat?</div>
      <div class="mm">Beschreibe das Problem, wähle Warnleuchten oder lade ein Foto hoch – die Diagnose gibt dir eine unverbindliche Ersteinschätzung mit Preisorientierung.</div></div>
      <a class="btn sm" href="#/diagnose">Diagnose starten</a>
    </div>
  </div>

  <div class="searchGrid">
    <div class="filterBox card">
      <div class="tt">Standort &amp; Umkreis</div>
      <div class="btnRow" style="margin-top:10px">
        <button class="btn ghost sm" id="locBtn">Mein Standort</button>
      </div>
      <div class="split" style="margin-top:10px">
        <input id="locAddr" placeholder="Adresse oder Ort eingeben…" value="${esc(PSEUDO_LOC_LABELS.includes(searchOriginLabel) ? "" : searchOriginLabel || "")}">
        <button class="btn sm" id="locGo" style="flex:0 0 auto">Suchen</button>
      </div>
      <select id="fDistrict" aria-label="Kölner Stadtteil" style="margin-top:8px">${opt("… oder Kölner Stadtteil wählen", Object.keys(DISTRICTS), "")}</select>
      <p class="mm" id="locInfo" style="margin-top:7px">${searchOrigin ? "" + esc(searchOriginLabel) : "Kein Standort gesetzt – Entfernungen ab Kölner Zentrum."}</p>
      <div class="label">Umkreis</div>
      <div class="chips" id="fRadius">
        ${RADIUS_STEPS.map(r => `<span class="chip ${s.radius === r ? "on" : ""}" data-r="${r}">${r} km</span>`).join("")}
        <span class="chip ${!s.radius ? "on" : ""}" data-r="">Alle</span>
      </div>

      <div class="tt" style="margin-top:20px">Filter</div>
      <div class="label">Bereich</div>
      <div class="chips" id="fWorlds">
        <span class="chip ${!s.world ? "on" : ""}" data-w="">Alle</span>
        ${WORLDS.map(w => `<span class="chip ${s.world === w.key ? "on" : ""}" data-w="${w.key}">${ico(w.key)} ${w.name}</span>`).join("")}
      </div>
      <div class="label">Sortierung</div>
      <select id="fSort" aria-label="Sortierung">
        <option value="rating" ${s.sort === "rating" ? "selected" : ""}>Beste Bewertung</option>
        <option value="distance" ${s.sort === "distance" ? "selected" : ""}>Entfernung</option>
        <option value="price" ${s.sort === "price" ? "selected" : ""}>Preisniveau</option>
      </select>
      <button class="btn ghost wide sm" style="margin-top:14px" id="fMoreBtn"></button>
      <div id="fAdvanced" class="hidden">
        <div class="label">Kategorie</div>
        <select id="fCat" aria-label="Kategorie"></select>
        <div class="label">Leistung</div>
        <select id="fService" aria-label="Leistung"></select>
        <div class="label">Fahrzeugmarke</div>
        <select id="fBrand" aria-label="Fahrzeugmarke">${opt("Alle Marken", Object.keys(BRANDS), s.brand)}</select>
        <div class="label">Ausstattung</div>
        <label class="inline"><input type="checkbox" id="fOpen" ${s.openNow ? "checked" : ""}> Jetzt geöffnet</label>
        <label class="inline"><input type="checkbox" id="fPickup" ${s.pickup ? "checked" : ""}> Hol- &amp; Bringservice</label>
        <label class="inline"><input type="checkbox" id="fReplace" ${s.replacement ? "checked" : ""}> Ersatzwagen</label>
        <label class="inline"><input type="checkbox" id="fMobile" ${s.mobile ? "checked" : ""}> Mobile Werkstatt</label>
        <div class="label">Mindestbewertung</div>
        <select id="fRating" aria-label="Mindestbewertung"><option value="0">Alle</option><option value="4" ${s.minRating == 4 ? "selected" : ""}>★ 4,0+</option><option value="4.5" ${s.minRating == 4.5 ? "selected" : ""}>★ 4,5+</option></select>
      </div>
      <button class="btn ghost wide sm" style="margin-top:14px" id="fReset">Filter zurücksetzen</button>
    </div>
    <div>
      <div id="mapToggleWrap" style="margin-bottom:10px"><button class="btn ghost sm" id="mapToggle">Karte anzeigen</button></div>
      <div class="mapWrap hidden" id="mapWrap" style="margin-bottom:14px"><div id="map"></div></div>
      <div id="activeFilters" class="chips" style="margin-bottom:10px"></div>
      <div id="resultMeta" class="mm" style="margin-bottom:10px"></div>
      <div id="results"><div class="sk" style="height:110px"></div></div>
      <div id="moreBox" style="text-align:center;margin-top:12px"></div>
    </div>
  </div>
  <div id="compareBar"></div>`;

  fillCatSelect();
  mountFilterSheet();

  // Freitext-Suche
  $("fQ").oninput = () => {
    searchState.q = $("fQ").value;
    searchState.shown = 12;
    applyFilters();
  };
  if ($("fQClear")) $("fQClear").onclick = () => { searchState.q = ""; vSearch(); };

  // Standort-Quellen
  $("locBtn").onclick = () => {
    if (!navigator.geolocation) return toast("Standort wird von diesem Gerät nicht unterstützt.");
    $("locBtn").disabled = true; $("locBtn").textContent = "Suche Standort…";
    navigator.geolocation.getCurrentPosition(
      (pos) => { setSearchOrigin([pos.coords.latitude, pos.coords.longitude], "Dein Standort"); $("locBtn").disabled = false; $("locBtn").textContent = "Mein Standort"; },
      () => { toast("Standort nicht verfügbar – bitte Adresse eingeben."); $("locBtn").disabled = false; $("locBtn").textContent = "Mein Standort"; },
      { timeout: 8000 });
  };
  $("locGo").onclick = geocodeAddress;
  $("locAddr").onkeydown = (e) => { if (e.key === "Enter") geocodeAddress(); };
  $("fDistrict").onchange = () => {
    const d = DISTRICTS[$("fDistrict").value];
    if (d) setSearchOrigin(d, "Köln-" + $("fDistrict").value);
  };
  document.querySelectorAll("#fRadius .chip").forEach(c => c.onclick = () => {
    searchState.radius = c.dataset.r ? +c.dataset.r : 0;
    document.querySelectorAll("#fRadius .chip").forEach(x => x.classList.toggle("on", x === c));
    searchState.shown = 12; applyFilters();
  });

  document.querySelectorAll("#fWorlds .chip").forEach(c => c.onclick = () => {
    searchState.world = c.dataset.w; searchState.cat = ""; searchState.service = "";
    document.querySelectorAll("#fWorlds .chip").forEach(x => x.classList.toggle("on", x === c));
    fillCatSelect(); searchState.shown = 12; applyFilters();
  });
  ["fCat", "fService", "fBrand", "fRating", "fSort", "fOpen", "fPickup", "fReplace", "fMobile"].forEach(id => $(id).onchange = () => {
    searchState.cat = $("fCat").value; searchState.service = $("fService").value;
    searchState.brand = $("fBrand").value;
    searchState.minRating = parseFloat($("fRating").value) || 0;
    searchState.sort = $("fSort").value;
    searchState.openNow = $("fOpen").checked; searchState.pickup = $("fPickup").checked;
    searchState.replacement = $("fReplace").checked; searchState.mobile = $("fMobile").checked;
    if (id === "fCat") { searchState.service = ""; fillServiceSelect(); }
    searchState.shown = 12; applyFilters();
  });
  $("fReset").onclick = () => {
    searchState = { q: "", world: "", cat: "", service: "", brand: "", radius: 25, openNow: false, pickup: false, replacement: false, mobile: false, minRating: 0, sort: "rating", shown: 12 };
    vSearch();
  };

  // Erweiterte Filter ein-/ausklappen (bei aktiven Erweitert-Filtern offen starten)
  const advActive = s.cat || s.service || s.brand || s.openNow || s.pickup || s.replacement || s.mobile || s.minRating;
  let advOpen = !!advActive;
  const syncAdv = () => {
    $("fAdvanced").classList.toggle("hidden", !advOpen);
    $("fMoreBtn").textContent = advOpen ? "Weniger Filter" : "Mehr Filter";
  };
  $("fMoreBtn").onclick = () => { advOpen = !advOpen; syncAdv(); };
  syncAdv();

  // Karte lazy laden (erst beim Einblenden – Leaflet braucht sichtbaren Container)
  $("mapToggle").onclick = () => {
    const wrap = $("mapWrap");
    const show = wrap.classList.contains("hidden");
    wrap.classList.toggle("hidden", !show);
    $("mapToggle").textContent = show ? "Karte ausblenden" : "Karte anzeigen";
    if (show) {
      if (!searchMap) {
        searchMap = CarfixoMaps.create("map", { center: searchOrigin || CITY_CENTER, zoom: 12 });
        searchMap.onClick((ll) => setSearchOrigin(ll, "Karten-Position"));
      }
      setTimeout(() => { searchMap.refresh(); applyFilters(); }, 60);
    }
  };

  if (!allWorkshops) {
    const { data, error } = await sb.from("workshops").select("*").eq("is_verified", true).order("rating_avg", { ascending: false }).limit(200);
    if (!$("results")) return;
    if (error) { $("results").innerHTML = `<div class="warn">${esc(error.message)}</div>`; return; }
    allWorkshops = data || [];
  }
  applyFilters();
  // Ort von der Startseite übernehmen (z.B. „Köln" oder PLZ)
  if (pendingLoc && $("locAddr")) { $("locAddr").value = pendingLoc; geocodeAddress(); }
}
// Route zur Werkstatt in Google Maps. Bewusst ein normaler Link statt der
// Directions API: kostet nichts, braucht keinen Schluessel und oeffnet auf dem
// Handy direkt die Maps-App (bzw. Apple Maps, wenn Maps nicht installiert ist).
// Die Adresse ist als Ziel lesbarer als Koordinaten - fehlt sie, nehmen wir den
// Karten-Pin, den der Betrieb selbst gesetzt hat.
function mapsDirUrl(ws) {
  const ort = [ws.zip, ws.city].filter(Boolean).join(" ").trim();
  const adresse = [ws.street, ort].filter(Boolean).join(", ").trim();
  const link = z => "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(z);
  // Vollstaendige Adresse ist das beste Ziel: in Maps lesbar und eindeutig.
  if (ws.street && ort) return link(adresse);
  // Sonst der Karten-Pin des Betriebs - genauer als eine halbe Adresse.
  if (ws.lat != null && ws.lng != null) return link(`${ws.lat},${ws.lng}`);
  // Bruchstueck (nur Ort oder nur Strasse) ist immer noch besser als nichts.
  if (adresse) return link(adresse);
  // Ohne jede Ortsangabe keinen Button zeigen - "Köln" waere hier geraten.
  return null;
}
function setSearchOrigin(ll, label) {
  searchOrigin = ll; searchOriginLabel = label;
  const info = $("locInfo");
  if (info) info.textContent = "" + label;
  if (searchMap) searchMap.setView(ll, 12);
  toast("Standort gesetzt: " + label);
  applyFilters();
}
// Adresssuche über den eigenen Proxy /api/geocode (funktioniert deutschlandweit).
// Der Proxy setzt den von Nominatim geforderten User-Agent, cacht die Antworten
// und verhindert, dass die IP-Adressen unserer Nutzer beim Kartendienst landen.
const geoCache = new Map();
async function geocodeAddress() {
  const q = $("locAddr").value.trim();
  if (!q) return toast("Bitte eine Adresse oder einen Ort eingeben.");

  const key = q.toLowerCase();
  if (geoCache.has(key)) {
    const c = geoCache.get(key);
    return c ? setSearchOrigin([c.lat, c.lng], c.label) : toast("Adresse nicht gefunden – bitte genauer eingeben.");
  }

  $("locGo").disabled = true; $("locGo").textContent = "…";
  try {
    const res = await fetch(API + "/api/geocode?q=" + encodeURIComponent(q));
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error("upstream");
    if (!data.found) {
      geoCache.set(key, null);
      toast("Adresse nicht gefunden – bitte genauer eingeben.");
    } else {
      geoCache.set(key, data);
      setSearchOrigin([data.lat, data.lng], data.label || q);
    }
  } catch (e) {
    toast("Adresssuche gerade nicht erreichbar.");
  }
  $("locGo").disabled = false; $("locGo").textContent = "Suchen";
}
function fillCatSelect() {
  const w = WORLDS.find(x => x.key === searchState.world);
  const cats = w ? w.cats : Object.keys(CATS);
  $("fCat").innerHTML = `<option value="">Alle Kategorien</option>` +
    cats.map(k => `<option value="${k}" ${searchState.cat === k ? "selected" : ""}>${CATS[k].name}</option>`).join("");
  fillServiceSelect();
}
function fillServiceSelect() {
  const services = searchState.cat ? CATS[searchState.cat].services : [];
  $("fService").innerHTML = opt(searchState.cat ? "Alle Leistungen" : "Erst Kategorie wählen", services, searchState.service);
  $("fService").disabled = !searchState.cat;
}
function applyFilters() {
  if (!$("results") || !allWorkshops) return;
  const s = searchState;
  const origin = searchOrigin || CITY_CENTER;
  const w = WORLDS.find(x => x.key === s.world);
  const q = (s.q || "").trim().toLowerCase();
  let list = allWorkshops.filter(ws => {
    if (q) {
      const hay = [ws.name, ws.description, ws.district, ws.city,
        ...(ws.services || []), ...(ws.brands || []),
        ...ws.categories.map(c => CATS[c]?.name || c)].join(" ").toLowerCase();
      if (!q.split(/\s+/).every(word => hay.includes(word))) return false;
    }
    if (w && !ws.categories.some(c => w.cats.includes(c))) return false;
    if (s.cat && !ws.categories.includes(s.cat)) return false;
    if (s.service && !(ws.services || []).includes(s.service)) return false;
    if (s.brand && (ws.brands || []).length > 0 && !ws.brands.includes(s.brand)) return false;
    if (s.mobile && ws.service_mode === "stationary") return false;
    if (s.pickup && !ws.pickup_service) return false;
    if (s.replacement && !ws.replacement_car) return false;
    if (s.openNow && isOpenNow(ws.opening_hours) === false) return false;
    if (s.minRating && (Number(ws.rating_avg) || 0) < s.minRating) return false;
    return true;
  }).map(ws => ({ ...ws, _dist: distKm(origin, [ws.lat, ws.lng]) }));

  if (s.radius) list = list.filter(ws => ws._dist == null || ws._dist <= s.radius);

  if (s.sort === "distance") list.sort((a, b) => (a._dist ?? 999) - (b._dist ?? 999));
  else if (s.sort === "price") list.sort((a, b) => (a.price_level || 2) - (b.price_level || 2));
  else list.sort((a, b) => (b.is_premium - a.is_premium) || (b.rating_avg || 0) - (a.rating_avg || 0) || (b.rating_count || 0) - (a.rating_count || 0));

  $("resultMeta").textContent = `${list.length} ${list.length === 1 ? "Betrieb" : "Betriebe"}${s.radius ? ` im Umkreis von ${s.radius} km` : ""}${searchOrigin ? " um " + searchOriginLabel : ""}`;
  const visible = list.slice(0, s.shown);
  $("results").innerHTML = list.length === 0
    ? `<div class="empty"><div class="e">${ico("search",40)}</div>Keine Betriebe für diese Filter.<br>Tipp: Radius vergrößern oder eine <a href="#/new-request" style="color:var(--blue2)">Ausschreibung</a> erstellen – Betriebe melden sich bei dir.</div>`
    : visible.map(ws => wsCardHtml(ws)).join("");
  $("moreBox").innerHTML = list.length > s.shown
    ? `<button class="btn ghost sm" onclick="searchState.shown+=12;applyFilters()">Mehr anzeigen (${list.length - s.shown} weitere)</button>` : "";

  renderActiveFilters();
  // Karte aktualisieren (nur wenn eingeblendet/initialisiert)
  if (searchMap) {
    searchMap.clearMarkers();
    if (searchOrigin) searchMap.addDot(searchOrigin, { radius: 8, color: "#38BDF8", stroke: "#7DD3FC", popup: "Dein Standort" });
    visible.forEach(ws => {
      if (ws.lat == null || ws.lng == null) return;
      searchMap.addPin([ws.lat, ws.lng], {
        iconName: ws.categories[0] || "reparatur",
        title: ws.name,
        popup: `<b>${esc(ws.name)}</b><br><span style="color:#FFB020">${stars(ws.rating_avg)}</span> ${ws.rating_avg ?? "–"} · ${esc(ws.district || ws.city || "")}<br><a href="#/workshop/${ws.id}" style="color:#4D8DFF;font-weight:700">Profil ansehen →</a>`,
      });
    });
    searchMap.fitMarkers();
  }
  renderCompareBar();
}
// Aktive Filter als entfernbare Chips über den Ergebnissen
function renderActiveFilters() {
  const box = $("activeFilters"); if (!box) return;
  const s = searchState, chips = [];
  const add = (label, clear) => chips.push(`<span class="chip on" style="cursor:pointer" data-clear="${clear}">${esc(label)} ✕</span>`);
  if (s.q) add(`„${s.q}"`, "q");
  if (s.world) add(WORLDS.find(w => w.key === s.world)?.name || s.world, "world");
  if (s.cat) add(CATS[s.cat]?.name || s.cat, "cat");
  if (s.service) add(s.service, "service");
  if (s.brand) add(s.brand, "brand");
  if (s.openNow) add("Jetzt geöffnet", "openNow");
  if (s.pickup) add("Hol- & Bringservice", "pickup");
  if (s.replacement) add("Ersatzwagen", "replacement");
  if (s.mobile) add("Mobil", "mobile");
  if (s.minRating) add(`★ ${s.minRating}+`, "minRating");
  box.innerHTML = chips.join("");
  updateFilterCount(chips.length);
  box.querySelectorAll("[data-clear]").forEach(c => c.onclick = () => {
    const k = c.dataset.clear;
    if (k === "minRating") searchState.minRating = 0;
    else if (["openNow", "pickup", "replacement", "mobile"].includes(k)) searchState[k] = false;
    else searchState[k] = "";
    if (k === "world" || k === "cat") { searchState.cat = k === "world" ? "" : searchState.cat; searchState.service = ""; }
    searchState.shown = 12; vSearch();
  });
}
// Vertrauens-Abzeichen eines Betriebs. Beispielbetriebe (is_demo) zeigen
// bewusst weder "verifiziert" noch "Hervorgehoben" noch "Meisterbetrieb":
// Ein erfundener Betrieb mit Prüfsiegel wäre irreführend.
function trustBadges(ws, style = "") {
  const b = (cls, txt) => `<span class="badge ${cls}" style="${style}">${txt}</span>`;
  if (ws.is_demo) return b("b-blue", "Beispielbetrieb");
  return (ws.is_premium ? b("b-gold", "Hervorgehoben") : "")
    + (ws.is_verified ? b("b-green", "✓ verifiziert") : "")
    + (ws.master_certified ? b("b-gold", "Meisterbetrieb") : "");
}
function wsCardHtml(ws) {
  const d = ws._dist;
  const open = isOpenNow(ws.opening_hours);
  const inCompare = compareSet.includes(ws.id);
  return `<div class="card tap" style="margin-bottom:12px" onclick="go('workshop/${ws.id}')">
    <div class="wsCard">
      <div class="wsAv" style="${ws.logo_url ? `background-image:url('${esc(ws.logo_url)}');background-size:cover;background-position:center;color:transparent` : avStil(ws.name)}">${esc(initials(ws.name))}</div>
      <div style="flex:1;min-width:0">
        <div class="tt">${esc(ws.name)} ${trustBadges(ws, "vertical-align:2px")}
          ${open === true ? '<span class="badge b-green" style="vertical-align:2px">Geöffnet</span>' : open === false ? '<span class="badge b-grey" style="vertical-align:2px">Geschlossen</span>' : ""}</div>
        <div class="ratingLine">${stars(ws.rating_avg)}<span class="cnt">${ws.rating_avg > 0 ? Number(ws.rating_avg).toLocaleString("de-DE") : "Neu"} · ${ws.rating_count || 0} Bewertungen</span></div>
        <div class="mm">${esc(ws.district || ws.city || "")}${d != null ? ` · ${d.toFixed(1).replace(".", ",")} km` : ""}${ws.service_mode !== "stationary" ? " · mobil" : ""}${ws.pickup_service ? " · Hol/Bring" : ""}${ws.replacement_car ? " · Ersatzwagen" : ""}${ws.price_level ? " · " + priceLevelTxt(ws.price_level) : ""}</div>
        ${ws.next_free_date ? `<div class="mm" style="color:var(--green)">Nächster freier Termin: ${new Date(ws.next_free_date) <= new Date() ? "heute" : fmtDate(ws.next_free_date)}</div>` : ""}
        <div class="chips" style="margin-top:9px">${ws.categories.slice(0, 4).map(c => `<span class="pill">${ico(c)} ${CATS[c]?.name || c}</span>`).join("")}</div>
      </div>
      <button class="btn ghost sm cmpBtn" style="flex-shrink:0" onclick="event.stopPropagation();toggleCompare('${ws.id}')" aria-label="${inCompare ? "Aus dem Vergleich entfernen" : "Zum Vergleich hinzufügen"}">${inCompare ? "✓" : "⇄"}<span class="cmpTxt">${inCompare ? " Im Vergleich" : " Vergleichen"}</span></button>
    </div>
  </div>`;
}
function toggleCompare(id) {
  const i = compareSet.indexOf(id);
  if (i >= 0) compareSet.splice(i, 1);
  else {
    if (compareSet.length >= 3) return toast("Maximal 3 Werkstätten vergleichbar.");
    compareSet.push(id);
  }
  applyFilters();
}
function renderCompareBar() {
  const bar = $("compareBar");
  if (!bar) return;
  bar.innerHTML = compareSet.length < 2 ? "" : `
    <div style="position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:60;background:var(--panel2);border:1px solid var(--line2);border-radius:99px;padding:9px 10px 9px 18px;display:flex;gap:12px;align-items:center;box-shadow:0 18px 50px rgba(0,0,0,.5)">
      <span style="font-size:13px;font-weight:700">${compareSet.length} Werkstätten ausgewählt</span>
      <a class="btn sm" href="#/vergleich">Vergleichen →</a>
    </div>`;
}

// ============================================================
// WERKSTATTPROFIL (öffentlich)
// ============================================================
// Google-Sterne und -Fotos – nur wenn der Betrieb seinen Eintrag verknüpft und
// Carfixo die Zuordnung bestätigt hat. Bewusst getrennt von den Carfixo-
// Bewertungen: die stammen nachweislich aus Buchungen (§ 5b UWG), Google-
// Bewertungen prüfen wir nicht. Sie zählen auch nicht für Ranking und Schnitt.
async function ladeGoogle(ws) {
  if (!ws.google_place_id || !ws.google_place_confirmed) return;
  // Jeder Abruf kostet bei Google Geld. Darum: Sterne 10 Minuten im Browser
  // merken und Fotos erst laden, wenn jemand sie sehen will.
  const merk = "cfx_g_" + ws.google_place_id;
  let g = null;
  try { const m = JSON.parse(sessionStorage.getItem(merk) || "null"); if (m && Date.now() - m.t < 600000) g = m.g; } catch (_) {}
  if (!g) {
    try {
      const r = await fetch(API + "/api/google-place?id=" + encodeURIComponent(ws.google_place_id));
      if (!r.ok) return;
      g = await r.json();
      try { sessionStorage.setItem(merk, JSON.stringify({ t: Date.now(), g })); } catch (_) {}
    } catch (_) { return; }
  }
  const st = $("gStars");
  if (st && g.sterne) {
    st.innerHTML = `<a class="gStars" href="${esc(g.link)}" target="_blank" rel="noopener">
      <span>★ ${String(g.sterne).replace(".", ",")}</span> bei Google · ${Number(g.anzahl).toLocaleString("de-DE")} Bewertungen ↗</a>`;
  }
  const box = $("gBox");
  const fotos = (g.fotos || []).slice(0, 4);
  if (!box || !fotos.length) return;
  box.innerHTML = `<div class="tt">Fotos von Google</div>
    <button class="btn ghost sm" id="gFotosZeigen" style="margin-top:10px">${fotos.length} Fotos von Google ansehen</button>`;
  box.hidden = false;
  $("gFotosZeigen").onclick = () => {
    const src = (f) => API + "/api/google-place?foto=" + encodeURIComponent(f.name);
    const autoren = [...new Set(fotos.flatMap(f => f.autoren.map(a => a.name)).filter(Boolean))].slice(0, 4);
    box.innerHTML = `<div class="tt">Fotos von Google</div>
      <div class="thumbs" id="gFotos" style="margin-top:10px">${fotos.map(f => `<img src="${src(f)}" data-full="${src(f)}" style="width:110px;height:110px;cursor:zoom-in" alt="Foto des Betriebs von Google">`).join("")}</div>
      <p class="mm" style="margin-top:8px;font-size:11px">Fotos über Google${autoren.length ? " · " + autoren.map(esc).join(", ") : ""}</p>`;
    box.querySelectorAll("img").forEach(im => im.onclick = () => openLightbox(im.dataset.full));
  };
}
async function vWorkshopProfile(id) {
  if (!id) return go("search");
  main.innerHTML = `<div class="sk" style="height:200px"></div>`;
  const [{ data: ws, error }, { data: reviews }] = await Promise.all([
    sb.from("workshops").select("*").eq("id", id).maybeSingle(),
    sb.from("reviews").select("*").eq("workshop_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  if (error || !ws) { main.innerHTML = `<div class="warn">Werkstatt nicht gefunden.</div>`; return; }
  const oh = ws.opening_hours || {};
  const days = [["mo", "Montag"], ["di", "Dienstag"], ["mi", "Mittwoch"], ["do", "Donnerstag"], ["fr", "Freitag"], ["sa", "Samstag"], ["so", "Sonntag"]];
  main.innerHTML = `
  ${ws.cover_url ? `<div style="height:180px;border-radius:20px;margin-bottom:-40px;background-image:url('${esc(ws.cover_url)}');background-size:cover;background-position:center;border:1px solid var(--line)"></div>` : ""}
  <div class="pageHead" style="${ws.cover_url ? "position:relative;padding:0 18px" : ""}">
    <div class="wsAv" style="width:64px;height:64px;font-size:23px;${ws.logo_url ? `background-image:url('${esc(ws.logo_url)}');background-size:cover;background-position:center;color:transparent;` : avStil(ws.name)}${ws.cover_url ? "border:3px solid var(--bg);" : ""}">${esc(initials(ws.name))}</div>
    <div style="flex:1">
      <h1>${esc(ws.name)} ${ws.is_demo ? '<span class="badge b-blue" style="vertical-align:6px">Beispielbetrieb</span>'
        : `${ws.is_premium ? '<span class="badge b-gold" style="vertical-align:6px">Hervorgehoben</span>' : ""} ${ws.is_verified ? '<span class="badge b-green" style="vertical-align:6px">✓ Verifiziert durch Carfixo</span>' : ""}`}</h1>
      <div class="ratingLine" style="margin-top:4px">${stars(ws.rating_avg)}<span class="cnt">${ws.rating_avg > 0 ? Number(ws.rating_avg).toLocaleString("de-DE") : "Neu"} · ${ws.rating_count || 0} Bewertungen · ${esc(ws.district || ws.city || "Köln")}</span></div>
      <div id="gStars"></div>
      ${openStatusLine(ws.opening_hours)}
    </div>
    <div class="right">
      <button class="btn ghost sm" id="wsFav">Merken</button>
      <button class="btn ghost sm" onclick="openReportModal('workshop','${ws.id}','${ws.id}',${jsArg(ws.name)})" title="Betrieb melden" aria-label="Betrieb melden">${ico("flag")}</button>
      <button class="btn" id="wsAsk" ${ws.is_demo && !istTester() ? "disabled" : ""}>Anfrage stellen</button>
    </div>
  </div>
  ${ws.is_demo ? `<div class="note" style="margin-bottom:14px"><b>Das ist ein Beispielbetrieb.</b>
    Er zeigt, wie ein Werkstattprofil auf Carfixo aussieht. Anfragen und Bestellungen sind hier nicht möglich –
    nutze die <a href="#/search" style="color:var(--blue2)">Suche</a> oder stelle eine
    <a href="#/new-request" style="color:var(--blue2)">Ausschreibung</a> an alle passenden Betriebe.</div>` : ""}
  <div class="searchGrid" style="grid-template-columns:1fr 340px">
    <div>
      <div class="card" style="margin-bottom:14px">
        <div class="tt">Über den Betrieb</div>
        <p class="mm" style="margin-top:8px;font-size:13px">${esc(ws.description || "Keine Beschreibung hinterlegt.")}</p>
        ${ws.founded_year ? `<p class="mm" style="margin-top:6px">Gegründet ${ws.founded_year}</p>` : ""}
        <div class="foot" style="border:none;padding-top:8px">
          ${ws.master_certified && !ws.is_demo ? '<span class="badge b-gold">Meisterbetrieb</span>' : ""}
          ${ws.service_mode !== "stationary" ? '<span class="badge b-blue">Mobiler Service</span>' : ""}
          ${ws.pickup_service ? '<span class="badge b-blue">Hol- & Bringservice</span>' : ""}
          ${ws.replacement_car ? '<span class="badge b-blue">Ersatzwagen</span>' : ""}
          ${ws.emergency_service ? '<span class="badge b-red">Notdienst</span>' : ""}
          ${ws.price_level ? `<span class="badge b-grey">Preisniveau ${priceLevelTxt(ws.price_level)}</span>` : ""}
          ${ws.hourly_rate ? `<span class="badge b-grey">Stundensatz ab ${Math.round(ws.hourly_rate)} €</span>` : ""}
          ${ws.next_free_date ? `<span class="badge b-green">Frei ab ${new Date(ws.next_free_date) <= new Date() ? "heute" : fmtDate(ws.next_free_date)}</span>` : ""}
        </div>
        <div class="offerLine" style="margin-top:8px"><span>Abgeschlossene Aufträge über Carfixo</span><span><b>${ws.rating_count || 0}</b></span></div>
        ${(ws.payment_methods || []).length ? `<div class="offerLine"><span>Zahlungsmöglichkeiten</span><span>${ws.payment_methods.map(esc).join(" · ")}</span></div>` : ""}
      </div>
      <div class="card fpCard" style="margin-bottom:14px" id="fpBox" hidden></div>
      <div class="card" style="margin-bottom:14px" id="gBox" hidden></div>
      ${(ws.gallery || []).length ? `<div class="card" style="margin-bottom:14px">
        <div class="tt">Einblicke & Referenzen</div>
        <div class="thumbs" id="wsGallery" style="margin-top:10px">${ws.gallery.map(u => `<img src="${esc(u)}" loading="lazy" data-full="${esc(u)}" style="width:110px;height:110px;cursor:zoom-in" alt="Werkstattbild">`).join("")}</div>
      </div>` : ""}
      <div class="card" style="margin-bottom:14px">
        <div class="tt">Leistungen</div>
        ${ws.categories.map(c => `
          <div class="label">${ico(c)} ${CATS[c]?.name || c}</div>
          <div class="chips">${(ws.services || []).filter(s => (CATS[c]?.services || []).includes(s)).map(s => `<span class="pill">${esc(s)}</span>`).join("") || '<span class="mm">Alle Leistungen dieser Kategorie</span>'}</div>`).join("")}
        ${(ws.brands || []).length ? `<div class="label">Spezialisiert auf Marken</div><div class="chips">${ws.brands.map(b => `<span class="pill">${esc(b)}</span>`).join("")}</div>` : ""}
      </div>
      <div class="card">
        <div class="tt">Bewertungen (${reviews?.length || 0})</div>
        <div id="revList">${(reviews || []).length === 0
          ? `<div class="empty" style="padding:22px"><div class="e">${ico("star", 40)}</div>Noch keine Bewertungen.</div>`
          : reviews.map(r => `
            <div style="padding:13px 0;border-bottom:1px solid var(--line)">
              <div class="ratingLine">${stars(r.rating)}<span class="cnt">${fmtDate(r.created_at)}</span>
                <button class="btn ghost sm" style="float:right;padding:4px 8px;letter-spacing:0" onclick="openReportModal('review','${r.id}','${ws.id}','Bewertung melden')" title="Bewertung melden" aria-label="Bewertung melden">${ico("flag")}</button></div>
              ${r.comment ? `<p class="mm" style="margin-top:5px;font-size:13px">${esc(r.comment)}</p>` : ""}
              ${(r.images || []).length ? `<div class="thumbs rvThumbs" style="margin-top:8px">${r.images.map(u => `<img src="${esc(u)}" loading="lazy" data-full="${esc(u)}" style="width:74px;height:74px;cursor:zoom-in" alt="Bewertungsfoto">`).join("")}</div>` : ""}
            </div>`).join("")}</div>
      </div>
    </div>
    <div>
      <div class="card" style="margin-bottom:14px">
        <div class="tt">Kontakt & Anfahrt</div>
        <p class="mm" style="margin-top:8px">${esc(ws.street || "")}<br>${esc(ws.zip || "")} ${esc(ws.city || "Köln")}${ws.district ? "-" + esc(ws.district) : ""}</p>
        ${ws.phone ? `<p class="mm" style="margin-top:5px">${esc(ws.phone)}</p>` : ""}
        ${ws.website ? `<p class="mm" style="margin-top:3px">${esc(ws.website)}</p>` : ""}
        ${mapsDirUrl(ws) ? `<a class="btn ghost sm wide" style="margin-top:12px;text-decoration:none"
          href="${esc(mapsDirUrl(ws))}" target="_blank" rel="noopener noreferrer">
          ${ico("pin")} Route in Google Maps</a>` : ""}
        <div class="mapWrap" style="height:200px;margin-top:12px">
          <div id="wsMap"></div>
          <button class="mapConsent" id="wsMapLoad" type="button">
            ${ico("search", 20)}<b>Karte anzeigen</b>
            <span>Dabei wird eine Verbindung zu Google Maps aufgebaut.</span>
          </button>
        </div>
      </div>
      <div class="card">
        <div class="tt">Öffnungszeiten</div>
        ${days.map(([k, label]) => `<div class="offerLine"><span>${label}</span><span>${esc(oh[k] || "geschlossen")}</span></div>`).join("")}
      </div>
    </div>
  </div>`;
  $("wsAsk").onclick = () => {
    if (!requireAuth()) return;
    if (myWorkshop) return toast("Als Betrieb kannst du keine Anfragen stellen.");
    go("new-request?ws=" + ws.id);
  };
  $("wsFav").onclick = () => toggleFavorite(ws.id, $("wsFav"));
  document.querySelectorAll("#wsGallery img, #revList .rvThumbs img").forEach(im => im.onclick = () => openLightbox(im.dataset.full));
  ladeGoogle(ws);
  ladeFestpreiseProfil(ws);
  if (me) {
    sb.from("favorites").select("workshop_id").eq("user_id", me.id).eq("workshop_id", ws.id).maybeSingle()
      .then(({ data }) => { if (data && $("wsFav")) $("wsFav").textContent = "Gemerkt"; });
  }
  // Vertrauenssignale: abgeschlossene Aufträge
  sb.from("reviews").select("id", { count: "exact", head: true }).eq("workshop_id", ws.id)
    .then(({ count }) => { /* Anzahl über Bewertungen sichtbar */ });
  if (ws.lat != null && ws.lng != null) {
    // Karte erst auf Klick laden – vorher geht keine Anfrage an den Kartendienst.
    $("wsMapLoad").onclick = () => {
      $("wsMapLoad").remove();
      const m = CarfixoMaps.create("wsMap", { center: [ws.lat, ws.lng], zoom: 14, interactive: false });
      m.addDot([ws.lat, ws.lng], { radius: 9, color: "#1E6BFF", stroke: "#4D8DFF" });
    };
  } else $("wsMap").parentElement.classList.add("hidden");
}

// ============================================================
// NEUE ANFRAGE / AUSSCHREIBUNG (Kunde)
// ============================================================
let nrCat = "reparatur", nrServices = [], nrFiles = [], nrTargetWs = null;
const PARTS_OPTIONS = [
  ["werkstatt", "Werkstatt soll passende Teile wählen"],
  ["original", "Nur Originalteile (OEM)"],
  ["marke", "Marken-Ersatzteile (z.B. Bosch, ATE)"],
  ["guenstig", "Günstigste passende Teile"],
  ["gebraucht_ok", "Gebrauchte Teile erlaubt"],
  ["nachhaltig", "Generalüberholte / nachhaltige Teile bevorzugt"],
  ["selbst", "Ich bringe die Teile selbst mit"],
];
async function vNewRequest(_p, query) {
  if (!requireAuth()) return;
  nrCat = query.cat && CATS[query.cat] ? query.cat : "reparatur";
  nrServices = query.service ? [query.service] : [];
  nrFiles = []; nrTargetWs = null;
  if (query.ws) {
    // select("*") statt fester Spaltenliste: is_demo kommt erst mit der
    // Migration 2026-10-18. Eine explizit genannte, fehlende Spalte ließe die
    // Abfrage scheitern und Direktanfragen bis dahin komplett ausfallen.
    const { data: ws } = await sb.from("workshops").select("*").eq("id", query.ws).maybeSingle();
    if (ws?.is_demo) {
      toast("Das ist ein Beispielbetrieb – deine Anfrage geht stattdessen an alle passenden Betriebe.");
    } else {
      nrTargetWs = ws;
    }
    if (ws && ws.categories?.length && !query.cat) nrCat = ws.categories[0];
  }
  const { data: cars } = await sb.from("vehicles").select("*").eq("owner_id", me.id).order("created_at");
  main.innerHTML = `
  <div class="pageHead"><div>
    <h1>${nrTargetWs ? "Direktanfrage" : "Ausschreibung erstellen"}</h1>
    <div class="sub">${nrTargetWs ? "Deine Anfrage geht direkt an den gewählten Betrieb." : "Deine Ausschreibung sehen alle passenden, verifizierten Betriebe – sie melden sich mit Angeboten."}</div>
  </div></div>
  ${nrTargetWs ? `<div class="note">Direktanfrage an <b>${esc(nrTargetWs.name)}</b> – nur dieser Betrieb sieht deine Anfrage und kann dir ein Angebot machen.</div>` : ""}
  <div class="grid2" style="align-items:start">
    <div class="card">
      <div class="label" style="margin-top:0">Fahrzeug (optional)</div>
      <div class="split" style="align-items:stretch">
        <select id="nCar"><option value="">Kein Fahrzeug / später ergänzen</option>${(cars || []).map((c, i) => `<option value="${c.id}" ${i === 0 ? "selected" : ""}>${esc(carLabel(c))}</option>`).join("")}</select>
        <button type="button" class="btn ghost sm" id="nCarAdd" style="flex:0 0 auto">＋ Fahrzeug</button>
      </div>
      ${(cars || []).length === 0 ? `<p class="mm" style="margin-top:5px">Tipp: Mit hinterlegtem Fahrzeug werden die Angebote genauer – du kannst es aber auch weglassen.</p>` : ""}
      <div class="label">Kategorie *</div>
      <div class="catGrid" id="nCats">${Object.entries(CATS).map(([k, v]) => `
        <div class="catCard ${k === nrCat ? "on" : ""}" data-k="${k}"><span class="ce">${ico(k)}</span><span class="cn">${v.name}</span></div>`).join("")}</div>
      <div class="label">Gewünschte Leistungen (optional)</div>
      <input id="nSvcFilter" placeholder="Leistung suchen…" style="margin-bottom:6px">
      <div class="chips" id="nServices"></div>
      <button type="button" class="btn ghost sm" id="nSvcMore" style="margin-top:8px;display:none"></button>
      <div id="nPriceHint"></div>
      <div class="label">Titel (optional)</div>
      <input id="nTitle" placeholder="z.B. Bremsen vorne erneuern" maxlength="80" value="${esc(query.title || "")}">
      <div class="label">Beschreibung (optional)</div>
      <textarea id="nDesc" placeholder="Was ist das Problem? Was soll gemacht werden? (optional, hilft aber bei genauen Angeboten)">${esc(query.desc || "")}</textarea>
      <div class="uploadTile" style="margin-top:12px" onclick="$('nFile').click()">
        <div class="ico icoPurple">${ico("camera", 20)}</div>
        <div><div class="tt" style="font-size:12.5px">Fotos oder Video vom Problem (optional)</div>
        <div class="mm">Bis zu 4 Dateien – ein kurzes Video (z.B. vom Geräusch) hilft Betrieben besonders</div></div>
      </div>
      <input type="file" id="nFile" accept="image/*,video/*" multiple class="hidden">
      <div class="thumbs" id="nThumbs"></div>
      <button class="btn ghost sm" style="margin-top:10px" id="nAnalyze">Beschreibung analysieren</button>
      <div id="nAiOut"></div>
    </div>
    <div class="card">
      <div class="label" style="margin-top:0">Dringlichkeit</div>
      <div class="seg" style="margin:4px 0 0" id="nUrgency">
        <div data-u="normal" class="${(query.urgency || "normal") === "normal" ? "on" : ""}">Normal</div>
        <div data-u="dringend" class="${query.urgency === "dringend" ? "on" : ""}">Dringend</div>
        <div data-u="notfall" class="${query.urgency === "notfall" ? "on" : ""}">Notfall</div>
      </div>
      <div class="label">Teile-Wunsch</div>
      <select id="nParts">${PARTS_OPTIONS.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>
      <div class="label">Budget in € (optional)</div>
      <input id="nBudget" inputmode="numeric" placeholder="z.B. 250">
      <div class="label">Ort</div>
      <div class="split">
        <select id="nCity"><option>Köln</option></select>
        <select id="nDistrict">${opt("Stadtteil (optional)", Object.keys(DISTRICTS), "")}</select>
      </div>
      <input id="nZip" inputmode="numeric" maxlength="5" placeholder="PLZ (optional)" style="margin-top:8px">
      <p class="mm" style="margin-top:6px;font-size:11px">Deine genaue Adresse wird Betrieben nie öffentlich angezeigt.</p>
      <div class="label">Wunschtermin (optional)</div>
      <input id="nDate" type="date" min="${new Date().toISOString().slice(0, 10)}">
      <label class="inline"><input type="checkbox" id="nFlex"> Termin flexibel</label>
      <label class="inline"><input type="checkbox" id="nAsap"> So schnell wie möglich</label>
      <div class="label">Service-Art</div>
      <select id="nMode">
        <option value="both">Egal – Werkstatt oder mobil</option>
        <option value="stationary">In der Werkstatt</option>
        <option value="mobile">Mobiler Service (bei mir vor Ort)</option>
      </select>
      <button class="btn wide" style="margin-top:20px" id="nGo">${nrTargetWs ? "Anfrage senden" : "Ausschreibung veröffentlichen"}</button>
      <div class="err" id="nErr"></div>
      <p class="mm" style="margin-top:10px;font-size:11px">Die Reparaturleistung und Rechnung werden durch die ausgewählte Werkstatt erbracht – Carfixo vermittelt.</p>
    </div>
  </div>`;
  renderNrServices();
  document.querySelectorAll("#nCats .catCard").forEach(c => c.onclick = () => {
    nrCat = c.dataset.k; nrServices = []; nrSvcExpanded = false;
    if ($("nSvcFilter")) $("nSvcFilter").value = "";
    document.querySelectorAll("#nCats .catCard").forEach(x => x.classList.toggle("on", x === c));
    renderNrServices();
  });
  // Dringlichkeit
  document.querySelectorAll("#nUrgency div").forEach(d => d.onclick = () => {
    document.querySelectorAll("#nUrgency div").forEach(x => x.classList.toggle("on", x === d));
  });
  // ASAP vs. Wunschtermin/flexibel: Gegenpunkt wird sichtbar deaktiviert
  const syncDateExclusive = () => {
    const asap = $("nAsap").checked;
    $("nDate").disabled = asap;
    $("nFlex").disabled = asap;
    if (asap) { $("nDate").value = ""; $("nFlex").checked = false; }
    $("nAsap").disabled = !!$("nDate").value || $("nFlex").checked;
  };
  $("nAsap").onchange = syncDateExclusive;
  $("nFlex").onchange = syncDateExclusive;
  $("nDate").onchange = syncDateExclusive;
  syncDateExclusive();
  $("nFile").onchange = handleNrFiles;
  $("nAnalyze").onclick = runAiAnalyze;
  $("nCarAdd").onclick = () => openVehicleForm();
  $("nGo").onclick = () => submitRequest(cars || []);
}
let nrSvcExpanded = false;
const NR_SVC_LIMIT = 8;
function renderNrServices() {
  const all = CATS[nrCat].services;
  const flt = $("nSvcFilter");
  const q = (flt?.value || "").trim().toLowerCase();
  // Bei aktiver Suche alle Treffer zeigen, sonst nur die ersten NR_SVC_LIMIT + Gewählte
  let visible;
  if (q) visible = all.filter(s => s.toLowerCase().includes(q));
  else if (nrSvcExpanded) visible = all;
  else visible = all.filter((s, i) => i < NR_SVC_LIMIT || nrServices.includes(s));
  $("nServices").innerHTML = visible.map(s =>
    `<span class="chip ${nrServices.includes(s) ? "on" : ""}" data-s="${esc(s)}">${esc(s)}</span>`).join("");
  document.querySelectorAll("#nServices .chip").forEach(c => c.onclick = () => {
    const s = c.dataset.s;
    const i = nrServices.indexOf(s);
    if (i >= 0) nrServices.splice(i, 1); else nrServices.push(s);
    c.classList.toggle("on");
    renderNrPriceHint();
  });
  const hidden = all.length - visible.length;
  const more = $("nSvcMore");
  if (more) {
    if (q || all.length <= NR_SVC_LIMIT) { more.style.display = "none"; }
    else {
      more.style.display = "";
      more.textContent = nrSvcExpanded ? "Weniger anzeigen" : `Mehr anzeigen (+${hidden})`;
      more.onclick = () => { nrSvcExpanded = !nrSvcExpanded; renderNrServices(); };
    }
  }
  if (flt) {
    flt.style.display = all.length > NR_SVC_LIMIT ? "" : "none";
    flt.oninput = () => renderNrServices();
  }
  renderNrPriceHint();
}
// Unverbindliche Preisorientierung zu den gewählten Leistungen
function renderNrPriceHint() {
  const box = $("nPriceHint");
  if (!box) return;
  const carSel = $("nCar");
  const car = window._nrCars?.find?.(c => c.id === carSel?.value) || null;
  const hints = nrServices.map(s => ({ s, r: priceRange(s, car) })).filter(x => x.r);
  box.innerHTML = hints.length === 0 ? "" : `
    <div class="note" style="margin-top:10px"><b>Unverbindliche Preisorientierung:</b><br>
    ${hints.map(h => `${esc(h.s)}: häufig <b>${h.r.lo}–${h.r.hi} €</b>${h.r.note ? " (" + esc(h.r.note) + ")" : ""}`).join("<br>")}
    <br><span style="font-size:11px;opacity:.8">Der endgültige Preis hängt von Fahrzeug, Region und Befund ab und wird von der Werkstatt festgelegt.</span></div>`;
}
function handleNrFiles() {
  // Bilder bis 8 MB, Videos bis 40 MB
  const files = [...$("nFile").files].slice(0, 4 - nrFiles.length);
  files.forEach(f => { const lim = f.type.startsWith("video") ? 40 : 8; if (f.size < lim * 1024 * 1024) nrFiles.push(f); });
  $("nThumbs").innerHTML = nrFiles.map(f => f.type.startsWith("video")
    ? `<span class="pill">${ico("camera")} ${esc(f.name.slice(0, 22))}</span>`
    : `<img src="${URL.createObjectURL(f)}" loading="lazy" alt="">`).join("");
}
// Anhang als Bild oder Video darstellen (nach Dateiendung)
function mediaTile(url) {
  return /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(url)
    ? `<video src="${esc(url)}" controls preload="metadata" style="width:130px;height:100px;object-fit:cover;border-radius:10px;border:1px solid var(--line2)"></video>`
    : `<a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" loading="lazy" alt="Anhang"></a>`;
}
function runAiAnalyze() {
  const hits = aiAnalyze($("nTitle").value + " " + $("nDesc").value);
  $("nAiOut").innerHTML = hits.length === 0
    ? `<div class="warn" style="margin-top:12px">Keine eindeutige Einschätzung möglich – beschreibe das Problem etwas genauer (Geräusch, Warnlampe, wann tritt es auf?).</div>`
    : `<div class="note" style="margin-top:12px"><b>Unverbindliche Ersteinschätzung:</b><br>${hits.map((h, i) => `
        <div style="margin-top:8px">• Mögliche Ursache: <b>${esc(h.guess)}</b> <span class="badge ${h.conf === "hoch" ? "b-green" : "b-gold"}">${h.conf}e Wahrscheinlichkeit</span><br>
        <a href="#" data-ai="${i}" style="color:var(--blue2);font-size:12px;font-weight:700">→ Kategorie „${CATS[h.cat].name}" + „${esc(h.service)}" übernehmen</a></div>`).join("")}
      <br><span style="font-size:11px;opacity:.8">Empfohlene Prüfung durch eine Fachwerkstatt – dies ist keine verbindliche Diagnose.</span></div>`;
  document.querySelectorAll("[data-ai]").forEach(a => a.onclick = (e) => {
    e.preventDefault();
    const h = hits[+a.dataset.ai];
    nrCat = h.cat; nrServices = [h.service];
    document.querySelectorAll("#nCats .catCard").forEach(x => x.classList.toggle("on", x.dataset.k === h.cat));
    renderNrServices();
    toast("Übernommen: " + CATS[h.cat].name);
  });
}
async function submitRequest(cars) {
  window._nrCars = cars;
  const err = $("nErr"); err.style.display = "none";
  let title = $("nTitle").value.trim();
  const desc = $("nDesc").value.trim();
  // Fahrzeug ist optional – Titel & Beschreibung ebenso (Titel notfalls aus Kategorie/Leistungen)
  if (!title) {
    title = nrServices.length ? `${CATS[nrCat].name}: ${nrServices.slice(0, 3).join(", ")}` : CATS[nrCat].name;
  }
  const budget = ($("nBudget").value || "").trim();
  if (budget && !(parseFloat(budget.replace(",", ".")) > 0)) return showErr(err, "Das Budget muss eine Zahl sein.");
  const zip = $("nZip").value.trim();
  if (zip && !/^\d{5}$/.test(zip)) return showErr(err, "Die PLZ muss 5 Ziffern haben.");
  const carId = $("nCar").value || null;
  const car = carId ? cars.find(c => c.id === carId) : null;
  const urgency = document.querySelector("#nUrgency div.on")?.dataset.u || "normal";
  $("nGo").disabled = true;
  $("nGo").textContent = "Wird veröffentlicht…";
  // Fotos hochladen
  const attachments = [];
  for (const f of nrFiles) {
    const path = `${me.id}/${Date.now()}_${f.name.replace(/[^\w.\-]/g, "_")}`;
    const { error: upErr } = await sb.storage.from("attachments").upload(path, f);
    if (!upErr) {
      const { data } = sb.storage.from("attachments").getPublicUrl(path);
      attachments.push(data.publicUrl);
    }
  }
  const { data: req, error } = await sb.from("requests").insert({
    customer_id: me.id, vehicle_id: carId, vehicle_label: car ? carLabel(car) : null,
    // vehicle_id darf leer sein (Fahrzeug optional)
    category: nrCat, title, description: desc || null,
    budget_max: parseFloat(budget.replace(",", ".")) || null,
    extras: { leistungen: nrServices }, attachments,
    urgency, parts_preference: $("nParts").value,
    city: "Köln", district: $("nDistrict").value || null, zip: zip || null,
    preferred_date: $("nDate").value || null, date_flexible: $("nFlex").checked, asap: $("nAsap").checked,
    status: "open", service_preference: $("nMode").value,
    type: nrTargetWs ? "direct" : "open", workshop_id: nrTargetWs ? nrTargetWs.id : null,
  }).select().single();
  $("nGo").disabled = false;
  $("nGo").textContent = nrTargetWs ? "Anfrage senden" : "Ausschreibung veröffentlichen";
  if (error) return showErr(err, error.message);
  toast(nrTargetWs ? "Anfrage gesendet ✓" : "Ausschreibung veröffentlicht ✓");
  go("request/" + req.id);
}

// ============================================================
// MEINE AUFTRÄGE (Kunde)
// ============================================================
let reqFilter = "alle";
async function vRequests() {
  if (!requireAuth()) return;
  main.innerHTML = `
  <div class="pageHead">
    <div><h1>Meine Aufträge</h1><div class="sub">Ausschreibungen, Direktanfragen, Angebote und Buchungen.</div></div>
    <div class="right"><a class="btn sm" href="#/new-request">＋ Neue Anfrage</a></div>
  </div>
  <div class="seg" id="reqSeg">
    <div data-f="alle" class="${reqFilter === "alle" ? "on" : ""}">Alle</div>
    <div data-f="open" class="${reqFilter === "open" ? "on" : ""}">Offen</div>
    <div data-f="booked" class="${reqFilter === "booked" ? "on" : ""}">Gebucht</div>
    <div data-f="done" class="${reqFilter === "done" ? "on" : ""}">Abgeschlossen</div>
  </div>
  <div id="reqList"><div class="sk" style="height:110px"></div></div>`;
  document.querySelectorAll("#reqSeg div").forEach(d => d.onclick = () => {
    reqFilter = d.dataset.f;
    document.querySelectorAll("#reqSeg div").forEach(x => x.classList.toggle("on", x === d));
    loadRequestList();
  });
  await loadRequestList();
}
async function loadRequestList() {
  const [{ data: reqs, error }, { data: bks }] = await Promise.all([
    sb.from("requests").select("*, offers(count)").eq("customer_id", me.id).order("created_at", { ascending: false }),
    sb.from("bookings").select("id,status,offer_id,offers(request_id)").eq("customer_id", me.id),
  ]);
  const box = $("reqList");
  if (!box) return;
  if (error) { box.innerHTML = `<div class="warn">${esc(error.message)}</div>`; return; }
  const bkMap = {};
  (bks || []).forEach(b => { if (b.offers) bkMap[b.offers.request_id] = b; });
  let list = reqs || [];
  if (reqFilter === "open") list = list.filter(r => r.status === "open");
  if (reqFilter === "booked") list = list.filter(r => bkMap[r.id] && !["completed", "cancelled"].includes(bkMap[r.id].status));
  if (reqFilter === "done") list = list.filter(r => bkMap[r.id] && bkMap[r.id].status === "completed");
  if (list.length === 0) { box.innerHTML = `<div class="empty"><div class="e">${ico("megaphone",40)}</div>Keine Aufträge in dieser Ansicht.</div>`; return; }
  box.innerHTML = list.map(r => {
    const c = CATS[r.category] || { icon: "", name: r.category };
    const n = r.offers?.[0]?.count || 0;
    const bk = bkMap[r.id];
    let st;
    if (bk && BK_STATUS[bk.status]) st = `<span class="badge ${BK_STATUS[bk.status][1]}">${BK_STATUS[bk.status][0]}</span>`;
    else if (r.status === "open") st = n > 0 ? `<span class="badge b-blue">${n} Angebot${n > 1 ? "e" : ""}</span>` : `<span class="badge b-green">Offen</span>`;
    else st = `<span class="badge b-grey">${esc(r.status)}</span>`;
    return `<div class="card tap" style="margin-bottom:11px" onclick="go('request/${r.id}')">
      <div class="cardHead"><div class="ico">${ico(r.category)}</div>
        <div style="flex:1;min-width:0"><div class="tt">${esc(r.title)} ${r.type === "direct" ? '<span class="badge b-purple">Direkt</span>' : ""}</div>
        <div class="mm">${esc(r.vehicle_label || "")}</div>
        <div class="mm">${c.name}${r.district ? " · " + esc(r.district) : ""}${r.asap ? " · ASAP" : r.preferred_date ? " · " + fmtDate(r.preferred_date) : ""}</div></div>
        ${st}</div>
      <div class="foot"><span class="mm">${fmtDate(r.created_at)}</span><b style="color:var(--blue2)">Ansehen →</b></div>
    </div>`;
  }).join("");
}

// ============================================================
// AUFTRAGS-DETAIL: Angebote vergleichen, Chat, Bewertung
// ============================================================
async function vRequestDetail(id) {
  if (!requireAuth() || !id) return;
  main.innerHTML = `<div class="sk" style="height:220px"></div>`;
  const { data: r } = await sb.from("requests").select("*").eq("id", id).maybeSingle();
  if (!r) { main.innerHTML = `<div class="warn">Auftrag nicht gefunden.</div>`; return; }
  const c = CATS[r.category] || { icon: "", name: r.category };
  const booked = r.status === "booked";
  main.innerHTML = `
  <div class="pageHead">
    <div class="ico" style="width:52px;height:52px;font-size:23px">${ico(r.category)}</div>
    <div style="flex:1"><h1>${esc(r.title)}</h1>
    <div class="sub">${esc(r.vehicle_label || "")} · ${c.name}${r.type === "direct" ? " · Direktanfrage" : ""}</div></div>
    <div class="right">
      <button class="btn ghost sm" onclick="openReportModal('request','${r.id}',null,'Auftrag melden')" title="Problem melden" aria-label="Problem melden">${ico("flag")}</button>
      ${r.status === "open" ? `<button class="btn red sm" id="rCancel">Zurückziehen</button>` : ""}
    </div>
  </div>
  <div class="grid2" style="align-items:start">
    <div>
      <div class="card" style="margin-bottom:14px">
        <div class="tt">Details</div>
        <p class="mm" style="margin-top:8px;font-size:13px">${esc(r.description)}</p>
        <div class="chips" style="margin-top:10px">
          ${(r.extras?.leistungen || []).map(s => `<span class="pill">${esc(s)}</span>`).join("")}
          ${r.budget_max ? `<span class="pill">Budget bis ${fmtEur(r.budget_max)}</span>` : ""}
          ${r.district ? `<span class="pill">${esc(r.district)}</span>` : ""}
          ${r.asap ? `<span class="pill">ASAP</span>` : ""}
          ${r.preferred_date ? `<span class="pill">${fmtDate(r.preferred_date)}</span>` : ""}
          ${r.date_flexible ? `<span class="pill">flexibel</span>` : ""}
        </div>
        ${(r.attachments || []).length ? `<div class="thumbs">${r.attachments.map(u => mediaTile(u)).join("")}</div>` : ""}
      </div>
      <div id="bookingBox"></div>
      <div class="card">
        <div class="tt">Angebote <span id="offCount" class="badge b-blue"></span></div>
        <div id="offers" style="margin-top:12px"><div class="sk" style="height:80px"></div></div>
      </div>
    </div>
    <div class="card">
      <div class="tt">Chat</div>
      <div class="msgs" id="msgs"></div>
      <div class="msgRow"><input id="msgIn" placeholder="Nachricht schreiben…"><button id="msgGo" aria-label="Nachricht senden">${ico("send")}</button></div>
    </div>
  </div>`;
  if ($("rCancel")) $("rCancel").onclick = async () => {
    if (!(await frage("Die Werkstätten sehen deine Anfrage danach nicht mehr.", { titel: "Anfrage zurückziehen?", ja: "Zurückziehen", gefahr: true }))) return;
    const { error } = await sb.from("requests").update({ status: "cancelled" }).eq("id", r.id);
    if (error) toast(error.message); else { toast("Zurückgezogen."); go("requests"); }
  };
  $("msgGo").onclick = () => sendMsg(r.id);
  $("msgIn").onkeydown = (e) => { if (e.key === "Enter") sendMsg(r.id); };
  await Promise.all([loadOffers(r), loadMsgs(r.id), booked ? loadBookingBox(r) : Promise.resolve()]);
  const ch = sb.channel("req:" + r.id)
    .on("postgres_changes", { event: "*", schema: "public", table: "offers", filter: "request_id=eq." + r.id }, () => loadOffers(r))
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "request_id=eq." + r.id }, () => loadMsgs(r.id))
    .subscribe();
  rtChannels.push(ch);
}
async function loadOffers(r) {
  const { data } = await sb.from("offers").select("*, workshops(*)").eq("request_id", r.id).order("total_price");
  const box = $("offers"); if (!box) return;
  $("offCount").textContent = (data || []).length || "";
  if (!data || data.length === 0) {
    box.innerHTML = `<div class="empty" style="padding:22px"><div class="e">${ico("clock",40)}</div>Noch keine Angebote.<br><span class="mm">Passende Betriebe sehen deine Anfrage und melden sich hier.</span></div>`;
    return;
  }
  window._offers = data;
  const minPrice = Math.min(...data.filter(o => o.status !== "withdrawn").map(o => Number(o.total_price)));
  box.innerHTML = data.map(o => {
    const w = o.workshops || {};
    const p = o.pricing || {};
    const items = (o.line_items || []).map(li => `<div class="offerLine"><span>${esc(li.label)}${li.meta ? ` <span class="mm">(${esc(li.meta)})</span>` : ""}</span><span>${fmtEur(li.price)}</span></div>`).join("");
    const best = Number(o.total_price) === minPrice && data.length > 1;
    const st = o.status === "accepted" ? '<span class="badge b-green">Angenommen ✓</span>'
      : o.status === "declined" ? '<span class="badge b-grey">Abgelehnt</span>'
      : o.status === "withdrawn" ? '<span class="badge b-grey">Zurückgezogen</span>'
      : r.status === "open" ? `<button class="btn green sm" onclick="openCheckout('${o.id}','${r.id}')">Zahlungspflichtig buchen</button>` : "";
    return `<div class="card" style="margin-bottom:11px;${best ? "border-color:rgba(43,213,138,.45)" : ""};position:relative">
      ${best ? '<span class="badge b-green" style="position:absolute;top:-9px;right:14px">Bester Preis</span>' : ""}
      <div class="cardHead">
        <div class="wsAv" style="width:42px;height:42px;font-size:15px;${w.logo_url ? `background-image:url('${esc(w.logo_url)}');background-size:cover;background-position:center;color:transparent` : avStil(w.name)}">${esc(initials(w.name))}</div>
        <div style="flex:1;min-width:0">
          <div class="tt"><a href="#/workshop/${w.id}" style="color:inherit">${esc(w.name || "Werkstatt")}</a>${w.is_verified ? " ✓" : ""}</div>
          <div class="ratingLine">${stars(w.rating_avg)}<span class="cnt">${w.rating_avg > 0 ? Number(w.rating_avg).toLocaleString("de-DE") : "Neu"} · ${w.rating_count || 0} Bew.${w.district ? " · " + esc(w.district) : ""}</span></div>
        </div>
        <div style="text-align:right"><b style="font-size:19px">${fmtEur(o.total_price)}</b><div class="mm">inkl. MwSt. · ${o.is_fixed_price === false ? "Kostenschätzung" : "Festpreis"}</div></div>
      </div>
      ${items ? `<div style="margin-top:10px">${items}</div>` : ""}
      ${p.labor_hours ? `<div class="mm" style="margin-top:6px">Arbeitszeit: ${p.labor_hours} h × ${fmtEur(p.hourly_rate || 0)}</div>` : ""}
      ${o.message ? `<p class="mm" style="margin-top:8px">${esc(o.message)}</p>` : ""}
      <div class="foot"><span class="mm">${fmtDate(o.created_at)}</span>${st}</div>
    </div>`;
  }).join("");
}

// ---------- Buchungsübersicht ----------
// Gebucht wird ohne Zahlung. Bezahlt wird nach der Reparatur – vor Ort oder,
// wenn der Betrieb Stripe verbunden hat, online (siehe "Online-Zahlung").
function openCheckout(offerId, requestId) {
  const o = (window._offers || []).find(x => x.id === offerId);
  if (!o) return;
  const w = o.workshops || {};
  const net = Number(o.total_price) / 1.19;
  openModal(`
    <h2 style="font-size:20px;font-weight:800">Buchungsübersicht</h2>
    <div class="note" style="margin-top:12px">Jetzt wird nichts berechnet. Bezahlt wird nach der Reparatur – direkt beim Betrieb${w.online_payment ? " oder bequem online in Carfixo" : ""}.</div>
    <div class="card" style="margin-top:8px;padding:14px">
      <div class="offerLine"><span>Werkstatt</span><span><b>${esc(w.name || "")}</b></span></div>
      ${(o.line_items || []).map(li => `<div class="offerLine"><span>${esc(li.label)}</span><span>${fmtEur(li.price)}</span></div>`).join("")}
      <div class="offerLine"><span>davon MwSt. (19 %)</span><span>${fmtEur(o.total_price - net)}</span></div>
      <div class="offerLine total"><span>Gesamt (${o.is_fixed_price === false ? "Kostenschätzung" : "Festpreis"})</span><span>${fmtEur(o.total_price)}</span></div>
    </div>
    <p class="mm" style="margin-top:10px;font-size:11px">
      Mit der Buchung nimmst du das Angebot verbindlich an; alle anderen Angebote werden abgelehnt.
      ${o.is_fixed_price === false ? "Bei einer Kostenschätzung kann sich der Preis nach Diagnose ändern – Zusatzarbeiten benötigen deine Freigabe." : ""}
      ${STORNO_HINWEIS}
      Die Reparaturleistung und Rechnung werden durch die ausgewählte Werkstatt erbracht.</p>
    <div class="btnRow">
      <button class="btn green" id="ckGo">Verbindlich buchen</button>
      <button class="btn ghost" onclick="closeModal()">Abbrechen</button>
    </div>
    <div class="err" id="ckErr"></div>`);
  $("ckGo").onclick = async () => {
    $("ckGo").disabled = true; $("ckGo").textContent = "Wird gebucht…";
    const { data: bkId, error } = await sb.rpc("accept_offer", { p_offer_id: offerId });
    if (error) { $("ckGo").disabled = false; $("ckGo").textContent = "Verbindlich buchen"; return showErr($("ckErr"), error.message); }
    closeModal();
    toast("Gebucht ✓ – die Werkstatt ist informiert.");
    vRequestDetail(requestId);
  };
}

const PAY_LABELS = {
  none: ["Noch nicht bezahlt", "b-grey"], payment_pending: ["Zahlung in Bearbeitung", "b-gold"],
  payment_authorized: ["Zahlung autorisiert", "b-blue"], payment_paid: ["Bezahlt", "b-green"],
  payment_failed: ["Zahlung fehlgeschlagen", "b-red"], payment_refunded: ["Erstattet", "b-purple"],
  payment_cancelled: ["Zahlung storniert", "b-grey"], test_payment_confirmed: ["Testzahlung bestätigt", "b-green"],
  pending: ["Ausstehend", "b-gold"], paid: ["Bezahlt", "b-green"], refunded: ["Erstattet", "b-purple"],
};
// ---------- Online-Zahlung (Stripe Connect) ----------
// Die Werkstatt ist Zahlungsempfänger, Carfixo erhält kein Geld. Als bezahlt
// markiert nur der stripe-webhook – die App leitet bloß zur Bezahlseite weiter.
async function stripeCall(action, extra = {}) {
  const { data, error } = await sb.functions.invoke("stripe", { body: { action, ...extra } });
  if (!error) return data || {};
  let msg = "Die Verbindung zu Stripe hat nicht geklappt. Bitte später erneut versuchen.";
  try { const j = await error.context.json(); if (j?.error) msg = j.error; } catch (_) {}
  return { error: msg };
}
const BEZAHLT = ["payment_paid", "payment_refunded"];
async function payOnline(bkId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = "Bezahlseite wird geöffnet…"; }
  const r = await stripeCall("checkout", { booking_id: bkId });
  if (r.url) { oeffneExtern(r.url); return; }
  if (btn) { btn.disabled = false; btn.textContent = "Jetzt online bezahlen"; }
  toast(r.error || "Bezahlen ist gerade nicht möglich.");
}
async function refundBooking(bkId) {
  if (!(await frage("Der online bezahlte Betrag geht vollständig an den Kunden zurück. Das lässt sich nicht rückgängig machen.", { titel: "Zahlung erstatten?", ja: "Erstatten", gefahr: true }))) return;
  const r = await stripeCall("refund", { booking_id: bkId });
  if (r.error) return toast(r.error);
  toast("Erstattung ausgelöst – der Status aktualisiert sich, sobald Stripe sie bestätigt.");
  setTimeout(loadWsJobs, 2500);
}
function payBoxHtml(bk, w, due) {
  if (bk.status === "cancelled" && !BEZAHLT.includes(bk.payment_status)) return "";
  if (bk.payment_status === "payment_paid") {
    return `<div class="okBox" style="margin:14px 0 0">Online bezahlt: <b>${fmtEur(bk.paid_amount ?? due)}</b>${bk.paid_at ? " am " + fmtDate(bk.paid_at) : ""}${Number(bk.refunded_amount) > 0 ? ` · davon erstattet: ${fmtEur(bk.refunded_amount)}` : ""}</div>`;
  }
  if (bk.payment_status === "payment_refunded") return `<div class="note" style="margin-top:14px">Die Zahlung von ${fmtEur(bk.paid_amount ?? due)} wurde erstattet.</div>`;
  if (bk.payment_status === "payment_pending") return `<div class="note" style="margin-top:14px">Deine Zahlung wird bearbeitet (z. B. Lastschrift). Das kann einige Tage dauern.</div>`;
  if (!w.online_payment) return "";
  const zahlbar = ["ready_for_pickup", "completed"].includes(bk.status);
  return `<div class="card" style="margin-top:14px;padding:14px">
    <div class="offerLine total" style="margin-top:0;border-top:0;padding-top:0"><span>Zu zahlen</span><span style="white-space:nowrap">${fmtEur(due)}</span></div>
    ${due > Number(bk.total_price) ? '<div class="mm" style="font-size:11.5px">inkl. freigegebener Zusatzarbeiten</div>' : ""}
    ${bk.payment_status === "payment_failed" ? '<div class="warn" style="margin-top:8px">Die letzte Zahlung ist fehlgeschlagen. Du kannst es erneut versuchen.</div>' : ""}
    ${zahlbar
      ? `<button class="btn green wide" style="margin-top:10px" onclick="payOnline('${bk.id}',this)">Jetzt online bezahlen</button>
         <p class="mm" style="margin-top:8px;font-size:11px">Sichere Zahlung über Stripe direkt an ${esc(w.name || "die Werkstatt")}. Du kannst auch vor Ort bezahlen.</p>`
      : `<p class="mm" style="margin-top:8px;font-size:12px">Online bezahlen kannst du, sobald die Werkstatt den Auftrag als abholbereit meldet – oder du zahlst vor Ort.</p>`}
  </div>`;
}

const CANCEL_REASONS = ["Termin passt nicht mehr", "Problem hat sich erledigt", "Anderes Angebot gewählt", "Preis zu hoch", "Werkstatt nicht erreichbar", "Sonstiges"];
// Zentrale Stornoregel. Carfixo vermittelt nur; bezahlt wird an den Betrieb –
// über die Plattform zu stornieren kostet nichts. Verbindlich sind die
// Bedingungen des Betriebs. Bei Änderung hier auch legal.html anpassen.
const STORNO_HINWEIS = "Das Stornieren über Carfixo ist kostenlos. Es gelten die Bedingungen des jeweiligen Betriebs – sage möglichst frühzeitig ab und nutze bei kurzfristigen Änderungen zusätzlich den Chat.";

function bookingTimeline(status) {
  if (status === "cancelled") return `<div class="warn" style="margin:12px 0 0">Dieser Auftrag wurde storniert.</div>`;
  const idx = BK_FLOW.indexOf(status === "approval_needed" ? "in_progress" : status);
  return `<div style="display:flex;gap:4px;margin-top:14px;overflow-x:auto;padding-bottom:4px">
    ${BK_FLOW.map((k, i) => `
      <div style="flex:1;min-width:74px;text-align:center">
        <div style="height:4px;border-radius:2px;background:${i <= idx ? "var(--green)" : "rgba(255,255,255,.1)"}"></div>
        <div style="font-size:9px;font-weight:700;margin-top:5px;color:${i <= idx ? "var(--ink)" : "var(--muted)"}">${BK_STATUS[k][0]}</div>
      </div>`).join("")}
  </div>${status === "approval_needed" ? '<div class="warn" style="margin-top:10px">Die Werkstatt wartet auf deine Freigabe für Zusatzarbeiten – siehe unten.</div>' : ""}`;
}

async function loadBookingBox(r) {
  const { data: bk } = await sb.from("bookings")
    .select("*, offers!inner(request_id,total_price,is_fixed_price,workshops(*))")
    .eq("offers.request_id", r.id).eq("customer_id", me.id).maybeSingle();
  const box = $("bookingBox"); if (!box || !bk) return;
  const s = BK_STATUS[bk.status] || ["?", "b-grey"];
  const pay = PAY_LABELS[bk.payment_status] || PAY_LABELS.none;
  const w = bk.offers?.workshops || {};
  const active = !["completed", "cancelled"].includes(bk.status);
  // Abschließen (und damit Bewerten) erst, wenn der Betrieb fertig gemeldet
  // hat oder der Termin vorbei ist – sonst ließe sich ein Betrieb bewerten,
  // bevor er überhaupt gearbeitet hat. Dieselbe Regel prüft die Datenbank.
  const canComplete = bk.status === "ready_for_pickup"
    || (!!bk.scheduled_at && new Date(bk.scheduled_at) < new Date());
  const [{ data: rev }, { data: approvals }, { data: widerruf }] = await Promise.all([
    sb.from("reviews").select("id,rating").eq("booking_id", bk.id).maybeSingle(),
    sb.from("approvals").select("*").eq("booking_id", bk.id).order("created_at", { ascending: false }),
    sb.from("contract_withdrawals").select("received_at").eq("booking_id", bk.id).limit(1).maybeSingle(),
  ]);
  // Widerrufsfrist: 14 Tage ab Buchung (Vertragsschluss). Danach kein Knopf mehr.
  const fristEnde = new Date(new Date(bk.created_at).getTime() + WIDERRUF_TAGE * 864e5);
  const widerrufbar = !widerruf && bk.status !== "cancelled" && new Date() < fristEnde;
  box.innerHTML = `
  <div class="card" style="border-color:rgba(30,107,255,.4);margin-bottom:14px">
    <div class="cardHead"><div class="ico icoGreen"></div>
      <div style="flex:1"><div class="tt">Buchung ${esc(bk.booking_no || "")} · <a href="#/workshop/${w.id}" style="color:var(--blue2)">${esc(w.name || "Werkstatt")}</a></div>
      <div class="mm">Preis: <b>${fmtEur(bk.total_price)}</b> (${bk.offers?.is_fixed_price === false ? "Schätzung" : "Festpreis"})${bk.scheduled_at ? " · Termin: " + fmtDateTime(bk.scheduled_at) : ""}${w.phone ? " · " + esc(w.phone) : ""}</div>
      <div style="margin-top:6px"><span class="badge ${pay[1]}">${pay[0]}</span> ${bk.no_show ? `<span class="badge b-red">${bk.no_show === "customer" ? "Als nicht erschienen markiert" : "Werkstatt nicht erschienen"}</span>` : ""}</div></div>
      <span class="badge ${s[1]}">${s[0]}</span></div>
    ${bookingTimeline(bk.status)}
    ${active ? terminLinks(`${r.title} – ${w.name || "Werkstatt"}`, bk.scheduled_at, w) : ""}
    ${payBoxHtml(bk, w, Number(bk.total_price) + (approvals || []).filter(a => a.status === "approved").reduce((n, a) => n + Number(a.extra_cost || 0), 0))}
    ${bk.proposed_date && bk.reschedule_by === "workshop" ? `
      <div class="note" style="margin-top:12px">Die Werkstatt schlägt einen neuen Termin vor: <b>${fmtDateTime(bk.proposed_date)}</b>
      <div class="btnRow"><button class="btn green sm" onclick="acceptProposedDate('${bk.id}','${r.id}')">Termin annehmen</button></div></div>` : ""}
    ${(approvals || []).map(a => approvalCardHtml(a, r.id)).join("")}
    ${bk.status === "completed" && !rev ? `<button class="btn wide" style="margin-top:14px" onclick="openReviewModal('${bk.id}','${w.id}',${jsArg(w.name)},'${r.id}')">Jetzt bewerten</button>` : ""}
    ${bk.status === "completed" && rev ? `<div class="okBox" style="margin-bottom:0;margin-top:14px">Deine Bewertung: <span style="color:var(--gold)">${stars(rev.rating)}</span> – danke!</div>` : ""}
    ${active && !canComplete ? `<p class="mm" style="margin-top:12px;font-size:12px">Abschließen und bewerten kannst du, sobald die Werkstatt den Auftrag als fertig meldet oder der Termin vorbei ist.</p>` : ""}
    ${active ? `
    <div class="btnRow">
      ${canComplete ? `<button class="btn green sm" onclick="completeBooking('${bk.id}','${r.id}','${w.id}',${jsArg(w.name || "")})">Auftrag abschließen</button>` : ""}
      <button class="btn ghost sm" onclick="openReschedule('${bk.id}','${r.id}')">Termin verschieben</button>
      <button class="btn red sm" onclick="openCancel('${bk.id}','${r.id}',${bk.payment_status === "payment_paid"})">Stornieren</button>
    </div>` : ""}
    ${widerruf ? `<div class="note" style="margin-top:12px">Dein Widerruf ist am ${fmtDateTime(widerruf.received_at)} eingegangen. Die Werkstatt meldet sich bei dir.</div>` : ""}
    ${widerrufbar ? `<div class="wdRow"><span class="mm">Widerrufsfrist bis ${fmtDate(fristEnde.toISOString())}</span>
      <a class="btn ghost sm" href="#/widerrufen/${encodeURIComponent(bk.booking_no || "")}">Vertrag widerrufen</a></div>` : ""}
    ${bookingDocsHtml(bk)}
    <p class="mm" style="margin-top:12px;font-size:11px">Die Reparaturleistung, Rechnung und Gewährleistung werden durch die ausgewählte Werkstatt erbracht.</p>
  </div>`;
}
function approvalCardHtml(a, reqId) {
  const items = (a.line_items || []).map(li => `<div class="offerLine"><span>${esc(li.label)}</span><span>${fmtEur(li.price)}</span></div>`).join("");
  return `<div class="card" style="margin-top:12px;padding:14px;border-color:${a.status === "requested" ? "rgba(255,176,32,.5)" : a.status === "approved" ? "rgba(43,213,138,.4)" : "var(--line)"}">
    <div class="cardHead"><div class="ico icoGold" style="width:34px;height:34px;font-size:15px"></div>
      <div style="flex:1"><div class="tt" style="font-size:13px">Zusatzarbeit: ${esc(a.title)}</div>
      <div class="mm">${fmtDate(a.created_at)} · Zusatzkosten: <b>${fmtEur(a.extra_cost)}</b></div></div>
      <span class="badge ${a.status === "requested" ? "b-gold" : a.status === "approved" ? "b-green" : "b-red"}">${a.status === "requested" ? "Freigabe angefragt" : a.status === "approved" ? "Freigegeben ✓" : "Abgelehnt"}</span></div>
    ${a.description ? `<p class="mm" style="margin-top:8px">${esc(a.description)}</p>` : ""}
    ${items ? `<div style="margin-top:8px">${items}</div>` : ""}
    ${(a.photos || []).length ? `<div class="thumbs">${a.photos.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" loading="lazy" alt="Foto"></a>`).join("")}</div>` : ""}
    ${a.status === "requested" ? `
    <div class="btnRow">
      <button class="btn green sm" onclick="decideApproval('${a.id}','approved','${reqId}')">✓ Freigeben (${fmtEur(a.extra_cost)})</button>
      <button class="btn red sm" onclick="decideApproval('${a.id}','declined','${reqId}')">Ablehnen</button>
    </div>
    <p class="mm" style="margin-top:8px;font-size:11px">Ohne deine Zustimmung wird die Zusatzarbeit nicht ausgeführt. Rückfragen? Nutze den Chat.</p>` : ""}
  </div>`;
}
async function decideApproval(id, status, reqId) {
  if (status === "declined" && !(await frage("Die Werkstatt führt die Zusatzarbeit dann nicht aus.", { titel: "Zusatzarbeit ablehnen?", ja: "Ablehnen", gefahr: true }))) return;
  const { error } = await sb.from("approvals").update({ status, decided_at: new Date().toISOString() }).eq("id", id);
  if (error) return toast(error.message);
  await sb.from("messages").insert({ request_id: reqId, sender_id: me.id, kind: "system", body: status === "approved" ? "Zusatzarbeit freigegeben" : "Zusatzarbeit abgelehnt" });
  toast(status === "approved" ? "Freigegeben ✓" : "Abgelehnt.");
  vRequestDetail(reqId);
}
function openReschedule(bkId, reqId) {
  openModal(`
    <h2 style="font-size:19px;font-weight:800">Termin verschieben</h2>
    <p class="mm" style="margin-top:6px">Schlage einen neuen Wunschtermin vor – die Werkstatt bestätigt ihn.</p>
    <div class="label">Neuer Wunschtermin</div>
    <input type="datetime-local" id="rsDt" min="${new Date().toISOString().slice(0, 16)}">
    <div class="btnRow">
      <button class="btn" id="rsGo">Vorschlag senden</button>
      <button class="btn ghost" onclick="closeModal()">Abbrechen</button>
    </div>`);
  $("rsGo").onclick = async () => {
    const v = $("rsDt").value;
    if (!v) return toast("Bitte Termin wählen.");
    const { error } = await sb.from("bookings").update({ proposed_date: new Date(v).toISOString(), reschedule_by: "customer" }).eq("id", bkId);
    if (error) return toast(error.message);
    await sb.from("messages").insert({ request_id: reqId, sender_id: me.id, kind: "system", body: "Neuer Terminvorschlag vom Kunden: " + fmtDateTime(v) });
    closeModal(); toast("Terminvorschlag gesendet ");
    vRequestDetail(reqId);
  };
}
async function acceptProposedDate(bkId, reqId) {
  const { data: bk } = await sb.from("bookings").select("proposed_date").eq("id", bkId).maybeSingle();
  if (!bk?.proposed_date) return;
  const { error } = await sb.from("bookings").update({ scheduled_at: bk.proposed_date, proposed_date: null, reschedule_by: null, status: "ready" }).eq("id", bkId);
  if (error) return toast(error.message);
  toast("Neuer Termin bestätigt ✓");
  vRequestDetail(reqId);
}
function openCancel(bkId, reqId, bezahlt) {
  openModal(`
    <h2 style="font-size:19px;font-weight:800">Buchung stornieren</h2>
    <div class="note" style="margin-top:10px">${STORNO_HINWEIS}</div>
    ${bezahlt ? '<div class="warn" style="margin-top:10px">Du hast bereits online bezahlt. Die Erstattung veranlasst die Werkstatt nach ihren Bedingungen – sprich sie am besten im Chat darauf an.</div>' : ""}
    <div class="label">Grund</div>
    <select id="ccReason">${CANCEL_REASONS.map(x => `<option>${x}</option>`).join("")}</select>
    <div class="btnRow">
      <button class="btn red" id="ccGo">Verbindlich stornieren</button>
      <button class="btn ghost" onclick="closeModal()">Zurück</button>
    </div>`);
  $("ccGo").onclick = async () => {
    $("ccGo").disabled = true;
    const { error } = await sb.from("bookings").update({ status: "cancelled", cancel_reason: $("ccReason").value, cancelled_by: "customer", payment_status: "payment_cancelled" }).eq("id", bkId);
    if (error) { $("ccGo").disabled = false; return toast(error.message); }
    closeModal(); toast("Buchung storniert.");
    vRequestDetail(reqId);
  };
}
async function completeBooking(bkId, reqId, wsId, wsName) {
  if (!(await frage("Bestätige, dass die Arbeit erledigt ist und du dein Fahrzeug abgeholt hast. Danach kannst du die Werkstatt bewerten.", { titel: "Auftrag abschließen?", ja: "Ja, abschließen" }))) return;
  const { error } = await sb.from("bookings").update({ status: "completed" }).eq("id", bkId);
  if (error) toast(error.message);
  else {
    toast("Auftrag abgeschlossen ✓");
    await vRequestDetail(reqId);
    // Direkt danach fragen, solange die Erfahrung frisch ist – überspringen geht jederzeit.
    if (wsId) openReviewModal(bkId, wsId, wsName, reqId);
  }
}

// ---------- Bewertung ----------
let revRating = 0;
function openReviewModal(bookingId, workshopId, wsName, reqId) {
  revRating = 0;
  openModal(`
    <h2 style="font-size:20px;font-weight:800">Wie war ${esc(wsName)}?</h2>
    <p class="mm" style="margin-top:6px">Deine Bewertung hilft anderen Autofahrern.</p>
    <div class="starPick" style="margin:18px 0" id="starPick">${[1,2,3,4,5].map(n => `<span data-n="${n}">★</span>`).join("")}</div>
    <div class="label">Kommentar (optional)</div>
    <textarea id="revComment" placeholder="Wie lief Kommunikation, Preis, Qualität?"></textarea>
    <div class="label">Fotos (optional, bis 4)</div>
    <input type="file" id="revImgs" accept="image/*" multiple style="padding:9px">
    <div class="thumbs" id="revThumbs" style="margin-top:8px"></div>
    <div class="btnRow">
      <button class="btn" id="revGo">Bewertung abschicken</button>
      <button class="btn ghost" onclick="closeModal()">Abbrechen</button>
    </div>
    <div class="err" id="revErr"></div>`);
  document.querySelectorAll("#starPick span").forEach(s => s.onclick = () => {
    revRating = +s.dataset.n;
    document.querySelectorAll("#starPick span").forEach(x => x.classList.toggle("on", +x.dataset.n <= revRating));
  });
  $("revImgs").onchange = () => {
    $("revThumbs").innerHTML = [...$("revImgs").files].slice(0, 4).map(f => `<img src="${URL.createObjectURL(f)}" loading="lazy" alt="">`).join("");
  };
  $("revGo").onclick = async () => {
    if (!revRating) return showErr($("revErr"), "Bitte Sterne vergeben.");
    $("revGo").disabled = true; $("revGo").textContent = "Wird gesendet…";
    const images = [];
    for (const f of [...$("revImgs").files].slice(0, 4)) {
      if (f.size >= 8 * 1024 * 1024) continue;
      const path = `${me.id}/review_${Date.now()}_${f.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await sb.storage.from("attachments").upload(path, f);
      if (!upErr) images.push(sb.storage.from("attachments").getPublicUrl(path).data.publicUrl);
    }
    const { error } = await sb.from("reviews").insert({
      booking_id: bookingId, customer_id: me.id, workshop_id: workshopId,
      rating: revRating, comment: $("revComment").value.trim() || null, images,
    });
    $("revGo").disabled = false; $("revGo").textContent = "Bewertung abschicken";
    if (error) return showErr($("revErr"), error.message);
    closeModal(); toast("Danke für deine Bewertung ");
    allWorkshops = null;
    vRequestDetail(reqId);
  };
}

// ---------- Chat ----------
async function loadMsgs(requestId) {
  const { data } = await sb.from("messages").select("*").eq("request_id", requestId).order("created_at");
  const box = $("msgs"); if (!box) return;
  box.innerHTML = (data || []).map(m => `
    <div class="msg ${m.sender_id === me.id ? "me" : "them"}">${esc(m.body)}<div class="mt">${fmtDateTime(m.created_at)}</div></div>`).join("")
    || '<p class="mm" style="text-align:center;padding:14px">Noch keine Nachrichten – stell hier Rückfragen.</p>';
  box.scrollTop = box.scrollHeight;
}
async function sendMsg(requestId) {
  const inp = $("msgIn");
  const body = inp.value.trim(); if (!body) return;
  inp.value = "";
  const { error } = await sb.from("messages").insert({ request_id: requestId, sender_id: me.id, body });
  if (error) toast(error.message); else loadMsgs(requestId);
}

// ============================================================
// FAHRZEUGE (Kunde)
// ============================================================
async function vVehicles() {
  if (!requireAuth()) return;
  main.innerHTML = `
  <div class="pageHead">
    <div><h1>Meine Fahrzeuge</h1><div class="sub">Deine Garage – Basis für Anfragen und Erinnerungen. Optional mit Fahrzeugschein.</div></div>
    <div class="right"><a class="btn ghost sm" href="#/reminders">Erinnerungen</a><button class="btn sm" onclick="openVehicleForm()">＋ Fahrzeug</button></div>
  </div>
  <div id="carList" class="grid2"><div class="sk" style="height:120px"></div></div>`;
  await loadVehicles();
}
async function loadVehicles() {
  const { data, error } = await sb.from("vehicles").select("*").eq("owner_id", me.id).order("created_at");
  const box = $("carList"); if (!box) return;
  if (error) { box.innerHTML = `<div class="warn">${esc(error.message)}</div>`; return; }
  if (!data || data.length === 0) { box.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="e">${ico("car",40)}</div>Noch kein Fahrzeug gespeichert.</div>`; return; }
  box.innerHTML = data.map(v => `
    <div class="card">
      <div class="cardHead"><div class="ico icoBlue"></div>
        <div style="flex:1;min-width:0"><div class="tt">${esc(v.make)} ${esc(v.model)}${v.series && v.series !== "Keine Angabe" ? " " + esc(v.series) : ""}</div>
        <div class="mm">${esc(carLabel(v))}</div>
        ${v.license_plate ? `<div class="mm">${esc(v.license_plate)}</div>` : ""}
        ${v.tuev_until ? `<div class="mm">TÜV bis ${fmtDate(v.tuev_until)}${new Date(v.tuev_until) < new Date(Date.now() + 60 * 864e5) ? ' <span class="badge b-gold">bald fällig</span>' : ""}</div>` : ""}
        ${v.registration_doc ? `<div class="mm">Fahrzeugschein hinterlegt</div>` : ""}
        </div></div>
      <div class="foot">
        <a class="btn sm" href="#/vehicle/${v.id}">Fahrzeugakte</a>
        <button class="btn ghost sm" onclick='openVehicleForm(${JSON.stringify(v.id)})'>Bearbeiten</button>
        <button class="btn red sm" onclick='deleteVehicle(${JSON.stringify(v.id)})'>Löschen</button>
      </div>
    </div>`).join("");
}
async function deleteVehicle(id) {
  if (!(await frage("Auch die Fahrzeugakte mit Kilometerständen wird gelöscht.", { titel: "Fahrzeug löschen?", ja: "Löschen", gefahr: true }))) return;
  const { error } = await sb.from("vehicles").delete().eq("id", id);
  if (error) toast(error.message); else { toast("Gelöscht."); loadVehicles(); }
}
// ---------- Fahrzeugschein-Scan (OCR, Zulassungsbescheinigung Teil I) ----------
// Liest die genormten Feldcodes: D.1 Marke, D.3 Modell, D.2 Typ/Variante,
// P.2 Leistung (kW→PS), P.3 Kraftstoff, (B) Erstzulassung, S.1 Sitzplätze.
function parseFahrzeugschein(raw) {
  const U = (" " + String(raw || "").replace(/\r/g, "").replace(/[ \t]+/g, " ") + " ").toUpperCase();
  const out = {};
  // Wert nach einem Code lesen, aber am nächsten Feldcode / Zeilenende abschneiden
  const cut = (v) => v ? v.split(/(?=\s(?:[A-Z]\.\d|\([A-Z]\)))|\n/)[0].replace(/\s{2,}.*$/, "").trim() : null;
  const grab = (re) => { const m = U.match(re); return m ? cut(m[1]) : null; };
  out.make = grab(/D[\.\s]*1[^A-Z0-9]{0,4}([A-ZÄÖÜ][A-ZÄÖÜ\- ]{1,24})/);
  out.model = grab(/D[\.\s]*3[^A-Z0-9]{0,4}([A-Z0-9][A-Z0-9\-\. ]{0,24})/);
  out.variant = grab(/D[\.\s]*2[^A-Z0-9]{0,4}([A-Z0-9][A-Z0-9\-\/ ]{0,24})/);
  const kw = (U.match(/P[\.\s]*2[^0-9]{0,4}(\d{2,3})/) || [])[1];
  if (kw) out.ps = Math.round(+kw / 0.7355);
  const fuelRaw = grab(/P[\.\s]*3[^A-Z]{0,4}([A-ZÄÖÜ\/ ]{3,24})/) || U;
  for (const [k, val] of [["DIESEL", "Diesel"], ["BENZIN", "Benzin"], ["OTTO", "Benzin"],
    ["PLUG", "Plug-in-Hybrid"], ["HYBRID", "Hybrid (Benzin/Elektro)"], ["ELEKTR", "Elektro"],
    ["FLÜSSIG", "Autogas (LPG)"], ["LPG", "Autogas (LPG)"], ["ERDGAS", "Erdgas (CNG)"],
    ["CNG", "Erdgas (CNG)"], ["WASSERSTOFF", "Wasserstoff"]]) {
    if ((fuelRaw || "").includes(k)) { out.fuel = val; break; }
  }
  const ez = U.match(/\(?\bB\)?[^0-9]{0,4}(\d{2})[.\/](\d{2})[.\/](\d{4})/);
  if (ez) { out.ez_month = +ez[2]; out.ez_year = +ez[3]; }
  const seats = (U.match(/S[\.\s]*1[^0-9]{0,4}(\d)/) || [])[1];
  if (seats) out.seats = +seats;
  const plate = U.match(/\b([A-ZÖÜÄ]{1,3})[-\s]([A-Z]{1,2})[-\s](\d{1,4})\b/);
  if (plate) out.plate = `${plate[1]}-${plate[2]} ${plate[3]}`;
  return out;
}
let _tesseractLoading = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve();
  if (_tesseractLoading) return _tesseractLoading;
  _tesseractLoading = new Promise((res, rej) => {
    const sc = document.createElement("script");
    sc.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    sc.onload = res; sc.onerror = () => rej(new Error("OCR-Bibliothek konnte nicht geladen werden."));
    document.head.appendChild(sc);
  });
  return _tesseractLoading;
}
// Übernimmt erkannte Werte ins offene Fahrzeugformular
function applyScheinData(d, statusEl) {
  const filled = [];
  const setVal = (id, val, label) => { if (val != null && val !== "" && $(id)) { $(id).value = val; filled.push(label); } };
  let canonMake = "";
  if (d.make) {
    canonMake = VehicleData.brands().find(x => x.toLowerCase() === d.make.toLowerCase())
      || d.make.charAt(0) + d.make.slice(1).toLowerCase();
    setVal("cMake", canonMake, "Marke"); $("cMake").dispatchEvent(new Event("input"));
  }
  if (d.model) {
    const canonModel = (canonMake ? VehicleData.models(canonMake) : []).find(x => x.toLowerCase() === d.model.toLowerCase()) || d.model;
    setVal("cModel", canonModel, "Modell"); $("cModel").dispatchEvent(new Event("input"));
  }
  setVal("cVariant", d.variant, "Variante");
  if (d.ez_month && $("cEzMonth")) setVal("cEzMonth", String(d.ez_month).padStart(2, "0"), "EZ-Monat");
  if (d.ez_year && $("cYear")) setVal("cYear", d.ez_year, "EZ-Jahr");
  setVal("cPs", d.ps, "Leistung");
  if (d.fuel && $("cFuel")) setVal("cFuel", d.fuel, "Kraftstoff");
  if (d.seats && $("cSeats")) setVal("cSeats", d.seats, "Sitzplätze");
  setVal("cPlate", d.plate, "Kennzeichen");
  if (statusEl) statusEl.innerHTML = filled.length
    ? `<span style="color:var(--green)">${ico("check")} Übernommen: ${filled.join(", ")}. Bitte kurz prüfen und ergänzen.</span>`
    : `<span style="color:var(--gold)">${ico("alert")} Keine Felder sicher erkannt – bitte manuell ausfüllen (Foto möglichst gerade & scharf).</span>`;
}
async function scanFahrzeugschein(file, statusEl) {
  if (!file) return;
  statusEl.innerHTML = `${ico("scan")} Lade Texterkennung…`;
  try {
    await loadTesseract();
    statusEl.innerHTML = `${ico("scan")} Scanne Fahrzeugschein… <span id="ocrPct">0%</span>`;
    const { data } = await window.Tesseract.recognize(file, "deu", {
      logger: (m) => { if (m.status === "recognizing text" && $("ocrPct")) $("ocrPct").textContent = Math.round(m.progress * 100) + "%"; },
    });
    applyScheinData(parseFahrzeugschein(data.text || ""), statusEl);
  } catch (e) {
    statusEl.innerHTML = `<span style="color:var(--gold)">${ico("alert")} Scan nicht möglich (${esc(e.message || e)}). Bitte manuell ausfüllen.</span>`;
  }
}

// Fahrzeug anlegen – Aufbau und Auswahllisten nach mobile.de-Vorbild.
// Pflicht sind nur Marke + Modell; Motorisierung aus der Datenbank füllt
// Kraftstoff/Leistung automatisch vor. Freitext ist überall erlaubt.
async function openVehicleForm(editId) {
  let v = {};
  if (editId) { const { data } = await sb.from("vehicles").select("*").eq("id", editId).maybeSingle(); v = data || {}; }
  const years = []; for (let y = 2026; y >= 1950; y--) years.push(y);
  openModal(`
    <h2 style="font-size:20px;font-weight:800">${editId ? "Fahrzeug bearbeiten" : "Fahrzeug anlegen"}</h2>
    <p class="mm" style="margin-top:4px">Nur <b>Marke und Modell</b> sind Pflicht. Nicht in der Liste? Einfach eintippen – Freitext ist erlaubt.</p>

    <div class="uploadTile" style="margin-top:12px" onclick="$('cScan').click()">
      <div class="ico icoPurple">${ico("scan", 20)}</div>
      <div><div class="tt" style="font-size:12.5px">Fahrzeugschein scannen &amp; automatisch ausfüllen</div>
      <div class="mm">Foto der Zulassungsbescheinigung Teil I – Marke, Modell, PS, Erstzulassung u.&nbsp;a. werden übernommen</div></div>
    </div>
    <input type="file" id="cScan" accept="image/*" capture="environment" class="hidden">
    <div class="mm" id="cScanStatus" style="margin-top:8px"></div>

    <div class="label" style="margin-top:14px">Fahrzeugdaten</div>
    <div class="split">
      <div><div class="label" style="margin-top:0">Marke *</div>
        <input id="cMake" list="dlMake" placeholder="z.B. BMW" autocomplete="off" value="${esc(v.make || "")}">
        <datalist id="dlMake">${VehicleData.brands().map(b => `<option value="${esc(b)}"></option>`).join("")}</datalist>
        <div class="mm" id="cMakeHint" style="font-size:11px;margin-top:4px"></div></div>
      <div><div class="label" style="margin-top:0">Modell *</div>
        <input id="cModel" list="dlModel" placeholder="Erst Marke wählen" autocomplete="off" disabled value="${esc(v.model || "")}">
        <datalist id="dlModel"></datalist>
        <div class="mm" id="cModelHint" style="font-size:11px;margin-top:4px"></div></div>
    </div>
    <div class="split">
      <div><div class="label">Variante (optional)</div><input id="cVariant" maxlength="60" placeholder="z.B. 320d M Sport" value="${esc(v.variant || "")}"></div>
      <div><div class="label">Kategorie</div><select id="cBody">${opt("Optional…", BODIES, v.body_type)}</select></div>
    </div>

    <div class="label" style="margin-top:18px">Erstzulassung &amp; Historie</div>
    <div class="split">
      <div><div class="label" style="margin-top:0">EZ Monat</div><select id="cEzMonth">${opt("MM", EZ_MONTHS, v.ez_month ? String(v.ez_month).padStart(2, "0") : "")}</select></div>
      <div><div class="label" style="margin-top:0">EZ Jahr</div><select id="cYear">${opt("JJJJ", years, v.year)}</select></div>
    </div>
    <div class="split">
      <div><div class="label">Kilometerstand</div><input id="cKm" inputmode="numeric" placeholder="z.B. 87500" value="${v.mileage ?? ""}"></div>
      <div><div class="label">Anzahl Fahrzeughalter</div><select id="cOwners">${opt("Optional…", [1,2,3,4,5,6,7,8,9], v.owners)}</select></div>
    </div>
    <div class="label">HU gültig bis</div>
    <input id="cTuev" type="date" value="${esc(v.tuev_until || "")}">
    <label class="inline"><input type="checkbox" id="cCheckbook" ${v.checkbook ? "checked" : ""}> Scheckheftgepflegt</label>
    <label class="inline"><input type="checkbox" id="cAccFree" ${v.accident_free ? "checked" : ""}> Unfallfrei</label>

    <div class="label" style="margin-top:18px">Technische Daten</div>
    <div class="label" style="margin-top:6px">Motorisierung (optional – füllt Kraftstoff &amp; Leistung automatisch)</div>
    <select id="cEngine" disabled><option value="">Erst Marke &amp; Modell wählen</option></select>
    <div class="split">
      <div><div class="label">Kraftstoffart</div><select id="cFuel">${opt("Optional…", FUELS, v.fuel)}</select></div>
      <div><div class="label">Getriebe</div><select id="cTrans">${opt("Optional…", TRANS, v.transmission)}</select></div>
    </div>
    <div class="split">
      <div><div class="label">Leistung (PS)</div><input id="cPs" inputmode="numeric" placeholder="z.B. 150" value="${v.power_ps ?? ""}"><div class="mm" id="cKw" style="font-size:11px;margin-top:4px"></div></div>
      <div><div class="label">Baureihe / Generation</div><select id="cSeries" disabled><option value="">Optional…</option></select></div>
    </div>

    <div class="label" style="margin-top:18px">Ausstattung</div>
    <div class="split">
      <div><div class="label" style="margin-top:0">Türen</div><select id="cDoors">${opt("Optional…", DOORS, v.doors)}</select></div>
      <div><div class="label" style="margin-top:0">Sitzplätze</div><select id="cSeats">${opt("Optional…", SEATS, v.seats)}</select></div>
    </div>
    <div class="label">Außenfarbe</div>
    <select id="cColor">${opt("Optional…", COLORS, v.color)}</select>

    <div class="okBox hidden" id="vfSummary" style="margin-top:14px"></div>

    <div class="label" style="margin-top:18px">Dokumente</div>
    <div class="split">
      <div><div class="label" style="margin-top:0">Kennzeichen (optional)</div><input id="cPlate" placeholder="K-XX 1234" value="${esc(v.license_plate || "")}"></div>
      <div><div class="label" style="margin-top:0">Fahrzeugschein (optional)</div><input type="file" id="cDoc" accept="image/*,.pdf" style="padding:9px"></div>
    </div>
    ${v.registration_doc ? '<p class="mm" style="margin-top:5px">Bereits hinterlegt – neue Datei ersetzt die alte.</p>' : ""}
    <div class="btnRow">
      <button class="btn" id="cSave" disabled>${editId ? "Speichern" : "Fahrzeug anlegen"}</button>
      <button class="btn ghost" onclick="closeModal()">Abbrechen</button>
    </div>
    <div class="err" id="cErr"></div>`);

  // Tipp-Suche: exakter Treffer aus der Datenbank wird übernommen, sonst Freitext
  const known = (list, val) => list.find(x => x.toLowerCase() === String(val || "").trim().toLowerCase()) || "";
  const makeSel = () => known(VehicleData.brands(), $("cMake").value) || $("cMake").value.trim();
  const modelSel = () => known(VehicleData.models(makeSel()), $("cModel").value) || $("cModel").value.trim();

  function refresh() {
    const mk = makeSel(), mo = modelSel();
    const mkKnown = !!known(VehicleData.brands(), mk);
    const moKnown = mkKnown && !!known(VehicleData.models(mk), mo);
    const mkHint = $("cMakeHint"), moHint = $("cModelHint");
    mkHint.textContent = !mk ? `${VehicleData.brands().length} Marken – oder frei eintippen`
      : mkKnown ? `✓ ${mk}` : `✓ „${mk}" als eigene Angabe`;
    mkHint.style.color = mk ? "var(--green)" : "";
    moHint.textContent = !mk ? "" : !mo
      ? (mkKnown ? `${VehicleData.models(mk).length} Modelle – oder frei eintippen` : "Modell frei eintippen")
      : moKnown ? `✓ ${mo}` : `✓ „${mo}" als eigene Angabe`;
    moHint.style.color = mo ? "var(--green)" : "";
    $("cSave").disabled = !(mk && mo);
    const ps = parseInt($("cPs").value, 10);
    $("cKw").textContent = ps > 0 ? `= ${Math.round(ps * 0.7355)} kW` : "";
    const sum = $("vfSummary");
    if (mk && mo) {
      sum.classList.remove("hidden");
      sum.innerHTML = `<b>${esc(mk)} ${esc(mo)}</b>${$("cVariant").value.trim() ? " " + esc($("cVariant").value.trim()) : ""}${$("cFuel").value ? " · " + esc($("cFuel").value) : ""}${ps > 0 ? " · " + ps + " PS" : ""}${$("cYear").value ? " · EZ " + ($("cEzMonth").value ? $("cEzMonth").value + "/" : "") + esc($("cYear").value) : ""}${$("cKm").value ? " · " + Number($("cKm").value).toLocaleString("de-DE") + " km" : ""}`;
    } else sum.classList.add("hidden");
  }
  function fillModel(keep) {
    const mk = makeSel();
    const models = VehicleData.models(mk);
    const inp = $("cModel");
    inp.disabled = !mk;
    inp.placeholder = !mk ? "Erst Marke wählen" : models.length ? `Modell tippen… (${models.length} verfügbar)` : "Modell frei eintippen";
    $("dlModel").innerHTML = models.map(m => `<option value="${esc(m)}"></option>`).join("");
    if (keep !== undefined) inp.value = keep || "";
  }
  function fillSeries(keep) {
    const mk = makeSel(), mo = modelSel();
    $("cSeries").disabled = !mo;
    if (!mo) { $("cSeries").innerHTML = "<option value=''>Optional…</option>"; return; }
    const list = VehicleData.series(mk, mo).map(x => x.label);
    if (keep && !list.includes(keep)) list.unshift(keep);
    $("cSeries").innerHTML = opt("Baureihe (optional)", list, keep);
  }
  function fillEngine(keep) {
    const mk = makeSel(), mo = modelSel();
    $("cEngine").disabled = !mo;
    if (!mo) { $("cEngine").innerHTML = "<option value=''>Erst Marke &amp; Modell wählen</option>"; return; }
    const list = VehicleData.engines(mk, mo).map(e => e.n);
    if (keep && !list.includes(keep)) list.unshift(keep);
    $("cEngine").innerHTML = opt("Motorisierung wählen (optional)", list, keep);
  }
  // Motor-Auswahl füllt Kraftstoff + PS automatisch vor
  function applyEngine() {
    const mk = makeSel(), mo = modelSel(), en = $("cEngine").value;
    if (!en) return;
    const e = VehicleData.engine(mk, mo, en);
    if (!e) return;
    if (e.f) {
      const mapped = known(FUELS, e.f) || (e.f === "Hybrid" ? "Hybrid (Benzin/Elektro)" : e.f === "Autogas (LPG/CNG)" ? "Autogas (LPG)" : e.f);
      if (![...$("cFuel").options].some(o => o.value === mapped)) $("cFuel").insertAdjacentHTML("beforeend", `<option value="${esc(mapped)}">${esc(mapped)}</option>`);
      $("cFuel").value = mapped;
    }
    if (e.ps?.length === 1) $("cPs").value = e.ps[0];
    else if (e.ps?.length && !$("cPs").value) $("cPs").placeholder = e.ps.join(" / ") + " PS möglich";
    if (e.f === "Elektro") $("cTrans").value = "Automatik";
    refresh();
  }

  // Vorbelegung bei Bearbeitung
  if (v.make) { fillModel(v.model); fillSeries(v.series); fillEngine(v.engine); }

  let lastMake = makeSel(), lastModel = modelSel();
  $("cMake").oninput = () => {
    const mk = makeSel();
    if (mk !== lastMake) { lastMake = mk; lastModel = ""; fillModel(""); fillSeries(); fillEngine(); }
    refresh();
  };
  $("cMake").onchange = () => { const mk = makeSel(); if (mk) $("cMake").value = mk; $("cMake").oninput(); };
  $("cModel").oninput = () => {
    const mo = modelSel();
    if (mo !== lastModel) { lastModel = mo; fillSeries(); fillEngine(); }
    refresh();
  };
  $("cModel").onchange = () => { const mo = modelSel(); if (mo) $("cModel").value = mo; $("cModel").oninput(); };
  $("cEngine").onchange = applyEngine;
  ["cVariant", "cBody", "cEzMonth", "cYear", "cKm", "cOwners", "cFuel", "cTrans", "cPs", "cDoors", "cSeats", "cColor"].forEach(id => {
    $(id).oninput = refresh; $(id).onchange = refresh;
  });
  // Fahrzeugschein-Scan → Felder automatisch füllen
  $("cScan").onchange = async () => {
    const f = $("cScan").files[0];
    if (f) { await scanFahrzeugschein(f, $("cScanStatus")); refresh(); }
  };
  refresh();

  $("cSave").onclick = async () => {
    const err = $("cErr"); err.style.display = "none";
    if (!makeSel()) return showErr(err, "Bitte eine Marke angeben.");
    if (!modelSel()) return showErr(err, "Bitte ein Modell angeben.");
    const kmRaw = $("cKm").value.replace(/[^0-9]/g, "");
    if ($("cKm").value.trim() && !kmRaw) return showErr(err, "Bitte den Kilometerstand als Zahl angeben.");
    const psRaw = $("cPs").value.replace(/[^0-9]/g, "");
    $("cSave").disabled = true; $("cSave").textContent = "Wird gespeichert…";
    let docPath = v.registration_doc || null;
    const f = $("cDoc").files[0];
    if (f && f.size < 10 * 1024 * 1024) {
      const path = `${me.id}/schein_${Date.now()}_${f.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await sb.storage.from("documents").upload(path, f);
      if (!upErr) docPath = path;
    }
    const row = {
      owner_id: me.id, make: makeSel(), model: modelSel(),
      variant: $("cVariant").value.trim() || null,
      body_type: $("cBody").value || null,
      ez_month: +$("cEzMonth").value || null, year: +$("cYear").value || null,
      mileage: kmRaw ? +kmRaw : null,
      owners: +$("cOwners").value || null,
      tuev_until: $("cTuev").value || null,
      checkbook: $("cCheckbook").checked, accident_free: $("cAccFree").checked,
      engine: $("cEngine").value || null, series: $("cSeries").value || null,
      fuel: $("cFuel").value || null, transmission: $("cTrans").value || null,
      power_ps: psRaw ? +psRaw : null,
      doors: $("cDoors").value || null, seats: +$("cSeats").value || null,
      color: $("cColor").value || null,
      license_plate: $("cPlate").value.trim() || null,
      registration_doc: docPath,
    };
    const q = editId ? sb.from("vehicles").update(row).eq("id", editId) : sb.from("vehicles").insert(row);
    const { error } = await q;
    $("cSave").disabled = false; $("cSave").textContent = editId ? "Speichern" : "Fahrzeug anlegen";
    if (error) return showErr(err, error.message);
    closeModal(); toast(editId ? "Gespeichert ✓" : "Fahrzeug angelegt ✓");
    if ($("carList")) loadVehicles(); else route();
  };
}
function kmLabel(m) { if (!m) return ""; const f = KM_STEPS.find(k => k[0] === Number(m)); return f ? f[1] : ""; }

// ============================================================
// TEILE-MARKTPLATZ
// ============================================================
let allParts = null;
// Verfügbarkeit als Badge (null = auf Anfrage, 0 = vergriffen, >0 = Stückzahl)
function partAvail(p) {
  if (p.quantity === 0) return { txt: "Vergriffen", cls: "b-grey", sold: true };
  if (p.quantity > 0) return { txt: p.quantity === 1 ? "Noch 1 verfügbar" : `${p.quantity} verfügbar`, cls: "b-green", sold: false };
  return { txt: "Verfügbar", cls: "b-green", sold: false };
}
async function vPartsMarket(_p, query) {
  const preQ = query?.q || "", preCat = (query?.cat && PART_CATS[query.cat]) ? query.cat : "";
  main.innerHTML = `
  <div class="pageHead">
    <div><h1>Teile-Marktplatz</h1><div class="sub">Neue und gebrauchte Teile direkt von geprüften Betrieben – kaufen (Versand/Abholung) oder anfragen.</div></div>
    ${myWorkshop ? `<div class="right"><a class="btn sm" href="#/ws/parts">Meine Teile verwalten</a></div>` : ""}
  </div>
  <div class="card" style="margin-bottom:14px">
    <div class="split">
      <input id="ptQ" placeholder="Teil, Marke, OE-Nummer oder Fahrzeug suchen…" value="${esc(preQ)}">
      <select id="ptCat"><option value="">Alle Kategorien</option>${Object.entries(PART_CATS).map(([k, [ic, n]]) => `<option value="${k}" ${k === preCat ? "selected" : ""}>${n}</option>`).join("")}</select>
    </div>
    <div class="split" style="margin-top:8px">
      <select id="ptCond"><option value="">Zustand: alle</option>${Object.entries(PART_CONDITIONS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>
      <select id="ptSort">
        <option value="new">Neueste zuerst</option>
        <option value="near">Nächste zuerst</option>
        <option value="cheap">Preis: günstigste zuerst</option>
        <option value="exp">Preis: teuerste zuerst</option>
      </select>
    </div>
    <label class="inline" style="margin-top:8px"><input type="checkbox" id="ptAvail"> Nur verfügbare anzeigen</label>
  </div>
  <div id="ptList" class="grid2"><div class="sk" style="height:130px"></div><div class="sk" style="height:130px"></div></div>
  <div id="myPartOrders" style="margin-top:22px"></div>`;
  if (me && !myWorkshop) loadMyPartOrders();
  if (!allParts) {
    const { data, error } = await sb.from("parts")
      .select("*, workshops(*)")
      .eq("active", true).order("created_at", { ascending: false }).limit(500);
    if (!$("ptList")) return; // Nutzer hat die Seite inzwischen verlassen
    if (error) { $("ptList").innerHTML = `<div class="warn" style="grid-column:1/-1">${esc(error.message)}</div>`; return; }
    allParts = data || [];
  }
  ["ptQ", "ptCat", "ptCond", "ptSort", "ptAvail"].forEach(id => { const el = $(id); if (el) { el.oninput = renderPartList; el.onchange = renderPartList; } });
  renderPartList();
}
function renderPartList() {
  const box = $("ptList"); if (!box) return;
  const q = ($("ptQ").value || "").trim().toLowerCase();
  const cat = $("ptCat").value, cond = $("ptCond").value, sort = $("ptSort").value;
  const onlyAvail = $("ptAvail")?.checked;
  const origin = searchOrigin || CITY_CENTER;
  let list = (allParts || []).map(p => ({ ...p, _dist: distKm(origin, [p.workshops?.lat, p.workshops?.lng]) })).filter(p => {
    if (cat && p.category !== cat) return false;
    if (cond && p.condition !== cond) return false;
    if (onlyAvail && p.quantity === 0) return false;
    if (q) {
      const hay = [p.title, p.brand, p.oem_number, p.fits, p.description, p.workshops?.name].join(" ").toLowerCase();
      if (!q.split(/\s+/).every(w => hay.includes(w))) return false;
    }
    return true;
  });
  if (sort === "cheap") list.sort((a, b) => (a.price ?? 1e12) - (b.price ?? 1e12));
  else if (sort === "exp") list.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
  else if (sort === "near") list.sort((a, b) => (a._dist ?? 9999) - (b._dist ?? 9999));
  box.innerHTML = list.length === 0
    ? `<div class="empty" style="grid-column:1/-1"><div class="e">${ico("puzzle",40)}</div>Keine Teile gefunden.${(allParts || []).length === 0 ? "<br><span class='mm'>Sobald Betriebe Teile einstellen, erscheinen sie hier.</span>" : ""}</div>`
    : list.map(partCardHtml).join("");
}
function partCardHtml(p) {
  const img = (p.images || [])[0];
  const c = PART_CATS[p.category] || ["", p.category];
  const av = partAvail(p);
  return `<div class="card tap" onclick="openPartDetail('${p.id}')" style="${av.sold ? "opacity:.72" : ""}">
    <div style="display:flex;gap:12px">
      ${img ? `<img src="${esc(img)}" loading="lazy" alt="" style="width:86px;height:86px;object-fit:cover;border-radius:12px;flex:0 0 auto">`
            : `<div class="ico icoBlue" style="width:86px;height:86px;font-size:32px;flex:0 0 auto;display:flex;align-items:center;justify-content:center">${ico(p.category)}</div>`}
      <div style="flex:1;min-width:0">
        <div class="tt">${esc(p.title)}</div>
        <div class="mm">${ico(p.category)} ${esc(c[1])} · <span class="badge ${p.condition === "neu" ? "b-green" : "b-grey"}">${esc(PART_CONDITIONS[p.condition] || p.condition)}</span> · <span class="badge ${av.cls}">${av.txt}</span></div>
        <div class="mm">${p.install_service ? "Einbau möglich · " : ""}${p.shipping ? "Versand · " : ""}${p.fits ? "Passend für: " + esc(p.fits) : ""}</div>
        <div style="font-weight:800;font-size:16px;margin-top:6px">${p.price != null ? fmtEur(p.price) : "Preis auf Anfrage"}${p.price_note ? ` <span class="mm">${esc(p.price_note)}</span>` : ""}</div>
        <div class="mm" style="margin-top:2px">${esc(p.workshops?.name || "")}${p.workshops?.district ? " · " + esc(p.workshops.district) : ""}${p._dist != null ? " · " + p._dist.toFixed(1).replace(".", ",") + " km" : ""}${p.workshops?.is_demo ? ' <span class="badge b-blue">Beispiel</span>' : ""}</div>
      </div>
    </div></div>`;
}
// Bild-Lightbox (Vollansicht)
function openLightbox(url) {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;z-index:300;background:rgba(3,5,10,.92);display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out";
  host.innerHTML = `<img src="${esc(url)}" alt="" style="max-width:96vw;max-height:92vh;border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,.6)">`;
  host.onclick = () => host.remove();
  document.body.appendChild(host);
}
function openPartDetail(id) {
  const p = (allParts || []).find(x => x.id === id);
  if (!p) return;
  const c = PART_CATS[p.category] || ["", p.category];
  const imgs = p.images || [];
  const av = partAvail(p);
  openModal(`
    <h2 style="font-size:19px;font-weight:800">${esc(p.title)}</h2>
    <div class="mm" style="margin-top:4px">${ico(p.category)} ${esc(c[1])} · <span class="badge ${p.condition === "neu" ? "b-green" : "b-grey"}">${esc(PART_CONDITIONS[p.condition] || p.condition)}</span> · <span class="badge ${av.cls}">${av.txt}</span></div>
    ${imgs.length ? `<div class="thumbs" id="ptGallery" style="margin-top:12px">${imgs.map(u => `<img src="${esc(u)}" loading="lazy" alt="" data-full="${esc(u)}" style="width:110px;height:110px;object-fit:cover;border-radius:12px;cursor:zoom-in">`).join("")}</div>` : ""}
    <div style="font-weight:800;font-size:22px;margin-top:12px">${p.price != null ? fmtEur(p.price) : "Preis auf Anfrage"}${p.price_note ? ` <span class="mm" style="font-size:13px">${esc(p.price_note)}</span>` : ""}</div>
    ${p.description ? `<p class="mm" style="margin-top:10px;white-space:pre-wrap">${esc(p.description)}</p>` : ""}
    <div style="margin-top:12px">
      ${p.brand ? `<div class="offerLine"><span>Hersteller / Marke</span><span>${esc(p.brand)}</span></div>` : ""}
      ${p.fits ? `<div class="offerLine"><span>Passend für</span><span>${esc(p.fits)}</span></div>` : ""}
      ${p.oem_number ? `<div class="offerLine"><span>OE-/Teilenummer</span><span>${esc(p.oem_number)}</span></div>` : ""}
      <div class="offerLine"><span>Verfügbarkeit</span><span>${av.txt}</span></div>
      <div class="offerLine"><span>Einbau durch Betrieb</span><span>${p.install_service ? "✓ möglich" : "–"}</span></div>
      <div class="offerLine"><span>Versand</span><span>${p.shipping ? "✓ möglich" : "– nur Abholung"}</span></div>
      <div class="offerLine"><span>Anbieter</span><span>${esc(p.workshops?.name || "")}${p.workshops?.district ? " · " + esc(p.workshops.district) : ""}</span></div>
    </div>
    ${p.workshops?.is_demo ? `<div class="note" style="margin-top:12px">Das ist ein <b>Beispielangebot</b> eines Beispielbetriebs – es zeigt, wie Teile auf Carfixo aussehen. Kauf und Anfrage sind hier nicht möglich.</div>` : ""}
    <div class="btnRow">
      <button class="btn green" id="ptBuy" ${av.sold || p.workshops?.is_demo ? "disabled" : ""}>${av.sold ? "Vergriffen" : "Direkt kaufen"}</button>
      <button class="btn ghost" id="ptAsk" ${p.workshops?.is_demo ? "disabled" : ""}>Frage stellen</button>
      <a class="btn ghost" href="#/workshop/${p.workshop_id}" onclick="closeModal()">Zum Betrieb</a>
      <button class="btn ghost sm" onclick="openReportModal('part','${p.id}','${p.workshop_id}','Teil melden')" title="Teil melden" aria-label="Teil melden">${ico("flag")}</button>
    </div>
    <p class="mm" style="margin-top:10px;font-size:11px">Kauf und Abwicklung erfolgen direkt mit dem Betrieb – Verfügbarkeit, Versand/Abholung und Bezahlung werden vor dem Kauf mit dem Betrieb abgestimmt. Carfixo vermittelt.</p>`);
  document.querySelectorAll("#ptGallery img").forEach(im => im.onclick = () => openLightbox(im.dataset.full));
  if (!av.sold) $("ptBuy").onclick = () => openPartBuy(p);
  $("ptAsk").onclick = () => {
    const title = "Teile-Anfrage: " + p.title;
    const desc = "Hallo, ich interessiere mich für: " + p.title + (p.price != null ? " (" + p.price + " €)" : "") +
      ". Ist das Teil noch verfügbar?" + (p.install_service ? " Mich interessiert ggf. auch der Einbau." : "");
    closeModal();
    go(`new-request?ws=${p.workshop_id}&cat=teile&title=${encodeURIComponent(title)}&desc=${encodeURIComponent(desc)}`);
  };
}
function openPartBuy(p) {
  if (!me) { sessionStorage.setItem("cfx_after_auth", "teile"); toast("Bitte kostenlos registrieren, um zu kaufen."); return go("register"); }
  if (myWorkshop) return toast("Als Betrieb kannst du keine Teile kaufen.");
  const canShip = !!p.shipping;
  openModal(`
    <h2 style="font-size:19px;font-weight:800">Teil kaufen</h2>
    <p class="mm" style="margin-top:4px">${esc(p.title)} · <b>${p.price != null ? fmtEur(p.price) : "Preis auf Anfrage"}</b></p>
    <div class="label">Wie möchtest du es erhalten?</div>
    <div class="seg" id="poFulfill">
      <div data-f="pickup" class="on">Abholung beim Betrieb</div>
      <div data-f="shipping" class="${canShip ? "" : "disabled"}" ${canShip ? "" : 'style="opacity:.4;pointer-events:none"'}>Versand${canShip ? "" : " (nicht angeboten)"}</div>
    </div>
    ${p.install_service ? '<label class="inline"><input type="checkbox" id="poInstall"> Einbau durch den Betrieb gewünscht</label>' : ""}
    <div class="label">Kontakt für Rückfragen (Telefon oder E-Mail)</div>
    <input id="poContact" placeholder="damit der Betrieb dich erreichen kann" value="${esc(myProfile?.phone || me.email || "")}">
    <div class="label">Nachricht an den Betrieb (optional)</div>
    <textarea id="poNote" placeholder="z.B. Wunschtermin zur Abholung, Fragen zum Zustand…"></textarea>
    <div class="okBox" style="margin-top:12px">Das ist eine <b>verbindliche Kaufanfrage</b>: Der Betrieb bestätigt Verfügbarkeit, Endpreis und Versand/Abholung. Erst danach bezahlst du direkt beim Betrieb. In der aktuellen Version läuft keine Online-Zahlung.</div>
    <div class="btnRow">
      <button class="btn green" id="poGo">Kaufanfrage senden</button>
      <button class="btn ghost" onclick="closeModal()">Abbrechen</button>
    </div>
    <div class="err" id="poErr"></div>`);
  let fulfill = "pickup";
  document.querySelectorAll("#poFulfill div:not(.disabled)").forEach(d => d.onclick = () => {
    fulfill = d.dataset.f;
    document.querySelectorAll("#poFulfill div").forEach(x => x.classList.toggle("on", x === d));
  });
  $("poGo").onclick = async () => {
    const err = $("poErr"); err.style.display = "none";
    const contact = $("poContact").value.trim();
    if (!contact) return showErr(err, "Bitte eine Kontaktmöglichkeit angeben.");
    let note = $("poNote").value.trim();
    if (p.install_service && $("poInstall")?.checked) note = "[Einbau gewünscht] " + note;
    $("poGo").disabled = true; $("poGo").textContent = "Wird gesendet…";
    const { error } = await sb.from("part_orders").insert({
      part_id: p.id, buyer_id: me.id, workshop_id: p.workshop_id,
      part_title: p.title, price: p.price ?? null,
      fulfillment: fulfill, buyer_note: note || null, buyer_contact: contact,
    });
    $("poGo").disabled = false; $("poGo").textContent = "Kaufanfrage senden";
    if (error) return showErr(err, error.message);
    closeModal();
    toast("Kaufanfrage gesendet ✓ – der Betrieb meldet sich zur Bestätigung.");
    if (location.hash.includes("teile")) vPartsMarket();
  };
}
const PO_STATUS = { requested: ["Angefragt", "b-gold"], confirmed: ["Bestätigt", "b-blue"], ready: ["Bereit/Versandt", "b-green"], completed: ["Abgeschlossen", "b-green"], cancelled: ["Storniert", "b-grey"] };
async function loadMyPartOrders() {
  const box = $("myPartOrders"); if (!box) return;
  const { data } = await sb.from("part_orders").select("*, workshops(name,phone)").eq("buyer_id", me.id).order("created_at", { ascending: false });
  if (!data || !data.length) { box.innerHTML = ""; return; }
  box.innerHTML = `<div class="rowHead" style="margin:8px 0 12px"><h2 style="font-size:18px;font-weight:800">Meine Käufe</h2></div>` +
    data.map(o => {
      const st = PO_STATUS[o.status] || ["?", "b-grey"];
      return `<div class="card" style="margin-bottom:10px">
        <div class="cardHead"><div class="ico icoGreen"></div>
          <div style="flex:1;min-width:0"><div class="tt">${esc(o.part_title)}</div>
          <div class="mm">${o.price != null ? fmtEur(o.price) + " · " : ""}${o.fulfillment === "shipping" ? "Versand" : "Abholung"} · ${esc(o.workshops?.name || "")}</div></div>
          <span class="badge ${st[1]}">${st[0]}</span></div>
        ${o.status === "requested" ? `<div class="foot"><button class="btn ghost sm" onclick="cancelPartOrder('${o.id}')">Stornieren</button></div>` : ""}
      </div>`;
    }).join("");
}
async function cancelPartOrder(id) {
  if (!(await frage("Der Betrieb wird über die Stornierung informiert.", { titel: "Kaufanfrage stornieren?", ja: "Stornieren", gefahr: true }))) return;
  const { error } = await sb.from("part_orders").update({ status: "cancelled" }).eq("id", id);
  if (error) return toast(error.message);
  toast("Storniert."); vPartsMarket();
}

// --- Werkstatt: eigene Teile verwalten ---
async function vWsParts() {
  if (needWorkshop()) return;
  main.innerHTML = `
  <div class="pageHead">
    <div><h1>Meine Teile</h1><div class="sub">Verkaufe neue und gebrauchte Teile über den Carfixo-Marktplatz${myWorkshop.is_verified ? "" : " – sichtbar nach Verifizierung deines Betriebs"}.</div></div>
    <div class="right"><button class="btn sm" onclick="openPartForm()">＋ Teil einstellen</button></div>
  </div>
  ${myWorkshop.is_verified ? "" : `<div class="warn">Dein Betrieb ist noch nicht verifiziert – deine Teile werden erst nach der Freischaltung öffentlich angezeigt. Du kannst sie aber jetzt schon anlegen.</div>`}
  <div id="wsPartOrders"></div>
  <div class="rowHead" style="margin:6px 0 12px"><h2 style="font-size:18px;font-weight:800">Meine Teile-Angebote</h2></div>
  <div id="wspList" class="grid2"><div class="sk" style="height:120px"></div></div>`;
  loadWsPartOrders();
  await loadWsParts();
}
async function loadWsPartOrders() {
  const box = $("wsPartOrders"); if (!box) return;
  const { data } = await sb.from("part_orders").select("*").eq("workshop_id", myWorkshop.id).order("created_at", { ascending: false });
  const open = (data || []).filter(o => !["cancelled", "completed"].includes(o.status));
  if (!data || !data.length) { box.innerHTML = ""; return; }
  box.innerHTML = `<div class="rowHead" style="margin:6px 0 12px"><h2 style="font-size:18px;font-weight:800">Bestellungen${open.length ? ` <span class="badge b-gold">${open.length} offen</span>` : ""}</h2></div>` +
    data.map(o => {
      const st = PO_STATUS[o.status] || ["?", "b-grey"];
      const next = { requested: ["confirmed", "Bestätigen"], confirmed: ["ready", o.fulfillment === "shipping" ? "Als versandt markieren" : "Als abholbereit markieren"], ready: ["completed", "Abschließen"] }[o.status];
      return `<div class="card" style="margin-bottom:10px">
        <div class="cardHead"><div class="ico icoGreen"></div>
          <div style="flex:1;min-width:0"><div class="tt">${esc(o.part_title)}</div>
          <div class="mm">${o.price != null ? fmtEur(o.price) + " · " : ""}${o.fulfillment === "shipping" ? "Versand" : "Abholung"} · ${esc(o.buyer_contact || "–")}</div>
          ${o.buyer_note ? `<div class="mm" style="margin-top:3px">${esc(o.buyer_note)}</div>` : ""}</div>
          <span class="badge ${st[1]}">${st[0]}</span></div>
        <div class="foot">
          ${next ? `<button class="btn sm" onclick="setPartOrderStatus('${o.id}','${next[0]}')">${next[1]}</button>` : ""}
          ${["cancelled", "completed"].includes(o.status) ? "" : `<button class="btn ghost sm" onclick="setPartOrderStatus('${o.id}','cancelled')">Ablehnen/Stornieren</button>`}
        </div>
      </div>`;
    }).join("");
}
async function setPartOrderStatus(id, status) {
  const { error } = await sb.from("part_orders").update({ status }).eq("id", id);
  if (error) return toast(error.message);
  toast("Aktualisiert ✓"); loadWsPartOrders();
}
async function loadWsParts() {
  const box = $("wspList"); if (!box) return;
  const { data, error } = await sb.from("parts").select("*").eq("workshop_id", myWorkshop.id).order("created_at", { ascending: false });
  if (error) { box.innerHTML = `<div class="warn" style="grid-column:1/-1">${esc(error.message)}</div>`; return; }
  window._wsParts = data || [];
  box.innerHTML = (data || []).length === 0
    ? `<div class="empty" style="grid-column:1/-1"><div class="e">${ico("puzzle",40)}</div>Noch keine Teile eingestellt.<br><span class="mm">Stelle dein erstes Teil ein – Kunden finden es im Teile-Marktplatz.</span></div>`
    : data.map(p => {
      const c = PART_CATS[p.category] || ["", p.category];
      const img = (p.images || [])[0];
      return `<div class="card">
        <div class="cardHead">
          ${img ? `<img src="${esc(img)}" loading="lazy" alt="" style="width:52px;height:52px;object-fit:cover;border-radius:10px">` : `<div class="ico icoBlue">${ico(p.category)}</div>`}
          <div style="flex:1;min-width:0">
            <div class="tt">${esc(p.title)} ${p.active ? "" : '<span class="badge b-grey">pausiert</span>'}</div>
            <div class="mm">${ico(p.category)} ${esc(c[1])} · ${esc(PART_CONDITIONS[p.condition] || p.condition)} · ${p.price != null ? fmtEur(p.price) : "Preis auf Anfrage"}</div>
          </div>
        </div>
        <div class="foot">
          <button class="btn ghost sm" onclick='openPartForm(${JSON.stringify(p.id)})'>Bearbeiten</button>
          <button class="btn ghost sm" onclick='togglePart(${JSON.stringify(p.id)},${!p.active})'>${p.active ? "Pausieren" : "Aktivieren"}</button>
          <button class="btn red sm" onclick='deletePart(${JSON.stringify(p.id)})'>Löschen</button>
        </div>
      </div>`;
    }).join("");
}
function openPartForm(editId) {
  const p = editId ? (window._wsParts || []).find(x => x.id === editId) || {} : {};
  openModal(`
    <h2 style="font-size:20px;font-weight:800">${editId ? "Teil bearbeiten" : "Teil einstellen"}</h2>
    <div class="label">Titel *</div>
    <input id="pfTitle" maxlength="90" placeholder="z.B. BMW 19 Zoll Alufelgen Styling 442 (Satz)" value="${esc(p.title || "")}">
    <div class="split">
      <div><div class="label">Kategorie *</div><select id="pfCat">${Object.entries(PART_CATS).map(([k, [ic, n]]) => `<option value="${k}" ${p.category === k ? "selected" : ""}>${ic} ${n}</option>`).join("")}</select></div>
      <div><div class="label">Zustand *</div><select id="pfCond">${Object.entries(PART_CONDITIONS).map(([k, l]) => `<option value="${k}" ${p.condition === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    </div>
    <div class="split">
      <div><div class="label">Preis in € (leer = auf Anfrage)</div><input id="pfPrice" inputmode="decimal" placeholder="z.B. 899" value="${p.price != null ? esc(p.price) : ""}"></div>
      <div><div class="label">Preiszusatz (optional)</div><input id="pfPriceNote" maxlength="30" placeholder="z.B. VB / pro Satz" value="${esc(p.price_note || "")}"></div>
    </div>
    <div><div class="label">Verfügbare Stückzahl (leer = auf Anfrage)</div><input id="pfQty" inputmode="numeric" placeholder="z.B. 4 · 0 = vergriffen" value="${p.quantity != null ? esc(p.quantity) : ""}"></div>
    <div class="split">
      <div><div class="label">Hersteller / Marke (optional)</div><input id="pfBrand" maxlength="60" placeholder="z.B. Bosch, BBS, Original BMW" value="${esc(p.brand || "")}"></div>
      <div><div class="label">OE-/Teilenummer (optional)</div><input id="pfOem" maxlength="60" placeholder="z.B. 36116787778" value="${esc(p.oem_number || "")}"></div>
    </div>
    <div class="label">Passend für (optional)</div>
    <input id="pfFits" maxlength="120" placeholder="z.B. BMW 3er F30/F31 (2012–2019)" value="${esc(p.fits || "")}">
    <div class="label">Beschreibung (optional)</div>
    <textarea id="pfDesc" placeholder="Zustand, Lieferumfang, Besonderheiten…">${esc(p.description || "")}</textarea>
    <label class="inline"><input type="checkbox" id="pfInstall" ${p.install_service ? "checked" : ""}> Einbau durch uns möglich</label>
    <label class="inline"><input type="checkbox" id="pfShip" ${p.shipping ? "checked" : ""}> Versand möglich</label>
    <div class="label">Fotos (bis 4 Bilder)</div>
    <input type="file" id="pfImgs" accept="image/*" multiple style="padding:9px">
    ${(p.images || []).length ? `<div class="thumbs" style="margin-top:8px">${p.images.map((u, i) => `
      <span style="position:relative"><img src="${esc(u)}" loading="lazy" alt="">
      <button onclick="removePartImg('${p.id}',${i})" aria-label="Bild entfernen" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:none;background:var(--red);color:#fff;font-size:11px;cursor:pointer">✕</button></span>`).join("")}</div>` : ""}
    <div class="btnRow">
      <button class="btn" id="pfSave">${editId ? "Speichern" : "Teil einstellen"}</button>
      <button class="btn ghost" onclick="closeModal()">Abbrechen</button>
    </div>
    <div class="err" id="pfErr"></div>`);
  $("pfSave").onclick = () => savePart(editId || null, p);
}
async function savePart(editId, prev) {
  const err = $("pfErr"); err.style.display = "none";
  const title = $("pfTitle").value.trim();
  if (!title) return showErr(err, "Bitte einen Titel angeben.");
  const priceRaw = ($("pfPrice").value || "").trim().replace(",", ".");
  if (priceRaw && isNaN(parseFloat(priceRaw))) return showErr(err, "Bitte einen gültigen Preis angeben (oder leer lassen).");
  $("pfSave").disabled = true; $("pfSave").textContent = "Wird gespeichert…";
  const images = [...(prev?.images || [])];
  for (const f of [...$("pfImgs").files].slice(0, 4 - images.length)) {
    if (f.size >= 8 * 1024 * 1024) continue;
    const u = await uploadWsImage(f, "part");
    if (u) images.push(u);
  }
  const row = {
    workshop_id: myWorkshop.id, title,
    category: $("pfCat").value, condition: $("pfCond").value,
    price: priceRaw ? parseFloat(priceRaw) : null,
    price_note: $("pfPriceNote").value.trim() || null,
    brand: $("pfBrand").value.trim() || null,
    oem_number: $("pfOem").value.trim() || null,
    fits: $("pfFits").value.trim() || null,
    description: $("pfDesc").value.trim() || null,
    install_service: $("pfInstall").checked, shipping: $("pfShip").checked,
    quantity: $("pfQty").value.trim() === "" ? null : Math.max(0, parseInt($("pfQty").value, 10) || 0),
    images,
  };
  const q = editId ? sb.from("parts").update(row).eq("id", editId) : sb.from("parts").insert(row);
  const { error } = await q;
  $("pfSave").disabled = false; $("pfSave").textContent = editId ? "Speichern" : "Teil einstellen";
  if (error) return showErr(err, error.message);
  allParts = null;
  closeModal(); toast(editId ? "Gespeichert ✓" : "Teil eingestellt ✓");
  loadWsParts();
}
async function removePartImg(partId, i) {
  const p = (window._wsParts || []).find(x => x.id === partId);
  if (!p) return;
  const images = [...(p.images || [])];
  images.splice(i, 1);
  const { error } = await sb.from("parts").update({ images }).eq("id", partId);
  if (error) return toast(error.message);
  p.images = images;
  allParts = null;
  toast("Bild entfernt.");
  openPartForm(partId);
}
async function togglePart(id, active) {
  const { error } = await sb.from("parts").update({ active }).eq("id", id);
  if (error) return toast(error.message);
  allParts = null;
  toast(active ? "Teil aktiviert ✓" : "Teil pausiert.");
  loadWsParts();
}
async function deletePart(id) {
  if (!(await frage("Das Teil verschwindet aus dem Marktplatz.", { titel: "Teil löschen?", ja: "Löschen", gefahr: true }))) return;
  const { error } = await sb.from("parts").delete().eq("id", id);
  if (error) return toast(error.message);
  allParts = null;
  toast("Gelöscht.");
  loadWsParts();
}

// ============================================================
// ERINNERUNGEN (Premium)
// ============================================================
const REMINDER_KINDS = { tuev: ["", "TÜV / HU"], service: ["", "Service / Inspektion"], reifen: ["", "Reifenwechsel"], custom: ["", "Eigene Erinnerung"] };
async function vReminders() {
  if (!requireAuth()) return;
  if (!myProfile?.is_premium) {
    main.innerHTML = `
    <div class="pageHead"><div><h1>Erinnerungen</h1><div class="sub">Nie wieder TÜV, Service oder Reifenwechsel verpassen.</div></div></div>
    <div class="card" style="max-width:560px;margin:30px auto;text-align:center;border-color:rgba(255,176,32,.4)">
      <div style="font-size:44px"></div>
      <h2 style="font-size:22px;font-weight:800;margin-top:10px">Carfixo Premium</h2>
      <p class="mm" style="margin-top:10px;font-size:13.5px">Automatische Erinnerungen, wenn dein TÜV abläuft, ein Service ansteht oder der saisonale Reifenwechsel fällig ist – inklusive passender Angebote aus deiner Nähe.</p>
      <div class="chips" style="justify-content:center;margin-top:16px">
        <span class="pill">TÜV-Warnung</span><span class="pill">Service-Intervalle</span><span class="pill">Saison-Reifen</span>
      </div>
      <button class="btn wide" style="margin-top:20px" id="premGo">Premium aktivieren – aktuell kostenlos</button>
    </div>`;
    $("premGo").onclick = async () => {
      const { error } = await sb.from("profiles").update({ is_premium: true }).eq("id", me.id);
      if (error) return toast(error.message);
      myProfile.is_premium = true;
      toast("Premium aktiviert ");
      vReminders();
    };
    return;
  }
  main.innerHTML = `
  <div class="pageHead">
    <div><h1>Erinnerungen <span class="badge b-gold">Premium</span></h1><div class="sub">Deine anstehenden Termine rund ums Auto.</div></div>
    <div class="right"><button class="btn sm" onclick="openReminderForm()">＋ Erinnerung</button>
    <button class="btn ghost sm" id="remAuto">Aus Fahrzeugen übernehmen</button></div>
  </div>
  <div id="remList"><div class="sk" style="height:100px"></div></div>`;
  $("remAuto").onclick = autoReminders;
  await loadReminders();
}
async function loadReminders() {
  const { data, error } = await sb.from("reminders").select("*, vehicles(make,model)").eq("user_id", me.id).order("due_date");
  const box = $("remList"); if (!box) return;
  if (error) { box.innerHTML = `<div class="warn">${esc(error.message)}</div>`; return; }
  if (!data || data.length === 0) { box.innerHTML = `<div class="empty"><div class="e">${ico("bell",40)}</div>Keine Erinnerungen. Lege eine an oder übernimm TÜV-Termine aus deinen Fahrzeugen.</div>`; return; }
  const now = new Date();
  box.innerHTML = data.map(rm => {
    const k = REMINDER_KINDS[rm.kind] || REMINDER_KINDS.custom;
    const due = new Date(rm.due_date);
    const days = Math.ceil((due - now) / 864e5);
    const urgency = rm.done ? '<span class="badge b-grey">Erledigt</span>'
      : days < 0 ? '<span class="badge b-red">Überfällig!</span>'
      : days <= 30 ? `<span class="badge b-gold">In ${days} Tagen</span>`
      : `<span class="badge b-blue">In ${days} Tagen</span>`;
    return `<div class="card" style="margin-bottom:11px;${rm.done ? "opacity:.55" : ""}">
      <div class="cardHead"><div class="ico">${k[0]}</div>
        <div style="flex:1"><div class="tt">${esc(rm.title)}</div>
        <div class="mm">${fmtDate(rm.due_date)}${rm.vehicles ? " · " + esc(rm.vehicles.make + " " + rm.vehicles.model) : ""}${rm.note ? " · " + esc(rm.note) : ""}</div></div>
        ${urgency}</div>
      <div class="foot">
        ${!rm.done ? `<button class="btn ghost sm" onclick="setReminderDone('${rm.id}',true)">✓ Erledigt</button>` : `<button class="btn ghost sm" onclick="setReminderDone('${rm.id}',false)">Wieder öffnen</button>`}
        ${!rm.done && rm.kind !== "custom" ? `<a class="btn sm" href="#/new-request">Passenden Betrieb finden →</a>` : ""}
        <button class="btn red sm" onclick="deleteReminder('${rm.id}')">Löschen</button>
      </div>
    </div>`;
  }).join("");
}
async function setReminderDone(id, done) {
  await sb.from("reminders").update({ done }).eq("id", id);
  loadReminders();
}
async function deleteReminder(id) {
  await sb.from("reminders").delete().eq("id", id);
  loadReminders();
}
async function openReminderForm() {
  const { data: cars } = await sb.from("vehicles").select("id,make,model").eq("owner_id", me.id);
  openModal(`
    <h2 style="font-size:20px;font-weight:800">Neue Erinnerung</h2>
    <div class="label">Art</div>
    <select id="rmKind">${Object.entries(REMINDER_KINDS).map(([k, v]) => `<option value="${k}">${v[0]} ${v[1]}</option>`).join("")}</select>
    <div class="label">Titel</div>
    <input id="rmTitle" placeholder="z.B. TÜV BMW 3er">
    <div class="label">Fällig am</div>
    <input id="rmDate" type="date">
    <div class="label">Fahrzeug (optional)</div>
    <select id="rmCar">${opt("Kein Fahrzeug", (cars || []).map(c => c.make + " " + c.model), "")}</select>
    <div class="label">Notiz (optional)</div>
    <input id="rmNote" placeholder="z.B. vorher Bremsen prüfen lassen">
    <div class="btnRow">
      <button class="btn" id="rmGo">Speichern</button>
      <button class="btn ghost" onclick="closeModal()">Abbrechen</button>
    </div>
    <div class="err" id="rmErr"></div>`);
  $("rmGo").onclick = async () => {
    const title = $("rmTitle").value.trim(), date = $("rmDate").value;
    if (!title || !date) return showErr($("rmErr"), "Bitte Titel und Datum angeben.");
    const carIdx = $("rmCar").selectedIndex - 1;
    const { error } = await sb.from("reminders").insert({
      user_id: me.id, kind: $("rmKind").value, title, due_date: date,
      vehicle_id: carIdx >= 0 ? cars[carIdx].id : null, note: $("rmNote").value.trim() || null,
    });
    if (error) return showErr($("rmErr"), error.message);
    closeModal(); toast("Erinnerung angelegt ");
    loadReminders();
  };
}
async function autoReminders() {
  const { data: cars } = await sb.from("vehicles").select("*").eq("owner_id", me.id);
  const { data: existing } = await sb.from("reminders").select("vehicle_id,kind").eq("user_id", me.id);
  const have = new Set((existing || []).map(r => r.vehicle_id + "|" + r.kind));
  let created = 0;
  for (const v of cars || []) {
    if (v.tuev_until && !have.has(v.id + "|tuev")) {
      await sb.from("reminders").insert({ user_id: me.id, kind: "tuev", title: `TÜV ${v.make} ${v.model}`, due_date: v.tuev_until, vehicle_id: v.id });
      created++;
    }
  }
  // Saisonale Reifen-Erinnerung (O bis O: Oktober & Ostern)
  const now = new Date();
  const nextSwitch = now.getMonth() >= 9 || now.getMonth() < 3
    ? new Date(now.getFullYear() + (now.getMonth() >= 9 ? 1 : 0), 3, 1)
    : new Date(now.getFullYear(), 9, 1);
  for (const v of cars || []) {
    if (!have.has(v.id + "|reifen")) {
      await sb.from("reminders").insert({ user_id: me.id, kind: "reifen", title: `Reifenwechsel ${v.make} ${v.model}`, due_date: nextSwitch.toISOString().slice(0, 10), vehicle_id: v.id, note: "Saisonwechsel (O bis O)" });
      created++;
    }
  }
  toast(created ? `${created} Erinnerung${created > 1 ? "en" : ""} erstellt ✓` : "Nichts Neues – TÜV-Datum bei den Fahrzeugen pflegen.");
  loadReminders();
}

// ============================================================
// KONTO
// ============================================================
async function vAccount() {
  if (!requireAuth()) return;
  const isWs = !!myWorkshop;
  main.innerHTML = `
  <div class="pageHead"><div><h1>Konto</h1></div></div>
  <div class="grid2" style="align-items:start">
    <div class="card">
      <div class="cardHead">
        <div class="avatar" style="width:52px;height:52px;font-size:19px">${esc(initials(myProfile?.full_name || me.email))}</div>
        <div><div class="tt">${esc(myProfile?.full_name || "Ohne Namen")}</div>
        <div class="mm">${esc(me.email)} · Rolle: ${isWs ? "Betrieb" : myProfile?.role === "admin" ? "Admin" : "Kunde"}${myProfile?.is_premium ? " · Premium" : ""}</div></div>
      </div>
      <div class="label">Name</div>
      <input id="accName" value="${esc(myProfile?.full_name || "")}">
      <div class="label">Telefon</div>
      <input id="accPhone" value="${esc(myProfile?.phone || "")}" placeholder="+49 …">
      <button class="btn" style="margin-top:16px" id="accSave">Speichern</button>
    </div>
    <div>
      ${isWs ? `<div class="card" style="margin-bottom:14px">
        <div class="tt">${esc(myWorkshop.name)}</div>
        <p class="mm" style="margin-top:6px">${myWorkshop.is_verified ? '<span class="badge b-green">✓ verifiziert</span> Dein Betrieb ist sichtbar und kann Angebote senden.' : '<span class="badge b-gold">Warten auf Verifizierung</span> Ein Admin prüft deinen Betrieb.'}</p>
        <a class="btn ghost sm" style="margin-top:12px" href="#/ws/profile">Betriebsprofil bearbeiten</a>
      </div>` : `<div class="card" style="margin-bottom:14px">
        <div class="tt">Carfixo Premium</div>
        <p class="mm" style="margin-top:6px">${myProfile?.is_premium ? "Aktiv – du bekommst Erinnerungen für TÜV, Service und Reifen." : "Erinnerungen für TÜV, Service & saisonale Reifenwechsel."}</p>
        <button class="btn ghost sm" style="margin-top:12px" id="premToggle">${myProfile?.is_premium ? "Premium deaktivieren" : "Premium aktivieren (aktuell kostenlos)"}</button>
      </div>`}
      ${myProfile?.role === "admin" ? `<div class="card" style="margin-bottom:14px"><div class="tt">Admin</div><a class="btn ghost sm" style="margin-top:12px" href="admin.html">Admin-Bereich öffnen</a></div>` : ""}
      ${!isWs ? `<div class="card" style="margin-bottom:14px">
        <div class="tt">Meine Favoriten</div>
        <div id="favList" style="margin-top:8px"><div class="sk" style="height:40px"></div></div>
      </div>` : ""}
      <div class="card" style="margin-bottom:14px">
        <div class="tt">Benachrichtigungen</div>
        <label class="inline"><input type="checkbox" id="npEmail" ${myProfile?.notify_prefs?.email !== false ? "checked" : ""}> E-Mail-Benachrichtigungen</label>
        <label class="inline"><input type="checkbox" id="npPush" ${myProfile?.notify_prefs?.push !== false ? "checked" : ""}> Push-Benachrichtigungen</label>
        <label class="inline"><input type="checkbox" id="npRem" ${myProfile?.notify_prefs?.reminders !== false ? "checked" : ""}> Erinnerungen (TÜV, Service, Reifen)</label>
        <label class="inline"><input type="checkbox" id="npMkt" ${myProfile?.notify_prefs?.marketing ? "checked" : ""}> Marketing-E-Mails</label>
        <p class="mm" style="margin-top:8px;font-size:11px">Notfall- und sicherheitsrelevante Benachrichtigungen bleiben immer aktiv.</p>
        <button class="btn ghost sm" style="margin-top:10px" id="npSave">Einstellungen speichern</button>
      </div>
      <div class="card" style="margin-bottom:14px" id="pushBox"><div class="sk" style="height:60px"></div></div>
      <div class="card" style="margin-bottom:14px">
        <div class="tt">Hilfe & Rechtliches</div>
        <div class="btnRow">
          <button class="btn ghost sm" onclick="startTour('${myWorkshop ? "workshop" : "customer"}')">Tour erneut starten</button>
          <a class="btn ghost sm" href="legal.html" target="_blank">Datenschutz & Impressum</a>
        </div>
      </div>
      <div class="card">
        <div class="tt">Konto & Daten</div>
        <p class="mm" style="margin-top:6px">Du kannst deine Daten jederzeit exportieren oder dein Konto löschen.</p>
        <div class="btnRow">
          <button class="btn ghost sm" onclick="exportMyData()">⬇ Daten exportieren (JSON)</button>
          <button class="btn ghost sm" onclick="signOut()">Abmelden</button>
          <button class="btn red sm" onclick="confirmDeleteAccount()">Konto löschen</button>
        </div>
      </div>
      ${appEinstellungenHtml()}
    </div>
  </div>`;
  appEinstellungenBinden();
  $("accSave").onclick = async () => {
    const { error } = await sb.from("profiles").update({ full_name: $("accName").value.trim() || null, phone: $("accPhone").value.trim() || null }).eq("id", me.id);
    if (error) return toast(error.message);
    myProfile.full_name = $("accName").value.trim();
    toast("Gespeichert ✓");
    renderNav("account");
  };
  if ($("favList")) {
    const { data: favs } = await sb.from("favorites").select("workshop_id, workshops(id,name,district,rating_avg,rating_count)").eq("user_id", me.id);
    $("favList").innerHTML = (favs || []).length === 0
      ? '<p class="mm">Noch keine Favoriten – merke dir Werkstätten über im Profil oder in der Suche.</p>'
      : favs.map(f => {
        const w = f.workshops || {};
        return `<div class="offerLine"><span><a href="#/workshop/${w.id}" style="color:var(--ink);font-weight:700">${esc(w.name || "")}</a> <span class="mm">${esc(w.district || "")} · ★ ${w.rating_avg > 0 ? Number(w.rating_avg).toLocaleString("de-DE") : "Neu"}</span></span>
          <a href="#/new-request?ws=${w.id}" style="color:var(--blue2);font-weight:700;font-size:12px">Erneut anfragen →</a></div>`;
      }).join("");
  }
  renderPushBox();
  $("npSave").onclick = async () => {
    const prefs = { email: $("npEmail").checked, push: $("npPush").checked, reminders: $("npRem").checked, marketing: $("npMkt").checked };
    const { error } = await sb.from("profiles").update({ notify_prefs: prefs }).eq("id", me.id);
    if (error) return toast(error.message);
    myProfile.notify_prefs = prefs;
    toast("Benachrichtigungen gespeichert ✓");
  };
  const pt = $("premToggle");
  if (pt) pt.onclick = async () => {
    const nv = !myProfile.is_premium;
    const { error } = await sb.from("profiles").update({ is_premium: nv }).eq("id", me.id);
    if (error) return toast(error.message);
    myProfile.is_premium = nv;
    toast(nv ? "Premium aktiviert " : "Premium deaktiviert.");
    vAccount();
  };
}

// ============================================================
// WERKSTATT: Dashboard
// ============================================================
function needWorkshop() {
  if (!requireAuth()) return true;
  if (!myWorkshop) {
    const pending = localStorage.getItem("cfx_pending_ws");
    main.innerHTML = `<div class="pageHead"><div><h1>Betrieb einrichten</h1></div></div>
      <div class="card" style="max-width:520px">
        <p class="mm">Zu deinem Konto gehört noch kein Betrieb.</p>
        <div class="label">Name des Betriebs</div>
        <input id="wsNewName" value="${esc(pending || "")}" placeholder="z.B. Muster KFZ GmbH">
        <button class="btn" style="margin-top:16px" id="wsNewGo">Betrieb anlegen</button>
      </div>`;
    $("wsNewGo").onclick = async () => {
      const name = $("wsNewName").value.trim();
      if (!name) return toast("Bitte einen Namen angeben.");
      await createWorkshopForMe(name);
      localStorage.removeItem("cfx_pending_ws");
      go("ws/profile");
    };
    return true;
  }
  return false;
}
async function vWsDashboard() {
  if (needWorkshop()) return;
  main.innerHTML = `
  <div class="pageHead">
    <div><h1>${esc(myWorkshop.name)}</h1>
    <div class="sub">${myWorkshop.is_verified ? "✓ Verifiziert – du siehst passende Ausschreibungen live." : "Noch nicht verifiziert – ein Admin prüft deinen Betrieb. Vervollständige solange dein Profil."}</div></div>
    <div class="right">
      <a class="btn ghost sm" href="#/ws/stats">Statistiken</a>
      <a class="btn ghost sm" href="#/ws/archive">Archiv</a>
      <a class="btn ghost sm" href="#/ws/profile">Profil</a>
    </div>
  </div>
  ${!myWorkshop.is_verified ? `<div class="warn">Dein Betrieb ist noch nicht freigeschaltet. Sobald ein Admin dich verifiziert, siehst du offene Ausschreibungen und kannst Angebote senden.</div>` : ""}
  <div class="kpiRow" id="kpis">
    <div class="kpi"><b class="sk" style="width:40px;height:26px;display:block"></b><span>Offene Anfragen</span></div>
    <div class="kpi"><b>–</b><span>Gesendete Angebote</span></div>
    <div class="kpi"><b>–</b><span>Aktive Aufträge</span></div>
    <div class="kpi"><b>–</b><span>Bewertung</span></div>
  </div>
  <div class="grid2" style="align-items:start">
    <div class="card"><div class="tt">Neueste Anfragen</div><div id="dashLeads" style="margin-top:12px"><div class="sk" style="height:80px"></div></div>
      <a class="btn ghost sm" style="margin-top:6px" href="#/ws/leads">Alle Anfragen →</a></div>
    <div class="card"><div class="tt">Aktuelle Aufträge</div><div id="dashJobs" style="margin-top:12px"><div class="sk" style="height:80px"></div></div>
      <a class="btn ghost sm" style="margin-top:6px" href="#/ws/jobs">Alle Aufträge →</a></div>
  </div>`;
  const [{ data: leads }, { data: offers }, { data: jobs }] = await Promise.all([
    sb.from("requests").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(6),
    sb.from("offers").select("id,status").eq("workshop_id", myWorkshop.id),
    sb.from("bookings").select("*, offers(request_id, requests(title))").eq("workshop_id", myWorkshop.id).order("created_at", { ascending: false }),
  ]);
  const activeJobs = (jobs || []).filter(j => !["completed", "cancelled"].includes(j.status));
  $("kpis").innerHTML = `
    <div class="kpi"><b>${(leads || []).length}</b><span>Offene Anfragen</span></div>
    <div class="kpi"><b>${(offers || []).length}</b><span>Gesendete Angebote</span></div>
    <div class="kpi"><b>${activeJobs.length}</b><span>Aktive Aufträge</span></div>
    <div class="kpi"><b>${myWorkshop.rating_avg > 0 ? "★ " + Number(myWorkshop.rating_avg).toLocaleString("de-DE") : "–"}</b><span>${myWorkshop.rating_count || 0} Bewertungen</span></div>`;
  $("dashLeads").innerHTML = (leads || []).length === 0
    ? `<div class="empty" style="padding:18px">Keine offenen Anfragen${myWorkshop.is_verified ? "" : " (Verifizierung ausstehend)"}.</div>`
    : leads.slice(0, 4).map(r => leadRowHtml(r)).join("");
  $("dashJobs").innerHTML = activeJobs.length === 0
    ? `<div class="empty" style="padding:18px">Keine aktiven Aufträge.</div>`
    : activeJobs.slice(0, 4).map(b => `
      <div class="card tap" style="margin-bottom:9px;padding:13px" onclick="go('ws/jobs')">
        <div class="cardHead"><div class="ico"></div>
        <div style="flex:1"><div class="tt" style="font-size:13px">${esc(b.offers?.requests?.title || "Auftrag")}</div>
        <div class="mm">${fmtEur(b.total_price)}${b.scheduled_at ? " · " + fmtDateTime(b.scheduled_at) : ""}</div></div>
        <span class="badge ${BK_STATUS[b.status]?.[1] || "b-grey"}">${BK_STATUS[b.status]?.[0] || b.status}</span></div>
      </div>`).join("");
}
function leadRowHtml(r) {
  const c = CATS[r.category] || { icon: "", name: r.category };
  return `<div class="card tap" style="margin-bottom:9px;padding:13px" onclick="go('ws/lead/${r.id}')">
    <div class="cardHead"><div class="ico">${ico(r.category)}</div>
      <div style="flex:1;min-width:0"><div class="tt" style="font-size:13px">${esc(r.title)} ${r.type === "direct" ? '<span class="badge b-purple">Direkt an dich</span>' : ""}</div>
      <div class="mm">${esc(r.vehicle_label || "k.A.")}</div>
      <div class="mm">${c.name}${r.district ? " · " + esc(r.district) : ""}${r.asap ? " · ASAP" : ""}${r.budget_max ? " · bis " + fmtEur(r.budget_max) : ""}</div></div>
      <span class="badge b-blue">Ansehen →</span></div>
  </div>`;
}

// ============================================================
// WERKSTATT: Anfragen (Leads)
// ============================================================
let leadTab = "open";
async function vWsLeads() {
  if (needWorkshop()) return;
  main.innerHTML = `
  <div class="pageHead"><div><h1>Anfragen</h1><div class="sub">Offene Ausschreibungen aus deinen Kategorien und Direktanfragen an deinen Betrieb.</div></div></div>
  ${!myWorkshop.is_verified ? `<div class="warn">Noch nicht verifiziert – du siehst Anfragen erst nach der Freischaltung durch einen Admin.</div>` : ""}
  <div class="seg" id="leadSeg">
    <div data-t="open" class="${leadTab === "open" ? "on" : ""}">Ausschreibungen</div>
    <div data-t="direct" class="${leadTab === "direct" ? "on" : ""}">Direktanfragen</div>
    <div data-t="mine" class="${leadTab === "mine" ? "on" : ""}">Meine Angebote</div>
  </div>
  <div id="leadList"><div class="sk" style="height:110px"></div></div>`;
  document.querySelectorAll("#leadSeg div").forEach(d => d.onclick = () => {
    leadTab = d.dataset.t;
    document.querySelectorAll("#leadSeg div").forEach(x => x.classList.toggle("on", x === d));
    loadLeads();
  });
  await loadLeads();
  const ch = sb.channel("ws-leads")
    .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => loadLeads())
    .subscribe();
  rtChannels.push(ch);
}
async function loadLeads() {
  const box = $("leadList"); if (!box) return;
  if (leadTab === "mine") {
    const { data: offers, error } = await sb.from("offers").select("*, requests(id,title,vehicle_label,status)").eq("workshop_id", myWorkshop.id).order("created_at", { ascending: false });
    if (error) { box.innerHTML = `<div class="warn">${esc(error.message)}</div>`; return; }
    box.innerHTML = (offers || []).length === 0
      ? `<div class="empty"><div class="e">${ico("megaphone",40)}</div>Noch keine Angebote gesendet.</div>`
      : offers.map(o => `
        <div class="card tap" style="margin-bottom:11px" onclick="go('ws/lead/${o.requests?.id}')">
          <div class="cardHead"><div class="ico"></div>
            <div style="flex:1"><div class="tt">${esc(o.requests?.title || "Anfrage")}</div>
            <div class="mm">${esc(o.requests?.vehicle_label || "")} · Angebot: <b>${fmtEur(o.total_price)}</b> · ${fmtDate(o.created_at)}</div></div>
            <span class="badge ${o.status === "accepted" ? "b-green" : o.status === "declined" ? "b-grey" : "b-blue"}">${o.status === "accepted" ? "Angenommen ✓" : o.status === "declined" ? "Abgelehnt" : "Gesendet"}</span></div>
        </div>`).join("");
    return;
  }
  const { data, error } = await sb.from("requests").select("*").eq("status", "open").order("created_at", { ascending: false });
  if (error) { box.innerHTML = `<div class="warn">${esc(error.message)}</div>`; return; }
  const list = (data || []).filter(r => leadTab === "direct" ? (r.type === "direct" && r.workshop_id === myWorkshop.id) : r.type === "open");
  box.innerHTML = list.length === 0
    ? `<div class="empty"><div class="e">${ico("chat",40)}</div>${leadTab === "direct" ? "Keine Direktanfragen – Kunden finden dich über dein Profil in der Suche." : "Keine offenen Ausschreibungen in deinen Kategorien. Neue erscheinen automatisch."}</div>`
    : list.map(r => leadRowHtml(r)).join("");
}

// ============================================================
// WERKSTATT: Lead-Detail + Angebot + Chat
// ============================================================
async function vWsLead(id) {
  if (needWorkshop() || !id) return;
  main.innerHTML = `<div class="sk" style="height:220px"></div>`;
  const { data: r } = await sb.from("requests").select("*").eq("id", id).maybeSingle();
  if (!r) { main.innerHTML = `<div class="warn">Anfrage nicht gefunden (evtl. bereits vergeben).</div>`; return; }
  const [{ data: myOffer }, { data: templates }] = await Promise.all([
    sb.from("offers").select("*").eq("request_id", id).eq("workshop_id", myWorkshop.id).maybeSingle(),
    sb.from("offer_templates").select("*").eq("workshop_id", myWorkshop.id).order("name"),
  ]);
  window._oTemplates = templates || [];
  const c = CATS[r.category] || { icon: "", name: r.category };
  const partsLabel = (PARTS_OPTIONS.find(p => p[0] === r.parts_preference) || [])[1];
  main.innerHTML = `
  <div class="pageHead">
    <div class="ico" style="width:52px;height:52px;font-size:23px">${ico(r.category)}</div>
    <div style="flex:1"><h1>${esc(r.title)}</h1>
    <div class="sub">${esc(r.vehicle_label || "k.A.")} · ${c.name}${r.type === "direct" ? " · Direktanfrage an dich" : ""}${r.urgency === "notfall" ? ' · <span class="badge b-red">NOTFALL</span>' : r.urgency === "dringend" ? ' · <span class="badge b-gold">Dringend</span>' : ""}</div></div>
  </div>
  <div class="grid2" style="align-items:start">
    <div>
      <div class="card" style="margin-bottom:14px">
        <div class="tt">Anfrage-Details</div>
        <p class="mm" style="margin-top:8px;font-size:13px">${esc(r.description)}</p>
        <div class="chips" style="margin-top:10px">
          ${(r.extras?.leistungen || []).map(s => `<span class="pill">${esc(s)}</span>`).join("")}
          ${partsLabel ? `<span class="pill">${esc(partsLabel)}</span>` : ""}
          ${r.budget_max ? `<span class="pill">Budget bis ${fmtEur(r.budget_max)}</span>` : ""}
          ${r.district ? `<span class="pill">${esc(r.district)}${r.zip ? " (" + esc(r.zip) + ")" : ""}</span>` : ""}
          ${r.asap ? `<span class="pill">ASAP</span>` : ""}
          ${r.preferred_date ? `<span class="pill">${fmtDate(r.preferred_date)}</span>` : ""}
          ${r.service_preference === "mobile" ? `<span class="pill">Mobiler Service gewünscht</span>` : ""}
        </div>
        ${(r.attachments || []).length ? `<div class="thumbs">${r.attachments.map(u => mediaTile(u)).join("")}</div>` : ""}
      </div>
      <div class="card" id="offerBox">
        ${myOffer ? `
          <div class="tt">Dein Angebot <span class="badge ${myOffer.status === "accepted" ? "b-green" : myOffer.status === "declined" ? "b-grey" : "b-blue"}">${myOffer.status === "accepted" ? "Angenommen ✓" : myOffer.status === "declined" ? "Abgelehnt" : "Gesendet"}</span></div>
          <div style="margin-top:10px">${(myOffer.line_items || []).map(li => `<div class="offerLine"><span>${esc(li.label)}${li.meta ? ` <span class="mm">(${esc(li.meta)})</span>` : ""}</span><span>${fmtEur(li.price)}</span></div>`).join("")}
          <div class="offerLine total"><span>Gesamt inkl. MwSt. (${myOffer.is_fixed_price === false ? "Schätzung" : "Festpreis"})</span><span>${fmtEur(myOffer.total_price)}</span></div></div>
          ${myOffer.message ? `<p class="mm" style="margin-top:8px">${esc(myOffer.message)}</p>` : ""}`
        : r.status !== "open" ? `<div class="tt">Diese Anfrage ist nicht mehr offen.</div>`
        : offerFormHtml()}
      </div>
    </div>
    <div class="card">
      <div class="tt">Rückfragen an den Kunden</div>
      <div class="msgs" id="msgs"></div>
      <div class="msgRow"><input id="msgIn" placeholder="Nachricht schreiben…"><button id="msgGo" aria-label="Nachricht senden">${ico("send")}</button></div>
    </div>
  </div>`;
  if ($("oGo")) bindOfferForm(r.id);
  $("msgGo").onclick = () => sendMsg(r.id);
  $("msgIn").onkeydown = (e) => { if (e.key === "Enter") sendMsg(r.id); };
  await loadMsgs(r.id);
  const ch = sb.channel("ws-lead:" + r.id)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "request_id=eq." + r.id }, () => loadMsgs(r.id))
    .subscribe();
  rtChannels.push(ch);
}

// ---------- Strukturierte Angebotskalkulation ----------
const PART_KINDS = ["Original (OEM)", "Marken-Ersatzteil", "Aftermarket", "Gebraucht", "Generalüberholt"];
function offerFormHtml() {
  const tpl = window._oTemplates || [];
  return `
    <div class="tt">Angebot kalkulieren</div>
    ${tpl.length ? `<div class="label">Vorlage laden</div>
    <div class="split"><select id="oTpl">${opt("Vorlage wählen…", tpl.map(t => t.name), "")}</select>
    <button class="btn ghost sm" id="oTplDel" style="flex:0 0 auto" title="Gewählte Vorlage löschen" aria-label="Vorlage löschen">${ico("trash")}</button></div>` : ""}
    <div class="label">Arbeitszeit</div>
    <div class="split">
      <input id="oHours" inputmode="decimal" placeholder="Stunden, z.B. 1,5">
      <input id="oRate" inputmode="decimal" placeholder="Stundensatz €" value="${esc(myWorkshop.hourly_rate || "")}">
    </div>
    <div class="label">Teile</div>
    <div id="oParts"></div>
    <button class="btn ghost sm" id="oPartAdd">＋ Teil hinzufügen</button>
    <div class="label">Material / Kleinteile / Zusatzkosten €</div>
    <input id="oMat" inputmode="decimal" placeholder="z.B. 15">
    <div class="label">Preisart</div>
    <div class="seg" style="margin:4px 0 0" id="oFixed">
      <div data-f="1" class="on">Festpreis</div>
      <div data-f="0">Kostenschätzung (nach Diagnose)</div>
    </div>
    <div class="card" style="margin-top:14px;padding:13px" id="oSum"></div>
    <div class="label">Nachricht an den Kunden (optional)</div>
    <textarea id="oMsg" placeholder="z.B. Termin diese Woche möglich, 12 Monate Garantie auf Teile…" style="min-height:64px"></textarea>
    <label class="inline"><input type="checkbox" id="oSaveTpl"> Als Vorlage speichern</label>
    <input id="oTplName" placeholder="Name der Vorlage, z.B. Bremsen vorne" class="hidden" style="margin-top:8px">
    <button class="btn wide" style="margin-top:14px" id="oGo">Angebot verbindlich senden</button>
    <div class="err" id="oErr"></div>`;
}
function partRowHtml(p = {}) {
  return `<div class="card oPartRow" style="padding:11px;margin-bottom:8px">
    <div class="split">
      <input class="opName" placeholder="Teil, z.B. Bremsbeläge vorne" value="${esc(p.name || "")}">
      <input class="opNo" placeholder="Teilenr. (opt.)" value="${esc(p.no || "")}" style="max-width:110px">
    </div>
    <div class="split" style="margin-top:8px">
      <select class="opKind">${PART_KINDS.map(k => `<option ${p.kind === k ? "selected" : ""}>${k}</option>`).join("")}</select>
      <input class="opQty" inputmode="numeric" placeholder="Menge" value="${esc(p.qty || 1)}" style="max-width:70px">
      <input class="opPrice" inputmode="decimal" placeholder="€/Stück" value="${esc(p.price || "")}" style="max-width:100px">
      <select class="opWarr" style="max-width:130px">${["Keine Garantie","6 Monate","12 Monate","24 Monate"].map(k => `<option ${p.warr === k ? "selected" : ""}>${k}</option>`).join("")}</select>
      <button class="btn red sm" style="flex:0 0 auto" aria-label="Position entfernen" onclick="this.closest('.oPartRow').remove();calcOfferSum()">✕</button>
    </div>
  </div>`;
}
function bindOfferForm(requestId) {
  $("oParts").innerHTML = partRowHtml();
  const recalcIds = ["oHours", "oRate", "oMat"];
  recalcIds.forEach(i => $(i).oninput = calcOfferSum);
  $("oParts").oninput = calcOfferSum;
  $("oPartAdd").onclick = () => { $("oParts").insertAdjacentHTML("beforeend", partRowHtml()); calcOfferSum(); };
  document.querySelectorAll("#oFixed div").forEach(d => d.onclick = () => {
    document.querySelectorAll("#oFixed div").forEach(x => x.classList.toggle("on", x === d));
    calcOfferSum();
  });
  $("oSaveTpl").onchange = () => $("oTplName").classList.toggle("hidden", !$("oSaveTpl").checked);
  const tplSel = $("oTpl");
  if (tplSel) {
    tplSel.onchange = () => {
      const t = (window._oTemplates || []).find(x => x.name === tplSel.value);
      if (!t) return;
      const p = t.pricing || {};
      $("oHours").value = p.labor_hours ?? "";
      $("oRate").value = p.hourly_rate ?? myWorkshop.hourly_rate ?? "";
      $("oMat").value = p.materials ?? "";
      $("oParts").innerHTML = (p.parts || []).map(partRowHtml).join("") || partRowHtml();
      document.querySelectorAll("#oFixed div").forEach(x => x.classList.toggle("on", x.dataset.f === (t.is_fixed_price === false ? "0" : "1")));
      calcOfferSum();
      toast("Vorlage geladen: " + t.name);
    };
    $("oTplDel").onclick = async () => {
      const t = (window._oTemplates || []).find(x => x.name === tplSel.value);
      if (!t) return toast("Bitte zuerst eine Vorlage wählen.");
      await sb.from("offer_templates").delete().eq("id", t.id);
      toast("Vorlage gelöscht.");
      vWsLead(requestId);
    };
  }
  calcOfferSum();
  $("oGo").onclick = () => sendOffer(requestId);
}
function collectOffer() {
  const hours = parseFloat(($("oHours").value || "").replace(",", ".")) || 0;
  const rate = parseFloat(($("oRate").value || "").replace(",", ".")) || 0;
  const mat = parseFloat(($("oMat").value || "").replace(",", ".")) || 0;
  const parts = [...document.querySelectorAll(".oPartRow")].map(row => ({
    name: row.querySelector(".opName").value.trim(),
    no: row.querySelector(".opNo").value.trim(),
    kind: row.querySelector(".opKind").value,
    qty: parseInt(row.querySelector(".opQty").value, 10) || 1,
    price: parseFloat((row.querySelector(".opPrice").value || "").replace(",", ".")) || 0,
    warr: row.querySelector(".opWarr").value,
  })).filter(p => p.name && p.price > 0);
  const labor = Math.round(hours * rate * 100) / 100;
  const partsSum = parts.reduce((s, p) => s + p.qty * p.price, 0);
  const total = Math.round((labor + partsSum + mat) * 100) / 100;
  const fixed = document.querySelector("#oFixed div.on")?.dataset.f !== "0";
  return { hours, rate, mat, parts, labor, partsSum, total, fixed };
}
function calcOfferSum() {
  const box = $("oSum"); if (!box) return;
  const o = collectOffer();
  box.innerHTML = `
    ${o.labor > 0 ? `<div class="offerLine"><span>Arbeitszeit ${o.hours} h × ${fmtEur(o.rate)}</span><span>${fmtEur(o.labor)}</span></div>` : ""}
    ${o.parts.map(p => `<div class="offerLine"><span>${esc(p.name)} (${p.qty}× · ${esc(p.kind)}${p.warr !== "Keine Garantie" ? " · " + esc(p.warr) : ""})</span><span>${fmtEur(p.qty * p.price)}</span></div>`).join("")}
    ${o.mat > 0 ? `<div class="offerLine"><span>Material / Zusatzkosten</span><span>${fmtEur(o.mat)}</span></div>` : ""}
    <div class="offerLine"><span>davon MwSt. (19 %)</span><span>${fmtEur(o.total - o.total / 1.19)}</span></div>
    <div class="offerLine total"><span>Gesamt inkl. MwSt. (${o.fixed ? "Festpreis" : "Schätzung"})</span><span>${fmtEur(o.total)}</span></div>`;
}
async function sendOffer(requestId) {
  const err = $("oErr"); err.style.display = "none";
  const o = collectOffer();
  if (o.total <= 0) return showErr(err, "Bitte Arbeitszeit und/oder mindestens ein Teil mit Preis angeben.");
  const line_items = [];
  if (o.labor > 0) line_items.push({ label: "Arbeitszeit", meta: `${o.hours} h × ${Math.round(o.rate)} €`, price: o.labor });
  o.parts.forEach(p => line_items.push({ label: p.name, meta: `${p.qty}× · ${p.kind}${p.warr !== "Keine Garantie" ? " · Garantie " + p.warr : ""}${p.no ? " · Nr. " + p.no : ""}`, price: Math.round(p.qty * p.price * 100) / 100 }));
  if (o.mat > 0) line_items.push({ label: "Material / Zusatzkosten", price: o.mat });
  const pricing = { labor_hours: o.hours, hourly_rate: o.rate, parts: o.parts, materials: o.mat };
  $("oGo").disabled = true; $("oGo").textContent = "Wird gesendet…";
  if ($("oSaveTpl").checked && $("oTplName").value.trim()) {
    await sb.from("offer_templates").insert({ workshop_id: myWorkshop.id, name: $("oTplName").value.trim(), line_items, pricing, is_fixed_price: o.fixed });
  }
  const { error } = await sb.from("offers").insert({
    request_id: requestId, workshop_id: myWorkshop.id,
    line_items, pricing, is_fixed_price: o.fixed,
    total_price: o.total, vat_rate: 19,
    message: $("oMsg").value.trim() || null, status: "sent",
  });
  $("oGo").disabled = false; $("oGo").textContent = "Angebot verbindlich senden";
  if (error) return showErr(err, String(error.message).includes("duplicate") ? "Du hast hier schon ein Angebot abgegeben." : error.message);
  toast("Angebot gesendet ✓");
  vWsLead(requestId);
}

// ============================================================
// WERKSTATT: Aufträge
// ============================================================
async function vWsJobs() {
  if (needWorkshop()) return;
  main.innerHTML = `
  <div class="pageHead"><div><h1>Aufträge</h1><div class="sub">Status pflegen, Termine setzen, Zusatzarbeiten freigeben lassen, mit dem Kunden chatten.</div></div>
  <div class="right"><a class="btn ghost sm" href="#/ws/calendar">Kalender</a></div></div>
  <div id="jobList"><div class="sk" style="height:110px"></div></div>`;
  await loadWsJobs();
}
async function loadWsJobs() {
  const { data, error } = await sb.from("bookings")
    .select("*, offers(request_id, requests(title,description,category,vehicle_label,district,extras)), profiles:customer_id(full_name,email,phone)")
    .eq("workshop_id", myWorkshop.id).order("created_at", { ascending: false });
  const box = $("jobList"); if (!box) return;
  if (error) { box.innerHTML = `<div class="warn">${esc(error.message)}</div>`; return; }
  const { data: wds } = await sb.from("contract_withdrawals").select("booking_id,received_at").eq("workshop_id", myWorkshop.id);
  const widerrufe = Object.fromEntries((wds || []).map(x => [x.booking_id, x.received_at]));
  if (!data || data.length === 0) { box.innerHTML = `<div class="empty"><div class="e">${ico("box",40)}</div>Noch keine gebuchten Aufträge. Sobald ein Kunde dein Angebot annimmt, erscheint der Auftrag hier.</div>`; return; }
  box.innerHTML = data.map(b => {
    const r = b.offers?.requests || {};
    const c = CATS[r.category] || { icon: "", name: r.category || "" };
    const s = BK_STATUS[b.status] || ["?", "b-grey"];
    const pay = PAY_LABELS[b.payment_status] || PAY_LABELS.none;
    const cust = b.profiles?.full_name || b.profiles?.email || "Kunde";
    const active = !["completed", "cancelled"].includes(b.status);
    return `<div class="card" style="margin-bottom:12px">
      <div class="cardHead"><div class="ico">${ico(r.category)}</div>
        <div style="flex:1;min-width:0"><div class="tt">${esc(b.booking_no || "")} · ${esc(r.title || "Auftrag")}</div>
        <div class="mm">${esc(cust)}${b.profiles?.phone ? " · " + esc(b.profiles.phone) : ""} · <b>${fmtEur(b.total_price)}</b> · <span class="badge ${pay[1]}">${pay[0]}</span>${b.payment_status === "payment_paid" ? ` <b>${fmtEur(b.paid_amount)}</b> online` : ""}${Number(b.refunded_amount) > 0 ? ` · erstattet ${fmtEur(b.refunded_amount)}` : ""}</div>
        <div class="mm">${esc(r.vehicle_label || "k.A.")}${b.scheduled_at ? " · " + fmtDateTime(b.scheduled_at) : " · kein Termin"}${b.no_show ? " · No-Show (" + (b.no_show === "customer" ? "Kunde" : "Werkstatt") + ")" : ""}</div>
        ${widerrufe[b.id] ? `<div class="warn" style="margin:8px 0 0;padding:8px 10px"><b>Widerruf erhalten</b> am ${fmtDateTime(widerrufe[b.id])}. Bitte melde dich beim Kunden, stimme die Rückabwicklung ab und erstatte ggf. die Zahlung.</div>` : ""}
        ${b.proposed_date && b.reschedule_by === "customer" ? `<div class="note" style="margin:8px 0 0;padding:8px 10px">Kunde schlägt vor: <b>${fmtDateTime(b.proposed_date)}</b> <a href="#" onclick="wsAcceptProposed('${b.id}');return false" style="color:var(--green);font-weight:800">Annehmen ✓</a></div>` : ""}
        </div>
        <span class="badge ${s[1]}">${s[0]}</span></div>
      <div class="foot">
        ${active ? `
        <select style="width:auto;flex:1;min-width:150px;padding:9px" onchange="setJobStatus('${b.id}',this.value)">
          ${Object.entries(BK_STATUS).map(([k, v]) => `<option value="${k}" ${k === b.status ? "selected" : ""}>${v[0]}</option>`).join("")}
        </select>
        <button class="btn ghost sm" onclick="setJobDate('${b.id}','${b.scheduled_at || ""}')">Termin</button>
        <button class="btn ghost sm" onclick="openApprovalForm('${b.id}','${b.customer_id}','${b.offers?.request_id}')">Zusatzfreigabe</button>
        <button class="btn ghost sm" onclick="openBookingDocForm('${b.id}')">Rechnung/Dokument</button>
        <button class="btn ghost sm" onclick="markNoShow('${b.id}')">Nicht erschienen</button>
        <button class="btn red sm" onclick="wsCancelJob('${b.id}')">Absagen</button>` : ""}
        <button class="btn ghost sm" onclick="go('ws/lead/${b.offers?.request_id}')">Chat</button>
        ${b.payment_status === "payment_paid" ? `<button class="btn ghost sm" onclick="refundBooking('${b.id}')">Zahlung erstatten</button>` : ""}
      </div>
    </div>`;
  }).join("");
}
async function setJobStatus(id, status) {
  const { error } = await sb.from("bookings").update({ status }).eq("id", id);
  if (error) toast(error.message); else { toast("Status aktualisiert ✓ – der Kunde sieht die Änderung im Auftrag."); loadWsJobs(); }
}
function setJobDate(id, current) {
  const cur = current ? new Date(current).toISOString().slice(0, 16) : "";
  openModal(`
    <h2 style="font-size:19px;font-weight:800">Termin festlegen</h2>
    <div class="label">Datum &amp; Uhrzeit</div>
    <input type="datetime-local" id="jobDt" value="${cur}">
    <div class="btnRow">
      <button class="btn" id="jobDtGo">Speichern</button>
      <button class="btn ghost" onclick="closeModal()">Abbrechen</button>
    </div>`);
  $("jobDtGo").onclick = async () => {
    const v = $("jobDt").value;
    if (!v) return toast("Bitte Datum wählen.");
    const { error } = await sb.from("bookings").update({ scheduled_at: new Date(v).toISOString(), status: "ready", proposed_date: null, reschedule_by: null }).eq("id", id);
    if (error) return toast(error.message);
    closeModal(); toast("Termin gesetzt ");
    if ($("jobList")) loadWsJobs(); else vWsCalendar();
  };
}
async function wsAcceptProposed(id) {
  const { data: bk } = await sb.from("bookings").select("proposed_date").eq("id", id).maybeSingle();
  if (!bk?.proposed_date) return;
  const { error } = await sb.from("bookings").update({ scheduled_at: bk.proposed_date, proposed_date: null, reschedule_by: null, status: "ready" }).eq("id", id);
  if (error) return toast(error.message);
  toast("Termin bestätigt ✓");
  loadWsJobs();
}
async function markNoShow(id) {
  if (!(await frage("Der Fall wird im Auftrag gespeichert und der Kunde informiert.", { titel: "Kunde nicht erschienen?", ja: "Als nicht erschienen markieren", gefahr: true }))) return;
  const { error } = await sb.from("bookings").update({ no_show: "customer" }).eq("id", id);
  if (error) return toast(error.message);
  toast("No-Show vermerkt.");
  loadWsJobs();
}
function wsCancelJob(id) {
  openModal(`
    <h2 style="font-size:19px;font-weight:800">Auftrag absagen</h2>
    <div class="label">Grund</div>
    <select id="wcReason">${["Kapazität reicht nicht", "Teile nicht lieferbar", "Fahrzeug nicht reparabel", "Kunde nicht erreichbar", "Sonstiges"].map(x => `<option>${x}</option>`).join("")}</select>
    <div class="btnRow">
      <button class="btn red" id="wcGo">Verbindlich absagen</button>
      <button class="btn ghost" onclick="closeModal()">Zurück</button>
    </div>`);
  $("wcGo").onclick = async () => {
    const { error } = await sb.from("bookings").update({ status: "cancelled", cancel_reason: $("wcReason").value, cancelled_by: "workshop", payment_status: "payment_cancelled" }).eq("id", id);
    if (error) return toast(error.message);
    closeModal(); toast("Auftrag abgesagt.");
    loadWsJobs();
  };
}
// ---------- Rechnung / Dokumente / Gewährleistung (Werkstatt) ----------
function openBookingDocForm(bookingId) {
  openModal(`
    <h2 style="font-size:19px;font-weight:800">Rechnung / Dokument hochladen</h2>
    <p class="mm" style="margin-top:6px">Rechnungen, Kostenvoranschläge, Prüfberichte oder Übergabeprotokolle – der Kunde sieht sie im Auftrag und in seiner Fahrzeugakte. Die Rechnung wird von deinem Betrieb gestellt, Carfixo speichert sie nur.</p>
    <div class="label">Dokumentart</div>
    <select id="bdType">${["Rechnung","Kostenvoranschlag","Prüfbericht / TÜV-Bericht","Übergabeprotokoll","Sonstiges Dokument"].map(x => `<option>${x}</option>`).join("")}</select>
    <div class="label">Datei (PDF oder Bild) *</div>
    <input type="file" id="bdFile" accept="application/pdf,image/*" style="padding:9px">
    <div class="label">Gewährleistungs- / Garantiehinweis (optional, gilt für den Auftrag)</div>
    <textarea id="bdWarranty" placeholder="z.B. 24 Monate Gewährleistung auf Arbeit, 12 Monate Garantie auf verbaute Teile."></textarea>
    <div class="btnRow">
      <button class="btn" id="bdGo">Hochladen</button>
      <button class="btn ghost" onclick="closeModal()">Abbrechen</button>
    </div>
    <div class="err" id="bdErr"></div>`);
  $("bdGo").onclick = async () => {
    const err = $("bdErr"); err.style.display = "none";
    const f = $("bdFile").files[0];
    const warranty = $("bdWarranty").value.trim();
    if (!f && !warranty) return showErr(err, "Bitte eine Datei wählen oder einen Gewährleistungshinweis eintragen.");
    $("bdGo").disabled = true; $("bdGo").textContent = "Wird hochgeladen…";
    const { data: bk } = await sb.from("bookings").select("documents").eq("id", bookingId).maybeSingle();
    const docs = [...(bk?.documents || [])];
    if (f) {
      if (f.size > 15 * 1024 * 1024) { $("bdGo").disabled = false; return showErr(err, "Datei zu groß (max. 15 MB)."); }
      const path = `booking/${bookingId}/${Date.now()}_${f.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await sb.storage.from("documents").upload(path, f);
      if (upErr) { $("bdGo").disabled = false; $("bdGo").textContent = "Hochladen"; return showErr(err, upErr.message); }
      docs.push({ type: $("bdType").value, name: f.name, path, uploaded_at: new Date().toISOString() });
    }
    const upd = { documents: docs };
    if (warranty) upd.warranty_note = warranty;
    const { error } = await sb.from("bookings").update(upd).eq("id", bookingId);
    if (error) { $("bdGo").disabled = false; return showErr(err, error.message); }
    closeModal(); toast("Gespeichert ✓ – der Kunde sieht es im Auftrag.");
    if ($("jobList")) loadWsJobs();
  };
}
async function openBookingDoc(path) {
  const { data, error } = await sb.storage.from("documents").createSignedUrl(path, 300);
  if (error || !data?.signedUrl) return toast("Dokument konnte nicht geladen werden.");
  window.open(data.signedUrl, "_blank");
}
function bookingDocsHtml(bk) {
  const docs = bk.documents || [];
  if (docs.length === 0 && !bk.warranty_note) return "";
  return `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line)">
    ${docs.length ? `<div class="tt" style="font-size:12.5px">Dokumente der Werkstatt</div>
    ${docs.map(d => `<div class="offerLine"><span>${esc(d.type || "Dokument")} · ${esc(d.name || "")}</span>
      <a href="#" onclick="openBookingDoc(${jsArg(d.path)});return false" style="color:var(--blue2);font-weight:700;font-size:12px">Öffnen →</a></div>`).join("")}` : ""}
    ${bk.warranty_note ? `<div class="note" style="margin:10px 0 0"><b>Gewährleistung/Garantie (durch die Werkstatt):</b><br>${esc(bk.warranty_note)}</div>` : ""}
  </div>`;
}

// ---------- Zusatzfreigabe anfordern ----------
let apFiles = [];
function openApprovalForm(bookingId, customerId, requestId) {
  apFiles = [];
  openModal(`
    <h2 style="font-size:19px;font-weight:800">Zusatzfreigabe anfordern</h2>
    <p class="mm" style="margin-top:6px">Beschreibe die nötige Zusatzarbeit – der Kunde muss zustimmen, bevor du sie ausführst.</p>
    <div class="label">Titel *</div>
    <input id="apTitle" placeholder="z.B. Bremsscheiben ebenfalls verschlissen">
    <div class="label">Begründung</div>
    <textarea id="apDesc" placeholder="Was wurde festgestellt? Warum ist die Zusatzarbeit nötig?"></textarea>
    <div class="label">Positionen (Arbeitszeit / Teile)</div>
    <div id="apItems">
      <div class="split" style="margin-bottom:8px"><input class="apL" placeholder="z.B. Bremsscheiben vorne"><input class="apP" inputmode="decimal" placeholder="€" style="max-width:100px"></div>
    </div>
    <button class="btn ghost sm" id="apAdd">＋ Position</button>
    <div class="label">Fotos (optional)</div>
    <div class="uploadTile" onclick="$('apFile').click()">
      <div class="ico icoGold"></div>
      <div><div class="tt" style="font-size:12.5px">Befund fotografieren</div><div class="mm">Bilder helfen dem Kunden bei der Entscheidung</div></div>
    </div>
    <input type="file" id="apFile" accept="image/*,video/*" multiple class="hidden">
    <div class="thumbs" id="apThumbs"></div>
    <div class="btnRow">
      <button class="btn" id="apGo">Freigabe anfordern</button>
      <button class="btn ghost" onclick="closeModal()">Abbrechen</button>
    </div>
    <div class="err" id="apErr"></div>`);
  $("apAdd").onclick = () => $("apItems").insertAdjacentHTML("beforeend", '<div class="split" style="margin-bottom:8px"><input class="apL" placeholder="Position"><input class="apP" inputmode="decimal" placeholder="€" style="max-width:100px"></div>');
  $("apFile").onchange = () => {
    [...$("apFile").files].slice(0, 4 - apFiles.length).forEach(f => { if (f.size < 20 * 1024 * 1024) apFiles.push(f); });
    $("apThumbs").innerHTML = apFiles.map(f => f.type.startsWith("video") ? `<span class="pill">${esc(f.name)}</span>` : `<img src="${URL.createObjectURL(f)}" loading="lazy" alt="">`).join("");
  };
  $("apGo").onclick = async () => {
    const err = $("apErr"); err.style.display = "none";
    const title = $("apTitle").value.trim();
    if (!title) return showErr(err, "Bitte einen Titel angeben.");
    const items = [];
    document.querySelectorAll(".apL").forEach((l, i) => {
      const p = parseFloat((document.querySelectorAll(".apP")[i].value || "").replace(",", "."));
      if (l.value.trim() && p > 0) items.push({ label: l.value.trim(), price: p });
    });
    if (items.length === 0) return showErr(err, "Mindestens eine Position mit Preis angeben.");
    $("apGo").disabled = true; $("apGo").textContent = "Wird gesendet…";
    const photos = [];
    for (const f of apFiles) {
      const path = `${me.id}/approval_${Date.now()}_${f.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await sb.storage.from("attachments").upload(path, f);
      if (!upErr) photos.push(sb.storage.from("attachments").getPublicUrl(path).data.publicUrl);
    }
    const extra = items.reduce((s, x) => s + x.price, 0);
    const { error } = await sb.from("approvals").insert({
      booking_id: bookingId, workshop_id: myWorkshop.id, customer_id: customerId,
      title, description: $("apDesc").value.trim() || null, photos, line_items: items, extra_cost: extra,
    });
    if (error) { $("apGo").disabled = false; $("apGo").textContent = "Freigabe anfordern"; return showErr(err, error.message); }
    await sb.from("bookings").update({ status: "approval_needed" }).eq("id", bookingId);
    if (requestId) await sb.from("messages").insert({ request_id: requestId, sender_id: me.id, kind: "system", body: `Zusatzfreigabe angefordert: ${title} (+${fmtEur(extra)})` });
    closeModal(); toast("Freigabe angefordert – der Kunde wurde informiert.");
    loadWsJobs();
  };
}

// ============================================================
// WERKSTATT: Kalender (Wochenansicht)
// ============================================================
let calOffset = 0;
async function vWsCalendar() {
  if (needWorkshop()) return;
  const monday = getMonday(new Date(Date.now() + calOffset * 7 * 864e5));
  const sunday = new Date(monday.getTime() + 6 * 864e5);
  main.innerHTML = `
  <div class="pageHead">
    <div><h1>Kalender</h1><div class="sub">Woche ${monday.toLocaleDateString("de-DE")} – ${sunday.toLocaleDateString("de-DE")}</div></div>
    <div class="right">
      <button class="btn ghost sm" id="calPrev">← Vorherige</button>
      <button class="btn ghost sm" id="calToday">Heute</button>
      <button class="btn ghost sm" id="calNext">Nächste →</button>
    </div>
  </div>
  <div style="overflow-x:auto"><div class="weekGrid" id="week"></div></div>`;
  $("calPrev").onclick = () => { calOffset--; vWsCalendar(); };
  $("calNext").onclick = () => { calOffset++; vWsCalendar(); };
  $("calToday").onclick = () => { calOffset = 0; vWsCalendar(); };
  const { data: jobs } = await sb.from("bookings")
    .select("*, offers(request_id, requests(title,vehicle_label)), profiles:customer_id(full_name,email)")
    .eq("workshop_id", myWorkshop.id)
    .gte("scheduled_at", monday.toISOString())
    .lt("scheduled_at", new Date(monday.getTime() + 7 * 864e5).toISOString());
  const dayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const todayStr = new Date().toDateString();
  $("week").innerHTML = dayNames.map((dn, i) => {
    const day = new Date(monday.getTime() + i * 864e5);
    const items = (jobs || []).filter(j => new Date(j.scheduled_at).toDateString() === day.toDateString())
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    return `<div class="dayCol ${day.toDateString() === todayStr ? "today" : ""}">
      <div class="dh">${dn} ${day.getDate()}.${day.getMonth() + 1}.</div>
      ${items.map(j => `
        <div class="calItem" onclick="setJobDate('${j.id}','${j.scheduled_at}')">
          ${new Date(j.scheduled_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} · ${esc(j.offers?.requests?.title || "Auftrag")}
          <div class="cm">${esc(j.profiles?.full_name || j.profiles?.email || "")}</div>
        </div>`).join("")}
    </div>`;
  }).join("");
}
function getMonday(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7;
  return new Date(x.getTime() - day * 864e5);
}

// ============================================================
// WERKSTATT: Profil-Editor
// ============================================================
let profCats = [], profServices = [], profBrands = [], profLatLng = null, profMap = null, profMarker = null;
// Betriebsprofil in Reitern statt einer langen Seite. Alle Felder bleiben im DOM,
// damit "Speichern" unabhängig vom offenen Reiter alles mitnimmt.
let profTab = "allg";
const PROF_TABS = [["allg", "Allgemein"], ["leist", "Leistungen"], ["fest", "Festpreise"], ["zeiten", "Zeiten & Ausstattung"], ["bilder", "Bilder"], ["zahl", "Zahlungen & Premium"], ["team", "Team"]];
// Was fehlt, damit Kunden den Betrieb finden und ihm vertrauen – Punkt am Reiter.
function profLuecken(w) {
  return {
    allg: !w.phone || !w.street || !w.district,
    leist: !(w.categories || []).length,
    zeiten: !Object.values(w.opening_hours || {}).some(Boolean),
    bilder: !w.logo_url && !w.cover_url,
    zahl: !w.online_payment,
  };
}
function profTabsHtml(w) {
  const l = profLuecken(w);
  const offen = ["allg", "leist", "zeiten", "bilder"].filter(k => l[k]).length;
  const pct = Math.round((4 - offen) / 4 * 100);
  return `<div class="profFort"><div class="profFortBar"><span style="width:${pct}%"></span></div>
    <span class="mm">Profil zu ${pct} % vollständig${offen ? " · der Punkt zeigt, wo noch etwas fehlt" : " ✓"}</span></div>
  <div class="pTabs" role="tablist">${PROF_TABS.map(([k, t]) =>
    `<button role="tab" data-ptab="${k}" class="${k === profTab ? "on" : ""}">${t}${l[k] ? '<i class="pDot" aria-label="unvollständig"></i>' : ""}</button>`).join("")}</div>`;
}
function zeigeProfTab(tab) {
  profTab = tab;
  document.querySelectorAll("[data-ptab]").forEach(b => { b.classList.toggle("on", b.dataset.ptab === tab); b.setAttribute("aria-selected", b.dataset.ptab === tab); });
  document.querySelectorAll("#profPanes .pCard").forEach(c => { c.hidden = c.dataset.tab !== tab; });
  // Team und Zahlungen speichern sich selbst – dort keine Speichern-Leiste.
  const bar = $("pSaveBar"); if (bar) bar.hidden = tab === "team" || tab === "zahl" || tab === "fest";
}
async function vWsProfile() {
  if (needWorkshop()) return;
  const w = myWorkshop;
  profCats = [...(w.categories || [])];
  profServices = [...(w.services || [])];
  profBrands = [...(w.brands || [])];
  profLatLng = w.lat != null ? [w.lat, w.lng] : null;
  profMap = null; profMarker = null;   // Karte wird erst beim Klick neu aufgebaut
  const oh = w.opening_hours || {};
  const days = [["mo", "Mo"], ["di", "Di"], ["mi", "Mi"], ["do", "Do"], ["fr", "Fr"], ["sa", "Sa"], ["so", "So"]];
  main.innerHTML = `
  <div class="pageHead">
    <div><h1>Betriebsprofil</h1>
    <div class="sub">Je vollständiger dein Profil, desto besser wirst du gefunden. ${w.is_verified ? '<span class="badge b-green">✓ verifiziert</span>' : '<span class="badge b-gold">Verifizierung ausstehend</span>'}</div></div>
  </div>
  ${profTabsHtml(w)}
  <div id="profPanes">
      <div class="card pCard" data-tab="allg">
        <div class="tt">Stammdaten</div>
        <div class="label">Name des Betriebs</div>
        <input id="pName" value="${esc(w.name)}">
        <div class="label">Beschreibung</div>
        <textarea id="pDesc" placeholder="Was macht deinen Betrieb besonders?">${esc(w.description || "")}</textarea>
        <div class="split">
          <div><div class="label">Telefon</div><input id="pPhone" value="${esc(w.phone || "")}"></div>
          <div><div class="label">E-Mail</div><input id="pEmail" value="${esc(w.email || "")}"></div>
        </div>
        <div class="label">Website (optional)</div>
        <input id="pWeb" value="${esc(w.website || "")}" placeholder="https://…">
        <div class="split">
          <div><div class="label">Gegründet</div><input id="pYear" inputmode="numeric" value="${esc(w.founded_year || "")}" placeholder="z.B. 2005"></div>
          <div><div class="label">Stundensatz €</div><input id="pRate" inputmode="numeric" value="${esc(w.hourly_rate || "")}" placeholder="z.B. 89"></div>
        </div>
        <div class="label">Preisniveau</div>
        <div class="seg" style="margin:4px 0 0">
          ${[1, 2, 3].map(n => `<div data-pl="${n}" class="${(w.price_level || 2) === n ? "on" : ""}">${"€".repeat(n)}</div>`).join("")}
        </div>
        <div class="label">Service-Art</div>
        <select id="pMode">
          <option value="stationary" ${w.service_mode === "stationary" ? "selected" : ""}>Nur in der Werkstatt</option>
          <option value="mobile" ${w.service_mode === "mobile" ? "selected" : ""}>Nur mobil beim Kunden</option>
          <option value="both" ${w.service_mode === "both" ? "selected" : ""}>Werkstatt + mobil</option>
        </select>
      </div>
      <div class="card pCard" data-tab="allg">
        <div class="tt">Adresse &amp; Standort</div>
        <div class="label">Straße &amp; Nr.</div>
        <input id="pStreet" value="${esc(w.street || "")}">
        <div class="split">
          <div><div class="label">PLZ</div><input id="pZip" value="${esc(w.zip || "")}"></div>
          <div><div class="label">Stadt</div><input id="pCity" value="${esc(w.city || "Köln")}"></div>
        </div>
        <div class="label">Stadtteil</div>
        <select id="pDistrict">${opt("Wählen…", Object.keys(DISTRICTS), w.district)}</select>
        <div class="label">Standort auf der Karte (klicken zum Setzen)</div>
        <div class="mapWrap" style="height:230px">
          <div id="obMap"></div>
          <button class="mapConsent" id="obMapLoad" type="button">
            ${ico("search", 20)}<b>Karte anzeigen</b>
            <span>Zum Setzen des Standort-Pins. Dabei wird eine Verbindung zu Google Maps aufgebaut.</span>
          </button>
        </div>
        <p class="mm" id="pLatLng" style="margin-top:6px">${profLatLng ? "Standort gesetzt" : "Noch kein Standort – auf die Karte klicken oder Stadtteil wählen."}</p>
      </div>
      <div class="card pCard" data-tab="allg">
        <div class="tt">Google-Eintrag</div>
        <div id="pGoogle"></div>
      </div>
      <div class="card pCard" data-tab="zeiten">
        <div class="tt">Öffnungszeiten</div>
        ${days.map(([k, label]) => `
          <div class="split" style="margin-top:8px;align-items:center">
            <span style="flex:0 0 36px;font-size:12.5px;font-weight:700">${label}</span>
            <input data-oh="${k}" value="${esc(oh[k] || "")}" placeholder="z.B. 08:00–18:00 (leer = geschlossen)">
          </div>`).join("")}
      </div>
      <div class="card pCard" data-tab="leist">
        <div class="tt">Kategorien</div>
        <p class="mm" style="margin-top:4px">Du siehst nur Ausschreibungen aus deinen Kategorien.</p>
        <div class="catGrid" id="pCats" style="margin-top:10px">${Object.entries(CATS).map(([k, v]) => `
          <div class="catCard ${profCats.includes(k) ? "on" : ""}" data-k="${k}"><span class="ce">${ico(k)}</span><span class="cn">${v.name}</span></div>`).join("")}</div>
      </div>
      <div class="card pCard" data-tab="leist">
        <div class="tt">Leistungen im Detail</div>
        <p class="mm" style="margin-top:4px">Danach filtern Kunden in der Suche.</p>
        <input id="pSvcFilter" placeholder="Leistung suchen – z.B. Chiptuning, Felgenaufbereitung…" style="margin-top:8px">
        <div id="pServices" style="margin-top:6px"></div>
      </div>
      <div class="card pCard" data-tab="leist">
        <div class="tt">Fahrzeugmarken</div>
        <p class="mm" style="margin-top:4px">Leer lassen = alle Marken.</p>
        <div class="chips" id="pBrands" style="margin-top:10px">${Object.keys(BRANDS).map(b => `
          <span class="chip ${profBrands.includes(b) ? "on" : ""}" data-b="${esc(b)}">${esc(b)}</span>`).join("")}</div>
      </div>
      <div class="card pCard" data-tab="bilder">
        <div class="tt">Bilder</div>
        <div class="label">Logo</div>
        <div class="split" style="align-items:center">
          <div class="wsAv" id="pLogoPrev" style="${w.logo_url ? `background-image:url('${esc(w.logo_url)}');background-size:cover;color:transparent` : avStil(w.name)}">${esc(initials(w.name))}</div>
          <input type="file" id="pLogo" accept="image/*" style="padding:9px">
        </div>
        <div class="label">Titelbild</div>
        <input type="file" id="pCover" accept="image/*" style="padding:9px">
        ${w.cover_url ? '<p class="mm" style="margin-top:5px">Titelbild vorhanden – neue Datei ersetzt es.</p>' : ""}
        <div class="label">Galerie (Werkstatt, Arbeiten, Vorher/Nachher, Team) ${w.is_premium ? "– bis 12 Bilder " : "– bis 4 Bilder"}</div>
        <input type="file" id="pGallery" accept="image/*" multiple style="padding:9px">
        <div class="thumbs" id="pGalThumbs">${(w.gallery || []).map((u, i) => `
          <span style="position:relative"><img src="${esc(u)}" loading="lazy" alt="">
          <button onclick="removeGalleryImg(${i})" aria-label="Bild entfernen" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:none;background:var(--red);color:#fff;font-size:11px;cursor:pointer">✕</button></span>`).join("")}</div>
      </div>
      <div class="card pCard" data-tab="zeiten">
        <div class="tt">Verfügbarkeit & Kapazität</div>
        <div class="label">Nächster freier Termin</div>
        <input type="date" id="pNextFree" value="${esc(w.next_free_date || "")}">
        <div class="split" style="margin-top:8px">
          <div><div class="label" style="margin-top:0">Hebebühnen</div><input id="pLifts" inputmode="numeric" value="${esc(w.capacity?.lifts ?? "")}" placeholder="z.B. 3"></div>
          <div><div class="label" style="margin-top:0">Mitarbeiter</div><input id="pStaff" inputmode="numeric" value="${esc(w.capacity?.staff ?? "")}" placeholder="z.B. 5"></div>
          <div><div class="label" style="margin-top:0">Max. Aufträge/Tag</div><input id="pMaxJobs" inputmode="numeric" value="${esc(w.capacity?.max_jobs_per_day ?? "")}" placeholder="z.B. 8"></div>
        </div>
        <div class="label">Ausstattung & Service</div>
        <label class="inline"><input type="checkbox" id="pMaster" ${w.master_certified ? "checked" : ""}> Meisterbetrieb</label>
        <label class="inline"><input type="checkbox" id="pPickup" ${w.pickup_service ? "checked" : ""}> Hol- &amp; Bringservice</label>
        <label class="inline"><input type="checkbox" id="pReplace" ${w.replacement_car ? "checked" : ""}> Ersatzwagen verfügbar</label>
        <label class="inline"><input type="checkbox" id="pEmergency" ${w.emergency_service ? "checked" : ""}> Notdienst / kurzfristige Hilfe</label>
        <div class="label">Zahlungsmöglichkeiten</div>
        <div class="chips" id="pPay">${["Bar","EC-Karte","Kreditkarte","Überweisung","PayPal","Rechnung"].map(p => `
          <span class="chip ${(w.payment_methods || []).includes(p) ? "on" : ""}" data-p="${p}">${p}</span>`).join("")}</div>
      </div>
      ${festpreisPaneHtml(w)}
      <div class="card pCard" data-tab="team">
        <div class="tt">Team-Zugänge</div>
        <p class="mm" style="margin-top:4px">Mitarbeiter mit eigenem Carfixo-Konto erhalten Zugriff auf deinen Betrieb (Rollen-Feinsteuerung folgt).</p>
        <div id="pTeamList" style="margin-top:8px"><div class="sk" style="height:30px"></div></div>
        <div class="split" style="margin-top:10px">
          <input id="pMemberEmail" type="email" placeholder="mitarbeiter@firma.de">
          <select id="pMemberRole" style="max-width:170px">
            ${[["serviceberater","Serviceberater"],["werkstattmeister","Werkstattmeister"],["mechaniker","Mechaniker"],["buchhaltung","Buchhaltung"],["geschaeftsfuehrer","Geschäftsführer"],["marketing","Marketing"],["eingeschraenkt","Eingeschränkt"]].map(([k,l]) => `<option value="${k}">${l}</option>`).join("")}
          </select>
          <button class="btn sm" id="pMemberAdd" style="flex:0 0 auto">＋</button>
        </div>
      </div>
      <div class="card pCard" data-tab="zahl">
        <div class="tt">Premium für Betriebe</div>
        <p class="mm" style="margin-top:4px">${w.is_premium ? "Aktiv: bevorzugte Platzierung (als „Hervorgehoben“ markiert), mehr Galerie-Bilder, detaillierte Statistiken." : "Bevorzugte Platzierung, mehr Bilder, detaillierte Statistiken – aktuell kostenlos."}</p>
        <div class="btnRow">
          <button class="btn ghost sm" id="pPremToggle">${w.is_premium ? "Premium deaktivieren" : "Premium aktivieren (aktuell kostenlos)"}</button>
          <a class="btn ghost sm" href="#/ws/stats">Statistiken</a>
        </div>
      </div>
      <div class="card pCard" data-tab="zahl" id="payCard">
        <div class="tt">Online-Zahlungen</div>
        <p class="mm" style="margin-top:4px">Wird geladen…</p>
      </div>
  </div>
  <div class="saveBar" id="pSaveBar">
    <div class="err" id="pErr"></div>
    <button class="btn wide" id="pSave">Änderungen speichern</button>
  </div>`;

  let priceLevel = w.price_level || 2;
  document.querySelectorAll("[data-pl]").forEach(d => d.onclick = () => {
    priceLevel = +d.dataset.pl;
    document.querySelectorAll("[data-pl]").forEach(x => x.classList.toggle("on", x === d));
  });
  document.querySelectorAll("#pCats .catCard").forEach(c => c.onclick = () => {
    const k = c.dataset.k;
    const i = profCats.indexOf(k);
    if (i >= 0) profCats.splice(i, 1); else profCats.push(k);
    c.classList.toggle("on");
    renderProfServices();
  });
  document.querySelectorAll("#pBrands .chip").forEach(c => c.onclick = () => {
    const b = c.dataset.b;
    const i = profBrands.indexOf(b);
    if (i >= 0) profBrands.splice(i, 1); else profBrands.push(b);
    c.classList.toggle("on");
  });
  document.querySelectorAll("#pPay .chip").forEach(c => c.onclick = () => c.classList.toggle("on"));
  renderProfServices();

  // Karte erst auf Klick laden – vorher geht keine Anfrage an den Kartendienst.
  $("obMapLoad").onclick = () => {
    $("obMapLoad").remove();
    profMap = CarfixoMaps.create("obMap", { center: profLatLng || CITY_CENTER, zoom: profLatLng ? 14 : 11 });
    if (profLatLng) profMarker = profMap.addDraggable(profLatLng, (ll) => { profLatLng = ll; });
    profMap.onClick((ll) => setProfLatLng(ll));
  };
  // Stadtteil-Auswahl setzt den Standort auch ohne geöffnete Karte.
  $("pDistrict").onchange = () => {
    const d = DISTRICTS[$("pDistrict").value];
    if (d) { setProfLatLng(d); if (profMap) profMap.setView(d, 14); }
  };
  $("pSave").onclick = saveWsProfile.bind(null, () => priceLevel);
  document.querySelectorAll("[data-ptab]").forEach(b => b.onclick = () => zeigeProfTab(b.dataset.ptab));
  zeigeProfTab(profTab);
  loadPayCard();
  renderGoogleCard();
  loadTeamList();
  festpreisFormBinden();
  $("pMemberAdd").onclick = addTeamMember;
  $("pPremToggle").onclick = async () => {
    const nv = !myWorkshop.is_premium;
    const { error } = await sb.from("workshops").update({ is_premium: nv }).eq("id", myWorkshop.id);
    if (error) return toast(error.message);
    myWorkshop.is_premium = nv;
    allWorkshops = null;
    toast(nv ? "Premium aktiviert " : "Premium deaktiviert.");
    vWsProfile();
  };
}
// Stripe-Verbindung des Betriebs. Kunden zahlen direkt an den Betrieb; Carfixo
// nimmt keine Provision. Die Stripe-Gebühren trägt das Konto des Betriebs.
async function loadPayCard() {
  const box = $("payCard"); if (!box) return;
  const kopf = '<div class="tt">Online-Zahlungen</div>';
  const st = await stripeCall("status");
  if (!$("payCard")) return;
  if (st.error && st.configured !== false) { box.innerHTML = kopf + `<p class="mm" style="margin-top:4px">${esc(st.error)}</p>`; return; }
  if (st.configured === false) {
    box.innerHTML = kopf + '<p class="mm" style="margin-top:4px">Bald verfügbar: Kunden zahlen nach der Reparatur online direkt an dich – über Stripe, ohne Provision für Carfixo.</p>';
    return;
  }
  if (!st.workshop) { box.innerHTML = kopf + '<p class="mm" style="margin-top:4px">Online-Zahlungen richtet der Inhaber des Betriebs ein.</p>'; return; }
  const info = '<p class="mm" style="margin-top:6px;font-size:11.5px">Zahlungsempfänger bist du. Das Geld geht auf dein Stripe-Konto; Stripe berechnet dir dafür seine üblichen Gebühren, Carfixo nimmt keine Provision.</p>';
  if (!st.connected) {
    box.innerHTML = kopf + `<p class="mm" style="margin-top:4px">Lass dir Aufträge nach der Reparatur online bezahlen – per Karte, Apple Pay, Google Pay und mehr.</p>
      ${st.verified ? '<div class="btnRow"><button class="btn sm" id="payConnect">Mit Stripe verbinden</button></div>' : '<div class="note" style="margin-top:8px">Möglich, sobald Carfixo deinen Betrieb verifiziert hat.</div>'}${info}`;
  } else if (!st.charges_enabled) {
    // Fehlen noch Angaben, muss der Betrieb zurück zu Stripe – sonst wartet er nur auf die Prüfung.
    const fehlt = (st.fehlt || []).length > 0 || !st.details_submitted;
    box.innerHTML = kopf + `<div class="note" style="margin-top:8px">${fehlt
        ? "Stripe braucht noch Angaben von dir, bevor Kunden online zahlen können."
        : "Stripe prüft deine Angaben. Das dauert meist nur kurz – du bekommst Bescheid, sobald es freigeschaltet ist."}</div>
      <div class="btnRow"><button class="btn sm" id="payConnect">${fehlt ? "Angaben bei Stripe ergänzen" : "Angaben bei Stripe ansehen"}</button></div>${info}`;
  } else {
    box.innerHTML = kopf + `<div class="okBox" style="margin:8px 0 0">Aktiv ✓ Kunden können online an dich bezahlen.${st.payouts_enabled ? "" : " Auszahlungen sind bei Stripe noch nicht freigeschaltet."}</div>
      <div class="btnRow"><a class="btn ghost sm" href="https://dashboard.stripe.com/" target="_blank" rel="noopener">Stripe-Dashboard öffnen</a></div>${info}`;
  }
  const btn = $("payConnect");
  if (btn) btn.onclick = async () => {
    btn.disabled = true; btn.textContent = "Stripe wird geöffnet…";
    const r = await stripeCall("connect");
    if (r.url) { oeffneExtern(r.url); return; }
    btn.disabled = false; btn.textContent = "Mit Stripe verbinden";
    toast(r.error || "Stripe ist gerade nicht erreichbar.");
  };
}
// Google-Unternehmenseintrag verknüpfen. Angezeigt wird er erst nach
// Bestätigung durch Carfixo (Admin) – das erzwingt auch die Datenbank.
function renderGoogleCard() {
  const box = $("pGoogle"); if (!box) return;
  const w = myWorkshop;
  const stand = !w.google_place_id ? ""
    : w.google_place_confirmed
      ? '<div class="okBox" style="margin:8px 0 0">Verknüpft ✓ Deine Google-Sterne und -Fotos erscheinen in deinem Profil.</div>'
      : '<div class="note" style="margin-top:8px">Verknüpft – Carfixo prüft noch, ob der Eintrag zu deinem Betrieb gehört. Danach erscheinen Sterne und Fotos.</div>';
  box.innerHTML = `<p class="mm" style="margin-top:4px">Zeig deine Google-Sterne und Fotos im Profil – ideal, solange du auf Carfixo noch wenige Bewertungen und Bilder hast.</p>
    ${stand}
    <div class="split" style="margin-top:10px">
      <input id="gSuche" value="${esc([w.name, w.city].filter(Boolean).join(" "))}" placeholder="Name und Ort deines Betriebs" aria-label="Google-Eintrag suchen">
      <button class="btn sm" id="gGo" style="flex:0 0 auto">${w.google_place_id ? "Neu suchen" : "Suchen"}</button>
    </div>
    <div id="gTreffer"></div>
    ${w.google_place_id ? '<button class="btn ghost sm" id="gLoesen" style="margin-top:10px">Verknüpfung lösen</button>' : ""}`;
  $("gGo").onclick = googleSuchen;
  $("gSuche").onkeydown = (e) => { if (e.key === "Enter") googleSuchen(); };
  if ($("gLoesen")) $("gLoesen").onclick = () => setGooglePlace(null);
}
async function googleSuchen() {
  const out = $("gTreffer"), text = $("gSuche").value.trim();
  if (text.length < 3) return toast("Bitte Name und Ort eingeben.");
  out.innerHTML = '<div class="sk" style="height:60px;margin-top:10px"></div>';
  const { data: { session } } = await sb.auth.getSession();
  let d = {};
  try {
    const r = await fetch(API + "/api/google-place?suche=" + encodeURIComponent(text), { headers: { Authorization: "Bearer " + (session?.access_token || "") } });
    d = await r.json();
    if (!r.ok) throw new Error(d.error);
  } catch (e) {
    out.innerHTML = `<p class="mm" style="margin-top:10px">${esc(e.message || "Google ist gerade nicht erreichbar.")}</p>`;
    return;
  }
  out.innerHTML = (d.treffer || []).length === 0
    ? '<p class="mm" style="margin-top:10px">Nichts gefunden. Probier es mit dem Namen wie bei Google und dem Ort.</p>'
    : d.treffer.map(t => `<div class="gTreffer">
        <div style="flex:1;min-width:0"><b>${esc(t.name)}</b><div class="mm">${esc(t.adresse)}${t.sterne ? ` · ★ ${String(t.sterne).replace(".", ",")} (${t.anzahl})` : ""}</div></div>
        <button class="btn green sm" data-place="${esc(t.id)}">Das ist mein Betrieb</button></div>`).join("");
  out.querySelectorAll("[data-place]").forEach(b => b.onclick = () => setGooglePlace(b.dataset.place));
}
async function setGooglePlace(id) {
  const { data, error } = await sb.from("workshops").update({ google_place_id: id }).eq("id", myWorkshop.id).select().maybeSingle();
  if (error) return toast(error.message);
  if (data) myWorkshop = data;
  toast(id ? "Verknüpft – Carfixo bestätigt den Eintrag in Kürze." : "Verknüpfung gelöst.");
  renderGoogleCard();
}
async function uploadWsImage(file, prefix) {
  const path = `${me.id}/${prefix}_${Date.now()}_${file.name.replace(/[^\w.\-]/g, "_")}`;
  const { error } = await sb.storage.from("attachments").upload(path, file);
  if (error) { toast("Upload fehlgeschlagen: " + error.message); return null; }
  return sb.storage.from("attachments").getPublicUrl(path).data.publicUrl;
}
async function removeGalleryImg(i) {
  const gal = [...(myWorkshop.gallery || [])];
  gal.splice(i, 1);
  const { error } = await sb.from("workshops").update({ gallery: gal }).eq("id", myWorkshop.id);
  if (error) return toast(error.message);
  myWorkshop.gallery = gal;
  toast("Bild entfernt.");
  vWsProfile();
}
async function loadTeamList() {
  const box = $("pTeamList"); if (!box) return;
  const { data } = await sb.from("workshop_members").select("*").eq("workshop_id", myWorkshop.id).order("created_at");
  box.innerHTML = (data || []).length === 0
    ? '<p class="mm">Noch keine Team-Mitglieder.</p>'
    : data.map(m => `<div class="offerLine">
        <span>${esc(m.email)} <span class="mm">· ${esc(m.member_role)}${m.user_id ? " · ✓ verknüpft" : " · wartet auf Registrierung"}${m.active ? "" : " · deaktiviert"}</span></span>
        <span><a href="#" onclick="toggleMember('${m.id}',${!m.active});return false" style="color:var(--blue2);font-size:12px;font-weight:700">${m.active ? "Deaktivieren" : "Aktivieren"}</a></span>
      </div>`).join("");
}
async function addTeamMember() {
  const email = $("pMemberEmail").value.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Bitte gültige E-Mail eingeben.");
  const { error } = await sb.from("workshop_members").insert({ workshop_id: myWorkshop.id, email, member_role: $("pMemberRole").value });
  if (error) return toast(String(error.message).includes("duplicate") ? "Diese E-Mail ist bereits im Team." : error.message);
  $("pMemberEmail").value = "";
  toast("Mitarbeiter hinzugefügt – Zugriff nach Registrierung/Login mit dieser E-Mail.");
  loadTeamList();
}
async function toggleMember(id, active) {
  await sb.from("workshop_members").update({ active }).eq("id", id);
  loadTeamList();
}
function setProfLatLng(ll) {
  profLatLng = ll;
  if (profMarker) profMarker.setPosition(ll);
  else if (profMap) profMarker = profMap.addDraggable(ll, (p) => { profLatLng = p; });
  $("pLatLng").textContent = "Standort gesetzt";
}
function renderProfServices() {
  $("pServices").innerHTML = profCats.length === 0
    ? '<p class="mm">Wähle zuerst Kategorien.</p>'
    : profCats.map(k => `
      <div class="label" data-svgroup="${k}">${ico(k)} ${CATS[k].name}</div>
      <div class="chips" data-svgroup="${k}">${CATS[k].services.map(s => `
        <span class="chip ${profServices.includes(s) ? "on" : ""}" data-sv="${esc(s)}">${esc(s)}</span>`).join("")}</div>`).join("");
  document.querySelectorAll("#pServices .chip").forEach(c => c.onclick = () => {
    const s = c.dataset.sv;
    const i = profServices.indexOf(s);
    if (i >= 0) profServices.splice(i, 1); else profServices.push(s);
    c.classList.toggle("on");
  });
  const flt = $("pSvcFilter");
  if (flt) {
    flt.style.display = profCats.length === 0 ? "none" : "";
    flt.oninput = () => filterServiceChips("#pServices", flt.value);
    if (flt.value) filterServiceChips("#pServices", flt.value);
  }
}
// Blendet Leistungs-Chips (und leere Gruppen) aus, die nicht zur Suche passen
function filterServiceChips(boxSel, query) {
  const q = (query || "").trim().toLowerCase();
  document.querySelectorAll(`${boxSel} .chip`).forEach(c => {
    c.style.display = !q || c.dataset.sv?.toLowerCase().includes(q) || c.dataset.s?.toLowerCase().includes(q) ? "" : "none";
  });
  document.querySelectorAll(`${boxSel} .chips[data-svgroup]`).forEach(g => {
    const any = [...g.querySelectorAll(".chip")].some(c => c.style.display !== "none");
    g.style.display = any ? "" : "none";
    const lbl = document.querySelector(`${boxSel} .label[data-svgroup="${g.dataset.svgroup}"]`);
    if (lbl) lbl.style.display = any ? "" : "none";
  });
}
async function saveWsProfile(getPriceLevel) {
  const err = $("pErr"); err.style.display = "none";
  if (!$("pName").value.trim()) { zeigeProfTab("allg"); return showErr(err, "Bitte einen Namen angeben."); }
  if (profCats.length === 0) { zeigeProfTab("leist"); return showErr(err, "Bitte mindestens eine Kategorie wählen."); }
  const oh = {};
  document.querySelectorAll("[data-oh]").forEach(i => { oh[i.dataset.oh] = i.value.trim() || null; });
  const row = {
    name: $("pName").value.trim(), description: $("pDesc").value.trim() || null,
    phone: $("pPhone").value.trim() || null, email: $("pEmail").value.trim() || null,
    website: $("pWeb").value.trim() || null,
    founded_year: +$("pYear").value || null, hourly_rate: parseFloat(($("pRate").value || "").replace(",", ".")) || null,
    price_level: getPriceLevel(), service_mode: $("pMode").value,
    street: $("pStreet").value.trim() || null, zip: $("pZip").value.trim() || null,
    city: $("pCity").value.trim() || "Köln", district: $("pDistrict").value || null,
    lat: profLatLng ? profLatLng[0] : null, lng: profLatLng ? profLatLng[1] : null,
    categories: profCats, services: profServices, brands: profBrands, opening_hours: oh,
    next_free_date: $("pNextFree").value || null,
    capacity: { lifts: +$("pLifts").value || null, staff: +$("pStaff").value || null, max_jobs_per_day: +$("pMaxJobs").value || null },
    master_certified: $("pMaster").checked,
    pickup_service: $("pPickup").checked, replacement_car: $("pReplace").checked, emergency_service: $("pEmergency").checked,
    payment_methods: [...document.querySelectorAll("#pPay .chip.on")].map(c => c.dataset.p),
  };
  // Bilder hochladen
  const logoFile = $("pLogo").files[0];
  if (logoFile) { const u = await uploadWsImage(logoFile, "logo"); if (u) row.logo_url = u; }
  const coverFile = $("pCover").files[0];
  if (coverFile) { const u = await uploadWsImage(coverFile, "cover"); if (u) row.cover_url = u; }
  const galFiles = [...$("pGallery").files];
  if (galFiles.length) {
    const max = myWorkshop.is_premium ? 12 : 4;
    const gal = [...(myWorkshop.gallery || [])];
    for (const f of galFiles) {
      if (gal.length >= max) { toast(`Maximal ${max} Galerie-Bilder${myWorkshop.is_premium ? "" : " – mehr mit Premium"}.`); break; }
      const u = await uploadWsImage(f, "gal");
      if (u) gal.push(u);
    }
    row.gallery = gal;
  }
  const { error } = await sb.from("workshops").update(row).eq("id", myWorkshop.id);
  if (error) return showErr(err, error.message);
  Object.assign(myWorkshop, row);
  allWorkshops = null;
  toast("Profil gespeichert ✓");
}

// ============================================================
// KI-DIAGNOSE (Hauptfunktion, öffentlich – regelbasiert)
// ============================================================
let dgLights = [], dgSounds = [], dgFiles = [];
async function vDiagnose() {
  dgLights = []; dgSounds = []; dgFiles = [];
  if (!allWorkshops) {
    sb.from("workshops").select("*").eq("is_verified", true).limit(200)
      .then(({ data }) => { allWorkshops = data || []; });
  }
  let cars = [];
  if (me && !myWorkshop) {
    const { data } = await sb.from("vehicles").select("*").eq("owner_id", me.id).order("created_at");
    cars = data || [];
  }
  window._dgCars = cars;
  // Schritt für Schritt: alle Felder bleiben im DOM (Sichern/Wiederherstellen
  // nach dem Login greift weiter über die IDs), sichtbar ist nur ein Schritt.
  main.innerHTML = `
  <div class="dg">
  <div class="pageHead"><div>
    <h1>Diagnose</h1>
    <div class="sub">In drei kurzen Schritten zur unverbindlichen Ersteinschätzung.</div>
  </div></div>
  <div class="card dgCard" id="dgWizard">
    <div class="dgProg" aria-hidden="true">
      ${DG_STEPS.map((t, i) => `<div class="dgSeg" data-i="${i + 1}"><i></i><span>${t}</span></div>`).join("")}
    </div>

    <section class="dgStep" data-step="1">
      <h2>Was ist los mit deinem Auto?</h2>
      <p class="mm">Ein, zwei Sätze reichen: Was passiert, wann und wo am Auto?</p>
      <textarea id="dgDesc" rows="4" placeholder="z.B. Beim Bremsen quietscht es vorne laut, besonders wenn es kalt ist"></textarea>
      <p class="dgHint">Lieber antippen statt tippen? Einfach weiter – im nächsten Schritt wählst du Warnleuchte oder Geräusch.</p>
    </section>

    <section class="dgStep" data-step="2" hidden>
      <h2>Leuchte oder Geräusch?</h2>
      <p class="mm">Tippe an, was zutrifft. Nichts davon? Einfach weiter.</p>
      <div class="seg dgSwitch" id="dgSwitch">
        <div data-p="dgLights" class="on">Warnleuchte <b id="dgCntL"></b></div>
        <div data-p="dgSounds">Geräusch <b id="dgCntS"></b></div>
      </div>
      <div class="chips dgChips" id="dgLights">${WARNING_LIGHTS.map(w => `<span class="chip" data-k="${w.k}"><span class="dgDot ${w.sev === "hoch" ? "rot" : ""}"></span>${w.name}</span>`).join("")}</div>
      <div class="chips dgChips" id="dgSounds" hidden>${SOUNDS.map(s => `<span class="chip" data-k="${s.k}">${s.name}</span>`).join("")}</div>
    </section>

    <section class="dgStep" data-step="3" hidden>
      <h2>Fast geschafft</h2>
      <p class="mm">Mit Fahrzeug und Dringlichkeit wird die Einschätzung genauer.</p>
      <div class="label">Fahrzeug ${cars.length ? "" : "(optional)"}</div>
      ${cars.length
        ? `<select id="dgCar">${cars.map((c, i) => `<option value="${c.id}" ${i === 0 ? "selected" : ""}>${esc(carLabel(c))}</option>`).join("")}</select>`
        : `<div class="split"><select id="dgMake">${opt("Marke (optional)", Object.keys(BRANDS), "")}</select><select id="dgPs">${opt("PS (optional)", PS_LIST, "")}</select></div>`}
      <div class="label">Wie dringend?</div>
      <div class="seg" style="margin:4px 0 0" id="dgUrgency">
        <div data-u="normal" class="on">Kann warten</div>
        <div data-u="dringend">Diese Woche</div>
        <div data-u="notfall">Sofort</div>
      </div>
      <div class="label">Foto oder Video (optional)</div>
      <div class="uploadTile" onclick="$('dgFile').click()">
        <div class="ico icoPurple">${ico("camera", 20)}</div>
        <div><div class="tt" style="font-size:12.5px">Schaden fotografieren oder filmen</div>
        <div class="mm">Geht mit deiner Anfrage an die Betriebe</div></div>
      </div>
      <input type="file" id="dgFile" accept="image/*,video/*" multiple class="hidden">
      <div class="thumbs" id="dgThumbs"></div>
    </section>

    <div class="err" id="dgErr"></div>
    <div class="dgNav">
      <button class="btn ghost" id="dgBack" type="button">Zurück</button>
      <button class="btn" id="dgNext" type="button">Weiter</button>
    </div>
    <p class="dgNote">Unverbindlich – ersetzt keine Prüfung durch eine Fachwerkstatt. Bei roten Warnleuchten besser sofort anhalten.</p>
  </div>
  <div id="dgResult"></div>
  </div>`;
  ["dgLights", "dgSounds"].forEach(boxId => document.querySelectorAll(`#${boxId} .chip`).forEach(c => c.onclick = () => {
    const arr = boxId === "dgLights" ? dgLights : dgSounds;
    const i = arr.indexOf(c.dataset.k);
    if (i >= 0) arr.splice(i, 1); else arr.push(c.dataset.k);
    c.classList.toggle("on");
    dgCounts();
  }));
  // Warnleuchten und Geräusche nacheinander statt untereinander – kürzere Liste
  document.querySelectorAll("#dgSwitch div").forEach(d => d.onclick = () => {
    document.querySelectorAll("#dgSwitch div").forEach(x => x.classList.toggle("on", x === d));
    ["dgLights", "dgSounds"].forEach(id => { $(id).hidden = id !== d.dataset.p; });
  });
  document.querySelectorAll("#dgUrgency div").forEach(d => d.onclick = () => {
    document.querySelectorAll("#dgUrgency div").forEach(x => x.classList.toggle("on", x === d));
  });
  $("dgFile").onchange = () => {
    const files = [...$("dgFile").files].slice(0, 4 - dgFiles.length);
    files.forEach(f => { if (f.size < 20 * 1024 * 1024) dgFiles.push(f); });
    $("dgThumbs").innerHTML = dgFiles.map(f => f.type.startsWith("video")
      ? `<span class="pill">${esc(f.name)}</span>`
      : `<img src="${URL.createObjectURL(f)}" loading="lazy" alt="">`).join("");
  };
  $("dgBack").onclick = () => dgShow(dgStep - 1);
  $("dgNext").onclick = () => dgStep < DG_STEPS.length ? dgShow(dgStep + 1) : runDiagnose();
  dgShow(1);

  // Nach Registrierung/Login: zuvor eingegebene Diagnose wiederherstellen …
  const pend = sessionStorage.getItem("cfx_dg_pending");
  if (pend) {
    sessionStorage.removeItem("cfx_dg_pending");
    try {
      const d = JSON.parse(pend);
      $("dgDesc").value = d.desc || "";
      dgLights = Array.isArray(d.lights) ? d.lights.slice() : [];
      dgSounds = Array.isArray(d.sounds) ? d.sounds.slice() : [];
      document.querySelectorAll("#dgLights .chip").forEach(c => c.classList.toggle("on", dgLights.includes(c.dataset.k)));
      document.querySelectorAll("#dgSounds .chip").forEach(c => c.classList.toggle("on", dgSounds.includes(c.dataset.k)));
      dgCounts();
      if (d.urgency) document.querySelectorAll("#dgUrgency div").forEach(x => x.classList.toggle("on", x.dataset.u === d.urgency));
      if ($("dgMake") && d.make) $("dgMake").value = d.make;
      if ($("dgPs") && d.ps) $("dgPs").value = d.ps;
      dgShow(DG_STEPS.length);
    } catch (e) { /* ignore */ }
    // … und die Einschätzung direkt anzeigen, wenn jetzt angemeldet
    if (me) runDiagnose();
  }
}
const DG_STEPS = ["Problem", "Anzeichen", "Details"];
let dgStep = 1;
function dgShow(n) {
  dgStep = Math.min(Math.max(n, 1), DG_STEPS.length);
  document.querySelectorAll(".dgStep").forEach(st => { st.hidden = +st.dataset.step !== dgStep; });
  document.querySelectorAll(".dgSeg").forEach(sg => {
    sg.classList.toggle("on", +sg.dataset.i <= dgStep);
    sg.classList.toggle("cur", +sg.dataset.i === dgStep);
  });
  $("dgBack").style.visibility = dgStep > 1 ? "visible" : "hidden";
  $("dgNext").textContent = dgStep < DG_STEPS.length ? "Weiter" : "Ergebnis zeigen";
  $("dgErr").style.display = "none";
}
function dgCounts() {
  $("dgCntL").textContent = dgLights.length || "";
  $("dgCntS").textContent = dgSounds.length || "";
}
// Ergebnis ausblenden und zurück zu den Angaben (alles bleibt ausgefüllt)
function dgEdit() {
  $("dgResult").innerHTML = "";
  $("dgWizard").hidden = false;
  dgShow(1);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function dgResultHead() {
  return `<div class="dgResHead"><h2>Deine Ersteinschätzung</h2>
    <button class="btn ghost sm" type="button" onclick="dgEdit()">Angaben ändern</button></div>`;
}
function saveDgPending() {
  sessionStorage.setItem("cfx_dg_pending", JSON.stringify({
    desc: $("dgDesc")?.value || "", lights: dgLights, sounds: dgSounds,
    urgency: document.querySelector("#dgUrgency div.on")?.dataset.u || "normal",
    make: $("dgMake")?.value || "", ps: $("dgPs")?.value || "",
  }));
}
function runDiagnose() {
  const err = $("dgErr"); err.style.display = "none";
  const desc = $("dgDesc").value.trim();
  if (!desc && dgLights.length === 0 && dgSounds.length === 0) {
    dgShow(1);
    return showErr(err, "Beschreibe kurz das Problem oder wähle im nächsten Schritt eine Warnleuchte bzw. ein Geräusch.");
  }
  $("dgWizard").hidden = true;
  // KI-Antwort erst nach Registrierung – Eingaben werden gesichert und danach fortgesetzt
  if (!me) {
    saveDgPending();
    $("dgResult").innerHTML = `${dgResultHead()}
      <div class="card" style="text-align:center;padding:34px 24px;border-color:rgba(30,107,255,.4);background:linear-gradient(160deg,rgba(30,107,255,.08),var(--panel))">
        <div style="color:var(--blue2)">${ico("lock", 34)}</div>
        <div class="tt" style="margin-top:10px;font-size:16px">Deine Ersteinschätzung ist fertig</div>
        <p class="mm" style="margin-top:8px;font-size:12.5px">Registriere dich <b>kostenlos</b>, um die möglichen Ursachen, die Preisorientierung und passende Werkstätten zu sehen. Deine Eingaben bleiben erhalten.</p>
        <div class="btnRow" style="justify-content:center;margin-top:16px">
          <button class="btn" onclick="authGate('diagnose')">Kostenlos registrieren &amp; Ergebnis sehen</button>
          <button class="btn ghost" onclick="authGate('diagnose', true)">Ich habe schon ein Konto</button>
        </div>
      </div>`;
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const car = $("dgCar") ? window._dgCars.find(c => c.id === $("dgCar").value)
    : ($("dgMake")?.value ? { make: $("dgMake").value, power_ps: +($("dgPs")?.value || 0) } : null);
  const urgency = document.querySelector("#dgUrgency div.on")?.dataset.u || "normal";

  // Treffer sammeln: Freitext + Warnleuchten + Geräusche
  const hits = [];
  const seen = new Set();
  const push = (h) => { const key = h.cat + "|" + h.service; if (!seen.has(key)) { seen.add(key); hits.push(h); } };
  dgLights.forEach(k => { const w = WARNING_LIGHTS.find(x => x.k === k); if (w) push({ cat: w.cat, service: w.service, guess: w.guess, conf: w.sev === "hoch" ? "hoch" : "mittel", sev: w.sev, why: w.why, risk: w.risk }); });
  dgSounds.forEach(k => { const s = SOUNDS.find(x => x.k === k); if (s) push({ cat: s.cat, service: s.service, guess: s.guess, conf: "mittel", why: s.why }); });
  aiAnalyze(desc, 5).forEach(push);
  const redAlert = dgLights.some(k => WARNING_LIGHTS.find(x => x.k === k)?.sev === "hoch") || urgency === "notfall";

  const top = hits.slice(0, 5);
  const recs = (allWorkshops || []).filter(ws => top.some(h => ws.categories.includes(h.cat))).slice(0, 3);
  const qs = top[0] ? `cat=${top[0].cat}&service=${encodeURIComponent(top[0].service)}&title=${encodeURIComponent(top[0].guess.slice(0, 60))}&desc=${encodeURIComponent(desc.slice(0, 300))}&urgency=${urgency}` : "";

  $("dgResult").innerHTML = `${dgResultHead()}
  ${redAlert ? `<div class="warn" style="border-color:rgba(255,92,92,.5);color:#FF9C9C"><b>Sicherheitshinweis:</b> Bei roten Warnleuchten oder akuten Problemen nicht weiterfahren. <a href="#/notfall" style="color:#fff;font-weight:800">Notfallmodus öffnen</a></div>` : ""}
  ${top.length === 0
    ? `<div class="card dgCause"><b>Keine eindeutige Zuordnung möglich</b>
        <p class="mm">Am besten prüft das eine Fachwerkstatt. Erstelle eine Ausschreibung mit deiner Beschreibung – passende Betriebe melden sich mit Angeboten.</p></div>`
    : top.map((h, i) => {
      const pr = priceRange(h.service, car);
      return `<div class="card dgCause">
        <div class="dgCauseTop"><span class="dgRank">${i + 1}</span><b>${esc(h.guess)}</b></div>
        <div class="dgTags">
          <span class="badge ${h.conf === "hoch" ? "b-green" : "b-gold"}">${h.conf}e Wahrscheinlichkeit</span>
          ${h.sev === "hoch" ? '<span class="badge b-red">wichtig</span>' : ""}
          <span class="badge b-blue">${ico(h.cat)} ${CATS[h.cat].name} · ${esc(h.service)}</span>
        </div>
        ${h.why ? `<p class="dgLine">${ico("lightbulb")}<span>${esc(h.why)}</span></p>` : ""}
        ${h.risk ? `<p class="dgLine dgRisk">${ico("alert")}<span>${esc(h.risk)}</span></p>` : ""}
        ${h.action ? `<p class="dgLine dgDo">${ico("arrowR")}<span>${esc(h.action)}</span></p>` : ""}
        ${pr ? `<div class="dgPrice">${ico("euro")} häufig <b>${pr.lo}–${pr.hi} €</b>${pr.note ? `<span>${esc(pr.note)}</span>` : ""}</div>` : ""}
      </div>`;
    }).join("")}
  <div class="btnRow dgActions">
    ${me && !myWorkshop ? `<a class="btn" href="#/new-request?${qs}">Angebote einholen</a>` : `<a class="btn" href="#/${me ? "search" : "register"}">${me ? "Werkstatt suchen" : "Kostenlos registrieren & anfragen"}</a>`}
    ${top[0] ? `<a class="btn ghost" href="#/teile?q=${encodeURIComponent(top[0].service)}">Passende Teile</a>` : ""}
    ${urgency !== "normal" ? `<a class="btn red" href="#/notfall">Notfallmodus</a>` : ""}
  </div>
  <p class="dgNote">Unverbindliche Ersteinschätzung – keine Diagnose und keine Preiszusage. Den endgültigen Preis legt die Werkstatt nach der Prüfung fest.</p>
  <div id="dgParts"></div>
  ${recs.length ? `<div class="card"><div class="tt">Passende Betriebe in der Nähe</div>
    <div style="margin-top:12px">${recs.map(ws => wsCardHtml({ ...ws, _dist: distKm(searchOrigin || CITY_CENTER, [ws.lat, ws.lng]) })).join("")}</div></div>` : ""}`;
  // Passende Teile aus dem Marktplatz (direkt zum Teil)
  if (top[0]) loadDiagnoseParts(top);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function loadDiagnoseParts(top) {
  const box = $("dgParts"); if (!box) return;
  if (!allParts) {
    const { data } = await sb.from("parts").select("*, workshops(*)")
      .eq("active", true).order("created_at", { ascending: false }).limit(500);
    allParts = data || [];
  }
  if (!$("dgParts")) return;
  const terms = top.flatMap(h => [h.service, ...(h.guess || "").split(/[\s,()/]+/)]).map(x => (x || "").toLowerCase()).filter(x => x.length > 3);
  const matches = (allParts || []).filter(p => p.quantity !== 0).filter(p => {
    const hay = [p.title, p.brand, p.fits, p.description, p.category].join(" ").toLowerCase();
    return terms.some(t => hay.includes(t));
  }).slice(0, 3);
  if (!matches.length) return;
  box.innerHTML = `<div class="card" style="margin-top:14px"><div class="tt">Passende Teile im Marktplatz</div>
    <div style="margin-top:12px">${matches.map(partCardHtml).join("")}</div>
    <a class="btn ghost sm" style="margin-top:10px" href="#/teile?q=${encodeURIComponent(top[0].service)}">Alle passenden Teile ansehen</a></div>`;
}

// ============================================================
// NOTFALLMODUS (öffentlich)
// ============================================================
function vNotfall() {
  // Gerüst (Notruf-/ADAC-Nummern, Formular) SOFORT rendern – unabhängig vom Backend.
  main.innerHTML = `
  <div class="pageHead"><div>
    <h1>Notfallmodus</h1>
    <div class="sub">Panne, Auto startet nicht oder rote Warnleuchte? Hier findest du schnelle Hilfe: mobile Werkstätten und Betriebe mit Notdienst.</div>
  </div></div>
  <div class="warn">Bei Unfällen mit Verletzten immer zuerst den Notruf <b>112</b> wählen. Pannenhilfe-Zentralen: ADAC <b>089 20 20 4000</b>.</div>
  <div class="card" style="margin-bottom:16px">
    <div class="label" style="margin-top:0">Was ist passiert?</div>
    <div class="chips" id="emType">${EMERGENCY_TYPES.map(e => `<span class="chip" data-k="${e.k}">${e.name}</span>`).join("")}</div>
    <div class="btnRow">
      <button class="btn ghost sm" id="emLoc">Meinen Standort verwenden</button>
      <span class="mm" id="emLocInfo" style="align-self:center">${searchOrigin ? "" + esc(searchOriginLabel) : "Kein Standort gesetzt"}</span>
    </div>
  </div>
  <div class="tt" style="margin-bottom:12px" id="emCount">Schnelle Hilfe in der Nähe</div>
  <div id="emList"><div class="empty"><div class="e">${ico("clock", 40)}</div>Betriebe in der Nähe werden geladen…</div></div>`;
  document.querySelectorAll("#emType .chip").forEach(c => c.onclick = () => {
    document.querySelectorAll("#emType .chip").forEach(x => x.classList.toggle("on", x === c));
  });
  $("emLoc").onclick = () => {
    if (!navigator.geolocation) return toast("Standort nicht unterstützt.");
    navigator.geolocation.getCurrentPosition(
      (pos) => { searchOrigin = [pos.coords.latitude, pos.coords.longitude]; searchOriginLabel = "Dein Standort"; toast("Standort gesetzt."); vNotfall(); },
      () => toast("Standort nicht verfügbar."));
  };
  fillEmergencyList();
}

async function fillEmergencyList() {
  let list = allWorkshops;
  if (!list) {
    try {
      const { data, error } = await sb.from("workshops").select("*").eq("is_verified", true).limit(200);
      if (error) throw error;
      list = data || [];
      allWorkshops = list; // nur bei Erfolg cachen
    } catch (e) {
      const el = $("emList");
      if (el) el.innerHTML = `<div class="warn">Betriebe konnten gerade nicht geladen werden. Bei akuter Panne: Notruf <b>112</b>, ADAC <b>089 20 20 4000</b>.</div>`;
      return;
    }
  }
  const helpers = list.filter(ws => ws.emergency_service || ws.service_mode !== "stationary");
  const cnt = $("emCount"); if (cnt) cnt.textContent = `Schnelle Hilfe in der Nähe (${helpers.length})`;
  const el = $("emList");
  if (!el) return; // Nutzer hat die Seite inzwischen verlassen
  el.innerHTML = helpers.length === 0
    ? `<div class="empty"><div class="e">${ico("alert", 40)}</div>Aktuell keine Notdienst-Betriebe verfügbar.</div>`
    : helpers.map(ws => {
      const d = distKm(searchOrigin || CITY_CENTER, [ws.lat, ws.lng]);
      return `<div class="card" style="margin-bottom:11px">
        <div class="cardHead">
          <div class="ico icoRed"></div>
          <div style="flex:1;min-width:0"><div class="tt">${esc(ws.name)}</div>
          <div class="mm">${ws.emergency_service ? "Notdienst · " : ""}${ws.service_mode !== "stationary" ? "Mobil · " : ""}${esc(ws.district || ws.city || "")}${d != null ? ` · ${d.toFixed(1).replace(".", ",")} km` : ""} · ${stars(ws.rating_avg)} ${ws.rating_avg > 0 ? Number(ws.rating_avg).toLocaleString("de-DE") : ""}</div></div>
        </div>
        <div class="foot">
          ${ws.phone ? `<a class="btn green sm" href="tel:${esc(ws.phone.replace(/\s/g, ""))}">${esc(ws.phone)}</a>` : ""}
          <button class="btn sm" onclick="emergencyRequest('${ws.id}')">Schnellanfrage</button>
          <a class="btn ghost sm" href="#/workshop/${ws.id}">Profil</a>
        </div>
      </div>`;
    }).join("");
}
function emergencyRequest(wsId) {
  if (!me) {
    sessionStorage.setItem("cfx_after_auth", "notfall");
    toast("Registriere dich kostenlos – danach kannst du die Notfall-Anfrage direkt senden.");
    return go("register");
  }
  if (myWorkshop) return toast("Als Betrieb kannst du keine Anfragen stellen.");
  const t = document.querySelector("#emType .chip.on");
  const typ = t ? EMERGENCY_TYPES.find(e => e.k === t.dataset.k) : null;
  go(`new-request?ws=${wsId}&urgency=notfall&title=${encodeURIComponent("Notfall: " + (typ?.name || "Panne"))}&desc=${encodeURIComponent("NOTFALL – " + (typ?.name || "Panne") + ". Standort: " + (searchOriginLabel || "bitte erfragen") + ". Bitte schnellstmöglich melden!")}`);
}

// ============================================================
// WERKSTATTVERGLEICH (bis zu 3)
// ============================================================
async function vCompare() {
  if (compareSet.length < 2) {
    main.innerHTML = `<div class="pageHead"><div><h1>Werkstattvergleich</h1></div></div>
      <div class="empty"><div class="e">${ico("arrowR",40)}</div>Wähle in der <a href="#/search" style="color:var(--blue2)">Suche</a> zwei bis drei Werkstätten über „Vergleichen" aus.</div>`;
    return;
  }
  const { data } = await sb.from("workshops").select("*").in("id", compareSet);
  const list = compareSet.map(id => (data || []).find(w => w.id === id)).filter(Boolean);
  const origin = searchOrigin || CITY_CENTER;
  const row = (label, fn) => `<tr><td style="color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:800">${label}</td>${list.map(ws => `<td>${fn(ws)}</td>`).join("")}</tr>`;
  main.innerHTML = `
  <div class="pageHead">
    <div><h1>Werkstattvergleich</h1><div class="sub">${list.length} Betriebe im direkten Vergleich.</div></div>
    <div class="right"><button class="btn ghost sm" onclick="compareSet=[];go('search')">Auswahl leeren</button></div>
  </div>
  <div class="tblWrap"><table class="tbl">
    <thead><tr><th style="width:150px"></th>${list.map(ws => `<th><a href="#/workshop/${ws.id}" style="color:var(--blue2)">${esc(ws.name)}</a></th>`).join("")}</tr></thead>
    <tbody>
      ${row("Bewertung", ws => `<span style="color:var(--gold)">${stars(ws.rating_avg)}</span> ${ws.rating_avg > 0 ? Number(ws.rating_avg).toLocaleString("de-DE") : "Neu"} (${ws.rating_count || 0})`)}
      ${row("Entfernung", ws => { const d = distKm(origin, [ws.lat, ws.lng]); return d != null ? d.toFixed(1).replace(".", ",") + " km" : "–"; })}
      ${row("Preisniveau", ws => ws.price_level ? "€".repeat(ws.price_level) : "–")}
      ${row("Stundensatz", ws => ws.hourly_rate ? "ab " + Math.round(ws.hourly_rate) + " €" : "–")}
      ${row("Verifiziert", ws => ws.is_verified ? "" : "–")}
      ${row("Jetzt geöffnet", ws => { const o = isOpenNow(ws.opening_hours); return o === true ? "" : o === false ? "" : "–"; })}
      ${row("Mobiler Service", ws => ws.service_mode !== "stationary" ? "" : "–")}
      ${row("Hol- & Bringservice", ws => ws.pickup_service ? "" : "–")}
      ${row("Ersatzwagen", ws => ws.replacement_car ? "" : "–")}
      ${row("Notdienst", ws => ws.emergency_service ? "" : "–")}
      ${row("Kategorien", ws => ws.categories.map(c => ico(c)).join(" "))}
      ${row("Marken-Fokus", ws => (ws.brands || []).length ? ws.brands.slice(0, 4).join(", ") : "Alle")}
      ${row("", ws => me && !myWorkshop ? `<a class="btn sm" href="#/new-request?ws=${ws.id}">Anfrage stellen</a>` : `<a class="btn ghost sm" href="#/workshop/${ws.id}">Profil</a>`)}
    </tbody>
  </table></div>`;
}

// ============================================================
// DIGITALE FAHRZEUGAKTE
// ============================================================
async function vVehicleRecord(id) {
  if (!requireAuth() || !id) return;
  main.innerHTML = `<div class="sk" style="height:220px"></div>`;
  const [{ data: v }, { data: reqs }, { data: logs }, { data: rems }] = await Promise.all([
    sb.from("vehicles").select("*").eq("id", id).maybeSingle(),
    sb.from("requests").select("*").eq("vehicle_id", id).order("created_at", { ascending: false }),
    sb.from("vehicle_logs").select("*").eq("vehicle_id", id).order("created_at", { ascending: false }),
    sb.from("reminders").select("*").eq("vehicle_id", id).order("due_date"),
  ]);
  if (!v) { main.innerHTML = `<div class="warn">Fahrzeug nicht gefunden.</div>`; return; }
  const reqIds = (reqs || []).map(r => r.id);
  const [{ data: bks }, { data: offers }] = await Promise.all([
    sb.from("bookings").select("*, offers(request_id,total_price,is_fixed_price,workshops(id,name,phone)), reviews(rating)").eq("vehicle_id", id).order("created_at", { ascending: false }),
    reqIds.length ? sb.from("offers").select("id,request_id,total_price,status,created_at, workshops(name)").in("request_id", reqIds) : Promise.resolve({ data: [] }),
  ]);
  const bkIds = (bks || []).map(b => b.id);
  const { data: approvals } = bkIds.length
    ? await sb.from("approvals").select("*").in("booking_id", bkIds).order("created_at", { ascending: false })
    : { data: [] };

  const bkByReq = {};
  (bks || []).forEach(b => { if (b.offers?.request_id) bkByReq[b.offers.request_id] = b; });
  const doneJobs = (bks || []).filter(b => b.status === "completed");
  const upcoming = (bks || []).filter(b => b.scheduled_at && new Date(b.scheduled_at) > new Date() && !["completed", "cancelled"].includes(b.status));
  const openApprovals = (approvals || []).filter(a => a.status === "requested");
  const allDocs = (bks || []).flatMap(b => (b.documents || []).map(d => ({ ...d, bk: b })));
  const allPics = (reqs || []).flatMap(r => (r.attachments || [])).concat((approvals || []).flatMap(a => a.photos || []));
  const openRems = (rems || []).filter(r => !r.done);
  const lastKm = (logs || []).find(l => l.mileage)?.mileage || v.mileage;
  const spent = doneJobs.reduce((s, b) => s + Number(b.total_price || 0), 0);

  // „Verkaufswert verbessern"
  const tips = [];
  if (!v.tuev_until || new Date(v.tuev_until) < new Date(Date.now() + 90 * 864e5)) tips.push(["", "TÜV erneuern", "tuev", "HU + AU"]);
  tips.push(["", "Inspektion durchführen", "inspektion", "Kleine Inspektion"]);
  tips.push(["", "Wartungsnachweise vollständig halten (Dokumente hier sammeln)", null, null]);
  tips.push(["", "Lack aufbereiten", "pflege", "Lackaufbereitung"]);
  tips.push(["", "Innenraum aufbereiten", "pflege", "Innenreinigung"]);
  tips.push(["", "Felgen reparieren", "reifen", "Felgenreparatur"]);
  tips.push(["", "Reifen erneuern", "reifen", "Reifenwechsel"]);
  tips.push(["", "Schäden dokumentieren (Fotos in Anfragen hochladen)", null, null]);

  main.innerHTML = `
  <div class="pageHead">
    <div class="ico icoBlue" style="width:52px;height:52px;font-size:23px"></div>
    <div style="flex:1"><h1>Fahrzeugakte: ${esc(v.make)} ${esc(v.model)}${v.series && v.series !== "Keine Angabe" ? " " + esc(v.series) : ""}</h1>
    <div class="sub">${esc(carLabel(v))}${v.license_plate ? " · " + esc(v.license_plate) : ""}</div></div>
    <div class="right">
      <a class="btn sm" href="#/new-request">＋ Neue Anfrage</a>
      <button class="btn ghost sm" onclick="openVehicleForm('${v.id}')">Bearbeiten</button>
    </div>
  </div>
  <div class="kpiRow">
    <div class="kpi"><b>${doneJobs.length}</b><span>Abgeschlossene Aufträge</span></div>
    <div class="kpi"><b>${v.tuev_until ? fmtDate(v.tuev_until) : "–"}</b><span>TÜV gültig bis${v.tuev_until && new Date(v.tuev_until) < new Date(Date.now() + 60 * 864e5) ? " " : ""}</span></div>
    <div class="kpi"><b>${lastKm ? Number(lastKm).toLocaleString("de-DE") + " km" : "–"}</b><span>Letzter Kilometerstand</span></div>
    <div class="kpi"><b>${spent > 0 ? spent.toLocaleString("de-DE") + " €" : "–"}</b><span>Investiert (abgeschlossen)</span></div>
  </div>

  ${openApprovals.length ? `<div class="warn"><b>${openApprovals.length} offene Zusatzfreigabe${openApprovals.length > 1 ? "n" : ""}:</b>
    ${openApprovals.map(a => {
      const bk = (bks || []).find(b => b.id === a.booking_id);
      const rid = bk?.offers?.request_id;
      return `${esc(a.title)} (+${fmtEur(a.extra_cost)}) ${rid ? `<a href="#/request/${rid}" style="color:#fff;font-weight:800">→ Jetzt entscheiden</a>` : ""}`;
    }).join(" · ")}</div>` : ""}

  ${upcoming.length ? `<div class="note"><b>Kommende Termine:</b> ${upcoming.map(b => {
      const w = b.offers?.workshops;
      return `${fmtDateTime(b.scheduled_at)} bei ${esc(w?.name || "Werkstatt")}`;
    }).join(" · ")}</div>` : ""}

  <div class="grid2" style="align-items:start">
    <div>
      <div class="card" style="margin-bottom:14px">
        <div class="tt">Fahrzeugdaten</div>
        <div style="margin-top:8px">
          <div class="offerLine"><span>Marke / Modell</span><span><b>${esc(v.make)} ${esc(v.model)}</b></span></div>
          <div class="offerLine"><span>Baureihe</span><span>${esc(v.series || "–")}</span></div>
          <div class="offerLine"><span>Karosserie</span><span>${esc(v.body_type || "–")}</span></div>
          <div class="offerLine"><span>Baujahr</span><span>${esc(v.year || "–")}</span></div>
          <div class="offerLine"><span>Motor / Kraftstoff</span><span>${esc(v.engine || "–")} · ${esc(v.fuel || "–")}</span></div>
          <div class="offerLine"><span>Leistung / Getriebe</span><span>${v.power_ps ? v.power_ps + " PS" : "–"} · ${esc(v.transmission || "–")}</span></div>
          <div class="offerLine"><span>Kilometerstand (ca.)</span><span>${lastKm ? Number(lastKm).toLocaleString("de-DE") + " km" : "–"}</span></div>
          <div class="offerLine"><span>Kennzeichen</span><span>${esc(v.license_plate || "–")}</span></div>
          <div class="offerLine"><span>TÜV / HU gültig bis</span><span>${v.tuev_until ? fmtDate(v.tuev_until) : "–"}</span></div>
        </div>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div class="tt">Reparatur- & Wartungshistorie <span class="badge b-blue">${(reqs || []).length}</span></div>
        <div style="margin-top:10px">${(reqs || []).length === 0
          ? '<p class="mm">Noch keine Aufträge mit diesem Fahrzeug. <a href="#/new-request" style="color:var(--blue2)">Erste Anfrage erstellen →</a></p>'
          : reqs.map(r => {
            const c = CATS[r.category] || { icon: "", name: r.category };
            const bk = bkByReq[r.id];
            const offerCount = (offers || []).filter(o => o.request_id === r.id).length;
            const rev = bk?.reviews?.[0] || (Array.isArray(bk?.reviews) ? bk.reviews[0] : bk?.reviews);
            return `<div class="card tap" style="margin-bottom:9px;padding:12px" onclick="go('request/${r.id}')">
              <div class="cardHead"><div class="ico" style="width:34px;height:34px;font-size:15px">${ico(r.category)}</div>
              <div style="flex:1;min-width:0"><div class="tt" style="font-size:13px">${esc(r.title)}</div>
              <div class="mm">${fmtDate(r.created_at)} · ${c.name}${bk ? ` · ${fmtEur(bk.total_price)} · ${esc(bk.offers?.workshops?.name || "")}` : offerCount ? ` · ${offerCount} Angebot${offerCount > 1 ? "e" : ""}` : ""}${rev?.rating ? ` · <span style="color:var(--gold)">${stars(rev.rating)}</span>` : ""}</div>
              ${bk?.warranty_note ? `<div class="mm">Garantie/Gewährleistung hinterlegt</div>` : ""}</div>
              <span class="badge ${bk ? (BK_STATUS[bk.status]?.[1] || "b-grey") : r.status === "open" ? "b-green" : "b-grey"}">${bk ? (BK_STATUS[bk.status]?.[0] || bk.status) : r.status === "open" ? "Offen" : r.status === "booked" ? "Gebucht" : "Beendet"}</span></div>
            </div>`;
          }).join("")}</div>
      </div>

      <div class="card">
        <div class="tt">Kilometerstand-Historie & Notizen</div>
        <div class="split" style="margin-top:12px">
          <input id="vlKm" inputmode="numeric" placeholder="Kilometerstand">
          <input id="vlNote" placeholder="Notiz (optional)">
          <button class="btn sm" id="vlAdd" style="flex:0 0 auto">＋</button>
        </div>
        <div style="margin-top:12px">${(logs || []).map(l => `
          <div class="offerLine"><span>${fmtDate(l.created_at)}${l.note ? " · " + esc(l.note) : ""}</span><span>${l.mileage ? "<b>" + Number(l.mileage).toLocaleString("de-DE") + " km</b>" : ""}</span></div>`).join("") || '<p class="mm">Noch keine Einträge – trage regelmäßig deinen Kilometerstand ein.</p>'}</div>
      </div>
    </div>

    <div>
      <div class="card" style="margin-bottom:14px">
        <div class="tt">Dokumente & Rechnungen <span class="badge b-blue">${allDocs.length + (v.registration_doc ? 1 : 0)}</span></div>
        <p class="mm" style="margin-top:4px;font-size:11px">Rechnungen und Berichte werden von der jeweiligen Werkstatt erstellt – Carfixo speichert sie hier für dich.</p>
        <div style="margin-top:8px">
          ${v.registration_doc ? `<div class="offerLine"><span>Fahrzeugschein (privat)</span><a href="#" onclick="openBookingDoc(${jsArg(v.registration_doc)});return false" style="color:var(--blue2);font-weight:700;font-size:12px">Öffnen →</a></div>` : ""}
          ${allDocs.length === 0 && !v.registration_doc ? '<p class="mm">Noch keine Dokumente. Werkstätten laden Rechnungen und Berichte nach dem Auftrag hoch.</p>' : ""}
          ${allDocs.map(d => `<div class="offerLine"><span>${esc(d.type || "Dokument")} · ${esc(d.name || "")} <span class="mm">(${esc(d.bk.booking_no || "")}, ${fmtDate(d.uploaded_at)})</span></span>
            <a href="#" onclick="openBookingDoc(${jsArg(d.path)});return false" style="color:var(--blue2);font-weight:700;font-size:12px">Öffnen →</a></div>`).join("")}
        </div>
        ${(bks || []).filter(b => b.warranty_note).map(b => `<div class="note" style="margin:10px 0 0"><b>${esc(b.booking_no || "Auftrag")} – Gewährleistung (${esc(b.offers?.workshops?.name || "Werkstatt")}):</b><br>${esc(b.warranty_note)}</div>`).join("")}
      </div>

      ${allPics.length ? `<div class="card" style="margin-bottom:14px">
        <div class="tt">Bilder aus Anfragen & Aufträgen <span class="badge b-blue">${allPics.length}</span></div>
        <div class="thumbs" style="margin-top:10px">${allPics.slice(0, 12).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" loading="lazy" alt="Bild"></a>`).join("")}</div>
      </div>` : ""}

      <div class="card" style="margin-bottom:14px">
        <div class="tt">Erinnerungen & Termine</div>
        <div style="margin-top:8px">${openRems.length === 0
          ? `<p class="mm">Keine offenen Erinnerungen. <a href="#/reminders" style="color:var(--blue2)">Zur Erinnerungszentrale →</a></p>`
          : openRems.map(rm => `<div class="offerLine"><span>${esc(rm.title)}</span><span>${fmtDate(rm.due_date)}</span></div>`).join("")}
        ${upcoming.map(b => `<div class="offerLine"><span>Werkstatt-Termin (${esc(b.offers?.workshops?.name || "")})</span><span>${fmtDateTime(b.scheduled_at)}</span></div>`).join("")}</div>
      </div>

      <div class="card">
        <div class="tt">Verkaufswert verbessern</div>
        <div style="margin-top:8px">${tips.map(t => `
          <div class="offerLine"><span>${t[0]} ${esc(t[1])}</span>${t[2] ? `<a href="#/new-request?cat=${t[2]}&service=${encodeURIComponent(t[3])}" style="color:var(--blue2);font-weight:700;font-size:12px">Anfragen →</a>` : ""}</div>`).join("")}</div>
        <p class="mm" style="margin-top:10px;font-size:11px">Diese Maßnahmen können Verkaufswert oder Verkaufschancen verbessern.</p>
      </div>
    </div>
  </div>`;
  $("vlAdd").onclick = async () => {
    const km = parseInt($("vlKm").value, 10);
    if (!km && !$("vlNote").value.trim()) return toast("Kilometerstand oder Notiz angeben.");
    if (km && lastKm && km < Number(lastKm)) {
      if (!(await frage("Der neue Kilometerstand ist niedriger als der letzte eingetragene.", { titel: "Trotzdem speichern?", ja: "Speichern" }))) return;
    }
    const { error } = await sb.from("vehicle_logs").insert({ vehicle_id: v.id, user_id: me.id, mileage: km || null, note: $("vlNote").value.trim() || null });
    if (error) return toast(error.message);
    toast("Eintrag gespeichert ✓");
    vVehicleRecord(v.id);
  };
}
// ---------- Favoriten ----------
async function toggleFavorite(wsId, btn) {
  if (!requireAuth()) return;
  const { data: ex } = await sb.from("favorites").select("workshop_id").eq("user_id", me.id).eq("workshop_id", wsId).maybeSingle();
  if (ex) {
    await sb.from("favorites").delete().eq("user_id", me.id).eq("workshop_id", wsId);
    toast("Aus Favoriten entfernt.");
    if (btn) btn.textContent = "Merken";
  } else {
    const { error } = await sb.from("favorites").insert({ user_id: me.id, workshop_id: wsId });
    if (error) return toast(error.message);
    toast("Zu Favoriten hinzugefügt ");
    if (btn) btn.textContent = "Gemerkt";
  }
}

// ============================================================
// WERKSTATT: Statistiken (Premium)
// ============================================================
async function vWsStats() {
  if (needWorkshop()) return;
  if (!myWorkshop.is_premium) {
    main.innerHTML = `<div class="pageHead"><div><h1>Statistiken</h1></div></div>
    <div class="card" style="max-width:560px;margin:30px auto;text-align:center;border-color:rgba(255,176,32,.4)">
      <div style="font-size:44px"></div>
      <h2 style="font-size:22px;font-weight:800;margin-top:10px">Carfixo Premium für Betriebe</h2>
      <p class="mm" style="margin-top:10px">Detaillierte Statistiken, bevorzugte Platzierung (als „Hervorgehoben" markiert), mehr Bilder, Angebotsvorlagen und Auslastungsübersicht.</p>
      <div class="chips" style="justify-content:center;margin-top:16px">
        <span class="pill">Angebots- & Annahmequote</span><span class="pill">Profil-Boost</span><span class="pill">Mehr Bilder</span>
      </div>
      <button class="btn wide" style="margin-top:20px" id="wsPremGo">Premium aktivieren – aktuell kostenlos</button>
    </div>`;
    $("wsPremGo").onclick = async () => {
      const { error } = await sb.from("workshops").update({ is_premium: true }).eq("id", myWorkshop.id);
      if (error) return toast(error.message);
      myWorkshop.is_premium = true;
      toast("Premium aktiviert ");
      vWsStats();
    };
    return;
  }
  main.innerHTML = `<div class="pageHead"><div><h1>Statistiken <span class="badge b-gold">Premium</span></h1>
    <div class="sub">Deine Performance auf Carfixo.</div></div></div>
    <div class="kpiRow" id="stKpis">${'<div class="kpi"><div class="sk" style="height:40px"></div></div>'.repeat(4)}</div>
    <div class="kpiRow" id="stKpis2"></div>
    <div class="grid2">
      <div class="card"><div class="tt">Beste Kategorien</div><div id="stCats" style="margin-top:10px"></div></div>
      <div class="card"><div class="tt">Verlorene Angebote</div><div id="stLost" style="margin-top:10px"></div></div>
    </div>`;
  const [{ data: offers }, { data: jobs }, { data: reqs }] = await Promise.all([
    sb.from("offers").select("*, requests(category,title)").eq("workshop_id", myWorkshop.id),
    sb.from("bookings").select("*").eq("workshop_id", myWorkshop.id),
    sb.from("requests").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  const o = offers || [], j = jobs || [];
  const accepted = o.filter(x => x.status === "accepted");
  const declined = o.filter(x => x.status === "declined");
  const done = j.filter(x => x.status === "completed");
  const avgVal = o.length ? o.reduce((s, x) => s + Number(x.total_price), 0) / o.length : 0;
  $("stKpis").innerHTML = `
    <div class="kpi"><b>${o.length}</b><span>Angebote gesendet</span></div>
    <div class="kpi"><b>${accepted.length}</b><span>Angenommen (${o.length ? Math.round(accepted.length / o.length * 100) : 0} %)</span></div>
    <div class="kpi"><b>${done.length}</b><span>Aufträge abgeschlossen</span></div>
    <div class="kpi"><b>${Math.round(avgVal).toLocaleString("de-DE")} €</b><span>Ø Angebotswert</span></div>`;
  const cancelled = j.filter(x => x.status === "cancelled").length;
  const noShows = j.filter(x => x.no_show).length;
  $("stKpis2").innerHTML = `
    <div class="kpi"><b>${myWorkshop.rating_avg > 0 ? "★ " + Number(myWorkshop.rating_avg).toLocaleString("de-DE") : "–"}</b><span>${myWorkshop.rating_count || 0} Bewertungen</span></div>
    <div class="kpi"><b>${done.reduce((s, x) => s + Number(x.total_price), 0).toLocaleString("de-DE")} €</b><span>Umsatz (abgeschlossen)</span></div>
    <div class="kpi"><b>${cancelled}</b><span>Stornierungen</span></div>
    <div class="kpi"><b>${noShows}</b><span>No-Shows</span></div>`;
  const byCat = {};
  o.forEach(x => { const c = x.requests?.category || "?"; byCat[c] = byCat[c] || { sent: 0, won: 0 }; byCat[c].sent++; if (x.status === "accepted") byCat[c].won++; });
  $("stCats").innerHTML = Object.entries(byCat).sort((a, b) => b[1].won - a[1].won).map(([c, v]) =>
    `<div class="offerLine"><span>${ico(c)} ${CATS[c]?.name || c}</span><span>${v.won}/${v.sent} gewonnen</span></div>`).join("") || '<p class="mm">Noch keine Daten.</p>';
  $("stLost").innerHTML = declined.slice(0, 8).map(x =>
    `<div class="offerLine"><span>${esc(x.requests?.title || "Anfrage")}</span><span>${fmtEur(x.total_price)}</span></div>`).join("") || '<p class="mm">Keine verlorenen Angebote </p>';
}

// ============================================================
// WERKSTATT: Archiv + CSV-Export
// ============================================================
let arSeg = "angebote";
async function vWsArchive() {
  if (needWorkshop()) return;
  main.innerHTML = `
  <div class="pageHead"><div><h1>Archiv</h1><div class="sub">Alle Angebote und Aufträge – filterbar und als CSV exportierbar.</div></div>
  <div class="right"><button class="btn ghost sm" id="arCsv">⬇ CSV-Export</button></div></div>
  <div class="seg" id="arSeg">
    <div data-s="angebote" class="${arSeg === "angebote" ? "on" : ""}">Angebote</div>
    <div data-s="auftraege" class="${arSeg === "auftraege" ? "on" : ""}">Aufträge</div>
  </div>
  <div class="split" style="max-width:560px">
    <select id="arStatus"><option value="">Alle Status</option></select>
    <select id="arCat">${opt("Alle Kategorien", Object.keys(CATS).map(k => CATS[k].name), "")}</select>
    <input id="arFrom" type="date" title="Von">
  </div>
  <div id="arList" style="margin-top:14px"><div class="sk" style="height:110px"></div></div>`;
  document.querySelectorAll("#arSeg div").forEach(d => d.onclick = () => {
    arSeg = d.dataset.s;
    document.querySelectorAll("#arSeg div").forEach(x => x.classList.toggle("on", x === d));
    fillArStatus(); loadArchive();
  });
  ["arStatus", "arCat", "arFrom"].forEach(id => $(id).onchange = loadArchive);
  $("arCsv").onclick = exportArchiveCsv;
  fillArStatus();
  await loadArchive();
}
function fillArStatus() {
  const opts = arSeg === "angebote"
    ? [["sent", "Gesendet"], ["accepted", "Angenommen"], ["declined", "Abgelehnt / verloren"], ["withdrawn", "Zurückgezogen"]]
    : Object.entries(BK_STATUS).map(([k, v]) => [k, v[0]]).concat([["no_show", "No-Show"]]);
  $("arStatus").innerHTML = '<option value="">Alle Status</option>' + opts.map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
}
let arRows = [];
async function loadArchive() {
  const box = $("arList"); if (!box) return;
  const st = $("arStatus").value, cat = $("arCat").value, from = $("arFrom").value;
  if (arSeg === "angebote") {
    let q = sb.from("offers").select("*, requests(title,category,vehicle_label)").eq("workshop_id", myWorkshop.id).order("created_at", { ascending: false }).limit(300);
    if (st) q = q.eq("status", st);
    if (from) q = q.gte("created_at", from);
    const { data } = await q;
    arRows = (data || []).filter(o => !cat || CATS[o.requests?.category]?.name === cat);
    box.innerHTML = arRows.length === 0 ? '<div class="empty"><div class="e">${ico("chat",40)}</div>Keine Einträge.</div>'
      : `<div class="tblWrap"><table class="tbl"><thead><tr><th>Anfrage</th><th>Fahrzeug</th><th>Betrag</th><th>Status</th><th>Datum</th></tr></thead><tbody>
        ${arRows.map(o => `<tr>
          <td><b>${esc(o.requests?.title || "")}</b><div class="mm">${CATS[o.requests?.category]?.name || ""}</div></td>
          <td class="mm">${esc(o.requests?.vehicle_label || "")}</td>
          <td>${fmtEur(o.total_price)}</td>
          <td><span class="badge ${o.status === "accepted" ? "b-green" : o.status === "declined" ? "b-red" : "b-blue"}">${o.status === "accepted" ? "Angenommen" : o.status === "declined" ? "Verloren" : o.status === "sent" ? "Gesendet" : o.status}</span></td>
          <td class="mm">${fmtDate(o.created_at)}</td></tr>`).join("")}</tbody></table></div>`;
  } else {
    let q = sb.from("bookings").select("*, offers(requests(title,category,vehicle_label)), profiles:customer_id(full_name,email)").eq("workshop_id", myWorkshop.id).order("created_at", { ascending: false }).limit(300);
    if (st && st !== "no_show") q = q.eq("status", st);
    if (from) q = q.gte("created_at", from);
    const { data } = await q;
    arRows = (data || []).filter(b => (!cat || CATS[b.offers?.requests?.category]?.name === cat) && (st !== "no_show" || b.no_show));
    box.innerHTML = arRows.length === 0 ? '<div class="empty"><div class="e">${ico("chat",40)}</div>Keine Einträge.</div>'
      : `<div class="tblWrap"><table class="tbl"><thead><tr><th>Buchung</th><th>Kunde</th><th>Betrag</th><th>Status</th><th>Zahlung</th><th>Datum</th></tr></thead><tbody>
        ${arRows.map(b => `<tr>
          <td><b>${esc(b.booking_no || "")}</b><div class="mm">${esc(b.offers?.requests?.title || "")}</div></td>
          <td class="mm">${esc(b.profiles?.full_name || b.profiles?.email || "")}</td>
          <td>${fmtEur(b.total_price)}</td>
          <td><span class="badge ${BK_STATUS[b.status]?.[1] || "b-grey"}">${BK_STATUS[b.status]?.[0] || b.status}</span>${b.no_show ? ' <span class="badge b-red">No-Show</span>' : ""}</td>
          <td class="mm">${(PAY_LABELS[b.payment_status] || PAY_LABELS.none)[0]}</td>
          <td class="mm">${fmtDate(b.created_at)}</td></tr>`).join("")}</tbody></table></div>`;
  }
}
function exportArchiveCsv() {
  if (!arRows.length) return toast("Nichts zu exportieren.");
  let rows;
  if (arSeg === "angebote") {
    rows = [["Datum", "Anfrage", "Kategorie", "Fahrzeug", "Betrag", "Status"]]
      .concat(arRows.map(o => [fmtDate(o.created_at), o.requests?.title || "", CATS[o.requests?.category]?.name || "", o.requests?.vehicle_label || "", String(o.total_price).replace(".", ","), o.status]));
  } else {
    rows = [["Datum", "Buchung", "Auftrag", "Kunde", "Betrag", "Status", "Zahlung"]]
      .concat(arRows.map(b => [fmtDate(b.created_at), b.booking_no || "", b.offers?.requests?.title || "", b.profiles?.full_name || b.profiles?.email || "", String(b.total_price).replace(".", ","), b.status, b.payment_status]));
  }
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = `carfixo-${arSeg}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  toast("CSV exportiert ⬇");
}

// ============================================================
// MELDESYSTEM
// ============================================================
const REPORT_REASONS = ["Betrug / unseriöses Verhalten", "Beleidigung", "Falsche Angaben", "Kunde nicht erschienen", "Werkstatt nicht erschienen", "Falsche Rechnung", "Unangemessene Bilder", "Fake-Bewertung", "Datenschutzproblem", "Sonstiges"];
function openReportModal(targetType, targetId, workshopId, label) {
  if (!requireAuth()) return;
  openModal(`
    <h2 style="font-size:19px;font-weight:800">Melden: ${esc(label || targetType)}</h2>
    <p class="mm" style="margin-top:6px">Deine Meldung wird vom Carfixo-Team geprüft. Missbrauch des Meldesystems kann zur Sperrung führen.</p>
    <div class="label">Grund *</div>
    <select id="rpReason">${REPORT_REASONS.map(x => `<option>${x}</option>`).join("")}</select>
    <div class="label">Beschreibung</div>
    <textarea id="rpDesc" placeholder="Was ist passiert? Je genauer, desto besser können wir helfen."></textarea>
    <div class="btnRow">
      <button class="btn red" id="rpGo">Meldung absenden</button>
      <button class="btn ghost" onclick="closeModal()">Abbrechen</button>
    </div>
    <div class="err" id="rpErr"></div>`);
  $("rpGo").onclick = async () => {
    $("rpGo").disabled = true;
    const { error } = await sb.from("reports").insert({
      reporter_id: me.id, target_type: targetType, target_id: targetId || null,
      workshop_id: workshopId || null, reason: $("rpReason").value,
      description: $("rpDesc").value.trim() || null,
    });
    if (error) { $("rpGo").disabled = false; return showErr($("rpErr"), error.message); }
    closeModal(); toast("Meldung gesendet – danke für den Hinweis.");
  };
}

// ============================================================
// ONBOARDING-TOUREN
// ============================================================
const TOURS = {
  customer: [
    ["", "Fahrzeug anlegen", "Lege zuerst dein Fahrzeug in der Garage an – Marke, Modell, Baureihe. Jede Anfrage gehört zu genau einem Fahrzeug.", "vehicles"],
    ["", "Diagnose oder Suche", "Nicht sicher, was dein Auto hat? Nutze die Diagnose. Oder finde Werkstätten direkt über die Suche mit Umkreis und Filtern.", "diagnose"],
    ["", "Anfrage erstellen", "Erstelle eine Ausschreibung für alle passenden Betriebe – oder stelle eine Direktanfrage an eine Wunsch-Werkstatt.", "new-request"],
    ["", "Angebote vergleichen", "Betriebe senden dir Angebote mit Einzelpositionen. Vergleiche Preis, Bewertung und Termin – und stelle Rückfragen im Chat.", "requests"],
    ["", "Termin buchen", "Nimm das beste Angebot an – als kostenlose Testbuchung. Der Termin wird mit der Werkstatt bestätigt.", null],
    ["", "Status verfolgen", "Verfolge deinen Auftrag live: von Fahrzeug angenommen über Reparatur läuft bis Abholbereit – inklusive Zusatzfreigaben.", null],
    ["", "Bewerten", "Nach Abschluss bewertest du den Betrieb – das hilft anderen Autofahrern.", null],
  ],
  workshop: [
    ["", "Profil einrichten", "Vervollständige dein Betriebsprofil: Adresse mit Karten-Pin, Beschreibung, Öffnungszeiten und Bilder.", "ws/profile"],
    ["", "Leistungen wählen", "Wähle Kategorien, Detail-Leistungen und Marken-Spezialisierungen – danach filtern Kunden.", "ws/profile"],
    ["", "Verfügbarkeit pflegen", "Trage Kapazitäten und deinen nächsten freien Termin ein – Kunden sehen deine Verfügbarkeit.", "ws/profile"],
    ["", "Anfragen erhalten", "Nach der Verifizierung siehst du passende Ausschreibungen und Direktanfragen in Echtzeit.", "ws/leads"],
    ["", "Angebote kalkulieren", "Kalkuliere transparent: Arbeitszeit × Stundensatz, Teile mit Garantie, Festpreis oder Schätzung. Speichere Vorlagen.", null],
    ["", "Aufträge verwalten", "Pflege den Auftragsstatus, setze Termine im Kalender und fordere Zusatzfreigaben mit Fotos an.", "ws/jobs"],
    ["", "Statistiken ansehen", "Sieh deine Angebots- und Annahmequote und optimiere dein Profil.", "ws/stats"],
  ],
};
let tourStep = 0, tourKind = "customer";
function startTour(kind) {
  tourKind = kind; tourStep = 0;
  renderTourStep();
}
function renderTourStep() {
  const steps = TOURS[tourKind];
  const [icon, title, text] = steps[tourStep];
  openModal(`
    <div style="text-align:center">
      <div style="font-size:44px">${icon}</div>
      <div class="mm" style="margin-top:8px">Schritt ${tourStep + 1} von ${steps.length}</div>
      <h2 style="font-size:21px;font-weight:800;margin-top:6px">${esc(title)}</h2>
      <p class="mm" style="margin-top:10px;font-size:13.5px">${esc(text)}</p>
      <div style="display:flex;gap:6px;justify-content:center;margin-top:16px">
        ${steps.map((_, i) => `<div style="width:8px;height:8px;border-radius:50%;background:${i === tourStep ? "var(--blue)" : "rgba(255,255,255,.15)"}"></div>`).join("")}
      </div>
      <div class="btnRow" style="justify-content:center">
        ${tourStep > 0 ? '<button class="btn ghost sm" id="tourPrev">← Zurück</button>' : ""}
        <button class="btn sm" id="tourNext">${tourStep === steps.length - 1 ? "Los geht's! " : "Weiter →"}</button>
        <button class="btn ghost sm" id="tourSkip">Überspringen</button>
      </div>
    </div>`);
  const done = () => { localStorage.setItem("cfx_tour_" + tourKind, "done"); closeModal(); };
  $("tourNext").onclick = () => { if (tourStep >= TOURS[tourKind].length - 1) done(); else { tourStep++; renderTourStep(); } };
  $("tourSkip").onclick = done;
  const prev = $("tourPrev");
  if (prev) prev.onclick = () => { tourStep--; renderTourStep(); };
}
function maybeStartTour() {
  if (!me || !myProfile) return;
  const kind = myWorkshop ? "workshop" : myProfile.role === "customer" ? "customer" : null;
  if (kind && !localStorage.getItem("cfx_tour_" + kind)) setTimeout(() => startTour(kind), 600);
}

// ============================================================
// DATEN EXPORTIEREN / KONTO LÖSCHEN
// ============================================================
async function exportMyData() {
  toast("Export wird erstellt…");
  const [profile, vehicles, requests, offers, bookings, reviews, reminders, favorites, messages] = await Promise.all([
    sb.from("profiles").select("*").eq("id", me.id).maybeSingle(),
    sb.from("vehicles").select("*").eq("owner_id", me.id),
    sb.from("requests").select("*").eq("customer_id", me.id),
    myWorkshop ? sb.from("offers").select("*").eq("workshop_id", myWorkshop.id) : { data: [] },
    sb.from("bookings").select("*"),
    sb.from("reviews").select("*").eq("customer_id", me.id),
    sb.from("reminders").select("*").eq("user_id", me.id),
    sb.from("favorites").select("*").eq("user_id", me.id),
    sb.from("messages").select("*").eq("sender_id", me.id),
  ]);
  const dump = {
    exported_at: new Date().toISOString(), account: me.email,
    profile: profile.data, workshop: myWorkshop || null,
    vehicles: vehicles.data, requests: requests.data, offers: offers.data,
    bookings: bookings.data, reviews: reviews.data, reminders: reminders.data,
    favorites: favorites.data, messages: messages.data,
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" }));
  a.download = `carfixo-datenexport-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  toast("Datenexport heruntergeladen ⬇");
}
function confirmDeleteAccount() {
  openModal(`
    <h2 style="font-size:19px;font-weight:800">Konto löschen</h2>
    <div class="warn" style="margin-top:10px">Dein Konto und alle zugehörigen Daten (Fahrzeuge, Anfragen, Chats${myWorkshop ? ", dein Betriebsprofil" : ""}) werden <b>unwiderruflich gelöscht</b>.</div>
    <p class="mm">Tippe zur Bestätigung <b>LÖSCHEN</b>:</p>
    <input id="delConfirm" placeholder="LÖSCHEN" style="margin-top:8px">
    <div class="btnRow">
      <button class="btn red" id="delGo">Konto endgültig löschen</button>
      <button class="btn ghost" onclick="closeModal()">Abbrechen</button>
    </div>`);
  $("delGo").onclick = async () => {
    if ($("delConfirm").value.trim() !== "LÖSCHEN") return toast("Bitte LÖSCHEN eintippen.");
    $("delGo").disabled = true;
    const { error } = await sb.rpc("delete_own_account");
    if (error) { $("delGo").disabled = false; return toast(error.message); }
    await sb.auth.signOut();
    closeModal();
    me = null; myProfile = null; myWorkshop = null;
    toast("Konto gelöscht. Alles Gute!");
    go("search");
  };
}

// ============================================================
// WEB-PUSH (Geräte-Anmeldung für Benachrichtigungen)
// ============================================================
// Serverseitig ist alles vorhanden (VAPID-Schlüssel, Versand über
// notify-dispatch). Hier fehlte bisher nur die Anmeldung des Geräts.
const pushSupported = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// ---------- Installation als App (Voraussetzung für Push auf dem iPhone) ----------
// Apple erlaubt Web-Push ausschliesslich in installierten PWAs. In Safari selbst
// existiert PushManager nicht – das laesst sich technisch nicht umgehen. Statt
// die Nutzer damit alleinzulassen, fuehren wir sie aktiv durch die Installation.
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);   // iPad ab iPadOS 13

// Android/Chrome liefern ein Ereignis, mit dem sich die Installation direkt
// anstossen laesst. Es feuert einmalig und muss dafuer aufgehoben werden.
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstall = e;
  renderInstallBanner();
});
window.addEventListener("appinstalled", () => {
  deferredInstall = null;
  $("installBanner")?.remove();
  toast("Carfixo wurde installiert ✓ – jetzt kannst du Push aktivieren.");
});

function installState() {
  if (isStandalone()) return "installiert";
  if (deferredInstall) return "installierbar";      // Android/Chrome/Edge
  if (isIOS()) return "ios_manuell";                // nur ueber das Teilen-Menue
  return "nicht_noetig";                            // Desktop: Push geht auch so
}

const IOS_SCHRITTE = [
  "Unten in der Mitte auf <b>Teilen</b> tippen (Quadrat mit Pfeil nach oben)",
  "Nach unten scrollen zu <b>„Zum Home-Bildschirm“</b>",
  "Auf <b>Hinzufügen</b> tippen",
  "Carfixo vom Home-Bildschirm öffnen – <b>nicht mehr über Safari</b>",
];

// Dezenter Hinweis unten. Erscheint nur, wenn Installation etwas bringt,
// und laesst sich dauerhaft wegklicken.
function renderInstallBanner() {
  if (NATIVE || document.getElementById("installBanner")) return;
  if (localStorage.getItem("cfx_install_hidden")) return;
  const st = installState();
  if (st === "installiert" || st === "nicht_noetig") return;
  if (!pushSupported() && st !== "ios_manuell") return;

  const el = document.createElement("div");
  el.id = "installBanner";
  el.className = "installBanner";
  el.innerHTML = `
    <div class="ib-ico">${ico("bell", 20)}</div>
    <div style="flex:1;min-width:0">
      <div class="ib-t">Carfixo als App installieren</div>
      <div class="ib-m">${st === "ios_manuell"
        ? "Auf dem iPhone nur so möglich – danach bekommst du Angebote sofort als Mitteilung."
        : "Ein Tippen – danach bekommst du neue Angebote sofort als Mitteilung."}</div>
    </div>
    <button class="btn sm" id="ibGo">${st === "ios_manuell" ? "Anleitung" : "Installieren"}</button>
    <button class="btn ghost sm" id="ibNo" aria-label="Hinweis ausblenden">✕</button>`;
  document.body.appendChild(el);

  $("ibNo").onclick = () => { localStorage.setItem("cfx_install_hidden", "1"); el.remove(); };
  $("ibGo").onclick = async () => {
    if (st === "installierbar" && deferredInstall) {
      deferredInstall.prompt();
      const { outcome } = await deferredInstall.userChoice;
      deferredInstall = null;
      if (outcome === "accepted") el.remove();
    } else {
      openInstallHelp();
    }
  };
}

function openInstallHelp() {
  openModal(`
    <h2 style="font-size:20px;font-weight:800">Carfixo aufs iPhone holen</h2>
    <p class="mm" style="margin-top:8px">
      Mitteilungen über neue Angebote und Nachrichten erlaubt Apple nur, wenn Carfixo
      als App installiert ist. Das dauert zehn Sekunden:</p>
    <ol style="margin:14px 0 0 18px;padding:0">
      ${IOS_SCHRITTE.map(s => `<li class="mm" style="font-size:13px;line-height:1.7;margin-bottom:6px">${s}</li>`).join("")}
    </ol>
    <div class="note" style="margin-top:14px">Bis dahin bekommst du alles Wichtige weiterhin per <b>E-Mail</b> – du verpasst also kein Angebot.</div>
    <div class="btnRow"><button class="btn" onclick="closeModal()">Alles klar</button></div>`);
}

// VAPID-Schlüssel liegt base64url-kodiert vor, subscribe() erwartet Bytes.
function vapidToBytes(base64url) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function pushRegistration() {
  if (!pushSupported()) return null;
  return navigator.serviceWorker.register("/sw.js");
}

// Aktueller Zustand für die Anzeige im Konto
async function pushStatus() {
  // In der iPhone-App gibt es keinen Web-Push; Mitteilungen kommen dort über
  // Apple (APNs) – bis das angebunden ist, ehrlich sagen, was gilt.
  if (NATIVE) return "app_bald";
  // Auf dem iPhone fehlt PushManager, solange die App nicht installiert ist.
  // Das ist kein Defekt, sondern eine Vorbedingung – entsprechend benannt.
  if (!pushSupported()) return isIOS() && !isStandalone() ? "installation_noetig" : "nicht_unterstuetzt";
  if (Notification.permission === "denied") return "blockiert";
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = reg && await reg.pushManager.getSubscription();
  return sub ? "aktiv" : "inaktiv";
}

async function enablePush() {
  if (!pushSupported()) return toast("Dieses Gerät unterstützt keine Push-Benachrichtigungen.");
  if (!me) return requireAuth();

  const erlaubnis = await Notification.requestPermission();
  if (erlaubnis !== "granted") {
    return toast(erlaubnis === "denied"
      ? "Benachrichtigungen sind im Browser blockiert – bitte in den Seiteneinstellungen erlauben."
      : "Ohne Erlaubnis können keine Benachrichtigungen gesendet werden.");
  }
  try {
    const reg = await pushRegistration();
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,   // von Chrome vorausgesetzt
        applicationServerKey: vapidToBytes(CARFIXO.VAPID_PUBLIC_KEY),
      });
    }
    const j = sub.toJSON();
    // endpoint ist eindeutig – ein erneutes Anmelden desselben Geräts
    // aktualisiert den Eintrag, statt ihn zu verdoppeln.
    const { error } = await sb.from("push_subscriptions").upsert({
      user_id: me.id,
      endpoint: j.endpoint,
      p256dh: j.keys.p256dh,
      auth: j.keys.auth,
      ua: navigator.userAgent.slice(0, 200),
    }, { onConflict: "endpoint" });
    if (error) throw error;
    toast("Push aktiviert ✓ – dieses Gerät erhält jetzt Benachrichtigungen.");
  } catch (e) {
    toast("Push konnte nicht aktiviert werden: " + (e.message || e));
  }
  if ($("pushBox")) renderPushBox();
}

async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = reg && await reg.pushManager.getSubscription();
    if (sub) {
      await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    toast("Push auf diesem Gerät deaktiviert.");
  } catch (e) {
    toast(e.message || String(e));
  }
  if ($("pushBox")) renderPushBox();
}

async function renderPushBox() {
  const box = $("pushBox"); if (!box) return;
  const st = await pushStatus();
  const texte = {
    aktiv: ["Dieses Gerät erhält Push-Benachrichtigungen.", "Auf diesem Gerät deaktivieren", "b-green", "Aktiv"],
    inaktiv: ["Erhalte neue Angebote, Nachrichten und Termine sofort – auch wenn Carfixo geschlossen ist.", "Auf diesem Gerät aktivieren", "b-grey", "Inaktiv"],
    blockiert: ["Benachrichtigungen sind für Carfixo im Browser blockiert. Das lässt sich nur in den Einstellungen deines Browsers wieder erlauben.", null, "b-red", "Blockiert"],
    installation_noetig: ["Apple erlaubt Mitteilungen nur, wenn Carfixo als App installiert ist. Das dauert zehn Sekunden – danach bekommst du neue Angebote sofort aufs Gerät.", "So geht's", "b-gold", "Installation nötig"],
    app_bald: ["Mitteilungen in der App kommen mit dem nächsten Update. Bis dahin bekommst du alles Wichtige per E-Mail.", null, "b-grey", "Bald verfügbar"],
    nicht_unterstuetzt: ["Dieser Browser unterstützt keine Mitteilungen. Du bekommst weiterhin alles per E-Mail.", null, "b-grey", "Nicht verfügbar"],
  }[st];
  box.innerHTML = `
    <div class="tt">Push auf diesem Gerät <span class="badge ${texte[2]}">${texte[3]}</span></div>
    <p class="mm" style="margin-top:6px">${esc(texte[0])}</p>
    ${st === "installation_noetig" ? `<ol style="margin:10px 0 0 18px;padding:0">
      ${IOS_SCHRITTE.map(s => `<li class="mm" style="font-size:12px;line-height:1.65;margin-bottom:4px">${s}</li>`).join("")}
    </ol>` : ""}
    ${texte[1] ? `<button class="btn ghost sm" style="margin-top:12px" id="pushToggle">${texte[1]}</button>` : ""}`;
  const btn = $("pushToggle");
  if (btn) btn.onclick = () => {
    if (st === "installation_noetig") return openInstallHelp();
    return st === "aktiv" ? disablePush() : enablePush();
  };
}

// ============================================================
// BENACHRICHTIGUNGEN (Glocke in der Topbar)
// ============================================================
const NOTIF_ICONS = {
  offer: "euro", message: "chat", booking: "calendar", approval: "alert",
  lead: "megaphone", part_order: "puzzle", review: "star", reminder: "bell",
};
let notifItems = [], notifChannel = null, notifOpen = false;

function relTime(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
  if (s < 60) return "gerade eben";
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std.`;
  if (s < 604800) return `vor ${Math.floor(s / 86400)} Tg.`;
  return fmtDate(iso);
}

// Der Kanal muss den Routenwechsel überleben, darf also nicht in rtChannels
// landen – cleanRT() räumt die bei jedem Seitenwechsel ab.
async function initNotifications() {
  const wrap = $("bellWrap");
  if (!wrap) return;
  if (!me) { wrap.classList.add("hidden"); return; }
  wrap.classList.remove("hidden");
  $("bellBtn").innerHTML = ico("bell", 17);
  $("bellBtn").onclick = (e) => { e.stopPropagation(); toggleNotifPanel(); };
  await loadNotifications();
  if (!notifChannel) {
    notifChannel = sb.channel("notif:" + me.id)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: "user_id=eq." + me.id },
        () => loadNotifications())
      .subscribe();
  }
}
function stopNotifications() {
  if (notifChannel) { try { sb.removeChannel(notifChannel); } catch (e) {} notifChannel = null; }
  notifItems = []; notifOpen = false;
  const w = $("bellWrap"); if (w) w.classList.add("hidden");
  const p = $("notifPanel"); if (p) p.classList.add("hidden");
}
async function loadNotifications() {
  if (!me) return;
  const { data, error } = await sb.from("notifications")
    .select("*").order("created_at", { ascending: false }).limit(30);
  if (error) return;
  notifItems = data || [];
  const unread = notifItems.filter(n => !n.read_at).length;
  const dot = $("bellDot");
  if (dot) {
    dot.textContent = unread > 9 ? "9+" : String(unread);
    dot.classList.toggle("hidden", unread === 0);
  }
  if (notifOpen) renderNotifPanel();
}
function toggleNotifPanel() {
  notifOpen = !notifOpen;
  $("bellBtn").setAttribute("aria-expanded", String(notifOpen));
  $("notifPanel").classList.toggle("hidden", !notifOpen);
  if (notifOpen) renderNotifPanel();
}
function renderNotifPanel() {
  const box = $("notifPanel"); if (!box) return;
  const unread = notifItems.filter(n => !n.read_at).length;
  box.innerHTML = `
    <div class="notifHead">
      <b>Benachrichtigungen${unread ? ` (${unread} neu)` : ""}</b>
      ${unread ? `<button class="btn ghost sm" data-act="readall">Alle gelesen</button>` : ""}
    </div>
    ${notifItems.length === 0
      ? `<div class="empty" style="padding:26px 14px"><div class="e">${ico("bell", 34)}</div>
         Noch keine Benachrichtigungen.<br><span class="mm">Neue Angebote, Nachrichten und Termine erscheinen hier.</span></div>`
      : notifItems.map(n => `
        <button class="notifItem ${n.read_at ? "" : "unread"}" data-id="${esc(n.id)}" data-link="${esc(n.link || "")}">
          <span class="ni">${ico(NOTIF_ICONS[n.type] || "bell", 16)}</span>
          <span style="flex:1;min-width:0">
            <span class="nt" style="display:block">${esc(n.title)}</span>
            ${n.body ? `<span class="nb" style="display:block">${esc(n.body)}</span>` : ""}
            <span class="nd" style="display:block">${relTime(n.created_at)}</span>
          </span>
        </button>`).join("")}`;
}
// Klicks über Delegation – so landen Titel/Links nie in einem inline-Handler.
document.addEventListener("click", async (e) => {
  const panel = $("notifPanel");
  if (!panel) return;
  const item = e.target.closest?.(".notifItem");
  const readAll = e.target.closest?.('[data-act="readall"]');

  if (readAll) {
    await sb.rpc("mark_all_notifications_read");
    await loadNotifications();
    renderNotifPanel();
    return;
  }
  if (item) {
    const id = item.dataset.id, link = item.dataset.link;
    const n = notifItems.find(x => x.id === id);
    if (n && !n.read_at) {
      n.read_at = new Date().toISOString();
      sb.from("notifications").update({ read_at: n.read_at }).eq("id", id).then(() => loadNotifications());
    }
    notifOpen = false;
    panel.classList.add("hidden");
    if (link) go(String(link).replace(/^[#/]+/, ""));
    return;
  }
  // Klick ausserhalb schliesst das Panel
  if (notifOpen && !e.target.closest?.("#bellWrap")) {
    notifOpen = false;
    panel.classList.add("hidden");
    $("bellBtn")?.setAttribute("aria-expanded", "false");
  }
});

// ============================================================
// FESTPREIS-TERMINE
// Betriebe pflegen Festpreise (Ölwechsel, Reifenwechsel, HU …), Kunden
// buchen direkt einen freien Termin – ohne Ausschreibung und Warten.
// Freie Termine liefert free_slots() (stündlich innerhalb der Öffnungszeiten,
// Kapazität je Zeitfenster), gebucht wird transaktional über book_fixed_price().
// ============================================================
const FEST_VORSCHLAEGE = [
  ["inspektion", "Ölwechsel", 89], ["reifen", "Reifenwechsel", 39], ["tuev", "HU + AU", 139],
  ["inspektion", "Kleine Inspektion", 189], ["klima", "Klimaservice", 99], ["pflege", "Außenwäsche", 29],
];
const istTester = () => /@carfixo-test\.de$/i.test(me?.email || "");

// ---------- Betrieb: Festpreise pflegen (Reiter im Betriebsprofil) ----------
async function ladeFestpreiseWs() {
  const box = $("fpList"); if (!box) return;
  const { data } = await sb.from("fixed_price_services").select("*").eq("workshop_id", myWorkshop.id).order("created_at");
  if (!$("fpList")) return;
  box.innerHTML = (data || []).length ? data.map(f => `
    <div class="fpRow">
      <div style="flex:1;min-width:0"><b>${esc(f.service)}</b>
        <div class="mm">${CATS[f.category]?.name || esc(f.category)} · ${f.duration_min} Min.${f.note ? " · " + esc(f.note) : ""}</div></div>
      <b class="fpPrice">${fmtEur(f.price)}</b>
      <label class="inline" style="margin:0" title="Online buchbar"><input type="checkbox" ${f.active ? "checked" : ""} onchange="festpreisAktiv('${f.id}', this.checked)"> aktiv</label>
      <button class="btn ghost sm" onclick="festpreisLoeschen('${f.id}')" aria-label="Löschen">${ico("trash", 16)}</button>
    </div>`).join("")
    : `<p class="mm">Noch keine Festpreise. Lege die Leistungen an, die Kunden ohne Rückfrage buchen können – das sind meist die häufigsten.</p>`;
}
async function festpreisAktiv(id, an) {
  const { error } = await sb.from("fixed_price_services").update({ active: an }).eq("id", id);
  if (error) return toast(error.message);
  toast(an ? "Online buchbar ✓" : "Pausiert.");
}
async function festpreisLoeschen(id) {
  if (!(await frage("Diesen Festpreis entfernen? Bestehende Buchungen bleiben erhalten.", { ja: "Entfernen", gefahr: true }))) return;
  const { error } = await sb.from("fixed_price_services").delete().eq("id", id);
  if (error) return toast(error.message);
  ladeFestpreiseWs();
}
function festpreisFormBinden() {
  const cats = myWorkshop.categories?.length ? myWorkshop.categories : Object.keys(CATS);
  $("fpVorschlag").innerHTML = FEST_VORSCHLAEGE.filter(([c]) => cats.includes(c)).map(([c, s, p]) =>
    `<span class="chip" data-c="${c}" data-s="${esc(s)}" data-p="${p}">${esc(s)}</span>`).join("");
  document.querySelectorAll("#fpVorschlag .chip").forEach(ch => ch.onclick = () => {
    $("fpCat").value = ch.dataset.c; $("fpService").value = ch.dataset.s; $("fpPrice").value = ch.dataset.p;
  });
  $("fpAdd").onclick = async () => {
    const service = $("fpService").value.trim(), price = Number(String($("fpPrice").value).replace(",", "."));
    if (service.length < 2) return toast("Bitte eine Leistung angeben.");
    if (!(price > 0 && price < 10000)) return toast("Bitte einen Preis zwischen 1 und 9.999 € angeben.");
    const { error } = await sb.from("fixed_price_services").insert({
      workshop_id: myWorkshop.id, category: $("fpCat").value, service, price,
      duration_min: +$("fpDur").value, note: $("fpNote").value.trim() || null,
    });
    if (error) return toast(String(error.message).includes("duplicate") ? "Diese Leistung hast du schon angelegt." : error.message);
    $("fpService").value = ""; $("fpPrice").value = ""; $("fpNote").value = "";
    toast("Festpreis angelegt ✓");
    ladeFestpreiseWs();
  };
  $("fpCap").onchange = async () => {
    const n = +$("fpCap").value;
    const { error } = await sb.from("workshops").update({ slot_capacity: n }).eq("id", myWorkshop.id);
    if (error) return toast(error.message);
    myWorkshop.slot_capacity = n;
    toast("Gespeichert ✓");
  };
  ladeFestpreiseWs();
}
function festpreisPaneHtml(w) {
  const cats = w.categories?.length ? w.categories : Object.keys(CATS);
  return `<div class="card pCard" data-tab="fest">
    <div class="tt">Festpreise & Online-Termine</div>
    <p class="mm" style="margin-top:4px">Kunden buchen diese Leistungen direkt mit Termin – freie Zeiten ergeben sich aus deinen Öffnungszeiten.
      ${w.is_verified ? "" : "<b>Sichtbar, sobald dein Betrieb verifiziert ist.</b>"}</p>
    <div id="fpList" style="margin-top:10px"><div class="sk" style="height:40px"></div></div>
    <div class="label">Neuer Festpreis</div>
    <div class="chips" id="fpVorschlag" style="margin-bottom:8px"></div>
    <div class="split">
      <select id="fpCat">${cats.map(c => `<option value="${c}">${esc(CATS[c]?.name || c)}</option>`).join("")}</select>
      <input id="fpService" placeholder="Leistung, z. B. Ölwechsel" maxlength="80">
    </div>
    <div class="split" style="margin-top:8px">
      <input id="fpPrice" inputmode="decimal" placeholder="Preis in € (inkl. MwSt.)">
      <select id="fpDur">${[30, 60, 90, 120, 180, 240].map(m => `<option value="${m}" ${m === 60 ? "selected" : ""}>${m} Min.</option>`).join("")}</select>
    </div>
    <input id="fpNote" style="margin-top:8px" maxlength="200" placeholder="Hinweis (optional), z. B. inkl. 5 l Markenöl">
    <button class="btn sm" id="fpAdd" style="margin-top:10px">Festpreis anlegen</button>
    <div class="label">Fahrzeuge pro Zeitfenster</div>
    <select id="fpCap" style="max-width:220px">${[1, 2, 3, 4, 5, 6, 8, 10].map(n => `<option value="${n}" ${n === (w.slot_capacity || 1) ? "selected" : ""}>${n} gleichzeitig</option>`).join("")}</select>
  </div>`;
}

// ---------- Kunde: Festpreise auf dem Werkstattprofil ----------
async function ladeFestpreiseProfil(ws) {
  const box = $("fpBox"); if (!box) return;
  const { data } = await sb.from("fixed_price_services").select("*").eq("workshop_id", ws.id).eq("active", true).order("price");
  if (!$("fpBox") || !(data || []).length) return;
  const buchbar = !ws.is_demo || istTester();
  box.hidden = false;
  box.innerHTML = `<div class="tt">Sofort buchen · Festpreis</div>
    <p class="mm" style="margin-top:2px">Termin wählen, fertig – ohne Angebot abwarten.</p>
    ${data.map(f => `<button class="fpBook" type="button" data-id="${f.id}" ${buchbar ? "" : "disabled"}>
      <span class="fpIco">${ico(f.category, 20)}</span>
      <span style="flex:1;min-width:0;text-align:left"><b>${esc(f.service)}</b><span class="mm">${f.duration_min} Min.${f.note ? " · " + esc(f.note) : ""}</span></span>
      <b class="fpPrice">${fmtEur(f.price)}</b>${ico("chev", 16)}</button>`).join("")}`;
  box.querySelectorAll(".fpBook").forEach(b => b.onclick = () => {
    if (!requireAuth()) return;
    if (myWorkshop) return toast("Als Betrieb kannst du keine Termine buchen.");
    oeffneTerminwahl(data.find(f => f.id === b.dataset.id), ws);
  });
}

async function oeffneTerminwahl(f, ws) {
  openModal(`<h2>${esc(f.service)} · ${fmtEur(f.price)}</h2>
    <p class="mm">${esc(ws.name)} · Festpreis inkl. MwSt.</p>
    <div id="twBody" style="margin-top:12px"><div class="sk" style="height:120px"></div></div>`);
  const [{ data: slots, error }, { data: cars }] = await Promise.all([
    sb.rpc("free_slots", { p_service: f.id, p_days: 14 }),
    sb.from("vehicles").select("id,make,model,license_plate").eq("owner_id", me.id).order("created_at"),
  ]);
  const body = $("twBody"); if (!body) return;
  if (error) { body.innerHTML = `<div class="warn">${esc(error.message)}</div>`; return; }
  const liste = (slots || []).map(s => typeof s === "string" ? s : s.free_slots).filter(Boolean);
  if (!liste.length) { body.innerHTML = `<div class="note">In den nächsten zwei Wochen ist leider nichts frei. Stell gern eine <a href="#/new-request?ws=${ws.id}" style="color:var(--blue2)" onclick="closeModal()">Anfrage</a>.</div>`; return; }
  // nach Tag gruppieren
  const tage = new Map();
  for (const s of liste) {
    const d = new Date(s); const k = d.toDateString();
    if (!tage.has(k)) tage.set(k, []); tage.get(k).push(s);
  }
  let tag = [...tage.keys()][0], wahl = null;
  const tagLabel = (k) => { const d = new Date(k); const heute = new Date().toDateString(), morgen = new Date(Date.now() + 864e5).toDateString();
    return k === heute ? "Heute" : k === morgen ? "Morgen" : d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }); };
  const zeichne = () => {
    body.innerHTML = `
      <div class="label" style="margin-top:0">Tag</div>
      <div class="dayRail">${[...tage.keys()].map(k => `<button type="button" class="dayBtn ${k === tag ? "on" : ""}" data-k="${k}">${tagLabel(k)}</button>`).join("")}</div>
      <div class="label">Uhrzeit</div>
      <div class="slotGrid">${tage.get(tag).map(s => `<button type="button" class="slotBtn ${s === wahl ? "on" : ""}" data-s="${s}">${new Date(s).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</button>`).join("")}</div>
      ${(cars || []).length ? `<div class="label">Fahrzeug</div><select id="twCar">${cars.map(c => `<option value="${c.id}">${esc(c.make + " " + c.model)}${c.license_plate ? " · " + esc(c.license_plate) : ""}</option>`).join("")}</select>` : ""}
      <div class="label">Hinweis für den Betrieb (optional)</div>
      <input id="twNote" maxlength="300" placeholder="z. B. Bitte auch Scheibenwischer prüfen">
      <div class="err" id="twErr"></div>
      <button class="btn wide" id="twGo" style="margin-top:14px" ${wahl ? "" : "disabled"}>${wahl ? `Verbindlich buchen · ${new Date(wahl).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "Uhrzeit wählen"}</button>
      <p class="mm" style="font-size:11px;margin-top:8px">Der Vertrag kommt mit dem Betrieb zustande. ${esc(STORNO_HINWEIS)}</p>`;
    body.querySelectorAll(".dayBtn").forEach(b => b.onclick = () => { tag = b.dataset.k; wahl = null; zeichne(); });
    body.querySelectorAll(".slotBtn").forEach(b => b.onclick = () => { wahl = b.dataset.s; zeichne(); });
    if (wahl) $("twGo").onclick = async () => {
      $("twGo").disabled = true;
      const { data: res, error: e2 } = await sb.rpc("book_fixed_price", {
        p_service: f.id, p_slot: wahl, p_vehicle: $("twCar")?.value || null, p_note: $("twNote").value.trim() || null,
      });
      if (e2) { $("twGo").disabled = false; return showErr($("twErr"), e2.message); }
      closeModal();
      toast("Termin gebucht ✓");
      go("request/" + res.request_id);
    };
  };
  zeichne();
}

// ---------- Home: Festpreise in der Nähe ----------
async function hmFestpreise() {
  const box = $("hmFest"); if (!box) return;
  const { data } = await sb.from("fixed_price_services")
    .select("id,service,price,category,workshop_id,workshops!inner(id,name,district,city,is_verified,is_demo)")
    .eq("active", true).eq("workshops.is_verified", true).order("price").limit(12);
  if (!$("hmFest")) return;
  const liste = (data || []).filter(f => !f.workshops.is_demo || istTester());
  if (!liste.length) return;
  box.innerHTML = `<div class="hmSec"><h2>Sofort buchen</h2><span class="mm">Festpreis · freie Termine</span></div>
    <div class="hmRail">${liste.map(f => `<a class="hmFp" href="#/workshop/${f.workshop_id}">
      <span class="fpIco">${ico(f.category, 20)}</span>
      <b>${esc(f.service)}</b>
      <span class="mm">${esc(f.workshops.name)}</span>
      <span class="hmFpPrice">${fmtEur(f.price)}</span></a>`).join("")}</div>`;
}

// ============================================================
// NATIVE-GEFÜHL
// Vibration, Ziehen zum Aktualisieren, Face ID, App-Sperre, Design-Wahl.
// Vibration und Face ID gibt es nur in der iPhone-App (assets/native.js
// stellt window.CarfixoNative bereit); im Browser passiert dort nichts.
// ============================================================
function haptic(kind = "light") { window.CarfixoNative?.haptic(kind); }

// Kurzes Antippen bei allem, was man drückt – wie in nativen Apps
document.addEventListener("click", (e) => {
  const t = e.target.closest?.(".tabbar a, .chip, .seg div, .hmTile, .hmQ, .slotBtn, .btn:not([disabled])");
  if (t) haptic(t.closest(".tabbar, .seg") ? "select" : "light");
}, true);

// ---------- Ziehen zum Aktualisieren (nur App-Ansicht) ----------
(function ziehenZumAktualisieren() {
  if (!APP_UI) return;
  const SCHWELLE = 70;
  const ind = document.createElement("div");
  ind.className = "ptr";
  ind.innerHTML = '<span class="ptrRing"></span>';
  document.body.appendChild(ind);
  let start = null, weg = 0, scharf = false, laeuft = false;
  const gesperrt = (el) => document.body.classList.contains("sheetOpen") || $("modalHost").innerHTML ||
    document.querySelector(".modal, #lockScreen") || el.closest?.(".mapWrap, .hmRail, .notifPanel, textarea, .maplibregl-map, .leaflet-container");
  window.addEventListener("touchstart", (e) => {
    if (laeuft || window.scrollY > 0 || e.touches.length !== 1 || gesperrt(e.target)) { start = null; return; }
    start = e.touches[0].clientY; weg = 0; scharf = false;
  }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (start == null) return;
    weg = Math.max(0, (e.touches[0].clientY - start) * 0.5);
    if (weg <= 0) return;
    ind.style.transform = `translate(-50%, ${Math.min(weg, 90)}px)`;
    ind.style.opacity = Math.min(1, weg / SCHWELLE);
    ind.firstChild.style.transform = `rotate(${weg * 4}deg)`;
    if (!scharf && weg >= SCHWELLE) { scharf = true; haptic("medium"); }
    if (scharf && weg < SCHWELLE) scharf = false;
  }, { passive: true });
  window.addEventListener("touchend", async () => {
    if (start == null) return;
    start = null;
    if (!scharf) { ind.style.transform = ""; ind.style.opacity = 0; return; }
    laeuft = true;
    ind.classList.add("spin");
    ind.style.transform = "translate(-50%, 56px)";
    try { await route(); } finally {
      ind.classList.remove("spin");
      ind.style.transform = ""; ind.style.opacity = 0;
      laeuft = false;
    }
  });
})();

// ---------- Face ID: schnell wieder anmelden ----------
// Zugangsdaten liegen im iOS-Schlüsselbund (nur nach Face ID lesbar),
// im Gerät gemerkt wird nur die E-Mail, damit der Knopf erscheinen kann.
const FACEID_KEY = "cfx_faceid";
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* privat */ } };

async function faceIdLoginKnopf() {
  const email = lsGet(FACEID_KEY);
  if (!NATIVE || !email || !window.CarfixoNative || !$("lGo")) return;
  const btn = document.createElement("button");
  btn.className = "btn wide faceBtn";
  btn.type = "button";
  btn.innerHTML = `${ico("user", 18)} Mit Face ID anmelden`;
  $("lGo").parentNode.insertBefore(btn, $("lGo"));
  $("lEmail").value = email;
  btn.onclick = async () => {
    if (!(await window.CarfixoNative.verify("Bei Carfixo anmelden"))) return;
    const z = await window.CarfixoNative.getLogin();
    if (!z) { lsSet(FACEID_KEY, null); btn.remove(); return toast("Face ID ist nicht mehr eingerichtet – bitte mit Passwort anmelden."); }
    btn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: z.email, password: z.password });
    btn.disabled = false;
    if (error) {
      // z. B. Passwort inzwischen geändert: alte Daten verwerfen
      await window.CarfixoNative.removeLogin(); lsSet(FACEID_KEY, null); btn.remove();
      return showErr($("lErr"), authFehler(error) + " Face ID wurde zurückgesetzt.");
    }
    await loadSession();
    toast("Angemeldet ✓");
    go(afterAuth(""));
  };
  btn.click();   // gleich anbieten, wie bei Banking-Apps
}

async function faceIdAnbieten(email, pass) {
  if (!NATIVE || !window.CarfixoNative || lsGet(FACEID_KEY) === email) return;
  if (lsGet("cfx_faceid_nein") === email || !(await window.CarfixoNative.biometryAvailable())) return;
  const ja = await frage("Beim nächsten Mal meldest du dich mit einem Blick an – ohne Passwort.",
    { titel: "Face ID verwenden?", ja: "Face ID aktivieren", nein: "Nicht jetzt" });
  if (!ja) return lsSet("cfx_faceid_nein", email);
  try { await window.CarfixoNative.saveLogin(email, pass); lsSet(FACEID_KEY, email); toast("Face ID aktiviert ✓"); }
  catch (e) { toast("Face ID konnte nicht eingerichtet werden."); }
}

// ---------- App-Sperre ----------
// Auf Wunsch verlangt die App beim Öffnen und nach einer Minute im
// Hintergrund Face ID (siehe native.js, appStateChange).
window.appLock = async function () {
  if (!NATIVE || !me || lsGet("cfx_applock") !== "1" || $("lockScreen") || !window.CarfixoNative) return;
  const d = document.createElement("div");
  d.id = "lockScreen";
  d.className = "lockScreen";
  d.innerHTML = `<div class="logo">car<b>fixo</b></div>
    <p class="mm">Carfixo ist gesperrt.</p>
    <button class="btn" id="lockGo" type="button">Mit Face ID entsperren</button>
    <button class="btn ghost sm" id="lockOut" type="button">Abmelden</button>`;
  document.body.appendChild(d);
  const entsperren = async () => {
    if (await window.CarfixoNative.verify("Carfixo entsperren")) { d.remove(); haptic("success"); }
  };
  $("lockGo").onclick = entsperren;
  $("lockOut").onclick = async () => { d.remove(); await signOut(); };
  entsperren();
};

// ---------- Design: Dunkel, Hell oder wie das System ----------
const THEME_KEY = "cfx_theme";
const systemHell = window.matchMedia ? matchMedia("(prefers-color-scheme: light)") : null;
function applyTheme() {
  const wahl = lsGet(THEME_KEY) || "dark";
  const hell = wahl === "light" || (wahl === "system" && !!systemHell?.matches);
  document.documentElement.dataset.theme = hell ? "light" : "dark";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", hell ? "#F3F5F9" : "#05070D");
  window.CarfixoNative?.statusBar?.(hell);
}
systemHell?.addEventListener?.("change", applyTheme);
applyTheme();

// Einstellungen im Konto: Design, Face ID, App-Sperre
function appEinstellungenHtml() {
  const wahl = lsGet(THEME_KEY) || "dark";
  return `<div class="card" style="margin-top:14px" id="appSettings">
    <div class="tt">Darstellung${NATIVE ? " & Sicherheit" : ""}</div>
    <div class="label">Design</div>
    <div class="seg" id="themeSeg" style="margin:4px 0 0">
      ${[["dark", "Dunkel"], ["light", "Hell"], ["system", "Wie System"]].map(([k, l]) => `<div data-t="${k}" class="${wahl === k ? "on" : ""}">${l}</div>`).join("")}
    </div>
    ${NATIVE ? `
    <label class="inline" style="margin-top:14px"><input type="checkbox" id="setFace" ${lsGet(FACEID_KEY) ? "checked" : ""}> Mit Face ID anmelden</label>
    <label class="inline"><input type="checkbox" id="setLock" ${lsGet("cfx_applock") === "1" ? "checked" : ""}> App mit Face ID sperren</label>
    <p class="mm" style="font-size:12px;margin-top:6px">Die Sperre greift beim Öffnen und wenn die App länger als eine Minute im Hintergrund war.</p>` : ""}
  </div>`;
}
function appEinstellungenBinden() {
  document.querySelectorAll("#themeSeg div").forEach(d => d.onclick = () => {
    document.querySelectorAll("#themeSeg div").forEach(x => x.classList.toggle("on", x === d));
    lsSet(THEME_KEY, d.dataset.t);
    applyTheme();
  });
  if ($("setFace")) $("setFace").onchange = async (e) => {
    if (e.target.checked) {
      e.target.checked = false;
      return toast("Melde dich einmal ab und mit Passwort wieder an – dann bietet Carfixo Face ID an.");
    }
    await window.CarfixoNative?.removeLogin(); lsSet(FACEID_KEY, null); lsSet("cfx_faceid_nein", null);
    toast("Face ID-Anmeldung ausgeschaltet.");
  };
  if ($("setLock")) $("setLock").onchange = async (e) => {
    if (e.target.checked && !(await window.CarfixoNative?.verify("App-Sperre einschalten"))) { e.target.checked = false; return; }
    lsSet("cfx_applock", e.target.checked ? "1" : null);
    toast(e.target.checked ? "App-Sperre an ✓" : "App-Sperre aus.");
  };
}

// ---------- Kalender und Route für einen Termin ----------
function terminLinks(titel, iso, ws, dauerMin = 60) {
  if (!iso) return "";
  const ort = [ws?.street, [ws?.zip, ws?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const kal = `${API}/api/termin?` + new URLSearchParams({ t: titel, s: new Date(iso).toISOString(), m: String(dauerMin), o: ort });
  // In der App direkt Apple Karten, sonst Google Maps im Browser
  const route = NATIVE && ort ? "maps://?daddr=" + encodeURIComponent(ort) : (ws ? mapsDirUrl(ws) : null);
  return `<div class="btnRow terminRow">
    <a class="btn ghost sm" href="${esc(kal)}" target="_blank" rel="noopener">${ico("calendar", 16)} In Kalender</a>
    ${route ? `<a class="btn ghost sm" href="${esc(route)}" target="_blank" rel="noopener">${ico("pin", 16)} Route</a>` : ""}
  </div>`;
}

// ============================================================
// Start
// ============================================================
window.addEventListener("hashchange", route);

// Supabase nutzt den impliziten Flow: Recovery-Links kommen als
// #access_token=…&type=recovery zurück. Das muss vor dem ersten Routing
// ausgewertet werden, sonst deutet der Hash-Router das Fragment als
// (ungültige) Route und verwirft es.
const authHash = new URLSearchParams(location.hash.replace(/^#/, ""));
const isRecoveryLink = authHash.get("type") === "recovery";
const authLinkError = authHash.get("error_description") || authHash.get("error");

sb.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") { me = null; myProfile = null; myWorkshop = null; }
  if (event === "PASSWORD_RECOVERY") go("reset-password");
});
(async () => {
  await loadSession();
  window.appLock();
  if (authLinkError) {
    // z.B. abgelaufener oder bereits benutzter Link
    history.replaceState(null, "", location.pathname + "#/forgot");
    toast("Der Link ist ungültig oder abgelaufen – fordere einen neuen an.");
  } else if (isRecoveryLink) {
    // Tokens aus der Adresszeile entfernen, damit sie nicht im Verlauf landen
    history.replaceState(null, "", location.pathname + "#/reset-password");
  } else {
    maybeStartTour();
    // Werkstatt-Registrierung nach E-Mail-Bestätigung abschließen
    if (me && !myWorkshop && localStorage.getItem("cfx_pending_ws") && myProfile?.role === "customer") {
      await createWorkshopForMe(localStorage.getItem("cfx_pending_ws"));
      localStorage.removeItem("cfx_pending_ws");
    }
    // Installationshinweis erst nach kurzer Verzögerung – er soll den
    // Einstieg begleiten, nicht den ersten Eindruck überdecken.
    if (me) setTimeout(renderInstallBanner, 2500);
  }
  stripeRueckkehr();
  route();
})();

// Rückkehr von der Stripe-Bezahlseite bzw. -Einrichtung: Hinweis zeigen und
// den Parameter aus der Adresse entfernen, damit er beim Neuladen nicht erneut kommt.
function stripeRueckkehr() {
  const q = new URLSearchParams(location.search);
  const hinweis = {
    "zahlung:ok": "Danke! Deine Zahlung wird bestätigt – das dauert meist nur Sekunden.",
    "zahlung:abbruch": "Zahlung abgebrochen. Es wurde nichts berechnet.",
    "stripe:zurueck": "Zurück von Stripe – der Stand deiner Online-Zahlungen wird aktualisiert.",
    "stripe:erneut": "Der Stripe-Link war abgelaufen. Bitte starte die Einrichtung erneut.",
  };
  for (const k of ["zahlung", "stripe"]) {
    const v = q.get(k);
    if (!v) continue;
    if (hinweis[k + ":" + v]) setTimeout(() => toast(hinweis[k + ":" + v]), 600);
    if (k === "stripe") profTab = "zahl";
    // Stripes Bestätigung braucht einen Moment – danach die Ansicht neu laden.
    if (k === "zahlung" && v === "ok") setTimeout(route, 4000);
    history.replaceState(null, "", location.pathname + location.hash);
  }
}
