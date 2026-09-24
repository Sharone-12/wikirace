-- WikiRace multiplayer schema.
-- All access goes through the Next.js server using the secret key
-- (service_role) over the Data API. RLS is on with no policies, and only
-- service_role is granted access, so anon/authenticated (the publishable key
-- in browsers) can't read or write any of these tables.

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 20),
  token_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{4}$'),
  host_id uuid not null references public.players (id),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  rounds_total int not null default 5 check (rounds_total between 1 and 10),
  time_limit int not null default 180 check (time_limit between 30 and 600),
  created_at timestamptz not null default now()
);

create table if not exists public.room_players (
  room_id uuid not null references public.rooms (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, player_id)
);
create index if not exists room_players_player_idx on public.room_players (player_id);

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  number int not null,
  start_title text not null,
  target_title text not null,
  target_extract text not null default '',
  time_limit int not null,
  starts_at timestamptz not null,
  status text not null default 'playing' check (status in ('playing', 'closing', 'closed')),
  closing_at timestamptz,
  closed_at timestamptz,
  unique (room_id, number)
);

-- One run per player per round. stack = in-app back stack (titles);
-- path = every article visited [{ title, via, back, t }] where t = ms since start.
create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  stack jsonb not null,
  path jsonb not null,
  clicks int not null default 0,
  status text not null default 'playing'
    check (status in ('playing', 'finished', 'gave_up', 'timed_out')),
  ended_at timestamptz,
  elapsed_ms int,
  score int,
  score_parts jsonb,
  closeness jsonb,
  unique (round_id, player_id)
);
create index if not exists runs_player_idx on public.runs (player_id);

alter table public.players enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.rounds enable row level security;
alter table public.runs enable row level security;

revoke all on public.players, public.rooms, public.room_players, public.rounds, public.runs
  from anon, authenticated;
grant select, insert, update, delete
  on public.players, public.rooms, public.room_players, public.rounds, public.runs
  to service_role;
