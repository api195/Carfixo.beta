-- ============================================================
-- Carfixo – RLS- und Index-Performance
-- Grundlage: Supabase Performance-Advisor
--
-- STATUS: auf Produktion angewendet (Migrationen
--   rls_perf_wrap_auth_calls_in_select
--   perf_add_missing_fk_indexes)
--
-- Ergebnis: Performance-Advisor von 81 auf 39 Meldungen.
--   erledigt: 40x auth_rls_initplan, 21x unindexed_foreign_keys,
--             1x duplicate_index
--   offen:    29x unused_index (INFO), 10x multiple_permissive_policies
--             – beides bewusst, Begruendung unten.
-- ============================================================

-- ------------------------------------------------------------
-- 1) auth.uid() in den Policies als InitPlan auswerten
--
-- auth.uid() direkt in einer Policy wird PRO ZEILE ausgewertet. In
-- (select auth.uid()) verpackt zieht Postgres den Aufruf heraus und wertet
-- ihn einmal je Anweisung aus. Die Funktionen sind STABLE, das Ergebnis ist
-- innerhalb einer Anweisung identisch – die Semantik bleibt unveraendert.
--
-- Zwei Fallstricke:
--  a) Postgres speichert den Subquery normalisiert als
--     "( SELECT auth.uid() AS uid)" – eine Gegenprobe muss dieses Format
--     beruecksichtigen, sonst meldet sie faelschlich eine Abweichung.
--  b) Vor dem Umbau auf die nackte Form normalisieren, sonst entsteht bei
--     einem zweiten Lauf ein doppeltes (select (select ...)).
--
-- Der Block prueft sich am Ende selbst und rollt bei jeder Abweichung
-- alles zurueck (ein DO-Block ist eine einzige Anweisung).
-- ------------------------------------------------------------
do $$
declare
  r record; base_q text; base_c text; newq text; newc text;
  changed int := 0; checked int := 0;
  unwrap constant text := '\( SELECT (auth\.(?:uid|role|jwt)\(\)) AS [a-z_]+\)';
  bare   constant text := '(auth\.(?:uid|role|jwt)\(\))';
begin
  create temp table _pol_backup as
  select c.relname::text as tbl, p.polname::text as pol,
         pg_get_expr(p.polqual, p.polrelid)      as q,
         pg_get_expr(p.polwithcheck, p.polrelid) as c
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public';

  for r in select * from _pol_backup
           where coalesce(q,'') ~ bare or coalesce(c,'') ~ bare
  loop
    base_q := regexp_replace(r.q, unwrap, '\1', 'g');
    base_c := regexp_replace(r.c, unwrap, '\1', 'g');
    newq   := regexp_replace(base_q, bare, '(select \1)', 'g');
    newc   := regexp_replace(base_c, bare, '(select \1)', 'g');

    if r.q is not null and r.c is not null then
      execute format('alter policy %I on public.%I using (%s) with check (%s)', r.pol, r.tbl, newq, newc);
    elsif r.q is not null then
      execute format('alter policy %I on public.%I using (%s)', r.pol, r.tbl, newq);
    else
      execute format('alter policy %I on public.%I with check (%s)', r.pol, r.tbl, newc);
    end if;
    changed := changed + 1;
  end loop;

  for r in
    select b.tbl, b.pol, b.q, b.c,
           pg_get_expr(p.polqual, p.polrelid)      as nq,
           pg_get_expr(p.polwithcheck, p.polrelid) as nc
    from _pol_backup b
    join pg_class c on c.relname = b.tbl
    join pg_namespace ns on ns.oid = c.relnamespace and ns.nspname = 'public'
    join pg_policy p on p.polrelid = c.oid and p.polname = b.pol
  loop
    checked := checked + 1;
    if coalesce(regexp_replace(r.nq, unwrap, '\1', 'g'), '')
         is distinct from coalesce(regexp_replace(r.q, unwrap, '\1', 'g'), '')
    or coalesce(regexp_replace(r.nc, unwrap, '\1', 'g'), '')
         is distinct from coalesce(regexp_replace(r.c, unwrap, '\1', 'g'), '') then
      raise exception 'Policy %.% weicht vom Original ab - Abbruch', r.tbl, r.pol;
    end if;
  end loop;

  raise notice 'Policies umgeschrieben: %, geprueft: %', changed, checked;
  drop table _pol_backup;
end $$;

-- ------------------------------------------------------------
-- 2) Fremdschluessel ohne Index
-- Ohne Index muss Postgres bei Joins und beim Loeschen der referenzierten
-- Zeile die ganze Tabelle scannen – betrifft genau die Spalten, ueber die
-- die App staendig joint (Auftraege -> Angebote -> Werkstatt/Kunde).
-- ------------------------------------------------------------
create index if not exists idx_approvals_booking        on public.approvals(booking_id);
create index if not exists idx_approvals_customer       on public.approvals(customer_id);
create index if not exists idx_approvals_workshop       on public.approvals(workshop_id);
create index if not exists idx_bookings_customer        on public.bookings(customer_id);
create index if not exists idx_bookings_offer           on public.bookings(offer_id);
create index if not exists idx_bookings_vehicle         on public.bookings(vehicle_id);
create index if not exists idx_bookings_workshop        on public.bookings(workshop_id);
create index if not exists idx_favorites_workshop       on public.favorites(workshop_id);
create index if not exists idx_messages_sender          on public.messages(sender_id);
create index if not exists idx_offer_templates_workshop on public.offer_templates(workshop_id);
create index if not exists idx_part_orders_part         on public.part_orders(part_id);
create index if not exists idx_reminders_vehicle        on public.reminders(vehicle_id);
create index if not exists idx_reports_booking          on public.reports(booking_id);
create index if not exists idx_reports_reporter         on public.reports(reporter_id);
create index if not exists idx_reports_workshop         on public.reports(workshop_id);
create index if not exists idx_requests_vehicle         on public.requests(vehicle_id);
create index if not exists idx_reviews_customer         on public.reviews(customer_id);
create index if not exists idx_vehicle_logs_user        on public.vehicle_logs(user_id);
create index if not exists idx_vehicle_logs_vehicle     on public.vehicle_logs(vehicle_id);
create index if not exists idx_workshop_members_user    on public.workshop_members(user_id);

-- Doppelter Index auf offers(request_id): identisch zu idx_offers_request,
-- keiner der beiden haengt an einem Constraint.
drop index if exists public.offers_request_id_idx;

-- ============================================================
-- BEWUSST NICHT GEAENDERT
--
-- unused_index (29x, INFO): Die Zahl ist nach dieser Migration hoeher als
--   vorher, weil neu angelegte Indizes naturgemaess noch nie benutzt wurden.
--   Die Statistik stammt aus einer Datenbank mit einer Handvoll Zeilen und
--   ohne echten Traffic – sie sagt nichts darueber aus, ob ein Index im
--   Betrieb gebraucht wird. Erst nach einigen Wochen Produktivbetrieb
--   erneut bewerten und dann gezielt aufraeumen.
--
-- multiple_permissive_policies (10x, WARN): Mehrere SELECT-Policies je
--   Tabelle (Admin / Eigentuemer / Beteiligter). Zusammenfassen hiesse, die
--   Zugriffslogik in eine grosse OR-Bedingung zu giessen. Das spart bei
--   diesen Tabellengroessen kaum Zeit, macht die Regeln aber deutlich
--   schwerer nachvollziehbar – und Fehler wirken sich hier direkt auf die
--   Datensicherheit aus. Getrennte, gut benannte Policies sind den
--   minimalen Mehraufwand wert.
-- ============================================================
