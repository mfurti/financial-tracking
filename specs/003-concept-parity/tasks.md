# Tasks: Concept parity corrections

**Inputs**: [Specification](spec.md), [plan](plan.md), [presentation models](data-model.md), [UI contract](contracts/ui.md), [research](research.md), [validation guide](quickstart.md), and [local evidence](validation.md).

**Baseline**: The existing checkout contains a working local correction pass. The three-width comparison and 21 Chromium checks are recorded in validation.md. Open boxes below mean the scoped increment has not been reviewed against its criteria and individually committed and pushed on the feature branch. Reuse and verify local changes; implement only remaining differences. Issue #15 and draft PR #16 track deployment, so keep this correction separate and do not stage the pending production acceptance edit with the new feature.

## Phase 1: Setup

- [x] T001 Record the current workspace, tracked/untracked correction paths, remote feature base and existing synthetic evidence in specs/003-concept-parity/validation.md. Preserve all working changes and isolate the correction diff from the pending specs/002-integrated-deployment/acceptance.md edit and deployment commits. Verify branch ancestry before transferring or staging any product files.

## Phase 2: Foundation

- [x] T002 Reconcile reusable dialog and month-control behavior in apps/web/app/components/FinanceDialog.vue and apps/web/app/components/MonthPicker.vue. Existing callers must keep their behavior. Dialogs retain the active trigger, contain keyboard focus, dismiss with Escape, and leave the underlying route unchanged. Validate shared instructions against specs/003-concept-parity/contracts/ui.md.
- [x] T003 Reconcile the shared tile and responsive rules in apps/web/app/components/FinanceTile.vue, apps/web/app/assets/main.css and apps/web/app/locales/de.ts and apps/web/app/locales/en.ts. Check contrast, unchanged tile geometry on hover, visible keyboard focus, touch targets, locale key parity and reduced motion. Keep normal, empty/error and unknown states legible. Follow docs/coding-guidelines.md, including JSDoc on new functions and callbacks.

## Phase 3: US1 — Overview and shared navigation (P1, MVP)

**Goal**: Make common navigation and the monthly overview match the marked interaction and visual reference.

**Independent check**: On the three reference widths, switch month, confirm at most five recent bookings, open and close both context dialogs, navigate directly to Wealth, and switch themes with and without reduced motion.

- [x] T004 [P] [US1] Reconcile the header account-management dialog, notification placement and direct Wealth navigation in apps/web/app/layouts/default.vue (comments 5, 6, 11, 27, 30). Verify focus return, active tab, discovery of all four account-management destinations and fit of all navigation items at tablet and phone widths.
- [x] T005 [P] [US1] Reconcile the pointer- or keyboard-origin theme reveal in apps/web/app/components/ThemeToggle.vue (comment 4 and FR-07). Verify the reference timing, immediate reduced-motion fallback and preference persistence across immediate navigation.
- [ ] T006 [US1] Reconcile compact Berlin month controls, the separate secondary actions, red expense value and at most five recent bookings in apps/web/app/pages/index.vue (comments 1–3, 19–20). Compare compact row hierarchy with the prototype, retain access to the full list, and preserve exact cents and masked amounts.
- [ ] T007 [US1] Reconcile account-group dialog and scoped refresh/link behavior in apps/web/app/pages/index.vue (comment 28). Verify All Accounts, a populated group and an empty group through selection and reload, link scope and Escape/focus return; disclose any intentionally workspace-wide data.

## Phase 4: US2 — Transactions and accounts (P1)

**Goal**: Make transaction and account pages compact without hiding useful controls or financial uncertainty.

**Independent check**: Switch months, combine primary and advanced filters, page through date groups, open a booking and return to the same scope; filter accounts and inspect an unknown balance on mobile.

- [ ] T008 [US2] Reconcile month switching and visible search/account/category controls in apps/web/app/pages/transactions/[[id]].vue (comments 7, 9, 21). Preserve existing explicit date ranges, filter deep links and CSV access. Exercise month boundaries and restore advanced filters on return.
- [ ] T009 [US2] Reconcile compact date-grouped rows in apps/web/app/pages/transactions/[[id]].vue (comments 8, 22). Check right-aligned signed cents, brief secondary labels, paging, focus, inline category changes and bulk selection; compare row height and scanability at all three widths.
- [ ] T010 [P] [US2] Reconcile account summary and card density in apps/web/app/pages/accounts/[[id]].vue (comments 10, 23 and FR-07). Compare the reduced copy, type filter and card grid against the concept with both populated and empty data. Correct unnecessary copy without substituting zero or simulated holdings for missing observed balances.

## Phase 5: US3 — Analytics and in-place details (P1)

**Goal**: Restore the reference hierarchy and real chart previews while retaining exact, scoped detail access.

**Independent check**: Compare the order and density of sections; activate all six module types, verify focus and scope, inspect genuine/missing chart values and drill into one report without losing the original filter.

- [ ] T011 [P] [US3] Reconcile bar and ring previews in apps/web/app/components/FinanceMiniChart.vue and apps/web/app/components/AnalysisModuleGrid.vue (comments 14, 26). Use existing exact aggregates and bounded drawing ratios, provide an empty state without inventing observations, and hide financial graphics when amounts are masked.
- [ ] T012 [US3] Reconcile monthly review, cashflow, red negative trend, Wealth and Distribution cards, and configurable analyses in apps/web/app/pages/analytics/index.vue (comments 12, 13, 24, 25). Compare the landing hierarchy and trim persistent copy; preserve access to filters, exact tables and useful explanatory text.
- [ ] T013 [US3] Reconcile tile activation in apps/web/app/pages/analytics/index.vue and coverage in tests/e2e/analysis-modules.spec.ts and tests/e2e/recorded-wealth.spec.ts (comment 15). Check same-page dialog open, scoped detail, explicit booking navigation, focus return and zero anchor jumps. Verify configurable tile order and existing wealth privacy.

## Phase 6: US4 — Contracts and More (P2)

**Goal**: Match the contract summary and calendar interaction and the reference grouping of secondary navigation.

**Independent check**: Open and dismiss the forecast calendar, switch between non-monthly and all contracts, inspect the three summary cards and find every More destination.

- [ ] T014 [P] [US4] Reconcile the contract heading, three plan summaries and centered calendar in apps/web/app/pages/contracts/[[id]].vue and apps/web/app/components/ContractCalendarPreview.vue (comments 16, 17, 29). Compare placement and density, verify the twelve-month forecast and both recurrence views. Preserve exact expense plans; keep planned income and remainder explicitly unavailable under the outgoing-only model. Track any request for recurring income separately.
- [ ] T015 [P] [US4] Reconcile My Money and Manage in apps/web/app/pages/more.vue (comments 18, 31). Compare grouping, order and density with the concept across widths; verify destination links and preserve the separation of observed finances from the Scalable demo.

## Phase 7: Polish and handover

- [ ] T016 Regenerate or verify the direct six-screen and four-dialog comparisons in specs/003-concept-parity/validation.md and tests/e2e/concept-parity.spec.ts at 1440×1000, 768×1024 and 390×844 using the matching final HTML and disposable fixtures. Compare dark and light appearance, hover, focus, normal/reduced motion and missing data. Map each browser comment to observed evidence and record remaining density or typography differences for review. Keep screenshots in .local/concept-parity/index.html and out of Git.
- [ ] T017 Reconcile the related browser regressions listed in specs/003-concept-parity/quickstart.md and run applicable checks from package.json and .github/workflows/ci.yml on the assembled feature candidate. Record build, type, lint, formatting and browser results in specs/003-concept-parity/validation.md. A previous working-tree result is evidence, not proof of the published candidate.
- [ ] T018 Prepare feature review from specs/003-concept-parity/validation.md and specs/003-concept-parity/tasks.md, synchronize checked tasks and their commits with the approved issue, and use one feature PR against main. Keep visual acceptance, merge, and deployment separate. Keep the existing deployment acceptance record independent.

## Dependencies and parallel opportunities

- Setup and foundation: T001 → T002 → T003. T001 needs the separately approved linked checkout before staging; preserve the current worktree as the source of the local changes.
- US1: T004 and T005 can proceed independently after T003. T006 follows the shared work; T007 follows T006 because both own index.vue.
- US2: T008 → T009. T010 can run in parallel with the transaction work because it owns accounts only.
- US3: T011 and T012 can proceed independently after T003. T013 follows both and owns the final integration.
- US4: T014 and T015 can run in parallel. T016 waits for all story checks; then T017 → T018.
- Parallel examples: independently review the header and theme toggle; compact the account page while preserving transaction scope; verify contracts and the More page independently. Coordinate any shared CSS/locale edits through T003.

## Implementation strategy

1. **MVP**: T001–T007. Review overview, navigation and dialogs as a runnable increment.
2. Add transactions/accounts, analytics and contracts/More as independently reviewable increments.
3. Complete direct parity verification and publish the reviewable candidate. Use one scoped commit and immediate push per implementation task. Mark completion after successful verification and push; keep unavailable earnings-model work, owner acceptance and production rollout outside this feature’s completion claim.
