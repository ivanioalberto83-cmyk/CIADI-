const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const installer = fs.readFileSync(path.join(__dirname, '..', 'build', 'installer.nsh'), 'utf8');

test('NSIS polo choices are positioned inside the dedicated visible page area', () => {
  const poloPage = installer.slice(installer.indexOf('Function CIADIPoloPageCreate'), installer.indexOf('Function CIADIPoloPageLeave'));
  assert.match(poloPage, /NSD_CreateLabel\} 0 0 100% 18u "Selecione o polo de trabalho desta estação:/);
  assert.match(poloPage, /NSD_CreateRadioButton\} 0 42u 100% 16u "Talatona/);
  assert.match(poloPage, /NSD_CreateRadioButton\} 0 64u 100% 16u "Jardim de Rosas/);
  assert.doesNotMatch(poloPage, /NSD_CreateRadioButton\} 0 (1[0-9][0-9]|[2-9][0-9]{2})u 100%/);
});

test('each polo remains independently selectable and required before RH or Reception installation', () => {
  assert.match(installer, /NSD_GetState\} \$CIADIPoloRadioTalatona/);
  assert.match(installer, /NSD_GetState\} \$CIADIPoloRadioRosas/);
  assert.match(installer, /Selecione o polo para continuar/);
  assert.match(installer, /ciadi-install-polo\.txt/);
});
