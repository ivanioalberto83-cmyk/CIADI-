-- PROPOSTA APENAS — NÃO APLICAR EM PRODUÇÃO SEM HOMOLOGAÇÃO E AUTORIZAÇÃO.
-- Corrige o workspace financeiro da Recepção: caixas disponíveis, turnos por operador interno
-- e capacidades explícitas para a interface. Preserva a validação final nas RPCs de caixa.

create or replace function ciadi_ti.reception_get_finance_workspace_impl(p_polo_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_company_id uuid;
  v_operator_id uuid;
  v_result jsonb;
  v_can_open boolean;
  v_can_close boolean;
  v_can_receive boolean;
  v_can_approve_close boolean;
begin
  if auth.uid() is null or p_polo_code not in ('talatona','jardim_de_rosas') then
    raise exception 'Sessão ou polo inválido';
  end if;

  if not exists (
    select 1
    from public.perfis p
    where p.id = auth.uid()
      and p.ativo = true
      and (
        p.tipo in ('admin','gestor')
        or (
          p.tipo = 'operador'
          and exists (
            select 1
            from ciadi_ti.reception_user_polos rup
            where rup.user_id = p.id
              and rup.polo_code = p_polo_code
              and rup.active = true
          )
        )
      )
  ) then
    raise exception 'Sem acesso financeiro para este polo';
  end if;

  select e.id into v_company_id
  from public.finance_empresas e
  where e.ativo = true and e.empresa_principal = true
  order by e.created_at
  limit 1;

  v_operator_id := public.ciadi_finance_operator_id();
  v_can_open := public.ciadi_finance_can('abrir') and v_operator_id is not null;
  v_can_close := public.ciadi_finance_can('fechar');
  v_can_receive := public.ciadi_finance_can('receber')
    and public.ciadi_finance_can('recibo')
    and v_operator_id is not null;
  v_can_approve_close := public.ciadi_finance_can('aprovar');

  if v_company_id is null then
    return pg_catalog.jsonb_build_object(
      'companyId', null,
      'clients', '[]'::jsonb,
      'services', '[]'::jsonb,
      'documentTypes', '[]'::jsonb,
      'series', '[]'::jsonb,
      'cashboxes', '[]'::jsonb,
      'documents', '[]'::jsonb,
      'shifts', '[]'::jsonb,
      'operatorId', v_operator_id,
      'canOpenCashbox', v_can_open,
      'canCloseCashbox', v_can_close,
      'canReceivePayments', v_can_receive,
      'canApproveCashClose', v_can_approve_close
    );
  end if;

  select pg_catalog.jsonb_build_object(
    'companyId', v_company_id,
    'clients', coalesce((
      select pg_catalog.jsonb_agg(x.item order by x.nome)
      from (
        select pg_catalog.jsonb_build_object(
          'id', c.id, 'nome', c.nome, 'nome_comercial', c.nome_comercial,
          'nif', c.nif, 'email', c.email, 'telefone', c.telefone,
          'tipo', c.tipo, 'empresa_id', c.empresa_id
        ) item, c.nome
        from public.finance_clientes c
        where c.ativo = true and c.empresa_id = v_company_id
        order by c.nome
        limit 200
      ) x
    ), '[]'::jsonb),
    'services', coalesce((
      select pg_catalog.jsonb_agg(x.item order by x.nome)
      from (
        select pg_catalog.jsonb_build_object(
          'id', s.id, 'codigo', s.codigo, 'nome', s.nome,
          'unidade', s.unidade, 'preco_base', s.preco_base,
          'taxa_imposto', s.taxa_imposto, 'empresa_id', s.empresa_id
        ) item, s.nome
        from public.finance_servicos s
        where s.ativo = true and (s.empresa_id is null or s.empresa_id = v_company_id)
        order by s.nome
        limit 200
      ) x
    ), '[]'::jsonb),
    'documentTypes', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', t.id, 'codigo', t.codigo, 'nome', t.nome,
        'natureza', t.natureza, 'exige_cliente', t.exige_cliente,
        'exige_linhas', t.exige_linhas
      ) order by t.nome)
      from public.finance_tipos_documento t
      where t.ativo = true
    ), '[]'::jsonb),
    'series', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', s.id, 'codigo', s.codigo, 'nome', s.nome,
        'tipo_documento', s.tipo_documento, 'ano', s.ano,
        'ativa', s.ativa, 'estado', s.estado, 'empresa_id', s.empresa_id
      ) order by s.ano desc)
      from public.finance_series s
      where s.ativa = true and s.estado = 'ativa'
        and (s.empresa_id is null or s.empresa_id = v_company_id)
    ), '[]'::jsonb),
    'cashboxes', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', c.id, 'codigo', c.codigo, 'nome', c.nome,
        'localizacao', c.localizacao, 'tipo', c.tipo, 'polo_code', c.polo_code,
        'estado', c.estado, 'moeda', c.moeda, 'empresa_id', c.empresa_id
      ) order by c.nome)
      from public.finance_caixas c
      where c.empresa_id = v_company_id
        and c.polo_code = p_polo_code
        and (v_can_open or v_can_receive or public.ciadi_finance_is_staff())
    ), '[]'::jsonb),
    'documents', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', d.id, 'document_no', d.document_no,
        'tipo_documento', d.tipo_documento, 'document_status', d.document_status,
        'data_emissao', d.data_emissao, 'total', d.total,
        'estado_pagamento', d.estado_pagamento, 'fiscal_status', d.fiscal_status,
        'empresa_id', d.empresa_id
      ) order by d.data_emissao desc)
      from (
        select d0.*
        from public.finance_documentos d0
        where d0.empresa_id = v_company_id
          and (
            d0.criado_por = auth.uid()
            or public.ciadi_finance_is_staff()
          )
        order by d0.data_emissao desc
        limit 30
      ) d
    ), '[]'::jsonb),
    'shifts', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', t.id, 'caixa_id', t.caixa_id, 'operador_id', t.operador_id,
        'aberto_em', t.aberto_em, 'saldo_inicial', t.saldo_inicial,
        'estado', t.estado
      ) order by t.aberto_em desc)
      from public.finance_caixa_turnos t
      join public.finance_caixas c on c.id = t.caixa_id
      where t.estado = 'aberto'
        and c.empresa_id = v_company_id
        and (
          t.operador_id = v_operator_id
          or public.ciadi_finance_is_staff()
        )
    ), '[]'::jsonb),
    'operatorId', v_operator_id,
    'canOpenCashbox', v_can_open,
    'canCloseCashbox', v_can_close,
    'canReceivePayments', v_can_receive,
    'canApproveCashClose', v_can_approve_close
  ) into v_result;

  return v_result;
end;
$function$;
