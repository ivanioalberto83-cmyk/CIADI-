const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../../renderer/modules/support-workflow-engine.js');

const template = {
  code: 'SUP-REQ', version: 1, title: 'Requisição interna de TI',
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

test('estados de requisição correspondem ao schema ciadi_ti e aprovação é exclusiva da Administração', () => {
  assert.deepEqual(engine.REQUEST_STATES, ['draft','submitted','returned','approved','rejected','received','cancelled']);
  assert.equal(engine.canTransition({from:'draft',to:'submitted',actorRole:'suporte_informatica'}), true);
  assert.equal(engine.canTransition({from:'submitted',to:'approved',actorRole:'suporte_informatica'}), false);
  assert.equal(engine.canTransition({from:'submitted',to:'approved',actorRole:'admin'}), true);
  assert.equal(engine.canTransition({from:'submitted',to:'rejected',actorRole:'gestor'}), true);
  assert.equal(engine.canTransition({from:'approved',to:'received',actorRole:'suporte_informatica'}), true);
});

test('não permite transições fora do fluxo nem mutação do pedido original', () => {
  const request = { id: 'REQ-2', status: 'rejected', history: [] };
  const result = engine.transitionRequest(request, 'received', { id: 'admin-1', role: 'admin' });
  assert.equal(result.ok, false);
  assert.equal(request.status, 'rejected');
});
