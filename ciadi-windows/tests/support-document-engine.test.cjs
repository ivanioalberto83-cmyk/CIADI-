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

test('cria rascunho sem atribuir número oficial no cliente',()=>{
  const r=engine.createDocumentDraft({templateCode:'SUP-INC',actorId:'user-1',values:{incident_title:'Falha de rede',detected_at:'2026-11-06 10:00',affected_service:'Rede',impact:'Interrupção',actions:'Diagnóstico',resolution:'Serviço restabelecido'}});
  assert.equal(r.ok,true);
  assert.equal(r.document.status,'draft');
  assert.equal(r.document.number,null);
  assert.equal(r.document.verification,null);
  assert.equal(r.document.title,engine.TEMPLATES.find(x=>x.code==='SUP-INC').title);
});

test('gera HTML A4 com identidade CIADI, QR e valores escapados',()=>{
  const t=engine.TEMPLATES.find(x=>x.code==='SUP-INC');
  const html=engine.renderDocumentHtml({template:t,values:{incident_title:'<script>alert(1)</script>',detected_at:'2026-11-06 10:00',affected_service:'Rede',impact:'Interrupção',actions:'Diagnóstico',resolution:'Restabelecido'},metadata:{number:'SUP-SUP-INC/2026/000001',status:'Emissão pendente'},qrDataUrl:'data:image/svg+xml;base64,PHN2Zz4='});
  assert.match(html,/CENTRO INTEGRADO DE APOIO E DESENVOLVIMENTO INDIVIDUAL/);
  assert.match(html,/#f58200/);
  assert.doesNotMatch(html,/<script>/);
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/QR Code de autenticação/);
  assert.match(html,/SUP-SUP-INC/);
});

test('QR de autenticação exige URL HTTPS e token aleatório válido',()=>{
  const p=engine.makeVerificationPayload({documentId:'doc-123',token:'Abcdefghijklmnopqrstuvwxyz123456',verificationBaseUrl:'https://ciadi.ao'});
  assert.equal(p,'https://ciadi.ao/validar-documento/doc-123?token=Abcdefghijklmnopqrstuvwxyz123456');
  assert.throws(()=>engine.makeVerificationPayload({documentId:'doc',token:'short',verificationBaseUrl:'http://ciadi.ao'}));
});

test('serviço não simula operações quando os adaptadores faltam',async()=>{
  const s=engine.createDocumentService();
  await assert.rejects(()=>s.save({status:'draft'}),/não foi gravado/);
  await assert.rejects(()=>s.prepareIssue('doc-1'),/não configurada/);
  await assert.rejects(()=>s.issuePrepared({documentId:'doc-1',verificationToken:'token',artifact:{bytes:new Uint8Array([1]),filename:'doc.pdf'}}),/não configurada/);
  await assert.rejects(()=>s.createQr('https://ciadi.ao'),/não configurado/);
  await assert.rejects(()=>s.exportPdf('<html/>','doc.pdf'),/não configurada/);
  await assert.rejects(()=>s.send({status:'issued'},'a@ciadi.ao',{bytes:new Uint8Array([1])}),/não configurado/);
});

test('envio exige documento emitido, destinatário e PDF',async()=>{
  const s=engine.createDocumentService({sender:async x=>x,deliveryRecorder:async()=>true});
  await assert.rejects(()=>s.send({status:'draft'},'a@ciadi.ao',{bytes:new Uint8Array([1])}),/Só é permitido/);
  await assert.rejects(()=>s.send({status:'issued'},'',{bytes:new Uint8Array([1])}),/Destinatário obrigatório/);
  await assert.rejects(()=>s.send({status:'issued'},'a@ciadi.ao',null),/PDF final/);
});

test('prepara QR e reserva número antes da emissão; depois emite PDF com QR',async()=>{
  const calls=[];
  const repository={
    prepareIssuance:async id=>{
      calls.push(['prepare',id]);
      return {documentId:id,documentNumber:'SUP-SUP-INC/2026/000001',verificationUrl:'https://ciadi.ao/functions/v1/ciadi-ti-verify-document?document_id=doc-1&token=abcdefghijklmnopqrstuvwxyz123456789ABCDEFG',qrDataUrl:'data:image/svg+xml;base64,PHN2Zz4=',expiresAt:'2026-11-08T11:20:00Z'};
    },
    issuePreparedDocument:async payload=>{
      calls.push(['issue',payload]);
      return {document:{id:payload.documentId,number:'SUP-SUP-INC/2026/000001',status:'issued'},verificationUrl:'https://ciadi.ao/functions/v1/ciadi-ti-verify-document?document_id=doc-1&token=abcdefghijklmnopqrstuvwxyz123456789ABCDEFG'};
    }
  };
  const service=engine.createDocumentService({repository});
  const prepared=await service.prepareIssue('doc-1');
  assert.equal(prepared.documentNumber,'SUP-SUP-INC/2026/000001');
  assert.match(prepared.verificationUrl,/^https:\/\//);
  assert.match(prepared.qrDataUrl,/^data:image\/svg\+xml/);
  const issued=await service.issuePrepared({documentId:'doc-1',verificationToken:'abcdefghijklmnopqrstuvwxyz123456789ABCDEFG',artifact:{bytes:new Uint8Array([37,80,68,70]),filename:'documento.pdf'}});
  assert.equal(issued.document.status,'issued');
  assert.equal(issued.document.number,prepared.documentNumber);
  assert.equal(calls[0][0],'prepare');
  assert.equal(calls[1][0],'issue');
  assert.equal(calls[1][1].artifact.filename,'documento.pdf');
});

test('preparação exige número reservado, QR e URL HTTPS confirmados pelo servidor',async()=>{
  const service=engine.createDocumentService({repository:{prepareIssuance:async()=>({documentNumber:'SUP-1'})}});
  await assert.rejects(()=>service.prepareIssue('doc-1'),/servidor não confirmou/);
});

test('emissão falha sem operação transaccional do servidor e não cria número local',async()=>{
  const service=engine.createDocumentService({repository:{saveDraft:async x=>x}});
  await assert.rejects(()=>service.issuePrepared({documentId:'doc-1',verificationToken:'token',artifact:{bytes:new Uint8Array([1]),filename:'doc.pdf'}}),/não configurada/);
});

test('PDF só é exportado a partir de documento emitido',async()=>{
  let exported;
  const service=engine.createDocumentService({pdfExporter:async x=>(exported=x,{ok:true})});
  await assert.rejects(()=>service.exportIssuedPdf({status:'draft'},'<html/>','draft.pdf'),/documento emitido/);
  await service.exportIssuedPdf({status:'issued'},'<html>QR</html>','issued.pdf');
  assert.match(exported.html,/QR/);
  assert.equal(exported.filename,'issued.pdf');
});
