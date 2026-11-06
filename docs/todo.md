# Implementation checklist

Implementation approved for [issue #1](https://github.com/mfurti/financial-tracking/issues/1) in the current checkout. Unchecked items remain pending; task completion evidence is recorded separately below.
See [plan.md](plan.md) for scope, architecture, defaults, and acceptance criteria.

## Before implementation

- [x] Obtain explicit approval for the plan.
- [x] Inspect existing remote tasks/PRs; create or reuse the task record required by the coding workflow without duplicates.
- [x] Show the task record and obtain implementation approval; agree on current checkout versus worktree.
- [x] Inspect the remote base before creating the implementation branch; preserve unrelated work.
- [x] Resolve dependency versions against current official documentation and record the supported runtime/package manager.
- [ ] Keep bank credentials out of chat, issues, fixtures, source files, and commits.

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
- [x] Test unauthenticated access, bad input, invalid responses, login/logout, CSRF, and session expiry.
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

- [ ] Test successful reads and authorization-required, pending, rejected, expired, cancelled, and network-failure states with sanitized fixtures.
- [ ] Test incorrect PIN without automatic credential retry, parallel refresh, and restart during approval.
- [x] Test CSV preview, mapping, invalid rows, limits, and cancellation.
- [ ] If FinTS fails, document the exact blocker and keep CSV operational; do not silently add another provider/runtime.
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
- [ ] Test repeated imports, overlapping periods, cross-source overlap, duplicate ambiguity, and preserved user edits.
- [ ] Test cent-exact totals, month/year boundaries, refunds, transfers, and pending/booked behavior.
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
- [ ] Validate forms with shared schemas; map server validation field paths to the relevant controls.
- [x] Clear sensitive form values after submission; prevent credentials entering browser persistence or telemetry.
- [x] Display German dates/currency and Europe/Berlin timestamps consistently.
- [x] Provide loading, empty, stale-data, partial-success, error, and expired-session states.
- [ ] Check keyboard navigation, accessible labels, focus management, and mobile layout.
- [x] Add Playwright coverage for login, imports, filtering, categorization, transfer exclusion, and monthly totals.
- [ ] Verify bank authorization interactions with mocks; do not put live credentials in browser tests.
- [x] Run applicable checks and document user-facing workflows.
- [x] Commit T4 and record its SHA and validation results.

## T5 — Production readiness and final acceptance

Dependencies: T4. Outcome: recoverable private deployment with documented validation.

- [x] Build production Docker images with the contracts package available to both consumers.
- [ ] Bind HTTPS ingress only to the intended home/VPN interface; keep API/database services internal.
- [x] Configure production secrets outside version control and image layers.
- [ ] Verify persistent volumes, health checks, and restart behavior without exposing financial details.
- [ ] Schedule daily encrypted database backups with seven-day retention and independently stored keys.
- [x] Document a fresh installation, administrative account provisioning, migration execution, and updates.
- [x] Document recovery for a failed update using a pre-update backup; do not promise automatic down-migrations.
- [ ] Restore a backup into an isolated environment and verify accounts, transactions, categories, and reports.
- [ ] Verify no PIN/TAN appears in database records, logs, error responses, or backup contents.
- [x] Run full lint, format check, strict typecheck, unit/integration tests, Playwright tests, and production builds in CI.
- [x] Review contract compatibility across Zod schemas, backend validation/serialization, OpenAPI, and frontend consumers.
- [ ] Complete desktop/mobile acceptance and separate real-bank verification or document the outstanding blocker.
- [x] Record exact commands/results and operational limitations in the task record and documentation.
- [x] Commit T5 and record its SHA and validation results.
- [x] Open/update the feature PR and follow the required review/merge approval workflow; do not deploy or merge without applicable authorization.

## Stop conditions

- [ ] Confirm version 1 stays single-user, EUR-only, and private to home network/VPN.
- [ ] Confirm no payment initiation, public signup, budgets, forecasts, investment features, or unattended bank synchronization were added.
- [ ] Confirm all required checks and restoration proof passed, with external blockers reported accurately.
- [ ] Confirm no implementation item was marked complete on the strength of this planning/documentation commit alone.
