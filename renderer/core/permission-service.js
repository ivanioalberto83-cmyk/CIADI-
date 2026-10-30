(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CIADI_PERMISSION_SERVICE = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function isValidContext(context, action) {
    return Boolean(
      context &&
      typeof context.userId === 'string' && context.userId.trim() &&
      typeof context.moduleId === 'string' && context.moduleId.trim() &&
      typeof action === 'string' && action.trim()
    );
  }

  function createPermissionService(options = {}) {
    const provider = options.authorizationProvider;

    async function check(context, action) {
      if (!isValidContext(context, action)) return false;
      if (!provider || typeof provider.checkPermission !== 'function') return false;

      try {
        const decision = await provider.checkPermission({
          userId: context.userId,
          moduleId: context.moduleId,
          action
        });
        return Boolean(decision && decision.allowed === true);
      } catch (_error) {
        // A failed or unavailable authorization source must never grant access.
        return false;
      }
    }

    return Object.freeze({
      canAccessModule(context) {
        return check(context, 'view');
      },
      canPerform(context) {
        return check(context, context && context.action);
      }
    });
  }

  return Object.freeze({ createPermissionService });
});
