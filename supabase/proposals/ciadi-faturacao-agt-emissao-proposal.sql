-- CIADI Faturação / AGT — proposta de correcção do motor de emissão
-- NÃO EXECUTAR automaticamente em produção.
-- Pré-requisitos: confirmar o número de validação AGT, product_id/product_version,
-- data de certificação e código/limite AGT da série. A integração JWS/API continua
-- bloqueada na aplicação até existir homologação e testes end-to-end.

create or replace function public.ciadi_faturacao_emitir_documento(p_documento_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  d public.finance_documentos%rowtype;
  e public.finance_empresas%rowtype;
  ec public.finance_emitente_config%rowtype;
  c public.finance_clientes%rowtype;
  s public.finance_series%rowtype;
  t public.finance_tipos_documento%rowtype;
  sw public.finance_agt_software_registos%rowtype;
  v_num bigint;
  v_serie_agt text;
  v_doc_no text;
  v_hash text;
  v_val jsonb;
begin
  if not public.is_staff() then
    raise exception 'Acesso negado';
  end if;

  select * into d
  from public.finance_documentos
  where id = p_documento_id
  for update;

  if not found then
    raise exception 'Documento não encontrado';
  end if;

  if d.document_status = 'N' and d.fiscal_status = 'emitido' then
    return jsonb_build_object(
      'ok', true,
      'idempotente', true,
      'documento_id', d.id,
      'document_no', d.document_no,
      'document_status', d.document_status,
      'fiscal_status', d.fiscal_status
    );
  end if;

  if d.document_status in ('emitido', 'anulado', 'cancelado')
     or d.fiscal_status in ('emitido', 'anulado') then
    raise exception 'Documento em estado legado ou encerrado; requer reconciliação antes de nova emissão';
  end if;

  if d.document_status not in ('em_edicao', 'rascunho')
     or d.fiscal_status not in ('em_edicao', 'rascunho') then
    raise exception 'Documento não está num estado válido para emissão';
  end if;

  perform public.ciadi_faturacao_calcular_documento(p_documento_id);

  select * into d
  from public.finance_documentos
  where id = p_documento_id
  for update;

  select * into e
  from public.finance_empresas
  where id = d.empresa_id and ativo = true;

  if not found then
    raise exception 'Empresa emitente inválida/inactiva';
  end if;

  select * into s
  from public.finance_series
  where id = d.serie_id
    and ativa = true
    and estado = 'ativa'
  for update;

  if not found then
    raise exception 'Série fiscal inválida/inactiva';
  end if;

  if s.empresa_id is not null and s.empresa_id <> d.empresa_id then
    raise exception 'A série fiscal não pertence à empresa emitente';
  end if;

  if nullif(btrim(s.codigo_serie_agt), '') is null
     or s.quantidade_autorizada is null
     or s.quantidade_autorizada <= 0 then
    raise exception 'Série sem código AGT ou quantidade autorizada; emissão fiscal bloqueada';
  end if;

  v_serie_agt := btrim(s.codigo_serie_agt);

  select * into t
  from public.finance_tipos_documento
  where codigo = d.tipo_documento and ativo = true;

  if not found then
    raise exception 'Tipo de documento fiscal não configurado';
  end if;

  select * into c
  from public.finance_clientes
  where id = d.cliente_id and ativo = true;

  if not found then
    raise exception 'Cliente inválido/inactivo';
  end if;

  select * into sw
  from public.finance_agt_software_registos
  where empresa_id = d.empresa_id
    and nullif(btrim(software_validation_number), '') is not null
    and nullif(btrim(product_id), '') is not null
    and nullif(btrim(product_version), '') is not null
    and data_certificacao is not null
    and chave_estado = 'ativa'
  order by data_certificacao desc nulls last, updated_at desc
  limit 1;

  if not found then
    raise exception 'SOFTWARE_AGT_NAO_CERTIFICADO: falta registo de certificação válido para esta empresa';
  end if;

  v_num := greatest(coalesce(s.proximo_numero, 1), 1);

  if v_num > s.quantidade_autorizada then
    raise exception 'A série AGT atingiu a quantidade autorizada';
  end if;

  v_doc_no := d.tipo_documento || ' ' || v_serie_agt || '/' || v_num::text;

  if exists (
    select 1
    from public.finance_documentos
    where serie_id = s.id
      and numero_sequencial = v_num
      and id <> d.id
  ) then
    raise exception 'Conflito de numeração na série fiscal';
  end if;

  select * into ec
  from public.finance_emitente_config
  where ativo = true
    and (empresa_id = d.empresa_id or empresa_id is null)
  order by case when empresa_id = d.empresa_id then 0 else 1 end,
           updated_at desc
  limit 1;

  v_hash := encode(
    extensions.digest(
      convert_to(
        concat_ws(
          '|',
          d.tipo_documento,
          v_doc_no,
          d.data_emissao::text,
          d.cliente_id::text,
          d.subtotal::text,
          d.desconto::text,
          d.imposto::text,
          d.retencao::text,
          d.total::text,
          coalesce((
            select string_agg(
              concat_ws(':', l.codigo, l.quantidade, l.preco_unitario,
                        l.desconto, l.taxa_imposto, l.imposto, l.total_linha),
              '|' order by l.id
            )
            from public.finance_documento_linhas l
            where l.documento_id = d.id
          ), '')
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  update public.finance_series
  set ultimo_numero = v_num,
      proximo_numero = v_num + 1,
      updated_at = now()
  where id = s.id;

  update public.finance_documentos
  set numero_sequencial = v_num,
      document_no = v_doc_no,
      documento_serie = v_serie_agt,
      document_status = 'N',
      fiscal_status = 'emitido',
      agt_submission_status = coalesce(agt_submission_status, 'nao_submetido'),
      data_operacao = coalesce(data_operacao, data_emissao::date),
      hash_documento = v_hash,
      hash_algoritmo = 'SHA-256',
      emitente_razao_social_snapshot = coalesce(e.razao_social, ec.razao_social),
      emitente_nome_comercial_snapshot = coalesce(e.nome_comercial, ec.nome_comercial),
      emitente_nif_snapshot = coalesce(e.nif, ec.nif),
      emitente_morada_snapshot = coalesce(e.morada, ec.morada),
      emitente_provincia_snapshot = coalesce(e.provincia, ec.provincia),
      emitente_municipio_snapshot = coalesce(e.municipio, ec.municipio),
      emitente_telefone_snapshot = coalesce(e.telefone, ec.telefone),
      emitente_email_snapshot = coalesce(e.email, ec.email),
      emitente_website_snapshot = coalesce(e.website, ec.website),
      emitente_logotipo_snapshot = coalesce(e.logotipo_url, ec.logotipo_url),
      emitente_regime_fiscal_snapshot = coalesce(e.regime_fiscal, ec.regime_fiscal),
      adquirente_nome_snapshot = c.nome,
      adquirente_nome_comercial_snapshot = coalesce(c.nome_comercial, c.nome),
      adquirente_nif_snapshot = c.nif,
      adquirente_tipo_snapshot = coalesce(c.tipo_adquirente, c.tipo),
      adquirente_contacto_snapshot = coalesce(c.contacto_principal, c.telefone),
      adquirente_telefone_snapshot = c.telefone,
      adquirente_whatsapp_snapshot = c.whatsapp,
      adquirente_email_snapshot = c.email,
      adquirente_endereco_snapshot = coalesce(c.endereco_faturacao, c.endereco),
      updated_at = now()
  where id = d.id;

  v_val := public.ciadi_validar_documento_fiscal(p_documento_id);

  if coalesce((v_val->>'valido')::boolean, false) = false then
    raise exception 'Documento fiscal inválido após numeração: %', v_val->>'erros';
  end if;

  insert into public.finance_auditoria_fiscal(
    documento_id, evento, estado_anterior, estado_novo, detalhe, utilizador_id
  )
  values (
    d.id,
    'EMISSAO_FISCAL',
    d.fiscal_status,
    'emitido',
    jsonb_build_object(
      'document_no', v_doc_no,
      'serie_agt', v_serie_agt,
      'numero', v_num,
      'hash', v_hash,
      'software_registo_id', sw.id
    ),
    auth.uid()
  );

  return jsonb_build_object(
    'ok', true,
    'documento_id', d.id,
    'document_no', v_doc_no,
    'document_status', 'N',
    'fiscal_status', 'emitido',
    'agt_submission_status', 'nao_submetido',
    'numero', v_num,
    'hash', v_hash
  );
end;
$function$;

-- Verificações após aplicação (não executar nesta fase):
-- 1) A função deve emitir document_status='N' e fiscal_status='emitido'.
-- 2) A validação documental ocorre depois de atribuir série/número.
-- 3) Sem número de certificação, product_id/product_version, data de certificação
--    ou série AGT autorizada, a transacção deve falhar sem consumir o número.
-- 4) O estado AGT permanece 'nao_submetido' até existir integração JWS/API real.
