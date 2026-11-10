const test = require('node:test');
const assert = require('node:assert/strict');
const reports = require('../../renderer/modules/cash-reports-module.js');

function makeSupabase(fixtures) {
  const calls = [];
  const client = {
    from(table) {
      const query = {
        table,
        filters: [],
        select(fields) { calls.push({ table, method: 'select', fields }); return this; },
        order(field, options) { calls.push({ table, method: 'order', field, options }); return this; },
        limit(value) { calls.push({ table, method: 'limit', value }); return this; },
        eq(field, value) { calls.push({ table, method: 'eq', field, value }); return this; },
        in(field, values) { calls.push({ table, method: 'in', field, values }); return this; },
        then(resolve, reject) {
          const failure = fixtures.errors?.[table] || null;
          return Promise.resolve({ data: fixtures[table] || [], error: failure }).then(resolve, reject);
        }
      };
      return query;
    }
  };
  return { client, calls };
}

test('cash report repository reads shifts, cash movements and accounting entries by linked payment', async () => {
  const shifts = [{ id: 'shift-1', caixa_id: 'cashbox-1', saldo_inicial: 100, estado: 'fechado' }];
  const movements = [
    { id: 'movement-1', turno_id: 'shift-1', tipo: 'entrada', valor: 100, pagamento_id: 'payment-1', estado: 'confirmado' },
    { id: 'movement-2', turno_id: 'shift-1', tipo: 'saida', valor: 20, pagamento_id: null, estado: 'confirmado' }
  ];
  const entries = [{ id: 'entry-1', origem_tipo: 'PAGAMENTO', origem_id: 'payment-1', estado: 'contabilizado' }];
  const { client, calls } = makeSupabase({
    finance_caixa_turnos: shifts,
    finance_movimentos_caixa: movements,
    finance_lancamentos: entries
  });
  const repository = reports.createCashReportsRepository({ supabase: client });
  const snapshot = await repository.getSnapshot({ limit: 25 });

  assert.deepEqual(snapshot.shifts, shifts);
  assert.deepEqual(snapshot.movements, movements);
  assert.deepEqual(snapshot.accountingEntries, entries);
  assert.deepEqual(calls.filter(call => call.method === 'in'), [
    { table: 'finance_movimentos_caixa', method: 'in', field: 'turno_id', values: ['shift-1'] },
    { table: 'finance_lancamentos', method: 'in', field: 'origem_id', values: ['payment-1'] }
  ]);
  assert.equal(calls.some(call => ['insert', 'update', 'upsert', 'delete'].includes(call.method)), false);
});

test('cash report repository avoids extra queries when there are no shifts or linked payments', async () => {
  const { client, calls } = makeSupabase({ finance_caixa_turnos: [] });
  const repository = reports.createCashReportsRepository({ supabase: client });
  const empty = await repository.getSnapshot();
  assert.deepEqual(empty, { shifts: [], movements: [], accountingEntries: [] });
  assert.deepEqual(calls.map(call => call.table), ['finance_caixa_turnos']);
});

test('cash report rows reconcile counted cash and expose incomplete accounting links', () => {
  const rows = reports.buildCashReportRows({
    shifts: [
      { id: 'shift-1', saldo_inicial: 100, saldo_esperado: 180, saldo_contado: 175, diferenca: -5, estado: 'pendente_aprovacao' }
    ],
    movements: [
      { turno_id: 'shift-1', tipo: 'entrada', valor: 100, pagamento_id: 'payment-1', estado: 'confirmado' },
      { turno_id: 'shift-1', tipo: 'recebimento', valor: 50, pagamento_id: 'payment-2', estado: 'confirmado' },
      { turno_id: 'shift-1', tipo: 'saida', valor: 20, pagamento_id: null, estado: 'confirmado' }
    ],
    accountingEntries: [
      { origem_tipo: 'PAGAMENTO', origem_id: 'payment-1', estado: 'contabilizado' },
      { origem_tipo: 'PAGAMENTO', origem_id: 'payment-2', estado: 'rascunho' }
    ]
  });

  assert.equal(rows[0].totalEntradas, 150);
  assert.equal(rows[0].totalSaidas, 20);
  assert.equal(rows[0].diferenca, -5);
  assert.equal(rows[0].accountingPaymentCount, 2);
  assert.equal(rows[0].accountingPostedCount, 1);
  assert.equal(rows[0].accountingPendingCount, 1);
  assert.equal(rows[0].accountingMissingCount, 0);
  assert.equal(rows[0].accountingStatus, 'Pendente');
});

test('cash report rows mark payments without accounting entries for verification', () => {
  const rows = reports.buildCashReportRows({
    shifts: [{ id: 'shift-2', estado: 'fechado' }],
    movements: [{ turno_id: 'shift-2', tipo: 'entrada', valor: 40, pagamento_id: 'payment-missing', estado: 'confirmado' }],
    accountingEntries: []
  });
  assert.equal(rows[0].accountingMissingCount, 1);
  assert.equal(rows[0].accountingStatus, 'Por verificar');
});
