-- ============================================================
-- Carfixo – Online-Zahlung über Stripe Connect
--
-- Modell: "Direct Charges" auf Standard-Konten der Betriebe.
--   * Jeder Betrieb hat ein eigenes Stripe-Konto und ist selbst
--     Zahlungsempfänger. Stripe-Gebühren, Erstattungen und Rückbuchungen
--     laufen über SEIN Konto – Carfixo trägt dafür kein Risiko und
--     bekommt (derzeit) kein Geld.
--   * Bezahlt wird nach der Reparatur ("Abholbereit"/"Abgeschlossen"),
--     Betrag = Buchungspreis + freigegebene Zusatzarbeiten.
--   * Geschrieben werden Zahlungsdaten NUR von den Edge Functions
--     (service_role). Die App kann sie lesen, aber nicht ändern.
--
-- Reihenfolge: nach 2026-10-19_kuendigung_2fa_csp.sql einspielen.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Stripe-Konto je Betrieb (privat: nur Inhaber und Admins)
-- ------------------------------------------------------------
create table if not exists public.workshop_payment_accounts (
  workshop_id       uuid primary key references public.workshops(id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled   boolean not null default false,
  payouts_enabled   boolean not null default false,
  details_submitted boolean not null default false,
  livemode          boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.workshop_payment_accounts enable row level security;

drop policy if exists wpa_owner_select on public.workshop_payment_accounts;
create policy wpa_owner_select on public.workshop_payment_accounts
  for select using (public.owns_workshop(workshop_id) or public.is_admin());
-- Kein insert/update/delete für Clients: das machen nur die Edge Functions.

-- Öffentlich sichtbar ist nur, OB ein Betrieb Online-Zahlung annimmt.
alter table public.workshops add column if not exists online_payment boolean not null default false;

-- ------------------------------------------------------------
-- 2) Zahlungsfelder an der Buchung
-- ------------------------------------------------------------
alter table public.bookings add column if not exists paid_amount        numeric(10,2);
alter table public.bookings add column if not exists refunded_amount    numeric(10,2) not null default 0;
alter table public.bookings add column if not exists paid_at            timestamptz;
alter table public.bookings add column if not exists stripe_session_id  text;
alter table public.bookings add column if not exists stripe_payment_intent text;

create index if not exists bookings_stripe_session_idx on public.bookings (stripe_session_id);
create index if not exists bookings_stripe_pi_idx on public.bookings (stripe_payment_intent);

-- ------------------------------------------------------------
-- 3) Schutzregeln
-- ------------------------------------------------------------
-- Betrieb darf "online_payment" nicht selbst einschalten.
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
    new.is_verified    := false;
    new.rating_avg     := 0;
    new.rating_count   := 0;
    new.is_demo        := false;
    new.online_payment := false;
  else
    -- Stillschweigend beibehalten statt Fehler: Das Profil-Formular darf
    -- die ganze Zeile zurückschicken, ohne dass das Speichern scheitert.
    new.is_verified    := old.is_verified;
    new.rating_avg     := old.rating_avg;
    new.rating_count   := old.rating_count;
    new.is_demo        := old.is_demo;
    new.owner_id       := old.owner_id;
    new.online_payment := old.online_payment;
  end if;
  return new;
end;
$$;

-- Buchung: Zahlungsfelder friert die App nicht auf. Neu gegenüber
-- 2026-10-18: Eine bezahlte oder erstattete Buchung kann der Client nicht
-- mehr auf "storniert"/"Testzahlung" zurücksetzen – vorher hätte das
-- Stornieren einer bezahlten Buchung den Zahlungsstatus überschrieben.
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

  -- Zahlungsdaten schreibt nur der Stripe-Webhook (service_role).
  new.paid_amount           := old.paid_amount;
  new.refunded_amount       := old.refunded_amount;
  new.paid_at               := old.paid_at;
  new.stripe_session_id     := old.stripe_session_id;
  new.stripe_payment_intent := old.stripe_payment_intent;

  -- Vom Client aus nur: Testzahlung (Beta) und Stornierung – und nur,
  -- solange über Stripe noch nichts gelaufen ist.
  if new.payment_status is distinct from old.payment_status
     and (new.payment_status not in ('test_payment_confirmed', 'payment_cancelled')
          or coalesce(old.payment_status, 'none') in
             ('payment_pending', 'payment_paid', 'payment_refunded', 'payment_failed')) then
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

-- ------------------------------------------------------------
-- 4) Zu zahlender Betrag – eine Quelle für App und Edge Function
-- ------------------------------------------------------------
-- Läuft mit den Rechten des Aufrufers (kein SECURITY DEFINER): Wer die
-- Buchung per RLS nicht sehen darf, bekommt NULL. In einer DEFINER-Funktion
-- wäre current_user immer der Besitzer und jede Prüfung darauf wirkungslos.
create or replace function public.booking_amount_due(p_booking uuid)
returns numeric
language sql
stable
set search_path = public
as $$
  select b.total_price + coalesce((select sum(a.extra_cost) from public.approvals a
                                   where a.booking_id = b.id and a.status = 'approved'), 0)
  from public.bookings b
  where b.id = p_booking;
$$;
revoke all on function public.booking_amount_due(uuid) from public;
grant execute on function public.booking_amount_due(uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- 5) Benachrichtigungen zu Zahlungen
-- ------------------------------------------------------------
create or replace function public.trg_notify_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_req uuid;
begin
  if new.payment_status is not distinct from old.payment_status then
    return new;
  end if;
  v_req := (select o.request_id from public.offers o where o.id = new.offer_id);

  if new.payment_status = 'payment_paid' then
    perform public.notify_workshop(new.workshop_id, 'payment', 'Zahlung eingegangen',
      'Auftrag ' || coalesce(new.booking_no, '') || ' · ' || public.eur(coalesce(new.paid_amount, new.total_price)),
      'ws/jobs', jsonb_build_object('booking_id', new.id));
    perform public.notify_user(new.customer_id, 'payment', 'Zahlung erfolgreich',
      'Auftrag ' || coalesce(new.booking_no, '') || ' ist bezahlt.',
      'request/' || v_req, jsonb_build_object('booking_id', new.id));
  elsif new.payment_status = 'payment_refunded' then
    perform public.notify_user(new.customer_id, 'payment', 'Zahlung erstattet',
      'Für Auftrag ' || coalesce(new.booking_no, '') || ' wurde der Betrag erstattet.',
      'request/' || v_req, jsonb_build_object('booking_id', new.id));
  elsif new.payment_status = 'payment_failed' then
    perform public.notify_user(new.customer_id, 'payment', 'Zahlung fehlgeschlagen',
      'Die Zahlung für Auftrag ' || coalesce(new.booking_no, '') || ' ist fehlgeschlagen. Du kannst es erneut versuchen.',
      'request/' || v_req, jsonb_build_object('booking_id', new.id));
  end if;
  return new;
end;
$$;
revoke execute on function public.trg_notify_payment() from public, anon, authenticated;

create or replace trigger notify_payment_upd
  after update of payment_status on public.bookings
  for each row execute function public.trg_notify_payment();
