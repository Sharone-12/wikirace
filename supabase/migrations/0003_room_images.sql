-- Whether articles in a room show their images (the host's choice).
alter table public.rooms
  add column if not exists show_images boolean not null default true;
