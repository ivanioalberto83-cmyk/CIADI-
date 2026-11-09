const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const installer = fs.readFileSync(path.join(__dirname, '..', 'build', 'installer.nsh'), 'utf8');

test('ADM and Support skip the polo page; RH and Reception must select a polo', () => {
  assert.match(installer, /Page custom CIADIPoloPageCreate CIADIPoloPageLeave/);
  const poloPage = installer.slice(installer.indexOf('Function CIADIPoloPageCreate'), installer.indexOf('Function CIADIPoloPageLeave'));
  assert.match(poloPage, /\$CIADIProfile == "adm"/);
  assert.match(poloPage, /\$CIADIProfile == "suporte_informatica"/);
  assert.match(poloPage, /Abort/);
  assert.match(poloPage, /NSD_CreateRadioButton/);
  assert.match(installer, /Function CIADIPoloPageLeave/);
});

test('installer requires a polo only for RH and Reception profiles', () => {
  const customInstall = installer.slice(installer.indexOf('!macro customInstall'), installer.indexOf('!macroend', installer.indexOf('!macro customInstall')));
  const validationBlock = customInstall.slice(0, customInstall.indexOf('FileOpen $0'));
  const firstLocalProfileCheck = validationBlock.indexOf('CIADIProfile == "rh"');
  assert.doesNotMatch(validationBlock.slice(0, firstLocalProfileCheck), /Polo CIADI não seleccionado/);
  assert.match(customInstall, /CIADIProfile == "rh"[\s\S]*CIADIPolo == ""[\s\S]*Polo CIADI não seleccionado/);
  assert.match(customInstall, /CIADIProfile == "recepcao"[\s\S]*CIADIPolo == ""[\s\S]*Polo CIADI não seleccionado/);
});
