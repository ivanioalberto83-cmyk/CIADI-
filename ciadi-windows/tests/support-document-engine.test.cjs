const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../../renderer/modules/support-document-engine.js');

test('disponibiliza dez modelos documentais técnicos CIADI com códigos únicos',()=>{
  assert.equal(engine.TEMPLATES.length,10);
  assert.equal(new Set(engine.TEMPLATES.map(x=>x.code)).size,10);
  for(const t of engine.TEMPLATES) assert.equal(engine.validateTemplate(t).valid,true);
});
test('valida campos obrigatórios, números e opções dos modelos',()=>{
  const t=engine.TEMPLATES.find(x=>x.code==='SUP-REQ');
  assert.equal(engine.validateValues(t,{}).valid,false);
  assert.equal(engine.validateValues(t,{requester:'Técnico',department:'TI',destination:'Talatona',item_description:'Portátil',quantity:-2,justification:'Substituição',priority:'Urgente'}).valid,false);
  assert.equal(engine.validateValues(t,{requester:'Técnico',department:'TI',destination:'Talatona',item_description:'Portátil',quantity:2,justification:'Substituição',priority:'Urgente'}).valid,true);
});
test('cria rascunho sem atribuir numeração oficial no cliente',()=>{
  const r=engine.createDocumentDraft({templateCode:'SUP-INC',actorId:'user-1',values:{incident_title:'Falha de rede',detected_at:'2026-11-06 10:00',affected_service:'Rede',impact:'Interrupção',actions:'Diagnóstico',resolution:'Serviço restabelecido'}});
  assert.equal(r.ok,true);assert.equal(r.document.status,'draft');assert.equal(r.document.number,null);assert.equal(r.document.verification,null);
});
test('gera HTML A4 com identidade CIADI e escapa valores não confiáveis',()=>{
  const t=engine.TEMPLATES.find(x=>x.code==='SUP-INC');
  const html=engine.renderDocumentHtml({template:t,values:{incident_title:'<script>alert(1)</script>',detected_at:'2026-11-06 10:00',affected_service:'Rede',impact:'Interrupção',actions:'Diagnóstico',resolution:'Restabelecido'}});
  assert.match(html,/CENTRO INTEGRADO DE APOIO E DESENVOLVIMENTO INDIVIDUAL/);assert.match(html,/#f58200/);assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/QR Code: por gerar/);
});
test('QR de autenticação exige URL HTTPS e token aleatório válido',()=>{
  const p=engine.makeVerificationPayload({documentId:'doc-123',token:'Abcdefghijklmnopqrstuvwxyz123456',verificationBaseUrl:'https://ciadi.ao'});
  assert.equal(p,'https://ciadi.ao/validar-documento/doc-123?token=Abcdefghijklmnopqrstuvwxyz123456');
  assert.throws(()=>engine.makeVerificationPayload({documentId:'doc',token:'short',verificationBaseUrl:'http://ciadi.ao'}));
});
test('serviço não simula gravação, exportação ou envio quando os adaptadores faltam',async()=>{
  const s=engine.createDocumentService();
  await assert.rejects(()=>s.save({status:'draft'}),/não foi gravado/);
  await assert.rejects(()=>s.createQr('https://ciadi.ao'),/não configurado/);
  await assert.rejects(()=>s.exportPdf('<html/>','doc.pdf'),/não configurada/);
  await assert.rejects(()=>s.send({status:'issued'},'a@ciadi.ao'),/não configurado/);
});
test('envio exige documento emitido e destinatário',async()=>{
  const s=engine.createDocumentService({sender:async x=>x});
  await assert.rejects(()=>s.send({status:'draft'},'a@ciadi.ao'),/Só é permitido/);
  await assert.rejects(()=>s.send({status:'issued'},''),/Destinatário obrigatório/);
});

test('emissão usa operação atómica do repositório e QR recebe apenas URL de verificação',async()=>{
  const calls=[];
  const repository={
    save:async doc=>({...doc,id:'doc-1'}),
    issue:async id=>{calls.push(['issue',id]);return {document:{id,number:'SUP-INC/2026/000001',status:'issued'},verificationUrl:'https://ciadi.ao/validar-documento/doc-1?token=abcdefghijklmnopqrstuvwxyz123456'};}
  };
  const qrEncoder=async url=>{calls.push(['qr',url]);return 'data:image/png;base64,QR';};
  const pdfExporter=async ({html,filename})=>({filename,bytes:html.length});
  const service=engine.createDocumentService({repository,qrEncoder,pdfExporter});
  const issued=await service.issue('doc-1');
  assert.equal(issued.document.status,'issued');
  assert.equal(issued.document.number,'SUP-INC/2026/000001');
  assert.equal(issued.qrDataUrl,'data:image/png;base64,QR');
  assert.deepEqual(calls[0],['issue','doc-1']);
  assert.match(calls[1][1],/^https:\/\//);
});
test('emissão falha sem operação atómica do servidor e não cria número local',async()=>{
  const service=engine.createDocumentService({repository:{save:async x=>x}});
  await assert.rejects(()=>service.issue('doc-1'),/emissão atómica/);
});
test('PDF só é exportado a partir de documento emitido e HTML final com QR',async()=>{
  let exported;
  const service=engine.createDocumentService({pdfExporter:async x=>(exported=x,{ok:true})});
  await assert.rejects(()=>service.exportIssuedPdf({status:'draft'},'<html/>','draft.pdf'),/documento emitido/);
  await service.exportIssuedPdf({status:'issued'},'<html>QR</html>','issued.pdf');
  assert.match(exported.html,/QR/);
  assert.equal(exported.filename,'issued.pdf');
});
