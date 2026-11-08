(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CIADI_SUPPORT_DOCUMENT_ENGINE = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const BRAND = Object.freeze({
    acronym:'CIADI', name:'CENTRO INTEGRADO DE APOIO E DESENVOLVIMENTO INDIVIDUAL',
    palette:Object.freeze({orange:'#f58200',peach:'#ffe7bf',yellow:'#ffdf19',brown:'#6f351f',white:'#fbfdff'}),
    fonts:'Poppins, Inter, Arial, sans-serif', logoAsset:'assets/ciadi-logo.png'
  });
  const f=(key,label,type='text',required=true,options=[])=>Object.freeze({key,label,type,required,options:Object.freeze(options)});
  const TEMPLATES=Object.freeze([
    {code:'SUP-REQ',title:'Requisição interna de material ou equipamento',fields:[f('requester','Requisitante'),f('department','Área solicitante'),f('destination','Polo / localização'),f('item_description','Material / equipamento','textarea'),f('quantity','Quantidade','number'),f('justification','Justificação','textarea'),f('priority','Prioridade','select',true,['Normal','Alta','Urgente'])]},
    {code:'SUP-OT',title:'Ordem de trabalho técnica',fields:[f('work_title','Designação'),f('requester','Solicitante'),f('equipment','Equipamento / sistema'),f('problem','Descrição do problema','textarea'),f('technician','Técnico responsável'),f('scheduled_at','Data prevista','date'),f('result','Trabalho realizado / resultado','textarea',false)]},
    {code:'SUP-EQP',title:'Ficha de equipamento e termo de atribuição',fields:[f('asset_tag','Código patrimonial'),f('description','Descrição'),f('serial_number','Número de série'),f('brand_model','Marca / modelo'),f('assigned_to','Responsável pela guarda'),f('location','Polo / localização'),f('condition','Estado de conservação','select',true,['Novo','Bom','Regular','Danificado','Inoperacional']),f('handover_date','Data de atribuição','date')]},
    {code:'SUP-GUI',title:'Guia de entrega ou devolução',fields:[f('guide_type','Tipo de guia','select',true,['Entrega','Devolução']),f('recipient','Destinatário'),f('destination','Polo / localização'),f('items','Bens e quantidades','textarea'),f('condition','Estado dos bens','textarea'),f('handover_date','Data','date'),f('observations','Observações','textarea',false)]},
    {code:'SUP-MAN',title:'Relatório de manutenção',fields:[f('equipment','Equipamento / sistema'),f('asset_tag','Código patrimonial','text',false),f('maintenance_type','Tipo de manutenção','select',true,['Preventiva','Correctiva']),f('symptoms','Sintomas / diagnóstico','textarea'),f('work_done','Intervenções realizadas','textarea'),f('parts_used','Peças / consumíveis utilizados','textarea',false),f('technician','Técnico responsável'),f('completed_at','Data de conclusão','date')]},
    {code:'SUP-INC',title:'Relatório de incidente informático',fields:[f('incident_title','Incidente'),f('detected_at','Data e hora de detecção'),f('affected_service','Serviço / sistema afectado'),f('impact','Impacto operacional','textarea'),f('actions','Acções tomadas','textarea'),f('root_cause','Causa identificada','textarea',false),f('resolution','Resolução / recomendações','textarea')]},
    {code:'SUP-ACC',title:'Registo de alteração de acesso ou configuração',fields:[f('change_type','Tipo de alteração','select',true,['Acesso','Configuração','Equipamento','Rede','Aplicação']),f('system','Sistema / recurso'),f('request_reference','Referência do pedido'),f('requested_by','Solicitante'),f('performed_by','Responsável técnico'),f('change_description','Descrição da alteração','textarea'),f('validation','Validação efectuada','textarea'),f('performed_at','Data da execução','date')]},
    {code:'SUP-BKP',title:'Relatório de backup e teste de recuperação',fields:[f('system','Sistema / origem'),f('backup_type','Tipo de backup','select',true,['Completo','Incremental','Diferencial']),f('started_at','Início'),f('finished_at','Conclusão'),f('result','Resultado','select',true,['Concluído','Falhou','Parcial']),f('integrity','Verificação de integridade','textarea'),f('restore_test','Resultado do teste de restauro','textarea'),f('evidence_reference','Referência da evidência','text',false)]},
    {code:'SUP-HOM',title:'Acta técnica de verificação e homologação',fields:[f('system','Sistema / módulo'),f('version','Versão avaliada'),f('scope','Âmbito da verificação','textarea'),f('tests','Testes executados','textarea'),f('findings','Resultados / não conformidades','textarea'),f('decision','Conclusão','select',true,['Aprovado','Aprovado com reservas','Reprovado']),f('participants','Participantes','textarea'),f('date','Data','date')]},
    {code:'SUP-REL',title:'Relatório técnico de intervenção',fields:[f('reference','Referência'),f('subject','Assunto'),f('context','Contexto','textarea'),f('analysis','Análise técnica','textarea'),f('actions','Acções executadas','textarea'),f('recommendations','Recomendações','textarea'),f('author','Responsável pela elaboração'),f('date','Data','date')]}
  ].map((t,i)=>Object.freeze({...t,version:1,sequence:i+1,fields:Object.freeze(t.fields)})));
  function clean(v){return String(v??'').trim();}
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function validateTemplate(t){const errors=[];if(!t||!/^[A-Z0-9][A-Z0-9-]{2,19}$/.test(clean(t.code)))errors.push('Código documental inválido.');if(!Number.isInteger(t?.version)||t.version<1)errors.push('Versão do modelo inválida.');if(!Array.isArray(t?.fields)||!t.fields.length)errors.push('O modelo não tem campos.');const seen=new Set();for(const x of t?.fields||[]){if(!/^[a-z][a-z0-9_]{1,39}$/.test(clean(x?.key)))errors.push('Identificador de campo inválido.');else if(seen.has(x.key))errors.push('Campo repetido: '+x.key);else seen.add(x.key);if(!['text','textarea','date','number','select','checkbox'].includes(x?.type||'text'))errors.push('Tipo de campo não suportado.');if(x?.type==='select'&&(!Array.isArray(x.options)||!x.options.length))errors.push('Lista de opções em falta: '+x.key);}return Object.freeze({valid:!errors.length,errors});}
  function validateValues(t,values){const errors=[...validateTemplate(t).errors];if(!values||typeof values!=='object'||Array.isArray(values))return Object.freeze({valid:false,errors:[...errors,'Valores documentais inválidos.']});for(const x of t.fields||[]){const v=values[x.key];if(x.required&&(v===undefined||v===null||clean(v)===''))errors.push('Campo obrigatório: '+x.label);if(x.type==='number'&&v!==undefined&&v!==''&&(!Number.isFinite(Number(v))||Number(v)<0))errors.push('Valor numérico inválido: '+x.label);if(x.type==='select'&&v!==undefined&&v!==''&&!x.options.includes(v))errors.push('Opção inválida: '+x.label);}return Object.freeze({valid:!errors.length,errors});}
  function makeVerificationPayload({documentId,token,verificationBaseUrl}){if(!clean(documentId)||!/^[A-Za-z0-9_-]{24,128}$/.test(clean(token)))throw new Error('Identificador ou token de autenticação inválido.');const base=clean(verificationBaseUrl).replace(/\/$/,'');if(!/^https:\/\//i.test(base))throw new Error('O endereço de autenticação deve usar HTTPS.');return base+'/validar-documento/'+encodeURIComponent(documentId)+'?token='+encodeURIComponent(token);}
  function renderDocumentHtml({template,values,metadata={},qrDataUrl=null,logoDataUrl=null}){const v=validateValues(template,values);if(!v.valid)throw new Error(v.errors.join(' '));const rows=template.fields.map(x=>'<div class="ciadi-field"><span>'+escapeHtml(x.label)+'</span><p>'+escapeHtml(values[x.key])+'</p></div>').join('');const logo=logoDataUrl?'<img class="ciadi-logo" alt="Logótipo CIADI" src="'+escapeHtml(logoDataUrl)+'">':'<div class="ciadi-wordmark">CIADI</div>';const qr=qrDataUrl?'<aside class="ciadi-auth"><img alt="QR Code de autenticação" src="'+escapeHtml(qrDataUrl)+'"><small>Verifique a autenticidade deste documento através do QR Code.</small></aside>':'<aside class="ciadi-auth ciadi-pending">QR Code: por gerar na emissão oficial</aside>';return '<!doctype html><html lang="pt-AO"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeHtml(template.title)+'</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:'+BRAND.fonts+';color:'+BRAND.palette.brown+';font-size:11px;margin:0}.sheet{max-width:180mm;margin:auto}.head{display:flex;align-items:center;justify-content:space-between;border-bottom:4px solid '+BRAND.palette.orange+';padding-bottom:14px}.ciadi-logo{max-width:130px;max-height:65px;object-fit:contain}.ciadi-wordmark{font-size:30px;font-weight:900;color:'+BRAND.palette.orange+'}.org{font-size:9px;font-weight:700;max-width:340px}.doc-meta{text-align:right;font-size:10px}.doc-title{font-size:20px;color:'+BRAND.palette.brown+';margin:24px 0 5px}.sub{color:#64748b;font-size:10px}.fields{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-top:24px}.ciadi-field{border-bottom:1px solid #e5e7eb;min-height:45px;padding:4px 0}.ciadi-field span{font-size:9px;color:'+BRAND.palette.orange+';font-weight:800;text-transform:uppercase}.ciadi-field p{white-space:pre-wrap;margin:5px 0 0;font-size:11px}.foot{display:flex;justify-content:space-between;align-items:end;border-top:1px solid #d1d5db;margin-top:35px;padding-top:12px;font-size:9px;color:#64748b}.ciadi-auth{width:105px;text-align:center}.ciadi-auth img{width:82px;height:82px;object-fit:contain}.ciadi-auth small{display:block;font-size:7px}.ciadi-pending{border:1px dashed #d97706;padding:12px;color:#92400e}.signatures{display:flex;gap:35px;margin-top:45px}.signatures div{flex:1;border-top:1px solid #777;padding-top:6px;font-size:9px}.notice{background:'+BRAND.palette.peach+';padding:9px;margin-top:18px;font-size:9px}</style></head><body><main class="sheet"><header class="head">'+logo+'<div class="org">'+BRAND.name+'</div><div class="doc-meta"><b>'+escapeHtml(metadata.number||'RASCUNHO')+'</b><br>'+escapeHtml(metadata.createdAt||'')+'<br>'+escapeHtml(metadata.status||'Em preparação')+'</div></header><h1 class="doc-title">'+escapeHtml(template.title)+'</h1><div class="sub">Código '+escapeHtml(template.code)+' · Modelo versão '+template.version+'</div><section class="fields">'+rows+'</section><div class="signatures"><div>Elaborado por</div><div>Validação / aprovação, quando aplicável</div></div><div class="notice">Documento institucional CIADI. A validade de um documento emitido deve ser confirmada no serviço oficial de autenticação.</div><footer class="foot"><div>CIADI · Suporte Informática<br>Documento sujeito a controlo de versão e auditoria.</div>'+qr+'</footer></main></body></html>';}
  function createDocumentDraft({templateCode,values,actorId,now}){const t=TEMPLATES.find(x=>x.code===templateCode);if(!t)return Object.freeze({ok:false,errors:['Modelo documental não encontrado.']});const validation=validateValues(t,values);if(!validation.valid)return Object.freeze({ok:false,errors:validation.errors});if(!clean(actorId))return Object.freeze({ok:false,errors:['Autor obrigatório.']});const createdAt=now||new Date().toISOString();return Object.freeze({ok:true,document:Object.freeze({id:null,number:null,title:t.title,templateCode,templateVersion:t.version,values:Object.freeze({...values}),status:'draft',createdBy:clean(actorId),createdAt,issuedAt:null,verification:null,history:Object.freeze([{event:'draft_created',actorId:clean(actorId),at:createdAt}])})});}
  function createDocumentService({repository,qrEncoder,pdfExporter,sender,deliveryRecorder}={}) {
    return Object.freeze({
      async save(document) {
        if(!repository?.saveDraft) throw new Error('Arquivo documental não configurado; não foi gravado qualquer documento.');
        if(!document||document.status!=='draft') throw new Error('Apenas rascunhos podem ser guardados nesta operação.');
        return repository.saveDraft(document);
      },
      async prepareIssue(documentId) {
        if(!clean(documentId)) throw new Error('Identificador documental obrigatório.');
        if(typeof repository?.prepareIssuance!=='function') throw new Error('Preparação segura da emissão no servidor não configurada.');
        const result=await repository.prepareIssuance(documentId);
        if(!result?.documentNumber||!result?.verificationUrl||!result?.qrDataUrl||!result?.expiresAt) {
          throw new Error('O servidor não confirmou a reserva do número e a preparação do QR Code.');
        }
        if(!/^https:\/\//i.test(result.verificationUrl)) throw new Error('A URL de autenticação deve usar HTTPS.');
        return Object.freeze({...result});
      },
      async issuePrepared({documentId,verificationToken,artifact}={}) {
        if(!clean(documentId)||!clean(verificationToken)) throw new Error('Identificador e token da sessão QR são obrigatórios.');
        if(!artifact?.bytes||!clean(artifact.filename)) throw new Error('PDF final obrigatório para emissão.');
        if(typeof repository?.issuePreparedDocument!=='function') throw new Error('Operação transaccional de emissão no servidor não configurada.');
        const result=await repository.issuePreparedDocument({documentId,verificationToken,artifact});
        if(!result?.document||result.document.status!=='issued'||!result.document.number) {
          throw new Error('O servidor não confirmou a emissão documental.');
        }
        return Object.freeze({...result,document:Object.freeze({...result.document})});
      },
      async createQr(payload) {
        if(typeof qrEncoder!=='function') throw new Error('Gerador de QR Code não configurado.');
        if(!/^https:\/\//i.test(clean(payload))) throw new Error('O QR Code só pode apontar para uma URL HTTPS.');
        return qrEncoder(payload);
      },
      async exportPdf(html,filename) {
        if(typeof pdfExporter!=='function') throw new Error('Exportação PDF não configurada.');
        return pdfExporter({html,filename});
      },
      async exportIssuedPdf(document,html,filename) {
        if(!document||document.status!=='issued') throw new Error('A exportação PDF exige um documento emitido.');
        if(!clean(html)||!clean(filename)) throw new Error('Conteúdo e nome do PDF são obrigatórios.');
        if(typeof pdfExporter!=='function') throw new Error('Exportação PDF não configurada.');
        return pdfExporter({html,filename,documentId:document.id});
      },
      async verify(documentId,token) {
        if(typeof repository?.verifyToken!=='function') throw new Error('Serviço de autenticação documental não configurado.');
        if(!clean(documentId)||!clean(token)) throw new Error('Dados de autenticação incompletos.');
        return repository.verifyToken({documentId,token});
      },
      async send(document,destination,artifact) {
        if(typeof sender!=='function') throw new Error('Canal de envio não configurado.');
        if(!clean(destination)) throw new Error('Destinatário obrigatório.');
        if(!document||document.status!=='issued') throw new Error('Só é permitido enviar documentos emitidos.');
        if(!artifact) throw new Error('O PDF final do documento é obrigatório para envio.');
        const result=await sender({document,destination,artifact});
        if(typeof deliveryRecorder!=='function') throw new Error('Registo de entrega não configurado; confirme o estado do envio antes de repetir.');
        await deliveryRecorder({documentId:document.id,destination,result});
        return result;
      }
    });
  }
  return Object.freeze({BRAND,TEMPLATES,validateTemplate,validateValues,makeVerificationPayload,renderDocumentHtml,createDocumentDraft,createDocumentService});
});
