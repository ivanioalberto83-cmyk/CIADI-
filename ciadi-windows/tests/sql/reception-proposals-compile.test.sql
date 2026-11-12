-- Verifies PostgreSQL compilation and privilege boundaries in the isolated CI database.
DO $$
DECLARE
  v_helper regprocedure;
BEGIN
  IF to_regprocedure('public.finance_registar_pagamento(uuid,numeric,text,text,text,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'RPC de pagamento não foi criada';
  END IF;
  IF to_regprocedure('ciadi_ti.reception_get_finance_workspace_impl(text)') IS NULL THEN
    RAISE EXCEPTION 'Workspace financeiro da Recepção não foi criado';
  END IF;
  IF to_regprocedure('ciadi_ti.reception_get_stock_workspace(text)') IS NULL THEN
    RAISE EXCEPTION 'Workspace de stock da Recepção não foi criado';
  END IF;
  IF to_regprocedure('ciadi_ti.reception_transfer_stock(uuid,uuid,uuid,numeric,text,text,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'RPC de transferência da Recepção não foi criada';
  END IF;
  IF to_regprocedure('ciadi_ti.finalize_goods_receipt(uuid)') IS NULL THEN
    RAISE EXCEPTION 'RPC de finalização de recepção não foi criada';
  END IF;

  v_helper := to_regprocedure('ciadi_ti.post_stock_movement_for_reception(uuid,uuid,text,text,numeric,text,text,numeric,text,text,uuid)');
  IF v_helper IS NULL THEN
    RAISE EXCEPTION 'Helper interno de stock não foi criado';
  END IF;
  IF has_function_privilege('authenticated', v_helper, 'EXECUTE') THEN
    RAISE EXCEPTION 'Helper interno de stock não pode ser executável por authenticated';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.finance_registar_pagamento(uuid,numeric,text,text,text,uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated deve poder executar a RPC de pagamento';
  END IF;
  IF has_function_privilege('anon', 'public.finance_registar_pagamento(uuid,numeric,text,text,text,uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon não pode executar a RPC de pagamento';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = to_regprocedure('public.finance_registar_pagamento(uuid,numeric,text,text,text,uuid,text)')
      AND p.prosecdef = true
  ) THEN
    RAISE EXCEPTION 'A RPC financeira deve executar com privilégios controlados SECURITY DEFINER';
  END IF;
  IF NOT has_function_privilege('authenticated', 'ciadi_ti.reception_get_stock_workspace(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated deve poder executar o workspace de stock controlado';
  END IF;
  IF NOT has_function_privilege('authenticated', 'ciadi_ti.reception_transfer_stock(uuid,uuid,uuid,numeric,text,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated deve poder executar a transferência validada por polo';
  END IF;
  IF NOT has_function_privilege('authenticated', 'ciadi_ti.finalize_goods_receipt(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated deve poder executar a finalização validada por polo';
  END IF;
END
$$;
