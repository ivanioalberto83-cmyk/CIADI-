const test = require('node:test');
const assert = require('node:assert/strict');
const reception = require('../../renderer/modules/reception-module.js');

test('valida chegada de utente com marcação e polo conhecido', () => {
  const result = reception.validateVisitInput({
    visitType: 'appointment',
    appointmentId: 'appointment-1',
    patientId: 'patient-1',
    displayName: 'Responsável de utente',
    purpose: 'Consulta agendada',
    poloCode: 'talatona'
  });
  assert.equal(result.valid, true);
  assert.equal(result.value.appointmentId, 'appointment-1');
});

test('rejeita chegada sem marcação associada quando o tipo é appointment', () => {
  const result = reception.validateVisitInput({
    visitType: 'appointment',
    displayName: 'Responsável',
    purpose: 'Consulta',
    poloCode: 'talatona'
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(message => /marcação|agendamento/i.test(message)));
});

test('rejeita polos desconhecidos e campos obrigatórios vazios', () => {
  const result = reception.validateVisitInput({
    visitType: 'walk_in',
    displayName: '',
    purpose: '',
    poloCode: 'polo-inventado'
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 2);
});

test('permite apenas transições válidas no ciclo de atendimento', () => {
  assert.equal(reception.transitionVisitStatus('waiting', 'in_service').valid, true);
  assert.equal(reception.transitionVisitStatus('in_service', 'referred').valid, true);
  assert.equal(reception.transitionVisitStatus('referred', 'completed').valid, true);
  assert.equal(reception.transitionVisitStatus('completed', 'waiting').valid, false);
  assert.equal(reception.transitionVisitStatus('cancelled', 'in_service').valid, false);
});

test('valida registo de visitante sem exigir nem guardar número de documento', () => {
  const result = reception.validateVisitorInput({
    displayName: 'Visitante Institucional',
    purpose: 'Entrega de documentação',
    hostDepartment: 'Administração',
    poloCode: 'jardim_de_rosas'
  });
  assert.equal(result.valid, true);
  assert.equal(Object.hasOwn(result.value, 'documentNumber'), false);
});

test('rejeita visitante sem finalidade ou departamento de destino', () => {
  const result = reception.validateVisitorInput({
    displayName: 'Visitante',
    purpose: '',
    hostDepartment: '',
    poloCode: 'talatona'
  });
  assert.equal(result.valid, false);
});

test('resume fila e tempos de espera sem contar estados terminais como pendentes', () => {
  const result = reception.summarizeReception([
    { status: 'waiting', created_at: '2026-11-09T08:00:00.000Z' },
    { status: 'in_service', created_at: '2026-11-09T08:10:00.000Z', service_started_at: '2026-11-09T08:20:00.000Z' },
    { status: 'referred' },
    { status: 'completed' },
    { status: 'no_show' },
    { status: 'cancelled' }
  ]);
  assert.equal(result.total, 6);
  assert.equal(result.waiting, 1);
  assert.equal(result.inService, 1);
  assert.equal(result.referred, 1);
  assert.equal(result.completed, 1);
  assert.equal(result.noShow, 1);
  assert.equal(result.cancelled, 1);
  assert.equal(result.averageWaitMinutes, 10);
});

test('repositório grava exclusivamente por RPC no schema ciadi_reception', async () => {
  const calls = [];
  const supabase = {
    schema(schemaName) {
      assert.equal(schemaName, 'ciadi_reception');
      return {
        async rpc(name, args) {
          calls.push({ name, args });
          return { data: { id: 'record-1', ...args }, error: null };
        }
      };
    }
  };
  const repository = reception.createReceptionRepository({ supabase });
  await repository.registerArrival({
    visitType: 'walk_in',
    displayName: 'Responsável',
    purpose: 'Pedido de informação',
    poloCode: 'talatona'
  }, 'actor-1');
  await repository.transitionVisit('visit-1', 'waiting', 'in_service', 'actor-1');
  await repository.registerVisitor({
    displayName: 'Visitante',
    purpose: 'Entrega',
    hostDepartment: 'Administração',
    poloCode: 'jardim_de_rosas'
  }, 'actor-1');
  await repository.closeVisitor('visitor-1', 'actor-1');
  assert.deepEqual(calls.map(call => call.name), [
    'reception_register_arrival',
    'reception_transition_visit',
    'reception_register_visitor',
    'reception_close_visitor'
  ]);
  assert.equal(calls[0].args.p_actor_id, 'actor-1');
  assert.equal(calls[0].args.p_visit_type, 'walk_in');
  assert.equal(calls[1].args.p_to_status, 'in_service');
  assert.equal(calls[2].args.p_actor_id, 'actor-1');
});

test('dados inválidos são rejeitados antes de qualquer chamada ao Supabase', async () => {
  let calls = 0;
  const supabase = {
    schema() {
      return { async rpc() { calls += 1; return { data: null, error: null }; } };
    }
  };
  const repository = reception.createReceptionRepository({ supabase });
  await assert.rejects(
    () => repository.registerArrival({ visitType: 'appointment', displayName: 'Responsável', purpose: 'Consulta', poloCode: 'talatona' }, 'actor-1'),
    /marcação|agendamento/i
  );
  await assert.rejects(
    () => repository.registerVisitor({ displayName: '', purpose: 'Entrega', hostDepartment: 'Administração', poloCode: 'talatona' }, 'actor-1'),
    /visitante|nome/i
  );
  assert.equal(calls, 0);
});

test('painel diário usa RPC próprio no schema de Recepção', async () => {
  const calls = [];
  const repository = reception.createReceptionRepository({
    supabase: { schema(schemaName) {
      assert.equal(schemaName, 'ciadi_reception');
      return { async rpc(name, args) { calls.push({ name, args }); return { data: { visits: [], visitors: [], summary: {} }, error: null }; } };
    } }
  });
  const result = await repository.getDashboard('talatona');
  assert.deepEqual(result.visits, []);
  assert.equal(calls[0].name, 'reception_get_dashboard');
  assert.equal(calls[0].args.p_polo_code, 'talatona');
});

test('proposta SQL da Recepção mantém RLS sem abrir políticas ou grants prematuros', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const sql = fs.readFileSync(path.join(__dirname, '../../supabase/proposals/ciadi-reception-workflow-proposal.sql'), 'utf8');
  assert.match(sql, /create schema if not exists ciadi_reception/i);
  assert.match(sql, /alter table ciadi_reception\.front_desk_visits enable row level security/i);
  assert.match(sql, /alter table ciadi_reception\.front_desk_visit_events enable row level security/i);
  assert.match(sql, /alter table ciadi_reception\.visitor_entries enable row level security/i);
  assert.match(sql, /reception_register_arrival/i);
  assert.match(sql, /reception_transition_visit/i);
  assert.match(sql, /reception_register_visitor/i);
  assert.match(sql, /reception_close_visitor/i);
  assert.match(sql, /reception_get_dashboard/i);
  assert.match(sql, /reception_search_appointments/i);
  assert.match(sql, /security invoker/i);
  assert.match(sql, /front_desk_visits_appointment_unique_idx/i);
  assert.match(sql, /from public\.agendamentos a/i);
  assert.match(sql, /set estado = 'check-in'/i);
  assert.match(sql, /checkin_em = now\(\)/i);
  assert.match(sql, /revoke all on all tables in schema ciadi_reception from public, anon, authenticated/i);
  assert.match(sql, /revoke execute on all functions in schema ciadi_reception from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /create policy/i);
  assert.doesNotMatch(sql, /grant\s+[^;]+\s+to\s+authenticated/i);
});

test('Dashboard liga a Recepção à sessão autenticada sem misturar o módulo clínico', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '../../CIADI_DASHBOARD_FINANCEIRO.html'), 'utf8');
  assert.match(html, /renderer\/modules\/reception-module\.js/);
  assert.match(html, /CIADI_RECEPTION_MODULE\.create\(\{root:c,navigate:go,notify:toast,supabase:sb,actorId:me\?\.id/);
});


test('pesquisa marcações existentes por nome/código e período sem escrever na tabela clínica', async () => {
  const calls = [];
  const rows = [{
    id: 'appointment-1', paciente_id: 'patient-1', profissional_id: 'professional-1',
    especialidade_id: 'specialty-1', data_hora: '2026-11-09T09:00:00.000Z',
    duracao_minutos: 45, tipo: 'presencial', estado: 'confirmada',
    modalidade: 'presencial', checkin_em: null
  }];
  function query(table) {
    const q = {
      select(columns) { calls.push(['select', table, columns]); return q; },
      in(column, values) { calls.push(['in', table, column, values]); return q; },
      is(column, value) { calls.push(['is', table, column, value]); return q; },
      gte(column, value) { calls.push(['gte', table, column, value]); return q; },
      lte(column, value) { calls.push(['lte', table, column, value]); return q; },
      order(column, options) { calls.push(['order', table, column, options]); return q; },
      limit(value) { calls.push(['limit', table, value]); return q; },
      ilike(column, value) { calls.push(['ilike', table, column, value]); return q; },
      or(value) { calls.push(['or', table, value]); return q; },
      then(resolve) { resolve({ data: table === 'agendamentos' ? rows : [{ id: 'patient-1', nome_completo: 'Maria', nome_responsavel: 'Responsável Maria' }], error: null }); }
    };
    return q;
  }
  const supabase = {
    schema(name) {
      assert.equal(name, 'ciadi_reception');
      return { async rpc(rpcName, args) {
        calls.push({ rpcName, args });
        return { data: rows.map(row => ({ ...row, patient_name: 'Maria', responsible_name: 'Responsável Maria' })), error: null };
      } };
    }
  };
  const repository = reception.createReceptionRepository({ supabase });
  const result = await repository.searchAppointments({ term: 'Maria', dateFrom: '2026-11-09', dateTo: '2026-11-09' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'appointment-1');
  assert.equal(calls[0].rpcName, 'reception_search_appointments');
  assert.deepEqual(calls[0].args, { p_search_term: 'Maria', p_date_from: '2026-11-09', p_date_to: '2026-11-09' });
  assert.equal(calls.some(call => call.rpcName === 'insert' || call.rpcName === 'update'), false);
});

test('check-in de marcação exige selecção de resultado existente, sem introdução manual de UUID', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '../../renderer/modules/reception-module.js'), 'utf8');
  assert.match(source, /data-reception-appointment-search/);
  assert.match(source, /data-reception-appointment-results/);
  assert.doesNotMatch(source, /name="appointmentId"[^>]*placeholder="ID da marcação existente"/);
});


test('emite e selecciona a próxima senha por ordem de fila, ignorando estados terminais', () => {
  const rows = [
    { id: 'later', status: 'waiting', ticket_number: 12, arrived_at: '2026-11-09T09:12:00Z' },
    { id: 'serving', status: 'in_service', ticket_number: 10, arrived_at: '2026-11-09T09:00:00Z' },
    { id: 'first', status: 'waiting', ticket_number: 11, arrived_at: '2026-11-09T09:05:00Z' },
    { id: 'closed', status: 'completed', ticket_number: 9, arrived_at: '2026-11-09T08:55:00Z' }
  ];
  assert.equal(reception.selectNextWaitingVisit(rows).id, 'first');
  assert.equal(reception.selectNextWaitingVisit([
    { id: 'talatona', status: 'waiting', polo_code: 'talatona', ticket_number: 2, arrived_at: '2026-11-09T09:02:00Z' },
    { id: 'rosas', status: 'waiting', polo_code: 'jardim_de_rosas', ticket_number: 1, arrived_at: '2026-11-09T09:01:00Z' }
  ]).id, 'rosas');
  assert.equal(reception.selectNextWaitingVisit([{ status: 'completed', ticket_number: 1 }]), null);
});

test('a proposta SQL gera senhas por polo e dia com contador transaccional', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const sql = fs.readFileSync(path.join(__dirname, '../../supabase/proposals/ciadi-reception-workflow-proposal.sql'), 'utf8');
  assert.match(sql, /front_desk_queue_counters/i);
  assert.match(sql, /on conflict \(polo_code, service_day\)/i);
  assert.match(sql, /last_ticket_number = ciadi_reception\.front_desk_queue_counters\.last_ticket_number \+ 1/i);
  assert.match(sql, /unique \(polo_code, service_day, ticket_number\)/i);
  assert.match(sql, /'ticket_number', v_visit\.ticket_number/i);
});


test('painel público expõe apenas senhas e destinos, sem nomes ou finalidade', () => {
  const model = reception.buildPublicCallPanelModel([
    { id: 'a', status: 'in_service', polo_code: 'talatona', ticket_number: 7, service_started_at: '2026-11-09T09:10:00Z', display_name: 'Nome confidencial', purpose: 'Informação clínica', host_department: 'Psicologia' },
    { id: 'b', status: 'waiting', polo_code: 'jardim_de_rosas', ticket_number: 8, arrived_at: '2026-11-09T09:11:00Z', display_name: 'Outro nome', purpose: 'Consulta sensível' },
    { id: 'c', status: 'completed', polo_code: 'talatona', ticket_number: 6, arrived_at: '2026-11-09T09:00:00Z' }
  ]);
  assert.deepEqual(model.called, [{
    ticketLabel: 'TAL #007',
    poloLabel: 'Talatona',
    destination: 'Atendimento'
  }]);
  assert.deepEqual(model.next, {
    ticketLabel: 'JDR #008',
    poloLabel: 'Jardim de Rosas',
    destination: 'Atendimento'
  });
  assert.doesNotMatch(JSON.stringify(model), /Nome confidencial|Outro nome|Psicologia|Informação clínica|Consulta sensível/);
});

test('painel público ordena chamadas e próxima senha sem divulgar dados pessoais', () => {
  const model = reception.buildPublicCallPanelModel([
    { status: 'waiting', polo_code: 'talatona', ticket_number: 2, arrived_at: '2026-11-09T09:02:00Z' },
    { status: 'in_service', polo_code: 'jardim_de_rosas', ticket_number: 4, service_started_at: '2026-11-09T09:04:00Z' },
    { status: 'in_service', polo_code: 'talatona', ticket_number: 3, service_started_at: '2026-11-09T09:03:00Z' },
    { status: 'waiting', polo_code: 'jardim_de_rosas', ticket_number: 1, arrived_at: '2026-11-09T09:01:00Z' }
  ]);
  assert.deepEqual(model.called.map(row => row.ticketLabel), ['TAL #003', 'JDR #004']);
  assert.equal(model.next.ticketLabel, 'JDR #001');
  assert.equal(reception.buildPublicCallPanelModel([]).next, null);
});


test('encaminhamento usa catálogo activo de especialidades e RPC autenticada', async () => {
  const calls = [];
  const repository = reception.createReceptionRepository({
    supabase: { schema(name) {
      assert.equal(name, 'ciadi_reception');
      return { async rpc(method, args) {
        calls.push({ method, args });
        if (method === 'reception_get_destinations') return { data: [{ id: 'specialty-1', name: 'Psicologia Infantil' }], error: null };
        return { data: { id: 'visit-1', destination_specialty_id: args.p_destination_specialty_id }, error: null };
      } };
    } }
  });
  const destinations = await repository.getDestinations();
  assert.deepEqual(destinations, [{ id: 'specialty-1', name: 'Psicologia Infantil' }]);
  await repository.routeVisit('visit-1', 'specialty-1', 'actor-1');
  assert.deepEqual(calls, [
    { method: 'reception_get_destinations', args: {} },
    { method: 'reception_route_visit', args: { p_visit_id: 'visit-1', p_destination_specialty_id: 'specialty-1', p_actor_id: 'actor-1' } }
  ]);
});

test('encaminhamento rejeita identificadores incompletos antes de chamar a base de dados', async () => {
  let calls = 0;
  const repository = reception.createReceptionRepository({
    supabase: { schema() { return { async rpc() { calls += 1; return { data: null, error: null }; } }; } }
  });
  await assert.rejects(() => repository.routeVisit('', 'specialty-1', 'actor-1'), /obrigatórios/i);
  await assert.rejects(() => repository.routeVisit('visit-1', '', 'actor-1'), /obrigatórios/i);
  assert.equal(calls, 0);
});

test('painel público mostra especialidade de destino sem expor dados do utente', () => {
  const model = reception.buildPublicCallPanelModel([
    { status: 'in_service', polo_code: 'talatona', ticket_number: 12, service_started_at: '2026-11-09T09:00:00Z', destination_service: 'Psicologia Infantil', display_name: 'Nome privado', purpose: 'Informação clínica' }
  ]);
  assert.equal(model.called[0].destination, 'Psicologia Infantil');
  assert.doesNotMatch(JSON.stringify(model), /Nome privado|Informação clínica/);
});

test('contrato SQL suporta destino por especialidade e histórico de encaminhamento', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const sql = fs.readFileSync(path.join(__dirname, '../../supabase/proposals/ciadi-reception-workflow-proposal.sql'), 'utf8');
  assert.match(sql, /destination_specialty_id uuid references public\.especialidades\(id\)/i);
  assert.match(sql, /reception_get_destinations/i);
  assert.match(sql, /reception_route_visit/i);
  assert.match(sql, /destination_assigned/i);
});


test('confirmação de encaminhamento usa RPC autenticada e exige serviço de destino', async () => {
  const calls = [];
  const repository = reception.createReceptionRepository({
    supabase: { schema(name) {
      assert.equal(name, 'ciadi_reception');
      return { async rpc(method, args) {
        calls.push({ method, args });
        return { data: { id: 'visit-1', referral_status: 'accepted' }, error: null };
      } };
    } }
  });
  await repository.confirmReferral('visit-1', 'actor-1');
  assert.deepEqual(calls, [{
    method: 'reception_confirm_referral',
    args: { p_visit_id: 'visit-1', p_actor_id: 'actor-1' }
  }]);
});

test('devolução de encaminhamento exige motivo e não chama a base com dados incompletos', async () => {
  let calls = 0;
  const repository = reception.createReceptionRepository({
    supabase: { schema() { return { async rpc() { calls += 1; return { data: null, error: null }; } }; } }
  });
  await assert.rejects(() => repository.returnReferral('visit-1', '', 'actor-1'), /motivo/i);
  await assert.rejects(() => repository.returnReferral('', 'Sem vaga', 'actor-1'), /obrigatórios/i);
  assert.equal(calls, 0);
});

test('proposta SQL inclui estado auditável de confirmação e devolução de encaminhamento', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const sql = fs.readFileSync(path.join(__dirname, '../../supabase/proposals/ciadi-reception-workflow-proposal.sql'), 'utf8');
  assert.match(sql, /referral_status/i);
  assert.match(sql, /reception_confirm_referral/i);
  assert.match(sql, /reception_return_referral/i);
  assert.match(sql, /referral_accepted/i);
  assert.match(sql, /referral_returned/i);
});


test('repositório de integração lê os motores financeiros e de aprovisionamento existentes sem criar registos', async () => {
  const calls = [];
  function queryFor(schema, table) {
    const query = {
      select(columns) { calls.push({ schema, table, method: 'select', columns }); return query; },
      eq(column, value) { calls.push({ schema, table, method: 'eq', column, value }); return query; },
      order(column, options) { calls.push({ schema, table, method: 'order', column, options }); return query; },
      limit(value) { calls.push({ schema, table, method: 'limit', value }); return query; },
      then(resolve) {
        const rows = {
          finance_servicos: [{ id: 'service-1', nome: 'Consulta' }],
          finance_caixas: [{ id: 'cash-1', nome: 'Recepção Talatona' }],
          finance_documentos: [{ id: 'doc-1', document_no: 'FT 1/2026' }],
          stock_balances: [{ item_id: 'item-1', quantity_on_hand: 4 }],
          purchase_requests: [{ id: 'request-1', status: 'pending' }]
        }[table] || [];
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      }
    };
    return query;
  }
  const supabase = {
    from(table) { return queryFor('public', table); },
    schema(name) {
      assert.equal(name, 'ciadi_ti');
      return { from(table) { return queryFor(name, table); } };
    },
    async rpc() { throw new Error('A leitura de painéis não deve executar RPC de escrita.'); }
  };
  const repository = reception.createReceptionBusinessRepository({ supabase });
  const [services, cashboxes, documents, stock, requests] = await Promise.all([
    repository.getActiveServices('company-1'),
    repository.getCashboxes('company-1'),
    repository.getRecentDocuments('company-1'),
    repository.getStockBalances(),
    repository.getPurchaseRequests()
  ]);
  assert.equal(services[0].id, 'service-1');
  assert.equal(cashboxes[0].id, 'cash-1');
  assert.equal(documents[0].id, 'doc-1');
  assert.equal(stock[0].item_id, 'item-1');
  assert.equal(requests[0].id, 'request-1');
  assert.ok(calls.some(call => call.table === 'finance_servicos' && call.method === 'eq' && call.column === 'ativo' && call.value === true));
  assert.ok(calls.some(call => call.table === 'finance_caixas' && call.method === 'eq' && call.column === 'empresa_id' && call.value === 'company-1'));
  assert.ok(calls.some(call => call.table === 'finance_documentos' && call.method === 'eq' && call.column === 'empresa_id' && call.value === 'company-1'));
  assert.ok(calls.some(call => call.schema === 'ciadi_ti' && call.table === 'stock_balances'));
  assert.ok(calls.some(call => call.schema === 'ciadi_ti' && call.table === 'purchase_requests'));
  assert.equal(calls.some(call => ['insert', 'update', 'delete'].includes(call.method)), false);
});

test('repositório financeiro exige empresa para impedir consultas sem âmbito empresarial', async () => {
  let queries = 0;
  const supabase = {
    from() { queries += 1; throw new Error('Não deveria consultar sem empresa.'); },
    schema() { return { from() { queries += 1; throw new Error('Não deveria consultar sem empresa.'); } }; }
  };
  const repository = reception.createReceptionBusinessRepository({ supabase });
  await assert.rejects(() => repository.getActiveServices(''), /empresa/i);
  await assert.rejects(() => repository.getCashboxes(null), /empresa/i);
  await assert.rejects(() => repository.getRecentDocuments(undefined), /empresa/i);
  assert.equal(queries, 0);
});


test('cabeçalho documental da Recepção reutiliza a identidade CIADI e incorpora o logótipo oficial', () => {
  const identity = require('../../renderer/core/institutional-identity-service.js');
  const html = reception.renderReceptionDocumentHeader({
    identity,
    title: 'Comprovativo de Atendimento',
    reference: 'REC-2026-0001',
    date: '09/11/2026'
  });
  const brand = identity.getBrand();
  assert.match(html, /Logótipo CIADI/i);
  assert.ok(html.includes(brand.logoDataUrl));
  assert.match(html, /Comprovativo de Atendimento/);
  assert.match(html, /REC-2026-0001/);
});

test('cabeçalho documental falha fechado se a identidade central ou o logótipo não estiverem disponíveis', () => {
  assert.throws(() => reception.renderReceptionDocumentHeader({ identity: null, title: 'Declaração' }), /identidade documental/i);
  assert.throws(() => reception.renderReceptionDocumentHeader({
    identity: { getBrand: () => ({ logoDataUrl: '' }), renderDocumentHeader: () => '<header></header>' },
    title: 'Declaração'
  }), /logótipo oficial/i);
});


test('valida recepção parcial de mercadoria ligada a requisição aprovada', () => {
  const result = reception.validatePurchaseReceiptInput({
    requestStatus: 'approved',
    requestedQuantity: 10,
    alreadyReceivedQuantity: 0,
    deliveryQuantity: 4,
    warehouseId: 'warehouse-1',
    deliveryReference: 'GUIA-ENTREGA-001',
    idempotencyKey: 'receipt-op-001',
    actorId: 'actor-1'
  });
  assert.equal(result.valid, true);
  assert.equal(result.value.remainingQuantity, 6);
  assert.equal(result.value.partial, true);
});

test('rejeita recepção superior à quantidade ainda em falta', () => {
  const result = reception.validatePurchaseReceiptInput({
    requestStatus: 'approved',
    requestedQuantity: 10,
    alreadyReceivedQuantity: 8,
    deliveryQuantity: 3,
    warehouseId: 'warehouse-1',
    deliveryReference: 'GUIA-ENTREGA-002',
    idempotencyKey: 'receipt-op-002',
    actorId: 'actor-1'
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(message => /quantidade|excede/i.test(message)));
});

test('recepção exige armazém, documento de entrega, chave idempotente e actor autenticado', () => {
  const result = reception.validatePurchaseReceiptInput({
    requestStatus: 'approved',
    requestedQuantity: 10,
    alreadyReceivedQuantity: 0,
    deliveryQuantity: 4
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 4);
});


test('proposta de recepção de mercadorias enriquece o razão existente sem criar tabelas duplicadas', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const sql = fs.readFileSync(path.join(__dirname, '../../supabase/proposals/ciadi-ti-purchase-receipt-extension-proposal.sql'), 'utf8');
  assert.match(sql, /alter table ciadi_ti\.purchase_requests\s+add column if not exists warehouse_id/i);
  assert.match(sql, /references public\.finance_centros_custo\(id\)/i);
  assert.match(sql, /alter table ciadi_ti\.stock_movements\s+add column if not exists purchase_request_id/i);
  assert.match(sql, /purchase_request_line_id/i);
  assert.match(sql, /idempotency_key/i);
  assert.match(sql, /create or replace function ciadi_ti\.receive_purchase_request_line/i);
  assert.match(sql, /has_support_access\(\)/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /revoke execute on function ciadi_ti\.receive_purchase_request_line/i);
  assert.doesNotMatch(sql, /create table/i);
  assert.doesNotMatch(sql, /grant\s+execute/i);
});


test('painel da Recepção permite confirmar ou devolver encaminhamentos pendentes com motivo', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '../../renderer/modules/reception-module.js'), 'utf8');
  assert.match(source, /data-referral-confirm/);
  assert.match(source, /data-referral-return/);
  assert.match(source, /data-referral-return-reason/);
  assert.match(source, /confirmReferral\(/);
  assert.match(source, /returnReferral\(/);
});


test('adaptador financeiro da Recepção usa exclusivamente RPCs centrais para facturação, pagamentos e caixa', async () => {
  const calls = [];
  const supabase = {
    async rpc(name, args) {
      calls.push({ name, args });
      return { data: { ok: true, name }, error: null };
    }
  };
  const finance = reception.createReceptionFinanceRepository({ supabase });
  await finance.createInvoice({
    companyId: 'company-1', documentType: 'FT', seriesId: 'series-1', clientId: 'client-1',
    patientId: 'patient-1', appointmentId: 'appointment-1', issueDate: '2026-11-09T10:00:00Z',
    dueDate: '2026-11-30', observations: 'Atendimento', lines: [{ serviceId: 'service-1', quantity: 1 }]
  });
  await finance.issueInvoice('document-1');
  await finance.registerPayment({ documentId: 'document-1', amount: 5000, method: 'numerario', reference: 'PAG-001', cashboxId: 'cash-1', notes: '' });
  await finance.openCashbox({ cashboxId: 'cash-1', openingBalance: 1000 });
  await finance.closeCashbox({ shiftId: 'shift-1', countedBalance: 6000, justification: '' });
  assert.deepEqual(calls.map(call => call.name), [
    'ciadi_faturacao_criar_documento',
    'ciadi_faturacao_emitir_documento',
    'finance_registar_pagamento',
    'ciadi_abrir_caixa',
    'ciadi_fechar_caixa'
  ]);
  assert.equal(calls[0].args.p_empresa_id, 'company-1');
  assert.equal(calls[0].args.p_linhas[0].servico_id, 'service-1');
  assert.equal(calls[2].args.p_valor, 5000);
  assert.equal(calls[3].args.p_saldo_inicial, 1000);
  assert.equal(calls[4].args.p_saldo_contado, 6000);
});

test('adaptador financeiro rejeita dados incompletos e propaga bloqueios do motor central', async () => {
  let calls = 0;
  const finance = reception.createReceptionFinanceRepository({
    supabase: { async rpc() { calls += 1; return { data: null, error: new Error('Sem permissão para esta operação') }; } }
  });
  await assert.rejects(() => finance.createInvoice({ companyId: 'company-1' }), /cliente|série|documento|linha/i);
  await assert.rejects(() => finance.registerPayment({ documentId: 'document-1', amount: 0, method: 'numerario' }), /valor/i);
  await assert.rejects(() => finance.issueInvoice('document-1'), /sem permissão/i);
  assert.equal(calls, 1);
});


test('repositório financeiro disponibiliza listas activas de clientes, tipos documentais e séries da empresa', async () => {
  const calls = [];
  function query(table, rows) {
    const q = {
      select(columns) { calls.push({ table, method: 'select', columns }); return q; },
      eq(column, value) { calls.push({ table, method: 'eq', column, value }); return q; },
      order(column, options) { calls.push({ table, method: 'order', column, options }); return q; },
      limit(value) { calls.push({ table, method: 'limit', value }); return q; },
      then(resolve) { resolve({ data: rows, error: null }); }
    };
    return q;
  }
  const supabase = {
    rpc: async () => ({ data: null, error: null }),
    schema() { return { from: table => this.from(table) }; },
    from(table) {
      const rows = {
        finance_clientes: [{ id: 'client-1', nome: 'Família A', nif: '5000000000' }],
        finance_tipos_documento: [{ id: 'type-1', codigo: 'FT', nome: 'Factura', exige_cliente: true, exige_linhas: true }],
        finance_series: [{ id: 'series-1', codigo: 'A', nome: 'Série A', tipo_documento: 'FT' }]
      };
      return query(table, rows[table] || []);
    }
  };
  const repository = reception.createReceptionBusinessRepository({ supabase });
  assert.equal((await repository.getActiveClients('company-1'))[0].id, 'client-1');
  assert.equal((await repository.getActiveDocumentTypes())[0].codigo, 'FT');
  assert.equal((await repository.getActiveSeries('company-1', 'FT'))[0].id, 'series-1');
  assert.ok(calls.some(call => call.table === 'finance_clientes' && call.column === 'empresa_id' && call.value === 'company-1'));
  assert.ok(calls.some(call => call.table === 'finance_series' && call.column === 'empresa_id' && call.value === 'company-1'));
});


test('painel financeiro da Recepção apresenta formulários centrais e sinaliza limites de autorização', () => {
  const html = reception.renderReceptionFinancePanel({
    clients: [{ id: 'client-1', nome: '<Família CIADI>' }],
    documentTypes: [{ codigo: 'FT', nome: 'Factura' }],
    series: [{ id: 'series-1', codigo: '2026', nome: 'Série 2026', tipo_documento: 'FT' }],
    services: [{ id: 'service-1', codigo: 'ABA', nome: 'Terapia ABA', preco_base: 15000 }],
    cashboxes: [{ id: 'cash-1', codigo: 'CX01', nome: 'Caixa Recepção', estado: 'aberto' }],
    documents: [{ id: 'doc-1', document_no: 'FT 1', document_status: 'emitido', fiscal_status: 'emitido', total: 15000 }],
    shifts: []
  });
  assert.match(html, /data-reception-invoice-form/);
  assert.match(html, /data-reception-cashbox-open/);
  assert.match(html, /data-reception-payment-form/);
  assert.match(html, /data-reception-cashbox-close/);
  assert.match(html, /&lt;Família CIADI&gt;/);
  assert.doesNotMatch(html, /<Família CIADI>/);
  assert.match(html, /permissões|autorização/i);
});
