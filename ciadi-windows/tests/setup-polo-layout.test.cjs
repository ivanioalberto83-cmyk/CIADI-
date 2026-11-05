const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const installer = fs.readFileSync(path.join(__dirname, '..', 'build', 'installer.nsh'), 'utf8');

test('NSIS polo choices are positioned inside the compact visible page area', () => {
  assert.match(installer, /NSD_CreateRadioButton\} 0 112u 100% 12u "Talatona/);
  assert.match(installer, /NSD_CreateRadioButton\} 0 128u 100% 12u "Jardim de Rosas/);
  assert.doesNotMatch(installer, /NSD_CreateRadioButton\} 0 (1[4-9][0-9]|[2-9][0-9]{2})u 100%/);
  assert.match(installer, /NSD_CreateLabel\} 0 94u 100% 14u "Selecione o polo desta instalação:/);
});

test('each polo remains independently selectable and required before installation', () => {
  assert.match(installer, /NSD_GetState\} \$CIADIPoloRadioTalatona/);
  assert.match(installer, /NSD_GetState\} \$CIADIPoloRadioRosas/);
  assert.match(installer, /Selecione o polo para continuar/);
  assert.match(installer, /ciadi-install-polo\.txt/);
});
