-- ============================================================
-- Carfixo Benachrichtigungen – Kern (Tabelle, RLS, Realtime, Helfer)
-- Angewendet über Supabase MCP (Projekt boozzfiroukraekyijfq).
-- ============================================================

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,                       -- Hash-Route, z.B. 'request/<id>' oder 'ws/lead/<id>'
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete using (user_id = auth.uid());

do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null;
  end;
end $$;

create or replace function public.notify_user(
  p_user  uuid,
  p_type  text,
  p_title text,
  p_body  text default null,
  p_link  text default null,
  p_data  jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, type, title, body, link, data)
  values (p_user, p_type, p_title, p_body, p_link, coalesce(p_data, '{}'::jsonb));
end;
$$;

create or replace function public.workshop_recipients(p_workshop uuid)
returns table(user_id uuid)
language sql security definer set search_path = public as $$
  select w.owner_id from public.workshops w where w.id = p_workshop and w.owner_id is not null
  union
  select m.user_id from public.workshop_members m
    where m.workshop_id = p_workshop and m.active and m.user_id is not null;
$$;

create or replace function public.notify_workshop(
  p_workshop uuid,
  p_type  text,
  p_title text,
  p_body  text default null,
  p_link  text default null,
  p_data  jsonb default '{}'::jsonb,
  p_exclude uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare r uuid;
begin
  for r in select wr.user_id from public.workshop_recipients(p_workshop) wr loop
    if p_exclude is null or r <> p_exclude then
      perform public.notify_user(r, p_type, p_title, p_body, p_link, p_data);
    end if;
  end loop;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns void
language sql security definer set search_path = public as $$
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null;
$$;

grant execute on function public.mark_all_notifications_read() to authenticated;
