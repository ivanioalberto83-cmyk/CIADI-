const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const installer = fs.readFileSync(path.join(__dirname, '..', 'build', 'installer.nsh'), 'utf8');
const main = fs.readFileSync(path.join(__dirname, '..', 'main.cjs'), 'utf8');

test('ADM e Suporte podem ser seleccionados sem escolher polo', () => {
  const page = installer.slice(installer.indexOf('Function CIADIPoloPageCreate'), installer.indexOf('Function CIADIPoloPageLeave'));
  assert.match(page, /CIADISelectRH != "1"/);
  assert.match(page, /CIADISelectReception != "1"/);
  assert.match(page, /Abort/);
  const install = installer.slice(installer.indexOf('!macro customInstall'), installer.indexOf('!macroend', installer.indexOf('!macro customInstall')));
  assert.match(install, /CIADISelectRH == "1"[\s\S]*CIADIPolo == ""/);
  assert.match(install, /CIADISelectReception == "1"[\s\S]*CIADIPolo == ""/);
});

test('RH e Receção exigem polo e recebem-no no argumento do respectivo atalho', () => {
  assert.match(installer, /--ciadi-profile=rh --ciadi-polo=\$CIADIPolo/);
  assert.match(installer, /--ciadi-profile=recepcao --ciadi-polo=\$CIADIPolo/);
  assert.match(installer, /Talatona — Polo 001/);
  assert.match(installer, /Jardim de Rosas — Polo 002/);
});

test('Electron só usa o polo instalado como fallback para RH ou Receção', () => {
  assert.match(main, /getStationProfileId\(\)/);
  assert.match(main, /profileId !== 'rh' && profileId !== 'recepcao'/);
  assert.match(main, /--ciadi-polo=/);
});
