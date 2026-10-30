const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const registryPath = path.join(root, 'renderer', 'core', 'module-registry.js');
const dashboard = fs.readFileSync(path.join(root, 'CIADI_DASHBOARD_FINANCEIRO.html'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'ciadi-windows', 'package.json'), 'utf8'));
const setupWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'ciadi-windows-setup.yml'), 'utf8');

const expectedIds = [
  'overview', 'sos', 'pedidos_site', 'agendamentos', 'financeiro',
  'faturacao', 'caixa', 'contabilidade', 'saft', 'especialidades',
  'triagens', 'pacientes', 'profissionais', 'documentos', 'familias',
  'conteudos', 'multimedia', 'marketing', 'janeth', 'utilizadores',
  'instituicao', 'empresas', 'clinica', 'auditoria', 'acompanhantes_at'
];

test('module registry preserves every current navigation identifier exactly once', () => {
  assert.ok(fs.existsSync(registryPath), 'the extracted module registry does not exist yet');
  const registry = require(registryPath);
  assert.equal(typeof registry.listNavigationEntries, 'function');
  const entries = registry.listNavigationEntries();
  assert.deepEqual(entries.map(entry => entry.id), expectedIds);
  assert.equal(new Set(entries.map(entry => entry.id)).size, expectedIds.length);
  for (const entry of entries) {
    assert.equal(typeof entry.label, 'string');
    assert.ok(entry.label.trim().length > 0, 'navigation label missing for ' + entry.id);
    assert.equal(entry.route, entry.id, 'legacy route id must remain stable for ' + entry.id);
  }
});

test('dashboard loads the registry and Windows package includes its renderer assets', () => {
  assert.match(dashboard, /<script\s+src=["']renderer\/core\/module-registry\.js["']><\/script>/);
  assert.ok(packageJson.build.files.includes('renderer/**/*'));
  assert.match(setupWorkflow, /Copy-Item\s+"renderer\/\*"\s+"ciadi-windows\/renderer\/"\s+-Recurse\s+-Force/);
  assert.match(dashboard, /const menu\s*=\s*window\.CIADI_MODULE_REGISTRY\.listNavigationEntries\(\)/);
});
