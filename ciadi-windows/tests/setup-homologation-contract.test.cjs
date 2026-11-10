const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const dashboard = fs.readFileSync(path.join(root, 'CIADI_DASHBOARD_FINANCEIRO.html'), 'utf8');
const installerPath = path.join(root, 'ciadi-windows', 'build', 'installer.nsh');
const installer = fs.existsSync(installerPath) ? fs.readFileSync(installerPath, 'utf8') : '';
const main = fs.readFileSync(path.join(root, 'ciadi-windows', 'main.cjs'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'ciadi-windows', 'package.json'), 'utf8'));
const buildWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'ciadi-setup-homologation.yml'), 'utf8');

test('o arranque exige novo login e não restaura uma sessão anterior', () => {
  const start = dashboard.indexOf('async function boot(){');
  const end = dashboard.indexOf('async function enter(u){', start);
  assert.ok(start >= 0 && end > start, 'boot e enter devem existir');
  const boot = dashboard.slice(start, end);
  assert.match(boot, /authService\.signOut\(\{scope:'local'\}\)/);
  assert.match(boot, /login\.classList\.remove\('hiddenx'\)/);
  assert.match(boot, /appView\.classList\.add\('hiddenx'\)/);
  assert.doesNotMatch(boot, /sb\.auth\.getSession\(\)/);
});

test('o Setup apresenta os quatro perfis de estação sem os confundir com permissões', () => {
  assert.ok(fs.existsSync(installerPath), 'falta ciadi-windows/build/installer.nsh');
  for (const label of [
    'ADM — Administração',
    'Suporte Informático',
    'Recursos Humanos (RH)',
    'Receção'
  ]) assert.ok(installer.includes(label), 'Falta opção no instalador: ' + label);
  assert.match(installer, /não concede permissões|Não concede permissões/i);
});

test('o processo Electron lê o perfil instalado e transmite-o ao Dashboard', () => {
  for (const id of ['adm', 'suporte_informatica', 'rh', 'recepcao']) {
    assert.ok(main.includes(id), 'O processo Electron não reconhece ' + id);
  }
  assert.match(main, /ciadi-install-profile\.txt/);
  assert.match(main, /query:\s*\{\s*ciadi_profile:/);
});

test('o pacote inclui os módulos renderer e a compilação nunca publica automaticamente', () => {
  assert.match(packageJson.scripts['dist:win'], /--publish\s+never/);
  assert.ok(packageJson.build.files.includes('renderer/**/*'), 'renderer/**/* tem de entrar no pacote');
  assert.equal(packageJson.build.nsis.include, 'build/installer.nsh');
});

test('a raiz index.html é a fonte canónica do Setup e coincide com o Dashboard legado', () => {
  const canonicalPath = path.join(root, 'index.html');
  const legacyPath = path.join(root, 'CIADI_DASHBOARD_FINANCEIRO.html');
  const canonical = fs.readFileSync(canonicalPath, 'utf8');
  const legacy = fs.readFileSync(legacyPath, 'utf8');
  assert.equal(canonical, legacy, 'index.html e CIADI_DASHBOARD_FINANCEIRO.html não podem divergir antes do Setup');
  assert.match(buildWorkflow, /\$source\s*=\s*["']index\.html["']/);
  assert.match(buildWorkflow, /Compare-Object|não correspondem|não coincide/i);
  assert.match(buildWorkflow, /Copy-Item\s+\$source\s+["']ciadi-windows\/index\.html["']\s+-Force/);
  assert.match(buildWorkflow, /Copy-Item\s+["']renderer\/\*["']\s+["']ciadi-windows\/renderer\//);
});

test('o Dashboard canónico referencia apenas recursos locais presentes no pacote', () => {
  const canonical = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const packageFiles = new Set(packageJson.build.files);
  assert.ok(packageFiles.has('index.html'));
  assert.ok(packageFiles.has('renderer/**/*'));
  const scriptRefs = [...canonical.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)]
    .map(([, src]) => src)
    .filter(src => !/^https?:\/\//i.test(src));
  assert.ok(scriptRefs.length > 0, 'o Dashboard deve declarar os seus scripts locais');
  for (const src of scriptRefs) {
    assert.ok(fs.existsSync(path.join(root, src)), 'Recurso local referenciado em falta: ' + src);
  }
});

test('o pacote Windows exige os motores de Recepção e Suporte Informático', () => {
  for (const relativePath of [
    'renderer/modules/support-operations-module.js',
    'renderer/modules/support-helpdesk-module.js',
    'renderer/modules/support-inventory-lifecycle-module.js',
    'renderer/modules/reception-module.js',
    'renderer/modules/cash-reports-module.js',
    'renderer/core/institutional-identity-service.js',
    'renderer/core/station-profile-service.js'
  ]) {
    assert.ok(fs.existsSync(path.join(root, relativePath)), 'Motor obrigatório em falta na origem: ' + relativePath);
  }
  assert.match(buildWorkflow, /support-operations-module\.js/);
  assert.match(buildWorkflow, /support-helpdesk-module\.js/);
  assert.match(buildWorkflow, /support-inventory-lifecycle-module\.js/);
  assert.match(buildWorkflow, /reception-module\.js/);
  assert.match(buildWorkflow, /institutional-identity-service\.js/);
  assert.match(buildWorkflow, /station-profile-service\.js/);
});
