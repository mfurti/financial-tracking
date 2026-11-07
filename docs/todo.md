# Expansion implementation checklist

Plan and decisions: [ausbauplan.md](ausbauplan.md), refined by the [binding user plan](HAUSHALTSBUCH_CODEX_PLAN.md). Stage 1 of [issue #3](https://github.com/mfurti/financial-tracking/issues/3) is explicitly approved in the current checkout, branch `codex/3-complete-ledger-stage-one`. Production rollout, real-bank acceptance, and host reboot require separate approval. Stages 2/3 remain gated.

The previous checklist, including the audited delivery evidence and remaining baseline checks, is preserved in [initial-implementation-checklist.md](initial-implementation-checklist.md). Its open work is carried into the tasks below; checked historical implementation is not proof of expansion acceptance.

## Current baseline and gates

- [x] Deliver initial ledger through issue #1 / PR #2, merged as `d0f90de395461376e94b79db8ca420d9906d215a`.
- [x] Record running deployment under `/root/docker/financial-tracking`, trusted Traefik HTTPS, user-confirmed login, and 13 default categories.
- [x] Record initial target-host schema restoration, separate synthetic financial-data restoration in CI, encrypted backups, and private backup identity held off-server.
- [x] Audit old checklist and preserve its evidence without claiming new test or server results.
- [x] Agree on three-stage expansion, account-independent CSV, per-candidate reconciliation decisions, `.33` container address, and complete light/dark interface redesign.
- [x] Record issue #3 and obtain explicit Stage 1 implementation approval in the current checkout after showing its link.
- [ ] Before each implementation task, confirm prerequisites and preserve unrelated work. Complete its relevant source, tests, documentation, validation, and commit together.

Ongoing rules: develop source locally only; never store real PIN/TAN in chat, source, fixtures, database, logs, backups, or browser persistence. No server repository or builds. Never count fixture bank results as real compatibility proof.

## P0 — Inventory and baseline

- [x] Inspect branch, commits, worktree, source/migrations, scripts, CI, tests, and all three plans; preserve the untracked user document and its original SHA-256 in `.local/p0`.
- [x] Fetch the remote base and retain local documentation commit `621c979` on the issue branch; no reset, clean, stash, or server connection performed.
- [x] Use existing Node 24.22.1 runtime and pnpm 11.25.0 without changing system Node 26 or package pins.
- [x] Run baseline lint, all 26 tests on disposable PostgreSQL, strict typechecks, production builds, and both desktop/mobile browser profiles. Record the pre-existing user-plan formatting failure separately.
- [x] Consolidate stricter user-plan requirements, Stage 2 refund semantics, and later recurrence decisions without implementing later-stage features.
- [x] Record the prioritized file/dependency/check matrix and baseline evidence in [progress.md](progress.md#p0--expansion-baseline-2026-11-07).
- [ ] Commit the validated P0 documentation before feature implementation.

## Stage 1 — Complete and validate the ledger

### P1.1 — Registry images and deployment-only server

- [ ] Add CI image builds for API, web, and backup; keep migration execution in the matching API image. Label images with source/revision and use commit tags.
- [ ] Gate GHCR publication on successful checks for the same revision; keep PR validation separate from production publication.
- [ ] Configure private package publication with CI credentials and server-side read-only pulls without committing registry secrets.
- [ ] Create one production `compose.yaml` containing digest-pinned `image:` references, no `build:`, no Dockerfile dependency, and no source mounts. Keep backup/restore scripts inside the image.
- [ ] Reinspect the other actual Compose files and `FRITZBOX` / `traefik-public` networks during implementation. Compare static addressing and Traefik conventions rather than guessing.
- [ ] Verify DHCP reservation/exclusion and non-Docker address conflicts before assigning `192.168.178.33`; planning proved only that Docker had no container assigned there.
- [ ] Give web `.33` on external `FRITZBOX`, plus Traefik/backend networking. Retain the canonical domain, existing TLS resolver, LAN middleware, and security headers. Publish no application host ports; keep API/database off the LAN.
- [ ] Prevent direct Macvlan requests bypassing Traefik protections; assess actual peer addresses and reject spoofed forwarding headers instead of trusting them as evidence of proxy traversal.
- [ ] Put PostgreSQL, API database-readiness, web-readiness, and backup-freshness healthchecks directly in Compose. Gate API startup on successful migration.
- [ ] Preserve Compose project name, `household-ledger_postgres_data`, secrets, and backup storage; compare data before/after recreation.
- [ ] Fix backup retention to preserve at least seven calendar days despite extra manual snapshots; keep independent keys and document manual off-host copies accurately.
- [ ] Test clean installation from deployment files and registry images without a repository/build tools; verify readiness failure/recovery and absence of secret/source leakage in runtime artifacts.
- [ ] Produce a versioned downloadable deployment bundle containing Compose/config templates/instructions only; prove missing-secret, registry-unavailable, and failed-migration behavior without touching production.
- [ ] After successful production transition and verification, remove the old source tree and obsolete project path rules. Retain only deployment configuration/secrets and required data; do not delete volumes or backups.
- [ ] Update deployment/recovery documentation, record actual checks, and commit P1.1. Production rollout still requires its applicable approval.

### P1.2 — CSV without an account or bank connection

- [ ] Review existing data and add a preservation-safe migration for unassigned transaction/staging account associations and explicit non-null identity scopes. Preserve existing account IDs and backfill their identity scopes.
- [ ] Update shared Zod contracts, runtime validation/serialization, OpenAPI, and clients for optional CSV targets, unassigned responses/filters, assignment, and reconciliation choices.
- [ ] Allow file selection, mapping, bounded preview, partial-import consent, confirmation, and cancellation with zero accounts/connections; require no hidden placeholder account.
- [ ] Persist unassigned transactions in "Ohne Konto" with categorization, immediate global/monthly totals, and explicit filtering; exclude them from specific-account totals.
- [ ] Support later assignment of individual/selected transactions with candidate comparison against existing CSV/live records.
- [ ] Offer bank values, CSV values, a separate transaction, or skipping assignment per candidate; show conflicting values before overwrite confirmation.
- [ ] Make consolidation/identity updates atomic; preserve provenance and manual categories/transfer annotations by default. Ensure one resulting transaction is counted once.
- [ ] Make repeated confirmations idempotent and detect concurrent assignment/merge conflicts. Show source/date/amount/text/account/category/status differences before resolving each candidate.
- [ ] Keep unassigned identities import-scoped; use explicit review for possible cross-file duplicates instead of trusting globally repeated bank references or nullable unique keys.
- [ ] Test old-data migration, repeated/partially overlapping CSVs, genuine equal-looking purchases, CSV/FinTS overlap, conflicting references, preservation of categories/transfer flags, rollback, and each reconciliation decision.
- [ ] Test cent-exact totals before/after assignment/consolidation, month/year boundaries, refunds, transfer exclusion, and pending-to-booked reconciliation.
- [ ] Document compatibility and coordinated migration/client rollout; record checks and commit P1.2.

### P1.3 — Calm, responsive interface and themes

- [ ] Redesign the application shell/navigation and all ledger pages with consistent Nuxt UI components, typography, spacing, and feedback.
- [ ] Redesign dashboard month selection, income/expense/net, category breakdown, recent activity, and outstanding reviews. Distinguish authoritative balances from incomplete transaction totals.
- [ ] Make "Ohne Konto", later assignment, and reconciliation choices clear in normal/empty/first-run workflows.
- [ ] Improve transaction filters and bulk actions; use mobile lists/cards instead of page-wide overflowing tables.
- [ ] Add light/dark toggles on login and authenticated pages; default to system preference and preserve explicit device-local choices across reloads.
- [ ] Replace hardcoded custom colors with shared semantic theme variables across all pages and interaction states.
- [ ] Preserve API error codes/field paths in the client and map safe errors to form controls; complete shared-schema validation including account IBAN input.
- [ ] Cover loading, empty, stale/partial data, failed imports, expired sessions, and recoverable errors without losing necessary user input.
- [ ] Verify keyboard navigation, accessible labels, contrast, focus transitions, and responsive behavior across all pages; do not rely on color alone.
- [ ] Add desktop/mobile browser assertions for unassigned CSV, assignment/reconciliation, exact monthly amounts, transfer exclusion, and both themes including reload persistence.
- [ ] Record page/state acceptance and commit P1.3.

### P1.4 — Manual live Sparkasse queries

- [ ] Help the user choose appropriate Sparkasse access and prepare their own FinTS product registration; explain required user actions when this step begins. No registration currently exists.
- [ ] Obtain the application's own product ID and confirm the official Sparkasse Bodensee endpoint, BLZ, and available account/TAN capabilities; do not reuse an unrelated product ID.
- [ ] Complete discovery, balances, booked transactions, history ranges, TAN method/media selection, app approval/polling, cancellation, and safe retry through the existing adapter.
- [ ] Implement actionable setup/unsupported-method states and keep CSV independent when prerequisites are missing.
- [ ] Verify bank-provided polling/expiry limits, a single active run per connection, transient credentials, worker disposal, and no automatic incorrect-PIN retry.
- [ ] Complete synthetic success, successful authorization continuation, pending, rejected, expired, network failure, wrong-PIN, cancellation, concurrent-refresh, and worker-restart tests.
- [ ] Add mocked browser interactions for TAN selection, app approval, polling, failure, expiry, and cancellation; never use real credentials in browser tests.
- [ ] Separately perform user-assisted real discovery/balance/transaction/approval checks when prerequisites exist; document supported history and sanitized restrictions. Keep compatibility explicitly open otherwise.
- [ ] Update banking/user documentation, record exact proof/blockers, and commit P1.4.

### P1.5 — Final acceptance, recovery, and Stage 1 review

- [ ] Add missing session-expiry, login-rate-limit, invalid HTTP input/response serialization, and structured field-error regressions from the baseline audit.
- [ ] Run applicable formatting, lint, strict typechecks, schema/migration validation, unit/integration tests, production builds, and desktop/mobile browser checks on the final candidate.
- [ ] Validate shared contracts/API/OpenAPI/client compatibility and review required function/type documentation and Vue conventions.
- [ ] Verify the deployment-only bundle, exact registry image digests, migrations, health/readiness behavior, private API/database, HTTPS/LAN restrictions, and no unexpected external route.
- [ ] Test persistence and backup health after container recreation; perform shared-host reboot acceptance only in a separately approved window.
- [ ] Restore a populated encrypted target-host backup into an isolated application stack and verify login, accounts, transactions, categories, import history, and monthly reports. Never overwrite production.
- [ ] Use synthetic secret markers to check persistence, logs, error responses, and decrypted backups for PIN/TAN leakage; verify temporary plaintext cleanup.
- [ ] Verify seven-calendar-day backup retention with additional manual runs and separately held recovery keys.
- [ ] Record current images and a verified encrypted pre-update backup, coordinate a write pause, run reviewed migrations, and validate data before reopening access.
- [ ] Document compatible image rollback versus backup-based schema/data recovery; do not promise automatic down-migrations.
- [ ] Finish approved source/CI delivery and production rollout; update evidence and commit P1.5 documentation with its scoped implementation/checks.
- [ ] Review Stage 1 jointly with the user: layout, workflow, exact totals, CSV decisions, operations, and real-bank status. List unresolved bank prerequisites explicitly.
- [ ] Obtain explicit Stage 1 acceptance and separate permission before starting Stage 2. **Stop here until then.**

## Stage 2 — Monthly category budgets

Dependencies: explicit Stage 1 acceptance and separate implementation approval.

- [ ] Define shared contracts/persistence and a reviewed migration for monthly expense-category budgets, with exact cent amounts.
- [ ] Implement create/edit and explicit copy from the previous month; no automatic rollover.
- [ ] Define explicit refund identification and calculate consumption as expenses less those refunds, floored at zero; ordinary category income is not automatically a refund. Include booked unassigned data and exclude pending transactions/own transfers.
- [ ] Show budget, consumption, remainder, and overspending in responsive light/dark UI with field validation.
- [ ] Test month boundaries, refunds, category changes, unassigned/assigned equivalence, exact totals, and budget-copy behavior.
- [ ] Complete applicable checks, documentation, scoped commits, and approved delivery.
- [ ] Obtain separate Stage 2 acceptance and permission before Stage 3. **Stop here until then.**

## Stage 3 — Recurring-expense planning

Dependencies: explicit Stage 2 acceptance and separate implementation approval.

- [ ] Define shared contracts/persistence and reviewed migration for amount, category, start, optional end, and monthly/quarterly/yearly intervals.
- [ ] Decide end-date inclusivity and handling of partial/combined payments; default to explicit 1:1 matching, without implementing these features during Stage 1.
- [ ] Implement create/edit/end and next-due-date calculation, preserving the intended monthly day across short months and leap years.
- [ ] Show upcoming payments, the amounts actually due in the selected month, and a separately labeled monthly average; round only displayed fractional-cent equivalents.
- [ ] Keep planning entries out of real transactions and actual reports; do not initiate payments or create real bookings automatically.
- [ ] Allow explicit matching to a real transaction and prevent duplicate matching of one planned occurrence.
- [ ] Implement responsive light/dark UI, validation, and tests for month ends, leap years, ended series, intervals, and duplicate matching.
- [ ] Complete applicable checks, documentation, scoped commits, approved delivery, and final user acceptance.

## Completion rules

- [ ] Complete only work backed by actual code/checks/recorded acceptance; this documentation commit does not complete expansion work.
- [ ] Preserve existing user/financial data and explicitly document any compatibility limit or external bank blocker.
- [ ] Keep the server deployment-only and all source development local; verify no repository or build dependency remains on rocky after the approved transition.
- [ ] Report current activity, remaining work, and required user actions at handoffs; do not claim background work that is not running.
