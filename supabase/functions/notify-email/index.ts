// ============================================================
// Carfixo – E-Mail-Versand für neue Benachrichtigungen
//
// Ablauf:  INSERT in public.notifications
//          -> Supabase Database Webhook (POST)
//          -> diese Edge-Function
//          -> E-Mail via Resend an die Adresse des Nutzers
//
// Deploy & Einrichtung: siehe supabase/functions/notify-email/README.md
// Wird NICHT automatisch versendet, solange RESEND_API_KEY fehlt.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "Carfixo <no-reply@carfixo.de>";
const APP_URL = Deno.env.get("APP_URL") ?? "https://carfixo.de";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]!));

function emailHtml(title: string, body: string, link?: string) {
  const btn = link
    ? `<a href="${esc(link)}" style="display:inline-block;margin-top:20px;background:#1E6BFF;color:#fff;font-weight:700;text-decoration:none;padding:13px 22px;border-radius:10px">Öffnen</a>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#05070D;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
      <table width="100%" style="max-width:520px" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:20px"><span style="font-size:26px;font-weight:800;color:#EAF0F9">car<span style="color:#4D8DFF">fixo</span></span></td></tr>
        <tr><td style="background:#0C111D;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:26px">
          <h1 style="margin:0;font-size:19px;color:#EAF0F9">${esc(title)}</h1>
          <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#8B98AC">${esc(body)}</p>
          ${btn}
        </td></tr>
        <tr><td style="padding-top:18px;font-size:11px;color:#5B6778">
          Du erhältst diese E-Mail, weil du bei Carfixo registriert bist.
          Einstellungen: <a href="${esc(APP_URL)}/app.html#/settings" style="color:#4D8DFF">Benachrichtigungen verwalten</a>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    // Optionaler Schutz: geteiltes Secret aus dem Webhook-Header prüfen
    if (WEBHOOK_SECRET && req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (!RESEND_API_KEY) {
      return new Response("RESEND_API_KEY not configured", { status: 200 });
    }

    const payload = await req.json();
    const n = payload?.record ?? payload; // Supabase-Webhook liefert { record }
    if (!n?.user_id || !n?.title) return new Response("Ignored", { status: 200 });

    // E-Mail-Adresse des Nutzers ermitteln (Service-Role)
    const { data: userRes, error } = await admin.auth.admin.getUserById(n.user_id);
    if (error || !userRes?.user?.email) return new Response("No email", { status: 200 });
    const to = userRes.user.email;

    const link = n.link ? (String(n.link).startsWith("http") ? n.link : APP_URL + "/app.html#" + String(n.link).replace(/^#/, "")) : undefined;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to,
        subject: n.title,
        html: emailHtml(n.title, n.body ?? "", link),
        text: `${n.title}\n\n${n.body ?? ""}${link ? "\n\n" + link : ""}`,
      }),
    });
    if (!res.ok) return new Response(`Resend error: ${await res.text()}`, { status: 502 });

    return new Response("Sent", { status: 200 });
  } catch (e) {
    return new Response("Error: " + (e as Error).message, { status: 500 });
  }
});
