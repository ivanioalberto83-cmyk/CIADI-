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
