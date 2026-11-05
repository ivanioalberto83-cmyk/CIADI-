const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const modulePath = path.join(root, 'renderer', 'modules', 'reception-module.js');

test('Reception workspace links only to real patient, family, appointment and triage handlers', () => {
  assert.ok(fs.existsSync(modulePath), 'Reception module must exist');
  const reception = require(modulePath);
  assert.equal(typeof reception.create, 'function');
  const source = fs.readFileSync(modulePath, 'utf8');
  for (const route of ['pedidos_site','agendamentos','pacientes','familias','triagens']) {
    assert.ok(source.includes(route), 'Missing Reception route: ' + route);
  }
});

test('Reception workspace uses existing Dashboard navigation without duplicating patient data', () => {
  const source = fs.readFileSync(modulePath, 'utf8');
  assert.match(source, /navigate\(/);
  assert.match(source, /data-reception-route/);
  assert.match(source, /Acolhimento e Recepção/);
  assert.doesNotMatch(source, /from\(['"]pacientes['"]\)/);
});
