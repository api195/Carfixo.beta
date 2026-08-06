# notify-dispatch – Push- und E-Mail-Versand

Verschickt jede neue Zeile aus `public.notifications` als **Web-Push** und –
sobald ein Resend-Key hinterlegt ist – zusätzlich als **E-Mail**.

## Wie es zusammenhängt

```
INSERT in public.notifications
  └─ Trigger dispatch_notification
      └─ pg_net ruft diese Function auf (Header x-notify-secret)
          ├─ Web-Push an alle Geräte aus push_subscriptions   (VAPID)
          └─ E-Mail über Resend                               (nur mit resend_api_key)
```

Die Function respektiert die Einstellungen des Nutzers aus
`profiles.notify_prefs` (`push`, `email`) und entfernt abgelaufene
Push-Abos automatisch (HTTP 404/410).

## Konfiguration

Die Werte liegen **nicht** in Edge-Function-Secrets, sondern in der Tabelle
`private.app_secrets` und werden über die RPC `get_notify_secrets` gelesen.

| Schlüssel | Zweck | Status |
|---|---|---|
| `notify_webhook_secret` | Authentifiziert den Trigger-Aufruf | ✅ gesetzt |
| `functions_url` | Ziel-URL für pg_net | ✅ gesetzt |
| `vapid_public` / `vapid_private` / `vapid_subject` | Web-Push | ✅ gesetzt |
| `app_url` | Basis für Links in der E-Mail | ✅ `https://carfixo.de/app.html` |
| `resend_from` | Absender | ⚠️ noch `onboarding@resend.dev` (Resend-Testabsender) |
| `resend_api_key` | Versand über Resend | ❌ **leer – ohne ihn geht keine E-Mail raus** |

Einen Wert setzen:

```sql
update private.app_secrets set value = 're_dein_key' where key = 'resend_api_key';
update private.app_secrets set value = 'Carfixo <no-reply@carfixo.de>' where key = 'resend_from';
```

> Der Absender darf erst auf `@carfixo.de` geändert werden, **nachdem** die
> Domain in Resend per DNS (SPF/DKIM) verifiziert wurde. Vorher lehnt Resend
> den Versand ab. Mit dem Testabsender `onboarding@resend.dev` kann nur an die
> eigene Konto-Adresse zugestellt werden.

## Deployen

```bash
supabase functions deploy notify-dispatch
```

## Testen

```sql
-- eigene User-ID einsetzen; loest Push und (mit Key) eine E-Mail aus
insert into public.notifications (user_id, type, title, body, link)
values ('<user-uuid>', 'test', 'Testbenachrichtigung', 'Funktioniert', 'requests');
```

Ergebnis prüfen: Dashboard → Edge Functions → `notify-dispatch` → Logs.
Die Antwort enthält `{ ok, pushed, removed, emailed }`.

## Offen

- Bounce- und Beschwerde-Behandlung über Resend-Webhooks
- Zusammenfassung statt Einzelmails bei hohem Aufkommen
