-- Fixture descartável para homologação da Recepção CIADI. Sem dados reais.
create extension if not exists pgcrypto;

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;

create schema auth;
create or replace function auth.uid()
returns uuid
language sql
stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

create table public.especialidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  ordem integer not null default 0
);

create table public.pacientes (
  id uuid primary key default gen_random_uuid(),
  nome_completo text not null,
  codigo_paciente text,
  nome_responsavel text
);

create table public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id),
  data_hora timestamptz not null,
  duracao_minutos integer not null default 60,
  tipo text not null default 'consulta',
  estado text not null default 'agendada',
  modalidade text not null default 'presencial',
  checkin_em timestamptz,
  updated_at timestamptz not null default now(),
  atualizado_por uuid
);
