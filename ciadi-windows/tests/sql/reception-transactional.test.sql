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
  v_company uuid := '33333333-3333-4333-8333-333333333333';
  v_cashbox uuid := '44444444-4444-4444-8444-444444444444';
  v_shift uuid := '55555555-5555-4555-8555-555555555555';
  v_operator uuid := '66666666-6666-4666-8666-666666666666';
  v_invoice uuid := '77777777-7777-4777-8777-777777777777';
  v_overpay_invoice uuid := '88888888-8888-4888-8888-888888888888';
  v_payment record;
  v_first_payment uuid;
  v_first_receipt uuid;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
  INSERT INTO public.perfis(id,ativo,tipo) VALUES (v_actor,true,'operador');
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
      '22222222-2222-4222-8222-222222222222',1,'numerário','payment-no-cash-01',null,null,null
    );
    RAISE EXCEPTION 'Esperava rejeição de pagamento sem caixa';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    GET STACKED DIAGNOSTICS v_state = MESSAGE_TEXT;
    IF v_state NOT LIKE 'Seleccione um caixa aberto%' THEN RAISE; END IF;
  END;


  -- Successful partial and final payments: RC, payment, cash movement and audit are atomic.
  PERFORM set_config('ciadi.test_finance_caps','receber,recibo',true);
  PERFORM set_config('ciadi.test_operator_id',v_operator::text,true);
  INSERT INTO public.finance_caixas(id,empresa_id,estado,codigo,nome)
  VALUES (v_cashbox,v_company,'aberto','CX-TST','Caixa de teste');
  INSERT INTO public.finance_caixa_turnos(id,caixa_id,operador_id,estado)
  VALUES (v_shift,v_cashbox,v_operator,'aberto');
  INSERT INTO public.finance_series(
    id,tipo_documento,proximo_numero,ultimo_numero,codigo,ano,activa,estado,empresa_id
  ) VALUES ('99999999-9999-4999-8999-999999999999','RC',1,0,'RC-TST',2026,true,'ativa',v_company);
  INSERT INTO public.finance_documentos(
    id,document_status,fiscal_status,estado_pagamento,total,empresa_id,document_no,
    moeda,criado_por,tipo_documento
  ) VALUES
    (v_invoice,'N','emitido','aberto',100,v_company,'FT-TST-001','AOA',v_actor,'FT'),
    (v_overpay_invoice,'N','emitido','aberto',50,v_company,'FT-TST-002','AOA',v_actor,'FT');

  SELECT * INTO v_payment FROM public.finance_registar_pagamento(
    v_invoice,40,'numerário','payment-key-001','PAY-REF-001',v_cashbox,'pagamento parcial'
  );
  IF v_payment.estado_pagamento <> 'parcial' OR v_payment.recibo_no <> 'RC-TST/1' THEN
    RAISE EXCEPTION 'Primeiro pagamento/recibo inesperado: %',row_to_json(v_payment);
  END IF;
  v_first_payment := v_payment.pagamento_id;
  v_first_receipt := v_payment.recibo_id;

  -- Repetir o mesmo pedido devolve o mesmo recibo e não cria novo movimento/auditoria.
  SELECT * INTO v_payment FROM public.finance_registar_pagamento(
    v_invoice,40,'numerário','payment-key-001','PAY-REF-001',v_cashbox,'pagamento parcial'
  );
  IF v_payment.pagamento_id <> v_first_payment OR v_payment.recibo_id <> v_first_receipt THEN
    RAISE EXCEPTION 'Replay idempotente não devolveu os identificadores originais';
  END IF;
  IF (SELECT count(*) FROM public.finance_pagamentos WHERE documento_id=v_invoice) <> 1
     OR (SELECT count(*) FROM public.finance_movimentos_caixa WHERE pagamento_id=v_first_payment) <> 1
     OR (SELECT count(*) FROM public.finance_auditoria_fiscal WHERE documento_id=v_invoice AND evento='PAGAMENTO') <> 1 THEN
    RAISE EXCEPTION 'Replay idempotente duplicou pagamento, movimento ou auditoria';
  END IF;

  -- A mesma chave com payload diferente deve ser rejeitada.
  BEGIN
    PERFORM * FROM public.finance_registar_pagamento(
      v_invoice,41,'numerário','payment-key-001','PAY-REF-001',v_cashbox,'payload alterado'
    );
    RAISE EXCEPTION 'Esperava rejeição de reutilização da chave com payload diferente';
  EXCEPTION WHEN SQLSTATE '23505' THEN NULL;
  END;

  SELECT * INTO v_payment FROM public.finance_registar_pagamento(
    v_invoice,60,'transferência','payment-key-002','PAY-REF-002',v_cashbox,'liquidação'
  );
  IF v_payment.estado_pagamento <> 'pago' OR v_payment.recibo_no <> 'RC-TST/2' THEN
    RAISE EXCEPTION 'Liquidação/recibo inesperado: %',row_to_json(v_payment);
  END IF;
  IF (SELECT estado_pagamento FROM public.finance_documentos WHERE id=v_invoice) <> 'pago' THEN
    RAISE EXCEPTION 'A factura não transitou para pago';
  END IF;
  IF (SELECT count(*) FROM public.finance_pagamentos WHERE documento_id=v_invoice) <> 2
     OR (SELECT count(*) FROM public.finance_documentos WHERE documento_origem_id=v_invoice AND tipo_documento='RC') <> 2
     OR (SELECT count(*) FROM public.finance_movimentos_caixa WHERE pagamento_id IN (
       SELECT id FROM public.finance_pagamentos WHERE documento_id=v_invoice
     )) <> 2 THEN
    RAISE EXCEPTION 'Pagamento, recibos e movimentos de caixa não ficaram sincronizados';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.finance_movimentos_caixa
    WHERE pagamento_id IN (SELECT id FROM public.finance_pagamentos WHERE documento_id=v_invoice)
      AND operador_id <> v_operator
  ) THEN
    RAISE EXCEPTION 'Movimento de caixa não preservou o operador interno do turno';
  END IF;
  IF (SELECT count(*) FROM public.finance_auditoria_fiscal WHERE documento_id=v_invoice AND evento='PAGAMENTO') <> 2 THEN
    RAISE EXCEPTION 'Faltam eventos de auditoria dos pagamentos';
  END IF;

  -- Overpayment is rejected and does not leave a payment, RC or cash movement.
  BEGIN
    PERFORM * FROM public.finance_registar_pagamento(
      v_overpay_invoice,60,'numerário','payment-over-001','PAY-OVER-001',v_cashbox,'excede saldo'
    );
    RAISE EXCEPTION 'Esperava rejeição de pagamento superior ao saldo';
  EXCEPTION WHEN SQLSTATE '23514' THEN
    GET STACKED DIAGNOSTICS v_state = MESSAGE_TEXT;
    IF v_state NOT LIKE 'Pagamento excede o saldo em aberto:%' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.finance_pagamentos WHERE documento_id=v_overpay_invoice)
     OR EXISTS (SELECT 1 FROM public.finance_documentos WHERE documento_origem_id=v_overpay_invoice)
     OR EXISTS (SELECT 1 FROM public.finance_movimentos_caixa WHERE descricao LIKE '%FT-TST-002%') THEN
    RAISE EXCEPTION 'Pagamento rejeitado deixou registos parciais';
  END IF;

  IF (SELECT count(*) FROM ciadi_ti.audit_events WHERE table_name='stock_movements') < 3 THEN
    RAISE EXCEPTION 'Faltam eventos de auditoria dos movimentos de stock';
  END IF;
END
$$;
