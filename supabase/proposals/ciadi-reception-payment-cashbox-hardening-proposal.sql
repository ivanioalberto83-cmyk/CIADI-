-- PROPOSTA APENAS — NÃO APLICAR EM PRODUÇÃO SEM HOMOLOGAÇÃO E AUTORIZAÇÃO.
-- CIADI Recepção: endurecimento transaccional do recebimento e integração obrigatória no caixa.
-- Mantém a factura fiscal emitida imutável; cria o RC e o movimento de caixa na mesma transacção.

create or replace function public.finance_registar_pagamento(
  p_documento_id uuid,
  p_valor numeric,
  p_metodo text,
  p_referencia text default null,
  p_caixa_id uuid default null,
  p_observacoes text default null
)
returns table(
  pagamento_id uuid,
  recibo_id uuid,
  recibo_no text,
  estado_pagamento text
)
language plpgsql
security invoker
set search_path to public
as $function$
declare
  v_actor uuid := auth.uid();
  v_operator_id uuid;
  v_doc public.finance_documentos%rowtype;
  v_pag public.finance_pagamentos%rowtype;
  v_rc public.finance_documentos%rowtype;
  v_serie public.finance_series%rowtype;
  v_caixa public.finance_caixas%rowtype;
  v_turno public.finance_caixa_turnos%rowtype;
  v_num bigint;
  v_restante numeric;
begin
  if v_actor is null then
    raise exception 'Sessão autenticada obrigatória para registar pagamentos';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor de pagamento inválido';
  end if;
  if nullif(trim(p_metodo), '') is null then
    raise exception 'Método de pagamento obrigatório';
  end if;
  if p_caixa_id is null then
    raise exception 'Seleccione um caixa aberto antes de registar o pagamento';
  end if;
  if not public.ciadi_finance_can('receber') or not public.ciadi_finance_can('recibo') then
    raise exception 'O operador não tem autorização para receber pagamentos e emitir recibos';
  end if;
  v_operator_id := public.ciadi_finance_operator_id();
  if v_operator_id is null then
    raise exception 'O utilizador não tem um operador de caixa activo associado';
  end if;

  perform public.finance_recalcular_documento(p_documento_id);

  select * into v_doc
  from public.finance_documentos
  where id = p_documento_id
  for update;

  if not found then
    raise exception 'Documento não encontrado';
  end if;
  if v_doc.document_status <> 'N' or v_doc.fiscal_status <> 'emitido' then
    raise exception 'Só é possível receber documentos com código documental N e estado fiscal emitido';
  end if;

  -- O caixa tem de pertencer à mesma empresa e estar aberto.
  select * into v_caixa
  from public.finance_caixas
  where id = p_caixa_id
    and empresa_id = v_doc.empresa_id
    and estado = 'aberto'
  for update;

  if not found then
    raise exception 'Caixa inexistente, fechado ou pertencente a outra empresa';
  end if;

  -- O operador só pode receber no seu próprio turno aberto.
  select * into v_turno
  from public.finance_caixa_turnos
  where caixa_id = p_caixa_id
    and estado = 'aberto'
    and operador_id = v_operator_id
  order by aberto_em desc
  limit 1
  for update;

  if not found then
    raise exception 'Não existe turno aberto deste operador para o caixa seleccionado';
  end if;

  select coalesce(sum(valor), 0)
    into v_restante
  from public.finance_pagamentos
  where documento_id = p_documento_id;

  if p_valor > v_doc.total - v_restante then
    raise exception 'Pagamento excede o saldo em aberto: %', (v_doc.total - v_restante);
  end if;

  if p_referencia is not null and exists (
    select 1 from public.finance_pagamentos
    where documento_id = p_documento_id and referencia = p_referencia
  ) then
    raise exception 'Referência de pagamento já utilizada neste documento';
  end if;

  insert into public.finance_pagamentos(
    documento_id, valor, metodo, referencia, observacoes, recebido_por, empresa_id
  )
  values (
    p_documento_id, p_valor, trim(p_metodo), p_referencia,
    p_observacoes, v_actor, v_doc.empresa_id
  )
  returning * into v_pag;

  select * into v_serie
  from public.finance_series
  where tipo_documento = 'RC'
    and activa = true
    and (empresa_id = v_doc.empresa_id or empresa_id is null)
  order by (empresa_id is not null) desc, ano desc
  limit 1
  for update;

  if not found then
    raise exception 'Série de recibos activa não configurada';
  end if;

  v_num := v_serie.proximo_numero;
  update public.finance_series
  set ultimo_numero = v_num, proximo_numero = v_num + 1, updated_at = now()
  where id = v_serie.id;

  insert into public.finance_documentos(
    tipo_documento, serie_id, numero_sequencial, document_no, document_status,
    documento_origem_id, paciente_id, cliente_id, data_emissao, moeda,
    subtotal, desconto, imposto, retencao, total, estado_pagamento,
    forma_pagamento, observacoes, data_operacao, documento_serie, origem_tipo,
    fiscal_status, empresa_id
  )
  values (
    'RC', v_serie.id, v_num, v_serie.codigo || '/' || v_num, 'N',
    v_doc.id, v_doc.paciente_id, v_doc.cliente_id, now(), v_doc.moeda,
    p_valor, 0, 0, 0, p_valor, 'pago', trim(p_metodo),
    coalesce(p_observacoes, 'Recibo de pagamento de ' || v_doc.document_no),
    current_date, v_serie.codigo, 'pagamento', 'emitido', v_doc.empresa_id
  )
  returning * into v_rc;

  insert into public.finance_documento_linhas(
    documento_id, codigo, descricao, quantidade, unidade, preco_unitario,
    desconto, taxa_imposto, imposto, total_linha
  )
  values (
    v_rc.id, 'PAG', 'Recebimento de ' || v_doc.document_no, 1, 'UN',
    p_valor, 0, 0, 0, p_valor
  );

  update public.finance_documentos
  set hash_documento = encode(
        extensions.digest(
          concat_ws('|', 'RC', v_serie.codigo, v_num::text, v_doc.id::text, p_valor::text),
          'sha256'
        ),
        'hex'
      ),
      hash_algoritmo = 'SHA-256'
  where id = v_rc.id
  returning * into v_rc;

  -- O movimento é obrigatório e fica ligado ao pagamento, recibo, caixa e turno.
  insert into public.finance_movimentos_caixa(
    caixa_id, tipo, valor, origem, documento_id, pagamento_id, descricao,
    turno_id, operador_id, metodo_pagamento, estado
  )
  values (
    p_caixa_id, 'entrada', p_valor, 'pagamento', v_rc.id, v_pag.id,
    'Recebimento ' || v_rc.document_no, v_turno.id, v_actor,
    trim(p_metodo), 'confirmado'
  );

  update public.finance_documentos d
  set estado_pagamento = case
        when coalesce((
          select sum(valor) from public.finance_pagamentos
          where documento_id = p_documento_id
        ), 0) >= d.total then 'pago'
        else 'parcial'
      end,
      updated_at = now()
  where d.id = p_documento_id;

  insert into public.finance_auditoria_fiscal(
    documento_id, evento, estado_anterior, estado_novo, detalhe, utilizador_id
  )
  values (
    p_documento_id, 'PAGAMENTO', v_doc.estado_pagamento,
    case when v_restante + p_valor >= v_doc.total then 'pago' else 'parcial' end,
    jsonb_build_object(
      'pagamento_id', v_pag.id,
      'valor', p_valor,
      'recibo', v_rc.document_no,
      'caixa_id', p_caixa_id,
      'turno_id', v_turno.id
    ),
    v_actor
  );

  return query
  select v_pag.id, v_rc.id, v_rc.document_no,
    case when v_restante + p_valor >= v_doc.total then 'pago' else 'parcial' end;
end;
$function$;

-- A função só pode ser chamada por utilizadores autenticados.
revoke all on function public.finance_registar_pagamento(uuid, numeric, text, text, uuid, text) from public, anon;
grant execute on function public.finance_registar_pagamento(uuid, numeric, text, text, uuid, text) to authenticated;
