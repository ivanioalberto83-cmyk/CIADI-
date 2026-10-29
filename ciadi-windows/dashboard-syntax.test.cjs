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
