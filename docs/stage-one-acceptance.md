# Stage 1 delivery and remaining acceptance

This record separates implemented source from external/live acceptance. Stage 2 budgets and Stage 3 recurring expenses remain unauthorized.

## Current deployed baseline and new review

This section records the pre-PR #8 deployment checkpoint. For subsequent delivery and actual server revision, see the current status in [issue #3](https://github.com/mfurti/financial-tracking/issues/3).

PRs #4–#7 are merged. Current approved runtime is `a2ea7371b181ebbf92c17006b827ba2ec35289a7`; [main CI 42397313981](https://github.com/mfurti/financial-tracking/actions/runs/42397313981) passed 74 tests, eight browser cases, isolated operations/recovery and publication. The PR #7 rollout preserved all 14 tables and migration state with no new schema migration; four services healthy, 31-second pause/start, trusted HTTPS 200, anonymous accounts 401 and direct/spoofed-header denial 403. The fresh initialized encrypted archive recovered off-server in 9 seconds; it contained no financial transactions. Original bank-file and joint everyday-use acceptance remain open.

The user's next review requests automatic upload/analysis, a Finanzguru-inspired redesign, a circular mode control, Settings theme families and understandable categories. These U1–U5 tasks are planned in ausbauplan.md and tracked in todo.md; they are not delivered merely because earlier UI tests passed. The records below preserve earlier rollout evidence.

## Current experience revision: source acceptance

Branch `codex/3-guided-finance-experience`; U1 `52525a6`, U2 `5772824`, U3 `79e0413`, U4 `4fdc508`. No new database migration or production change.

- All 94 tests across 18 files passed, including exact-money/reconciliation, authentication/security, HTTP/contracts, encoding and 19 palette/bootstrap cases. Format, lint, strict types and production builds passed.
- All 16 browser cases passed on populated desktop/mobile and accountless desktop/mobile instances. Covered upload-only analytics across more than 20 records and multiple months, lost-response recovery with one commit, format correction, missing mapping, explicit partial consent, late-preview cancellation, category assignment and resulting exact totals, month-read failure/retry, responsive navigation/keyboard, every bundled theme in both modes, persistence/reduced motion and existing overlap decisions.
- Browser fixtures use real application authentication, APIs and disposable PostgreSQL. Fault/response-loss injection is explicit; bank protocol states remain synthetic and do not prove live Sparkasse compatibility. Populated desktop/mobile instances are isolated to preserve the unchanged login throttle.
- Synthetic dashboard/category desktop and 360px mobile views were visually inspected in default light/dark; Dracula Settings inspected. Reviewable local captures: `.local/experience-dashboard-{desktop,mobile}.png`, `.local/experience-categories-{desktop,mobile}.png`, `.local/dashboard-{Hell,Dunkel}-{desktop,mobile}.png` and `.local/settings-dracula-{desktop,mobile}.png`. Images contain no real banking data and are not shipped assets.
- Actual original CSV, joint everyday-use review, FinTS registration/confirmed endpoint/live acceptance, credential-scope review and separately authorized host reboot remain open. This revision still needs its own PR CI, merge decision and server rollout decision. Production remains `a2ea737` until an explicitly approved rollout completes.

## PR #8 delivery decision

[PR CI 42414991656](https://github.com/mfurti/financial-tracking/actions/runs/42414991656) and push CI 42414959543 passed verification plus Linux image-only/container/backup/restore operations for `0a87b70`. The user explicitly authorized PR #8 merge and rollout after green CI, with a fresh encrypted backup, brief write pause, preserved data/secrets/IP and no new schema migration, reboot or real bank access. Recheck every subsequent head and main image publication. Actual merge/rollout/recovery evidence is maintained in issue #3; approval alone is not deployment proof.

## Source increments

| Increment                           | Commit               | Evidence                                                                                                                                                       |
| ----------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0 baseline                         | `e2e4963`            | Preserved user plan/local documentation; 26 baseline tests and both initial browser profiles                                                                   |
| P1.1 image-only operations          | `4af2e65`, `8512215` | [CI 42367331141](https://github.com/mfurti/financial-tracking/actions/runs/42367331141): verify and Linux operations passed                                    |
| P1.2 accountless CSV                | `07ebc21`            | 42 tests/four browser projects; [CI 42370494493](https://github.com/mfurti/financial-tracking/actions/runs/42370494493) passed                                 |
| P1.3 interface/themes               | `f0ace1c`            | 44 tests/six browser cases; [CI 42371818775](https://github.com/mfurti/financial-tracking/actions/runs/42371818775) passed                                     |
| P1.4 authorization and setup        | `d6d6c2c`, `7f01161` | 56 tests/eight browser cases; [CI 42373191575](https://github.com/mfurti/financial-tracking/actions/runs/42373191575) passed                                   |
| P1.5 final recovery/auth acceptance | `86f7b89`            | [CI 42374488764](https://github.com/mfurti/financial-tracking/actions/runs/42374488764) passed; actual initialized target archive recovered locally            |
| Final transfer correction           | `78f3371`            | [PR CI 42374808449](https://github.com/mfurti/financial-tracking/actions/runs/42374808449): 61 tests, eight browser cases and expanded Linux operations passed |

The CI publisher intentionally skips feature branches. Green feature CI does not mean production images were published or the server was updated.

Source review: [PR #4](https://github.com/mfurti/financial-tracking/pull/4) and [publisher correction #5](https://github.com/mfurti/financial-tracking/pull/5) merged after approved green CI. [Main CI 42389714786](https://github.com/mfurti/financial-tracking/actions/runs/42389714786) passed verify, operations and publication at `be3d8ab`: 67 tests, eight browser cases and populated isolated PostgreSQL 17 recovery. The earlier detail-navigation regression and correction remain recorded in progress.md.

## Approved target rollout, 2026-11-07

- User approved the maintenance/write pause and confirmed `.33` is unassigned. Their router screenshot shows DHCP `.200–.254`. Actual other Compose files, Docker assignments and three unanswered ARP probes were checked before allocation.
- Three private GHCR images were pulled by immutable digest on rocky; all OCI revision labels match `be3d8ab`. The pinned PostgreSQL 17.11 image is exactly the previously running image. Existing protected registry credentials worked; their minimum scopes were not inspected.
- Old runtime configuration was encrypted and copied off-server. Old web/API/backup writers were stopped. Fresh archive `ledger-20261107T163720-11179.dump.age`, SHA256 `ea714c927a7f62ca3e407c5ee016133003ff4e47058c859d96bee3e6a22ea411`, was copied off-server and passed the isolated verifier in **24 seconds**: decryption, migration, row preservation, disposable password rotation/login, reports and responsive UI. It still contains no financial transactions; populated financial recovery is separately proven in CI.
- Production migration exited zero. Counts and hashes of all original fields in all 12 original application tables matched before/after migration, including existing users/password hashes. No production password changed. The original database volume and backup storage were preserved.
- PostgreSQL, API, web and backup are healthy; migration exited zero. Web now has `.33`; API/database have no LAN assignment or published ports. PostgreSQL and web were recreated using the persistent volume/configuration.
- A real multi-network DNS issue initially rejected legitimate HTTPS: unqualified `traefik` resolved to LAN `.27`, while proxy traffic arrived from bridge `172.19.0.10`. Production Compose now uses `traefik.traefik-public`, verified to resolve the bridge endpoint. Images remain the exact published revision; this is a documented Compose-only correction, also prepared in source/CI.
- Windows verified trusted TLS: `/login`, `/health` and `/api/v1/health/ready` return 200; anonymous `/api/v1/accounts` returns 401. Direct `.33:3000` requests return 403 with and without spoofed forwarding headers.
- The new backup service completed a fresh automatic encrypted archive and is healthy. Final runtime configuration was encrypted and copied off-server. Server project root now contains only `compose.yaml`, `.env`, `.env.example`, `README.md`, `REVISION` and `secrets/`; old source/build files and the two obsolete `/opt` SELinux rules were removed after technical checks. No volume/backups were deleted.
- User login and joint UI/CSV acceptance are still required; no production credentials were requested. No host reboot, real bank access or Stage 2/3 work occurred.

## Target backup recovery, 2026-11-07

A read-only SSH lookup identified the newest existing encrypted target-host archive. Only the encrypted archive was copied locally. The private recovery identity remained in the administrative user's protected configuration directory; it was never uploaded or committed.

- Encrypted archive SHA-256: `98e744cf2644dc6dcc0b3097041763898bc5ca47df567990599abb984201592d`.
- Tools: age 1.3.2 (official GitHub release asset digest checked), PostgreSQL client 17.11 (official EDB binary archive), disposable embedded PostgreSQL 18.6, Node 24.22.1 and the current built API/web.
- Latest successful check: **11 seconds**, including decrypt/import, reviewed forward migration, preservation comparison, actual API/web startup, authentication, accounts/categories/history, monthly report and desktop/mobile geometry.
- Original rows/fields, including the password hash, were compared before/after migration. Only afterward was the password rotated **in the disposable copy** to exercise login without requesting the real password. No production credential changed.
- Decryption streamed directly into `pg_restore --single-transaction`. No plaintext dump file was created. The local app bound loopback ports only; bank configuration was disabled; its disposable database/processes were removed afterward.
- **Limit:** this initialized target backup contains no financial transactions. It proves actual archive/key usability, migration/preservation and app recovery; populated financial restoration is covered separately by synthetic Linux CI. It does not prove restoration of financial rows that were absent from this archive.
- This local PostgreSQL 18 recovery is not a downgrade or a replacement for the production PostgreSQL 17 CI recovery. No production restore, reboot or rollout occurred.

Repeat locally after `pnpm build`, using explicit tool/archive/identity paths:

```text
node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/verify-target-backup.ts ARCHIVE.age IDENTITY AGE_EXECUTABLE PG_RESTORE_EXECUTABLE
```

The verifier rejects CI and externally supplied `TEST_DATABASE_URL`, creates its own empty local cluster, suppresses sensitive process output and produces only boolean/hash/timing evidence. Neither the backup nor recovery keys belong in GitHub artifacts. Local helper downloads and evidence remain ignored under `.local`.

## Required external decisions and work

1. Review and merge the source follow-up for bridge-qualified proxy DNS after its own CI; the production Compose correction is already active and documented above.
2. Confirm/restrict the existing protected GHCR credential to read-only package access. Publication and actual target pulls are complete; minimal credential scope was not inspected.
3. Keep the current `.33` allocation outside DHCP and document future router/static-address changes. Existing networks were reused without modification.
4. User signs in with the existing password and performs joint CSV/layout/workflow acceptance. Technical rollout, fresh recovery proof, migration and data preservation are complete.
5. Keep runtime-only server layout, persistent volume, secrets and backups intact. Old source and obsolete `/opt` rules have been removed; do not reintroduce a repository or server builds.
6. Use the [registration guide](fints-registration.md) to apply for the application's own FinTS product ID and obtain the bank-confirmed endpoint/access. Then separately approve an accompanied live account/balance/history/TAN test. Synthetic success does not close this item.
7. Shared-host reboot acceptance requires a separate approved window. No reboot is included in ordinary feature CI or rollout approval.
8. Jointly accept Stage 1: layout, workflow, exact totals, reconciliation, operations and explicit real-bank limitations. Start neither Stage 2 nor Stage 3 without their separate approvals.

Image-only rollback requires schema compatibility. An incompatible schema requires the verified pre-update backup and matching image set; no automatic down-migration is promised.
