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

test('exporta PDF apenas de documento emitido e grava o ficheiro escolhido', async () => {
  const h = harness();
  const result = await h.service.exportIssuedPdf({
    document: { id: 'doc-1', status: 'issued', number: 'SUP-INC/2026/000001' },
    html: '<!doctype html><html><body>CIADI</body></html>',
    filename: 'relatorio-incidente.pdf'
  });
  assert.deepEqual(result, { saved: true, filePath: '/tmp/CIADI-documento.pdf' });
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].path, '/tmp/CIADI-documento.pdf');
  assert.equal(h.writes[0].bytes.toString(), '%PDF-test');
  assert.ok(h.calls.some(x => x[0] === 'printToPDF'));
  assert.ok(h.calls.some(x => x[0] === 'close'));
});

test('recusa rascunhos e HTML vazio sem abrir a janela de gravação', async () => {
  const h = harness();
  await assert.rejects(() => h.service.exportIssuedPdf({
    document: { id: 'doc-2', status: 'draft' }, html: '<html/>', filename: 'rascunho.pdf'
  }), /documento emitido/);
  await assert.rejects(() => h.service.exportIssuedPdf({
    document: { id: 'doc-2', status: 'issued' }, html: '', filename: 'vazio.pdf'
  }), /HTML.*obrigatório/);
  assert.equal(h.calls.length, 0);
});

test('trata cancelamento do utilizador sem criar ficheiro', async () => {
  const h = harness({ cancelled: true });
  const result = await h.service.exportIssuedPdf({
    document: { id: 'doc-3', status: 'issued' }, html: '<html/>', filename: 'doc.pdf'
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
  assert.ok(h.calls.some(x => x[0] === 'printToPDF'));
  assert.ok(h.calls.some(x => x[0] === 'close'));
  assert.equal(h.writes.length, 0);
  assert.equal(h.calls.some(x => x[0] === 'dialog'), false);
});

test('recusa HTML vazio na geração dos bytes PDF', async () => {
  const h = harness();
  await assert.rejects(() => h.service.renderPdfBytes({ html: '' }), /HTML.*obrigatório/);
  assert.equal(h.calls.length, 0);
});
