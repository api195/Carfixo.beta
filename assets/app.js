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
  "diagnose": vDiagnose, "notfall": vNotfall, "vergleich": vCompare,
  "requests": vRequests, "request": vRequestDetail,
  "vehicles": vVehicles, "vehicle": vVehicleRecord, "reminders": vReminders, "account": vAccount,
  "ws/dashboard": vWsDashboard, "ws/leads": vWsLeads, "ws/lead": vWsLead,
  "ws/jobs": vWsJobs, "ws/calendar": vWsCalendar, "ws/profile": vWsProfile,
  "ws/stats": vWsStats, "ws/archive": vWsArchive,
};
const CUSTOMER_NAV = [["search", "🔍", "Suche"], ["diagnose", "🤖", "Diagnose"], ["requests", "📢", "Aufträge"], ["vehicles", "🚗", "Fahrzeuge"], ["reminders", "🔔", "Erinnerungen"]];
const WS_NAV = [["ws/dashboard", "📊", "Dashboard"], ["ws/leads", "📢", "Anfragen"], ["ws/jobs", "🗂️", "Aufträge"], ["ws/calendar", "📅", "Kalender"], ["ws/profile", "🏪", "Profil"]];
const ANON_NAV = [["search", "🔍", "Suche"], ["diagnose", "🤖", "KI-Diagnose"], ["notfall", "🚨", "Notfall"]];

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
  const items = me ? (isWs ? WS_NAV : CUSTOMER_NAV) : ANON_NAV;
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
    sb.rpc("claim_membership").then(() => {});
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
// SUCHE (öffentlich) – Standort / Adresse / Radius
// ============================================================
let searchState = {
  world: "", cat: "", service: "", brand: "", radius: 25,
  openNow: false, pickup: false, replacement: false, mobile: false,
  minRating: 0, sort: "rating", shown: 12,
};
let searchOrigin = null, searchOriginLabel = "";   // [lat,lng] – Standort des Kunden
let allWorkshops = null, searchMap = null, compareSet = [];

async function vSearch() {
  const s = searchState;
  main.innerHTML = `
  <div class="pageHead">
    <div><h1>Werkstatt-Suche</h1>
    <div class="sub">Werkstätten, Tuning, Aufbereitung und Prüfstellen in deiner Nähe – nach Entfernung, Leistung und Bewertung gefiltert.</div></div>
    ${me && !myWorkshop ? `<div class="right"><a class="btn sm" href="#/new-request">＋ Ausschreibung</a></div>` : ""}
  </div>

  <div class="card" style="margin-bottom:16px;border-color:rgba(124,92,255,.35);background:linear-gradient(120deg,rgba(124,92,255,.1),var(--panel))">
    <div class="cardHead">
      <div class="ico icoPurple" style="width:48px;height:48px;font-size:22px">🤖</div>
      <div style="flex:1"><div class="tt">Nicht sicher, was dein Auto hat?</div>
      <div class="mm">Beschreibe das Problem, wähle Warnleuchten oder lade ein Foto hoch – die KI-Diagnose gibt dir eine unverbindliche Ersteinschätzung mit Preisorientierung.</div></div>
      <a class="btn sm" href="#/diagnose">KI-Diagnose starten</a>
    </div>
  </div>

  <div class="searchGrid">
    <div class="filterBox card">
      <div class="tt">Standort &amp; Umkreis</div>
      <div class="btnRow" style="margin-top:10px">
        <button class="btn ghost sm" id="locBtn">📍 Mein Standort</button>
      </div>
      <div class="split" style="margin-top:10px">
        <input id="locAddr" placeholder="Adresse oder Ort eingeben…" value="${esc(searchOriginLabel && !searchOriginLabel.startsWith("📍") ? searchOriginLabel : "")}">
        <button class="btn sm" id="locGo" style="flex:0 0 auto">Suchen</button>
      </div>
      <select id="fDistrict" style="margin-top:8px">${opt("… oder Kölner Stadtteil wählen", Object.keys(DISTRICTS), "")}</select>
      <p class="mm" id="locInfo" style="margin-top:7px">${searchOrigin ? "📍 " + esc(searchOriginLabel) : "Kein Standort gesetzt – Entfernungen ab Kölner Zentrum."}</p>
      <div class="label">Umkreis</div>
      <div class="chips" id="fRadius">
        ${RADIUS_STEPS.map(r => `<span class="chip ${s.radius === r ? "on" : ""}" data-r="${r}">${r} km</span>`).join("")}
        <span class="chip ${!s.radius ? "on" : ""}" data-r="">Alle</span>
      </div>

      <div class="tt" style="margin-top:20px">Filter</div>
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
      <div class="label">Ausstattung</div>
      <label class="inline"><input type="checkbox" id="fOpen" ${s.openNow ? "checked" : ""}> Jetzt geöffnet</label>
      <label class="inline"><input type="checkbox" id="fPickup" ${s.pickup ? "checked" : ""}> Hol- &amp; Bringservice</label>
      <label class="inline"><input type="checkbox" id="fReplace" ${s.replacement ? "checked" : ""}> Ersatzwagen</label>
      <label class="inline"><input type="checkbox" id="fMobile" ${s.mobile ? "checked" : ""}> Mobile Werkstatt</label>
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
      <div id="moreBox" style="text-align:center;margin-top:12px"></div>
    </div>
  </div>
  <div id="compareBar"></div>`;

  fillCatSelect();

  // Standort-Quellen
  $("locBtn").onclick = () => {
    if (!navigator.geolocation) return toast("Standort wird von diesem Gerät nicht unterstützt.");
    $("locBtn").disabled = true; $("locBtn").textContent = "📍 Suche Standort…";
    navigator.geolocation.getCurrentPosition(
      (pos) => { setSearchOrigin([pos.coords.latitude, pos.coords.longitude], "📍 Dein Standort"); $("locBtn").disabled = false; $("locBtn").textContent = "📍 Mein Standort"; },
      () => { toast("Standort nicht verfügbar – bitte Adresse eingeben."); $("locBtn").disabled = false; $("locBtn").textContent = "📍 Mein Standort"; },
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
    searchState = { world: "", cat: "", service: "", brand: "", radius: 25, openNow: false, pickup: false, replacement: false, mobile: false, minRating: 0, sort: "rating", shown: 12 };
    vSearch();
  };

  // Karte
  searchMap = L.map("map", { scrollWheelZoom: false }).setView(searchOrigin || CITY_CENTER, 12);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>', maxZoom: 19,
  }).addTo(searchMap);
  searchMap.on("click", (e) => setSearchOrigin([e.latlng.lat, e.latlng.lng], "Karten-Position"));

  if (!allWorkshops) {
    const { data, error } = await sb.from("workshops").select("*").eq("is_verified", true).order("rating_avg", { ascending: false }).limit(200);
    if (error) { $("results").innerHTML = `<div class="warn">${esc(error.message)}</div>`; return; }
    allWorkshops = data || [];
  }
  applyFilters();
}
function setSearchOrigin(ll, label) {
  searchOrigin = ll; searchOriginLabel = label;
  const info = $("locInfo");
  if (info) info.textContent = "📍 " + label;
  if (searchMap) searchMap.setView(ll, 12);
  toast("Standort gesetzt: " + label);
  applyFilters();
}
// Nominatim (OpenStreetMap) – funktioniert deutschlandweit
async function geocodeAddress() {
  const q = $("locAddr").value.trim();
  if (!q) return toast("Bitte eine Adresse oder einen Ort eingeben.");
  $("locGo").disabled = true; $("locGo").textContent = "…";
  try {
    const res = await fetch("https://nominatim.openstreetmap.org/search?format=json&countrycodes=de&limit=1&q=" + encodeURIComponent(q), { headers: { "Accept-Language": "de" } });
    const data = await res.json();
    if (!data || !data[0]) toast("Adresse nicht gefunden – bitte genauer eingeben.");
    else setSearchOrigin([+data[0].lat, +data[0].lon], data[0].display_name.split(",").slice(0, 2).join(","));
  } catch (e) {
    toast("Adresssuche gerade nicht erreichbar.");
  }
  $("locGo").disabled = false; $("locGo").textContent = "Suchen";
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
  if (!$("results") || !allWorkshops) return;
  const s = searchState;
  const origin = searchOrigin || CITY_CENTER;
  const w = WORLDS.find(x => x.key === s.world);
  let list = allWorkshops.filter(ws => {
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
    ? `<div class="empty"><div class="e">🔍</div>Keine Betriebe für diese Filter.<br>Tipp: Radius vergrößern oder eine <a href="#/new-request" style="color:var(--blue2)">Ausschreibung</a> erstellen – Betriebe melden sich bei dir.</div>`
    : visible.map(ws => wsCardHtml(ws)).join("");
  $("moreBox").innerHTML = list.length > s.shown
    ? `<button class="btn ghost sm" onclick="searchState.shown+=12;applyFilters()">Mehr anzeigen (${list.length - s.shown} weitere)</button>` : "";

  // Karte aktualisieren
  mapMarkers.forEach(m => searchMap.removeLayer(m));
  mapMarkers = [];
  if (searchOrigin) {
    const om = L.circleMarker(searchOrigin, { radius: 8, color: "#38BDF8", fillColor: "#38BDF8", fillOpacity: .9 }).addTo(searchMap);
    om.bindPopup("Dein Standort");
    mapMarkers.push(om);
  }
  visible.forEach(ws => {
    if (ws.lat == null || ws.lng == null) return;
    const icon = L.divIcon({ className: "", html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:linear-gradient(135deg,#2E77FF,#0A47C2);box-shadow:0 6px 16px rgba(30,107,255,.5);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:12px">${CATS[ws.categories[0]]?.icon || "🔧"}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 30] });
    const m = L.marker([ws.lat, ws.lng], { icon }).addTo(searchMap);
    m.bindPopup(`<b>${esc(ws.name)}</b><br><span style="color:#FFB020">${stars(ws.rating_avg)}</span> ${ws.rating_avg ?? "–"} · ${esc(ws.district || ws.city || "")}<br><a href="#/workshop/${ws.id}" style="color:#4D8DFF;font-weight:700">Profil ansehen →</a>`);
    mapMarkers.push(m);
  });
  if (mapMarkers.length) searchMap.fitBounds(L.featureGroup(mapMarkers).getBounds().pad(0.25));
  renderCompareBar();
}
function wsCardHtml(ws) {
  const d = ws._dist;
  const open = isOpenNow(ws.opening_hours);
  const inCompare = compareSet.includes(ws.id);
  return `<div class="card tap" style="margin-bottom:12px" onclick="go('workshop/${ws.id}')">
    <div class="wsCard">
      <div class="wsAv" style="${ws.logo_url ? `background-image:url('${esc(ws.logo_url)}');background-size:cover;background-position:center;color:transparent` : ""}">${esc(initials(ws.name))}</div>
      <div style="flex:1;min-width:0">
        <div class="tt">${esc(ws.name)} ${ws.is_premium ? '<span class="badge b-gold" style="vertical-align:2px">Gesponsert</span>' : ""}${ws.is_verified ? '<span class="badge b-green" style="vertical-align:2px">✓ verifiziert</span>' : ""}
          ${open === true ? '<span class="badge b-green" style="vertical-align:2px">Geöffnet</span>' : open === false ? '<span class="badge b-grey" style="vertical-align:2px">Geschlossen</span>' : ""}</div>
        <div class="ratingLine">${stars(ws.rating_avg)}<span class="cnt">${ws.rating_avg > 0 ? Number(ws.rating_avg).toLocaleString("de-DE") : "Neu"} · ${ws.rating_count || 0} Bewertungen</span></div>
        <div class="mm">📍 ${esc(ws.district || ws.city || "")}${d != null ? ` · ${d.toFixed(1).replace(".", ",")} km` : ""}${ws.service_mode !== "stationary" ? " · 🚐 mobil" : ""}${ws.pickup_service ? " · 🔁 Hol/Bring" : ""}${ws.replacement_car ? " · 🚗 Ersatzwagen" : ""}${ws.price_level ? " · " + priceLevelTxt(ws.price_level) : ""}</div>
        ${ws.next_free_date ? `<div class="mm" style="color:var(--green)">📅 Nächster freier Termin: ${new Date(ws.next_free_date) <= new Date() ? "heute" : fmtDate(ws.next_free_date)}</div>` : ""}
        <div class="chips" style="margin-top:9px">${ws.categories.slice(0, 4).map(c => `<span class="pill">${CATS[c]?.icon || ""} ${CATS[c]?.name || c}</span>`).join("")}</div>
      </div>
      <button class="btn ghost sm" style="flex-shrink:0" onclick="event.stopPropagation();toggleCompare('${ws.id}')">${inCompare ? "✓ Im Vergleich" : "⇄ Vergleichen"}</button>
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
    <div class="wsAv" style="width:64px;height:64px;font-size:23px;${ws.logo_url ? `background-image:url('${esc(ws.logo_url)}');background-size:cover;background-position:center;color:transparent;` : ""}${ws.cover_url ? "border:3px solid var(--bg);" : ""}">${esc(initials(ws.name))}</div>
    <div style="flex:1">
      <h1>${esc(ws.name)} ${ws.is_premium ? '<span class="badge b-gold" style="vertical-align:6px">Gesponsert</span>' : ""} ${ws.is_verified ? '<span class="badge b-green" style="vertical-align:6px">✓ Verifiziert durch Carfixo</span>' : ""}</h1>
      <div class="ratingLine" style="margin-top:4px">${stars(ws.rating_avg)}<span class="cnt">${ws.rating_avg > 0 ? Number(ws.rating_avg).toLocaleString("de-DE") : "Neu"} · ${ws.rating_count || 0} Bewertungen · 📍 ${esc(ws.district || ws.city || "Köln")}</span></div>
    </div>
    <div class="right">
      <button class="btn ghost sm" id="wsFav">🤍 Merken</button>
      <button class="btn ghost sm" onclick="openReportModal('workshop','${ws.id}','${ws.id}','${esc(ws.name)}')" title="Betrieb melden">🚩</button>
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
          ${ws.pickup_service ? '<span class="badge b-blue">🔁 Hol- & Bringservice</span>' : ""}
          ${ws.replacement_car ? '<span class="badge b-blue">🚗 Ersatzwagen</span>' : ""}
          ${ws.emergency_service ? '<span class="badge b-red">🚨 Notdienst</span>' : ""}
          ${ws.price_level ? `<span class="badge b-grey">Preisniveau ${priceLevelTxt(ws.price_level)}</span>` : ""}
          ${ws.hourly_rate ? `<span class="badge b-grey">Stundensatz ab ${Math.round(ws.hourly_rate)} €</span>` : ""}
          ${ws.next_free_date ? `<span class="badge b-green">📅 Frei ab ${new Date(ws.next_free_date) <= new Date() ? "heute" : fmtDate(ws.next_free_date)}</span>` : ""}
        </div>
        <div class="offerLine" style="margin-top:8px"><span>Abgeschlossene Aufträge über Carfixo</span><span><b>${ws.rating_count || 0}</b></span></div>
        ${(ws.payment_methods || []).length ? `<div class="offerLine"><span>Zahlungsmöglichkeiten</span><span>${ws.payment_methods.map(esc).join(" · ")}</span></div>` : ""}
      </div>
      ${(ws.gallery || []).length ? `<div class="card" style="margin-bottom:14px">
        <div class="tt">Einblicke & Referenzen</div>
        <div class="thumbs" style="margin-top:10px">${ws.gallery.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" loading="lazy" style="width:110px;height:110px" alt="Werkstattbild"></a>`).join("")}</div>
      </div>` : ""}
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
  $("wsFav").onclick = () => toggleFavorite(ws.id, $("wsFav"));
  if (me) {
    sb.from("favorites").select("workshop_id").eq("user_id", me.id).eq("workshop_id", ws.id).maybeSingle()
      .then(({ data }) => { if (data && $("wsFav")) $("wsFav").textContent = "❤️ Gemerkt"; });
  }
  // Vertrauenssignale: abgeschlossene Aufträge
  sb.from("reviews").select("id", { count: "exact", head: true }).eq("workshop_id", ws.id)
    .then(({ count }) => { /* Anzahl über Bewertungen sichtbar */ });
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
    const { data: ws } = await sb.from("workshops").select("id,name,categories").eq("id", query.ws).maybeSingle();
    nrTargetWs = ws;
    if (ws && ws.categories?.length && !query.cat) nrCat = ws.categories[0];
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
      <div class="label" style="margin-top:0">Fahrzeug *</div>
      <select id="nCar">${cars.map((c, i) => `<option value="${c.id}" ${i === 0 ? "selected" : ""}>${esc(carLabel(c))}</option>`).join("")}</select>
      <div class="label">Kategorie *</div>
      <div class="catGrid" id="nCats">${Object.entries(CATS).map(([k, v]) => `
        <div class="catCard ${k === nrCat ? "on" : ""}" data-k="${k}"><span class="ce">${v.icon}</span><span class="cn">${v.name}</span></div>`).join("")}</div>
      <div class="label">Gewünschte Leistungen (optional)</div>
      <div class="chips" id="nServices"></div>
      <div id="nPriceHint"></div>
      <div class="label">Titel *</div>
      <input id="nTitle" placeholder="z.B. Bremsen vorne erneuern" maxlength="80" value="${esc(query.title || "")}">
      <div class="label">Beschreibung *</div>
      <textarea id="nDesc" placeholder="Was ist das Problem? Was soll gemacht werden?">${esc(query.desc || "")}</textarea>
      <div class="uploadTile" style="margin-top:12px" onclick="$('nFile').click()">
        <div class="ico icoPurple">📷</div>
        <div><div class="tt" style="font-size:12.5px">Fotos vom Problem (optional)</div>
        <div class="mm">Bis zu 4 Bilder – hilft Betrieben bei der Einschätzung</div></div>
      </div>
      <input type="file" id="nFile" accept="image/*" multiple class="hidden">
      <div class="thumbs" id="nThumbs"></div>
      <button class="btn ghost sm" style="margin-top:10px" id="nAnalyze">🤖 Beschreibung analysieren (Beta)</button>
      <div id="nAiOut"></div>
    </div>
    <div class="card">
      <div class="label" style="margin-top:0">Dringlichkeit</div>
      <div class="seg" style="margin:4px 0 0" id="nUrgency">
        <div data-u="normal" class="${(query.urgency || "normal") === "normal" ? "on" : ""}">Normal</div>
        <div data-u="dringend" class="${query.urgency === "dringend" ? "on" : ""}">⚡ Dringend</div>
        <div data-u="notfall" class="${query.urgency === "notfall" ? "on" : ""}">🚨 Notfall</div>
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
    nrCat = c.dataset.k; nrServices = [];
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
    renderNrPriceHint();
  });
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
    <div class="note" style="margin-top:10px">💶 <b>Unverbindliche Preisorientierung:</b><br>
    ${hints.map(h => `${esc(h.s)}: häufig <b>${h.r.lo}–${h.r.hi} €</b>${h.r.note ? " (" + esc(h.r.note) + ")" : ""}`).join("<br>")}
    <br><span style="font-size:11px;opacity:.8">Der endgültige Preis hängt von Fahrzeug, Region und Befund ab und wird von der Werkstatt festgelegt.</span></div>`;
}
function handleNrFiles() {
  const files = [...$("nFile").files].slice(0, 4 - nrFiles.length);
  files.forEach(f => { if (f.size < 8 * 1024 * 1024) nrFiles.push(f); });
  $("nThumbs").innerHTML = nrFiles.map(f => `<img src="${URL.createObjectURL(f)}" loading="lazy" alt="">`).join("");
}
function runAiAnalyze() {
  const hits = aiAnalyze($("nTitle").value + " " + $("nDesc").value);
  $("nAiOut").innerHTML = hits.length === 0
    ? `<div class="warn" style="margin-top:12px">🤖 Keine eindeutige Einschätzung möglich – beschreibe das Problem etwas genauer (Geräusch, Warnlampe, wann tritt es auf?).</div>`
    : `<div class="note" style="margin-top:12px"><b>🤖 Unverbindliche Ersteinschätzung (Beta):</b><br>${hits.map((h, i) => `
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
  const title = $("nTitle").value.trim(), desc = $("nDesc").value.trim();
  if (!$("nCar").value) return showErr(err, "Bitte ein Fahrzeug wählen.");
  if (!title) return showErr(err, "Bitte einen Titel angeben.");
  if (!desc || desc.length < 10) return showErr(err, "Bitte das Problem kurz beschreiben (mind. 10 Zeichen).");
  const budget = ($("nBudget").value || "").trim();
  if (budget && !(parseFloat(budget.replace(",", ".")) > 0)) return showErr(err, "Das Budget muss eine Zahl sein.");
  const zip = $("nZip").value.trim();
  if (zip && !/^\d{5}$/.test(zip)) return showErr(err, "Die PLZ muss 5 Ziffern haben.");
  const carId = $("nCar").value;
  const car = cars.find(c => c.id === carId);
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
    category: nrCat, title, description: desc,
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
    <div class="right">
      <button class="btn ghost sm" onclick="openReportModal('request','${r.id}',null,'Auftrag melden')" title="Problem melden">🚩</button>
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
        <div class="wsAv" style="width:42px;height:42px;font-size:15px">${esc(initials(w.name))}</div>
        <div style="flex:1;min-width:0">
          <div class="tt"><a href="#/workshop/${w.id}" style="color:inherit">${esc(w.name || "Werkstatt")}</a>${w.is_verified ? " ✓" : ""}</div>
          <div class="ratingLine">${stars(w.rating_avg)}<span class="cnt">${w.rating_avg > 0 ? Number(w.rating_avg).toLocaleString("de-DE") : "Neu"} · ${w.rating_count || 0} Bew.${w.district ? " · 📍 " + esc(w.district) : ""}</span></div>
        </div>
        <div style="text-align:right"><b style="font-size:19px">${fmtEur(o.total_price)}</b><div class="mm">inkl. MwSt. · ${o.is_fixed_price === false ? "Kostenschätzung" : "Festpreis"}</div></div>
      </div>
      ${items ? `<div style="margin-top:10px">${items}</div>` : ""}
      ${p.labor_hours ? `<div class="mm" style="margin-top:6px">🔧 Arbeitszeit: ${p.labor_hours} h × ${fmtEur(p.hourly_rate || 0)}</div>` : ""}
      ${o.message ? `<p class="mm" style="margin-top:8px">💬 ${esc(o.message)}</p>` : ""}
      <div class="foot"><span class="mm">${fmtDate(o.created_at)}</span>${st}</div>
    </div>`;
  }).join("");
}

// ---------- Buchungsübersicht + Testzahlung (Stripe folgt zum Launch) ----------
function openCheckout(offerId, requestId) {
  const o = (window._offers || []).find(x => x.id === offerId);
  if (!o) return;
  const w = o.workshops || {};
  const net = Number(o.total_price) / 1.19;
  openModal(`
    <h2 style="font-size:20px;font-weight:800">Buchungsübersicht</h2>
    <div class="note" style="margin-top:12px">🧪 <b>Beta-Testmodus:</b> Zahlungen sind in der Beta noch nicht aktiv. Es wird nichts berechnet – der komplette Ablauf funktioniert trotzdem.</div>
    <div class="card" style="margin-top:8px;padding:14px">
      <div class="offerLine"><span>Werkstatt</span><span><b>${esc(w.name || "")}</b></span></div>
      ${(o.line_items || []).map(li => `<div class="offerLine"><span>${esc(li.label)}</span><span>${fmtEur(li.price)}</span></div>`).join("")}
      <div class="offerLine"><span>davon MwSt. (19 %)</span><span>${fmtEur(o.total_price - net)}</span></div>
      <div class="offerLine total"><span>Gesamt (${o.is_fixed_price === false ? "Kostenschätzung" : "Festpreis"})</span><span>${fmtEur(o.total_price)}</span></div>
    </div>
    <p class="mm" style="margin-top:10px;font-size:11px">
      Mit der Buchung nimmst du das Angebot verbindlich an; alle anderen Angebote werden abgelehnt.
      ${o.is_fixed_price === false ? "Bei einer Kostenschätzung kann sich der Preis nach Diagnose ändern – Zusatzarbeiten benötigen deine Freigabe." : ""}
      Stornierungsbedingungen: kostenfrei bis 24 h vor Termin (Platzhalter, final vor Launch).
      Die Reparaturleistung und Rechnung werden durch die ausgewählte Werkstatt erbracht.</p>
    <div class="btnRow">
      <button class="btn green" id="ckGo">🧪 Testbuchung abschließen</button>
      <button class="btn ghost" onclick="closeModal()">Abbrechen</button>
    </div>
    <div class="err" id="ckErr"></div>`);
  $("ckGo").onclick = async () => {
    $("ckGo").disabled = true; $("ckGo").textContent = "Wird gebucht…";
    const { data: bkId, error } = await sb.rpc("accept_offer", { p_offer_id: offerId });
    if (error) { $("ckGo").disabled = false; $("ckGo").textContent = "🧪 Testbuchung abschließen"; return showErr($("ckErr"), error.message); }
    await sb.from("bookings").update({ payment_status: "test_payment_confirmed" }).eq("id", bkId);
    closeModal();
    toast("Testbuchung bestätigt ✓");
    vRequestDetail(requestId);
  };
}

const PAY_LABELS = {
  none: ["Keine Zahlung", "b-grey"], payment_pending: ["Zahlung ausstehend", "b-gold"],
  payment_authorized: ["Zahlung autorisiert", "b-blue"], payment_paid: ["Bezahlt", "b-green"],
  payment_failed: ["Zahlung fehlgeschlagen", "b-red"], payment_refunded: ["Erstattet", "b-purple"],
  payment_cancelled: ["Zahlung storniert", "b-grey"], test_payment_confirmed: ["🧪 Testzahlung bestätigt", "b-green"],
  pending: ["Ausstehend", "b-gold"], paid: ["Bezahlt", "b-green"], refunded: ["Erstattet", "b-purple"],
};
const CANCEL_REASONS = ["Termin passt nicht mehr", "Problem hat sich erledigt", "Anderes Angebot gewählt", "Preis zu hoch", "Werkstatt nicht erreichbar", "Sonstiges"];

function bookingTimeline(status) {
  if (status === "cancelled") return `<div class="warn" style="margin:12px 0 0">Dieser Auftrag wurde storniert.</div>`;
  const idx = BK_FLOW.indexOf(status === "approval_needed" ? "in_progress" : status);
  return `<div style="display:flex;gap:4px;margin-top:14px;overflow-x:auto;padding-bottom:4px">
    ${BK_FLOW.map((k, i) => `
      <div style="flex:1;min-width:74px;text-align:center">
        <div style="height:4px;border-radius:2px;background:${i <= idx ? "var(--green)" : "rgba(255,255,255,.1)"}"></div>
        <div style="font-size:9px;font-weight:700;margin-top:5px;color:${i <= idx ? "var(--ink)" : "var(--muted)"}">${BK_STATUS[k][0]}</div>
      </div>`).join("")}
  </div>${status === "approval_needed" ? '<div class="warn" style="margin-top:10px">⚠️ Die Werkstatt wartet auf deine Freigabe für Zusatzarbeiten – siehe unten.</div>' : ""}`;
}

async function loadBookingBox(r) {
  const { data: bk } = await sb.from("bookings")
    .select("*, offers!inner(request_id,total_price,is_fixed_price,workshops(id,name,phone))")
    .eq("offers.request_id", r.id).eq("customer_id", me.id).maybeSingle();
  const box = $("bookingBox"); if (!box || !bk) return;
  const s = BK_STATUS[bk.status] || ["?", "b-grey"];
  const pay = PAY_LABELS[bk.payment_status] || PAY_LABELS.none;
  const w = bk.offers?.workshops || {};
  const active = !["completed", "cancelled"].includes(bk.status);
  const [{ data: rev }, { data: approvals }] = await Promise.all([
    sb.from("reviews").select("id,rating").eq("booking_id", bk.id).maybeSingle(),
    sb.from("approvals").select("*").eq("booking_id", bk.id).order("created_at", { ascending: false }),
  ]);
  box.innerHTML = `
  <div class="card" style="border-color:rgba(30,107,255,.4);margin-bottom:14px">
    <div class="cardHead"><div class="ico icoGreen">✅</div>
      <div style="flex:1"><div class="tt">Buchung ${esc(bk.booking_no || "")} · <a href="#/workshop/${w.id}" style="color:var(--blue2)">${esc(w.name || "Werkstatt")}</a></div>
      <div class="mm">Preis: <b>${fmtEur(bk.total_price)}</b> (${bk.offers?.is_fixed_price === false ? "Schätzung" : "Festpreis"})${bk.scheduled_at ? " · Termin: " + fmtDateTime(bk.scheduled_at) : ""}${w.phone ? " · 📞 " + esc(w.phone) : ""}</div>
      <div style="margin-top:6px"><span class="badge ${pay[1]}">${pay[0]}</span> ${bk.no_show ? `<span class="badge b-red">${bk.no_show === "customer" ? "Als nicht erschienen markiert" : "Werkstatt nicht erschienen"}</span>` : ""}</div></div>
      <span class="badge ${s[1]}">${s[0]}</span></div>
    ${bookingTimeline(bk.status)}
    ${bk.proposed_date && bk.reschedule_by === "workshop" ? `
      <div class="note" style="margin-top:12px">📅 Die Werkstatt schlägt einen neuen Termin vor: <b>${fmtDateTime(bk.proposed_date)}</b>
      <div class="btnRow"><button class="btn green sm" onclick="acceptProposedDate('${bk.id}','${r.id}')">Termin annehmen</button></div></div>` : ""}
    ${(approvals || []).map(a => approvalCardHtml(a, r.id)).join("")}
    ${bk.status === "completed" && !rev ? `<button class="btn wide" style="margin-top:14px" onclick="openReviewModal('${bk.id}','${w.id}','${esc(w.name)}','${r.id}')">⭐ Jetzt bewerten</button>` : ""}
    ${bk.status === "completed" && rev ? `<div class="okBox" style="margin-bottom:0;margin-top:14px">Deine Bewertung: <span style="color:var(--gold)">${stars(rev.rating)}</span> – danke!</div>` : ""}
    ${active ? `
    <div class="btnRow">
      ${["ready_for_pickup"].includes(bk.status) || true ? `<button class="btn green sm" onclick="completeBooking('${bk.id}','${r.id}')">Auftrag abschließen</button>` : ""}
      <button class="btn ghost sm" onclick="openReschedule('${bk.id}','${r.id}')">📅 Termin verschieben</button>
      <button class="btn red sm" onclick="openCancel('${bk.id}','${r.id}')">Stornieren</button>
    </div>` : ""}
    ${bookingDocsHtml(bk)}
    <p class="mm" style="margin-top:12px;font-size:11px">Die Reparaturleistung, Rechnung und Gewährleistung werden durch die ausgewählte Werkstatt erbracht.</p>
  </div>`;
}
function approvalCardHtml(a, reqId) {
  const items = (a.line_items || []).map(li => `<div class="offerLine"><span>${esc(li.label)}</span><span>${fmtEur(li.price)}</span></div>`).join("");
  return `<div class="card" style="margin-top:12px;padding:14px;border-color:${a.status === "requested" ? "rgba(255,176,32,.5)" : a.status === "approved" ? "rgba(43,213,138,.4)" : "var(--line)"}">
    <div class="cardHead"><div class="ico icoGold" style="width:34px;height:34px;font-size:15px">🔧</div>
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
  if (status === "declined" && !confirm("Zusatzarbeit wirklich ablehnen?")) return;
  const { error } = await sb.from("approvals").update({ status, decided_at: new Date().toISOString() }).eq("id", id);
  if (error) return toast(error.message);
  await sb.from("messages").insert({ request_id: reqId, sender_id: me.id, kind: "system", body: status === "approved" ? "✅ Zusatzarbeit freigegeben" : "❌ Zusatzarbeit abgelehnt" });
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
    await sb.from("messages").insert({ request_id: reqId, sender_id: me.id, kind: "system", body: "📅 Neuer Terminvorschlag vom Kunden: " + fmtDateTime(v) });
    closeModal(); toast("Terminvorschlag gesendet 📅");
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
function openCancel(bkId, reqId) {
  openModal(`
    <h2 style="font-size:19px;font-weight:800">Buchung stornieren</h2>
    <div class="note" style="margin-top:10px">Stornierung in der Beta kostenlos. Später gilt: kostenfrei bis 24 h vor Termin (Platzhalter).</div>
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
        <a class="btn sm" href="#/vehicle/${v.id}">🗂️ Fahrzeugakte</a>
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
// Fahrzeug anlegen – abhängige Auswahl wie bei mobile.de/AutoScout24.
// Datenquelle: VehicleData (assets/data.js) – später durch echte API ersetzbar.
async function openVehicleForm(editId) {
  let v = {};
  if (editId) { const { data } = await sb.from("vehicles").select("*").eq("id", editId).maybeSingle(); v = data || {}; }
  const steps = [
    ["cMake", "Marke"], ["cModel", "Modell"], ["cSeries", "Baureihe"], ["cBody", "Karosserie"],
    ["cYear", "Baujahr"], ["cEngine", "Motor"], ["cFuel", "Kraftstoff"], ["cPs", "Leistung"],
    ["cTrans", "Getriebe"], ["cKm", "Kilometer"],
  ];
  openModal(`
    <h2 style="font-size:20px;font-weight:800">${editId ? "Fahrzeug bearbeiten" : "Fahrzeug anlegen"}</h2>
    <p class="mm" style="margin-top:4px">Schritt für Schritt – es werden nur passende Kombinationen angezeigt.</p>
    <div id="vfProgress" style="display:flex;gap:3px;margin:14px 0 2px">${steps.map(() => '<div style="flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,.1)"></div>').join("")}</div>
    <div class="mm" id="vfStep" style="font-size:11px">Schritt 1 von 10 · Marke wählen</div>
    <div class="label">1 · Marke *</div>
    <select id="cMake">${opt("Marke wählen…", VehicleData.brands(), v.make)}</select>
    <div class="label">2 · Modell *</div>
    <select id="cModel" disabled><option value="">Erst Marke wählen</option></select>
    <div class="label">3 · Baureihe / Generation *</div>
    <select id="cSeries" disabled><option value="">Erst Modell wählen</option></select>
    <div class="split">
      <div><div class="label">4 · Karosserie *</div><select id="cBody">${opt("Wählen…", BODIES, v.body_type)}</select></div>
      <div><div class="label">5 · Baujahr *</div><select id="cYear" disabled><option value="">Erst Baureihe wählen</option></select></div>
    </div>
    <div class="label">6 · Motorisierung *</div>
    <select id="cEngine" disabled><option value="">Erst Modell wählen</option></select>
    <div class="split">
      <div><div class="label">7 · Kraftstoff *</div><select id="cFuel" disabled><option value="">Erst Motor wählen</option></select></div>
      <div><div class="label">8 · Leistung (PS) *</div><select id="cPs" disabled><option value="">Erst Motor wählen</option></select></div>
    </div>
    <div class="split">
      <div><div class="label">9 · Getriebe *</div><select id="cTrans" disabled><option value="">Erst Motor wählen</option></select></div>
      <div><div class="label">10 · Kilometerstand *</div><select id="cKm">${opt("Wählen…", KM_STEPS.map(k => k[1]), kmLabel(v.mileage))}</select></div>
    </div>
    <div class="okBox hidden" id="vfSummary" style="margin-top:14px"></div>
    <div class="split" style="margin-top:4px">
      <div><div class="label">Kennzeichen (optional)</div><input id="cPlate" placeholder="K-XX 1234" value="${esc(v.license_plate || "")}"></div>
      <div><div class="label">TÜV gültig bis (optional)</div><input id="cTuev" type="date" value="${esc(v.tuev_until || "")}"></div>
    </div>
    <div class="label">Fahrzeugschein (optional, privat gespeichert)</div>
    <input type="file" id="cDoc" accept="image/*,.pdf" style="padding:9px">
    ${v.registration_doc ? '<p class="mm" style="margin-top:5px">📄 Bereits hinterlegt – neue Datei ersetzt die alte.</p>' : ""}
    <div class="btnRow">
      <button class="btn" id="cSave" disabled>${editId ? "Speichern" : "Fahrzeug anlegen"}</button>
      <button class="btn ghost" onclick="closeModal()">Abbrechen</button>
    </div>
    <div class="err" id="cErr"></div>`);

  const stepOrder = ["cMake", "cModel", "cSeries", "cBody", "cYear", "cEngine", "cFuel", "cPs", "cTrans", "cKm"];
  function refreshProgress() {
    const bars = $("vfProgress").children;
    let done = 0;
    stepOrder.forEach((id, i) => {
      const ok = !!$(id).value;
      bars[i].style.background = ok ? "var(--green)" : "rgba(255,255,255,.1)";
      if (ok) done++;
    });
    const next = stepOrder.findIndex(id => !$(id).value);
    $("vfStep").textContent = next === -1 ? "Alle 10 Schritte ausgefüllt ✓" : `Schritt ${next + 1} von 10 · ${steps[next][1]} wählen`;
    $("cSave").disabled = next !== -1;
    const sum = $("vfSummary");
    if (done >= 6 && $("cMake").value) {
      sum.classList.remove("hidden");
      sum.innerHTML = `🚗 <b>${esc($("cMake").value)} ${esc($("cModel").value)}</b>${$("cSeries").value && $("cSeries").value !== "Keine Angabe" ? " · " + esc($("cSeries").value) : ""}${$("cEngine").value ? " · " + esc($("cEngine").value) : ""}${$("cPs").value ? " · " + esc($("cPs").value) + " PS" : ""}${$("cYear").value ? " · BJ " + esc($("cYear").value) : ""}`;
    } else sum.classList.add("hidden");
  }
  function fillModel(keep) {
    const mk = $("cMake").value;
    $("cModel").disabled = !mk;
    $("cModel").innerHTML = mk ? opt(`Modell wählen… (${VehicleData.models(mk).length})`, VehicleData.models(mk), keep) : "<option value=''>Erst Marke wählen</option>";
  }
  function fillSeries(keep) {
    const mk = $("cMake").value, mo = $("cModel").value;
    $("cSeries").disabled = !mo;
    if (!mo) { $("cSeries").innerHTML = "<option value=''>Erst Modell wählen</option>"; return; }
    const list = VehicleData.series(mk, mo).map(x => x.label);
    if (keep && !list.includes(keep)) list.unshift(keep); // Altbestand (z.B. "F30")
    $("cSeries").innerHTML = opt("Baureihe wählen…", list, keep);
  }
  function fillYear(keep) {
    const mk = $("cMake").value, mo = $("cModel").value, se = $("cSeries").value;
    $("cYear").disabled = !se;
    if (!se) { $("cYear").innerHTML = "<option value=''>Erst Baureihe wählen</option>"; return; }
    let years = VehicleData.years(mk, mo, se);
    if (keep && !years.includes(+keep)) years = [+keep].concat(years);
    $("cYear").innerHTML = opt("Baujahr wählen…", years, keep);
  }
  function fillEngine(keep) {
    const mk = $("cMake").value, mo = $("cModel").value;
    $("cEngine").disabled = !mo;
    if (!mo) { $("cEngine").innerHTML = "<option value=''>Erst Modell wählen</option>"; return; }
    const list = VehicleData.engines(mk, mo).map(e => e.n);
    if (keep && !list.includes(keep)) list.unshift(keep);
    $("cEngine").innerHTML = opt("Motorisierung wählen…", list, keep);
  }
  function fillEngineDeps(keepFuel, keepPs, keepTrans) {
    const mk = $("cMake").value, mo = $("cModel").value, en = $("cEngine").value;
    const has = !!en;
    ["cFuel", "cPs", "cTrans"].forEach(id => $(id).disabled = !has);
    if (!has) {
      ["cFuel", "cPs", "cTrans"].forEach(id => $(id).innerHTML = "<option value=''>Erst Motor wählen</option>");
      return;
    }
    const fuels = VehicleData.fuels(mk, mo, en);
    const ps = VehicleData.ps(mk, mo, en);
    const trans = VehicleData.transmissions(mk, mo, en);
    $("cFuel").innerHTML = fuels.length === 1
      ? `<option value="${esc(fuels[0])}" selected>${esc(fuels[0])} (passend zum Motor)</option>`
      : opt("Kraftstoff wählen…", fuels, keepFuel);
    const psList = keepPs && !ps.includes(+keepPs) ? [+keepPs].concat(ps) : ps;
    $("cPs").innerHTML = ps.length === 1
      ? `<option value="${ps[0]}" selected>${ps[0]} PS</option>`
      : opt("PS wählen…", psList, keepPs);
    $("cTrans").innerHTML = trans.length === 1
      ? `<option value="${esc(trans[0])}" selected>${esc(trans[0])}</option>`
      : opt("Getriebe wählen…", trans, keepTrans);
  }

  // Vorbelegung bei Bearbeitung
  if (v.make) { fillModel(v.model); fillSeries(v.series); fillYear(v.year); fillEngine(v.engine); fillEngineDeps(v.fuel, v.power_ps, v.transmission); }

  $("cMake").onchange = () => { fillModel(); fillSeries(); fillYear(); fillEngine(); fillEngineDeps(); refreshProgress(); };
  $("cModel").onchange = () => { fillSeries(); fillYear(); fillEngine(); fillEngineDeps(); refreshProgress(); };
  $("cSeries").onchange = () => { fillYear(); refreshProgress(); };
  $("cEngine").onchange = () => { fillEngineDeps(); refreshProgress(); };
  ["cBody", "cYear", "cFuel", "cPs", "cTrans", "cKm"].forEach(id => $(id).onchange = refreshProgress);
  refreshProgress();

  $("cSave").onclick = async () => {
    const err = $("cErr"); err.style.display = "none";
    for (const fid of stepOrder) {
      if (!$(fid).value) return showErr(err, "Bitte alle 10 Schritte ausfüllen – Schritt: " + steps[stepOrder.indexOf(fid)][1]);
    }
    $("cSave").disabled = true; $("cSave").textContent = "Wird gespeichert…";
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
    $("cSave").disabled = false; $("cSave").textContent = editId ? "Speichern" : "Fahrzeug anlegen";
    if (error) return showErr(err, error.message);
    closeModal(); toast(editId ? "Gespeichert ✓" : "Fahrzeug angelegt ✓");
    if ($("carList")) loadVehicles(); else route();
  };
}
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
      ${!isWs ? `<div class="card" style="margin-bottom:14px">
        <div class="tt">❤️ Meine Favoriten</div>
        <div id="favList" style="margin-top:8px"><div class="sk" style="height:40px"></div></div>
      </div>` : ""}
      <div class="card" style="margin-bottom:14px">
        <div class="tt">🔔 Benachrichtigungen</div>
        <label class="inline"><input type="checkbox" id="npEmail" ${myProfile?.notify_prefs?.email !== false ? "checked" : ""}> E-Mail-Benachrichtigungen</label>
        <label class="inline"><input type="checkbox" id="npPush" ${myProfile?.notify_prefs?.push !== false ? "checked" : ""}> Push-Benachrichtigungen (App folgt)</label>
        <label class="inline"><input type="checkbox" id="npRem" ${myProfile?.notify_prefs?.reminders !== false ? "checked" : ""}> Erinnerungen (TÜV, Service, Reifen)</label>
        <label class="inline"><input type="checkbox" id="npMkt" ${myProfile?.notify_prefs?.marketing ? "checked" : ""}> Marketing-E-Mails</label>
        <p class="mm" style="margin-top:8px;font-size:11px">Notfall- und sicherheitsrelevante Benachrichtigungen bleiben immer aktiv.</p>
        <button class="btn ghost sm" style="margin-top:10px" id="npSave">Einstellungen speichern</button>
      </div>
      <div class="card" style="margin-bottom:14px">
        <div class="tt">🧭 Hilfe & Rechtliches</div>
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
    </div>
  </div>`;
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
      ? '<p class="mm">Noch keine Favoriten – merke dir Werkstätten über 🤍 im Profil oder in der Suche.</p>'
      : favs.map(f => {
        const w = f.workshops || {};
        return `<div class="offerLine"><span><a href="#/workshop/${w.id}" style="color:var(--ink);font-weight:700">${esc(w.name || "")}</a> <span class="mm">${esc(w.district || "")} · ★ ${w.rating_avg > 0 ? Number(w.rating_avg).toLocaleString("de-DE") : "Neu"}</span></span>
          <a href="#/new-request?ws=${w.id}" style="color:var(--blue2);font-weight:700;font-size:12px">Erneut anfragen →</a></div>`;
      }).join("");
  }
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
    <div class="right">
      <a class="btn ghost sm" href="#/ws/stats">📊 Statistiken</a>
      <a class="btn ghost sm" href="#/ws/archive">🗄️ Archiv</a>
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
  const [{ data: myOffer }, { data: templates }] = await Promise.all([
    sb.from("offers").select("*").eq("request_id", id).eq("workshop_id", myWorkshop.id).maybeSingle(),
    sb.from("offer_templates").select("*").eq("workshop_id", myWorkshop.id).order("name"),
  ]);
  window._oTemplates = templates || [];
  const c = CATS[r.category] || { icon: "🔧", name: r.category };
  const partsLabel = (PARTS_OPTIONS.find(p => p[0] === r.parts_preference) || [])[1];
  main.innerHTML = `
  <div class="pageHead">
    <div class="ico" style="width:52px;height:52px;font-size:23px">${c.icon}</div>
    <div style="flex:1"><h1>${esc(r.title)}</h1>
    <div class="sub">🚗 ${esc(r.vehicle_label || "k.A.")} · ${c.name}${r.type === "direct" ? " · 📩 Direktanfrage an dich" : ""}${r.urgency === "notfall" ? ' · <span class="badge b-red">🚨 NOTFALL</span>' : r.urgency === "dringend" ? ' · <span class="badge b-gold">⚡ Dringend</span>' : ""}</div></div>
  </div>
  <div class="grid2" style="align-items:start">
    <div>
      <div class="card" style="margin-bottom:14px">
        <div class="tt">Anfrage-Details</div>
        <p class="mm" style="margin-top:8px;font-size:13px">${esc(r.description)}</p>
        <div class="chips" style="margin-top:10px">
          ${(r.extras?.leistungen || []).map(s => `<span class="pill">${esc(s)}</span>`).join("")}
          ${partsLabel ? `<span class="pill">🔩 ${esc(partsLabel)}</span>` : ""}
          ${r.budget_max ? `<span class="pill">💶 Budget bis ${fmtEur(r.budget_max)}</span>` : ""}
          ${r.district ? `<span class="pill">📍 ${esc(r.district)}${r.zip ? " (" + esc(r.zip) + ")" : ""}</span>` : ""}
          ${r.asap ? `<span class="pill">⚡ ASAP</span>` : ""}
          ${r.preferred_date ? `<span class="pill">📅 ${fmtDate(r.preferred_date)}</span>` : ""}
          ${r.service_preference === "mobile" ? `<span class="pill">🚐 Mobiler Service gewünscht</span>` : ""}
        </div>
        ${(r.attachments || []).length ? `<div class="thumbs">${r.attachments.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" loading="lazy" alt="Foto"></a>`).join("")}</div>` : ""}
      </div>
      <div class="card" id="offerBox">
        ${myOffer ? `
          <div class="tt">Dein Angebot <span class="badge ${myOffer.status === "accepted" ? "b-green" : myOffer.status === "declined" ? "b-grey" : "b-blue"}">${myOffer.status === "accepted" ? "Angenommen ✓" : myOffer.status === "declined" ? "Abgelehnt" : "Gesendet"}</span></div>
          <div style="margin-top:10px">${(myOffer.line_items || []).map(li => `<div class="offerLine"><span>${esc(li.label)}${li.meta ? ` <span class="mm">(${esc(li.meta)})</span>` : ""}</span><span>${fmtEur(li.price)}</span></div>`).join("")}
          <div class="offerLine total"><span>Gesamt inkl. MwSt. (${myOffer.is_fixed_price === false ? "Schätzung" : "Festpreis"})</span><span>${fmtEur(myOffer.total_price)}</span></div></div>
          ${myOffer.message ? `<p class="mm" style="margin-top:8px">💬 ${esc(myOffer.message)}</p>` : ""}`
        : r.status !== "open" ? `<div class="tt">Diese Anfrage ist nicht mehr offen.</div>`
        : offerFormHtml()}
      </div>
    </div>
    <div class="card">
      <div class="tt">💬 Rückfragen an den Kunden</div>
      <div class="msgs" id="msgs"></div>
      <div class="msgRow"><input id="msgIn" placeholder="Nachricht schreiben…"><button id="msgGo">➤</button></div>
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
    <button class="btn ghost sm" id="oTplDel" style="flex:0 0 auto" title="Gewählte Vorlage löschen">🗑</button></div>` : ""}
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
      <button class="btn red sm" style="flex:0 0 auto" onclick="this.closest('.oPartRow').remove();calcOfferSum()">✕</button>
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
    const pay = PAY_LABELS[b.payment_status] || PAY_LABELS.none;
    const cust = b.profiles?.full_name || b.profiles?.email || "Kunde";
    const active = !["completed", "cancelled"].includes(b.status);
    return `<div class="card" style="margin-bottom:12px">
      <div class="cardHead"><div class="ico">${c.icon}</div>
        <div style="flex:1;min-width:0"><div class="tt">${esc(b.booking_no || "")} · ${esc(r.title || "Auftrag")}</div>
        <div class="mm">👤 ${esc(cust)}${b.profiles?.phone ? " · 📞 " + esc(b.profiles.phone) : ""} · <b>${fmtEur(b.total_price)}</b> · <span class="badge ${pay[1]}">${pay[0]}</span></div>
        <div class="mm">🚗 ${esc(r.vehicle_label || "k.A.")}${b.scheduled_at ? " · 📅 " + fmtDateTime(b.scheduled_at) : " · 📅 kein Termin"}${b.no_show ? " · 🚫 No-Show (" + (b.no_show === "customer" ? "Kunde" : "Werkstatt") + ")" : ""}</div>
        ${b.proposed_date && b.reschedule_by === "customer" ? `<div class="note" style="margin:8px 0 0;padding:8px 10px">📅 Kunde schlägt vor: <b>${fmtDateTime(b.proposed_date)}</b> <a href="#" onclick="wsAcceptProposed('${b.id}');return false" style="color:var(--green);font-weight:800">Annehmen ✓</a></div>` : ""}
        </div>
        <span class="badge ${s[1]}">${s[0]}</span></div>
      <div class="foot">
        ${active ? `
        <select style="width:auto;flex:1;min-width:150px;padding:9px" onchange="setJobStatus('${b.id}',this.value)">
          ${Object.entries(BK_STATUS).map(([k, v]) => `<option value="${k}" ${k === b.status ? "selected" : ""}>${v[0]}</option>`).join("")}
        </select>
        <button class="btn ghost sm" onclick="setJobDate('${b.id}','${b.scheduled_at || ""}')">📅 Termin</button>
        <button class="btn ghost sm" onclick="openApprovalForm('${b.id}','${b.customer_id}','${b.offers?.request_id}')">🔧 Zusatzfreigabe</button>
        <button class="btn ghost sm" onclick="openBookingDocForm('${b.id}')">📄 Rechnung/Dokument</button>
        <button class="btn ghost sm" onclick="markNoShow('${b.id}')">🚫 Nicht erschienen</button>
        <button class="btn red sm" onclick="wsCancelJob('${b.id}')">Absagen</button>` : ""}
        <button class="btn ghost sm" onclick="go('ws/lead/${b.offers?.request_id}')">💬 Chat</button>
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
    closeModal(); toast("Termin gesetzt 📅");
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
  if (!confirm("Kunden als nicht erschienen markieren? Der Fall wird im Auftrag gespeichert und der Kunde informiert.")) return;
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
    <h2 style="font-size:19px;font-weight:800">📄 Rechnung / Dokument hochladen</h2>
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
    ${docs.length ? `<div class="tt" style="font-size:12.5px">📄 Dokumente der Werkstatt</div>
    ${docs.map(d => `<div class="offerLine"><span>${esc(d.type || "Dokument")} · ${esc(d.name || "")}</span>
      <a href="#" onclick="openBookingDoc('${esc(d.path)}');return false" style="color:var(--blue2);font-weight:700;font-size:12px">Öffnen →</a></div>`).join("")}` : ""}
    ${bk.warranty_note ? `<div class="note" style="margin:10px 0 0">🛡️ <b>Gewährleistung/Garantie (durch die Werkstatt):</b><br>${esc(bk.warranty_note)}</div>` : ""}
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
      <div class="ico icoGold">📷</div>
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
    $("apThumbs").innerHTML = apFiles.map(f => f.type.startsWith("video") ? `<span class="pill">🎬 ${esc(f.name)}</span>` : `<img src="${URL.createObjectURL(f)}" loading="lazy" alt="">`).join("");
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
    if (requestId) await sb.from("messages").insert({ request_id: requestId, sender_id: me.id, kind: "system", body: `🔧 Zusatzfreigabe angefordert: ${title} (+${fmtEur(extra)})` });
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
      <div class="card" style="margin-top:14px">
        <div class="tt">🖼️ Bilder</div>
        <div class="label">Logo</div>
        <div class="split" style="align-items:center">
          <div class="wsAv" id="pLogoPrev" style="${w.logo_url ? `background-image:url('${esc(w.logo_url)}');background-size:cover;color:transparent` : ""}">${esc(initials(w.name))}</div>
          <input type="file" id="pLogo" accept="image/*" style="padding:9px">
        </div>
        <div class="label">Titelbild</div>
        <input type="file" id="pCover" accept="image/*" style="padding:9px">
        ${w.cover_url ? '<p class="mm" style="margin-top:5px">Titelbild vorhanden – neue Datei ersetzt es.</p>' : ""}
        <div class="label">Galerie (Werkstatt, Arbeiten, Vorher/Nachher, Team) ${w.is_premium ? "– bis 12 Bilder 👑" : "– bis 4 Bilder"}</div>
        <input type="file" id="pGallery" accept="image/*" multiple style="padding:9px">
        <div class="thumbs" id="pGalThumbs">${(w.gallery || []).map((u, i) => `
          <span style="position:relative"><img src="${esc(u)}" loading="lazy" alt="">
          <button onclick="removeGalleryImg(${i})" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:none;background:var(--red);color:#fff;font-size:11px;cursor:pointer">✕</button></span>`).join("")}</div>
      </div>
      <div class="card" style="margin-top:14px">
        <div class="tt">📅 Verfügbarkeit & Kapazität</div>
        <div class="label">Nächster freier Termin</div>
        <input type="date" id="pNextFree" value="${esc(w.next_free_date || "")}">
        <div class="split" style="margin-top:8px">
          <div><div class="label" style="margin-top:0">Hebebühnen</div><input id="pLifts" inputmode="numeric" value="${esc(w.capacity?.lifts ?? "")}" placeholder="z.B. 3"></div>
          <div><div class="label" style="margin-top:0">Mitarbeiter</div><input id="pStaff" inputmode="numeric" value="${esc(w.capacity?.staff ?? "")}" placeholder="z.B. 5"></div>
          <div><div class="label" style="margin-top:0">Max. Aufträge/Tag</div><input id="pMaxJobs" inputmode="numeric" value="${esc(w.capacity?.max_jobs_per_day ?? "")}" placeholder="z.B. 8"></div>
        </div>
        <div class="label">Ausstattung & Service</div>
        <label class="inline"><input type="checkbox" id="pPickup" ${w.pickup_service ? "checked" : ""}> Hol- &amp; Bringservice</label>
        <label class="inline"><input type="checkbox" id="pReplace" ${w.replacement_car ? "checked" : ""}> Ersatzwagen verfügbar</label>
        <label class="inline"><input type="checkbox" id="pEmergency" ${w.emergency_service ? "checked" : ""}> Notdienst / kurzfristige Hilfe</label>
        <div class="label">Zahlungsmöglichkeiten</div>
        <div class="chips" id="pPay">${["Bar","EC-Karte","Kreditkarte","Überweisung","PayPal","Rechnung"].map(p => `
          <span class="chip ${(w.payment_methods || []).includes(p) ? "on" : ""}" data-p="${p}">${p}</span>`).join("")}</div>
      </div>
      <div class="card" style="margin-top:14px">
        <div class="tt">👥 Team-Zugänge</div>
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
      <div class="card" style="margin-top:14px;border-color:rgba(255,176,32,.35)">
        <div class="tt">👑 Premium für Betriebe</div>
        <p class="mm" style="margin-top:4px">${w.is_premium ? "Aktiv: bevorzugte Platzierung (als Gesponsert markiert), mehr Galerie-Bilder, detaillierte Statistiken." : "Bevorzugte Platzierung, mehr Bilder, detaillierte Statistiken – in der Beta kostenlos."}</p>
        <div class="btnRow">
          <button class="btn ghost sm" id="pPremToggle">${w.is_premium ? "Premium deaktivieren" : "Premium aktivieren (Beta: kostenlos)"}</button>
          <a class="btn ghost sm" href="#/ws/stats">📊 Statistiken</a>
        </div>
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
  document.querySelectorAll("#pPay .chip").forEach(c => c.onclick = () => c.classList.toggle("on"));
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
  loadTeamList();
  $("pMemberAdd").onclick = addTeamMember;
  $("pPremToggle").onclick = async () => {
    const nv = !myWorkshop.is_premium;
    const { error } = await sb.from("workshops").update({ is_premium: nv }).eq("id", myWorkshop.id);
    if (error) return toast(error.message);
    myWorkshop.is_premium = nv;
    allWorkshops = null;
    toast(nv ? "Premium aktiviert 👑" : "Premium deaktiviert.");
    vWsProfile();
  };
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
    next_free_date: $("pNextFree").value || null,
    capacity: { lifts: +$("pLifts").value || null, staff: +$("pStaff").value || null, max_jobs_per_day: +$("pMaxJobs").value || null },
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
// KI-DIAGNOSE (Hauptfunktion, öffentlich – Beta, regelbasiert)
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
  main.innerHTML = `
  <div class="pageHead"><div>
    <h1>🤖 KI-Diagnose <span class="badge b-purple">Beta</span></h1>
    <div class="sub">Beschreibe das Problem deines Autos – du bekommst eine <b>unverbindliche Ersteinschätzung</b> mit möglichen Ursachen, Preisorientierung und passenden Werkstätten. Ersetzt keine Prüfung durch eine Fachwerkstatt.</div>
  </div></div>
  <div class="grid2" style="align-items:start">
    <div class="card">
      <div class="label" style="margin-top:0">Fahrzeug ${cars.length ? "" : "(optional – ohne Login allgemein)"}</div>
      ${cars.length
        ? `<select id="dgCar">${cars.map((c, i) => `<option value="${c.id}" ${i === 0 ? "selected" : ""}>${esc(carLabel(c))}</option>`).join("")}</select>`
        : `<div class="split"><select id="dgMake">${opt("Marke (optional)", Object.keys(BRANDS), "")}</select><select id="dgPs">${opt("PS (optional)", PS_LIST, "")}</select></div>
           ${me ? "" : '<p class="mm" style="margin-top:6px">Tipp: <a href="#/login" style="color:var(--blue2)">Anmelden</a> und Fahrzeug speichern – dann wird die Einschätzung genauer.</p>'}`}
      <div class="label">Was ist das Problem? *</div>
      <textarea id="dgDesc" placeholder="z.B. Beim Bremsen quietscht es vorne laut, besonders wenn es kalt ist…"></textarea>
      <div class="label">Leuchtet eine Warnleuchte?</div>
      <div class="chips" id="dgLights">${WARNING_LIGHTS.map(w => `<span class="chip" data-k="${w.k}">${w.icon} ${w.name}</span>`).join("")}</div>
      <div class="label">Hörst du ein Geräusch?</div>
      <div class="chips" id="dgSounds">${SOUNDS.map(s => `<span class="chip" data-k="${s.k}">${s.name}</span>`).join("")}</div>
      <div class="label">Foto / Video (optional)</div>
      <div class="uploadTile" onclick="$('dgFile').click()">
        <div class="ico icoPurple">📷</div>
        <div><div class="tt" style="font-size:12.5px">Schaden fotografieren oder filmen</div>
        <div class="mm">Bilder werden mit deiner Anfrage an Betriebe übergeben</div></div>
      </div>
      <input type="file" id="dgFile" accept="image/*,video/*" multiple class="hidden">
      <div class="thumbs" id="dgThumbs"></div>
      <div class="label">Wie dringend ist es?</div>
      <div class="seg" style="margin:4px 0 0" id="dgUrgency">
        <div data-u="normal" class="on">Kann warten</div>
        <div data-u="dringend">⚡ Diese Woche</div>
        <div data-u="notfall">🚨 Sofort / Notfall</div>
      </div>
      <button class="btn wide" style="margin-top:18px" id="dgGo">Einschätzung anzeigen</button>
      <div class="err" id="dgErr"></div>
    </div>
    <div id="dgResult">
      <div class="card" style="text-align:center;padding:40px 24px">
        <div style="font-size:42px">🤖</div>
        <div class="tt" style="margin-top:10px">Deine Ersteinschätzung erscheint hier</div>
        <p class="mm" style="margin-top:6px">Je genauer deine Beschreibung, desto besser die Einschätzung. Bei roten Warnleuchten: besser sofort anhalten und prüfen lassen.</p>
      </div>
    </div>
  </div>`;
  ["dgLights", "dgSounds"].forEach(boxId => document.querySelectorAll(`#${boxId} .chip`).forEach(c => c.onclick = () => {
    const arr = boxId === "dgLights" ? dgLights : dgSounds;
    const i = arr.indexOf(c.dataset.k);
    if (i >= 0) arr.splice(i, 1); else arr.push(c.dataset.k);
    c.classList.toggle("on");
  }));
  document.querySelectorAll("#dgUrgency div").forEach(d => d.onclick = () => {
    document.querySelectorAll("#dgUrgency div").forEach(x => x.classList.toggle("on", x === d));
  });
  $("dgFile").onchange = () => {
    const files = [...$("dgFile").files].slice(0, 4 - dgFiles.length);
    files.forEach(f => { if (f.size < 20 * 1024 * 1024) dgFiles.push(f); });
    $("dgThumbs").innerHTML = dgFiles.map(f => f.type.startsWith("video")
      ? `<span class="pill">🎬 ${esc(f.name)}</span>`
      : `<img src="${URL.createObjectURL(f)}" loading="lazy" alt="">`).join("");
  };
  $("dgGo").onclick = runDiagnose;
}
function runDiagnose() {
  const err = $("dgErr"); err.style.display = "none";
  const desc = $("dgDesc").value.trim();
  if (!desc && dgLights.length === 0 && dgSounds.length === 0)
    return showErr(err, "Bitte beschreibe das Problem oder wähle mindestens eine Warnleuchte / ein Geräusch.");
  const car = $("dgCar") ? window._dgCars.find(c => c.id === $("dgCar").value)
    : ($("dgMake")?.value ? { make: $("dgMake").value, power_ps: +($("dgPs")?.value || 0) } : null);
  const urgency = document.querySelector("#dgUrgency div.on")?.dataset.u || "normal";

  // Treffer sammeln: Freitext + Warnleuchten + Geräusche
  const hits = [];
  const seen = new Set();
  const push = (h) => { const key = h.cat + "|" + h.service; if (!seen.has(key)) { seen.add(key); hits.push(h); } };
  dgLights.forEach(k => { const w = WARNING_LIGHTS.find(x => x.k === k); if (w) push({ cat: w.cat, service: w.service, guess: w.guess, conf: w.sev === "hoch" ? "hoch" : "mittel", sev: w.sev }); });
  dgSounds.forEach(k => { const s = SOUNDS.find(x => x.k === k); if (s) push({ cat: s.cat, service: s.service, guess: s.guess, conf: "mittel" }); });
  aiAnalyze(desc).forEach(push);
  const redAlert = dgLights.some(k => WARNING_LIGHTS.find(x => x.k === k)?.sev === "hoch") || urgency === "notfall";

  const top = hits.slice(0, 4);
  const recs = (allWorkshops || []).filter(ws => top.some(h => ws.categories.includes(h.cat))).slice(0, 3);
  const qs = top[0] ? `cat=${top[0].cat}&service=${encodeURIComponent(top[0].service)}&title=${encodeURIComponent(top[0].guess.slice(0, 60))}&desc=${encodeURIComponent(desc.slice(0, 300))}&urgency=${urgency}` : "";

  $("dgResult").innerHTML = `
  ${redAlert ? `<div class="warn" style="border-color:rgba(255,92,92,.5);color:#FF9C9C">🚨 <b>Sicherheitshinweis:</b> Bei roten Warnleuchten oder akuten Problemen nicht weiterfahren. ${urgency === "notfall" ? `<a href="#/notfall" style="color:#fff;font-weight:800">→ Zum Notfallmodus</a>` : `<a href="#/notfall" style="color:#fff;font-weight:800">Notfallmodus öffnen</a>`}</div>` : ""}
  <div class="card" style="margin-bottom:14px">
    <div class="tt">🤖 Unverbindliche Ersteinschätzung</div>
    ${top.length === 0
      ? `<p class="mm" style="margin-top:10px">Keine eindeutige Zuordnung möglich. Empfohlene Prüfung durch eine Fachwerkstatt – erstelle am besten eine Ausschreibung mit deiner Beschreibung.</p>`
      : top.map(h => {
        const pr = priceRange(h.service, car);
        return `<div style="padding:12px 0;border-bottom:1px solid var(--line)">
          <div style="font-size:13.5px"><b>Mögliche Ursache:</b> ${esc(h.guess)} <span class="badge ${h.conf === "hoch" ? "b-green" : "b-gold"}">${h.conf}e Wahrscheinlichkeit</span></div>
          <div class="mm" style="margin-top:4px">Empfohlener Bereich: ${CATS[h.cat].icon} ${CATS[h.cat].name} → ${esc(h.service)}</div>
          ${pr ? `<div class="mm" style="margin-top:3px">💶 Preisorientierung: häufig <b>${pr.lo}–${pr.hi} €</b>${pr.note ? " (" + esc(pr.note) + ")" : ""}</div>` : ""}
        </div>`;
      }).join("")}
    <p class="mm" style="margin-top:10px;font-size:11px">Unverbindliche Ersteinschätzung – keine Diagnose und keine Preiszusage. Der endgültige Preis wird nach Prüfung durch die Werkstatt festgelegt.</p>
    <div class="btnRow">
      ${me && !myWorkshop ? `<a class="btn" href="#/new-request?${qs}">📢 Ausschreibung mit diesen Angaben</a>` : `<a class="btn" href="#/${me ? "search" : "register"}">${me ? "Werkstatt suchen" : "Kostenlos registrieren & anfragen"}</a>`}
      ${urgency !== "normal" ? `<a class="btn red" href="#/notfall">🚨 Notfallmodus</a>` : ""}
    </div>
  </div>
  ${recs.length ? `<div class="card"><div class="tt">Passende Betriebe in der Nähe</div>
    <div style="margin-top:12px">${recs.map(ws => wsCardHtml({ ...ws, _dist: distKm(searchOrigin || CITY_CENTER, [ws.lat, ws.lng]) })).join("")}</div></div>` : ""}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================
// NOTFALLMODUS (öffentlich)
// ============================================================
async function vNotfall() {
  if (!allWorkshops) {
    const { data } = await sb.from("workshops").select("*").eq("is_verified", true).limit(200);
    allWorkshops = data || [];
  }
  const helpers = allWorkshops.filter(ws => ws.emergency_service || ws.service_mode !== "stationary");
  main.innerHTML = `
  <div class="pageHead"><div>
    <h1>🚨 Notfallmodus</h1>
    <div class="sub">Panne, Auto startet nicht oder rote Warnleuchte? Hier findest du schnelle Hilfe: mobile Werkstätten und Betriebe mit Notdienst.</div>
  </div></div>
  <div class="warn">Bei Unfällen mit Verletzten immer zuerst den Notruf <b>112</b> wählen. Pannenhilfe-Zentralen: ADAC <b>089 20 20 4000</b>.</div>
  <div class="card" style="margin-bottom:16px">
    <div class="label" style="margin-top:0">Was ist passiert?</div>
    <div class="chips" id="emType">${EMERGENCY_TYPES.map(e => `<span class="chip" data-k="${e.k}">${e.icon} ${e.name}</span>`).join("")}</div>
    <div class="btnRow">
      <button class="btn ghost sm" id="emLoc">📍 Meinen Standort verwenden</button>
      <span class="mm" id="emLocInfo" style="align-self:center">${searchOrigin ? "📍 " + esc(searchOriginLabel) : "Kein Standort gesetzt"}</span>
    </div>
  </div>
  <div class="tt" style="margin-bottom:12px">Schnelle Hilfe in der Nähe (${helpers.length})</div>
  <div id="emList">${helpers.length === 0
    ? '<div class="empty"><div class="e">🚧</div>Aktuell keine Notdienst-Betriebe verfügbar.</div>'
    : helpers.map(ws => {
      const d = distKm(searchOrigin || CITY_CENTER, [ws.lat, ws.lng]);
      return `<div class="card" style="margin-bottom:11px">
        <div class="cardHead">
          <div class="ico icoRed">🚨</div>
          <div style="flex:1;min-width:0"><div class="tt">${esc(ws.name)}</div>
          <div class="mm">${ws.emergency_service ? "🚨 Notdienst · " : ""}${ws.service_mode !== "stationary" ? "🚐 Mobil · " : ""}📍 ${esc(ws.district || ws.city || "")}${d != null ? ` · ${d.toFixed(1).replace(".", ",")} km` : ""} · ${stars(ws.rating_avg)} ${ws.rating_avg > 0 ? Number(ws.rating_avg).toLocaleString("de-DE") : ""}</div></div>
        </div>
        <div class="foot">
          ${ws.phone ? `<a class="btn green sm" href="tel:${esc(ws.phone.replace(/\s/g, ""))}">📞 ${esc(ws.phone)}</a>` : ""}
          <button class="btn sm" onclick="emergencyRequest('${ws.id}')">🚨 Schnellanfrage</button>
          <a class="btn ghost sm" href="#/workshop/${ws.id}">Profil</a>
        </div>
      </div>`;
    }).join("")}</div>`;
  document.querySelectorAll("#emType .chip").forEach(c => c.onclick = () => {
    document.querySelectorAll("#emType .chip").forEach(x => x.classList.toggle("on", x === c));
  });
  $("emLoc").onclick = () => {
    if (!navigator.geolocation) return toast("Standort nicht unterstützt.");
    navigator.geolocation.getCurrentPosition(
      (pos) => { searchOrigin = [pos.coords.latitude, pos.coords.longitude]; searchOriginLabel = "Dein Standort"; toast("Standort gesetzt."); vNotfall(); },
      () => toast("Standort nicht verfügbar."));
  };
}
function emergencyRequest(wsId) {
  if (!me) { toast("Bitte zuerst anmelden – dann geht die Anfrage direkt raus."); return go("login"); }
  if (myWorkshop) return toast("Als Betrieb kannst du keine Anfragen stellen.");
  const t = document.querySelector("#emType .chip.on");
  const typ = t ? EMERGENCY_TYPES.find(e => e.k === t.dataset.k) : null;
  go(`new-request?ws=${wsId}&urgency=notfall&title=${encodeURIComponent("🚨 Notfall: " + (typ?.name || "Panne"))}&desc=${encodeURIComponent("NOTFALL – " + (typ?.name || "Panne") + ". Standort: " + (searchOriginLabel || "bitte erfragen") + ". Bitte schnellstmöglich melden!")}`);
}

// ============================================================
// WERKSTATTVERGLEICH (bis zu 3)
// ============================================================
async function vCompare() {
  if (compareSet.length < 2) {
    main.innerHTML = `<div class="pageHead"><div><h1>Werkstattvergleich</h1></div></div>
      <div class="empty"><div class="e">⇄</div>Wähle in der <a href="#/search" style="color:var(--blue2)">Suche</a> zwei bis drei Werkstätten über „Vergleichen" aus.</div>`;
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
      ${row("Verifiziert", ws => ws.is_verified ? "✅" : "–")}
      ${row("Jetzt geöffnet", ws => { const o = isOpenNow(ws.opening_hours); return o === true ? "✅" : o === false ? "❌" : "–"; })}
      ${row("Mobiler Service", ws => ws.service_mode !== "stationary" ? "✅" : "–")}
      ${row("Hol- & Bringservice", ws => ws.pickup_service ? "✅" : "–")}
      ${row("Ersatzwagen", ws => ws.replacement_car ? "✅" : "–")}
      ${row("Notdienst", ws => ws.emergency_service ? "✅" : "–")}
      ${row("Kategorien", ws => ws.categories.map(c => CATS[c]?.icon || "").join(" "))}
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
  if (!v.tuev_until || new Date(v.tuev_until) < new Date(Date.now() + 90 * 864e5)) tips.push(["📋", "TÜV erneuern", "tuev", "HU + AU"]);
  tips.push(["🛠️", "Inspektion durchführen", "inspektion", "Kleine Inspektion"]);
  tips.push(["📁", "Wartungsnachweise vollständig halten (Dokumente hier sammeln)", null, null]);
  tips.push(["✨", "Lack aufbereiten", "pflege", "Lackaufbereitung"]);
  tips.push(["🧽", "Innenraum aufbereiten", "pflege", "Innenreinigung"]);
  tips.push(["🛞", "Felgen reparieren", "reifen", "Felgenreparatur"]);
  tips.push(["🛞", "Reifen erneuern", "reifen", "Reifenwechsel"]);
  tips.push(["📷", "Schäden dokumentieren (Fotos in Anfragen hochladen)", null, null]);

  main.innerHTML = `
  <div class="pageHead">
    <div class="ico icoBlue" style="width:52px;height:52px;font-size:23px">🚗</div>
    <div style="flex:1"><h1>Fahrzeugakte: ${esc(v.make)} ${esc(v.model)}${v.series && v.series !== "Keine Angabe" ? " " + esc(v.series) : ""}</h1>
    <div class="sub">${esc(carLabel(v))}${v.license_plate ? " · 🔖 " + esc(v.license_plate) : ""}</div></div>
    <div class="right">
      <a class="btn sm" href="#/new-request">＋ Neue Anfrage</a>
      <button class="btn ghost sm" onclick="openVehicleForm('${v.id}')">Bearbeiten</button>
    </div>
  </div>
  <div class="kpiRow">
    <div class="kpi"><b>${doneJobs.length}</b><span>Abgeschlossene Aufträge</span></div>
    <div class="kpi"><b>${v.tuev_until ? fmtDate(v.tuev_until) : "–"}</b><span>TÜV gültig bis${v.tuev_until && new Date(v.tuev_until) < new Date(Date.now() + 60 * 864e5) ? " ⚠️" : ""}</span></div>
    <div class="kpi"><b>${lastKm ? Number(lastKm).toLocaleString("de-DE") + " km" : "–"}</b><span>Letzter Kilometerstand</span></div>
    <div class="kpi"><b>${spent > 0 ? spent.toLocaleString("de-DE") + " €" : "–"}</b><span>Investiert (abgeschlossen)</span></div>
  </div>

  ${openApprovals.length ? `<div class="warn">⚠️ <b>${openApprovals.length} offene Zusatzfreigabe${openApprovals.length > 1 ? "n" : ""}:</b>
    ${openApprovals.map(a => {
      const bk = (bks || []).find(b => b.id === a.booking_id);
      const rid = bk?.offers?.request_id;
      return `${esc(a.title)} (+${fmtEur(a.extra_cost)}) ${rid ? `<a href="#/request/${rid}" style="color:#fff;font-weight:800">→ Jetzt entscheiden</a>` : ""}`;
    }).join(" · ")}</div>` : ""}

  ${upcoming.length ? `<div class="note">📅 <b>Kommende Termine:</b> ${upcoming.map(b => {
      const w = b.offers?.workshops;
      return `${fmtDateTime(b.scheduled_at)} bei ${esc(w?.name || "Werkstatt")}`;
    }).join(" · ")}</div>` : ""}

  <div class="grid2" style="align-items:start">
    <div>
      <div class="card" style="margin-bottom:14px">
        <div class="tt">📋 Fahrzeugdaten</div>
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
        <div class="tt">🗂️ Reparatur- & Wartungshistorie <span class="badge b-blue">${(reqs || []).length}</span></div>
        <div style="margin-top:10px">${(reqs || []).length === 0
          ? '<p class="mm">Noch keine Aufträge mit diesem Fahrzeug. <a href="#/new-request" style="color:var(--blue2)">Erste Anfrage erstellen →</a></p>'
          : reqs.map(r => {
            const c = CATS[r.category] || { icon: "🔧", name: r.category };
            const bk = bkByReq[r.id];
            const offerCount = (offers || []).filter(o => o.request_id === r.id).length;
            const rev = bk?.reviews?.[0] || (Array.isArray(bk?.reviews) ? bk.reviews[0] : bk?.reviews);
            return `<div class="card tap" style="margin-bottom:9px;padding:12px" onclick="go('request/${r.id}')">
              <div class="cardHead"><div class="ico" style="width:34px;height:34px;font-size:15px">${c.icon}</div>
              <div style="flex:1;min-width:0"><div class="tt" style="font-size:13px">${esc(r.title)}</div>
              <div class="mm">${fmtDate(r.created_at)} · ${c.name}${bk ? ` · ${fmtEur(bk.total_price)} · ${esc(bk.offers?.workshops?.name || "")}` : offerCount ? ` · ${offerCount} Angebot${offerCount > 1 ? "e" : ""}` : ""}${rev?.rating ? ` · <span style="color:var(--gold)">${stars(rev.rating)}</span>` : ""}</div>
              ${bk?.warranty_note ? `<div class="mm">🛡️ Garantie/Gewährleistung hinterlegt</div>` : ""}</div>
              <span class="badge ${bk ? (BK_STATUS[bk.status]?.[1] || "b-grey") : r.status === "open" ? "b-green" : "b-grey"}">${bk ? (BK_STATUS[bk.status]?.[0] || bk.status) : r.status === "open" ? "Offen" : r.status === "booked" ? "Gebucht" : "Beendet"}</span></div>
            </div>`;
          }).join("")}</div>
      </div>

      <div class="card">
        <div class="tt">📈 Kilometerstand-Historie & Notizen</div>
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
        <div class="tt">📄 Dokumente & Rechnungen <span class="badge b-blue">${allDocs.length + (v.registration_doc ? 1 : 0)}</span></div>
        <p class="mm" style="margin-top:4px;font-size:11px">Rechnungen und Berichte werden von der jeweiligen Werkstatt erstellt – Carfixo speichert sie hier für dich.</p>
        <div style="margin-top:8px">
          ${v.registration_doc ? `<div class="offerLine"><span>🪪 Fahrzeugschein (privat)</span><a href="#" onclick="openBookingDoc('${esc(v.registration_doc)}');return false" style="color:var(--blue2);font-weight:700;font-size:12px">Öffnen →</a></div>` : ""}
          ${allDocs.length === 0 && !v.registration_doc ? '<p class="mm">Noch keine Dokumente. Werkstätten laden Rechnungen und Berichte nach dem Auftrag hoch.</p>' : ""}
          ${allDocs.map(d => `<div class="offerLine"><span>${esc(d.type || "Dokument")} · ${esc(d.name || "")} <span class="mm">(${esc(d.bk.booking_no || "")}, ${fmtDate(d.uploaded_at)})</span></span>
            <a href="#" onclick="openBookingDoc('${esc(d.path)}');return false" style="color:var(--blue2);font-weight:700;font-size:12px">Öffnen →</a></div>`).join("")}
        </div>
        ${(bks || []).filter(b => b.warranty_note).map(b => `<div class="note" style="margin:10px 0 0">🛡️ <b>${esc(b.booking_no || "Auftrag")} – Gewährleistung (${esc(b.offers?.workshops?.name || "Werkstatt")}):</b><br>${esc(b.warranty_note)}</div>`).join("")}
      </div>

      ${allPics.length ? `<div class="card" style="margin-bottom:14px">
        <div class="tt">📷 Bilder aus Anfragen & Aufträgen <span class="badge b-blue">${allPics.length}</span></div>
        <div class="thumbs" style="margin-top:10px">${allPics.slice(0, 12).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" loading="lazy" alt="Bild"></a>`).join("")}</div>
      </div>` : ""}

      <div class="card" style="margin-bottom:14px">
        <div class="tt">🔔 Erinnerungen & Termine</div>
        <div style="margin-top:8px">${openRems.length === 0
          ? `<p class="mm">Keine offenen Erinnerungen. <a href="#/reminders" style="color:var(--blue2)">Zur Erinnerungszentrale →</a></p>`
          : openRems.map(rm => `<div class="offerLine"><span>${esc(rm.title)}</span><span>${fmtDate(rm.due_date)}</span></div>`).join("")}
        ${upcoming.map(b => `<div class="offerLine"><span>📅 Werkstatt-Termin (${esc(b.offers?.workshops?.name || "")})</span><span>${fmtDateTime(b.scheduled_at)}</span></div>`).join("")}</div>
      </div>

      <div class="card">
        <div class="tt">📈 Verkaufswert verbessern</div>
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
      if (!confirm("Der neue Kilometerstand ist niedriger als der letzte – trotzdem speichern?")) return;
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
    if (btn) btn.textContent = "🤍 Merken";
  } else {
    const { error } = await sb.from("favorites").insert({ user_id: me.id, workshop_id: wsId });
    if (error) return toast(error.message);
    toast("Zu Favoriten hinzugefügt ⭐");
    if (btn) btn.textContent = "❤️ Gemerkt";
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
      <div style="font-size:44px">👑</div>
      <h2 style="font-size:22px;font-weight:800;margin-top:10px">Carfixo Premium für Betriebe</h2>
      <p class="mm" style="margin-top:10px">Detaillierte Statistiken, bevorzugte Platzierung (als „Gesponsert" markiert), mehr Bilder, Angebotsvorlagen und Auslastungsübersicht.</p>
      <div class="chips" style="justify-content:center;margin-top:16px">
        <span class="pill">📊 Angebots- & Annahmequote</span><span class="pill">⭐ Profil-Boost</span><span class="pill">🖼️ Mehr Bilder</span>
      </div>
      <button class="btn wide" style="margin-top:20px" id="wsPremGo">Premium aktivieren – in der Beta kostenlos</button>
    </div>`;
    $("wsPremGo").onclick = async () => {
      const { error } = await sb.from("workshops").update({ is_premium: true }).eq("id", myWorkshop.id);
      if (error) return toast(error.message);
      myWorkshop.is_premium = true;
      toast("Premium aktiviert 👑");
      vWsStats();
    };
    return;
  }
  main.innerHTML = `<div class="pageHead"><div><h1>Statistiken <span class="badge b-gold">👑 Premium</span></h1>
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
    `<div class="offerLine"><span>${CATS[c]?.icon || ""} ${CATS[c]?.name || c}</span><span>${v.won}/${v.sent} gewonnen</span></div>`).join("") || '<p class="mm">Noch keine Daten.</p>';
  $("stLost").innerHTML = declined.slice(0, 8).map(x =>
    `<div class="offerLine"><span>${esc(x.requests?.title || "Anfrage")}</span><span>${fmtEur(x.total_price)}</span></div>`).join("") || '<p class="mm">Keine verlorenen Angebote 🎉</p>';
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
    <div data-s="angebote" class="${arSeg === "angebote" ? "on" : ""}">📤 Angebote</div>
    <div data-s="auftraege" class="${arSeg === "auftraege" ? "on" : ""}">🗂️ Aufträge</div>
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
    box.innerHTML = arRows.length === 0 ? '<div class="empty"><div class="e">📭</div>Keine Einträge.</div>'
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
    box.innerHTML = arRows.length === 0 ? '<div class="empty"><div class="e">📭</div>Keine Einträge.</div>'
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
    <h2 style="font-size:19px;font-weight:800">🚩 Melden: ${esc(label || targetType)}</h2>
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
    ["🚗", "Fahrzeug anlegen", "Lege zuerst dein Fahrzeug in der Garage an – Marke, Modell, Baureihe. Jede Anfrage gehört zu genau einem Fahrzeug.", "vehicles"],
    ["🤖", "KI-Diagnose oder Suche", "Nicht sicher, was dein Auto hat? Nutze die KI-Diagnose. Oder finde Werkstätten direkt über die Suche mit Umkreis und Filtern.", "diagnose"],
    ["📢", "Anfrage erstellen", "Erstelle eine Ausschreibung für alle passenden Betriebe – oder stelle eine Direktanfrage an eine Wunsch-Werkstatt.", "new-request"],
    ["⚖️", "Angebote vergleichen", "Betriebe senden dir Angebote mit Einzelpositionen. Vergleiche Preis, Bewertung und Termin – und stelle Rückfragen im Chat.", "requests"],
    ["🧪", "Termin buchen", "Nimm das beste Angebot an – in der Beta als kostenlose Testbuchung. Der Termin wird mit der Werkstatt bestätigt.", null],
    ["📌", "Status verfolgen", "Verfolge deinen Auftrag live: von Fahrzeug angenommen über Reparatur läuft bis Abholbereit – inklusive Zusatzfreigaben.", null],
    ["⭐", "Bewerten", "Nach Abschluss bewertest du den Betrieb – das hilft anderen Autofahrern.", null],
  ],
  workshop: [
    ["🏪", "Profil einrichten", "Vervollständige dein Betriebsprofil: Adresse mit Karten-Pin, Beschreibung, Öffnungszeiten und Bilder.", "ws/profile"],
    ["🔧", "Leistungen wählen", "Wähle Kategorien, Detail-Leistungen und Marken-Spezialisierungen – danach filtern Kunden.", "ws/profile"],
    ["📅", "Verfügbarkeit pflegen", "Trage Kapazitäten und deinen nächsten freien Termin ein – Kunden sehen deine Verfügbarkeit.", "ws/profile"],
    ["📢", "Anfragen erhalten", "Nach der Verifizierung siehst du passende Ausschreibungen und Direktanfragen in Echtzeit.", "ws/leads"],
    ["🧾", "Angebote kalkulieren", "Kalkuliere transparent: Arbeitszeit × Stundensatz, Teile mit Garantie, Festpreis oder Schätzung. Speichere Vorlagen.", null],
    ["🗂️", "Aufträge verwalten", "Pflege den Auftragsstatus, setze Termine im Kalender und fordere Zusatzfreigaben mit Fotos an.", "ws/jobs"],
    ["📊", "Statistiken ansehen", "Sieh deine Angebots- und Annahmequote und optimiere dein Profil.", "ws/stats"],
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
        <button class="btn sm" id="tourNext">${tourStep === steps.length - 1 ? "Los geht's! 🚀" : "Weiter →"}</button>
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
    <div class="warn" style="margin-top:10px">⚠️ Dein Konto und alle zugehörigen Daten (Fahrzeuge, Anfragen, Chats${myWorkshop ? ", dein Betriebsprofil" : ""}) werden <b>unwiderruflich gelöscht</b>.</div>
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
// Start
// ============================================================
window.addEventListener("hashchange", route);
sb.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") { me = null; myProfile = null; myWorkshop = null; }
});
(async () => {
  await loadSession();
  maybeStartTour();
  // Werkstatt-Registrierung nach E-Mail-Bestätigung abschließen
  if (me && !myWorkshop && localStorage.getItem("cfx_pending_ws") && myProfile?.role === "customer") {
    await createWorkshopForMe(localStorage.getItem("cfx_pending_ws"));
    localStorage.removeItem("cfx_pending_ws");
  }
  route();
})();
