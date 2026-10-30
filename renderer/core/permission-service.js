(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CIADI_PERMISSION_SERVICE = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function isOptionalId(value) {
    return value === undefined || value === null ||
      (typeof value === 'string' && value.trim().length > 0);
  }

  function buildRequestedScope(context) {
    const activePoloId = context.activePoloId ?? null;
    const representedPoloId = context.representedPoloId ?? null;
    const delegationId = context.delegationId ?? null;

    if (![activePoloId, representedPoloId, delegationId].every(isOptionalId)) return null;

    // Representation is explicit and scoped; never infer it from login location or profile labels.
    if (representedPoloId || delegationId) {
      if (!representedPoloId || !delegationId || !activePoloId) return null;
      if (activePoloId !== representedPoloId) return null;
    }

    return Object.freeze({ activePoloId, representedPoloId, delegationId });
  }

  function isValidContext(context, action) {
    return Boolean(
      context &&
      typeof context.userId === 'string' && context.userId.trim() &&
      typeof context.moduleId === 'string' && context.moduleId.trim() &&
      typeof action === 'string' && action.trim() &&
      buildRequestedScope(context)
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
          action,
          requestedScope: buildRequestedScope(context)
        });
        // The backend must bind the request to auth.uid(), reload the user's origin polo,
        // and validate the active polo/delegation against server-side records and expiry.
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
