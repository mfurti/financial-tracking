---
description: 'Dependency-ordered implementation tasks for the household ledger rebuild'
---

# Tasks: Rebuild the Household Ledger

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [API contract](contracts/api.md), [UI contract](contracts/ui.md), and [quickstart.md](quickstart.md).

**Format**: `Tnnn [P?] [USn?] Action`. A `[P]` task can run in parallel with its named peer once their prerequisites are complete. Story tasks are labeled with the corresponding specification story. Paths are repository-relative. Paths for new tests and the validation record identify their implementation targets.

**Delivery**: For each approved task, keep its changes, documentation and relevant checks in the same increment. Record results and commit per task. Push each successful commit to the approved issue branch and verify it reached the remote before continuing. When a task calls for a test before implementation, establish the expected regression failure first. Keep any committed test-only increment green with existing behavior cases and explicit pending cases until the paired implementation activates those cases and proves the regressions.

## Phase 1: Setup

- [x] T001 Record the target base SHA, status of PRs #16 and #20, exposed routes, supported journeys, preserved docs, and baseline verification in `specs/004-rebuild-household-ledger/validation.md`. Use `docs/user-guide.md`, `docs/api.md`, `docs/recovery.md`, and `.github/workflows/ci.yml`. Record baseline failures separately. If either PR landed, extend the baseline with its shipped behavior and migrations before changing code.
- [x] T002 Pin `@querry-kit/nest@1.1.2` in `apps/api/package.json` and `@querry-kit/nuxt@0.2.10` and `@querry-kit/nuxt-ui@3.3.10` in `apps/web/package.json`. Resolve actual peers and update `pnpm-lock.yaml` with pnpm 11.25.0. Prove frozen install, Prisma generation, typecheck and both app builds on Node 24.22.1. Record resolved versions and smoke results in `specs/004-rebuild-household-ledger/validation.md`.

## Phase 2: Foundational

- [x] T003 [P] Integrate the Querry Kit Nuxt UI module and client in `apps/web/nuxt.config.ts` and `apps/web/app/plugins/querry-kit.ts`. Reuse the transport policy in `apps/web/app/composables/useApi.ts` and `apps/web/server/api/[...path].ts`. Verify same-origin requests, SSR request isolation, safe error handling, response schema validation, session expiry and mutation CSRF against `tests/proxy-access.test.ts` and `tests/auth-boundaries.test.ts`. Can run alongside T004 after T002.
- [x] T004 [P] Rebuild the Workboard-inspired layout in `apps/web/app/layouts/default.vue` and `apps/web/app/assets/main.css`. Update `apps/web/app/locales/de.ts` and `apps/web/app/locales/en.ts` for changed shell labels. Keep all primary and secondary destinations reachable, preserve deep links and existing login behavior, and prove keyboard focus, narrow navigation, theme and first-render masking in `tests/e2e/concept-shell.spec.ts` and `tests/e2e/workspace-locale-privacy.spec.ts`. Can run alongside T003 after T002.

**Checkpoint**: Pinned libraries build in CI's runtime, the client uses the existing transport policy, and the shell exposes existing workflows.

## Phase 3: User Story 1 - Continue Working With an Existing Ledger (P1)

**Independent test**: Restore an anonymized or synthetic pre-rebuild backup in disposable PostgreSQL. Compare exact totals, record IDs and relationships and verify authenticated transaction reads, existing CSV/FinTS data, and unchanged mutation protections.

- [x] T005 [P] [US1] Establish a reproducible pre-rebuild restore and reconciliation baseline using `tests/database.ts`, `tests/previous-app-compat.test.ts`, `apps/api/prisma/schema.prisma`, and `docs/recovery.md`. Capture migration history, counts, IDs, joins and exact totals by account, month and currency. Include accountless rows, linked transfers, contract links, immutable wealth components, import receipts, account observations, access and settings. Store results without financial payloads in `specs/004-rebuild-household-ledger/validation.md`. Can run alongside T006.
- [x] T006 [P] [US1] Prepare transaction API contract and database coverage in `tests/querry-transactions.test.ts` for the new URL and legacy cursor read. Cover pin-specific client serialization, invalid filters and projections, authorization before rows and counts, stable page boundaries, accountless rows, date-only values and exact cents strings. Include more than one page, duplicate booked dates and a page beyond the end. Can run alongside T005.
- [x] T007 [US1] Implement `GET /api/v1/transactions/table` with Nest Querry Kit and a transaction read module in `apps/api/src/modules/transactions/transaction-table.module.ts` and `apps/api/src/modules/transactions/transaction-table.controller.ts`; wire it through `apps/api/src/app.ts`. Define strict query and public row schemas in `packages/contracts/src/index.ts`, publish them via `apps/api/src/api-document.ts`, and document them in `docs/api.md`. Apply server-owned visibility before selection and counting, reject undeclared fields/operators, and implement bounded search, inclusive booked-date range, account scope including accountless entries, category, and existing drill-down flow semantics. Enforce page 1 and 25 rows by default with a 100-row cap, use an ID tie-breaker and return the full `{ items, meta }` envelope. Preserve “stable transaction ID, optional account, source and import provenance” and “signed amount as a decimal string representing integer cents” where applicable to persisted and public data. Pass T006, including unchanged `{ items, nextCursor }` behavior and date and cents normalization. Compare timings and PostgreSQL query plans to the existing read on 10,000 seed transactions.
- [x] T008 [US1] Bring CSV import history, preview, commit, accountless assignment, deduplication and eligible rollback into the new shell in `apps/web/app/pages/imports/index.vue` and `apps/web/app/pages/imports/csv.vue`. Preserve existing import and assignment contracts and “preview/commit, duplicate handling, synchronization authorization and eligible rollback.” Exercise staged rows, duplicate re-import, failed import recovery and assignment reversal in `tests/e2e/accountless.spec.ts`, `tests/e2e/import-experience.spec.ts`, and `tests/import-rollback.test.ts`.
- [x] T009 [US1] Repeat T005 reconciliation through the existing Overview in the rebuilt shell and through the new transaction endpoint. Check current and prior compatible app builds against the unchanged schema and record the comparison in `specs/004-rebuild-household-ledger/validation.md`. Use `tests/previous-app-compat.test.ts`, `tests/migration.test.ts`, `tests/auth-boundaries.test.ts`, and `tests/e2e/ledger.spec.ts`. Require zero unexplained differences and unchanged protection for reads, writes, and stored bank configuration.

**Checkpoint**: Existing records reconcile, the first Querry Kit endpoint reads them, and existing data actions remain reachable.

## Phase 4: User Story 2 - Review Finances and Act From the New Interface (P1)

**Independent test**: With a seeded ledger, open Overview in German and English at 390 px and 1440 px. Pick a period and account scope, follow a card into Transactions, filter and page, then edit a transaction using the keyboard and verify matching results and focus.

- [x] T010 [US2] Deliver the real Transactions screen in `apps/web/app/pages/transactions/[[id]].vue` using Querry Kit client table state, `QTableToolbar` and `QTablePagination`. Keep filter, sort and page state in the URL and the existing details route and validated writes for categorization, rules, and transfers. Verify search, back/forward, stale-response handling, loading/empty/error/retry states, refresh after edit, page recovery, retained draft, and keyboard focus in `tests/e2e/ledger.spec.ts` and `tests/e2e/category-experience.spec.ts`.
- [x] T011 [US2] Rebuild scoped Overview in `apps/web/app/pages/index.vue` using the existing aggregate contracts and a Workboard-style summary and content panels. Show booked income and expenses separately from observed balances, with observation coverage and unknown values explicit. Use the existing date-only and Europe/Berlin period behavior and drill into T010 with identical periods, account selection and flow semantics. Prove matched results, both locales, 390 px and 1440 px layouts, and masking in `tests/e2e/concept-overview.spec.ts` and `tests/e2e/workspace-locale-privacy.spec.ts`.
- [x] T012 [P] [US2] Prepare Accounts table contract tests in `tests/querry-accounts.test.ts`. Cover routing beside the existing detail route, strict projection, correct counts under visibility scope, session denial, legacy reads, and public account summaries without bank configuration. Can run alongside T013.
- [x] T013 [P] [US2] Prepare Contracts table contract tests in `tests/querry-contracts.test.ts`. Cover routing beside detail/calendar/analysis, strict projection, correct dates and direction, denial without counts, stable paging and unchanged legacy reads. Can run alongside T012.
- [x] T014 [US2] Deliver scoped `GET /api/v1/accounts/table` via `apps/api/src/modules/accounts/account-table.module.ts`, `apps/api/src/app.ts`, `packages/contracts/src/index.ts` and `docs/api.md`. Wire the Querry Kit table in `apps/web/app/pages/accounts/[[id]].vue`. Preserve “included versus hidden scope,” distinguish observed balances from booked movement, and keep account details, observation history, groups and bank actions usable through `apps/web/app/pages/settings/account-groups.vue` and `apps/web/app/pages/connections.vue`. Pass T012 and `tests/e2e/concept-accounts.spec.ts`, `tests/e2e/account-groups.spec.ts`, and `tests/e2e/bank.spec.ts`.
- [x] T015 [US2] Deliver scoped `GET /api/v1/contracts/table` via `apps/api/src/modules/contracts/contract-table.module.ts`, `apps/api/src/app.ts`, `packages/contracts/src/index.ts` and `docs/api.md`. Wire the Querry Kit table in `apps/web/app/pages/contracts/[[id]].vue`, retain contract review, payment links and calendar in `apps/web/app/pages/contracts/calendar.vue` and `apps/web/app/pages/contracts/analysis.vue`, and “distinguish estimates and due dates from recorded payments.” Pass T013, `tests/e2e/contracts.spec.ts`, `tests/e2e/contract-calendar.spec.ts`, and `tests/contract-payments.test.ts`.
- [x] T016 [US2] Rebuild Analysis, reserves and recorded wealth in `apps/web/app/pages/analytics/index.vue`, `apps/web/app/pages/analytics/details.vue`, and `apps/web/app/pages/wealth/index.vue`. Preserve scoped aggregates, missing versus zero, reserve retries, immutable wealth capture and synthetic demo isolation. Verify historical observations, period drill-downs, and amount masking, including accessibility output, with `tests/e2e/analytics.spec.ts`, `tests/e2e/reserve-goal.spec.ts`, `tests/e2e/recorded-wealth.spec.ts`, and `tests/e2e/demo-isolation.spec.ts`.
- [x] T017 [US2] Rebuild Settings and supporting screens through `apps/web/app/pages/settings/index.vue`, `apps/web/app/pages/settings/profile.vue`, `apps/web/app/pages/settings/appearance/index.vue`, `apps/web/app/pages/categories.vue` and `apps/web/app/pages/notifications.vue`. Preserve owner/password/preferences contracts, category rules, archived classifications, notification acknowledgement, independent demo roles and original permissions. Run `tests/e2e/workspace-settings.spec.ts`, `tests/e2e/category-experience.spec.ts`, `tests/e2e/notifications.spec.ts`, and `tests/e2e/local-roles.spec.ts` in addition to the applicable locale and appearance cases.

**Checkpoint**: Every primary destination has its rebuilt screen, owned state, and passing journey. Querry Kit is exercised against the real application on both sides.

## Phase 5: User Story 3 - Maintain the Rebuilt App (P2)

**Independent test**: From a clean checkout, follow the active docs and run their checks. Cross-check each removal against its successor or retirement reason. Confirm zero remaining imports, links, runtime registrations, tests, or operational consumers for removed files.

- [x] T018 [US3] Remove replaced components, stale CSS and retired test fixtures only once their last consumers and supported acceptance checks are covered. Inspect `apps/web/app/assets/main.css`, `apps/web/app/layouts/default.vue`, `tests/e2e/concept-surfaces.spec.ts`, and `scripts/capture-concept-reference.mjs`, including Nuxt auto-imports and route discovery. Record each removal, remaining API compatibility and replacement coverage in `specs/004-rebuild-household-ledger/validation.md`. Keep migration, recovery and active deployment assets in place. Pass affected tests and a clean build.
- [x] T019 [US3] Consolidate active guidance in `README.md`, `docs/user-guide.md`, `docs/api.md`, and `docs/coding-guidelines.md`. Preserve current operational and recovery instructions. Update the Vue attribute-order prose to match effective ESLint and keep script/template/style, Prettier whitespace, strict TypeScript, and manual JSDoc review. Retire confirmed obsolete plans such as `docs/plan.md` and `docs/HAUSHALTSBUCH_CODEX_PLAN.md` after moving live criteria and correcting links. Review earlier Spec Kit plans and concept tooling with the same rule. Confirm no dangling references and record decisions in `specs/004-rebuild-household-ledger/validation.md`.

## Phase 6: Polish and Cross-Cutting Verification

- [x] T020 Run `specs/004-rebuild-household-ledger/quickstart.md` from a clean checkout and record each result in `specs/004-rebuild-household-ledger/validation.md`. Include frozen Node 24 install, format/lint/type, Prisma, Vitest, build, Chromium, and Docker operations checks from `.github/workflows/ci.yml`. Re-run reconciliation after cleanup, verify runtime/OpenAPI/client consistency and all primary journeys in both locales, and check JSDoc and effective Vue rules on touched declarations. Separate local results, remote CI, and any pending production-only evidence.

## Dependencies and Execution Order

| Task or group | Wait for                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| T001–T002     | T001 first, then T002                                                                                    |
| T003–T004     | T002, then run both concurrently if useful                                                               |
| T005–T006     | Foundation complete, then run both concurrently if useful                                                |
| T007          | T006                                                                                                     |
| T008–T009     | T007 before T008. T009 waits for T005, T007, and T008.                                                   |
| T010–T011     | T009 before T010. T011 waits for T010.                                                                   |
| T012–T013     | T007 and the Overview-to-Transactions slice (T011)                                                       |
| T014–T015     | T014 waits for T012. T015 waits for T013 and T014 so shared contract/module edits land in order.         |
| T016–T017     | Complete T015, then T016 and T017 in order                                                               |
| T018–T020     | Complete the user-facing slices, then retire code, consolidate docs, and run final verification in order |

### Parallel Examples

- **US1**: T005 captures the baseline restore while T006 prepares transaction contract cases in a separate test file.
- **US2**: T012 and T013 prepare independent Accounts and Contracts contract suites after shared conventions are established.
- **US3**: During T018, read-only source/runtime and document/link inventories can be checked in parallel. Apply and verify deletions and documentation changes in task order because both can affect the same references.

## Implementation Strategy

1. **MVP**: T001–T011 prove existing ledger access, real Querry Kit reads, protected imports, and Overview-to-Transactions with an edit through the new shell. Demo against synthetic or restored anonymized data.
2. **Incremental delivery**: T012–T017 extend the same approach to remaining screens and preserve their domain behavior. Complete scoped account and contract reads before upgrading their consumers.
3. **Cutover readiness**: T018–T020 complete cleanup and prove reconciliation, compatibility and checks. The rebuild requires full story acceptance before merge review.

## Coverage

| Requirement            | Tasks                                 |
| ---------------------- | ------------------------------------- |
| FR-001, FR-007, SC-003 | T003–T004, T010–T011, T014–T017, T020 |
| FR-002–FR-003, SC-001  | T007, T010–T017, T020                 |
| FR-004–FR-006, SC-002  | T003, T005–T009, T014–T017, T020      |
| FR-008, SC-004         | T001–T002, T018–T020                  |
