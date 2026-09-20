// ============================================================
// Carfixo – Sammelstelle für CSP-Verstöße
//
// Die Content-Security-Policy läuft vorerst im Report-Only-Modus: Der Browser
// blockiert nichts, meldet aber jeden Verstoß hierher. Die Meldungen landen in
// den Vercel-Logs (Projekt → Logs, nach "CSP-Verstoß" filtern).
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

const MAX_BYTES = 16 * 1024;   // Meldungen sind klein; alles darüber ist Müll.

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    return res.end();
  }

  try {
    const roh = await koerperLesen(req);
    if (roh) {
      for (const v of verstoesseAus(roh)) {
        // Kompakt halten: In den Logs zählt, WAS von WO blockiert würde.
        console.warn("CSP-Verstoß", JSON.stringify({
          richtlinie: v["effective-directive"] || v.effectiveDirective || "?",
          blockiert: kuerzen(v["blocked-uri"] || v.blockedURL),
          seite: kuerzen(v["document-uri"] || v.documentURL),
          zeile: v["line-number"] || v.lineNumber || undefined,
          quelle: kuerzen(v["source-file"] || v.sourceFile),
        }));
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
