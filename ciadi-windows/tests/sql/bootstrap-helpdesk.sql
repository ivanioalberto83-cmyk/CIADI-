-- Fixture descartável para homologação do Helpdesk CIADI. Sem dados reais.
create extension if not exists pgcrypto;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $authenticated$ begin create role authenticated nologin; exception when duplicate_object then null; end $authenticated$;
do $service_role$ begin create role service_role nologin; exception when duplicate_object then null; end $service_role$;
create schema auth;
create or replace function auth.uid()
returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table auth.users (id uuid primary key);
create table public.perfis (
  id uuid primary key references auth.users(id),
  ativo boolean not null default true,
  tipo text not null
);
create schema ciadi_ti;
create or replace function ciadi_ti.has_support_access()
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid()
      and p.ativo is true
      and p.tipo in ('admin','gestor','suporte_informatica')
  );
$$;
grant usage on schema auth to authenticated, service_role;
grant execute on function auth.uid() to authenticated, service_role;
grant execute on function ciadi_ti.has_support_access() to authenticated;
