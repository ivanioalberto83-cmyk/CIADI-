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

test('resume os estados reais do aprovisionamento sem misturar aprovação e recepção', () => {
  const result = support.summarizeProcurement([
    { status: 'draft' },
    { status: 'submitted' },
    { status: 'returned' },
    { status: 'approved' },
    { status: 'rejected' },
    { status: 'received' },
    { status: 'cancelled' }
  ]);
  assert.deepEqual(result, {
    total: 7, pending: 2, submitted: 1, returned: 1,
    approved: 1, rejected: 1, received: 1
  });
});


test('serviço de aprovisionamento valida o perfil e os dados antes de criar artigos', async () => {
  const calls = [];
  const db = { from(table) { return { insert(payload) { calls.push({ table, payload }); return { select() { return { single: async () => ({ data: { id: 'item-1', ...payload }, error: null }) }; } }; } }; } };
  const service = support.createProcurementService({ db, role: 'suporte_informatica' });
  const result = await service.createItem({ sku: 'TI-001', name: 'Portátil', item_type: 'equipamento', tracking_mode: 'serialized', minimum_stock: 0 });
  assert.equal(result.data.id, 'item-1');
  assert.equal(calls[0].table, 'items');
  assert.equal(calls[0].payload.sku, 'TI-001');
});

test('serviço de aprovisionamento rejeita perfis sem capacidade e payloads inválidos sem chamar a base de dados', async () => {
  let writes = 0;
  const db = { from() { return { insert() { writes++; return this; } }; } };
  const denied = support.createProcurementService({ db, role: 'operador' });
  await assert.rejects(() => denied.createItem({ sku: 'TI-002', name: 'Rato' }), /Perfil sem autorização/);
  const allowed = support.createProcurementService({ db, role: 'suporte_informatica' });
  await assert.rejects(() => allowed.createItem({ sku: '', name: '', item_type: 'inexistente', tracking_mode: 'x', minimum_stock: -1 }), /Dados do artigo inválidos/);
  assert.equal(writes, 0);
});

test('serviço cria fornecedores e armazéns apenas com os campos permitidos', async () => {
  const calls = [];
  const db = { from(table) { return { insert(payload) { calls.push({ table, payload }); return { select() { return { single: async () => ({ data: payload, error: null }) }; } }; } }; } };
  const service = support.createProcurementService({ db, role: 'admin' });
  await service.createSupplier({ name: 'Fornecedor TI', nif: '5000000000', email: 'vendas@example.ao', active: true, unexpected: 'não gravar' });
  await service.createWarehouse({ code: 'AR-01', name: 'Armazém TI', polo: 'Talatona', active: true, unexpected: 'não gravar' });
  assert.deepEqual(calls.map(x => x.table), ['suppliers', 'warehouses']);
  assert.equal('unexpected' in calls[0].payload, false);
  assert.equal('unexpected' in calls[1].payload, false);
});


test('analisa movimentos de stock por tipo e dia sem tratar a soma líquida como saldo global', () => {
  const rows = [
    { movement_type: 'entrada', quantity_delta: 10, created_at: '2026-11-06T08:00:00Z' },
    { movement_type: 'saida', quantity_delta: -3, created_at: '2026-11-06T09:00:00Z' },
    { movement_type: 'entrada', quantity_delta: 5, created_at: '2026-11-05T09:00:00Z' }
  ];
  const result = support.summarizeStockMovements(rows);
  assert.equal(result.total, 3);
  assert.equal(result.netQuantity, 12);
  assert.equal(result.knownQuantities, 3);
  assert.deepEqual(result.byType, [{ label: 'entrada', value: 2 }, { label: 'saida', value: 1 }]);
  assert.deepEqual(result.byDay, [{ label: '2026-11-05', value: 1 }, { label: '2026-11-06', value: 2 }]);
  assert.equal(rows.length, 3);
});

test('ignora quantidades inválidas na soma e agrupa datas desconhecidas', () => {
  const result = support.summarizeStockMovements([
    { movement_type: 'ajuste_positivo', quantity_delta: 'não-numérico', created_at: 'inválida' },
    { movement_type: 'ajuste_positivo', quantity_delta: 2, created_at: null }
  ]);
  assert.equal(result.total, 2);
  assert.equal(result.netQuantity, 2);
  assert.equal(result.knownQuantities, 1);
  assert.equal(result.byDay.find(x => x.label === 'Data desconhecida').value, 2);
});
