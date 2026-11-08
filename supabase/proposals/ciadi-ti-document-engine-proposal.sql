-- CIADI | Suporte Informático
-- PROPOSTA DE MIGRATION — NÃO EXECUTAR EM PRODUÇÃO
-- Preparada após auditoria read-only de 2026-11-08.
-- Depende do schema ciadi_ti e de ciadi_ti.has_support_access().
--
-- Segurança:
--   * bucket privado exclusivo para PDFs do Suporte Informático;
--   * caminhos únicos; nunca usar upsert;
--   * cliente autenticado só lê documentos do módulo e edita rascunhos próprios;
--   * emissão/numeração apenas através de função interna SECURITY DEFINER;
--   * QR público verificado por Edge Function, sem acesso anon às tabelas.

begin;

do $preflight$
begin
  if to_regnamespace('ciadi_ti') is null then
    raise exception 'Schema ciadi_ti não existe; interromper proposta.';
  end if;
  if to_regprocedure('ciadi_ti.has_support_access()') is null then
    raise exception 'Função ciadi_ti.has_support_access() não existe; interromper proposta.';
  end if;
end
$preflight$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ciadi-ti-documentos', 'ciadi-ti-documentos', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

do $bucket_check$
declare
  v_bucket storage.buckets%rowtype;
begin
  select * into v_bucket
  from storage.buckets
  where id = 'ciadi-ti-documentos';

  if not found
     or v_bucket.public is distinct from false
     or v_bucket.file_size_limit is distinct from 10485760
     or not ('application/pdf' = any(coalesce(v_bucket.allowed_mime_types, array[]::text[]))) then
    raise exception 'Bucket ciadi-ti-documentos existe com configuração incompatível; rever manualmente.';
  end if;
end
$bucket_check$;

create table ciadi_ti.documents (
  id uuid primary key default gen_random_uuid(),
  document_type_code text not null
    check (document_type_code ~ '^[A-Z0-9_-]{2,20}$'),
  title text not null check (length(btrim(title)) between 1 and 240),
  status text not null default 'draft' check (status in ('draft', 'issued')),
  document_number text,
  payload jsonb not null default '{}'::jsonb,
  storage_bucket text not null default 'ciadi-ti-documentos'
    check (storage_bucket = 'ciadi-ti-documentos'),
  storage_path text,
  mime_type text,
  file_size_bytes bigint
    check (file_size_bytes is null or file_size_bytes between 1 and 10485760),
  sha256 text
    check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  verification_token_hash text unique
    check (verification_token_hash is null or verification_token_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  issued_by uuid,
  issued_at timestamptz,
  constraint documents_storage_path_prefix
    check (storage_path is null or storage_path like 'suporte-informatica/%'),
  constraint documents_issued_fields check (
    status <> 'issued'
    or (
      document_number is not null
      and storage_path is not null
      and mime_type = 'application/pdf'
      and file_size_bytes is not null
      and sha256 is not null
      and verification_token_hash is not null
      and issued_by is not null
      and issued_at is not null
    )
  )
);

create unique index documents_document_number_uidx
  on ciadi_ti.documents (document_number)
  where document_number is not null;
create index documents_created_by_status_idx
  on ciadi_ti.documents (created_by, status, created_at desc);

create table ciadi_ti.document_sequences (
  document_type_code text not null
    check (document_type_code ~ '^[A-Z0-9_-]{2,20}$'),
  issue_year integer not null check (issue_year between 2020 and 2200),
  last_value bigint not null check (last_value > 0),
  primary key (document_type_code, issue_year)
);

create table ciadi_ti.document_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references ciadi_ti.documents(id) on delete restrict,
  event_type text not null check (
    event_type in ('created', 'issued', 'sent', 'exported', 'viewed', 'verification_attempt', 'voided')
  ),
  actor_id uuid,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index document_events_document_time_idx
  on ciadi_ti.document_events (document_id, occurred_at desc);

-- Short-lived server-issued QR token, prepared before the final PDF is rendered.
-- The clear token is returned once to the authenticated client for QR rendering;
-- only its hash is persisted and it is consumed atomically by issue_document().
create table ciadi_ti.document_issuance_sessions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references ciadi_ti.documents(id) on delete restrict,
  actor_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}
alter table ciadi_ti.documents enable row level security;
alter table ciadi_ti.document_sequences enable row level security;
alter table ciadi_ti.document_events enable row level security;\nalter table ciadi_ti.document_issuance_sessions enable row level security;

create policy ciadi_ti_documents_read
  on ciadi_ti.documents for select to authenticated
  using (ciadi_ti.has_support_access());

create policy ciadi_ti_documents_create_draft
  on ciadi_ti.documents for insert to authenticated
  with check (
    ciadi_ti.has_support_access()
    and created_by = (select auth.uid())
    and status = 'draft'
  );

create policy ciadi_ti_documents_update_own_draft
  on ciadi_ti.documents for update to authenticated
  using (
    ciadi_ti.has_support_access()
    and created_by = (select auth.uid())
    and status = 'draft'
  )
  with check (
    ciadi_ti.has_support_access()
    and created_by = (select auth.uid())
    and status = 'draft'
  );

create policy ciadi_ti_document_events_read
  on ciadi_ti.document_events for select to authenticated
  using (ciadi_ti.has_support_access());

create policy ciadi_ti_storage_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ciadi-ti-documentos'
    and (storage.foldername(name))[1] = 'suporte-informatica'
    and ciadi_ti.has_support_access()
  );

create policy ciadi_ti_storage_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ciadi-ti-documentos'
    and (storage.foldername(name))[1] = 'suporte-informatica'
    and ciadi_ti.has_support_access()
  );

create or replace function ciadi_ti.guard_document_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, ciadi_ti
as $guard$
begin
  if tg_op = 'DELETE' then
    raise exception 'Os registos documentais não podem ser eliminados; use o histórico.';
  end if;

  if old.status = 'issued' then
    raise exception 'Um documento emitido é imutável.';
  end if;

  new.updated_at := now();
  return new;
end
$guard$;

create trigger ciadi_ti_documents_guard_mutation
before update or delete on ciadi_ti.documents
for each row execute function ciadi_ti.guard_document_mutation();

create or replace function ciadi_ti.issue_document(
  p_document_id uuid,
  p_actor_id uuid,
  p_sha256 text,
  p_verification_token_hash text,
  p_file_size_bytes bigint
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, ciadi_ti, public, storage
as $issue$
declare
  v_doc ciadi_ti.documents%rowtype;
  v_year integer := extract(year from (now() at time zone 'Africa/Luanda'))::integer;
  v_next bigint;
  v_number text;
  v_path text;\n  v_session_id uuid;
begin
  if p_actor_id is null
     or not exists (
       select 1
       from public.perfis p
       where p.id = p_actor_id
         and p.ativo is true
         and p.tipo in ('admin', 'gestor', 'suporte_informatica')
     ) then
    raise exception 'Perfil activo sem acesso ao Suporte Informático.';
  end if;

  if p_sha256 is null
     or p_sha256 !~ '^[a-f0-9]{64}$'
     or p_verification_token_hash is null
     or p_verification_token_hash !~ '^[a-f0-9]{64}$'
     or p_file_size_bytes is null
     or p_file_size_bytes not between 1 and 10485760 then
    raise exception 'Metadados PDF ou hashes inválidos.';
  end if;

  select *
  into v_doc
  from ciadi_ti.documents
  where id = p_document_id
  for update;

  if not found or v_doc.status <> 'draft' then
    raise exception 'Documento inexistente ou já emitido.';
  end if;

  select s.id
  into v_session_id
  from ciadi_ti.document_issuance_sessions s
  where s.document_id = v_doc.id
    and s.actor_id = p_actor_id
    and s.token_hash = p_verification_token_hash
    and s.expires_at > now()
    and s.consumed_at is null
  for update;

  if not found then
    raise exception 'Sessão de emissão inválida, expirada ou já consumida.';
  end if;

  v_path := 'suporte-informatica/' || v_doc.id::text || '.pdf';

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'ciadi-ti-documentos'
      and o.name = v_path
      and o.metadata ->> 'mimetype' = 'application/pdf'
  ) then
    raise exception 'O PDF não foi encontrado no arquivo privado ou não é PDF.';
  end if;

  insert into ciadi_ti.document_sequences (document_type_code, issue_year, last_value)
  values (v_doc.document_type_code, v_year, 1)
  on conflict (document_type_code, issue_year)
  do update set last_value = ciadi_ti.document_sequences.last_value + 1
  returning last_value into v_next;

  v_number := 'SUP-' || v_doc.document_type_code || '/' ||
    v_year::text || '/' || lpad(v_next::text, 6, '0');

  update ciadi_ti.documents
  set status = 'issued',
      document_number = v_number,
      storage_path = v_path,
      mime_type = 'application/pdf',
      file_size_bytes = p_file_size_bytes,
      sha256 = p_sha256,
      verification_token_hash = p_verification_token_hash,
      issued_by = p_actor_id,
      issued_at = now(),
      updated_at = now()
  where id = v_doc.id;

  update ciadi_ti.document_issuance_sessions
  set consumed_at = now()
  where id = v_session_id;

  insert into ciadi_ti.document_events (document_id, event_type, actor_id, details)
  values (
    v_doc.id,
    'issued',
    p_actor_id,
    jsonb_build_object('document_number', v_number, 'sha256', p_sha256, 'storage_path', v_path)
  );

  return v_number;
end
$issue$;

revoke all on function ciadi_ti.issue_document(uuid, uuid, text, text, bigint) from public;
revoke all on function ciadi_ti.issue_document(uuid, uuid, text, text, bigint) from anon;
revoke all on function ciadi_ti.issue_document(uuid, uuid, text, text, bigint) from authenticated;
grant execute on function ciadi_ti.issue_document(uuid, uuid, text, text, bigint) to service_role;

revoke all on ciadi_ti.documents from anon;
revoke all on ciadi_ti.document_sequences from anon, authenticated;
revoke all on ciadi_ti.document_events from anon;\nrevoke all on ciadi_ti.document_issuance_sessions from anon, authenticated;
grant usage on schema ciadi_ti to authenticated, service_role;
grant select, insert, update on ciadi_ti.documents to authenticated;
grant select on ciadi_ti.document_events to authenticated;

-- The trusted Edge Functions use service_role for verification lookups and
-- server-written audit events. Do not grant service_role direct UPDATE/DELETE
-- on documents; issuance remains behind issue_document().
grant select on ciadi_ti.documents to service_role;
grant select, insert on ciadi_ti.document_events to service_role;\ngrant select, insert, update on ciadi_ti.document_issuance_sessions to service_role;

commit;

-- VALIDAÇÕES OBRIGATÓRIAS ANTES DE QUALQUER APLICAÇÃO:
-- 1. Confirmar metadata.mimetype na versão Storage do projecto.
-- 2. A Edge Function deve usar Storage .info(path) e validar contentType e
--    tamanho real (1..10 MiB); não confiar em tamanho enviado pelo browser.
-- 3. Testar RLS com Suporte, Administração, Gestão e utilizador sem perfil.
-- 4. Implementar Edge Functions autenticada de upload/emissão e verificação QR.
-- 5. A verificação pública deve devolver apenas campos allowlisted, nunca
--    payload, hashes, storage_path, PDF ou dados pessoais do autor.
-- 6. Executar advisors, testes de concorrência, imutabilidade e revisão de segurança.
),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  check (expires_at > created_at)
);
create index document_issuance_sessions_lookup_idx
  on ciadi_ti.document_issuance_sessions (document_id, actor_id, expires_at desc)
  where consumed_at is null;

alter table ciadi_ti.documents enable row level security;
alter table ciadi_ti.document_sequences enable row level security;
alter table ciadi_ti.document_events enable row level security;

create policy ciadi_ti_documents_read
  on ciadi_ti.documents for select to authenticated
  using (ciadi_ti.has_support_access());

create policy ciadi_ti_documents_create_draft
  on ciadi_ti.documents for insert to authenticated
  with check (
    ciadi_ti.has_support_access()
    and created_by = (select auth.uid())
    and status = 'draft'
  );

create policy ciadi_ti_documents_update_own_draft
  on ciadi_ti.documents for update to authenticated
  using (
    ciadi_ti.has_support_access()
    and created_by = (select auth.uid())
    and status = 'draft'
  )
  with check (
    ciadi_ti.has_support_access()
    and created_by = (select auth.uid())
    and status = 'draft'
  );

create policy ciadi_ti_document_events_read
  on ciadi_ti.document_events for select to authenticated
  using (ciadi_ti.has_support_access());

create policy ciadi_ti_storage_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ciadi-ti-documentos'
    and (storage.foldername(name))[1] = 'suporte-informatica'
    and ciadi_ti.has_support_access()
  );

create policy ciadi_ti_storage_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ciadi-ti-documentos'
    and (storage.foldername(name))[1] = 'suporte-informatica'
    and ciadi_ti.has_support_access()
  );

create or replace function ciadi_ti.guard_document_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, ciadi_ti
as $guard$
begin
  if tg_op = 'DELETE' then
    raise exception 'Os registos documentais não podem ser eliminados; use o histórico.';
  end if;

  if old.status = 'issued' then
    raise exception 'Um documento emitido é imutável.';
  end if;

  new.updated_at := now();
  return new;
end
$guard$;

create trigger ciadi_ti_documents_guard_mutation
before update or delete on ciadi_ti.documents
for each row execute function ciadi_ti.guard_document_mutation();

create or replace function ciadi_ti.issue_document(
  p_document_id uuid,
  p_actor_id uuid,
  p_sha256 text,
  p_verification_token_hash text,
  p_file_size_bytes bigint
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, ciadi_ti, public, storage
as $issue$
declare
  v_doc ciadi_ti.documents%rowtype;
  v_year integer := extract(year from (now() at time zone 'Africa/Luanda'))::integer;
  v_next bigint;
  v_number text;
  v_path text;
begin
  if p_actor_id is null
     or not exists (
       select 1
       from public.perfis p
       where p.id = p_actor_id
         and p.ativo is true
         and p.tipo in ('admin', 'gestor', 'suporte_informatica')
     ) then
    raise exception 'Perfil activo sem acesso ao Suporte Informático.';
  end if;

  if p_sha256 is null
     or p_sha256 !~ '^[a-f0-9]{64}$'
     or p_verification_token_hash is null
     or p_verification_token_hash !~ '^[a-f0-9]{64}$'
     or p_file_size_bytes is null
     or p_file_size_bytes not between 1 and 10485760 then
    raise exception 'Metadados PDF ou hashes inválidos.';
  end if;

  select *
  into v_doc
  from ciadi_ti.documents
  where id = p_document_id
  for update;

  if not found or v_doc.status <> 'draft' then
    raise exception 'Documento inexistente ou já emitido.';
  end if;

  v_path := 'suporte-informatica/' || v_doc.id::text || '.pdf';

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'ciadi-ti-documentos'
      and o.name = v_path
      and o.metadata ->> 'mimetype' = 'application/pdf'
  ) then
    raise exception 'O PDF não foi encontrado no arquivo privado ou não é PDF.';
  end if;

  insert into ciadi_ti.document_sequences (document_type_code, issue_year, last_value)
  values (v_doc.document_type_code, v_year, 1)
  on conflict (document_type_code, issue_year)
  do update set last_value = ciadi_ti.document_sequences.last_value + 1
  returning last_value into v_next;

  v_number := 'SUP-' || v_doc.document_type_code || '/' ||
    v_year::text || '/' || lpad(v_next::text, 6, '0');

  update ciadi_ti.documents
  set status = 'issued',
      document_number = v_number,
      storage_path = v_path,
      mime_type = 'application/pdf',
      file_size_bytes = p_file_size_bytes,
      sha256 = p_sha256,
      verification_token_hash = p_verification_token_hash,
      issued_by = p_actor_id,
      issued_at = now(),
      updated_at = now()
  where id = v_doc.id;

  insert into ciadi_ti.document_events (document_id, event_type, actor_id, details)
  values (
    v_doc.id,
    'issued',
    p_actor_id,
    jsonb_build_object('document_number', v_number, 'sha256', p_sha256, 'storage_path', v_path)
  );

  return v_number;
end
$issue$;

revoke all on function ciadi_ti.issue_document(uuid, uuid, text, text, bigint) from public;
revoke all on function ciadi_ti.issue_document(uuid, uuid, text, text, bigint) from anon;
revoke all on function ciadi_ti.issue_document(uuid, uuid, text, text, bigint) from authenticated;
grant execute on function ciadi_ti.issue_document(uuid, uuid, text, text, bigint) to service_role;

revoke all on ciadi_ti.documents from anon;
revoke all on ciadi_ti.document_sequences from anon, authenticated;
revoke all on ciadi_ti.document_events from anon;
grant usage on schema ciadi_ti to authenticated, service_role;
grant select, insert, update on ciadi_ti.documents to authenticated;
grant select on ciadi_ti.document_events to authenticated;

-- The trusted Edge Functions use service_role for verification lookups and
-- server-written audit events. Do not grant service_role direct UPDATE/DELETE
-- on documents; issuance remains behind issue_document().
grant select on ciadi_ti.documents to service_role;
grant select, insert on ciadi_ti.document_events to service_role;

commit;

-- VALIDAÇÕES OBRIGATÓRIAS ANTES DE QUALQUER APLICAÇÃO:
-- 1. Confirmar metadata.mimetype na versão Storage do projecto.
-- 2. A Edge Function deve usar Storage .info(path) e validar contentType e
--    tamanho real (1..10 MiB); não confiar em tamanho enviado pelo browser.
-- 3. Testar RLS com Suporte, Administração, Gestão e utilizador sem perfil.
-- 4. Implementar Edge Functions autenticada de upload/emissão e verificação QR.
-- 5. A verificação pública deve devolver apenas campos allowlisted, nunca
--    payload, hashes, storage_path, PDF ou dados pessoais do autor.
-- 6. Executar advisors, testes de concorrência, imutabilidade e revisão de segurança.
