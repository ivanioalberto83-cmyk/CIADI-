const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const registryPath = path.join(__dirname, '..', 'renderer', 'core', 'module-registry.js');
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
