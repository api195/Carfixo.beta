// ============================================================
// Carfixo App – SPA (Kunde + Werkstatt)
// ============================================================
"use strict";

const sb = window.supabase.createClient(CARFIXO.SUPABASE_URL, CARFIXO.SUPABASE_KEY);
let me = null, myProfile = null, myWorkshop = null;
let rtChannels = [];

const $ = (id) => document.getElementById(id);
const main = $("main");

// ---------- UI-Helfer ----------
let toastTimer = null;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}
function showErr(el, msg) { if (el) { el.textContent = msg; el.style.display = "block"; } else toast(msg); }
function openModal(html) {
  $("modalHost").innerHTML = `<div class="modal" onclick="if(event.target===this)closeModal()"><div class="modalBox">${html}</div></div>`;
}
function closeModal() { $("modalHost").innerHTML = ""; }
function cleanRT() { rtChannels.forEach(c => { try { sb.removeChannel(c); } catch (e) {} }); rtChannels = []; }
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
  "search": vSearch, "workshop": vWorkshopProfile, "new-request": vNewRequest,
  "requests": vRequests, "request": vRequestDetail,
  "vehicles": vVehicles, "reminders": vReminders, "account": vAccount,
  "ws/dashboard": vWsDashboard, "ws/leads": vWsLeads, "ws/lead": vWsLead,
  "ws/jobs": vWsJobs, "ws/calendar": vWsCalendar, "ws/profile": vWsProfile,
};
const CUSTOMER_NAV = [["search", "🔍", "Suche"], ["requests", "📢", "Aufträge"], ["vehicles", "🚗", "Fahrzeuge"], ["reminders", "🔔", "Erinnerungen"]];
const WS_NAV = [["ws/dashboard", "📊", "Dashboard"], ["ws/leads", "📢", "Anfragen"], ["ws/jobs", "🗂️", "Aufträge"], ["ws/calendar", "📅", "Kalender"], ["ws/profile", "🏪", "Profil"]];

function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [pathPart, queryPart] = h.split("?");
  const segs = pathPart.split("/").filter(Boolean);
  const query = {};
  (queryPart || "").split("&").forEach(kv => { const [k, v] = kv.split("="); if (k) query[k] = decodeURIComponent(v || ""); });
  let name = segs[0] || "", param = segs[1] || null;
  if (name === "ws" && segs[1]) { name = "ws/" + segs[1]; param = segs[2] || null; }
  return { name, param, query };
}
function go(path) { location.hash = "#/" + path; }

async function route() {
  cleanRT();
  const { name, param, query } = parseHash();
  window.scrollTo(0, 0);
  if (!name) {
    if (!me) return go("search");
    if (myProfile?.role === "workshop_owner" || myProfile?.role === "workshop_staff") return go("ws/dashboard");
    return go("search");
  }
  const view = routes[name];
  if (!view) return go("search");
  renderNav(name);
  try { await view(param, query); } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="warn">Fehler beim Laden: ${esc(e.message || e)}</div>`;
  }
}

function renderNav(active) {
  const isWs = myProfile?.role === "workshop_owner" || myProfile?.role === "workshop_staff";
  const items = me ? (isWs ? WS_NAV : CUSTOMER_NAV) : [["search", "🔍", "Suche"]];
  const nav = items.map(([r, ic, label]) =>
    `<a href="#/${r}" class="${active === r ? "on" : ""}">${label}</a>`).join("");
  $("topNav").innerHTML = nav + (me
    ? ""
    : `<a href="#/login" class="${active === "login" ? "on" : ""}">Anmelden</a><a href="#/register" class="${active === "register" ? "on" : ""}" style="color:var(--blue2)">Registrieren</a>`);
  $("tabbar").innerHTML = items.map(([r, ic, label]) =>
    `<a href="#/${r}" class="${active === r ? "on" : ""}"><span class="ti">${ic}</span>${label}</a>`).join("") +
    `<a href="#/${me ? "account" : "login"}" class="${active === "account" || active === "login" ? "on" : ""}"><span class="ti">👤</span>${me ? "Konto" : "Login"}</a>`;
  const av = $("avatarBtn");
  if (me) {
    av.classList.remove("hidden");
    av.textContent = initials(myProfile?.full_name || me.email);
    av.onclick = () => go("account");
  } else av.classList.add("hidden");
}

async function loadSession() {
  const { data: { session } } = await sb.auth.getSession();
  me = session?.user || null;
  myProfile = null; myWorkshop = null;
  if (me) {
    const { data: p } = await sb.from("profiles").select("*").eq("id", me.id).maybeSingle();
    myProfile = p;
    if (p && (p.role === "workshop_owner" || p.role === "workshop_staff")) {
      const { data: w } = await sb.from("workshops").select("*").eq("owner_id", me.id).maybeSingle();
      myWorkshop = w;
    }
  }
}
function requireAuth() {
  if (!me) { toast("Bitte zuerst anmelden."); go("login"); return false; }
  return true;
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
    <button class="btn wide" style="margin-top:18px" id="lGo">Anmelden</button>
    <div class="err" id="lErr"></div>
    <p class="mm" style="margin-top:16px;text-align:center">Noch kein Konto? <a href="#/register" style="color:var(--blue2);font-weight:700">Jetzt registrieren</a></p>
  </div></div>`;
  $("lPass").onkeydown = (e) => { if (e.key === "Enter") $("lGo").click(); };
  $("lGo").onclick = async () => {
    const err = $("lErr"); err.style.display = "none";
    $("lGo").disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: $("lEmail").value.trim(), password: $("lPass").value });
    $("lGo").disabled = false;
    if (error) return showErr(err, error.message === "Invalid login credentials" ? "E-Mail oder Passwort falsch." : error.message);
    await loadSession();
    toast("Angemeldet ✓");
    go("");
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
        <div class="re">🚗</div><div class="rn">Kunde</div>
        <div class="rm">Ich suche Werkstätten &amp; Services für mein Auto</div>
      </div>
      <div class="roleCard" id="rcWs" onclick="pickRole('workshop')">
        <div class="re">🔧</div><div class="rn">Betrieb</div>
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
  if (pass.length < 8) return showErr(err, "Das Passwort braucht mindestens 8 Zeichen.");
  if (regRole === "workshop" && !company) return showErr(err, "Bitte den Namen deines Betriebs angeben.");
  $("rGo").disabled = true;
  const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { full_name: name } } });
  $("rGo").disabled = false;
  if (error) return showErr(err, error.message);
  if (!data.session) {
    main.innerHTML = `<div class="authWrap"><div class="authCard" style="text-align:center">
      <div style="font-size:42px">📬</div>
      <h1 style="margin-top:10px">Fast geschafft!</h1>
      <p class="mm" style="margin-top:10px">Wir haben dir eine Bestätigungs-E-Mail an <b>${esc(email)}</b> geschickt. Klicke auf den Link darin und melde dich dann an.${company ? "<br><br>Dein Betrieb wird beim ersten Login angelegt – trage danach dein Profil ein." : ""}</p>
      ${company ? `<script>localStorage.setItem("cfx_pending_ws", ${JSON.stringify(company)})<\/script>` : ""}
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
    go("search");
  }
}
async function createWorkshopForMe(name) {
  const { error } = await sb.from("workshops").insert({ owner_id: me.id, name, categories: [] });
  if (error && !String(error.message).includes("duplicate")) toast("Betrieb konnte nicht angelegt werden: " + error.message);
  await loadSession();
}

async function signOut() {
  cleanRT();
  await sb.auth.signOut();
  me = null; myProfile = null; myWorkshop = null;
  toast("Abgemeldet.");
  go("search");
}

// ============================================================
// SUCHE (öffentlich)
// ============================================================
let searchState = { world: "", cat: "", service: "", brand: "", district: "", mode: "", minRating: 0, sort: "rating", view: "list" };
let allWorkshops = null, searchMap = null;

async function vSearch() {
  const s = searchState;
  main.innerHTML = `
  <div class="pageHead">
    <div><h1>Werkstatt-Suche</h1>
    <div class="sub">Finde Werkstätten, Tuning-Betriebe, Aufbereiter und Prüfstellen in Köln – gefiltert nach dem, was dein Auto braucht.</div></div>
    ${me && !myWorkshop ? `<div class="right"><a class="btn sm" href="#/new-request">＋ Ausschreibung erstellen</a></div>` : ""}
  </div>
  <div class="searchGrid">
    <div class="filterBox card">
      <div class="tt">Filter</div>
      <div class="label">Bereich</div>
      <div class="chips" id="fWorlds">
        <span class="chip ${!s.world ? "on" : ""}" data-w="">Alle</span>
        ${WORLDS.map(w => `<span class="chip ${s.world === w.key ? "on" : ""}" data-w="${w.key}">${w.icon} ${w.name}</span>`).join("")}
      </div>
      <div class="label">Kategorie</div>
      <select id="fCat"></select>
      <div class="label">Leistung</div>
      <select id="fService"></select>
      <div class="label">Fahrzeugmarke</div>
      <select id="fBrand">${opt("Alle Marken", Object.keys(BRANDS), s.brand)}</select>
      <div class="label">Stadtteil (für Entfernung)</div>
      <select id="fDistrict">${opt("Alle / Kölner Zentrum", Object.keys(DISTRICTS), s.district)}</select>
      <div class="label">Service-Art</div>
      <select id="fMode"><option value="">Egal</option><option value="mobile" ${s.mode === "mobile" ? "selected" : ""}>Mobiler Service möglich</option></select>
      <div class="label">Mindestbewertung</div>
      <select id="fRating"><option value="0">Alle</option><option value="4" ${s.minRating == 4 ? "selected" : ""}>★ 4,0+</option><option value="4.5" ${s.minRating == 4.5 ? "selected" : ""}>★ 4,5+</option></select>
      <div class="label">Sortierung</div>
      <select id="fSort">
        <option value="rating" ${s.sort === "rating" ? "selected" : ""}>Beste Bewertung</option>
        <option value="distance" ${s.sort === "distance" ? "selected" : ""}>Entfernung</option>
        <option value="price" ${s.sort === "price" ? "selected" : ""}>Preisniveau</option>
      </select>
      <button class="btn ghost wide sm" style="margin-top:16px" id="fReset">Filter zurücksetzen</button>
    </div>
    <div>
      <div class="mapWrap" style="margin-bottom:14px"><div id="map"></div></div>
      <div id="resultMeta" class="mm" style="margin-bottom:10px"></div>
      <div id="results"><div class="sk" style="height:110px"></div></div>
    </div>
  </div>`;

  fillCatSelect();
  document.querySelectorAll("#fWorlds .chip").forEach(c => c.onclick = () => {
    searchState.world = c.dataset.w; searchState.cat = ""; searchState.service = "";
    document.querySelectorAll("#fWorlds .chip").forEach(x => x.classList.toggle("on", x === c));
    fillCatSelect(); applyFilters();
  });
  ["fCat", "fService", "fBrand", "fDistrict", "fMode", "fRating", "fSort"].forEach(id => $(id).onchange = () => {
    searchState.cat = $("fCat").value; searchState.service = $("fService").value;
    searchState.brand = $("fBrand").value; searchState.district = $("fDistrict").value;
    searchState.mode = $("fMode").value; searchState.minRating = parseFloat($("fRating").value) || 0;
    searchState.sort = $("fSort").value;
    if (id === "fCat") { searchState.service = ""; fillServiceSelect(); }
    applyFilters();
  });
  $("fReset").onclick = () => { searchState = { world: "", cat: "", service: "", brand: "", district: "", mode: "", minRating: 0, sort: "rating", view: "list" }; vSearch(); };

  // Karte
  searchMap = L.map("map", { scrollWheelZoom: false }).setView(CITY_CENTER, 12);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>', maxZoom: 19,
  }).addTo(searchMap);

  if (!allWorkshops) {
    const { data, error } = await sb.from("workshops").select("*").eq("is_verified", true).order("rating_avg", { ascending: false });
    if (error) { $("results").innerHTML = `<div class="warn">${esc(error.message)}</div>`; return; }
    allWorkshops = data || [];
  }
  applyFilters();
}
function fillCatSelect() {
  const w = WORLDS.find(x => x.key === searchState.world);
  const cats = w ? w.cats : Object.keys(CATS);
  $("fCat").innerHTML = `<option value="">Alle Kategorien</option>` +
    cats.map(k => `<option value="${k}" ${searchState.cat === k ? "selected" : ""}>${CATS[k].icon} ${CATS[k].name}</option>`).join("");
  fillServiceSelect();
}
function fillServiceSelect() {
  const services = searchState.cat ? CATS[searchState.cat].services : [];
  $("fService").innerHTML = opt(searchState.cat ? "Alle Leistungen" : "Erst Kategorie wählen", services, searchState.service);
  $("fService").disabled = !searchState.cat;
}
let mapMarkers = [];
function applyFilters() {
  const s = searchState;
  const origin = s.district ? DISTRICTS[s.district] : CITY_CENTER;
  const w = WORLDS.find(x => x.key === s.world);
  let list = (allWorkshops || []).filter(ws => {
    if (w && !ws.categories.some(c => w.cats.includes(c))) return false;
    if (s.cat && !ws.categories.includes(s.cat)) return false;
    if (s.service && !(ws.services || []).includes(s.service)) return false;
    if (s.brand && (ws.brands || []).length > 0 && !ws.brands.includes(s.brand)) return false;
    if (s.mode === "mobile" && ws.service_mode === "stationary") return false;
    if (s.minRating && (Number(ws.rating_avg) || 0) < s.minRating) return false;
    return true;
  }).map(ws => ({ ...ws, _dist: distKm(origin, [ws.lat, ws.lng]) }));

  if (s.sort === "distance") list.sort((a, b) => (a._dist ?? 99) - (b._dist ?? 99));
  else if (s.sort === "price") list.sort((a, b) => (a.price_level || 2) - (b.price_level || 2));
  else list.sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0) || (b.rating_count || 0) - (a.rating_count || 0));

  $("resultMeta").textContent = `${list.length} ${list.length === 1 ? "Betrieb" : "Betriebe"} gefunden`;
  $("results").innerHTML = list.length === 0
    ? `<div class="empty"><div class="e">🔍</div>Keine Betriebe für diese Filter.<br>Tipp: Erstelle eine <a href="#/new-request" style="color:var(--blue2)">Ausschreibung</a> – Betriebe melden sich bei dir.</div>`
    : list.map(ws => wsCardHtml(ws)).join("");

  // Karte aktualisieren
  mapMarkers.forEach(m => searchMap.removeLayer(m));
  mapMarkers = [];
  list.forEach(ws => {
    if (ws.lat == null || ws.lng == null) return;
    const icon = L.divIcon({ className: "", html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:linear-gradient(135deg,#2E77FF,#0A47C2);box-shadow:0 6px 16px rgba(30,107,255,.5);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:12px">${CATS[ws.categories[0]]?.icon || "🔧"}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 30] });
    const m = L.marker([ws.lat, ws.lng], { icon }).addTo(searchMap);
    m.bindPopup(`<b>${esc(ws.name)}</b><br><span style="color:#FFB020">${stars(ws.rating_avg)}</span> ${ws.rating_avg ?? "–"} · ${esc(ws.district || "")}<br><a href="#/workshop/${ws.id}" style="color:#4D8DFF;font-weight:700">Profil ansehen →</a>`);
    mapMarkers.push(m);
  });
  if (mapMarkers.length) searchMap.fitBounds(L.featureGroup(mapMarkers).getBounds().pad(0.25));
}
function wsCardHtml(ws) {
  const d = ws._dist;
  return `<div class="card tap" style="margin-bottom:12px" onclick="go('workshop/${ws.id}')">
    <div class="wsCard">
      <div class="wsAv">${esc(initials(ws.name))}</div>
      <div style="flex:1;min-width:0">
        <div class="tt">${esc(ws.name)} ${ws.is_verified ? '<span class="badge b-green" style="vertical-align:2px">✓ verifiziert</span>' : ""}</div>
        <div class="ratingLine">${stars(ws.rating_avg)}<span class="cnt">${ws.rating_avg > 0 ? Number(ws.rating_avg).toLocaleString("de-DE") : "Neu"} · ${ws.rating_count || 0} Bewertungen</span></div>
        <div class="mm">📍 ${esc(ws.district || ws.city || "Köln")}${d != null ? ` · ${d.toFixed(1).replace(".", ",")} km` : ""}${ws.service_mode !== "stationary" ? " · 🚐 mobil" : ""}${ws.price_level ? " · " + priceLevelTxt(ws.price_level) : ""}${ws.hourly_rate ? ` · ab ${Math.round(ws.hourly_rate)} €/h` : ""}</div>
        <div class="chips" style="margin-top:9px">${ws.categories.slice(0, 4).map(c => `<span class="pill">${CATS[c]?.icon || ""} ${CATS[c]?.name || c}</span>`).join("")}</div>
      </div>
    </div>
  </div>`;
}

// ============================================================
// WERKSTATTPROFIL (öffentlich)
// ============================================================
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
  <div class="pageHead">
    <div class="wsAv" style="width:64px;height:64px;font-size:23px">${esc(initials(ws.name))}</div>
    <div style="flex:1">
      <h1>${esc(ws.name)} ${ws.is_verified ? '<span class="badge b-green" style="vertical-align:6px">✓ verifiziert</span>' : ""}</h1>
      <div class="ratingLine" style="margin-top:4px">${stars(ws.rating_avg)}<span class="cnt">${ws.rating_avg > 0 ? Number(ws.rating_avg).toLocaleString("de-DE") : "Neu"} · ${ws.rating_count || 0} Bewertungen · 📍 ${esc(ws.district || ws.city || "Köln")}</span></div>
    </div>
    <div class="right">
      <button class="btn" id="wsAsk">Anfrage stellen</button>
    </div>
  </div>
  <div class="searchGrid" style="grid-template-columns:1fr 340px">
    <div>
      <div class="card" style="margin-bottom:14px">
        <div class="tt">Über den Betrieb</div>
        <p class="mm" style="margin-top:8px;font-size:13px">${esc(ws.description || "Keine Beschreibung hinterlegt.")}</p>
        ${ws.founded_year ? `<p class="mm" style="margin-top:6px">Gegründet ${ws.founded_year}</p>` : ""}
        <div class="foot" style="border:none;padding-top:8px">
          ${ws.service_mode !== "stationary" ? '<span class="badge b-blue">🚐 Mobiler Service</span>' : ""}
          ${ws.price_level ? `<span class="badge b-grey">Preisniveau ${priceLevelTxt(ws.price_level)}</span>` : ""}
          ${ws.hourly_rate ? `<span class="badge b-grey">Stundensatz ab ${Math.round(ws.hourly_rate)} €</span>` : ""}
        </div>
      </div>
      <div class="card" style="margin-bottom:14px">
        <div class="tt">Leistungen</div>
        ${ws.categories.map(c => `
          <div class="label">${CATS[c]?.icon || ""} ${CATS[c]?.name || c}</div>
          <div class="chips">${(ws.services || []).filter(s => (CATS[c]?.services || []).includes(s)).map(s => `<span class="pill">${esc(s)}</span>`).join("") || '<span class="mm">Alle Leistungen dieser Kategorie</span>'}</div>`).join("")}
        ${(ws.brands || []).length ? `<div class="label">Spezialisiert auf Marken</div><div class="chips">${ws.brands.map(b => `<span class="pill">${esc(b)}</span>`).join("")}</div>` : ""}
      </div>
      <div class="card">
        <div class="tt">Bewertungen (${reviews?.length || 0})</div>
        <div id="revList">${(reviews || []).length === 0
          ? '<div class="empty" style="padding:22px"><div class="e">⭐</div>Noch keine Bewertungen.</div>'
          : reviews.map(r => `
            <div style="padding:13px 0;border-bottom:1px solid var(--line)">
              <div class="ratingLine">${stars(r.rating)}<span class="cnt">${fmtDate(r.created_at)}</span></div>
              ${r.comment ? `<p class="mm" style="margin-top:5px;font-size:13px">${esc(r.comment)}</p>` : ""}
            </div>`).join("")}</div>
      </div>
    </div>
    <div>
      <div class="card" style="margin-bottom:14px">
        <div class="tt">Kontakt & Anfahrt</div>
        <p class="mm" style="margin-top:8px">${esc(ws.street || "")}<br>${esc(ws.zip || "")} ${esc(ws.city || "Köln")}${ws.district ? "-" + esc(ws.district) : ""}</p>
        ${ws.phone ? `<p class="mm" style="margin-top:5px">📞 ${esc(ws.phone)}</p>` : ""}
        ${ws.website ? `<p class="mm" style="margin-top:3px">🌐 ${esc(ws.website)}</p>` : ""}
        <div class="mapWrap" style="height:200px;margin-top:12px"><div id="wsMap"></div></div>
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
  if (ws.lat != null && ws.lng != null) {
    const m = L.map("wsMap", { scrollWheelZoom: false, dragging: false, zoomControl: false }).setView([ws.lat, ws.lng], 14);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(m);
    L.circleMarker([ws.lat, ws.lng], { radius: 9, color: "#4D8DFF", fillColor: "#1E6BFF", fillOpacity: .9 }).addTo(m);
  } else $("wsMap").parentElement.classList.add("hidden");
}

// ============================================================
// NEUE ANFRAGE / AUSSCHREIBUNG (Kunde)
// ============================================================
let nrCat = "reparatur", nrServices = [], nrFiles = [], nrTargetWs = null;
async function vNewRequest(_p, query) {
  if (!requireAuth()) return;
  nrCat = "reparatur"; nrServices = []; nrFiles = []; nrTargetWs = null;
  if (query.ws) {
    const { data: ws } = await sb.from("workshops").select("id,name,categories").eq("id", query.ws).maybeSingle();
    nrTargetWs = ws;
    if (ws && ws.categories?.length) nrCat = ws.categories[0];
  }
  const { data: cars } = await sb.from("vehicles").select("*").eq("owner_id", me.id).order("created_at");
  if (!cars || cars.length === 0) {
    main.innerHTML = `<div class="pageHead"><div><h1>${nrTargetWs ? "Direktanfrage" : "Ausschreibung erstellen"}</h1></div></div>
      <div class="note">🚗 Zuerst brauchst du ein gespeichertes Fahrzeug – jede Anfrage ist mit genau einem Fahrzeug verbunden.</div>
      <button class="btn" onclick="go('vehicles')">＋ Fahrzeug anlegen</button>`;
    return;
  }
  main.innerHTML = `
  <div class="pageHead"><div>
    <h1>${nrTargetWs ? "Direktanfrage" : "Ausschreibung erstellen"}</h1>
    <div class="sub">${nrTargetWs ? "Deine Anfrage geht direkt an den gewählten Betrieb." : "Deine Ausschreibung sehen alle passenden, verifizierten Betriebe – sie melden sich mit Angeboten."}</div>
  </div></div>
  ${nrTargetWs ? `<div class="note">📩 Direktanfrage an <b>${esc(nrTargetWs.name)}</b> – nur dieser Betrieb sieht deine Anfrage und kann dir ein Angebot machen.</div>` : ""}
  <div class="grid2" style="align-items:start">
    <div class="card">
      <div class="label" style="margin-top:0">Fahrzeug</div>
      <select id="nCar">${cars.map((c, i) => `<option value="${c.id}" ${i === 0 ? "selected" : ""}>${esc(carLabel(c))}</option>`).join("")}</select>
      <div class="label">Kategorie</div>
      <div class="catGrid" id="nCats">${Object.entries(CATS).map(([k, v]) => `
        <div class="catCard ${k === nrCat ? "on" : ""}" data-k="${k}"><span class="ce">${v.icon}</span><span class="cn">${v.name}</span></div>`).join("")}</div>
      <div class="label">Gewünschte Leistungen (optional)</div>
      <div class="chips" id="nServices"></div>
      <div class="label">Titel</div>
      <input id="nTitle" placeholder="z.B. Bremsen vorne erneuern" maxlength="80">
      <div class="label">Beschreibung</div>
      <textarea id="nDesc" placeholder="Was ist das Problem? Was soll gemacht werden?"></textarea>
      <div class="uploadTile" style="margin-top:12px" onclick="$('nFile').click()">
        <div class="ico icoPurple">🤖</div>
        <div><div class="tt" style="font-size:12.5px">KI-Analyse (Beta) &amp; Fotos</div>
        <div class="mm">Fotos hochladen und Beschreibung analysieren lassen</div></div>
      </div>
      <input type="file" id="nFile" accept="image/*" multiple class="hidden">
      <div class="thumbs" id="nThumbs"></div>
      <button class="btn ghost sm" style="margin-top:10px" id="nAnalyze">🤖 Beschreibung analysieren</button>
      <div id="nAiOut"></div>
    </div>
    <div class="card">
      <div class="label" style="margin-top:0">Budget in € (optional)</div>
      <input id="nBudget" inputmode="numeric" placeholder="z.B. 250">
      <div class="label">Ort</div>
      <div class="split">
        <select id="nCity"><option>Köln</option></select>
        <select id="nDistrict">${opt("Stadtteil (optional)", Object.keys(DISTRICTS), "")}</select>
      </div>
      <input id="nZip" inputmode="numeric" maxlength="5" placeholder="PLZ (optional)" style="margin-top:8px">
      <p class="mm" style="margin-top:6px;font-size:11px">Deine genaue Adresse wird Betrieben nie öffentlich angezeigt.</p>
      <div class="label">Wunschtermin (optional)</div>
      <input id="nDate" type="date">
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
    </div>
  </div>`;
  renderNrServices();
  document.querySelectorAll("#nCats .catCard").forEach(c => c.onclick = () => {
    nrCat = c.dataset.k; nrServices = [];
    document.querySelectorAll("#nCats .catCard").forEach(x => x.classList.toggle("on", x === c));
    renderNrServices();
  });
  $("nFile").onchange = handleNrFiles;
  $("nAnalyze").onclick = runAiAnalyze;
  $("nGo").onclick = () => submitRequest(cars);
}
function renderNrServices() {
  $("nServices").innerHTML = CATS[nrCat].services.map(s =>
    `<span class="chip ${nrServices.includes(s) ? "on" : ""}" data-s="${esc(s)}">${esc(s)}</span>`).join("");
  document.querySelectorAll("#nServices .chip").forEach(c => c.onclick = () => {
    const s = c.dataset.s;
    const i = nrServices.indexOf(s);
    if (i >= 0) nrServices.splice(i, 1); else nrServices.push(s);
    c.classList.toggle("on");
  });
}
function handleNrFiles() {
  const files = [...$("nFile").files].slice(0, 4 - nrFiles.length);
  files.forEach(f => { if (f.size < 8 * 1024 * 1024) nrFiles.push(f); });
  $("nThumbs").innerHTML = nrFiles.map(f => `<img src="${URL.createObjectURL(f)}" alt="">`).join("");
}
function runAiAnalyze() {
  const hits = aiAnalyze($("nTitle").value + " " + $("nDesc").value);
  $("nAiOut").innerHTML = hits.length === 0
    ? `<div class="warn" style="margin-top:12px">🤖 Keine eindeutige Einschätzung möglich – beschreibe das Problem etwas genauer (Geräusch, Warnlampe, wann tritt es auf?).</div>`
    : `<div class="note" style="margin-top:12px"><b>🤖 KI-Einschätzung (Beta – ersetzt keine Diagnose):</b><br>${hits.map((h, i) => `
        <div style="margin-top:8px">• <b>${esc(h.guess)}</b> <span class="badge ${h.conf === "hoch" ? "b-green" : "b-gold"}">${h.conf}e Wahrscheinlichkeit</span><br>
        <a href="#" data-ai="${i}" style="color:var(--blue2);font-size:12px;font-weight:700">→ Kategorie „${CATS[h.cat].name}" + „${esc(h.service)}" übernehmen</a></div>`).join("")}</div>`;
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
  const err = $("nErr"); err.style.display = "none";
  const title = $("nTitle").value.trim(), desc = $("nDesc").value.trim();
  if (!title || !desc) return showErr(err, "Bitte Titel und Beschreibung ausfüllen.");
  const carId = $("nCar").value;
  const car = cars.find(c => c.id === carId);
  $("nGo").disabled = true;
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
    category: nrCat, title, description: desc,
    budget_max: parseFloat(($("nBudget").value || "").replace(",", ".")) || null,
    extras: { leistungen: nrServices }, attachments,
    city: "Köln", district: $("nDistrict").value || null, zip: $("nZip").value.trim() || null,
    preferred_date: $("nDate").value || null, date_flexible: $("nFlex").checked, asap: $("nAsap").checked,
    status: "open", service_preference: $("nMode").value,
    type: nrTargetWs ? "direct" : "open", workshop_id: nrTargetWs ? nrTargetWs.id : null,
  }).select().single();
  $("nGo").disabled = false;
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
  if (list.length === 0) { box.innerHTML = `<div class="empty"><div class="e">📢</div>Keine Aufträge in dieser Ansicht.</div>`; return; }
  box.innerHTML = list.map(r => {
    const c = CATS[r.category] || { icon: "🔧", name: r.category };
    const n = r.offers?.[0]?.count || 0;
    const bk = bkMap[r.id];
    let st;
    if (bk && BK_STATUS[bk.status]) st = `<span class="badge ${BK_STATUS[bk.status][1]}">${BK_STATUS[bk.status][0]}</span>`;
    else if (r.status === "open") st = n > 0 ? `<span class="badge b-blue">${n} Angebot${n > 1 ? "e" : ""}</span>` : `<span class="badge b-green">Offen</span>`;
    else st = `<span class="badge b-grey">${esc(r.status)}</span>`;
    return `<div class="card tap" style="margin-bottom:11px" onclick="go('request/${r.id}')">
      <div class="cardHead"><div class="ico">${c.icon}</div>
        <div style="flex:1;min-width:0"><div class="tt">${esc(r.title)} ${r.type === "direct" ? '<span class="badge b-purple">Direkt</span>' : ""}</div>
        <div class="mm">🚗 ${esc(r.vehicle_label || "")}</div>
        <div class="mm">${c.name}${r.district ? " · 📍 " + esc(r.district) : ""}${r.asap ? " · ⚡ ASAP" : r.preferred_date ? " · 📅 " + fmtDate(r.preferred_date) : ""}</div></div>
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
  const c = CATS[r.category] || { icon: "🔧", name: r.category };
  const booked = r.status === "booked";
  main.innerHTML = `
  <div class="pageHead">
    <div class="ico" style="width:52px;height:52px;font-size:23px">${c.icon}</div>
    <div style="flex:1"><h1>${esc(r.title)}</h1>
    <div class="sub">🚗 ${esc(r.vehicle_label || "")} · ${c.name}${r.type === "direct" ? " · 📩 Direktanfrage" : ""}</div></div>
    ${r.status === "open" ? `<div class="right"><button class="btn red sm" id="rCancel">Zurückziehen</button></div>` : ""}
  </div>
  <div class="grid2" style="align-items:start">
    <div>
      <div class="card" style="margin-bottom:14px">
        <div class="tt">Details</div>
        <p class="mm" style="margin-top:8px;font-size:13px">${esc(r.description)}</p>
        <div class="chips" style="margin-top:10px">
          ${(r.extras?.leistungen || []).map(s => `<span class="pill">${esc(s)}</span>`).join("")}
          ${r.budget_max ? `<span class="pill">💶 Budget bis ${fmtEur(r.budget_max)}</span>` : ""}
          ${r.district ? `<span class="pill">📍 ${esc(r.district)}</span>` : ""}
          ${r.asap ? `<span class="pill">⚡ ASAP</span>` : ""}
          ${r.preferred_date ? `<span class="pill">📅 ${fmtDate(r.preferred_date)}</span>` : ""}
          ${r.date_flexible ? `<span class="pill">🔄 flexibel</span>` : ""}
        </div>
        ${(r.attachments || []).length ? `<div class="thumbs">${r.attachments.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Foto"></a>`).join("")}</div>` : ""}
      </div>
      <div id="bookingBox"></div>
      <div class="card">
        <div class="tt">Angebote <span id="offCount" class="badge b-blue"></span></div>
        <div id="offers" style="margin-top:12px"><div class="sk" style="height:80px"></div></div>
      </div>
    </div>
    <div class="card">
      <div class="tt">💬 Chat</div>
      <div class="msgs" id="msgs"></div>
      <div class="msgRow"><input id="msgIn" placeholder="Nachricht schreiben…"><button id="msgGo">➤</button></div>
    </div>
  </div>`;
  if ($("rCancel")) $("rCancel").onclick = async () => {
    if (!confirm("Anfrage wirklich zurückziehen?")) return;
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
  const { data } = await sb.from("offers").select("*, workshops(id,name,rating_avg,rating_count,is_verified,district)").eq("request_id", r.id).order("total_price");
  const box = $("offers"); if (!box) return;
  $("offCount").textContent = (data || []).length || "";
  if (!data || data.length === 0) {
    box.innerHTML = `<div class="empty" style="padding:22px"><div class="e">⏳</div>Noch keine Angebote.<br><span class="mm">Passende Betriebe sehen deine Anfrage und melden sich hier.</span></div>`;
    return;
  }
  const minPrice = Math.min(...data.filter(o => o.status !== "withdrawn").map(o => Number(o.total_price)));
  box.innerHTML = data.map(o => {
    const w = o.workshops || {};
    const items = (o.line_items || []).map(li => `<div class="offerLine"><span>${esc(li.label)}</span><span>${fmtEur(li.price)}</span></div>`).join("");
    const best = Number(o.total_price) === minPrice && data.length > 1;
    const st = o.status === "accepted" ? '<span class="badge b-green">Angenommen ✓</span>'
      : o.status === "declined" ? '<span class="badge b-grey">Abgelehnt</span>'
      : o.status === "withdrawn" ? '<span class="badge b-grey">Zurückgezogen</span>'
      : r.status === "open" ? `<button class="btn green sm" onclick="acceptOffer('${o.id}','${r.id}')">Annehmen</button>` : "";
    return `<div class="card" style="margin-bottom:11px;${best ? "border-color:rgba(43,213,138,.45)" : ""};position:relative">
      ${best ? '<span class="badge b-green" style="position:absolute;top:-9px;right:14px">Bester Preis</span>' : ""}
      <div class="cardHead">
        <div class="wsAv" style="width:42px;height:42px;font-size:15px">${esc(initials(w.name))}</div>
        <div style="flex:1;min-width:0">
          <div class="tt"><a href="#/workshop/${w.id}" style="color:inherit">${esc(w.name || "Werkstatt")}</a>${w.is_verified ? " ✓" : ""}</div>
          <div class="ratingLine">${stars(w.rating_avg)}<span class="cnt">${w.rating_avg > 0 ? Number(w.rating_avg).toLocaleString("de-DE") : "Neu"} · ${w.rating_count || 0} Bew.${w.district ? " · 📍 " + esc(w.district) : ""}</span></div>
        </div>
        <div style="text-align:right"><b style="font-size:19px">${fmtEur(o.total_price)}</b><div class="mm">inkl. MwSt.</div></div>
      </div>
      ${items ? `<div style="margin-top:10px">${items}</div>` : ""}
      ${o.message ? `<p class="mm" style="margin-top:8px">💬 ${esc(o.message)}</p>` : ""}
      <div class="foot"><span class="mm">${fmtDate(o.created_at)}</span>${st}</div>
    </div>`;
  }).join("");
}
async function acceptOffer(offerId, requestId) {
  if (!confirm("Dieses Angebot verbindlich annehmen? Alle anderen Angebote werden automatisch abgelehnt.")) return;
  const { error } = await sb.rpc("accept_offer", { p_offer_id: offerId });
  if (error) toast("Annahme fehlgeschlagen: " + error.message);
  else { toast("Angebot angenommen ✓"); vRequestDetail(requestId); }
}
async function loadBookingBox(r) {
  const { data: bk } = await sb.from("bookings")
    .select("*, offers!inner(request_id,total_price,workshops(id,name,phone))")
    .eq("offers.request_id", r.id).eq("customer_id", me.id).maybeSingle();
  const box = $("bookingBox"); if (!box || !bk) return;
  const s = BK_STATUS[bk.status] || ["?", "b-grey"];
  const w = bk.offers?.workshops || {};
  const { data: rev } = await sb.from("reviews").select("id,rating").eq("booking_id", bk.id).maybeSingle();
  box.innerHTML = `
  <div class="card" style="border-color:rgba(30,107,255,.4);margin-bottom:14px">
    <div class="cardHead"><div class="ico icoGreen">✅</div>
      <div style="flex:1"><div class="tt">Gebucht bei: <a href="#/workshop/${w.id}" style="color:var(--blue2)">${esc(w.name || "Werkstatt")}</a></div>
      <div class="mm">Preis: <b>${fmtEur(bk.total_price)}</b>${bk.scheduled_at ? " · Termin: " + fmtDateTime(bk.scheduled_at) : ""}${w.phone ? " · 📞 " + esc(w.phone) : ""}</div></div>
      <span class="badge ${s[1]}">${s[0]}</span></div>
    ${bk.status === "completed" && !rev ? `<button class="btn wide" style="margin-top:14px" onclick="openReviewModal('${bk.id}','${w.id}','${esc(w.name)}','${r.id}')">⭐ Jetzt bewerten</button>` : ""}
    ${bk.status === "completed" && rev ? `<div class="okBox" style="margin-bottom:0;margin-top:14px">Deine Bewertung: <span style="color:var(--gold)">${stars(rev.rating)}</span> – danke!</div>` : ""}
    ${!["completed", "cancelled"].includes(bk.status) ? `<button class="btn green wide" style="margin-top:14px" onclick="completeBooking('${bk.id}','${r.id}')">Auftrag als abgeschlossen bestätigen</button>` : ""}
  </div>`;
}
async function completeBooking(bkId, reqId) {
  if (!confirm("Auftrag wirklich als abgeschlossen bestätigen?")) return;
  const { error } = await sb.from("bookings").update({ status: "completed" }).eq("id", bkId);
  if (error) toast(error.message);
  else { toast("Abgeschlossen ✓ – du kannst jetzt bewerten."); vRequestDetail(reqId); }
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
    <div class="btnRow">
      <button class="btn" id="revGo">Bewertung abschicken</button>
      <button class="btn ghost" onclick="closeModal()">Abbrechen</button>
    </div>
    <div class="err" id="revErr"></div>`);
  document.querySelectorAll("#starPick span").forEach(s => s.onclick = () => {
    revRating = +s.dataset.n;
    document.querySelectorAll("#starPick span").forEach(x => x.classList.toggle("on", +x.dataset.n <= revRating));
  });
  $("revGo").onclick = async () => {
    if (!revRating) return showErr($("revErr"), "Bitte Sterne vergeben.");
    $("revGo").disabled = true;
    const { error } = await sb.from("reviews").insert({
      booking_id: bookingId, customer_id: me.id, workshop_id: workshopId,
      rating: revRating, comment: $("revComment").value.trim() || null,
    });
    $("revGo").disabled = false;
    if (error) return showErr($("revErr"), error.message);
    closeModal(); toast("Danke für deine Bewertung ⭐");
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
    <div class="right"><button class="btn sm" onclick="openVehicleForm()">＋ Fahrzeug</button></div>
  </div>
  <div id="carList" class="grid2"><div class="sk" style="height:120px"></div></div>`;
  await loadVehicles();
}
async function loadVehicles() {
  const { data, error } = await sb.from("vehicles").select("*").eq("owner_id", me.id).order("created_at");
  const box = $("carList"); if (!box) return;
  if (error) { box.innerHTML = `<div class="warn">${esc(error.message)}</div>`; return; }
  if (!data || data.length === 0) { box.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="e">🚗</div>Noch kein Fahrzeug gespeichert.</div>`; return; }
  box.innerHTML = data.map(v => `
    <div class="card">
      <div class="cardHead"><div class="ico icoBlue">🚗</div>
        <div style="flex:1;min-width:0"><div class="tt">${esc(v.make)} ${esc(v.model)}${v.series && v.series !== "Keine Angabe" ? " " + esc(v.series) : ""}</div>
        <div class="mm">${esc(carLabel(v))}</div>
        ${v.license_plate ? `<div class="mm">🔖 ${esc(v.license_plate)}</div>` : ""}
        ${v.tuev_until ? `<div class="mm">📋 TÜV bis ${fmtDate(v.tuev_until)}${new Date(v.tuev_until) < new Date(Date.now() + 60 * 864e5) ? ' <span class="badge b-gold">bald fällig</span>' : ""}</div>` : ""}
        ${v.registration_doc ? `<div class="mm">📄 Fahrzeugschein hinterlegt</div>` : ""}
        </div></div>
      <div class="foot">
        <button class="btn ghost sm" onclick='openVehicleForm(${JSON.stringify(v.id)})'>Bearbeiten</button>
        <button class="btn red sm" onclick='deleteVehicle(${JSON.stringify(v.id)})'>Löschen</button>
      </div>
    </div>`).join("");
}
async function deleteVehicle(id) {
  if (!confirm("Fahrzeug wirklich löschen?")) return;
  const { error } = await sb.from("vehicles").delete().eq("id", id);
  if (error) toast(error.message); else { toast("Gelöscht."); loadVehicles(); }
}
async function openVehicleForm(editId) {
  let v = {};
  if (editId) { const { data } = await sb.from("vehicles").select("*").eq("id", editId).maybeSingle(); v = data || {}; }
  const years = []; for (let y = 2026; y >= 1990; y--) years.push(y);
  openModal(`
    <h2 style="font-size:20px;font-weight:800">${editId ? "Fahrzeug bearbeiten" : "Fahrzeug anlegen"}</h2>
    <div class="label">1 · Marke</div>
    <select id="cMake">${opt("Marke wählen…", Object.keys(BRANDS), v.make)}</select>
    <div class="label">2 · Modell</div>
    <select id="cModel" ${v.make ? "" : "disabled"}>${v.make ? opt("Modell wählen…", BRANDS[v.make] || [], v.model) : "<option value=''>Erst Marke wählen</option>"}</select>
    <div class="label">3 · Baureihe</div>
    <select id="cSeries" ${v.model ? "" : "disabled"}>${v.make && v.model ? opt("Baureihe wählen…", seriesFor(v.make, v.model), v.series) : "<option value=''>Erst Modell wählen</option>"}</select>
    <div class="split">
      <div><div class="label">4 · Karosserie</div><select id="cBody">${opt("Wählen…", BODIES, v.body_type)}</select></div>
      <div><div class="label">5 · Baujahr</div><select id="cYear">${opt("Wählen…", years, v.year)}</select></div>
    </div>
    <div class="split">
      <div><div class="label">6 · Motor</div><select id="cEngine">${opt("Wählen…", v.make && ENGINES[v.make] ? ENGINES[v.make] : ENGINE_DEFAULT, v.engine)}</select></div>
      <div><div class="label">7 · Kraftstoff</div><select id="cFuel">${opt("Wählen…", FUELS, v.fuel)}</select></div>
    </div>
    <div class="split">
      <div><div class="label">8 · PS</div><select id="cPs">${opt("Wählen…", PS_LIST, v.power_ps)}</select></div>
      <div><div class="label">9 · Getriebe</div><select id="cTrans">${opt("Wählen…", TRANS, v.transmission)}</select></div>
    </div>
    <div class="label">10 · Kilometerstand</div>
    <select id="cKm">${opt("Wählen…", KM_STEPS.map(k => k[1]), kmLabel(v.mileage))}</select>
    <div class="split">
      <div><div class="label">Kennzeichen (optional)</div><input id="cPlate" placeholder="K-XX 1234" value="${esc(v.license_plate || "")}"></div>
      <div><div class="label">TÜV gültig bis (optional)</div><input id="cTuev" type="date" value="${esc(v.tuev_until || "")}"></div>
    </div>
    <div class="label">Fahrzeugschein (optional, privat)</div>
    <input type="file" id="cDoc" accept="image/*,.pdf" style="padding:9px">
    ${v.registration_doc ? '<p class="mm" style="margin-top:5px">📄 Bereits hinterlegt – neue Datei ersetzt die alte.</p>' : ""}
    <div class="btnRow">
      <button class="btn" id="cSave">${editId ? "Speichern" : "Fahrzeug anlegen"}</button>
      <button class="btn ghost" onclick="closeModal()">Abbrechen</button>
    </div>
    <div class="err" id="cErr"></div>`);
  $("cMake").onchange = () => {
    const mk = $("cMake").value;
    $("cModel").disabled = !mk;
    $("cModel").innerHTML = mk ? opt("Modell wählen…", BRANDS[mk] || []) : "<option value=''>Erst Marke wählen</option>";
    $("cSeries").disabled = true; $("cSeries").innerHTML = "<option value=''>Erst Modell wählen</option>";
    $("cEngine").innerHTML = opt("Wählen…", ENGINES[mk] || ENGINE_DEFAULT);
  };
  $("cModel").onchange = () => {
    const mk = $("cMake").value, mo = $("cModel").value;
    $("cSeries").disabled = !mo;
    $("cSeries").innerHTML = mo ? opt("Baureihe wählen…", seriesFor(mk, mo)) : "<option value=''>Erst Modell wählen</option>";
  };
  $("cSave").onclick = async () => {
    const err = $("cErr"); err.style.display = "none";
    for (const fid of ["cMake", "cModel", "cSeries", "cBody", "cYear", "cEngine", "cFuel", "cPs", "cTrans", "cKm"]) {
      if (!$(fid).value) return showErr(err, "Bitte alle 10 Schritte ausfüllen.");
    }
    $("cSave").disabled = true;
    let docPath = v.registration_doc || null;
    const f = $("cDoc").files[0];
    if (f && f.size < 10 * 1024 * 1024) {
      const path = `${me.id}/schein_${Date.now()}_${f.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await sb.storage.from("documents").upload(path, f);
      if (!upErr) docPath = path;
    }
    const kmVal = KM_STEPS.find(k => k[1] === $("cKm").value);
    const row = {
      owner_id: me.id, make: $("cMake").value, model: $("cModel").value, series: $("cSeries").value,
      body_type: $("cBody").value, year: +$("cYear").value, engine: $("cEngine").value, fuel: $("cFuel").value,
      power_ps: +$("cPs").value, transmission: $("cTrans").value, mileage: kmVal ? kmVal[0] : null,
      license_plate: $("cPlate").value.trim() || null, tuev_until: $("cTuev").value || null,
      registration_doc: docPath,
    };
    const q = editId ? sb.from("vehicles").update(row).eq("id", editId) : sb.from("vehicles").insert(row);
    const { error } = await q;
    $("cSave").disabled = false;
    if (error) return showErr(err, error.message);
    closeModal(); toast(editId ? "Gespeichert ✓" : "Fahrzeug angelegt ✓");
    loadVehicles();
  };
}
function seriesFor(make, model) { return (SERIES[make + "|" + model] || []).concat(["Keine Angabe"]); }
function kmLabel(m) { if (!m) return ""; const f = KM_STEPS.find(k => k[0] === Number(m)); return f ? f[1] : ""; }

// ============================================================
// ERINNERUNGEN (Premium)
// ============================================================
const REMINDER_KINDS = { tuev: ["📋", "TÜV / HU"], service: ["🛠️", "Service / Inspektion"], reifen: ["🛞", "Reifenwechsel"], custom: ["🔔", "Eigene Erinnerung"] };
async function vReminders() {
  if (!requireAuth()) return;
  if (!myProfile?.is_premium) {
    main.innerHTML = `
    <div class="pageHead"><div><h1>Erinnerungen</h1><div class="sub">Nie wieder TÜV, Service oder Reifenwechsel verpassen.</div></div></div>
    <div class="card" style="max-width:560px;margin:30px auto;text-align:center;border-color:rgba(255,176,32,.4)">
      <div style="font-size:44px">👑</div>
      <h2 style="font-size:22px;font-weight:800;margin-top:10px">Carfixo Premium</h2>
      <p class="mm" style="margin-top:10px;font-size:13.5px">Automatische Erinnerungen, wenn dein TÜV abläuft, ein Service ansteht oder der saisonale Reifenwechsel fällig ist – inklusive passender Angebote aus deiner Nähe.</p>
      <div class="chips" style="justify-content:center;margin-top:16px">
        <span class="pill">📋 TÜV-Warnung</span><span class="pill">🛠️ Service-Intervalle</span><span class="pill">🛞 Saison-Reifen</span>
      </div>
      <button class="btn wide" style="margin-top:20px" id="premGo">Premium aktivieren – in der Beta kostenlos</button>
    </div>`;
    $("premGo").onclick = async () => {
      const { error } = await sb.from("profiles").update({ is_premium: true }).eq("id", me.id);
      if (error) return toast(error.message);
      myProfile.is_premium = true;
      toast("Premium aktiviert 👑");
      vReminders();
    };
    return;
  }
  main.innerHTML = `
  <div class="pageHead">
    <div><h1>Erinnerungen <span class="badge b-gold">👑 Premium</span></h1><div class="sub">Deine anstehenden Termine rund ums Auto.</div></div>
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
  if (!data || data.length === 0) { box.innerHTML = `<div class="empty"><div class="e">🔔</div>Keine Erinnerungen. Lege eine an oder übernimm TÜV-Termine aus deinen Fahrzeugen.</div>`; return; }
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
        <div class="mm">📅 ${fmtDate(rm.due_date)}${rm.vehicles ? " · 🚗 " + esc(rm.vehicles.make + " " + rm.vehicles.model) : ""}${rm.note ? " · " + esc(rm.note) : ""}</div></div>
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
    closeModal(); toast("Erinnerung angelegt 🔔");
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
        <div class="mm">${esc(me.email)} · Rolle: ${isWs ? "Betrieb" : myProfile?.role === "admin" ? "Admin" : "Kunde"}${myProfile?.is_premium ? " · 👑 Premium" : ""}</div></div>
      </div>
      <div class="label">Name</div>
      <input id="accName" value="${esc(myProfile?.full_name || "")}">
      <div class="label">Telefon</div>
      <input id="accPhone" value="${esc(myProfile?.phone || "")}" placeholder="+49 …">
      <button class="btn" style="margin-top:16px" id="accSave">Speichern</button>
    </div>
    <div>
      ${isWs ? `<div class="card" style="margin-bottom:14px">
        <div class="tt">🏪 ${esc(myWorkshop.name)}</div>
        <p class="mm" style="margin-top:6px">${myWorkshop.is_verified ? '<span class="badge b-green">✓ verifiziert</span> Dein Betrieb ist sichtbar und kann Angebote senden.' : '<span class="badge b-gold">Warten auf Verifizierung</span> Ein Admin prüft deinen Betrieb.'}</p>
        <a class="btn ghost sm" style="margin-top:12px" href="#/ws/profile">Betriebsprofil bearbeiten</a>
      </div>` : `<div class="card" style="margin-bottom:14px">
        <div class="tt">👑 Carfixo Premium</div>
        <p class="mm" style="margin-top:6px">${myProfile?.is_premium ? "Aktiv – du bekommst Erinnerungen für TÜV, Service und Reifen." : "Erinnerungen für TÜV, Service & saisonale Reifenwechsel."}</p>
        <button class="btn ghost sm" style="margin-top:12px" id="premToggle">${myProfile?.is_premium ? "Premium deaktivieren" : "Premium aktivieren (Beta: kostenlos)"}</button>
      </div>`}
      ${myProfile?.role === "admin" ? `<div class="card" style="margin-bottom:14px"><div class="tt">🛡️ Admin</div><a class="btn ghost sm" style="margin-top:12px" href="admin.html">Admin-Bereich öffnen</a></div>` : ""}
      <div class="card">
        <div class="tt">Abmelden</div>
        <p class="mm" style="margin-top:6px">Du kannst dich jederzeit wieder anmelden.</p>
        <button class="btn red sm" style="margin-top:12px" onclick="signOut()">Abmelden</button>
      </div>
    </div>
  </div>`;
  $("accSave").onclick = async () => {
    const { error } = await sb.from("profiles").update({ full_name: $("accName").value.trim() || null, phone: $("accPhone").value.trim() || null }).eq("id", me.id);
    if (error) return toast(error.message);
    myProfile.full_name = $("accName").value.trim();
    toast("Gespeichert ✓");
    renderNav("account");
  };
  const pt = $("premToggle");
  if (pt) pt.onclick = async () => {
    const nv = !myProfile.is_premium;
    const { error } = await sb.from("profiles").update({ is_premium: nv }).eq("id", me.id);
    if (error) return toast(error.message);
    myProfile.is_premium = nv;
    toast(nv ? "Premium aktiviert 👑" : "Premium deaktiviert.");
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
    <div class="sub">${myWorkshop.is_verified ? "✓ Verifiziert – du siehst passende Ausschreibungen live." : "⏳ Noch nicht verifiziert – ein Admin prüft deinen Betrieb. Vervollständige solange dein Profil."}</div></div>
    <div class="right"><a class="btn ghost sm" href="#/ws/profile">Profil</a></div>
  </div>
  ${!myWorkshop.is_verified ? `<div class="warn">Dein Betrieb ist noch nicht freigeschaltet. Sobald ein Admin dich verifiziert, siehst du offene Ausschreibungen und kannst Angebote senden.</div>` : ""}
  <div class="kpiRow" id="kpis">
    <div class="kpi"><b class="sk" style="width:40px;height:26px;display:block"></b><span>Offene Anfragen</span></div>
    <div class="kpi"><b>–</b><span>Gesendete Angebote</span></div>
    <div class="kpi"><b>–</b><span>Aktive Aufträge</span></div>
    <div class="kpi"><b>–</b><span>Bewertung</span></div>
  </div>
  <div class="grid2" style="align-items:start">
    <div class="card"><div class="tt">📢 Neueste Anfragen</div><div id="dashLeads" style="margin-top:12px"><div class="sk" style="height:80px"></div></div>
      <a class="btn ghost sm" style="margin-top:6px" href="#/ws/leads">Alle Anfragen →</a></div>
    <div class="card"><div class="tt">🗂️ Aktuelle Aufträge</div><div id="dashJobs" style="margin-top:12px"><div class="sk" style="height:80px"></div></div>
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
        <div class="cardHead"><div class="ico">🔧</div>
        <div style="flex:1"><div class="tt" style="font-size:13px">${esc(b.offers?.requests?.title || "Auftrag")}</div>
        <div class="mm">${fmtEur(b.total_price)}${b.scheduled_at ? " · 📅 " + fmtDateTime(b.scheduled_at) : ""}</div></div>
        <span class="badge ${BK_STATUS[b.status]?.[1] || "b-grey"}">${BK_STATUS[b.status]?.[0] || b.status}</span></div>
      </div>`).join("");
}
function leadRowHtml(r) {
  const c = CATS[r.category] || { icon: "🔧", name: r.category };
  return `<div class="card tap" style="margin-bottom:9px;padding:13px" onclick="go('ws/lead/${r.id}')">
    <div class="cardHead"><div class="ico">${c.icon}</div>
      <div style="flex:1;min-width:0"><div class="tt" style="font-size:13px">${esc(r.title)} ${r.type === "direct" ? '<span class="badge b-purple">📩 Direkt an dich</span>' : ""}</div>
      <div class="mm">🚗 ${esc(r.vehicle_label || "k.A.")}</div>
      <div class="mm">${c.name}${r.district ? " · 📍 " + esc(r.district) : ""}${r.asap ? " · ⚡ ASAP" : ""}${r.budget_max ? " · 💶 bis " + fmtEur(r.budget_max) : ""}</div></div>
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
    <div data-t="open" class="${leadTab === "open" ? "on" : ""}">📢 Ausschreibungen</div>
    <div data-t="direct" class="${leadTab === "direct" ? "on" : ""}">📩 Direktanfragen</div>
    <div data-t="mine" class="${leadTab === "mine" ? "on" : ""}">📤 Meine Angebote</div>
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
      ? `<div class="empty"><div class="e">📤</div>Noch keine Angebote gesendet.</div>`
      : offers.map(o => `
        <div class="card tap" style="margin-bottom:11px" onclick="go('ws/lead/${o.requests?.id}')">
          <div class="cardHead"><div class="ico">📤</div>
            <div style="flex:1"><div class="tt">${esc(o.requests?.title || "Anfrage")}</div>
            <div class="mm">🚗 ${esc(o.requests?.vehicle_label || "")} · Angebot: <b>${fmtEur(o.total_price)}</b> · ${fmtDate(o.created_at)}</div></div>
            <span class="badge ${o.status === "accepted" ? "b-green" : o.status === "declined" ? "b-grey" : "b-blue"}">${o.status === "accepted" ? "Angenommen ✓" : o.status === "declined" ? "Abgelehnt" : "Gesendet"}</span></div>
        </div>`).join("");
    return;
  }
  const { data, error } = await sb.from("requests").select("*").eq("status", "open").order("created_at", { ascending: false });
  if (error) { box.innerHTML = `<div class="warn">${esc(error.message)}</div>`; return; }
  const list = (data || []).filter(r => leadTab === "direct" ? (r.type === "direct" && r.workshop_id === myWorkshop.id) : r.type === "open");
  box.innerHTML = list.length === 0
    ? `<div class="empty"><div class="e">${leadTab === "direct" ? "📩" : "📭"}</div>${leadTab === "direct" ? "Keine Direktanfragen – Kunden finden dich über dein Profil in der Suche." : "Keine offenen Ausschreibungen in deinen Kategorien. Neue erscheinen automatisch."}</div>`
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
  const { data: myOffer } = await sb.from("offers").select("*").eq("request_id", id).eq("workshop_id", myWorkshop.id).maybeSingle();
  const c = CATS[r.category] || { icon: "🔧", name: r.category };
  main.innerHTML = `
  <div class="pageHead">
    <div class="ico" style="width:52px;height:52px;font-size:23px">${c.icon}</div>
    <div style="flex:1"><h1>${esc(r.title)}</h1>
    <div class="sub">🚗 ${esc(r.vehicle_label || "k.A.")} · ${c.name}${r.type === "direct" ? " · 📩 Direktanfrage an dich" : ""}</div></div>
  </div>
  <div class="grid2" style="align-items:start">
    <div>
      <div class="card" style="margin-bottom:14px">
        <div class="tt">Anfrage-Details</div>
        <p class="mm" style="margin-top:8px;font-size:13px">${esc(r.description)}</p>
        <div class="chips" style="margin-top:10px">
          ${(r.extras?.leistungen || []).map(s => `<span class="pill">${esc(s)}</span>`).join("")}
          ${r.budget_max ? `<span class="pill">💶 Budget bis ${fmtEur(r.budget_max)}</span>` : ""}
          ${r.district ? `<span class="pill">📍 ${esc(r.district)}${r.zip ? " (" + esc(r.zip) + ")" : ""}</span>` : ""}
          ${r.asap ? `<span class="pill">⚡ ASAP</span>` : ""}
          ${r.preferred_date ? `<span class="pill">📅 ${fmtDate(r.preferred_date)}</span>` : ""}
          ${r.service_preference === "mobile" ? `<span class="pill">🚐 Mobiler Service gewünscht</span>` : ""}
        </div>
        ${(r.attachments || []).length ? `<div class="thumbs">${r.attachments.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Foto"></a>`).join("")}</div>` : ""}
      </div>
      <div class="card" id="offerBox">
        ${myOffer ? `
          <div class="tt">Dein Angebot <span class="badge ${myOffer.status === "accepted" ? "b-green" : myOffer.status === "declined" ? "b-grey" : "b-blue"}">${myOffer.status === "accepted" ? "Angenommen ✓" : myOffer.status === "declined" ? "Abgelehnt" : "Gesendet"}</span></div>
          <div style="margin-top:10px">${(myOffer.line_items || []).map(li => `<div class="offerLine"><span>${esc(li.label)}</span><span>${fmtEur(li.price)}</span></div>`).join("")}
          <div class="offerLine total"><span>Gesamt inkl. MwSt.</span><span>${fmtEur(myOffer.total_price)}</span></div></div>
          ${myOffer.message ? `<p class="mm" style="margin-top:8px">💬 ${esc(myOffer.message)}</p>` : ""}`
        : r.status !== "open" ? `<div class="tt">Diese Anfrage ist nicht mehr offen.</div>`
        : `
          <div class="tt">Angebot senden</div>
          <div class="label">Positionen</div>
          <div id="liBox">
            <div class="split" style="margin-bottom:8px"><input placeholder="z.B. Bremsbeläge vorne (Material)" class="liL"><input placeholder="€" inputmode="decimal" class="liP" style="max-width:110px"></div>
            <div class="split" style="margin-bottom:8px"><input placeholder="z.B. Arbeitszeit" class="liL"><input placeholder="€" inputmode="decimal" class="liP" style="max-width:110px"></div>
          </div>
          <button class="btn ghost sm" id="liAdd">＋ Position</button>
          <div class="label">Nachricht an den Kunden (optional)</div>
          <textarea id="oMsg" placeholder="z.B. Termin diese Woche möglich, Originalteile inklusive…" style="min-height:64px"></textarea>
          <button class="btn wide" style="margin-top:14px" id="oGo">Angebot verbindlich senden</button>
          <div class="err" id="oErr"></div>`}
      </div>
    </div>
    <div class="card">
      <div class="tt">💬 Rückfragen an den Kunden</div>
      <div class="msgs" id="msgs"></div>
      <div class="msgRow"><input id="msgIn" placeholder="Nachricht schreiben…"><button id="msgGo">➤</button></div>
    </div>
  </div>`;
  if ($("liAdd")) {
    $("liAdd").onclick = () => {
      const d = document.createElement("div");
      d.className = "split"; d.style.marginBottom = "8px";
      d.innerHTML = '<input placeholder="Position" class="liL"><input placeholder="€" inputmode="decimal" class="liP" style="max-width:110px">';
      $("liBox").appendChild(d);
    };
    $("oGo").onclick = () => sendOffer(r.id);
  }
  $("msgGo").onclick = () => sendMsg(r.id);
  $("msgIn").onkeydown = (e) => { if (e.key === "Enter") sendMsg(r.id); };
  await loadMsgs(r.id);
  const ch = sb.channel("ws-lead:" + r.id)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "request_id=eq." + r.id }, () => loadMsgs(r.id))
    .subscribe();
  rtChannels.push(ch);
}
async function sendOffer(requestId) {
  const err = $("oErr"); err.style.display = "none";
  const labels = [...document.querySelectorAll(".liL")].map(i => i.value.trim());
  const prices = [...document.querySelectorAll(".liP")].map(i => parseFloat((i.value || "").replace(",", ".")));
  const items = [];
  labels.forEach((l, i) => { if (l && prices[i] > 0) items.push({ label: l, price: prices[i] }); });
  if (items.length === 0) return showErr(err, "Mindestens eine Position mit Preis angeben.");
  const total = items.reduce((s, x) => s + x.price, 0);
  $("oGo").disabled = true;
  const { error } = await sb.from("offers").insert({
    request_id: requestId, workshop_id: myWorkshop.id,
    line_items: items, total_price: total, vat_rate: 19,
    message: $("oMsg").value.trim() || null, status: "sent",
  });
  $("oGo").disabled = false;
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
  <div class="pageHead"><div><h1>Aufträge</h1><div class="sub">Gebuchte Aufträge – Status pflegen, Termin setzen, mit dem Kunden chatten.</div></div>
  <div class="right"><a class="btn ghost sm" href="#/ws/calendar">📅 Kalender</a></div></div>
  <div id="jobList"><div class="sk" style="height:110px"></div></div>`;
  await loadWsJobs();
}
async function loadWsJobs() {
  const { data, error } = await sb.from("bookings")
    .select("*, offers(request_id, requests(title,description,category,vehicle_label,district,extras)), profiles:customer_id(full_name,email,phone)")
    .eq("workshop_id", myWorkshop.id).order("created_at", { ascending: false });
  const box = $("jobList"); if (!box) return;
  if (error) { box.innerHTML = `<div class="warn">${esc(error.message)}</div>`; return; }
  if (!data || data.length === 0) { box.innerHTML = `<div class="empty"><div class="e">🗂️</div>Noch keine gebuchten Aufträge. Sobald ein Kunde dein Angebot annimmt, erscheint der Auftrag hier.</div>`; return; }
  box.innerHTML = data.map(b => {
    const r = b.offers?.requests || {};
    const c = CATS[r.category] || { icon: "🔧", name: r.category || "" };
    const s = BK_STATUS[b.status] || ["?", "b-grey"];
    const cust = b.profiles?.full_name || b.profiles?.email || "Kunde";
    return `<div class="card" style="margin-bottom:12px">
      <div class="cardHead"><div class="ico">${c.icon}</div>
        <div style="flex:1;min-width:0"><div class="tt">${esc(r.title || "Auftrag")}</div>
        <div class="mm">👤 ${esc(cust)}${b.profiles?.phone ? " · 📞 " + esc(b.profiles.phone) : ""} · <b>${fmtEur(b.total_price)}</b></div>
        <div class="mm">🚗 ${esc(r.vehicle_label || "k.A.")}${b.scheduled_at ? " · 📅 " + fmtDateTime(b.scheduled_at) : " · 📅 kein Termin"}</div></div>
        <span class="badge ${s[1]}">${s[0]}</span></div>
      <div class="foot">
        <select style="width:auto;flex:1;min-width:150px;padding:9px" onchange="setJobStatus('${b.id}',this.value)">
          ${Object.entries(BK_STATUS).map(([k, v]) => `<option value="${k}" ${k === b.status ? "selected" : ""}>${v[0]}</option>`).join("")}
        </select>
        <button class="btn ghost sm" onclick="setJobDate('${b.id}','${b.scheduled_at || ""}')">📅 Termin</button>
        <button class="btn ghost sm" onclick="go('ws/lead/${b.offers?.request_id}')">💬 Chat</button>
      </div>
    </div>`;
  }).join("");
}
async function setJobStatus(id, status) {
  const { error } = await sb.from("bookings").update({ status }).eq("id", id);
  if (error) toast(error.message); else { toast("Status aktualisiert ✓"); loadWsJobs(); }
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
    const { error } = await sb.from("bookings").update({ scheduled_at: new Date(v).toISOString(), status: "ready" }).eq("id", id);
    if (error) return toast(error.message);
    closeModal(); toast("Termin gesetzt 📅");
    if ($("jobList")) loadWsJobs(); else vWsCalendar();
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
async function vWsProfile() {
  if (needWorkshop()) return;
  const w = myWorkshop;
  profCats = [...(w.categories || [])];
  profServices = [...(w.services || [])];
  profBrands = [...(w.brands || [])];
  profLatLng = w.lat != null ? [w.lat, w.lng] : null;
  const oh = w.opening_hours || {};
  const days = [["mo", "Mo"], ["di", "Di"], ["mi", "Mi"], ["do", "Do"], ["fr", "Fr"], ["sa", "Sa"], ["so", "So"]];
  main.innerHTML = `
  <div class="pageHead">
    <div><h1>Betriebsprofil</h1>
    <div class="sub">Je vollständiger dein Profil, desto besser wirst du gefunden. ${w.is_verified ? '<span class="badge b-green">✓ verifiziert</span>' : '<span class="badge b-gold">Verifizierung ausstehend</span>'}</div></div>
    <div class="right"><button class="btn sm" id="pSave">Alles speichern</button></div>
  </div>
  <div class="grid2" style="align-items:start">
    <div>
      <div class="card" style="margin-bottom:14px">
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
      <div class="card" style="margin-bottom:14px">
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
        <div class="mapWrap" style="height:230px"><div id="obMap"></div></div>
        <p class="mm" id="pLatLng" style="margin-top:6px">${profLatLng ? "📍 Standort gesetzt" : "Noch kein Standort – auf die Karte klicken oder Stadtteil wählen."}</p>
      </div>
      <div class="card">
        <div class="tt">Öffnungszeiten</div>
        ${days.map(([k, label]) => `
          <div class="split" style="margin-top:8px;align-items:center">
            <span style="flex:0 0 36px;font-size:12.5px;font-weight:700">${label}</span>
            <input data-oh="${k}" value="${esc(oh[k] || "")}" placeholder="z.B. 08:00–18:00 (leer = geschlossen)">
          </div>`).join("")}
      </div>
    </div>
    <div>
      <div class="card" style="margin-bottom:14px">
        <div class="tt">Kategorien</div>
        <p class="mm" style="margin-top:4px">Du siehst nur Ausschreibungen aus deinen Kategorien.</p>
        <div class="catGrid" id="pCats" style="margin-top:10px">${Object.entries(CATS).map(([k, v]) => `
          <div class="catCard ${profCats.includes(k) ? "on" : ""}" data-k="${k}"><span class="ce">${v.icon}</span><span class="cn">${v.name}</span></div>`).join("")}</div>
      </div>
      <div class="card" style="margin-bottom:14px">
        <div class="tt">Leistungen im Detail</div>
        <p class="mm" style="margin-top:4px">Danach filtern Kunden in der Suche.</p>
        <div id="pServices" style="margin-top:6px"></div>
      </div>
      <div class="card">
        <div class="tt">Fahrzeugmarken</div>
        <p class="mm" style="margin-top:4px">Leer lassen = alle Marken.</p>
        <div class="chips" id="pBrands" style="margin-top:10px">${Object.keys(BRANDS).map(b => `
          <span class="chip ${profBrands.includes(b) ? "on" : ""}" data-b="${esc(b)}">${esc(b)}</span>`).join("")}</div>
      </div>
    </div>
  </div>
  <div class="err" id="pErr"></div>`;

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
  renderProfServices();

  profMap = L.map("obMap", { scrollWheelZoom: false }).setView(profLatLng || CITY_CENTER, profLatLng ? 14 : 11);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(profMap);
  if (profLatLng) profMarker = L.marker(profLatLng, { draggable: true }).addTo(profMap);
  profMap.on("click", (e) => setProfLatLng([e.latlng.lat, e.latlng.lng]));
  $("pDistrict").onchange = () => {
    const d = DISTRICTS[$("pDistrict").value];
    if (d) { setProfLatLng(d); profMap.setView(d, 14); }
  };
  $("pSave").onclick = saveWsProfile.bind(null, () => priceLevel);
}
function setProfLatLng(ll) {
  profLatLng = ll;
  if (profMarker) profMarker.setLatLng(ll);
  else { profMarker = L.marker(ll, { draggable: true }).addTo(profMap); profMarker.on("dragend", () => { const p = profMarker.getLatLng(); profLatLng = [p.lat, p.lng]; }); }
  $("pLatLng").textContent = "📍 Standort gesetzt";
}
function renderProfServices() {
  $("pServices").innerHTML = profCats.length === 0
    ? '<p class="mm">Wähle zuerst Kategorien.</p>'
    : profCats.map(k => `
      <div class="label">${CATS[k].icon} ${CATS[k].name}</div>
      <div class="chips">${CATS[k].services.map(s => `
        <span class="chip ${profServices.includes(s) ? "on" : ""}" data-sv="${esc(s)}">${esc(s)}</span>`).join("")}</div>`).join("");
  document.querySelectorAll("#pServices .chip").forEach(c => c.onclick = () => {
    const s = c.dataset.sv;
    const i = profServices.indexOf(s);
    if (i >= 0) profServices.splice(i, 1); else profServices.push(s);
    c.classList.toggle("on");
  });
}
async function saveWsProfile(getPriceLevel) {
  const err = $("pErr"); err.style.display = "none";
  if (!$("pName").value.trim()) return showErr(err, "Bitte einen Namen angeben.");
  if (profCats.length === 0) return showErr(err, "Bitte mindestens eine Kategorie wählen.");
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
  };
  const { error } = await sb.from("workshops").update(row).eq("id", myWorkshop.id);
  if (error) return showErr(err, error.message);
  Object.assign(myWorkshop, row);
  allWorkshops = null;
  toast("Profil gespeichert ✓");
}

// ============================================================
// Start
// ============================================================
window.addEventListener("hashchange", route);
sb.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") { me = null; myProfile = null; myWorkshop = null; }
});
(async () => {
  await loadSession();
  // Werkstatt-Registrierung nach E-Mail-Bestätigung abschließen
  if (me && !myWorkshop && localStorage.getItem("cfx_pending_ws") && myProfile?.role === "customer") {
    await createWorkshopForMe(localStorage.getItem("cfx_pending_ws"));
    localStorage.removeItem("cfx_pending_ws");
  }
  route();
})();
