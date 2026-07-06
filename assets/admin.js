// ============================================================
// Carfixo Admin – geschützter Bereich (nur role = admin)
// Die Sicherheit erzwingt die Datenbank per RLS; die UI prüft
// zusätzlich die Rolle und verweigert sonst den Zugriff.
// ============================================================
"use strict";

const sb = window.supabase.createClient(CARFIXO.SUPABASE_URL, CARFIXO.SUPABASE_KEY);
let me = null, myProfile = null;
const $ = (id) => document.getElementById(id);
const main = $("main");

let toastTimer = null;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3000);
}

const VIEWS = { dashboard: vDashboard, workshops: vWorkshops, users: vUsers, requests: vRequests };
function nav(active) {
  $("topNav").innerHTML = [["dashboard", "Übersicht"], ["workshops", "Werkstätten"], ["users", "Nutzer"], ["requests", "Anfragen"]]
    .map(([k, l]) => `<a href="#/${k}" class="${active === k ? "on" : ""}">${l}</a>`).join("") +
    `<a href="app.html" style="color:var(--blue2)">Zur App</a><a href="#" id="outLink">Abmelden</a>`;
  $("outLink").onclick = async (e) => { e.preventDefault(); await sb.auth.signOut(); location.reload(); };
}

async function route() {
  const name = location.hash.replace(/^#\/?/, "") || "dashboard";
  const view = VIEWS[name] || vDashboard;
  nav(name);
  try { await view(); } catch (e) {
    main.innerHTML = `<div class="warn">Fehler: ${esc(e.message || e)}</div>`;
  }
}

// ---------- Login / Guard ----------
function vLogin(msg) {
  $("topNav").innerHTML = "";
  main.innerHTML = `
  <div class="authWrap"><div class="authCard">
    <h1>🛡️ Admin-Login</h1>
    ${msg ? `<div class="warn" style="margin-top:12px">${esc(msg)}</div>` : ""}
    <div class="label">E-Mail</div>
    <input id="aEmail" type="email" autocapitalize="off">
    <div class="label">Passwort</div>
    <input id="aPass" type="password">
    <button class="btn wide" style="margin-top:18px" id="aGo">Anmelden</button>
    <div class="err" id="aErr"></div>
  </div></div>`;
  $("aGo").onclick = async () => {
    const err = $("aErr"); err.style.display = "none";
    const { error } = await sb.auth.signInWithPassword({ email: $("aEmail").value.trim(), password: $("aPass").value });
    if (error) { err.textContent = error.message; err.style.display = "block"; return; }
    boot();
  };
}

// ---------- Übersicht ----------
async function vDashboard() {
  main.innerHTML = `<div class="pageHead"><div><h1>Übersicht</h1><div class="sub">Plattform-Statistiken auf einen Blick.</div></div></div>
  <div class="kpiRow" id="kpis">${'<div class="kpi"><div class="sk" style="height:40px"></div></div>'.repeat(4)}</div>
  <div class="kpiRow" id="kpis2"></div>
  <div class="card"><div class="tt">⏳ Wartende Verifizierungen</div><div id="pending" style="margin-top:12px"></div></div>`;
  const [ws, users, reqs, offers, bookings, reviews] = await Promise.all([
    sb.from("workshops").select("id,is_verified,name,created_at,district,categories,owner_id", { count: "exact" }),
    sb.from("profiles").select("id", { count: "exact", head: true }),
    sb.from("requests").select("id,status", { count: "exact" }),
    sb.from("offers").select("id", { count: "exact", head: true }),
    sb.from("bookings").select("id,status,total_price"),
    sb.from("reviews").select("rating"),
  ]);
  const pending = (ws.data || []).filter(w => !w.is_verified);
  const open = (reqs.data || []).filter(r => r.status === "open").length;
  const completed = (bookings.data || []).filter(b => b.status === "completed");
  const gmv = completed.reduce((s, b) => s + Number(b.total_price || 0), 0);
  const avgRating = (reviews.data || []).length ? (reviews.data.reduce((s, r) => s + r.rating, 0) / reviews.data.length).toFixed(1) : "–";
  $("kpis").innerHTML = `
    <div class="kpi"><b>${users.count ?? "–"}</b><span>Nutzer gesamt</span></div>
    <div class="kpi"><b>${ws.count ?? "–"}</b><span>Werkstätten (${pending.length} unverifiziert)</span></div>
    <div class="kpi"><b>${reqs.count ?? "–"}</b><span>Anfragen (${open} offen)</span></div>
    <div class="kpi"><b>${offers.count ?? "–"}</b><span>Angebote gesamt</span></div>`;
  $("kpis2").innerHTML = `
    <div class="kpi"><b>${(bookings.data || []).length}</b><span>Buchungen</span></div>
    <div class="kpi"><b>${completed.length}</b><span>Abgeschlossen</span></div>
    <div class="kpi"><b>${gmv.toLocaleString("de-DE")} €</b><span>Umsatzvolumen (abgeschlossen)</span></div>
    <div class="kpi"><b>★ ${avgRating}</b><span>Ø Bewertung (${(reviews.data || []).length})</span></div>`;
  $("pending").innerHTML = pending.length === 0
    ? '<p class="mm">Keine offenen Verifizierungen 🎉</p>'
    : pending.map(w => `
      <div class="cardHead" style="padding:10px 0;border-bottom:1px solid var(--line)">
        <div class="ico icoGold">🏪</div>
        <div style="flex:1"><div class="tt" style="font-size:13px">${esc(w.name)}</div>
        <div class="mm">${esc(w.district || "kein Standort")} · seit ${fmtDate(w.created_at)}</div></div>
        <button class="btn green sm" onclick="verifyWs('${w.id}',true)">✓ Verifizieren</button>
      </div>`).join("");
}

// ---------- Werkstätten ----------
async function vWorkshops() {
  main.innerHTML = `<div class="pageHead"><div><h1>Werkstätten</h1><div class="sub">Verifizieren, prüfen, sperren.</div></div></div>
  <div class="tblWrap"><table class="tbl"><thead><tr>
    <th>Betrieb</th><th>Standort</th><th>Kategorien</th><th>Bewertung</th><th>Status</th><th></th>
  </tr></thead><tbody id="wsRows"><tr><td colspan="6"><div class="sk" style="height:60px"></div></td></tr></tbody></table></div>`;
  const { data, error } = await sb.from("workshops").select("*").order("created_at", { ascending: false });
  if (error) { main.innerHTML += `<div class="warn">${esc(error.message)}</div>`; return; }
  $("wsRows").innerHTML = (data || []).map(w => `
    <tr>
      <td><b>${esc(w.name)}</b><div class="mm">${esc(w.email || w.phone || "")}</div></td>
      <td>${esc(w.district || "–")}${w.lat != null ? " 📍" : ""}</td>
      <td>${(w.categories || []).map(c => CATS[c]?.icon || "").join(" ")}</td>
      <td>${w.rating_avg > 0 ? "★ " + Number(w.rating_avg).toLocaleString("de-DE") + ` (${w.rating_count})` : "–"}</td>
      <td>${w.is_verified ? '<span class="badge b-green">verifiziert</span>' : '<span class="badge b-gold">wartet</span>'}</td>
      <td style="white-space:nowrap">
        <button class="btn ${w.is_verified ? "red" : "green"} sm" onclick="verifyWs('${w.id}',${!w.is_verified})">${w.is_verified ? "Sperren" : "✓ Verifizieren"}</button>
        <a class="btn ghost sm" href="app.html#/workshop/${w.id}" style="margin-left:6px">Profil</a>
      </td>
    </tr>`).join("") || '<tr><td colspan="6" class="mm">Keine Werkstätten.</td></tr>';
}
async function verifyWs(id, verified) {
  const { error } = await sb.from("workshops").update({ is_verified: verified }).eq("id", id);
  if (error) return toast(error.message);
  toast(verified ? "Verifiziert ✓" : "Gesperrt.");
  route();
}

// ---------- Nutzer ----------
async function vUsers() {
  main.innerHTML = `<div class="pageHead"><div><h1>Nutzer</h1><div class="sub">Alle registrierten Konten.</div></div></div>
  <div class="tblWrap"><table class="tbl"><thead><tr>
    <th>Name</th><th>E-Mail</th><th>Rolle</th><th>Premium</th><th>Registriert</th>
  </tr></thead><tbody id="uRows"><tr><td colspan="5"><div class="sk" style="height:60px"></div></td></tr></tbody></table></div>`;
  const { data, error } = await sb.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) { main.innerHTML += `<div class="warn">${esc(error.message)}</div>`; return; }
  const roleBadge = { admin: "b-red", workshop_owner: "b-blue", workshop_staff: "b-blue", customer: "b-grey" };
  const roleName = { admin: "Admin", workshop_owner: "Betrieb", workshop_staff: "Betrieb (Team)", customer: "Kunde" };
  $("uRows").innerHTML = (data || []).map(p => `
    <tr>
      <td><b>${esc(p.full_name || "–")}</b></td>
      <td>${esc(p.email || "–")}</td>
      <td><span class="badge ${roleBadge[p.role] || "b-grey"}">${roleName[p.role] || p.role}</span></td>
      <td>${p.is_premium ? "👑" : "–"}</td>
      <td class="mm">${fmtDate(p.created_at)}</td>
    </tr>`).join("");
}

// ---------- Anfragen-Monitor ----------
async function vRequests() {
  main.innerHTML = `<div class="pageHead"><div><h1>Anfragen</h1><div class="sub">Alle Ausschreibungen und Direktanfragen der Plattform.</div></div></div>
  <div class="tblWrap"><table class="tbl"><thead><tr>
    <th>Titel</th><th>Kategorie</th><th>Typ</th><th>Ort</th><th>Status</th><th>Erstellt</th>
  </tr></thead><tbody id="rRows"><tr><td colspan="6"><div class="sk" style="height:60px"></div></td></tr></tbody></table></div>`;
  const { data, error } = await sb.from("requests").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) { main.innerHTML += `<div class="warn">${esc(error.message)}</div>`; return; }
  const stBadge = { open: "b-green", booked: "b-blue", cancelled: "b-red", offers_received: "b-blue" };
  $("rRows").innerHTML = (data || []).map(r => `
    <tr>
      <td><b>${esc(r.title)}</b><div class="mm">${esc(r.vehicle_label || "")}</div></td>
      <td>${CATS[r.category]?.icon || ""} ${CATS[r.category]?.name || r.category}</td>
      <td>${r.type === "direct" ? '<span class="badge b-purple">Direkt</span>' : '<span class="badge b-grey">Offen</span>'}</td>
      <td>${esc(r.district || "–")}</td>
      <td><span class="badge ${stBadge[r.status] || "b-grey"}">${esc(r.status)}</span></td>
      <td class="mm">${fmtDate(r.created_at)}</td>
    </tr>`).join("");
}

// ---------- Start ----------
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  me = session?.user || null;
  if (!me) return vLogin();
  const { data: p } = await sb.from("profiles").select("*").eq("id", me.id).maybeSingle();
  myProfile = p;
  if (!p || p.role !== "admin") {
    await sb.auth.signOut();
    return vLogin("Dieses Konto hat keine Admin-Rechte.");
  }
  $("avatarBtn").classList.remove("hidden");
  route();
}
window.addEventListener("hashchange", () => { if (myProfile?.role === "admin") route(); });
boot();
