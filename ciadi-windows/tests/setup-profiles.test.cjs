const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const installer = fs.readFileSync(path.join(root, 'build', 'installer.nsh'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.cjs'), 'utf8');

test('Setup oferece exatamente os quatro perfis funcionais pretendidos', () => {
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
});

test('Cada perfil de estação tem uma lista de módulos própria na navegação', () => {
  const dashboard = fs.readFileSync(path.resolve(root, '..', 'CIADI_DASHBOARD_FINANCEIRO.html'), 'utf8');
  assert.ok(dashboard.includes("const stationMode = stationParams.has('ciadi_profile');"));
  assert.match(dashboard, /CIADI_STATION_PROFILE_SERVICE\.getVisibleEntries/);
  assert.ok(dashboard.includes('async function supportDashboard()'));
  assert.ok(dashboard.includes("go(stationMode && stationProfile==='suporte_informatica' ? 'support' : 'overview')"));
  assert.ok(dashboard.includes("const menu = window.CIADI_MODULE_REGISTRY.listNavigationEntries();"));
  
  assert.ok(dashboard.includes("stationMode ? stationProfile : 'adm'"));
  assert.ok(dashboard.includes("window.CIADI_STATION_PROFILE_SERVICE.getVisibleEntries"));
  assert.ok(dashboard.includes('function visibleMenu(){'));
  assert.ok(dashboard.includes('station-profile-service.js'));
  assert.ok(dashboard.includes('renderer/modules/hr-module.js'));
  assert.ok(dashboard.includes('renderer/modules/reception-module.js'));
  assert.ok(dashboard.includes("if(id==='reception')return window.CIADI_RECEPTION_MODULE.create"));
  assert.ok(dashboard.includes("if(id==='rh')return window.CIADI_HR_MODULE.create"));
  assert.ok(dashboard.includes('Centro de Suporte Informático'));
  assert.ok(dashboard.includes('stationLabel'));
  assert.ok(main.includes("query: { ciadi_profile: stationProfile || 'unconfigured' }"));
});

test('Perfil serve apenas para identificar a estação e não atribui permissões', () => {
  assert.match(installer, /não concede permissões nem substitui o login CIADI/i);
  assert.match(main, /CIADI Dashboard — Estação:/);
  assert.match(main, /getStationLabel/);
  assert.doesNotMatch(main, /ciadi-install-profile\.txt[\s\S]{0,500}(role|permission|grant)/i);
});
