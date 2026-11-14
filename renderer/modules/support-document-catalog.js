(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CIADI_SUPPORT_DOCUMENT_CATALOG=api;
})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const MOTORS=Object.freeze([
 {id:'procurement',code:'COM',title:'Compras e Aprovisionamento',description:'Pedidos, cotações, aquisição, fornecedores e recepção de bens.',sources:['ciadi_ti.purchase_requests','ciadi_ti.purchase_request_lines','ciadi_ti.suppliers','ciadi_ti.items']},
 {id:'stock',code:'STK',title:'Armazém e Stock',description:'Entradas, saídas, transferências, contagens e existências.',sources:['ciadi_ti.stock_movements','ciadi_ti.items','ciadi_ti.warehouses','ciadi_ti.inventory_counts','ciadi_ti.inventory_count_lines']},
 {id:'losses',code:'QUE',title:'Quebras, Avarias e Abates',description:'Ocorrências, danos, perdas, quebras, inutilizações e abates.',sources:['ciadi_ti.assets','ciadi_ti.stock_movements','ciadi_ti.audit_events']},
 {id:'assets',code:'PAT',title:'Equipamentos e Património',description:'Cadastro, atribuição, manutenção e localização dos activos.',sources:['ciadi_ti.assets','ciadi_ti.items','ciadi_ti.warehouses']},
 {id:'technical',code:'TEC',title:'Assistência Técnica e Operações',description:'Helpdesk, ordens de trabalho, incidentes e intervenções.',sources:['ciadi_ti.assets','ciadi_ti.audit_events','public.auditoria']},
 {id:'security',code:'SEG',title:'Sistemas, Segurança e Continuidade',description:'Backups, recuperação, acessos, segurança e auditoria técnica.',sources:['ciadi_ti.audit_events','public.auditoria']},
 {id:'administration',code:'ADM',title:'Gestão Administrativa do Suporte',description:'Planos, actas, comunicações, memorandos e relatórios de actividade.',sources:['public.auditoria']},
 {id:'analytics',code:'ANA',title:'Relatórios, Gráficos e Análises',description:'Indicadores calculados a partir dos registos operacionais confirmados.',sources:['ciadi_ti.purchase_requests','ciadi_ti.stock_movements','ciadi_ti.assets','ciadi_ti.inventory_counts','ciadi_ti.audit_events']}
]);
const GROUPS=[
 ['procurement',[
 'Pedido de aquisição','Requisição interna de compra','Pedido de cotação','Mapa comparativo de propostas','Parecer técnico de aquisição','Autorização de compra','Ordem de compra','Nota de encomenda','Ficha de fornecedor','Contrato de fornecimento','Guia de remessa','Nota de recepção de mercadorias','Auto de conferência da entrega','Relatório de divergência de fornecimento','Nota de devolução ao fornecedor','Relatório de compras'
 ]],
 ['stock',[
 'Guia de entrada em armazém','Guia de saída de armazém','Guia de transferência de stock','Guia de devolução de material','Requisição interna de material','Ficha individual de artigo','Ficha de controlo de stock','Mapa de existências','Folha de contagem física','Auto de inventário','Relatório de diferenças de inventário','Relatório de stock mínimo','Relatório de stock máximo','Relatório de produtos sem movimento','Relatório de consumo de materiais'
 ]],
 ['losses',[
 'Relatório de quebra','Relatório de avaria','Participação de ocorrência','Auto de constatação de danos','Relatório de perda ou extravio','Auto de inutilização','Proposta de abate','Auto de abate de equipamento','Relatório de avaliação de danos','Relatório de reposição de material','Histórico de ocorrências por equipamento'
 ]],
 ['assets',[
 'Ficha de equipamento','Termo de atribuição de equipamento','Termo de responsabilidade','Guia de entrega de equipamento','Guia de devolução de equipamento','Auto de transferência de equipamento','Ficha de manutenção','Plano de manutenção preventiva','Relatório de manutenção correctiva','Auto de recolha de equipamento','Relatório de estado do equipamento','Mapa de equipamentos por polo','Inventário de activos informáticos'
 ]],
 ['technical',[
 'Pedido de assistência técnica','Ordem de trabalho','Ficha de intervenção técnica','Relatório de intervenção','Relatório de resolução de incidente','Relatório de falha de sistema','Registo de instalação de software','Registo de configuração','Registo de alteração técnica','Relatório de manutenção de sistemas','Relatório de disponibilidade dos serviços','Relatório de incidentes recorrentes','Acta de verificação técnica','Auto de homologação técnica'
 ]],
 ['security',[
 'Relatório de backup','Relatório de teste de recuperação','Auto de validação de recuperação','Registo de actualização de sistema','Relatório de vulnerabilidades técnicas','Relatório de auditoria informática','Registo de alterações de acessos','Relatório de controlo de utilizadores','Relatório de disponibilidade da rede','Relatório de segurança informática'
 ]],
 ['administration',[
 'Plano anual de actividades','Plano mensal de actividades','Plano de necessidades informáticas','Relatório diário de actividades','Relatório semanal','Relatório mensal','Relatório trimestral','Relatório semestral','Relatório anual','Acta de reunião técnica','Memorando interno','Comunicação interna','Informação técnica','Parecer técnico','Termo de entrega de serviço','Relatório de acompanhamento de tarefas'
 ]],
 ['analytics',[
 'Mapa de despesas de aprovisionamento','Mapa de custos por equipamento','Mapa de custos por polo','Relatório de consumo por departamento','Relatório de compras por fornecedor','Relatório de execução do orçamento informático','Mapa de necessidades de aquisição','Relatório de custos de manutenção','Relatório de perdas e desperdícios','Relatório de eficiência operacional','Gráfico de entradas e saídas de stock','Gráfico de evolução das compras','Gráfico de consumo por período','Gráfico de avarias e quebras','Gráfico de equipamentos por estado','Gráfico de custos por polo','Gráfico de despesas por categoria','Gráfico de desempenho das intervenções','Mapa de stock por armazém','Mapa de necessidades de reposição','Painel de indicadores do Suporte Informática'
 ]]
];
const LEGACY_TEMPLATES=Object.freeze({
 'Requisição interna de compra':'SUP-REQ',
 'Ordem de trabalho':'SUP-OT',
 'Ficha de equipamento':'SUP-EQP',
 'Guia de entrega de equipamento':'SUP-GUI',
 'Ficha de manutenção':'SUP-MAN',
 'Relatório de resolução de incidente':'SUP-INC',
 'Registo de alterações de acessos':'SUP-ACC',
 'Relatório de backup':'SUP-BKP',
 'Acta de verificação técnica':'SUP-HOM',
 'Relatório de intervenção':'SUP-REL'
});

const pf=(key,label,type='text',required=true,options=[])=>Object.freeze({key,label,type,required,options:Object.freeze(options)});
const PROCUREMENT_FORM_FIELDS=Object.freeze({
 'Pedido de aquisição':[
  pf('requester','Unidade requisitante'),pf('department','Departamento'),pf('destination','Polo de destino'),
  pf('need_description','Necessidade a satisfazer','textarea'),pf('estimated_value','Valor estimado (Kz)','number'),
  pf('required_date','Data pretendida','date'),pf('justification','Fundamentação','textarea'),pf('priority','Prioridade','select',true,['Normal','Alta','Urgente'])
 ],
 'Requisição interna de compra':[
  pf('requester','Requisitante'),pf('cost_center','Centro de custo'),pf('item_code','Código do artigo','text',false),
  pf('item_description','Descrição do artigo','textarea'),pf('quantity','Quantidade','number'),pf('unit','Unidade de medida'),
  pf('required_date','Data necessária','date'),pf('purpose','Finalidade','textarea')
 ],
 'Pedido de cotação':[
  pf('quotation_reference','Referência do pedido'),pf('supplier_candidates','Fornecedores convidados','textarea'),
  pf('scope','Objecto da cotação','textarea'),pf('quantity','Quantidade','number'),pf('submission_deadline','Prazo de entrega das propostas','date'),
  pf('delivery_location','Local de entrega'),pf('commercial_conditions','Condições comerciais pretendidas','textarea')
 ],
 'Mapa comparativo de propostas':[
  pf('quotation_reference','Referência da cotação'),pf('supplier_a','Fornecedor A'),pf('price_a','Preço A (Kz)','number'),
  pf('supplier_b','Fornecedor B'),pf('price_b','Preço B (Kz)','number'),pf('supplier_c','Fornecedor C','text',false),
  pf('price_c','Preço C (Kz)','number',false),pf('technical_comparison','Comparação técnica','textarea'),pf('recommended_supplier','Fornecedor recomendado')
 ],
 'Parecer técnico de aquisição':[
  pf('request_reference','Referência da requisição'),pf('technical_requirements','Requisitos técnicos','textarea'),
  pf('compliance_analysis','Análise de conformidade','textarea'),pf('alternatives','Alternativas avaliadas','textarea',false),
  pf('technical_recommendation','Recomendação técnica','textarea'),pf('reviewer','Responsável pelo parecer'),pf('review_date','Data do parecer','date')
 ],
 'Autorização de compra':[
  pf('purchase_request','Pedido de compra'),pf('approved_supplier','Fornecedor proposto'),pf('approved_amount','Montante autorizado (Kz)','number'),
  pf('budget_reference','Referência orçamental'),pf('approval_conditions','Condições da autorização','textarea',false),
  pf('authorization_date','Data da autorização','date'),pf('authorization_reference','Referência da autorização')
 ],
 'Ordem de compra':[
  pf('purchase_order_number','Número da ordem'),pf('supplier','Fornecedor'),pf('supplier_tax_id','NIF do fornecedor'),
  pf('delivery_address','Morada de entrega','textarea'),pf('order_lines','Artigos, quantidades e preços','textarea'),
  pf('total_amount','Valor total (Kz)','number'),pf('delivery_deadline','Prazo de entrega','date'),pf('payment_terms','Condições de pagamento','textarea')
 ],
 'Nota de encomenda':[
  pf('order_reference','Referência da encomenda'),pf('supplier','Fornecedor'),pf('supplier_contact','Contacto do fornecedor'),
  pf('ordered_items','Descrição dos bens/serviços','textarea'),pf('net_amount','Valor líquido (Kz)','number'),
  pf('tax_amount','Impostos (Kz)','number'),pf('gross_amount','Total (Kz)','number'),pf('expected_delivery','Entrega prevista','date')
 ],
 'Ficha de fornecedor':[
  pf('legal_name','Denominação social'),pf('tax_id','NIF'),pf('commercial_registration','Registo comercial','text',false),
  pf('address','Endereço','textarea'),pf('contact_person','Pessoa de contacto'),pf('phone','Telefone'),pf('email','Correio electrónico','text',false),
  pf('bank_details','Dados bancários','textarea',false),pf('supplied_categories','Categorias fornecidas','textarea')
 ],
 'Contrato de fornecimento':[
  pf('contract_reference','Referência do contrato'),pf('supplier_legal_name','Denominação do fornecedor'),pf('supplier_tax_id','NIF'),
  pf('contract_object','Objecto do contrato','textarea'),pf('contract_value','Valor contratual (Kz)','number'),
  pf('start_date','Início de vigência','date'),pf('end_date','Fim de vigência','date'),pf('obligations','Obrigações e condições','textarea')
 ],
 'Guia de remessa':[
  pf('delivery_note_number','Número da guia'),pf('supplier','Fornecedor'),pf('purchase_order','Ordem de compra'),
  pf('dispatch_date','Data de expedição','date'),pf('transport_reference','Referência de transporte','text',false),
  pf('packages','Volumes/embalagens','number'),pf('goods_description','Descrição dos bens','textarea'),pf('destination','Destino')
 ],
 'Nota de recepção de mercadorias':[
  pf('goods_receipt_reference','Referência da recepção'),pf('supplier','Fornecedor'),pf('purchase_order','Ordem de compra'),
  pf('delivery_note','Guia de remessa'),pf('received_date','Data de recepção','date'),pf('received_by','Recebido por'),
  pf('received_quantities','Quantidades recebidas por artigo','textarea'),pf('warehouse','Armazém de entrada')
 ],
 'Auto de conferência da entrega':[
  pf('inspection_reference','Referência do auto'),pf('goods_receipt','Nota de recepção'),pf('inspection_date','Data da conferência','date'),
  pf('inspected_items','Artigos conferidos','textarea'),pf('accepted_quantity','Quantidade aceite','number'),
  pf('damaged_quantity','Quantidade danificada','number'),pf('rejected_quantity','Quantidade rejeitada','number'),
  pf('inspection_result','Resultado da conferência','select',true,['Conforme','Conforme com reservas','Não conforme'])
 ],
 'Relatório de divergência de fornecimento':[
  pf('discrepancy_reference','Referência da divergência'),pf('supplier','Fornecedor'),pf('purchase_order','Ordem de compra'),
  pf('expected_delivery','Entrega esperada','textarea'),pf('actual_delivery','Entrega verificada','textarea'),
  pf('discrepancy_type','Tipo de divergência','select',true,['Falta','Excesso','Dano','Qualidade','Atraso','Outro']),
  pf('impact','Impacto operacional','textarea'),pf('corrective_action','Acção correctiva proposta','textarea')
 ],
 'Nota de devolução ao fornecedor':[
  pf('return_reference','Referência da devolução'),pf('supplier','Fornecedor'),pf('original_receipt','Recepção original'),
  pf('return_date','Data da devolução','date'),pf('returned_items','Artigos e quantidades devolvidas','textarea'),
  pf('return_reason','Motivo da devolução','textarea'),pf('transport_reference','Referência de transporte','text',false),
  pf('supplier_acknowledgement','Comprovativo de recepção do fornecedor','text',false)
 ],
 'Relatório de compras':[
  pf('report_period','Período do relatório'),pf('purchase_count','Número de compras','number'),
  pf('total_committed','Valor total comprometido (Kz)','number'),pf('supplier_breakdown','Compras por fornecedor','textarea'),
  pf('category_breakdown','Compras por categoria','textarea'),pf('delivery_performance','Desempenho das entregas','textarea'),
  pf('variances','Divergências e desvios','textarea'),pf('conclusions','Conclusões e recomendações','textarea')
 ]
});

const sourceFor=m=>m.sources;
const documents=[];
for(const [motorId,titles] of GROUPS){
 const motor=MOTORS.find(x=>x.id===motorId);
 titles.forEach((title,index)=>{
  const outputKind=motorId==='analytics'?(title.startsWith('Gráfico')||title.startsWith('Painel')?'dashboard':'report'):
   (/^Relatório|^Mapa|^Histórico|^Inventário/.test(title)?'report':'document');
  documents.push(Object.freeze({
   code:'SUP-'+motor.code+'-'+String(index+1).padStart(3,'0'),
   title,motorId,outputKind,
   description:title+' do motor '+motor.title+'.',
   dataSources:Object.freeze(sourceFor(motor)),
   formProfile:outputKind==='document'?motorId:'report',
   formFields:motorId==='procurement'?PROCUREMENT_FORM_FIELDS[title]:null,
   lifecycle:outputKind==='document'?Object.freeze(['draft','submitted','validated','approved','issued','archived','cancelled']):Object.freeze(['available','generated','archived']),
   requiresServerNumber:outputKind==='document',
   immutableAfterIssue:outputKind==='document',
   legacyTemplateCode:LEGACY_TEMPLATES[title]||null,
   implementationStatus:LEGACY_TEMPLATES[title]?'draft-template-available':'catalogued'
  }));
 });
}
const frozenDocuments=Object.freeze(documents);
function listMotors(){return MOTORS;}
function listDocuments(){return frozenDocuments;}
function findDocument(code){return frozenDocuments.find(x=>x.code===String(code||'').trim())||null;}
function getDocumentsByMotor(motorId){return frozenDocuments.filter(x=>x.motorId===motorId);}
function validateCatalog(){
 const errors=[],motorIds=new Set(MOTORS.map(x=>x.id)),codes=new Set();
 if(MOTORS.length!==8)errors.push('O catálogo deve conter oito motores.');
 if(frozenDocuments.length!==116)errors.push('O catálogo deve conter 116 tipos.');
 for(const d of frozenDocuments){
  if(codes.has(d.code))errors.push('Código repetido: '+d.code);codes.add(d.code);
  if(!motorIds.has(d.motorId))errors.push('Motor desconhecido: '+d.code);
  if(!['document','report','dashboard'].includes(d.outputKind))errors.push('Saída inválida: '+d.code);
  if(!d.title||!d.description||!d.dataSources.length)errors.push('Metadados incompletos: '+d.code);
 }
 for(const m of MOTORS)if(!getDocumentsByMotor(m.id).length)errors.push('Motor sem documentos: '+m.id);
 return Object.freeze({valid:errors.length===0,errors:Object.freeze(errors),motorCount:MOTORS.length,documentCount:frozenDocuments.length});
}
return Object.freeze({MOTORS,frozenDocuments,listMotors,listDocuments,findDocument,getDocumentsByMotor,validateCatalog});
});
