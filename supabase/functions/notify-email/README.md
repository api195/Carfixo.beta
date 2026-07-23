# notify-email – E-Mail bei neuen Benachrichtigungen

Schickt jede neue Zeile aus `public.notifications` als E-Mail an den betroffenen
Nutzer. Läuft erst, sobald ein E-Mail-Provider (Resend) hinterlegt ist.

## Einrichtung (einmalig)

1. **Resend-Konto** anlegen und die Domain `carfixo.de` verifizieren
   (SPF/DKIM-Einträge im DNS setzen). API-Key kopieren.

2. **Secrets setzen** (Supabase Dashboard → Edge Functions → Secrets,
   oder CLI):
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxx
   supabase secrets set EMAIL_FROM="Carfixo <no-reply@carfixo.de>"
   supabase secrets set APP_URL=https://carfixo.de
   supabase secrets set WEBHOOK_SECRET=<zufälliger-string>
   ```
   `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` sind in Edge Functions
   automatisch vorhanden.

3. **Function deployen:**
   ```bash
   supabase functions deploy notify-email
   ```

4. **Database Webhook** anlegen (Dashboard → Database → Webhooks):
   - Tabelle: `public.notifications`
   - Event: `INSERT`
   - Typ: HTTP Request → URL der Function
   - Header: `x-webhook-secret: <derselbe WEBHOOK_SECRET>`

## Test
```bash
# Test-Notification einfügen → es sollte eine E-Mail rausgehen
insert into public.notifications (user_id, type, title, body, link)
values ('<eine-user-uuid>', 'test', 'Testbenachrichtigung', 'Funktioniert 🎉', '/inbox');
```

## Noch offen / optional
- **Opt-out je Nutzer:** vor dem Versand eine Einstellung prüfen
  (z. B. Spalte `profiles.email_notifications`) und ggf. überspringen.
- **Digest statt Einzelmails** bei hohem Aufkommen.
- **Bounce-/Complaint-Handling** über Resend-Webhooks.
