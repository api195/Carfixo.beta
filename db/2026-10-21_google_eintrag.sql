-- ============================================================
-- Carfixo – Google-Eintrag eines Betriebs verknüpfen
--
-- Der Betrieb wählt im Profil seinen Google-Unternehmenseintrag aus
-- (google_place_id). Angezeigt werden Google-Sterne und -Fotos erst, wenn
-- ein Admin die Zuordnung bestätigt hat (google_place_confirmed) – sonst
-- könnte sich ein Fake-Betrieb die Bewertungen eines anderen ausleihen.
--
-- Gespeichert wird NUR die Place-ID (erlaubt laut Google Maps Platform).
-- Sterne und Fotos werden bei jedem Aufruf live über /api/google-place
-- geholt und nicht gespeichert.
--
-- Reihenfolge: nach 2026-10-21_stripe.sql einspielen.
-- ============================================================

alter table public.workshops add column if not exists google_place_id text
  check (google_place_id is null
         or (google_place_id ~ '^[A-Za-z0-9_-]+$' and char_length(google_place_id) between 10 and 300));
alter table public.workshops add column if not exists google_place_confirmed boolean not null default false;

create index if not exists workshops_google_place_idx on public.workshops (google_place_id)
  where google_place_id is not null;

-- Schutzregel: Betrieb darf seine Place-ID setzen, aber nicht selbst bestätigen.
-- Jede Änderung der Place-ID hebt eine frühere Bestätigung auf.
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
    new.is_verified            := false;
    new.rating_avg             := 0;
    new.rating_count           := 0;
    new.is_demo                := false;
    new.online_payment         := false;
    new.google_place_confirmed := false;
  else
    -- Stillschweigend beibehalten statt Fehler: Das Profil-Formular darf
    -- die ganze Zeile zurückschicken, ohne dass das Speichern scheitert.
    new.is_verified    := old.is_verified;
    new.rating_avg     := old.rating_avg;
    new.rating_count   := old.rating_count;
    new.is_demo        := old.is_demo;
    new.owner_id       := old.owner_id;
    new.online_payment := old.online_payment;
    if new.google_place_id is distinct from old.google_place_id then
      new.google_place_confirmed := false;
    else
      new.google_place_confirmed := old.google_place_confirmed;
    end if;
  end if;
  return new;
end;
$$;
