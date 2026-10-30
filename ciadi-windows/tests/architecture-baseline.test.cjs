const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const dashboardPath = path.join(root, 'CIADI_DASHBOARD_FINANCEIRO.html');
const dashboard = fs.readFileSync(dashboardPath, 'utf8');
const main = fs.readFileSync(path.join(root, 'ciadi-windows', 'main.cjs'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'ciadi-windows', 'preload.cjs'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'ciadi-windows-setup.yml'), 'utf8');

test('Windows build copies the canonical dashboard source into the packaged entry point', () => {
  assert.match(workflow, /\$source\s*=\s*"CIADI_DASHBOARD_FINANCEIRO\.html"/);
  assert.match(workflow, /Copy-Item\s+\$source\s+"ciadi-windows\/index\.html"\s+-Force/);
});

test('all inline dashboard JavaScript blocks parse', () => {
  const scripts = [...dashboard.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs, body]) => !/\bsrc\s*=/.test(attrs) && body.trim());
  assert.ok(scripts.length > 0, 'expected inline JavaScript in the dashboard');
  scripts.forEach(([, , body], index) => {
    assert.doesNotThrow(
      () => new vm.Script(body, { filename: 'CIADI_DASHBOARD_FINANCEIRO.html:inline-' + index }),
      'inline script ' + index + ' must parse'
    );
  });
});

test('Electron renderer keeps context isolation, sandbox and Node integration disabled', () => {
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /preload:\s*path\.join\(__dirname, 'preload\.cjs'\)/);
});

test('preload exposes only the non-privileged application identity', () => {
  assert.match(preload, /contextBridge\.exposeInMainWorld\('ciadiDesktop'/);
  assert.match(preload, /appName:\s*'CIADI Dashboard'/);
  assert.doesNotMatch(preload, /require\(['"](?:fs|child_process|electron-store|node:fs|node:child_process)['"]\)/);
});

test('dashboard requires an active Supabase profile from the allowed account types', () => {
  assert.match(dashboard, /profileService\.getCurrentProfile\(u\.id\)/);
  assert.match(dashboard, /if\(!profile\)[\s\S]{0,180}signOut/);
  assert.match(dashboard, /if\(profile\.ativo!==true\)[\s\S]{0,180}signOut/);
  assert.match(dashboard, /!\['admin','gestor','profissional'\]\.includes\(profile\.tipo\)/);
  assert.ok(dashboard.indexOf("if(profile.ativo!==true)") < dashboard.indexOf("document.getElementById('app').classList.remove('hiddenx')"));
});
