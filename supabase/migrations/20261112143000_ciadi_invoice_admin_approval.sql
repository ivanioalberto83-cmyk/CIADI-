-- CIADI ERP — Aprovação obrigatória do ADM para alterações/anulações de facturas.
-- Migration preparada em branch. NÃO aplicar em produção sem homologação funcional.
-- O Caixa pode pedir; apenas perfil admin activo pode decidir. O documento original é preservado.

begin;

create schema if not exists ciadi_reception;

create table if not exists ciadi_reception.invoice_change_requests (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.finance_documentos(id) on delete restrict,
  request_type text not null check (request_type in ('alteracao', 'anulacao')),
  reason text not null check (length(trim(reason)) between 10 and 2000),
  requested_changes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(requested_changes) = 'object'),
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovado', 'rejeitado', 'executado')),
  requested_by uuid not null references public.perfis(id) on delete restrict,
  requested_at timestamptz not null default now(),
  decided_by uuid references public.perfis(id) on delete restrict,
  decided_at timestamptz,
  decision_note text,
  executed_at timestamptz,
  executed_by uuid references public.perfis(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_change_decision_consistency check (
    (status = 'pendente' and decided_by is null and decided_at is null)
    or
    (status <> 'pendente' and decided_by is not null and decided_at is not null)
  )
);

create index if not exists invoice_change_requests_status_idx
  on ciadi_reception.invoice_change_requests(status, requested_at desc);
create index if not exists invoice_change_requests_document_idx
  on ciadi_reception.invoice_change_requests(document_id, requested_at desc);

-- A restrição única fecha a condição de corrida entre pedidos simultâneos.
create unique index if not exists invoice_change_requests_one_pending_per_document
  on ciadi_reception.invoice_change_requests(document_id)
  where status = 'pendente';

alter table ciadi_reception.invoice_change_requests enable row level security;

grant usage on schema ciadi_reception to authenticated;

drop policy if exists invoice_change_requests_read_own_or_adm
  on ciadi_reception.invoice_change_requests;
create policy invoice_change_requests_read_own_or_adm
  on ciadi_reception.invoice_change_requests
  for select to authenticated
  using (
    requested_by = auth.uid()
    or exists (
      select 1 from public.perfis p
      where p.id = auth.uid() and p.ativo is true and p.tipo = 'admin'
    )
  );

revoke all on ciadi_reception.invoice_change_requests from anon, authenticated;
grant select on ciadi_reception.invoice_change_requests to authenticated;

-- Regista pedidos sem permitir que o Caixa altere directamente a factura.
create or replace function public.ciadi_reception_request_invoice_change(
  p_document_id uuid,
  p_request_type text,
  p_reason text,
  p_requested_changes jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_reception
as $$
declare
  v_request_id uuid;
  v_profile public.perfis%rowtype;
begin
  select * into v_profile
  from public.perfis
  where id = auth.uid() and ativo is true;

  if not found or v_profile.tipo not in ('operador', 'admin') then
    raise exception 'Sem permissão para solicitar alteração de factura';
  end if;

  if p_request_type not in ('alteracao', 'anulacao') then
    raise exception 'Tipo de pedido inválido';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'Indique um motivo com pelo menos 10 caracteres';
  end if;

  if jsonb_typeof(coalesce(p_requested_changes, '{}'::jsonb)) <> 'object' then
    raise exception 'As alterações solicitadas devem ser um objecto JSON';
  end if;

  if p_request_type = 'alteracao'
     and length(trim(coalesce(p_requested_changes->>'description', ''))) < 10 then
    raise exception 'Descreva a alteração pretendida com pelo menos 10 caracteres';
  end if;

  if not exists (
    select 1 from public.finance_documentos d
    where d.id = p_document_id
  ) then
    raise exception 'Factura não encontrada';
  end if;

  if exists (
    select 1 from ciadi_reception.invoice_change_requests r
    where r.document_id = p_document_id and r.status = 'pendente'
  ) then
    raise exception 'Já existe um pedido pendente para esta factura';
  end if;

  insert into ciadi_reception.invoice_change_requests
    (document_id, request_type, reason, requested_changes, requested_by)
  values
    (p_document_id, p_request_type, trim(p_reason),
     coalesce(p_requested_changes, '{}'::jsonb), auth.uid())
  returning id into v_request_id;

  return v_request_id;
end;
$$;

-- Decisão exclusiva do ADM. Aprovar não altera nem apaga a factura automaticamente:
-- a execução fiscal deve ser feita pelo procedimento adequado e ficar auditada.
create or replace function public.ciadi_reception_decide_invoice_change(
  p_request_id uuid,
  p_decision text,
  p_decision_note text default null
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_reception
as $$
declare
  v_admin public.perfis%rowtype;
begin
  select * into v_admin
  from public.perfis
  where id = auth.uid() and ativo is true and tipo = 'admin';

  if not found then
    raise exception 'Apenas o ADM activo pode aprovar ou rejeitar pedidos';
  end if;

  if p_decision not in ('aprovado', 'rejeitado') then
    raise exception 'Decisão inválida';
  end if;

  update ciadi_reception.invoice_change_requests
  set status = p_decision,
      decided_by = auth.uid(),
      decided_at = now(),
      decision_note = nullif(trim(coalesce(p_decision_note, '')), ''),
      updated_at = now()
  where id = p_request_id and status = 'pendente';

  if not found then
    raise exception 'Pedido inexistente ou já decidido';
  end if;
end;
$$;

revoke all on function public.ciadi_reception_request_invoice_change(uuid,text,text,jsonb) from public, anon;
revoke all on function public.ciadi_reception_decide_invoice_change(uuid,text,text) from public, anon;
grant execute on function public.ciadi_reception_request_invoice_change(uuid,text,text,jsonb) to authenticated;
grant execute on function public.ciadi_reception_decide_invoice_change(uuid,text,text) to authenticated;

-- Não instalar um segundo trigger de UPDATE sobre finance_documentos.
-- A base já possui trg_finance_documentos_immutable, que protege documentos emitidos.
-- A aprovação fica registada nesta tabela; a execução fiscal deve usar o procedimento
-- dedicado de correcção/anulação, sem alterar o documento original nem interferir
-- com os RPCs existentes de emissão e integração AGT.

comment on table ciadi_reception.invoice_change_requests is
  'Pedidos de alteração/anulação de facturas. Apenas ADM activo decide; o documento original nunca é apagado pelo fluxo de pedido.';
comment on function public.ciadi_reception_decide_invoice_change(uuid,text,text) is
  'Decisão exclusiva do ADM. A aprovação não executa automaticamente a alteração fiscal.';

commit;
