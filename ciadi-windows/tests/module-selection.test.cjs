const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const windowsDir = path.join(root, 'ciadi-windows');
const installer = fs.readFileSync(path.join(windowsDir, 'build', 'installer.nsh'), 'utf8');
const main = fs.readFileSync(path.join(windowsDir, 'main.cjs'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(windowsDir, 'package.json'), 'utf8'));
const dashboard = fs.readFileSync(path.join(root, 'CIADI_DASHBOARD_FINANCEIRO.html'), 'utf8');

test('Setup has one custom installer and does not create a generic shortcut', () => {
  assert.equal(packageJson.build.nsis.include, 'build/installer.nsh');
  assert.equal(packageJson.build.nsis.createDesktopShortcut, false);
  assert.equal(packageJson.build.nsis.createStartMenuShortcut, false);
  assert.equal(packageJson.build.nsis.runAfterFinish, false);
});

test('installer exposes all four modules and creates separate shortcuts', () => {
  for (const [id, label] of [
    ['adm', 'CIADI ADM'],
    ['suporte', 'Suporte Informático'],
    ['rh', 'Recursos Humanos'],
    ['recepcao', 'Receção']
  ]) {
    assert.ok(installer.includes(label), 'installer label missing: ' + label);
    assert.ok(installer.includes('--ciadi-module=' + id), 'shortcut argument missing: ' + id);
    assert.ok(installer.includes('"'+id+'"'), 'registry selection missing: ' + id);
  }
  assert.match(installer, /Selecione pelo menos um módulo CIADI/);
  assert.match(installer, /customPageAfterChangeDir/);
  assert.match(installer, /customInstall/);
});

test('desktop launcher passes selected module to the dashboard without changing station configuration', () => {
  assert.match(main, /--ciadi-module=/);
  assert.match(main, /ciadiModule: activeModule/);
  assert.match(main, /ensureStationPolo\(\)/);
  assert.match(main, /ciadi:station:get/);
});

test('dashboard maps each launcher to a landing page and filters navigation by module', () => {
  for (const id of ['adm', 'suporte', 'rh', 'recepcao']) {
    assert.ok(dashboard.includes(id + ':'), 'module mapping missing: ' + id);
  }
  assert.match(dashboard, /function defaultLandingForModule/);
  assert.match(dashboard, /function moduleAllowsPage/);
  assert.match(dashboard, /if\(!moduleAllowsPage\(id\)\)/);
  assert.match(dashboard, /await go\(defaultLandingForModule\(\)\)/);
});

test('inline dashboard JavaScript parses without syntax errors', () => {
  const scripts = [...dashboard.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  const inlineScripts = scripts.filter(([, attrs, body]) => !/\bsrc\s*=/.test(attrs) && body.trim());
  assert.ok(inlineScripts.length > 0, 'no inline JavaScript found');
  for (const [, , body] of inlineScripts) new vm.Script(body, { filename: 'CIADI_DASHBOARD_FINANCEIRO.html' });
});
