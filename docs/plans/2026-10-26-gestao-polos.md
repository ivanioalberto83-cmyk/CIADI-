# CIADI — Gestão de Polos Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add controlled management of CIADI operational poles, link each pole to an approved financial cost center, and support scoped views in the Web and Windows dashboards without corrupting historical data.

**Architecture:** Keep operational poles separate from the existing financial cost-center catalog and link them through an explicit, server-enforced relationship after confirming the current schema and policies. Implement authorization in Supabase RLS and use the existing Dashboard HTML as the shared UI source copied by the Windows Setup workflow. The plan is gated: no production migration or release until the unresolved product decisions below are approved and non-production validation succeeds.

**Tech Stack:** Supabase PostgreSQL/Auth/RLS, existing Supabase JS v2 client, HTML/JavaScript/Tailwind dashboard, Electron 35 / electron-builder, GitHub Actions on Node.js 22, Node built-in test runner for isolated validation where suitable.

## Global Constraints

- Preserve existing structure, RLS, records, and integrations; avoid unrelated refactoring.
- Initial inspection is read-only. Do not execute production SQL or write production data as part of planning.
- No paid services or additional cost without explicit authorization.
- Do not put Supabase `service_role` secrets in browser or Electron renderer code.
- Reuse existing Auth and roles; do not create parallel roles without demonstrated need.
- No physical deletion of poles with linked records; use deactivation.
- Do not automatically map or rewrite historical records. Unmapped financial records must remain visible as unassigned until an approved mapping policy is applied.
- A Setup.exe must only be built from an approved branch/commit and identified by version and SHA-256. Do not publish a release or trigger an automatic update without separate approval.
- Treat codes `1012` (POLO TALATONA; TALATONA RUA DO CENTRO LOGÍSTICO) and `1013` (POLO JARDIM DE ROSAS; Condomínio Jardim de Rosas, Talatona, Luanda) as user-provided inputs, not as proof that production records exist. Confirm the exact operational location for Jardim de Rosas before production data entry.

---

## Task 1: Complete read-only schema, permissions, and dependency inventory

**Files:**
- Inspect: `CIADI_DASHBOARD_FINANCEIRO.html` (observed root dashboard)
- Inspect: `ciadi-windows/package.json` (observed Windows packaging configuration)
- Inspect: `.github/workflows/ciadi-windows-setup.yml` (observed Setup build/release workflow)
- Proposed report: `docs/specs/2026-10-26-gestao-polos-discovery.md`

**Interfaces:**
- Consumes: existing `public.finance_centros_custo`, `public.finance_despesas`, role/profile model, current financial views/functions and the existing `newCostCenter()` / `financeAccounting()` UI flows.
- Produces: a read-only inventory of the current cost-center row (without exposing sensitive data), table constraints, foreign keys, RLS policies, dependent views/functions, and exact files/functions to integrate.

- [ ] **Step 1: Record the required evidence**
  
  Record the current cost-center identifier, code/name and active status; column types; foreign keys; uniqueness constraints; RLS policies for SELECT/INSERT/UPDATE/DELETE; and references to `finance_centros_custo` and `finance_despesas`. Also record the current meanings of `finance_despesas.centro_custo` and `empresa_id`. Use read-only inspection only.

- [ ] **Step 2: Verify the inventory is complete**
  
  Compare the inventory against the existing dashboard functions and schema metadata. Expected outcome: every proposed new relationship and every existing dependency is explicitly accounted for; any inaccessible metadata is reported as unknown rather than guessed.

- [ ] **Step 3: Publish the discovery report**
  
  Save the findings to the proposed report path on the documentation branch. Do not include credentials, patient information, or full sensitive row payloads.

- [ ] **Step 4: Gate**
  
  Stop before migration work if the existing center's purpose, permissions, or dependencies cannot be established. Obtain approval for the unresolved product decisions at the end of this plan before proceeding to Task 2.

## Task 2: Versioned data model, constraints, RLS, and migration safety

**Files:**
- Proposed migration: `supabase/migrations/<timestamp>_gestao_polos.sql` (exact timestamp/path to be chosen when repository migration conventions are verified)
- Proposed tests: `tests/polos/schema-and-rls.test.mjs`
- Proposed rollback notes: `docs/specs/2026-10-26-gestao-polos-rollback.md`

**Interfaces:**
- Consumes: approved discovery report and written decisions for center mapping, user/pole scope, operational tables, and historical records.
- Produces: a versioned schema contract for the pole catalog and approved center-cost relationship; server-side uniqueness; RLS policies tied to existing roles; and documented rollback steps.

- [ ] **Step 1: Define the schema assertions before SQL**
  
  Add focused tests/checks that assert: a duplicate pole code is rejected at the database boundary (including concurrent attempts); unauthorized insert/update/deactivation is denied; authorized Direction/admin operations succeed; and a manager cannot read or mutate a pole outside their approved scope if scoped managers are adopted.

- [ ] **Step 2: Confirm the checks fail against the intended missing behavior**
  
  Run the checks against an isolated non-production Supabase project or controlled disposable database. Expected outcome: the new pole catalog/relationship checks report the missing schema or policy behavior; production is not contacted for writes.

- [ ] **Step 3: Draft the migration**
  
  After approval, create a separate pole catalog with a stable primary key, code uniqueness enforced by PostgreSQL, active/inactive status, timestamps, and a validated relationship to the approved financial center. Implement only the user/pole assignment and operational foreign keys explicitly approved. Do not drop or rename existing columns, delete rows, silently reinterpret the free-text `centro_custo` field, or remap history.

- [ ] **Step 4: Verify RLS and rollback**
  
  Test SELECT/INSERT/UPDATE/deactivation through authenticated roles and direct API calls. Verify policy behavior for both the old and new rows on UPDATE. Test rollback on a disposable copy and verify that existing row counts and existing financial totals remain unchanged.

- [ ] **Step 5: Gate**
  
  Do not apply this migration to production until a recoverable backup has been confirmed, rollback has been exercised, the SQL has been reviewed, and explicit production-migration approval is obtained.

## Task 3: Pole management UI in the shared Dashboard source

**Files:**
- Modify: `CIADI_DASHBOARD_FINANCEIRO.html` (observed shared dashboard source)
- Proposed tests: `tests/polos/dashboard-polos.test.mjs`

**Interfaces:**
- Consumes: approved Supabase table/API contract and server-side role policies from Task 2.
- Produces: a “Polos” navigation view with list/search, “+ Adicionar Polo”, edit, activate/deactivate, and explicit cost-center association.

- [ ] **Step 1: Add focused UI behavior tests**
  
  Cover: authorized admin/Direction sees management controls; unauthorized users cannot use controls; the form carries name, code, location and approved cost-center association; duplicate-code server errors are shown in Portuguese; network failures do not show a false success; deactivation preserves the record; and a repeated submit does not create duplicate UI requests.

- [ ] **Step 2: Implement the smallest UI slice**
  
  Add the Polos navigation entry and view using existing layout, escaping helpers, and toast/error patterns. Load records through the authenticated Supabase client. Keep the server as the final authority for permissions and uniqueness. Show loading, empty, success, validation, and network-error states. Do not expose internal IDs as user-editable codes.

- [ ] **Step 3: Implement create/edit/deactivate flows**
  
  Validate required form inputs at the UI for usability, but rely on database constraints for uniqueness. Disable submit while a request is pending. On failure, retain entered values and show an actionable message. On success, only display confirmation after the server confirms the write, then reload the list.

- [ ] **Step 4: Verify focused and regression checks**
  
  Run the pole UI tests and the existing dashboard validation checks. Expected outcome: pole CRUD/deactivation behavior passes and existing login, finance, SOS, triage and navigation flows remain intact.

## Task 4: Approved financial/operational filters and Windows artifact validation

**Files:**
- Modify only the approved sections of `CIADI_DASHBOARD_FINANCEIRO.html`
- Inspect/use: `ciadi-windows/package.json`
- Inspect/use: `.github/workflows/ciadi-windows-setup.yml`
- Proposed tests: `tests/polos/reporting-polos.test.mjs`

**Interfaces:**
- Consumes: approved mapping policy, approved operational tables, and Task 2/3 pole IDs and authorization contract.
- Produces: pole-scoped and consolidated reports that do not double-count, plus a test Setup artifact built from the reviewed commit.

- [ ] **Step 1: Add report invariants**
  
  Test that each expense is counted once in consolidated totals; a record with no valid pole mapping appears in “Não atribuídas”; selecting a pole filters only approved rows; and inactive poles remain available for historical reporting but cannot receive new assignments unless policy explicitly allows it.

- [ ] **Step 2: Integrate only approved filters**
  
  Add pole filters to the financial and operational views selected in the product decisions. Keep consolidated totals as the default where that matches existing behavior. Do not infer a pole from a free-text label or automatically map historical expenses.

- [ ] **Step 3: Run regression and security checks**
  
  Verify old and new role scopes, direct API access, duplicate prevention, empty results, network failures, inactive poles, unassigned records, and financial total invariants. Review Supabase security findings related to exposed views/functions; do not use broad privilege revocations as a shortcut.

- [ ] **Step 4: Build a non-release Setup artifact**
  
  In a reviewed PR branch, run the existing Windows Setup workflow as a test artifact, not a release tag. Confirm the artifact contains the dashboard source from the reviewed commit; record commit SHA, version and SHA-256; verify the workflow succeeds. Do not publish a release or trigger automatic update distribution.

- [ ] **Step 5: Final acceptance gate**
  
  Provide a summary of changed files, test outputs, security review, migration/rollback evidence, artifact hash and remaining limitations. Production migration, release publication and installation on user machines each require their own explicit approval.

## Unresolved product decisions — required before Task 2

1. **Existing financial center:** what is the purpose of the one existing `finance_centros_custo` record, and should it be assigned to either pole? Do not assume.
2. **Jardim de Rosas address:** confirm the exact operational location text for POLO JARDIM DE ROSAS (code `1013`).
3. **Relationship cardinality:** should each pole have exactly one primary cost center, or can one pole be linked to multiple cost centers?
4. **User assignments:** which existing roles may assign users and professionals to poles, and should managers be restricted to assigned poles?
5. **First-phase operational scope:** which tables must be pole-scoped in the first release: appointments, triage requests, SOS alerts, AT sessions, patients, professionals, expenses, or only a subset?
6. **Historical expenses:** should historical expenses remain “Não atribuídas” until manually reviewed, or is there an approved explicit mapping rule? No automatic mapping will occur without approval.
7. **Unmapped expenses:** confirm whether unassigned expenses are visible to Direction/admin only, or also to managers within their approved company/pole scope.
