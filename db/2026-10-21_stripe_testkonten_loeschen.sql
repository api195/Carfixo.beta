-- ============================================================
-- Testkonten aus dem Stripe-Test vom 21.10.2026 endgültig löschen
--   stripe-test-werkstatt@carfixo.de  (Testwerkstatt – bitte ignorieren)
--   stripe-test-kunde@carfixo.de
--
-- Beide sind bereits gesperrt und die Werkstatt ist öffentlich nicht mehr
-- sichtbar. Dieses Skript entfernt sie samt Anfrage, Angebot, Buchung,
-- Chat, Benachrichtigungen und Stripe-Verknüpfung.
--
-- Buchungen müssen zuerst weg (sie blockieren das Löschen von Betrieb und
-- Angebot), alles andere hängt per "on delete cascade" an den Konten.
-- Das verbundene Testkonto in der Stripe-Sandbox stört nicht und kann bleiben.
-- ============================================================
begin;

delete from public.bookings
 where customer_id in (select id from auth.users where email like 'stripe-test-%@carfixo.de')
    or workshop_id in (select w.id from public.workshops w
                         join auth.users u on u.id = w.owner_id
                        where u.email like 'stripe-test-%@carfixo.de');

delete from auth.users where email like 'stripe-test-%@carfixo.de';

commit;

-- Muss 0 ergeben:
select count(*) as uebrig from auth.users where email like 'stripe-test-%@carfixo.de';
