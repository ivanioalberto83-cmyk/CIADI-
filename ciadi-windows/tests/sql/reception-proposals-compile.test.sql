-- Verifies PostgreSQL compilation and privilege boundaries in the isolated CI database.
DO $$
DECLARE
  v_helper regprocedure;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'ciadi_reception.front_desk_queue_counters'::regclass) THEN
    RAISE EXCEPTION 'A tabela de contadores da fila tem de ter RLS activo';
  END IF;
  IF has_table_privilege('anon','ciadi_reception.front_desk_queue_counters','SELECT')
     OR has_table_privilege('anon','ciadi_reception.front_desk_queue_counters','INSERT')
     OR has_table_privilege('authenticated','ciadi_reception.front_desk_queue_counters','SELECT')
     OR has_table_privilege('authenticated','ciadi_reception.front_desk_queue_counters','INSERT') THEN
    RAISE EXCEPTION 'A tabela de contadores da fila não pode conceder acesso directo a anon/authenticated';
  END IF;
  IF to_regprocedure('public.finance_registar_pagamento(uuid,numeric,text,text,text,text,uuid,text)') IS NULL THEN
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
  IF NOT has_function_privilege('authenticated', 'public.finance_registar_pagamento(uuid,numeric,text,text,text,text,uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated deve poder executar a RPC de pagamento';
  END IF;
  IF has_function_privilege('anon', 'public.finance_registar_pagamento(uuid,numeric,text,text,text,text,uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon não pode executar a RPC de pagamento';
  END IF;
  IF has_function_privilege('anon', 'public.finance_registar_pagamento(uuid,numeric,text,text,uuid,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.finance_registar_pagamento(uuid,numeric,text,text,uuid,text)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.finance_registar_pagamento(uuid,numeric,text,text,uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'A assinatura antiga da RPC de pagamento deve ficar desactivada';
  END IF;
  IF has_function_privilege('anon', 'public.finance_registar_pagamento(uuid,numeric,text,text,text,uuid,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.finance_registar_pagamento(uuid,numeric,text,text,text,uuid,text)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.finance_registar_pagamento(uuid,numeric,text,text,text,uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'A assinatura intermédia da RPC de pagamento deve ficar desactivada';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = to_regprocedure('public.finance_registar_pagamento(uuid,numeric,text,text,text,text,uuid,text)')
      AND p.prosecdef = false
  ) THEN
    RAISE EXCEPTION 'A RPC pública de pagamento deve ser SECURITY INVOKER';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = to_regprocedure('ciadi_private.finance_registar_pagamento(uuid,numeric,text,text,text,text,uuid,text)')
      AND p.prosecdef = true
  ) THEN
    RAISE EXCEPTION 'A implementação privilegiada deve ficar no schema privado';
  END IF;
  IF has_function_privilege('anon', 'ciadi_private.finance_registar_pagamento(uuid,numeric,text,text,text,text,uuid,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'ciadi_private.finance_registar_pagamento(uuid,numeric,text,text,text,text,uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'O helper privado deve ser acessível apenas a authenticated';
  END IF;
  IF has_schema_privilege('anon', 'ciadi_private', 'USAGE')
     OR NOT has_schema_privilege('authenticated', 'ciadi_private', 'USAGE') THEN
    RAISE EXCEPTION 'O schema privado não pode ser usado por anon e tem de estar disponível ao wrapper autenticado';
  END IF;
  IF has_function_privilege('anon', 'public.finance_registar_pagamento(uuid,numeric,text,text,uuid,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.finance_registar_pagamento(uuid,numeric,text,text,uuid,text)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.finance_registar_pagamento(uuid,numeric,text,text,uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'A assinatura antiga da RPC de pagamento deve ficar desactivada';
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
