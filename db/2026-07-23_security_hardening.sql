-- ============================================================
-- Carfixo – Security-Härtung
-- Grundlage: Supabase Security-Advisor (Advisor 0011 / 0028 / 0029)
--
-- STATUS: auf Produktion angewendet (Migrationen
--   security_hardening_revoke_internal_functions
--   security_hardening_revoke_public_execute)
-- Verifiziert: anon/authenticated haben auf die internen Funktionen
-- kein EXECUTE mehr; service_role und postgres behalten es.
--
-- WICHTIG – zwei Fallstricke, die diese Datei ursprünglich enthielt:
--
--  1) EXECUTE hängt an der Pseudo-Rolle PUBLIC (ACL-Eintrag "=X/postgres").
--     "revoke ... from anon, authenticated" allein bleibt daher WIRKUNGSLOS –
--     anon erbt das Recht weiter über PUBLIC. Nötig ist "from public".
--     Prüfen mit:  select has_function_privilege('anon', 'public.notify_user(...)', 'EXECUTE');
--
--  2) "alter function public.eur set search_path ..." ohne Argumentliste ist
--     ungültige Syntax – die Signatur muss mit angegeben werden.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Interne Trigger-Funktionen: dürfen NICHT per REST-RPC von
--    anon/authenticated aufrufbar sein (sonst kann jeder z.B.
--    Benachrichtigungen faken/spammen). Sie laufen nur aus
--    Triggern heraus – dort prüft Postgres kein EXECUTE-Recht
--    des auslösenden Nutzers, der Entzug ist also gefahrlos.
-- ------------------------------------------------------------
revoke execute on function public.trg_notify_approval()    from public, anon, authenticated;
revoke execute on function public.trg_notify_booking()     from public, anon, authenticated;
revoke execute on function public.trg_notify_message()     from public, anon, authenticated;
revoke execute on function public.trg_notify_offer()       from public, anon, authenticated;
revoke execute on function public.trg_notify_part_order()  from public, anon, authenticated;
revoke execute on function public.trg_notify_request()     from public, anon, authenticated;
revoke execute on function public.trg_notify_review()      from public, anon, authenticated;

-- ------------------------------------------------------------
-- 2) Interne Helfer für Versand/Scheduler: nur systemintern genutzt.
--    run_due_reminders() wird von pg_cron als postgres ausgeführt,
--    der E-Mail-Versand läuft als service_role – beide behalten Zugriff.
-- ------------------------------------------------------------
revoke execute on function public.notify_user(uuid, text, text, text, text, jsonb)           from public, anon, authenticated;
revoke execute on function public.notify_workshop(uuid, text, text, text, text, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.workshop_recipients(uuid)                                  from public, anon, authenticated;
revoke execute on function public.run_due_reminders()                                        from public, anon, authenticated;

-- ------------------------------------------------------------
-- 3) Anzeigenamen nicht anonym enumerierbar machen.
--    PUBLIC (und damit anon) verliert den Zugriff; authenticated
--    behält ihn über sein explizites Grant – wird in Chat und
--    Bewertungen gebraucht.
-- ------------------------------------------------------------
revoke execute on function public._display_name(uuid) from public, anon;

-- mark_all_notifications_read() arbeitet auf auth.uid(); anonym aufgerufen
-- ist es wirkungslos, aber ein unnötig offener RPC-Endpunkt.
revoke execute on function public.mark_all_notifications_read() from public, anon;

-- ------------------------------------------------------------
-- 4) search_path fixieren (Advisor 0011). Verhindert, dass die
--    Funktionen über einen manipulierten search_path andere
--    Objekte auflösen. Signatur ist Pflicht (siehe Kopf).
-- ------------------------------------------------------------
alter function public.parts_touch_updated_at() set search_path = public, pg_temp;
alter function public.eur(numeric)             set search_path = public, pg_temp;
alter function public.status_label_de(text)    set search_path = public, pg_temp;

-- ------------------------------------------------------------
-- 5) Erweiterung pg_net aus dem public-Schema holen (Advisor 0014).
--    OPTIONAL / mit Bedacht: Wenn Funktionen pg_net.* unqualifiziert
--    aufrufen, danach ggf. anpassen. Auf Staging prüfen!
-- ------------------------------------------------------------
-- create schema if not exists extensions;
-- alter extension pg_net set schema extensions;

-- ============================================================
-- NOCH OFFEN – nicht per SQL, sondern im Supabase-Dashboard:
--   Auth → Providers → Password:
--   „Leaked password protection" (HaveIBeenPwned) aktivieren.
--
-- NOCH OFFEN – Testkonten vor dem Launch:
--   Die Zugangsdaten der Konten …@carfixo-test.de standen im README
--   im Klartext (inkl. Admin-Rolle). Konten löschen oder Passwörter
--   rotieren, bevor die Plattform öffentlich geht.
--
-- BEWUSST NICHT ANGEFASST (absichtlich für authenticated aufrufbar –
-- das sind gewollte RPCs bzw. RLS-Helfer; der Advisor meldet sie weiterhin
-- unter 0029, das ist hier erwartet und in Ordnung):
--   accept_offer, delete_own_account, mark_all_notifications_read,
--   claim_membership, is_admin, is_verified_workshop, owns_workshop,
--   can_access_request, is_blocked_user,
--   workshop_has_active_offer_for_request
--
-- Ergebnis der Härtung: Security-Advisor von 43 auf 14 Meldungen;
-- alle verbliebenen sind gewollt (0029) oder offen dokumentiert
-- (pg_net, Leaked-Password-Schutz, Testkonten).
-- ============================================================
