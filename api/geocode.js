// ============================================================
// Carfixo – Geocoding-Proxy (Adresse -> Koordinaten)
//
// Warum nicht direkt aus dem Browser?
//  1. Nominatim verlangt einen identifizierenden User-Agent mit Kontakt.
//     Ein Browser kann den nicht setzen – Anfragen werden sonst geblockt.
//  2. Ohne Proxy sieht Nominatim die IP-Adresse jedes Nutzers.
//  3. Am CDN gecachte Antworten entlasten den kostenlosen Dienst spürbar,
//     weil dieselben Orte ("Köln", "50667") ständig gesucht werden.
//
// Läuft als Vercel Serverless Function unter /api/geocode?q=...
// Kein API-Key, keine Kosten.
// ============================================================

const UPSTREAM = "https://nominatim.openstreetmap.org/search";
// Nominatim-Richtlinie: identifizierender User-Agent inkl. Kontaktmöglichkeit.
const USER_AGENT = "Carfixo/1.0 (Werkstatt-Marktplatz; +https://carfixo.de; kontakt@carfixo.de)";

module.exports = async function handler(req, res) {
  const q = String((req.query && req.query.q) || "").trim();

  if (!q) return json(res, 400, { error: "Parameter q fehlt." });
  if (q.length > 120) return json(res, 400, { error: "Suchbegriff zu lang." });

  try {
    const url = `${UPSTREAM}?format=json&countrycodes=de&limit=1&addressdetails=0&q=${encodeURIComponent(q)}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);

    const r = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "de" },
      signal: ctrl.signal,
    });
    clearTimeout(t);

    if (!r.ok) return json(res, 502, { error: "Adressdienst nicht erreichbar." });

    const data = await r.json();
    const hit = Array.isArray(data) && data[0];
    if (!hit) {
      // Auch Nulltreffer cachen – Tippfehler wiederholen sich.
      res.setHeader("Cache-Control", "public, s-maxage=3600");
      return json(res, 200, { found: false });
    }

    // Nur zurückgeben, was die App braucht.
    res.setHeader("Cache-Control", "public, s-maxage=604800, stale-while-revalidate=86400");
    return json(res, 200, {
      found: true,
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      label: String(hit.display_name || "").split(",").slice(0, 2).join(",").trim(),
    });
  } catch (e) {
    const abgebrochen = e && e.name === "AbortError";
    return json(res, abgebrochen ? 504 : 500, { error: "Adresssuche gerade nicht möglich." });
  }
};

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}
