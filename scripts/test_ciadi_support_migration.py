from pathlib import Path
import re
from pglast import parse_sql

migration_path = Path("supabase/migrations/20261029120000_ciadi_support_requests_approvals.sql")
sql = migration_path.read_text(encoding="utf-8")
normalized = sql.lower()

# Parse the complete outer PostgreSQL statement stream. This catches broken
# SQL statement boundaries, unterminated dollar quotes and malformed DDL.
statements = parse_sql(sql)
assert len(statements) >= 25, f"Expected migration statements, found {len(statements)}"

functions = [
    "ciadi_is_support_technician",
    "ciadi_support_proposal_guard",
    "ciadi_create_support_proposal",
    "ciadi_decide_support_proposal",
    "ciadi_execute_approved_support_action",
]
for name in functions:
    match = re.search(
        rf"create\s+or\s+replace\s+function\s+public\.{name}\s*\(",
        normalized,
    )
    assert match, f"Missing function definition: {name}"
    body_start = normalized.find("as $$", match.start())
    assert body_start >= 0, f"Function {name} has no valid AS $$ body opener"
    body_end = normalized.find("$$;", body_start + 5)
    assert body_end >= 0, f"Function {name} has no closing $$; delimiter"
    body = normalized[body_start + 5:body_end]
    if name != "ciadi_is_support_technician":
        assert re.search(r"\bbegin\b", body), f"Function {name} is missing BEGIN"
        assert re.search(r"\bend\s*;\s*$", body), f"Function {name} is missing END;"
    else:
        assert re.search(r"\bselect\b", body), "Support role predicate is missing SELECT"

checks = {
    "proposal RLS has a SELECT policy": "create policy ciadi_support_proposals_select_support" in normalized,
    "all four support tables enable RLS": normalized.count("enable row level security") == 4,
    "server computes authoritative SHA-256": "extensions.digest(convert_to(p_proposal::text, 'utf8'), 'sha256')" in normalized,
    "executor recomputes and verifies proposal hash": "if v_hash <> v_proposal.proposal_hash then" in normalized,
    "executor only allows read-only action": "p_action_code is distinct from 'readonly_validate_proposal'" in normalized,
    "executor requires exact approved decision": "a.decision = 'approved'" in normalized and "v_proposal.status <> 'approved'" in normalized,
    "direct state-changing grants are revoked": all(x in normalized for x in [\n        "revoke insert on public.ciadi_support_proposals from authenticated",\n        "revoke update on public.ciadi_support_proposals from authenticated",\n        "revoke insert on public.ciadi_support_approvals from authenticated",\n        "revoke update on public.ciadi_support_requests from authenticated",\n    ]),
    "migration is transaction-wrapped": normalized.strip().startswith("-- ciadi") and normalized.count("begin;") == 1 and normalized.rstrip().endswith("commit;"),
    "malformed single-dollar function delimiter is absent": "as $\ndeclare" not in normalized,
}
for label, ok in checks.items():
    print(("PASS" if ok else "FAIL") + ": " + label)
if not all(checks.values()):
    raise SystemExit(1)
print(f"PASS: PostgreSQL parser accepted {len(statements)} statements")
