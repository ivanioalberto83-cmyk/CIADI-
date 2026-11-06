const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const installer = fs.readFileSync(path.join(root, 'build', 'installer.nsh'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.cjs'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('Os atalhos são criados condicionalmente para cada caixa seleccionada', () => {
  const expected = [
    ['CIADISelectADM', 'adm', 'CIADI - ADM'],
    ['CIADISelectSupport', 'suporte_informatica', 'CIADI - Suporte Informático'],
    ['CIADISelectRH', 'rh', 'CIADI - Recursos Humanos'],
    ['CIADISelectReception', 'recepcao', 'CIADI - Receção']
  ];
  for (const [flag,id,label] of expected) {
    const block = installer.slice(installer.indexOf(flag + ' == "1"', installer.indexOf('!macro customInstall')), installer.indexOf('!macroend', installer.indexOf('!macro customInstall')));
    assert.ok(block.includes(label + '.lnk'), 'Atalho ausente: ' + label);
    assert.ok(block.includes('--ciadi-profile=' + id), 'Argumento ausente: ' + id);
  }
  assert.match(installer, /CreateShortCut "\$DESKTOP/);
  assert.match(installer, /CreateShortCut "\$SMPROGRAMS/);
});

test('O perfil de execução vem do argumento individual do atalho', () => {
  assert.match(main, /--ciadi-profile=/);
  assert.match(main, /function getStationProfileId\(\)/);
  assert.doesNotMatch(main, /ciadi-install-profile\.txt/);
});

test('RH e Receção recebem o polo escolhido; ADM e Suporte não recebem polo', () => {
  assert.match(installer, /--ciadi-profile=rh --ciadi-polo=\$CIADIPolo/);
  assert.match(installer, /--ciadi-profile=recepcao --ciadi-polo=\$CIADIPolo/);
  assert.match(installer, /--ciadi-profile=adm"/);
  assert.match(installer, /--ciadi-profile=suporte_informatica"/);
  assert.doesNotMatch(installer, /--ciadi-profile=adm --ciadi-polo=/);
  assert.doesNotMatch(installer, /--ciadi-profile=suporte_informatica --ciadi-polo=/);
});

test('A reinstalação remove atalhos antigos antes de recriar os seleccionados', () => {
  const install = installer.slice(installer.indexOf('!macro customInstall'), installer.indexOf('!macroend', installer.indexOf('!macro customInstall')));
  const firstCreate = install.indexOf('CreateShortCut');
  for (const label of ['CIADI - ADM', 'CIADI - Suporte Informático', 'CIADI - Recursos Humanos', 'CIADI - Receção']) {
    const deletion = install.indexOf('Delete "$DESKTOP\\' + label + '.lnk"');
    assert.ok(deletion >= 0 && deletion < firstCreate, 'Não remove o atalho antigo antes de criar: ' + label);
  }
});

test('A aplicação não cria atalhos genéricos e a desinstalação remove os quatro', () => {
  assert.equal(packageJson.build.nsis.createDesktopShortcut, false);
  assert.equal(packageJson.build.nsis.createStartMenuShortcut, false);
  const uninstall = installer.slice(installer.indexOf('!macro customUnInstall'));
  for (const label of ['CIADI - ADM', 'CIADI - Suporte Informático', 'CIADI - Recursos Humanos', 'CIADI - Receção']) {
    assert.ok(uninstall.includes(label + '.lnk'));
  }
});
