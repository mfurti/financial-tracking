# Implementation Validation: Integrated Household Finance Concept

## Authorization and Checkout

- Issue: [#13](https://github.com/mfurti/financial-tracking/issues/13), related to [#3](https://github.com/mfurti/financial-tracking/issues/3).
- Existing checkout: V:/GitHub/financial-tracking; linked branch 13-implement-integrated-household-finance-concept; starting planning commit 0ae88aecf9e76a5986f45661a94f47a43280b39d. No additional worktree.
- User explicitly approved existing documented project rules as governance baseline and speckit-implement for all 48 tasks. No merge, deployment or real bank/broker permission.
- Checklist scan: requirements.md has 15 items, 14 checked, one historical governance marker open. This exact prerequisite is resolved by the explicit user decision; reviewer-owned markers and constitution remain unchanged.
- No before/after implementation hooks: .specify/extensions.yml absent at entry.

## T001: Reconciliation and Baseline

All 39 source views exist in each reference and have task ownership in contracts/ui.md. FR-001–FR-021 and SC-001–SC-010 have owning tasks in tasks.md. Existing R1/I2/I3/P1 and related R2/R3 overlap is mapped without marking product features complete or closing external gates.

Original SHA-256 fingerprints were rechecked and match contracts/ui.md for PC/tablet/mobile; each has 39 named views. The ignored source files were not changed.

### Tooling and Initial Results

- Initial shell default: Node 26.13.0, outside project requirement. Official Node 24.22.1 was downloaded to ignored .local/runtime and archive SHA-256 verified against nodejs.org: d2046d28c2c3dcd211ac5145c0bf30e2047ef9dfb306693c8c6e2eccd8b95fa5. No global runtime change.
- Elevated pinned pnpm reports 11.25.0; sandbox default launcher otherwise attempted a network version lookup and fell back to 12.18.0. Run project gates with Node 24 on the process PATH and pinned pnpm outside that sandbox restriction.
- Initial ESLint: passed.
- Initial Prettier: failed only for ignored machine-local .specify/feature.json. Normalized that owned pointer and excluded it from tracked-source formatting to avoid per-checkout generated-state failures.
- Setup verification added missing log exclusions, Docker coverage exclusion and ESLint coverage exclusion. Existing secrets/env/generated/build/test-output exclusions preserved. No publishing-only npmignore required for private application packages.
- Node 24.22.1 + pnpm 11.25.0: pnpm typecheck passed across shared contracts, API, Nuxt and root tests/scripts.
- pnpm test passed: 24 test files, 131 tests, 137.94 seconds. Existing pg concurrent-query deprecation warnings are recorded; no failing test.
- Final full-source Prettier and ESLint checks passed; git diff --check passed.
- Coverage validation: 39 unique source-view owners, 48 sequential pending task IDs, all declared requirement ownership retained. Reviewer checklist and original source HTML untouched.
- No initial browser/build/runtime/production result is claimed.

## Evidence Policy

Record actual commands/results per task, exact delivery commits in the issue, and unavailable checks separately. Check tasks only after relevant proof, task commit and successful immediate push. Runtime feature claims require corresponding real integration/browser evidence; references/screenshots alone do not establish financial correctness.

## T002: Reference Capture

- scripts/capture-concept-reference.mjs --check passed all three SHA-256 fingerprints and 39 views per format.
- Full offline capture passed: 54 screenshots (3 devices x 2 themes x 9 screens), with visible-element computed geometry and source provenance in ignored .local/concept-reference/manifest.json. Tracked reference-index.md inventories the artifacts.
- Browser clock fixed to 2026-11-18 12:00 UTC, Europe/Berlin, de-DE, scale 1, reduced motion. Actual header control and applied html theme class verified; initial reference tone does not necessarily follow browser colorScheme.
- Zero page errors and zero requested remote origins. Desktop light overview and mobile dark analyses visually inspected after the applied-theme correction; geometry and readable content confirmed for reference evidence only.
- Script lint, formatting and artifact existence/count checks passed. No runtime product acceptance claimed.

## T003: Isolated Viewport and Data Fixtures

- Added 9 concept profiles: 360, 390, 700, 701, 768, 1024, 1100, 1101 and 1440 px. Every profile owns separate web/API ports and its own disposable PostgreSQL database, preserving existing desktop/mobile/empty projects. Explicit project selection starts only required owned servers.
- Added deterministic synthetic labels and data for long names, exact 900719925474099301-cent balance, missing/negative balances, July/August/October data with September gap, refunds, unknown merchants, accountless bookings, linked transfer pair and a month-end contract.
- Fixture integration test passed against the real analytics service, proving exact income 600299/expense 22100 cents and gap/transfer semantics. Initial test incorrectly accessed a nonexistent report.totals wrapper; corrected to the existing public report shape.
- Full typecheck and production build passed; final root TypeScript, scoped ESLint/Prettier and whitespace checks passed.
- New browser smoke initially navigated while login was still pending because login itself has a heading. Corrected to wait for authenticated root navigation; focused 390 px smoke passed.
- Final nine-project browser smoke passed: 9/9, 1.7 minutes. This proves isolated fixture/login/account reachability, not visual feature acceptance.

## T004: Shared Visual Tokens and Surfaces

- Added named semantic layer/gutter/gap/radius/motion tokens and connected existing page, card, row and sticky-header surfaces without replacing palette identities or financial calculations. Nuxt UI card/modal defaults now use the same semantic surfaces.
- New computed browser acceptance failed before the change at the real 1320 px content maximum versus required 1480 px.
- Nuxt typecheck, production build, scoped ESLint/Prettier and whitespace checks passed.
- Browser validation passed: 3 concept surface cases (390/768/1440 px) and 2 existing desktop/mobile interface journeys, 5/5 in 1.5 minutes. Header/gutters/radius/shadow/hover geometry verified; existing light/dark, form/retry/session behavior remained green.

T004 visual observation: the synthetic 390 px overview screenshot confirms restrained card boundaries, no tile shadow, readable signed/large amounts and consistent page insets. The old overview order/density remains intentionally owned by T008/T009, so this is surface-layer acceptance rather than final concept parity.

## T005: Reusable Finance Tiles and Dialogs

- Added semantic feature/insight/account/stat tiles with label/value/context hierarchy, independent sibling actions, disabled/loading/empty/error representations and retry events; navigation and primary button actions never nest interactive controls.
- Added the Nuxt UI dialog wrapper with native focus/dismissal behavior, bounded viewport scrolling and reference insets/radius. Existing settings owner information now uses both components without adding a showcase route or changing password behavior.
- The new real-settings acceptance failed before implementation because the account tile did not exist. A later geometry assertion initially measured before Playwright scrolled to the offscreen tile; corrected the test to scroll first, retaining the strict stationary-hover check.
- Focus/escape/return/reduced-motion checks passed at 390 px and then 768/1440 px. Visual review found the default overlay still winning the arbitrary utility color; replaced it with an explicit semantic overlay class and added a computed dark-backdrop assertion. Final three-viewport rerun passed: 3/3 in 34.1 seconds, including computed dark backdrop, bounded dialog, keyboard focus/return, reduced-motion operation and stationary tile geometry. Final mobile overlay screenshot visually inspected.
- Nuxt typecheck, rebuilt production bundle, scoped ESLint/Prettier and whitespace checks passed. Async tile-state integration is exercised by owning page tasks such as T009; no fabricated financial values or real user changes.

## T006: Versioned Device Preferences

- Added a dedicated allowlisted v1 object for language, display privacy, ordered unique module IDs, chart choice and in-app notification-kind booleans. Existing theme keys are preserved; custom tones remain null until T041 validation/UI.
- Restore supports legacy hideAmounts/modules names and distinguishes invalid, unsupported and unavailable storage without overwriting on read. Explicit saves serialize only supported fields and report blocked writes while keeping in-memory use available.
- Added the real early head bootstrap, reactive client locale/privacy attributes and shared preference composable. Early CSS display masking precedes value rendering; full translated and accessible masked-string coverage remains T042 and is not claimed here.
- New suite first failed because the utility module did not exist. Implemented behavior then passed 5 preference cases plus 20 existing appearance cases. Tests execute the actual head script and inspect serialized storage, including corruption/future schema/blocked getters and discarded financial/secret fields.
- Nuxt typecheck and production build passed. Real browser checks passed 4/4 at 390/1440 px: restored locale/privacy, palette retained, authenticated display masking/reload and blocked-storage usable login. Scoped lint/format and whitespace checks passed.

## T007: Shared Compact Application Shell

- Replaced the desktop sidebar with one opaque responsive navigation surface, floating on larger screens and fixed full-width on phones. Accounts are a delivered primary destination; future wealth routes are not advertised yet.
- Header retains accessible settings/theme/logout and skip navigation, without a repeated visible page heading. More uses a compact management list; login is condensed while preserving shared validation and password/session handling.
- New shell acceptance failed before the change because the sidebar still existed. After implementation, 3 concept cases at 390/768/1440 px plus existing desktop/mobile interface journeys passed (5/5, 1.7 minutes), including selected destinations, management-child marker, no overflow, logout, both themes, field/retry and session-expiry behavior.
- Nuxt typecheck/build, scoped lint/format and whitespace checks passed. Mobile shell screenshot visually inspected.
