-- The host's choice of look for a room, shown to everyone in it.
alter table public.rooms
  add column if not exists theme text not null default 'paper'
  check (theme in ('paper', 'code'));
