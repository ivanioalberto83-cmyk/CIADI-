-- PROPOSTA APENAS — NÃO EXECUTAR EM PRODUÇÃO SEM HOMOLOGAÇÃO E AUTORIZAÇÃO.
-- CIADI Facturação: alinhar o código documental legado com o estado fiscal do ciclo.
-- Diagnóstico confirmado:
--   finance_documentos_document_status_check aceita apenas N, C, A.
--   A criação gravava 'em_edicao' e a emissão gravava 'emitido' em document_status.
--   finance_registar_pagamento exige document_status='N' e fiscal_status='emitido'.
-- Resultado pretendido:
--   document_status='N' durante o ciclo normal (código documental legado);
--   fiscal_status='em_edicao' enquanto rascunho;
--   fiscal_status='emitido' após emissão fiscal.
-- Não altera dados existentes, grants, RLS, séries, pagamentos ou permissões.

begin;

do $preflight$
declare
  v_constraint text;
begin
  select pg_get_constraintdef(c.oid) into v_constraint
  from pg_constraint c
  join pg_class t on t.oid=c.conrelid
  join pg_namespace n on n.oid=t.relnamespace
  where n.nspname='public'
    and t.relname='finance_documentos'
    and c.conname='finance_documentos_document_status_check';

  if v_constraint is null or v_constraint not like '%N%' then
    raise exception 'Preflight falhou: constraint document_status não confirma o código N.';
  end if;
  if to_regprocedure('public.ciadi_faturacao_criar_documento(uuid,text,uuid,uuid,uuid,uuid,timestamp with time zone,date,text,jsonb)') is null
     or to_regprocedure('public.ciadi_faturacao_emitir_documento(uuid)') is null then
    raise exception 'Preflight falhou: funções centrais de facturação não encontradas.';
  end if;
end
$preflight$;

CREATE OR REPLACE FUNCTION public.ciadi_faturacao_criar_documento(p_empresa_id uuid, p_tipo_documento text, p_serie_id uuid, p_cliente_id uuid, p_paciente_id uuid DEFAULT NULL::uuid, p_agendamento_id uuid DEFAULT NULL::uuid, p_data_emissao timestamp with time zone DEFAULT now(), p_data_vencimento date DEFAULT NULL::date, p_observacoes text DEFAULT NULL::text, p_linhas jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_serie public.finance_series%rowtype;
  v_tipo public.finance_tipos_documento%rowtype;
  v_cliente public.finance_clientes%rowtype;
  v_item jsonb;
  v_servico public.finance_servicos%rowtype;
  v_codigo text;
  v_descricao text;
  v_unidade text;
  v_q numeric;
  v_preco numeric;
  v_desc numeric;
  v_taxa numeric;
  v_imposto numeric;
  v_total numeric;
begin
  if not public.is_staff() then raise exception 'Acesso negado'; end if;
  if p_empresa_id is null then raise exception 'Empresa emitente obrigatória'; end if;
  if p_cliente_id is null then raise exception 'Cliente obrigatório'; end if;
  if jsonb_typeof(p_linhas) <> 'array' or jsonb_array_length(p_linhas)=0 then
    raise exception 'O documento precisa de pelo menos uma linha';
  end if;

  select * into v_tipo
  from public.finance_tipos_documento
  where codigo=p_tipo_documento and ativo=true
  limit 1;
  if not found then raise exception 'Tipo de documento inválido/inativo: %',p_tipo_documento; end if;

  select * into v_serie
  from public.finance_series
  where id=p_serie_id and ativa=true and estado='ativa'
    and (empresa_id is null or empresa_id=p_empresa_id)
  for update;
  if not found then raise exception 'Série inválida/inativa para a empresa'; end if;
  if upper(v_serie.tipo_documento) <> upper(p_tipo_documento) then
    raise exception 'A série não pertence ao tipo de documento';
  end if;

  select * into v_cliente
  from public.finance_clientes
  where id=p_cliente_id and ativo=true
    and (empresa_id is null or empresa_id=p_empresa_id);
  if not found then raise exception 'Cliente inválido/inativo para a empresa'; end if;

  insert into public.finance_documentos(
    tipo_documento,serie_id,numero_sequencial,document_no,document_status,
    agendamento_id,paciente_id,cliente_id,data_emissao,data_vencimento,moeda,
    subtotal,desconto,imposto,retencao,total,estado_pagamento,observacoes,
    criado_por,created_at,updated_at,empresa_id,origem_tipo,fiscal_status
  ) values (
    p_tipo_documento,p_serie_id,0,
    'EM-EDICAO-'||substr(replace(gen_random_uuid()::text,'-',''),1,12),
    'N',
    p_agendamento_id,p_paciente_id,p_cliente_id,coalesce(p_data_emissao,now()),
    p_data_vencimento,coalesce(v_serie.codigo_serie_agt,'AOA')::text,
    0,0,0,0,0,'pendente',p_observacoes,
    auth.uid(),now(),now(),p_empresa_id,
    case when p_agendamento_id is not null then 'AGENDAMENTO' else 'MANUAL' end,
    'em_edicao'
  ) returning id into v_id;

  update public.finance_documentos d
  set moeda=(select coalesce(e.moeda,'AOA') from public.finance_empresas e where e.id=p_empresa_id)
  where d.id=v_id;

  for v_item in select value from jsonb_array_elements(p_linhas)
  loop
    v_codigo:=nullif(trim(v_item->>'codigo'),'');
    v_descricao:=nullif(trim(v_item->>'descricao'),'');
    v_unidade:=coalesce(nullif(trim(v_item->>'unidade'),''),'UN');
    v_q:=greatest(coalesce((v_item->>'quantidade')::numeric,1),0);
    v_preco:=greatest(coalesce((v_item->>'preco_unitario')::numeric,0),0);
    v_desc:=greatest(coalesce((v_item->>'desconto')::numeric,0),0);
    v_taxa:=greatest(coalesce((v_item->>'taxa_imposto')::numeric,0),0);

    if (v_item ? 'servico_id') and nullif(v_item->>'servico_id','') is not null then
      select * into v_servico
      from public.finance_servicos
      where id=(v_item->>'servico_id')::uuid and ativo=true;
      if not found then raise exception 'Serviço inválido/inativo'; end if;
      v_codigo:=coalesce(v_codigo,v_servico.codigo);
      v_descricao:=coalesce(v_descricao,v_servico.nome);
      v_unidade:=coalesce(nullif(v_item->>'unidade',''),v_servico.unidade);
      if not (v_item ? 'preco_unitario') then v_preco:=v_servico.preco_base; end if;
      if not (v_item ? 'taxa_imposto') then v_taxa:=v_servico.taxa_imposto; end if;
    end if;

    if coalesce(v_codigo,'')='' or coalesce(v_descricao,'')='' then
      raise exception 'Cada linha precisa de código e descrição';
    end if;
    if v_q<=0 then raise exception 'Quantidade deve ser maior que zero'; end if;
    if v_desc > round(v_q*v_preco,2) then
      raise exception 'Desconto da linha superior ao valor bruto';
    end if;

    v_imposto:=round((round(v_q*v_preco,2)-round(v_desc,2))*v_taxa/100,2);
    v_total:=round(round(v_q*v_preco,2)-round(v_desc,2)+v_imposto,2);

    insert into public.finance_documento_linhas(
      documento_id,servico_id,codigo,descricao,quantidade,unidade,preco_unitario,
      desconto,taxa_imposto,imposto,total_linha,conta_receita
    ) values (
      v_id,nullif(v_item->>'servico_id','')::uuid,v_codigo,v_descricao,v_q,v_unidade,
      v_preco,v_desc,v_taxa,v_imposto,v_total,v_item->>'conta_receita'
    );
  end loop;

  return public.ciadi_faturacao_calcular_documento(v_id)
         || jsonb_build_object('documento_id',v_id,'estado','em_edicao');
end;
$function$


CREATE OR REPLACE FUNCTION public.ciadi_faturacao_emitir_documento(p_documento_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d public.finance_documentos%rowtype;
  e public.finance_empresas%rowtype;
  ec public.finance_emitente_config%rowtype;
  c public.finance_clientes%rowtype;
  s public.finance_series%rowtype;
  t public.finance_tipos_documento%rowtype;
  v_num bigint;
  v_doc_no text;
  v_hash text;
  v_val jsonb;
begin
  if not public.is_staff() then raise exception 'Acesso negado'; end if;

  select * into d from public.finance_documentos where id=p_documento_id for update;
  if not found then raise exception 'Documento não encontrado'; end if;
  if d.fiscal_status='anulado' or d.document_status in ('anulado','cancelado') then raise exception 'Documento anulado/cancelado'; end if;
  if d.fiscal_status='emitido' then
    return jsonb_build_object('ok',true,'idempotente',true,'documento_id',d.id,'document_no',d.document_no);
  end if;

  v_val:=public.ciadi_validar_documento_fiscal(p_documento_id);
  if coalesce((v_val->>'valido')::boolean,false)=false then
    raise exception 'Documento fiscal inválido: %',v_val->>'erros';
  end if;

  select * into e from public.finance_empresas where id=d.empresa_id and ativo=true;
  if not found then raise exception 'Empresa emitente inválida/inativa'; end if;
  select * into s from public.finance_series where id=d.serie_id and ativa=true and estado='ativa' for update;
  if not found then raise exception 'Série inválida/inativa'; end if;
  if s.empresa_id is not null and s.empresa_id<>d.empresa_id then raise exception 'Série não pertence à empresa'; end if;
  select * into t from public.finance_tipos_documento where codigo=d.tipo_documento and ativo=true;
  if not found then raise exception 'Tipo de documento inválido/inativo'; end if;
  select * into c from public.finance_clientes where id=d.cliente_id and ativo=true;
  if not found then raise exception 'Cliente inválido/inativo'; end if;

  -- Numeração atómica da série, protegida pelo FOR UPDATE.
  v_num:=greatest(s.proximo_numero,1);
  if s.quantidade_autorizada is not null and v_num > s.quantidade_autorizada then
    raise exception 'A série atingiu a quantidade autorizada configurada';
  end if;
  update public.finance_series
  set ultimo_numero=v_num,proximo_numero=v_num+1,updated_at=now()
  where id=s.id;

  v_doc_no:=s.codigo||' '||v_num::text;
  if exists(select 1 from public.finance_documentos where serie_id=s.id and numero_sequencial=v_num and id<>d.id) then
    raise exception 'Conflito de numeração na série';
  end if;

  select * into ec from public.finance_emitente_config
  where ativo=true and (empresa_id=d.empresa_id or empresa_id is null)
  order by case when empresa_id=d.empresa_id then 0 else 1 end,updated_at desc limit 1;

  v_hash:=encode(digest(convert_to(
    concat_ws('|',d.id,d.tipo_documento,s.codigo,v_num,d.data_emissao,d.cliente_id,d.subtotal,d.desconto,d.imposto,d.retencao,d.total,
      coalesce((select string_agg(concat_ws(':',l.codigo,l.quantidade,l.preco_unitario,l.desconto,l.taxa_imposto,l.imposto,l.total_linha),'|'
        order by l.id) from public.finance_documento_linhas l where l.documento_id=d.id),''))
  ,'UTF8'),'sha256'),'hex');

  update public.finance_documentos
  set numero_sequencial=v_num,
      document_no=v_doc_no,
      documento_serie=s.codigo,
      document_status='N',
      fiscal_status='emitido',
      data_operacao=coalesce(data_operacao,data_emissao::date),
      hash_documento=v_hash,
      hash_algoritmo='SHA-256',
      emitente_razao_social_snapshot=coalesce(e.razao_social,ec.razao_social),
      emitente_nome_comercial_snapshot=coalesce(e.nome_comercial,ec.nome_comercial),
      emitente_nif_snapshot=coalesce(e.nif,ec.nif),
      emitente_morada_snapshot=coalesce(e.morada,ec.morada),
      emitente_provincia_snapshot=coalesce(e.provincia,ec.provincia),
      emitente_municipio_snapshot=coalesce(e.municipio,ec.municipio),
      emitente_telefone_snapshot=coalesce(e.telefone,ec.telefone),
      emitente_email_snapshot=coalesce(e.email,ec.email),
      emitente_website_snapshot=coalesce(e.website,ec.website),
      emitente_logotipo_snapshot=coalesce(e.logotipo_url,ec.logotipo_url),
      emitente_regime_fiscal_snapshot=coalesce(e.regime_fiscal,ec.regime_fiscal),
      adquirente_nome_snapshot=c.nome,
      adquirente_nome_comercial_snapshot=coalesce(c.nome_comercial,c.nome),
      adquirente_nif_snapshot=c.nif,
      adquirente_tipo_snapshot=coalesce(c.tipo_adquirente,c.tipo),
      adquirente_contacto_snapshot=coalesce(c.contacto_principal,c.telefone),
      adquirente_telefone_snapshot=c.telefone,
      adquirente_whatsapp_snapshot=c.whatsapp,
      adquirente_email_snapshot=c.email,
      adquirente_endereco_snapshot=coalesce(c.endereco_faturacao,c.endereco),
      updated_at=now()
  where id=d.id;

  insert into public.finance_auditoria_fiscal(documento_id,evento,estado_anterior,estado_novo,detalhe,utilizador_id)
  values(d.id,'EMISSAO_FISCAL',d.fiscal_status,'emitido',
    jsonb_build_object('document_no',v_doc_no,'serie',s.codigo,'numero',v_num,'hash',v_hash),auth.uid());

  return jsonb_build_object('ok',true,'documento_id',d.id,'document_no',v_doc_no,'serie',s.codigo,'numero',v_num,'hash',v_hash);
end;
$function$


comment on function public.ciadi_faturacao_criar_documento(uuid,text,uuid,uuid,uuid,uuid,timestamp with time zone,date,text,jsonb)
is 'Cria rascunho com document_status legado N e fiscal_status em_edicao; a situação fiscal controla o ciclo de emissão.';

comment on function public.ciadi_faturacao_emitir_documento(uuid)
is 'Emite documento fiscal mantendo document_status legado N, compatível com constraint e registo de pagamentos.';

commit;
