# Finanzfluss-orientierter Ausbau mit konsequenter Nuxt UI

Approved implementation: user supplied this plan and explicitly requested implementation in the current checkout after the Plan-mode review. Issue #3 remains the task record. Preserve audit commit `392d988`, existing financial data, CSV automation, Sparkasse date support and the recorded deployed baseline `1e33afa`. New merge and rollout approvals remain separate.

## Goal and fixed decisions

- Finanzfluss Copilot is the primary design reference: [expense analysis](https://www.finanzfluss.de/copilot/hilfe/budget/). Use Nuxt UI for all controls and consistent desktop/mobile surfaces.
- Safe category rules apply automatically; manual assignments, including deliberately clearing a category, take precedence.
- Recurring payments produce suggestions requiring confirmation. Confirmed contracts automatically mark only unambiguous matching payments.
- Sort contracts by their next upcoming payment; advance the list with time and payment assignment.
- Averages use completed months containing relevant transactions. Breakdown means category and fixed/variable shares, not splitting individual bank transactions.
- Budgets remain independent backlog. No server repository/builds, reboot, real bank access or payment initiation.

## Ordered implementation and commit boundaries

| Package | Working increment                                                                                                          | Acceptance                                                                                     |
| ------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| F0      | Save this approved plan, synchronize todo.md and issue #3; preserve the audit commit.                                      | Historical delivery, new work and external gates remain distinct.                              |
| F1      | Replace existing raw controls, confirmations and disclosures with Nuxt UI; shared date/month pickers.                      | Real CSV, account assignment and bank-dialog journeys remain usable by keyboard and on mobile. |
| F2      | Theme preview tiles, six Ayu variants and circular Nuxt UI mode button.                                                    | Correct previews, selection, early restoration, mode pairing and reduced motion.               |
| F3      | Category templates, deterministic rules and manual fixed/variable classification across persistence/API/UI.                | New imports classified with reasons; manual/legacy annotations preserved.                      |
| F4      | Contracts, suggestions, versioned schedules, payment marking/history and rolling due-date order across persistence/API/UI. | Confirmed contract and payment agree without generating or double-counting transactions.       |
| F5      | Multi-month analytics, final navigation and dashboard integration.                                                         | Reproducible metrics and links to their actual filtered transactions.                          |
| F6      | Guide/checklist/evidence, full checks, visual acceptance and one feature PR.                                               | Current full CI passes; request this PR's merge/rollout approval.                              |

Each package includes source, meaningful tests and documentation; run applicable checks before its own commit. Preserve completed commits. Reuse the current issue/checkout and existing standards; no Changesets setup is present.

## UI and navigation

- Main navigation: Übersicht, Umsätze, Analysen, Verträge, Mehr. More contains accounts, import history, bank connections and Settings. Category analysis/management belongs under Analyses; import remains prominent on overview/transactions. Do not expose links before their working pages exist.
- Overview: monthly cash flow, expenditure distribution, next contract payments and actionable clarification. Bank-reported balances remain separate.
- Use USelect for short choices, searchable USelectMenu for long choices, UFormField/UInput/UCheckbox/USwitch/UFileUpload/UModal/UAccordion and Nuxt navigation components. Keep accessible labels, drafts, field errors, focus, loading, clearing and disabled states.
- Dates: [UInputDate with UPopover/UCalendar](https://ui.nuxt.com/docs/components/input-date#as-a-date-picker), German locale, direct entry/clearing/ranges. Months use UCalendar type=month. Transport calendar dates without timezone shifts; preserve URL filters.
- Charts use UChart; retain exact money labels/tooltips and an accessible data table. Geometry never becomes the money source.
- Keep @nuxt/ui 4.12.0. Add direct @internationalized/date 3.12.4 and @tanstack/charts 1.5.0 (the required optional chart peer); do not install unrelated framework peers.
- Replace vague import checks with Buchungen klären. Separate invalid rows from potential duplicates; explain reasons, compared values and consequences. Preserve automatic known duplicates, explicit ambiguous decisions and partial-import consent.

## Appearance

- Habit Tracker-style finance preview tiles with names and selection indicators. Read-only reference: V:/GitHub/habit-tracker/web/app/pages/theme.vue and ThemePreview.vue; do not edit that repository.
- Ayu Light, Dark and Mirage each bordered/unbordered. Selecting a tile activates its brightness. The circular mode button preserves border choice and switches between Light and the last selected Dark/Mirage.
- Keep all existing family/storage identities compatible; preferences stay device-local and restore before mounting. Contrast, keyboard focus and reduced motion remain supported.

## Shared contracts and categories

- Extend packages/contracts/src/index.ts; runtime/API/OpenAPI/browser use the same shared Zod contracts. BIGINT cents remain decimal strings on the wire. No Prisma types in browser code.
- Offer reusable category templates for food, fashion, technology and other everyday costs; reuse existing suitable categories without renaming user data.
- CRUD /category-rules: exact counterparty or explicitly entered text substring, optional income/expense scope, order and active flag. No free regex or external AI service. Conflicting same-priority matches remain unresolved.
- Record automatic category origin. Manual assignment/clearing always wins. New rules never silently change old records; explicit backfill is a separate user action. Existing non-null categories migrate as manual; unclassified legacy records remain untouched without explicit action.
- Fixed/variable is independent metadata, editable singly/in bulk. Explicit classification wins; otherwise linked confirmed payments are fixed and all other expenses unclassified.

## Contracts and recurrence

- Additive models: contract, effective payment schedule/revision, payment association. Preserve historical schedules/matches when future amount/interval changes are entered.
- Contract fields: name, provider, kind (subscription/rent/insurance/energy/telecom/other), optional category/account, positive cents, start, optional inclusive end and user-entered cancellation date.
- Intervals 1/3/6/12 months. Preserve intended anchor day across short months/leap years. Future changes start at the selected new due date; do not rewrite matched historical occurrences.
- Suggestions need at least two matching payments in different periods fitting a supported rhythm, equal amount/counterparty, at most five days timing deviation. Never auto-create contracts.
- Confirmed-contract automatic matching needs unique counterparty/amount and a due-date difference of at most five days. Multiple contracts or payments leave a proposal. One payment per contract occurrence and at most one contract per transaction, enforced in the database.
- Manual date/amount mismatches require visible confirmation, without changing the actual amount or forecast. Unlinking blocks immediate automatic relinking until explicitly re-enabled.
- Badge actual linked transactions with contract name and detail link. Order active contracts by today's/future next unmatched due date. Older unmatched occurrences remain history and never block the rolling list; do not claim an unlinked payment is unpaid.
- Forecasts never create transactions or enter actual totals. Delete/unlink never deletes a bank transaction. Actual current-month dues and monthly/yearly equivalents are separately labeled; round only displayed fractional-cent averages.
- APIs: /contracts CRUD, /contracts/suggestions, /contracts/{id}/payments. Resolve duplicate/account-assignment conflicts explicitly; transfer existing category origins/classification/payment links atomically or refuse a conflicting merge.

## Analytics

- GET /analytics/overview: inclusive from/to dates, optional account/category, maximum 36 calendar months. Default last 12 completed months; presets 3/6/12 and custom range.
- Return monthly series, income/expense/net totals, average expenses, category shares and fixed/variable/unclassified actual expenses. Include booked accountless records; exclude pending/own transfers. Positive refunds remain income.
- Average denominator: fully selected past calendar months with at least one relevant transaction, including income-only months with zero expenses. Show included count and excluded reasons (no data/current/future/partial selection). No eligible month means unavailable, not invented zero. Existing bookings do not establish complete bank-history coverage.
- Trend: latest eligible month versus its immediate calendar predecessor, only if both contain relevant data. Return exact cent delta; percent unavailable for a zero base. Do not treat gaps as zero or compare a partial month with a full month.
- Category/chart selection opens the underlying transactions with the same filters. No individual-transaction splitting. Preserve rule/contract annotations during later import/reconciliation/account assignment.

## Verification and delivery

- Apply migrations to clean and representative populated disposable PostgreSQL; compare all original fields/identities/annotations and test constraints. Review SQL and compatibility; do not rewrite applied migrations or reset shared databases.
- Cover manual category clearing, conflicting rules, classification overrides, contract uniqueness, repeated imports/merges, amount mismatches, recurrence month/year/leap boundaries, ending/versioning, nullable averages, rounding, missing/current/clipped months and zero trends.
- Real browser journeys: upload to analytics, rule assignment, contract confirmation/automatic marking, next-due ordering, drill-down, theme tiles, keyboard and loading/empty/error recovery.
- Visual checks at 360/768/1024/1440 in both modes with synthetic data; contrast/focus/reduced motion. Relevant skills: coding-workflow/guidelines, api-contract-check, database-change, vue-feature-check.
- Run format:check, lint, strict typechecks, Prisma validation, tests, production build and browser suite; then exact-head Linux container/backup/restore CI.
- After user-approved merge and successful immutable main publication, a separately approved rollout requires fresh encrypted backup/recovery, recorded existing config/images, paused writers, reviewed migration, original-data preservation and target health/HTTPS/proxy checks. Keep secrets/private identity out of outputs and source. No automatic down-migration.

## Status

- Implementation approval: explicit user instruction to implement the complete reviewed plan in the existing checkout.
- F0 committed as 8f423da. F1 verified: consistent controls, calendar/month selection, keyboard/mobile journeys and safe category deletion. F1 committed as 2328a7d. F2 verified: 23 preview tiles, six Ayu variants, compatible persistence and circular Nuxt UI toggle. F2 committed as dee4bc8. F3 verified: rules/templates/manual provenance/classification, additive migration and merge preservation. F3 committed as 2e174b9. F4 verified: confirmed contracts, suggestions, anchored/versioned recurrence, unique payment ownership, history and merge preservation. F4 committed as bd1df09. F5 verified: exact multi-month reports, disclosed averages/trends, Nuxt UI charts, matching transaction filters and final navigation/dashboard. F5 committed as d31e748. F6 local verification passed: 115 tests, 20 browser scenarios and the four-width/two-mode matrix. PR #10 is open with explicit merge-after-green-CI approval. Linux CI 42479998163 passed code revision 0320fd0, including all 20 browser scenarios and encrypted contract/rule restoration. F6 source acceptance is complete; current documentation-head checks still gate merge. Production rollout requires its separate approval. Audit commit 392d988 preserved. Production unchanged at the last verified 1e33afa until a new approved rollout.
