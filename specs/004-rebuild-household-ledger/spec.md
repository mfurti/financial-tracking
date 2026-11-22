# Feature Specification: Rebuild the Household Ledger

**Feature Branch**: `21-rebuild-the-household-ledger-with-querry-kit` ([#21](https://github.com/mfurti/financial-tracking/issues/21))

**Created**: 2026-11-22

**Status**: Draft

**Input**: Rebuild the application, use Querry Kit on both sides, use Workboard as the layout reference, take selected dashboard cues from Finanzfluss, and remove obsolete files and plans.

## User Scenarios & Testing

### User Story 1 - Continue working with an existing ledger (Priority: P1)

An existing owner signs in and finds the same recorded balances, transactions, classifications, transfers, import history, contracts, and settings in the rebuilt application.

**Why this priority**: Reopening existing records is necessary for continued use.

**Independent Test**: Load an anonymized pre-rebuild backup into an isolated database, start the rebuild, and compare representative records, relationships, and period totals before and after.

**Acceptance Scenarios**:

1. **Given** an existing ledger, **When** the owner opens Overview, **Then** it displays the reconciled totals for the selected accounts and period.
2. **Given** existing bank and CSV records including accountless entries, **When** the owner opens Transactions and Imports, **Then** both sources and their assignment and rollback actions remain available with their original meanings.
3. **Given** an unauthenticated session or a user without permission for an action, **When** the user requests a screen or submits the action, **Then** the operation exposes no protected data and changes no records.

### User Story 2 - Review finances and act from the new interface (Priority: P1)

The owner starts at Overview, chooses a period and relevant accounts, drills into a transaction list, and reviews or edits a transaction. The same journey works by keyboard and on a narrow screen.

**Why this priority**: Review and editing are the primary daily interaction.

**Independent Test**: Open a seeded dashboard in German and English, select a month and account scope, filter and page through transactions, edit one transaction, then return to the filtered list.

**Acceptance Scenarios**:

1. **Given** activity in multiple accounts and periods, **When** an owner follows an overview card, **Then** the target list uses the same scope and period and shows matching items.
2. **Given** a filtered list, **When** the owner saves an edit, **Then** that list refreshes coherently and preserves still-valid filters.
3. **Given** an empty ledger, a failed read, or a slow response, **When** the owner opens a list, **Then** the interface distinguishes empty, error, and loading states and allows recovery after a read failure.

### User Story 3 - Maintain the rebuilt app (Priority: P2)

A maintainer finds one current implementation plan and usable onboarding, recovery, and operational docs. Replaced code and obsolete concepts are removed once their remaining obligations have been carried forward.

**Why this priority**: A single current plan keeps future changes and recovery instructions traceable.

**Independent Test**: From a clean checkout, follow the active documentation, execute documented checks, and verify that retired files have no remaining links, imports, test references, or deployment consumers.

**Acceptance Scenarios**:

1. **Given** a superseded artifact, **When** it is removed, **Then** any unique active acceptance criterion, deployment instruction, or recovery evidence is moved to its current owner and references are updated.
2. **Given** a supported workflow, **When** the prior UI and its tests are removed, **Then** replacement acceptance tests cover that workflow in the new application.

### Edge Cases

- Small viewports, long German labels, keyboard-only interaction, and privacy masking from initial render.
- No accounts, accountless CSV rows, linked transfers, deleted or archived choices, and pages that shrink after an edit.
- Zero, negative, and large amounts, missing balance observations, Europe/Berlin date boundaries, and period changes during requests.
- Bank synchronization requiring user authorization, partial import failures, and repeated requests after interruption.

## Requirements

### Functional Requirements

- **FR-001**: Provide a rebuilt navigation shell and responsive screens for Overview, Transactions, Accounts, Analysis, Contracts, Imports, and Settings. Preserve access to notifications, reserves, recorded wealth, categories, and bank connections from those screens.
- **FR-002**: Offer an overview with recorded balances, income and expenses for the chosen period, and links to the matching drill-downs. Keep date and account selection consistent between summaries and lists.
- **FR-003**: Provide predictable search, filtering, sorting, bounded paging, and stable row identity in the transaction list and apply the same interaction conventions to other suitable resource lists.
- **FR-004**: Preserve supported manual/accountless CSV import, deduplication, assignment, rollback, category rules, transfers, contract review/calendar and payment links, balance observations, reserves, recorded wealth, analytics, notification acknowledgements, and local owner/settings workflows.
- **FR-005**: Preserve existing data identifiers, relationships, exact amounts, historical dates, permissions, and separation of synthetic data from recorded finances.
- **FR-006**: Keep existing protection for sessions, mutating requests, sensitive bank inputs, and nonpublic financial data.
- **FR-007**: Keep German and English labels, full keyboard access on primary workflows, and finance amount masking on initial and subsequent renders.
- **FR-008**: Remove a superseded file, concept, or plan when supported workflows, historical evidence, and all remaining references are accounted for.

### Design Constraints

- Adopt the user-requested Querry Kit stack across the API and web application. Workboard is the layout and table interaction reference.
- Select functional ideas from Finanzfluss Copilot within the existing ledger scope. Use original navigation, visual identity, wording, and screen composition.

### Key Entities

- **Ledger records**: Transactions, source identities, accounts and balance observations, categories, rules, and paired transfers.
- **Import and bank records**: Imports, staged rows, issues, assignment receipts, and bank connections.
- **Planning and tracking records**: Contracts and revisions, payment links, reserve goals, recorded wealth and components.
- **Access and settings records**: Users, sessions, owner profile, account groups, presentation preferences, and notification acknowledgements.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Each supported primary journey has a passing browser scenario on the rebuilt interface, including overview drill-down, transaction editing, import, and opening account and contract details.
- **SC-002**: On a restored pre-rebuild database, reconciliation reports zero unexplained differences in finance record counts, IDs, audited relationships, and exact representative totals.
- **SC-003**: The main journeys complete at 390 px and 1440 px in both supported locales. Keyboard users can open, operate, and close filters and editors. Masked amounts remain absent from visible and accessible output.
- **SC-004**: A clean checkout passes format, lint, type, unit/DB, build, and browser checks. Every removed artifact has an identified replacement or recorded reason for retirement, with zero dangling required references.

## Assumptions

- Feature parity uses the target base revision and documented shipped behavior. Pending PRs are rechecked before implementation; merged capabilities become part of the baseline.
- Existing synthetic investment tools remain isolated and reachable until an explicit scope decision retires those tools. Cleanup includes old design variants and duplicate planning material.
- New external financial services, investment products, production deployment, and deleting financial history are outside this rebuild.
