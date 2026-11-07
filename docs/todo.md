# Expansion implementation checklist

Plan and decisions: [ausbauplan.md](ausbauplan.md), refined by the [binding user plan](HAUSHALTSBUCH_CODEX_PLAN.md). Stage 1 of [issue #3](https://github.com/mfurti/financial-tracking/issues/3) is approved; PRs #4–#7 are merged. Current separately approved deployment: `a2ea737`, web `.33`, runtime-only server. The user explicitly requested the U1–U5 experience revision below. Real-bank acceptance, new rollout and host reboot retain separate approvals. Stages 2/3 remain gated.

The previous checklist, including the audited delivery evidence and remaining baseline checks, is preserved in [initial-implementation-checklist.md](initial-implementation-checklist.md). Its open work is carried into the tasks below; checked historical implementation is not proof of expansion acceptance.

## Current baseline and gates

- [x] Deliver initial ledger through issue #1 / PR #2, merged as `d0f90de395461376e94b79db8ca420d9906d215a`.
- [x] Record running deployment under `/root/docker/financial-tracking`, trusted Traefik HTTPS, user-confirmed login, and 13 default categories.
- [x] Record initial target-host schema restoration, separate synthetic financial-data restoration in CI, encrypted backups, and private backup identity held off-server.
- [x] Audit old checklist and preserve its evidence without claiming new test or server results.
- [x] Agree on three-stage expansion, account-independent CSV, per-candidate reconciliation decisions, `.33` container address, and complete light/dark interface redesign.
- [x] Record issue #3 and obtain explicit Stage 1 implementation approval in the current checkout after showing its link.
      Per-task rule: confirm prerequisites and preserve unrelated work; complete relevant source, tests, documentation, validation and a scoped commit together. This is an ongoing rule rather than unfinished feature work.

Ongoing rules: develop source locally only; never store real PIN/TAN in chat, source, fixtures, database, logs, backups, or browser persistence. No server repository or builds. Never count fixture bank results as real compatibility proof.

## P0 — Inventory and baseline

- [x] Inspect branch, commits, worktree, source/migrations, scripts, CI, tests, and all three plans; preserve the untracked user document and its original SHA-256 in `.local/p0`.
- [x] Fetch the remote base and retain local documentation commit `621c979` on the issue branch; no reset, clean, stash, or server connection performed.
- [x] Use existing Node 24.22.1 runtime and pnpm 11.25.0 without changing system Node 26 or package pins.
- [x] Run baseline lint, all 26 tests on disposable PostgreSQL, strict typechecks, production builds, and both desktop/mobile browser profiles. Record the pre-existing user-plan formatting failure separately.
- [x] Consolidate stricter user-plan requirements, Stage 2 refund semantics, and later recurrence decisions without implementing later-stage features.
- [x] Record the prioritized file/dependency/check matrix and baseline evidence in [progress.md](progress.md#p0--expansion-baseline-2026-11-07).
- [x] Commit the validated P0 documentation before feature implementation: `e2e4963`.

## Stage 1 — Complete and validate the ledger

### P1.1 — Registry images and deployment-only server

- [x] Add CI image builds for API, web, and backup; keep migration execution in the matching API image. Label images with source/revision and use commit tags.
- [x] Gate GHCR publication on successful checks for the same revision; keep PR validation separate from production publication.
- [x] Verify private GHCR publication and successful exact-digest pulls on rocky through protected Docker credentials without exposing registry secrets.
- [ ] Confirm or restrict the existing server credential to read-only package access; successful pulls do not prove minimal token scope.
- [x] Create one production `compose.yaml` containing digest-pinned `image:` references, no `build:`, no Dockerfile dependency, and no source mounts. Keep backup/restore scripts inside the image.
- [x] Reinspect the other actual Compose files and `FRITZBOX` / `traefik-public` networks during implementation. Compare static addressing and Traefik conventions rather than guessing.
- [x] Verify `.33` is outside the user-confirmed DHCP pool `.200–.254`, absent from inspected Docker assignments and unanswered by ARP probes; obtain the user's confirmation that it is unassigned before allocation.
- [x] Prepare web `.33` on external `FRITZBOX`, plus Traefik/backend networking. Retain the canonical domain, existing TLS resolver, LAN middleware, and security headers. Publish no application host ports; keep API/database off the LAN.
- [x] Prevent direct Macvlan requests bypassing Traefik protections; assess actual peer addresses and reject spoofed forwarding headers instead of trusting them as evidence of proxy traversal.
- [x] Put PostgreSQL, API database-readiness, web-readiness, and backup-freshness healthchecks directly in Compose. Gate API startup on successful migration.
- [x] Preserve in the deployment definition the Compose project name, `household-ledger_postgres_data`, secrets, and backup storage; compare data before/after recreation.
- [x] Fix backup retention to preserve at least seven calendar days despite extra manual snapshots; keep independent keys and document manual off-host copies accurately.
- [x] Test isolated image-only installation, readiness failure/recovery and runtime source exclusions in Linux CI; verify actual private publication and target pulls through PR #7 rollout.
- [x] Produce a versioned downloadable deployment bundle containing Compose/config templates/instructions only; prove missing-secret, registry-unavailable, and failed-migration behavior without touching production.
- [x] After successful production transition and verification, remove the old server source tree and the two obsolete `/opt/financial-tracking` path rules. Preserve Compose/env/secrets, database volume and backups.
- [x] Update deployment/recovery documentation, record actual checks, and commit P1.1. Production rollout still requires its applicable approval.

P1.1 initial code/CI evidence: `4af2e65`, `8512215`. Actual approved rollout: 2026-11-07, revision `be3d8ab`, web `192.168.178.33`, four healthy runtime services, successful migrator, HTTPS 200 and direct/spoofed-header denial 403. See [stage-one-acceptance.md](stage-one-acceptance.md) for backup and preservation evidence.

### P1.2 — CSV without an account or bank connection

- [x] Review existing data and add a preservation-safe migration for unassigned transaction/staging account associations and explicit non-null identity scopes. Preserve existing account IDs and backfill their identity scopes.
- [x] Update shared Zod contracts, runtime validation/serialization, OpenAPI, and clients for optional CSV targets, unassigned responses/filters, assignment, and reconciliation choices.
- [x] Allow file selection, mapping, bounded preview, partial-import consent, confirmation, and cancellation with zero accounts/connections; require no hidden placeholder account.
- [x] Persist unassigned transactions in "Ohne Konto" with categorization, immediate global/monthly totals, and explicit filtering; exclude them from specific-account totals.
- [x] Support later assignment of individual/selected transactions with candidate comparison against existing CSV/live records.
- [x] Offer bank values, CSV values, a separate transaction, or skipping assignment per candidate; show conflicting values before overwrite confirmation.
- [x] Make consolidation/identity updates atomic; preserve provenance and manual categories/transfer annotations by default. Ensure one resulting transaction is counted once.
- [x] Make repeated confirmations idempotent and detect concurrent assignment/merge conflicts. Show source/date/amount/text/account/category/status differences before resolving each candidate.
- [x] Keep unassigned identities import-scoped; use explicit review for possible cross-file duplicates instead of trusting globally repeated bank references or nullable unique keys.
- [x] Test old-data migration, repeated/partially overlapping CSVs, genuine equal-looking purchases, CSV/FinTS overlap, conflicting references, preservation of categories/transfer flags, rollback, and each reconciliation decision.
- [x] Test cent-exact totals before/after assignment/consolidation, month/year boundaries, refunds, transfer exclusion, and pending-to-booked reconciliation.
- [x] Document compatibility and coordinated migration/client rollout; record checks and commit P1.2.

P1.2: `07ebc21`; 42 tests and four browser projects passed locally; GitHub verify/operations passed. No production migration executed.

### P1.3 — Calm, responsive interface and themes

- [x] Redesign the application shell/navigation and all ledger pages with consistent Nuxt UI components, typography, spacing, and feedback.
- [x] Redesign dashboard month selection, income/expense/net, category breakdown, recent activity, and outstanding reviews. Distinguish authoritative balances from incomplete transaction totals.
- [x] Make "Ohne Konto", later assignment, and reconciliation choices clear in normal/empty/first-run workflows.
- [x] Improve transaction filters and bulk actions; use mobile lists/cards instead of page-wide overflowing tables.
- [x] Add light/dark toggles on login and authenticated pages; default to system preference and preserve explicit device-local choices across reloads.
- [x] Replace hardcoded custom colors with shared semantic theme variables across all pages and interaction states.
- [x] Preserve API error codes/field paths in the client and map safe errors to form controls; complete shared-schema validation including account IBAN input.
- [x] Cover loading, empty, stale/partial data, failed imports, expired sessions, and recoverable errors without losing necessary user input.
- [x] Verify keyboard navigation, accessible labels, contrast, focus transitions, and responsive behavior across all pages; do not rely on color alone.
- [x] Add desktop/mobile browser assertions for unassigned CSV, assignment/reconciliation, exact monthly amounts, transfer exclusion, and both themes including reload persistence.
- [x] Record page/state acceptance and commit P1.3.

### P1.4 — Manual live Sparkasse queries

- [x] Help the user choose appropriate Sparkasse access and prepare their own FinTS product registration; explain required user actions when this step begins. No registration currently exists.
- [ ] Obtain the application's own product ID and confirm the official Sparkasse Bodensee endpoint, BLZ, and available account/TAN capabilities; do not reuse an unrelated product ID.
- [x] Complete discovery, balances, booked transactions, history ranges, TAN method/media selection, app approval/polling, cancellation, and safe retry through the existing adapter.
- [x] Implement actionable setup/unsupported-method states and keep CSV independent when prerequisites are missing.
- [x] Verify bank-provided polling/expiry limits, a single active run per connection, transient credentials, worker disposal, and no automatic incorrect-PIN retry.
- [x] Complete synthetic success, successful authorization continuation, pending, rejected, expired, network failure, wrong-PIN, cancellation, concurrent-refresh, and worker-restart tests.
- [x] Add mocked browser interactions for TAN selection, app approval, polling, failure, expiry, and cancellation; never use real credentials in browser tests.
- [ ] Separately perform user-assisted real discovery/balance/transaction/approval checks when prerequisites exist; document supported history and sanitized restrictions. Keep compatibility explicitly open otherwise.
- [x] Update banking/user documentation, record exact proof/blockers, and commit P1.4.

### P1.5 — Final acceptance, recovery, and Stage 1 review

- [x] Add real HTTP/PostgreSQL session-expiry, login-rate-limit, safe invalid-input/field-path and response-serialization regressions.
- [x] Run final local format/lint/strict types, schema/migration tests, production builds, 60 tests and eight desktop/mobile browser cases. Record the Windows test-cleanup race and verified fix.
- [x] Review shared contracts/API/OpenAPI/client compatibility, function/type documentation and Vue conventions.
- [x] Restore the actual initialized encrypted target-host backup locally, apply forward migrations, compare existing rows/hash, and verify isolated login/accounts/categories/history/report/responsive UI. Record the explicit limitation: this archive has no financial transactions.
- [x] Pass extended Linux CI for source candidate `7754522`: 61 tests, eight browser cases, populated PostgreSQL 17/API/web encrypted recovery, login/history/reports, PIN/TAN marker scans and plaintext cleanup. Both [push](https://github.com/mfurti/financial-tracking/actions/runs/42386882489) and [PR](https://github.com/mfurti/financial-tracking/actions/runs/42386886259) runs passed.
- [x] Confirm image-only CI startup, readiness/dependency recovery, private API/database, direct-access denial, volume recreation and backup health for tested source candidate `7754522`. Actual target rollout remains open below.
- [x] Verify seven-calendar-day retention with extra manual-run fixtures; retain the separately held recovery identity and prove actual archive decryption.
- [x] Document schema-compatible image rollback versus backup recovery, with no automatic down-migration promise.
- [x] Merge approved [source PR #4](https://github.com/mfurti/financial-tracking/pull/4) and [publisher PR #5](https://github.com/mfurti/financial-tracking/pull/5) after green current-head CI; main `be3d8ab` passed verify/operations/publication in run 42389714786.
- [x] Verify private GHCR publication, exact immutable digests, deployment-only bundle and successful target pulls. Existing credential minimum-scope review remains separately open above.
- [x] Implement the publisher correction in [PR #5](https://github.com/mfurti/financial-tracking/pull/5): resolve registry manifest metadata, retain revision/main gates, and pass six publisher/two bundle regressions. Actual main publication and target pulls remain part of the registry gate above; current CI controls merge readiness.
- [x] Recheck DHCP/exclusion/ARP and obtain user confirmation that `.33` is unassigned before allocating it during the approved rollout.
- [x] Obtain rollout approval, record old image/config state, pause writes, verify a fresh encrypted backup off-server, migrate and validate preserved data/HTTPS/private access/readiness/automatic backup. Existing production password was not changed; the user's renewed login/UI acceptance remains open below.
- [x] Remove obsolete server source/build files and the two old `/opt` rules after successful technical transition; preserve runtime configuration, secrets, database volume and backups.
- [ ] Perform shared-host reboot acceptance only in a separately approved window.
- [ ] Complete user-assisted real-bank compatibility after the user's own registration and confirmed endpoint; record history/TAN/media restrictions without credentials.
- [ ] Review Stage 1 jointly: layout, workflow, exact totals, CSV decisions, operations and explicit real-bank limitations. See [stage-one-acceptance.md](stage-one-acceptance.md).
- [ ] Obtain explicit Stage 1 acceptance and separate permission before starting Stage 2. **Stop here until then.**

## Stage 1 user acceptance corrections, before Stage 2

- [x] Reproduce strict UTF-8 rejection with synthetic Windows-1252 bank bytes; detect supported formats, allow re-decoding without reselection and explain all import choices. Add UTF-16/Latin-9/tab metadata through shared Zod, runtime API and OpenAPI.
- [x] Replace raw local exception/validation text with safe actionable German messages and concrete CSV row diagnostics; preserve field paths, request IDs, drafts, financial identities and partial-import consent.
- [x] Replace three theme controls with one animated accessible light/dark button; retain initial system preference and persisted explicit choice, honor reduced motion.
- [x] Verify 74 tests and eight desktop/mobile import/error/theme/bank-state journeys, including keyboard/reload/reduced-motion behavior. Recheck both import journeys after final focus/layout corrections; inspect synthetic screenshots.
- [x] Merge PR #7 after both green current-head runs and perform separately approved rollout of `a2ea737` after main CI 42397313981 publication. Fresh encrypted recovery passed in 9 seconds; 14 tables/migration state preserved, 31-second pause/start, four healthy services and productive browser/proxy checks.
- [ ] Obtain acceptance of the user's actual CSV and everyday workflow; synthetic success and deployment do not replace that check.

## Current experience revision — U1–U5

- [x] U1: incorporate the user's latest direction into both plans, audit stale implementation/deployment entries and preserve genuine external gates.
- [x] U2: upload-and-analyze happy path, Sparkasse purpose precedence, optional full-file period in shared response/runtime/OpenAPI and actual monthly analytics. Retain exception/partial/duplicate handling; verify lost-response recovery without another POST and abandoned-preview cancellation. Passed 27 focused tests and all 12 browser cases.
- [x] U3: 18 adapted theme families in Settings, build-time palette CSS/early allowlisted preference, device-local persistence and one 44×44 circular mode control. Passed 19 palette/bootstrap tests and four real desktop/mobile appearance/interface journeys, including every family/mode, reload/logout and reduced motion.
- [x] U4: new Finanzguru-inspired cards/dashboard/compact mobile navigation; category purpose, real monthly totals/counts and secondary management, with empty/error/loading/uncategorized states. Verified real assignments, failed-month retry, mobile disclosure/focus and synthetic responsive views; separate browser test instances preserve production login limits.
- [ ] U5: update user guide/evidence, finish feature checks, open PR and verify full CI; obtain new action-specific merge/rollout approvals.

Still external: real-file/joint acceptance, own FinTS registration plus bank-confirmed endpoint/live test, registry minimum-scope review and separately approved shared-host reboot. These are not silently marked done by this UI revision.

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
