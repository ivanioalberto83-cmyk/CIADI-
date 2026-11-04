const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const installer = fs.readFileSync(path.join(root, 'build', 'installer.nsh'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.cjs'), 'utf8');
const dashboard = fs.readFileSync(path.resolve(root, '..', 'CIADI_DASHBOARD_FINANCEIRO.html'), 'utf8');

test('Setup oferece os quatro perfis e exige uma escolha explícita', () => {
  for (const label of [
    'ADM — Administração',
    'Suporte Informático',
    'Recursos Humanos (RH)',
    'Receção'
  ]) assert.ok(installer.includes(label), 'Falta opção: ' + label);

  for (const id of ['adm', 'suporte_informatica', 'rh', 'recepcao']) {
    assert.match(installer, new RegExp('StrCpy \\$CIADIProfile "' + id + '"'));
    assert.ok(main.includes(id), 'A aplicação não reconhece o perfil ' + id);
  }
  assert.doesNotMatch(installer, /\$\{NSD_Check\} \$CIADIProfileRadioADM/);
  assert.doesNotMatch(installer.slice(installer.indexOf('!macro customInstall')), /StrCpy \$CIADIProfile "adm"/);
  assert.match(installer, /Selecione um perfil para continuar/);
});

test('Setup exige a escolha do polo e guarda o polo sem o converter em autorização', () => {
  for (const label of ['Talatona', 'Jardim de Rosas']) assert.ok(installer.includes(label), 'Falta polo: ' + label);
  for (const id of ['talatona', 'jardim_de_rosas']) {
    assert.ok(installer.includes('"' + id + '"'), 'Falta identificador do polo: ' + id);
    assert.ok(main.includes(id), 'Electron não reconhece o polo ' + id);
  }
  assert.match(installer, /ciadi-install-polo\.txt/);
  assert.match(main, /ciadi-install-polo\.txt/);
  assert.match(main, /ciadi_polo:\s*stationPolo/);
  assert.match(installer, /não concede permissões nem substitui o login CIADI/i);
});

test('Os controlos de selecção do polo ficam dentro da área visível da página NSIS', () => {
  assert.match(installer, /NSD_CreateRadioButton\} 0 128u 100% 16u "Talatona/);
  assert.match(installer, /NSD_CreateRadioButton\} 0 148u 100% 16u "Jardim de Rosas/);
  assert.doesNotMatch(installer, /NSD_CreateRadioButton\} 0 (17[6-9]|18[0-9]|19[0-9]|2[0-9][0-9])u 100%/);
});

test('Setup cria apenas o atalho do perfil seleccionado', () => {
  for (const id of ['adm', 'suporte_informatica', 'rh', 'recepcao']) {
    assert.match(installer, new RegExp('CIADIProfile == "' + id + '"'));
    assert.match(installer, new RegExp('--ciadi-profile=' + id));
  }
  assert.match(installer, /--ciadi-polo=/);
  assert.doesNotMatch(installer, /CreateShortCut[^\n]*--ciadi-profile=adm[^\n]*\n\s*CreateShortCut[^\n]*--ciadi-profile=suporte_informatica[^\n]*\n\s*CreateShortCut[^\n]*--ciadi-profile=rh[^\n]*\n\s*CreateShortCut[^\n]*--ciadi-profile=recepcao/);
});

test('Dashboard valida o perfil da estação sem referência indefinida a stationMenu', () => {
  assert.doesNotMatch(dashboard, /stationMenu/);
  assert.match(dashboard, /stationProfile[\s\S]*adm[\s\S]*suporte_informatica[\s\S]*rh[\s\S]*recepcao/);
  assert.match(dashboard, /ciadi_polo/);
  assert.match(dashboard, /stationPolo/);
  assert.match(dashboard, /getVisibleEntries/);
});

test('Perfil e polo da estação apenas identificam a estação e não atribuem permissões', () => {
  assert.match(main, /CIADI Dashboard — Estação:/);
  assert.match(main, /getStationLabel/);
  assert.match(dashboard, /profileService\.getCurrentProfile\(u\.id\)/);
  assert.match(dashboard, /!\['admin','gestor','profissional'\]\.includes\(profile\.tipo\)/);
});
