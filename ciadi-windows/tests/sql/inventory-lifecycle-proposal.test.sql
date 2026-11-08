-- Homologação funcional da proposta em PostgreSQL isolado de CI.
do $$
declare
  v_user uuid := '10000000-0000-4000-8000-000000000001';
  v_supplier uuid := '20000000-0000-4000-8000-000000000001';
  v_warehouse uuid := '30000000-0000-4000-8000-000000000001';
  v_item_a uuid := '40000000-0000-4000-8000-000000000001';
  v_item_b uuid := '40000000-0000-4000-8000-000000000002';
  v_request uuid := '50000000-0000-4000-8000-000000000001';
  v_line uuid := '60000000-0000-4000-8000-000000000001';
  v_receipt uuid;
  v_bad_receipt uuid;
  v_count uuid := '70000000-0000-4000-8000-000000000001';
  v_empty_count uuid := '70000000-0000-4000-8000-000000000002';
  v_result jsonb;
  v_balance numeric;
begin
  perform set_config('request.jwt.claim.sub', v_user::text, false);

  insert into public.perfis(id, ativo, tipo) values (v_user, true, 'suporte_informatica');
  insert into ciadi_ti.suppliers(id, name) values (v_supplier, 'Fornecedor de teste');
  insert into ciadi_ti.warehouses(id, code, name) values (v_warehouse, 'WH-TEST', 'Armazém de homologação');
  insert into ciadi_ti.items(id, sku, name) values
    (v_item_a, 'IT-TEST-A', 'Artigo A'),
    (v_item_b, 'IT-TEST-B', 'Artigo B');
  insert into ciadi_ti.purchase_requests(id, requested_by, supplier_id, status, justification)
  values (v_request, v_user, v_supplier, 'approved', 'Homologação do ciclo de recepção');
  insert into ciadi_ti.purchase_request_lines(id, request_id, item_id, description, quantity, estimated_unit_cost)
  values (v_line, v_request, v_item_a, 'Artigo A', 10, 1000);

  if not ciadi_ti.has_support_access() then
    raise exception 'Perfil de suporte não foi reconhecido pelo helper.';
  end if;

  -- Recepção parcial: 6 aceites, 1 danificada, 1 devolvida; só 6 entram em stock.
  v_result := ciadi_ti.create_goods_receipt(
    v_request, v_warehouse, 'GUIA-CI-001', current_date, 'Recepção parcial',
    jsonb_build_array(jsonb_build_object(
      'purchase_request_line_id', v_line,
      'received_quantity', 8,
      'accepted_quantity', 6,
      'damaged_quantity', 1,
      'returned_quantity', 1,
      'unit_cost', 1000,
      'lot_code', 'LOTE-A'
    ))
  );
  v_receipt := (v_result->>'id')::uuid;
  if v_result->>'status' <> 'draft' then
    raise exception 'A recepção nova não ficou em rascunho.';
  end if;

  v_result := ciadi_ti.check_goods_receipt(v_receipt);
  if v_result->>'status' <> 'checked' then
    raise exception 'A recepção não passou ao estado conferido.';
  end if;

  v_result := ciadi_ti.finalize_goods_receipt(v_receipt);
  if (v_result->>'movements_created')::integer <> 1 then
    raise exception 'A recepção deveria criar exactamente um movimento de stock.';
  end if;
  select coalesce(sum(quantity_delta),0) into v_balance
  from ciadi_ti.stock_movements where item_id = v_item_a and warehouse_id = v_warehouse;
  if v_balance <> 6 then
    raise exception 'Só as 6 unidades aceites deveriam entrar em stock; saldo obtido: %.', v_balance;
  end if;

  -- A mesma recepção não pode ser finalizada duas vezes.
  begin
    perform ciadi_ti.finalize_goods_receipt(v_receipt);
    raise exception 'A dupla finalização deveria ter sido recusada.';
  exception when sqlstate '23514' then
    null;
  end;

  -- Uma recepção não pode ser conferida enquanto houver unidades sem classificação.
  v_result := ciadi_ti.create_goods_receipt(
    v_request, v_warehouse, 'GUIA-CI-002', current_date, 'Conferência incompleta',
    jsonb_build_array(jsonb_build_object(
      'purchase_request_line_id', v_line,
      'received_quantity', 5,
      'accepted_quantity', 4,
      'damaged_quantity', 0,
      'returned_quantity', 0
    ))
  );
  v_bad_receipt := (v_result->>'id')::uuid;
  begin
    perform ciadi_ti.check_goods_receipt(v_bad_receipt);
    raise exception 'A conferência de quantidades não classificadas deveria falhar.';
  exception when sqlstate '23514' then
    null;
  end;

  -- A criação rejeita quantidades classificadas acima do total recebido.
  begin
    perform ciadi_ti.create_goods_receipt(
      v_request, v_warehouse, 'GUIA-CI-003', current_date, 'Quantidades inválidas',
      jsonb_build_array(jsonb_build_object(
        'purchase_request_line_id', v_line,
        'received_quantity', 4,
        'accepted_quantity', 3,
        'damaged_quantity', 1,
        'returned_quantity', 1
      ))
    );
    raise exception 'A criação com quantidades acima do recebido deveria falhar.';
  exception when sqlstate '23514' then
    null;
  end;

  -- Reconciliação com ajuste positivo e negativo na mesma transacção.
  perform ciadi_ti.post_stock_movement(v_item_b, v_warehouse, 'entrada', 5, 'SEED-TEST', 'Saldo inicial', 500, null);
  insert into ciadi_ti.inventory_counts(id, warehouse_id, status, counted_by, counted_at, notes)
  values (v_count, v_warehouse, 'counted', v_user, now(), 'Contagem de homologação');
  insert into ciadi_ti.inventory_count_lines(count_id, item_id, system_quantity, counted_quantity, variance)
  values
    (v_count, v_item_a, 6, 8, 2),
    (v_count, v_item_b, 5, 3, -2);
  v_result := ciadi_ti.reconcile_inventory_count(v_count);
  if (v_result->>'movements_created')::integer <> 2 or v_result->>'status' <> 'reconciled' then
    raise exception 'A reconciliação deveria criar dois ajustes e fechar a contagem.';
  end if;
  select coalesce(sum(quantity_delta),0) into v_balance
  from ciadi_ti.stock_movements where item_id = v_item_a and warehouse_id = v_warehouse;
  if v_balance <> 8 then raise exception 'Saldo final do artigo A deveria ser 8, obtido: %.', v_balance; end if;
  select coalesce(sum(quantity_delta),0) into v_balance
  from ciadi_ti.stock_movements where item_id = v_item_b and warehouse_id = v_warehouse;
  if v_balance <> 3 then raise exception 'Saldo final do artigo B deveria ser 3, obtido: %.', v_balance; end if;

  begin
    perform ciadi_ti.reconcile_inventory_count(v_count);
    raise exception 'A dupla reconciliação deveria ser recusada.';
  exception when sqlstate '23514' then
    null;
  end;

  insert into ciadi_ti.inventory_counts(id, warehouse_id, status, counted_by, counted_at)
  values (v_empty_count, v_warehouse, 'counted', v_user, now());
  begin
    perform ciadi_ti.reconcile_inventory_count(v_empty_count);
    raise exception 'Uma contagem sem linhas não deveria ser reconciliada.';
  exception when sqlstate '23514' then
    null;
  end;

  if (select count(*) from ciadi_ti.audit_events where record_id = v_receipt) <> 3 then
    raise exception 'A recepção deveria produzir eventos de auditoria para criação, conferência e publicação.';
  end if;

  if has_function_privilege('anon', 'ciadi_ti.create_goods_receipt(uuid,uuid,text,date,text,jsonb)', 'EXECUTE') then
    raise exception 'O perfil anon não deve executar a RPC de recepção.';
  end if;
  if not has_function_privilege('authenticated', 'ciadi_ti.create_goods_receipt(uuid,uuid,text,date,text,jsonb)', 'EXECUTE') then
    raise exception 'O perfil authenticated deve executar a RPC de recepção.';
  end if;
end;
$$;

-- Verifica a política RLS de leitura como utilizador autenticado.
set role authenticated;
select count(*) from ciadi_ti.goods_receipts;
select count(*) from ciadi_ti.goods_receipt_lines;
reset role;

select 'CIADI inventory lifecycle SQL homologation: PASS' as result;
