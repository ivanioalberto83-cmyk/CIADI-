# CIADI Recepção Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the current Recepção navigation page into a professional institutional front-desk module with auditable arrival, queue, visitor, referral, billing/cashier, procurement and branded document workflows.

**Architecture:** Keep the module independent from clinical workflows and integrated with the central Finance/Billing/Cash and Procurement engines. Reuse existing appointments and patient references only when explicitly linked, while storing front-desk operational events in a dedicated `ciadi_reception` schema. All writes go through named RPCs; until a reviewed permission phase is completed, the database proposal remains unapplied and the module must fail closed when the schema is unavailable.

**Tech Stack:** Existing Electron/HTML dashboard, vanilla JavaScript modules, Supabase JS, PostgreSQL proposal SQL, Node.js built-in test runner.

## Global Constraints

- Work only on the Recepção feature branch; do not edit the Support Informática PR or other stations.
- No writes to the remote Supabase project, no production deployment, no account changes, no RLS activation or permission grants in this phase.
- Do not store clinical notes or unnecessary child-identifying data in front-desk records.
- Do not let the reception module modify clinical records, appointments, invoices, cash, procurement or stock directly; use audited central engine contracts, approvals and permissions without duplicate ledgers or stock records.
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
- [x] Add daily, per-polo sequential ticket numbers using an atomic upsert counter; keep global call-next order chronological when both polos are shown.
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


### Task 5: Privacy-safe call panel preview

- [x] Specify public-panel data contract through tests: ticket label, polo and generic destination only.
- [x] Add a pure model builder that filters invalid tickets, lists active calls and selects the next waiting ticket chronologically.
- [x] Add a Reception dashboard preview with no patient/visitor name, purpose, or clinical information.
- [x] Red-green verification: the test-only commit `4e6ebaff553ecf886199b7208bc7f4e2ee05a9d0` failed in the module test stage; implementation commit `a5e347805ac950b5e85e98a95ef05d76db5e27e5` passed the full module CI.
- [x] Latest module CI: run 42607316292, completed successfully.
- [ ] Dedicated TV/public route and read-only data endpoint remain pending. Do not expose anonymous access or grant public database permissions before a separate security design and approval.
- [ ] Sound, automatic refresh, room routing and PostgreSQL integration tests remain pending.


### Task 6: Service destination routing

- [x] Audited the live public schema read-only: `public.especialidades` has six active service rows; `public.agendamentos.sala_nome` currently contains generated technical room identifiers, so those values are not suitable for public display.
- [x] Use the existing active specialty catalogue as the routing destination source; do not invent room names or expose internal room identifiers.
- [x] Add repository contracts for reading active destinations and assigning a destination to a visit.
- [x] Add a transaction-safe RPC proposal that locks the visit, validates an active specialty, updates the destination and records an immutable `destination_assigned` event with actor and details.
- [x] Extend the dashboard queue with a destination selector and routing action; display the specialty label in the privacy-filtered call panel.
- [x] Keep routing within the Reception schema proposal; no live SQL or permission changes have been applied.
- [ ] Verify PostgreSQL execution and RLS behaviour in an isolated homologation environment.
- [ ] Standardize human-readable room identifiers and map specialty-to-room only after operational confirmation.
- [ ] Add role/polo authorization, public TV endpoint, automatic refresh and sound in subsequent phases.


### Task 7: Referral receipt confirmation and return

- [x] Add repository contracts for service acceptance and return with mandatory reason.
- [x] Extend the SQL proposal with pending/accepted/returned state, actor/time fields and immutable events.
- [x] Set referrals to pending when a destination is assigned and expose referral state in the dashboard payload.
- [x] Display referral receipt status in the Reception queue.
- [ ] Verify the test-first red run and the green GitHub Actions run for the new referral tests.
- [ ] Add service-side acceptance UI only after the destination-service workflow and role authorization are specified.
- [ ] Keep the SQL proposal unapplied and grants absent.


## Scope addition — billing, cashier, procurement and CIADI identity

### Task 8: Read-only audit of central engines
- [x] Confirm existing Finance structures: finance_documentos, finance_documento_linhas, finance_clientes, finance_servicos, finance_series, finance_pagamentos, finance_caixas, finance_caixa_turnos, finance_movimentos_caixa, finance_operadores and audit/accounting/SAF-T tables.
- [x] Identify central billing/cash functions: ciadi_faturacao_criar_documento, ciadi_faturacao_emitir_documento, ciadi_faturacao_anular_documento, ciadi_abrir_caixa, ciadi_fechar_caixa, ciadi_aprovar_fecho_caixa, ciadi_registar_movimento_caixa, ciadi_finance_integrar_pagamento.
- [x] Confirm ciadi_ti procurement/inventory structures: items, item_categories, warehouses, stock_balances, stock_movements, inventory_counts, inventory_count_lines, purchase_requests, purchase_request_lines, suppliers, assets, audit_events.
- [x] Identify procurement functions decide_purchase_request, post_stock_movement, transfer_stock; confirm RLS enabled and relevant policies currently scoped to Support Informática.
- [x] Identify central identity service renderer/core/institutional-identity-service.js, already consumed by the Support document engine.
- [x] Record logo configuration gap: instituicao.logo_url and finance_emitente_config.logotipo_url are null; Storage logos bucket exists but contains no objects in the audit query. The central identity service already carries embedded logoDataUrl.
- [x] Inspect representative SECURITY DEFINER bodies: invoice creation requires is_staff(); payment accounting requires finance staff; cashier actions use ciadi_finance_can operator capabilities; procurement decision requires admin/gestor; stock posting requires Support access.\n- [ ] Complete EXECUTE grant inventory and review all remaining SECURITY DEFINER bodies before Reception invokes any write action.
- [ ] Confirm whether a purchase-order / goods-receipt flow exists elsewhere; current inspected ciadi_ti tables do not show dedicated formal purchase order or goods receipt entities.
- [ ] Produce final action-to-RPC mapping with operator, company, polo, cash-shift, approval and idempotency requirements; no remote writes or schema changes. Reception must fail closed where current RLS/RPC checks do not authorize the session.

### Task 9: Reception billing and cashier
- [ ] Service/charge lookup and payer selection using existing master data.
- [ ] Invoice, receipt and payment proof issued through the central finance engine.
- [ ] Configured payment methods, cashier opening/closing, cash movements, daily reconciliation and reports by polo/operator.
- [ ] Voids, refunds, reversals and credit notes require reason, actor, audit event and appropriate approval.
- [ ] Test idempotency and duplicate-payment prevention.

### Task 10: Reception procurement
- [ ] Internal requisitions for materials/services with polo, cost centre, purpose, quantities and priority.
- [ ] Track approval and requisition status.
- [ ] Request replenishment and read stock availability through central Procurement.
- [ ] Register physical delivery quantities and discrepancies for Reception deliveries.
- [ ] Keep supplier, purchase order, stock ledger and inventory master records central.

### Task 11: Central CIADI identity and document templates
- [ ] Audit the actual approved CIADI logo asset and existing central identity/document service.
- [x] Reuse the existing CIADI_INSTITUTIONAL_IDENTITY service as the single brand source; its embedded logoDataUrl is available to PDF templates.
- [ ] Use one shared identity configuration and template engine for every Reception document/export.
- [ ] Embed the approved logo in PDFs, not as a remote runtime dependency.
- [ ] Cover invoices/receipts (through Finance), cashier summaries, requisitions, delivery records, visitor declarations, correspondence, protocols and operational reports.
- [ ] Add tests ensuring no Reception document/export omits the official logo and identity component.
- [ ] Use only verified institutional and fiscal details; do not invent legal name, NIF, address or contacts.
