-- PostgreSQL harness only. This fixture is NOT a Supabase migration.
-- Creates the minimum Supabase-shaped objects required to parse and exercise
-- the proposal in an isolated PostgreSQL service container.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create schema storage;
create schema ciadi_ti;

grant usage on schema auth, storage, ciadi_ti to anon, authenticated, service_role;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to public;

create table public.perfis (
  id uuid primary key,
  tipo text not null,
  ativo boolean not null default true
);

create or replace function ciadi_ti.has_support_access()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid()
      and p.ativo is true
      and p.tipo in ('admin', 'gestor', 'suporte_informatica')
  )
$$;
grant execute on function ciadi_ti.has_support_access() to public;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(bucket_id, name)
);

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select string_to_array(name, '/')[1:array_length(string_to_array(name, '/'), 1)-1]
$$;

grant usage on schema storage to authenticated;
grant select, insert on storage.objects to authenticated;
