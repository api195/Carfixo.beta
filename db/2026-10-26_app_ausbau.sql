-- ============================================================
-- Carfixo – App-Ausbau (26.10.2026)
--   1. Festpreis-Termine: Betriebe pflegen Festpreise, Kunden buchen
--      einen freien Termin direkt (ohne Ausschreibung)
--   2. Bewertungen: Antwort des Betriebs
--   3. Chat: Fotos an Nachrichten
--   4. Fahrzeuge: HSN/TSN aus dem Fahrzeugschein
-- Rückwärtskompatibel: nur neue Tabellen, Spalten und Funktionen.
-- ============================================================

-- ---------- 0. Testkonten ----------
-- Testkonten (@carfixo-test.de) dürfen Beispielbetriebe anfragen und buchen,
-- damit sich der ganze Ablauf durchspielen lässt. Für alle anderen bleiben
-- Beispielbetriebe gesperrt.
create or replace function public.is_test_account()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from auth.users u
                  where u.id = auth.uid() and u.email like '%@carfixo-test.de');
$$;
grant execute on function public.is_test_account() to authenticated;

create or replace function public.reject_demo_workshop()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if new.workshop_id is not null
     and exists (select 1 from public.workshops where id = new.workshop_id and is_demo)
     and not public.is_test_account() then
    raise exception 'Das ist ein Beispielbetrieb – hier sind keine Anfragen oder Bestellungen möglich.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

-- ---------- 1. Festpreis-Termine ----------
create table if not exists public.fixed_price_services (
  id           uuid primary key default gen_random_uuid(),
  workshop_id  uuid not null references public.workshops(id) on delete cascade,
  category     text not null,
  service      text not null check (length(service) between 2 and 80),
  price        numeric(10,2) not null check (price > 0 and price < 10000),
  duration_min integer not null default 60 check (duration_min between 15 and 480),
  note         text check (note is null or length(note) <= 200),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (workshop_id, service)
);
create index if not exists fixed_price_services_ws on public.fixed_price_services (workshop_id) where active;

-- Wie viele Fahrzeuge der Betrieb pro Zeitfenster annimmt
alter table public.workshops add column if not exists slot_capacity integer not null default 1
  check (slot_capacity between 1 and 20);

alter table public.fixed_price_services enable row level security;

drop policy if exists fps_select on public.fixed_price_services;
create policy fps_select on public.fixed_price_services for select using (
  (active and exists (select 1 from public.workshops w where w.id = workshop_id and w.is_verified))
  or public.owns_workshop(workshop_id) or public.is_admin());

drop policy if exists fps_insert_own on public.fixed_price_services;
create policy fps_insert_own on public.fixed_price_services for insert with check (public.owns_workshop(workshop_id));
drop policy if exists fps_update_own on public.fixed_price_services;
create policy fps_update_own on public.fixed_price_services for update
  using (public.owns_workshop(workshop_id)) with check (public.owns_workshop(workshop_id));
drop policy if exists fps_delete_own on public.fixed_price_services;
create policy fps_delete_own on public.fixed_price_services for delete using (public.owns_workshop(workshop_id));

-- Freie Termine: stündliche Zeitfenster innerhalb der Öffnungszeiten, ab
-- zwei Stunden in der Zukunft, solange die Kapazität nicht ausgebucht ist.
-- Öffnungszeiten stehen als "08:00–18:00" je Wochentag (mo … so).
create or replace function public.free_slots(p_service uuid, p_days integer default 14)
returns setof timestamptz
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_ws   public.workshops%rowtype;
  v_svc  public.fixed_price_services%rowtype;
  v_day  date;
  v_key  text;
  v_txt  text;
  v_m    text[];
  v_from time; v_to time;
  v_slot timestamptz;
  v_used integer;
  v_keys text[] := array['so','mo','di','mi','do','fr','sa'];
begin
  select * into v_svc from public.fixed_price_services where id = p_service and active;
  if not found then return; end if;
  select * into v_ws from public.workshops where id = v_svc.workshop_id and is_verified
     and (not is_demo or public.is_test_account());
  if not found then return; end if;

  for i in 0 .. least(greatest(p_days, 1), 31) - 1 loop
    v_day := (now() at time zone 'Europe/Berlin')::date + i;
    v_key := v_keys[extract(dow from v_day)::int + 1];
    v_txt := v_ws.opening_hours ->> v_key;
    continue when v_txt is null;
    v_m := regexp_match(v_txt, '(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})');
    continue when v_m is null;
    v_from := make_time(v_m[1]::int, v_m[2]::int, 0);
    v_to   := make_time(least(v_m[3]::int, 23), v_m[4]::int, 0);
    -- Zähler statt nur Zeitvergleich: time + interval läuft um Mitternacht über
    for h in 0 .. 23 loop
      exit when v_from + make_interval(mins => v_svc.duration_min) > v_to
             or v_from + make_interval(mins => v_svc.duration_min) < v_from;
      v_slot := (v_day + v_from) at time zone 'Europe/Berlin';
      if v_slot > now() + interval '2 hours' then
        select count(*) into v_used from public.bookings b
         where b.workshop_id = v_ws.id and b.scheduled_at = v_slot and b.status <> 'cancelled';
        if v_used < v_ws.slot_capacity then
          return next v_slot;
        end if;
      end if;
      exit when v_from + interval '1 hour' < v_from;
      v_from := v_from + interval '1 hour';
    end loop;
  end loop;
end;
$$;
grant execute on function public.free_slots(uuid, integer) to anon, authenticated;

-- Festpreis-Termin buchen: legt Anfrage, angenommenes Angebot und Buchung
-- in einem Schritt an. Prüft Termin und Kapazität unter Sperre.
create or replace function public.book_fixed_price(p_service uuid, p_slot timestamptz, p_vehicle uuid default null, p_note text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid  uuid := auth.uid();
  v_svc  public.fixed_price_services%rowtype;
  v_ws   public.workshops%rowtype;
  v_veh  public.vehicles%rowtype;
  v_req  uuid; v_off uuid; v_bk uuid;
  v_lbl  text;
begin
  if v_uid is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_blocked_user() then raise exception 'Dein Konto ist gesperrt.'; end if;

  select * into v_svc from public.fixed_price_services where id = p_service and active;
  if not found then raise exception 'Diesen Festpreis gibt es nicht mehr.'; end if;
  -- Sperre auf den Betrieb: zwei gleichzeitige Buchungen desselben Termins
  select * into v_ws from public.workshops where id = v_svc.workshop_id for update;
  if not v_ws.is_verified or (v_ws.is_demo and not public.is_test_account()) then
    raise exception 'Bei diesem Betrieb ist keine Buchung möglich.';
  end if;
  if public.owns_workshop(v_ws.id) then raise exception 'Du kannst nicht bei deinem eigenen Betrieb buchen.'; end if;

  if not exists (select 1 from public.free_slots(p_service, 31) s where s = p_slot) then
    raise exception 'Dieser Termin ist leider nicht mehr frei.';
  end if;

  if p_vehicle is not null then
    select * into v_veh from public.vehicles where id = p_vehicle and owner_id = v_uid;
    if not found then raise exception 'Fahrzeug nicht gefunden.'; end if;
    v_lbl := trim(coalesce(v_veh.make, '') || ' ' || coalesce(v_veh.model, ''));
  end if;

  -- Keine Mitteilungen "Neue Direktanfrage"/"Neues Angebot" – es gibt nur
  -- die Buchung (notify_booking_ins meldet sie dem Betrieb).
  perform set_config('carfixo.fixed_booking', '1', true);

  insert into public.requests (customer_id, category, title, description, status, type, workshop_id,
                               vehicle_id, vehicle_label, city, preferred_date, extras)
  values (v_uid, v_svc.category, v_svc.service,
          'Festpreis-Termin: ' || v_svc.service || coalesce(E'\n' || nullif(left(trim(p_note), 500), ''), ''),
          'booked', 'direct', v_ws.id, p_vehicle, nullif(v_lbl, ''), v_ws.city,
          (p_slot at time zone 'Europe/Berlin')::date,
          jsonb_build_object('fixed_price_service', v_svc.id))
  returning id into v_req;

  insert into public.offers (request_id, workshop_id, line_items, total_price, message, status, is_fixed_price)
  values (v_req, v_ws.id,
          jsonb_build_array(jsonb_build_object('label', v_svc.service, 'qty', 1, 'price', v_svc.price)),
          v_svc.price, 'Festpreis', 'accepted', true)
  returning id into v_off;

  insert into public.bookings (offer_id, customer_id, workshop_id, vehicle_id, total_price, vat_amount,
                               scheduled_at, status, payment_status)
  values (v_off, v_uid, v_ws.id, p_vehicle, v_svc.price, round(v_svc.price - v_svc.price / 1.19, 2),
          p_slot, 'ready', 'none')
  returning id into v_bk;

  perform set_config('carfixo.fixed_booking', '', true);
  return jsonb_build_object('booking_id', v_bk, 'request_id', v_req);
end;
$$;
revoke all on function public.book_fixed_price(uuid, timestamptz, uuid, text) from public, anon;
grant execute on function public.book_fixed_price(uuid, timestamptz, uuid, text) to authenticated;

-- Mitteilungen bei Festpreis-Buchung unterdrücken (siehe oben)
create or replace function public.trg_notify_request()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare w record;
begin
  if coalesce(current_setting('carfixo.fixed_booking', true), '') = '1' then return NEW; end if;
  if NEW.type = 'direct' and NEW.workshop_id is not null then
    perform public.notify_workshop(NEW.workshop_id, 'lead', 'Neue Direktanfrage',
      coalesce(nullif(NEW.title,''),'Neue Anfrage'), 'ws/lead/' || NEW.id,
      jsonb_build_object('request_id', NEW.id), NEW.customer_id);
  elsif NEW.type = 'open' then
    for w in
      select id from public.workshops
       where is_verified and NEW.category = any(categories)
    loop
      perform public.notify_workshop(w.id, 'lead', 'Neue Ausschreibung',
        coalesce(nullif(NEW.title,''),'Neue Anfrage') ||
          coalesce(' · ' || nullif(NEW.city,''), ''),
        'ws/lead/' || NEW.id, jsonb_build_object('request_id', NEW.id), NEW.customer_id);
    end loop;
  end if;
  return NEW;
end; $function$;

create or replace function public.trg_notify_offer()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v_cust uuid; v_title text; v_ws text;
begin
  if coalesce(current_setting('carfixo.fixed_booking', true), '') = '1' then return NEW; end if;
  select customer_id, title into v_cust, v_title from public.requests where id = NEW.request_id;
  v_ws := (select name from public.workshops where id = NEW.workshop_id);
  perform public.notify_user(
    v_cust, 'offer', 'Neues Angebot',
    coalesce(v_ws,'Ein Betrieb') || ' · ' || public.eur(NEW.total_price)
      || coalesce(' – ' || nullif(v_title,''), ''),
    'request/' || NEW.request_id,
    jsonb_build_object('request_id', NEW.request_id, 'offer_id', NEW.id, 'workshop_id', NEW.workshop_id));
  return NEW;
end; $function$;

-- ---------- 2. Antwort des Betriebs auf Bewertungen ----------
alter table public.reviews add column if not exists reply text check (reply is null or length(reply) <= 1000);
alter table public.reviews add column if not exists reply_at timestamptz;

drop policy if exists reviews_workshop_reply on public.reviews;
create policy reviews_workshop_reply on public.reviews for update
  using (public.owns_workshop(workshop_id)) with check (public.owns_workshop(workshop_id));

-- Der Betrieb darf nur die Antwort ändern, nie Sterne oder Text des Kunden
create or replace function public.guard_review_fields()
returns trigger language plpgsql set search_path to 'public'
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;
  new.booking_id  := old.booking_id;
  new.customer_id := old.customer_id;
  new.workshop_id := old.workshop_id;
  new.rating      := old.rating;
  new.comment     := old.comment;
  new.images      := old.images;
  new.created_at  := old.created_at;
  new.reply       := nullif(trim(new.reply), '');
  new.reply_at    := case when new.reply is distinct from old.reply then
                       case when new.reply is null then null else now() end
                     else old.reply_at end;
  return new;
end;
$$;
drop trigger if exists trg_guard_review_fields on public.reviews;
create trigger trg_guard_review_fields before update on public.reviews
  for each row execute function public.guard_review_fields();

-- ---------- 3. Fotos im Chat ----------
alter table public.messages add column if not exists attachments jsonb not null default '[]'::jsonb
  check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 4);

-- ---------- 4. HSN/TSN ----------
alter table public.vehicles add column if not exists hsn text check (hsn is null or hsn ~ '^[0-9]{4}$');
alter table public.vehicles add column if not exists tsn text check (tsn is null or tsn ~ '^[A-Z0-9]{3}$');
