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
