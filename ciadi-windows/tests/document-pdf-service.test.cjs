const test = require('node:test');
const assert = require('node:assert/strict');
const { createDocumentPdfService } = require('../document-pdf-service.cjs');

function harness({ cancelled = false } = {}) {
  const calls = [];
  const dialog = {
    async showSaveDialog(options) {
      calls.push(['dialog', options]);
      return cancelled ? { canceled: true } : { canceled: false, filePath: '/tmp/CIADI-documento.pdf' };
    }
  };
  const windowFactory = () => ({
    webContents: {
      async loadURL(url) { calls.push(['loadURL', url]); },
      async printToPDF(options) { calls.push(['printToPDF', options]); return Buffer.from('%PDF-test'); }
    },
    async close() { calls.push(['close']); }
  });
  const writes = [];
  const fs = { async writeFile(path, bytes) { writes.push({ path, bytes: Buffer.from(bytes) }); } };
  return { service: createDocumentPdfService({ dialog, windowFactory, fs }), calls, writes };
}

test('exporta apenas o PDF oficial arquivado e grava o ficheiro escolhido', async () => {
  const h = harness();
  const archived = Buffer.from('%PDF-test');
  const result = await h.service.exportIssuedPdf({
    document: { id: 'doc-1', status: 'issued', number: 'SUP-INC/2026/000001' },
    bytes: archived,
    mimeType: 'application/pdf',
    filename: 'relatorio-incidente.pdf'
  });
  assert.deepEqual(result, { saved: true, filePath: '/tmp/CIADI-documento.pdf', source: 'archive' });
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].path, '/tmp/CIADI-documento.pdf');
  assert.equal(h.writes[0].bytes.toString(), '%PDF-test');
  assert.equal(h.calls.some(x => x[0] === 'printToPDF'), false);
});

test('recusa rascunhos e documentos sem bytes oficiais arquivados', async () => {
  const h = harness();
  await assert.rejects(() => h.service.exportIssuedPdf({
    document: { id: 'doc-2', status: 'draft' }, bytes: Buffer.from('%PDF-test'), mimeType: 'application/pdf', filename: 'rascunho.pdf'
  }), /documento emitido/);
  await assert.rejects(() => h.service.exportIssuedPdf({
    document: { id: 'doc-2', status: 'issued' }, filename: 'vazio.pdf'
  }), /bytes.*obrigatórios/);
  assert.equal(h.calls.length, 0);
});

test('trata cancelamento do utilizador sem criar ficheiro', async () => {
  const h = harness({ cancelled: true });
  const result = await h.service.exportIssuedPdf({
    document: { id: 'doc-3', status: 'issued' },
    bytes: Buffer.from('%PDF-test'),
    mimeType: 'application/pdf',
    filename: 'doc.pdf'
  });
  assert.deepEqual(result, { saved: false, cancelled: true });
  assert.equal(h.writes.length, 0);
});

test('inclui o serviço PDF no pacote Windows', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.ok(packageJson.build.files.includes('document-pdf-service.cjs'));
});


test('gera bytes PDF A4 para a emissão antes de abrir a caixa de exportação', async () => {
  const h = harness();
  const bytes = await h.service.renderPdfBytes({
    html: '<!doctype html><html><body>CIADI QR</body></html>'
  });
  assert.ok(bytes instanceof Uint8Array);
  assert.equal(Buffer.from(bytes).toString(), '%PDF-test');
  assert.ok(h.calls.some(x => x[0] === 'loadURL'));
  const printCall = h.calls.find(x => x[0] === 'printToPDF');
  assert.ok(printCall);
  assert.equal(printCall[1].preferCSSPageSize, true);
  assert.ok(h.calls.some(x => x[0] === 'close'));
  assert.equal(h.writes.length, 0);
  assert.equal(h.calls.some(x => x[0] === 'dialog'), false);
});

test('recusa HTML vazio na geração dos bytes PDF', async () => {
  const h = harness();
  await assert.rejects(() => h.service.renderPdfBytes({ html: '' }), /HTML.*obrigatório/);
  assert.equal(h.calls.length, 0);
});


test('exporta os bytes do PDF arquivado sem voltar a renderizar HTML', async () => {
  const h = harness();
  const archived = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);
  const result = await h.service.exportIssuedPdf({
    document: { id: 'doc-archive', status: 'issued', number: 'SUP-REL/2026/000001' },
    bytes: archived,
    mimeType: 'application/pdf',
    filename: 'oficial.pdf'
  });
  assert.deepEqual(result, { saved: true, filePath: '/tmp/CIADI-documento.pdf', source: 'archive' });
  assert.equal(h.writes.length, 1);
  assert.deepEqual([...h.writes[0].bytes], [...archived]);
  assert.equal(h.calls.some(x => x[0] === 'printToPDF'), false);
});

test('recusa bytes arquivados que não tenham assinatura PDF', async () => {
  const h = harness();
  await assert.rejects(() => h.service.exportIssuedPdf({
    document: { id: 'doc-archive', status: 'issued' },
    bytes: new Uint8Array([1, 2, 3, 4, 5]),
    mimeType: 'application/pdf',
    filename: 'invalid.pdf'
  }), /assinatura PDF/);
  assert.equal(h.writes.length, 0);
});
