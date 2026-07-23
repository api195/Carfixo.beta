-- ============================================================
-- Carfixo Benachrichtigungen – Event-Trigger
-- Angewendet über Supabase MCP (Projekt boozzfiroukraekyijfq).
-- ============================================================

create or replace function public.eur(n numeric)
returns text language sql immutable as $$
  select replace(trim(to_char(coalesce(n,0),'FM999999990.00')),'.',',') || ' €';
$$;

create or replace function public._display_name(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(full_name),''), split_part(coalesce(email,''),'@',1), 'Nutzer')
  from public.profiles where id = p_user;
$$;

-- OFFERS -> Kunde
create or replace function public.trg_notify_offer()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cust uuid; v_title text; v_ws text;
begin
  select customer_id, title into v_cust, v_title from public.requests where id = NEW.request_id;
  v_ws := (select name from public.workshops where id = NEW.workshop_id);
  perform public.notify_user(v_cust, 'offer', 'Neues Angebot',
    coalesce(v_ws,'Ein Betrieb') || ' · ' || public.eur(NEW.total_price)
      || coalesce(' – ' || nullif(v_title,''), ''),
    'request/' || NEW.request_id,
    jsonb_build_object('request_id', NEW.request_id, 'offer_id', NEW.id, 'workshop_id', NEW.workshop_id));
  return NEW;
end; $$;
drop trigger if exists notify_offer on public.offers;
create trigger notify_offer after insert on public.offers
  for each row execute function public.trg_notify_offer();

-- MESSAGES -> Gegenseite
create or replace function public.trg_notify_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cust uuid; v_direct_ws uuid; v_booked_ws uuid;
  v_sender_name text; v_snippet text; w record;
begin
  if NEW.kind is distinct from 'user' then return NEW; end if;
  select customer_id, workshop_id into v_cust, v_direct_ws from public.requests where id = NEW.request_id;
  v_booked_ws := (select b.workshop_id from public.bookings b
      join public.offers o on o.id = b.offer_id
     where o.request_id = NEW.request_id order by b.created_at desc limit 1);
  v_sender_name := public._display_name(NEW.sender_id);
  v_snippet := left(NEW.body, 90);
  if NEW.sender_id = v_cust then
    if v_booked_ws is not null then
      perform public.notify_workshop(v_booked_ws, 'message', 'Neue Nachricht',
        v_sender_name || ': ' || v_snippet, 'ws/lead/' || NEW.request_id,
        jsonb_build_object('request_id', NEW.request_id), NEW.sender_id);
    elsif v_direct_ws is not null then
      perform public.notify_workshop(v_direct_ws, 'message', 'Neue Nachricht',
        v_sender_name || ': ' || v_snippet, 'ws/lead/' || NEW.request_id,
        jsonb_build_object('request_id', NEW.request_id), NEW.sender_id);
    else
      for w in select distinct workshop_id from public.offers where request_id = NEW.request_id loop
        perform public.notify_workshop(w.workshop_id, 'message', 'Neue Nachricht',
          v_sender_name || ': ' || v_snippet, 'ws/lead/' || NEW.request_id,
          jsonb_build_object('request_id', NEW.request_id), NEW.sender_id);
      end loop;
    end if;
  else
    perform public.notify_user(v_cust, 'message', 'Neue Nachricht',
      v_sender_name || ': ' || v_snippet, 'request/' || NEW.request_id,
      jsonb_build_object('request_id', NEW.request_id));
  end if;
  return NEW;
end; $$;
drop trigger if exists notify_message on public.messages;
create trigger notify_message after insert on public.messages
  for each row execute function public.trg_notify_message();

-- REQUESTS -> Direktanfrage / offene Ausschreibung
create or replace function public.trg_notify_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare w record;
begin
  if NEW.type = 'direct' and NEW.workshop_id is not null then
    perform public.notify_workshop(NEW.workshop_id, 'lead', 'Neue Direktanfrage',
      coalesce(nullif(NEW.title,''),'Neue Anfrage'), 'ws/lead/' || NEW.id,
      jsonb_build_object('request_id', NEW.id), NEW.customer_id);
  elsif NEW.type = 'open' then
    for w in select id from public.workshops where is_verified and NEW.category = any(categories) loop
      perform public.notify_workshop(w.id, 'lead', 'Neue Ausschreibung',
        coalesce(nullif(NEW.title,''),'Neue Anfrage') || coalesce(' · ' || nullif(NEW.city,''), ''),
        'ws/lead/' || NEW.id, jsonb_build_object('request_id', NEW.id), NEW.customer_id);
    end loop;
  end if;
  return NEW;
end; $$;
drop trigger if exists notify_request on public.requests;
create trigger notify_request after insert on public.requests
  for each row execute function public.trg_notify_request();

-- BOOKINGS -> neue Buchung + Statuswechsel
create or replace function public.status_label_de(s text)
returns text language sql immutable as $$
  select case s
    when 'confirmed' then 'Bestätigt' when 'ready' then 'Bereit'
    when 'vehicle_received' then 'Fahrzeug angenommen' when 'diagnosing' then 'In Diagnose'
    when 'in_progress' then 'In Bearbeitung' when 'approval_needed' then 'Freigabe benötigt'
    when 'ready_for_pickup' then 'Abholbereit' when 'completed' then 'Abgeschlossen'
    when 'cancelled' then 'Storniert' else s end;
$$;

create or replace function public.trg_notify_booking()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_req uuid;
begin
  v_req := (select o.request_id from public.offers o where o.id = NEW.offer_id);
  if TG_OP = 'INSERT' then
    perform public.notify_workshop(NEW.workshop_id, 'booking', 'Neue Buchung',
      'Auftrag ' || coalesce(NEW.booking_no,'') || ' · ' || public.eur(NEW.total_price),
      'ws/jobs', jsonb_build_object('booking_id', NEW.id, 'request_id', v_req));
    return NEW;
  end if;
  if NEW.status is distinct from OLD.status then
    if NEW.status = 'cancelled' then
      if NEW.cancelled_by = 'workshop' then
        perform public.notify_user(NEW.customer_id, 'booking', 'Buchung storniert',
          'Der Betrieb hat Auftrag ' || coalesce(NEW.booking_no,'') || ' storniert.',
          'request/' || v_req, jsonb_build_object('booking_id', NEW.id));
      else
        perform public.notify_workshop(NEW.workshop_id, 'booking', 'Buchung storniert',
          'Der Kunde hat Auftrag ' || coalesce(NEW.booking_no,'') || ' storniert.',
          'ws/jobs', jsonb_build_object('booking_id', NEW.id));
      end if;
    else
      perform public.notify_user(NEW.customer_id, 'booking',
        'Status: ' || public.status_label_de(NEW.status),
        'Auftrag ' || coalesce(NEW.booking_no,''),
        'request/' || v_req, jsonb_build_object('booking_id', NEW.id, 'status', NEW.status));
    end if;
  end if;
  if NEW.proposed_date is distinct from OLD.proposed_date and NEW.proposed_date is not null then
    if NEW.reschedule_by = 'workshop' then
      perform public.notify_user(NEW.customer_id, 'booking', 'Neuer Terminvorschlag',
        'Der Betrieb schlägt einen neuen Termin vor.', 'request/' || v_req,
        jsonb_build_object('booking_id', NEW.id));
    else
      perform public.notify_workshop(NEW.workshop_id, 'booking', 'Neuer Terminvorschlag',
        'Der Kunde schlägt einen neuen Termin vor.', 'ws/jobs',
        jsonb_build_object('booking_id', NEW.id));
    end if;
  end if;
  return NEW;
end; $$;
drop trigger if exists notify_booking_ins on public.bookings;
create trigger notify_booking_ins after insert on public.bookings
  for each row execute function public.trg_notify_booking();
drop trigger if exists notify_booking_upd on public.bookings;
create trigger notify_booking_upd after update on public.bookings
  for each row execute function public.trg_notify_booking();

-- APPROVALS -> Zusatzfreigabe
create or replace function public.trg_notify_approval()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_req uuid;
begin
  v_req := (select o.request_id from public.bookings b
              join public.offers o on o.id = b.offer_id where b.id = NEW.booking_id);
  if TG_OP = 'INSERT' then
    perform public.notify_user(NEW.customer_id, 'approval', 'Freigabe benötigt',
      coalesce(nullif(NEW.title,''),'Zusatzarbeit') || ' · ' || public.eur(NEW.extra_cost),
      'request/' || v_req, jsonb_build_object('approval_id', NEW.id, 'booking_id', NEW.booking_id));
    return NEW;
  end if;
  if NEW.status is distinct from OLD.status and NEW.status in ('approved','declined') then
    perform public.notify_workshop(NEW.workshop_id, 'approval',
      case NEW.status when 'approved' then 'Freigabe erteilt' else 'Freigabe abgelehnt' end,
      coalesce(nullif(NEW.title,''),'Zusatzarbeit'), 'ws/jobs',
      jsonb_build_object('approval_id', NEW.id, 'booking_id', NEW.booking_id));
  end if;
  return NEW;
end; $$;
drop trigger if exists notify_approval_ins on public.approvals;
create trigger notify_approval_ins after insert on public.approvals
  for each row execute function public.trg_notify_approval();
drop trigger if exists notify_approval_upd on public.approvals;
create trigger notify_approval_upd after update on public.approvals
  for each row execute function public.trg_notify_approval();

-- REVIEWS -> Werkstatt
create or replace function public.trg_notify_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_workshop(NEW.workshop_id, 'review',
    'Neue Bewertung (' || NEW.rating || '★)',
    coalesce(left(NEW.comment, 90), 'Ein Kunde hat dich bewertet.'),
    'ws/profile', jsonb_build_object('review_id', NEW.id));
  return NEW;
end; $$;
drop trigger if exists notify_review on public.reviews;
create trigger notify_review after insert on public.reviews
  for each row execute function public.trg_notify_review();

-- PART_ORDERS -> Bestellung + Statuswechsel
create or replace function public.trg_notify_part_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    perform public.notify_workshop(NEW.workshop_id, 'part_order', 'Neue Teile-Bestellung',
      coalesce(nullif(NEW.part_title,''),'Teil') || coalesce(' · ' || public.eur(NEW.price), ''),
      'ws/parts', jsonb_build_object('part_order_id', NEW.id), NEW.buyer_id);
    return NEW;
  end if;
  if NEW.status is distinct from OLD.status then
    perform public.notify_user(NEW.buyer_id, 'part_order',
      'Bestellung: ' || case NEW.status
        when 'requested' then 'Angefragt' when 'confirmed' then 'Bestätigt'
        when 'ready' then 'Abholbereit' when 'completed' then 'Abgeschlossen'
        when 'cancelled' then 'Storniert' else NEW.status end,
      coalesce(nullif(NEW.part_title,''),'Teil'),
      'teile', jsonb_build_object('part_order_id', NEW.id, 'status', NEW.status));
  end if;
  return NEW;
end; $$;
drop trigger if exists notify_part_order_ins on public.part_orders;
create trigger notify_part_order_ins after insert on public.part_orders
  for each row execute function public.trg_notify_part_order();
drop trigger if exists notify_part_order_upd on public.part_orders;
create trigger notify_part_order_upd after update on public.part_orders
  for each row execute function public.trg_notify_part_order();
