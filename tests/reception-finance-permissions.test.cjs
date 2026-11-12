const test = require('node:test');
const assert = require('node:assert/strict');
const reception = require('../renderer/modules/reception-module.js');

test('recepção identifica documentos fiscais emitidos pelo estado normal N', () => {
  const html = reception.renderReceptionFinancePanel({
    clients: [],
    documentTypes: [],
    series: [],
    services: [],
    cashboxes: [],
    shifts: [],
    documents: [
      { id: 'normal', document_no: 'FT A/1', document_status: 'N', fiscal_status: 'emitido', total: 100 },
      { id: 'legacy', document_no: 'FT A/2', document_status: 'emitido', fiscal_status: 'emitido', total: 200 },
      { id: 'draft', document_no: 'FT A/3', document_status: 'N', fiscal_status: 'rascunho', total: 300 }
    ]
  });

  assert.match(html, /FT A\/1/);
  assert.doesNotMatch(html, /FT A\/2/);
  assert.doesNotMatch(html, /Temporariamente bloqueado: a função central de pagamentos exige document_status = N, enquanto a função de emissão actualmente grava document_status = emitido/);
});

test('recepção não apresenta acções de alteração ou eliminação de facturas', () => {
  const html = reception.renderReceptionFinancePanel({
    clients: [{ id: 'c1', nome: 'Cliente de teste' }],
    documentTypes: [{ codigo: 'FT', nome: 'Factura' }],
    series: [{ id: 's1', codigo: 'FT26' }],
    services: [{ id: 'sv1', nome: 'Consulta', preco_base: 100 }],
    cashboxes: [],
    shifts: [],
    documents: [
      { id: 'draft', document_no: 'RASCUNHO-1', document_status: 'N', fiscal_status: 'rascunho', total: 100 }
    ]
  });

  assert.match(html, /Criar factura em rascunho/);
  assert.match(html, /data-reception-client-form/);
  assert.match(html, /Guardar cliente/);
  assert.doesNotMatch(html, /data-invoice-calculate|data-invoice-edit|data-invoice-delete/);
  assert.match(html, /Cadastrar cliente\/entidade/);
  assert.doesNotMatch(html, /data-invoice-edit|data-invoice-delete|Apagar factura|Alterar factura/);
  assert.match(html, /Não pode alterar, apagar, emitir ou anular documentos/);
});

test('proposta SQL antiga está explicitamente retirada e não pode ser reaplicada', () => {
  const fs = require('node:fs');
  const sql = fs.readFileSync('supabase/proposals/ciadi-reception-finance-workflows-proposal.sql', 'utf8');
  assert.match(sql, /SUPERSEDED — DO NOT EXECUTE/);
  assert.match(sql, /ciadi_reception_finance_workflows_20261112/);
  assert.match(sql, /ciadi_reception_block_unpriced_invoice_drafts_20261112/);
  assert.match(sql, /SECURITY INVOKER/);
  assert.match(sql, /empty search_path/);
});
