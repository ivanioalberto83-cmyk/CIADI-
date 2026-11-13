-- PROPOSTA APENAS — NÃO APLICAR EM PRODUÇÃO SEM HOMOLOGAÇÃO E AUTORIZAÇÃO.
-- Pedidos de compra passam a ter polo explícito. Registos antigos sem origem inequívoca
-- permanecem sem polo e não são expostos à Recepção até classificação por ADM/Suporte.
alter table ciadi_ti.purchase_requests
  add column if not exists polo_code text;

do $purchase_polo_constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'ciadi_ti.purchase_requests'::regclass
      and conname = 'purchase_requests_polo_code_check'
  ) then
    alter table ciadi_ti.purchase_requests
      add constraint purchase_requests_polo_code_check
      check (polo_code is null or polo_code in ('talatona','jardim_de_rosas'));
  end if;
end;
$purchase_polo_constraint$;

-- Backfill apenas quando todas as recepções existentes do pedido apontam para o mesmo polo.
update ciadi_ti.purchase_requests pr
set polo_code = inferred.polo_code
from (
  select gr.purchase_request_id, min(w.polo) as polo_code
  from ciadi_ti.goods_receipts gr
  join ciadi_ti.warehouses w on w.id = gr.warehouse_id
  where gr.purchase_request_id is not null
  group by gr.purchase_request_id
  having count(distinct w.polo) = 1
) inferred
where pr.id = inferred.purchase_request_id
  and pr.polo_code is null;

create index if not exists purchase_requests_polo_status_idx
  on ciadi_ti.purchase_requests (polo_code, status);

-- Leitura controlada do stock para a Recepção sem criar políticas SELECT abertas nas tabelas.
-- A função valida a sessão e o polo e devolve apenas dados operacionais do polo autorizado.

create or replace function ciadi_ti.reception_get_stock_workspace(p_polo_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti, auth
as $
declare
  v_company_id uuid;
  v_result jsonb;
begin
  select e.id into v_company_id
  from public.finance_empresas e
  where e.ativo = true and e.empresa_principal = true
  order by e.created_at
  limit 1;

  if auth.uid() is null or not ciadi_ti.has_reception_operation_access(p_polo_code) then
    raise exception 'Sem autorização para consultar o stock deste polo.' using errcode = '42501';
  end if;
  if p_polo_code is null or p_polo_code not in ('talatona','jardim_de_rosas') then
    raise exception 'Polo CIADI inválido.' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'poloCode', p_polo_code,
    'canApprove', ciadi_ti.has_finance_approval(),
    'canTransferStock', to_regprocedure('ciadi_ti.post_stock_movement_for_reception(uuid,uuid,text,text,numeric,text,text,numeric,text,text,uuid)') is not null,
    'canFinalizeGoodsReceipt', to_regprocedure('ciadi_ti.post_stock_movement_for_reception(uuid,uuid,text,text,numeric,text,text,numeric,text,text,uuid)') is not null,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'sku', i.sku, 'name', i.name,
        'unit_of_measure', i.unit_of_measure, 'minimum_stock', i.minimum_stock
      ) order by i.name)
      from ciadi_ti.items i
      where i.active = true
    ), '[]'::jsonb),
    'warehouses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id, 'code', w.code, 'name', w.name, 'polo', w.polo
      ) order by w.name)
      from ciadi_ti.warehouses w
      where w.active = true and w.polo = p_polo_code
    ), '[]'::jsonb),
    'costCenters', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'code', c.codigo, 'name', c.nome
      ) order by c.codigo)
      from public.finance_centros_custo c
      where c.ativo = true
        and (c.empresa_id is null or c.empresa_id = v_company_id)
        and upper(btrim(c.codigo)) = case p_polo_code
          when 'talatona' then 'CC-001'
          when 'jardim_de_rosas' then 'CC-002'
          else null
        end
    ), '[]'::jsonb),
    'stockBalances', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_id', b.item_id, 'sku', b.sku, 'item_name', b.item_name,
        'unit_of_measure', b.unit_of_measure, 'minimum_stock', b.minimum_stock,
        'warehouse_id', b.warehouse_id, 'warehouse_code', b.warehouse_code,
        'warehouse_name', b.warehouse_name, 'quantity_on_hand', b.quantity_on_hand,
        'below_minimum', b.below_minimum
      ) order by b.item_name, b.warehouse_name)
      from ciadi_ti.stock_balances b
      join ciadi_ti.warehouses w on w.id = b.warehouse_id
      where w.polo = p_polo_code
    ), '[]'::jsonb),
    'requisitions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'request_number', r.request_number, 'polo_code', r.polo_code,
        'warehouse_id', r.warehouse_id, 'cost_center_id', r.cost_center_id,
        'purpose', r.purpose, 'priority', r.priority, 'status', r.status,
        'requested_by', r.requested_by, 'approved_by', r.approved_by,
        'approved_at', r.approved_at, 'decision_note', r.decision_note,
        'created_at', r.created_at,
        'lines', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', l.id, 'item_id', l.item_id, 'item_name', i.name,
            'sku', i.sku, 'quantity_requested', l.quantity_requested,
            'quantity_approved', l.quantity_approved,
            'quantity_issued', l.quantity_issued,
            'unit_of_measure', l.unit_of_measure, 'notes', l.notes
          ) order by i.name)
          from ciadi_ti.stock_requisition_lines l
          join ciadi_ti.items i on i.id = l.item_id
          where l.requisition_id = r.id
        ), '[]'::jsonb)
      ) order by r.created_at desc)
      from ciadi_ti.stock_requisitions r
      where r.polo_code = p_polo_code
    ), '[]'::jsonb),
    'purchaseRequests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'request_number', r.request_number, 'polo_code', r.polo_code,
        'status', r.status, 'justification', r.justification, 'estimated_total', r.estimated_total,
        'supplier_id', r.supplier_id, 'supplier_name', s.name,
        'created_at', r.created_at,
        'lines', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', l.id, 'item_id', l.item_id, 'description', l.description,
            'quantity', l.quantity, 'unit_of_measure', l.unit_of_measure,
            'estimated_unit_cost', l.estimated_unit_cost,
            'already_received_quantity', coalesce((
              select sum(grl.received_quantity)
              from ciadi_ti.goods_receipt_lines grl
              join ciadi_ti.goods_receipts gr on gr.id = grl.receipt_id
              where grl.purchase_request_line_id = l.id
                and gr.status <> 'cancelled'
            ), 0)
          ) order by l.id)
          from ciadi_ti.purchase_request_lines l
          where l.request_id = r.id
        ), '[]'::jsonb)
      ) order by r.created_at desc)
      from ciadi_ti.purchase_requests r
      left join ciadi_ti.suppliers s on s.id = r.supplier_id
      where r.status = 'approved'
        and r.polo_code = p_polo_code
        and exists (
          select 1 from ciadi_ti.purchase_request_lines l
          where l.request_id = r.id and l.item_id is not null
        )
    ), '[]'::jsonb),
    'goodsReceipts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'receipt_number', r.receipt_number,
        'purchase_request_id', r.purchase_request_id,
        'warehouse_id', r.warehouse_id, 'warehouse_name', w.name,
        'delivery_reference', r.delivery_reference, 'delivery_date', r.delivery_date,
        'status', r.status, 'notes', r.notes, 'created_at', r.created_at,
        'lines', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', l.id, 'purchase_request_line_id', l.purchase_request_line_id,
            'item_id', l.item_id, 'received_quantity', l.received_quantity,
            'accepted_quantity', l.accepted_quantity, 'damaged_quantity', l.damaged_quantity,
            'returned_quantity', l.returned_quantity, 'unit_cost', l.unit_cost,
            'lot_code', l.lot_code, 'notes', l.notes
          ) order by l.id)
          from ciadi_ti.goods_receipt_lines l
          where l.receipt_id = r.id
        ), '[]'::jsonb)
      ) order by r.created_at desc)
      from ciadi_ti.goods_receipts r
      join ciadi_ti.warehouses w on w.id = r.warehouse_id
      where w.polo = p_polo_code
        and exists (
          select 1 from ciadi_ti.purchase_requests pr
          where pr.id = r.purchase_request_id and pr.polo_code = p_polo_code
        )
    ), '[]'::jsonb),
    'movements', coalesce((
      select jsonb_agg(recent.movement order by recent.created_at desc)
      from (
        select jsonb_build_object(
          'id', m.id, 'item_id', m.item_id, 'item_name', i.name,
          'warehouse_id', m.warehouse_id, 'warehouse_name', w.name,
          'movement_type', m.movement_type, 'quantity_delta', m.quantity_delta,
          'reference', m.reference, 'created_at', m.created_at
        ) as movement, m.created_at
        from ciadi_ti.stock_movements m
        join ciadi_ti.warehouses w on w.id = m.warehouse_id
        join ciadi_ti.items i on i.id = m.item_id
        where w.polo = p_polo_code
        order by m.created_at desc
        limit 50
      ) recent
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function ciadi_ti.reception_get_stock_workspace(text) from public, anon;
grant execute on function ciadi_ti.reception_get_stock_workspace(text) to authenticated;
