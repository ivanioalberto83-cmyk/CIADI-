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
  assert.ok(calls[1][1].verificationUrl.startsWith('https://'));
  assert.ok(calls[1][1].qrDataUrl.startsWith('data:image/'));
  assert.equal(calls[3][1].token,'abcdefghijklmnopqrstuvwxyz1234567890');
  assert.equal(calls[3][1].artifact.mimeType,'application/pdf');
});
test('repete a finalização se a primeira tentativa falhar antes da emissão',async()=>{
  let attempts=0;
  const seen=[];
  const repository={
    prepareIssuance:async()=>({number:'SUP-SUP-INC/2026/000003',token:'abcdefghijklmnopqrstuvwxyz1234567890',verificationUrl:'https://ciadi.ao/validar',qrDataUrl:'data:image/svg+xml;base64,PHN2Zy8+'}),
    finalizeIssuance:async input=>{
      attempts++;seen.push(input);
      if(attempts===1)throw new Error('resposta de rede perdida');
      return {document:{id:input.documentId,number:'SUP-SUP-INC/2026/000003',status:'issued'}};
    }
  };
  const service=engine.createDocumentService({
    repository,
    pdfRenderer:async()=>({bytes:new Uint8Array([37,80,68,70]),mimeType:'application/pdf'})
  });
  const result=await service.issue('doc-retry',{renderHtml:async()=>'<html/>',filename:'retry.pdf'});
  assert.equal(result.document.status,'issued');
  assert.equal(attempts,2);
  assert.equal(seen[0].token,seen[1].token);
  assert.equal(seen[0].artifact.bytes,seen[1].artifact.bytes);
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
  await assert.rejects(()=>service.issue('doc-1'),/fluxo seguro exige preparação e finalização atómicas/);
});
test('exportação descarrega o PDF oficial arquivado sem o voltar a compor',async()=>{
  let downloadedId=null,exported=null;
  const archivedBytes=new Uint8Array([37,80,68,70,45,49]);
  const repository={downloadIssuedPdf:async id=>{downloadedId=id;return {bytes:archivedBytes,mimeType:'application/pdf',filename:'oficial.pdf'};}};
  const service=engine.createDocumentService({repository,pdfExporter:async input=>(exported=input,{saved:true})});
  await assert.rejects(()=>service.exportIssuedPdf({status:'draft',id:'doc-1'},'draft.pdf'),/documento emitido/);
  await service.exportIssuedPdf({status:'issued',id:'doc-1',number:'SUP-REL/2026/000001'},'copia.pdf');
  assert.equal(downloadedId,'doc-1');
  assert.equal(exported.bytes,archivedBytes);
  assert.equal(exported.filename,'copia.pdf');
  assert.equal(exported.mimeType,'application/pdf');
});


test('inclui QR SVG e número reservado no PDF definitivo',()=>{
  const t=engine.TEMPLATES.find(x=>x.code==='SUP-INC');
  const values={incident_title:'Falha de rede',detected_at:'2026-11-06 10:00',affected_service:'Rede',impact:'Interrupção',actions:'Diagnóstico',resolution:'Restabelecido'};
  const html=engine.renderDocumentHtml({template:t,values,metadata:{number:'SUP-SUP-INC/2026/000001',status:'Emitido'},qrDataUrl:'data:image/svg+xml;base64,PHN2Zy8+'});
  assert.ok(html.includes('data:image/svg+xml;base64,PHN2Zy8+'));
  assert.ok(html.includes('SUP-SUP-INC/2026/000001'));
  assert.ok(html.includes('QR Code de autenticação'));
});

test('filtra o arquivo documental por texto e estado sem alterar os registos',()=>{
  const rows=[
    {id:'1',title:'Relatório de manutenção',document_number:'SUP-TEC/2026/000001',document_type_code:'SUP-MAN',status:'issued'},
    {id:'2',title:'Requisição de material',document_number:null,document_type_code:'SUP-REQ',status:'draft'},
    {id:'3',title:'Relatório de incidente',document_number:'SUP-INC/2026/000002',document_type_code:'SUP-INC',status:'issued'}
  ];
  assert.deepEqual(engine.filterDocumentArchive(rows,{query:'manutenção'}).map(x=>x.id),['1']);
  assert.deepEqual(engine.filterDocumentArchive(rows,{status:'draft'}).map(x=>x.id),['2']);
  assert.deepEqual(engine.filterDocumentArchive(rows,{query:'SUP-INC',status:'issued'}).map(x=>x.id),['3']);
  assert.equal(rows.length,3);
});
test('resume o arquivo documental por estado',()=>{
  const summary=engine.summarizeDocumentArchive([
    {status:'draft'},{status:'issued'},{status:'issued'},{status:'cancelled'}
  ]);
  assert.deepEqual(summary,{total:4,drafts:1,issued:2,other:1});
});
