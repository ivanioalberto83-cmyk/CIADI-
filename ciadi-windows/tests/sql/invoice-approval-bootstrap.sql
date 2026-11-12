-- Fixture isolada para homologar a migração; nunca aponta para Supabase de produção.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create or replace function auth.uid()
returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.perfis (
  id uuid primary key,
  tipo text not null,
  ativo boolean not null default true
);
create table public.finance_documentos (
  id uuid primary key,
  total numeric(14,2) not null,
  estado_pagamento text not null default 'pendente',
  forma_pagamento text,
  tipo_documento text,
  document_status text,
  fiscal_status text,
  origem_tipo text,
  documento_origem_id uuid,
  hash_documento text,
  hash_algoritmo text,
  updated_by uuid,
  agt_submission_status text,
  agt_validation_status text,
  agt_request_id text,
  agt_error text,
  agt_submission_at timestamptz,
  agt_submitted_at timestamptz,
  contabilizado_em timestamptz,
  updated_at timestamptz not null default now()
);
create table public.finance_pagamentos (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null,
  valor numeric(14,2) not null,
  created_at timestamptz not null default now()
);
create or replace function public.ciadi_finance_can(p_action text)
returns boolean language sql stable security definer
as $fn$ select exists (
  select 1 from public.perfis p
  where p.id=auth.uid() and p.ativo is true and p.tipo in ('admin','operador')
) $fn$;
grant usage on schema public, auth to authenticated;
grant select on public.perfis to authenticated;
grant execute on function auth.uid() to authenticated;
grant select, insert, update on public.finance_documentos to authenticated;
grant insert on public.finance_pagamentos to authenticated;
insert into public.perfis(id,tipo,ativo) values
 ('11111111-1111-4111-8111-111111111111','operador',true),
 ('22222222-2222-4222-8222-222222222222','admin',true);
insert into public.finance_documentos(id,total) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',100.00);
