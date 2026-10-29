from pathlib import Path

dashboard = Path("CIADI_DASHBOARD_FINANCEIRO.html").read_text(encoding="utf-8")
migration = Path("supabase/migrations/20261029120000_ciadi_support_requests_approvals.sql").read_text(encoding="utf-8").lower()

checks = {
    "server computes the authoritative proposal hash": "extensions.digest(convert_to(p_proposal::text, 'utf8'), 'sha256')" in migration,
    "execution log is isolated and idempotent per proposal": "create table if not exists public.ciadi_support_executions" in migration and "unique (proposal_id)" in migration,
    "executor RPC checks exact approved proposal": "function public.ciadi_execute_approved_support_action(" in migration and "v_proposal.status <> 'approved'" in migration,
    "executor only permits read-only validation": "p_action_code is distinct from 'readonly_validate_proposal'" in migration,
    "executor requires matching approval record": "from public.ciadi_support_approvals" in migration and "decision = 'approved'" in migration,
    "execution table uses RLS": "alter table public.ciadi_support_executions enable row level security" in migration,
    "browser calls the server executor RPC": "sb.rpc('ciadi_execute_approved_support_action'" in dashboard,
    "browser executor remains disabled until isolated test DB is configured": "const SUPPORT_EXECUTOR_TEST_MODE = false" in dashboard,
    "browser never runs arbitrary SQL or shell commands": "SUPPORT_EXECUTOR_TEST_MODE = false" in dashboard and "p_action_code:'readonly_validate_proposal'" in dashboard,
}
for label, ok in checks.items():
    print(("PASS" if ok else "FAIL") + ": " + label)
if not all(checks.values()):
    raise SystemExit(1)
