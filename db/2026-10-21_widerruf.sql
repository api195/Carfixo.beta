-- ============================================================
-- Carfixo – Widerrufsbutton für Buchungen
--
-- Seit 19.06.2026 müssen Verbraucher online geschlossene Verträge auch
-- online widerrufen können: eine gut sichtbare Schaltfläche
-- "Vertrag widerrufen", danach eine Bestätigungsseite mit
-- "Widerruf bestätigen", und eine Eingangsbestätigung in Textform mit
-- Datum und Uhrzeit (Richtlinie (EU) 2023/2673, im BGB umgesetzt).
--
-- Vertragspartner der Reparatur ist der Betrieb. Carfixo stellt die
-- Schaltfläche bereit, speichert den Zugang, informiert den Betrieb und
-- schickt dem Kunden die Eingangsbestätigung (notify-dispatch).
--
-- Wie bei der Kündigung legt nicht der Client die Zeile an, sondern
-- submit_withdrawal(): prüft Eingaben, bremst Missbrauch, ordnet die
-- Buchung zu. Eine Erklärung wird IMMER angenommen – ob sie wirksam ist
-- (Frist, bereits erbrachte Leistung), klären Betrieb und Kunde.
--
-- Reihenfolge: nach 2026-10-21_google_eintrag.sql einspielen.
-- ============================================================

create table if not exists public.contract_withdrawals (
  id              uuid primary key default gen_random_uuid(),
  received_at     timestamptz not null default now(),    -- Zugang der Erklärung
  user_id         uuid references auth.users(id) on delete set null,
  full_name       text not null check (char_length(full_name) between 2 and 120),
  email           text not null check (char_length(email) between 5 and 200
                                       and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  booking_no      text not null check (char_length(booking_no) between 3 and 40),
  booking_id      uuid references public.bookings(id) on delete set null,
  workshop_id     uuid references public.workshops(id) on delete set null,
  note            text check (note is null or char_length(note) <= 2000),
  status          text not null default 'eingegangen'
                    check (status in ('eingegangen', 'bearbeitet')),
  processed_at    timestamptz,
  receipt_sent_at timestamptz,
  client_ip_hash  text
);

alter table public.contract_withdrawals enable row level security;

drop policy if exists withdrawals_admin on public.contract_withdrawals;
create policy withdrawals_admin on public.contract_withdrawals
  for all using (public.is_admin()) with check (public.is_admin());

-- Kunde sieht seine eigenen (auch ohne Anmeldung erklärte zu seiner Buchung),
-- Betrieb die zu seinen Buchungen – nur lesen
drop policy if exists withdrawals_read on public.contract_withdrawals;
create policy withdrawals_read on public.contract_withdrawals
  for select using (
    user_id = auth.uid()
    or public.owns_workshop(workshop_id)
    or exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = auth.uid()));

create index if not exists contract_withdrawals_email_idx on public.contract_withdrawals (lower(email), received_at);
create index if not exists contract_withdrawals_ip_idx on public.contract_withdrawals (client_ip_hash, received_at);
create index if not exists contract_withdrawals_booking_idx on public.contract_withdrawals (booking_id);

create or replace function public.submit_withdrawal(
  p_full_name  text,
  p_email      text,
  p_booking_no text,
  p_note       text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  ip_hash text;
  bk      record;
  zeile   public.contract_withdrawals;
begin
  ip_hash := nullif(md5(split_part(coalesce(
               current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1)),
             md5(''));

  if (select count(*) from public.contract_withdrawals
       where lower(email) = lower(trim(p_email)) and received_at > now() - interval '1 day') >= 5
     or (ip_hash is not null and (select count(*) from public.contract_withdrawals
       where client_ip_hash = ip_hash and received_at > now() - interval '1 hour') >= 10) then
    raise exception 'Zu viele Widerrufe in kurzer Zeit. Bitte versuche es später erneut oder schreib uns per E-Mail.';
  end if;

  -- Buchung nur zuordnen, wenn sie dem Erklärenden gehört (angemeldet oder
  -- gleiche E-Mail). Sonst wird die Erklärung trotzdem gespeichert und
  -- Carfixo ordnet sie von Hand zu.
  select b.id, b.workshop_id, w.name as betrieb into bk
    from public.bookings b
    join public.profiles p on p.id = b.customer_id
    join public.workshops w on w.id = b.workshop_id
   where upper(b.booking_no) = upper(trim(p_booking_no))
     and (b.customer_id = auth.uid() or lower(p.email) = lower(trim(p_email)))
   limit 1;

  insert into public.contract_withdrawals
    (user_id, full_name, email, booking_no, booking_id, workshop_id, note, client_ip_hash)
  values
    (auth.uid(), trim(p_full_name), lower(trim(p_email)), upper(trim(p_booking_no)),
     bk.id, bk.workshop_id, nullif(trim(p_note), ''), ip_hash)
  returning * into zeile;

  return json_build_object('id', zeile.id, 'received_at', zeile.received_at,
                           'zugeordnet', bk.id is not null, 'betrieb', bk.betrieb);
end;
$$;

revoke all on function public.submit_withdrawal(text, text, text, text) from public;
grant execute on function public.submit_withdrawal(text, text, text, text) to anon, authenticated;

-- Eingangsbestätigung an den Kunden (notify-dispatch), Hinweis an Betrieb und Admins
create or replace function private.dispatch_withdrawal()
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
        body := jsonb_build_object('withdrawal_id', new.id),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
        timeout_milliseconds := 6000);
    exception when others then null;
    end;
  end if;

  if new.workshop_id is not null then
    perform public.notify_workshop(new.workshop_id, 'booking', 'Widerruf erhalten',
      'Der Kunde widerruft den Vertrag zu Auftrag ' || new.booking_no || '. Bitte melde dich bei ihm und erstatte ggf. Zahlungen.',
      'ws/jobs', jsonb_build_object('withdrawal_id', new.id));
  end if;
  for a in select id from public.profiles where role = 'admin' loop
    perform public.notify_user(a, 'system', 'Widerruf eingegangen',
      new.full_name || ' · ' || new.booking_no || case when new.workshop_id is null then ' · nicht zugeordnet' else '' end,
      'admin', jsonb_build_object('withdrawal_id', new.id));
  end loop;
  return new;
end;
$$;

create or replace trigger trg_dispatch_withdrawal
  after insert on public.contract_withdrawals
  for each row execute function private.dispatch_withdrawal();
