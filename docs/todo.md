# Expansion implementation checklist

## Active approved implementation — UX0–UX5

Approved [contract usability plan](vertragsanalyse-usability-plan.md), existing checkout, issue #3, branch `codex/3-contracts-import-usability`. PR #10 is merged and production rollout of `3b990ec` succeeded: fresh encrypted restore, 13 original application tables preserved, four healthy services, HTTPS/proxy/read-only analytics checks. Delivery evidence: issue #3 comment 6722694054. New merge/rollout approval remains separate.

- [x] UX0: save approved plan and synchronize delivery/checklist/task record.
- [x] UX1: previewed, atomic CSV rollback and reupload with source/link protection.
- [x] UX2: permanent management links, mobile More page, clearer headings/colors/icons and concise copy.
- [x] UX3: monthly fixed-cost card and category/kind contract analytics.
- [x] UX4: editable review cards and persistent accept/dismiss/restore decisions.
- [x] UX5: full local/visual verification and [PR #11](https://github.com/mfurti/financial-tracking/pull/11). Linux [CI 42497875724](https://github.com/mfurti/financial-tracking/actions/runs/42497875724) passed source 2f93e95: 131 tests, all 20 browser scenarios and extended encrypted restore. Merge after green current CI explicitly approved; final documentation-head checks still gate merge, and rollout remains separate.

## Delivered implementation — F0–F6

Historical F0–F6 implementation: [Finanzfluss implementation plan](finanzfluss-umsetzungsplan.md), preserved audit `392d988`, merged PR #10. Production was separately approved and rolled out as `3b990ec`; see the current delivery record above.

- [x] F0: save the approved plan and synchronize the existing task record/checklist; relevant Markdown checks pass before commit.
- [x] F1: consistent Nuxt UI controls, dates/months, clarification and existing keyboard/mobile journeys. Lint, strict types, production build and all 16 browser scenarios verified; focused six-case rerun passed after waiting for menu exit animations.
- [x] F2: 23 theme tiles, six Ayu variants, circular Nuxt UI toggle and compatible early persistence. Twenty contrast/storage tests and both browser profiles passed; all four viewport widths checked.
- [x] F3: category templates/rules, manual provenance and fixed/variable metadata with additive migration, API/UI and preservation tests. All 100 tests, both extended browser journeys, format/lint/types and production builds passed.
- [x] F4: confirmed contracts, versioned recurrence, unique payment matches, history/marking and next-due ordering with additive migration/API/UI/tests. All 108 tests and both contract browser journeys passed; shared transport handles nested IDs.
- [x] F5: exact multi-month analytics, valid average/trend denominators, breakdown/drill-down and final navigation/dashboard. Seven new calculation/API tests and both focused analytic browser journeys passed; complete suite/visual/CI acceptance continues in F6.
- [x] F6: guide/evidence/checklist, full local checks/visual matrix and [PR #10](https://github.com/mfurti/financial-tracking/pull/10). Linux [CI 42479998163](https://github.com/mfurti/financial-tracking/actions/runs/42479998163) passed on code revision 0320fd0, including all 20 browser scenarios and extended encrypted restore. PR #10 merge after green CI is explicitly approved; production rollout remains separate.

Plan and decisions: [ausbauplan.md](ausbauplan.md), refined by the [binding user plan](HAUSHALTSBUCH_CODEX_PLAN.md). [Issue #3](https://github.com/mfurti/financial-tracking/issues/3) remains open. PRs #4–#10 are merged; the last verified deployment is `3b990ecaba356c0bfe85a79bb87915c41eac0967`, web `.33`, runtime-only server. The new user instruction selects Finanzfluss Copilot as the primary reference and requests Nuxt UI consistency, analyses, contracts and theme tiles. The source audit below separates these missing features from earlier delivery. Budgets remain separate backlog; real-bank access, host reboot and any new rollout retain their own gates.

The previous checklist, including the audited delivery evidence and remaining baseline checks, is preserved in [initial-implementation-checklist.md](initial-implementation-checklist.md). Its open work is carried into the tasks below; checked historical implementation is not proof of expansion acceptance.

## Current source audit — 2026-11-07

- [x] Check source/routes/schema against the new request: existing analytics is one monthly report; category CRUD exists. Range analyses, categorization rules and contract models/routes/pages do not exist.
- [x] Correct delivery status using recorded evidence: PR #8 `f1b3e78` and PR #9 `1e33afa` merged/deployed; [main CI 42417004125](https://github.com/mfurti/financial-tracking/actions/runs/42417004125) passed 95 tests, 16 browser cases, operations/recovery and publication. Fresh write-stopped backup restored in nine seconds, all 14 tables preserved, 103-second pause, four healthy services. Encrypted current configuration was explicitly approved, copied off-server and authenticated. This audit did not rerun those checks or access production.
- [x] Identify unfinished Nuxt UI adoption: native selects/date/month/checkbox/disclosure controls remain in transactions, CSV import, import clarification, bank connections, account assignment, category management, Settings and navigation. Earlier redesign completion does not mean all controls are Nuxt UI.
- [x] Compare the local Habit Tracker reference: theme cards have actual color previews and selection indicators. Financial Tracking still uses a select and one generic Ayu family.

### Requested product work — implementation mapped to F0–F6

- [x] N1 — Consistent Nuxt UI controls throughout the application, including searchable long selections, validation, disabled/loading/error states, confirmations, keyboard focus and compact mobile navigation. Preserve the circular mode button and import/assignment/partial-consent behavior.
- [x] N2 — Date selection following the official InputDate “As a date picker” example: German `UInputDate`, `UPopover`, `UCalendar`; range selection where needed and clear monthly report selection. Preserve calendar dates without timezone shifts, clearing, URL filters and keyboard/mobile behavior.
- [x] N3 — Theme cards like the Habit Tracker, with faithful mini previews, a visible selection indicator and device persistence. Include Ayu Light, Mirage and Dark, each bordered/unbordered; retain saved preferences, mode toggle, contrast and reduced motion.
- [x] N4 — A dedicated Analyses page: 3/6/12-month and chosen-period views, average expenses, comparable trends in euros/percent, category distribution and drill-down into the underlying transactions. Specify missing/incomplete months and zero comparison bases; preserve exact cents, transfer/pending exclusion and accountless records. Distinguish confirmed fixed costs from unclassified spending.
- [x] N5 — Keep existing category management; add useful category templates and deterministic assignment rules with visible reasons. Preserve manual assignments, avoid guessing ambiguous categories and explain why a booking remains uncategorized.
- [x] N6 — Contracts for subscriptions, rent, insurance, energy, internet and other recurring payments: real persistence, create/edit/end, intervals, next payment, monthly/yearly equivalents and user-entered cancellation data. Recurrence suggestions need sufficient evidence and confirmation; actual transactions remain separate and must not be counted twice. Reuse the recurrence requirements below without requiring unrelated budget implementation first.
- [x] N7 — Finanzfluss-inspired navigation: Overview, Transactions, Analyses, Contracts, More. Put category analysis under Analyses and make import a reachable action. Replace vague import “checks” with specific “bookings to clarify,” showing the reason, candidates and consequences; known duplicates remain automatic, uncertain matches remain explicit.
- [x] N8 — Detailed implementation plan/task record, API/shared-Zod/OpenAPI review, reviewed additive migration where needed, preservation tests, complete UI journeys and synthetic visual acceptance. Scoped commits and PR; new merge/rollout approval applies only to that concrete revision. No real bank access or server source checkout.

The subsequent Plan-mode review and explicit implementation request approved finanzfluss-umsetzungsplan.md. N1–N8 remain the requirement inventory; F0–F6 above track implementation. Approval does not claim completed features, blanket Stage 1 acceptance or production deployment approval.

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

- [x] Deliver the initial application shell/cards/ledger-page redesign, typography, spacing and feedback.
- [x] Finish consistent Nuxt UI adoption: F1/F2 controls/date/month/theme work, F3/F4 forms and F5 charts/navigation. Final integrated acceptance remains F6.
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
- [x] U5 source checks: update user guide/evidence, pass all 94 tests and 16 browser cases, format/lint/types/production build. U1 `52525a6`, U2 `5772824`, U3 `79e0413`, U4 `4fdc508`.
- [x] U5 delivery: [PR #8](https://github.com/mfurti/financial-tracking/pull/8) opened; [PR CI 42414991656](https://github.com/mfurti/financial-tracking/actions/runs/42414991656) and push CI 42414959543 passed verification plus Linux container/backup/restore operations for `0a87b70`. User authorized this PR's merge and rollout after green CI.

Delivery rule: recheck full CI for any subsequent head before merging; await successful main image publication, fresh encrypted backup/recovery and target checks before claiming rollout complete. Current delivery evidence is maintained in issue #3. Approval is not proof of execution.

Still external: real-file/joint acceptance, own FinTS registration plus bank-confirmed endpoint/live test, registry minimum-scope review and separately approved shared-host reboot. These are not silently marked done by this UI revision.

### Confirmed short-year import follow-up

- [x] D1: support the user's confirmed Sparkasse `TT.MM.JJ` dates (booking and value date, explicit 2000–2099), retain strict calendar checks and existing formats; update guidance and parser/real-upload regression evidence. All 95 tests and four focused desktop/mobile import cases passed; format/lint/types/build passed.

- [x] D2 delivery: approved PR #9 merged as `1e33afa`; combined PR #8/#9 rollout completed after successful main CI 42417004125, fresh write-stopped backup/recovery and all-table preservation. The intermediate PR #8-only rollout was intentionally skipped. Current encrypted runtime configuration is also verified off-server. Evidence: issue #3 and the current audit above.

## Stage 2 — Monthly category budgets

Dependencies: explicit Stage 1 acceptance and separate implementation approval.

- [ ] Define shared contracts/persistence and a reviewed migration for monthly expense-category budgets, with exact cent amounts.
- [ ] Implement create/edit and explicit copy from the previous month; no automatic rollover.
- [ ] Define explicit refund identification and calculate consumption as expenses less those refunds, floored at zero; ordinary category income is not automatically a refund. Include booked unassigned data and exclude pending transactions/own transfers.
- [ ] Show budget, consumption, remainder, and overspending in responsive light/dark UI with field validation.
- [ ] Test month boundaries, refunds, category changes, unassigned/assigned equivalence, exact totals, and budget-copy behavior.
- [ ] Complete applicable checks, documentation, scoped commits, and approved delivery.
- [ ] Obtain separate Stage 2 acceptance and permission before Stage 3. **Stop here until then.**

## Recurring-expense source delivery — approved F4/F5 supersedes the old Stage 2 dependency

The explicit Finanzfluss implementation approval made contracts independent of budget implementation. The original stage checklist is preserved in initial-implementation-checklist.md; the new source delivery maps to F4/F5 rather than claiming budget completion or production acceptance.

- [x] Shared contracts/persistence and reviewed additive migration for amount, category, start, inclusive end and monthly/quarterly/half-yearly/yearly intervals.
- [x] Decide inclusive ending and explicit 1:1 actual payment ownership; no partial/combined payment support.
- [x] Create/edit/end, time-effective future changes and next-due calculation, retaining month-end/leap anchors.
- [x] Show upcoming dates/history and separately labeled rounded monthly/yearly contract planning equivalents.
- [x] Keep forecasts out of real transactions and actual reports; no payment initiation.
- [x] Match one real booking per occurrence, preserve links through consolidation and reject competing links atomically.
- [x] Nuxt UI forms/history, light/dark styling and date/identity/mismatch/preservation tests; feature-wide proof remains F6.
- [ ] Separate future planning enhancement: aggregate all contracts' forecast amounts due in a selected month. The approved F0–F6 plan delivers next-due ordering and per-contract history, not this aggregate budget/planning view.
- [x] F0–F6 delivery: PR #10 merged and 3b990ec rolled out with fresh encrypted restore and preserved data.
- [ ] UX0–UX5 delivery: new feature PR merge, production rollout and user acceptance remain separately gated.

## Completion rules

- Complete only work backed by actual code/checks/recorded acceptance; source completion and external acceptance remain distinct.
- Preserve existing user/financial data and explicitly document any compatibility limit or external bank blocker.
- Keep the server deployment-only and all source development local; verify no repository or build dependency remains on rocky after any approved transition.
- Report current activity, remaining work, and required user actions at handoffs; do not claim background work that is not running.
