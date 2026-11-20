# Tasks: Integrated Household Finance Concept

**Input**: `specs/001-integrated-household-concept/` — spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md.
**Generated**: 2026-11-18.
**Authorization**: The user approved task generation, issue #13, its linked branch and planning commit/push, then explicitly authorized speckit-implement for all 48 tasks using the documented project rules as governance baseline. Merge and deployment remain separate decisions.
**Checkout**: Existing `V:/GitHub/financial-tracking`, linked branch `13-implement-integrated-household-finance-concept`, verified starting commit `1f8d113bfa9294707bcd3b6ea6a3a03e8e12ec62`, matching freshly fetched origin/main. This checkout predates the feature workflow; no additional worktree was created.
**Governance**: Existing documented project rules were explicitly accepted for this feature. The constitution remains an unratified template; preserve reviewer-owned checklist markers and record the specific execution decision in plan.md/validation.md. No repeated implementation or governance approval is required within this scope.
**Tracking**: [Feature issue #13](https://github.com/mfurti/financial-tracking/issues/13), related to [stage-1 issue #3](https://github.com/mfurti/financial-tracking/issues/3). GitHub linked branch: `13-implement-integrated-household-finance-concept`. Reconcile R1/I2/I3 and the P1 contract-calendar overlap without duplicating completed work or closing unrelated external gates.

## Format and Execution Rules

Tasks use `- [ ] Tnnn [P?] [USn?] description with exact file paths`. Paths are repository-relative; new filenames are implementation targets, not existing-file claims. If an equivalent existing module is reused, update the path before execution.

- `[P]` means disjoint-file work after the stated prerequisites. It does not authorize spawning agents. Serialize shared contract, registration, migration and fixture edits.
- Each implementation task includes relevant tests, working code and documentation in one validated increment. Write behavioral regression/contract checks before the implementation and observe the relevant failure, then make them pass before completing the task. Never commit a deliberately failing test-only increment.
- After implementation approval, commit each completed implementation task separately and immediately push it before another task. No empty commit for read-only proof; no implementation is performed by generating this list.
- Preserve strict TypeScript/JSDoc, Vue script/template/style and attribute order, Nuxt UI controls, BIGINT cents/decimal-string transport, Berlin dates, session/CSRF and the owner singleton. Use `docs/coding-guidelines.md` and existing executable checks without claiming constitutional ratification.
- Each API slice includes shared Zod input/output, runtime/controller validation, client use, matching OpenAPI in `apps/api/src/api-document.ts`, registration in `apps/api/src/app.ts` where needed, and malformed-input/auth/CSRF checks. This rule supplements each task's primary paths.
- The spec explicitly requires financial, browser, migration, accessibility and visual proof; meaningful checks belong in their owning tasks. Documentation-only changes need no new tests.
- Use `tests/database.ts` with disposable databases only. No production reset/migration, bank/broker action, dependency upgrade, Changesets installation or rollout. Changesets is not configured.
- Create `specs/001-integrated-household-concept/validation.md` during execution for actual evidence; its planned existence is not proof already collected.

## Phase 1: Setup (Existing Project and Reference Baseline)

**Goal**: Reconcile existing work and prepare reproducible references and fixtures.

- [x] T001 Reconcile all 39 views, FR-001–FR-021, SC-001–SC-010 and existing R1/I2/I3/P1 overlap in specs/001-integrated-household-concept/contracts/ui.md and specs/001-integrated-household-concept/validation.md; link docs/todo.md entries without marking them implemented, record baseline failures and the governance prerequisite, and preserve original concept files.
- [x] T002 [P] Create scripts/capture-concept-reference.mjs using installed Playwright to verify the three recorded HTML hashes and capture comparable synthetic reference screens at 390/768/1440 px with theme/locale/zoom and final override selectors; save images under .local/concept-reference/ and a nonsecret index in specs/001-integrated-household-concept/reference-index.md, reporting missing inputs rather than substituting fabricated screenshots.
- [x] T003 [P] Extend playwright.config.ts, scripts/e2e-server.ts and tests/e2e/fixtures.ts for isolated tablet/boundary coverage and synthetic long labels, signed large amounts, partial/gap months, unknown merchants, transfers, accountless imports, missing balances and month-end contracts; preserve existing populated/empty desktop/mobile projects and verify server/database isolation.

**Dependencies**: T001 first; then T002 and T003 independently.

## Phase 2: Foundational (Shared Visual and Preference Infrastructure)

**Goal**: Shared visual primitives before page composition. This phase blocks story UI; do not introduce unrelated domain tables.

- [x] T004 Define theme-aware canvas/card/control/overlay and responsive spacing/radius/motion tokens in apps/web/app/assets/main.css and apps/web/app/app.config.ts using contracts/visual-design.md: 1480 px content bound, desktop/narrow gutters 32/17 px, overview gaps 22/23 px, feature gap 16 px, 22 px tile radius and shadow-free stationary tiles; preserve palette identities and check computed geometry on a representative existing page.
- [x] T005 [P] Add apps/web/app/components/FinanceTile.vue and apps/web/app/components/FinanceDialog.vue around existing Nuxt UI primitives and integrate them into the existing apps/web/app/pages/settings.vue owner-information section, with tile variants, label/value/context hierarchy, semantic single-action surfaces, valid independent controls, loading/empty/error states, focus trap/return and bounded overlay scrolling; prove keyboard/focus and no hover displacement in tests/e2e/visual-primitives.spec.ts without nested interactive elements.
- [x] T006 [P] Add apps/web/app/utils/workspace-preferences.ts and apps/web/app/composables/useWorkspacePreferences.ts and integrate apps/web/app/plugins/appearance.client.ts and apps/web/nuxt.config.ts for versioned “language `de|en`”, “maskAmounts boolean”, “ordered unique analysis module IDs”, chart choice and custom-tone validation slots; preserve haushaltsbuch-palette/haushaltsbuch-theme, mask before values appear, exclude amounts/credentials, and cover old/corrupt/blocked storage in tests/workspace-preferences.test.ts.

**Dependencies**: T004 after setup; T005/T006 independently after T004. Theme bootstrap/configuration belongs to T006 during this phase.

## Phase 3: User Story 1 — Compact Responsive Application (P1, MVP)

**Goal**: Existing-data shell and overview with the five visual refinements.
**Independent Test**: Navigate existing main/detail destinations and return by pointer/keyboard at 360/390/768/1024/1440 px, including 700/701 and 1100/1101 boundaries. Compare overview, tiles, account cards and dialog. Future routes are not advertised as working until their story ships.

- [x] T007 [P] [US1] Recompose apps/web/app/layouts/default.vue, apps/web/app/pages/login.vue and apps/web/app/pages/more.vue with reference navigation, sticky surface hierarchy, selected states, back navigation and mobile access; preserve authentication/logout and add shell, expired-session and navigation checks in tests/e2e/concept-shell.spec.ts.
- [x] T008 [P] [US1] Recompose apps/web/app/pages/index.vue with apps/web/app/components/OverviewColumns.vue using actual-month data: bookings | payments+accounts | categories above 1100 px; bookings+accounts | payments+categories at 701–1100 px; bookings/payments/accounts/categories at <=700 px; retain unknown balances, accountless data and partial-month labels, and add data/composition checks in tests/e2e/concept-overview.spec.ts.
- [x] T009 [US1] Apply tile variants and loading/empty/error/retry behavior to apps/web/app/components/SectionPanel.vue, apps/web/app/components/UpcomingContracts.vue, apps/web/app/components/ExpenseBreakdown.vue, apps/web/app/components/FinanceTile.vue and apps/web/app/pages/index.vue; preserve reference feature/insight/account/stat geometry, wrapping, stable reserved space and truthful missing values, and cover applicable states in tests/e2e/concept-overview.spec.ts.
- [x] T010 [US1] Refine semantic colors/focus in apps/web/app/utils/appearance.ts and apps/web/app/assets/main.css while preserving stored family IDs; extend tests/appearance.test.ts and tests/e2e/appearance.spec.ts for composited normal-text contrast >=4.5:1 and large-text/essential-control/focus contrast >=3:1, decorative-border distinctions, signs and chart keys across supported palettes.
- [x] T011 [US1] Integrate restrained motion in apps/web/app/components/ThemeToggle.vue, apps/web/app/components/FinanceTile.vue and apps/web/app/components/FinanceDialog.vue: reference feedback approximately 180 ms, proposed dialog opacity 160–220 ms, immediate actions/focus, hover only on capable pointers, no row/tile transform or shadow, and no decorative animation/theme reveal/smooth scrolling under reduced motion; prove stable geometry and preference behavior in tests/e2e/concept-motion.spec.ts.
- [x] T012 [US1] Validate independent shell/overview and existing routes through tests/e2e/concept-shell.spec.ts, tests/e2e/concept-overview.spec.ts and tests/e2e/concept-motion.spec.ts; record depth/spacing/contrast/tiles/motion separately in specs/001-integrated-household-concept/validation.md using settled screenshots and interaction recordings, explicitly listing future unavailable destinations.

**Checkpoint**: Useful standalone visual MVP with existing financial pages. Full 39-view completion belongs to final acceptance, not this checkpoint.

## Phase 4: User Story 2 — Trace Monthly Finances (P1)

**Goal**: Exact review, merchant/category details and completed-month modules.
**Independent Test**: Reconcile displayed amounts with bookings containing refunds, transfers, unknown classifications and partial/missing months; verify reload/back scope and stale-response rejection. Account scope works here; group integration belongs to US6.

- [x] T013 [US2] Deliver GET /analytics/merchants and additive /transactions merchantKey in packages/contracts/src/index.ts, apps/api/src/analytics.ts, apps/api/src/merchant-identity.ts, apps/api/src/ledger.ts and apps/api/src/ledger-controller.ts with one exact-trimmed counterparty predicate, opaque validated keys, explicit unknown bucket and “nullable exact trimmed counterparty name”; preserve decimal cents, booked-only transfer exclusion, pagination/36-month limits, and verify reconciliation, malformed keys and access boundaries in tests/merchant-analytics.test.ts.
- [x] T014 [US2] Deliver GET /analytics/review in packages/contracts/src/index.ts, apps/api/src/analytics.ts and apps/api/src/ledger-controller.ts for inclusive Berlin month/account scope, exact income/expense/net, completeness/provenance and contributing queries; preserve existing report defaults and cover leap/year boundaries, accountless data, refunds and transfers in tests/monthly-review.test.ts.
- [x] T015 [US2] Recompose apps/web/app/pages/analytics.vue, apps/web/app/components/MonthlyChart.vue, apps/web/app/components/ExpenseChart.vue, apps/web/app/components/ExpenseBreakdown.vue, apps/web/app/components/FinanceTile.vue, apps/web/app/components/SectionPanel.vue and apps/web/app/assets/main.css for completed 3/6/12-month comparison, eligible averages/trends, missing-month explanations, bar/ring choices and accessible equivalent values; extend tests/e2e/analytics.spec.ts without using chart geometry as money data.
- [x] T016 [US2] Move apps/web/app/pages/analytics.vue to apps/web/app/pages/analytics/index.vue to keep sibling detail routes renderable, add apps/web/app/pages/analytics/details.vue and integrate apps/web/app/pages/transactions/[[id]].vue, apps/web/app/pages/index.vue, apps/web/app/utils/finance-return.ts, packages/contracts/src/index.ts and apps/api/src/analytics.ts for validated merchant/category identity and exact effective period/account/direction; preserve reload/back scope, reject stale results and add unknown-bucket, refund, invalid-filter and failed/retried request proof in tests/e2e/merchant-drilldown.spec.ts.
- [x] T017 [US2] Add apps/web/app/components/AnalysisModuleGrid.vue and apps/web/app/components/AnalysisModulePicker.vue with apps/web/app/utils/analysis-modules.ts, apps/web/app/pages/analytics/index.vue and apps/web/app/assets/main.css using the six declared module IDs and device preferences; show only delivered modules until reserve/history/contracts are integrated, preserve configured order without fake values, and cover selection, reload and chart switching in tests/e2e/analysis-modules.spec.ts.
- [x] T018 [US2] Validate independent review/category/merchant journeys using tests/merchant-analytics.test.ts, tests/monthly-review.test.ts and tests/e2e/merchant-drilldown.spec.ts; record cent reconciliation, effective scope, eligible/excluded months, API/OpenAPI compatibility and module visuals in specs/001-integrated-household-concept/validation.md.

## Phase 5: User Story 3 — Preserve Financial Maintenance (P1)

**Goal**: Reference layouts for existing maintenance and a recurrence-backed calendar.
**Independent Test**: Synthetic CSV upload/mapping/issues/duplicates, assignment, transfer, rollback, contract review/edit/calendar and bank cancellation remain exact and keyboard/touch usable. No live banking credentials.

- [x] T019 [P] [US3] Recompose apps/web/app/pages/accounts/[[id]].vue and add apps/web/app/pages/accounts/add.vue with apps/web/app/assets/main.css and apps/web/app/composables/useFormFeedback.ts using existing account/connection services, compact variants and observed-balance provenance; preserve creation/edit/detail and unknown-versus-zero semantics, with form/navigation/empty-account checks in tests/e2e/concept-accounts.spec.ts.
- [x] T020 [P] [US3] Refine apps/web/app/pages/imports/csv.vue, apps/web/app/utils/csv-file.ts and apps/api/src/csv.ts for obvious keyboard/touch upload and valid explicit text mapping; retain useful booking text when purpose is empty without invented content or silently discarded rows, and cover mixed-text/both-empty/manual-mapping/reimport in tests/csv.test.ts and tests/e2e/import-experience.spec.ts.
- [x] T021 [US3] Recompose apps/web/app/pages/imports/index.vue and apps/web/app/components/ImportRollback.vue for compact grouped issues/duplicate comparisons, expandable rows, drafts, explicit partial-import decisions and confirmed rollback impact; extend tests/import-rollback.test.ts and tests/e2e/import-experience.spec.ts without silently adding separate I1 deep-history scope.
- [x] T022 [US3] Apply reference state/layout rules to apps/web/app/components/AccountAssignment.vue, apps/web/app/components/ClassificationEditor.vue, apps/web/app/components/CategoryRules.vue, apps/web/app/pages/categories.vue and apps/web/app/pages/transactions/[[id]].vue; preserve annotation conflicts, idempotent assignment and opposing transfer legs, and extend tests/e2e/ledger.spec.ts and tests/e2e/category-experience.spec.ts for keyboard/failure/reconciliation.
- [x] T023 [US3] Recompose apps/web/app/pages/contracts/[[id]].vue, apps/web/app/pages/contracts/analysis.vue, apps/web/app/components/ContractForm.vue and apps/web/app/components/ContractReview.vue for reference list/detail/edit/suggestion/payment views, retaining versioned history and planned/actual distinction; cover next-due ordering, failed saves and drafts in tests/e2e/contracts.spec.ts.
- [x] T024 [US3] Deliver GET /contracts/calendar and apps/web/app/pages/contracts/calendar.vue through packages/contracts/src/index.ts, apps/api/src/contracts.ts and apps/api/src/contracts-controller.ts, reusing apps/api/src/contract-schedule.ts for bounded events and exact due-month totals; verify inclusive dates, month-end anchors, leap dates, future revisions and actual-payment distinctions in tests/contract-calendar.test.ts and tests/e2e/contract-calendar.spec.ts without generating ledger rows.
- [x] T025 [US3] Recompose apps/web/app/pages/connections.vue around its existing authorization state machine; validate maintenance with tests/e2e/bank.spec.ts, tests/e2e/import-experience.spec.ts, tests/e2e/contracts.spec.ts and tests/e2e/accountless.spec.ts, and record synthetic TAN/poll/cancel/expiry, focus/responsive and preserved history evidence in specs/001-integrated-household-concept/validation.md.

## Phase 6: User Story 4 — Reserve and Recorded Wealth (P2)

**Goal**: Persist reserve configuration and immutable source-attributed wealth.
**Independent Test**: Save/reload target and eligibility, distinguish missing/stale/negative observations, record and retry a snapshot, then change imported balances without changing recorded history.

- [x] T026 [US4] Add AccountPresentation, ReserveGoal, WealthRecord and WealthRecordComponent in apps/api/prisma/schema.prisma and apps/api/prisma/migrations/202611180001_reserve_wealth/migration.sql with packages/contracts/src/index.ts, quoting model constraints: “accountId UUID primary key, reserveEligible boolean default false”; “fixed singleton key, targetCents positive BigInt, updatedAt”; “Default 300000 cents”; “id UUID, recordedAt timestamp, totalCents signed BigInt, coverage COMPLETE/PARTIAL, idempotencyKey unique bounded string”; “id UUID, recordId UUID, nullable accountId UUID, sourceLabel, amountCents nullable BigInt, observedAt nullable timestamp, sourceType”; concretize new idempotencyKey/sourceLabel/sourceType limits as 128/120/64 characters, preserve SetNull account links and immutable components, and validate populated-data preservation/constraints in tests/wealth-migration.test.ts before completing this working schema increment.
- [x] T027 [US4] Deliver PATCH /accounts/:id/presentation and GET/PUT /reserve-goal in apps/api/src/reserves.ts and apps/api/src/workspace-controller.ts with apps/web/app/components/ReserveGoalTile.vue and apps/web/app/pages/accounts/[[id]].vue; enforce “Account currency must be EUR to contribute”, explicit Tagesgeld eligibility, positive target and no stored derived balance, disclose signed values/dates/missing coverage, and cover reload/invalid/access cases in tests/reserves.test.ts and tests/e2e/reserve-goal.spec.ts.
- [x] T028 [US4] Deliver paginated GET/POST /wealth-records in apps/api/src/wealth.ts and apps/api/src/workspace-controller.ts with apps/web/app/pages/wealth/index.vue and apps/web/app/components/RecordedWealth.vue; preview provenance then capture server-derived components in one consistent transaction, replay idempotency keys without duplicate records, reject client real amounts and preserve “Missing amount means unknown, never zero”, testing immutable history in tests/wealth.test.ts and tests/e2e/recorded-wealth.spec.ts.
- [x] T029 [US4] Integrate reserve/history modules into apps/web/app/pages/analytics/index.vue and apps/web/app/components/AnalysisModuleGrid.vue; validate deleted-account, missing/stale/negative source, duplicate capture, pagination and reload behavior in tests/e2e/recorded-wealth.spec.ts and record migration/balance/provenance/visual evidence in specs/001-integrated-household-concept/validation.md.

## Phase 7: User Story 5 — Isolated Investment Simulation (P2)

**Goal**: Synthetic portfolio, securities, orders, plans, transfers, scenarios, history and reset.
**Independent Test**: Valid/invalid trades and transfers, duplicate plan period, scenario, reload, corrupt/blocked/stale storage and reset; real financial rows and bank request counts remain unchanged.

- [x] T030 [US5] Create apps/web/app/utils/demo-state.ts and apps/web/app/utils/demo-finance.ts with “schemaVersion, revision, seed identity”, synthetic cash/securities/positions/orders/plans/activity/history/local roles and pure validated transitions; enforce “whole integers 1–1000 per order”, “integer-cent strings; calculate with BigInt”, “integer basis points -3000 through +3000”, deterministic rounding, rejection without partial cash/holdings/identical-account mutation and “append only when aggregate value changes; cap at 48”; test all invariants in tests/demo-finance.test.ts without useApi or real IDs.
- [x] T031 [US5] Add apps/web/app/composables/useDemoPortfolio.ts and apps/web/app/utils/demo-storage.ts with dedicated-key parsing/validation/migration, visible in-memory fallback, confirmed corrupt-state reset and stale-revision handling; document the locking/commit strategy preventing silent cross-tab overwrite and cover corrupt/blocked/replayed/conflicting writes in tests/demo-storage.test.ts.
- [x] T032 [US5] Build apps/web/app/components/DemoPortfolio.vue, apps/web/app/components/DemoOrderForm.vue and apps/web/app/pages/wealth/demo/securities/[id].vue for validated catalog, exact synthetic prices, positions/cash, allocations and scenarios; compose into apps/web/app/pages/wealth/index.vue with persistent simulation labels separate from real observations, and cover keyboard/buy/sell/rejection in tests/e2e/demo-orders.spec.ts.
- [x] T033 [US5] Add apps/web/app/pages/wealth/demo/plans.vue, apps/web/app/pages/wealth/demo/activity.vue and apps/web/app/components/DemoAccountActions.vue for synthetic account/category creation, cash transfers and plan CRUD/explicit execution; enforce “positive cent amount, supported synthetic security and valid execution day” and “A plan execution key prevents duplicate execution of the same plan period”, covering cancellation/reload/double execution in tests/e2e/demo-plans.spec.ts.
- [x] T034 [US5] Add apps/web/app/components/DemoHistory.vue and apps/web/app/components/DemoResetDialog.vue for maximum-48 changed-value snapshots, recorded-simulation wording and confirmed/cancelled reset of only dedicated demo state; preserve real settings/data and verify focus/cancel/seed restoration in tests/e2e/demo-orders.spec.ts.
- [x] T035 [US5] Prove isolation in tests/demo-isolation.test.ts and tests/e2e/demo-isolation.spec.ts by comparing disposable real records and intercepting real API/bank requests around every demo mutation/reset, including storage races/errors; record zero financial mutations/remote actions and visual evidence in specs/001-integrated-household-concept/validation.md.

## Phase 8: User Story 6 — Personal Workspace Settings (P2)

**Goal**: Durable owner/groups/notifications, device customization, bilingual/privacy coverage and local roles.
**Independent Test**: Save/reload owner/groups, filter overlapping/empty groups, acknowledge notifications, customize themes/modules/locale/privacy, change password and edit local roles without gaining real permissions.

- [x] T036 [US6] Add OwnerProfile, AccountGroup, AccountGroupMember and NotificationAcknowledgement in apps/api/prisma/schema.prisma and apps/api/prisma/migrations/202611180002_workspace_settings/migration.sql with packages/contracts/src/index.ts: “userId UUID primary key, displayName 1–80 trimmed characters, optional validated contactEmail <=254 characters, updatedAt”; “id UUID, name 1–60 trimmed characters, sortOrder nonnegative integer, timestamps”; “groupId UUID, accountId UUID” and “Composite unique key”; “userId UUID, sourceKey bounded string, acknowledgedAt timestamp” with sourceKey limited to 256 characters; preserve owner singleton and membership-only cascade, validating old-row preservation and keys in tests/workspace-migration.test.ts.
- [x] T037 [US6] Deliver GET/PATCH /workspace/profile in apps/api/src/workspace.ts and apps/api/src/workspace-controller.ts with apps/web/app/pages/settings/profile.vue, moving apps/web/app/pages/settings.vue to apps/web/app/pages/settings/index.vue so sibling settings routes render; use exact profile constraints/current owner; contact email is display/contact only, never a username/recovery change; cover validation, auth/CSRF, reload and failed-save drafts in tests/workspace-profile.test.ts and tests/e2e/workspace-profile.spec.ts.
- [x] T038 [US6] Deliver group CRUD in apps/api/src/account-groups.ts and apps/api/src/workspace-controller.ts with apps/web/app/pages/settings/account-groups.vue and apps/api/src/account-scope.ts; enforce “Reject duplicate names ignoring case in the service”, unique atomic memberships, “Aggregate selected account IDs as a set” and delete without account loss; extend packages/contracts/src/index.ts, apps/api/src/analytics.ts, apps/api/src/ledger.ts, apps/api/src/contracts.ts and clients for mutually exclusive accountId/groupId and empty-group-no-matches, verifying report/detail/calendar reconciliation in tests/account-groups.test.ts and tests/e2e/account-groups.spec.ts.
- [x] T039 [US6] Deliver paginated GET /notifications and idempotent PUT /notifications/acknowledgement in apps/api/src/notifications.ts and apps/api/src/workspace-controller.ts with apps/web/app/pages/notifications.vue and links in apps/web/app/layouts/default.vue; validate keys from “event kind + source identity + revision/due date”, derive only import issues/upcoming obligations, leave financial sources unchanged, and cover revision/deleted-source/access/pagination in tests/notifications.test.ts and tests/e2e/notifications.spec.ts without email/push infrastructure.
- [x] T040 [US6] Recompose apps/web/app/pages/settings/index.vue and add apps/web/app/pages/settings/password.vue and apps/web/app/pages/settings/appearance/index.vue, linking delivered destinations and reusing /auth/password and AppearanceSettings.vue; preserve session revocation and palette/brightness behavior, expose truthful analysis/privacy/in-app notification scope, and cover the journeys in tests/e2e/appearance.spec.ts and tests/e2e/workspace-settings.spec.ts.
- [x] T041 [US6] Add apps/web/app/pages/settings/appearance/custom.vue and extend apps/web/app/components/AppearanceSettings.vue, apps/web/app/utils/appearance.ts and apps/web/app/utils/workspace-preferences.ts for validated paired custom tones with “4.5:1 normal text and 3:1 large text/control contrast against applicable backgrounds”; reject invalid replacement of a working theme, preserve early bootstrap/migration, and cover custom colors/storage/focus in tests/appearance.test.ts and tests/e2e/custom-appearance.spec.ts.
- [x] T042 [US6] Complete apps/web/app/locales/de.ts, apps/web/app/locales/en.ts, apps/web/app/composables/useWorkspaceLocale.ts and apps/web/app/utils/financial-display.ts; apply validated locale/date/currency formatting and early privacy across every delivered page/dialog/chart/tooltip/accessible name without float money, stored real amounts or hydration flashes, and verify dictionary parity/large signed values/masking in tests/e2e/workspace-locale-privacy.spec.ts.
- [x] T043 [US6] Add apps/web/app/pages/settings/users.vue as a labeled local roles demonstration using synthetic state, with editable display entries/reset and no User/session/permission mutation or real invitations; prove edits never change authenticated access in tests/e2e/local-roles.spec.ts.
- [x] T044 [US6] Validate profile/groups/notifications/custom themes/modules/password/local roles together in tests/e2e/workspace-settings.spec.ts and tests/e2e/workspace-locale-privacy.spec.ts, including inactive/deleted members, stale notification links and blocked storage; document persistence scope and unchanged singleton access in specs/001-integrated-household-concept/validation.md.

## Phase 9: Polish and Cross-Cutting Acceptance

**Goal**: Close all mapped views and cross-boundary acceptance without new product scope.

- [ ] T045 Audit all 39 views and five visual dimensions against specs/001-integrated-household-concept/contracts/ui.md, specs/001-integrated-household-concept/contracts/visual-design.md and tests/e2e/concept-coverage.spec.ts; capture comparable settled screenshots and normal/reduced-motion recordings at 390/768/1440 px plus 360/breakpoint pairs, inspect long DE/EN text, large amounts and tile states, and record corrected or explicitly accepted differences in specs/001-integrated-household-concept/validation.md.
- [ ] T046 Verify shared Zod/runtime/OpenAPI/client/access consistency and populated migration/previous-app compatibility in tests/contracts.test.ts, tests/auth-boundaries.test.ts, tests/wealth-migration.test.ts and tests/workspace-migration.test.ts; review exact totals/provenance/additive SQL and update docs/api.md and docs/feature-migrations.md with actual endpoints/limits/rollback constraints, without destructive down migrations or production execution.
- [ ] T047 Run Prisma validation, format:check, lint, typecheck, test, build and test:e2e from specs/001-integrated-household-concept/quickstart.md, then verify exact-candidate Linux operations/restore CI from .github/workflows/ci.yml after authorized publication; record actual head/results/pre-existing failures/unavailable proof in specs/001-integrated-household-concept/validation.md, fix scoped regressions in separate validated task commits and never count pending CI as passed.
- [ ] T048 Update docs/user-guide.md, docs/appearance.md, docs/status.md, docs/todo.md and specs/001-integrated-household-concept/quickstart.md for verified behavior and remaining external gates; reconcile approved tracking/commit evidence, prepare one feature PR from final scope/validation and retain separate merge/deployment decisions under coding-workflow.

## Dependencies and Execution Order

Default task-ID order is sequential. Within each implementation task, checks precede the behavior change; models precede services/endpoints/client integration; passing checks precede the task's own commit and immediate push. A failing intermediate development state is never a finished task commit. Synchronize the approved issue checklist and evidence after every successful task push, not only at T048.

```text
Setup: T001; then T002 and T003 independently
Foundation: T004; then T005 and T006 independently
US1: T007 and T008 independently; then T009–T012
US2: T013–T018
US3: T019 and T020 independently; then T021–T025
US4: T026–T029
US5: T030–T035
US6: T036–T044
Final acceptance: T045–T048
```

### Story Dependencies

| Story | Prerequisites                                                  | Independent completion boundary                                          |
| ----- | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| US1   | Setup + foundation                                             | Existing-data shell/overview; future routes not promised.                |
| US2   | US1 visual composition                                         | Exact account-scoped reports/detail; groups integrated later by US6.     |
| US3   | US1; default order finishes US2 first                          | Established maintenance and calendar using account scope.                |
| US4   | US1 + T019 account UI                                          | Reserve/immutable recorded wealth; migration precedes US6 migration.     |
| US5   | Foundation; final composition waits for T028 /wealth container | Pure demo engine/store can develop separately without groups/profile.    |
| US6   | US2–US5 for full module/group/settings integration             | Personal settings and cross-report group scope with real/demo isolation. |
| Final | All six stories                                                | All 39 views and final visual/financial/API/migration proof.             |

Do not run all stories concurrently: shared contracts, API registration/controllers, Prisma migrations, appearance files, analytics.vue and browser fixtures require serialized ownership/integration.

### Parallel Examples per Story

Optional independent work is described below; this is not permission for agent spawning or simultaneous commits in the same checkout.

- **US1**: T007 shell and T008 overview use separate implementation/test files after foundation; finish both before T009.
- **US2**: No whole-task parallel marker because report slices share schemas/services. Within T013, draft tests/merchant-analytics.test.ts cases while reviewing contract merchant-key examples in contracts/api.md; integrate both with working code before the task commit.
- **US3**: T019 accounts and T020 CSV mapping are disjoint after US1; serialize later shared fixture and integration edits.
- **US4**: No parallel whole tasks; migration precedes services. Within T028, review immutable-source scenarios from data-model.md independently of editing tests/wealth.test.ts; commit the integrated working slice.
- **US5**: After T030, storage-recovery scenario preparation for T031 and UI/reference preparation for T032 can proceed independently; actual UI waits for the store. Pure demo-engine work may overlap unrelated ledger work only with disjoint files and serialized commits.
- **US6**: No whole-task parallel marker because workspace/schema/preferences collide. Within T042, populate locales/de.ts and locales/en.ts independently after freezing shared keys, then require parity before the task commit.

## Requirement Coverage

| Requirements                                 | Primary tasks                                       |
| -------------------------------------------- | --------------------------------------------------- |
| FR-001, SC-001                               | T001, T007, T019–T025, T028, T032–T034, T037–T045   |
| FR-002, FR-017–FR-021, SC-002, SC-007–SC-010 | T002–T012, each story's visual tasks, T045          |
| FR-003, SC-006                               | T007–T008, T019–T025, T040, T047                    |
| FR-004–FR-005, SC-003                        | T013–T018, T024, T027–T029, T038, T046              |
| FR-006                                       | T023–T024                                           |
| FR-007–FR-008                                | T026–T029                                           |
| FR-009–FR-010, FR-016, SC-005                | T030–T035, T043, T046                               |
| FR-011–FR-013, SC-004                        | T006, T017, T027–T034, T036–T044                    |
| FR-014–FR-015                                | T005–T012 and every story's failure/keyboard checks |

## Contract and Entity Ownership

- Merchant/review/detail: T013–T018; calendar: T024; group-aware report/detail/calendar integration: T038.
- AccountPresentation/ReserveGoal/WealthRecord/WealthRecordComponent constraints: T026–T029.
- OwnerProfile/AccountGroup/AccountGroupMember/NotificationAcknowledgement constraints: T036–T039.
- Device preferences: T006, T017, T040–T042. Demo state/storage/history: T030–T035; local roles: T043.
- Newly concretized string limits: idempotencyKey 128, sourceLabel 120, sourceType 64, sourceKey 256 characters. Synchronize data-model.md/contracts/api.md; do not apply these limits to existing imported fields.
- API contract, database preservation and Vue acceptance checks belong in affected tasks and again at T045–T047; no unrelated dependency/release audits.

## Implementation Strategy

1. Issue #13, linked branch and planning commit 0ae88ae are published. Governance baseline and implementation are explicitly approved. Execute from the first unfinished task; merge/deployment remain separate.
2. Deliver **MVP = setup + foundation + US1, T001–T012**. Validate existing journeys and all five visual dimensions before extending features. No production deployment is implied.
3. Deliver US2 and US3 as P1 increments, then US4/US5/US6 as P2 increments, preserving completed task commits.
4. Complete final proof and use one feature issue/branch/PR chosen through the workflow. Record unavailable checks as gaps.
5. Mark an implementation task complete only after relevant checks, its own commit and immediate successful push; a failed push/check leaves it incomplete. Read-only verification needs recorded evidence, not an empty commit.

## Generated Summary

- **48 tasks** generated; current execution status is recorded in the checklist above.
- Setup **3**, foundation **3**, US1 **6**, US2 **6**, US3 **7**, US4 **4**, US5 **6**, US6 **9**, final **4**.
- **8 [P] tasks in four disjoint pairs**: T002/T003, T005/T006, T007/T008, T019/T020, subject to stated prerequisites.
- Suggested MVP: **12 tasks**, T001–T012, under the recorded governance/tracking/implementation approvals.
- Planning artifacts do not constitute completed implementation tasks.
