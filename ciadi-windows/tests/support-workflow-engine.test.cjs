const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../../renderer/modules/support-workflow-engine.js');

const template = {
  code: 'SUP-REQ',
  version: 1,
  title: 'Requisição interna de TI',
  fields: [
    { key: 'subject', label: 'Necessidade', required: true, type: 'text' },
    { key: 'quantity', label: 'Quantidade', required: true, type: 'number' }
  ]
};

test('valida modelos e campos obrigatórios antes de criar documento', () => {
  assert.equal(engine.validateTemplate(template).valid, true);
  assert.equal(engine.validateValues(template, { subject: 'Portátil', quantity: 2 }).valid, true);
  assert.equal(engine.validateValues(template, { subject: '', quantity: 'x' }).valid, false);
});

test('gera numeração documental previsível e valida parâmetros', () => {
  assert.equal(engine.makeDocumentNumber('SUP-REQ', 12, 2026), 'SUP-REQ/2026/00012');
  assert.throws(() => engine.makeDocumentNumber('SUP', 0, 2026));
});

test('cria rascunho, emite documento imutável e preserva histórico', () => {
  const created = engine.createDraft({
    template, values: { subject: 'Portátil', quantity: 2 },
    actorId: 'user-1', number: 'SUP-REQ/2026/00001', now: '2026-11-06T10:00:00Z'
  });
  assert.equal(created.ok, true);
  const issued = engine.issueDocument(created.document, 'user-2', '2026-11-06T10:05:00Z');
  assert.equal(issued.ok, true);
  assert.equal(issued.document.status, 'emitido');
  assert.equal(issued.document.history.length, 2);
  assert.equal(created.document.status, 'rascunho');
  assert.equal(engine.issueDocument(issued.document, 'user-3').ok, false);
});

test('pré-visualização escapa conteúdo HTML', () => {
  const html = engine.renderPreview(template, { subject: '<script>alert(1)</script>', quantity: 1 });
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
});

test('Suporte pode submeter e validar tecnicamente, mas não aprovar compras', () => {
  const request = { id: 'REQ-1', status: 'rascunho', history: [] };
  const submitted = engine.transitionRequest(request, 'submetida', {
    id: 'support-1', role: 'suporte_informatica', at: '2026-11-06T10:00:00Z'
  });
  assert.equal(submitted.ok, true);
  const validation = engine.transitionRequest(submitted.request, 'em_validacao_tecnica', {
    id: 'support-1', role: 'suporte_informatica'
  });
  assert.equal(validation.ok, true);
  const pending = engine.transitionRequest(validation.request, 'pendente_aprovacao_administracao', {
    id: 'support-1', role: 'suporte_informatica'
  });
  assert.equal(pending.ok, true);
  assert.equal(engine.transitionRequest(pending.request, 'aprovada', {
    id: 'support-1', role: 'suporte_informatica'
  }).ok, false);
  assert.equal(engine.transitionRequest(pending.request, 'aprovada', {
    id: 'admin-1', role: 'admin'
  }).ok, true);
});

test('não permite transições fora do fluxo nem mutação do pedido original', () => {
  const request = { id: 'REQ-2', status: 'rejeitada', history: [] };
  const result = engine.transitionRequest(request, 'em_aquisicao', {
    id: 'admin-1', role: 'admin'
  });
  assert.equal(result.ok, false);
  assert.equal(request.status, 'rejeitada');
});
