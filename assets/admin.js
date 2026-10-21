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

const VIEWS = { dashboard: vDashboard, workshops: vWorkshops, users: vUsers, requests: vRequests, payments: vPayments, reports: vReports, kuendigungen: vCancellations };
function nav(active) {
  $("topNav").innerHTML = [["dashboard", "Übersicht"], ["workshops", "Werkstätten"], ["users", "Nutzer"], ["requests", "Anfragen"], ["payments", "Zahlungen"], ["reports", "Meldungen"], ["kuendigungen", "Kündigungen & Widerrufe"]]
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
    <h1>Admin-Login</h1>
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
  <div class="card"><div class="tt">Wartende Verifizierungen</div><div id="pending" style="margin-top:12px"></div></div>`;
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
  // Conversion-Funnel + beliebte Kategorien
  const reqTotal = reqs.count || 0;
  const withOffer = new Set();
  const catCount = {};
  (reqs.data || []).forEach(r => {});
  const { data: allReq } = await sb.from("requests").select("id,category,status");
  (allReq || []).forEach(r => { catCount[r.category] = (catCount[r.category] || 0) + 1; });
  const bookedCnt = (allReq || []).filter(r => r.status === "booked").length;
  const funnel = document.createElement("div");
  funnel.className = "grid2";
  funnel.style.marginBottom = "20px";
  funnel.innerHTML = `
    <div class="card"><div class="tt">Conversion</div>
      <div class="offerLine" style="margin-top:8px"><span>Anfragen → Angebote erhalten</span><span><b>${reqTotal ? Math.round(((offers.count || 0) > 0 ? Math.min(reqTotal, offers.count) : 0) / reqTotal * 100) : 0} %</b></span></div>
      <div class="offerLine"><span>Anfragen → Buchung</span><span><b>${reqTotal ? Math.round(bookedCnt / reqTotal * 100) : 0} %</b></span></div>
      <div class="offerLine"><span>Buchung → Abschluss</span><span><b>${(bookings.data || []).length ? Math.round(completed.length / bookings.data.length * 100) : 0} %</b></span></div>
      <div class="offerLine"><span>Stornierungen / No-Shows</span><span><b>${(bookings.data || []).filter(b => b.status === "cancelled").length}</b></span></div>
    </div>
    <div class="card"><div class="tt">Beliebte Kategorien</div>
      ${Object.entries(catCount).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([c, n]) =>
        `<div class="offerLine"><span>${CATS[c]?.icon || ""} ${CATS[c]?.name || c}</span><span><b>${n}</b></span></div>`).join("") || '<p class="mm" style="margin-top:8px">Noch keine Daten.</p>'}
    </div>`;
  $("pending").parentElement.before(funnel);
  $("pending").innerHTML = pending.length === 0
    ? '<p class="mm">Keine offenen Verifizierungen </p>'
    : pending.map(w => `
      <div class="cardHead" style="padding:10px 0;border-bottom:1px solid var(--line)">
        <div class="ico icoGold"></div>
        <div style="flex:1"><div class="tt" style="font-size:13px">${esc(w.name)}</div>
        <div class="mm">${esc(w.district || "kein Standort")} · seit ${fmtDate(w.created_at)}</div></div>
        <button class="btn green sm" onclick="verifyWs('${w.id}',true)">✓ Verifizieren</button>
      </div>`).join("");
}

// ---------- Werkstätten ----------
async function vWorkshops() {
  main.innerHTML = `<div class="pageHead"><div><h1>Werkstätten</h1><div class="sub">Verifizieren, prüfen, sperren.</div></div></div>
  <div class="tblWrap"><table class="tbl"><thead><tr>
    <th>Betrieb</th><th>Standort</th><th>Kategorien</th><th>Bewertung</th><th>Status</th><th>Premium</th><th></th>
  </tr></thead><tbody id="wsRows"><tr><td colspan="6"><div class="sk" style="height:60px"></div></td></tr></tbody></table></div>`;
  const { data, error } = await sb.from("workshops").select("*").order("created_at", { ascending: false });
  if (error) { main.innerHTML += `<div class="warn">${esc(error.message)}</div>`; return; }
  $("wsRows").innerHTML = (data || []).map(w => `
    <tr>
      <td><b>${esc(w.name)}</b><div class="mm">${esc(w.email || w.phone || "")}</div></td>
      <td>${esc(w.district || "–")}${w.lat != null ? " " : ""}</td>
      <td>${(w.categories || []).map(c => CATS[c]?.icon || "").join(" ")}</td>
      <td>${w.rating_avg > 0 ? "★ " + Number(w.rating_avg).toLocaleString("de-DE") + ` (${w.rating_count})` : "–"}</td>
      <td>${w.is_verified ? '<span class="badge b-green">verifiziert</span>' : '<span class="badge b-gold">wartet</span>'}
        ${w.google_place_id ? `<div style="margin-top:6px"><a class="mm" href="https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(w.google_place_id)}" target="_blank" rel="noopener">Google-Eintrag ↗</a>
          ${w.google_place_confirmed ? '<span class="badge b-green">bestätigt</span>' : `<button class="btn green sm" style="margin-left:4px;padding:3px 8px" onclick="confirmGoogle('${w.id}',true)">Bestätigen</button>`}
          ${w.google_place_confirmed ? `<button class="btn ghost sm" style="margin-left:4px;padding:3px 8px" onclick="confirmGoogle('${w.id}',false)">Aufheben</button>` : ""}</div>` : ""}</td>
      <td>${w.is_premium ? "" : "–"}</td>
      <td style="white-space:nowrap">
        <button class="btn ${w.is_verified ? "red" : "green"} sm" onclick="verifyWs('${w.id}',${!w.is_verified})">${w.is_verified ? "Sperren" : "✓ Verifizieren"}</button>
        <button class="btn ghost sm" onclick="togglePremium('${w.id}',${!w.is_premium})" style="margin-left:6px">${w.is_premium ? "Premium aus" : "Premium an"}</button>
        <a class="btn ghost sm" href="app.html#/workshop/${w.id}" style="margin-left:6px">Profil</a>
      </td>
    </tr>`).join("") || '<tr><td colspan="7" class="mm">Keine Werkstätten.</td></tr>';
}
// Google-Eintrag erst nach Sichtprüfung freigeben: Gehört er wirklich zu
// diesem Betrieb (Name, Adresse)? Sonst könnte ein Betrieb fremde Sterne zeigen.
async function confirmGoogle(id, val) {
  const { error } = await sb.from("workshops").update({ google_place_confirmed: val }).eq("id", id);
  if (error) return toast(error.message);
  toast(val ? "Google-Eintrag bestätigt ✓" : "Bestätigung aufgehoben.");
  route();
}
async function togglePremium(id, val) {
  const { error } = await sb.from("workshops").update({ is_premium: val }).eq("id", id);
  if (error) return toast(error.message);
  toast(val ? "Premium aktiviert " : "Premium deaktiviert.");
  route();
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
    <th>Name</th><th>E-Mail</th><th>Rolle</th><th>Premium</th><th>Registriert</th><th></th>
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
      <td>${p.is_premium ? "" : "–"}</td>
      <td class="mm">${fmtDate(p.created_at)}</td>
      <td>${p.role !== "admin" ? `<button class="btn ${p.is_blocked ? "green" : "red"} sm" onclick="toggleBlock('${p.id}',${!p.is_blocked})">${p.is_blocked ? "Entsperren" : "Sperren"}</button>` : ""}</td>
    </tr>`).join("");
}

async function toggleBlock(id, val) {
  const { error } = await sb.from("profiles").update({ is_blocked: val }).eq("id", id);
  if (error) return toast(error.message);
  toast(val ? "Nutzer gesperrt." : "Nutzer entsperrt.");
  route();
}

// ---------- Meldungen & Konflikte ----------
const RP_STATUS = { offen: "b-red", in_pruefung: "b-gold", rueckfrage_gesendet: "b-blue", geloest: "b-green", abgelehnt: "b-grey", geschlossen: "b-grey" };
async function vReports() {
  main.innerHTML = `<div class="pageHead"><div><h1>Meldungen & Konflikte</h1><div class="sub">Meldungen von Kunden und Betrieben prüfen und Entscheidungen dokumentieren.</div></div></div>
  <div id="rpList"><div class="sk" style="height:110px"></div></div>`;
  const { data, error } = await sb.from("reports").select("*, workshops(name)").order("created_at", { ascending: false }).limit(100);
  if (error) { main.innerHTML += `<div class="warn">${esc(error.message)}</div>`; return; }
  $("rpList").innerHTML = (data || []).length === 0
    ? '<div class="empty"><div class="e"></div>Keine Meldungen.</div>'
    : data.map(r => `
      <div class="card" style="margin-bottom:12px">
        <div class="cardHead"><div class="ico icoRed"></div>
          <div style="flex:1"><div class="tt">${esc(r.reason)} <span class="mm">· Ziel: ${esc(r.target_type)}${r.workshops ? " · " + esc(r.workshops.name) : ""}</span></div>
          <div class="mm">${fmtDate(r.created_at)}${r.description ? " · " + esc(r.description) : ""}</div>
          ${r.admin_note ? `<div class="mm">${esc(r.admin_note)}</div>` : ""}</div>
          <span class="badge ${RP_STATUS[r.status] || "b-grey"}">${esc(r.status)}</span></div>
        <div class="foot">
          <select style="width:auto;flex:1;min-width:160px;padding:9px" onchange="setReportStatus('${r.id}',this.value)">
            ${Object.keys(RP_STATUS).map(k => `<option value="${k}" ${k === r.status ? "selected" : ""}>${k}</option>`).join("")}
          </select>
          <button class="btn ghost sm" onclick="noteReport('${r.id}')">Notiz</button>
          ${r.workshop_id ? `<a class="btn ghost sm" href="app.html#/workshop/${r.workshop_id}">Betrieb ansehen</a>` : ""}
          ${r.target_type === "review" && r.target_id ? `<button class="btn red sm" onclick="removeTarget('review','${r.id}','${r.target_id}')">Bewertung entfernen</button>` : ""}
          ${r.target_type === "part" && r.target_id ? `<button class="btn red sm" onclick="removeTarget('part','${r.id}','${r.target_id}')">Teil ausblenden</button>` : ""}
        </div>
      </div>`).join("");
}
async function setReportStatus(id, status) {
  const upd = { status };
  if (["geloest", "abgelehnt", "geschlossen"].includes(status)) upd.resolved_at = new Date().toISOString();
  const { error } = await sb.from("reports").update(upd).eq("id", id);
  if (error) return toast(error.message);
  toast("Status: " + status);
}
// Entfernen nur mit dokumentierter Begründung – die betroffene Person
// muss sie nach Art. 17 DSA erfahren (Notiz = Grundlage der Mitteilung).
async function removeTarget(kind, reportId, targetId) {
  const grund = prompt(kind === "review" ? "Warum wird die Bewertung entfernt? (wird dokumentiert)" : "Warum wird das Teil ausgeblendet? (wird dokumentiert)");
  if (!grund) return;
  const { error } = kind === "review"
    ? await sb.from("reviews").delete().eq("id", targetId)
    : await sb.from("parts").update({ active: false }).eq("id", targetId);
  if (error) return toast(error.message);
  await sb.from("reports").update({ status: "geloest", resolved_at: new Date().toISOString(),
    admin_note: (kind === "review" ? "Bewertung entfernt: " : "Teil ausgeblendet: ") + grund }).eq("id", reportId);
  toast(kind === "review" ? "Bewertung entfernt. Betroffene Person mit Begründung informieren." : "Teil ausgeblendet. Betrieb mit Begründung informieren.");
  vReports();
}
async function noteReport(id) {
  const note = prompt("Entscheidung / Notiz dokumentieren:");
  if (note == null) return;
  const { error } = await sb.from("reports").update({ admin_note: note }).eq("id", id);
  if (error) return toast(error.message);
  toast("Notiz gespeichert.");
  vReports();
}

// ---------- Kündigungen (§ 312k BGB) ----------
// Eingang über "Verträge hier kündigen". Die Bestätigung in Textform
// verschickt notify-dispatch automatisch; hier wird nur die Umsetzung erfasst.
const KD_VERTRAG = { kundenkonto: "Kundenkonto", betriebskonto: "Betriebskonto", premium_kunde: "Premium Kunde", premium_betrieb: "Premium Betrieb" };
const KD_STATUS = { eingegangen: "b-red", umgesetzt: "b-green", abgelehnt: "b-grey" };
async function vCancellations() {
  main.innerHTML = `<div class="pageHead"><div><h1>Kündigungen</h1><div class="sub">Eingegangen über „Verträge hier kündigen“. Unverzüglich umsetzen – kostenlose Konten spätestens nach 2 Werktagen.</div></div></div>
  <div id="kdList"><div class="sk" style="height:110px"></div></div>
  <h2 style="font-size:18px;font-weight:800;margin:26px 0 12px">Widerrufe</h2>
  <div id="wdList"><div class="sk" style="height:110px"></div></div>`;
  ladeWiderrufe();
  const { data, error } = await sb.from("contract_cancellations").select("*").order("received_at", { ascending: false }).limit(200);
  if (error) { $("kdList").innerHTML = `<div class="warn">${esc(error.message)}</div>`; return; }
  $("kdList").innerHTML = (data || []).length === 0
    ? '<div class="empty"><div class="e"></div>Keine Kündigungen.</div>'
    : data.map(k => `
      <div class="card" style="margin-bottom:12px">
        <div class="cardHead">
          <div style="flex:1"><div class="tt">Kündigung · ${esc(k.full_name)} <span class="mm">· ${esc(k.email)}</span></div>
          <div class="mm">${esc(KD_VERTRAG[k.contract] || k.contract)}${k.contract_ref ? " · " + esc(k.contract_ref) : ""}
            · ${k.kind === "ausserordentlich" ? "außerordentlich" : "ordentlich"}
            · ${k.effective === "datum" && k.effective_date ? "zum " + fmtDate(k.effective_date) : "nächstmöglich"}</div>
          <div class="mm">Eingang ${new Date(k.received_at).toLocaleString("de-DE")}
            · Bestätigung ${k.receipt_sent_at ? "versendet ✓" : "<b style=\"color:var(--red)\">nicht versendet – manuell bestätigen</b>"}
            ${k.processed_at ? " · erledigt " + fmtDate(k.processed_at) : ""}</div>
          ${k.reason ? `<div class="mm">Grund: ${esc(k.reason)}</div>` : ""}</div>
          <span class="badge ${KD_STATUS[k.status] || "b-grey"}">${esc(k.status)}</span></div>
        <div class="foot">
          ${k.status === "eingegangen" ? `<button class="btn green sm" onclick="setCancellation('${k.id}','umgesetzt')">✓ Umgesetzt</button>
          <button class="btn ghost sm" onclick="setCancellation('${k.id}','abgelehnt')">Ablehnen</button>` : ""}
          ${k.user_id ? `<a class="btn ghost sm" href="#/users">Nutzer ansehen</a>` : ""}
        </div>
      </div>`).join("");
}
// Widerrufe (Widerrufsbutton): Carfixo leitet nur weiter, der Betrieb wickelt
// ab. Hier prüfen, ob jede Erklärung zugeordnet und die Bestätigung raus ist.
async function ladeWiderrufe() {
  const box = $("wdList"); if (!box) return;
  const { data, error } = await sb.from("contract_withdrawals").select("*, workshops(name)").order("received_at", { ascending: false }).limit(200);
  if (error) { box.innerHTML = `<div class="warn">${esc(error.message)}</div>`; return; }
  box.innerHTML = (data || []).length === 0
    ? '<div class="empty"><div class="e"></div>Keine Widerrufe.</div>'
    : data.map(w => `
      <div class="card" style="margin-bottom:12px">
        <div class="cardHead">
          <div style="flex:1"><div class="tt">Widerruf · ${esc(w.full_name)} <span class="mm">· ${esc(w.email)}</span></div>
          <div class="mm">Auftrag ${esc(w.booking_no)} · ${w.workshops ? esc(w.workshops.name) : '<b style="color:var(--red)">nicht zugeordnet – Kunde kontaktieren</b>'}</div>
          <div class="mm">Eingang ${new Date(w.received_at).toLocaleString("de-DE")}
            · Bestätigung ${w.receipt_sent_at ? "versendet ✓" : '<b style="color:var(--red)">nicht versendet – manuell bestätigen</b>'}</div>
          ${w.note ? `<div class="mm">Nachricht: ${esc(w.note)}</div>` : ""}</div>
          <span class="badge ${w.status === "bearbeitet" ? "b-green" : "b-red"}">${esc(w.status)}</span></div>
        ${w.status !== "bearbeitet" ? `<div class="foot"><button class="btn green sm" onclick="setWithdrawal('${w.id}')">✓ Bearbeitet</button></div>` : ""}
      </div>`).join("");
}
async function setWithdrawal(id) {
  const { error } = await sb.from("contract_withdrawals").update({ status: "bearbeitet", processed_at: new Date().toISOString() }).eq("id", id);
  if (error) return toast(error.message);
  toast("Als bearbeitet markiert.");
  ladeWiderrufe();
}
async function setCancellation(id, status) {
  if (status === "abgelehnt" && !confirm("Ablehnen nur, wenn die Kündigung keinem Vertrag zuzuordnen ist. Dem Absender per E-Mail Bescheid geben. Fortfahren?")) return;
  const { error } = await sb.from("contract_cancellations").update({ status, processed_at: new Date().toISOString() }).eq("id", id);
  if (error) return toast(error.message);
  toast(status === "umgesetzt" ? "Als umgesetzt markiert." : "Abgelehnt.");
  vCancellations();
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

// ---------- Zahlungen (Stripe Connect: Betriebe sind Zahlungsempfänger) ----------
const PAY_LABELS = {
  none: ["Nicht online bezahlt", "b-grey"], payment_pending: ["In Bearbeitung", "b-gold"],
  payment_authorized: ["Autorisiert", "b-blue"], payment_paid: ["Bezahlt", "b-green"],
  payment_failed: ["Fehlgeschlagen", "b-red"], payment_refunded: ["Erstattet", "b-purple"],
  payment_cancelled: ["Storniert", "b-grey"], test_payment_confirmed: ["Testzahlung", "b-green"],
  pending: ["Ausstehend", "b-gold"], paid: ["Bezahlt", "b-green"], refunded: ["Erstattet", "b-purple"],
};
async function vPayments() {
  main.innerHTML = `<div class="pageHead"><div><h1>Zahlungen</h1><div class="sub">Online-Zahlungen laufen über Stripe direkt an die Betriebe. Carfixo nimmt kein Geld an; Erstattungen löst der Betrieb aus.</div></div></div>
  <div class="kpiRow" id="payKpis"></div>
  <div class="tblWrap"><table class="tbl"><thead><tr>
    <th>Buchung</th><th>Betrag</th><th>MwSt.</th><th>Online bezahlt</th><th>Zahlungsstatus</th><th>Auftragsstatus</th><th>Datum</th>
  </tr></thead><tbody id="payRows"><tr><td colspan="7"><div class="sk" style="height:60px"></div></td></tr></tbody></table></div>`;
  const { data, error } = await sb.from("bookings").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) { main.innerHTML += `<div class="warn">${esc(error.message)}</div>`; return; }
  const online = (data || []).filter(b => ["payment_paid", "payment_refunded"].includes(b.payment_status));
  const onlineSumme = online.reduce((s, b) => s + Number(b.paid_amount || 0) - Number(b.refunded_amount || 0), 0);
  const gmv = (data || []).filter(b => b.status === "completed").reduce((s, b) => s + Number(b.total_price || 0), 0);
  $("payKpis").innerHTML = `
    <div class="kpi"><b>${(data || []).length}</b><span>Buchungen gesamt</span></div>
    <div class="kpi"><b>${online.length}</b><span>Online-Zahlungen</span></div>
    <div class="kpi"><b>${onlineSumme.toLocaleString("de-DE")} €</b><span>Online bezahlt (netto nach Erstattung)</span></div>
    <div class="kpi"><b>${gmv.toLocaleString("de-DE")} €</b><span>Volumen (abgeschlossen)</span></div>`;
  $("payRows").innerHTML = (data || []).map(b => {
    const p = PAY_LABELS[b.payment_status] || PAY_LABELS.none;
    return `<tr>
      <td><b>${esc(b.booking_no || b.id.slice(0, 8))}</b>${b.cancelled_by ? `<div class="mm">storniert (${b.cancelled_by === "customer" ? "Kunde" : "Werkstatt"})</div>` : ""}</td>
      <td>${Number(b.total_price).toLocaleString("de-DE")} €</td>
      <td>${b.vat_amount ? Number(b.vat_amount).toLocaleString("de-DE") + " €" : "–"}</td>
      <td class="mm">${b.paid_amount ? Number(b.paid_amount).toLocaleString("de-DE") + " €" + (Number(b.refunded_amount) > 0 ? ` (−${Number(b.refunded_amount).toLocaleString("de-DE")} €)` : "") : "–"}</td>
      <td><span class="badge ${p[1]}">${p[0]}</span></td>
      <td class="mm">${esc(b.status)}</td>
      <td class="mm">${fmtDate(b.created_at)}</td>
    </tr>`;
  }).join("") || '<tr><td colspan="7" class="mm">Keine Buchungen.</td></tr>';
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
  // Die Datenbank erkennt Admin-Rechte nur mit zweitem Faktor (aal2) an.
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return aal?.nextLevel === "aal2" ? vMfaCode() : vMfaEnroll();
  mfaOk = true;
  $("avatarBtn").classList.remove("hidden");
  route();
}

// ---------- Zwei-Faktor (TOTP) ----------
let mfaOk = false;
function mfaCard(inner) {
  $("topNav").innerHTML = `<a href="#" id="outLink">Abmelden</a>`;
  $("outLink").onclick = async (e) => { e.preventDefault(); await sb.auth.signOut(); location.reload(); };
  main.innerHTML = `<div class="authWrap"><div class="authCard">${inner}<div class="err" id="mErr"></div></div></div>`;
}
function mfaFehler(msg) { const e = $("mErr"); e.textContent = msg; e.style.display = "block"; }
async function mfaPruefen(factorId) {
  const code = $("mCode").value.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return mfaFehler("Bitte den 6-stelligen Code aus der App eingeben.");
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return mfaFehler("Code falsch oder abgelaufen. Bitte den aktuellen Code eingeben.");
  boot();
}
async function vMfaCode() {
  const { data } = await sb.auth.mfa.listFactors();
  const f = (data?.totp || []).find(x => x.status === "verified");
  if (!f) return vMfaEnroll();
  mfaCard(`<h1>Bestätigungscode</h1>
    <p class="mm" style="margin-top:8px">Gib den 6-stelligen Code aus deiner Authenticator-App ein.</p>
    <input id="mCode" inputmode="numeric" autocomplete="one-time-code" maxlength="7" style="margin-top:14px;font-size:22px;letter-spacing:6px;text-align:center">
    <button class="btn wide" style="margin-top:14px" id="mGo">Bestätigen</button>`);
  $("mGo").onclick = () => mfaPruefen(f.id);
  $("mCode").onkeydown = (e) => { if (e.key === "Enter") mfaPruefen(f.id); };
  $("mCode").focus();
}
async function vMfaEnroll() {
  // Halb fertige Einrichtungen aufräumen, sonst lehnt Supabase eine neue ab.
  const { data: lf } = await sb.auth.mfa.listFactors();
  for (const f of (lf?.all || []).filter(x => x.status === "unverified")) await sb.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "Carfixo Admin" });
  if (error) return mfaCard(`<h1>Zwei-Faktor</h1><div class="warn" style="margin-top:12px">${esc(error.message)}</div>`);
  mfaCard(`<h1>Zwei-Faktor einrichten</h1>
    <p class="mm" style="margin-top:8px">Der Admin-Bereich ist nur mit zweitem Faktor zugänglich. Scanne den QR-Code mit einer Authenticator-App (z. B. Google Authenticator, 1Password, Authy) und gib den angezeigten Code ein.</p>
    <img src="${data.totp.qr_code}" alt="QR-Code für die Authenticator-App" style="display:block;width:200px;height:200px;margin:16px auto;background:#fff;border-radius:12px;padding:8px">
    <p class="mm" style="text-align:center;word-break:break-all">Manuell: <code>${esc(data.totp.secret)}</code></p>
    <input id="mCode" inputmode="numeric" autocomplete="one-time-code" maxlength="7" style="margin-top:14px;font-size:22px;letter-spacing:6px;text-align:center">
    <button class="btn wide" style="margin-top:14px" id="mGo">Aktivieren</button>`);
  $("mGo").onclick = () => mfaPruefen(data.id);
  $("mCode").onkeydown = (e) => { if (e.key === "Enter") mfaPruefen(data.id); };
}
window.addEventListener("hashchange", () => { if (myProfile?.role === "admin" && mfaOk) route(); });
boot();
