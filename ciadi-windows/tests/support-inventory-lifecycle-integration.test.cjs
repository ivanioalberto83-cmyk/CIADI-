const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('ambos pontos de entrada do Dashboard carregam o motor de ciclo de inventário', () => {
  for (const file of ['index.html', 'CIADI_DASHBOARD_FINANCEIRO.html']) {
    assert.match(read(file), /renderer\/modules\/support-inventory-lifecycle-module\.js/);
  }
});

test('a estação Suporte Informático integra recepção, conferência, publicação e reconciliação', () => {
  const source = read('renderer/modules/support-operations-module.js');
  assert.match(source, /createInventoryLifecycleService/);
  assert.match(source, /createGoodsReceipt/);
  assert.match(source, /checkGoodsReceipt/);
  assert.match(source, /finalizeGoodsReceipt/);
  assert.match(source, /reconcileInventoryCount/);
  assert.match(source, /data-receipt-check/);
  assert.match(source, /data-receipt-finalize/);
  assert.match(source, /data-reconcile-count/);
});

test('a proposta SQL activa RLS e mantém a publicação do stock em RPC transaccional', () => {
  const sql = read('supabase/proposals/ciadi-ti-inventory-lifecycle-proposal.sql');
  assert.match(sql, /alter table ciadi_ti\.goods_receipts enable row level security/i);
  assert.match(sql, /alter table ciadi_ti\.goods_receipt_lines enable row level security/i);
  assert.match(sql, /create or replace function ciadi_ti\.finalize_goods_receipt/i);
  assert.match(sql, /create or replace function ciadi_ti\.reconcile_inventory_count/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /ciadi_ti\.post_stock_movement\(/i);
  assert.match(sql, /revoke all on function ciadi_ti\.finalize_goods_receipt\(uuid\) from public, anon/i);
  assert.match(sql, /grant execute on function ciadi_ti\.finalize_goods_receipt\(uuid\) to authenticated/i);
  assert.doesNotMatch(sql, /insert into ciadi_ti\.stock_movements/i);
});

test('as RPCs da proposta exigem utilizador autenticado e acesso reconhecido no servidor', () => {
  const sql = read('supabase/proposals/ciadi-ti-inventory-lifecycle-proposal.sql');
  const checks = sql.match(/if auth\.uid\(\) is null or not ciadi_ti\.has_support_access\(\) then/gi) || [];
  assert.equal(checks.length, 4);
  assert.match(sql, /set search_path = pg_catalog, public, ciadi_ti/gi);
});
