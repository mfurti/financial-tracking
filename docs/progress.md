# Implementation evidence

Current expansion task: [issue #3](https://github.com/mfurti/financial-tracking/issues/3), Stage 1 approved in the current checkout on `codex/3-complete-ledger-stage-one`. Initial delivery evidence below remains historical, including then-pending PR/deployment gates; it does not override later merged/deployed status recorded in the checklist. No live bank credentials have been requested or used.

## P0 — Expansion baseline (2026-11-07)

- Initial checkout: `main` at `621c979`, one local documentation commit beyond fetched `origin/main` (`d0f90de`). Only untracked file: user-supplied `docs/HAUSHALTSBUCH_CODEX_PLAN.md`; no tracked or staged changes. Original preserved byte-for-byte in ignored `.local/p0/HAUSHALTSBUCH_CODEX_PLAN.original.md`, SHA-256 `77b5c5efc62b5d60e24be8d2e592f6c3b650ec9c0b6ad4735df483f5b18c2458`. Its Markdown formatting is normalized separately without changing requirements.
- Remote tasks inspected: initial issue #1/PR #2 already delivered; no expansion issue found, so issue #3 was created. User explicitly approved Stage 1 in this checkout after the new issue was shown. Created the normal issue branch retaining the local documentation commit. SSH fetch failed at the signing agent; authenticated HTTPS fetch using the existing GitHub CLI login succeeded without changing remotes or exposing credentials.
- Global Node is 26.13.0, outside the repository's `>=24.22.1 <25` range. Commands below used existing Node 24.22.1 by prepending `C:\Users\mfurti\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin` to the child PowerShell PATH; pnpm is 11.25.0. No system runtime or package pins were changed.

| Baseline command                  | Observed result                                                                                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check`               | Failed only on the new untracked user plan's Markdown formatting; existing tracked formatting passed. No implementation regression.                             |
| `pnpm lint`                       | Passed.                                                                                                                                                         |
| `pnpm test`                       | Passed: 5 files, 26 tests; fresh local embedded PostgreSQL, no external TEST_DATABASE_URL or production database.                                               |
| `pnpm typecheck`                  | Passed for contracts, API, web, and root test/script types.                                                                                                     |
| `pnpm build`                      | Passed for contracts, API, and web production output.                                                                                                           |
| `pnpm test:e2e`                   | Passed: desktop 1440×1000 and mobile 360×800, 2 tests. Isolated local application/database.                                                                     |
| Docker/registry/target-host tests | Not executed during P0: no local Docker executable. Production/real-bank proof is not inferred from local checks. No server or bank connection performed in P0. |

### Prioritized implementation matrix

| ID   | Status / existing seam                                                                                                                                                                        | Dependencies and owning files                                                                                                                                                                     | Required new evidence                                                                                                                                                                       | Commit / remaining decisions                                                                                                                                                                                                |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0   | Inventory/baseline checked; documentation consolidated                                                                                                                                        | User plan, `docs/ausbauplan.md`, `docs/todo.md`, this record                                                                                                                                      | Actual baseline above; format/links/diff of consolidated docs                                                                                                                               | Committed as `e2e4963`; supplied plan meaning preserved.                                                                                                                                                                    |
| P1.1 | Partial: production images, DB/API health and encrypted dumps exist; Compose builds source, API health is liveness-only, web lacks health, retention is seven files; no GHCR publisher/bundle | P0; `.github/workflows/ci.yml`, `infrastructure/{Dockerfile,compose.yaml,backup/*}`, API health/auth/contracts, web server health/proxy guard, operations scripts/tests, deployment/recovery docs | Digest-gated publication, image-only startup, failed prerequisites/migration, readiness, seven-day retention, proxy-bypass negatives and existing-volume preservation                       | Not started. Reinspect actual Compose/DHCP/conflicts before `.33`; private GHCR pull access and production rollout remain gates. Prepare locally before rollout.                                                            |
| P1.2 | Missing accountless path: contracts/parser, staging/transactions/identities and importer require account IDs; reports/annotations/locks already provide reuse seams                           | P0 + P1.1 rollout design; Prisma schema/new migration, `tests/database.ts`, shared contracts, CSV/import/ledger services/controllers, API document, CSV/review UI, integration/browser tests      | Upgrade existing populated fixtures; explicit nonempty identity scopes; no dropped records through joins; four atomic/idempotent/concurrent assignment decisions; exact totals before/after | Not started. Test harness currently applies only initial SQL, so it must cover all migrations rather than silently ignoring the new one. Old consumers cannot serialize nullable account IDs: coordinated release required. |
| P1.3 | Partial existing pages, shared forms and response validation; no explicit theme switch, hardcoded light surfaces, client drops structured error details                                       | P1.2 contracts; web layout/pages/styles/composable, shared IBAN validation, browser tests                                                                                                         | Both themes including login/reload, field paths/checksum, all responsive states, keyboard/focus, exact reports                                                                              | Not started. Keep Nuxt UI and German calm layout; no budgets/fixed-cost UI.                                                                                                                                                 |
| P1.4 | Partial isolated FinTS worker/leases/cancel/recovery and challenge UI; missing comprehensive fixture/browser states and real-bank proof                                                       | P1.2 identity design + P1.3 UI; bank/worker/sync services, contracts, connections/review UI, tests and banking docs                                                                               | Success/wrong PIN/continuation/pending/expiry/network/cancel/restart; no secret leakage; separate real discovery/balance/history/TAN proof                                                  | Not started. External blocker: no own product ID, confirmed endpoint, or user-assisted real bank acceptance. CSV independent.                                                                                               |
| P1.5 | Partial existing CI/browser/synthetic restore; no populated target-app restore, complete auth/browser matrix, bundle/registry readiness or reboot proof                                       | P1.1–P1.4; integration/browser/operations tests, CI, deploy/recovery docs and candidate bundle                                                                                                    | Exact candidate checks; populated isolated login/data/report restoration; secret markers; controlled deployment and joint acceptance                                                        | Not started. Explicit production/reboot/bank gates; stop after Stage 1 review, no Stage 2/3 work.                                                                                                                           |

Code inspection is not functional acceptance: the existing ledger, annotation rollback, basic CSV and synthetic bank tests pass, while the new Stage 1 capabilities above remain partial/missing. Prior target-host results are historical evidence, not new P0 probes. Budget refund identification, target-month overwrite conflicts, recurrence end-date semantics, and partial/combined-payment behavior belong to later gated stages.

Next allowed step after validated P0 commit: prepare P1.1 source/CI/deployment changes locally. No production migration, IP allocation, server source deletion, bank login, or host reboot is authorized by this record.

## P1.1 — Registry/deployment preparation

Status: local implementation/checks passed; Linux container acceptance, actual publication/pull, DHCP reservation and production transition remain open. P0 commit is `e2e4963`. No new IP was allocated, no running application changed, no source removed from rocky, and no real bank call performed.

- Replaced production Compose build contexts/Caddy with image references, explicit `.33` web/Traefik/private networking and no host mappings. Preserved project/volume naming and migration/API image parity. PostgreSQL digest matches the existing rocky image, read-only inspected after P0. Planning's other-Compose/network observations remain recorded; DHCP/non-Docker conflicts must still be rechecked before deployment.
- Added bounded API database readiness and web-to-API health. Added socket-peer validation against the configured proxy's Docker DNS addresses; HTTP forwarding headers cannot authorize a direct Macvlan request. Production enables this gate; direct local browser fixtures explicitly opt out.
- Added actual time-based pruning: all generated snapshots from seven preceding complete UTC days plus today survive, regardless of manual-run count; unrelated/incomplete files are ignored. Health advances only after encrypted dump completion.
- Added allowlisted deployment packaging with immutable GHCR image validation and full revision. It writes only Compose, `.env.example`, README and REVISION, rejects nonempty output and mutable/foreign references, and copies no secrets/source.
- CI operations now builds/test-runs runtime images in generated isolated networks, tests missing secrets/unavailable registry/failed migration, readiness failure/recovery, direct-access denial, encrypted restore, volume persistence and runtime source exclusions. On main only it exports those exact verified images; the publication job requires both verify/operations, loads the artifact, verifies revision labels and publishes without rebuilding. It records digests and uploads the versioned deployment-only tarball. No production images are published on feature/PR runs.
- Local checks with Node 24.22.1/pnpm 11.25.0: all 32 tests passed; strict typechecks and production builds passed; both browser profiles passed; lint/format and Bash syntax passed. After tightening the UTC calendar boundary, focused bundle/proxy/Compose/retention checks passed (7 tests). An initial test-only attempt to spy/restore a Prisma virtual method broke later tests; replacing it with an isolated injected failing dependency fixed the fixture without changing production behavior.
- Docker checks are authored but not claimed executed on Windows. Private GHCR credentials/visibility and target-host rollout remain acceptance items. Publication scripts operate only on protected main pushes and do not change rocky.

## Historical initial delivery evidence

Task record: [GitHub issue #1](https://github.com/mfurti/financial-tracking/issues/1).

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
- Docker is unavailable locally. The Linux [CI run 42299354331](https://github.com/mfurti/financial-tracking/actions/runs/42299354331) passed both verify and operations on `d9af458`: production images built, trusted private HTTPS and unauthenticated denial passed, and an age-encrypted backup was decrypted/restored into a separate empty PostgreSQL container. The restored amount, transfer flag, and category matched the synthetic source data.
- Real Sparkasse product registration, endpoint/TAN compatibility, and target-home/VPN reachability/certificate trust remain operator-dependent acceptance items, not mocked passes.

## Review follow-up — Atomic annotations and reachable duplicate reviews

- Reproduced both review findings on disposable PostgreSQL before editing: a failed category/transfer patch removed the group, and 1,000 CSV errors hid a staged duplicate review.
- Added three regression tests that failed on the original code: invalid-category preservation, rollback after a database-triggered final-write failure, and an actionable review behind 1,001 invalid CSV rows. The first test also checks the valid combined category/transfer update.
- Fixed compound transaction patches with category validation and all group/counterpart/annotation writes inside one serializable transaction. The bounded issue list now prioritizes staged actionable reviews and fills remaining capacity with diagnostics, without changing the public response schema.
- All 26 local tests passed, including the three new PostgreSQL regressions; lint, format check, strict typechecks, and the API build also passed. Latest-head remote CI must pass before the correction is reported complete. No merge or production deployment authorized.

## Initial delivery state

- T5 implementation commit: `6ad379d`; validation/delivery tracking: `d9af458`.
- After explicit publication approval, remote main was initialized with the original documentation commit `49bba21`, and `codex/1-household-ledger` was pushed. [PR #2](https://github.com/mfurti/financial-tracking/pull/2) targets main and links issue #1.
- Both remote CI jobs passed for `d9af458`. Documentation follow-ups also require green checks on their own head. No merge or production deployment is authorized or performed.
