-- PROPOSTA APENAS — não executar em produção sem revisão, backup e homologação.
-- CIADI Suporte Informático: recepção/conferência de mercadorias e reconciliação de inventário.
-- Pré-requisitos confirmados na auditoria read-only:
--   ciadi_ti.has_support_access()
--   ciadi_ti.post_stock_movement(uuid,uuid,text,numeric,text,text,numeric,text)
--   ciadi_ti.purchase_requests / purchase_request_lines / stock_movements
--   ciadi_ti.inventory_counts / inventory_count_lines
--   public.perfis(id)
-- Esta proposta não altera a estação Administração nem as permissões actuais.

begin;

create table if not exists ciadi_ti.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number bigint generated always as identity unique,
  purchase_request_id uuid not null references ciadi_ti.purchase_requests(id) on delete restrict,
  supplier_id uuid references ciadi_ti.suppliers(id) on delete restrict,
  warehouse_id uuid not null references ciadi_ti.warehouses(id) on delete restrict,
  delivery_reference text,
  delivery_date date not null default current_date,
  status text not null default 'draft'
    check (status in ('draft','checked','posted','cancelled')),
  notes text,
  created_by uuid not null references public.perfis(id),
  checked_by uuid references public.perfis(id),
  checked_at timestamptz,
  posted_by uuid references public.perfis(id),
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ciadi_ti.goods_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references ciadi_ti.goods_receipts(id) on delete restrict,
  purchase_request_line_id uuid not null references ciadi_ti.purchase_request_lines(id) on delete restrict,
  item_id uuid not null references ciadi_ti.items(id) on delete restrict,
  ordered_quantity numeric(14,3) not null check (ordered_quantity > 0),
  received_quantity numeric(14,3) not null check (received_quantity >= 0),
  accepted_quantity numeric(14,3) not null check (accepted_quantity >= 0),
  damaged_quantity numeric(14,3) not null default 0 check (damaged_quantity >= 0),
  returned_quantity numeric(14,3) not null default 0 check (returned_quantity >= 0),
  unit_cost numeric(14,2) check (unit_cost is null or unit_cost >= 0),
  lot_code text,
  notes text,
  movement_id uuid references ciadi_ti.stock_movements(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (receipt_id, purchase_request_line_id),
  check (accepted_quantity <= received_quantity),
  check (damaged_quantity <= received_quantity),
  check (returned_quantity <= received_quantity),
  check (accepted_quantity + damaged_quantity + returned_quantity <= received_quantity)
);

create index if not exists goods_receipts_request_created_idx
  on ciadi_ti.goods_receipts(purchase_request_id, created_at desc);
create index if not exists goods_receipts_status_created_idx
  on ciadi_ti.goods_receipts(status, created_at desc);
create index if not exists goods_receipt_lines_receipt_idx
  on ciadi_ti.goods_receipt_lines(receipt_id);
create index if not exists goods_receipt_lines_item_idx
  on ciadi_ti.goods_receipt_lines(item_id);

alter table ciadi_ti.goods_receipts enable row level security;
alter table ciadi_ti.goods_receipt_lines enable row level security;

drop policy if exists goods_receipts_select_support on ciadi_ti.goods_receipts;
create policy goods_receipts_select_support
  on ciadi_ti.goods_receipts
  for select to authenticated
  using (ciadi_ti.has_support_access());

drop policy if exists goods_receipt_lines_select_support on ciadi_ti.goods_receipt_lines;
create policy goods_receipt_lines_select_support
  on ciadi_ti.goods_receipt_lines
  for select to authenticated
  using (
    exists (
      select 1 from ciadi_ti.goods_receipts r
      where r.id = receipt_id and ciadi_ti.has_support_access()
    )
  );

-- A escrita das recepções ocorre apenas pelas RPCs transaccionais abaixo.
grant select on ciadi_ti.goods_receipts, ciadi_ti.goods_receipt_lines to authenticated;
revoke insert, update, delete on ciadi_ti.goods_receipts, ciadi_ti.goods_receipt_lines from anon, authenticated;

create or replace function ciadi_ti.record_goods_receipt_audit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, ciadi_ti
as $$
begin
  if auth.uid() is null then
    raise exception 'Auditoria de recepção exige utilizador autenticado.' using errcode = '42501';
  end if;
  insert into ciadi_ti.audit_events(table_name, record_id, action, actor_id)
  values (
    'goods_receipts',
    new.id,
    case when tg_op = 'INSERT' then 'INSERT' else 'UPDATE' end,
    auth.uid()
  );
  return new;
end;
$$;

drop trigger if exists goods_receipts_audit_after_insert on ciadi_ti.goods_receipts;
create trigger goods_receipts_audit_after_insert
after insert on ciadi_ti.goods_receipts
for each row execute function ciadi_ti.record_goods_receipt_audit();

drop trigger if exists goods_receipts_audit_after_status_update on ciadi_ti.goods_receipts;
create trigger goods_receipts_audit_after_status_update
after update of status on ciadi_ti.goods_receipts
for each row when (old.status is distinct from new.status)
execute function ciadi_ti.record_goods_receipt_audit();

revoke all on function ciadi_ti.record_goods_receipt_audit() from public, anon, authenticated;

create or replace function ciadi_ti.create_goods_receipt(
  p_purchase_request_id uuid,
  p_warehouse_id uuid,
  p_delivery_reference text default null,
  p_delivery_date date default current_date,
  p_notes text default null,
  p_lines jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti
as $$
declare
  v_request ciadi_ti.purchase_requests%rowtype;
  v_receipt ciadi_ti.goods_receipts%rowtype;
  v_line jsonb;
  v_request_line ciadi_ti.purchase_request_lines%rowtype;
  v_received numeric(14,3);
  v_accepted numeric(14,3);
  v_damaged numeric(14,3);
  v_returned numeric(14,3);
  v_cost numeric(14,2);
  v_line_id uuid;
begin
  if auth.uid() is null or not ciadi_ti.has_support_access() then
    raise exception 'Acesso não autorizado à recepção de mercadorias.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array' then
    raise exception 'As linhas da recepção devem ser fornecidas numa lista.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_lines) = 0 then
    raise exception 'A recepção deve conter pelo menos uma linha.' using errcode = '22023';
  end if;
  select * into v_request
  from ciadi_ti.purchase_requests
  where id = p_purchase_request_id
  for update;
  if not found or v_request.status <> 'approved' then
    raise exception 'Só é possível receber um pedido de aquisição aprovado.' using errcode = '23514';
  end if;
  if not exists (
    select 1 from ciadi_ti.warehouses
    where id = p_warehouse_id and active = true
  ) then
    raise exception 'Armazém inexistente ou inactivo.' using errcode = '23503';
  end if;

  insert into ciadi_ti.goods_receipts(
    purchase_request_id, supplier_id, warehouse_id, delivery_reference,
    delivery_date, notes, created_by
  ) values (
    v_request.id, v_request.supplier_id, p_warehouse_id,
    nullif(btrim(p_delivery_reference), ''), coalesce(p_delivery_date, current_date),
    nullif(btrim(p_notes), ''), auth.uid()
  ) returning * into v_receipt;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_line_id := nullif(v_line->>'purchase_request_line_id','')::uuid;
    if v_line_id is null then
      raise exception 'Cada linha deve identificar a linha da encomenda.' using errcode = '22023';
    end if;
    select * into v_request_line
    from ciadi_ti.purchase_request_lines
    where id = v_line_id and request_id = v_request.id
    for update;
    if not found or v_request_line.item_id is null then
      raise exception 'Linha da encomenda inexistente ou sem artigo de stock associado.' using errcode = '23503';
    end if;

    v_received := nullif(v_line->>'received_quantity','')::numeric;
    v_accepted := nullif(v_line->>'accepted_quantity','')::numeric;
    v_damaged := coalesce(nullif(v_line->>'damaged_quantity','')::numeric, 0);
    v_returned := coalesce(nullif(v_line->>'returned_quantity','')::numeric, 0);
    v_cost := coalesce(nullif(v_line->>'unit_cost','')::numeric, v_request_line.estimated_unit_cost);
    if v_received is null or v_accepted is null or v_received < 0 or v_accepted < 0 or v_damaged < 0 or v_returned < 0 then
      raise exception 'As quantidades recebida, aceite e danificada devem ser não negativas.' using errcode = '22023';
    end if;
    if v_accepted > v_received or v_damaged > v_received or v_returned > v_received or v_accepted + v_damaged + v_returned > v_received then
      raise exception 'As quantidades aceite, danificada e devolvida não podem exceder a quantidade recebida.' using errcode = '23514';
    end if;
    if v_cost is not null and v_cost < 0 then
      raise exception 'O custo unitário não pode ser negativo.' using errcode = '22023';
    end if;

    insert into ciadi_ti.goods_receipt_lines(
      receipt_id, purchase_request_line_id, item_id, ordered_quantity,
      received_quantity, accepted_quantity, damaged_quantity, returned_quantity, unit_cost,
      lot_code, notes
    ) values (
      v_receipt.id, v_request_line.id, v_request_line.item_id, v_request_line.quantity,
      v_received, v_accepted, v_damaged, v_returned, v_cost,
      nullif(btrim(v_line->>'lot_code'), ''),
      nullif(btrim(v_line->>'notes'), '')
    );
  end loop;

  return jsonb_build_object(
    'id', v_receipt.id,
    'receipt_number', v_receipt.receipt_number,
    'status', v_receipt.status,
    'line_count', jsonb_array_length(p_lines)
  );
end;
$$;

create or replace function ciadi_ti.check_goods_receipt(p_receipt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti
as $$
declare
  v_receipt ciadi_ti.goods_receipts%rowtype;
  v_count integer;
  v_unclassified integer;
begin
  if auth.uid() is null or not ciadi_ti.has_support_access() then
    raise exception 'Acesso não autorizado à conferência de mercadorias.' using errcode = '42501';
  end if;
  select * into v_receipt
  from ciadi_ti.goods_receipts
  where id = p_receipt_id
  for update;
  if not found or v_receipt.status <> 'draft' then
    raise exception 'Recepção inexistente ou fora do estado de rascunho.' using errcode = '23514';
  end if;
  select count(*) into v_count
  from ciadi_ti.goods_receipt_lines
  where receipt_id = v_receipt.id;
  if v_count = 0 then
    raise exception 'Não é possível conferir uma recepção sem linhas.' using errcode = '23514';
  end if;
  select count(*) into v_unclassified
  from ciadi_ti.goods_receipt_lines
  where receipt_id = v_receipt.id
    and accepted_quantity + damaged_quantity + returned_quantity <> received_quantity;
  if v_unclassified > 0 then
    raise exception 'Classifique todas as unidades recebidas como aceites, danificadas ou devolvidas antes da conferência.' using errcode = '23514';
  end if;
  update ciadi_ti.goods_receipts
  set status = 'checked', checked_by = auth.uid(), checked_at = now(), updated_at = now()
  where id = v_receipt.id;
  return jsonb_build_object('receipt_id', v_receipt.id, 'status', 'checked', 'line_count', v_count);
end;
$$;

create or replace function ciadi_ti.finalize_goods_receipt(p_receipt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti
as $$
declare
  v_receipt ciadi_ti.goods_receipts%rowtype;
  v_line ciadi_ti.goods_receipt_lines%rowtype;
  v_movement_id uuid;
  v_movement_ids jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_reference text;
begin
  if auth.uid() is null or not ciadi_ti.has_support_access() then
    raise exception 'Acesso não autorizado à finalização da recepção.' using errcode = '42501';
  end if;
  select * into v_receipt
  from ciadi_ti.goods_receipts
  where id = p_receipt_id
  for update;
  if not found or v_receipt.status <> 'checked' then
    raise exception 'A recepção tem de estar conferida antes da entrada em stock.' using errcode = '23514';
  end if;
  v_reference := 'GR-' || v_receipt.receipt_number::text;

  for v_line in
    select * from ciadi_ti.goods_receipt_lines
    where receipt_id = v_receipt.id and accepted_quantity > 0
    order by item_id, id
  loop
    v_movement_id := ciadi_ti.post_stock_movement(
      v_line.item_id,
      v_receipt.warehouse_id,
      'entrada',
      v_line.accepted_quantity,
      v_reference,
      coalesce(v_line.notes, v_receipt.notes, 'Recepção de mercadorias CIADI'),
      v_line.unit_cost,
      v_line.lot_code
    );
    update ciadi_ti.goods_receipt_lines
    set movement_id = v_movement_id
    where id = v_line.id;
    v_movement_ids := v_movement_ids || jsonb_build_array(v_movement_id);
    v_count := v_count + 1;
  end loop;

  update ciadi_ti.goods_receipts
  set status = 'posted', posted_by = auth.uid(), posted_at = now(), updated_at = now()
  where id = v_receipt.id;

  return jsonb_build_object(
    'receipt_id', v_receipt.id,
    'receipt_number', v_receipt.receipt_number,
    'status', 'posted',
    'movements_created', v_count,
    'movement_ids', v_movement_ids
  );
end;
$$;

create or replace function ciadi_ti.reconcile_inventory_count(p_count_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti
as $$
declare
  v_count ciadi_ti.inventory_counts%rowtype;
  v_line ciadi_ti.inventory_count_lines%rowtype;
  v_movement_id uuid;
  v_movement_ids jsonb := '[]'::jsonb;
  v_created integer := 0;
  v_type text;
  v_reference text;
begin
  if auth.uid() is null or not ciadi_ti.has_support_access() then
    raise exception 'Acesso não autorizado à reconciliação do inventário.' using errcode = '42501';
  end if;
  select * into v_count
  from ciadi_ti.inventory_counts
  where id = p_count_id
  for update;
  if not found or v_count.status <> 'counted' then
    raise exception 'A contagem tem de estar concluída antes da reconciliação.' using errcode = '23514';
  end if;

  v_reference := 'IC-' || v_count.id::text;
  for v_line in
    select * from ciadi_ti.inventory_count_lines
    where count_id = v_count.id and variance <> 0
    order by item_id, id
  loop
    v_type := case when v_line.variance > 0 then 'ajuste_positivo' else 'ajuste_negativo' end;
    v_movement_id := ciadi_ti.post_stock_movement(
      v_line.item_id,
      v_count.warehouse_id,
      v_type,
      abs(v_line.variance),
      v_reference,
      coalesce(v_line.notes, v_count.notes, 'Reconciliação de inventário CIADI'),
      null,
      null
    );
    v_movement_ids := v_movement_ids || jsonb_build_array(v_movement_id);
    v_created := v_created + 1;
  end loop;

  update ciadi_ti.inventory_counts
  set status = 'reconciled', reconciled_by = auth.uid(), reconciled_at = now(), updated_at = now()
  where id = v_count.id;

  return jsonb_build_object(
    'count_id', v_count.id,
    'status', 'reconciled',
    'movements_created', v_created,
    'movement_ids', v_movement_ids
  );
end;
$$;

revoke all on function ciadi_ti.create_goods_receipt(uuid,uuid,text,date,text,jsonb) from public, anon;
revoke all on function ciadi_ti.check_goods_receipt(uuid) from public, anon;
revoke all on function ciadi_ti.finalize_goods_receipt(uuid) from public, anon;
revoke all on function ciadi_ti.reconcile_inventory_count(uuid) from public, anon;
grant execute on function ciadi_ti.create_goods_receipt(uuid,uuid,text,date,text,jsonb) to authenticated;
grant execute on function ciadi_ti.check_goods_receipt(uuid) to authenticated;
grant execute on function ciadi_ti.finalize_goods_receipt(uuid) to authenticated;
grant execute on function ciadi_ti.reconcile_inventory_count(uuid) to authenticated;

comment on table ciadi_ti.goods_receipts is 'Registo formal de recepção, conferência e entrada de mercadorias CIADI.';
comment on table ciadi_ti.goods_receipt_lines is 'Conferência por linha de encomenda; apenas quantidades aceites entram em stock.';
comment on function ciadi_ti.finalize_goods_receipt(uuid) is 'Publica entradas aceites no razão de stock na mesma transacção e impede dupla finalização.';
comment on function ciadi_ti.reconcile_inventory_count(uuid) is 'Publica ajustes de inventário a partir de contagem concluída, numa única transacção.';

commit;
