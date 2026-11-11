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
 'Contrato de fornecimento':'SUP-CON',
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
