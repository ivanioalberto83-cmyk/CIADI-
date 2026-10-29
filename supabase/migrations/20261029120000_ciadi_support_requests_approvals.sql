-- CIADI — Centro de Suporte Informático e propostas do Agente de IA.
-- Preparação isolada em branch: NÃO aplicar em produção sem backup restaurável verificado,
-- revisão da RLS e autorização explícita para uma janela de mudança.
begin;

create or replace function public.ciadi_is_support_technician()
returns boolean
language sql
stable
security definer
set search_path = public
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
set search_path = public
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

drop policy if exists ciadi_support_requests_update_support on public.ciadi_support_requests;
create policy ciadi_support_requests_update_support
  on public.ciadi_support_requests for update to authenticated
  using (public.ciadi_is_support_technician())
  with check (public.ciadi_is_support_technician());

drop policy if exists ciadi_support_proposals_select_support on public.ciadi_support_proposals;
create policy ciadi_support_proposals_select_support
  on public.ciadi_support_proposals for select to authenticated
  using (public.ciadi_is_support_technician());

drop policy if exists ciadi_support_proposals_insert_support on public.ciadi_support_proposals;
create policy ciadi_support_proposals_insert_support
  on public.ciadi_support_proposals for insert to authenticated
  with check (public.ciadi_is_support_technician() and created_by = auth.uid());

drop policy if exists ciadi_support_proposals_update_support on public.ciadi_support_proposals;
create policy ciadi_support_proposals_update_support
  on public.ciadi_support_proposals for update to authenticated
  using (public.ciadi_is_support_technician())
  with check (public.ciadi_is_support_technician());

drop policy if exists ciadi_support_approvals_select_support on public.ciadi_support_approvals;
create policy ciadi_support_approvals_select_support
  on public.ciadi_support_approvals for select to authenticated
  using (public.ciadi_is_support_technician());

drop policy if exists ciadi_support_approvals_insert_support on public.ciadi_support_approvals;
create policy ciadi_support_approvals_insert_support
  on public.ciadi_support_approvals for insert to authenticated
  with check (public.ciadi_is_support_technician() and approved_by = auth.uid());

grant select, insert, update on public.ciadi_support_requests to authenticated;
grant select, insert, update on public.ciadi_support_proposals to authenticated;
grant select, insert on public.ciadi_support_approvals to authenticated;

commit;
