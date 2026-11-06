const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../../renderer/modules/support-transaction-engine.js');

const item = '11111111-1111-4111-8111-111111111111';
const warehouseA = '22222222-2222-4222-8222-222222222222';
const warehouseB = '33333333-3333-4333-8333-333333333333';

function mockDb(response = { data: 'movement-1', error: null }) {
  const calls = [];
  return {
    calls,
    schema(name) {
      assert.equal(name, 'ciadi_ti');
      return { async rpc(fn, args) { calls.push({ fn, args }); return response; } };
    }
  };
}

test('movimento de stock chama a RPC exacta e nunca escreve directamente no ledger', async () => {
  const db = mockDb({ data: 'movement-1', error: null });
  const service = engine.createSupportTransactionService({ db, role: 'suporte_informatica' });
  const id = await service.postStockMovement({
    item_id: item, warehouse_id: warehouseA, movement_type: 'entrada',
    quantity: '4', reference: 'GUIA-01', notes: 'Recepção técnica',
    unit_cost: '1250.50', lot_code: 'LOT-26'
  });
  assert.equal(id, 'movement-1');
  assert.deepEqual(db.calls, [{
    fn: 'post_stock_movement',
    args: {
      p_item_id: item, p_warehouse_id: warehouseA, p_movement_type: 'entrada',
      p_quantity: 4, p_reference: 'GUIA-01', p_notes: 'Recepção técnica',
      p_unit_cost: 1250.5, p_lot_code: 'LOT-26'
    }
  }]);
});

test('transferência usa uma única RPC transaccional com origem e destino distintos', async () => {
  const response = { data: [{ out_movement_id: 'out-1', in_movement_id: 'in-1' }], error: null };
  const db = mockDb(response);
  const service = engine.createSupportTransactionService({ db, role: 'suporte_informatica' });
  assert.deepEqual(await service.transferStock({
    item_id: item, from_warehouse_id: warehouseA, to_warehouse_id: warehouseB,
    quantity: 2, reference: 'TR-01'
  }), response.data);
  assert.equal(db.calls.length, 1);
  assert.equal(db.calls[0].fn, 'transfer_stock');
  assert.equal(db.calls[0].args.p_quantity, 2);
});

test('bloqueia perfis diferentes do Suporte antes de chamar a base de dados', async () => {
  const db = mockDb();
  const service = engine.createSupportTransactionService({ db, role: 'admin' });
  await assert.rejects(() => service.postStockMovement({
    item_id: item, warehouse_id: warehouseA, movement_type: 'entrada', quantity: 1
  }), /apenas na estação Suporte/);
  assert.equal(db.calls.length, 0);
});

test('valida IDs, quantidade, tipo e armazéns antes de chamar a RPC', async () => {
  const db = mockDb();
  const service = engine.createSupportTransactionService({ db, role: 'suporte_informatica' });
  await assert.rejects(() => service.postStockMovement({ item_id: 'x', warehouse_id: warehouseA, movement_type: 'entrada', quantity: 1 }), /Artigo inválido/);
  await assert.rejects(() => service.postStockMovement({ item_id: item, warehouse_id: warehouseA, movement_type: 'transferencia_saida', quantity: 1 }), /Tipo de movimento inválido/);
  await assert.rejects(() => service.postStockMovement({ item_id: item, warehouse_id: warehouseA, movement_type: 'entrada', quantity: 0 }), /superior a zero/);
  await assert.rejects(() => service.transferStock({ item_id: item, from_warehouse_id: warehouseA, to_warehouse_id: warehouseA, quantity: 1 }), /diferentes/);
  assert.equal(db.calls.length, 0);
});

test('propaga erros devolvidos pelo Supabase sem os converter em sucesso', async () => {
  const db = mockDb({ data: null, error: { message: 'Stock insuficiente' } });
  const service = engine.createSupportTransactionService({ db, role: 'suporte_informatica' });
  await assert.rejects(() => service.postStockMovement({
    item_id: item, warehouse_id: warehouseA, movement_type: 'saida', quantity: 9
  }), error => error && error.message === 'Stock insuficiente');
});

test('não permite textos acima dos limites definidos', async () => {
  const db = mockDb();
  const service = engine.createSupportTransactionService({ db, role: 'suporte_informatica' });
  await assert.rejects(() => service.postStockMovement({
    item_id: item, warehouse_id: warehouseA, movement_type: 'entrada', quantity: 1,
    notes: 'x'.repeat(1001)
  }), /limite permitido/);
  assert.equal(db.calls.length, 0);
});
