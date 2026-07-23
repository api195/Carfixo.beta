-- ============================================================
-- Carfixo – Zeitgesteuerte Erinnerungs-Benachrichtigungen (pg_cron)
-- Angewendet über Supabase MCP (Projekt boozzfiroukraekyijfq).
-- ============================================================

-- Merkt sich, zu welchen Meilensteinen (Tage vor Fälligkeit) schon benachrichtigt wurde.
alter table public.reminders
  add column if not exists notified_offsets int[] not null default '{}';

-- Scannt offene Erinnerungen und erzeugt zum passenden Meilenstein je eine Benachrichtigung.
-- Meilensteine: 30, 14, 7, 1, 0 Tage vor Fälligkeit; -1 = überfällig.
create or replace function public.run_due_reminders()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record; d int; target int;
  v_title text; v_body text; v_when text;
  sent int := 0;
begin
  for r in
    select rm.*, v.make, v.model,
           coalesce((p.notify_prefs->>'reminders') is distinct from 'false', true) as rem_on
      from public.reminders rm
      join public.profiles p on p.id = rm.user_id
      left join public.vehicles v on v.id = rm.vehicle_id
     where rm.done = false
       and rm.due_date is not null
       and rm.due_date <= current_date + 30
  loop
    if not r.rem_on then continue; end if;
    d := r.due_date - current_date;
    target := case
      when d < 0  then -1
      when d = 0  then 0
      when d <= 1  then 1
      when d <= 7  then 7
      when d <= 14 then 14
      when d <= 30 then 30
      else null end;
    if target is null or target = any(r.notified_offsets) then continue; end if;

    v_title := case r.kind
      when 'tuev'    then 'Erinnerung: TÜV/HU'
      when 'service' then 'Erinnerung: Service/Inspektion'
      when 'reifen'  then 'Erinnerung: Reifenwechsel'
      else 'Erinnerung: ' || coalesce(nullif(r.title,''),'Termin') end;
    v_when := case
      when d < 0  then 'überfällig seit ' || to_char(r.due_date,'DD.MM.YYYY')
      when d = 0  then 'heute fällig (' || to_char(r.due_date,'DD.MM.YYYY') || ')'
      when d = 1  then 'morgen fällig (' || to_char(r.due_date,'DD.MM.YYYY') || ')'
      else 'fällig am ' || to_char(r.due_date,'DD.MM.YYYY') || ' · noch ' || d || ' Tage' end;
    v_body := coalesce(nullif(r.title,'') || ' – ', '') || v_when
              || case when r.make is not null then ' · ' || r.make || ' ' || coalesce(r.model,'') else '' end;

    perform public.notify_user(
      r.user_id, 'reminder', v_title, v_body, 'reminders',
      jsonb_build_object('reminder_id', r.id, 'kind', r.kind, 'offset', target));
    update public.reminders
       set notified_offsets = array_append(notified_offsets, target) where id = r.id;
    sent := sent + 1;
  end loop;
  return sent;
end; $$;

-- Täglich um 06:00 UTC
create extension if not exists pg_cron;
do $$
begin
  perform cron.schedule('carfixo-daily-reminders', '0 6 * * *', 'select public.run_due_reminders();');
exception when others then
  perform cron.alter_job(jobid, schedule := '0 6 * * *', command := 'select public.run_due_reminders();')
    from cron.job where jobname = 'carfixo-daily-reminders';
end $$;
