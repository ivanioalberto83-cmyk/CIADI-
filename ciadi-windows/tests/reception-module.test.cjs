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
