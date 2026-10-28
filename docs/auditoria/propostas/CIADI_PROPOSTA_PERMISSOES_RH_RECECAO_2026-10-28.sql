-- PROPOSTA DE REVISÃO — NÃO EXECUTAR EM PRODUÇÃO SEM REVISÃO E AUTORIZAÇÃO.
-- CIADI: permissões mínimas para RH e Receção.
-- Baseada na leitura das políticas de produção em 28-10-2026.
-- Pré-requisitos:
--   1. Rever/aprovar a migration que permite perfis 'rh' e 'rececao'.
--   2. Aplicar primeiro num ambiente de homologação.
--   3. Confirmar grants de tabela e testar RLS com contas reais de teste.
--   4. Esta proposta NÃO altera is_staff() nem concede permissões de ADM.

-- A expressão EXISTS abaixo consulta apenas o perfil autenticado.
-- A política self-read existente em public.perfis permite ao utilizador ler o próprio perfil.
-- Todas as políticas são adicionais e permissivas: rever interacções com políticas existentes.

-- Recursos Humanos: dados laborais necessários ao trabalho corrente.
CREATE POLICY ciadi_funcionarios_rh_select
ON public.ciadi_funcionarios FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rh'
));

CREATE POLICY ciadi_funcionarios_rh_insert
ON public.ciadi_funcionarios FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rh'
));

CREATE POLICY ciadi_funcionarios_rh_update
ON public.ciadi_funcionarios FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rh'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rh'
));

CREATE POLICY ciadi_funcionario_contratos_rh_select
ON public.ciadi_funcionario_contratos FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rh'
));

CREATE POLICY ciadi_funcionario_contratos_rh_insert
ON public.ciadi_funcionario_contratos FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rh'
));

CREATE POLICY ciadi_funcionario_contratos_rh_update
ON public.ciadi_funcionario_contratos FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rh'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rh'
));

-- RH: leitura das áreas laborais adicionais. Escrita deverá ser adicionada
-- apenas para fluxos cuja UI, validação e auditoria já estejam implementadas.
CREATE POLICY ciadi_funcionario_documentos_rh_select
ON public.ciadi_funcionario_documentos FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rh'
));

CREATE POLICY ciadi_funcionario_assiduidade_rh_select
ON public.ciadi_funcionario_assiduidade FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rh'
));

CREATE POLICY ciadi_funcionario_ferias_rh_select
ON public.ciadi_funcionario_ferias_licencas FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rh'
));

CREATE POLICY ciadi_funcionario_avaliacoes_rh_select
ON public.ciadi_funcionario_avaliacoes FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rh'
));

CREATE POLICY ciadi_funcionario_formacoes_rh_select
ON public.ciadi_funcionario_formacoes FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rh'
));

CREATE POLICY ciadi_funcionario_competencias_rh_select
ON public.ciadi_funcionario_competencias FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rh'
));

CREATE POLICY ciadi_funcionario_historico_rh_select
ON public.ciadi_funcionario_historico FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rh'
));

-- Folha salarial: leitura/criação/actualização por RH; não concede DELETE.
-- A aprovação final e o pagamento devem continuar sujeitos ao fluxo de aprovação definido.
CREATE POLICY ciadi_folhas_salariais_rh_select
ON public.ciadi_folhas_salariais FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rh'
));

CREATE POLICY ciadi_folhas_salariais_rh_insert_draft
ON public.ciadi_folhas_salariais FOR INSERT TO authenticated
WITH CHECK (
  estado = 'rascunho'
  AND total_bruto = 0 AND total_descontos = 0 AND total_liquido = 0
  AND criado_por = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.perfis p
    WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rh'
  )
);

CREATE POLICY ciadi_folha_linhas_rh_select
ON public.ciadi_folha_salarial_linhas FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rh'
));

CREATE POLICY ciadi_folha_linhas_rh_insert_draft
ON public.ciadi_folha_salarial_linhas FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ciadi_folhas_salariais f
    WHERE f.id = folha_id AND f.estado = 'rascunho' AND f.criado_por = (SELECT auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.perfis p
    WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rh'
  )
);

-- Receção: acesso apenas a cadastro de clientes, sem DELETE.
-- A consulta de empresas emitentes deve usar RPC/view que devolva só ID e razão social;
-- NÃO criar uma política SELECT ampla em finance_empresas, que contém dados fiscais.
CREATE POLICY finance_clientes_recepcao_select
ON public.finance_clientes FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rececao'
));

CREATE POLICY finance_clientes_recepcao_insert
ON public.finance_clientes FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rececao'
));

CREATE POLICY finance_clientes_recepcao_update
ON public.finance_clientes FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rececao'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.perfis p
  WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rececao'
));

-- Não incluído intencionalmente:
-- * ciadi_funcionario_beneficios e ciadi_funcionario_confidencial (actualmente admin/gestor).
-- * autorização de RPCs de emissão/anulação/contabilização fiscal.
-- * permissões de caixa em finance_operadores.
-- * upload de documentos ou políticas de Storage.
-- Cada item exige revisão própria antes de tornar o módulo totalmente operacional.

-- Consulta mínima da empresa emitente para o formulário de Receção.
-- O formulário da Receção deve chamar esta RPC em vez de ler finance_empresas
-- directamente. A função só devolve o identificador e a razão social da empresa
-- principal activa; não expõe NIF, morada, configuração fiscal ou outros campos.
CREATE OR REPLACE FUNCTION public.ciadi_recepcao_empresas_ativas()
RETURNS TABLE(id uuid, razao_social text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT e.id, e.razao_social
  FROM public.finance_empresas e
  WHERE e.ativo = true
    AND e.empresa_principal = true
    AND EXISTS (
      SELECT 1
      FROM public.perfis p
      WHERE p.id = (SELECT auth.uid())
        AND p.ativo = true
        AND p.tipo IN ('admin', 'gestor', 'rececao')
    );
$function$;

REVOKE ALL ON FUNCTION public.ciadi_recepcao_empresas_ativas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ciadi_recepcao_empresas_ativas() TO authenticated;

-- A autorização desta RPC de leitura é limitada aos campos indicados.
-- A RPC de criação/emissão de factura continua bloqueada para Receção até existir
-- autorização própria e validada, baseada no operador e nas permissões comerciais.

-- O RH pode limpar apenas a sua própria folha em rascunho se uma operação
-- de criação falhar. Não pode apagar folhas aprovadas/pagas nem rascunhos alheios.
CREATE POLICY ciadi_folhas_salariais_rh_delete_own_draft
ON public.ciadi_folhas_salariais FOR DELETE TO authenticated
USING (
  estado = 'rascunho' AND criado_por = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.perfis p
    WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rh'
  )
);

CREATE POLICY ciadi_folha_linhas_rh_delete_own_draft
ON public.ciadi_folha_salarial_linhas FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ciadi_folhas_salariais f
    WHERE f.id = folha_id AND f.estado = 'rascunho' AND f.criado_por = (SELECT auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.perfis p
    WHERE p.id = (SELECT auth.uid()) AND p.ativo = true AND p.tipo = 'rh'
  )
);

-- Opções mínimas para preparar a folha. Evita conceder ao RH leitura ampla
-- das tabelas financeiras de empresas e centros de custo.
CREATE OR REPLACE FUNCTION public.ciadi_rh_opcoes_folha()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.perfis p
    WHERE p.id = (SELECT auth.uid()) AND p.ativo = true
      AND p.tipo IN ('rh', 'admin', 'gestor')
  ) THEN
    RAISE EXCEPTION 'Sem autorização para consultar opções de folha salarial' USING ERRCODE='42501';
  END IF;

  RETURN jsonb_build_object(
    'empresas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', e.id, 'razao_social', e.razao_social) ORDER BY e.razao_social)
      FROM public.finance_empresas e
      WHERE e.ativo = true
    ), '[]'::jsonb),
    'centros_custo', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'codigo', c.codigo, 'nome', c.nome, 'empresa_id', c.empresa_id) ORDER BY c.codigo)
      FROM public.finance_centros_custo c
      WHERE c.ativo = true
    ), '[]'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.ciadi_rh_opcoes_folha() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ciadi_rh_opcoes_folha() TO authenticated;

-- Recalcula apenas os totais de uma folha em rascunho. Não altera o estado.
-- RH não recebe UPDATE directo na folha, impedindo que contorne aprovação/pagamento.
CREATE OR REPLACE FUNCTION public.ciadi_rh_finalizar_folha_rascunho(p_folha_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_sheet public.ciadi_folhas_salariais%rowtype;
  v_count integer;
  v_bruto numeric(14,2);
  v_descontos numeric(14,2);
  v_liquido numeric(14,2);
BEGIN
  IF v_user IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfis p
    WHERE p.id = v_user AND p.ativo = true AND p.tipo IN ('rh', 'admin', 'gestor')
  ) THEN
    RAISE EXCEPTION 'Sem autorização para finalizar a folha em rascunho' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_sheet
  FROM public.ciadi_folhas_salariais
  WHERE id = p_folha_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Folha não encontrada'; END IF;
  IF v_sheet.estado <> 'rascunho' THEN RAISE EXCEPTION 'Só é possível calcular uma folha em rascunho'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.finance_empresas e
    WHERE e.id = v_sheet.empresa_id AND e.ativo = true
  ) THEN
    RAISE EXCEPTION 'Empresa emitente inválida/inactiva';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.finance_centros_custo c
    WHERE c.id = v_sheet.centro_custo_id AND c.ativo = true
      AND (c.empresa_id IS NULL OR c.empresa_id = v_sheet.empresa_id)
  ) THEN
    RAISE EXCEPTION 'Centro de custo inválido/inactivo para a empresa';
  END IF;

  SELECT count(*), coalesce(sum(total_bruto),0), coalesce(sum(total_descontos),0), coalesce(sum(total_liquido),0)
  INTO v_count, v_bruto, v_descontos, v_liquido
  FROM public.ciadi_folha_salarial_linhas
  WHERE folha_id = p_folha_id;
  IF v_count = 0 THEN RAISE EXCEPTION 'A folha não contém linhas de trabalhadores'; END IF;

  UPDATE public.ciadi_folhas_salariais
  SET total_bruto = v_bruto, total_descontos = v_descontos, total_liquido = v_liquido,
      atualizado_por = v_user, updated_at = now()
  WHERE id = p_folha_id;

  RETURN jsonb_build_object('id', p_folha_id, 'estado', 'rascunho',
    'colaboradores', v_count, 'total_bruto', v_bruto,
    'total_descontos', v_descontos, 'total_liquido', v_liquido);
END;
$function$;

REVOKE ALL ON FUNCTION public.ciadi_rh_finalizar_folha_rascunho(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ciadi_rh_finalizar_folha_rascunho(uuid) TO authenticated;

