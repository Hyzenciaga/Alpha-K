create table public.learning_captures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('link', 'note')),
  title text check (title is null or char_length(title) between 1 and 500),
  note text check (note is null or char_length(note) between 1 and 2000),
  content text not null check (char_length(content) between 1 and 20000),
  normalized_url text check (normalized_url is null or char_length(normalized_url) <= 8000),
  source_host text check (source_host is null or char_length(source_host) between 1 and 255),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'link' and normalized_url is not null and source_host is not null)
    or
    (kind = 'note' and normalized_url is null and source_host is null)
  )
);

create index learning_captures_owner_kind_created_idx
  on public.learning_captures (owner_id, kind, created_at desc);

alter table public.learning_captures enable row level security;

create policy "learning captures are private to their owner"
on public.learning_captures for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create trigger learning_captures_set_updated_at
before update on public.learning_captures
for each row execute function public.alpha_k_set_updated_at();

revoke all on table public.learning_captures from anon;
grant select, insert, update on table public.learning_captures to authenticated;
