const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

test('dashboard HTML has valid inline JavaScript syntax', () => {
  const htmlPath = path.join(__dirname, '..', 'CIADI_DASHBOARD_FINANCEIRO.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs, body]) => !/\bsrc\s*=/.test(attrs) && body.trim())
    .map(([, , body], index) => ({ body, index }));
  assert.ok(scripts.length > 0, 'expected at least one inline script block');
  for (const script of scripts) {
    assert.doesNotThrow(
      () => new vm.Script(script.body, { filename: 'CIADI_DASHBOARD_FINANCEIRO.html:inline-' + script.index }),
      'inline script ' + script.index + ' must parse'
    );
  }
});

test('support centre and AI agent are registered as technician-only routes', () => {
  const htmlPath = path.join(__dirname, '..', 'CIADI_DASHBOARD_FINANCEIRO.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.match(html, /\['centro_suporte',\s*['"][^'"]*Centro de Suporte Informático['"]\]/);
  assert.match(html, /\['agente_ia_suporte',\s*['"][^'"]*Agente de IA['"]\]/);
  assert.match(html, /if\s*\(id\s*===\s*['"]centro_suporte['"]\)\s*return\s+supportCentre\(\)/);
  assert.match(html, /if\s*\(id\s*===\s*['"]agente_ia_suporte['"]\)\s*return\s+aiSupport\(\)/);
  assert.match(html, /function\s+supportCentre\s*\(/);
  assert.match(html, /function\s+aiSupport\s*\(/);
});

test('AI support proposal requires explicit approval and remains blocked without a verified executor', () => {
  const htmlPath = path.join(__dirname, '..', 'CIADI_DASHBOARD_FINANCEIRO.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.match(html, /function\s+approveSupportProposal\s*\(/);
  assert.match(html, /async\s+function\s+executeApprovedSupportAction\s*\(/);
  assert.match(html, /SUPPORT_EXECUTOR_TEST_MODE\s*=\s*false/);
  assert.match(html, /proposalHash/);
  assert.match(html, /status\s*[:=]\s*['"]blocked['"]/);
});
