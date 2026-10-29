-- CIADI — Centro de Suporte Informático e propostas do Agente de IA.
-- Preparação isolada em branch: NÃO aplicar em produção sem backup restaurável verificado,
-- revisão da RLS e autorização explícita para uma janela de mudança.
begin;

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
  proposal_hash text not null,
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
  proposal_hash text not null,
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

  if old.status <> 'awaiting_approval' or new.status not in ('approved', 'rejected', 'blocked') then
    raise exception 'Transição de estado da proposta não permitida.';
  end if;

  return new;
end;
$$;

drop trigger if exists ciadi_support_proposal_immutable on public.ciadi_support_proposals;
create trigger ciadi_support_proposal_immutable
before update on public.ciadi_support_proposals
for each row execute function public.ciadi_support_proposal_guard();

alter table public.ciadi_support_requests enable row level security;
alter table public.ciadi_support_proposals enable row level security;
alter table public.ciadi_support_approvals enable row level security;

drop policy if exists ciadi_support_requests_select_support on public.ciadi_support_requests;
create policy ciadi_support_requests_select_support
  on public.ciadi_support_requests for select to authenticated
  using (public.ciadi_is_support_technician());

drop policy if exists ciadi_support_requests_insert_support on public.ciadi_support_requests;
create policy ciadi_support_requests_insert_support
  on public.ciadi_support_requests for insert to authenticated
  with check (public.ciadi_is_support_technician() and created_by = auth.uid());

-- Todas as decisões de estado são feitas numa única transação no servidor.
-- O mesmo técnico pode aprovar o seu próprio pedido; não se exige um segundo aprovador.
drop policy if exists ciadi_support_requests_update_support on public.ciadi_support_requests;
drop policy if exists ciadi_support_proposals_update_support on public.ciadi_support_proposals;
drop policy if exists ciadi_support_approvals_insert_support on public.ciadi_support_approvals;

drop policy if exists ciadi_support_approvals_select_support on public.ciadi_support_approvals;
create policy ciadi_support_approvals_select_support
  on public.ciadi_support_approvals for select to authenticated
  using (public.ciadi_is_support_technician());

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
     or p_proposal_hash is null or length(trim(p_proposal_hash)) = 0 then
    raise exception 'Pedido, proposta, versão e hash são obrigatórios.';
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

-- A API autenticada pode criar e consultar pedidos/propostas, mas não decidir estados
-- nem inserir decisões diretamente. A função SECURITY DEFINER faz a transação atómica.
revoke update on public.ciadi_support_requests from authenticated;
revoke update on public.ciadi_support_proposals from authenticated;
revoke insert on public.ciadi_support_approvals from authenticated;
grant select, insert on public.ciadi_support_requests to authenticated;
grant select, insert on public.ciadi_support_proposals to authenticated;
grant select on public.ciadi_support_approvals to authenticated;

commit;
