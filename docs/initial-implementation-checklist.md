# Implementation checklist

Status reviewed on 2026-11-07 against source/tests, recorded CI results, target-host acceptance, and the user's successful login. [Issue #1](https://github.com/mfurti/financial-tracking/issues/1) was implemented through [PR #2](https://github.com/mfurti/financial-tracking/pull/2), merged as `d0f90de395461376e94b79db8ca420d9906d215a`, and deployed with approval. Unchecked items remain pending; a checked implementation does not imply complete acceptance coverage.
See [plan.md](plan.md) for scope, architecture, defaults, and acceptance criteria.

## Current status and remaining order

- Running on `rocky` from `/root/docker/financial-tracking`: <https://haushaltsbuch.mfurti.de>, existing Traefik/Netcup TLS, LAN middleware, private API/database, one user and 13 default categories. Use `./ledger` in that directory. The user confirmed successful login.
- Daily age-encrypted backups are active; the private key stays on the Windows administrative computer. Encrypted database/configuration copies were also saved there manually; no recurring off-host copy is configured.
- Recovery evidence has two boundaries: CI restored synthetic financial records; the target-host test restored the initial schema before user creation. Recovery of populated target-host data and application login/reports remains open.
- Existing test sources and prior results were reviewed for this update; tests and server probes were not rerun. Historical entries in `progress.md` describe their delivery stage and do not supersede this status.
- Remaining order: complete missing functional/security tests and field-error handling; finish operational and accessibility acceptance; verify live Sparkasse separately when prerequisites exist. Coordinate the later layout plan with these open items; no layout implementation is started by this update.

Ongoing rule: keep real bank credentials out of chat, issues, fixtures, source files, and commits. Synthetic test-only credentials are not real bank credentials. No live bank access has been performed.

## Before implementation

- [x] Obtain explicit approval for the plan.
- [x] Inspect existing remote tasks/PRs; create or reuse the task record required by the coding workflow without duplicates.
- [x] Show the task record and obtain implementation approval; agree on current checkout versus worktree.
- [x] Inspect the remote base before creating the implementation branch; preserve unrelated work.
- [x] Resolve dependency versions against current official documentation and record the supported runtime/package manager.

## T1 — Workspace, contracts, and application foundation

Dependencies: implementation approval. Outcome: buildable applications with shared validation, persistence, and authenticated access.

### Workspace and standards

- [x] Create the pnpm workspace: API, web, and contracts packages.
- [x] Configure strict TypeScript, package exports, build outputs, and dependency/build order.
- [x] Pin the package manager and compatible supported runtime/dependency versions; commit the lockfile.
- [x] Establish ESLint, formatting, LF endings, Vue block/attribute ordering, and JSDoc/TSDoc rules.
- [x] Document canonical standards and actual check/fix commands; exclude generated/vendor/build files.
- [x] Add CI checks incrementally, starting with lint, format, typecheck, and package builds.

### Shared Zod library

- [x] Create `@financial-tracking/contracts` as a framework-independent browser-safe package.
- [x] Define reusable identifiers, EUR cent amounts, dates, timestamps, pagination, and validation-error schemas.
- [x] Define session, account, transaction, category, monthly-summary, and import-run request/response schemas.
- [x] Define run status, authorization-continuation, and cancellation contracts without exposing FinTS internals.
- [x] Define concrete `/api/v1` routes and input limits before building their consumers.
- [x] Infer exported TypeScript types from Zod; avoid duplicate handwritten DTO field definitions.
- [x] Keep transport schemas JSON-compatible; keep form-specific coercion explicit.
- [x] Add schema tests for valid payloads, invalid boundaries, and safe errors.

### API, web, and persistence

- [x] Bootstrap NestJS with Fastify and connect Prisma to PostgreSQL.
- [x] Create initial models/migrations for the user, sessions, bank connections, accounts, balances, transactions, categories, and import runs.
- [x] Keep money in integer cents and booking/value dates as calendar dates.
- [x] Add explicit Prisma-to-contract mapping; prevent internal record fields from leaking.
- [x] Integrate `nestjs-zod` request validation, response serialization, and generated OpenAPI.
- [x] Bootstrap Nuxt/Nuxt UI and a typed `$fetch` wrapper using shared request/response types and response parsing.
- [x] Add one administratively provisioned user; no registration endpoint.
- [x] Implement Argon2id password hashing, server-side sessions, logout, expiry, CSRF protection, and login rate limits.
- [x] Configure secure HttpOnly cookies and same-origin API routing through the reverse proxy.
- [x] Add environment templates without secrets and Docker Compose for local development.

### T1 verification and handoff

- [x] Verify contracts build before consumers; import the built package in API and web.
- [x] Verify the contracts package bundles for the browser without server-only dependencies.
- [x] Test unauthenticated access, session creation/revocation, logout, CSRF, password reauthentication, and rotation (`tests/auth.test.ts`, `tests/e2e/ledger.spec.ts`).
- [ ] Add explicit session-expiry and login-rate-limit regression tests and API tests for invalid input/response serialization; existing contract unit tests do not prove these HTTP boundaries.
- [x] Verify effective lint/format rules and formatting convergence on representative TS/Vue files.
- [x] Run applicable lint, format, typecheck, tests, migrations on a disposable database, and builds.
- [x] Document setup and verified commands; record remaining manual documentation checks.
- [x] Commit T1 and record its SHA and validation results in the task record.

## T2 — Sparkasse connectivity and CSV fallback

Dependencies: T1. Outcome: proven bank reads or an explicit FinTS blocker, plus a usable CSV import path.

### FinTS compatibility proof

- [ ] Register an application-specific FinTS product ID through the official process.
- [ ] Confirm Sparkasse Bodensee BLZ `69050001` and its official FinTS endpoint.
- [x] Review and pin `lib-fints`; retain required license notices.
- [x] Define the internal `BankConnector` boundary for discovery, balances, transactions, authorization continuation, and cancellation.
- [x] Validate configured bank destinations; do not accept arbitrary request-supplied bank URLs.
- [ ] Discover account capabilities and available TAN methods/media.
- [x] Implement manual refresh with PIN entry; never persist PIN/TAN.
- [ ] Support the user's available authorization method, including banking-app approval when available.
- [x] Respect bank-provided polling limits and expiry; prevent concurrent runs for one connection.
- [x] Release in-memory credentials and authorization state after completion, failure, cancellation, expiry, or restart.
- [x] Review persisted connection metadata for secrets and transient authorization material.
- [x] Disable protocol/body logging that could expose credentials or financial data.
- [ ] Interactively verify account discovery, balance, and transaction reads against the real account; record sanitized results only.
- [ ] Record supported history range and any bank restrictions; never imply complete history without evidence.

### CSV fallback

- [x] Add file size/row limits and supported encoding/delimiter handling for Sparkasse exports.
- [x] Provide column mapping for dates, signed amount, counterparty, purpose, and available references.
- [x] Parse German numeric/date formats; reject unsupported currencies and ambiguous mappings.
- [x] Show a preview and row-level errors before confirmation; retain no uploaded raw file after processing.
- [x] Normalize CSV records to the same internal import input used by FinTS.
- [x] Expose import status and safe actionable errors through shared contracts.

### T2 verification and handoff

- [x] Test synthetic partial account success, authorization-required/rejected, cancellation, parallel-run refusal, and abandoned-run recovery (`tests/ledger.test.ts`).
- [ ] Complete synthetic coverage for successful authorization continuation, pending approval/polling, expiry, and network failure.
- [ ] Test incorrect PIN without automatic credential retry and restart during actual worker approval; persisted-run recovery alone does not verify worker behavior.
- [x] Test CSV preview, mapping, invalid rows, limits, and cancellation.
- [x] Document the current FinTS prerequisite blocker and keep CSV operational without another provider/runtime (`banking.md`); missing configuration fails safely. This is not a failed or successful live compatibility test.
- [x] Update bank setup documentation with prerequisites and actual verified behavior.
- [x] Commit T2 and record its SHA, checks, and real-bank proof or blocker.

## T3 — Durable imports and reporting

Dependencies: T2. Outcome: reliable imports and accurate account/monthly views.

- [x] Persist source references and import provenance scoped to each account.
- [x] Prefer stable bank references for idempotent ingestion.
- [x] Present ambiguous duplicate candidates for review; preserve legitimate equal-looking transactions.
- [x] Reconcile overlapping CSV/FinTS imports through the same pipeline.
- [x] Preserve manual category assignments and transfer flags during reimport.
- [x] Import each account atomically after its complete fetch; preserve previous data on failure.
- [x] Expose partial success when some accounts succeed and others fail.
- [x] Save authoritative balance snapshots separately from transaction-derived totals.
- [x] Store pending/booked status and keep pending records out of monthly totals.
- [x] Implement category creation/update and transaction category assignment.
- [x] Implement marking transfers between owned accounts and excluding them from income/expense totals.
- [x] Implement transaction search, account/date/category filters, stable ordering, and bounded pagination.
- [x] Implement monthly income, expense, net, category breakdown, and previous-month comparison by booking date.
- [x] Test repeated CSV imports, concurrent overlapping commits, duplicate ambiguity, preserved categories, and transactional annotation rollback (`tests/ledger.test.ts`).
- [ ] Add explicit CSV/FinTS cross-source overlap, partially overlapping date ranges, and transfer-flag preservation on reimport tests.
- [x] Test cent-exact monthly totals, month boundaries, refunds, own-transfer exclusion, and exclusion of pending transactions (`tests/ledger.test.ts`).
- [ ] Add year-boundary and pending-to-booked transition/reconciliation tests.
- [x] Test response schemas/OpenAPI against actual API results and authorization boundaries.
- [x] Run applicable checks; update data/import documentation.
- [x] Commit T3 and record its SHA and validation results.

## T4 — Responsive German household ledger

Dependencies: T3. Outcome: complete browser workflow on desktop and phone.

- [x] Build the login screen and authenticated application shell.
- [x] Build account selection, balance display, and last-successful-refresh indicators.
- [x] Build dashboard month selection, income/expense/net summaries, and monthly comparison.
- [x] Build the transaction list with search, filters, pagination, category assignment, and transfer marking.
- [x] Build category management with clear validation feedback.
- [x] Build CSV upload, mapping, preview, duplicate review, confirmation, and import results.
- [x] Build bank connection setup, PIN entry, TAN-method selection, approval status, cancellation, and retry flows.
- [x] Use shared schemas in existing login, connection, category, account-create, and password forms; account creation currently omits IBAN from its form schema.
- [ ] Complete consistent form validation, including account IBAN validation, and map server validation field paths to controls; `useApi.ts` currently reduces structured API errors to their message.
- [x] Clear sensitive form values after submission; prevent credentials entering browser persistence or telemetry.
- [x] Display German dates/currency and Europe/Berlin timestamps consistently.
- [x] Provide loading, empty, stale-data, partial-success, error, and expired-session states.
- [x] Run the existing desktop/mobile browser journey and dashboard overflow check at 1440×1000 and 360×800; desktop screenshot inspection was recorded.
- [ ] Complete keyboard navigation, accessible-label, focus-management, and responsive checks across all pages and interaction states; the dashboard overflow check is not a full mobile acceptance.
- [x] Add Playwright coverage for login/logout, CSV import, filtering, categorization, transfer marking, and page navigation (`tests/e2e/ledger.spec.ts`).
- [ ] Add browser assertions for monthly amounts and transfer exclusion; current coverage marks a transfer without checking its effect on report totals.
- [ ] Verify bank authorization interactions with mocks; do not put live credentials in browser tests.
- [x] Run applicable checks and document user-facing workflows.
- [x] Commit T4 and record its SHA and validation results.

## T5 — Production readiness and final acceptance

Dependencies: T4. Outcome: recoverable private deployment with documented validation.

- [x] Build production Docker images with the contracts package available to both consumers.
- [x] Route private HTTPS through existing Traefik on `rocky`, with the LAN middleware; keep API/database internal and publish no application host ports. Target-host checks passed: trusted HTTPS 200, unauthenticated API 401, non-LAN source with forged forwarding header 403, and no application route on external entrypoint 8443 (404).
- [x] Configure production secrets outside version control and image layers.
- [x] Verify the PostgreSQL persistent volume, API/database/backup health checks, and configured restart policies on `rocky`.
- [x] Recreate the application containers during the approved move from `/opt/financial-tracking` to `/root/docker/financial-tracking`; verify identical data-only dump fingerprints, the same PostgreSQL volume, new Compose/secret paths, healthy services/backups, and HTTPS after recreation.
- [ ] Exercise host reboot recovery; verify persisted data and subsequent backup health. Container recreation and configured restart policies do not prove host reboot recovery.
- [x] Start daily encrypted database backups with an independently stored age identity; verify manual backups and copy encrypted database/configuration snapshots off-host.
- [x] Configure retention of the newest seven generated archives (`infrastructure/backup/backup.sh`).
- [ ] Resolve the original seven-day retention requirement: seven archives can cover fewer than seven days when manual backups run. Verify or adjust retention before claiming seven full calendar days.
- [x] Document a fresh installation, administrative account provisioning, migration execution, and updates.
- [x] Document recovery for a failed update using a pre-update backup; do not promise automatic down-migrations.
- [x] Restore an encrypted synthetic financial-data backup into isolated PostgreSQL in CI; verify the exact amount, transfer flag, and category (`scripts/verify-operations.sh`). Both jobs passed on merged main in [CI run 42303810535](https://github.com/mfurti/financial-tracking/actions/runs/42303810535).
- [x] Restore the target host's initial encrypted backup into network-isolated, tmpfs-only PostgreSQL 17; compare 13 public tables and one migration. The private key stayed local; temporary plaintext and the restore container were removed.
- [ ] Restore a populated target-host backup into an isolated application stack; verify user login, accounts, transactions, categories, imports, and monthly reports. The target-host restore preceded user creation; a new encrypted backup was taken and copied locally after user creation.
- [ ] Verify no PIN/TAN appears in database records, logs, error responses, or backup contents.

  Existing evidence covers suppressed bank-worker output, safe synthetic rejection records, and no live credentials used. A comprehensive synthetic secret-canary check across persistence, logs, errors, and decrypted backups is still required.

- [x] Run full lint, format check, strict typecheck, unit/integration tests, Playwright tests, and production builds in CI.
- [x] Review contract compatibility across Zod schemas, backend validation/serialization, OpenAPI, and frontend consumers.
- [x] Complete approved installation, administrative provisioning, and user-confirmed login; document missing FinTS product ID, confirmed endpoint, and real-account/TAN acceptance separately.
- [ ] Complete remaining desktop/mobile and populated-recovery acceptance; keep the real-bank checklist open until independently verified.
- [x] Record exact commands/results and operational limitations in the task record and documentation.
- [x] Commit T5 and record its SHA and validation results.
- [x] Open/update the feature PR and follow the required review/merge approval workflow; do not deploy or merge without applicable authorization.

## Stop conditions

- [x] Confirm the delivered installation is single-user, EUR-only, and restricted by the existing LAN middleware. VPN client access has not been separately tested.
- [ ] Confirm no payment initiation, public signup, budgets, forecasts, investment features, or unattended bank synchronization were added.
- [ ] Confirm all required checks and restoration proof passed, with external blockers reported accurately.
- [x] Base completion marks on existing implementation, tests, CI, or recorded target-host results; this checklist update adds no implementation or new test evidence.
