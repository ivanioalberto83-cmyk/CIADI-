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
  updated_at timestamptz not null default now()
);
grant usage on schema public, auth to authenticated;
grant select on public.perfis to authenticated;
grant execute on function auth.uid() to authenticated;
grant select, update on public.finance_documentos to authenticated;
insert into public.perfis(id,tipo,ativo) values
 ('11111111-1111-4111-8111-111111111111','operador',true),
 ('22222222-2222-4222-8222-222222222222','admin',true);
insert into public.finance_documentos(id,total) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',100.00);
