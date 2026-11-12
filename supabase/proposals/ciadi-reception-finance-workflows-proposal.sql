-- CIADI Recepção: cadastro de clientes e criação de facturas em rascunho.
-- Proposta versionada; não aplicar em produção sem aprovação específica.
create or replace function public.reception_create_finance_client(
  p_polo_code text,
  p_empresa_id uuid,
  p_nome text,
  p_tipo_adquirente text default 'particular',
  p_nif text default null,
  p_email text default null,
  p_telefone text default null,
  p_endereco text default null,
  p_cidade text default null,
  p_provincia text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, ciadi_ti, auth
as $$
declare v_id uuid; v_tipo text;
begin
  if auth.uid() is null then raise exception 'Sessão autenticada obrigatória'; end if;
  if p_polo_code not in ('talatona','jardim_de_rosas') then raise exception 'Polo inválido'; end if;
  if not exists (
    select 1 from public.perfis p
    where p.id=auth.uid() and p.ativo=true
      and (p.tipo in ('admin','gestor') or (
        p.tipo='operador' and exists (
          select 1 from ciadi_ti.reception_user_polos rup
          where rup.user_id=p.id and rup.polo_code=p_polo_code and rup.active=true
        )
      ))
  ) then raise exception 'Sem autorização para cadastrar clientes neste polo'; end if;
  if p_empresa_id is null then raise exception 'Empresa obrigatória'; end if;
  if length(trim(coalesce(p_nome,''))) < 2 then raise exception 'Nome/razão social obrigatório'; end if;
  v_tipo := case when lower(coalesce(p_tipo_adquirente,'particular')) in ('empresa','pessoa_colectiva','pessoa_coletiva') then 'empresa' else 'particular' end;
  insert into public.finance_clientes(
    nome,nome_comercial,nif,email,telefone,endereco,cidade,provincia,pais,
    tipo,tipo_adquirente,empresa_id,ativo,created_at,updated_at
  ) values (
    trim(p_nome),trim(p_nome),nullif(trim(p_nif),''),nullif(trim(p_email),''),
    nullif(trim(p_telefone),''),nullif(trim(p_endereco),''),nullif(trim(p_cidade),''),
    nullif(trim(p_provincia),''),'AO',v_tipo,v_tipo,p_empresa_id,true,now(),now()
  ) returning id into v_id;
  return jsonb_build_object('ok',true,'cliente_id',v_id);
end;
$$;

create or replace function public.reception_create_finance_invoice_draft(
  p_polo_code text,
  p_empresa_id uuid,
  p_tipo_documento text,
  p_serie_id uuid,
  p_cliente_id uuid,
  p_servico_id uuid,
  p_quantidade numeric default 1,
  p_data_vencimento date default null,
  p_observacoes text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, ciadi_ti, auth
as $$
declare
  v_id uuid; v_cliente public.finance_clientes%rowtype;
  v_tipo public.finance_tipos_documento%rowtype;
  v_serie public.finance_series%rowtype;
  v_servico public.finance_servicos%rowtype;
  v_base numeric(15,2); v_imposto numeric(15,2); v_total numeric(15,2);
begin
  if auth.uid() is null then raise exception 'Sessão autenticada obrigatória'; end if;
  if p_polo_code not in ('talatona','jardim_de_rosas') then raise exception 'Polo inválido'; end if;
  if not exists (
    select 1 from public.perfis p
    where p.id=auth.uid() and p.ativo=true
      and (p.tipo in ('admin','gestor') or (
        p.tipo='operador' and exists (
          select 1 from ciadi_ti.reception_user_polos rup
          where rup.user_id=p.id and rup.polo_code=p_polo_code and rup.active=true
        )
      ))
  ) then raise exception 'Sem autorização para criar rascunhos neste polo'; end if;
  if p_empresa_id is null or p_cliente_id is null or p_serie_id is null or p_servico_id is null then
    raise exception 'Empresa, cliente, série e serviço são obrigatórios';
  end if;
  if coalesce(p_quantidade,0) <= 0 then raise exception 'Quantidade inválida'; end if;
  select * into v_tipo from public.finance_tipos_documento
   where codigo=p_tipo_documento and ativo=true limit 1;
  if not found then raise exception 'Tipo documental inválido/inactivo'; end if;
  select * into v_serie from public.finance_series
   where id=p_serie_id and ativa=true and estado='ativa'
     and (empresa_id is null or empresa_id=p_empresa_id)
   for share;
  if not found or upper(v_serie.tipo_documento) <> upper(p_tipo_documento) then
    raise exception 'Série inválida para o tipo documental/empresa';
  end if;
  select * into v_cliente from public.finance_clientes
   where id=p_cliente_id and ativo=true and (empresa_id is null or empresa_id=p_empresa_id);
  if not found then raise exception 'Cliente inválido para a empresa'; end if;
  select * into v_servico from public.finance_servicos
   where id=p_servico_id and ativo=true and (empresa_id is null or empresa_id=p_empresa_id);
  if not found then raise exception 'Serviço inválido para a empresa'; end if;
  v_base := round(p_quantidade*v_servico.preco_base,2);
  v_imposto := round(v_base*v_servico.taxa_imposto/100,2);
  v_total := v_base+v_imposto;
  insert into public.finance_documentos(
    tipo_documento,serie_id,numero_sequencial,document_no,document_status,
    cliente_id,data_emissao,data_vencimento,moeda,subtotal,desconto,imposto,
    retencao,total,estado_pagamento,observacoes,criado_por,created_at,updated_at,
    empresa_id,origem_tipo,fiscal_status,agt_submission_status,
    adquirente_nome_snapshot,adquirente_nome_comercial_snapshot,adquirente_nif_snapshot,
    adquirente_tipo_snapshot,adquirente_contacto_snapshot,adquirente_telefone_snapshot,
    adquirente_email_snapshot,adquirente_endereco_snapshot,adquirente_pais_snapshot
  ) values (
    p_tipo_documento,p_serie_id,0,'RASCUNHO-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
    'N',p_cliente_id,now(),p_data_vencimento,
    coalesce((select moeda from public.finance_empresas where id=p_empresa_id),'AOA'),
    v_base,0,v_imposto,0,v_total,'pendente',nullif(trim(p_observacoes),''),auth.uid(),
    now(),now(),p_empresa_id,'MANUAL','rascunho','nao_submetido',
    v_cliente.nome,v_cliente.nome_comercial,v_cliente.nif,v_cliente.tipo_adquirente,
    v_cliente.contacto_principal,v_cliente.telefone,v_cliente.email,v_cliente.endereco,v_cliente.pais
  ) returning id into v_id;
  insert into public.finance_documento_linhas(
    documento_id,servico_id,codigo,descricao,quantidade,unidade,preco_unitario,
    desconto,taxa_imposto,imposto,total_linha,conta_receita
  ) values (
    v_id,v_servico.id,v_servico.codigo,v_servico.nome,p_quantidade,
    coalesce(v_servico.unidade,'UN'),v_servico.preco_base,0,v_servico.taxa_imposto,
    v_imposto,v_total,v_servico.conta_receita
  );
  return jsonb_build_object('ok',true,'documento_id',v_id,'estado','em_edicao','fiscal_status','rascunho','total',v_total);
end;
$$;

revoke all on function public.reception_create_finance_client(text,uuid,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.reception_create_finance_client(text,uuid,text,text,text,text,text,text,text,text) to authenticated;
revoke all on function public.reception_create_finance_invoice_draft(text,uuid,text,uuid,uuid,uuid,numeric,date,text) from public, anon;
grant execute on function public.reception_create_finance_invoice_draft(text,uuid,text,uuid,uuid,uuid,numeric,date,text) to authenticated;


-- Leitura financeira estritamente read-only para utilizadores Recepção atribuídos ao polo.
create or replace function public.reception_get_finance_workspace(p_polo_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, ciadi_ti, auth
as $$
declare v_company_id uuid; v_result jsonb;
begin
  if auth.uid() is null or p_polo_code not in ('talatona','jardim_de_rosas') then
    raise exception 'Sessão ou polo inválido';
  end if;
  if not exists (
    select 1 from public.perfis p
    where p.id=auth.uid() and p.ativo=true
      and (p.tipo in ('admin','gestor') or (
        p.tipo='operador' and exists (
          select 1 from ciadi_ti.reception_user_polos rup
          where rup.user_id=p.id and rup.polo_code=p_polo_code and rup.active=true
        )
      ))
  ) then raise exception 'Sem acesso financeiro para este polo'; end if;
  select id into v_company_id from public.finance_empresas
   where ativo=true and empresa_principal=true order by created_at limit 1;
  if v_company_id is null then
    return jsonb_build_object('companyId',null,'clients','[]'::jsonb,'services','[]'::jsonb,
      'documentTypes','[]'::jsonb,'series','[]'::jsonb,'cashboxes','[]'::jsonb,
      'documents','[]'::jsonb,'shifts','[]'::jsonb);
  end if;
  select jsonb_build_object(
    'companyId',v_company_id,
    'clients',coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'nome',c.nome,'nome_comercial',c.nome_comercial,'nif',c.nif,
      'email',c.email,'telefone',c.telefone,'tipo',c.tipo,'empresa_id',c.empresa_id
    ) order by c.nome) from public.finance_clientes c
      where c.ativo=true and (c.empresa_id is null or c.empresa_id=v_company_id)
      limit 200),'[]'::jsonb),
    'services',coalesce((select jsonb_agg(jsonb_build_object(
      'id',s.id,'codigo',s.codigo,'nome',s.nome,'unidade',s.unidade,
      'preco_base',s.preco_base,'taxa_imposto',s.taxa_imposto,'empresa_id',s.empresa_id
    ) order by s.nome) from public.finance_servicos s
      where s.ativo=true and (s.empresa_id is null or s.empresa_id=v_company_id)
      limit 200),'[]'::jsonb),
    'documentTypes',coalesce((select jsonb_agg(jsonb_build_object(
      'id',t.id,'codigo',t.codigo,'nome',t.nome,'natureza',t.natureza,
      'exige_cliente',t.exige_cliente,'exige_linhas',t.exige_linhas
    ) order by t.nome) from public.finance_tipos_documento t where t.ativo=true),'[]'::jsonb),
    'series',coalesce((select jsonb_agg(jsonb_build_object(
      'id',s.id,'codigo',s.codigo,'nome',s.nome,'tipo_documento',s.tipo_documento,
      'ano',s.ano,'ativa',s.ativa,'estado',s.estado,'empresa_id',s.empresa_id
    ) order by s.ano desc) from public.finance_series s
      where s.ativa=true and s.estado='ativa' and (s.empresa_id is null or s.empresa_id=v_company_id)
    ),'[]'::jsonb),
    'cashboxes','[]'::jsonb,
    'documents',coalesce((select jsonb_agg(jsonb_build_object(
      'id',d.id,'document_no',d.document_no,'tipo_documento',d.tipo_documento,
      'document_status',d.document_status,'data_emissao',d.data_emissao,'total',d.total,
      'estado_pagamento',d.estado_pagamento,'fiscal_status',d.fiscal_status,'empresa_id',d.empresa_id
    ) order by d.data_emissao desc) from (
      select * from public.finance_documentos where empresa_id=v_company_id
        and (criado_por=auth.uid() or exists (select 1 from public.perfis p where p.id=auth.uid() and p.tipo in ('admin','gestor')))
      order by data_emissao desc limit 30
    ) d),'[]'::jsonb),
    'shifts',coalesce((select jsonb_agg(jsonb_build_object(
      'id',t.id,'caixa_id',t.caixa_id,'operador_id',t.operador_id,
      'aberto_em',t.aberto_em,'saldo_inicial',t.saldo_inicial,'estado',t.estado
    ) order by t.aberto_em desc) from public.finance_caixa_turnos t
      where t.estado='aberto' and t.operador_id=auth.uid() limit 20),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.reception_get_finance_workspace(text) from public, anon;
grant execute on function public.reception_get_finance_workspace(text) to authenticated;

-- Leitura de pré-visualização/PDF: apenas documentos criados pelo operador,
-- ou documentos consultados por ADM/Gestão. Não disponibiliza UPDATE/DELETE.
create or replace function public.reception_get_finance_document_print_data(
  p_polo_code text,
  p_document_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, ciadi_ti, auth
as $$
declare v_document public.finance_documentos%rowtype;
        v_client jsonb; v_series jsonb; v_lines jsonb; v_emitter jsonb;
begin
  if auth.uid() is null or p_polo_code not in ('talatona','jardim_de_rosas') then
    raise exception 'Sessão ou polo inválido';
  end if;
  if not exists (
    select 1 from public.perfis p
    where p.id=auth.uid() and p.ativo=true
      and (p.tipo in ('admin','gestor') or (
        p.tipo='operador' and exists (
          select 1 from ciadi_ti.reception_user_polos rup
          where rup.user_id=p.id and rup.polo_code=p_polo_code and rup.active=true
        )
      ))
  ) then raise exception 'Sem acesso documental para este polo'; end if;
  select * into v_document from public.finance_documentos d
   where d.id=p_document_id
     and (d.criado_por=auth.uid() or exists (
       select 1 from public.perfis p where p.id=auth.uid() and p.tipo in ('admin','gestor')
     ));
  if not found then raise exception 'Documento não encontrado ou sem permissão de consulta'; end if;
  select to_jsonb(c) into v_client from public.finance_clientes c where c.id=v_document.cliente_id;
  select to_jsonb(s) into v_series from public.finance_series s where s.id=v_document.serie_id;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at),'[]'::jsonb)
    into v_lines from public.finance_documento_linhas l where l.documento_id=p_document_id;
  select to_jsonb(e) into v_emitter from public.finance_emitente_config e
   where e.ativo=true order by e.updated_at desc limit 1;
  return jsonb_build_object(
    'document',to_jsonb(v_document)||jsonb_build_object('finance_clientes',coalesce(v_client,'{}'::jsonb),'finance_series',coalesce(v_series,'{}'::jsonb)),
    'lines',coalesce(v_lines,'[]'::jsonb),'emitter',coalesce(v_emitter,'{}'::jsonb)
  );
end;
$$;
revoke all on function public.reception_get_finance_document_print_data(text,uuid) from public, anon;
grant execute on function public.reception_get_finance_document_print_data(text,uuid) to authenticated;
