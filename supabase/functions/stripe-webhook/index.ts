// Carfixo stripe-webhook: Rückmeldungen von Stripe (Connect-Endpunkt).
// Einzige Stelle, die Buchungen als bezahlt/erstattet markiert. Jede
// Meldung ist von Stripe signiert (STRIPE_WEBHOOK_SECRET) – ohne gültige
// Signatur passiert nichts.
//
// Im Stripe-Dashboard als Endpunkt für "Ereignisse in verbundenen Konten"
// anlegen, mit diesen Ereignissen:
//   checkout.session.completed, checkout.session.async_payment_succeeded,
//   checkout.session.async_payment_failed, charge.refunded,
//   account.updated, account.application.deauthorized
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!key || !secret) return new Response("not configured", { status: 503 });

  const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
  const roh = await req.text();
  let ev: Stripe.Event;
  try {
    ev = await stripe.webhooks.constructEventAsync(roh, req.headers.get("stripe-signature") || "", secret,
      undefined, Stripe.createSubtleCryptoProvider());
  } catch (_) {
    return new Response("bad signature", { status: 400 });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    await verarbeiten(admin, ev);
    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    // 500 -> Stripe wiederholt die Zustellung automatisch.
    console.error("stripe-webhook", ev.type, e);
    return new Response("error", { status: 500 });
  }
});

// deno-lint-ignore no-explicit-any
type Db = any;

export async function verarbeiten(admin: Db, ev: Stripe.Event) {
  switch (ev.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed": {
      const s = ev.data.object as Stripe.Checkout.Session;
      const bk = await passendeBuchung(admin, s.metadata?.booking_id, ev.account);
      // Gehört die Sitzung nicht genau zu dieser Buchung und diesem Betrieb,
      // wird sie ignoriert. Sonst könnte ein Betrieb mit einer selbst
      // angelegten Sitzung fremde Buchungen als bezahlt markieren.
      if (!bk || bk.stripe_session_id !== s.id) return;
      const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id || null;
      if (ev.type === "checkout.session.async_payment_failed") {
        await admin.from("bookings").update({ payment_status: "payment_failed", stripe_payment_intent: pi }).eq("id", bk.id);
      } else if (s.payment_status === "paid") {
        await admin.from("bookings").update({
          payment_status: "payment_paid",
          paid_amount: (s.amount_total || 0) / 100,
          paid_at: new Date(ev.created * 1000).toISOString(),
          stripe_payment_intent: pi,
        }).eq("id", bk.id);
      } else {
        // z. B. SEPA-Lastschrift: Geld kommt erst in einigen Tagen.
        await admin.from("bookings").update({ payment_status: "payment_pending", stripe_payment_intent: pi }).eq("id", bk.id);
      }
      return;
    }
    case "charge.refunded": {
      const c = ev.data.object as Stripe.Charge;
      const pi = typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent?.id;
      if (!pi) return;
      const { data: bk } = await admin.from("bookings").select("id,workshop_id").eq("stripe_payment_intent", pi).maybeSingle();
      if (!bk || !(await kontoPasst(admin, bk.workshop_id, ev.account))) return;
      await admin.from("bookings").update({
        refunded_amount: c.amount_refunded / 100,
        // Teilerstattung: bleibt "bezahlt", der erstattete Betrag steht daneben.
        ...(c.refunded ? { payment_status: "payment_refunded" } : {}),
      }).eq("id", bk.id);
      return;
    }
    case "account.updated": {
      const a = ev.data.object as Stripe.Account;
      const { data: acc } = await admin.from("workshop_payment_accounts").select("workshop_id").eq("stripe_account_id", a.id).maybeSingle();
      if (!acc) return;
      await admin.from("workshop_payment_accounts").update({
        charges_enabled: !!a.charges_enabled, payouts_enabled: !!a.payouts_enabled,
        details_submitted: !!a.details_submitted, updated_at: new Date().toISOString(),
      }).eq("workshop_id", acc.workshop_id);
      await admin.from("workshops").update({ online_payment: !!a.charges_enabled }).eq("id", acc.workshop_id);
      return;
    }
    case "account.application.deauthorized": {
      // Betrieb hat Carfixo in seinem Stripe-Konto getrennt.
      if (!ev.account) return;
      const { data: acc } = await admin.from("workshop_payment_accounts").select("workshop_id").eq("stripe_account_id", ev.account).maybeSingle();
      if (!acc) return;
      await admin.from("workshop_payment_accounts").update({ charges_enabled: false, payouts_enabled: false, updated_at: new Date().toISOString() }).eq("workshop_id", acc.workshop_id);
      await admin.from("workshops").update({ online_payment: false }).eq("id", acc.workshop_id);
      return;
    }
  }
}

async function kontoPasst(admin: Db, workshopId: string, account?: string | null) {
  if (!account) return false;
  const { data } = await admin.from("workshop_payment_accounts").select("stripe_account_id").eq("workshop_id", workshopId).maybeSingle();
  return data?.stripe_account_id === account;
}

async function passendeBuchung(admin: Db, bookingId?: string | null, account?: string | null) {
  if (!bookingId) return null;
  const { data: bk } = await admin.from("bookings").select("id,workshop_id,stripe_session_id").eq("id", bookingId).maybeSingle();
  if (!bk || !(await kontoPasst(admin, bk.workshop_id, account))) return null;
  return bk;
}
