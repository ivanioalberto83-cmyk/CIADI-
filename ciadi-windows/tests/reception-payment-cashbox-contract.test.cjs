'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('proposta de pagamento exige caixa e turno do operador antes de qualquer registo', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '../../supabase/proposals/ciadi-reception-payment-cashbox-hardening-proposal.sql'),
    'utf8'
  );

  assert.match(sql, /security definer/i);
  assert.match(sql, /public\.perfis p[\s\S]*p\.ativo = true/i);
  assert.match(sql, /auth\.uid\(\)/i);
  assert.match(sql, /p_caixa_id is null/i);
  assert.match(sql, /p_polo_code text/i);
  assert.match(sql, /has_reception_operation_access\(p_polo_code\)/i);
  assert.match(sql, /polo_code = p_polo_code/i);
  assert.match(sql, /p_idempotency_key text/i);
  assert.match(sql, /finance_pagamentos_idempotency_key_uidx/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /idempotent_replay|chave idempotente/i);
  assert.match(sql, /empresa_id = v_doc\.empresa_id/i);
  assert.match(sql, /estado = 'aberto'/i);
  assert.match(sql, /ciadi_finance_can\('receber'\)/i);
  assert.match(sql, /ciadi_finance_can\('recibo'\)/i);
  assert.match(sql, /ciadi_finance_operator_id\(\)/i);
  assert.match(sql, /operador_id = v_operator_id/i);
  assert.match(sql, /raise exception 'Não existe turno aberto deste operador/i);
  assert.match(sql, /document_status <> 'N'/i);
  assert.match(sql, /fiscal_status <> 'emitido'/i);
});

test('proposta cria pagamento, recibo RC, movimento de caixa e auditoria na mesma função', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '../../supabase/proposals/ciadi-reception-payment-cashbox-hardening-proposal.sql'),
    'utf8'
  );

  const payment = sql.indexOf('insert into public.finance_pagamentos');
  const receipt = sql.indexOf("insert into public.finance_documentos(");
  const cashMovement = sql.indexOf('insert into public.finance_movimentos_caixa');
  const audit = sql.indexOf('insert into public.finance_auditoria_fiscal');

  assert.ok(payment > 0);
  assert.ok(receipt > payment);
  assert.ok(cashMovement > receipt);
  assert.ok(audit > cashMovement);
  assert.match(sql, /pagamento_id, descricao,[\s\S]*turno_id, operador_id/i);
  const cashMovementBlock = sql.slice(sql.indexOf('insert into public.finance_movimentos_caixa'), sql.indexOf('update public.finance_documentos d'));
  assert.match(cashMovementBlock, /v_turno\.id, v_turno\.operador_id/i);
  assert.doesNotMatch(cashMovementBlock, /v_turno\.id, v_actor/i);
  assert.match(sql, /revoke all on function[\s\S]*from public, anon/i);
  assert.match(sql, /grant execute on function[\s\S]*to authenticated/i);
  assert.match(sql, /PROPOSTA APENAS/i);
});

test('interface e repositório não permitem pagamento sem caixa seleccionado', () => {
  const moduleSource = fs.readFileSync(
    path.join(__dirname, '../../renderer/modules/reception-module.js'),
    'utf8'
  );
  assert.match(moduleSource, /p_caixa_id: requiredId\(input\.cashboxId, 'Caixa'\)/);
  assert.match(moduleSource, /p_idempotency_key: requiredId\(input\.idempotencyKey/);
  assert.match(moduleSource, /p_polo_code: requiredId\(input\.poloCode/);
  assert.match(moduleSource, /poloCode: activePolo/);
  assert.match(moduleSource, /<select name="cashboxId" required class="[^"]*border rounded-lg p-2">/);
  assert.match(moduleSource, /Seleccione o caixa obrigatório/);
});

test('formulário de recebimento chama o motor central, confirma o RC e disponibiliza pré-visualização PDF', () => {
  const moduleSource = fs.readFileSync(
    path.join(__dirname, '../../renderer/modules/reception-module.js'),
    'utf8'
  );
  assert.match(moduleSource, /form\.matches\('\[data-reception-payment-form\]'\)/);
  assert.match(moduleSource, /financeRepository\.registerPayment\(/);
  assert.match(moduleSource, /paymentIdempotencyKey/);
  assert.match(moduleSource, /globalThis\.crypto\?\.randomUUID/);
  assert.match(moduleSource, /result\?\.pagamento_id[\s\S]*result\?\.recibo_id[\s\S]*result\?\.recibo_no/);
  assert.match(moduleSource, /pdfService\.preview\(result\.recibo_id\)/);
  assert.match(moduleSource, /data-invoice-pdf-export=/);
});

test('proposta de operações de stock fecha correctamente todos os corpos PL/pgSQL', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '../../supabase/proposals/ciadi-reception-stock-operations-permissions-proposal.sql'),
    'utf8'
  );

  assert.equal((sql.match(/\$\$/g) || []).length % 2, 0, 'delimitadores $$ devem estar emparelhados');
  const finalizer = sql.slice(sql.indexOf('create or replace function ciadi_ti.finalize_goods_receipt'));
  assert.match(finalizer, /\nend;\n\$\$;\n\nrevoke all on function ciadi_ti\.reception_transfer_stock/i);
});
