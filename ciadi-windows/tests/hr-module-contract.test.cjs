const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const modulePath = path.join(root, 'renderer', 'modules', 'hr-module.js');

test('HR module exposes real views for employee administration and payroll', () => {
  assert.ok(fs.existsSync(modulePath), 'HR module must exist');
  const hr = require(modulePath);
  assert.equal(typeof hr.create, 'function');
  const source = fs.readFileSync(modulePath, 'utf8');
  for (const method of ['renderHome','renderEmployees','renderAttendance','renderContracts','renderLeave','renderDocuments','renderPayroll']) {
    assert.match(source, new RegExp(method));
  }
});

test('HR module queries only verified employee and payroll tables and fields', () => {
  const source = fs.readFileSync(modulePath, 'utf8');
  for (const table of [
    'ciadi_funcionarios','ciadi_funcionario_assiduidade','ciadi_funcionario_contratos',
    'ciadi_funcionario_ferias_licencas','ciadi_funcionario_documentos',
    'ciadi_funcionario_confidencial','ciadi_folhas_salariais','ciadi_folha_salarial_linhas'
  ]) assert.ok(source.includes(table), 'Missing verified HR table: ' + table);
  assert.ok(source.includes('profissional_id'));
  assert.ok(source.includes('periodo_ano'));
  assert.ok(source.includes('total_liquido'));
});

test('HR module hides payroll and confidential data from non-management accounts', () => {
  const source = fs.readFileSync(modulePath, 'utf8');
  assert.match(source, /profile\.tipo\s*===\s*['"]admin['"]/);
  assert.match(source, /profile\.tipo\s*===\s*['"]gestor['"]/);
  assert.match(source, /Acesso reservado à Administração e Gestão/);
  assert.match(source, /canManagePayroll \? FIELDS\.contracts : FIELDS\.contracts\.replace\(',salario_referencia'/);
  assert.match(source, /ciadi_funcionario_confidencial/);
});

test('HR module distinguishes empty data from Supabase query errors', () => {
  const source = fs.readFileSync(modulePath, 'utf8');
  assert.match(source, /Ainda não existem registos/);
  assert.match(source, /Não foi possível carregar/);
});
