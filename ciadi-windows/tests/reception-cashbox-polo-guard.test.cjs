'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('abertura de caixa valida polo e associação do operador', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../supabase/proposals/ciadi-reception-cashbox-polo-guard-proposal.sql'), 'utf8');
  const open = sql.slice(sql.indexOf('function public.ciadi_abrir_caixa'), sql.indexOf('function public.ciadi_fechar_caixa'));
  assert.match(open, /c\.polo_code/);
  assert.match(open, /has_reception_operation_access\(v_polo_code\)/);
  assert.match(open, /ciadi_finance_is_staff\(\)/);
});

test('fecho de caixa só permite ao operador do turno ou à supervisão global', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../supabase/proposals/ciadi-reception-cashbox-polo-guard-proposal.sql'), 'utf8');
  const close = sql.slice(sql.indexOf('function public.ciadi_fechar_caixa'), sql.indexOf('function public.ciadi_registar_movimento_caixa'));
  assert.match(close, /t\.operador_id is distinct from v_op/);
  assert.match(close, /has_reception_operation_access\(v_polo_code\)/);
  assert.match(close, /ciadi_finance_is_staff\(\)/);
});

test('movimento de caixa valida polo e turno do operador', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../supabase/proposals/ciadi-reception-cashbox-polo-guard-proposal.sql'), 'utf8');
  const movement = sql.slice(sql.indexOf('function public.ciadi_registar_movimento_caixa'));
  assert.match(movement, /has_reception_operation_access\(v_polo_code\)/);
  assert.match(movement, /t\.operador_id=v_op/);
  assert.match(movement, /p_pagamento_id is not null/);
});
