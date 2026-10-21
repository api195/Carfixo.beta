// ============================================================
// Carfixo – Google-Eintrag eines Betriebs (Sterne, Fotos)
//
//   GET /api/google-place?suche=Name+Ort      Kandidaten zum Verknüpfen
//                                            (nur angemeldet)
//   GET /api/google-place?id=PLACE_ID         Sterne, Anzahl, Link, Fotoliste
//   GET /api/google-place?foto=places/…/photos/…   das Foto selbst
//
// Warum über unseren Server?
//   1. Der Server-Key (GOOGLE_MAPS_SERVER_KEY) bleibt geheim.
//   2. Google sieht nicht die IP-Adressen der Besucher – deshalb braucht die
//      Anzeige keine Einwilligung (anders als die interaktive Karte).
//   3. Sterne und Fotos gibt es nur für Betriebe, deren Verknüpfung ein Admin
//      bestätigt hat. Fremde Place-IDs werden abgelehnt, damit niemand den
//      Endpunkt auf unsere Kosten für beliebige Orte nutzt.
//
// Google erlaubt, nur die Place-ID dauerhaft zu speichern. Sterne und Fotos
// werden deshalb bei jedem Aufruf frisch geholt und nur kurz im Browser
// zwischengespeichert. Benötigt: "Places API (New)" für den Server-Key.
// ============================================================

const fs = require("fs");
const path = require("path");

const PLACES = "https://places.googleapis.com/v1";
const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;
const FOTO = /^places\/([A-Za-z0-9_-]{10,300})\/photos\/([A-Za-z0-9_-]{10,1000})$/;
const MAX_FOTOS = 4;   // jedes Foto ist ein eigener, kostenpflichtiger Abruf

// Supabase-Adresse und Publishable Key aus der Frontend-Konfiguration – kein Geheimnis.
const SUPA = (() => {
  try {
    const t = fs.readFileSync(path.join(__dirname, "..", "assets", "config.js"), "utf8");
    const url = (t.match(/SUPABASE_URL:\s*"([^"]+)"/) || [])[1];
    const key = (t.match(/SUPABASE_KEY:\s*"([^"]+)"/) || [])[1];
    return url && key ? { url, key } : null;
  } catch (e) { return null; }
})();

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "method" });
  const key = String(process.env.GOOGLE_MAPS_SERVER_KEY || "").trim();
  if (!key || !SUPA) return json(res, 503, { error: "Google-Anbindung ist nicht eingerichtet." });
  const q = req.query || {};

  try {
    if (q.suche != null) return await suche(req, res, key, String(q.suche));
    if (q.id != null) return await details(res, key, String(q.id));
    if (q.foto != null) return await foto(res, key, String(q.foto));
    return json(res, 400, { error: "Parameter fehlt." });
  } catch (e) {
    console.warn("google-place", e && e.message);
    return json(res, 502, { error: "Google ist gerade nicht erreichbar." });
  }
};

// Kandidaten für die Verknüpfung – nur für angemeldete Nutzer, damit die
// Textsuche nicht anonym auf unsere Kosten läuft.
async function suche(req, res, key, text) {
  text = text.trim();
  if (text.length < 3 || text.length > 120) return json(res, 400, { error: "Bitte Name und Ort eingeben." });
  if (!(await angemeldet(req))) return json(res, 401, { error: "Bitte melde dich an." });

  const r = await mitTimeout(`${PLACES}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount",
    },
    body: JSON.stringify({ textQuery: text, languageCode: "de", regionCode: "DE", pageSize: 5 }),
  });
  if (!r.ok) throw new Error("searchText " + r.status);
  const d = await r.json();
  res.setHeader("Cache-Control", "no-store");
  return json(res, 200, {
    treffer: (d.places || []).slice(0, 5).map(p => ({
      id: p.id,
      name: p.displayName && p.displayName.text || "",
      adresse: p.formattedAddress || "",
      sterne: p.rating || null,
      anzahl: p.userRatingCount || 0,
    })),
  });
}

async function details(res, key, id) {
  if (!PLACE_ID.test(id)) return json(res, 400, { error: "Ungültige Place-ID." });
  if (!(await bestaetigt(id))) return json(res, 404, { error: "Kein bestätigter Google-Eintrag." });

  const r = await mitTimeout(`${PLACES}/places/${id}?languageCode=de`, {
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "rating,userRatingCount,googleMapsUri,photos" },
  });
  if (!r.ok) throw new Error("details " + r.status);
  const d = await r.json();
  res.setHeader("Cache-Control", "private, max-age=600");
  return json(res, 200, {
    sterne: d.rating || null,
    anzahl: d.userRatingCount || 0,
    link: d.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${id}`,
    fotos: (d.photos || []).slice(0, MAX_FOTOS).map(f => ({
      name: f.name,
      // Google verlangt, die Urheber der Fotos zu nennen.
      autoren: (f.authorAttributions || []).map(a => ({ name: a.displayName || "", url: a.uri || "" })),
    })),
  });
}

async function foto(res, key, name) {
  const m = name.match(FOTO);
  if (!m) return json(res, 400, { error: "Ungültiges Foto." });
  if (!(await bestaetigt(m[1]))) return json(res, 404, { error: "Kein bestätigter Google-Eintrag." });

  const r = await mitTimeout(`${PLACES}/${name}/media?maxWidthPx=900&key=${encodeURIComponent(key)}`, {});
  if (!r.ok) throw new Error("foto " + r.status);
  const typ = r.headers.get("content-type") || "image/jpeg";
  if (!typ.startsWith("image/")) throw new Error("kein Bild");
  const daten = Buffer.from(await r.arrayBuffer());
  res.statusCode = 200;
  res.setHeader("Content-Type", typ);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.end(daten);
}

// Gibt es einen Betrieb, dessen Verknüpfung mit dieser Place-ID bestätigt ist?
async function bestaetigt(placeId) {
  const url = `${SUPA.url}/rest/v1/workshops?select=id&google_place_id=eq.${encodeURIComponent(placeId)}`
    + "&google_place_confirmed=is.true&limit=1";
  const r = await mitTimeout(url, { headers: { apikey: SUPA.key, Authorization: `Bearer ${SUPA.key}` } });
  if (!r.ok) return false;
  const rows = await r.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function angemeldet(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || token === SUPA.key) return false;
  const r = await mitTimeout(`${SUPA.url}/auth/v1/user`, { headers: { apikey: SUPA.key, Authorization: `Bearer ${token}` } });
  return r.ok;
}

function mitTimeout(url, opt, ms = 6000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  return fetch(url, { ...opt, signal: ctl.signal }).finally(() => clearTimeout(t));
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (!res.getHeader("Cache-Control")) res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
