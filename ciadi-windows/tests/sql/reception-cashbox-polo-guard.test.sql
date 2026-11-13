-- Cashbox polo/ownership regression tests in isolated PostgreSQL.
DO $cashbox_polo_guard$
DECLARE
  v_actor uuid := 'a1111111-1111-4111-8111-111111111111';
  v_operator uuid := 'a2222222-2222-4222-8222-222222222222';
  v_other_operator uuid := 'a3333333-3333-4333-8333-333333333333';
  v_company uuid := 'a4444444-4444-4444-8444-444444444444';
  v_tal_box uuid := 'a5555555-5555-4555-8555-555555555555';
  v_ros_box uuid := 'a6666666-6666-4666-8666-666666666666';
  v_tal_shift uuid;
  v_ros_shift uuid := 'a7777777-7777-4777-8777-777777777777';
  v_other_shift uuid := 'a8888888-8888-4888-8888-888888888888';
  v_movement uuid;
  v_result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
  PERFORM set_config('ciadi.test_finance_caps','abrir,fechar,receber',true);
  PERFORM set_config('ciadi.test_operator_id',v_operator::text,true);
  PERFORM set_config('ciadi.test_allowed_polo','talatona',true);

  INSERT INTO public.finance_operadores(id,funcao)
  VALUES (v_operator,'operador_caixa');

  INSERT INTO public.finance_caixas(id,empresa_id,estado,polo_code,nome,codigo)
  VALUES
    (v_tal_box,v_company,'fechado','talatona','Caixa Talatona','CX-TAL-GUARD'),
    (v_ros_box,v_company,'fechado','jardim_de_rosas','Caixa Jardim de Rosas','CX-ROS-GUARD');

  -- The operator may open a cashbox in the assigned polo.
  v_tal_shift := public.ciadi_abrir_caixa(v_tal_box,100);
  IF v_tal_shift IS NULL THEN
    RAISE EXCEPTION 'A abertura autorizada não devolveu o turno';
  END IF;

  -- The same operator cannot open a cashbox in a different polo.
  BEGIN
    PERFORM public.ciadi_abrir_caixa(v_ros_box,100);
    RAISE EXCEPTION 'Esperava bloqueio de abertura em polo não atribuído';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  -- A user cannot close another operator's turn, even in the same polo.
  INSERT INTO public.finance_caixa_turnos(id,caixa_id,operador_id,estado,saldo_inicial)
  VALUES (v_other_shift,v_tal_box,v_other_operator,'aberto',50);
  BEGIN
    PERFORM public.ciadi_fechar_caixa(v_other_shift,50,'teste de propriedade do turno');
    RAISE EXCEPTION 'Esperava bloqueio de fecho de turno alheio';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  -- A user cannot close a turn belonging to a different polo.
  INSERT INTO public.finance_caixa_turnos(id,caixa_id,operador_id,estado,saldo_inicial)
  VALUES (v_ros_shift,v_ros_box,v_operator,'aberto',50);
  BEGIN
    PERFORM public.ciadi_fechar_caixa(v_ros_shift,50,'teste de isolamento de polo');
    RAISE EXCEPTION 'Esperava bloqueio de fecho de outro polo';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  -- Cash movement in a different polo is denied before any ledger write.
  BEGIN
    PERFORM public.ciadi_registar_movimento_caixa(
      v_ros_box,'entrada',10,'numerário','movimento fora do polo',null,null,'teste'
    );
    RAISE EXCEPTION 'Esperava bloqueio de movimento em outro polo';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  -- A permitted movement and close on the operator's own polo remain available.
  v_movement := public.ciadi_registar_movimento_caixa(
    v_tal_box,'entrada',10,'numerário','movimento de teste',null,null,'teste'
  );
  IF v_movement IS NULL THEN
    RAISE EXCEPTION 'O movimento autorizado não foi registado';
  END IF;

  v_result := public.ciadi_fechar_caixa(v_tal_shift,100,'fecho de teste');
  IF v_result->>'estado' <> 'fechado' THEN
    RAISE EXCEPTION 'O fecho autorizado não concluiu: %',v_result;
  END IF;

  IF (SELECT count(*) FROM public.finance_auditoria_operacoes
      WHERE evento IN ('abertura','movimento','fechamento')) <> 3 THEN
    RAISE EXCEPTION 'A auditoria de abertura, movimento e fecho está incompleta';
  END IF;
END;
$cashbox_polo_guard$;
