-- CIADI — contabilização segura de documentos de faturação
-- PROPOSTA PARA HOMOLOGAÇÃO. NÃO aplicar em produção sem testes, backup validado
-- e autorização explícita. Não ativa emissão fiscal nem validação AGT.
begin;

create or replace function public.ciadi_finance_contabilizar_documento(p_documento_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  d public.finance_documentos%rowtype;
  r public.finance_regras_contabilizacao%rowtype;
  per public.finance_periodos_contabeis%rowtype;
  diario uuid;
  lid uuid;
  base numeric(18,2);
  imposto numeric(18,2);
  total numeric(18,2);
  result jsonb;
  v_estado text;
  linhas_count integer;
begin
  if not public.ciadi_finance_is_staff() then
    raise exception 'Acesso não autorizado';
  end if;

  select * into d
  from public.finance_documentos
  where id = p_documento_id
  for update;

  if not found then
    raise exception 'Documento financeiro não encontrado';
  end if;

  if d.fiscal_status <> 'emitido' or d.document_status <> 'emitido' then
    raise exception 'Só documentos emitidos podem ser contabilizados';
  end if;

  -- Até existir regra própria e testada para NC/ND/RC, não os contabilizar
  -- como se fossem vendas normais.
  if upper(d.tipo_documento) not in ('FT','FR') then
    return jsonb_build_object(
      'ok', false,
      'codigo', 'TIPO_DOCUMENTO_NAO_SUPORTADO',
      'mensagem', 'Este fluxo só contabiliza FT/FR. NC/ND/RC precisam de regras próprias.'
    );
  end if;

  select count(*) into linhas_count
  from public.finance_documento_linhas
  where documento_id = d.id;

  if linhas_count = 0 then
    return jsonb_build_object('ok',false,'codigo','SEM_LINHAS','mensagem','O documento não tem linhas.');
  end if;

  -- Idempotência segura: um lançamento já contabilizado é reutilizado;
  -- um rascunho anterior exige reconciliação, não é silenciosamente aceite.
  select id, estado into lid, v_estado
  from public.finance_lancamentos
  where empresa_id = d.empresa_id
    and origem_tipo = 'DOCUMENTO'
    and origem_id = d.id
  order by created_at desc
  limit 1
  for update;

  if lid is not null then
    if v_estado = 'contabilizado' then
      return jsonb_build_object('ok',true,'idempotente',true,'lancamento_id',lid,'estado','contabilizado');
    end if;
    return jsonb_build_object(
      'ok',false,
      'codigo','LANÇAMENTO_EXISTENTE_PENDENTE',
      'lancamento_id',lid,
      'mensagem','Existe um lançamento não contabilizado para este documento; reconciliar antes de repetir.'
    );
  end if;

  base := round(coalesce(d.subtotal,0) - coalesce(d.desconto,0),2);
  imposto := round(coalesce(d.imposto,0),2);
  total := round(coalesce(d.total,0),2);

  if base < 0 or imposto < 0 or total <= 0 then
    return jsonb_build_object('ok',false,'codigo','VALORES_INVALIDOS','mensagem','Base, imposto ou total inválidos.');
  end if;

  -- Não existe conta de retenção na regra contabilística atual.
  -- Bloquear em vez de gerar um lançamento desequilibrado ou incorreto.
  if round(coalesce(d.retencao,0),2) <> 0 then
    return jsonb_build_object(
      'ok',false,
      'codigo','RETENCAO_SEM_REGRA',
      'mensagem','Configure e valide uma conta/regra de retenção antes de contabilizar este documento.'
    );
  end if;

  if round(base + imposto,2) <> total then
    return jsonb_build_object(
      'ok',false,
      'codigo','TOTAIS_INCONSISTENTES',
      'base',base,
      'imposto',imposto,
      'total',total,
      'mensagem','Base tributável + imposto não coincide com o total do documento.'
    );
  end if;

  select * into per
  from public.finance_periodos_contabeis
  where empresa_id = d.empresa_id
    and d.data_emissao::date between data_inicio and data_fim
    and estado = 'aberto'
  order by data_inicio desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok',false,'codigo','SEM_PERIODO_ABERTO','mensagem','Não existe período contabilístico aberto para a data do documento.');
  end if;

  select id into diario
  from public.finance_diarios
  where empresa_id = d.empresa_id and ativo = true and codigo = 'VEN'
  limit 1;

  if diario is null then
    return jsonb_build_object('ok',false,'codigo','SEM_DIARIO_VENDAS','mensagem','Configure o diário VEN antes de contabilizar.');
  end if;

  select * into r
  from public.finance_regras_contabilizacao
  where empresa_id = d.empresa_id
    and ativo = true
    and upper(operacao) in ('FATURACAO','VENDA','VENDAS')
    and (tipo_documento is null or upper(tipo_documento) = upper(d.tipo_documento))
  order by prioridade asc
  limit 1;

  if not found or r.conta_debito_id is null or r.conta_credito_id is null then
    return jsonb_build_object('ok',false,'codigo','REGRA_INCOMPLETA','mensagem','Configure contas de débito e crédito para faturação.');
  end if;

  if r.conta_debito_id = r.conta_credito_id then
    return jsonb_build_object('ok',false,'codigo','CONTAS_IGUAIS','mensagem','As contas de débito e crédito não podem ser iguais.');
  end if;

  if not exists (
    select 1 from public.finance_contas
    where id = r.conta_debito_id and ativa = true and aceita_lancamentos = true
  ) or not exists (
    select 1 from public.finance_contas
    where id = r.conta_credito_id and ativa = true and aceita_lancamentos = true
  ) then
    return jsonb_build_object('ok',false,'codigo','CONTA_INATIVA','mensagem','As contas de débito/crédito devem estar ativas e aceitar lançamentos.');
  end if;

  if imposto > 0 then
    if r.conta_imposto_id is null or r.conta_imposto_id in (r.conta_debito_id,r.conta_credito_id) then
      return jsonb_build_object('ok',false,'codigo','CONTA_IMPOSTO_INVALIDA','mensagem','Configure uma conta de imposto distinta e válida.');
    end if;
    if not exists (
      select 1 from public.finance_contas
      where id = r.conta_imposto_id and ativa = true and aceita_lancamentos = true
    ) then
      return jsonb_build_object('ok',false,'codigo','CONTA_IMPOSTO_INATIVA','mensagem','A conta de imposto deve estar ativa e aceitar lançamentos.');
    end if;
  end if;

  insert into public.finance_lancamentos (
    data_lancamento, descricao, referencia, documento_id,
    conta_debito_id, conta_credito_id, valor, centro_custo,
    criado_por, empresa_id, diario_id, periodo_id, estado,
    origem_tipo, origem_id, total_debito, total_credito
  ) values (
    d.data_emissao::date,
    'Contabilização automática do documento ' || coalesce(d.document_no,d.id::text),
    d.document_no, d.id, r.conta_debito_id, r.conta_credito_id,
    total, null, auth.uid(), d.empresa_id, diario, per.id, 'rascunho',
    'DOCUMENTO', d.id, 0, 0
  ) returning id into lid;

  insert into public.finance_lancamento_linhas (
    lancamento_id, conta_id, centro_custo_id, descricao, debito, credito, ordem
  ) values (
    lid, r.conta_debito_id, r.centro_custo_id, 'Conta a receber / documento ' || coalesce(d.document_no,''),
    total, 0, 1
  );

  if base > 0 then
    insert into public.finance_lancamento_linhas (
      lancamento_id, conta_id, centro_custo_id, descricao, debito, credito, ordem
    ) values (
      lid, r.conta_credito_id, r.centro_custo_id, 'Receita / documento ' || coalesce(d.document_no,''),
      0, base, 2
    );
  end if;

  if imposto > 0 then
    insert into public.finance_lancamento_linhas (
      lancamento_id, conta_id, centro_custo_id, descricao, debito, credito, ordem
    ) values (
      lid, r.conta_imposto_id, r.centro_custo_id, 'Imposto / documento ' || coalesce(d.document_no,''),
      0, imposto, 3
    );
  end if;

  result := public.ciadi_finance_contabilizar_lancamento(lid);
  if coalesce((result->>'ok')::boolean,false) = false then
    raise exception 'Falha ao validar lançamento contabilístico: %', result;
  end if;

  return result || jsonb_build_object(
    'ok',true,
    'lancamento_id',lid,
    'documento_id',d.id,
    'base',base,
    'imposto',imposto,
    'total',total
  );
end
$function$;

commit;
