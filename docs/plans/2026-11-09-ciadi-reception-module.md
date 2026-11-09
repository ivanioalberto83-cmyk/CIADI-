# CIADI Recepção Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the current Recepção navigation page into a professional institutional front-desk module with auditable arrival, queue, visitor, referral and reporting workflows.

**Architecture:** Keep the module independent from clinical and procurement workflows. Reuse existing appointments and patient references only when explicitly linked, while storing front-desk operational events in a dedicated `ciadi_reception` schema. All writes go through named RPCs; until a reviewed permission phase is completed, the database proposal remains unapplied and the module must fail closed when the schema is unavailable.

**Tech Stack:** Existing Electron/HTML dashboard, vanilla JavaScript modules, Supabase JS, PostgreSQL proposal SQL, Node.js built-in test runner.

## Global Constraints

- Work only on the Recepção feature branch; do not edit the Support Informática PR or other stations.
- No writes to the remote Supabase project, no production deployment, no account changes, no RLS activation or permission grants in this phase.
- Do not store clinical notes or unnecessary child-identifying data in front-desk records.
- Do not let the reception module modify clinical records, appointments, invoices, cash, procurement or stock.
- Preserve the current integration contract: `CIADI_RECEPTION_MODULE.create({ root, navigate, notify }).renderHome()`.
- The station selector is not an authorization mechanism; server-side permissions remain a separate later phase.
- No paid Supabase branch or staging environment is to be created.

---

### Task 1: Reception domain engine

**Files:**
- Modify: `renderer/modules/reception-module.js`
- Test: `ciadi-windows/tests/reception-module.test.cjs`

**Interfaces:**
- Exports: `validateVisitInput(input)`, `transitionVisitStatus(current, next)`, `validateVisitorInput(input)`, `summarizeReception(rows)`, `createReceptionRepository({ supabase })`, `create({ root, navigate, notify })`.
- RPC contract: `reception_register_arrival`, `reception_transition_visit`, `reception_register_visitor`, `reception_close_visitor`, all invoked through schema `ciadi_reception`.

- [x] Add tests for valid/invalid arrivals, required appointment reference for appointment visits, allowed/forbidden lifecycle transitions, visitor validation, queue metrics, and RPC-only persistence.
- [ ] Run `node --test ciadi-windows/tests/reception-module.test.cjs`; expected red failures must identify missing exports/behaviour.
- [x] Implement validation, state transitions, metrics, and a repository that calls only the named RPCs; reject invalid input before any database call.
- [ ] Re-run the focused test; expected all reception tests pass.
- [x] `node --check renderer/modules/reception-module.js` passed in GitHub Actions.
- [ ] Commit the isolated domain-engine deliverable.

### Task 2: Front-desk dashboard and queue workflow

**Files:**
- Modify: `renderer/modules/reception-module.js`
- Modify: `CIADI_DASHBOARD_FINANCEIRO.html` only if the current script loader or integration contract requires it.
- Test: `ciadi-windows/tests/reception-module.test.cjs`

**Interfaces:**
- Preserve the existing module factory contract.
- Render the reception home, today's queue, arrival registration, status changes, visitor log and clear unavailable-state messaging.
- Route to existing areas only through the supplied `navigate` callback; never render patient clinical details.

- [ ] Add focused rendering tests for the empty queue and unavailable schema (not yet covered).
- [x] Implement the dashboard and forms; Dashboard integration workflow passed. The first full CI run exposed three legacy-contract/fixture failures, which were corrected; the subsequent full suite passed.
- [ ] Confirm that an unavailable database produces a clear non-operational state and never a fake successful save.

### Task 3: Dedicated database proposal

**Files:**
- Create: `supabase/proposals/ciadi-reception-workflow-proposal.sql`
- Test: `ciadi-windows/tests/reception-module.test.cjs`
- Create or update: `docs/CIADI_RECEPCAO_ARQUITECTURA.md`

**Interfaces:**
- Proposed tables: `front_desk_visits`, `front_desk_visit_events`, `visitor_entries`.
- Proposed RPCs match Task 1 exactly.
- Include foreign-key references to existing appointments/patients only where verified and nullable; no duplicate clinical master records.
- Enable RLS and leave policies/grants out of this engine phase; no authenticated writes become available until the later permission design is reviewed.

- [x] Add static SQL contract tests for schema isolation, RLS enabled, event history, no DELETE grants, and absence of policies/grants.
- [x] Write the additive proposal; static SQL contract tests passed in the full Node suite. PostgreSQL execution remains pending.
- [ ] Run PostgreSQL 16 isolated homologation through GitHub Actions when the branch workflow is configured.
- [ ] Keep the proposal unapplied to remote Supabase.

### Task 4: Integration and quality gate

**Files:**
- Modify: `.github/workflows/ciadi-modules-ci.yml` to include this feature branch and its PR base.
- Modify: `CIADI_DASHBOARD_FINANCEIRO.html` and `index.html` only if integration is necessary; preserve byte-for-byte equality.
- Update: `docs/CIADI_RECEPCAO_ARQUITECTURA.md`.

- [x] Full Node architecture suite: 145 passed, 0 failed; Dashboard syntax/integration workflow passed.
- [ ] Inspect the diff for accidental Support Informática, RH, production or permission changes.
- [ ] Keep the PR Draft until database, profile and end-to-end checks are completed in a controlled environment.

## Product decisions reserved for the permission/homologation phase

- Which reception staff may create, correct, cancel, reopen or export each record.
- Exact polo-level visibility and any supervisor override.
- Whether visitor identification documents are ever collected; the current design does not store document numbers.
- Retention periods for visitor and front-desk event history.
- Whether WhatsApp/SMS/email channels are configured and approved for institutional use.
