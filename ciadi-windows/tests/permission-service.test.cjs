const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Contract tests: the server remains the sole source of authorization decisions.
const servicePath = path.resolve(__dirname, '..', '..', 'renderer', 'core', 'permission-service.js');

test('PermissionService denies by default when no server authorization provider is configured', async () => {
  assert.ok(require('node:fs').existsSync(servicePath), 'PermissionService module does not exist yet');
  const { createPermissionService } = require(servicePath);
  const service = createPermissionService();

  assert.equal(await service.canAccessModule({ userId: 'u1', moduleId: 'financeiro' }), false);
  assert.equal(await service.canPerform({ userId: 'u1', moduleId: 'financeiro', action: 'export' }), false);
});

test('PermissionService delegates decisions to the server provider for each module and operation', async () => {
  const { createPermissionService } = require(servicePath);
  const calls = [];
  const provider = {
    async checkPermission(context) {
      calls.push(context);
      return { allowed: context.moduleId === 'sos' && context.action === 'view' };
    }
  };
  const service = createPermissionService({ authorizationProvider: provider });

  assert.equal(await service.canAccessModule({ userId: 'u1', moduleId: 'sos' }), true);
  assert.equal(await service.canPerform({ userId: 'u1', moduleId: 'financeiro', action: 'export' }), false);
  assert.deepEqual(calls, [
    { userId: 'u1', moduleId: 'sos', action: 'view' },
    { userId: 'u1', moduleId: 'financeiro', action: 'export' }
  ]);
});

test('PermissionService fails closed when the provider errors or returns an invalid decision', async () => {
  const { createPermissionService } = require(servicePath);
  const broken = createPermissionService({
    authorizationProvider: { async checkPermission() { throw new Error('network failure'); } }
  });
  const invalid = createPermissionService({
    authorizationProvider: { async checkPermission() { return { allowed: 'yes' }; } }
  });

  assert.equal(await broken.canPerform({ userId: 'u1', moduleId: 'rh', action: 'read' }), false);
  assert.equal(await invalid.canPerform({ userId: 'u1', moduleId: 'rh', action: 'read' }), false);
});

test('PermissionService rejects incomplete contexts instead of inferring rights from profile labels', async () => {
  const { createPermissionService } = require(servicePath);
  let calls = 0;
  const service = createPermissionService({
    authorizationProvider: { async checkPermission() { calls += 1; return { allowed: true }; } }
  });

  assert.equal(await service.canPerform({ profile: 'admin', moduleId: 'rh', action: 'read' }), false);
  assert.equal(await service.canPerform({ userId: 'u1', moduleId: 'rh' }), false);
  assert.equal(calls, 0);
});
