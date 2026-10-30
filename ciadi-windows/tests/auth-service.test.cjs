const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('AuthService delegates session, login, logout and auth-state subscription to Supabase', async () => {
  const servicePath = path.resolve(__dirname, '..', '..', 'renderer', 'core', 'auth-service.js');
  assert.ok(fs.existsSync(servicePath), 'AuthService module has not been extracted yet');
  const { createAuthService } = require(servicePath);
  const calls = [];
  const subscription = { unsubscribe() {} };
  const client = {
    auth: {
      getSession: async () => { calls.push(['getSession']); return { data: { session: null }, error: null }; },
      signInWithPassword: async credentials => { calls.push(['signInWithPassword', credentials]); return { data: { user: { id: 'u-1' } }, error: null }; },
      signOut: async (...args) => { calls.push(['signOut', ...args]); return { error: null }; },
      onAuthStateChange: callback => { calls.push(['onAuthStateChange', callback]); return { data: { subscription } }; }
    }
  };
  const service = createAuthService(client);
  const credentials = { email: 'staff@ciadi.ao', password: 'not-a-real-password' };
  const callback = () => {};

  assert.deepEqual(await service.getSession(), { data: { session: null }, error: null });
  assert.deepEqual(await service.signInWithPassword(credentials), { data: { user: { id: 'u-1' } }, error: null });
  assert.deepEqual(await service.signOut(), { error: null });
  assert.equal(service.onAuthStateChange(callback).data.subscription, subscription);
  assert.deepEqual(calls.map(call => call[0]), ['getSession', 'signInWithPassword', 'signOut', 'onAuthStateChange']);
  assert.equal(calls[1][1], credentials);
  assert.equal(calls[3][1], callback);
});

test('AuthService preserves Supabase errors without silently converting them to success', async () => {
  const servicePath = path.resolve(__dirname, '..', '..', 'renderer', 'core', 'auth-service.js');
  assert.ok(fs.existsSync(servicePath), 'AuthService module has not been extracted yet');
  const { createAuthService } = require(servicePath);
  const failure = new Error('auth unavailable');
  const service = createAuthService({
    auth: {
      getSession: async () => { throw failure; },
      signInWithPassword: async () => ({ data: null, error: failure }),
      signOut: async () => ({ error: failure }),
      onAuthStateChange: () => ({ data: { subscription: null } })
    }
  });

  await assert.rejects(service.getSession(), error => error === failure);
  assert.equal((await service.signInWithPassword({ email: 'x', password: 'y' })).error, failure);
  assert.equal((await service.signOut()).error, failure);
});


test('Dashboard initializes AuthService and no longer calls Supabase auth directly', () => {
  const root = path.resolve(__dirname, '..', '..');
  const dashboard = fs.readFileSync(path.join(root, 'CIADI_DASHBOARD_FINANCEIRO.html'), 'utf8');
  assert.match(dashboard, /<script\s+src=["']renderer\/core\/auth-service\.js["']><\/script>/);
  assert.match(dashboard, /authService=window\.CIADI_AUTH_SERVICE\.createAuthService\(sb\)/);
  assert.doesNotMatch(dashboard, /sb\.auth\.(?:getSession|signInWithPassword|signOut|onAuthStateChange)/);
});
