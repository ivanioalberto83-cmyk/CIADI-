const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const dashboard = fs.readFileSync(path.join(root, 'CIADI_DASHBOARD_FINANCEIRO.html'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('Dashboard pede autenticação novamente em cada arranque', () => {
  const start = dashboard.indexOf('async function boot(){');
  const end = dashboard.indexOf('\nasync function enter(u){', start);
  assert.ok(start >= 0 && end > start, 'função boot deve existir');
  const boot = dashboard.slice(start, end);
  assert.match(boot, /sb\.auth\.signOut\(\{scope:'local'\}\)/);
  assert.match(boot, /login\.classList\.remove\('hiddenx'\)/);
  assert.match(boot, /appView\.classList\.add\('hiddenx'\)/);
  assert.doesNotMatch(boot, /sb\.auth\.getSession\(\)/);
});

test('index.html e Dashboard fonte permanecem sincronizados', () => {
  assert.equal(index, dashboard);
});
