const test = require('node:test');
const assert = require('node:assert/strict');
const registry = require('../../renderer/core/module-registry.js');

test('ADM keeps administration routes, Accounting and read-only cash reports but excludes operational stations', () => {
  const service = require('../../renderer/core/station-profile-service.js');
  const entries = [
    { id: 'support', label: 'Suporte Informático', route: 'support', moduleId: 'support' },
    ...registry.listNavigationEntries()
  ];
  const adm = service.getVisibleEntries('adm', entries).map(entry => entry.id);
  for (const forbidden of ['support', 'reception', 'caixa', 'faturacao', 'financeiro']) {
    assert.equal(adm.includes(forbidden), false, 'ADM must not expose ' + forbidden);
  }
  assert.ok(adm.includes('cash_reports'), 'ADM must retain cash opening/closing reports');
  assert.ok(adm.includes('contabilidade'), 'ADM must retain Accounting');
  assert.ok(adm.includes('auditoria'), 'ADM must retain administrative audit');
});

test('Support station exposes only its own Helpdesk and IT operations module', () => {
  const service = require('../../renderer/core/station-profile-service.js');
  const entries = [
    { id: 'support', label: 'Suporte Informático', route: 'support', moduleId: 'support' },
    ...registry.listNavigationEntries()
  ];
  assert.deepEqual(
    service.getVisibleEntries('suporte_informatica', entries).map(entry => entry.id),
    ['support']
  );
});

test('Reception retains its dedicated workspace and RH remains restricted to its route', () => {
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
  assert.equal(service.getVisibleEntries('adm', input).length, service.getVisibleEntries('adm', original).length);
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
