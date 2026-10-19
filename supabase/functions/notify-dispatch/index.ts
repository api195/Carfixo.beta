// Carfixo notify-dispatch: Web-Push (VAPID) + optional E-Mail (Resend)
// Aufruf per DB-Trigger (pg_net). Auth via x-notify-secret.
//   { notification_id } -> Benachrichtigung an einen Nutzer (Push + E-Mail)
//   { cancellation_id } -> Kündigungsbestätigung in Textform (§ 312k Abs. 4 BGB)
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ error: "method" }, 405);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: secrets } = await admin.rpc("get_notify_secrets");
    const S: Record<string, string> = secrets || {};
    const provided = req.headers.get("x-notify-secret") || "";
    if (!S.notify_webhook_secret || provided !== S.notify_webhook_secret) {
      return json({ error: "unauthorized" }, 401);
    }
    const payload = await req.json().catch(() => ({}));
    if (payload.cancellation_id) return await sendCancellationReceipt(admin, S, payload.cancellation_id);
    const { notification_id } = payload;
    if (!notification_id) return json({ error: "missing notification_id" }, 400);
    const { data: n } = await admin.from("notifications").select("*").eq("id", notification_id).single();
    if (!n) return json({ error: "not found" }, 404);
    const { data: prof } = await admin.from("profiles")
      .select("notify_prefs, email, full_name").eq("id", n.user_id).maybeSingle();
    const prefs: Record<string, unknown> = (prof?.notify_prefs) || {};
    let pushed = 0, removed = 0, emailed = false;

    if (prefs.push !== false && S.vapid_public && S.vapid_private) {
      webpush.setVapidDetails(S.vapid_subject || "mailto:info@carfixo.de", S.vapid_public, S.vapid_private);
      const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", n.user_id);
      const payload = JSON.stringify({ title: n.title, body: n.body || "", path: n.link || "", type: n.type });
      for (const s of subs || []) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
          pushed++;
        } catch (e) {
          const code = (e as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            await admin.from("push_subscriptions").delete().eq("id", s.id);
            removed++;
          }
        }
      }
    }

    if (prefs.email !== false && S.resend_api_key && prof?.email) {
      const link = S.app_url && n.link ? `${S.app_url}#/${n.link}` : (S.app_url || "");
      const html = emailHtml(n.title, n.body || "", link);
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${S.resend_api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: S.resend_from || "Carfixo <onboarding@resend.dev>",
          to: [prof.email], subject: `Carfixo: ${n.title}`, html,
        }),
      });
      emailed = r.ok;
    }
    return json({ ok: true, pushed, removed, emailed });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

// ---------- Kündigungsbestätigung ----------
// § 312k Abs. 4 BGB: Inhalt, Datum und Uhrzeit des Zugangs und den Zeitpunkt
// der Beendigung SOFORT elektronisch in Textform bestätigen. Geht an die
// Adresse aus dem Formular – auch ohne Konto, die Kündigung braucht keins.
const VERTRAG: Record<string, string> = {
  kundenkonto: "Nutzungsvertrag (Kundenkonto)",
  betriebskonto: "Plattformvertrag (Betriebskonto)",
  premium_kunde: "Premium für Kunden",
  premium_betrieb: "Premium für Betriebe",
};

// deno-lint-ignore no-explicit-any
async function sendCancellationReceipt(admin: any, S: Record<string, string>, id: string) {
  const { data: c } = await admin.from("contract_cancellations").select("*").eq("id", id).maybeSingle();
  if (!c) return json({ error: "not found" }, 404);
  if (!S.resend_api_key) return json({ ok: false, reason: "no resend key" });

  const berlin = (d: string, opt: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", ...opt }).format(new Date(d));
  const zugang = berlin(c.received_at, { dateStyle: "long", timeStyle: "medium" });
  const ende = c.effective === "datum" && c.effective_date
    ? `zum ${berlin(c.effective_date + "T12:00:00Z", { dateStyle: "long" })} – frühestens zum nächstmöglichen Zeitpunkt`
    : "zum nächstmöglichen Zeitpunkt";
  const zeilen: [string, string][] = [
    ["Name", c.full_name],
    ["E-Mail", c.email],
    ["Vertrag", VERTRAG[c.contract] || c.contract],
    ...(c.contract_ref ? [["Angabe zum Vertrag", c.contract_ref] as [string, string]] : []),
    ["Art der Kündigung", c.kind === "ausserordentlich" ? "außerordentlich (fristlos)" : "ordentlich"],
    ...(c.reason ? [["Kündigungsgrund", c.reason] as [string, string]] : []),
    ["Beendigung", ende],
    ["Eingegangen am", zugang],
    ["Vorgangsnummer", c.id],
  ];
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f1830">`
    + `<div style="font-size:22px;font-weight:800;color:#1E6BFF">car<span style="color:#0f1830">fixo</span></div>`
    + `<h1 style="font-size:18px;margin:20px 0 6px">Eingangsbestätigung deiner Kündigung</h1>`
    + `<p style="font-size:14px;color:#48566e;line-height:1.5;margin:0 0 14px">Deine Kündigung ist bei uns eingegangen. Hier ihr Inhalt:</p>`
    + `<table style="font-size:14px;border-collapse:collapse;width:100%">`
    + zeilen.map(([k, v]) => `<tr><td style="padding:6px 10px 6px 0;color:#48566e;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td>`
      + `<td style="padding:6px 0;font-weight:600">${escapeHtml(String(v))}</td></tr>`).join("")
    + `</table>`
    + `<p style="font-size:12px;color:#9aa7bd;margin-top:24px;line-height:1.5">Die Kündigung wurde über die Schaltfläche „Jetzt kündigen“ auf carfixo.de erklärt. `
    + `Falls du das nicht warst, antworte bitte nicht auf diese E-Mail, sondern schreib uns an ${escapeHtml(S.contact_email || "info@carfixo.de")}.</p></div>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${S.resend_api_key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: S.resend_from || "Carfixo <onboarding@resend.dev>",
      to: [c.email], subject: "Carfixo: Eingangsbestätigung deiner Kündigung", html,
    }),
  });
  if (r.ok) {
    await admin.from("contract_cancellations").update({ receipt_sent_at: new Date().toISOString() }).eq("id", id);
  }
  return json({ ok: r.ok, emailed: r.ok });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function emailHtml(title: string, body: string, link: string) {
  const btn = link
    ? `<a href="${link}" style="display:inline-block;margin-top:18px;background:#1E6BFF;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700">In Carfixo öffnen</a>`
    : "";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f1830">`
    + `<div style="font-size:22px;font-weight:800;color:#1E6BFF">car<span style="color:#0f1830">fixo</span></div>`
    + `<h1 style="font-size:18px;margin:20px 0 6px">${escapeHtml(title)}</h1>`
    + `<p style="font-size:14px;color:#48566e;line-height:1.5;margin:0">${escapeHtml(body)}</p>${btn}`
    + `<p style="font-size:11px;color:#9aa7bd;margin-top:28px">Du erhältst diese E-Mail, weil E-Mail-Benachrichtigungen in deinem Carfixo-Konto aktiv sind.</p></div>`;
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m] as string));
}
