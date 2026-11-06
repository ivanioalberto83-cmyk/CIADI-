const test = require('node:test');
const assert = require('node:assert/strict');
const support = require('../../renderer/modules/support-operations-module.js');

test('normaliza estados sem transformar ausência de evidência em operacional', () => {
  assert.equal(support.normalizeStatus({ verified: false }), 'Por verificar');
  assert.equal(support.normalizeStatus({ verified: true, ok: true }), 'Operacional');
  assert.equal(support.normalizeStatus({ verified: true, ok: false }), 'Indisponível');
  assert.equal(support.normalizeStatus({ verified: true, warning: true }), 'Atenção');
});

test('agrega eventos de auditoria por acção e por dia sem alterar os registos', () => {
  const rows = [
    { acao: 'LOGIN', created_at: '2026-11-06T08:00:00Z' },
    { acao: 'LOGIN', created_at: '2026-11-06T09:00:00Z' },
    { acao: 'UPDATE', created_at: '2026-11-05T09:00:00Z' }
  ];
  const result = support.aggregateAudit(rows);
  assert.deepEqual(result.byAction, [{ label: 'LOGIN', value: 2 }, { label: 'UPDATE', value: 1 }]);
  assert.equal(result.total, 3);
  assert.equal(rows.length, 3);
});

test('valida modelos documentais com código, versão e campos', () => {
  assert.equal(support.validateDocumentModel({ code: 'SUP-REQ', version: 1, fields: [{ key: 'subject', required: true }] }).valid, true);
  assert.equal(support.validateDocumentModel({ code: '', version: 0, fields: [] }).valid, false);
});

test('calcula indicadores de aprovisionamento sem aprovar compras', () => {
  const result = support.summarizeProcurement([
    { status: 'submitted', category: 'hardware' },
    { status: 'approved', category: 'consumables' },
    { status: 'returned', category: 'hardware' }
  ]);
  assert.equal(result.total, 3);
  assert.equal(result.pending, 2);
  assert.equal(result.approved, 1);
  assert.equal(result.returned, 1);
});


test('trata datas inválidas na auditoria sem interromper a agregação', () => {
  const result = support.aggregateAudit([
    { acao: 'LOGIN', created_at: 'data-inválida' },
    { acao: 'UPDATE', created_at: '2026-11-06T09:00:00Z' }
  ]);
  assert.equal(result.total, 2);
  assert.equal(result.byDay.find(x => x.label === 'Data desconhecida').value, 1);
  assert.equal(result.byDay.find(x => x.label === '2026-11-06').value, 1);
});
