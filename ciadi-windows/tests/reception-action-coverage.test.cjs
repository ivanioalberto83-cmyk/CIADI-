'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const modulePath = path.join(__dirname, '../../renderer/modules/reception-module.js');
const workspaceSqlPath = path.join(__dirname, '../../supabase/proposals/ciadi-reception-stock-read-workspace-proposal.sql');

test('Recepção apresenta operações de devolução e transferência ligadas aos RPCs centrais', () => {
  const source = fs.readFileSync(modulePath, 'utf8');
  assert.match(source, /data-stock-return-form/);
  assert.match(source, /data-stock-transfer-form/);
  assert.match(source, /form\.matches\('\[data-stock-return-form\]'\)/);
  assert.match(source, /form\.matches\('\[data-stock-transfer-form\]'\)/);
  assert.match(source, /service\.registerStockReturn\(/);
  assert.match(source, /service\.transferStock\(/);
});

test('recepção de mercadorias percorre criação, conferência e entrada efectiva em stock', () => {
  const source = fs.readFileSync(modulePath, 'utf8');
  assert.match(source, /data-goods-receipt-form/);
  assert.match(source, /data-goods-receipt-check/);
  assert.match(source, /data-goods-receipt-finalize/);
  assert.match(source, /service\.createGoodsReceipt\(/);
  assert.match(source, /service\.checkGoodsReceipt\(/);
  assert.match(source, /service\.finalizeGoodsReceipt\(/);
});

test('workspace controlado fornece pedidos aprovados e recepções sem abrir SELECT nas tabelas', () => {
  const sql = fs.readFileSync(workspaceSqlPath, 'utf8');
  const source = fs.readFileSync(modulePath, 'utf8');
  assert.match(sql, /'purchaseRequests'/i);
  assert.match(sql, /'goodsReceipts'/i);
  assert.match(sql, /has_reception_operation_access\(p_polo_code\)/i);
  assert.match(sql, /revoke all on function ciadi_ti\.reception_get_stock_workspace\(text\) from public, anon/i);
  assert.match(source, /stockWorkspace\?\.purchaseRequests/);
  assert.match(source, /stockWorkspace\?\.goodsReceipts/);
  assert.doesNotMatch(source, /businessRepository\.getPurchaseRequests\(\)/);
  assert.doesNotMatch(source, /businessRepository\.getInventoryCounts\(\)/);
});

test('PDF não oferece exportação oficial de documentos que ainda não foram emitidos', () => {
  const source = fs.readFileSync(modulePath, 'utf8');
  assert.match(source, /document_status === 'N' && document\.fiscal_status === 'emitido'/);
  assert.match(source, /data-invoice-pdf-export/);
  assert.match(source, /requireIssued/);
});

test('acções confirmadas não são apresentadas como falhadas quando apenas a actualização da lista falha', () => {
  const source = fs.readFileSync(modulePath, 'utf8');
  assert.match(source, /Requisição submetida; a actualização da lista falhou/);
  assert.match(source, /Transferência registada; a actualização da consulta falhou/);
  assert.match(source, /Recepção criada; a actualização da lista falhou/);
  assert.match(source, /A requisição tem de manter pelo menos um artigo/);
});
