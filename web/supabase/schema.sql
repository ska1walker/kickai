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

-- News-Memory: täglich gesammelte Bundesliga-News für den Kaderbau.
-- durable = dauerhafter Fakt (Transfer, Trainer, Verletzung m. Dauer) → verfällt nicht;
-- sonst flüchtiges Signal (Gerücht, Form) → wird nach Aktualität abgewertet.
create table if not exists news_log (
  id         bigint generated always as identity primary key,
  news_date  date not null default current_date,
  club       text,                          -- kanonischer Vereinscode (nullable)
  player     text,
  type       text not null check (type in
             ('transfer_in','transfer_out','coach','injury','suspension','return','preseason_form','other')),
  durable    boolean not null default false,
  impact     int not null default 2 check (impact between 1 and 4),
             -- Managerspiel-Relevanz: 4=kritisch, 3=hoch, 2=mittel, 1=gering
  summary    text not null,
  source     text,
  dedup_key  text not null unique,          -- gruppiert dieselbe Story über Tage
  created_at timestamptz not null default now()
);
-- Upgrade bestehender Installationen (idempotent):
alter table news_log add column if not exists impact int not null default 2;
create index if not exists idx_news_created on news_log (created_at desc);
create index if not exists idx_news_club on news_log (club);

-- Spieler-Pool je Saison (per Import-Button aus der kicker-CSV gefüllt).
-- Ersetzt zur Laufzeit die gebündelte JSON, sodass neue Saisondaten ohne
-- Redeploy in den Kader-Aufbau fließen.
create table if not exists player_pool (
  season     int  not null,
  id         text not null,
  name       text not null,
  club       text not null,               -- kanonischer Vereinscode ('?' = unbekannt)
  club_name  text not null,
  position   text not null check (position in ('TW','ABW','MF','ST')),
  mv         numeric not null,
  points     int not null default 0,
  exp_points numeric not null default 0,
  has_history boolean,
  updated_at timestamptz not null default now(),
  primary key (season, id)
);
create index if not exists idx_pool_season on player_pool (season);

-- Einzelnutzer-App (Kai): RLS an, anon darf lesen/schreiben.
-- Für Mehrbenutzer später auf auth.uid() umstellen.
alter table squad_players  enable row level security;
alter table matchday_status enable row level security;
alter table news_log        enable row level security;
alter table player_pool     enable row level security;

drop policy if exists "anon all squad"  on squad_players;
drop policy if exists "anon all status" on matchday_status;
drop policy if exists "anon all news"   on news_log;
drop policy if exists "anon all pool"   on player_pool;
create policy "anon all squad"  on squad_players  for all using (true) with check (true);
create policy "anon all status" on matchday_status for all using (true) with check (true);
create policy "anon all news"   on news_log        for all using (true) with check (true);
create policy "anon all pool"   on player_pool     for all using (true) with check (true);
