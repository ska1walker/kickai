-- kick-ai Supabase-Schema (Region EU Frankfurt).
-- Anwenden: Supabase-Dashboard → SQL Editor, oder via MCP apply_migration.

-- Kader: die 22 Spieler mit erwartetem Punktwert.
create table if not exists squad_players (
  id           text primary key,          -- kicker Spieler-ID (pl-...)
  name         text not null,
  club         text not null,             -- kanonischer Vereinscode
  position     text not null check (position in ('TW','ABW','MF','ST')),
  exp_points   numeric not null default 0,
  mv           numeric,                   -- Marktwert in Mio €
  created_at   timestamptz not null default now()
);

-- Status pro Spieler und Spieltag (start/doubt/bench/out).
create table if not exists matchday_status (
  season     int  not null,               -- Startjahr, 2025 = 25/26
  matchday   int  not null,
  player_id  text not null references squad_players(id) on delete cascade,
  status     text not null check (status in ('start','doubt','bench','out')),
  updated_at timestamptz not null default now(),
  primary key (season, matchday, player_id)
);

create index if not exists idx_status_md on matchday_status (season, matchday);

-- Einzelnutzer-App (Kai): RLS an, anon darf lesen/schreiben.
-- Für Mehrbenutzer später auf auth.uid() umstellen.
alter table squad_players  enable row level security;
alter table matchday_status enable row level security;

drop policy if exists "anon all squad"  on squad_players;
drop policy if exists "anon all status" on matchday_status;
create policy "anon all squad"  on squad_players  for all using (true) with check (true);
create policy "anon all status" on matchday_status for all using (true) with check (true);
