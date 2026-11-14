const test = require('node:test');
const assert = require('node:assert/strict');
const reception = require('../../renderer/modules/reception-module.js');

const scheduled = '2026-11-14T08:00:00.000Z';

test('classifies check-in at exactly 20 minutes as within tolerance', () => {
  const result = reception.classifyAppointmentAttendance({
    data_hora: scheduled,
    checkin_em: '2026-11-14T08:20:00.000Z',
    estado: 'check-in'
  }, '2026-11-14T08:20:00.000Z');

  assert.equal(result.classification, 'within_tolerance');
  assert.equal(result.latenessMinutes, 0);
});

test('classifies check-in after 20 minutes as late and counts from scheduled time', () => {
  const result = reception.classifyAppointmentAttendance({
    data_hora: scheduled,
    checkin_em: '2026-11-14T08:20:01.000Z',
    estado: 'check-in'
  }, '2026-11-14T08:20:01.000Z');

  assert.equal(result.classification, 'late');
  assert.equal(result.latenessMinutes, 21);
});

test('signals possible absence only after 20 minutes using server time', () => {
  const beforeBoundary = reception.classifyAppointmentAttendance({
    data_hora: scheduled, checkin_em: null, estado: 'confirmada'
  }, '2026-11-14T08:20:00.000Z');
  const afterBoundary = reception.classifyAppointmentAttendance({
    data_hora: scheduled, checkin_em: null, estado: 'confirmada'
  }, '2026-11-14T08:20:01.000Z');

  assert.equal(beforeBoundary.classification, 'within_tolerance');
  assert.equal(afterBoundary.classification, 'possible_no_show');
});

test('excludes cancelled, rescheduled and rejected appointments from absence counts', () => {
  for (const estado of ['cancelada', 'reagendada', 'rejeitada']) {
    const result = reception.classifyAppointmentAttendance({
      data_hora: scheduled, checkin_em: null, estado
    }, '2026-11-14T10:00:00.000Z');
    assert.equal(result.classification, 'excluded', estado);
  }
});

test('keeps confirmed absence distinct from a possible absence', () => {
  const result = reception.classifyAppointmentAttendance({
    data_hora: scheduled, checkin_em: null, estado: 'faltou'
  }, '2026-11-14T10:00:00.000Z');

  assert.equal(result.classification, 'confirmed_no_show');
});

test('does not invent attendance timing when a check-in state has no check-in timestamp', () => {
  const result = reception.classifyAppointmentAttendance({
    data_hora: scheduled, checkin_em: null, estado: 'em_atendimento'
  }, '2026-11-14T10:00:00.000Z');

  assert.equal(result.classification, 'inconsistent_data');
});


test('attendance metrics use the dedicated RPC with date range and optional polo', async () => {
  const calls = [];
  const repository = reception.createReceptionRepository({
    supabase: {
      schema(schemaName) {
        assert.equal(schemaName, 'ciadi_reception');
        return {
          async rpc(name, args) {
            calls.push({ name, args });
            return { data: { server_now: '2026-11-14T08:00:00.000Z', summary: {} }, error: null };
          }
        };
      }
    }
  });

  const result = await repository.getAttendanceMetrics({
    dateFrom: '2026-11-14',
    dateTo: '2026-11-14',
    poloCode: 'talatona'
  });

  assert.equal(result.server_now, '2026-11-14T08:00:00.000Z');
  assert.deepEqual(calls, [{
    name: 'reception_get_attendance_metrics',
    args: {
      p_date_from: '2026-11-14',
      p_date_to: '2026-11-14',
      p_polo_code: 'talatona'
    }
  }]);
});

test('attendance metrics reject invalid date ranges and unknown polos before RPC', async () => {
  let calls = 0;
  const repository = reception.createReceptionRepository({
    supabase: { schema() { return { async rpc() { calls += 1; return { data: {}, error: null }; } }; } }
  });

  await assert.rejects(
    repository.getAttendanceMetrics({ dateFrom: '14-11-2026', dateTo: '2026-11-14' }),
    /Período de indicadores inválido/
  );
  await assert.rejects(
    repository.getAttendanceMetrics({ dateFrom: '2026-11-14', dateTo: '2026-11-14', poloCode: 'luanda' }),
    /Polo inválido/
  );
  assert.equal(calls, 0);
});
