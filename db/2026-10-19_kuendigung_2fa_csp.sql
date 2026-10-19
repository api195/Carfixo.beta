-- ============================================================
-- Carfixo – Kündigungsbutton, Zwei-Faktor-Pflicht für Admins,
--           dauerhafte CSP-Meldungen
--
-- STAND: VORBEREITET, WARTET AUFS EINSPIELEN (2026-10-19).
-- Reihenfolge: ZUERST 2026-10-18_vertrauensfelder_und_beispielbetriebe.sql,
-- DANN diese Datei. Beide im Supabase SQL Editor komplett ausführen.
-- Wiederholbar (if not exists / create or replace).
--
-- ACHTUNG Admin-Zugang: Nach dem Einspielen gelten Admin-Rechte nur noch
-- mit zweitem Faktor (aal2). Bis du in der App unter "Konto" die
-- Zwei-Faktor-Anmeldung eingerichtet hast, ist der Admin-Bereich gesperrt –
-- das ist Absicht. Notfalls zurück mit Abschnitt 2 aus der alten Fassung:
--   create or replace function public.is_admin() returns boolean
--   language sql stable security definer set search_path = public as
--   $$ select exists (select 1 from public.profiles
--                     where id = auth.uid() and role = 'admin'); $$;
-- ============================================================


-- ============================================================
-- 1) KÜNDIGUNGEN (§ 312k BGB)
--
-- Die Schaltfläche "Verträge hier kündigen" muss ohne Anmeldung nutzbar
-- sein. Deshalb legt nicht der Client die Zeile an, sondern die Funktion
-- submit_cancellation() – sie prüft die Eingaben, bremst Missbrauch und gibt
-- den Zeitpunkt des Zugangs zurück. Lesen und Bearbeiten nur für Admins.
--
-- Missbrauchsschutz: Die Funktion verschickt eine Bestätigung an die
-- angegebene Adresse. Ohne Bremse ließe sich darüber jemand mit Mails
-- zuschütten. Höchstens 3 Kündigungen pro Adresse und Tag, 10 pro
-- Netzwerk-Adresse und Stunde. Die IP wird nur als Hash gespeichert.
-- ============================================================

create table if not exists public.contract_cancellations (
  id              uuid primary key default gen_random_uuid(),
  received_at     timestamptz not null default now(),   -- Zugang der Erklärung
  user_id         uuid references auth.users(id) on delete set null,
  full_name       text not null check (char_length(full_name) between 2 and 120),
  email           text not null check (char_length(email) between 5 and 200
                                       and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contract        text not null check (contract in
                    ('kundenkonto', 'betriebskonto', 'premium_kunde', 'premium_betrieb')),
  contract_ref    text check (contract_ref is null or char_length(contract_ref) <= 200),
  kind            text not null check (kind in ('ordentlich', 'ausserordentlich')),
  reason          text check (reason is null or char_length(reason) <= 2000),
  effective       text not null check (effective in ('naechstmoeglich', 'datum')),
  effective_date  date,
  status          text not null default 'eingegangen'
                    check (status in ('eingegangen', 'umgesetzt', 'abgelehnt')),
  processed_at    timestamptz,
  receipt_sent_at timestamptz,                          -- Bestätigung in Textform verschickt
  client_ip_hash  text,
  check (kind = 'ordentlich' or reason is not null),
  check (effective = 'naechstmoeglich' or effective_date is not null)
);

alter table public.contract_cancellations enable row level security;

drop policy if exists contract_cancellations_admin on public.contract_cancellations;
create policy contract_cancellations_admin on public.contract_cancellations
  for all using (public.is_admin()) with check (public.is_admin());

create index if not exists contract_cancellations_email_idx
  on public.contract_cancellations (lower(email), received_at);
create index if not exists contract_cancellations_ip_idx
  on public.contract_cancellations (client_ip_hash, received_at);

create or replace function public.submit_cancellation(
  p_full_name      text,
  p_email          text,
  p_contract       text,
  p_contract_ref   text,
  p_kind           text,
  p_reason         text,
  p_effective      text,
  p_effective_date date
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  ip_hash text;
  zeile   public.contract_cancellations;
begin
  ip_hash := nullif(md5(split_part(coalesce(
               current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1)),
             md5(''));

  if (select count(*) from public.contract_cancellations
       where lower(email) = lower(trim(p_email)) and received_at > now() - interval '1 day') >= 3
     or (ip_hash is not null and (select count(*) from public.contract_cancellations
       where client_ip_hash = ip_hash and received_at > now() - interval '1 hour') >= 10) then
    raise exception 'Zu viele Kündigungen in kurzer Zeit. Bitte versuche es später erneut oder schreib uns per E-Mail.';
  end if;

  insert into public.contract_cancellations
    (user_id, full_name, email, contract, contract_ref, kind, reason,
     effective, effective_date, client_ip_hash)
  values
    (auth.uid(), trim(p_full_name), lower(trim(p_email)), p_contract,
     nullif(trim(p_contract_ref), ''), p_kind, nullif(trim(p_reason), ''),
     p_effective, case when p_effective = 'datum' then p_effective_date end, ip_hash)
  returning * into zeile;

  return json_build_object('id', zeile.id, 'received_at', zeile.received_at);
end;
$$;

revoke all on function public.submit_cancellation(text, text, text, text, text, text, text, date) from public;
grant execute on function public.submit_cancellation(text, text, text, text, text, text, text, date) to anon, authenticated;

-- Bestätigung in Textform (§ 312k Abs. 4) über notify-dispatch verschicken
-- und alle Admins benachrichtigen. Asynchron über pg_net wie bisher.
create or replace function private.dispatch_cancellation()
returns trigger
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_url text; v_secret text; a uuid;
begin
  select value into v_url    from private.app_secrets where key = 'functions_url';
  select value into v_secret from private.app_secrets where key = 'notify_webhook_secret';
  if v_url is not null and v_url <> '' then
    begin
      perform net.http_post(
        url := v_url,
        body := jsonb_build_object('cancellation_id', new.id),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
        timeout_milliseconds := 6000);
    exception when others then null;   -- best effort; Admin sieht die Kündigung trotzdem
    end;
  end if;

  for a in select id from public.profiles where role = 'admin' loop
    perform public.notify_user(a, 'system', 'Neue Kündigung eingegangen',
      new.full_name || ' · ' || new.contract, 'admin', jsonb_build_object('cancellation_id', new.id));
  end loop;
  return new;
end;
$$;

create or replace trigger trg_dispatch_cancellation
  after insert on public.contract_cancellations
  for each row execute function private.dispatch_cancellation();


-- ============================================================
-- 2) ADMIN-RECHTE NUR MIT ZWEITEM FAKTOR
--
-- Das Admin-Konto ist das mächtigste Konto der Plattform. Bisher reichte
-- das Passwort. Jetzt zählt die Rolle nur, wenn die Sitzung mit zweitem
-- Faktor bestätigt ist (aal2). Einrichten des Faktors braucht keine
-- Admin-Rechte – das geht ganz normal unter "Konto".
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;


-- ============================================================
-- 3) CSP-MELDUNGEN DAUERHAFT SPEICHERN
--
-- Der Hobby-Plan von Vercel hält Logs nur eine Stunde – die Meldungen aus
-- /api/csp-report waren verfallen, bevor jemand nachsah. Jetzt schreibt der
-- Endpunkt sie über log_csp_report() hierher. Nur Admins lesen. Einträge
-- älter als 30 Tage räumt die Funktion selbst weg, und pro Tag werden
-- höchstens 2.000 angenommen – damit kann niemand die Tabelle fluten.
-- ============================================================

create table if not exists public.csp_reports (
  id          bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  directive   text check (char_length(directive) <= 100),
  blocked     text check (char_length(blocked) <= 300),
  page        text check (char_length(page) <= 300),
  source      text check (char_length(source) <= 300),
  line        int
);

alter table public.csp_reports enable row level security;

drop policy if exists csp_reports_admin_select on public.csp_reports;
create policy csp_reports_admin_select on public.csp_reports
  for select using (public.is_admin());

create or replace function public.log_csp_report(
  p_directive text, p_blocked text, p_page text, p_source text, p_line int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.csp_reports where received_at > now() - interval '1 day') >= 2000 then
    return;
  end if;
  insert into public.csp_reports (directive, blocked, page, source, line)
  values (left(p_directive, 100), left(p_blocked, 300), left(p_page, 300), left(p_source, 300), p_line);
  delete from public.csp_reports where received_at < now() - interval '30 days';
end;
$$;

revoke all on function public.log_csp_report(text, text, text, text, int) from public;
grant execute on function public.log_csp_report(text, text, text, text, int) to anon;

-- ============================================================
-- 4) Meldungen auch für Teile (Art. 16 DSA: Meldeweg für ALLE
--    eingestellten Inhalte). Bewertungen ('review') gingen schon.
-- ============================================================
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('workshop', 'user', 'review', 'request', 'message', 'offer', 'part'));

-- Admins dürfen gemeldete Teile ausblenden (active = false). Bewertungen
-- löschen konnten sie schon (reviews_admin_delete).
drop policy if exists parts_admin_update on public.parts;
create policy parts_admin_update on public.parts
  for update using (public.is_admin()) with check (public.is_admin());
