'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('workspace financeiro devolve caixas da empresa e turnos pelo ID interno do operador', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '../../supabase/proposals/ciadi-reception-finance-workspace-permissions-proposal.sql'),
    'utf8'
  );
  assert.match(sql, /public\.ciadi_finance_operator_id\(\)/i);
  assert.match(sql, /public\.ciadi_finance_can\('abrir'\)/i);
  assert.match(sql, /public\.ciadi_finance_can\('receber'\)/i);
  assert.match(sql, /from public\.finance_caixas c[\s\S]*where c\.empresa_id = v_company_id/i);
  assert.match(sql, /t\.operador_id = v_operator_id/i);
  assert.doesNotMatch(sql, /t\.operador_id\s*=\s*auth\.uid\(\)/i);
  assert.match(sql, /'canOpenCashbox'/i);
  assert.match(sql, /'canCloseCashbox'/i);
  assert.match(sql, /'canReceivePayments'/i);
});

test('interface da Recepção só activa caixa e pagamentos quando o workspace confirma permissões e turno', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../../renderer/modules/reception-module.js'),
    'utf8'
  );
  assert.match(source, /snapshot\.canOpenCashbox === true && cashboxes\.length > 0/);
  assert.match(source, /snapshot\.canCloseCashbox === true && shifts\.length > 0/);
  assert.match(source, /snapshot\.canReceivePayments === true && shifts\.length > 0/);
  assert.match(source, /canOpenCashbox: businessSnapshot\.canOpenCashbox/);
  assert.match(source, /canCloseCashbox: businessSnapshot\.canCloseCashbox/);
  assert.match(source, /canReceivePayments: businessSnapshot\.canReceivePayments/);
});
