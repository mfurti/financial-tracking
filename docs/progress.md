# Implementation evidence

Task record: [GitHub issue #1](https://github.com/mfurti/financial-tracking/issues/1). Implementation approved in the existing checkout. No live bank credentials have been requested or used.

## T1 — Foundation

- Implemented pnpm workspace, shared browser-safe Zod contracts, API/session foundation, Prisma schema/initial migration, Nuxt UI shell, standards, and CI.
- Compatible pinned foundation: NestJS 11.2.8, nestjs-zod 5.5.0, Zod 4.6.7, Prisma 7.10.1, Nuxt 4.6.4, Nuxt UI 4.12.0. NestJS 12 was excluded because nestjs-zod's supported peers are NestJS 10/11.
- Verified: contracts/API/web typechecks; lint; API/web production builds; seven tests including actual PostgreSQL session persistence, CSRF/logout and migration execution. PostgreSQL tests use disposable instances, never DATABASE_URL.
- Documentation coverage reviewed manually. Docker execution is unavailable on this workstation and is not claimed as verified.
- The UI is a shell at this boundary; the interactive ledger is T4. Bank compatibility remains T2.

## T2 — Source boundaries

- T1 commit: `af4ed79`.
- Added bounded CSV parsing/mapping, normalized PostgreSQL staging, preview/status/diagnostics/cancellation APIs, and isolated FinTS worker with safe output handling and authorization continuation.
- Verified: API typecheck/build, lint, twelve tests (including PostgreSQL preview atomicity/cancellation), exact German cents, invalid dates/rows/quoting/size limits, separate identical purchases, and missing-bank-configuration failure.
- External FinTS compatibility remains **blocked**: no registered product ID, confirmed bank endpoint, real credentials, or approval was supplied. No live bank call was attempted. See banking.md for the required acceptance procedure and unsupported challenge formats.
- Preview-to-final commit and import reconciliation are T3; CSV preview does not claim final ledger persistence yet.

## T3 — Ledger, reconciliation, and reports

- T2 commit: `bf52941`. The external FinTS gate remains open; the implementation continues through the specified CSV fallback.
- Added confirmed CSV commit, per-account locks, exact identities, manual ambiguity review with incoming/candidate data, preserved categories, transfer linking, monthly reports, bank-run leases/cancellation/recovery, and private ledger APIs.
- Existing CSV accounts with an IBAN can be explicitly reassigned to a FinTS connection through the account patch contract; the bank importer refuses to silently duplicate an IBAN under another connection.
- Verified: eighteen tests including repeat/parallel imports, true duplicate-looking purchases, invalid-row consent, transactional rollback, preserved annotations, cursor pagination, month boundaries/refunds/pending/own transfers, and synthetic bank partial success/lease conflict. Contracts/API typecheck, lint, and API build passed.
- No real bank access or Docker execution claimed.

## T4 — Responsive application

- T3 commit: `8f4d00b`.
- Implemented German authenticated navigation, dashboard, accounts, transaction detail/filter/categorization/bulk actions, categories, transfer controls, CSV wizard, duplicate review/history, bank refresh/challenge UI, and password reauthentication/rotation.
- Verified the real browser/API/PostgreSQL journey in Chromium at 1440×1000 and 360×800: login, populated/unknown-balance dashboard, category creation, CSV preview/commit, filtered transaction, category persistence, transfer marking, navigation, logout, no uncaught browser errors, and no dashboard horizontal overflow.
- Both Playwright projects passed. Synthetic screenshots: `.local/dashboard-desktop.png` and `.local/dashboard-mobile.png` (not committed). Desktop screenshot visually inspected. Runtime proxy configuration uses `NUXT_API_INTERNAL_URL`; the browser only calls the same origin.
- Contracts/API/web typechecks and production builds passed. Vue TypeScript identifier checks are owned by vue-tsc (ESLint no-undef is disabled only for Vue's TypeScript scripts to support Nuxt auto-imports).
- Remaining operational/live-bank checks are tracked in T5 and banking.md.

## T5 — Packaging and operational acceptance

- T4 commit: `53a6010`.
- Added production API/web images, private HTTPS Compose deployment, database secret bootstrap with privilege drop, daily age-encrypted backups/seven-archive retention, guarded empty-target restore, deployment/recovery/API documentation, and full OpenAPI/response contracts.
- Verified locally: twenty-three tests; lint/format/typechecks; contracts/API/web production builds; both real desktop/mobile browser journeys; Bash syntax for backup, restore, and CI operations scripts. The isolated production API package also generated OpenAPI without database access.
- Docker is unavailable locally. The GitHub operations job builds the images, checks private trusted HTTPS and unauthenticated denial, backs up synthetic category/transaction data, and decrypts/restores it into a separate empty PostgreSQL container. Its result must be checked before claiming Docker/restore acceptance.
- Real Sparkasse product registration, endpoint/TAN compatibility, and target-home/VPN reachability/certificate trust remain operator-dependent acceptance items, not mocked passes.
