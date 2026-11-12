-- PROPOSTA APENAS — NÃO APLICAR EM PRODUÇÃO SEM HOMOLOGAÇÃO E AUTORIZAÇÃO.
-- Corrige duas chamadas que hoje atravessam para helpers exclusivos do Suporte:
--   1) reception_transfer_stock -> transfer_stock (has_support_access)
--   2) finalize_goods_receipt -> post_stock_movement (has_support_access)
-- A Recepção mantém acesso apenas ao polo validado por has_reception_operation_access.

-- Restringe centros de custo e armazéns ao polo indicado no pedido interno.
-- A associação operacional CIADI é CC-001 = Talatona e CC-002 = Jardim de Rosas.
create or replace function ciadi_ti.enforce_reception_stock_requisition_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti
as $
declare
  v_expected_cost_center text;
begin
  if auth.uid() is null or not ciadi_ti.has_reception_operation_access(new.polo_code) then
    raise exception 'Sessão ou acesso ao polo da requisição inválido.' using errcode = '42501';
  end if;
  if new.polo_code not in ('talatona','jardim_de_rosas') then
    raise exception 'Polo inválido para a requisição de stock.' using errcode = '22023';
  end if;

  v_expected_cost_center := case new.polo_code
    when 'talatona' then 'CC-001'
    when 'jardim_de_rosas' then 'CC-002'
  end;

  if not exists (
    select 1 from ciadi_ti.warehouses w
    where w.id = new.warehouse_id and w.active = true and w.polo = new.polo_code
  ) then
    raise exception 'O armazém não pertence ao polo da requisição.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.finance_centros_custo c
    where c.id = new.cost_center_id and c.ativo = true
      and upper(btrim(c.codigo)) = v_expected_cost_center
  ) then
    raise exception 'O centro de custo não corresponde ao polo da requisição.' using errcode = '42501';
  end if;

  return new;
end;
$;

revoke all on function ciadi_ti.enforce_reception_stock_requisition_scope() from public, anon, authenticated;
drop trigger if exists trg_reception_stock_requisition_scope on ciadi_ti.stock_requisitions;
create trigger trg_reception_stock_requisition_scope
before insert or update of polo_code, warehouse_id, cost_center_id
on ciadi_ti.stock_requisitions
for each row execute function ciadi_ti.enforce_reception_stock_requisition_scope();

-- Uma recepção de mercadorias só pode ligar um pedido e um armazém do mesmo polo.
create or replace function ciadi_ti.enforce_goods_receipt_polo_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti
as $
declare
  v_warehouse_polo text;
  v_request_polo text;
begin
  if auth.uid() is null then
    raise exception 'Sessão autenticada obrigatória para a recepção de mercadorias.' using errcode = '42501';
  end if;
  select w.polo into v_warehouse_polo
  from ciadi_ti.warehouses w
  where w.id = new.warehouse_id and w.active = true;

  select pr.polo_code into v_request_polo
  from ciadi_ti.purchase_requests pr
  where pr.id = new.purchase_request_id and pr.status = 'approved';

  if v_warehouse_polo is null or v_request_polo is null
     or v_request_polo not in ('talatona','jardim_de_rosas')
     or v_request_polo <> v_warehouse_polo
     or not ciadi_ti.has_reception_operation_access(v_warehouse_polo) then
    raise exception 'O pedido de compra e o armazém têm de pertencer ao mesmo polo autorizado.' using errcode = '42501';
  end if;

  return new;
end;
$;

revoke all on function ciadi_ti.enforce_goods_receipt_polo_scope() from public, anon, authenticated;
drop trigger if exists trg_goods_receipt_polo_scope on ciadi_ti.goods_receipts;
create trigger trg_goods_receipt_polo_scope
before insert or update of purchase_request_id, warehouse_id
on ciadi_ti.goods_receipts
for each row execute function ciadi_ti.enforce_goods_receipt_polo_scope();

-- O helper interno abaixo não é executável directamente por authenticated.

create or replace function ciadi_ti.post_stock_movement_for_reception(
  p_item_id uuid,
  p_warehouse_id uuid,
  p_polo_code text,
  p_movement_type text,
  p_quantity numeric,
  p_reference text,
  p_notes text,
  p_unit_cost numeric,
  p_lot_code text,
  p_idempotency_key text,
  p_related_movement_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti, auth
as $$
declare
  v_delta numeric(14,3);
  v_balance numeric(14,3);
  v_existing ciadi_ti.stock_movements%rowtype;
  v_id uuid;
begin
  if auth.uid() is null
     or p_polo_code not in ('talatona','jardim_de_rosas')
     or not ciadi_ti.has_reception_operation_access(p_polo_code) then
    raise exception 'Acesso não autorizado ao movimento de stock deste polo.' using errcode = '42501';
  end if;

  if p_movement_type is null or p_movement_type not in (
    'entrada','saida','devolucao_entrada','devolucao_saida',
    'transferencia_entrada','transferencia_saida'
  ) then
    raise exception 'Tipo de movimento não permitido à Recepção.' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity = 'NaN'::numeric
     or p_quantity <= 0 or round(p_quantity,3) <> p_quantity then
    raise exception 'Quantidade de movimento inválida.' using errcode = '22023';
  end if;
  if p_unit_cost is not null and p_unit_cost < 0 then
    raise exception 'O custo unitário não pode ser negativo.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_idempotency_key,''))) not between 8 and 128 then
    raise exception 'Chave idempotente obrigatória.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_item_id::text || ':' || p_warehouse_id::text, 0)
  );

  if not exists (
    select 1 from ciadi_ti.items
    where id = p_item_id and active = true
  ) or not exists (
    select 1 from ciadi_ti.warehouses
    where id = p_warehouse_id and active = true and polo = p_polo_code
  ) then
    raise exception 'Artigo ou armazém inválido para o polo autorizado.' using errcode = '23503';
  end if;

  v_delta := case
    when p_movement_type in ('entrada','devolucao_entrada','transferencia_entrada')
      then p_quantity
    else -p_quantity
  end;

  select * into v_existing
  from ciadi_ti.stock_movements
  where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.item_id = p_item_id
       and v_existing.warehouse_id = p_warehouse_id
       and v_existing.movement_type = p_movement_type
       and v_existing.quantity_delta = v_delta
       and v_existing.related_movement_id is not distinct from p_related_movement_id
       and v_existing.reference is not distinct from nullif(btrim(p_reference),'')
       and v_existing.notes is not distinct from nullif(btrim(p_notes),'')
       and v_existing.unit_cost is not distinct from p_unit_cost
       and v_existing.lot_code is not distinct from nullif(btrim(p_lot_code), '') then
      return v_existing.id;
    end if;
    raise exception 'A chave idempotente já foi utilizada noutro movimento.' using errcode = '23505';
  end if;

  if v_delta < 0 then
    select coalesce(sum(quantity_delta),0) into v_balance
    from ciadi_ti.stock_movements
    where item_id = p_item_id and warehouse_id = p_warehouse_id;
    if v_balance < p_quantity then
      raise exception 'Stock insuficiente. Saldo actual: %, saída solicitada: %.',
        v_balance, p_quantity using errcode = '23514';
    end if;
  end if;

  insert into ciadi_ti.stock_movements(
    item_id, warehouse_id, movement_type, quantity_delta, unit_cost,
    lot_code, reference, notes, related_movement_id, created_by, idempotency_key
  ) values (
    p_item_id, p_warehouse_id, p_movement_type, v_delta, p_unit_cost,
    nullif(btrim(p_lot_code),''), nullif(btrim(p_reference),''),
    nullif(btrim(p_notes),''), p_related_movement_id, auth.uid(), p_idempotency_key
  ) returning id into v_id;

  insert into ciadi_ti.audit_events(table_name,record_id,action,actor_id)
  values ('stock_movements',v_id,'INSERT',auth.uid());

  return v_id;
end;
$$;

revoke all on function ciadi_ti.post_stock_movement_for_reception(
  uuid,uuid,text,text,numeric,text,text,numeric,text,text,uuid
) from public, anon, authenticated;


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
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti, auth
as $$
declare
  v_key text := btrim(coalesce(p_idempotency_key,''));
  v_from ciadi_ti.stock_movements%rowtype;
  v_to ciadi_ti.stock_movements%rowtype;
  v_out_id uuid;
  v_in_id uuid;
  v_first_key text;
  v_second_key text;
begin
  if auth.uid() is null or p_polo_code not in ('talatona','jardim_de_rosas')
     or not ciadi_ti.has_reception_operation_access(p_polo_code) then
    raise exception 'Acesso não autorizado à transferência neste polo.' using errcode = '42501';
  end if;
  if length(v_key) not between 8 and 120 then
    raise exception 'Chave idempotente inválida.' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity = 'NaN'::numeric
     or p_quantity <= 0 or round(p_quantity,3) <> p_quantity then
    raise exception 'Quantidade de transferência inválida.' using errcode = '22023';
  end if;
  if p_from_warehouse_id = p_to_warehouse_id then
    raise exception 'A origem e o destino têm de ser armazéns diferentes.' using errcode = '22023';
  end if;
  if not exists (select 1 from ciadi_ti.items where id=p_item_id and active=true)
     or not exists (
       select 1 from ciadi_ti.warehouses
       where id=p_from_warehouse_id and active=true and polo=p_polo_code
     )
     or not exists (
       select 1 from ciadi_ti.warehouses
       where id=p_to_warehouse_id and active=true and polo=p_polo_code
     ) then
    raise exception 'Artigo ou armazéns inválidos para o polo seleccionado.' using errcode = '42501';
  end if;

  -- Bloqueio ordenado para evitar deadlocks em transferências simultâneas inversas.
  v_first_key := least(p_from_warehouse_id::text,p_to_warehouse_id::text);
  v_second_key := greatest(p_from_warehouse_id::text,p_to_warehouse_id::text);
  perform pg_advisory_xact_lock(hashtextextended(p_item_id::text || ':' || v_first_key,0));
  perform pg_advisory_xact_lock(hashtextextended(p_item_id::text || ':' || v_second_key,0));

  perform pg_advisory_xact_lock(hashtextextended('stock-transfer:' || v_key,0));
  select * into v_from from ciadi_ti.stock_movements where idempotency_key=v_key || ':out';
  select * into v_to from ciadi_ti.stock_movements where idempotency_key=v_key || ':in';
  if v_from.id is not null or v_to.id is not null then
    if v_from.id is not null and v_to.id is not null
       and v_from.item_id=p_item_id and v_to.item_id=p_item_id
       and v_from.warehouse_id=p_from_warehouse_id and v_to.warehouse_id=p_to_warehouse_id
       and v_from.movement_type='transferencia_saida'
       and v_to.movement_type='transferencia_entrada'
       and v_from.quantity_delta=-p_quantity and v_to.quantity_delta=p_quantity
       and v_to.related_movement_id=v_from.id
       and v_from.reference is not distinct from nullif(btrim(p_reference),'')
       and v_to.reference is not distinct from nullif(btrim(p_reference),'')
       and v_from.notes is not distinct from nullif(btrim(p_notes),'')
       and v_to.notes is not distinct from nullif(btrim(p_notes),'')
       and v_from.lot_code is not distinct from nullif(btrim(p_lot_code),'')
       and v_to.lot_code is not distinct from nullif(btrim(p_lot_code),'' ) then
      return jsonb_build_object(
        'out_movement_id',v_from.id,'in_movement_id',v_to.id,'idempotent_replay',true
      );
    end if;
    raise exception 'A chave idempotente já foi utilizada noutra transferência.' using errcode = '23505';
  end if;

  v_out_id := ciadi_ti.post_stock_movement_for_reception(
    p_item_id,p_from_warehouse_id,p_polo_code,'transferencia_saida',
    p_quantity,p_reference,p_notes,null,p_lot_code,v_key || ':out',null
  );
  v_in_id := ciadi_ti.post_stock_movement_for_reception(
    p_item_id,p_to_warehouse_id,p_polo_code,'transferencia_entrada',
    p_quantity,p_reference,p_notes,null,p_lot_code,v_key || ':in',v_out_id
  );

  return jsonb_build_object(
    'out_movement_id',v_out_id,
    'in_movement_id',v_in_id,
    'idempotent_replay',false
  );
end;
$$;


create or replace function ciadi_ti.finalize_goods_receipt(p_receipt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti, auth
as $$
declare
  v_receipt ciadi_ti.goods_receipts%rowtype;
  v_line ciadi_ti.goods_receipt_lines%rowtype;
  v_polo_code text;
  v_movement_id uuid;
  v_movement_ids jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_reference text;
begin
  if auth.uid() is null then
    raise exception 'Sessão autenticada obrigatória.' using errcode = '42501';
  end if;

  select w.polo into v_polo_code
  from ciadi_ti.goods_receipts r
  join ciadi_ti.warehouses w on w.id=r.warehouse_id
  join ciadi_ti.purchase_requests pr
    on pr.id=r.purchase_request_id and pr.polo_code=w.polo
  where r.id=p_receipt_id and w.active=true;
  if not found or v_polo_code not in ('talatona','jardim_de_rosas')
     or not ciadi_ti.has_reception_operation_access(v_polo_code) then
    raise exception 'Acesso não autorizado à finalização da recepção.' using errcode = '42501';
  end if;

  select * into v_receipt
  from ciadi_ti.goods_receipts
  where id=p_receipt_id
  for update;
  if not found or v_receipt.status <> 'checked' then
    raise exception 'A recepção tem de estar conferida antes da entrada em stock.' using errcode = '23514';
  end if;
  if not exists (
    select 1 from ciadi_ti.goods_receipt_lines where receipt_id=v_receipt.id
  ) then
    raise exception 'Não é possível finalizar uma recepção sem linhas.' using errcode = '23514';
  end if;

  v_reference := 'GR-' || v_receipt.receipt_number::text;
  for v_line in
    select * from ciadi_ti.goods_receipt_lines
    where receipt_id=v_receipt.id and accepted_quantity > 0
    order by item_id,id
  loop
    v_movement_id := ciadi_ti.post_stock_movement_for_reception(
      v_line.item_id,
      v_receipt.warehouse_id,
      v_polo_code,
      'entrada',
      v_line.accepted_quantity,
      v_reference,
      coalesce(v_line.notes,v_receipt.notes,'Recepção de mercadorias CIADI'),
      v_line.unit_cost,
      v_line.lot_code,
      'goods-receipt:' || v_receipt.id::text || ':' || v_line.id::text,
      null
    );
    update ciadi_ti.goods_receipt_lines
    set movement_id=v_movement_id
    where id=v_line.id;
    v_movement_ids := v_movement_ids || jsonb_build_array(v_movement_id);
    v_count := v_count + 1;
  end loop;

  update ciadi_ti.goods_receipts
  set status='posted',posted_by=auth.uid(),posted_at=now(),updated_at=now()
  where id=v_receipt.id;

  insert into ciadi_ti.audit_events(table_name,record_id,action,actor_id)
  values ('goods_receipts',v_receipt.id,'UPDATE',auth.uid());

  return jsonb_build_object(
    'receipt_id',v_receipt.id,
    'receipt_number',v_receipt.receipt_number,
    'status','posted',
    'movements_created',v_count,
    'movement_ids',v_movement_ids
  );
end;
$$;

revoke all on function ciadi_ti.reception_transfer_stock(uuid,uuid,uuid,numeric,text,text,text,text,text) from public, anon;
grant execute on function ciadi_ti.reception_transfer_stock(uuid,uuid,uuid,numeric,text,text,text,text,text) to authenticated;
revoke all on function ciadi_ti.finalize_goods_receipt(uuid) from public, anon;
grant execute on function ciadi_ti.finalize_goods_receipt(uuid) to authenticated;

-- A função auxiliar permanece privada; só os wrappers SECURITY DEFINER acima a invocam.
