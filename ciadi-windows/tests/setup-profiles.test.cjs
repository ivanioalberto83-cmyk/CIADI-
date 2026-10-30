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
  assert.ok(dashboard.includes("suporte_informatica: new Set(['support','sos','utilizadores','instituicao','auditoria'])"));
  assert.ok(dashboard.includes('async function supportDashboard()'));
  assert.ok(dashboard.includes("go(stationMode && stationProfile==='suporte_informatica' ? 'support' : 'overview')"));
  assert.ok(dashboard.includes("adm: new Set(['overview','sos','pedidos_site','agendamentos','financeiro'"));
  
  assert.ok(dashboard.includes("rh: new Set(['overview','profissionais','acompanhantes_at'])"));
  assert.ok(dashboard.includes("recepcao: new Set(['overview','pedidos_site','agendamentos','pacientes','familias'])"));
  assert.ok(dashboard.includes('const allowed = stationMode ? stationMenu[stationProfile] : stationMenu.adm;'));
  assert.ok(dashboard.includes('if (!allowed) return [];'));
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
