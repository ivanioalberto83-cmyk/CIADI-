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
  const start = main.indexOf('const stationMenu = {');
  const end = main.indexOf('function visibleMenu()', start);
  assert.ok(start >= 0 && end > start, 'Falta a configuração de navegação por perfil');
  const config = main.slice(start, end);
  for (const id of ['adm', 'suporte_informatica', 'rh', 'recepcao']) {
    assert.match(config, new RegExp('\\\\b' + id + ': new Set\\\\('), 'Falta configuração para ' + id);
  }
  assert.match(config, /suporte_informatica: new Set\\(\\['overview','sos','utilizadores','instituicao','auditoria'\\]\\)/);
  assert.match(config, /rh: new Set\\(\\['overview','profissionais','acompanhantes_at'\\]\\)/);
  assert.match(config, /recepcao: new Set\\(\\['overview','pedidos_site','agendamentos','pacientes','familias'\\]\\)/);
  assert.match(main, /new URLSearchParams\\(window\\.location\\.search\\)\\.get\\('ciadi_profile'\\)/);
});

test('Perfil serve apenas para identificar a estação e não atribui permissões', () => {
  assert.match(installer, /não concede permissões nem substitui o login CIADI/i);
  assert.match(main, /CIADI Dashboard — Estação:/);
  assert.match(main, /getStationLabel/);
  assert.doesNotMatch(main, /ciadi-install-profile\.txt[\s\S]{0,500}(role|permission|grant)/i);
});
