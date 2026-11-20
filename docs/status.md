# Project status

Updated 2026-11-20. This page and [todo.md](todo.md) are the current status source. Historical plans/checklists retain their dated meaning. Integrated source delivery: [issue #13](https://github.com/mfurti/financial-tracking/issues/13), related to [issue #3](https://github.com/mfurti/financial-tracking/issues/3).

## Integrated source delivery

The approved 39-view concept is implemented on branch 13-implement-integrated-household-finance-concept. It includes responsive overview/analysis composition, shared stationary tiles/dialogs, refined depth/spacing/contrast/motion, exact merchant/monthly drill-downs, maintenance/import improvements, contract calendar, explicit reserve sources, immutable wealth capture, isolated synthetic investments/roles and focused settings.

Server metadata covers profile, account groups and source-bound in-app read receipts. Device preferences cover DE/EN, masking, modules/chart style and paired custom appearance. Existing singleton sessions/CSRF remain authoritative. Demo state never grants access or writes real finances. The constitution remains an unratified template; the user explicitly approved documented project rules as governance for this feature.

All local gates passed: Prisma generation/validation, repository formatting/lint, full types, 225 unit/integration tests in 42 files, production API/web builds, and the complete 440-case browser selection. Browser results are 428 passes, 12 intentional extra-recording/theme skips outside reference widths, zero failures and zero flaky cases across 24 isolated batches. All 39 view identities were checked in DE/EN across 360/390/700/701/768/1024/1100/1101/1440 px. Source fingerprints, geometry, five visual dimensions and six normal/reduced-motion recordings are documented in [feature validation](../specs/001-integrated-household-concept/validation.md).

Both additive migrations preserve all old fields in populated disposable fixtures. The actual pre-feature application, its contracts and historical generated Prisma client were rebuilt and exercised on the expanded schema. Exact financial values, credentials and new metadata remained intact. See [migration evidence](feature-migrations.md); this is not proof of production lock timing or deployed-image compatibility.

## Repository visibility and current review gate

The user explicitly requested public visibility on 2026-11-20. The repository is now public; the previous account-payment/spending-limit startup blocker is resolved without changing billing settings or weakening CI. Earlier zero-step failures, including [run 44748728462](https://github.com/mfurti/financial-tracking/actions/runs/44748728462), remain historical evidence.

The exact implementation candidate c9718ae97997521993a6b62d51544d522dd72259 passed both [PR run 44750684649](https://github.com/mfurti/financial-tracking/actions/runs/44750684649) and [push run 44750674278](https://github.com/mfurti/financial-tracking/actions/runs/44750674278), attempt 2. Both full verification and Linux container/restore acceptance succeeded. Linux verification passed 225 tests and all 24 browser batches: 428 passes and 12 intentional skips. Current PR checks remain authoritative after documentation-only follow-ups; a pending run is not a passing result. No merge, deployment, production migration, reboot or live bank test was performed by this acceptance step.

Review remains open in [PR #14](https://github.com/mfurti/financial-tracking/pull/14). The exact review head must retain successful required checks, and merging needs the user's separate approval. Deployment needs its own writer/backup/migration approval. Final task/metadata commits are linked from issue #13; later documentation commits do not claim new production evidence.

## Last verified production delivery

The most recent evidenced production revision remains d193639762a543e9283b62a604804ab5245f30dd from [PR #11](https://github.com/mfurti/financial-tracking/pull/11). PR #10 was previously merged/deployed as 3b990ec. [Main CI 42499226320](https://github.com/mfurti/financial-tracking/actions/runs/42499226320) passed 131 tests, 20 browser cases, Linux container/restore acceptance and image publication.

The separately approved PR #11 rollout restored a fresh encrypted populated backup in isolation in 10 seconds, preserving original fields/rows from 17 application tables. Writer downtime was 212 seconds; both PR #11 additive migrations were applied. Four runtime services were healthy; HTTPS/access protection, exact actual reports, monthly contract forecasts and read-only API checks passed. Configuration/secrets were retained and encrypted configuration was backed up off-host.

Runtime location remains /root/docker/financial-tracking, web IP 192.168.178.33, with Compose/config/secrets and published images only. No server repository/build, reboot or live banking was involved. Evidence: [issue #3 rollout comment](https://github.com/mfurti/financial-tracking/issues/3#issuecomment-6724648706); ignored local evidence remains under .local/releases/d193639. This historical evidence is not a new server probe.

## Delivered source and retained boundaries

| Area           | Current source                                                                                                                                          | Remaining boundary                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| CSV/imports    | Automatic valid import, mapped-text fallback, native selection, compact exception review, accountless history, duplicate comparison, protected rollback | Original-file acceptance E5; latest-100 history without paging I1; optional C1–C3 |
| Categories     | Templates, ordered rules, protected manual/empty choices and fixed/variable annotations                                                                 | Joint domain acceptance E6                                                        |
| Contracts      | Suggestions/decisions, revisions/payment history, monthly forecast and due-month calendar with exact totals                                             | Legacy field feedback R2; richer proposal evidence R3; joint acceptance           |
| Analysis       | Exact monthly/merchant/category/classification drill-down, saved account-group scopes, configurable modules                                             | User review E6; no budget inference                                               |
| Reserve/wealth | Explicit BOOKED source coverage, positive goal and immutable captures                                                                                   | No invented bank balances or earlier history                                      |
| Demo           | Synthetic portfolio/plans/activity/scenarios and local display roles                                                                                    | Device-only; no real permissions, broker or bank                                  |
| Settings       | Server profile/groups/read receipts; DE/EN, first-render masking, custom colors and device choices                                                      | Device storage limitations remain visible                                         |
| Appearance     | Approved integrated layout, 23 preset choices, paired custom colors, stable hover and reduced motion                                                    | Human visual acceptance E6                                                        |
| Budgets        | Not implemented                                                                                                                                         | Separate unapproved scope B1–B5                                                   |
| FinTS          | Existing adapter/manual challenge flow and synthetic tests                                                                                              | Own registration, confirmed endpoint and supervised real test E1–E2               |

R1/I2/I3/P1/A1 now have source delivery through the approved integrated feature; their previous “not implemented” status is superseded. R2/R3 and the latest-100 history limit remain explicit existing backlog, not a claim that all earlier UX details passed. K1 was the earlier source cleanup; its audit remains in [code-audit.md](code-audit.md).

## Reading the documentation

[Feature spec/plan/tasks](../specs/001-integrated-household-concept/spec.md), [validation](../specs/001-integrated-household-concept/validation.md) and [quickstart](../specs/001-integrated-household-concept/quickstart.md) describe the approved integrated delivery. [todo.md](todo.md) owns current stable backlog IDs.

Earlier [base plan](plan.md), [specification](haushaltsbuch-implementierungsspezifikation.md), [initial checklist](initial-implementation-checklist.md), [expansion plan](ausbauplan.md), [stage plan](HAUSHALTSBUCH_CODEX_PLAN.md), [Finanzfluss plan](finanzfluss-umsetzungsplan.md) and [usability plan](vertragsanalyse-usability-plan.md) preserve historical requirements, including the eight November 8 UI comments. Their old status does not override this delivery record.

Dated [Stage 1](stage-one-acceptance.md), [Finanzfluss](finanzfluss-abnahme.md), [usability](vertragsanalyse-usability-abnahme.md) and [progress](progress.md) evidence is not blanket product acceptance. Runtime guidance remains in [API](api.md), [appearance](appearance.md), [user guide](user-guide.md), [banking](banking.md), [registration](fints-registration.md), [deployment](deployment.md), [migrations](feature-migrations.md), [recovery](recovery.md) and [coding guidelines](coding-guidelines.md). The [archived backlog](archive/todo-2026-11-08-before-audit.md) retains its historical status.

Shared Zod contracts supersede duplicate class-validator/generated-client models. Automatic valid accountless import supersedes mandatory account selection and routine confirmation. Explicitly approved contract expansion removed its earlier budget prerequisite and allowed unambiguous automatic payment matching; budgets themselves remain unapproved. Passing technical checks never replaces user acceptance or merge/deployment approval.
