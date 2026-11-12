const test = require('node:test');
const assert = require('node:assert/strict');
const reception = require('../renderer/modules/reception-module.js');

function makeRepository() {
  const calls = [];
  const supabase = {
    schema(name) {
      return {
        async rpc(name, args) {
          calls.push({ schema: 'ciadi_reception', name, args });
          return { data: [], error: null };
        }
      };
    }
  };
  return { repository: reception.createReceptionRepository({ supabase }), calls };
}

test('appointment search sends the selected polo to the database function', async () => {
  const { repository, calls } = makeRepository();

  await repository.searchAppointments({
    term: 'Maria',
    dateFrom: '2026-11-12',
    dateTo: '2026-11-12',
    poloCode: 'jardim_de_rosas'
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'reception_search_appointments');
  assert.deepEqual(calls[0].args, {
    p_search_term: 'Maria',
    p_date_from: '2026-11-12',
    p_date_to: '2026-11-12',
    p_polo_code: 'jardim_de_rosas'
  });
});

test('appointment search rejects missing or unsupported polo before calling the database', async () => {
  const { repository, calls } = makeRepository();

  await assert.rejects(
    repository.searchAppointments({
      term: 'Maria',
      dateFrom: '2026-11-12',
      dateTo: '2026-11-12'
    }),
    /Seleccione um polo CIADI válido/
  );

  await assert.rejects(
    repository.searchAppointments({
      term: 'Maria',
      dateFrom: '2026-11-12',
      dateTo: '2026-11-12',
      poloCode: 'luanda'
    }),
    /Seleccione um polo CIADI válido/
  );

  assert.equal(calls.length, 0);
});
