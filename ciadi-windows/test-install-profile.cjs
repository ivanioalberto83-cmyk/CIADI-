const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const installer = fs.readFileSync(path.join(__dirname, 'build', 'installer.nsh'), 'utf8');
const main = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8');
const preload = fs.readFileSync(path.join(__dirname, 'preload.cjs'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'CIADI_DASHBOARD_FINANCEIRO.html'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.equal(packageJson.build.nsis.oneClick, false, 'O instalador deve continuar assistido.');
assert.equal(packageJson.build.nsis.include, 'build/installer.nsh', 'O instalador deve incluir a página de perfis.');
assert.notEqual(packageJson.build.nsis.perMachine, true, 'Não forçar instalação para todos os utilizadores; manter a escolha de âmbito.');

for (const [label, id] of [
  ['Polo 001', 'polo001'],
  ['Polo 002', 'polo002'],
  ['ADM', 'adm'],
  ['Suporte Informática', 'suporte_informatica']
]) {
  assert.ok(installer.includes(label), 'Falta a opção de instalação: ' + label);
  assert.ok(installer.includes('StrCpy $CIADIProfile "' + id + '"'), 'Falta o identificador de perfil: ' + id);
}
assert.ok(installer.includes('ciadi-install-profile.txt'), 'O perfil selecionado deve ser guardado na instalação.');
assert.ok(main.includes('--ciadi-install-profile='), 'O shell Electron deve passar o perfil ao preload.');
assert.ok(preload.includes('suporte_informatica'), 'O preload deve validar o perfil de suporte.');
assert.ok(dashboard.includes("profile?.tipo==='suporte_informatica' && window.ciadiDesktop?.installProfile==='suporte_informatica'"), 'O agente deve exigir perfil autenticado e perfil de instalação Suporte Informática.');
assert.ok(dashboard.includes("profile.tipo==='suporte_informatica' && window.ciadiDesktop?.installProfile!=='suporte_informatica'"), 'O perfil de suporte não deve entrar por outro perfil de instalação.');
assert.ok(dashboard.includes('Execução ainda não ligada.'), 'O Dashboard deve informar que a execução real ainda não está configurada.');

assert.ok(dashboard.includes("function isGlobalAdmin(){ return ['admin','suporte_informatica'].includes(profile?.tipo); }"), 'ADM e Suporte Informática devem ter acesso global aos módulos.');
assert.ok(dashboard.includes("'Gestão Clínica'") && dashboard.includes("'Gestão Administrativa'"), 'A navegação deve separar gestão clínica e administrativa.');
assert.ok(dashboard.includes("async function financeClients()"), 'O cadastro de clientes deve estar disponível.');
assert.ok(dashboard.includes("async function hrPayrolls()"), 'A folha salarial deve estar dentro do módulo RH.');
assert.ok(dashboard.includes("sb.from('finance_clientes').select('id,nome,nif,ativo')"), 'O gerador fiscal deve permitir seleccionar clientes financeiros directamente.');
assert.ok(dashboard.includes('async function hrPrintContract(id)'), 'O RH deve conseguir gerar uma minuta imprimível do contrato.');
assert.ok(dashboard.includes("if(id==='agente'&&!canUseAgent())"), 'O agente deve permanecer exclusivo do Suporte Informática.');
assert.ok(dashboard.includes("async function polesAccess()"), 'A página de polos deve explicitar que as associações ainda não foram aplicadas.');
assert.ok(dashboard.includes('Resumo SOS indisponível') && dashboard.includes('insertAdjacentHTML'), 'A visão geral deve voltar a mostrar a central de Alertas SOS.');
assert.ok(dashboard.includes("O esquema consultado ainda não contém a tabela finance_fornecedores"), 'O Dashboard não deve fingir que fornecedores estão gravados sem tabela.');

assert.equal(index, dashboard, 'index.html deve corresponder ao Dashboard de origem.');

for (const file of ['main.cjs', 'preload.cjs']) {
  const result = spawnSync(process.execPath, ['--check', path.join(__dirname, file)], { encoding: 'utf8' });
  assert.equal(result.status, 0, 'Falha de sintaxe em ' + file + ': ' + result.stderr);
}

console.log('PASS: quatro perfis do instalador configurados.');
console.log('PASS: seleção de instalação preserva a escolha per-user/per-machine do NSIS.');
console.log('PASS: perfil do agente condicionado a Suporte Informática + perfil autenticado.');
console.log('PASS: ficheiros Dashboard sincronizados e sintaxe Electron válida.');
console.log('LIMITAÇÃO: a execução real do agente continua pendente de backend seguro e autorização server-side.');
