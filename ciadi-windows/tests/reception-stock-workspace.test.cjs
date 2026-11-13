'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sqlPath = path.join(__dirname, '../../supabase/proposals/ciadi-reception-stock-read-workspace-proposal.sql');
const modulePath = path.join(__dirname, '../../renderer/modules/reception-module.js');

test('workspace de stock é lido por RPC com validação de sessão e polo, sem abrir SELECT directo', () => {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const source = fs.readFileSync(modulePath, 'utf8');

  assert.match(sql, /reception_get_stock_workspace\(p_polo_code text\)/i);
  assert.match(sql, /auth\.uid\(\) is null or not ciadi_ti\.has_reception_operation_access\(p_polo_code\)/i);
  assert.match(sql, /revoke all on function ciadi_ti\.reception_get_stock_workspace\(text\) from public, anon/i);
  assert.match(sql, /grant execute on function ciadi_ti\.reception_get_stock_workspace\(text\) to authenticated/i);
  const financeWorkspace = fs.readFileSync(
    path.join(__dirname, '../../supabase/proposals/ciadi-reception-finance-workspace-permissions-proposal.sql'),
    'utf8'
  );
  assert.match(financeWorkspace, /c\.polo_code = p_polo_code/i);
  assert.match(source, /rpc\('reception_get_stock_workspace'/);
  assert.match(source, /data-reception-stock-operations/);
});

test('Recepção cria e submete requisições; só Administração/Gestão vê decisões', () => {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const source = fs.readFileSync(modulePath, 'utf8');

  assert.match(source, /createStockRequisition\(input = \{\}\)/);
  assert.match(source, /submitStockRequisition\(requisitionId\)/);
  assert.match(source, /decideStockRequisition\(requisitionId, decision/);
  assert.match(source, /request\.status === 'submitted' && canApprove/);
  assert.match(sql, /'canApprove', ciadi_ti\.has_finance_approval\(\)/i);
  assert.match(sql, /'stockBalances'/i);
  assert.match(sql, /'requisitions'/i);
  assert.match(sql, /'movements'/i);
  assert.match(sql, /add column if not exists polo_code text/i);
  assert.match(sql, /r\.polo_code = p_polo_code/i);
  assert.match(sql, /CC-001[\s\S]*CC-002/i);
  assert.match(sql, /purchase_requests_polo_status_idx/i);
  assert.match(sql, /count\(distinct w\.polo\) = 1/i);
});

test('saída de stock exige linha aprovada e não excede a quantidade por entregar', () => {
  const source = fs.readFileSync(modulePath, 'utf8');
  assert.match(source, /form\.matches\('\[data-stock-exit-form\]'\)/);
  assert.match(source, /mode: 'approved_request'/);
  assert.match(source, /quantity > maximum/);
  assert.match(source, /selected\.dataset\.requestId/);
  assert.match(source, /selected\.dataset\.itemId/);
  assert.match(source, /selected\.dataset\.warehouseId/);
});


test('novos pedidos de compra são criados com polo explícito', () => {
  const supportSource = fs.readFileSync(
    path.join(__dirname, '../../renderer/modules/support-operations-module.js'),
    'utf8'
  );
  assert.match(supportSource, /poloCode=String\(input\?\.polo_code\|\|input\?\.poloCode/);
  assert.match(supportSource, /polo_code:poloCode/);
  assert.match(supportSource, /Seleccione um polo válido para o pedido de compra/);
});

test('workspace de stock resolve empresa antes de filtrar centros de custo', () => {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const workspace = sql.slice(sql.indexOf('create or replace function ciadi_ti.reception_get_stock_workspace'));
  assert.match(workspace, /v_company_id uuid/i);
  assert.match(workspace, /select e\.id into v_company_id[\s\S]*from public\.finance_empresas e[\s\S]*e\.ativo = true/i);
});
