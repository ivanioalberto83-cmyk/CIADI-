const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const installer = fs.readFileSync(path.join(root, 'build', 'installer.nsh'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.cjs'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('NSIS creates four profile-specific desktop and Start Menu shortcuts', () => {
  for (const [id,label] of [
    ['adm','CIADI - ADM'],
    ['suporte_informatica','CIADI - Suporte Informático'],
    ['rh','CIADI - Recursos Humanos'],
    ['recepcao','CIADI - Receção']
  ]) {
    assert.ok(installer.includes(label), 'Missing shortcut label: ' + label);
    assert.ok(installer.includes('--ciadi-profile=' + id), 'Missing launch argument: ' + id);
  }
  assert.match(installer, /CreateShortCut.*\$DESKTOP/);
  assert.match(installer, /CreateShortCut.*\$SMPROGRAMS/);
});

test('Electron resolves a profile from the shortcut argument before the installer default', () => {
  assert.match(main, /--ciadi-profile=/);
  assert.match(main, /getStationProfileId\(\)/);
  assert.match(main, /getStationProfileId\(\)[\s\S]{0,1000}process\.argv/);
});

test('custom uninstall removes all profile shortcuts and package does not create a generic shortcut', () => {
  assert.match(installer, /!macro customUnInstall/);
  assert.match(installer, /Delete.*CIADI - ADM/);
  assert.match(installer, /Delete.*CIADI - Suporte Informático/);
  assert.match(installer, /Delete.*CIADI - Recursos Humanos/);
  assert.match(installer, /Delete.*CIADI - Receção/);
  assert.equal(packageJson.build.nsis.createDesktopShortcut, false);
  assert.equal(packageJson.build.nsis.createStartMenuShortcut, false);
});
