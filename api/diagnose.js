// ============================================================
// Carfixo – KI-Ersteinschätzung (Claude, mit Fotos)
//
// Läuft als Vercel Serverless Function unter POST /api/diagnose.
// Eingabe (JSON): { desc, lights[], sounds[], car{make,model,year,ps}, urgency,
//                   images[] (bis 3 JPEG als Base64, vom Browser verkleinert) }
// Antwort: { configured, result{summary, safe_to_drive, urgency, photo_findings, causes[]} }
//
// - Ohne ANTHROPIC_API_KEY (Vercel-Umgebungsvariable) antwortet die Funktion
//   mit configured:false – die App zeigt dann nur die regelbasierte Einschätzung.
// - Nur für angemeldete Nutzer: das Supabase-Token wird bei Supabase geprüft,
//   damit niemand die (kostenpflichtige) Schnittstelle anonym leerziehen kann.
// - Plain fetch statt SDK: die Funktionen hier laufen ohne npm-Abhängigkeiten.
// ============================================================

const SUPABASE_URL = "https://boozzfiroukraekyijfq.supabase.co";
const MODEL = "claude-opus-5-5";
const KATEGORIEN = ["reparatur", "inspektion", "reifen", "karosserie", "lack", "pflege", "klima", "tuev",
  "tuning", "autoglas", "schluessel", "oldtimer", "eauto"];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "safe_to_drive", "urgency", "photo_findings", "causes"],
  properties: {
    summary: { type: "string", description: "Ein bis zwei Sätze Ersteinschätzung, Du-Form" },
    safe_to_drive: { type: "string", enum: ["ja", "eingeschraenkt", "nein"] },
    urgency: { type: "string", enum: ["normal", "bald", "sofort"] },
    photo_findings: { type: "string", description: "Was auf den Fotos zu sehen ist; leer, wenn keine Fotos" },
    causes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "likelihood", "category", "service", "explanation", "next_step"],
        properties: {
          title: { type: "string" },
          likelihood: { type: "string", enum: ["hoch", "mittel", "gering"] },
          category: { type: "string", enum: KATEGORIEN },
          service: { type: "string", description: "Passende Werkstattleistung, z. B. Bremsen, Ölwechsel" },
          explanation: { type: "string" },
          next_step: { type: "string" },
        },
      },
    },
  },
};

const SYSTEM = `Du bist der Diagnose-Assistent von Carfixo, einem deutschen Werkstatt-Marktplatz.
Du gibst Autofahrern eine unverbindliche Ersteinschätzung: mögliche Ursachen (höchstens 4, die
wahrscheinlichste zuerst), ob sie weiterfahren können und wie dringend es ist. Schreibe kurz,
verständlich und ohne Fachjargon, in der Du-Form.
Grundsätze:
- Du kannst das Auto nicht prüfen. Formuliere Ursachen als Möglichkeiten, nie als Befund.
- Sicherheit zuerst: Bei Bremsen, Lenkung, Öldruck, Überhitzung, Rauch, Benzingeruch oder roten
  Warnleuchten safe_to_drive "nein" oder "eingeschraenkt" und urgency "sofort".
- Nenne keine Preise und keine Marken von Werkstätten.
- Beschreibe auf Fotos nur, was wirklich erkennbar ist. Personen, Kennzeichen oder andere
  persönliche Daten auf Fotos erwähnst du nicht.
- Geht es nicht um ein Fahrzeugproblem, gib eine leere Ursachenliste zurück und erkläre im summary kurz,
  wobei Carfixo helfen kann.`;

// Einfache Bremse je Server-Instanz (ersetzt kein echtes Kontingent)
const ZULETZT = new Map();

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }   // Vorabprüfung der App (CORS)
  if (req.method !== "POST") return json(res, 405, { error: "Nur POST." });
  const key = String(process.env.ANTHROPIC_API_KEY || "").trim();
  if (!key) return json(res, 200, { configured: false });

  // Angemeldet? Token bei Supabase prüfen
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const anon = String(process.env.SUPABASE_ANON_KEY || req.headers.apikey || "");
  if (!token || !anon) return json(res, 401, { error: "Bitte melde dich an." });
  const nutzer = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: { apikey: anon, Authorization: "Bearer " + token } })
    .then(r => r.ok ? r.json() : null).catch(() => null);
  if (!nutzer || !nutzer.id) return json(res, 401, { error: "Bitte melde dich an." });
  const jetzt = Date.now();
  if (jetzt - (ZULETZT.get(nutzer.id) || 0) < 20000) return json(res, 429, { error: "Bitte kurz warten und erneut versuchen." });
  ZULETZT.set(nutzer.id, jetzt);

  const b = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  const desc = String(b.desc || "").slice(0, 1500);
  const lights = (Array.isArray(b.lights) ? b.lights : []).map(String).slice(0, 10);
  const sounds = (Array.isArray(b.sounds) ? b.sounds : []).map(String).slice(0, 10);
  const car = b.car && typeof b.car === "object" ? b.car : {};
  const bilder = (Array.isArray(b.images) ? b.images : [])
    .filter(x => typeof x === "string" && /^[A-Za-z0-9+/=]+$/.test(x) && x.length < 1_600_000).slice(0, 3);
  if (!desc && !lights.length && !sounds.length && !bilder.length) return json(res, 400, { error: "Keine Angaben." });

  const text = [
    car.make ? `Fahrzeug: ${[car.make, car.model, car.year, car.ps ? car.ps + " PS" : ""].filter(Boolean).join(" ")}` : "Fahrzeug: unbekannt",
    desc ? `Beschreibung des Fahrers: ${desc}` : "",
    lights.length ? `Warnleuchten: ${lights.join(", ")}` : "",
    sounds.length ? `Geräusche: ${sounds.join(", ")}` : "",
    b.urgency ? `Eigene Einschätzung der Dringlichkeit: ${String(b.urgency).slice(0, 20)}` : "",
    bilder.length ? `${bilder.length} Foto(s) anbei.` : "Keine Fotos.",
  ].filter(Boolean).join("\n");

  const content = [
    ...bilder.map(data => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } })),
    { type: "text", text },
  ];

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2026-10-21",
        // Lehnt ein Sicherheitsfilter ab, übernimmt serverseitig das empfohlene Ersatzmodell
        "anthropic-beta": "server-side-fallback-2026-07-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM,
        fallbacks: "default",
        output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
        messages: [{ role: "user", content }],
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      console.error("Anthropic", r.status, d && d.error);
      return json(res, 502, { configured: true, error: "Die KI-Einschätzung ist gerade nicht erreichbar." });
    }
    if (d.stop_reason === "refusal") return json(res, 200, { configured: true, refused: true });
    const t = (d.content || []).find(c => c.type === "text");
    const result = t ? safeParse(t.text) : null;
    if (!result) return json(res, 502, { configured: true, error: "Antwort unvollständig." });
    result.causes = (result.causes || []).slice(0, 4);
    return json(res, 200, { configured: true, result });
  } catch (e) {
    console.error("diagnose", e);
    return json(res, 502, { configured: true, error: "Die KI-Einschätzung ist gerade nicht erreichbar." });
  }
};

function safeParse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
