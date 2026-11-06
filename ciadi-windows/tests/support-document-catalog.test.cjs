const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../../renderer/modules/support-document-catalog.js');

test('regista os oito motores e os 116 tipos documentais e analíticos CIADI', () => {
  assert.equal(catalog.listMotors().length, 8);
  assert.equal(catalog.listDocuments().length, 116);
  assert.equal(new Set(catalog.listDocuments().map(x => x.code)).size, 116);
});

test('cada documento pertence a um motor existente e tem saída tipificada', () => {
  const motors = new Set(catalog.listMotors().map(x => x.id));
  for (const item of catalog.listDocuments()) {
    assert.ok(motors.has(item.motorId), item.code + ' sem motor');
    assert.ok(['document', 'report', 'dashboard'].includes(item.outputKind), item.code + ' sem tipo de saída');
    assert.ok(item.title && item.description, item.code + ' sem descrição');
  }
});

test('pesquisa documental por código e filtra por motor', () => {
  assert.equal(catalog.findDocument('SUP-COM-001').title, 'Pedido de aquisição');
  assert.equal(catalog.getDocumentsByMotor('procurement').length, 16);
  assert.equal(catalog.findDocument('NAO-EXISTE'), null);
});

test('gráficos e painéis são definidos como saídas analíticas, não formulários vazios', () => {
  const chart = catalog.listDocuments().find(x => x.title === 'Painel de indicadores do Suporte Informática');
  assert.equal(chart.outputKind, 'dashboard');
  assert.ok(chart.dataSources.length > 0);
  assert.equal(catalog.validateCatalog().valid, true);
});

test('identifica os dez modelos-base já ligados ao motor de rascunhos sem declarar os restantes concluídos', () => {
  const ready = catalog.listDocuments().filter(x => x.implementationStatus === 'draft-template-available');
  assert.equal(ready.length, 10);
  assert.ok(ready.every(x => x.legacyTemplateCode));
  assert.ok(catalog.listDocuments().filter(x => x.implementationStatus === 'catalogued').length > 100);
});
