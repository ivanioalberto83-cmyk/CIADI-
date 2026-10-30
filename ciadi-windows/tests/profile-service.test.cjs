const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('ProfileService reads the authenticated user profile using the existing query contract', async () => {
  const servicePath = path.resolve(__dirname, '..', '..', 'renderer', 'core', 'profile-service.js');
  assert.ok(fs.existsSync(servicePath), 'ProfileService module has not been extracted yet');
  const { createProfileService } = require(servicePath);
  const calls = [];
  const expected = { data: { id: 'user-42', tipo: 'profissional', ativo: true }, error: null };
  const builder = {
    select(columns) { calls.push(['select', columns]); return this; },
    eq(column, value) { calls.push(['eq', column, value]); return this; },
    maybeSingle() { calls.push(['maybeSingle']); return Promise.resolve(expected); }
  };
  const client = { from(table) { calls.push(['from', table]); return builder; } };
  const service = createProfileService(client);

  assert.equal(await service.getCurrentProfile('user-42'), expected);
  assert.deepEqual(calls, [
    ['from', 'perfis'],
    ['select', 'id,email,nome_completo,nome_exibicao,tipo,ativo,telefone'],
    ['eq', 'id', 'user-42'],
    ['maybeSingle']
  ]);
});

test('ProfileService preserves Supabase query errors', async () => {
  const servicePath = path.resolve(__dirname, '..', '..', 'renderer', 'core', 'profile-service.js');
  assert.ok(fs.existsSync(servicePath), 'ProfileService module has not been extracted yet');
  const { createProfileService } = require(servicePath);
  const failure = new Error('profile query denied');
  const builder = {
    select() { return this; },
    eq() { return this; },
    maybeSingle() { return Promise.resolve({ data: null, error: failure }); }
  };
  const service = createProfileService({ from: () => builder });

  assert.equal((await service.getCurrentProfile('user-42')).error, failure);
});
