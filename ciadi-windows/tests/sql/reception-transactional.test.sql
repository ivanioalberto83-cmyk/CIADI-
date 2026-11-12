-- Transactional behaviour tests against an isolated PostgreSQL 16 instance.
-- All identifiers and data below are synthetic and discarded with the CI container.
DO $$
DECLARE
  v_actor uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_item uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_wh_a uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  v_wh_b uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  v_wh_other uuid := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  v_receipt uuid := 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  v_line uuid := '11111111-1111-4111-8111-111111111111';
  v_result jsonb;
  v_id uuid;
  v_balance numeric;
  v_count integer;
  v_state text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
  PERFORM set_config('ciadi.test_allowed_polo','talatona',true);

  INSERT INTO ciadi_ti.items(id,sku,name) VALUES (v_item,'TEST-001','Artigo de teste');
  INSERT INTO ciadi_ti.warehouses(id,code,name,polo) VALUES
    (v_wh_a,'TAL-A','Armazém A','talatona'),
    (v_wh_b,'TAL-B','Armazém B','talatona'),
    (v_wh_other,'ROS-A','Armazém Rosas','jardim_de_rosas');
  INSERT INTO ciadi_ti.stock_movements(
    item_id,warehouse_id,movement_type,quantity_delta,reference,created_by,idempotency_key
  ) VALUES (v_item,v_wh_a,'entrada',10,'SALDO-INICIAL',v_actor,'seed-stock-0001');

  -- Valid transfer: atomic outbound/inbound pair and consistent balance.
  v_result := ciadi_ti.reception_transfer_stock(
    v_item,v_wh_a,v_wh_b,3,'TRF-001','teste transaccional',null,'transfer-key-001','talatona'
  );
  IF coalesce((v_result->>'idempotent_replay')::boolean,true) THEN
    RAISE EXCEPTION 'A primeira transferência não pode ser replay';
  END IF;
  SELECT coalesce(sum(quantity_delta),0) INTO v_balance
  FROM ciadi_ti.stock_movements WHERE item_id=v_item AND warehouse_id=v_wh_a;
  IF v_balance <> 7 THEN RAISE EXCEPTION 'Saldo da origem esperado 7, obtido %',v_balance; END IF;
  SELECT coalesce(sum(quantity_delta),0) INTO v_balance
  FROM ciadi_ti.stock_movements WHERE item_id=v_item AND warehouse_id=v_wh_b;
  IF v_balance <> 3 THEN RAISE EXCEPTION 'Saldo do destino esperado 3, obtido %',v_balance; END IF;

  -- Idempotent replay must not duplicate either movement.
  v_result := ciadi_ti.reception_transfer_stock(
    v_item,v_wh_a,v_wh_b,3,'TRF-001','teste transaccional',null,'transfer-key-001','talatona'
  );
  IF NOT coalesce((v_result->>'idempotent_replay')::boolean,false) THEN
    RAISE EXCEPTION 'A repetição da transferência devia ser idempotente';
  END IF;
  SELECT count(*) INTO v_count FROM ciadi_ti.stock_movements
  WHERE idempotency_key IN ('transfer-key-001:out','transfer-key-001:in');
  IF v_count <> 2 THEN RAISE EXCEPTION 'Replay duplicou movimentos: %',v_count; END IF;

  -- Stock shortage must reject and leave no partial movement.
  BEGIN
    PERFORM ciadi_ti.reception_transfer_stock(
      v_item,v_wh_a,v_wh_b,99,'TRF-OVER','sem stock',null,'transfer-shortage-01','talatona'
    );
    RAISE EXCEPTION 'Esperava rejeição por stock insuficiente';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  SELECT count(*) INTO v_count FROM ciadi_ti.stock_movements
  WHERE idempotency_key IN ('transfer-shortage-01:out','transfer-shortage-01:in');
  IF v_count <> 0 THEN RAISE EXCEPTION 'Transferência rejeitada deixou movimentos parciais'; END IF;

  -- Cross-polo access must be rejected before creating stock movements.
  BEGIN
    PERFORM ciadi_ti.reception_transfer_stock(
      v_item,v_wh_a,v_wh_other,1,'TRF-CROSS','fora do polo',null,'transfer-cross-01','talatona'
    );
    RAISE EXCEPTION 'Esperava rejeição de armazém de outro polo';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  -- A reused idempotency key with different payload must fail.
  BEGIN
    PERFORM ciadi_ti.reception_transfer_stock(
      v_item,v_wh_a,v_wh_b,2,'TRF-001','payload diferente',null,'transfer-key-001','talatona'
    );
    RAISE EXCEPTION 'Esperava conflito de chave idempotente';
  EXCEPTION WHEN SQLSTATE '23505' THEN NULL;
  END;

  -- Checked goods receipt posts its accepted quantity once and updates its status.
  INSERT INTO ciadi_ti.goods_receipts(id,warehouse_id,receipt_number,status,notes)
  VALUES (v_receipt,v_wh_a,'GR-TEST-001','checked','entrada de teste');
  INSERT INTO ciadi_ti.goods_receipt_lines(
    id,receipt_id,item_id,received_quantity,accepted_quantity,unit_cost,lot_code
  ) VALUES (v_line,v_receipt,v_item,2,2,10,'LOTE-TESTE');

  v_result := ciadi_ti.finalize_goods_receipt(v_receipt);
  IF v_result->>'status' <> 'posted' OR (v_result->>'movements_created')::integer <> 1 THEN
    RAISE EXCEPTION 'Finalização da recepção devolveu resultado inesperado: %',v_result;
  END IF;
  IF (SELECT status FROM ciadi_ti.goods_receipts WHERE id=v_receipt) <> 'posted' THEN
    RAISE EXCEPTION 'Estado da recepção não foi actualizado para posted';
  END IF;
  IF (SELECT count(*) FROM ciadi_ti.stock_movements
      WHERE idempotency_key='goods-receipt:'||v_receipt::text||':'||v_line::text) <> 1 THEN
    RAISE EXCEPTION 'A recepção não criou exactamente um movimento';
  END IF;

  -- Unauthenticated calls are denied.
  PERFORM set_config('request.jwt.claim.sub','',true);
  BEGIN
    PERFORM ciadi_ti.reception_transfer_stock(
      v_item,v_wh_a,v_wh_b,1,'TRF-ANON','sem sessão',null,'transfer-anon-01','talatona'
    );
    RAISE EXCEPTION 'Esperava rejeição de sessão anónima';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);

  -- Payment cannot proceed without an explicitly selected cashbox.
  BEGIN
    PERFORM * FROM public.finance_registar_pagamento(
      '22222222-2222-4222-8222-222222222222',1,'numerário',null,null,null
    );
    RAISE EXCEPTION 'Esperava rejeição de pagamento sem caixa';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    IF v_state <> 'P0001' THEN RAISE; END IF;
  END;

  IF (SELECT count(*) FROM ciadi_ti.audit_events WHERE table_name='stock_movements') < 3 THEN
    RAISE EXCEPTION 'Faltam eventos de auditoria dos movimentos de stock';
  END IF;
END
$$;
