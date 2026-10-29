-- CIADI — Centro de Suporte Informático e propostas do Agente de IA.
-- Preparação exclusiva em branch de auditoria. NÃO aplicar em produção sem
-- backup restaurável verificado, revisão RLS e autorização explícita.
begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.ciadi_is_support_technician()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.perfis p
    where p.id = auth.uid()
      and p.tipo = 'suporte_informatica'
      and p.ativo is true
  );
$$;

revoke all on function public.ciadi_is_support_technician() from public;
grant execute on function public.ciadi_is_support_technician() to authenticated;

create table if not exists public.ciadi_support_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  impact text not null default 'normal'
    check (impact in ('normal', 'high', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'diagnosed', 'awaiting_approval', 'approved', 'blocked', 'completed', 'failed')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ciadi_support_requests_created_at_idx
  on public.ciadi_support_requests (created_at desc);
create index if not exists ciadi_support_requests_status_idx
  on public.ciadi_support_requests (status);

create table if not exists public.ciadi_support_proposals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.ciadi_support_requests(id) on delete restrict,
  version integer not null check (version > 0),
  proposal jsonb not null,
  proposal_hash text not null check (proposal_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'awaiting_approval'
    check (status in ('awaiting_approval', 'approved', 'rejected', 'blocked')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (request_id, version)
);

create index if not exists ciadi_support_proposals_request_idx
  on public.ciadi_support_proposals (request_id, version desc);

create table if not exists public.ciadi_support_approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.ciadi_support_requests(id) on delete restrict,
  proposal_id uuid not null references public.ciadi_support_proposals(id) on delete restrict,
  proposal_version integer not null check (proposal_version > 0),
  proposal_hash text not null check (proposal_hash ~ '^[0-9a-f]{64}$'),
  decision text not null check (decision in ('approved', 'rejected')),
  approved_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (proposal_id, approved_by)
);

create index if not exists ciadi_support_approvals_proposal_idx
  on public.ciadi_support_approvals (proposal_id, created_at desc);

create or replace function public.ciadi_support_proposal_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.request_id is distinct from old.request_id
     or new.version is distinct from old.version
     or new.proposal is distinct from old.proposal
     or new.proposal_hash is distinct from old.proposal_hash
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'A proposta de suporte é imutável; crie uma nova versão.';
  end if;

  if old.status <> 'awaiting_approval'
     or new.status not in ('approved', 'rejected', 'blocked') then
    raise exception 'Transição de estado da proposta não permitida.';
  end if;
  return new;
end;
$$;

drop trigger if exists ciadi_support_proposal_immutable on public.ciadi_support_proposals;
create trigger ciadi_support_proposal_immutable
before update on public.ciadi_support_proposals
for each row execute function public.ciadi_support_proposal_guard();

create table if not exists public.ciadi_support_executions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.ciadi_support_requests(id) on delete restrict,
  proposal_id uuid not null references public.ciadi_support_proposals(id) on delete restrict,
  proposal_version integer not null check (proposal_version > 0),
  proposal_hash text not null check (proposal_hash ~ '^[0-9a-f]{64}$'),
  action_code text not null check (action_code = 'readonly_validate_proposal'),
  status text not null check (status in ('completed', 'failed', 'blocked')),
  result jsonb not null,
  executed_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (proposal_id)
);

create index if not exists ciadi_support_executions_created_at_idx
  on public.ciadi_support_executions (created_at desc);

alter table public.ciadi_support_requests enable row level security;
alter table public.ciadi_support_proposals enable row level security;
alter table public.ciadi_support_approvals enable row level security;
alter table public.ciadi_support_executions enable row level security;

drop policy if exists ciadi_support_requests_select_support on public.ciadi_support_requests;
create policy ciadi_support_requests_select_support
  on public.ciadi_support_requests for select to authenticated
  using (public.ciadi_is_support_technician());

drop policy if exists ciadi_support_requests_insert_support on public.ciadi_support_requests;
create policy ciadi_support_requests_insert_support
  on public.ciadi_support_requests for insert to authenticated
  with check (public.ciadi_is_support_technician() and created_by = auth.uid());

drop policy if exists ciadi_support_proposals_select_support on public.ciadi_support_proposals;
create policy ciadi_support_proposals_select_support
  on public.ciadi_support_proposals for select to authenticated
  using (public.ciadi_is_support_technician());

drop policy if exists ciadi_support_approvals_select_support on public.ciadi_support_approvals;
create policy ciadi_support_approvals_select_support
  on public.ciadi_support_approvals for select to authenticated
  using (public.ciadi_is_support_technician());

drop policy if exists ciadi_support_executions_select_support on public.ciadi_support_executions;
create policy ciadi_support_executions_select_support
  on public.ciadi_support_executions for select to authenticated
  using (public.ciadi_is_support_technician());

grant select, insert on public.ciadi_support_requests to authenticated;
grant select on public.ciadi_support_proposals to authenticated;
grant select on public.ciadi_support_approvals to authenticated;
grant select on public.ciadi_support_executions to authenticated;
revoke update on public.ciadi_support_requests from authenticated;
revoke delete on public.ciadi_support_requests from authenticated;
revoke insert on public.ciadi_support_proposals from authenticated;
revoke update on public.ciadi_support_proposals from authenticated;
revoke delete on public.ciadi_support_proposals from authenticated;
revoke insert on public.ciadi_support_approvals from authenticated;
revoke update, delete on public.ciadi_support_approvals from authenticated;
revoke insert, update, delete on public.ciadi_support_executions from authenticated;

create or replace function public.ciadi_create_support_proposal(
  p_request_id uuid,
  p_proposal jsonb,
  p_proposal_hash text
)
returns table(new_proposal_id uuid, new_version integer, new_hash text)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_request public.ciadi_support_requests%rowtype;
  v_version integer;
  v_proposal_id uuid;
  v_server_hash text;
begin
  if auth.uid() is null or not public.ciadi_is_support_technician() then
    raise exception 'Apenas um técnico ativo do Suporte Informático pode criar propostas.';
  end if;
  if p_request_id is null or p_proposal is null
     or jsonb_typeof(p_proposal) <> 'object'
     or p_proposal_hash is null
     or p_proposal_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Pedido, objeto da proposta e hash SHA-256 válido são obrigatórios.';
  end if;

  select * into v_request
  from public.ciadi_support_requests
  where id = p_request_id
  for update;
  if not found then
    raise exception 'Pedido de suporte não encontrado.';
  end if;
  if v_request.status not in ('open', 'diagnosed') then
    raise exception 'O pedido não está disponível para receber uma nova proposta.';
  end if;

  -- O hash do navegador é apenas validação de formato. O valor autoritativo
  -- é sempre calculado no servidor sobre a representação JSONB canónica.
  v_server_hash := encode(extensions.digest(convert_to(p_proposal::text, 'UTF8'), 'sha256'), 'hex');

  select coalesce(max(p.version), 0) + 1 into v_version
  from public.ciadi_support_proposals p
  where p.request_id = p_request_id;

  insert into public.ciadi_support_proposals (
    request_id, version, proposal, proposal_hash, status, created_by
  ) values (
    p_request_id, v_version, p_proposal, v_server_hash, 'awaiting_approval', auth.uid()
  )
  returning id into v_proposal_id;

  update public.ciadi_support_requests
  set status = 'awaiting_approval', updated_at = now()
  where id = p_request_id;

  return query select v_proposal_id, v_version, v_server_hash;
end;
$$;

revoke all on function public.ciadi_create_support_proposal(uuid, jsonb, text) from public;
grant execute on function public.ciadi_create_support_proposal(uuid, jsonb, text) to authenticated;

create or replace function public.ciadi_decide_support_proposal(
  p_request_id uuid,
  p_proposal_id uuid,
  p_proposal_version integer,
  p_proposal_hash text,
  p_decision text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_request public.ciadi_support_requests%rowtype;
  v_proposal public.ciadi_support_proposals%rowtype;
  v_approval_id uuid;
begin
  if auth.uid() is null or not public.ciadi_is_support_technician() then
    raise exception 'Apenas um técnico ativo do Suporte Informático pode decidir propostas.';
  end if;
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'Decisão inválida.';
  end if;
  if p_request_id is null or p_proposal_id is null
     or p_proposal_version is null or p_proposal_version < 1
     or p_proposal_hash is null or p_proposal_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Pedido, proposta, versão e hash válidos são obrigatórios.';
  end if;

  select * into v_request
  from public.ciadi_support_requests
  where id = p_request_id
  for update;
  if not found then
    raise exception 'Pedido de suporte não encontrado.';
  end if;

  select * into v_proposal
  from public.ciadi_support_proposals
  where id = p_proposal_id
  for update;
  if not found
     or v_proposal.request_id <> p_request_id
     or v_proposal.version <> p_proposal_version
     or v_proposal.proposal_hash <> p_proposal_hash
     or v_proposal.status <> 'awaiting_approval'
     or v_request.status <> 'awaiting_approval' then
    raise exception 'A proposta mudou, não corresponde ao pedido ou já foi decidida.';
  end if;

  insert into public.ciadi_support_approvals (
    request_id, proposal_id, proposal_version, proposal_hash, decision, approved_by
  ) values (
    p_request_id, p_proposal_id, p_proposal_version, p_proposal_hash, p_decision, auth.uid()
  )
  returning id into v_approval_id;

  update public.ciadi_support_proposals
  set status = p_decision
  where id = p_proposal_id and status = 'awaiting_approval';
  if not found then
    raise exception 'A proposta já foi decidida.';
  end if;

  update public.ciadi_support_requests
  set status = case when p_decision = 'approved' then 'approved' else 'diagnosed' end,
      updated_at = now()
  where id = p_request_id;

  return v_approval_id;
end;
$$;

revoke all on function public.ciadi_decide_support_proposal(uuid, uuid, integer, text, text) from public;
grant execute on function public.ciadi_decide_support_proposal(uuid, uuid, integer, text, text) to authenticated;

create or replace function public.ciadi_execute_approved_support_action(
  p_request_id uuid,
  p_proposal_id uuid,
  p_proposal_version integer,
  p_proposal_hash text,
  p_action_code text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_request public.ciadi_support_requests%rowtype;
  v_proposal public.ciadi_support_proposals%rowtype;
  v_execution public.ciadi_support_executions%rowtype;
  v_result jsonb;
  v_hash text;
  v_valid boolean;
begin
  if auth.uid() is null or not public.ciadi_is_support_technician() then
    raise exception 'Apenas um técnico ativo do Suporte Informático pode executar validações.';
  end if;
  if p_action_code is distinct from 'readonly_validate_proposal' then
    raise exception 'Ação não permitida pelo executor de teste.';
  end if;
  if p_request_id is null or p_proposal_id is null
     or p_proposal_version is null or p_proposal_version < 1
     or p_proposal_hash is null or p_proposal_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Pedido, proposta, versão e hash válidos são obrigatórios.';
  end if;

  select * into v_request
  from public.ciadi_support_requests
  where id = p_request_id
  for update;
  if not found then
    raise exception 'Pedido de suporte não encontrado.';
  end if;

  select * into v_proposal
  from public.ciadi_support_proposals
  where id = p_proposal_id
  for update;
  if not found
     or v_proposal.request_id <> p_request_id
     or v_proposal.version <> p_proposal_version
     or v_proposal.proposal_hash <> p_proposal_hash
     or v_proposal.status <> 'approved'
     or v_request.status <> 'approved' then
    raise exception 'A execução exige a proposta exata, aprovada e ainda válida.';
  end if;

  v_hash := encode(extensions.digest(convert_to(v_proposal.proposal::text, 'UTF8'), 'sha256'), 'hex');
  if v_hash <> v_proposal.proposal_hash then
    raise exception 'A impressão digital da proposta não corresponde ao conteúdo.';
  end if;

  if not exists (
    select 1 from public.ciadi_support_approvals a
    where a.request_id = p_request_id
      and a.proposal_id = p_proposal_id
      and a.proposal_version = p_proposal_version
      and a.proposal_hash = p_proposal_hash
      and a.decision = 'approved'
  ) then
    raise exception 'Não existe aprovação válida para esta versão exata.';
  end if;

  -- Repetir a validação da mesma proposta devolve o resultado anterior.
  select * into v_execution
  from public.ciadi_support_executions
  where proposal_id = p_proposal_id;
  if found then
    return jsonb_build_object(
      'execution_id', v_execution.id,
      'status', v_execution.status,
      'result', v_execution.result,
      'replayed', true
    );
  end if;

  v_valid := coalesce(nullif(trim(v_proposal.proposal->>'summary'), ''), '') <> ''
    and coalesce(nullif(trim(v_proposal.proposal->>'scope'), ''), '') <> ''
    and coalesce(nullif(trim(v_proposal.proposal->>'risk'), ''), '') <> ''
    and coalesce(nullif(trim(v_proposal.proposal->>'verification'), ''), '') <> ''
    and jsonb_typeof(v_proposal.proposal->'tests') = 'array'
    and v_proposal.proposal->>'requires_approval' = 'true';

  v_result := jsonb_build_object(
    'validation', case when v_valid then 'passed' else 'failed' end,
    'checks', jsonb_build_object(
      'hash_matches_content', v_hash = v_proposal.proposal_hash,
      'approval_matches_version', true,
      'summary_present', coalesce(nullif(trim(v_proposal.proposal->>'summary'), ''), '') <> '',
      'scope_present', coalesce(nullif(trim(v_proposal.proposal->>'scope'), ''), '') <> '',
      'risk_present', coalesce(nullif(trim(v_proposal.proposal->>'risk'), ''), '') <> '',
      'verification_present', coalesce(nullif(trim(v_proposal.proposal->>'verification'), ''), '') <> '',
      'tests_is_array', jsonb_typeof(v_proposal.proposal->'tests') = 'array',
      'approval_required', v_proposal.proposal->>'requires_approval' = 'true'
    ),
    'note', 'Validação de estrutura apenas; nenhuma alteração de dados, SQL, ficheiros ou código foi executada.'
  );

  insert into public.ciadi_support_executions (
    request_id, proposal_id, proposal_version, proposal_hash, action_code,
    status, result, executed_by
  ) values (
    p_request_id, p_proposal_id, p_proposal_version, p_proposal_hash,
    'readonly_validate_proposal',
    case when v_valid then 'completed' else 'failed' end,
    v_result, auth.uid()
  )
  returning * into v_execution;

  update public.ciadi_support_requests
  set status = case when v_valid then 'completed' else 'failed' end,
      updated_at = now()
  where id = p_request_id;

  return jsonb_build_object(
    'execution_id', v_execution.id,
    'status', v_execution.status,
    'result', v_execution.result,
    'replayed', false
  );
end;
$$;

revoke all on function public.ciadi_execute_approved_support_action(uuid, uuid, integer, text, text) from public;
grant execute on function public.ciadi_execute_approved_support_action(uuid, uuid, integer, text, text) to authenticated;

commit;
