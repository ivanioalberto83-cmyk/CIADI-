# CIADI — Centro de Suporte Informático e Agente de IA Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a restricted CIADI IT Support Centre where the authenticated `suporte_informatica` technician can submit issues, review AI-prepared diagnostic plans, and explicitly approve an unchanged proposal before any supported action can run.

**Architecture:** Extend the existing single-file Dashboard only behind the current support-only route guard. Persist support requests and approval state through a versioned Supabase migration with least-privilege RLS, and keep AI credentials and action execution out of browser code. The repository inspection did not locate a working AI service or an action executor, so the first implementation must remain diagnosis/proposal-only until a server-side service and an approved action catalogue are identified and tested.

**Tech Stack:** Existing HTML/inline JavaScript Dashboard, Supabase JS client and Auth, SQL migrations, GitHub Actions validation, Node.js built-in test runner.

## Global Constraints

- Work only on branch `audit/divisao-acessos-ciadi-2026-10-29`; do not merge, deploy, tag a release, or change the production Supabase project.
- Do not apply migrations or change production RLS.
- Only the active Supabase-authenticated profile whose `public.perfis.tipo` is `suporte_informatica` may open or invoke the Support Centre or AI-support UI. The Setup profile only labels the station and never grants access.
- Admin remains blocked from the Support Centre and AI support, even though the existing general module matrix gives Admin broad access.
- An AI proposal is never executable merely because it exists. Approval must be explicit, bound to the exact proposal version/content and performed by the authenticated authorized technician.
- If the proposal changes after approval, approval is invalidated. If identity, scope, or proposal version cannot be verified, deny execution.
- Never expose service-role keys, API secrets, passwords, patient/clinical content unrelated to the support request, or confidential employee records.
- Do not call an unverified AI provider or claim that AI integration works until an existing server-side service and credentials are confirmed.
- Production changes remain blocked until a restorable Supabase database backup and separate Storage backup are verified.

---

### Task 1: Lock down the support entry points with focused regression tests

**Files:**
- Modify: `CIADI_DASHBOARD_FINANCEIRO.html`
- Modify: `index.html` (must remain byte-identical to the dashboard source)
- Modify: `.github/workflows/validate-ciadi-dashboard.yml`
- Test: `ciadi-windows/dashboard-syntax.test.cjs`

**Interfaces:**
- Consumes: `MODULE_ACCESS`, `SUPPORT_ONLY_MODULES`, `canAccessModule(id)`, `visibleMenu()`, `go(id)`.
- Produces: support route IDs `centro_suporte` and `agente_ia_suporte` remain inaccessible to `admin`, `rh`, `rececao`, `operador`, `profissional`, `paciente`, `responsavel`, and unauthenticated sessions; only `suporte_informatica` is admitted.

- [ ] **Step 1: Add the focused failing test**

Add explicit checks to the existing dashboard validation workflow for each support-only ID and the `tipo !== 'suporte_informatica'` deny rule. Add a Node test that extracts the inline script and verifies that the support route IDs are in `SUPPORT_ONLY_MODULES`, and that both menu filtering and direct route entry use `canAccessModule`.

- [ ] **Step 2: Verify the relevant failure**

Run: `cd ciadi-windows && npm test`

Expected: the new focused test fails if either route ID is removed from the restricted list or if direct navigation no longer checks the access function.

- [ ] **Step 3: Implement the minimum behavior**

Keep a single route authorization check for both menu rendering and direct calls to `go(id)`. Add no permission based on station setup, role label in local storage, or client-provided request fields. Keep Admin blocked from the support-only IDs.

- [ ] **Step 4: Verify the focused pass**

Run: `cd ciadi-windows && npm test`

Expected: all station-profile and Dashboard syntax/access regression tests pass.

- [ ] **Step 5: Run the affected integration check**

Run the existing `Validate CIADI dashboard integration` GitHub Actions workflow.

Expected: HTML copies match, inline JavaScript parses, support-route checks pass, and no service-role credential marker appears in the dashboard.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add CIADI_DASHBOARD_FINANCEIRO.html index.html ciadi-windows/dashboard-syntax.test.cjs .github/workflows/validate-ciadi-dashboard.yml
git commit -m "test: enforce CIADI support route access"
```

### Task 2: Add the Support Centre request and proposal workflow in the Dashboard

**Files:**
- Modify: `CIADI_DASHBOARD_FINANCEIRO.html`
- Modify: `index.html`
- Modify: `.github/workflows/validate-ciadi-dashboard.yml`
- Test: `ciadi-windows/dashboard-syntax.test.cjs`

**Interfaces:**
- Consumes: authenticated `me.id`, validated `profile.tipo`, existing `sb` Supabase client and `audit(acao,tabela,registro_id,detalhes)`.
- Produces: `supportCentre()`, `renderSupportRequest(request)`, and support request/proposal states `open`, `diagnosed`, `awaiting_approval`, `approved`, `blocked`, `completed`, `failed`.

- [ ] **Step 1: Add the focused failing test**

Add checks for a Support Centre menu item and route dispatcher, a request form, a visible diagnosis/proposal state, and explicit Approve/Reject controls that are only rendered for `suporte_informatica`.

- [ ] **Step 2: Verify the relevant failure**

Run: `cd ciadi-windows && npm test`

Expected: the checks fail because the current Dashboard has route guards but no functional Support Centre or AI-agent view.

- [ ] **Step 3: Implement the minimum behavior**

Add a support request screen that captures the technician's issue and impact, shows a structured diagnostic proposal, and displays the proposed scope, affected component, risk, preconditions, and verification steps. Keep AI analysis behind a service adapter; if no configured server-side service is available, show a clear “diagnóstico assistido indisponível; proposta manual” state and do not simulate an AI response. The view must not execute commands or write to business modules.

- [ ] **Step 4: Verify the focused pass**

Run: `cd ciadi-windows && npm test`

Expected: the new route/form/proposal checks pass and inline JavaScript remains syntactically valid.

- [ ] **Step 5: Run the affected integration check**

Run the existing Dashboard validation workflow.

Expected: route, syntax, public-key, and support-only access checks pass.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add CIADI_DASHBOARD_FINANCEIRO.html index.html .github/workflows/validate-ciadi-dashboard.yml ciadi-windows/dashboard-syntax.test.cjs
git commit -m "feat: add CIADI support centre proposal workflow"
```

### Task 3: Define durable approval records and row-level boundaries in a branch-only migration

**Files:**
- Create: `supabase/migrations/20261029120000_ciadi_support_requests_approvals.sql` (proposed path; verify migration naming/order before implementation)
- Create: `docs/AUDITORIA-RLS-SUPORTE-IA-2026-10-29.md`
- Modify: `.github/workflows/validate-ciadi-dashboard.yml`
- Test: branch-only SQL/static validation in the existing GitHub Actions workflow

**Interfaces:**
- Consumes: `auth.uid()`, `public.perfis(id,tipo,ativo)`, the existing `public.auditoria` convention where compatible.
- Produces: a versioned support request record, a proposal snapshot/hash, an explicit approval record tied to the proposal version, and RLS policies that deny all non-`suporte_informatica` access. Exact table and column names must be specified in the migration and kept consistent with the Dashboard adapter.

- [ ] **Step 1: Add the focused failing test**

Add static checks that the proposed migration creates support-specific objects, verifies the authenticated user's active profile type, binds approvals to a proposal version/hash, and does not alter `is_staff()`, `ciadi_finance_staff()`, or unrelated RLS policies.

- [ ] **Step 2: Verify the relevant failure**

Run the Dashboard validation workflow.

Expected: the migration checks fail before the new support-specific migration exists.

- [ ] **Step 3: Implement the minimum behavior**

Create only support-specific tables/policies in a new migration. Deny access to anonymous users and all roles except active `suporte_informatica`; scope rows to the support workflow. An approval record must bind approver ID, proposal version/hash and timestamp. A proposal edit must make the previous approval unusable. Do not include secrets or raw credentials in proposal/audit payloads. Do not apply the migration to production.

- [ ] **Step 4: Verify the focused pass**

Run the static migration validation workflow and review the SQL diff manually.

Expected: checks pass; the migration touches only the new support-specific objects and does not broaden shared helper functions.

- [ ] **Step 5: Run the affected integration check**

Run the complete Dashboard validation workflow and `cd ciadi-windows && npm test`.

Expected: the Dashboard and tests remain valid; no production database is contacted or modified.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add supabase/migrations/20261029120000_ciadi_support_requests_approvals.sql docs/AUDITORIA-RLS-SUPORTE-IA-2026-10-29.md .github/workflows/validate-ciadi-dashboard.yml
git commit -m "feat: define isolated CIADI support approval records"
```

### Task 4: Enforce approval as a server-side execution boundary, with live execution disabled until an executor is verified

**Files:**
- Create: `docs/ESPECIFICACAO-AGENTE-IA-SUPORTE-CIADI-2026-10-29.md`
- Modify: `CIADI_DASHBOARD_FINANCEIRO.html`
- Modify: `index.html`
- Modify: `.github/workflows/validate-ciadi-dashboard.yml`
- Test: `ciadi-windows/dashboard-syntax.test.cjs`

**Interfaces:**
- Consumes: support request ID, immutable proposal version/hash, authenticated approver identity, and a server-side execution adapter only if an existing approved service is located.
- Produces: `approveSupportProposal(requestId, proposalVersion, proposalHash)` and `executeApprovedSupportAction(requestId)`; the latter must return `blocked` unless a server-side executor verifies identity, approval, unchanged proposal hash, allowed action type and target scope.

- [ ] **Step 1: Add the focused failing test**

Add checks proving the browser does not execute a proposed action directly, that a changed proposal invalidates approval, and that the UI remains blocked if no server-side executor is configured.

- [ ] **Step 2: Verify the relevant failure**

Run: `cd ciadi-windows && npm test`

Expected: the checks fail before the approval boundary and blocked state are implemented.

- [ ] **Step 3: Implement the minimum behavior**

The browser may record an approval request but may not run shell commands, arbitrary SQL, migrations, account/role changes, deployments, or broad module writes. The server-side executor must independently validate the active Supabase identity and support role, the immutable approved proposal, the allowed action catalogue, and the target scope. If repository inspection cannot verify an existing server-side AI/execution service, keep execution disabled and report the missing integration instead of adding browser-side secrets or pretending the action ran.

- [ ] **Step 4: Verify the focused pass**

Run: `cd ciadi-windows && npm test`

Expected: approval and execution-gate regression checks pass; any request without a verified executor returns `blocked`.

- [ ] **Step 5: Run the affected integration check**

Run the Dashboard validation workflow and inspect the resulting diff for any credential, production URL mutation, migration application, or deployment step.

Expected: all tests pass; no production action occurs.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add docs/ESPECIFICACAO-AGENTE-IA-SUPORTE-CIADI-2026-10-29.md CIADI_DASHBOARD_FINANCEIRO.html index.html .github/workflows/validate-ciadi-dashboard.yml ciadi-windows/dashboard-syntax.test.cjs
git commit -m "feat: require explicit approval for CIADI support actions"
```

---

## Unresolved product decisions

1. **Allowed action catalogue:** Which concrete operations may the agent propose for execution (for example, read-only diagnostics, local file inspection, or a specific module repair)? Until this list is approved, live execution remains disabled.
2. **Execution environment:** Which existing server-side service is authorized to execute approved actions? The inspected Dashboard and Windows shell did not establish an existing AI provider or secure action executor. Do not choose a provider or deploy a new backend by assumption.
3. **Approval separation:** Must the approving technician be the same technician who opened the request, or should high-risk actions require a second authorized technician?
4. **Retention and visibility:** How long should support requests, proposal snapshots, approvals, and execution logs be retained, and may non-support Admin see only a redacted summary or nothing at all? The default in this plan is no Support Centre access for Admin.
