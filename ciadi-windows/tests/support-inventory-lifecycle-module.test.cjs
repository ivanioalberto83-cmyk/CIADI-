const test = require('node:test');
const assert = require('node:assert/strict');
const lifecycle = require('../../renderer/modules/support-inventory-lifecycle-module.js');

test('resume recepções sem confundir quantidade entregue com quantidade aceite', () => {
  const result = lifecycle.summarizeGoodsReceipts([
    { status: 'draft', received_quantity: 4, accepted_quantity: 0, damaged_quantity: 0, returned_quantity: 0 },
    { status: 'checked', received_quantity: 8, accepted_quantity: 6, damaged_quantity: 2, returned_quantity: 0 },
    { status: 'posted', received_quantity: 5, accepted_quantity: 5, damaged_quantity: 0, returned_quantity: 0 }
  ]);
  assert.deepEqual(result, {
    total: 3, draft: 1, checked: 1, posted: 1,
    receivedQuantity: 17, acceptedQuantity: 11, damagedQuantity: 2, returnedQuantity: 0,
    returns: 0, discrepancies: 1
  });
});

test('identifica faltas, excessos e artigos danificados na conferência', () => {
  const result = lifecycle.summarizeReceiptDiscrepancies([
    { ordered_quantity: 10, received_quantity: 8, accepted_quantity: 8, damaged_quantity: 0 },
    { ordered_quantity: 4, received_quantity: 6, accepted_quantity: 4, damaged_quantity: 2 },
    { ordered_quantity: 3, received_quantity: 3, accepted_quantity: 2, damaged_quantity: 1, returned_quantity: 0 },
    { ordered_quantity: 4, received_quantity: 4, accepted_quantity: 3, damaged_quantity: 0, returned_quantity: 1 }
  ]);
  assert.deepEqual(result, {
    lines: 4, shortages: 1, excesses: 1, damagedLines: 2, returnedLines: 1,
    shortageQuantity: 2, excessQuantity: 2, damagedQuantity: 3, returnedQuantity: 1
  });
});

test('não permite aceitar mais unidades do que as recebidas nem quantidades negativas', () => {
  assert.throws(() => lifecycle.validateReceiptLines([
    { ordered_quantity: 5, received_quantity: 2, accepted_quantity: 3, damaged_quantity: 0, returned_quantity: 0 }
  ]), /aceite não pode exceder/);
  assert.throws(() => lifecycle.validateReceiptLines([
    { ordered_quantity: 5, received_quantity: -1, accepted_quantity: 0, damaged_quantity: 0, returned_quantity: 0 }
  ]), /quantidades não negativas/);
  assert.throws(() => lifecycle.validateReceiptLines([
    { ordered_quantity: 5, received_quantity: 4, accepted_quantity: 2, damaged_quantity: 1, returned_quantity: 2 }
  ]), /aceite, danificada e devolvida/);
});

test('a finalização da recepção delega a gravação transaccional de stock ao RPC do servidor', async () => {
  const calls = [];
  const db = { rpc: async (name, args) => {
    calls.push({ name, args });
    return { data: { receipt_id: 'receipt-1', movement_ids: ['movement-1'] }, error: null };
  }};
  const service = lifecycle.createInventoryLifecycleService({ db, role: 'suporte_informatica', actorId: 'user-1' });
  const result = await service.finalizeGoodsReceipt('receipt-1');
  assert.equal(result.receipt_id, 'receipt-1');
  assert.deepEqual(calls, [{ name: 'finalize_goods_receipt', args: { p_receipt_id: 'receipt-1' } }]);
});

test('não finaliza recepção sem sessão ou com perfil diferente de Suporte Informático', async () => {
  const db = { rpc: async () => { throw new Error('Não deve chamar o servidor.'); } };
  const noSession = lifecycle.createInventoryLifecycleService({ db, role: 'suporte_informatica' });
  await assert.rejects(() => noSession.finalizeGoodsReceipt('receipt-1'), /sessão autenticada/);
  const otherRole = lifecycle.createInventoryLifecycleService({ db, role: 'gestor', actorId: 'user-2' });
  await assert.rejects(() => otherRole.finalizeGoodsReceipt('receipt-1'), /Perfil sem autorização/);
});

test('resume divergências de inventário e não esconde contagens por reconciliar', () => {
  const result = lifecycle.summarizeInventoryReconciliation([
    { status: 'counted', variance: -2 },
    { status: 'counted', variance: 0 },
    { status: 'reconciled', variance: 3 },
    { status: 'draft', variance: null }
  ]);
  assert.deepEqual(result, {
    total: 4, draft: 1, counted: 2, reconciled: 1,
    varianceLines: 2, shortageQuantity: 2, surplusQuantity: 3
  });
});

test('reconcilia contagem através de RPC transaccional e exige utilizador autenticado', async () => {
  const calls = [];
  const db = { rpc: async (name, args) => {
    calls.push({ name, args });
    return { data: { count_id: 'count-1', movements_created: 2 }, error: null };
  }};
  const service = lifecycle.createInventoryLifecycleService({ db, role: 'suporte_informatica', actorId: 'user-1' });
  const result = await service.reconcileInventoryCount('count-1');
  assert.equal(result.movements_created, 2);
  assert.deepEqual(calls, [{ name: 'reconcile_inventory_count', args: { p_count_id: 'count-1' } }]);
});

test('agrega indicadores de aprovisionamento por recepção, divergência e inventário', () => {
  const result = lifecycle.summarizeInventoryOperations({
    receipts: [{ status: 'posted', received_quantity: 5, accepted_quantity: 4, damaged_quantity: 1 }],
    receiptLines: [{ ordered_quantity: 6, received_quantity: 5, accepted_quantity: 4, damaged_quantity: 1 }],
    counts: [{ status: 'counted', variance: -2 }, { status: 'reconciled', variance: 2 }]
  });
  assert.equal(result.receipts.posted, 1);
  assert.equal(result.receipts.acceptedQuantity, 4);
  assert.equal(result.discrepancies.shortages, 1);
  assert.equal(result.inventory.varianceLines, 2);
});

test('cria recepção em rascunho através de RPC e não aceita linhas sem referência à encomenda', async () => {
  const calls = [];
  const db = { rpc: async (name, args) => {
    calls.push({ name, args });
    return { data: { id: 'receipt-2', status: 'draft' }, error: null };
  }};
  const service = lifecycle.createInventoryLifecycleService({ db, role: 'suporte_informatica', actorId: 'user-1' });
  const result = await service.createGoodsReceipt({
    purchaseRequestId: 'request-1',
    warehouseId: 'warehouse-1',
    deliveryReference: 'GUIA-22',
    deliveryDate: '2026-11-08',
    notes: 'Entrega parcial',
    lines: [{
      purchaseRequestLineId: 'line-1', ordered_quantity: 5,
      received_quantity: 4, accepted_quantity: 3, damaged_quantity: 1, returned_quantity: 0,
      unit_cost: 2500, lot_code: 'L-22', notes: 'Uma unidade danificada'
    }]
  });
  assert.equal(result.id, 'receipt-2');
  assert.deepEqual(calls, [{
    name: 'create_goods_receipt',
    args: {
      p_purchase_request_id: 'request-1',
      p_warehouse_id: 'warehouse-1',
      p_delivery_reference: 'GUIA-22',
      p_delivery_date: '2026-11-08',
      p_notes: 'Entrega parcial',
      p_lines: [{
        purchase_request_line_id: 'line-1', received_quantity: 4,
        accepted_quantity: 3, damaged_quantity: 1, returned_quantity: 0, unit_cost: 2500,
        lot_code: 'L-22', notes: 'Uma unidade danificada'
      }]
    }
  }]);
  await assert.rejects(() => service.createGoodsReceipt({
    purchaseRequestId: 'request-1', warehouseId: 'warehouse-1',
    lines: [{ received_quantity: 1, accepted_quantity: 1, damaged_quantity: 0 }]
  }), /referência à linha da encomenda/);
  await assert.rejects(() => service.createGoodsReceipt({
    purchaseRequestId: 'request-1', warehouseId: 'warehouse-1',
    deliveryReference: ' ', lines: [{
      purchaseRequestLineId: 'line-1', received_quantity: 1,
      accepted_quantity: 1, damaged_quantity: 0, returned_quantity: 0
    }]
  }), /documento de entrega/);
});

test('marca recepção conferida através de RPC sem alterar stock antes da finalização', async () => {
  const calls = [];
  const db = { rpc: async (name, args) => {
    calls.push({ name, args });
    return { data: { receipt_id: 'receipt-3', status: 'checked' }, error: null };
  }};
  const service = lifecycle.createInventoryLifecycleService({ db, role: 'suporte_informatica', actorId: 'user-1' });
  const result = await service.checkGoodsReceipt('receipt-3');
  assert.equal(result.status, 'checked');
  assert.deepEqual(calls, [{ name: 'check_goods_receipt', args: { p_receipt_id: 'receipt-3' } }]);
});
