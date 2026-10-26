// ============================================================
// Carfixo – Werkstatt-Termin als Kalendereintrag (.ics)
//
// Läuft als Vercel Serverless Function unter
//   /api/termin?t=Titel&s=2026-10-27T07:00:00Z&m=60&o=Adresse
//
// Warum über den Server statt im Browser erzeugt? In der iPhone-App kann
// WKWebView keine Blob-Downloads öffnen. Ein echter https-Link mit
// text/calendar öffnet iOS dagegen direkt mit "Zum Kalender hinzufügen" –
// in Safari, Chrome und im Safari-Fenster der App gleichermaßen.
//
// Zustandslos: alles steht in der URL, gespeichert wird nichts.
// ============================================================

module.exports = function handler(req, res) {
  const q = req.query || {};
  const titel = text(q.t, 120) || "Werkstatt-Termin";
  const ort = text(q.o, 200);
  const start = new Date(String(q.s || ""));
  const min = Math.min(Math.max(parseInt(q.m, 10) || 60, 15), 600);
  if (isNaN(start.getTime())) {
    res.statusCode = 400;
    return res.end("Startzeit fehlt oder ist ungültig.");
  }
  const ende = new Date(start.getTime() + min * 60000);
  const uid = `${start.getTime()}-${hash(titel + ort)}@carfixo.de`;

  const zeilen = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Carfixo//Termin//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${ics(new Date())}`,
    `DTSTART:${ics(start)}`,
    `DTEND:${ics(ende)}`,
    `SUMMARY:${esc(titel)}`,
    ort ? `LOCATION:${esc(ort)}` : null,
    "DESCRIPTION:Gebucht über Carfixo – Details in der App.",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Werkstatt-Termin",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'inline; filename="carfixo-termin.ics"');
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.end(zeilen.map(falten).join("\r\n") + "\r\n");
};

// Nur druckbarer Text, gekürzt – die Werte kommen ungeprüft aus der URL
function text(v, max) {
  return String(v || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}
// RFC 5545: Komma, Semikolon und Backslash maskieren
function esc(s) { return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,"); }
function ics(d) { return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
// Zeilen über 75 Zeichen umbrechen (Folgezeile beginnt mit Leerzeichen)
function falten(z) {
  const out = [];
  while (z.length > 74) { out.push(z.slice(0, 74)); z = " " + z.slice(74); }
  out.push(z);
  return out.join("\r\n");
}
function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); }
