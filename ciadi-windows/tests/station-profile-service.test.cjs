const test = require('node:test');
const assert = require('node:assert/strict');
const registry = require('../../renderer/core/module-registry.js');

test('ADM and Support receive every implemented Dashboard module', () => {
  const service = require('../../renderer/core/station-profile-service.js');
  const entries = registry.listNavigationEntries();
  const adm = service.getVisibleEntries('adm', entries);
  const support = service.getVisibleEntries('suporte_informatica', entries);
  const expected = entries.map(entry => entry.id);
  assert.deepEqual(adm.map(entry => entry.id), expected);
  assert.deepEqual(support.map(entry => entry.id), ['support', ...expected]);
});

test('Reception and RH receive only their explicitly assigned existing routes', () => {
  const service = require('../../renderer/core/station-profile-service.js');
  const entries = registry.listNavigationEntries();
  assert.deepEqual(service.getVisibleEntries('rh', entries).map(entry => entry.id), ['rh']);
  assert.deepEqual(service.getVisibleEntries('recepcao', entries).map(entry => entry.id), ['reception', 'overview', 'pedidos_site', 'agendamentos', 'pacientes', 'familias', 'triagens']);
});

test('unknown profiles fail closed and duplicate entries are removed without mutation', () => {
  const service = require('../../renderer/core/station-profile-service.js');
  const original = registry.listNavigationEntries();
  const input = [...original, original[0]];
  assert.deepEqual(service.getVisibleEntries('unknown', input), []);
  assert.equal(service.getVisibleEntries('adm', input).length, original.length);
  assert.equal(input.length, original.length + 1);
});

test('station profile service does not expose or modify account permissions', () => {
  const service = require('../../renderer/core/station-profile-service.js');
  const account = Object.freeze({ id: 'user-1', tipo: 'profissional', ativo: true });
  service.getVisibleEntries('suporte_informatica', registry.listNavigationEntries(), { account });
  assert.deepEqual(account, { id: 'user-1', tipo: 'profissional', ativo: true });
  assert.equal(service.getProfileLabel('rh'), 'Recursos Humanos');
  assert.equal(service.isKnownProfile('recepcao'), true);
  assert.equal(service.isKnownProfile('root'), false);
});
