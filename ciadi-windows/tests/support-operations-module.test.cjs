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
  const service = support.createProcurementService({ db, role: 'suporte_informatica' });
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


test('estação Suporte Informática não concede gestão de aprovisionamento a perfis administrativos ou de gestão', async () => {
  const db = { from() { throw new Error('A base de dados não deve ser chamada.'); } };
  for (const role of ['admin', 'gestor', 'operador', null]) {
    const service = support.createProcurementService({ db, role });
    await assert.rejects(
      () => service.createItem({ sku: 'TI-SEC-01', name: 'Equipamento', item_type: 'equipamento', tracking_mode: 'quantity' }),
      /Perfil sem autorização/
    );
  }
});

test('calcula saldos estimados por artigo, armazém e lote a partir do razão de movimentos',()=>{
  const result=support.summarizeStockBalances(
    [{id:'i1',sku:'TI-01',name:'Cabo',minimum_stock:3}],
    [{id:'w1',name:'Armazém central'}],
    [
      {item_id:'i1',warehouse_id:'w1',lot_code:'L1',quantity_delta:5},
      {item_id:'i1',warehouse_id:'w1',lot_code:'L1',quantity_delta:-1},
      {item_id:'i1',warehouse_id:'w1',lot_code:'L2',quantity_delta:2}
    ]
  );
  assert.equal(result.length,2);
  assert.equal(result.find(x=>x.lot_code==='L1').quantity,4);
  assert.equal(result.find(x=>x.lot_code==='L2').quantity,2);
  assert.equal(result.find(x=>x.lot_code==='L2').below_minimum,true);
});
test('cria pedido de aquisição em rascunho com linhas e total estimado',async()=>{
  const calls=[];
  const db={from(table){
    let payload;
    const q={
      insert(value){payload=value;calls.push({table,payload:value});return q;},
      select(){return q;},
      single(){return Promise.resolve({data:table==='purchase_requests'?{id:'req-1',request_number:12,...payload}:payload,error:null});},
      then(resolve,reject){return Promise.resolve({data:payload,error:null}).then(resolve,reject);}
    };
    return q;
  }};
  const service=support.createProcurementService({db,role:'suporte_informatica',actorId:'user-1'});
  const result=await service.createPurchaseRequest({
    justification:'Substituição de periféricos',
    lines:[{description:'Rato USB',quantity:2,unit_of_measure:'unidade',estimated_unit_cost:1500}]
  });
  assert.equal(result.request.request_number,12);
  assert.equal(calls[0].table,'purchase_requests');
  assert.equal(calls[0].payload.status,'draft');
  assert.equal(calls[0].payload.requested_by,'user-1');
  assert.equal(calls[1].table,'purchase_request_lines');
  assert.equal(calls[1].payload[0].request_id,'req-1');
  assert.equal(result.request.estimated_total,3000);
});
test('movimentos e transferências usam apenas RPC transaccional existente',async()=>{
  const calls=[];
  const db={from(){throw new Error('Não deve inserir directamente em stock_movements.');},rpc:async(name,args)=>{calls.push({name,args});return{name,data:name==='transfer_stock'?[{out_movement_id:'out-1',in_movement_id:'in-1'}]:'move-1',error:null};}};
  const service=support.createProcurementService({db,role:'suporte_informatica',actorId:'user-1'});
  const movement=await service.postStockMovement({item_id:'item-1',warehouse_id:'warehouse-1',movement_type:'entrada',quantity:'3',reference:'GR-01'});
  const transfer=await service.transferStock({item_id:'item-1',from_warehouse_id:'warehouse-1',to_warehouse_id:'warehouse-2',quantity:1});
  assert.equal(movement,'move-1');
  assert.equal(transfer[0].out_movement_id,'out-1');
  assert.deepEqual(calls.map(x=>x.name),['post_stock_movement','transfer_stock']);
  await assert.rejects(()=>service.postStockMovement({item_id:'item-1',warehouse_id:'warehouse-1',movement_type:'transferencia_saida',quantity:1}),/Transferências usam/);
  await assert.rejects(()=>service.transferStock({item_id:'item-1',from_warehouse_id:'warehouse-1',to_warehouse_id:'warehouse-1',quantity:1}),/diferentes/);
});
test('cria contagem de inventário com quantidades iguais a zero permitidas',async()=>{
  const calls=[];
  const db={from(table){
    let payload;
    const q={
      insert(value){payload=value;calls.push({table,payload:value});return q;},
      select(){return q;},
      single(){return Promise.resolve({data:{id:'count-1',...payload},error:null});},
      then(resolve,reject){return Promise.resolve({data:payload,error:null}).then(resolve,reject);}
    };
    return q;
  }};
  const service=support.createProcurementService({db,role:'suporte_informatica',actorId:'user-1'});
  const result=await service.createInventoryCount({warehouse_id:'warehouse-1',lines:[{item_id:'item-1',system_quantity:0,counted_quantity:0}]});
  assert.equal(result.count.id,'count-1');
  assert.equal(calls[0].table,'inventory_counts');
  assert.equal(calls[1].table,'inventory_count_lines');
  assert.equal(calls[1].payload[0].variance,undefined);
  assert.equal(calls[1].payload[0].system_quantity,0);
});

test('só acrescenta linhas a contagens próprias ainda em rascunho',async()=>{
  const calls=[];
  const db={from(table){
    let payload;
    const q={
      select(){return q;},
      eq(){return q;},
      maybeSingle(){return Promise.resolve({data:{id:'count-1',status:'draft',counted_by:'user-1'},error:null});},
      insert(value){payload=value;calls.push({table,payload:value});return q;},
      then(resolve,reject){return Promise.resolve({data:payload,error:null}).then(resolve,reject);}
    };
    return q;
  }};
  const service=support.createProcurementService({db,role:'suporte_informatica',actorId:'user-1'});
  const saved=await service.addInventoryCountLines('count-1',[{item_id:'item-1',system_quantity:0,counted_quantity:2}]);
  assert.equal(saved[0].count_id,'count-1');
  assert.equal(saved[0].system_quantity,0);
  assert.equal(calls[0].table,'inventory_count_lines');
});


test('recolhe várias linhas dinâmicas de compra e contagem sem perder campos', () => {
  const row = values => ({
    querySelector(selector) {
      const key = selector.match(/name="([^"]+)"/)?.[1];
      return key && Object.prototype.hasOwnProperty.call(values, key) ? { value: values[key] } : null;
    }
  });
  const purchase = support.collectProcurementLineRows([
    row({ item_id: 'item-1', description: 'Portátil', quantity: '2', unit_of_measure: 'unidade', estimated_unit_cost: '250000' }),
    row({ item_id: '', description: 'Mala', quantity: '2', unit_of_measure: 'unidade', estimated_unit_cost: '12000' })
  ], 'purchase');
  assert.deepEqual(purchase, [
    { item_id: 'item-1', description: 'Portátil', quantity: '2', unit_of_measure: 'unidade', estimated_unit_cost: '250000' },
    { item_id: '', description: 'Mala', quantity: '2', unit_of_measure: 'unidade', estimated_unit_cost: '12000' }
  ]);
  const count = support.collectProcurementLineRows([
    row({ item_id: 'item-1', system_quantity: '5', counted_quantity: '4', notes: 'Caixa aberta' }),
    row({ item_id: 'item-2', system_quantity: '0', counted_quantity: '0', notes: '' })
  ], 'count');
  assert.deepEqual(count, [
    { item_id: 'item-1', system_quantity: '5', counted_quantity: '4', notes: 'Caixa aberta' },
    { item_id: 'item-2', system_quantity: '0', counted_quantity: '0', notes: '' }
  ]);
  assert.deepEqual(support.collectProcurementLineRows([], 'purchase'), []);
  assert.throws(() => support.collectProcurementLineRows([], 'unknown'), /Tipo de linha inválido/);
});
