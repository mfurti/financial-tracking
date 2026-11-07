# Household ledger expansion plan

Agreed on 2026-11-07. This document records the three-stage plan and user decisions. Current authorization: save the plan, revise the checklist, and commit documentation only. No expansion implementation, image publication, server changes, or bank access is authorized by this documentation commit.

Execution checklist: [todo.md](todo.md). Initial delivery evidence and unresolved baseline checks: [initial-implementation-checklist.md](initial-implementation-checklist.md). The original [plan.md](plan.md) and detailed specification remain historical inputs; this plan takes precedence for changed requirements.

## Goal and constraints

- Retain the pnpm monorepo, Nuxt UI frontend, NestJS backend, PostgreSQL/Prisma, and shared browser-safe Zod contracts. Keep EUR integer cents internally and decimal strings over the API.
- Work on source exclusively in the local checkout. GitHub Actions builds/tests images; rocky only pulls finished images from GHCR.
- Keep only `compose.yaml`, `.env`, and required secrets/configuration under `/root/docker/financial-tracking` on rocky. No source checkout, Dockerfiles, build contexts, or local image builds on the server. Runtime application code and migrations belong inside images.
- Preserve existing financial data, user credentials, categories, and annotations during upgrades. Keep the private backup identity off-server.
- Stage 1 completes the existing ledger. Stages 2 and 3 add budgets and recurring-expense planning respectively. Payment initiation, public signup, multiple users, investments, and unattended bank synchronization remain excluded.
- After Stage 1, stop for a joint review and explicit user acceptance. Passing CI does not authorize starting Stage 2. Stage 2 also receives a separate acceptance before Stage 3.

## Stage 1 — Complete the existing ledger

### P1.1 — Registry images and deployment-only server

Dependencies: implementation approval and the existing baseline acceptance evidence. Outcome: recoverable production deployment without a server-side repository.

- Publish tested API, web, and backup images from GitHub Actions, labeled with source/revision and tagged by commit. Publish only after successful checks on the same revision. Deployment pins image digests; the migrator uses exactly the API image deployed for that release. PR validation must not publish production images.
- Default to private GHCR packages, CI publication using `GITHUB_TOKEN`, and read-only registry credentials on rocky. Never commit credentials or embed them in Compose literals. See [GitHub image publication](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images) and [registry authentication](https://docs.github.com/en/packages/working-with-the-container-registry).
- Provide one standalone production `compose.yaml`, with `image:` references only and no mounts into a source tree. PostgreSQL uses an explicitly pinned upstream image. Backup/restore scripts are packaged in the backup image, not copied from a repository on rocky.
- Reinspect other actual Compose files during implementation. Planning inspected habit-tracker, bambuddy, and dbf: the existing external `FRITZBOX` network is macvlan on `eno1`, subnet `192.168.178.0/24`, gateway `192.168.178.1`; bambuddy demonstrates fixed LAN addressing plus `traefik-public`. Docker reported no container assigned `.33`. This does not establish DHCP availability or absence of a non-Docker device.
- Before allocating `192.168.178.33`, verify DHCP reservation/exclusion and address conflicts. Give the web container this address on `FRITZBOX`, plus its existing Traefik and backend-network connections. Preserve the canonical browser URL `https://haushaltsbuch.mfurti.de`, existing Traefik certificates, LAN middleware, and application security headers. The IP is a container address, not a request to move the domain to `.33`. Keep API/database off the LAN and publish no application host ports.
- Put healthchecks directly in Compose: PostgreSQL, API database readiness, web readiness, and backup freshness. Return generic health results, never financial data or secrets. Require successful one-shot migration before API startup; do not invent a perpetual healthcheck for the completed migrator.
- Preserve project name `household-ledger`, the existing `household-ledger_postgres_data` volume, secrets, and encrypted backup storage. Test migration/recreation without resetting data.
- Fix retention to preserve at least seven calendar days; additional manual backups must not shorten that window. Continue daily encrypted backups. Recurring off-host backup automation is not part of this plan; document the manual off-host copies accurately.
- After successful registry deployment and verification, remove the old source tree from the server while retaining the deployment allowlist and all required data/secrets. Remove obsolete application SELinux path rules. Do not delete shared services, persistent volumes, or backups.

Acceptance: a clean deployment directory starts the tested digest-pinned images without source/build tools; existing data survives, `.33` is conflict-free, healthchecks pass, and HTTPS/access restrictions remain effective.

### P1.2 — Account-independent CSV imports

Dependencies: reviewed data/API migration design; P1.1 must be ready before production rollout. Outcome: CSV works with zero accounts and zero bank connections.

- Upload, map columns, preview, review errors, and confirm CSV without creating an account or bank connection. Retain existing size/row limits, encoding handling, partial-import consent, and cancellation.
- Persist real unassigned transactions, shown as "Ohne Konto". Allow categorization and include booked unassigned transactions immediately in global/monthly totals. Specific-account filters exclude them; offer an explicit unassigned filter.
- Assign individual or selected transactions to an account later. Before assignment, compare with existing CSV/live records and show candidate differences.
- For each candidate, let the user choose bank values, CSV values, a separate transaction, or skipping assignment. Consolidation and identity updates are atomic, preserve provenance, and count the resulting transaction exactly once. Preserve manual categories/transfer annotations by default; show conflicts and require confirmation before overwriting them.
- Extend the data model for nullable transaction/staging account associations without changing existing assignments. Keep import identity scopes explicit and non-null; nullable account IDs must not weaken uniqueness. Backfill existing identity scopes from account IDs. New unassigned identities are import-scoped; repeated/overlapping files can require review instead of blindly merging identical references from unrelated sources.
- Review and test migration SQL and old-data preservation. Coordinate the API/client rollout during maintenance: older consumers requiring account IDs must not serve newly unassigned records.
- Update shared Zod inputs/responses, runtime validation, serialization, OpenAPI, import processing, and report consumers together. Cover optional CSV target accounts, nullable transaction account IDs, unassigned filtering, and explicit account-assignment/reconciliation requests. Do not leak Prisma or FinTS internals.

Acceptance: the user imports and analyzes a CSV on an empty installation, then assigns/merges it with bank records without duplicate totals or silent annotation loss.

### P1.3 — Complete interface redesign

Dependencies: P1.2 contracts for unassigned data. Outcome: a calm, legible German interface using consistent Nuxt UI components.

- Redesign navigation, dashboard, accounts, transactions, categories, imports/review, connections, and settings. Retain core workflows while improving labels, hierarchy, spacing, feedback, and forms.
- Dashboard: month selection, income/expense/net, category breakdown, recent transactions, and outstanding import reviews. Distinguish unknown authoritative balances from transaction-derived totals and clearly identify unassigned data.
- Provide accessible filters and bulk actions. Use responsive lists/cards on phones instead of page-wide tables. Cover empty, loading, failure, partial-success, and expired-session states across pages.
- Add a visible light/dark toggle on both login and authenticated pages. Start with the system preference; persist an explicit device-local choice and restore it on reload. Use Nuxt's existing color-mode integration and semantic theme variables for all custom surfaces, text, borders, controls, and data displays. See [Nuxt Color Mode](https://color-mode.nuxtjs.org/usage/basic).
- Preserve structured API error codes/field paths through the client and attach safe validation messages to relevant controls. Complete consistent shared-schema form validation, including account IBAN input.
- Verify keyboard use, labels, focus after navigation/dialogs/errors, readable contrast, and mobile layout. Financial status must not rely on color alone.

Acceptance: the complete CSV-to-report workflow is usable by keyboard and on desktop/phone in both themes, including first-run and error paths.

### P1.4 — Finish live bank-query integration

Dependencies: existing FinTS adapter, shared contracts, and separate real-bank prerequisites. Outcome: complete manual live-query workflow, with honest compatibility status.

- Finish account discovery, balances, transaction reads, TAN method/media selection, approval status/polling, cancellation, and safe retry through the existing connector boundary.
- At this step, help the user choose the appropriate Sparkasse access and complete the application-specific FinTS product registration. No product ID is currently available. Confirm the bank's official endpoint and supported authorization method; do not borrow another application's ID. See [official registration](https://www.fints.org/de/hersteller/produktregistrierung) and [registration FAQ](https://www.fints.org/de/hersteller/faq-produktregistrierung).
- PIN/TAN remain transient and user-entered for manual runs. No automatic incorrect-PIN retry, protocol/body logging, persisted authorization state, or unattended bank synchronization.
- Explain missing configuration and unsupported authorization formats in actionable UI states. Keep CSV operational independently. Release worker resources on completion, failure, cancellation, expiry, and restart.
- Independently test real discovery, balances, transactions/history limits, and available approval with the user; record sanitized outcomes only. Fixture success does not establish live Sparkasse compatibility.

Acceptance: the technical workflow passes synthetic cases; real compatibility is accepted only after the real-account check. Missing registration/bank prerequisites remain explicit blockers, never a claimed success.

### P1.5 — Functional acceptance and rollout

Dependencies: P1.1–P1.4 and all remaining baseline checks mapped into the checklist.

- Extend existing regression coverage for session expiry/rate limits, invalid API input/output, field errors, overlapping CSV/FinTS imports, preserved annotations, year boundaries, pending-to-booked transitions, and bank success/pending/rejection/expiry/network/cancellation/restart behavior.
- Add browser assertions for unassigned import, later assignment, each reconciliation decision, exact monthly totals/transfer exclusion, both themes, mobile interactions, and bank authorization mocks.
- Test clean startup from the deployment bundle plus downloaded images, readiness behavior, persistent data after recreation, and host reboot recovery in an agreed window. A reboot of shared rocky requires its own explicit approval.
- Restore a populated encrypted target-host backup into an isolated application stack and verify login, accounts, transactions, categories, import history, and monthly reports. Never restore over production. Use synthetic secret markers to verify no PIN/TAN reaches persistence, logs, errors, or decrypted backups.
- Before rollout, make and verify an encrypted pre-update backup, record running image digests, stop writes for migration, and validate results before reopening access. Separate image rollback from data/schema recovery; use the tested backup recovery path when the previous image is incompatible. Do not promise automatic down-migrations.
- Joint Stage 1 review covers usability, numbers, import decisions, operations, and live-bank status. Record unresolved external blockers explicitly. Stop after review until the user authorizes Stage 2.

## Stage 2 — Category budgets

Dependencies: explicit Stage 1 acceptance and separate implementation approval.

- Create/edit monthly budgets per expense category, with explicit copying from the previous month and no automatic rollover.
- Show budget, consumed amount, remainder, and overspending. Include booked unassigned transactions; exclude own transfers and pending transactions.
- Calculate consumption from category expenses minus categorized refunds, with a minimum of zero. Retain exact cent arithmetic.
- Add shared contracts, persistence/migration, API, theme-aware UI, and tests for month boundaries, refunds, category changes, and unassigned/assigned equivalence.
- Complete separate acceptance before starting Stage 3.

## Stage 3 — Recurring-expense planning

Dependencies: explicit Stage 2 acceptance and separate implementation approval.

- Manage recurring expenses with amount, category, start, optional end, and monthly/quarterly/yearly intervals.
- Display upcoming due dates and planned amounts actually due in the selected month. Separately show the monthly average; round only its displayed fractional-cent equivalent.
- Clamp unavailable monthly due days to the last day of that month without permanently shifting the original day. Respect start/end dates and leap years.
- Planning entries never create real transactions, initiate payments, or change actual monthly results. Allow explicit matching to real transactions and prevent duplicate matching of one planned occurrence.
- Add shared contracts, persistence/migration, API, theme-aware UI, and tests for month ends, leap years, ending a series, and duplicate matching.

## Delivery and proof

- Create/reuse the appropriate task record after plan approval and obtain implementation approval before feature work. Keep current uncommitted documentation changes; do not discard them or treat the initial issue's implementation approval as permission for this expansion.
- Each P1 task and later implementation stage includes scoped source/tests/docs and its own commit after relevant checks pass. Use the existing coding standards; include API-contract, migration, and Vue acceptance checks for the affected boundaries.
- Required applicable checks: formatting, lint, strict typechecks, unit/integration tests, browser tests, production builds, and container operations on the exact candidate revision.
- Publication, merge, and production rollout follow their respective approvals. No automatic Stage 2 start or implicit shared-server reboot.
- Completion reports name actual evidence, unresolved blockers, current activity, and required user action. This documentation-only change does not complete any expansion task.
