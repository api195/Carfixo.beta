// Carfixo stripe: Online-Zahlung über Stripe Connect
//   { action: "status" }                -> Betrieb: Verbindungsstand (gleicht mit Stripe ab)
//   { action: "connect" }               -> Betrieb: Link zur Stripe-Einrichtung
//   { action: "checkout", booking_id }  -> Kunde: Link zur Bezahlseite
//   { action: "refund", booking_id }    -> Betrieb/Admin: volle Erstattung
//
// Modell "Direct Charges" auf Standard-Konten: Der Betrieb ist selbst
// Zahlungsempfänger, Stripe-Gebühren, Erstattungen und Rückbuchungen laufen
// über sein Konto. Carfixo nimmt kein Geld an und trägt kein Ausfallrisiko.
//
// Auth: eigenes Prüfen des Nutzer-Tokens (verify_jwt aus), weil die App mit
// einem Publishable Key arbeitet. Bezahlt markiert wird NIE hier, sondern nur
// im stripe-webhook nach Stripes signierter Bestätigung.
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
// Bezahlen erst, wenn die Arbeit erledigt ist – der Preis steht dann fest.
const ZAHLBAR_STATUS = ["ready_for_pickup", "completed"];
const NICHT_ERNEUT = ["payment_paid", "payment_pending", "payment_refunded"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "Bitte melde dich an." }, 401);

    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) {
      // Noch nicht eingerichtet: die App zeigt dann "bald verfügbar".
      return json({ configured: false, error: "Online-Zahlung ist noch nicht eingerichtet." }, action === "status" ? 200 : 503);
    }
    const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
    const { data: secrets } = await admin.rpc("get_notify_secrets");
    const app: string = (secrets || {}).app_url || "https://carfixo.de/app.html";

    if (action === "status") return await status(admin, stripe, user.id);
    if (action === "connect") return await connect(admin, stripe, user, app);
    if (action === "checkout") return await checkout(admin, stripe, user, String(body.booking_id || ""), app);
    if (action === "refund") return await refund(admin, stripe, user.id, token, String(body.booking_id || ""));
    return json({ error: "unbekannte Aktion" }, 400);
  } catch (e) {
    // Stripe-Fehlertexte sind englisch und technisch – nur loggen.
    console.error("stripe", e);
    return json({ error: "Die Zahlung konnte gerade nicht vorbereitet werden. Bitte später erneut versuchen." }, 500);
  }
});

// deno-lint-ignore no-explicit-any
type Db = any;

async function eigenerBetrieb(admin: Db, userId: string) {
  const { data } = await admin.from("workshops")
    .select("id,name,email,website,is_verified,is_demo").eq("owner_id", userId).limit(1).maybeSingle();
  return data;
}

// Kontostand bei Stripe abfragen und in der Datenbank nachziehen – so bleibt
// der Stand auch dann richtig, wenn ein Webhook verloren ging.
async function abgleichen(admin: Db, stripe: Stripe, workshopId: string, accountId: string) {
  const a = await stripe.accounts.retrieve(accountId);
  const felder = {
    charges_enabled: !!a.charges_enabled,
    payouts_enabled: !!a.payouts_enabled,
    details_submitted: !!a.details_submitted,
    updated_at: new Date().toISOString(),
  };
  await admin.from("workshop_payment_accounts").update(felder).eq("workshop_id", workshopId);
  await admin.from("workshops").update({ online_payment: felder.charges_enabled }).eq("id", workshopId);
  return felder;
}

async function status(admin: Db, stripe: Stripe, userId: string) {
  const ws = await eigenerBetrieb(admin, userId);
  if (!ws) return json({ configured: true, workshop: false });
  const { data: acc } = await admin.from("workshop_payment_accounts").select("*").eq("workshop_id", ws.id).maybeSingle();
  if (!acc) return json({ configured: true, workshop: true, connected: false, verified: !!ws.is_verified });
  const f = await abgleichen(admin, stripe, ws.id, acc.stripe_account_id);
  return json({ configured: true, workshop: true, connected: true, verified: !!ws.is_verified, ...f });
}

async function connect(admin: Db, stripe: Stripe, user: { id: string; email?: string }, app: string) {
  const ws = await eigenerBetrieb(admin, user.id);
  if (!ws) return json({ error: "Nur Inhaber eines Betriebs können Zahlungen einrichten." }, 403);
  if (ws.is_demo) return json({ error: "Beispielbetriebe können keine Zahlungen annehmen." }, 403);
  // Geld fließt nur an geprüfte Betriebe – sonst könnte ein Fake-Profil kassieren.
  if (!ws.is_verified) return json({ error: "Online-Zahlung ist möglich, sobald Carfixo deinen Betrieb verifiziert hat." }, 403);

  let { data: acc } = await admin.from("workshop_payment_accounts").select("*").eq("workshop_id", ws.id).maybeSingle();
  if (!acc) {
    const a = await stripe.accounts.create({
      type: "standard",
      country: "DE",
      email: ws.email || user.email,
      business_profile: { name: ws.name, url: ws.website || undefined, mcc: "7538" }, // 7538 = Kfz-Werkstätten
      metadata: { workshop_id: ws.id },
    });
    const { data, error } = await admin.from("workshop_payment_accounts")
      .insert({ workshop_id: ws.id, stripe_account_id: a.id, livemode: !(Deno.env.get("STRIPE_SECRET_KEY") || "").startsWith("sk_test") }).select().single();
    if (error) throw error;
    acc = data;
  }
  const link = await stripe.accountLinks.create({
    account: acc.stripe_account_id,
    type: "account_onboarding",
    refresh_url: `${app}?stripe=erneut#/ws/profile`,
    return_url: `${app}?stripe=zurueck#/ws/profile`,
  });
  return json({ url: link.url });
}

async function checkout(admin: Db, stripe: Stripe, user: { id: string; email?: string }, bookingId: string, app: string) {
  const { data: bk } = await admin.from("bookings")
    .select("id,booking_no,status,payment_status,customer_id,workshop_id,stripe_session_id,offers(request_id),workshops(name,online_payment)")
    .eq("id", bookingId).maybeSingle();
  if (!bk || bk.customer_id !== user.id) return json({ error: "Buchung nicht gefunden." }, 404);
  if (!ZAHLBAR_STATUS.includes(bk.status)) return json({ error: "Bezahlen kannst du, sobald die Werkstatt den Auftrag fertig gemeldet hat." }, 409);
  if (NICHT_ERNEUT.includes(bk.payment_status)) return json({ error: "Diese Buchung ist bereits bezahlt oder die Zahlung läuft noch." }, 409);

  const { data: acc } = await admin.from("workshop_payment_accounts").select("*").eq("workshop_id", bk.workshop_id).maybeSingle();
  if (!acc || !bk.workshops?.online_payment) return json({ error: "Diese Werkstatt nimmt keine Online-Zahlung an. Bitte direkt vor Ort bezahlen." }, 409);

  const { data: betrag } = await admin.rpc("booking_amount_due", { p_booking: bk.id });
  const cent = Math.round(Number(betrag) * 100);
  if (!(cent >= 50)) return json({ error: "Der Betrag ist zu niedrig für eine Online-Zahlung." }, 409);
  const opt = { stripeAccount: acc.stripe_account_id };

  // Offene Bezahlseite wiederverwenden – aber nur, wenn der Betrag noch stimmt
  // (zwischendurch freigegebene Zusatzarbeiten ändern ihn).
  if (bk.stripe_session_id) {
    try {
      const alt = await stripe.checkout.sessions.retrieve(bk.stripe_session_id, opt);
      // Schon bezahlt, Bestätigung (Webhook) aber noch unterwegs: kein zweites Mal kassieren.
      if (alt.status === "complete") return json({ error: "Deine Zahlung ist eingegangen und wird gerade bestätigt. Bitte lade die Seite gleich neu." }, 409);
      if (alt.status === "open" && alt.amount_total === cent && alt.url) return json({ url: alt.url });
      if (alt.status === "open") await stripe.checkout.sessions.expire(alt.id, opt);
    } catch (_) { /* alte Sitzung unbekannt: neue anlegen */ }
  }

  const reqId = bk.offers?.request_id || "";
  const s = await stripe.checkout.sessions.create({
    mode: "payment",
    locale: "de",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: cent,
        product_data: { name: `Auftrag ${bk.booking_no || ""}`.trim(), description: bk.workshops?.name || undefined },
      },
    }],
    customer_email: user.email,
    client_reference_id: bk.id,
    metadata: { booking_id: bk.id },
    payment_intent_data: { metadata: { booking_id: bk.id }, description: `Carfixo ${bk.booking_no || bk.id}` },
    success_url: `${app}?zahlung=ok#/request/${reqId}`,
    cancel_url: `${app}?zahlung=abbruch#/request/${reqId}`,
  }, opt);
  await admin.from("bookings").update({ stripe_session_id: s.id }).eq("id", bk.id);
  return json({ url: s.url });
}

async function refund(admin: Db, stripe: Stripe, userId: string, token: string, bookingId: string) {
  const { data: bk } = await admin.from("bookings")
    .select("id,payment_status,stripe_payment_intent,workshop_id,workshops(owner_id)").eq("id", bookingId).maybeSingle();
  if (!bk) return json({ error: "Buchung nicht gefunden." }, 404);

  let darf = bk.workshops?.owner_id === userId;
  if (!darf) {
    // Admin? Mit dem Token des Nutzers fragen, damit die 2FA-Regel greift.
    const alsNutzer = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data } = await alsNutzer.rpc("is_admin");
    darf = data === true;
  }
  if (!darf) return json({ error: "Nur der Betrieb kann erstatten." }, 403);
  if (bk.payment_status !== "payment_paid" || !bk.stripe_payment_intent) return json({ error: "Es gibt keine Online-Zahlung, die erstattet werden kann." }, 409);

  const { data: acc } = await admin.from("workshop_payment_accounts").select("stripe_account_id").eq("workshop_id", bk.workshop_id).maybeSingle();
  if (!acc) return json({ error: "Kein Stripe-Konto verbunden." }, 409);
  await stripe.refunds.create({ payment_intent: bk.stripe_payment_intent, metadata: { booking_id: bk.id } },
    { stripeAccount: acc.stripe_account_id });
  // Den Status setzt der Webhook (charge.refunded), sobald Stripe bestätigt.
  return json({ ok: true });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
