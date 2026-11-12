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
create or replace function public.finance_bloquear_alteracao_fiscal()
returns trigger language plpgsql security definer set search_path to 'public'
as $fn$
declare old_core jsonb; new_core jsonb;
begin
  if old.document_status = 'N' or old.fiscal_status = 'emitido' then
    if tg_op = 'DELETE' then raise exception 'Documento fiscal emitido não pode ser eliminado'; end if;
    old_core := to_jsonb(old) - array[
      'updated_at','updated_by','estado_pagamento','agt_submission_status',
      'agt_validation_status','agt_request_id','agt_error','agt_submission_at',
      'agt_submitted_at','fiscal_status','contabilizado_em'
    ];
    new_core := to_jsonb(new) - array[
      'updated_at','updated_by','estado_pagamento','agt_submission_status',
      'agt_validation_status','agt_request_id','agt_error','agt_submission_at',
      'agt_submitted_at','fiscal_status','contabilizado_em'
    ];
    if old_core is distinct from new_core then
      raise exception 'Documento fiscal emitido é imutável; use documento de correcção/anulação';
    end if;
  end if;
  return coalesce(new,old);
end;
$fn$;
create trigger trg_finance_documentos_immutable
before update or delete on public.finance_documentos
for each row execute function public.finance_bloquear_alteracao_fiscal();
grant usage on schema public, auth to authenticated;
grant select on public.perfis to authenticated;
grant execute on function auth.uid() to authenticated;
grant select, insert, update on public.finance_documentos to authenticated;
insert into public.perfis(id,tipo,ativo) values
 ('11111111-1111-4111-8111-111111111111','operador',true),
 ('22222222-2222-4222-8222-222222222222','admin',true);
insert into public.finance_documentos(id,total,document_status,fiscal_status) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',100.00,'N','emitido');
