const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const installer = fs.readFileSync(path.join(root, 'build', 'installer.nsh'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.cjs'), 'utf8');
const dashboard = fs.readFileSync(path.resolve(root, '..', 'CIADI_DASHBOARD_FINANCEIRO.html'), 'utf8');

test('Setup apresenta quatro caixas de selecção independentes e exige pelo menos uma', () => {
  for (const label of ['ADM — Administração', 'Suporte Informático', 'Recursos Humanos (RH)', 'Receção']) {
    assert.ok(installer.includes(label), 'Falta opção: ' + label);
  }
  assert.equal((installer.match(/\$\{NSD_CreateCheckBox\}/g) || []).length, 4);
  assert.match(installer, /NSD_GetState\} \$CIADIProfileCheckADM/);
  assert.match(installer, /NSD_GetState\} \$CIADIProfileCheckSupport/);
  assert.match(installer, /NSD_GetState\} \$CIADIProfileCheckRH/);
  assert.match(installer, /NSD_GetState\} \$CIADIProfileCheckReception/);
  assert.match(installer, /Seleccione pelo menos uma estação/);
});

test('A página de polo só aparece quando RH ou Receção estão seleccionados', () => {
  const page = installer.slice(installer.indexOf('Function CIADIPoloPageCreate'), installer.indexOf('Function CIADIPoloPageLeave'));
  assert.match(page, /CIADISelectRH == "1"/);
  assert.match(page, /CIADISelectReception == "1"/);
  assert.match(page, /Abort/);
  for (const label of ['Talatona — Polo 001', 'Jardim de Rosas — Polo 002']) assert.ok(page.includes(label));
  assert.match(installer, /Polo CIADI não seleccionado/);
});

test('Cada estação seleccionada recebe atalhos próprios no Ambiente de Trabalho e menu Iniciar', () => {
  for (const [id,label] of [
    ['adm','CIADI - ADM'],
    ['suporte_informatica','CIADI - Suporte Informático'],
    ['rh','CIADI - Recursos Humanos'],
    ['recepcao','CIADI - Receção']
  ]) {
    assert.match(installer, new RegExp('CIADISelect' + (id === 'adm' ? 'ADM' : id === 'suporte_informatica' ? 'Support' : id === 'rh' ? 'RH' : 'Reception') + ' == "1"'));
    assert.ok(installer.includes(label + '.lnk'));
    assert.ok(installer.includes('--ciadi-profile=' + id));
  }
  assert.equal((installer.match(/CreateShortCut "\$DESKTOP/g) || []).length, 4);
  assert.equal((installer.match(/CreateShortCut "\$SMPROGRAMS/g) || []).length, 4);
});

test('A estação identifica o contexto, mas o perfil já não é lido de um ficheiro global', () => {
  assert.match(main, /--ciadi-profile=/);
  assert.doesNotMatch(main, /ciadi-install-profile\.txt/);
  assert.match(main, /ciadi_profile:\s*stationProfile/);
  assert.match(main, /CIADI Dashboard — Estação:/);
  assert.match(dashboard, /profileService\.getCurrentProfile\(u\.id\)/);
});

test('A configuração do instalador usa o ícone CIADI para aplicação e instalador', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(packageJson.build.win.icon, 'ciadi.ico');
  assert.equal(packageJson.build.nsis.installerIcon, 'ciadi.ico');
  assert.equal(packageJson.build.nsis.uninstallerIcon, 'ciadi.ico');
  assert.equal(packageJson.build.nsis.installerHeaderIcon, 'ciadi.ico');
  assert.match(dashboard, /data:image\/png;base64,/);
});
