# Current tasks

Updated 2026-11-20. [Status/evidence](status.md), [integrated issue #13](https://github.com/mfurti/financial-tracking/issues/13), related [issue #3](https://github.com/mfurti/financial-tracking/issues/3). Production remains the last verified d193639 delivery from PR #11. An open item is not automatic implementation or deployment approval.

## Integrated delivery and external gates

The approved 39-view concept and its ordered source tasks are recorded in [the feature tasks](../specs/001-integrated-household-concept/tasks.md). All local gates passed: 225 tests, 428 browser passes plus 12 intentional skips, full types/lint/format/Prisma and production builds. [Validation](../specs/001-integrated-household-concept/validation.md) distinguishes local proof from Linux CI and production.

- [ ] **E7 — Exact-head Linux CI and restore acceptance.** GitHub currently refuses to start verify/operations because of account payments/spending limit. Resolve that account prerequisite and obtain actual successful checks for the review head. Existing static operation tests and historical green CI do not replace runtime container/restore proof. No billing changes were performed.
- [ ] **E8 — Feature review, merge and deployment decisions.** Review the one feature PR, retain required checks/reviews and obtain separate merge approval. Deployment additionally needs its own writer pause, verified backup, matching image/migration sequence and post-deployment checks. No production migration or rollout has occurred for this feature.

## R — UI delivery and retained detail backlog

The approved integrated concept supersedes the earlier R1 layout proposal, using its documented 700/1100 px composition boundaries and nine-width acceptance instead of silently claiming old prototype pixel rules. Original browser comments remain in the [usability plan](vertragsanalyse-usability-plan.md#nutzerfeedback-app-charakter-und-import--8-november-2026). Human acceptance stays E6.

- [x] **K1 — Preparatory code cleanup.** The prior cleanup removed unused CSS/proposal code and consolidated existing metadata with before/after proof. See [code audit](code-audit.md); it is distinct from the later integrated source delivery.
- [x] **R1 — Compact integrated application UI.** Delivered responsive composition, shared sections/tiles/dialogs, compact search/filters and month navigation, contextual help, focused settings and stable light/dark/reduced-motion behavior through issue #13. Actual five-dimension visual evidence and accepted adaptations are in the feature validation. This is technical source delivery, not user acceptance or deployment.
- [ ] **R2 — Field-level feedback for all legacy forms.** Future contract revisions and manual payment assignment still need consistently named fields/shared validation/field feedback for invalid amounts/dates and server conflicts, preserving drafts, focusing the relevant field and retaining financial values. Other delivered forms do not close this entire older requirement.
- [ ] **R3 — Rich proposal payment evidence.** Replace indistinguishable booking links with compact date/amount/counterparty-or-text evidence while retaining linked detail, active-card state, dirty decisions and navigation-only swipes. Existing proposal decisions/carousel are delivered; per-payment previews remain open.

Use existing Nuxt UI/shared Zod/exact cents and preserve history. Future increments retain scoped checks and their own approval/commit boundaries.

## I — Import boundaries

- [ ] **I1 — Historical import paging.** History still lists the latest 100 runs without a pager. Plan bounded access to older runs, their issues and eligible rollback. Acceptance: find a run beyond 100, inspect its issues and rollback preview. A retained deep link or current notification is not a complete historical browser.
- [x] **I2 — Obvious file selection.** Delivered visible native-selectable upload area, drag/drop alternative, keyboard/mobile selection and cancellation/valid retry while retaining automatic processing and duplicate/abandonment guards.
- [x] **I3 — Empty purpose/alternative booking text.** Delivered explicit mapped-text fallback, grouped diagnostics and consent for truly empty rows; mixed-column, all-empty, manual-mapping and repeated-import cases pass. The originally reported six real rows have not been inspected, so original-file acceptance remains E5.

## P/A — Delivered planning and group scope

- [x] **P1 — Due-month planned total.** The calendar sums actual scheduled due amounts separately from monthly averages: annual EUR 120 contributes EUR 120 in its due month, not EUR 10. Month ends/leap years/effective revisions/inclusive end and exact group-scoped events are tested. No bank transaction is created.
- [x] **A1 — Several accounts in one scope.** Saved account groups provide deduplicated multi-account ledger/report/detail/calendar scopes, including inactive historical members. Empty groups stay empty; deleted groups fail instead of widening scope. Accountless scope remains explicitly separate. This delivers named groups, not an unreviewed arbitrary filter model.

## B — Separate unapproved budget scope

Budget work still requires joint Stage 1 acceptance and explicit budget approval. The later contract/calendar approval did not create a budget prerequisite for contract corrections or approve budgets.

- [ ] **B1 — Model/API.** Per-category monthly budget, unique database identity, exact cents, shared Zod/OpenAPI and CRUD.
- [ ] **B2 — Explicit previous-month copy.** No silent carry-forward/overwrite; resolve target conflicts visibly.
- [ ] **B3 — Consumption/refunds.** Booked non-transfer expenses including accountless rows; consumption is max(0, expenses minus explicitly attributed refunds). Ordinary income is not automatically a refund. Exact remaining/overspend.
- [ ] **B4 — UI/recalculation.** Month, budget/consumption/remaining/overspend, both modes, field/empty states and recalculation after classification/category changes.
- [ ] **B5 — Verification/acceptance.** Populated migration, cent/month/year limits, copy conflicts, excess refunds and transaction states; keep technical delivery separate from user acceptance.

## C — Older optional import details

These are not automatically authorized corrections to the integrated feature.

- [ ] **C1 — Separate debit/credit columns.** Plan explicit signs/empty/conflict rules, manual mapping and repeat-import acceptance. Current import uses one signed amount column.
- [ ] **C2 — Explicit CSV source balance.** Only with unambiguous account/type/observation date mapping. Current CSV mapping has no balance column; never derive bank balance from transaction sums.
- [ ] **C3 — Configurable limits.** Current fixed limits are 10 MiB/50,000 rows. Any configurable bounded replacement needs scope agreement and consistent browser/contracts/API limits before processing.

## E — Other external prerequisites and acceptance

- [ ] **E1 — Own FinTS registration/official endpoint.** Obtain your own product ID and bank-confirmed endpoint/access/TAN capabilities; [registration guide](fints-registration.md). No borrowed ID or credentials in chat/repository.
- [ ] **E2 — Supervised live bank test.** After E1 and separate approval, verify account detection, balances/history, TAN/media/app approval, cancellation and idempotent repeat import. Synthetic tests do not establish compatibility.
- [ ] **E3 — Least-privilege registry access.** Inspect/restrict the protected server account to read-only package access. A successful pull does not prove minimum privilege.
- [ ] **E4 — Host reboot acceptance.** Only in a separately approved maintenance window, verifying data, startup, HTTPS and backup health. Container restart/CI does not prove shared-host reboot behavior.
- [ ] **E5 — Original CSV/everyday workflow.** Jointly review the actual export, rollback/reupload, categories, proposals and reports. Keep private financial data out of public evidence.
- [ ] **E6 — Joint product/Stage 1 acceptance.** Review compactness, text, exact figures, exceptions, accessibility and operational/bank boundaries. Technical checks are not full user acceptance; budgets need additional explicit approval.

## Documentation and historical delivery

- [x] **D1 — Current status reconciliation.** The earlier audit retained stable IDs and archived previous requirements. This integrated follow-up now distinguishes source delivery, unexecuted Linux acceptance and unchanged production. Historical materials remain in [the archive](archive/todo-2026-11-08-before-audit.md).

Previously delivered: CSV automation/encodings/short years/accountless assignment/deduplication/rollback; categories/rules/classifications; contracts/payment links/history/forecasts; actual multi-month analytics; theme controls/navigation; image-only deployment, .33, health checks, daily encrypted seven-day backups and the separately approved d193639 rollout. The new integrated source extends those features without claiming a newer production deployment.

Only tick implementation after scoped validation and publication; record user/operational acceptance independently. No server repository, unauthorized bank access/reboot, merge or deployment is implied by this task list.
