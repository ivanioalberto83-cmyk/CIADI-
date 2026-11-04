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

test('a compilação sincroniza o Dashboard e os serviços renderer para o pacote Windows', () => {
  assert.match(buildWorkflow, /\$source\s*=\s*["']CIADI_DASHBOARD_FINANCEIRO\.html["']/);
  assert.match(buildWorkflow, /Copy-Item\s+\$source\s+["']ciadi-windows\/index\.html["']\s+-Force/);
  assert.match(buildWorkflow, /Copy-Item\s+["']renderer\/\*["']\s+["']ciadi-windows\/renderer\/["']\s+-Recurse\s+-Force/);
});
