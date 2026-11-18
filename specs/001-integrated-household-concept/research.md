# Research: Integrated Household Finance Concept

Research date: 2026-11-18. Evidence is the supplied local concept and checked-in implementation, not assumptions about newer dependency releases. No package upgrade or external integration is proposed.

## 1. Rendering architecture

**Decision**: Implement native Nuxt/Vue components using installed Nuxt UI 4.12.0 and existing chart controls.
**Rationale**: `apps/web/package.json` already matches the concept's UI version. The HTML contains compiled bundles and successive overrides; final rendered behavior and final functions, not early static placeholders, define the reference.
**Alternatives considered**: Embedding HTML duplicates runtime/state/auth and does not connect to the real application; rebuilding a second application discards working financial behavior.

## 2. Responsive composition

**Decision**: Follow final `arrangeIntegratedHome()` placement: >1100 px bookings | payments+accounts | categories; 701–1100 px bookings+accounts | payments+categories; <=700 px bookings, payments, accounts, categories. Other pages use content-appropriate grids without forcing every screen into three columns.
**Rationale**: Final concept overrides earlier generic 760 px rules for the overview. One application must reproduce all three references.
**Alternatives considered**: Separate device applications duplicate behavior; using the first CSS breakpoint found ignores later overrides.

## 3. Actual analytics and merchant identity

**Decision**: Extend `analytics.ts` and shared schemas, retaining server-side exact cents and existing transaction scopes. Build an opaque merchant identity from exact trimmed counterparty text, with one explicit unknown bucket; use that same predicate in both aggregate and detail queries. Case/alias merging is excluded until explicitly specified.
**Rationale**: Existing analytics supports exact ranges, account/category filters, transfers, missing months, and manual-first classification. Matching only a display label or fuzzy search cannot guarantee reconciled detail totals.
**Alternatives considered**: Browser aggregation over paginated transactions is incomplete; fuzzy merchant grouping can merge unrelated parties.

## 4. Final analysis modules

**Decision**: Six configurable modules: completed months, categories, merchants, recorded wealth, reserve, and contracts. Support 3/6/12 completed months, account selector, and bar/ring presentation where meaningful. Monthly overview may show the current partial month with an explicit label.
**Rationale**: Final `IntegratedFeatures` replaces early emergency/history placeholders; completed-month comparison is distinct from current-month review.
**Alternatives considered**: Porting only the early static cards misses final concept interactions.

## 5. Reserve and recorded wealth

**Decision**: Positive reserve target defaults to EUR 3,000 and uses accounts explicitly designated as Tagesgeld. Preserve existing account type values; add an explicit subtype/designation rather than assume all savings accounts are Tagesgeld. Missing observed balances remain unknown. Persist real recorded wealth in new snapshot/components records; demo history remains local, change-triggered and capped at 48 points.
**Rationale**: Existing `BalanceSnapshot` requires account/import provenance. Fabricating imports or historical bank observations would corrupt semantics. Real snapshots freeze amounts and their observation dates; total coverage is explicit.
**Alternatives considered**: Reusing imported balances for synthetic events invents provenance; recomputing history from current balances silently changes the past.

## 6. Demo investment behavior

**Decision**: Isolate synthetic cash, securities, holdings, whole-share orders (1–1000), plans, transfers, activity, and -30%…+30% scenarios in a versioned browser store. Store money as integer-cent strings and calculate with BigInt; rational/integer scenario rounding is explicit and deterministic. Validate the entire next state before one commit.
**Rationale**: The concept states simulation, without remote brokerage. Reload and storage failure need deterministic handling; demo mutations must never call financial APIs.
**Alternatives considered**: New broker APIs exceed scope; mixing demo accounts with real accounts breaks real wealth totals and reset safety.

## 7. Settings and owner boundary

**Decision**: Reuse existing appearance bootstrap/keys, `/auth/password`, and single-owner sessions. Add bilingual UI, amount masking, module preferences and validated custom semantic colors. Real owner profile/groups use authenticated API storage; notification preferences describe in-app behavior. The concept's user screen remains a labeled browser-local roles demonstration.
**Rationale**: Prisma `User.singleton` enforces one real owner; the concept explicitly says local roles, not real accounts. Notification toggles do not establish delivery infrastructure.
**Alternatives considered**: Removing the singleton creates a new authorization product; enabling fake email/push switches misrepresents capabilities.

## 8. Governance and delivery context

**Decision**: Preserve `main` and current checkout; create only local planning artifacts. Record the constitution gate as unavailable. Reconcile existing R1/I2/I3 work instead of opening duplicate tracking.
**Rationale**: Constitution is an unratified template. `docs/coding-guidelines.md`, existing implementation specification, tests, and CI provide concrete constraints, but are not evidence of ratified constitutional principles. Setup reported `BRANCH=001-integrated-household-concept`; `git branch --show-current` verifies the actual branch is `main`, so feature context must not be mistaken for Git mutation.
**Alternatives considered**: Inventing ratification or reporting a nonexistent feature branch would misstate project state.

## Resolution Status

Technical decisions are resolved from local evidence. The governance decision remains explicitly open in `plan.md`; constitutional compliance cannot be declared until that gate is resolved. The user's later explicit task-generation request authorizes `tasks.md` while preserving that implementation prerequisite. No runtime implementation or validation has been claimed.

## Visual Refinement: Depth, Spacing, Contrast, Tiles, and Animation

**Decision**: Treat these five dimensions as explicit acceptance requirements, documented in `contracts/visual-design.md`, before propagating shared styling across the application.
**Rationale**: Inspection of the final `.T` and `.INTEGRATED` CSS shows that later rules remove earlier hover movement, full-row hover highlights, and shadows. Feature tiles use a 22 px radius, 20 px / 22 px desktop padding, a 16 px grid gap, and narrow-screen padding of 18 px. Overview composition uses a 22 px column gap and 23 px within-column gap. Icon/graphic feedback uses approximately 180 ms transitions, while reduced-motion rules disable transitions and animations. Depth is carried by surface tones, borders, spacing and overlay layers, rather than elevated cards. These findings come from source inspection, not rendered/computed-style verification.
**Alternatives considered**: Adding stronger shadows, hover lifts, arbitrary spacing, or spring animations would diverge from the final reference. Generic screenshot approval would not separately establish contrast, keyboard states or motion behavior. Proposed dialog timing is explicitly marked as a design choice rather than a reference measurement.
