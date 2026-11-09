(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CIADI_RECEPTION_MODULE = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const POLOS = Object.freeze(['talatona', 'jardim_de_rosas']);
  const VISIT_TYPES = Object.freeze(['appointment', 'walk_in']);
  const VISIT_STATUSES = Object.freeze(['waiting', 'in_service', 'referred', 'completed', 'no_show', 'cancelled']);
  const VISITOR_STATUSES = Object.freeze(['inside', 'exited']);
  const ROUTES = Object.freeze([
    { id: 'pedidos_site', label: 'Pedidos de triagem do site' },
    { id: 'agendamentos', label: 'Agenda de consultas' },
    { id: 'pacientes', label: 'Consulta de pacientes' },
    { id: 'familias', label: 'Portal das famílias' },
    { id: 'triagens', label: 'Triagens' }
  ]);
  const TRANSITIONS = Object.freeze({
    waiting: Object.freeze(['in_service', 'no_show', 'cancelled']),
    in_service: Object.freeze(['waiting', 'referred', 'completed']),
    referred: Object.freeze(['waiting', 'completed']),
    completed: Object.freeze([]),
    no_show: Object.freeze([]),
    cancelled: Object.freeze([])
  });
  const STATUS_LABELS = Object.freeze({
    waiting: 'A aguardar',
    in_service: 'Em atendimento',
    referred: 'Encaminhado',
    completed: 'Concluído',
    no_show: 'Não compareceu',
    cancelled: 'Cancelado'
  });
  const POLO_LABELS = Object.freeze({
    talatona: 'Talatona',
    jardim_de_rosas: 'Jardim de Rosas'
  });

  function clean(value, max = 160) {
    return String(value ?? '').trim().slice(0, max);
  }

  function validateVisitInput(input = {}) {
    const errors = [];
    const visitType = input.visitType;
    const poloCode = input.poloCode;
    const displayName = clean(input.displayName, 120);
    const purpose = clean(input.purpose, 160);
    const appointmentId = clean(input.appointmentId, 128);
    const patientId = clean(input.patientId, 128);

    if (!VISIT_TYPES.includes(visitType)) errors.push('Seleccione o tipo de chegada.');
    if (!POLOS.includes(poloCode)) errors.push('Seleccione um polo CIADI válido.');
    if (displayName.length < 2) errors.push('Indique o nome do responsável ou visitante.');
    if (purpose.length < 2) errors.push('Indique a finalidade do atendimento.');
    if (visitType === 'appointment' && !appointmentId) errors.push('Associe a chegada a uma marcação/agendamento existente.');
    if (visitType === 'appointment' && !patientId) errors.push('A marcação seleccionada deve identificar o utente associado.');

    return Object.freeze({
      valid: errors.length === 0,
      errors: Object.freeze(errors),
      value: Object.freeze({
        visitType,
        appointmentId: appointmentId || null,
        patientId: patientId || null,
        displayName,
        purpose,
        poloCode
      })
    });
  }

  function transitionVisitStatus(current, next) {
    const known = VISIT_STATUSES.includes(current) && VISIT_STATUSES.includes(next);
    const valid = known && TRANSITIONS[current].includes(next);
    return Object.freeze({
      valid,
      errors: Object.freeze(valid ? [] : ['A transição de estado solicitada não é permitida.']),
      value: valid ? Object.freeze({ from: current, to: next }) : null
    });
  }

  function validateVisitorInput(input = {}) {
    const errors = [];
    const displayName = clean(input.displayName, 120);
    const purpose = clean(input.purpose, 160);
    const hostDepartment = clean(input.hostDepartment, 100);
    const poloCode = input.poloCode;

    if (displayName.length < 2) errors.push('Indique o nome do visitante.');
    if (purpose.length < 2) errors.push('Indique a finalidade da visita.');
    if (hostDepartment.length < 2) errors.push('Indique o serviço de destino.');
    if (!POLOS.includes(poloCode)) errors.push('Seleccione um polo CIADI válido.');

    return Object.freeze({
      valid: errors.length === 0,
      errors: Object.freeze(errors),
      value: Object.freeze({ displayName, purpose, hostDepartment, poloCode })
    });
  }

  function summarizeReception(rows = []) {
    const result = {
      total: 0, waiting: 0, inService: 0, referred: 0,
      completed: 0, noShow: 0, cancelled: 0, averageWaitMinutes: 0
    };
    let waitTotal = 0;
    let waitCount = 0;

    for (const row of Array.isArray(rows) ? rows : []) {
      result.total += 1;
      if (row.status === 'waiting') result.waiting += 1;
      else if (row.status === 'in_service') result.inService += 1;
      else if (row.status === 'referred') result.referred += 1;
      else if (row.status === 'completed') result.completed += 1;
      else if (row.status === 'no_show') result.noShow += 1;
      else if (row.status === 'cancelled') result.cancelled += 1;

      if (row.created_at && row.service_started_at) {
        const start = Date.parse(row.created_at);
        const service = Date.parse(row.service_started_at);
        if (Number.isFinite(start) && Number.isFinite(service) && service >= start) {
          waitTotal += (service - start) / 60000;
          waitCount += 1;
        }
      }
    }

    result.averageWaitMinutes = waitCount ? Math.round(waitTotal / waitCount) : 0;
    return Object.freeze(result);
  }


  function selectNextWaitingVisit(rows = []) {
    return (Array.isArray(rows) ? rows : [])
      .filter(row => row && row.status === 'waiting')
      .slice()
      .sort((a, b) => {
        const aTime = Date.parse(a.arrived_at || '');
        const bTime = Date.parse(b.arrived_at || '');
        const timeOrder = (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
        if (timeOrder !== 0) return timeOrder;
        return Number(a.ticket_number || 0) - Number(b.ticket_number || 0);
      })[0] || null;
  }

  function buildPublicCallPanelModel(rows = []) {
    const safeTicket = row => {
      const poloCode = POLOS.includes(row?.polo_code) ? row.polo_code : null;
      if (!poloCode || !Number.isInteger(Number(row?.ticket_number)) || Number(row.ticket_number) < 1) return null;
      return Object.freeze({
        ticketLabel: `${poloCode === 'talatona' ? 'TAL' : 'JDR'} #${String(Number(row.ticket_number)).padStart(3, '0')}`,
        poloLabel: POLO_LABELS[poloCode],
        destination: clean(row.destination_service, 80) || 'Atendimento'
      });
    };
    const validRows = Array.isArray(rows) ? rows : [];
    const called = validRows
      .filter(row => row?.status === 'in_service')
      .slice()
      .sort((a, b) => {
        const aTime = Date.parse(a.service_started_at || '');
        const bTime = Date.parse(b.service_started_at || '');
        return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
      })
      .map(safeTicket)
      .filter(Boolean);
    const next = safeTicket(selectNextWaitingVisit(validRows));
    return Object.freeze({ called: Object.freeze(called), next });
  }

  function createReceptionBusinessRepository({ supabase } = {}) {
    if (!supabase || typeof supabase.from !== 'function' || typeof supabase.schema !== 'function') {
      throw new Error('A ligação aos motores financeiros e de aprovisionamento não está disponível.');
    }

    async function rows(query) {
      const { data, error } = await query;
      if (error) throw error;
      return Object.freeze(Array.isArray(data) ? data : []);
    }

    function requireCompany(companyId) {
      const id = clean(companyId, 128);
      if (!id) throw new Error('É obrigatório identificar a empresa para consultar dados financeiros.');
      return id;
    }

    return Object.freeze({
      async getActiveServices(companyId) {
        const id = requireCompany(companyId);
        return rows(supabase.from('finance_servicos')
          .select('id,codigo,nome,categoria,unidade,preco_base,taxa_imposto,codigo_imposto')
          .eq('empresa_id', id)
          .eq('ativo', true)
          .order('nome', { ascending: true })
          .limit(100));
      },
      async getCashboxes(companyId) {
        const id = requireCompany(companyId);
        return rows(supabase.from('finance_caixas')
          .select('id,codigo,nome,localizacao,estado,moeda,empresa_id')
          .eq('empresa_id', id)
          .order('nome', { ascending: true })
          .limit(50));
      },
      async getRecentDocuments(companyId) {
        const id = requireCompany(companyId);
        return rows(supabase.from('finance_documentos')
          .select('id,document_no,tipo_documento,document_status,data_emissao,total,estado_pagamento,fiscal_status,empresa_id')
          .eq('empresa_id', id)
          .order('data_emissao', { ascending: false })
          .limit(10));
      },
      async getStockBalances() {
        return rows(supabase.schema('ciadi_ti').from('stock_balances')
          .select('item_id,sku,item_name,unit_of_measure,minimum_stock,warehouse_id,warehouse_code,warehouse_name,quantity_on_hand,below_minimum')
          .order('item_name', { ascending: true })
          .limit(100));
      },
      async getPurchaseRequests() {
        return rows(supabase.schema('ciadi_ti').from('purchase_requests')
          .select('id,request_number,status,justification,estimated_total,finance_decision_at,finance_decision_note,created_at')
          .order('created_at', { ascending: false })
          .limit(20));
      }
    });
  }

  function renderReceptionDocumentHeader({ identity = globalThis.CIADI_INSTITUTIONAL_IDENTITY, title, reference = '', date = '' } = {}) {
    if (!identity || typeof identity.getBrand !== 'function' || typeof identity.renderDocumentHeader !== 'function') {
      throw new Error('O serviço central de identidade documental CIADI não está disponível.');
    }
    const brand = identity.getBrand();
    if (!brand?.logoDataUrl || !/^data:image\/(png|jpeg|jpg);base64,/i.test(brand.logoDataUrl)) {
      throw new Error('O logótipo oficial CIADI incorporado não está disponível.');
    }
    return identity.renderDocumentHeader({ title, reference, date, logoUrl: brand.logoDataUrl });
  }

  function createReceptionRepository({ supabase } = {}) {
    if (!supabase || typeof supabase.schema !== 'function') {
      throw new Error('A ligação ao serviço de Recepção não está disponível.');
    }
    const db = supabase.schema('ciadi_reception');
    if (!db || typeof db.rpc !== 'function') {
      throw new Error('O serviço de Recepção CIADI não está exposto nesta ligação.');
    }

    async function call(name, args) {
      const { data, error } = await db.rpc(name, args);
      if (error) throw error;
      return data;
    }

    return Object.freeze({
      async searchAppointments({ term, dateFrom, dateTo } = {}) {
        const needle = clean(term, 80).replace(/[%,_(),\\]/g, ' ').replace(/\s+/g, ' ').trim();
        if (needle.length < 2) throw new Error('Introduza pelo menos dois caracteres para pesquisar o utente.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom || '') || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo || '')) {
          throw new Error('Seleccione um intervalo de datas válido.');
        }
        if (dateFrom > dateTo) throw new Error('A data inicial não pode ser posterior à data final.');
        const { data, error } = await db.rpc('reception_search_appointments', {
          p_search_term: needle,
          p_date_from: dateFrom,
          p_date_to: dateTo
        });
        if (error) throw error;
        return Object.freeze(Array.isArray(data) ? data : []);
      },
      async getDashboard(poloCode) {
        if (poloCode && !POLOS.includes(poloCode)) throw new Error('Polo inválido.');
        return call('reception_get_dashboard', { p_polo_code: poloCode || null });
      },
      async getDestinations() {
        const rows = await call('reception_get_destinations', {});
        return Object.freeze((Array.isArray(rows) ? rows : []).filter(row =>
          row && clean(row.id, 128) && clean(row.name, 80)
        ).map(row => Object.freeze({ id: clean(row.id, 128), name: clean(row.name, 80) })));
      },
      async routeVisit(visitId, specialtyId, actorId) {
        if (!clean(visitId, 128) || !clean(specialtyId, 128) || !clean(actorId, 128)) {
          throw new Error('Atendimento, destino e sessão autenticada são obrigatórios.');
        }
        return call('reception_route_visit', {
          p_visit_id: clean(visitId, 128),
          p_destination_specialty_id: clean(specialtyId, 128),
          p_actor_id: clean(actorId, 128)
        });
      },
      async confirmReferral(visitId, actorId) {
        if (!clean(visitId, 128) || !clean(actorId, 128)) {
          throw new Error('Atendimento e sessão autenticada são obrigatórios.');
        }
        return call('reception_confirm_referral', {
          p_visit_id: clean(visitId, 128),
          p_actor_id: clean(actorId, 128)
        });
      },
      async returnReferral(visitId, reason, actorId) {
        const note = clean(reason, 240);
        if (!clean(visitId, 128) || !clean(actorId, 128)) {
          throw new Error('Atendimento e sessão autenticada são obrigatórios.');
        }
        if (note.length < 3) throw new Error('Indique o motivo da devolução do encaminhamento.');
        return call('reception_return_referral', {
          p_visit_id: clean(visitId, 128),
          p_reason: note,
          p_actor_id: clean(actorId, 128)
        });
      },
      async registerArrival(input, actorId) {
        const checked = validateVisitInput(input);
        if (!checked.valid) throw new Error(checked.errors.join(' '));
        if (!clean(actorId, 128)) throw new Error('Sessão autenticada necessária.');
        const v = checked.value;
        return call('reception_register_arrival', {
          p_visit_type: v.visitType,
          p_appointment_id: v.appointmentId,
          p_patient_id: v.patientId,
          p_display_name: v.displayName,
          p_purpose: v.purpose,
          p_polo_code: v.poloCode,
          p_actor_id: clean(actorId, 128)
        });
      },
      async transitionVisit(visitId, current, next, actorId) {
        const checked = transitionVisitStatus(current, next);
        if (!checked.valid) throw new Error(checked.errors.join(' '));
        if (!clean(visitId, 128) || !clean(actorId, 128)) throw new Error('Identificador do atendimento e sessão autenticada são obrigatórios.');
        return call('reception_transition_visit', {
          p_visit_id: clean(visitId, 128),
          p_from_status: current,
          p_to_status: next,
          p_actor_id: clean(actorId, 128)
        });
      },
      async registerVisitor(input, actorId) {
        const checked = validateVisitorInput(input);
        if (!checked.valid) throw new Error(checked.errors.join(' '));
        if (!clean(actorId, 128)) throw new Error('Sessão autenticada necessária.');
        return call('reception_register_visitor', {
          p_display_name: checked.value.displayName,
          p_purpose: checked.value.purpose,
          p_host_department: checked.value.hostDepartment,
          p_polo_code: checked.value.poloCode,
          p_actor_id: clean(actorId, 128)
        });
      },
      async closeVisitor(visitorId, actorId) {
        if (!clean(visitorId, 128) || !clean(actorId, 128)) throw new Error('Identificador do visitante e sessão autenticada são obrigatórios.');
        return call('reception_close_visitor', {
          p_visitor_id: clean(visitorId, 128),
          p_actor_id: clean(actorId, 128)
        });
      }
    });
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function renderBusinessPanel(snapshot = {}) {
    const cards = [
      { key: 'services', title: 'Serviços e preços', render: rows => rows.slice(0, 5).map(row => '<div class="flex justify-between gap-2 py-1 border-b text-sm"><span>' + esc(row.nome) + '</span><strong>' + esc(row.preco_base) + ' Kz</strong></div>').join('') },
      { key: 'cashboxes', title: 'Caixas', render: rows => rows.slice(0, 5).map(row => '<div class="flex justify-between gap-2 py-1 border-b text-sm"><span>' + esc(row.nome || row.codigo) + '</span><strong>' + esc(row.estado || '—') + '</strong></div>').join('') },
      { key: 'documents', title: 'Documentos recentes', render: rows => rows.slice(0, 5).map(row => '<div class="flex justify-between gap-2 py-1 border-b text-sm"><span>' + esc(row.document_no || row.tipo_documento) + '</span><strong>' + esc(row.document_status || '—') + '</strong></div>').join('') },
      { key: 'stock', title: 'Stock e inventário', render: rows => rows.slice(0, 5).map(row => '<div class="flex justify-between gap-2 py-1 border-b text-sm"><span>' + esc(row.item_name) + ' <small class="text-slate-500">' + esc(row.warehouse_name) + '</small></span><strong class="' + (row.below_minimum ? 'text-red-700' : '') + '">' + esc(row.quantity_on_hand) + ' ' + esc(row.unit_of_measure) + '</strong></div>').join('') },
      { key: 'requests', title: 'Requisições de compra', render: rows => rows.slice(0, 5).map(row => '<div class="flex justify-between gap-2 py-1 border-b text-sm"><span>' + esc(row.request_number || row.id) + '</span><strong>' + esc(row.status) + '</strong></div>').join('') }
    ];
    return '<section class="card p-5 space-y-4" data-reception-business-integration>' +
      '<div><h3 class="font-black text-lg">Facturação, caixa e aprovisionamento</h3><p class="text-xs text-slate-500">Consulta das estruturas centrais existentes. Esta área é apenas de leitura; emissão, pagamentos, compras e movimentos de stock permanecem nos respectivos motores autorizados.</p></div>' +
      '<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">' +
      cards.map(card => {
        const result = snapshot[card.key];
        let content = '<p class="text-xs text-slate-500">A carregar dados…</p>';
        if (result && result.error) content = '<p class="text-xs text-amber-700">Sem acesso autorizado ou serviço indisponível.</p>';
        else if (result && result.rows.length) content = card.render(result.rows);
        else if (result) content = '<p class="text-xs text-slate-500">Sem registos disponíveis.</p>';
        return '<article class="rounded-xl border p-3"><h4 class="font-bold text-sm mb-2">' + card.title + '</h4>' + content + '</article>';
      }).join('') +
      '</div></section>';
  }

  function create({ root: container, navigate, notify = () => {}, supabase, actorId, poloCode, companyId: configuredCompanyId } = {}) {
    if (!container || typeof navigate !== 'function') {
      throw new Error('O módulo Recepção necessita do contentor e da navegação do Dashboard.');
    }

    let repository = null;
    let dashboard = null;
    let destinations = [];
    let activePolo = POLOS.includes(poloCode) ? poloCode : null;
    let businessRepository = null;
    let businessSnapshot = { services: null, cashboxes: null, documents: null, stock: null, requests: null };

    function renderUnavailable(error) {
      container.innerHTML = `
        <section class="card p-6 space-y-3">
          <span class="text-xs font-black uppercase tracking-widest text-orange">CIADI • Recepção</span>
          <h2 class="text-2xl font-black">Serviço de Recepção</h2>
          <p class="text-slate-600">O motor está preparado, mas a ligação ao serviço de dados ainda não está homologada.</p>
          <p class="text-sm text-amber-700">${esc(error?.message || 'Serviço indisponível.')}</p>
          <p class="text-xs text-slate-500">Nenhum atendimento ou visitante foi registado. A activação depende da proposta de base de dados e da fase de permissões.</p>
          <button type="button" data-reception-retry class="bg-orange text-white rounded-xl px-4 py-2 font-bold">Tentar novamente</button>
        </section>`;
    }

    function renderDashboard() {
      const data = dashboard || {};
      const visits = Array.isArray(data.visits) ? data.visits : [];
      const visitors = Array.isArray(data.visitors) ? data.visitors : [];
      const summary = data.summary || summarizeReception(visits);
      const brand = globalThis.CIADI_INSTITUTIONAL_IDENTITY?.getBrand?.() || null;
      container.innerHTML = `
        <section class="space-y-5">
          <header class="card p-6">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div class="flex items-center gap-3">${brand?.logoDataUrl ? `<img src="${esc(brand.logoDataUrl)}" alt="Logótipo CIADI" class="h-14 w-auto object-contain">` : ""}<div><span class="text-xs font-black uppercase tracking-widest text-orange">CIADI • Atendimento institucional</span>
                <h2 class="text-2xl font-black mt-1">Acolhimento e Recepção</h2></div></div>
                <p class="text-sm text-slate-500 mt-2">Gestão de chegadas, fila de espera, visitantes e encaminhamentos.</p>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button type="button" data-reception-form="arrival" class="bg-orange text-white rounded-xl px-4 py-2 font-bold">Registar chegada</button>
                <button type="button" data-reception-form="visitor" class="border rounded-xl px-4 py-2 font-bold">Registar visitante</button>
                <button type="button" data-reception-refresh class="border rounded-xl px-4 py-2">Actualizar</button>
              </div>
            </div>
            <div class="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <span class="font-semibold">Polo:</span>
              <select data-reception-polo class="border rounded-lg px-3 py-2">
                <option value="">Todos os polos</option>
                ${POLOS.map(code => `<option value="${code}" ${activePolo === code ? 'selected' : ''}>${POLO_LABELS[code]}</option>`).join('')}
              </select>
            </div>
          </header>
          <div class="grid grid-cols-2 xl:grid-cols-4 gap-3">
            ${[
              ['Atendimentos', summary.total || 0],
              ['Em espera', summary.waiting || 0],
              ['Em atendimento', summary.inService || 0],
              ['Tempo médio de espera', (summary.averageWaitMinutes || 0) + ' min']
            ].map(([label, value]) => `<article class="card p-4"><p class="text-sm text-slate-500">${label}</p><p class="text-2xl font-black mt-1">${esc(value)}</p></article>`).join('')}
          </div>
          ${renderBusinessPanel(businessSnapshot)}
          <section class="card p-5" data-reception-call-panel>
            <div class="flex items-center justify-between gap-3 mb-3">
              <div><h3 class="font-black text-lg">Painel de chamadas</h3><p class="text-xs text-slate-500">Pré-visualização pública: apenas senhas, polo e destino.</p></div>
              <span class="text-xs text-slate-500">Sem dados pessoais</span>
            </div>
            ${(() => {
              const panel = buildPublicCallPanelModel(visits);
              return `<div class="grid md:grid-cols-2 gap-3">
                <div class="rounded-xl bg-slate-50 border p-4">
                  <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Em chamada</p>
                  ${panel.called.length ? panel.called.map(ticket => `<div class="flex items-center justify-between gap-2 py-2 border-b last:border-0"><strong class="text-2xl text-orange">${esc(ticket.ticketLabel)}</strong><span class="text-sm text-slate-600">${esc(ticket.poloLabel)} · ${esc(ticket.destination)}</span></div>`).join('') : '<p class="text-sm text-slate-500">Nenhuma senha chamada.</p>'}
                </div>
                <div class="rounded-xl bg-slate-50 border p-4">
                  <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Próxima senha</p>
                  ${panel.next ? `<strong class="text-3xl text-orange">${esc(panel.next.ticketLabel)}</strong><p class="text-sm text-slate-600 mt-1">${esc(panel.next.poloLabel)} · ${esc(panel.next.destination)}</p>` : '<p class="text-sm text-slate-500">Sem utentes em espera.</p>'}
                </div>
              </div>`;
            })()}
          </section>
          <section class="card p-5">
            <div class="flex items-center justify-between gap-3 mb-3">
              <div><h3 class="font-black text-lg">Fila de atendimento</h3><p class="text-xs text-slate-500">Registos operacionais do dia, sem exposição de notas clínicas.</p></div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-slate-500">${visits.length} registo(s)</span>
                ${visits.some(row => row.status === 'waiting') ? '<button type="button" data-reception-call-next class="bg-orange text-white rounded-lg px-3 py-2 text-xs font-bold">Chamar próximo</button>' : ''}
              </div>
            </div>
            ${visits.length ? `
              <div class="overflow-x-auto"><table class="w-full text-sm">
                <thead><tr class="text-left border-b"><th class="py-2">Senha</th><th>Hora</th><th>Responsável</th><th>Finalidade</th><th>Polo</th><th>Estado</th><th>Destino do serviço</th><th>Acção</th></tr></thead>
                <tbody>${visits.map(visit => `
                  <tr class="border-b">
                    <td class="py-3 font-black text-orange">${esc(visit.polo_code === 'talatona' ? 'TAL' : 'JDR')} #${esc(String(visit.ticket_number || '—').padStart(3, '0'))}</td><td>${esc(visit.arrived_at ? new Date(visit.arrived_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '—')}</td>
                    <td class="font-semibold">${esc(visit.display_name)}</td>
                    <td>${esc(visit.purpose)}</td>
                    <td>${esc(POLO_LABELS[visit.polo_code] || visit.polo_code || '—')}</td>
                    <td><span>${esc(STATUS_LABELS[visit.status] || visit.status)}</span>${visit.referral_status ? `<span class="block text-xs mt-1 ${visit.referral_status === 'accepted' ? 'text-green-700' : visit.referral_status === 'returned' ? 'text-red-700' : 'text-amber-700'}">Encaminhamento: ${visit.referral_status === 'pending' ? 'Pendente de confirmação' : visit.referral_status === 'accepted' ? 'Recebido pelo serviço' : 'Devolvido'}</span>` : ''}</td>
                    <td>
                      ${['waiting', 'in_service'].includes(visit.status) ? `<div class="flex flex-wrap items-center gap-2">
                        <select data-route-destination="${esc(visit.id)}" class="border rounded-lg px-2 py-1 text-xs" aria-label="Destino de atendimento">
                          <option value="">Seleccionar serviço</option>
                          ${destinations.map(item => `<option value="${esc(item.id)}" ${visit.destination_specialty_id === item.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}
                        </select>
                        <button type="button" data-visit-route="${esc(visit.id)}" class="text-orange font-bold text-xs">Encaminhar</button>
                      </div>` : esc(visit.destination_service || '—')}
                    </td>
                    <td>${visit.status === 'waiting' ? `<button data-visit-action="in_service" data-visit-id="${esc(visit.id)}" class="text-orange font-bold">Iniciar</button>` : visit.status === 'in_service' ? `<button data-visit-action="completed" data-visit-id="${esc(visit.id)}" class="text-orange font-bold">Concluir</button>` : '—'}</td>
                  </tr>`).join('')}</tbody>
              </table></div>` : '<p class="text-sm text-slate-500 py-5">Não existem chegadas registadas para o filtro seleccionado.</p>'}
          </section>
          <section class="card p-5">
            <h3 class="font-black text-lg mb-3">Áreas institucionais integradas</h3>
            <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
              ${ROUTES.map(route => `<button type="button" data-reception-route="${route.id}" class="border rounded-xl p-3 text-left font-semibold hover:border-orange-400">${route.label}<span class="block text-xs font-normal text-slate-500 mt-1">Abrir área autorizada</span></button>`).join('')}
            </div>
          </section>
          <section class="card p-5">
            <h3 class="font-black text-lg mb-3">Visitantes no centro</h3>
            ${visitors.length ? `
              <div class="overflow-x-auto"><table class="w-full text-sm">
                <thead><tr class="text-left border-b"><th class="py-2">Entrada</th><th>Visitante</th><th>Destino</th><th>Finalidade</th><th>Polo</th><th>Acção</th></tr></thead>
                <tbody>${visitors.map(visitor => `
                  <tr class="border-b"><td class="py-3">${esc(visitor.entered_at ? new Date(visitor.entered_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '—')}</td>
                  <td class="font-semibold">${esc(visitor.display_name)}</td><td>${esc(visitor.host_department)}</td><td>${esc(visitor.purpose)}</td>
                  <td>${esc(POLO_LABELS[visitor.polo_code] || visitor.polo_code || '—')}</td>
                  <td><button data-visitor-exit="${esc(visitor.id)}" class="text-orange font-bold">Registar saída</button></td></tr>`).join('')}</tbody>
              </table></div>` : '<p class="text-sm text-slate-500 py-4">Não existem visitantes dentro do centro neste momento.</p>'}
          </section>
        </section>`;
    }

    let appointmentResults = [];
    let selectedAppointment = null;
    let appointmentSearch = { term: '', dateFrom: '', dateTo: '' };

    function renderArrivalForm() {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Luanda' });
      const dateFrom = appointmentSearch.dateFrom || today;
      const dateTo = appointmentSearch.dateTo || today;
      container.innerHTML = `
        <section class="card p-6 space-y-5">
          <div class="flex items-center justify-between gap-3"><div><span class="text-xs font-black uppercase tracking-widest text-orange">CIADI • Recepção</span><h2 class="text-2xl font-black">Registar chegada</h2></div><button data-reception-home class="border rounded-lg px-3 py-2">Voltar</button></div>
          <section class="rounded-xl border p-4 space-y-3">
            <h3 class="font-bold">Localizar marcação existente</h3>
            <form data-reception-appointment-search class="grid md:grid-cols-4 gap-3">
              <label class="text-sm font-semibold md:col-span-2">Nome ou código do utente<input name="term" required minlength="2" maxlength="80" value="${esc(appointmentSearch.term)}" class="block w-full border rounded-lg p-2 mt-1" placeholder="Pesquisar nome ou código"></label>
              <label class="text-sm font-semibold">Data inicial<input name="dateFrom" type="date" required value="${esc(dateFrom)}" class="block w-full border rounded-lg p-2 mt-1"></label>
              <label class="text-sm font-semibold">Data final<input name="dateTo" type="date" required value="${esc(dateTo)}" class="block w-full border rounded-lg p-2 mt-1"></label>
              <div class="md:col-span-4"><button type="submit" class="border border-orange text-orange rounded-lg px-4 py-2 font-bold">Pesquisar agenda</button></div>
            </form>
            <div data-reception-appointment-results aria-live="polite">
              ${appointmentResults.length ? appointmentResults.map(row => `<button type="button" data-appointment-select="${esc(row.id)}" class="w-full text-left border rounded-lg p-3 mt-2 hover:border-orange-400">
                <span class="font-bold">${esc(row.patient_name)}</span><span class="block text-sm text-slate-600">${esc(row.responsible_name || 'Responsável não indicado')} • ${esc(new Date(row.data_hora).toLocaleString('pt-PT'))}</span>
                <span class="block text-xs text-slate-500">${esc(row.estado)} • ${esc(row.tipo)} • ${esc(row.id === selectedAppointment?.id ? 'Seleccionada' : 'Seleccionar marcação')}</span>
              </button>`).join('') : '<p class="text-sm text-slate-500">Pesquise para localizar uma marcação. Não é necessário introduzir identificadores manualmente.</p>'}
            </div>
          </section>
          ${selectedAppointment ? `<div class="rounded-xl bg-orange-50 border border-orange-200 p-3 text-sm"><strong>Marcação seleccionada:</strong> ${esc(selectedAppointment.patient_name)} — ${esc(new Date(selectedAppointment.data_hora).toLocaleString('pt-PT'))}</div>` : ''}
          <form data-reception-arrival-form class="grid md:grid-cols-2 gap-4">
            <label class="text-sm font-semibold">Tipo de chegada<select name="visitType" required class="block w-full border rounded-xl p-3 mt-1"><option value="appointment" ${selectedAppointment ? 'selected' : ''}>Com marcação</option><option value="walk_in">Sem marcação</option></select></label>
            <label class="text-sm font-semibold">Polo<select name="poloCode" required class="block w-full border rounded-xl p-3 mt-1">${POLOS.map(code => `<option value="${code}" ${activePolo === code ? 'selected' : ''}>${POLO_LABELS[code]}</option>`).join('')}</select></label>
            <input type="hidden" name="appointmentId" value="${esc(selectedAppointment?.id || '')}">
            <input type="hidden" name="patientId" value="${esc(selectedAppointment?.paciente_id || '')}">
            <label class="text-sm font-semibold">Nome do responsável presente<input name="displayName" required maxlength="120" value="${esc(selectedAppointment?.responsible_name || '')}" class="block w-full border rounded-xl p-3 mt-1"></label>
            <label class="text-sm font-semibold">Finalidade<input name="purpose" required maxlength="160" value="${esc(selectedAppointment ? 'Atendimento agendado' : '')}" class="block w-full border rounded-xl p-3 mt-1" placeholder="Ex.: consulta agendada, pedido de informação"></label>
            <p class="md:col-span-2 text-xs text-slate-500">A recepção consulta apenas os dados necessários à identificação da marcação. Não introduza notas clínicas.</p>
            <div class="md:col-span-2 flex items-center gap-3"><button class="bg-orange text-white rounded-xl px-4 py-2 font-bold" type="submit">Confirmar chegada</button><span data-reception-message class="text-sm text-slate-500"></span></div>
          </form>
        </section>`;
    }

    function renderVisitorForm() {
      container.innerHTML = `
        <section class="card p-6">
          <div class="flex items-center justify-between gap-3"><div><span class="text-xs font-black uppercase tracking-widest text-orange">CIADI • Controlo de entradas</span><h2 class="text-2xl font-black">Registar visitante</h2></div><button data-reception-home class="border rounded-lg px-3 py-2">Voltar</button></div>
          <form data-reception-visitor-form class="grid md:grid-cols-2 gap-4 mt-5">
            <label class="text-sm font-semibold">Nome do visitante<input name="displayName" required maxlength="120" class="block w-full border rounded-xl p-3 mt-1"></label>
            <label class="text-sm font-semibold">Polo<select name="poloCode" required class="block w-full border rounded-xl p-3 mt-1">${POLOS.map(code => `<option value="${code}" ${activePolo === code ? 'selected' : ''}>${POLO_LABELS[code]}</option>`).join('')}</select></label>
            <label class="text-sm font-semibold">Serviço de destino<input name="hostDepartment" required maxlength="100" class="block w-full border rounded-xl p-3 mt-1" placeholder="Ex.: Administração"></label>
            <label class="text-sm font-semibold">Finalidade<input name="purpose" required maxlength="160" class="block w-full border rounded-xl p-3 mt-1"></label>
            <p class="md:col-span-2 text-xs text-slate-500">O módulo não recolhe número de Bilhete de Identidade ou outros identificadores documentais nesta fase.</p>
            <div class="md:col-span-2 flex items-center gap-3"><button class="bg-orange text-white rounded-xl px-4 py-2 font-bold" type="submit">Registar entrada</button><span data-reception-message class="text-sm text-slate-500"></span></div>
          </form>
        </section>`;
    }

    async function loadBusinessSnapshot() {
      if (!businessRepository) businessRepository = createReceptionBusinessRepository({ supabase });
      let company = clean(configuredCompanyId, 128);
      if (!company) {
        try {
          const { data, error } = await supabase.from('finance_empresas')
            .select('id')
            .eq('ativo', true)
            .eq('empresa_principal', true)
            .maybeSingle();
          if (error) throw error;
          company = clean(data?.id, 128);
        } catch (error) {
          businessSnapshot.services = { rows: [], error };
          businessSnapshot.cashboxes = { rows: [], error };
          businessSnapshot.documents = { rows: [], error };
        }
      }
      const tasks = [
        ['services', () => company ? businessRepository.getActiveServices(company) : Promise.resolve([])],
        ['cashboxes', () => company ? businessRepository.getCashboxes(company) : Promise.resolve([])],
        ['documents', () => company ? businessRepository.getRecentDocuments(company) : Promise.resolve([])],
        ['stock', () => businessRepository.getStockBalances()],
        ['requests', () => businessRepository.getPurchaseRequests()]
      ];
      const results = await Promise.all(tasks.map(async ([key, load]) => {
        if (businessSnapshot[key]?.error && ['services', 'cashboxes', 'documents'].includes(key) && !company) return [key, businessSnapshot[key]];
        try { return [key, { rows: await load(), error: null }]; }
        catch (error) { return [key, { rows: [], error }]; }
      }));
      businessSnapshot = Object.fromEntries(results);
    }

    async function refresh() {
      if (!repository) repository = createReceptionRepository({ supabase });
      const [nextDashboard, nextDestinations] = await Promise.all([
        repository.getDashboard(activePolo),
        repository.getDestinations()
      ]);
      dashboard = nextDashboard;
      destinations = nextDestinations;
      await loadBusinessSnapshot();
      renderDashboard();
    }

    async function renderHome() {
      try {
        if (!supabase) throw new Error('A sessão do Supabase não foi fornecida ao módulo.');
        if (!actorId) throw new Error('Não foi possível identificar a sessão autenticada.');
        repository = createReceptionRepository({ supabase });
        await refresh();
      } catch (error) {
        renderUnavailable(error);
      }
    }

    if (!container.__ciadiReceptionBound) {
      container.__ciadiReceptionBound = true;
      container.addEventListener('click', async event => {
        const button = event.target.closest('button');
        if (!button) return;
        try {
          if (button.hasAttribute('data-reception-route')) {
            const route = ROUTES.find(item => item.id === button.getAttribute('data-reception-route'));
            if (route) navigate(route.id);
            return;
          }
          if (button.hasAttribute('data-reception-retry')) return renderHome();
          if (button.hasAttribute('data-reception-home')) return renderHome();
          if (button.hasAttribute('data-reception-refresh')) return refresh();
          if (button.hasAttribute('data-reception-form')) {
            selectedAppointment = null;
            appointmentResults = [];
            appointmentSearch = { term: '', dateFrom: '', dateTo: '' };
            return button.getAttribute('data-reception-form') === 'arrival' ? renderArrivalForm() : renderVisitorForm();
          }
          if (button.hasAttribute('data-appointment-select')) {
            selectedAppointment = appointmentResults.find(row => String(row.id) === button.getAttribute('data-appointment-select')) || null;
            if (!selectedAppointment) throw new Error('A marcação seleccionada já não está disponível.');
            return renderArrivalForm();
          }
          if (button.hasAttribute('data-reception-call-next')) {
            const nextVisit = selectNextWaitingVisit(dashboard?.visits || []);
            if (!nextVisit) throw new Error('Não existem utentes em espera.');
            await repository.transitionVisit(nextVisit.id, 'waiting', 'in_service', actorId);
            notify(`Senha ${nextVisit.polo_code === 'talatona' ? 'TAL' : 'JDR'} #${String(nextVisit.ticket_number || '').padStart(3, '0')} chamada para atendimento.`);
            try { await refresh(); } catch (refreshError) { renderUnavailable(refreshError); }
            return;
          }
          if (button.hasAttribute('data-visit-route')) {
            const visitId = button.getAttribute('data-visit-route');
            const selector = Array.from(container.querySelectorAll('[data-route-destination]')).find(item => item.getAttribute('data-route-destination') === visitId);
            const specialtyId = selector?.value || '';
            if (!specialtyId) throw new Error('Seleccione o serviço de destino antes de encaminhar.');
            await repository.routeVisit(visitId, specialtyId, actorId);
            notify('Encaminhamento registado no histórico do atendimento.');
            try { await refresh(); } catch (refreshError) { renderUnavailable(refreshError); }
            return;
          }
          if (button.hasAttribute('data-visit-action')) {
            const visit = (dashboard?.visits || []).find(row => String(row.id) === button.getAttribute('data-visit-id'));
            if (!visit) throw new Error('O atendimento seleccionado já não está disponível.');
            await repository.transitionVisit(visit.id, visit.status, button.getAttribute('data-visit-action'), actorId);
            notify('Estado do atendimento actualizado.');
            try { await refresh(); } catch (refreshError) { renderUnavailable(refreshError); }
            return;
          }
          if (button.hasAttribute('data-visitor-exit')) {
            await repository.closeVisitor(button.getAttribute('data-visitor-exit'), actorId);
            notify('Saída do visitante registada.');
            return refresh();
          }
        } catch (error) { notify(error.message || 'Não foi possível concluir a operação.'); }
      });

      container.addEventListener('change', async event => {
        if (event.target.matches('[data-reception-polo]')) {
          activePolo = event.target.value || null;
          try { await refresh(); } catch (error) { renderUnavailable(error); }
        }
      });

      container.addEventListener('submit', async event => {
        const form = event.target;
        if (form.matches('[data-reception-appointment-search]')) {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(form).entries());
          appointmentSearch = { term: values.term, dateFrom: values.dateFrom, dateTo: values.dateTo };
          const results = form.parentElement.querySelector('[data-reception-appointment-results]');
          results.textContent = 'A pesquisar agenda...';
          try {
            appointmentResults = await repository.searchAppointments(appointmentSearch);
            selectedAppointment = null;
            renderArrivalForm();
            const output = container.querySelector('[data-reception-appointment-results]');
            if (!appointmentResults.length) output.innerHTML = '<p class="text-sm text-slate-500">Não foram encontradas marcações para os critérios indicados.</p>';
          } catch (error) {
            results.textContent = error.message || 'Não foi possível pesquisar a agenda.';
          }
          return;
        }
        if (form.matches('[data-reception-arrival-form]')) {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(form).entries());
          const message = form.querySelector('[data-reception-message]');
          const button = form.querySelector('button[type="submit"]');
          button.disabled = true;
          try {
            await repository.registerArrival(values, actorId);
            notify('Chegada registada.');
            try { await refresh(); } catch (refreshError) { renderUnavailable(refreshError); }
          } catch (error) {
            button.disabled = false;
            message.textContent = error.message || 'Não foi possível registar a chegada.';
          }
        }
        if (form.matches('[data-reception-visitor-form]')) {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(form).entries());
          const message = form.querySelector('[data-reception-message]');
          const button = form.querySelector('button[type="submit"]');
          button.disabled = true;
          try {
            await repository.registerVisitor(values, actorId);
            notify('Entrada do visitante registada.');
            try { await refresh(); } catch (refreshError) { renderUnavailable(refreshError); }
          } catch (error) {
            button.disabled = false;
            message.textContent = error.message || 'Não foi possível registar o visitante.';
          }
        }
      });
    }

    return Object.freeze({ renderHome, refresh });
  }

  return Object.freeze({
    POLOS, VISIT_TYPES, VISIT_STATUSES, VISITOR_STATUSES, STATUS_LABELS, ROUTES,
    validateVisitInput, transitionVisitStatus, validateVisitorInput,
    summarizeReception, selectNextWaitingVisit, buildPublicCallPanelModel, createReceptionRepository, createReceptionBusinessRepository, renderReceptionDocumentHeader, create
  });
});
