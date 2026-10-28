(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CIADIProcurementDocuments = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TYPES = Object.freeze({
    pedido_interno: { label: 'Pedido interno de material', prefix: 'PI', fiscal: false },
    pedido_cotacao: { label: 'Pedido de cotação', prefix: 'PC', fiscal: false },
    mapa_comparativo: { label: 'Mapa comparativo de cotações', prefix: 'MC', fiscal: false },
    ordem_compra: { label: 'Ordem de compra', prefix: 'OC', fiscal: false },
    guia_recepcao: { label: 'Guia de receção de material', prefix: 'GR', fiscal: false },
    auto_divergencia: { label: 'Auto de divergência na receção', prefix: 'AD', fiscal: false },
    guia_entrega_interna: { label: 'Guia de entrega interna', prefix: 'GE', fiscal: false },
    devolucao_fornecedor: { label: 'Nota interna de devolução ao fornecedor', prefix: 'DEV', fiscal: false },
    ficha_patrimonio: { label: 'Ficha de inventário patrimonial', prefix: 'PAT', fiscal: false }
  });
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => new Intl.NumberFormat('pt-PT', { style:'currency', currency:'AOA', minimumFractionDigits:2, maximumFractionDigits:2 }).format(Number(value || 0));
  const dateText = value => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? esc(value) : d.toLocaleDateString('pt-PT');
  };
  const n = (value, label) => {
    const v = Number(value == null || value === '' ? 0 : value);
    if (!Number.isFinite(v) || v < 0) throw new Error(label + ' deve ser um valor não negativo.');
    return v;
  };
  function makeDocumentNumber(type, date, sequence) {
    const cfg = TYPES[type];
    if (!cfg) throw new Error('Tipo documental não suportado.');
    const d = new Date(date || Date.now());
    if (Number.isNaN(d.getTime())) throw new Error('Data do documento inválida.');
    const seq = String(n(sequence, 'Sequência')).padStart(4, '0');
    return cfg.prefix + '/' + d.getFullYear() + '/' + seq;
  }
  function calculateLines(lines) {
    if (!Array.isArray(lines) || !lines.length) throw new Error('O documento deve conter pelo menos uma linha.');
    const normalized = lines.map((line, index) => {
      const description = String(line.description || '').trim();
      if (!description) throw new Error('A linha ' + (index + 1) + ' precisa de descrição.');
      const quantity = n(line.quantity, 'Quantidade da linha ' + (index + 1));
      const unitPrice = n(line.unitPrice, 'Preço unitário da linha ' + (index + 1));
      if (quantity <= 0) throw new Error('A quantidade da linha ' + (index + 1) + ' tem de ser superior a zero.');
      const discount = n(line.discount, 'Desconto da linha ' + (index + 1));
      const taxRate = n(line.taxRate, 'Taxa de imposto da linha ' + (index + 1));
      if (discount > quantity * unitPrice) throw new Error('O desconto da linha ' + (index + 1) + ' excede o valor bruto.');
      const subtotal = Math.round((quantity * unitPrice - discount + Number.EPSILON) * 100) / 100;
      const tax = Math.round((subtotal * taxRate / 100 + Number.EPSILON) * 100) / 100;
      return { description, quantity, unitPrice, discount, taxRate, subtotal, tax, total: Math.round((subtotal + tax + Number.EPSILON) * 100) / 100, unit: String(line.unit || 'un').trim() };
    });
    const subtotal = Math.round((normalized.reduce((s, x) => s + x.subtotal, 0) + Number.EPSILON) * 100) / 100;
    const tax = Math.round((normalized.reduce((s, x) => s + x.tax, 0) + Number.EPSILON) * 100) / 100;
    return { lines: normalized, subtotal, tax, total: Math.round((subtotal + tax + Number.EPSILON) * 100) / 100 };
  }
  function buildDocument(input) {
    const cfg = TYPES[input.type];
    if (!cfg) throw new Error('Tipo documental não suportado.');
    const sums = calculateLines(input.lines);
    const docDate = input.date || new Date().toISOString().slice(0, 10);
    const number = String(input.number || makeDocumentNumber(input.type, docDate, input.sequence || 1));
    const status = String(input.status || 'rascunho');
    const supplier = input.supplier || {};
    const org = input.organization || { name: 'CIADI' };
    const doc = {
      type: input.type, title: cfg.label, number, date: docDate, dueDate: input.dueDate || null,
      status, organization: { name: String(org.name || 'CIADI'), nif: String(org.nif || ''), address: String(org.address || ''), phone: String(org.phone || ''), email: String(org.email || '') },
      supplier: { name: String(supplier.name || ''), nif: String(supplier.nif || ''), address: String(supplier.address || ''), phone: String(supplier.phone || ''), email: String(supplier.email || '') },
      polo: String(input.polo || ''), costCenter: String(input.costCenter || ''), requester: String(input.requester || ''),
      approver: String(input.approver || ''), observations: String(input.observations || ''), reference: String(input.reference || ''),
      lines: sums.lines, subtotal: sums.subtotal, tax: sums.tax, total: sums.total, currency: 'AOA',
      fiscalDocument: false, generatedAt: new Date().toISOString(),
      warning: 'Documento operacional interno. Não substitui fatura, recibo fiscal ou documento autorizado pela AGT.'
    };
    return Object.freeze(doc);
  }
  function renderHtml(doc) {
    if (!doc || !TYPES[doc.type]) throw new Error('Documento de aprovisionamento inválido.');
    const rows = doc.lines.map((line, i) => '<tr><td>'+(i+1)+'</td><td>'+esc(line.description)+'</td><td class="num">'+esc(line.quantity)+' '+esc(line.unit)+'</td><td class="num">'+money(line.unitPrice)+'</td><td class="num">'+money(line.discount)+'</td><td class="num">'+money(line.tax)+'</td><td class="num">'+money(line.total)+'</td></tr>').join('');
    const field = (label, value) => value ? '<div><b>'+esc(label)+':</b> '+esc(value)+'</div>' : '';
    return '<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(doc.title)+' '+esc(doc.number)+'</title><style>body{font:14px Arial,sans-serif;color:#222;margin:32px}header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #f58200;padding-bottom:16px}h1{font-size:22px;margin:0 0 8px}h2{font-size:15px;margin:20px 0 8px}.muted{color:#555;font-size:12px}.meta{min-width:200px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f7f7f7}.num{text-align:right;white-space:nowrap}.totals{margin:18px 0 0 auto;width:300px}.totals div{display:flex;justify-content:space-between;padding:5px}.grand{font-weight:bold;border-top:2px solid #333}.notice{margin-top:24px;padding:10px;background:#fff7ed;border:1px solid #fed7aa;font-size:11px}.signatures{display:flex;gap:40px;margin-top:60px}.signatures div{border-top:1px solid #888;flex:1;text-align:center;padding-top:8px}@media print{body{margin:12mm}button{display:none}}</style></head><body><header><div><h1>'+esc(doc.organization.name)+'</h1>'+field('NIF',doc.organization.nif)+field('Morada',doc.organization.address)+field('Telefone',doc.organization.phone)+field('Email',doc.organization.email)+'</div><div class="meta"><h1>'+esc(doc.title)+'</h1>'+field('Número',doc.number)+field('Data',dateText(doc.date))+field('Estado',doc.status)+field('Referência',doc.reference)+'</div></header><h2>Fornecedor / destinatário</h2>'+field('Nome',doc.supplier.name)+field('NIF',doc.supplier.nif)+field('Morada',doc.supplier.address)+field('Telefone',doc.supplier.phone)+field('Email',doc.supplier.email)+'<h2>Controlo interno</h2>'+field('Polo',doc.polo)+field('Centro de custo',doc.costCenter)+field('Requisitante',doc.requester)+field('Aprovador',doc.approver)+'<table><thead><tr><th>#</th><th>Descrição</th><th class="num">Qtd.</th><th class="num">Preço unit.</th><th class="num">Desconto</th><th class="num">Imposto</th><th class="num">Total</th></tr></thead><tbody>'+rows+'</tbody></table><div class="totals"><div><span>Subtotal</span><b>'+money(doc.subtotal)+'</b></div><div><span>Impostos calculados</span><b>'+money(doc.tax)+'</b></div><div class="grand"><span>Total</span><b>'+money(doc.total)+'</b></div></div>'+field('Observações',doc.observations)+'<div class="signatures"><div>Preparado por</div><div>Conferido / aprovado por</div><div>Recebido por</div></div><div class="notice">'+esc(doc.warning)+' Os valores de impostos são cálculos de apoio e devem ser confirmados pela Contabilidade. A numeração sugerida não substitui a numeração persistida e controlada pelo sistema.</div><script>window.addEventListener("load",function(){setTimeout(function(){window.print()},250)});</script></body></html>';
  }
  return { TYPES, calculateLines, makeDocumentNumber, buildDocument, renderHtml };
});
