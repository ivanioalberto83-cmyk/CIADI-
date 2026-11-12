const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'CIADI_DASHBOARD_FINANCEIRO.html'), 'utf8');
const entry = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase/proposals/ciadi-faturacao-agt-emissao-proposal.sql'), 'utf8');

test('Web entry and dashboard remain synchronised', () => {
  assert.equal(entry, dashboard);
});

test('Only normal fiscal documents can expose the receive-payment action', () => {
  assert.match(dashboard, /r\.document_status==='N' && r\.fiscal_status==='emitido'/);
  assert.match(dashboard, /select\('id,document_no,total,estado_pagamento,document_status,fiscal_status,empresa_id'\)/);
  assert.match(dashboard, /d\.document_status!=='N'\|\|d\.fiscal_status!=='emitido'/);
});

test('AGT certification and series readiness block fiscal emission while allowing a saved draft', () => {
  assert.match(dashboard, /registrationReady:Boolean\(agtRegistration\?\.software_validation_number/);
  assert.match(dashboard, /if\(!agt\.apiReady\)missing\.push/);
  assert.match(dashboard, /GUARDAR_RASCUNHO_FISCAL_PENDENTE/);
  assert.match(dashboard, /await previewFinanceInvoice\(id\)/);
});

test('Series are filtered by the selected document type', () => {
  assert.match(dashboard, /series\.filter\(x=>x\.tipo_documento===typeField\.value\)/);
});

test('A4 preview reflects the persisted document state', () => {
  assert.match(dashboard, /preview:d\.document_status!=='N'\|\|d\.fiscal_status!=='emitido'/);
});

test('Cash movement is created once; accounting retry does not create a duplicate movement', () => {
  assert.match(dashboard, /finance_registar_pagamento',[^;]*p_caixa_id:caixaId/);
  assert.match(dashboard, /ciadi_finance_integrar_pagamento',[^;]*p_caixa_id:null/);
  assert.match(dashboard, /PAGAMENTO_INTEGRACAO_PENDENTE/);
});

test('SQL proposal assigns AGT numbering before fiscal validation and uses N as normal status', () => {
  assert.match(sql, /document_status = 'N'/);
  assert.match(sql, /v_doc_no := d\.tipo_documento \|\| ' ' \|\| v_serie_agt \|\| '\/' \|\| v_num::text/);
  assert.ok(sql.indexOf('update public.finance_documentos\n  set numero_sequencial') < sql.indexOf('v_val := public.ciadi_validar_documento_fiscal'));
  assert.match(sql, /SOFTWARE_AGT_NAO_CERTIFICADO/);
  assert.match(sql, /agt_submission_status = coalesce\(agt_submission_status, 'nao_submetido'\)/);
});
