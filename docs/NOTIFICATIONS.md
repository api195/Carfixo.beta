# Carfixo – Benachrichtigungen

Drei Ebenen, alle auf demselben Fundament (`public.notifications`):

1. **In-App-Zentrale** (Glocke oben rechts) – immer aktiv, live per Supabase Realtime.
2. **Browser-Push** (Web Push / VAPID) – erreicht Nutzer auch bei geschlossener Seite.
3. **E-Mail** (Resend) – optional, respektiert die Nutzer-Einstellung.

## Ablauf

```
Ereignis (Angebot, Nachricht, Buchung, …)
   └─ DB-Trigger  → notify_user() / notify_workshop()
        └─ INSERT public.notifications  (RLS: nur Empfänger sieht sie)
             ├─ Realtime  → Glocke + Badge + Toast im Browser
             └─ AFTER-INSERT-Trigger  → pg_net POST → Edge Function `notify-dispatch`
                   ├─ Web-Push an alle push_subscriptions des Nutzers   (wenn notify_prefs.push ≠ false)
                   └─ E-Mail via Resend                                 (wenn notify_prefs.email ≠ false und Key gesetzt)
```

## Ausgelöste Ereignisse

| Tabelle | Auslöser | Empfänger |
|---|---|---|
| `offers` (INSERT) | Neues Angebot | Kunde |
| `messages` (INSERT, kind=user) | Neue Chat-Nachricht | Gegenseite (Kunde ↔ Werkstatt) |
| `requests` (INSERT) | Direktanfrage / offene Ausschreibung | Ziel-Werkstatt bzw. alle passenden verifizierten Betriebe |
| `bookings` (INSERT/UPDATE) | Neue Buchung, Statuswechsel, Storno, Terminvorschlag | Werkstatt bzw. Kunde |
| `approvals` (INSERT/UPDATE) | Zusatzfreigabe angefragt / entschieden | Kunde bzw. Werkstatt |
| `reviews` (INSERT) | Neue Bewertung | Werkstatt |
| `part_orders` (INSERT/UPDATE) | Teile-Bestellung / Statuswechsel | Werkstatt bzw. Käufer |

Werkstatt-Empfänger = Inhaber **und** aktive Teammitglieder (`workshop_members`).

## Konfiguration (Secrets)

Liegen in `private.app_secrets` (nicht über die API erreichbar, RLS ohne Policy → nur `service_role`).
Die Edge Function liest sie über die auf `service_role` beschränkte RPC `public.get_notify_secrets()`.

| Key | Zweck |
|---|---|
| `vapid_public` / `vapid_private` | VAPID-Schlüsselpaar für Web-Push (public zusätzlich in `assets/config.js`) |
| `vapid_subject` | `mailto:`-Kontakt für Push-Dienste |
| `functions_url` | URL der Edge Function (Dispatch-Ziel) |
| `notify_webhook_secret` | Shared Secret, das der Trigger im Header `x-notify-secret` mitschickt |
| `resend_api_key` | Resend-API-Key (leer = kein E-Mail-Versand) |
| `resend_from` | Absender, z. B. `Carfixo <benachrichtigung@deine-domain.de>` |
| `app_url` | Basis-URL der App für E-Mail-Links, z. B. `https://…/app.html` |

## E-Mail aktivieren (Stufe 3)

1. Bei [resend.com](https://resend.com) registrieren, **Domain verifizieren** und einen API-Key erstellen.
   (Ohne eigene Domain funktioniert nur `onboarding@resend.dev` – und nur an die eigene Konto-Adresse.)
2. Secrets setzen:

```sql
update private.app_secrets set value = 're_XXXXXXXX'                       where key = 'resend_api_key';
update private.app_secrets set value = 'Carfixo <benachrichtigung@deine-domain.de>' where key = 'resend_from';
update private.app_secrets set value = 'https://deine-domain.de/app.html'   where key = 'app_url';
```

Danach werden E-Mails automatisch versendet (sofern der Nutzer E-Mail-Benachrichtigungen aktiv hat).

## Test

```sql
-- Löst die komplette Kette aus (Realtime + Dispatch):
select public.notify_user(
  (select id from public.profiles where email = 'kunde@carfixo-test.de'),
  'system', 'Testbenachrichtigung', 'Hallo aus Supabase', null, '{}'::jsonb);

-- Antwort der Edge Function prüfen:
select status_code, content from net._http_response order by id desc limit 1;
```

## Browser-Hinweise

- **Android/Chrome/Firefox/Edge (Desktop):** Push funktioniert direkt nach Zustimmung.
- **iOS/Safari:** Web-Push nur, wenn die Seite als **PWA zum Home-Bildschirm** hinzugefügt wurde (iOS 16.4+).
- Berechtigung wird nur nach einer Nutzeraktion abgefragt (Häkchen „Push“ im Konto).
