'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const modulePath = path.join(__dirname, '../../renderer/modules/reception-module.js');
const permissionsSqlPath = path.join(__dirname, '../../supabase/proposals/ciadi-reception-stock-operations-permissions-proposal.sql');
const workspaceSqlPath = path.join(__dirname, '../../supabase/proposals/ciadi-reception-stock-read-workspace-proposal.sql');

test('transferência da Recepção não chama o helper exclusivo do Suporte Informático', () => {
  const sql = fs.readFileSync(permissionsSqlPath, 'utf8');
  const transfer = sql.slice(sql.indexOf('create or replace function ciadi_ti.reception_transfer_stock'), sql.indexOf('create or replace function ciadi_ti.finalize_goods_receipt'));
  assert.match(transfer, /has_reception_operation_access\(p_polo_code\)/i);
  assert.match(transfer, /post_stock_movement_for_reception\(/i);
  assert.doesNotMatch(transfer, /ciadi_ti\.transfer_stock\(/i);
  assert.match(transfer, /idempotency_key/i);
  assert.match(transfer, /related_movement_id/i);
});

test('finalização da recepção usa o movimento seguro por polo, não o helper de Suporte', () => {
  const sql = fs.readFileSync(permissionsSqlPath, 'utf8');
  const finalize = sql.slice(sql.indexOf('create or replace function ciadi_ti.finalize_goods_receipt'));
  assert.match(finalize, /has_reception_operation_access\(v_polo_code\)/i);
  assert.match(finalize, /post_stock_movement_for_reception\(/i);
  assert.doesNotMatch(finalize, /ciadi_ti\.post_stock_movement\(/i);
  assert.match(finalize, /goods_receipts.*UPDATE|values \('goods_receipts'/is);
});

test('workspace só activa transferência e finalização quando o helper seguro está instalado', () => {
  const workspaceSql = fs.readFileSync(workspaceSqlPath, 'utf8');
  const source = fs.readFileSync(modulePath, 'utf8');
  assert.match(workspaceSql, /'canTransferStock',[\s\S]*to_regprocedure/i);
  assert.match(workspaceSql, /'canFinalizeGoodsReceipt',[\s\S]*to_regprocedure/i);
  assert.match(source, /const canTransferStock = snapshot\.canTransferStock === true/);
  assert.match(source, /const canFinalizeGoodsReceipt = snapshot\.canFinalizeGoodsReceipt === true/);
  assert.match(source, /Aguarda homologação das permissões do motor de stock para a Recepção/);
});
