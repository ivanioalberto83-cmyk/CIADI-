-- PROPOSTA APENAS — NÃO APLICAR EM PRODUÇÃO SEM HOMOLOGAÇÃO E AUTORIZAÇÃO.
-- Defesa em profundidade para o contador da fila de Recepção.
-- A única operação de negócio que o utiliza é reception_register_arrival,
-- uma função SECURITY DEFINER pertencente a postgres que valida auth.uid()
-- e has_reception_operation_access(p_polo_code) antes de incrementar o contador.
--
-- A auditoria remota confirmou que anon/authenticated não têm privilégios directos
-- sobre a tabela. Esta proposta mantém esse bloqueio e activa RLS para impedir
-- exposição acidental caso grants sejam introduzidos no futuro.

ALTER TABLE ciadi_reception.front_desk_queue_counters
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE ciadi_reception.front_desk_queue_counters
  FROM PUBLIC, anon, authenticated;

DO $verify_queue_counter_security$
DECLARE
  v_table oid := 'ciadi_reception.front_desk_queue_counters'::regclass;
BEGIN
  IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = v_table) THEN
    RAISE EXCEPTION 'RLS não ficou activo em ciadi_reception.front_desk_queue_counters';
  END IF;

  IF has_table_privilege('anon', v_table, 'SELECT')
     OR has_table_privilege('anon', v_table, 'INSERT')
     OR has_table_privilege('anon', v_table, 'UPDATE')
     OR has_table_privilege('anon', v_table, 'DELETE')
     OR has_table_privilege('authenticated', v_table, 'SELECT')
     OR has_table_privilege('authenticated', v_table, 'INSERT')
     OR has_table_privilege('authenticated', v_table, 'UPDATE')
     OR has_table_privilege('authenticated', v_table, 'DELETE') THEN
    RAISE EXCEPTION 'A tabela de contadores não pode ter privilégios directos para anon/authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    WHERE p.oid = to_regprocedure(
      'ciadi_reception.reception_register_arrival(text,uuid,uuid,text,text,text,uuid)'
    )
      AND p.prosecdef = true
      AND pg_get_userbyid(p.proowner) = 'postgres'
  ) THEN
    RAISE EXCEPTION 'A RPC autenticada de chegada deixou de ser a única via privilegiada esperada';
  END IF;
END;
$verify_queue_counter_security$;
