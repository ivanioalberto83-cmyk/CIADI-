from pathlib import Path

source = Path("supabase/functions/ciadi-support-agent/index.ts").read_text(encoding="utf-8")
workflow = Path(".github/workflows/validate-ciadi-dashboard.yml").read_text(encoding="utf-8")

checks = {
    "Edge Function authenticates the caller with Supabase Auth": "supabase.auth.getUser(token)" in source,
    "only active support technicians are authorized": 'profile.tipo !== "suporte_informatica" || profile.ativo !== true' in source,
    "LLM output uses strict JSON schema": 'additionalProperties: false' in source and 'strict: true' in source,
    "proposal is stored through the server RPC": 'supabase.rpc("ciadi_create_support_proposal"' in source,
    "server-returned hash is surfaced": "hash_payload: row?.new_hash" in source,
    "approval requires explicit confirmation": "body.confirm_approval !== true" in source,
    "execution is server-gated by test-mode flag": 'Deno.env.get("SUPPORT_EXECUTOR_TEST_MODE") === "true"' in source,
    "only read-only action is passed to executor": 'p_action_code: "readonly_validate_proposal"' in source,
    "audit logs use the caller client and a bounded query": 'supabase.from("auditoria")' in source and ".limit(50)" in source,
    "audit output redacts sensitive keys": 'cleanAuditDetails(row.detalhes)' in source and "authorization|api.?key|credential|cookie" in source,
    "no service-role key is referenced": "SUPABASE_SERVICE_ROLE_KEY" not in source and "SERVICE_ROLE_KEY" not in source,
    "responses disable caching": '"Cache-Control": "no-store"' in source,
    "workflow runs this contract test": "python scripts/test_ciadi_support_agent.py" in workflow,
    "workflow watches Edge Function source": "'supabase/functions/ciadi-support-agent/index.ts'" in workflow,
}
for label, ok in checks.items():
    print(("PASS" if ok else "FAIL") + ": " + label)
if not all(checks.values()):
    raise SystemExit(1)
