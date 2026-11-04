# CIADI Workstation Modules Implementation Plan

> **For agentic workers:** Execute task by task. Each task is independently testable.

**Goal:** Replace the current profile-labelled Dashboard launch with four real CIADI workspaces: ADM, Suporte Informático, Recursos Humanos and Recepção.

**Architecture:** Keep the existing Electron application shell and Supabase client. Extract station navigation into a tested service, then build RH and Reception workspaces on verified existing Dashboard routes and database tables. Station profiles select navigation only; Supabase authentication and RLS remain the actual data-permission boundary.

**Tech Stack:** Electron 35, NSIS, vanilla JavaScript, Supabase JS, Node.js built-in test runner, GitHub Actions Windows build.

## Global Constraints

- No Supabase production schema, data, RLS, policy, grant, function, Storage or Edge Function changes in this implementation.
- Do not add a new public.perfis.tipo or imply that an installer selection grants backend permissions.
- Preserve all current Dashboard route IDs and existing data.
- ADM and Suporte Informático are global workspaces for all implemented modules; backend authorization remains authoritative.
- RH and Recepção expose only working functions. No demo-only pages or dead menu entries.
- Use existing HR tables only with verified column names and RLS. Payroll and confidential employee data are currently restricted to admin/gestor.
- No service-role key, database password or privileged secret in the Electron client.
- Staff computers must not require local PostgreSQL, Node.js, Docker or Supabase CLI.
- No official release or merge to main until functional tests and manual Windows installation checks pass.

---

### Task 1: Extract and test station navigation

**Files:** Create renderer/core/station-profile-service.js and ciadi-windows/tests/station-profile-service.test.cjs. Modify index.html and ciadi-windows/tests/setup-profiles.test.cjs.

**Interfaces:** Consume CIADI_MODULE_REGISTRY.listNavigationEntries(). Produce getVisibleEntries(profileId, entries, options), getProfileLabel(profileId), and isKnownProfile(profileId).

- [ ] Add failing tests: ADM and Support expose all currently implemented routes; RH and Reception expose only routes with real handlers; unknown profiles expose none; duplicates are removed; station selection never changes account permissions.
- [ ] Run: cd ciadi-windows && npm run test:architecture. Expected: failure because the service is absent and Support is currently limited to five routes.
- [ ] Implement the pure profile service. Preserve all 25 existing route IDs. ADM and Support receive the full current route catalogue, with Support additionally receiving the support centre route. RH and Reception remain explicit allowlists of real handlers only.
- [ ] Run: cd ciadi-windows && node --test tests/station-profile-service.test.cjs tests/setup-profiles.test.cjs. Expected: all focused tests pass.
- [ ] Run: cd ciadi-windows && npm run test:architecture. Expected: all architecture tests pass.
- [ ] Commit: feat: centralize CIADI workstation navigation.

### Task 2: Implement Recursos Humanos on verified HR tables

**Files:** Create renderer/modules/hr-module.js and ciadi-windows/tests/hr-module-contract.test.cjs. Modify index.html to load and route the module.

**Interfaces:** create({supabase, profile, root, notify, audit}) returns renderHome, renderEmployees, renderAttendance, renderContracts, renderLeave, renderDocuments and renderPayroll.

- [ ] Add failing tests for verified tables: ciadi_funcionarios, ciadi_funcionario_assiduidade, ciadi_funcionario_contratos, ciadi_funcionario_ferias_licencas, ciadi_funcionario_documentos, ciadi_funcionario_confidencial, ciadi_folhas_salariais and ciadi_folha_salarial_linhas. Assert no nonexistent columns are queried, payroll/confidential fields are hidden from non-admin/gestor accounts, and empty data is shown as an empty state.
- [ ] Run: cd ciadi-windows && node --test tests/hr-module-contract.test.cjs. Expected: failure because the HR module entry point is absent.
- [ ] Implement employee directory, attendance, contracts, leave/licences, employee documents and payroll views. Use verified field lists. Enforce admin/gestor checks in UI for payroll/confidential fields while relying on RLS for actual data access. Show errors separately from empty states. Do not invent IRT/INSS calculations; initially show only persisted approved payroll records and clearly indicate calculation is not yet available.
- [ ] Run: cd ciadi-windows && node --test tests/hr-module-contract.test.cjs. Expected: focused tests pass.
- [ ] Run: cd ciadi-windows && npm run test:architecture. Expected: all architecture and HR contract tests pass.
- [ ] Commit: feat: add CIADI human resources workspace.

### Task 3: Implement Recepção workspace on existing handlers

**Files:** Create renderer/modules/reception-module.js and ciadi-windows/tests/reception-module-contract.test.cjs. Modify index.html to load and route it.

**Interfaces:** create({supabase, profile, root, navigate, notify}) returns a workspace landing page linked to existing patient, family, appointment and triage handlers.

- [ ] Add failing tests: Reception exposes only real triage, appointment, patient and family handlers; it does not expose Finance, clinical document management, HR or system administration; unavailable handlers are never rendered as active actions.
- [ ] Run: cd ciadi-windows && node --test tests/reception-module-contract.test.cjs. Expected: failure because the Reception workspace entry point is absent.
- [ ] Implement a Reception landing page that routes to existing handlers and preserves their authorization checks. Do not duplicate clinical data or create another data model.
- [ ] Run: cd ciadi-windows && node --test tests/reception-module-contract.test.cjs. Expected: focused tests pass.
- [ ] Run: cd ciadi-windows && npm run test:architecture. Expected: all architecture, HR and Reception contract tests pass.
- [ ] Commit: feat: add CIADI reception workspace.

### Task 4: Package profile-specific shortcuts and verify Windows installer

**Files:** Modify ciadi-windows/main.cjs, ciadi-windows/build/installer.nsh, ciadi-windows/package.json and .github/workflows/ciadi-setup-homologation.yml. Create ciadi-windows/tests/setup-shortcuts.test.cjs.

**Interfaces:** One NSIS installer offers four profiles and creates four clearly named launch shortcuts, all launching the same complete app with the selected workspace.

- [ ] Add failing tests for four shortcuts, correct profile IDs, packaged renderer files, preservation of user data on uninstall and disabled automatic publishing.
- [ ] Run: cd ciadi-windows && node --test tests/setup-shortcuts.test.cjs. Expected: failure because current NSIS creates one generic Dashboard shortcut.
- [ ] Implement profile-specific shortcuts and persist the selected profile in the installation directory. Keep one application binary and one auth/data path. Keep publishing disabled and include every renderer module.
- [ ] Run: cd ciadi-windows && node --test tests/setup-shortcuts.test.cjs. Expected: all four shortcuts and profile arguments pass.
- [ ] Run: cd ciadi-windows && npm run test:architecture, then run the Windows NSIS workflow. Expected: all tests pass and a new homologation artifact is uploaded; no release or production database change occurs.
- [ ] Commit: feat: create CIADI workstation shortcuts.

## Verified implementation and access findings (4 November 2026)

- The first station-navigation increment is implemented: ADM and Support list all registered Dashboard modules; RH and Reception use explicit workspace routes. Unknown profiles fail closed.
- The HR workspace now has real data views for employees, attendance, contracts, leave/licences, employee documents and payroll headers. It is currently a read/consultation interface; create/edit/approval flows and Angola payroll calculation are not yet implemented.
- The Reception workspace is a landing page linking to existing triage, appointments, patient and family handlers. It does not duplicate patient data.
- The database profile constraint includes admin, gestor, profissional, paciente, responsavel and operador. The Dashboard login gate currently admits only admin, gestor and profissional.
- The current is_staff() function grants staff access to admin, gestor and active A.T. professionals only. It does not include operador, RH or Reception-specific accounts.
- Existing patient and appointment RLS policies rely on is_staff() for staff access. Therefore, merely allowing operador to log in would not make Reception data access work safely.
- Payroll and employee-confidential RLS policies currently restrict those tables to admin/gestor. The HR interface keeps those views gated and does not change production policy.
- The current automated CI run for the workstation modules passed after the HR and Reception workspace additions. The latest Windows installer build is still running and has not yet been verified.

## Open decisions

- Whether RH operators need a new Supabase account type and dedicated RLS policies. Production currently accepts admin, gestor, profissional, paciente, responsavel and operador; payroll/confidential records are restricted to admin/gestor. This plan does not change those controls.
- Whether Angola payroll calculation should be implemented only after confirming the applicable IRT/INSS law, effective dates, exemptions and rounding rules. No tax calculation will be invented.
- Whether the four shortcuts should be installed for all Windows users or only the installing user; verify CIADI workstation practice before choosing.
- Whether the official version remains 1.0.1 or becomes 1.1.0 after module work. No official release is created by this plan.
