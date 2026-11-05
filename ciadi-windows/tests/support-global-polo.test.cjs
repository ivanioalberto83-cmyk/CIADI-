const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'main.cjs'), 'utf8');
const dashboard = fs.readFileSync(path.resolve(root, '..', 'CIADI_DASHBOARD_FINANCEIRO.html'), 'utf8');

test('Suporte Informático e ADM não dependem de um polo da estação', () => {
  assert.match(dashboard, /!\['adm', 'suporte_informatica'\]\.includes\(stationProfile\)/);
  assert.match(dashboard, /const stationRequiresPolo/);
  assert.match(dashboard, /stationRequiresPolo && !Object\.prototype\.hasOwnProperty\.call\(stationPoloLabels, stationPolo\)/);
  assert.match(dashboard, /stationRequiresPolo \? \(stationProfileLabels\[stationProfile\] \+ ' · ' \+ stationPoloLabels\[stationPolo\]\) : stationProfileLabels\[stationProfile\]/);
  assert.match(main, /ciadi_polo:\s*stationPolo \|\| ''/);
});

test('RH e Receção continuam obrigados a identificar um polo válido', () => {
  assert.match(dashboard, /const stationRequiresPolo = stationMode && !\['adm', 'suporte_informatica'\]\.includes\(stationProfile\)/);
  assert.match(dashboard, /if\(stationRequiresPolo && !Object\.prototype\.hasOwnProperty/);
});
