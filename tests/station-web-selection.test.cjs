const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('web login exposes station and polo selectors', () => {
  assert.match(html, /id="stationProfileSelect"/);
  assert.match(html, /id="stationPoloSelect"/);
  assert.match(html, /Administração/);
  assert.match(html, /Suporte Informático/);
  assert.match(html, /Recursos Humanos/);
  assert.match(html, /Receção/);
  assert.match(html, /Talatona/);
  assert.match(html, /Jardim de Rosas/);
});

test('browser station selection is applied before authenticating', () => {
  assert.match(html, /function setStationSelection\(/);
  assert.match(html, /setStationSelection\(\);/);
  assert.match(html, /stationMode = Boolean\(stationProfile\)/);
  assert.match(html, /stationProfileSelect.*addEventListener\('change'/s);
});

test('ADM and Support do not require a polo; RH and Reception do', () => {
  assert.match(html, /stationRequiresPolo = stationMode && !\['adm', 'suporte_informatica'\]\.includes\(stationProfile\)/);
  assert.match(html, /poloSelect\.required = stationRequiresPolo/);
  assert.match(html, /if\(stationRequiresPolo && !stationPolo\)/);
});

test('installer-provided station profile remains authoritative in the desktop app', () => {
  assert.match(html, /stationParams\.has\('ciadi_profile'\)/);
  assert.match(html, /stationSelection.*class="hiddenx/);
});
