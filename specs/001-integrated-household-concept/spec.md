# Feature Specification: Integrated Household Finance Concept

**Feature Branch**: `13-implement-integrated-household-finance-concept`
**Issue**: [#13](https://github.com/mfurti/financial-tracking/issues/13)
**Created**: 2026-11-18
**Status**: Draft; constitutional gate unavailable
**Input**: Implement `.local/design-concepts/output/html/integrated/` across desktop, tablet, and mobile.

## User Scenarios & Testing

### User Story 1 - Compact responsive application (Priority: P1)

The owner navigates overview, bookings, accounts, analyses, contracts, wealth, and management in the concept's compact application shell.

**Why this priority**: Every financial workflow depends on accessible navigation.
**Independent Test**: Open main and detail destinations at phone, tablet, and desktop widths.

**Acceptance Scenarios**:

1. **Given** an authenticated owner, **When** navigating and returning from details, **Then** headings, active navigation, history, and selected filters remain consistent.
2. **Given** identical records, **When** changing screen size, **Then** the interface uses one, two, or up to three content columns without page-wide horizontal overflow.
3. **Given** keyboard navigation, **When** operating menus and dialogs, **Then** focus remains visible, dismissal works, and focus returns to the trigger.

### User Story 2 - Trace monthly finances (Priority: P1)

The owner reviews actual monthly income and spending, completed-month comparisons, categories, merchants, and contributing bookings.

**Why this priority**: Displayed financial figures must remain explainable and exact.
**Independent Test**: Reconcile category and merchant totals against bookings containing transfers, refunds, and unknown classifications.

**Acceptance Scenarios**:

1. **Given** a selected period and account, **When** opening a category or merchant, **Then** the detail retains scope and sums to the displayed amount to the cent.
2. **Given** an own transfer, **When** reviewing actual income and expenses, **Then** neither leg inflates the totals.
3. **Given** incomplete or missing months, **When** comparing 3, 6, or 12 completed months, **Then** gaps remain visible and averages explain their eligible months.

### User Story 3 - Preserve financial maintenance (Priority: P1)

The owner retains account maintenance, CSV imports, issue and duplicate resolution, assignment, rollback, bank authorization, category rules, and contract review/editing in the new layouts.

**Why this priority**: A visual replacement must preserve working financial operations.
**Independent Test**: Import synthetic rows, resolve mapping/duplicates, assign an account, link a transfer, review a contract, and inspect its calendar.

**Acceptance Scenarios**:

1. **Given** empty purpose but populated booking text, **When** mapping a CSV, **Then** useful text is preserved or an explicit correction is offered before commit.
2. **Given** linked imported records, **When** previewing rollback, **Then** impact and confirmation retain existing preservation rules.
3. **Given** a recurring contract, **When** editing its schedule, **Then** planned costs and calendar agree while actual payments remain distinct.
4. **Given** an existing bank connection, **When** authorizing or cancelling, **Then** the established connector handles the operation without credential persistence.

### User Story 4 - Reserve and recorded wealth (Priority: P2)

The owner edits a reserve target and inspects dated wealth observations with clear source and coverage labels.

**Why this priority**: The new concept modules require meaningful financial semantics.
**Independent Test**: Change the reserve target, reload, inspect missing balances, and record/revisit a wealth observation.

**Acceptance Scenarios**:

1. **Given** a positive target, **When** saving it, **Then** it persists and progress uses eligible Tagesgeld observations with their dates.
2. **Given** missing balances or negative balances, **When** recording wealth, **Then** missing coverage and signed values are preserved; unknown is not treated as observed zero.
3. **Given** a recorded observation, **When** later data changes, **Then** historical recorded values remain fixed and are not advertised as reconstructed bank history.

### User Story 5 - Isolated investment simulation (Priority: P2)

The owner explores demo portfolio, security details, orders, savings plans, transfers, activity, and market scenarios.

**Why this priority**: The concept supplies an interactive demonstration without a live broker.
**Independent Test**: Buy/sell, reject insufficient funds, execute a savings plan, reload, and reset; compare real records and bank request counts before/after.

**Acceptance Scenarios**:

1. **Given** sufficient demo cash or holdings, **When** submitting a valid order, **Then** demo cash, positions, and activity change atomically.
2. **Given** an invalid quantity or insufficient funds, **When** submitting, **Then** the error explains the rejection and demo state remains unchanged.
3. **Given** real financial data, **When** operating or resetting the simulation, **Then** no real financial record or external bank request changes.

### User Story 6 - Personal workspace settings (Priority: P2)

The owner configures profile, account groups, in-app notifications, analysis tiles, language, amount privacy, appearance, and password.

**Why this priority**: These concept screens complete personal control and navigation.
**Independent Test**: Save settings/groups, reload, switch language/privacy, change password, and open the labeled local roles demonstration.

**Acceptance Scenarios**:

1. **Given** saved preferences, **When** reloading, **Then** language, privacy, analysis selection, and appearance retain their documented scope.
2. **Given** overlapping account groups, **When** aggregating, **Then** each account contributes once and group deletion preserves accounts/history.
3. **Given** user management, **When** editing the local demonstration, **Then** no real users, credentials, roles, or access rights are created.
4. **Given** a notification source, **When** following or dismissing it, **Then** the target is reachable and financial records remain unchanged.

### Edge Cases

- Empty installation, accountless imports, inactive accounts, long names, stale responses, expired sessions, failed saves.
- Month/year boundaries, leap days, end-of-month schedules, Berlin dates, partial months and no eligible averages.
- Refunds, negative balances, zero denominators, large amounts, unknown merchants and missing observations.
- Blocked/corrupt browser storage, repeated submit, invalid custom colors, demo reset cancellation, deleted group members.

## Requirements

### Functional Requirements

- **FR-001**: All 39 named concept views MUST have a route, embedded flow, or documented adaptation in `contracts/ui.md`.
- **FR-002**: Navigation, compact cards, visual hierarchy, controls, and responsive placement MUST follow the integrated concept across three screen families.
- **FR-003**: Existing authentication, accounts, bookings, classification, categories/rules, transfers, imports, rollback, assignment, contracts, and banking authorization MUST remain functional.
- **FR-004**: Monthly review, cashflow, categories, and merchants MUST share explicit date/account scope and offer reconcilable transaction details.
- **FR-005**: Actual finances MUST exclude own transfers and distinguish future planned costs, observed balances, recorded wealth, and simulated values.
- **FR-006**: Contract editing, cost planning, and calendar MUST use the same recurrence rules.
- **FR-007**: Reserve targets MUST be positive, default to EUR 3,000, persist, and disclose eligible Tagesgeld balances and missing/stale sources.
- **FR-008**: Recorded wealth MUST retain timestamps, signed components, coverage, and source observation dates without manufacturing historical bank observations.
- **FR-009**: Simulated orders, savings plans, scenarios, transfers, accounts, and local roles MUST be visibly labeled and isolated from real financial and authentication state.
- **FR-010**: Demo orders MUST validate whole quantities 1–1000, cash, and holdings atomically; scenario controls MUST stay within -30% to +30%; confirmed reset MUST affect only demo state.
- **FR-011**: Profile, account groups, in-app notification state, and analysis preferences MUST persist with documented scope; group totals MUST deduplicate accounts.
- **FR-012**: Password changes MUST reuse the existing authenticated process; the single-owner access model MUST remain unchanged.
- **FR-013**: German and English labels, localized dates/currency, amount privacy, existing appearance choices, and contrast-validated custom themes MUST be supported.
- **FR-014**: Every asynchronous view MUST support loading, empty, validation, failure, and retry states without presenting stale results as current.
- **FR-015**: Controls/dialogs MUST support labels, keyboard focus, touch, dismissal, and reduced motion.
- **FR-016**: Real amounts and credentials MUST NOT enter demo storage, diagnostics, or external design resources.
- **FR-017**: Depth MUST distinguish canvas, content surfaces, active controls, and overlays consistently in light and dark appearances, while preserving the concept's restrained, shadow-free tile surfaces.
- **FR-018**: Spacing MUST follow shared responsive values for page gutters, column gaps, tile padding, headings, and compact rows; long or translated content MUST remain readable without clipping required information.
- **FR-019**: Text, essential controls, focus indicators, selected states, and financial/chart labels MUST remain distinguishable across supported appearances; color alone MUST NOT convey financial direction or interaction state.
- **FR-020**: Tiles MUST use consistent variants with an explicit label/value/context hierarchy, comparable alignment, and complete default, hover, focus, pressed, selected, disabled, loading, empty, and error states where applicable.
- **FR-021**: Animation MUST provide restrained interaction feedback without moving financial rows or tiles on hover, shifting layout, delaying actions, or hiding focus; reduced-motion preferences MUST disable decorative motion.

### Key Entities

- Existing accounts, observed balances, transactions, categories/rules, imports, transfers, contracts/payments retain identities and history.
- Account groups identify sets of real accounts; reserve goals identify a positive target and eligible accounts.
- Recorded wealth contains dated fixed components and coverage/provenance.
- Owner profile/preferences contain display identity, locale, privacy, and analysis/appearance choices.
- Notification acknowledgements refer to source-derived events.
- Simulation state contains synthetic cash, securities, holdings, orders, plans, activity, and local demonstration roles.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All 39 concept views are mapped; applicable actions have observable outcomes and no dead navigation.
- **SC-002**: Primary journeys work at 360, 390, 768, 1024, and 1440 CSS-pixel widths without page-wide overflow or hidden required actions.
- **SC-003**: Every tested monthly/category/merchant total reconciles to the cent; linked transfers contribute zero to actual income and expenses.
- **SC-004**: Saved settings, groups, goals, snapshots, and demo state survive their documented reload/session boundaries.
- **SC-005**: Every demo operation and reset leaves real records and bank request counts unchanged.
- **SC-006**: Existing import, contract, assignment, auth, and accountless journeys pass together with new scenarios.
- **SC-007**: Every primary journey and modal is keyboard operable with visible focus and correct return focus.
- **SC-008**: Reference comparisons at phone, tablet, and desktop widths separately document depth, spacing, contrast, tile composition, and motion, with every difference either corrected or explicitly accepted.
- **SC-009**: Normal text achieves at least 4.5:1 contrast and large text and essential control/focus boundaries at least 3:1 against adjacent surfaces; decorative borders are reviewed separately. Values, states, and chart series remain understandable without color alone.
- **SC-010**: Hovering financial rows and tiles changes no element's position or dimensions. Reduced-motion mode produces no decorative transition or animation, while every action remains operable.

## Assumptions

- Integrated HTML is the visual authority; synthetic examples are not production records. Fingerprints and mapping are in `contracts/ui.md`.
- Existing single-owner/shared-ledger semantics remain authoritative. The concept explicitly describes local roles, not real user accounts.
- Notifications are in-app; delivery infrastructure and live brokerage/price feeds are outside scope.
- Existing real bank integrations remain available; the mockup's demo-only notice does not remove established production functionality.
- German remains the default. Existing theme storage stays compatible.
- Existing open compact-layout/import work in `docs/todo.md` is reconciled into this feature rather than tracked twice.
