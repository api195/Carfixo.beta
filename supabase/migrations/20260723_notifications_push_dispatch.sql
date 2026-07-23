-- ============================================================
-- Carfixo Benachrichtigungen – Push/E-Mail-Versand (Plumbing)
-- Angewendet über Supabase MCP (Projekt boozzfiroukraekyijfq).
-- HINWEIS: Die tatsächlichen Secret-Werte (VAPID privat, Webhook-Secret,
--          Resend-Key) wurden direkt in der DB gesetzt und sind hier
--          bewusst als Platzhalter belassen (Repo evtl. öffentlich).
-- ============================================================

create extension if not exists pg_net;

create schema if not exists private;

create table if not exists private.app_secrets (
  key   text primary key,
  value text
);
alter table private.app_secrets enable row level security;  -- keine Policy => nur service_role / SECURITY DEFINER

-- Werte via SQL/Dashboard setzen (siehe docs/NOTIFICATIONS.md):
--   vapid_public, vapid_private, vapid_subject, functions_url,
--   notify_webhook_secret, resend_api_key, resend_from, app_url
insert into private.app_secrets(key, value) values
  ('vapid_public',          '<VAPID_PUBLIC>'),
  ('vapid_private',         '<VAPID_PRIVATE>'),
  ('vapid_subject',         'mailto:info@carfixo.de'),
  ('functions_url',         'https://<PROJECT>.supabase.co/functions/v1/notify-dispatch'),
  ('notify_webhook_secret', '<RANDOM_SECRET>'),
  ('resend_api_key',        ''),
  ('resend_from',           'Carfixo <onboarding@resend.dev>'),
  ('app_url',               '')
on conflict (key) do nothing;

-- Push-Abos (Browser Web-Push Subscriptions)
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  ua         text,
  created_at timestamptz not null default now()
);
create index if not exists push_sub_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;

drop policy if exists push_sub_select_own on public.push_subscriptions;
create policy push_sub_select_own on public.push_subscriptions
  for select using (user_id = auth.uid());
drop policy if exists push_sub_insert_own on public.push_subscriptions;
create policy push_sub_insert_own on public.push_subscriptions
  for insert with check (user_id = auth.uid());
drop policy if exists push_sub_update_own on public.push_subscriptions;
create policy push_sub_update_own on public.push_subscriptions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists push_sub_delete_own on public.push_subscriptions;
create policy push_sub_delete_own on public.push_subscriptions
  for delete using (user_id = auth.uid());

-- Dispatch-Trigger: nach jedem notifications-INSERT die Edge Function anstoßen.
create or replace function private.dispatch_notification()
returns trigger
language plpgsql security definer set search_path = private, public as $$
declare v_url text; v_secret text;
begin
  select value into v_url    from private.app_secrets where key = 'functions_url';
  select value into v_secret from private.app_secrets where key = 'notify_webhook_secret';
  if v_url is null or v_url = '' then return NEW; end if;
  begin
    perform net.http_post(
      url     := v_url,
      body    := jsonb_build_object('notification_id', NEW.id),
      headers := jsonb_build_object('Content-Type','application/json','x-notify-secret', v_secret),
      timeout_milliseconds := 6000
    );
  exception when others then null;  -- Push/E-Mail ist best effort
  end;
  return NEW;
end; $$;

drop trigger if exists dispatch_notification on public.notifications;
create trigger dispatch_notification after insert on public.notifications
  for each row execute function private.dispatch_notification();

-- Nur für service_role (Edge Function) lesbare Secrets-RPC
create or replace function public.get_notify_secrets()
returns jsonb
language sql security definer set search_path = private, public as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from private.app_secrets;
$$;
revoke all on function public.get_notify_secrets() from public, anon, authenticated;
grant execute on function public.get_notify_secrets() to service_role;
