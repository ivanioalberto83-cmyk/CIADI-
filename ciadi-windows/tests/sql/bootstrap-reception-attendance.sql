-- PostgreSQL fixture isolated to GitHub Actions; contains no CIADI production data.
DO $
BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$;
DO $
BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$;

create schema if not exists auth;
create schema if not exists public;

create or replace function auth.uid()
returns uuid
language sql
stable
as $auth_uid$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$auth_uid$;

create table public.especialidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem integer not null default 0,
  ativo boolean not null default true
);

create table public.pacientes (
  id uuid primary key default gen_random_uuid(),
  nome_completo text not null,
  nome_responsavel text,
  codigo_paciente text
);

create table public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id),
  data_hora timestamptz not null,
  duracao_minutos integer not null default 45,
  tipo text not null default 'presencial',
  estado text not null,
  checkin_em timestamptz,
  faltou_em timestamptz,
  reagendado_em timestamptz,
  reagendado_de_id uuid references public.agendamentos(id),
  motivo_falta text,
  polo_code text,
  updated_at timestamptz not null default now(),
  atualizado_por uuid
);
