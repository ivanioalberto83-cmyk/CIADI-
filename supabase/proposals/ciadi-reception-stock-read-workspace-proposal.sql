-- PROPOSTA APENAS — NÃO APLICAR EM PRODUÇÃO SEM HOMOLOGAÇÃO E AUTORIZAÇÃO.
-- Leitura controlada do stock para a Recepção sem criar políticas SELECT abertas nas tabelas.
-- A função valida a sessão e o polo e devolve apenas dados operacionais do polo autorizado.

create or replace function ciadi_ti.reception_get_stock_workspace(p_polo_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ciadi_ti, auth
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not ciadi_ti.has_reception_operation_access(p_polo_code) then
    raise exception 'Sem autorização para consultar o stock deste polo.' using errcode = '42501';
  end if;
  if p_polo_code is null or p_polo_code not in ('talatona','jardim_de_rosas') then
    raise exception 'Polo CIADI inválido.' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'poloCode', p_polo_code,
    'canApprove', ciadi_ti.has_finance_approval(),
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
    'movements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'item_id', m.item_id, 'item_name', i.name,
        'warehouse_id', m.warehouse_id, 'warehouse_name', w.name,
        'movement_type', m.movement_type, 'quantity_delta', m.quantity_delta,
        'reference', m.reference, 'created_at', m.created_at
      ) order by m.created_at desc)
      from ciadi_ti.stock_movements m
      join ciadi_ti.warehouses w on w.id = m.warehouse_id
      join ciadi_ti.items i on i.id = m.item_id
      where w.polo = p_polo_code
      limit 50
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function ciadi_ti.reception_get_stock_workspace(text) from public, anon;
grant execute on function ciadi_ti.reception_get_stock_workspace(text) to authenticated;
