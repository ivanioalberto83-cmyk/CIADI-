const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const installer = fs.readFileSync(path.join(__dirname, '..', 'build', 'installer.nsh'), 'utf8');

test('NSIS polo choices are positioned inside the dedicated visible page area', () => {
  const poloPage = installer.slice(installer.indexOf('Function CIADIPoloPageCreate'), installer.indexOf('Function CIADIPoloPageLeave'));
  assert.match(poloPage, /NSD_CreateLabel\} 0 0 100% 18u "Seleccione o polo para as estações RH e\/ou Receção:/);
  assert.match(poloPage, /NSD_CreateRadioButton\} 0 48u 100% 16u "Talatona/);
  assert.match(poloPage, /NSD_CreateRadioButton\} 0 72u 100% 16u "Jardim de Rosas/);
  assert.doesNotMatch(poloPage, /NSD_CreateRadioButton\} 0 (1[0-9][0-9]|[2-9][0-9]{2})u 100%/);
});

test('each polo remains independently selectable and required only for RH or Reception selections', () => {
  assert.match(installer, /NSD_GetState\} \$CIADIPoloRadioTalatona/);
  assert.match(installer, /NSD_GetState\} \$CIADIPoloRadioRosas/);
  assert.match(installer, /Seleccione o polo para as estações RH\/Receção/);
  assert.match(installer, /ciadi-install-polo\.txt/);
  assert.match(installer, /CIADISelectRH == "1"/);
  assert.match(installer, /CIADISelectReception == "1"/);
});
