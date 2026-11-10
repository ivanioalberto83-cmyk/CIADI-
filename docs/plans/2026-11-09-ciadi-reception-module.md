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
- [x] TDD red observed: commit f0a1550 added the integration contract tests and CI failed specifically because createReceptionBusinessRepository was not yet exported.
- [x] Implement validation, state transitions, metrics, and a repository that calls only the named RPCs; reject invalid input before any database call.
- [x] TDD green verified by GitHub Actions: 162 tests passed, 0 failed on run 42610491365.
- [x] `node --check renderer/modules/reception-module.js` passed in GitHub Actions.
- [x] Implementation committed incrementally on the isolated Recepção feature branch.

### Task 2: Front-desk dashboard and queue workflow

**Files:**
- Modify: `renderer/modules/reception-module.js`
- Modify: `CIADI_DASHBOARD_FINANCEIRO.html` only if the current script loader or integration contract requires it.
- Test: `ciadi-windows/tests/reception-module.test.cjs`

**Interfaces:**
- Preserve the existing module factory contract.
- Render the reception home, today's queue, arrival registration, status changes, visitor log and clear unavailable-state messaging.
- Route to existing areas only through the supplied `navigate` callback; never render patient clinical details.

- [x] Add focused rendering tests for the empty queue and unavailable schema; both states are covered through the module's public `renderHome()` entry point.
- [x] Implement the dashboard and forms; Dashboard integration workflow passed. The first full CI run exposed three legacy-contract/fixture failures, which were corrected; the subsequent full suite passed.
- [x] Finance integration fails closed when the principal company cannot be resolved; unavailable/RLS-blocked data is shown as unavailable, not as a successful operation.

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
- [x] Run PostgreSQL 16 isolated homologation through GitHub Actions: run `42790400616` passed after correcting a malformed dollar-quote delimiter in `reception_search_appointments`.
- [x] Add daily, per-polo sequential ticket numbers using an atomic upsert counter; keep global call-next order chronological when both polos are shown.
- [ ] Keep the proposal unapplied to remote Supabase.

### Task 4: Integration and quality gate

**Files:**
- Modify: `.github/workflows/ciadi-modules-ci.yml` to include this feature branch and its PR base.
- Modify: `CIADI_DASHBOARD_FINANCEIRO.html` and `index.html` only if integration is necessary; preserve byte-for-byte equality.
- Update: `docs/CIADI_RECEPCAO_ARQUITECTURA.md`.

- [x] Earlier Node architecture suite: 145 passed, 0 failed; latest full Node suite: 162 passed, 0 failed (run 42610491365). Dashboard validation passed (run 42610491460).
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
- [x] Verify PostgreSQL execution and RLS behaviour in isolated PostgreSQL 16: arrival, sequential per-polo tickets, appointment check-in, visitor entry/exit, referral routing/acceptance, dashboard aggregation, RLS enabled and no schema/function grants before the permission phase.
- [ ] Standardize human-readable room identifiers and map specialty-to-room only after operational confirmation.
- [ ] Add role/polo authorization, public TV endpoint, automatic refresh and sound in subsequent phases.


### Task 7: Referral receipt confirmation and return

- [x] Add repository contracts for service acceptance and return with mandatory reason.
- [x] Extend the SQL proposal with pending/accepted/returned state, actor/time fields and immutable events.
- [x] Set referrals to pending when a destination is assigned and expose referral state in the dashboard payload.
- [x] Display referral receipt status in the Reception queue.
- [x] Verify red/green SQL homologation: the first PostgreSQL run exposed the invalid `# CIADI Recepção Implementation Plan

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
- [x] TDD red observed: commit f0a1550 added the integration contract tests and CI failed specifically because createReceptionBusinessRepository was not yet exported.
- [x] Implement validation, state transitions, metrics, and a repository that calls only the named RPCs; reject invalid input before any database call.
- [x] TDD green verified by GitHub Actions: 162 tests passed, 0 failed on run 42610491365.
- [x] `node --check renderer/modules/reception-module.js` passed in GitHub Actions.
- [x] Implementation committed incrementally on the isolated Recepção feature branch.

### Task 2: Front-desk dashboard and queue workflow

**Files:**
- Modify: `renderer/modules/reception-module.js`
- Modify: `CIADI_DASHBOARD_FINANCEIRO.html` only if the current script loader or integration contract requires it.
- Test: `ciadi-windows/tests/reception-module.test.cjs`

**Interfaces:**
- Preserve the existing module factory contract.
- Render the reception home, today's queue, arrival registration, status changes, visitor log and clear unavailable-state messaging.
- Route to existing areas only through the supplied `navigate` callback; never render patient clinical details.

- [x] Add focused rendering tests for the empty queue and unavailable schema; both states are covered through the module's public `renderHome()` entry point.
- [x] Implement the dashboard and forms; Dashboard integration workflow passed. The first full CI run exposed three legacy-contract/fixture failures, which were corrected; the subsequent full suite passed.
- [x] Finance integration fails closed when the principal company cannot be resolved; unavailable/RLS-blocked data is shown as unavailable, not as a successful operation.

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
- [x] Run PostgreSQL 16 isolated homologation through GitHub Actions: run `42790400616` passed after correcting a malformed dollar-quote delimiter in `reception_search_appointments`.
- [x] Add daily, per-polo sequential ticket numbers using an atomic upsert counter; keep global call-next order chronological when both polos are shown.
- [ ] Keep the proposal unapplied to remote Supabase.

### Task 4: Integration and quality gate

**Files:**
- Modify: `.github/workflows/ciadi-modules-ci.yml` to include this feature branch and its PR base.
- Modify: `CIADI_DASHBOARD_FINANCEIRO.html` and `index.html` only if integration is necessary; preserve byte-for-byte equality.
- Update: `docs/CIADI_RECEPCAO_ARQUITECTURA.md`.

- [x] Earlier Node architecture suite: 145 passed, 0 failed; latest full Node suite: 162 passed, 0 failed (run 42610491365). Dashboard validation passed (run 42610491460).
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
- [x] Verify PostgreSQL execution and RLS behaviour in isolated PostgreSQL 16: arrival, sequential per-polo tickets, appointment check-in, visitor entry/exit, referral routing/acceptance, dashboard aggregation, RLS enabled and no schema/function grants before the permission phase.
- [ ] Standardize human-readable room identifiers and map specialty-to-room only after operational confirmation.
- [ ] Add role/polo authorization, public TV endpoint, automatic refresh and sound in subsequent phases.


### Task 7: Referral receipt confirmation and return

- [x] Add repository contracts for service acceptance and return with mandatory reason.
- [x] Extend the SQL proposal with pending/accepted/returned state, actor/time fields and immutable events.
- [x] Set referrals to pending when a destination is assigned and expose referral state in the dashboard payload.
- [x] Display referral receipt status in the Reception queue.
 function delimiter; the corrected proposal passed run `42790400616`.
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
- [x] Add a read-only adapter for the existing finance_servicos catalogue, scoped by the verified principal company.
- [x] Add read-only views of finance_caixas and recent finance_documentos, scoped by empresa_id.
- [x] Display service prices, cashbox state and recent document state in the Reception dashboard.
- [x] Fail closed when the principal company cannot be resolved; do not present an unscoped finance query as an empty ledger.
- [ ] Add authorized invoice/payment/cash write actions only after reviewing EXECUTE grants, function bodies, operator capabilities, shift and idempotency.
- [ ] Service/charge lookup and payer selection using existing master data.
- [ ] Invoice, receipt and payment proof issued through the central finance engine.
- [ ] Configured payment methods, cashier opening/closing, cash movements, daily reconciliation and reports by polo/operator.
- [ ] Voids, refunds, reversals and credit notes require reason, actor, audit event and appropriate approval.
- [ ] Test idempotency and duplicate-payment prevention.

### Task 10: Reception procurement
- [x] Add read-only adapters for existing ciadi_ti.stock_balances and ciadi_ti.purchase_requests.
- [x] Display current stock/minimum indicators and existing purchase request status in the Reception dashboard.
- [ ] Internal requisitions for materials/services with polo, cost centre, purpose, quantities and priority, extending the existing request contract rather than creating a duplicate ledger.
- [ ] Track approval and requisition status.
- [ ] Request replenishment and read stock availability through central Procurement.
- [ ] Register physical delivery quantities and discrepancies for Reception deliveries.
- [ ] Keep supplier, purchase order, stock ledger and inventory master records central.

### Task 11: Central CIADI identity and document templates
- [x] Audit the actual approved CIADI logo asset and existing central identity/document service; the embedded logoDataUrl is the available approved asset in the codebase.
- [x] Reuse the existing CIADI_INSTITUTIONAL_IDENTITY service as the single brand source; its embedded logoDataUrl is available to PDF templates.
- [ ] Use one shared identity configuration and template engine for every Reception document/export.
- [ ] Wire the shared header helper into every final Reception PDF/export template and verify actual PDF output; the current change establishes and tests the shared document header contract.
- [ ] Cover invoices/receipts (through Finance), cashier summaries, requisitions, delivery records, visitor declarations, correspondence, protocols and operational reports.
- [x] Add a tested renderReceptionDocumentHeader helper that requires the central identity service and embeds logoDataUrl in the returned document header.
- [x] Add a test confirming the document header contains the official embedded logo and fails closed when identity/logo is missing.
- [x] Dashboard header now displays the central CIADI logo; use only the identity service values.
- [ ] Use only verified institutional and fiscal details; do not invent legal name, NIF, address or contacts.


### Task 12: Enriquecimento do Aprovisionamento existente — auditoria 09/11/2026

- [x] Confirmar colunas e constraints reais de `purchase_requests`, `purchase_request_lines`, `warehouses`, `stock_movements`, `stock_balances`, `inventory_counts`, `inventory_count_lines`, `suppliers`, `items`, `assets` e `audit_events`.
- [x] Confirmar que `warehouses.polo` já existe; evitar criar campo duplicado no armazém.
- [x] Confirmar que requisições suportam estados draft/submitted/returned/approved/rejected/received/cancelled, mas não têm quantidade recebida por linha.
- [x] Confirmar que `stock_movements` já é o livro central e contém referência/notas/actor/data; não criar novo livro.
- [x] Confirmar que inventário físico é tratado por `inventory_counts` e `inventory_count_lines`; não reutilizar estas linhas como guias de recepção.
- [x] Rever RLS e políticas: acesso de leitura/escrita de Aprovisionamento está limitado ao acesso de Suporte Informático; decisão financeira exige admin/gestor.
- [x] Rever funções SECURITY DEFINER `decide_purchase_request`, `post_stock_movement` e `transfer_stock`; nenhuma deve ser chamada como atalho para contornar permissões.
- [ ] Criar testes TDD para recepção parcial, quantidades superiores às pedidas, divergências, duplicação/idempotência e actor obrigatório.
- [ ] Preparar proposta SQL aditiva apenas sobre estruturas existentes: requisição, linhas e movimentos; não criar tabelas/livros duplicados.
- [ ] Definir ligação transaccional de movimento de entrada à requisição e linha, usando o armazém existente e a referência do documento de entrega.
- [ ] Rever grants, SECURITY DEFINER, actor, empresa/polo e permissões com a Direcção antes de qualquer escrita da Recepção.
- [ ] Não aplicar DDL, políticas, grants nem dados no Supabase remoto; manter PR #40 Draft.


**Resultado da Task 12 — proposta e contrato inicial**
- [x] TDD red observado: commit `bab2915e2d155849f4dbb655e6d3d3c0e3ea3eb5` falhou nos três testes porque `validatePurchaseReceiptInput` ainda não existia.
- [x] Implementada validação pura de recepção parcial: estado aprovado, quantidades positivas, bloqueio de excesso, armazém, referência de entrega, chave idempotente e actor obrigatório.
- [x] TDD green: run `42611308259`, 165 testes aprovados, 0 falhas.
- [x] TDD red da proposta SQL observado: teste falhou porque o ficheiro aditivo ainda não existia.
- [x] Criada `supabase/proposals/ciadi-ti-purchase-receipt-extension-proposal.sql`; apenas altera, em proposta, estruturas existentes e mantém a função sem EXECUTE para qualquer role.
- [x] Corrigida a expressão de teste para tolerar formatação SQL multiline.
- [x] TDD green final: run `42611771034`, 166 testes aprovados, 0 falhas.
- [x] Validação do Dashboard no commit anterior: run `42611704689`, sucesso.
- [ ] Execução da proposta em PostgreSQL isolado, revisão de segurança, definição de permissões Recepção e homologação ponta a ponta continuam pendentes.
- [ ] Não aplicar ao Supabase remoto; PR #40 permanece Draft.


### Task 13 — Motor PDF real da facturação na Recepção

- [x] Criar contrato TDD para pré-visualização A4 baseada nos dados reais de finance_documentos, finance_documento_linhas, finance_clientes, finance_series e finance_emitente_config.
- [x] Observar RED no CI 42635125161: o teste falhou porque createReceptionInvoicePdfService ainda não existia.
- [x] Implementar compositor A4 com o logótipo oficial obtido do serviço central de identidade CIADI; escapar os dados dinâmicos e apresentar linhas, impostos, totais, emitente e cliente.
- [x] Ligar o renderizador real do CIADI Desktop (documents.renderPdf) e a janela de gravação (documents.exportIssuedPdf); validar assinatura %PDF-, MIME e limite de 10 MiB.
- [x] Disponibilizar pré-visualização para rascunhos e documentos emitidos; exportação local apenas para facturas com document_status = emitido e fiscal_status = emitido.
- [x] Não inventar QR: quando o servidor não fornece uma imagem de autenticação, o documento assinala expressamente a ausência e não afirma ser PDF oficial autenticado.
- [x] TDD GREEN no CI 42635573323: 173 testes aprovados, 0 falhas; CI do PR 42635588700 também passou.
- [ ] Arquivo central do PDF no Storage, hash e metadados documentais ainda exigem contrato/API e permissões do servidor financeiro; não foi escrito qualquer ficheiro no Supabase.
- [ ] QR verificável oficial ainda exige serviço de emissão/validação ligado ao documento financeiro; não reutilizar a função documental de Suporte, que está ausente no schema remoto e não autoriza Recepção.
- [ ] Teste ponta a ponta com Electron Windows instalado e factura real emitida continua pendente; CI valida o contrato e os adaptadores, não substitui o teste visual/operacional.


### Task 14 — Estrutura do aprovisionamento integrado da Recepção

- [x] Separar requisição interna de stock de pedido de compra a fornecedor; não reutilizar purchase_requests para saídas internas.
- [x] Definir os dois modos de saída: requisição interna aprovada ou saída directa com justificação obrigatória.
- [x] Criar validadores de requisição, recepção de mercadorias, saídas, devoluções e transferências; quantidades com até três casas decimais e classificação integral das quantidades recebidas.
- [x] Criar adaptadores para criação/submissão de requisição interna, saída, devolução, transferência, recepção, conferência, finalização e reconciliação de inventário.
- [x] Criar proposta SQL separada para stock_requisitions, stock_requisition_lines, idempotência, saídas, devoluções e transferências.
- [x] Estruturar o painel de consulta com requisições internas, recepções, contagens físicas e razão de movimentos.
- [x] Manter uma única fonte de verdade para saldos: ciadi_ti.stock_movements / stock_balances; não criar razão paralelo.
- [x] CI 42637834745: 182 testes aprovados, 0 falhas.
- [ ] A proposta SQL não foi aplicada; as RPCs novas não existem no Supabase remoto e as permissões permanecem fechadas.
- [ ] Faltam UI transaccional completa para cada formulário e homologação ponta a ponta num ambiente seguro, depois de aplicar e rever as propostas.
- [ ] A fase de permissões deve autorizar explicitamente Recepção por polo e separar Administração (decisão), Recepção (requisição/recepção/saída) e Suporte (gestão técnica), sem alargar permissões financeiras.


### Task 15 — Homologação SQL isolada da Recepção (10/11/2026)

- [x] Criar fixture PostgreSQL 16 descartável com as dependências mínimas de agenda, utentes e especialidades; sem dados reais.
- [x] Criar workflow dedicado que executa apenas no PostgreSQL efémero do GitHub Actions, sem ligação ao Supabase CIADI remoto.
- [x] Testar chegada walk-in, numeração sequencial por polo, check-in de marcação existente, transições válidas/inválidas, visitantes, encaminhamento, aceitação, pesquisa de agenda e painel diário.
- [x] Testar RLS activo e ausência de policies, USAGE e EXECUTE para authenticated antes da fase de permissões.
- [x] RED confirmado no run `42790189352`: PostgreSQL detectou erro de sintaxe no delimitador da função `reception_search_appointments`.
- [x] Correcção SQL aplicada no branch; GREEN confirmado no run `42790400616` — proposta aplicada e testes funcionais aprovados em PostgreSQL 16 isolado.
- [x] CI de código no commit final: run `42790400047` concluído com sucesso; 184 testes aprovados, 0 falhas. Validação do Dashboard: run `42790400386` concluído com sucesso.
- [ ] Não aplicar a proposta no Supabase remoto; a fase de permissões, validação de perfis/polo e homologação com sessões reais continua pendente.
- [ ] A homologação de aprovisionamento da Recepção continua pendente: as chamadas à função central `transfer_stock` e a compatibilidade das escritas com o ledger real precisam de contratos SQL confirmados antes de serem testadas ou ligadas.


### Risco identificado na proposta de aprovisionamento da Recepção

- [ ] A proposta `ciadi-reception-stock-workflows-proposal.sql` insere directamente em `ciadi_ti.stock_movements` nas funções de saída e devolução, em vez de chamar o motor central `post_stock_movement`; rever e alinhar a validação, bloqueios e auditoria antes de qualquer homologação de escrita.
- [ ] A proposta chama `ciadi_ti.transfer_stock` com sete argumentos, mas a assinatura exacta no Supabase remoto ainda não foi confirmada por fonte SQL/tipos fiável. Não adaptar o contrato por suposição.
- [ ] Manter as RPCs de stock sem EXECUTE e não aplicar a proposta até concluir a revisão do ledger e dos contratos reais.
