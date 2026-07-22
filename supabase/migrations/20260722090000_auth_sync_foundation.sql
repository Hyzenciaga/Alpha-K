create table public.devices (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  platform text not null check (platform in ('macos', 'windows', 'linux')),
  app_version text not null check (char_length(app_version) between 1 and 100),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (owner_id, id)
);

create table public.knowledge_refs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  ref_key text not null check (char_length(ref_key) between 1 and 1000),
  kind text not null check (kind in ('rss', 'arxiv', 'url', 'file_hash')),
  source_key text check (source_key is null or char_length(source_key) <= 1000),
  external_id text check (external_id is null or char_length(external_id) <= 2000),
  canonical_url text check (canonical_url is null or char_length(canonical_url) <= 8000),
  content_hash text check (content_hash is null or char_length(content_hash) <= 256),
  title text not null check (char_length(title) between 1 and 4000),
  authors jsonb not null default '[]'::jsonb check (jsonb_typeof(authors) = 'array'),
  published_at timestamptz,
  discovered_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, ref_key),
  unique (owner_id, id)
);

create table public.user_knowledge_states (
  owner_id uuid not null references auth.users(id) on delete cascade,
  knowledge_ref_id uuid not null,
  is_read boolean not null default false,
  is_starred boolean not null default false,
  disposition text check (disposition is null or disposition in ('accepted', 'ignored')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, knowledge_ref_id),
  foreign key (owner_id, knowledge_ref_id)
    references public.knowledge_refs(owner_id, id) on delete cascade
);

create table public.sync_changes (
  sequence bigint generated always as identity primary key,
  id uuid not null default gen_random_uuid() unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('knowledge_ref', 'user_knowledge_state')),
  entity_id uuid not null,
  operation text not null check (operation in ('upsert', 'delete')),
  changed_at timestamptz not null default now()
);

create index knowledge_refs_owner_updated_idx
  on public.knowledge_refs(owner_id, updated_at desc);
create index user_knowledge_states_owner_updated_idx
  on public.user_knowledge_states(owner_id, updated_at desc);
create index sync_changes_owner_sequence_idx
  on public.sync_changes(owner_id, sequence);

create function public.alpha_k_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.alpha_k_record_sync_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  change_owner_id uuid;
  change_entity_id uuid;
begin
  change_owner_id := case when tg_op = 'DELETE' then old.owner_id else new.owner_id end;
  change_entity_id := case
    when tg_table_name = 'knowledge_refs' and tg_op = 'DELETE' then old.id
    when tg_table_name = 'knowledge_refs' then new.id
    when tg_op = 'DELETE' then old.knowledge_ref_id
    else new.knowledge_ref_id
  end;

  insert into public.sync_changes (owner_id, entity_type, entity_id, operation)
  values (
    change_owner_id,
    case when tg_table_name = 'knowledge_refs' then 'knowledge_ref' else 'user_knowledge_state' end,
    change_entity_id,
    case when tg_op = 'DELETE' then 'delete' else 'upsert' end
  );
  return coalesce(new, old);
end;
$$;

create trigger knowledge_refs_set_updated_at
before update on public.knowledge_refs
for each row execute function public.alpha_k_set_updated_at();

create trigger user_knowledge_states_set_updated_at
before update on public.user_knowledge_states
for each row execute function public.alpha_k_set_updated_at();

create trigger knowledge_refs_record_sync_change
after insert or update or delete on public.knowledge_refs
for each row execute function public.alpha_k_record_sync_change();

create trigger user_knowledge_states_record_sync_change
after insert or update or delete on public.user_knowledge_states
for each row execute function public.alpha_k_record_sync_change();

alter table public.devices enable row level security;
alter table public.knowledge_refs enable row level security;
alter table public.user_knowledge_states enable row level security;
alter table public.sync_changes enable row level security;

create policy "devices are private to their owner"
on public.devices for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "knowledge refs are private to their owner"
on public.knowledge_refs for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "knowledge states are private to their owner"
on public.user_knowledge_states for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "users can read their own sync changes"
on public.sync_changes for select to authenticated
using ((select auth.uid()) = owner_id);

revoke all on table public.devices from anon;
revoke all on table public.knowledge_refs from anon;
revoke all on table public.user_knowledge_states from anon;
revoke all on table public.sync_changes from anon;

grant select, insert, update, delete on table public.devices to authenticated;
grant select, insert, update, delete on table public.knowledge_refs to authenticated;
grant select, insert, update, delete on table public.user_knowledge_states to authenticated;
grant select on table public.sync_changes to authenticated;

revoke all on function public.alpha_k_set_updated_at() from public, anon, authenticated;
revoke all on function public.alpha_k_record_sync_change() from public, anon, authenticated;

