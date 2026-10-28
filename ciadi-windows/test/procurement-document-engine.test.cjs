const test = require('node:test');
const assert = require('node:assert/strict');
const { TYPES, calculateLines, makeDocumentNumber, buildDocument, renderHtml } = require('../procurement-document-engine.js');

test('calculates line discounts, tax and totals consistently', () => {
  const result = calculateLines([
    { description: 'Papel A4', quantity: 2, unitPrice: 1000, discount: 100, taxRate: 14, unit: 'resma' },
    { description: 'Canetas', quantity: 3, unitPrice: 200, discount: 0, taxRate: 0, unit: 'caixa' }
  ]);
  assert.equal(result.subtotal, 2500);
  assert.equal(result.tax, 266);
  assert.equal(result.total, 2766);
});

test('rejects empty lines, negative values and discounts over gross', () => {
  assert.throws(() => calculateLines([]), /pelo menos uma linha/);
  assert.throws(() => calculateLines([{ description: 'Item', quantity: 1, unitPrice: -1 }]), /não negativo/);
  assert.throws(() => calculateLines([{ description: 'Item', quantity: 1, unitPrice: 10, discount: 11 }]), /excede/);
});

test('generates internal reference numbers but does not mark them as fiscal', () => {
  assert.equal(makeDocumentNumber('ordem_compra', '2026-10-28', 7), 'OC/2026/0007');
  const doc = buildDocument({
    type: 'ordem_compra', number: 'OC/2026/0007', date: '2026-10-28',
    organization: { name: 'CIADI', nif: '5001005677' },
    supplier: { name: 'Fornecedor Teste', nif: '123456789' },
    polo: 'Talatona', costCenter: 'CC-001', requester: 'Gestor',
    lines: [{ description: 'Papel A4', quantity: 2, unitPrice: 1000, taxRate: 0 }]
  });
  assert.equal(doc.total, 2000);
  assert.equal(doc.fiscalDocument, false);
  assert.match(doc.warning, /Não substitui fatura/);
  assert.equal(Object.keys(TYPES).length, 9);
});

test('renders safe printable HTML with escaped supplier and item content', () => {
  const doc = buildDocument({
    type: 'pedido_cotacao', date: '2026-10-28',
    supplier: { name: '<script>alert(1)</script>' },
    lines: [{ description: 'Item <b>perigoso</b>', quantity: 1, unitPrice: 100 }]
  });
  const html = renderHtml(doc);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;b&gt;perigoso&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /window\.print\(\)/);
});
