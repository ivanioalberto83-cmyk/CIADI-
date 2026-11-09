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
        const needle = clean(term, 80).replace(/[%,_(),\\\\]/g, ' ').replace(/\\s+/g, ' ').trim();
        if (needle.length < 2) throw new Error('Introduza pelo menos dois caracteres para pesquisar o utente.');
        if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(dateFrom || '') || !/^\\d{4}-\\d{2}-\\d{2}$/.test(dateTo || '')) {
          throw new Error('Seleccione um intervalo de datas válido.');
        }
        if (dateFrom > dateTo) throw new Error('A data inicial não pode ser posterior à data final.');
        const patientQuery = await supabase.from('pacientes')
          .select('id,nome_completo,codigo_paciente,nome_responsavel')
          .or(['nome_completo','codigo_paciente','nome_responsavel'].map(field => `${field}.ilike.%${needle}%`).join(','))
          .limit(30);
        if (patientQuery.error) throw patientQuery.error;
        const patients = Array.isArray(patientQuery.data) ? patientQuery.data : [];
        if (!patients.length) return Object.freeze([]);
        const patientIds = patients.map(patient => patient.id).filter(Boolean);
        const appointmentQuery = await supabase.from('agendamentos')
          .select('id,paciente_id,profissional_id,especialidade_id,data_hora,duracao_minutos,tipo,estado,modalidade,checkin_em')
          .in('paciente_id', patientIds)
          .gte('data_hora', `${dateFrom}T00:00:00+01:00`)
          .lte('data_hora', `${dateTo}T23:59:59.999+01:00`)
          .order('data_hora', { ascending: true })
          .limit(50);
        if (appointmentQuery.error) throw appointmentQuery.error;
        const byPatient = new Map(patients.map(patient => [patient.id, patient]));
        return Object.freeze((Array.isArray(appointmentQuery.data) ? appointmentQuery.data : []).map(row => {
          const patient = byPatient.get(row.paciente_id) || {};
          return Object.freeze({
            ...row,
            patient_name: patient.nome_completo || '',
            responsible_name: patient.nome_responsavel || ''
          });
        }));
      },
      async getDashboard(poloCode) {
        if (poloCode && !POLOS.includes(poloCode)) throw new Error('Polo inválido.');
        return call('reception_get_dashboard', { p_polo_code: poloCode || null });
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

  function create({ root: container, navigate, notify = () => {}, supabase, actorId, poloCode } = {}) {
    if (!container || typeof navigate !== 'function') {
      throw new Error('O módulo Recepção necessita do contentor e da navegação do Dashboard.');
    }

    let repository = null;
    let dashboard = null;
    let activePolo = POLOS.includes(poloCode) ? poloCode : null;

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
      container.innerHTML = `
        <section class="space-y-5">
          <header class="card p-6">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span class="text-xs font-black uppercase tracking-widest text-orange">CIADI • Atendimento institucional</span>
                <h2 class="text-2xl font-black mt-1">Acolhimento e Recepção</h2>
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
          <section class="card p-5">
            <div class="flex items-center justify-between gap-3 mb-3">
              <div><h3 class="font-black text-lg">Fila de atendimento</h3><p class="text-xs text-slate-500">Registos operacionais do dia, sem exposição de notas clínicas.</p></div>
              <span class="text-xs text-slate-500">${visits.length} registo(s)</span>
            </div>
            ${visits.length ? `
              <div class="overflow-x-auto"><table class="w-full text-sm">
                <thead><tr class="text-left border-b"><th class="py-2">Hora</th><th>Responsável</th><th>Finalidade</th><th>Polo</th><th>Estado</th><th>Acção</th></tr></thead>
                <tbody>${visits.map(visit => `
                  <tr class="border-b">
                    <td class="py-3">${esc(visit.arrived_at ? new Date(visit.arrived_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '—')}</td>
                    <td class="font-semibold">${esc(visit.display_name)}</td>
                    <td>${esc(visit.purpose)}</td>
                    <td>${esc(POLO_LABELS[visit.polo_code] || visit.polo_code || '—')}</td>
                    <td>${esc(STATUS_LABELS[visit.status] || visit.status)}</td>
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

    async function refresh() {
      if (!repository) repository = createReceptionRepository({ supabase });
      dashboard = await repository.getDashboard(activePolo);
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
    summarizeReception, createReceptionRepository, create
  });
});
