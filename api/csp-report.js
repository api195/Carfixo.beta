// ============================================================
// Carfixo – Sammelstelle für CSP-Verstöße
//
// Die Content-Security-Policy läuft vorerst im Report-Only-Modus: Der Browser
// blockiert nichts, meldet aber jeden Verstoß hierher. Die Meldungen landen in
// der Tabelle public.csp_reports (30 Tage, max. 2000 pro Tag – Funktion
// log_csp_report) und zusätzlich in den Vercel-Logs. Auf dem Hobby-Tarif hält
// Vercel Logs nur eine Stunde, deshalb die Datenbank.
//
// Auswerten im Supabase SQL-Editor:
//   select directive, blocked, count(*) from csp_reports
//   group by 1, 2 order by 3 desc;
//
// So lässt sich über ein paar Tage echten Traffics sammeln, welche Quellen die
// Richtlinie noch nicht kennt – bevor sie scharf geschaltet wird und im
// Zweifel die Seite lahmlegt.
//
// Browser schicken zwei Formate an dieselbe URL:
//   - report-uri  -> { "csp-report": { ... } }          (u.a. Safari)
//   - report-to   -> [ { "type": "csp-violation", ... } ] (Chrome, Edge)
// Beide werden hier auf eine gemeinsame Form gebracht.
// ============================================================

const fs = require("fs");
const path = require("path");

const MAX_BYTES = 16 * 1024;   // Meldungen sind klein; alles darüber ist Müll.

// Supabase-Adresse und öffentlichen Publishable Key aus derselben Datei wie
// das Frontend lesen – so gibt es nur eine Stelle zum Pflegen. Ein Geheimnis
// ist das nicht; log_csp_report ist bewusst für anon freigegeben.
const SUPA = (() => {
  try {
    const t = fs.readFileSync(path.join(__dirname, "..", "assets", "config.js"), "utf8");
    const url = (t.match(/SUPABASE_URL:\s*"([^"]+)"/) || [])[1];
    const key = (t.match(/SUPABASE_KEY:\s*"([^"]+)"/) || [])[1];
    return url && key ? { url, key } : null;
  } catch (e) { return null; }
})();

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    return res.end();
  }

  try {
    const roh = await koerperLesen(req);
    if (roh) {
      // Höchstens 5 pro Anfrage – mehr schickt kein ehrlicher Browser.
      for (const v of verstoesseAus(roh).slice(0, 5)) {
        // Kompakt halten: Es zählt, WAS von WO blockiert würde.
        const m = {
          richtlinie: v["effective-directive"] || v.effectiveDirective || v["violated-directive"] || "?",
          blockiert: kuerzen(v["blocked-uri"] || v.blockedURL),
          seite: kuerzen(v["document-uri"] || v.documentURL),
          zeile: Number(v["line-number"] || v.lineNumber) || undefined,
          quelle: kuerzen(v["source-file"] || v.sourceFile),
        };
        console.warn("CSP-Verstoß", JSON.stringify(m));
        await speichern(m);
      }
    }
  } catch (e) {
    // Eine kaputte Meldung darf nichts weiter auslösen – der Browser
    // interessiert sich ohnehin nicht für die Antwort.
  }

  // Immer 204: Der Browser wiederholt sonst unnötig.
  res.statusCode = 204;
  res.end();
};

// Fehler beim Speichern sind egal – die Meldung steht dann nur im Log.
async function speichern(m) {
  if (!SUPA) return;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3000);
    await fetch(`${SUPA.url}/rest/v1/rpc/log_csp_report`, {
      method: "POST",
      signal: ctl.signal,
      headers: { apikey: SUPA.key, Authorization: `Bearer ${SUPA.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_directive: String(m.richtlinie).slice(0, 80),
        p_blocked: m.blockiert || null,
        p_page: m.seite || null,
        p_source: m.quelle || null,
        p_line: m.zeile || null,
      }),
    });
    clearTimeout(t);
  } catch (e) { /* egal */ }
}

function koerperLesen(req) {
  // Vercel parst je nach Content-Type schon vor; beide Fälle abdecken.
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") return Promise.resolve(sicherParsen(req.body));

  return new Promise((resolve) => {
    let daten = "", zuGross = false;
    req.on("data", (stueck) => {
      if (zuGross) return;
      daten += stueck;
      if (daten.length > MAX_BYTES) { zuGross = true; daten = ""; }
    });
    req.on("end", () => resolve(zuGross ? null : sicherParsen(daten)));
    req.on("error", () => resolve(null));
  });
}

function sicherParsen(text) {
  try { return JSON.parse(text); } catch (e) { return null; }
}

// Beide Meldeformate auf eine Liste einzelner Verstöße bringen.
function verstoesseAus(roh) {
  if (Array.isArray(roh)) {
    return roh.filter(e => e && e.type === "csp-violation" && e.body).map(e => e.body);
  }
  if (roh && roh["csp-report"]) return [roh["csp-report"]];
  return [];
}

// Lange Data-URIs und Query-Strings würden die Logs zumüllen.
function kuerzen(wert) {
  const s = String(wert || "");
  if (!s) return undefined;
  return s.length > 180 ? s.slice(0, 180) + "…" : s;
}
