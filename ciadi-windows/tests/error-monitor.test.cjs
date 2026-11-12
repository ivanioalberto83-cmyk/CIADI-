const test = require('node:test');
const assert = require('node:assert/strict');
const monitor = require('../../renderer/core/error-monitor.js');

test('redacts credentials and email addresses from reported errors', () => {
  const message = monitor.safeErrorMessage('password=secret token=abc123 user@example.com');
  assert.match(message, /password=\[redigido\]/);
  assert.match(message, /token=\[redigido\]/);
  assert.doesNotMatch(message, /secret|abc123|user@example.com/);
});

test('collects useful technical diagnostics without URL query or hash', () => {
  const diagnostics = monitor.collectDiagnostics({
    windowRef: {
      navigator: { userAgent: 'Test Browser', platform: 'Windows', language: 'pt-PT', onLine: true },
      screen: { width: 1920, height: 1080 },
      location: { pathname: '/recepcao', search: '?token=secret', hash: '#private' },
      innerWidth: 1280,
      innerHeight: 720,
      CIADI_VERSION: 'test-build'
    },
    documentRef: { title: 'CIADI Recepção' },
    stationLabel: 'Recepção',
    profile: { tipo: 'operador' },
    poloCode: 'jardim_de_rosas',
    now: () => new Date('2026-11-12T10:00:00.000Z')
  });
  assert.equal(diagnostics.station, 'Recepção');
  assert.equal(diagnostics.polo, 'jardim_de_rosas');
  assert.equal(diagnostics.page, '/recepcao');
  assert.equal(diagnostics.browser, 'Test Browser');
  assert.equal(diagnostics.online, true);
  assert.equal(diagnostics.appVersion, 'test-build');
  assert.doesNotMatch(JSON.stringify(diagnostics), /secret|private|token=/);
});

test('builds a readable diagnostic section for the Helpdesk ticket', () => {
  const description = monitor.buildReportDescription({
    type: 'Relato manual',
    message: 'Não consigo abrir a factura',
    diagnostics: {
      station: 'Recepção', profile: 'operador', polo: 'jardim_de_rosas',
      page: '/recepcao', pageTitle: 'CIADI', timestamp: '2026-11-12T10:00:00.000Z',
      browser: 'Test Browser', platform: 'Windows', language: 'pt-PT',
      online: false, viewport: '1280x720', screen: '1920x1080',
      appVersion: 'test-build'
    },
    reference: 'abc123'
  });
  assert.match(description, /Descrição: Não consigo abrir a factura/);
  assert.match(description, /Polo: jardim_de_rosas/);
  assert.match(description, /Navegador: Test Browser/);
  assert.match(description, /Ligação à Internet: offline/);
});
