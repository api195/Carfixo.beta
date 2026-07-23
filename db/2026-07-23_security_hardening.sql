-- ============================================================
-- Carfixo – Security-Härtung (Vorschlag, VOR Launch anwenden)
-- Grundlage: Supabase Security-Advisor (Stand 2026-07-23)
--
-- WICHTIG: Erst auf einem Branch/Staging testen, dann auf Prod.
-- Alle Anweisungen hier sind bewusst konservativ (nur REVOKE +
-- search_path), also gut reversibel und ohne Logikänderung.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Interne Trigger-Funktionen: dürfen NICHT per REST-RPC von
--    anon/authenticated aufrufbar sein (sonst kann jeder z.B.
--    Benachrichtigungen faken/spammen). Sie laufen nur aus
--    Triggern heraus – EXECUTE entziehen ist daher gefahrlos.
-- ------------------------------------------------------------
revoke execute on function public.trg_notify_approval()    from anon, authenticated;
revoke execute on function public.trg_notify_booking()     from anon, authenticated;
revoke execute on function public.trg_notify_message()     from anon, authenticated;
revoke execute on function public.trg_notify_offer()       from anon, authenticated;
revoke execute on function public.trg_notify_part_order()  from anon, authenticated;
revoke execute on function public.trg_notify_request()     from anon, authenticated;
revoke execute on function public.trg_notify_review()      from anon, authenticated;

-- ------------------------------------------------------------
-- 2) Interne Helfer für den Versand/Scheduler: nur systemintern
--    genutzt – ebenfalls kein direkter RPC-Zugriff nötig.
-- ------------------------------------------------------------
revoke execute on function public.notify_user(uuid, text, text, text, text, jsonb)              from anon, authenticated;
revoke execute on function public.notify_workshop(uuid, text, text, text, text, jsonb, uuid)    from anon, authenticated;
revoke execute on function public.workshop_recipients(uuid)                                     from anon, authenticated;
revoke execute on function public.run_due_reminders()                                           from anon, authenticated;

-- ------------------------------------------------------------
-- 3) Anzeigenamen nicht anonym enumerierbar machen
--    (_display_name bleibt für eingeloggte Nutzer verfügbar –
--     wird in Chat/Bewertungen gebraucht – nur anon entzogen).
-- ------------------------------------------------------------
revoke execute on function public._display_name(uuid) from anon;

-- ------------------------------------------------------------
-- 4) search_path fixieren (Advisor 0011). Verhindert, dass die
--    Funktionen über einen manipulierten search_path andere
--    Objekte auflösen.
-- ------------------------------------------------------------
alter function public.parts_touch_updated_at() set search_path = public, pg_temp;
alter function public.eur                        set search_path = public, pg_temp;
alter function public.status_label_de            set search_path = public, pg_temp;

-- ------------------------------------------------------------
-- 5) Erweiterung pg_net aus dem public-Schema holen (Advisor 0014).
--    OPTIONAL / mit Bedacht: Wenn Funktionen pg_net.* unqualifiziert
--    aufrufen, danach ggf. anpassen. Auf Staging prüfen!
-- ------------------------------------------------------------
-- create schema if not exists extensions;
-- alter extension pg_net set schema extensions;

-- ============================================================
-- NICHT per SQL, sondern im Supabase-Dashboard erledigen:
--   Auth → Providers → Password:
--   „Leaked password protection" (HaveIBeenPwned) aktivieren.
--
-- BEWUSST NICHT ANGEFASST (absichtlich öffentlich/authentifiziert
-- aufrufbar – das sind gewollte RPCs bzw. RLS-Helfer):
--   accept_offer, delete_own_account, mark_all_notifications_read,
--   claim_membership, is_admin, is_verified_workshop, owns_workshop,
--   can_access_request, is_blocked_user,
--   workshop_has_active_offer_for_request
-- ============================================================
