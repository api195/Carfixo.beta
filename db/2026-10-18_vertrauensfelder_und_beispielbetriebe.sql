-- ============================================================
-- Carfixo – Vertrauensfelder schützen, Beispielbetriebe kennzeichnen
--
-- STAND: VORBEREITET, NOCH NICHT ANGEWENDET (2026-10-18).
-- Einspielen: Supabase → SQL Editor → diese Datei komplett ausführen.
-- Sie ist wiederholbar (if not exists / create or replace / drop if exists).
-- Bis dahin sind die unten beschriebenen Lücken offen. Vor dem Launch Pflicht.
--
-- Teil 2 (Buchungen, Teilebestellungen, Anfragen) greift in laufende
-- Abläufe ein. Vor dem Einspielen jeden App-Ablauf (stornieren, Termin
-- vorschlagen/annehmen, abschließen, Testzahlung, Status setzen) einmal
-- in einer zurückgerollten Transaktion gegenprüfen.
--
-- 1. SICHERHEITSLÜCKE: workshops_owner_update / workshops_owner_insert
--    erlauben Inhabern, ihre eigene Zeile beliebig zu schreiben – auch
--    is_verified, rating_avg und rating_count. Nachgewiesen (Test mit
--    Rollback):
--      A) Ein Betrieb setzt sich selbst is_verified = true und
--         rating_avg = 5.0 / rating_count = 999.
--      B) Ein beliebiges Kundenkonto legt einen Betrieb an, der sofort
--         verifiziert und mit 500 Fake-Bewertungen in der Suche steht.
--    Damit waren Admin-Prüfung und Bewertungs-Aggregat wirkungslos.
--
--    Lösung: Ein Trigger hält diese Felder für direkte App-Zugriffe
--    (Rollen anon/authenticated) fest, außer für Admins. Interne
--    SECURITY-DEFINER-Funktionen wie refresh_workshop_rating laufen als
--    postgres und schreiben weiterhin – daran hängt die Unterscheidung
--    über current_user. Ebenso service_role (Edge Functions).
--
--    is_premium bleibt bewusst selbst schaltbar: In der Beta ist Premium
--    kostenlos aktivierbar. Sobald Premium Geld kostet (Stripe), muss es
--    in diese Liste.
--
-- 2. BEISPIELBETRIEBE: Die 6 Demo-Betriebe und die Test-Werkstatt bleiben
--    zum Vorzeigen sichtbar, bekommen aber is_demo = true. Die App zeigt
--    "Beispielbetrieb" und bietet keine Anfrage/Bestellung an; die
--    Datenbank lehnt Direktanfragen und Teilebestellungen an sie zusätzlich
--    ab, falls jemand die App umgeht. Ihre Inhaber-Konten sind seit
--    2026-10-18 gesperrt (verbranntes Passwort aus der Git-Historie).
--
--    Vor dem echten Launch: Beispielbetriebe ausblenden mit
--      update public.workshops set is_verified = false where is_demo;
-- ============================================================

-- 1) Kennzeichnung
alter table public.workshops
  add column if not exists is_demo boolean not null default false;

update public.workshops w
   set is_demo = true
  from auth.users u
 where u.id = w.owner_id
   and split_part(u.email, '@', 2) in ('carfixo-test.de', 'carfixo-demo.de');

-- 2) Vertrauensfelder schützen
create or replace function public.guard_workshop_trust_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Nur direkte Zugriffe aus der App prüfen. SECURITY-DEFINER-Funktionen
  -- (refresh_workshop_rating) und service_role laufen nicht als
  -- anon/authenticated und dürfen schreiben.
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Neue Betriebe starten immer unverifiziert und ohne Bewertungen.
    new.is_verified  := false;
    new.rating_avg   := 0;
    new.rating_count := 0;
    new.is_demo      := false;
  else
    -- Stillschweigend beibehalten statt Fehler: Das Profil-Formular darf
    -- die ganze Zeile zurückschicken, ohne dass das Speichern scheitert.
    new.is_verified  := old.is_verified;
    new.rating_avg   := old.rating_avg;
    new.rating_count := old.rating_count;
    new.is_demo      := old.is_demo;
    new.owner_id     := old.owner_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_workshop_trust on public.workshops;
create trigger trg_guard_workshop_trust
  before insert or update on public.workshops
  for each row execute function public.guard_workshop_trust_fields();

-- 3) Keine Direktanfragen und keine Teilebestellungen an Beispielbetriebe
create or replace function public.reject_demo_workshop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workshop_id is not null
     and exists (select 1 from public.workshops where id = new.workshop_id and is_demo) then
    raise exception 'Das ist ein Beispielbetrieb – hier sind keine Anfragen oder Bestellungen möglich.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_requests_no_demo on public.requests;
create trigger trg_requests_no_demo
  before insert on public.requests
  for each row execute function public.reject_demo_workshop();

drop trigger if exists trg_part_orders_no_demo on public.part_orders;
create trigger trg_part_orders_no_demo
  before insert on public.part_orders
  for each row execute function public.reject_demo_workshop();


-- ============================================================
-- TEIL 2 – dieselbe Lückenklasse auf weiteren Tabellen
--
-- Die Update-Policies von profiles, bookings, part_orders und requests
-- prüfen nur, WEM die Zeile gehört – nicht, WELCHE Spalten geändert
-- werden. Nachgewiesen (Test mit Rollback):
--   C) Ein gesperrter Nutzer hebt seine Sperre selbst auf
--      (profiles.is_blocked) – die Admin-Sperre wirkt nicht.
--   D) Ein Kunde setzt seine Buchung auf payment_status = 'paid' und den
--      Preis auf 1 €.
-- Dazu ein Designproblem: "Auftrag abschließen" steht dem Kunden ab
-- Buchungsbestätigung offen – also vor dem Termin, ohne dass gearbeitet
-- wurde. Danach darf er bewerten. Das Versprechen "Bewertungen nur nach
-- abgeschlossenem Auftrag" ist damit nicht belastbar (§ 5b Abs. 3 UWG).
-- Neue Regel: Abschließen erst, wenn der Betrieb "abholbereit" gemeldet
-- hat ODER der Termin vorbei ist. Die App zeigt den Knopf nur dann.
--
-- Erlaubt bleiben alle Schreibzugriffe, die die App heute macht
-- (geprüft gegen jeden .update()-Aufruf in assets/app.js):
--   Kunde:   stornieren, Termin vorschlagen, Werkstatt-Termin annehmen,
--            abschließen, Testzahlung bestätigen, Teilebestellung stornieren
--   Betrieb: Status setzen, Termin setzen, No-Show, stornieren, Belege
-- Preis, Mehrwertsteuer, Zuordnung und Buchungsnummer legt nur
-- accept_offer() fest – das läuft als postgres und ist nicht betroffen.
-- ============================================================

-- 4) Profile: Sperre und E-Mail nur durch Admins
create or replace function public.guard_profile_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;
  new.is_blocked := old.is_blocked;
  new.email      := old.email;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_fields on public.profiles;
create trigger trg_guard_profile_fields
  before update on public.profiles
  for each row execute function public.guard_profile_fields();

-- 5) Buchungen
create or replace function public.guard_booking_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  ist_kunde boolean;
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  -- Geld und Zuordnung: nur accept_offer() (postgres) und Admins
  new.offer_id    := old.offer_id;
  new.customer_id := old.customer_id;
  new.workshop_id := old.workshop_id;
  new.total_price := old.total_price;
  new.vat_amount  := old.vat_amount;
  new.booking_no  := old.booking_no;

  -- Bezahlt wird künftig nur über den Stripe-Webhook (service_role).
  -- Vom Client aus nur: Testzahlung (Beta) und Stornierung.
  if new.payment_status is distinct from old.payment_status
     and new.payment_status not in ('test_payment_confirmed', 'payment_cancelled') then
    new.payment_status := old.payment_status;
  end if;

  ist_kunde := old.customer_id = auth.uid() and not public.owns_workshop(old.workshop_id);
  if not ist_kunde then
    return new;   -- Betrieb: Status, Termin, No-Show, Belege bleiben frei
  end if;

  -- Was nur der Betrieb festhält
  new.no_show       := old.no_show;
  new.documents     := old.documents;
  new.warranty_note := old.warranty_note;

  -- Einen "Vorschlag des Betriebs" kann der Kunde sich nicht selbst
  -- eintragen – sonst nähme er ihn im zweiten Schritt an und hätte den
  -- Termin frei verschoben.
  if new.reschedule_by = 'workshop' and old.reschedule_by is distinct from 'workshop' then
    new.reschedule_by := old.reschedule_by;
    new.proposed_date := old.proposed_date;
  end if;

  if new.status is distinct from old.status then
    if old.status in ('completed', 'cancelled') then
      raise exception 'Diese Buchung ist bereits abgeschlossen oder storniert.';
    elsif new.status = 'completed' then
      if not (old.status = 'ready_for_pickup'
              or (old.scheduled_at is not null and old.scheduled_at < now())) then
        raise exception 'Abschließen ist möglich, sobald der Betrieb fertig gemeldet hat oder der Termin vorbei ist.';
      end if;
    elsif new.status = 'ready' then
      -- Nur beim Annehmen eines Terminvorschlags des Betriebs
      if not (old.proposed_date is not null and old.reschedule_by = 'workshop') then
        new.status := old.status;
      end if;
    elsif new.status <> 'cancelled' then
      new.status := old.status;  -- Arbeitsschritte meldet nur der Betrieb
    end if;
  end if;

  -- Termin ändert der Kunde nur durch Annehmen eines Vorschlags
  if new.scheduled_at is distinct from old.scheduled_at
     and not (old.reschedule_by = 'workshop' and new.scheduled_at = old.proposed_date) then
    new.scheduled_at := old.scheduled_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_booking_fields on public.bookings;
create trigger trg_guard_booking_fields
  before update on public.bookings
  for each row execute function public.guard_booking_fields();

-- 6) Teilebestellungen: Käufer darf nur stornieren
create or replace function public.guard_part_order_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;
  new.part_id     := old.part_id;
  new.buyer_id    := old.buyer_id;
  new.workshop_id := old.workshop_id;
  new.price       := old.price;
  new.part_title  := old.part_title;

  if old.buyer_id = auth.uid() and not public.owns_workshop(old.workshop_id)
     and new.status is distinct from old.status and new.status <> 'cancelled' then
    new.status := old.status;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_part_order_fields on public.part_orders;
create trigger trg_guard_part_order_fields
  before update on public.part_orders
  for each row execute function public.guard_part_order_fields();

-- 7) Anfragen: Art und Ziel-Betrieb stehen nach dem Anlegen fest.
--    Sonst ließe sich eine offene Anfrage nachträglich auf einen
--    Beispielbetrieb umbiegen (die Sperre in 3) greift nur beim Anlegen).
create or replace function public.guard_request_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;
  new.customer_id := old.customer_id;
  new.type        := old.type;
  new.workshop_id := old.workshop_id;
  return new;
end;
$$;

drop trigger if exists trg_guard_request_fields on public.requests;
create trigger trg_guard_request_fields
  before update on public.requests
  for each row execute function public.guard_request_fields();


-- ============================================================
-- TEIL 3 – Testdaten
-- ============================================================

-- 8) Offene Anfragen der gesperrten Testkonten schließen. Stand 2026-10-18:
--    eine offene Ausschreibung und zwei offene Direktanfragen. Die
--    Ausschreibung sähe sonst jeder echte Betrieb der Kategorie nach seiner
--    Verifizierung als Kundenanfrage – und schriebe ein Angebot an ein
--    gesperrtes Konto. Nichts wird gelöscht.
update public.requests r
   set status = 'cancelled'
  from auth.users u
 where u.id = r.customer_id
   and split_part(u.email, '@', 2) in ('carfixo-test.de', 'carfixo-demo.de')
   and r.status in ('open', 'offers_received');
