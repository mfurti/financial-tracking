# Rebuild validation record

## T001: Baseline and compatibility inventory

- Target: `main` at `740f2103a068c9401d9c1e194b3986a12983eeae`. The approved planning commit is `16e1222` on the branch linked to [issue #21](https://github.com/mfurti/financial-tracking/issues/21).
- [PR #16](https://github.com/mfurti/financial-tracking/pull/16) and [PR #20](https://github.com/mfurti/financial-tracking/pull/20) are open against `main`. Their recovery or budgeting changes were not in the selected revision. Reconcile with the current base again before integration.
- The existing nine Prisma migrations and migration lock stay intact. Plan restoration against disposable PostgreSQL, with ID, relationship, and exact-cents reconciliation in T005 and T009.
- The requirements checklist passes 10 of 10. The twenty task IDs match the issue checklist. The Git, Docker, ESLint, and Prettier exclusions cover the dependencies, generated code and output, test artifacts, and relevant environment files. Both application packages are private.

### Exposed interfaces and workflows

| Area                        | Baseline API and user journeys                                                                                                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access and operations       | Same-origin `/api/v1`; health and readiness, login, session, password change and logout. Preserve private access, session expiry, guarded owner, Origin and CSRF protections.                                                    |
| Overview and analysis       | `/analytics/{overview,monthly,merchants,review}` and the existing scope/group rules. Distinguish booked flow, recorded balance, planned amounts, missing values, and privacy masking.                                            |
| Transactions and categories | `/transactions` cursor list, details, edits, bulk classification and assignment; `/categories`, `/category-rules`, and `/transfers`. Preserve optional accounts, source identity, category/archive semantics and transfer rules. |
| Accounts and import         | `/accounts`, details and balances, `/bank-connections`, `/bank-setup`, `/imports`, and `/import-runs`. Preserve preview, commit, issues, staged assignment, duplicates, rollback, and bank synchronization/authentication.       |
| Contracts                   | `/contracts`, suggestions/decisions, summary, calendar, revisions and payment links. Keep actual payments distinct from planned dues.                                                                                            |
| Workspace and wealth        | Account groups, profile, notifications, account presentation, reserve and wealth routes. Preserve immutable snapshots, locale, theme, amount masking and independent synthetic demo storage.                                     |

Route methods, shapes, and errors remain grounded in [the API documentation](../../docs/api.md), the shared operation inventory at `packages/contracts/src/index.ts`, and their current controllers. The [user guide](../../docs/user-guide.md) is the feature parity baseline. Preserve the [recovery guide](../../docs/recovery.md), [deployment guide](../../docs/deployment.md), [migration ledger](../../docs/feature-migrations.md), [banking guide](../../docs/banking.md), and active verification scripts and evidence when retiring plans.

### Baseline checks

- Remote: [CI run 44961490715](https://github.com/mfurti/financial-tracking/actions/runs/44961490715) passed verification and operations at the exact target SHA. The verification job includes pinned Node/pnpm, Prisma, format, lint, type, unit/database tests, build and Chromium. The operations job includes the Linux/Docker checks. Its publish job also succeeded for that main revision.
- Local: Spec Kit prerequisites, issue checklist agreement, package/ignore configuration and repository status inspected before product changes. The Windows host defaults to Node 26.13.0 and has no Docker CLI on PATH. Node 24.22.1 is available as an isolated npm runtime for T002. This baseline records remote Docker evidence separately from local checks.
- Baseline failures: no failures reported by the exact-revision CI. No production access or acceptance was performed.

## T002: Pinned runtime and library compatibility

- Node 24.22.1 and pnpm 11.25.0: frozen install with strict peer checking, Prisma generation, root typecheck, and the production API/web build all passed on Windows.
- Resolved Querry Kit Nest 1.1.2, Nuxt 0.2.10, and Nuxt UI 3.3.10. The web package pins VueUse core/router 14.4.0 and Vue Router 5.4.0 to match the existing Nuxt dependency graph. The existing Vue 3.5.45 resolution and NestJS runtime versions are unchanged.
- The web build emitted an informational Vite plugin timing warning. The build completed successfully. Runtime integration is covered by later tasks.

## T003: Web transport

- Querry Kit UI module loads in Nuxt. Table clients are made within the current Nuxt app, delegate only relative table reads to the existing same-origin transport, and validate each response using the caller's Zod schema. Existing commands keep the session and CSRF handling in the app transport.
- Nuxt typecheck and scoped ESLint passed. The proxy and authorization boundary suites passed 7 tests in total. End-to-end table use is verified with the actual resource routes.

## T004: Responsive shell

- The rebuilt shell uses a centered 1120 px content column, compact sticky desktop navigation with Imports and Settings, and bottom navigation on small screens. It reuses the existing translated destination labels.
- Nuxt typecheck, lint, and production build passed. Playwright passed all 18 shell, surface, concept coverage, and locale/privacy cases at 390 px and 1440 px. The earlier browser run loaded the previous build; the evidence is from the rebuilt artifacts.

## T006: Transaction table contract cases

- The pinned client serializer, scoped pagination and projection cases reject the baseline's missing route as expected. The real authenticated legacy cursor test passes. The two new-route cases are recorded as pending until T007 adds the endpoint. Scoped ESLint passed.

## T005: Restore and exact-data baseline

- The migration history still matches the selected main revision. A two-database synthetic logical backup/restore round trip reconciled canonical rows in 22 tables, including exact values above JavaScript's safe integer range, scoped monthly totals, identities, imports, transfers, payment links, observations, wealth, and owner settings.
- The archived API compatibility test initially failed on an entire-lockfile equality assertion after adding Querry Kit. The check now compares the archived API and compiler's effective locked dependency closure and integrity, then still boots the actual older app. Both the old-application test and the restore test passed.
- This fixture exercises a PostgreSQL logical export and restore in isolation. The encrypted pg_dump/age container procedure retains its separate operations gate.

## T007: Scoped transaction resource

- The new protected route uses validated resource filters, repeatable-read counting and row selection, Querry Kit projection and paging, and exact scoped date/cents semantics. Legacy cursor reads still use the same predicate.
- All 3 transaction resource cases and 22 existing ledger, monthly review, auth boundary, and archived app cases passed. API build, root TypeScript, and scoped ESLint passed.
- On 10,000 disposable transactions scoped to one account, an authenticated 25-row first page took about 5.0 ms on the legacy cursor route and 7.1 ms on the table route (middle warm samples, Windows workstation). Both row-select shapes used a limiting index-only scan on the account/date/ID index. The full-scope count used an aggregate over a sequential scan. The measurement is local fixture evidence.
- Prisma's PostgreSQL adapter emitted a pg concurrency deprecation notice when loading relations in a transaction. The pinned driver completed the reads successfully.

## T008: Import experience

- Import history now has direct CSV and bank connection actions, compact separated rows, and a dedicated review panel. CSV upload keeps the existing state machine and presents the file stage and preview as distinct regions.
- Nuxt typecheck, lint, build, all 10 desktop/mobile and empty-ledger import browser cases, and all 9 rollback tests passed. An initial duplicate accessibility label was corrected before the passing run.

## T009: Rebuilt-app restore compatibility

- The populated restore retained every archived row and exact total after using authenticated monthly and Querry Kit transaction reads. The application denied anonymous reads and invalid-CSRF mutations, and the bank connection response omitted its stored protocol metadata.
- Both archived APIs, the historical feature baseline and rebuild base `740f210`, compiled and exercised their real legacy contracts against the same schema. Nine compatibility, reconciliation, migration, and authorization tests passed.
- Eight Chromium Overview and ledger tests passed across 390 px, 1440 px, and the regular desktop/mobile projects.

## T010: Transaction table journeys

- The transaction list uses Querry Kit for resource paging, table ordering and stale-response handling. Date/account/category bookmarks, stable details links and the existing edit actions keep their validated domain behavior.
- Nuxt typecheck, lint, production build and the return-target test passed. All six browser cases passed on desktop and mobile, including production-shaped pagination, a malformed-response retry, exact amount ordering, out-of-range page recovery, focus restoration, and existing classification flows.

## T011: Scoped financial overview

- The scope control supports all accounts, a saved group, or one account. The visible report and observed balances use that scope. Income and expense cards open the corresponding booked, transfer-excluding transaction list for the same month.
- Nuxt typecheck, lint and production build passed. All 16 Chromium overview, group, and locale/privacy cases passed at 390 px and 1440 px, including the account-scoped keyboard drill-down.

## T012: Account table compatibility cases

- The new authenticated resource case failed against the baseline's absent table route as expected. The existing routes passed their compatibility case. Scoped lint passed. The new case is pending until the matching implementation task.

## T013: Contract table compatibility cases

- The new authenticated resource case failed against the baseline's absent table route as expected. The existing routes passed their compatibility case. Scoped lint passed. The new case is pending until the matching implementation task.
