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
  assert.equal(r.ok,true);assert.equal(r.document.status,'draft');assert.equal(r.document.number,null);assert.equal(r.document.verification,null);assert.equal(r.document.title,engine.TEMPLATES.find(x=>x.code==='SUP-INC').title);
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

test('emissão prepara número e QR antes de compor e arquivar o PDF final',async()=>{
  const calls=[];
  const repository={
    prepareIssuance:async id=>{calls.push(['prepare',id]);return {number:'SUP-SUP-INC/2026/000001',token:'abcdefghijklmnopqrstuvwxyz1234567890',verificationUrl:'https://ciadi.ao/validar-documento/doc-1?token=abcdefghijklmnopqrstuvwxyz1234567890',qrDataUrl:'data:image/svg+xml;base64,PHN2Zy8+'};},
    finalizeIssuance:async input=>{calls.push(['finalize',input]);return {document:{id:input.documentId,number:'SUP-SUP-INC/2026/000001',status:'issued'}};}
  };
  const pdfRenderer=async input=>{calls.push(['pdf',input]);return {bytes:new Uint8Array([37,80,68,70]),mimeType:'application/pdf',filename:'documento.pdf'};};
  const renderHtml=async input=>{calls.push(['html',input]);return '<html><body><img src="'+input.qrDataUrl+'"></body></html>';};
  const service=engine.createDocumentService({repository,pdfRenderer});
  const issued=await service.issue('doc-1',{renderHtml,filename:'documento.pdf'});
  assert.equal(issued.document.status,'issued');
  assert.equal(issued.document.number,'SUP-SUP-INC/2026/000001');
  assert.equal(issued.qrDataUrl,'data:image/svg+xml;base64,PHN2Zy8+');
  assert.deepEqual(calls.map(x=>x[0]),['prepare','html','pdf','finalize']);
  assert.ok(calls[2][1].verificationUrl.startsWith('https://'));
  assert.ok(calls[2][1].qrDataUrl.startsWith('data:image/'));
  assert.equal(calls[4][1].token,'abcdefghijklmnopqrstuvwxyz1234567890');
  assert.equal(calls[4][1].artifact.mimeType,'application/pdf');
});
test('emissão não finaliza se o QR ou o PDF falharem',async()=>{
  let finalized=false;
  const repository={
    prepareIssuance:async()=>({number:'SUP-SUP-INC/2026/000002',token:'abcdefghijklmnopqrstuvwxyz1234567890',verificationUrl:'https://ciadi.ao/validar'}),
    finalizeIssuance:async()=>{finalized=true;return {document:{status:'issued'}};}
  };
  const service=engine.createDocumentService({
    repository,
    qrEncoder:async()=>{throw new Error('QR indisponível');},
    pdfRenderer:async()=>({bytes:new Uint8Array([1]),mimeType:'application/pdf'})
  });
  await assert.rejects(()=>service.issue('doc-2',{renderHtml:async()=>'<html/>',filename:'x.pdf'}),/QR indisponível/);
  assert.equal(finalized,false);
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
