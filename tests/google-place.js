// Carfixo – /api/google-place ohne echtes Google: fetch wird nachgebildet.
// Ausführen:  node tests/google-place.js
process.env.GOOGLE_MAPS_SERVER_KEY = "test-key";
let pass = 0, fail = 0;
const check = (n, ok, i = "") => { console.log(`${ok ? "OK  " : "FAIL"}  ${n}${i ? "  – " + i : ""}`); ok ? pass++ : fail++; };

const BESTAETIGT = "ChIJbestaetigt0000001";
const aufrufe = [];
global.fetch = async (url, opt = {}) => {
  url = String(url); aufrufe.push(url);
  const antwort = (body, status = 200, typ = "application/json") => ({
    ok: status < 400, status, headers: { get: () => typ },
    json: async () => body, arrayBuffer: async () => new TextEncoder().encode("BILD").buffer,
  });
  if (url.includes("/auth/v1/user")) return antwort({}, opt.headers.Authorization === "Bearer gueltig" ? 200 : 401);
  if (url.includes("/rest/v1/workshops")) return antwort(url.includes(`eq.${BESTAETIGT}`) ? [{ id: "w1" }] : []);
  if (url.includes("places:searchText")) return antwort({ places: [{ id: "ChIJtreffer000001", displayName: { text: "Autohaus Test" }, formattedAddress: "Köln", rating: 4.6, userRatingCount: 230 }] });
  if (url.includes("/media?")) return antwort(null, 200, "image/jpeg");
  if (url.includes(`/places/${BESTAETIGT}`)) return antwort({ rating: 4.6, userRatingCount: 230, googleMapsUri: "https://maps.google.com/?cid=1",
    photos: Array.from({ length: 9 }, (_, i) => ({ name: `places/${BESTAETIGT}/photos/foto${i}abcdefghij`, authorAttributions: [{ displayName: "Max", uri: "https://x" }] })) });
  return antwort({}, 404);
};

const handler = require("../api/google-place.js");
const rufe = (query, headers = {}) => new Promise((resolve) => {
  const res = { statusCode: 200, h: {}, setHeader(k, v) { this.h[k.toLowerCase()] = v; }, getHeader(k) { return this.h[k.toLowerCase()]; },
    end(b) { resolve({ status: this.statusCode, h: this.h, body: Buffer.isBuffer(b) ? b : (b ? JSON.parse(b) : null) }); } };
  handler({ method: "GET", query, headers }, res);
});

(async () => {
  let r = await rufe({ suche: "Autohaus Test Köln" });
  check("Suche ohne Anmeldung abgelehnt", r.status === 401);
  r = await rufe({ suche: "Autohaus Test Köln" }, { authorization: "Bearer gueltig" });
  check("Suche angemeldet liefert Treffer", r.status === 200 && r.body.treffer[0].name === "Autohaus Test" && r.body.treffer[0].sterne === 4.6);
  r = await rufe({ suche: "ab" }, { authorization: "Bearer gueltig" });
  check("Zu kurze Suche abgelehnt", r.status === 400);

  r = await rufe({ id: BESTAETIGT });
  check("Bestätigter Eintrag: Sterne und Link", r.status === 200 && r.body.sterne === 4.6 && r.body.anzahl === 230 && r.body.link.startsWith("https://"));
  check("Höchstens 4 Fotos mit Urheber", r.body.fotos.length === 4 && r.body.fotos[0].autoren[0].name === "Max");
  check("Nur kurz im Browser zwischengespeichert", r.h["cache-control"] === "private, max-age=600");
  r = await rufe({ id: "ChIJfremd0000000001" });
  check("Fremder/unbestätigter Eintrag abgelehnt", r.status === 404);
  r = await rufe({ id: "../../etwas" });
  check("Ungültige Place-ID abgelehnt", r.status === 400);

  r = await rufe({ foto: `places/${BESTAETIGT}/photos/foto1abcdefghij` });
  check("Foto wird über unseren Server ausgeliefert", r.status === 200 && r.h["content-type"] === "image/jpeg" && r.body.toString() === "BILD");
  check("Server-Key nicht im Bild-Header", !JSON.stringify(r.h).includes("test-key"));
  r = await rufe({ foto: `places/ChIJfremd0000000001/photos/foto1abcdefghij` });
  check("Foto eines fremden Eintrags abgelehnt", r.status === 404);
  r = await rufe({ foto: "https://evil.example/x.jpg" });
  check("Beliebige URL als Foto abgelehnt", r.status === 400);
  check("Google nie ohne Prüfung aufgerufen", !aufrufe.some(u => u.includes("ChIJfremd") && u.includes("places.googleapis.com")));

  delete process.env.GOOGLE_MAPS_SERVER_KEY;
  r = await rufe({ id: BESTAETIGT });
  check("Ohne Server-Key: 503 statt Absturz", r.status === 503);

  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
})();
