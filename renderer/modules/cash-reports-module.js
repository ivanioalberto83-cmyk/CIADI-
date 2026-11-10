(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CIADI_CASH_REPORTS_MODULE = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const PAYMENT_ORIGIN = 'PAGAMENTO';
  const CASH_IN_TYPES = new Set(['entrada', 'receita', 'recebimento']);

  function rowsOrThrow(result) {
    if (result?.error) throw result.error;
    return Array.isArray(result?.data) ? result.data : [];
  }

  function uniqueIds(values) {
    return [...new Set(values.filter(value => typeof value === 'string' && value.trim()))];
  }

  function createCashReportsRepository({ supabase } = {}) {
    if (!supabase || typeof supabase.from !== 'function') {
      throw new Error('A ligação ao Financeiro CIADI não está disponível.');
    }

    return Object.freeze({
      async getSnapshot({ limit = 100 } = {}) {
        const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 250) : 100;
        const shiftResult = await supabase.from('finance_caixa_turnos')
          .select('id,caixa_id,operador_id,aberto_em,saldo_inicial,fechado_em,saldo_esperado,saldo_contado,diferenca,justificacao_diferenca,aprovado_por,aprovado_em,estado,observacoes,created_at,finance_caixas(nome,codigo,localizacao,empresa_id),finance_operadores(funcao)')
          .order('aberto_em', { ascending: false })
          .limit(safeLimit);
        const shifts = rowsOrThrow(shiftResult);
        const shiftIds = uniqueIds(shifts.map(row => row.id));
        if (!shiftIds.length) {
          return Object.freeze({ shifts: Object.freeze([]), movements: Object.freeze([]), accountingEntries: Object.freeze([]) });
        }

        const movementResult = await supabase.from('finance_movimentos_caixa')
          .select('id,turno_id,tipo,valor,origem,pagamento_id,documento_id,descricao,data_movimento,metodo_pagamento,estado')
          .in('turno_id', shiftIds)
          .limit(2000);
        const movements = rowsOrThrow(movementResult);
        const paymentIds = uniqueIds(movements
          .filter(row => row.estado === 'confirmado' && row.pagamento_id)
          .map(row => row.pagamento_id));

        let accountingEntries = [];
        if (paymentIds.length) {
          const accountingResult = await supabase.from('finance_lancamentos')
            .select('id,origem_tipo,origem_id,estado,total_debito,total_credito,contabilizado_em,referencia,data_lancamento')
            .eq('origem_tipo', PAYMENT_ORIGIN)
            .in('origem_id', paymentIds)
            .limit(2000);
          accountingEntries = rowsOrThrow(accountingResult);
        }

        return Object.freeze({
          shifts: Object.freeze(shifts),
          movements: Object.freeze(movements),
          accountingEntries: Object.freeze(accountingEntries)
        });
      }
    });
  }

  function buildCashReportRows(snapshot = {}) {
    const shifts = Array.isArray(snapshot.shifts) ? snapshot.shifts : [];
    const movements = Array.isArray(snapshot.movements) ? snapshot.movements : [];
    const entries = Array.isArray(snapshot.accountingEntries) ? snapshot.accountingEntries : [];
    const entriesByPayment = new Map();

    for (const entry of entries) {
      if (entry?.origem_tipo !== PAYMENT_ORIGIN || !entry.origem_id) continue;
      const list = entriesByPayment.get(entry.origem_id) || [];
      list.push(entry);
      entriesByPayment.set(entry.origem_id, list);
    }

    return shifts.map(shift => {
      const turnMovements = movements.filter(row => row.turno_id === shift.id && row.estado === 'confirmado');
      const totalEntradas = turnMovements
        .filter(row => CASH_IN_TYPES.has(String(row.tipo || '').toLowerCase()))
        .reduce((sum, row) => sum + (Number(row.valor) || 0), 0);
      const totalSaidas = turnMovements
        .filter(row => !CASH_IN_TYPES.has(String(row.tipo || '').toLowerCase()))
        .reduce((sum, row) => sum + (Number(row.valor) || 0), 0);
      const paymentIds = uniqueIds(turnMovements.filter(row => row.pagamento_id).map(row => row.pagamento_id));
      const accountingForPayments = paymentIds.map(id => entriesByPayment.get(id) || []);
      const accountingPostedCount = accountingForPayments.filter(list => list.some(entry => entry.estado === 'contabilizado')).length;
      const accountingMissingCount = accountingForPayments.filter(list => list.length === 0).length;
      const accountingPendingCount = accountingForPayments.filter(list => list.length > 0 && !list.some(entry => entry.estado === 'contabilizado')).length;
      const paymentMovementTotal = turnMovements
        .filter(row => row.pagamento_id)
        .reduce((sum, row) => sum + (Number(row.valor) || 0), 0);
      const accountingPostedTotal = accountingForPayments.reduce((sum, list) => sum + list
        .filter(entry => entry.estado === 'contabilizado')
        .reduce((entrySum, entry) => entrySum + (Number(entry.total_debito) || 0), 0), 0);
      const accountingDifference = Math.round((paymentMovementTotal - accountingPostedTotal) * 100) / 100;
      const accountingStatus = paymentIds.length === 0
        ? 'Sem pagamentos associados'
        : accountingMissingCount > 0
          ? 'Por verificar'
          : accountingPendingCount > 0
            ? 'Pendente'
            : Math.abs(accountingDifference) > 0.005
              ? 'Divergência'
              : 'Conciliado';

      return Object.freeze({
        ...shift,
        totalEntradas,
        totalSaidas,
        paymentMovementTotal,
        accountingPostedTotal,
        accountingDifference,
        accountingPaymentCount: paymentIds.length,
        accountingPostedCount,
        accountingPendingCount,
        accountingMissingCount,
        accountingStatus
      });
    });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function formatMoney(value) {
    return new Intl.NumberFormat('pt-AO', {
      style: 'currency', currency: 'AOA', maximumFractionDigits: 2
    }).format(Number(value || 0));
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-AO', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }

  function relationOne(value) {
    return Array.isArray(value) ? value[0] || {} : value || {};
  }

  function renderReport(rootElement, rows) {
    const brand = globalThis.CIADI_INSTITUTIONAL_IDENTITY?.getBrand?.() || null;
    const logo = brand?.logoDataUrl
      ? '<img src="' + escapeHtml(brand.logoDataUrl) + '" alt="Logótipo CIADI" class="h-12 w-auto object-contain">'
      : '<strong class="text-orange text-2xl">CIADI</strong>';
    const pendingApproval = rows.filter(row => row.estado === 'pendente_aprovacao').length;
    const unresolved = rows.filter(row => ['Por verificar', 'Pendente', 'Divergência'].includes(row.accountingStatus)).length;
    const differenceTotal = rows.reduce((sum, row) => sum + (Number(row.diferenca) || 0), 0);

    rootElement.innerHTML = `
      <section class="space-y-5" data-ciadi-cash-reports>
        <header class="card p-6 flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">${logo}<div>
            <p class="text-xs font-black uppercase tracking-widest text-orange">CIADI • Administração</p>
            <h2 class="text-2xl font-black">Relatórios de Abertura e Fecho de Caixa</h2>
            <p class="text-sm text-slate-500">Consulta e conferência dos turnos da Recepção com os movimentos e lançamentos contabilísticos</p>
          </div></div>
          <span class="rounded-full border px-3 py-2 text-xs font-bold">Consulta apenas</span>
        </header>
        <div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <article class="card p-4"><p class="text-xs text-slate-500">Turnos consultados</p><strong class="text-2xl">${rows.length}</strong></article>
          <article class="card p-4"><p class="text-xs text-slate-500">Fechos pendentes de aprovação</p><strong class="text-2xl">${pendingApproval}</strong></article>
          <article class="card p-4"><p class="text-xs text-slate-500">Diferenças líquidas registadas</p><strong class="text-2xl">${formatMoney(differenceTotal)}</strong></article>
          <article class="card p-4"><p class="text-xs text-slate-500">Conciliações contabilísticas por verificar</p><strong class="text-2xl">${unresolved}</strong></article>
        </div>
        <div class="card p-5">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div><h3 class="font-black text-lg">Histórico de turnos</h3><p class="text-xs text-slate-500">Últimos ${rows.length} turnos disponibilizados pelas permissões financeiras da conta.</p></div>
            <button type="button" data-cash-reports-refresh class="border rounded-xl px-4 py-2 font-bold">Actualizar</button>
          </div>
          <div class="overflow-auto">
            <table class="w-full text-sm min-w-[1050px]">
              <thead><tr class="border-b text-left text-slate-500">
                <th class="p-3">Caixa / Operador</th><th>Abertura</th><th>Fecho</th><th>Saldo inicial</th><th>Esperado</th><th>Contado</th><th>Diferença de caixa</th><th>Entradas</th><th>Saídas</th><th>Débito contabilizado</th><th>Diferença contabilística</th><th>Estado</th><th>Conciliação</th>
              </tr></thead>
              <tbody>${rows.map(row => {
                const cashbox = relationOne(row.finance_caixas);
                const operator = relationOne(row.finance_operadores);
                const status = row.accountingStatus === 'Conciliado' ? 'text-emerald-700' : row.accountingStatus === 'Sem pagamentos associados' ? 'text-slate-500' : 'text-amber-700';
                return `<tr class="border-b align-top">
                  <td class="p-3"><strong>${escapeHtml(cashbox.nome || cashbox.codigo || row.caixa_id || 'Caixa')}</strong><div class="text-xs text-slate-500">${escapeHtml(cashbox.localizacao || operator.funcao || '—')}</div></td>
                  <td>${formatDate(row.aberto_em)}</td><td>${formatDate(row.fechado_em)}</td>
                  <td>${formatMoney(row.saldo_inicial)}</td><td>${formatMoney(row.saldo_esperado)}</td><td>${formatMoney(row.saldo_contado)}</td>
                  <td class="${Number(row.diferenca) < 0 ? 'text-red-700' : ''}">${formatMoney(row.diferenca)}</td>
                  <td><span class="rounded-full bg-slate-100 px-2 py-1 text-xs">${escapeHtml(row.estado || '—')}</span></td>
                  <td><strong class="${status}">${escapeHtml(row.accountingStatus)}</strong><div class="text-xs text-slate-500">${row.accountingPostedCount}/${row.accountingPaymentCount} recebimentos contabilizados</div></td>
                </tr>`;
              }).join('') || '<tr><td colspan="13" class="p-6 text-center text-slate-500">Ainda não existem turnos de caixa disponíveis para consulta.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
        <p class="text-xs text-slate-500">Nota de reconciliação: o fecho do turno regista os saldos e a diferença; não cria, por si só, um lançamento contabilístico. Esta vista compara o valor dos recebimentos associados a pagamentos com o débito dos lançamentos efectivamente contabilizados. Movimentos sem pagamento associado não são classificados automaticamente como contabilizados.</p>
      </section>`;
  }

  function create({ root: rootElement, supabase, notify = () => {} } = {}) {
    if (!rootElement) throw new Error('O contentor dos relatórios de caixa não foi fornecido.');
    const repository = createCashReportsRepository({ supabase });

    async function renderHome() {
      rootElement.innerHTML = '<div class="card p-6">A carregar relatórios de caixa…</div>';
      try {
        const snapshot = await repository.getSnapshot();
        renderReport(rootElement, buildCashReportRows(snapshot));
      } catch (error) {
        rootElement.innerHTML = `
          <section class="card p-6 space-y-3" role="alert">
            <h2 class="text-xl font-black">Relatórios de Caixa indisponíveis</h2>
            <p class="text-sm text-slate-600">Não foi possível consultar os turnos, movimentos ou lançamentos contabilísticos com a sessão actual.</p>
            <p class="text-xs text-slate-500">${escapeHtml(error?.message || 'Serviço indisponível.')}</p>
            <button type="button" data-cash-reports-refresh class="border rounded-xl px-4 py-2 font-bold">Tentar novamente</button>
          </section>`;
      }
    }

    if (!rootElement.__ciadiCashReportsBound) {
      rootElement.__ciadiCashReportsBound = true;
      rootElement.addEventListener('click', event => {
        if (event.target.closest('[data-cash-reports-refresh]')) renderHome();
      });
    }

    return Object.freeze({ renderHome });
  }

  return Object.freeze({ createCashReportsRepository, buildCashReportRows, create });
});
