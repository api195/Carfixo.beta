// ============================================================
// Carfixo – Geocoding-Proxy (Adresse -> Koordinaten)
//
// Läuft als Vercel Serverless Function unter /api/geocode?q=...
//
// Zwei Anbieter, in dieser Reihenfolge:
//   1. Google Geocoding API – nur wenn die Umgebungsvariable
//      GOOGLE_MAPS_SERVER_KEY gesetzt ist. Trifft deutsche Adressen
//      (inkl. Hausnummer und Tippfehler) deutlich zuverlässiger.
//   2. Nominatim (OpenStreetMap) – kostenlos, ohne Key, immer als Rückfall.
//      Greift auch, wenn Google gerade nicht antwortet oder das Kontingent
//      erschöpft ist. Die Adresssuche fällt dadurch nie komplett aus.
//
// Warum überhaupt ein Proxy?
//   1. Der Google-Server-Key darf NICHT ins Frontend – hier bleibt er
//      in der Serverumgebung. (Der Browser-Key in assets/config.js ist ein
//      anderer und darf nur die Maps JavaScript API.)
//   2. Nominatim verlangt einen identifizierenden User-Agent mit Kontakt.
//      Ein Browser kann den nicht setzen – Anfragen werden sonst geblockt.
//   3. Ohne Proxy sieht der Kartendienst die IP-Adresse jedes Nutzers.
//   4. Am CDN gecachte Antworten sparen Kosten und entlasten den
//      kostenlosen Dienst, weil dieselben Orte ("Köln", "50667") ständig
//      gesucht werden.
// ============================================================

const GOOGLE_UPSTREAM = "https://maps.googleapis.com/maps/api/geocode/json";
const NOMINATIM_UPSTREAM = "https://nominatim.openstreetmap.org/search";
// Nominatim-Richtlinie: identifizierender User-Agent inkl. Kontaktmöglichkeit.
const USER_AGENT = "Carfixo/1.0 (Werkstatt-Marktplatz; +https://carfixo.de; kontakt@carfixo.de)";

module.exports = async function handler(req, res) {
  const q = String((req.query && req.query.q) || "").trim();

  if (!q) return json(res, 400, { error: "Parameter q fehlt." });
  if (q.length > 120) return json(res, 400, { error: "Suchbegriff zu lang." });

  const googleKey = String(process.env.GOOGLE_MAPS_SERVER_KEY || "").trim();

  try {
    let hit = null;
    if (googleKey) hit = await viaGoogle(q, googleKey);
    if (!hit) hit = await viaNominatim(q);

    if (!hit) {
      // Auch Nulltreffer cachen – Tippfehler wiederholen sich.
      res.setHeader("Cache-Control", "public, s-maxage=3600");
      return json(res, 200, { found: false });
    }

    res.setHeader("Cache-Control", "public, s-maxage=604800, stale-while-revalidate=86400");
    return json(res, 200, { found: true, lat: hit.lat, lng: hit.lng, label: hit.label });
  } catch (e) {
    const abgebrochen = e && e.name === "AbortError";
    return json(res, abgebrochen ? 504 : 500, { error: "Adresssuche gerade nicht möglich." });
  }
};

// Google Geocoding. Gibt null zurück, wenn es keinen Treffer gibt ODER der
// Dienst hakt – dann übernimmt Nominatim.
async function viaGoogle(q, key) {
  try {
    const url = `${GOOGLE_UPSTREAM}?address=${encodeURIComponent(q)}`
      + `&components=country:DE&language=de&region=de&key=${encodeURIComponent(key)}`;
    const r = await fetchMitTimeout(url, {});
    if (!r.ok) return null;

    const data = await r.json();
    if (data.status !== "OK" || !Array.isArray(data.results) || !data.results[0]) return null;

    const hit = data.results[0];
    const loc = hit.geometry && hit.geometry.location;
    if (!loc) return null;

    return {
      lat: Number(loc.lat),
      lng: Number(loc.lng),
      label: kurzLabel(hit.formatted_address, q),
    };
  } catch (e) {
    return null;   // Timeout/Netzfehler: still auf Nominatim ausweichen
  }
}

async function viaNominatim(q) {
  const url = `${NOMINATIM_UPSTREAM}?format=json&countrycodes=de&limit=1&addressdetails=0&q=${encodeURIComponent(q)}`;
  const r = await fetchMitTimeout(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "de" },
  });
  if (!r.ok) throw new Error("upstream");

  const data = await r.json();
  const hit = Array.isArray(data) && data[0];
  if (!hit) return null;

  return {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    label: kurzLabel(hit.display_name, q),
  };
}

async function fetchMitTimeout(url, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    return await fetch(url, Object.assign({ signal: ctrl.signal }, opts));
  } finally {
    clearTimeout(t);
  }
}

// Nur die ersten beiden Bestandteile anzeigen ("Domstraße 5, Köln"),
// sonst wird die Standortzeile in der App unlesbar lang.
function kurzLabel(adresse, fallback) {
  const kurz = String(adresse || "").split(",").slice(0, 2).join(",").trim();
  return kurz || fallback;
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}
