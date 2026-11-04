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


test('Dashboard uses ProfileService for the authenticated profile lookup', () => {
  const root = path.resolve(__dirname, '..', '..');
  const dashboard = fs.readFileSync(path.join(root, 'CIADI_DASHBOARD_FINANCEIRO.html'), 'utf8');
  assert.match(dashboard, /<script\s+src=["']renderer\/core\/profile-service\.js["']><\/script>/);
  assert.match(dashboard, /profileService=window\.CIADI_PROFILE_SERVICE\.createProfileService\(sb\)/);
  assert.match(dashboard, /profileService\.getCurrentProfile\(u\.id\)/);
  assert.doesNotMatch(dashboard, /sb\.from\('perfis'\)\.select\('id,email,nome_completo,nome_exibicao,tipo,ativo,telefone'\)/);
});
