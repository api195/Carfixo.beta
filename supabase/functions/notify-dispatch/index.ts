// ============================================================
// Carfixo – notify-dispatch
// Wird vom DB-Trigger nach jedem notifications-INSERT via pg_net aufgerufen.
// Versendet Web-Push (VAPID) und optional E-Mail (Resend), je nach notify_prefs.
// Auth: Shared Secret im Header 'x-notify-secret' (verify_jwt = false).
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ error: "method" }, 405);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Secrets laden (nur service_role darf diese RPC)
    const { data: secrets } = await admin.rpc("get_notify_secrets");
    const S: Record<string, string> = secrets || {};

    // Shared-Secret prüfen
    const provided = req.headers.get("x-notify-secret") || "";
    if (!S.notify_webhook_secret || provided !== S.notify_webhook_secret) {
      return json({ error: "unauthorized" }, 401);
    }

    const { notification_id } = await req.json().catch(() => ({}));
    if (!notification_id) return json({ error: "missing notification_id" }, 400);

    const { data: n } = await admin.from("notifications").select("*").eq("id", notification_id).single();
    if (!n) return json({ error: "not found" }, 404);

    const { data: prof } = await admin.from("profiles")
      .select("notify_prefs, email, full_name").eq("id", n.user_id).maybeSingle();
    const prefs = (prof?.notify_prefs as Record<string, unknown>) || {};

    let pushed = 0, removed = 0;
    let emailed = false;

    // ---------- Web Push ----------
    if (prefs.push !== false && S.vapid_public && S.vapid_private) {
      webpush.setVapidDetails(S.vapid_subject || "mailto:info@carfixo.de", S.vapid_public, S.vapid_private);
      const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", n.user_id);
      // Nur der Hash-Pfad – der Service Worker baut die volle URL aus seinem Scope.
      const payload = JSON.stringify({
        title: n.title, body: n.body || "", path: n.link || "", type: n.type,
      });
      for (const s of subs || []) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
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

    // ---------- E-Mail (Resend) ----------
    if (prefs.email !== false && S.resend_api_key && prof?.email) {
      const link = S.app_url && n.link ? `${S.app_url}#/${n.link}` : (S.app_url || "");
      const html = emailHtml(n.title, n.body || "", link);
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${S.resend_api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: S.resend_from || "Carfixo <onboarding@resend.dev>",
          to: [prof.email],
          subject: `Carfixo: ${n.title}`,
          html,
        }),
      });
      emailed = r.ok;
    }

    return json({ ok: true, pushed, removed, emailed });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}

function emailHtml(title: string, body: string, link: string) {
  const btn = link
    ? `<a href="${link}" style="display:inline-block;margin-top:18px;background:#1E6BFF;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700">In Carfixo öffnen</a>`
    : "";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f1830">
    <div style="font-size:22px;font-weight:800;color:#1E6BFF">car<span style="color:#0f1830">fixo</span></div>
    <h1 style="font-size:18px;margin:20px 0 6px">${escapeHtml(title)}</h1>
    <p style="font-size:14px;color:#48566e;line-height:1.5;margin:0">${escapeHtml(body)}</p>
    ${btn}
    <p style="font-size:11px;color:#9aa7bd;margin-top:28px">Du erhältst diese E-Mail, weil E-Mail-Benachrichtigungen in deinem Carfixo-Konto aktiv sind. Einstellungen änderst du unter „Konto“.</p>
  </div>`;
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m] as string));
}
