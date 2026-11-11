-- PROPOSTA APENAS — NÃO EXECUTAR NO SUPABASE REMOTO NESTA FASE.
-- CIADI Recepção: requisição interna de stock, saídas controladas e devoluções.
-- Dependências:
--   1) ciadi_ti.has_reception_operation_access(text) e ciadi_ti.has_finance_approval()
--   2) ciadi_ti.stock_movements / items / warehouses / audit_events
--   3) ciadi-ti-inventory-lifecycle-proposal.sql (goods_receipts / goods_receipt_lines)
--   4) ciadi-ti-purchase-receipt-extension-proposal.sql (idempotency_key em stock_movements)
--
-- A gate de escrita mantém-se limitada a Suporte Informático enquanto a fase de permissões
-- da Recepção não for aprovada. Nenhum EXECUTE é concedido nesta proposta.

begin;

-- Atribuição explícita do operador ao(s) polo(s) da Recepção.
create table if not exists ciadi_ti.reception_user_polos (
  user_id uuid not null references public.perfis(id) on delete cascade,
  polo_code text not null check (polo_code in ('talatona','jardim_de_rosas')),
  active boolean not null default true,
  assigned_by uuid references public.perfis(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,polo_code)
);
alter table ciadi_ti.reception_user_polos enable row level security;
revoke all on table ciadi_ti.reception_user_polos from public,anon,authenticated;

create or replace function ciadi_ti.has_reception_operation_access(p_polo_code text)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public, ciadi_ti, auth
as $
  select auth.uid() is not null
    and p_polo_code in ('talatona','jardim_de_rosas')
    and exists (
      select 1 from public.perfis p
      where p.id = auth.uid() and p.ativo = true
        and (
          p.tipo in ('admin','gestor','suporte_informatica')
          or (p.tipo = 'operador' and exists (
            select 1 from ciadi_ti.reception_user_polos rup
            where rup.user_id = p.id
              and rup.polo_code = p_polo_code
              and rup.active = true
          ))
        )
    );
$;
revoke all on function ciadi_ti.has_reception_operation_access(text) from public,anon;

-- Atribuição/desactivação de polo é uma tarefa de Suporte Informático.
-- O operador não pode atribuir a si próprio nem a terceiros um polo.
create or replace function ciadi_ti.reception_set_user_polo(
  p_user_id uuid,
  p_polo_code text,
  p_active boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti, auth
as $$
begin
  if auth.uid() is null or not ciadi_ti.has_support_access() then
    raise exception 'A gestão de acessos aos polos exige Suporte Informático ou Administração.' using errcode = '42501';
  end if;
  if p_polo_code is null or p_polo_code not in ('talatona','jardim_de_rosas') then
    raise exception 'Polo CIADI inválido.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.perfis
    where id = p_user_id and tipo = 'operador' and ativo = true
  ) then
    raise exception 'Só é possível atribuir polos a contas activas do perfil operador.' using errcode = '22023';
  end if;
  insert into ciadi_ti.reception_user_polos(user_id,polo_code,active,assigned_by,updated_at)
  values (p_user_id,p_polo_code,coalesce(p_active,true),auth.uid(),now())
  on conflict (user_id,polo_code) do update
    set active=excluded.active,assigned_by=excluded.assigned_by,updated_at=now();
  return jsonb_build_object('user_id',p_user_id,'polo_code',p_polo_code,'active',coalesce(p_active,true));
end;
$$;
revoke all on function ciadi_ti.reception_set_user_polo(uuid,text,boolean) from public,anon;
grant execute on function ciadi_ti.reception_set_user_polo(uuid,text,boolean) to authenticated;




create table if not exists ciadi_ti.stock_requisitions (
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated always as identity unique,
  polo_code text not null check (polo_code in ('talatona','jardim_de_rosas')),
  warehouse_id uuid not null references ciadi_ti.warehouses(id) on delete restrict,
  cost_center_id uuid not null references public.finance_centros_custo(id) on delete restrict,
  purpose text not null check (length(btrim(purpose)) >= 10),
  priority text not null default 'normal' check (priority in ('normal','alta','urgente')),
  status text not null default 'draft'
    check (status in ('draft','submitted','approved','rejected','cancelled','partially_fulfilled','fulfilled')),
  requested_by uuid not null references public.perfis(id) on delete restrict,
  approved_by uuid references public.perfis(id) on delete restrict,
  approved_at timestamptz,
  decision_note text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ciadi_ti.stock_requisition_lines (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references ciadi_ti.stock_requisitions(id) on delete restrict,
  item_id uuid not null references ciadi_ti.items(id) on delete restrict,
  quantity_requested numeric(14,3) not null check (quantity_requested > 0),
  quantity_approved numeric(14,3) not null default 0 check (quantity_approved >= 0),
  quantity_issued numeric(14,3) not null default 0 check (quantity_issued >= 0),
  unit_of_measure text not null default 'unidade',
  notes text,
  created_at timestamptz not null default now(),
  check (quantity_issued <= quantity_approved)
);

alter table ciadi_ti.stock_movements
  add column if not exists stock_requisition_id uuid
    references ciadi_ti.stock_requisitions(id) on delete restrict,
  add column if not exists stock_requisition_line_id uuid
    references ciadi_ti.stock_requisition_lines(id) on delete restrict,
  add column if not exists idempotency_key text;

create unique index if not exists stock_movements_idempotency_key_unique
  on ciadi_ti.stock_movements(idempotency_key)
  where idempotency_key is not null;
create index if not exists stock_requisitions_polo_status_created_idx
  on ciadi_ti.stock_requisitions(polo_code,status,created_at desc);
create index if not exists stock_requisition_lines_parent_idx
  on ciadi_ti.stock_requisition_lines(requisition_id);
create index if not exists stock_movements_stock_requisition_idx
  on ciadi_ti.stock_movements(stock_requisition_id,stock_requisition_line_id);

alter table ciadi_ti.stock_requisitions enable row level security;
alter table ciadi_ti.stock_requisition_lines enable row level security;
revoke all on ciadi_ti.stock_requisitions, ciadi_ti.stock_requisition_lines from public, anon, authenticated;

-- Idempotência também na criação da guia de recepção já definida no motor de ciclo de mercadorias.
alter table ciadi_ti.goods_receipts add column if not exists idempotency_key text;
create unique index if not exists goods_receipts_idempotency_key_unique
  on ciadi_ti.goods_receipts(idempotency_key)
  where idempotency_key is not null;

create or replace function ciadi_ti.reception_create_goods_receipt(
  p_purchase_request_id uuid,
  p_warehouse_id uuid,
  p_delivery_reference text,
  p_delivery_date date,
  p_notes text,
  p_lines jsonb,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti, auth
as $$
declare
  v_key text := btrim(coalesce(p_idempotency_key,''));
  v_existing ciadi_ti.goods_receipts%rowtype;
  v_result jsonb;
  v_receipt_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from ciadi_ti.warehouses w
    where w.id = p_warehouse_id and w.active = true
      and ciadi_ti.has_reception_operation_access(w.polo)
  ) then
    raise exception 'A recepção de mercadorias ainda não está autorizada para este perfil.' using errcode = '42501';
  end if;
  if length(v_key) not between 8 and 128 then
    raise exception 'Chave idempotente obrigatória.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('goods-receipt:' || v_key,0));
  select * into v_existing from ciadi_ti.goods_receipts where idempotency_key = v_key;
  if found then
    if v_existing.purchase_request_id = p_purchase_request_id
       and v_existing.warehouse_id = p_warehouse_id
       and v_existing.delivery_reference = btrim(coalesce(p_delivery_reference,'')) then
      return jsonb_build_object('id',v_existing.id,'receipt_number',v_existing.receipt_number,'status',v_existing.status,'idempotent_replay',true);
    end if;
    raise exception 'A chave idempotente já foi utilizada noutra recepção.' using errcode = '23505';
  end if;
  v_result := ciadi_ti.create_goods_receipt(
    p_purchase_request_id,p_warehouse_id,p_delivery_reference,
    coalesce(p_delivery_date,current_date),p_notes,p_lines
  );
  v_receipt_id := (v_result->>'id')::uuid;
  update ciadi_ti.goods_receipts set idempotency_key = v_key where id = v_receipt_id;
  return v_result || jsonb_build_object('idempotency_key',v_key,'idempotent_replay',false);
end;
$$;

create or replace function ciadi_ti.reception_create_stock_requisition(
  p_polo_code text,
  p_warehouse_id uuid,
  p_cost_center_id uuid,
  p_purpose text,
  p_priority text,
  p_idempotency_key text,
  p_lines jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti, auth
as $$
declare
  v_key text := btrim(coalesce(p_idempotency_key,''));
  v_existing ciadi_ti.stock_requisitions%rowtype;
  v_requisition ciadi_ti.stock_requisitions%rowtype;
  v_line jsonb;
  v_item_id uuid;
  v_quantity numeric(14,3);
  v_unit text;
  v_count integer := 0;
begin
  if auth.uid() is null or not ciadi_ti.has_reception_operation_access(p_polo_code) then
    raise exception 'A criação de requisições de stock ainda não está autorizada para este perfil.' using errcode = '42501';
  end if;
  if p_polo_code is null or p_polo_code not in ('talatona','jardim_de_rosas') then
    raise exception 'Polo CIADI inválido.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_purpose,''))) < 10 then
    raise exception 'A finalidade deve ter pelo menos 10 caracteres.' using errcode = '22023';
  end if;
  if p_priority is null or p_priority not in ('normal','alta','urgente') then
    raise exception 'Prioridade inválida.' using errcode = '22023';
  end if;
  if length(v_key) not between 8 and 128 then
    raise exception 'Chave idempotente obrigatória.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A requisição deve conter pelo menos uma linha.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('stock-requisition:' || v_key,0));
  select * into v_existing from ciadi_ti.stock_requisitions where idempotency_key = v_key;
  if found then
    return jsonb_build_object('id',v_existing.id,'request_number',v_existing.request_number,'status',v_existing.status,'idempotent_replay',true);
  end if;
  if not exists(select 1 from ciadi_ti.warehouses where id=p_warehouse_id and active=true and polo=p_polo_code) then
    raise exception 'Armazém activo não corresponde ao polo seleccionado.' using errcode = '23503';
  end if;
  if not exists(select 1 from public.finance_centros_custo where id=p_cost_center_id and ativo=true) then
    raise exception 'Centro de custo inexistente ou inactivo.' using errcode = '23503';
  end if;
  insert into ciadi_ti.stock_requisitions(
    polo_code,warehouse_id,cost_center_id,purpose,priority,requested_by,idempotency_key
  ) values (
    p_polo_code,p_warehouse_id,p_cost_center_id,btrim(p_purpose),p_priority,auth.uid(),v_key
  ) returning * into v_requisition;
  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_item_id := nullif(v_line->>'item_id','')::uuid;
    v_quantity := nullif(v_line->>'quantity_requested','')::numeric;
    v_unit := coalesce(nullif(btrim(v_line->>'unit_of_measure'),''),'unidade');
    if v_item_id is null or v_quantity is null or v_quantity <= 0 or round(v_quantity,3) <> v_quantity then
      raise exception 'Artigo e quantidade positiva até três casas decimais são obrigatórios.' using errcode = '22023';
    end if;
    if not exists(select 1 from ciadi_ti.items where id=v_item_id and active=true) then
      raise exception 'Artigo inexistente ou inactivo.' using errcode = '23503';
    end if;
    insert into ciadi_ti.stock_requisition_lines(
      requisition_id,item_id,quantity_requested,unit_of_measure,notes
    ) values (
      v_requisition.id,v_item_id,v_quantity,v_unit,nullif(btrim(v_line->>'notes'),'')
    );
    v_count := v_count + 1;
  end loop;
  insert into ciadi_ti.audit_events(table_name,record_id,action,actor_id)
  values ('stock_requisitions',v_requisition.id,'INSERT',auth.uid());
  return jsonb_build_object('id',v_requisition.id,'request_number',v_requisition.request_number,'status',v_requisition.status,'line_count',v_count);
end;
$$;

create or replace function ciadi_ti.reception_submit_stock_requisition(p_requisition_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti, auth
as $$
declare
  v_request ciadi_ti.stock_requisitions%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from ciadi_ti.stock_requisitions r
    where r.id = p_requisition_id and r.requested_by = auth.uid()
      and ciadi_ti.has_reception_operation_access(r.polo_code)
  ) then
    raise exception 'A submissão de requisições de stock ainda não está autorizada para este perfil.' using errcode = '42501';
  end if;
  select * into v_request from ciadi_ti.stock_requisitions
  where id=p_requisition_id and requested_by=auth.uid() for update;
  if not found or v_request.status <> 'draft' then
    raise exception 'Requisição inexistente ou fora do estado de rascunho.' using errcode = '55000';
  end if;
  if not exists(select 1 from ciadi_ti.stock_requisition_lines where requisition_id=v_request.id) then
    raise exception 'Não é possível submeter uma requisição sem linhas.' using errcode = '22023';
  end if;
  update ciadi_ti.stock_requisitions set status='submitted',updated_at=now()
  where id=v_request.id returning * into v_request;
  insert into ciadi_ti.audit_events(table_name,record_id,action,actor_id)
  values ('stock_requisitions',v_request.id,'UPDATE',auth.uid());
  return jsonb_build_object('id',v_request.id,'request_number',v_request.request_number,'status',v_request.status);
end;
$$;

create or replace function ciadi_ti.reception_decide_stock_requisition(
  p_requisition_id uuid,
  p_decision text,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti, auth
as $$
declare
  v_request ciadi_ti.stock_requisitions%rowtype;
begin
  if auth.uid() is null or not ciadi_ti.has_finance_approval() then
    raise exception 'A decisão de requisições internas exige Administração (admin/gestor).' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('approved','rejected') then
    raise exception 'Decisão inválida.' using errcode = '22023';
  end if;
  select * into v_request from ciadi_ti.stock_requisitions where id=p_requisition_id for update;
  if not found or v_request.status <> 'submitted' then
    raise exception 'Só podem ser decididas requisições submetidas.' using errcode = '55000';
  end if;
  if p_decision='approved' then
    update ciadi_ti.stock_requisition_lines
    set quantity_approved=quantity_requested
    where requisition_id=v_request.id;
  end if;
  update ciadi_ti.stock_requisitions
  set status=p_decision,approved_by=auth.uid(),approved_at=now(),
      decision_note=nullif(btrim(p_note),''),updated_at=now()
  where id=v_request.id returning * into v_request;
  insert into ciadi_ti.audit_events(table_name,record_id,action,actor_id)
  values ('stock_requisitions',v_request.id,'UPDATE',auth.uid());
  return jsonb_build_object('id',v_request.id,'status',v_request.status);
end;
$$;

create or replace function ciadi_ti.reception_register_stock_exit(
  p_exit_mode text,
  p_item_id uuid,
  p_warehouse_id uuid,
  p_quantity numeric,
  p_request_id uuid default null,
  p_request_line_id uuid default null,
  p_justification text default null,
  p_reference text default null,
  p_idempotency_key text default null,
  p_polo_code text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti, auth
as $$
declare
  v_key text := btrim(coalesce(p_idempotency_key,''));
  v_existing ciadi_ti.stock_movements%rowtype;
  v_request ciadi_ti.stock_requisitions%rowtype;
  v_line ciadi_ti.stock_requisition_lines%rowtype;
  v_balance numeric(14,3);
  v_movement_id uuid;
  v_notes text;
begin
  if auth.uid() is null or not ciadi_ti.has_reception_operation_access(p_polo_code) then
    raise exception 'As saídas de stock ainda não estão autorizadas para este perfil.' using errcode = '42501';
  end if;
  if p_exit_mode is null or p_exit_mode not in ('approved_request','direct_justified') then
    raise exception 'Modo de saída inválido.' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity='NaN'::numeric or p_quantity <= 0 or round(p_quantity,3) <> p_quantity then
    raise exception 'A quantidade deve ser positiva e ter no máximo três casas decimais.' using errcode = '22023';
  end if;
  if length(v_key) not between 8 and 128 then
    raise exception 'Chave idempotente obrigatória.' using errcode = '22023';
  end if;
  if p_exit_mode='direct_justified' and length(btrim(coalesce(p_justification,''))) < 10 then
    raise exception 'A saída directa exige justificação com pelo menos 10 caracteres.' using errcode = '22023';
  end if;
  if p_exit_mode='approved_request' and (p_request_id is null or p_request_line_id is null) then
    raise exception 'A saída por requisição exige uma requisição aprovada e a respectiva linha.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('stock-exit:' || v_key,0));
  select * into v_existing from ciadi_ti.stock_movements where idempotency_key=v_key;
  if found then
    if v_existing.item_id=p_item_id and v_existing.warehouse_id=p_warehouse_id
       and v_existing.movement_type='saida' and v_existing.quantity_delta=-p_quantity
       and v_existing.stock_requisition_id is not distinct from (case when p_exit_mode='approved_request' then p_request_id else null end)
       and v_existing.stock_requisition_line_id is not distinct from (case when p_exit_mode='approved_request' then p_request_line_id else null end) then
      return v_existing.id;
    end if;
    raise exception 'A chave idempotente já foi utilizada noutra saída.' using errcode = '23505';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_item_id::text || ':' || p_warehouse_id::text,0));
  if not exists(select 1 from ciadi_ti.items where id=p_item_id and active=true) then
    raise exception 'Artigo inexistente ou inactivo.' using errcode = '23503';
  end if;
  if not exists(select 1 from ciadi_ti.warehouses where id=p_warehouse_id and active=true and polo=p_polo_code) then
    raise exception 'Armazém inactivo ou fora do polo da Recepção.' using errcode = '23503';
  end if;
  if p_exit_mode='approved_request' then
    select * into v_request from ciadi_ti.stock_requisitions
    where id=p_request_id for update;
    if not found or v_request.status not in ('approved','partially_fulfilled') then
      raise exception 'A requisição interna não está aprovada ou já foi concluída.' using errcode = '55000';
    end if;
    if v_request.warehouse_id<>p_warehouse_id or v_request.polo_code<>p_polo_code then
      raise exception 'A requisição não pertence ao armazém/polo desta operação.' using errcode = '42501';
    end if;
    select * into v_line from ciadi_ti.stock_requisition_lines
    where id=p_request_line_id and requisition_id=v_request.id and item_id=p_item_id for update;
    if not found or v_line.quantity_approved-v_line.quantity_issued < p_quantity then
      raise exception 'A quantidade excede o saldo aprovado da linha da requisição.' using errcode = '23514';
    end if;
    v_notes := 'Saída de stock por requisição interna ' || v_request.request_number::text;
  else
    if p_request_id is not null or p_request_line_id is not null then
      raise exception 'A saída directa não pode incluir uma requisição aprovada.' using errcode = '22023';
    end if;
    v_notes := 'SAÍDA DIRECTA JUSTIFICADA: ' || btrim(p_justification);
  end if;
  select coalesce(sum(quantity_delta),0) into v_balance
  from ciadi_ti.stock_movements where item_id=p_item_id and warehouse_id=p_warehouse_id;
  if v_balance < p_quantity then
    raise exception 'Stock insuficiente. Saldo actual: %, saída solicitada: %.',v_balance,p_quantity using errcode = '23514';
  end if;
  insert into ciadi_ti.stock_movements(
    item_id,warehouse_id,movement_type,quantity_delta,reference,notes,created_by,
    stock_requisition_id,stock_requisition_line_id,idempotency_key
  ) values (
    p_item_id,p_warehouse_id,'saida',-p_quantity,nullif(btrim(p_reference),''),v_notes,auth.uid(),
    case when p_exit_mode='approved_request' then p_request_id else null end,
    case when p_exit_mode='approved_request' then p_request_line_id else null end,
    v_key
  ) returning id into v_movement_id;
  if p_exit_mode='approved_request' then
    update ciadi_ti.stock_requisition_lines set quantity_issued=quantity_issued+p_quantity where id=v_line.id;
    if not exists(
      select 1 from ciadi_ti.stock_requisition_lines
      where requisition_id=v_request.id and quantity_issued<quantity_approved
    ) then
      update ciadi_ti.stock_requisitions set status='fulfilled',updated_at=now() where id=v_request.id;
    else
      update ciadi_ti.stock_requisitions set status='partially_fulfilled',updated_at=now() where id=v_request.id;
    end if;
  end if;
  insert into ciadi_ti.audit_events(table_name,record_id,action,actor_id)
  values ('stock_movements',v_movement_id,'INSERT',auth.uid());
  return v_movement_id;
end;
$$;

create or replace function ciadi_ti.reception_register_stock_return(
  p_item_id uuid,
  p_warehouse_id uuid,
  p_quantity numeric,
  p_return_type text,
  p_reason text,
  p_reference text,
  p_idempotency_key text,
  p_polo_code text
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti, auth
as $$
declare
  v_key text := btrim(coalesce(p_idempotency_key,''));
  v_delta numeric(14,3);
  v_balance numeric(14,3);
  v_existing ciadi_ti.stock_movements%rowtype;
  v_id uuid;
begin
  if auth.uid() is null or not ciadi_ti.has_reception_operation_access(p_polo_code) then
    raise exception 'As devoluções de stock ainda não estão autorizadas para este perfil.' using errcode = '42501';
  end if;
  if p_return_type is null or p_return_type not in ('devolucao_entrada','devolucao_saida') then
    raise exception 'Tipo de devolução inválido.' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity='NaN'::numeric or p_quantity<=0 or round(p_quantity,3)<>p_quantity then
    raise exception 'Quantidade de devolução inválida.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_reason,'')))<10 or length(v_key) not between 8 and 128 then
    raise exception 'Motivo e chave idempotente são obrigatórios.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('stock-return:' || v_key,0));
  select * into v_existing from ciadi_ti.stock_movements where idempotency_key=v_key;
  if found then
    if v_existing.item_id=p_item_id and v_existing.warehouse_id=p_warehouse_id
       and v_existing.movement_type=p_return_type
       and v_existing.quantity_delta=(case when p_return_type='devolucao_entrada' then p_quantity else -p_quantity end) then return v_existing.id; end if;
    raise exception 'Chave idempotente já utilizada noutra devolução.' using errcode = '23505';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_item_id::text || ':' || p_warehouse_id::text,0));
  if not exists(select 1 from ciadi_ti.items where id=p_item_id and active=true)
     or not exists(select 1 from ciadi_ti.warehouses where id=p_warehouse_id and active=true and polo=p_polo_code) then
    raise exception 'Artigo ou armazém inválido para este polo.' using errcode = '23503';
  end if;
  v_delta := case when p_return_type='devolucao_entrada' then p_quantity else -p_quantity end;
  if v_delta<0 then
    select coalesce(sum(quantity_delta),0) into v_balance from ciadi_ti.stock_movements
    where item_id=p_item_id and warehouse_id=p_warehouse_id;
    if v_balance<p_quantity then raise exception 'Stock insuficiente para devolver ao fornecedor.' using errcode = '23514'; end if;
  end if;
  insert into ciadi_ti.stock_movements(
    item_id,warehouse_id,movement_type,quantity_delta,reference,notes,created_by,idempotency_key
  ) values (
    p_item_id,p_warehouse_id,p_return_type,v_delta,nullif(btrim(p_reference),''),
    'DEVOLUÇÃO: ' || btrim(p_reason),auth.uid(),v_key
  ) returning id into v_id;
  insert into ciadi_ti.audit_events(table_name,record_id,action,actor_id)
  values ('stock_movements',v_id,'INSERT',auth.uid());
  return v_id;
end;
$$;

create or replace function ciadi_ti.reception_transfer_stock(
  p_item_id uuid,
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_quantity numeric,
  p_reference text,
  p_notes text,
  p_lot_code text,
  p_idempotency_key text,
  p_polo_code text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti, auth
as $$
declare
  v_key text := btrim(coalesce(p_idempotency_key,''));
  v_from ciadi_ti.stock_movements%rowtype;
  v_to ciadi_ti.stock_movements%rowtype;
  v_result record;
begin
  if auth.uid() is null or not ciadi_ti.has_reception_operation_access(p_polo_code) then
    raise exception 'As transferências de stock ainda não estão autorizadas para este perfil.' using errcode = '42501';
  end if;
  if p_polo_code is null or p_polo_code not in ('talatona','jardim_de_rosas') then
    raise exception 'Polo CIADI inválido.' using errcode = '22023';
  end if;
  if length(v_key) not between 8 and 120 then
    raise exception 'Chave idempotente inválida.' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity='NaN'::numeric or p_quantity<=0 or round(p_quantity,3)<>p_quantity then
    raise exception 'Quantidade de transferência inválida.' using errcode = '22023';
  end if;
  if p_from_warehouse_id=p_to_warehouse_id then
    raise exception 'A origem e o destino têm de ser armazéns diferentes.' using errcode = '22023';
  end if;
  if not exists(select 1 from ciadi_ti.warehouses where id=p_from_warehouse_id and active=true and polo=p_polo_code)
     or not exists(select 1 from ciadi_ti.warehouses where id=p_to_warehouse_id and active=true and polo=p_polo_code) then
    raise exception 'Os dois armazéns têm de estar activos e pertencer ao polo seleccionado.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('stock-transfer:' || v_key,0));
  select * into v_from from ciadi_ti.stock_movements where idempotency_key=v_key || ':out';
  select * into v_to from ciadi_ti.stock_movements where idempotency_key=v_key || ':in';
  if v_from.id is not null or v_to.id is not null then
    if v_from.id is not null and v_to.id is not null
       and v_from.item_id=p_item_id and v_to.item_id=p_item_id
       and v_from.warehouse_id=p_from_warehouse_id and v_to.warehouse_id=p_to_warehouse_id
       and v_from.quantity_delta=-p_quantity and v_to.quantity_delta=p_quantity then
      return jsonb_build_object('out_movement_id',v_from.id,'in_movement_id',v_to.id,'idempotent_replay',true);
    end if;
    raise exception 'A chave idempotente já foi utilizada noutra transferência.' using errcode = '23505';
  end if;
  select * into v_result from ciadi_ti.transfer_stock(
    p_item_id,p_from_warehouse_id,p_to_warehouse_id,p_quantity,p_reference,p_notes,p_lot_code
  );
  update ciadi_ti.stock_movements set idempotency_key=v_key || ':out' where id=v_result.out_movement_id;
  update ciadi_ti.stock_movements set idempotency_key=v_key || ':in' where id=v_result.in_movement_id;
  return jsonb_build_object(
    'out_movement_id',v_result.out_movement_id,
    'in_movement_id',v_result.in_movement_id,
    'idempotent_replay',false
  );
end;
$$;

revoke all on function ciadi_ti.reception_create_goods_receipt(uuid,uuid,text,date,text,jsonb,text) from public,anon;
revoke all on function ciadi_ti.reception_create_stock_requisition(text,uuid,uuid,text,text,text,jsonb) from public,anon;
revoke all on function ciadi_ti.reception_submit_stock_requisition(uuid) from public,anon;
revoke all on function ciadi_ti.reception_decide_stock_requisition(uuid,text,text) from public,anon;
revoke all on function ciadi_ti.reception_register_stock_exit(text,uuid,uuid,numeric,uuid,uuid,text,text,text,text) from public,anon;
revoke all on function ciadi_ti.reception_register_stock_return(uuid,uuid,numeric,text,text,text,text,text) from public,anon;
revoke all on function ciadi_ti.reception_transfer_stock(uuid,uuid,uuid,numeric,text,text,text,text,text) from public,anon;

-- As operações são executáveis apenas por authenticated; cada função valida perfil, polo e estado.
grant execute on function ciadi_ti.reception_create_goods_receipt(uuid,uuid,text,date,text,jsonb,text) to authenticated;
grant execute on function ciadi_ti.reception_create_stock_requisition(text,uuid,uuid,text,text,text,jsonb) to authenticated;
grant execute on function ciadi_ti.reception_submit_stock_requisition(uuid) to authenticated;
grant execute on function ciadi_ti.reception_decide_stock_requisition(uuid,text,text) to authenticated;
grant execute on function ciadi_ti.reception_register_stock_exit(text,uuid,uuid,numeric,uuid,uuid,text,text,text,text) to authenticated;
grant execute on function ciadi_ti.reception_register_stock_return(uuid,uuid,numeric,text,text,text,text,text) to authenticated;
grant execute on function ciadi_ti.reception_transfer_stock(uuid,uuid,uuid,numeric,text,text,text,text,text) to authenticated;

comment on table ciadi_ti.stock_requisitions is 'Requisição interna de artigos de stock por polo, armazém e centro de custo; distinta da compra a fornecedor.';
comment on table ciadi_ti.stock_requisition_lines is 'Linhas aprovadas e expedidas de uma requisição interna de stock.';
comment on function ciadi_ti.reception_register_stock_exit(text,uuid,uuid,numeric,uuid,uuid,text,text,text,text) is 'Regista saída por requisição interna aprovada ou saída directa com justificação obrigatória, com bloqueio de saldo negativo e idempotência.';
comment on function ciadi_ti.reception_register_stock_return(uuid,uuid,numeric,text,text,text,text,text) is 'Regista devolução para stock ou devolução ao fornecedor, sempre com motivo, saldo e idempotência.';
comment on function ciadi_ti.reception_transfer_stock(uuid,uuid,uuid,numeric,text,text,text,text,text) is 'Transfere stock entre armazéns do mesmo polo com duas linhas ligadas e idempotência.';

commit;
