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

create schema ciadi_ti;
create table public.perfis (
  id uuid primary key,
  tipo text not null,
  ativo boolean not null default true
);
create table ciadi_ti.reception_user_polos (
  user_id uuid not null references public.perfis(id) on delete cascade,
  polo_code text not null check (polo_code in ('talatona','jardim_de_rosas')),
  active boolean not null default true,
  primary key(user_id,polo_code)
);
create or replace function ciadi_ti.has_support_access()
returns boolean language sql stable security definer
set search_path=pg_catalog,public,auth
as $function$
  select auth.uid() is not null and exists (
    select 1 from public.perfis p
    where p.id=auth.uid() and p.ativo=true
      and p.tipo in ('admin','gestor','suporte_informatica')
  );
$function$;
create or replace function ciadi_ti.has_reception_operation_access(p_polo_code text)
returns boolean language sql stable security definer
set search_path=pg_catalog,public,ciadi_ti,auth
as $function$
  select auth.uid() is not null
    and p_polo_code in ('talatona','jardim_de_rosas')
    and (
      ciadi_ti.has_support_access()
      or exists (
        select 1 from public.perfis p
        where p.id=auth.uid() and p.ativo=true
          and (
            p.tipo in ('admin','gestor')
            or (p.tipo='operador' and exists (
              select 1 from ciadi_ti.reception_user_polos rup
              where rup.user_id=p.id and rup.polo_code=p_polo_code and rup.active=true
            ))
          )
      )
    );
$function$;
grant usage on schema ciadi_ti to authenticated;
grant execute on function ciadi_ti.has_support_access() to authenticated;
grant execute on function ciadi_ti.has_reception_operation_access(text) to authenticated;

create table public.especialidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  ordem integer not null default 0
);

grant select on public.especialidades to authenticated;

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
