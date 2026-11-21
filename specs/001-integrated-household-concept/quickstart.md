# Quickstart Validation Guide

This guide validates the implemented integrated source. The approved project-rules governance baseline remains in effect. Local Prisma/format/lint/type/test/build gates passed, including 225 tests and a complete browser selection of 428 passes plus 12 intentional recording/theme skips. Exact commands, baseline compatibility, visual evidence and subsequent Linux CI/restore results are recorded in [validation.md](validation.md). Merge, deployment and production migration remain separate decisions.

## Prerequisites

- Node >=24.22.1 <25 and pnpm 11.25.0.
- Repository dependencies and generated Prisma client.
- Original concept files at `.local/design-concepts/output/html/integrated/` are needed only for reference recapture/fingerprint review against `contracts/ui.md`; application/runtime browser tests do not embed or require those ignored HTML files.
- Disposable PostgreSQL for database/browser tests. The existing harness starts embedded PostgreSQL when `TEST_DATABASE_URL` is unset. Any configured `TEST_DATABASE_URL` must name an expendable `*_test` database; the harness drops its public schema. Never point it at a real household database.
- Use synthetic fixtures, including empty/accountless, refunds, transfers, unknown merchants, missing balances, recurring contracts and month boundaries.

## Setup and Existing Gates

From the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter api exec prisma validate
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Build precedes Playwright: `scripts/e2e-server.ts` imports compiled API and starts the built web server. The configured browser harness owns isolated test servers/databases. Existing populated/empty desktop and mobile suites remain unchanged. Concept projects now cover 360, 390, 700, 701, 768, 1024, 1100, 1101 and 1440 px, each with its own server/API ports and disposable database. Explicit --project selections start only their required servers; omitted selection retains the full suite. `pnpm db:migrate` is not a required manual step for this guide because the disposable harness applies migrations.

`pnpm test:e2e` uses `scripts/e2e-runner.ts` to collect the actual Playwright selection and run every selected file/project pair in bounded batches. Each batch owns at most three servers and budgets at most eight real login attempts per project, accounting for the extra sessions in password and motion journeys. Servers/databases restart between batches; production authentication and its ten-attempt limit are unchanged. File, project and grep selections still go through Playwright. `--list` retains the native read-only listing. Direct `pnpm exec playwright test` remains available for focused runs within one server's login budget.

Batch traces/screenshots and JSON results remain under `test-results/batch-N`; `test-results/batches.json` records the original selection and completed batches. A failed or incomplete batch fails the command. An explicit `--output` selects a different parent directory. Linux CI already collects `test-results`, so diagnostics remain available without changing workflow permissions.

## Acceptance Scenarios

| Scenario                | Procedure                                                                                                                           | Expected result                                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Responsive shell        | Navigate all 39 mappings at desktop/tablet/phone; inspect 360, 390, 768, 1024, 1440 px plus 700/701 and 1100/1101 boundaries        | Correct composition, active navigation and back links; no page-wide overflow, dead links or hidden required actions.                      |
| Exact actuals           | Select month/account/group; open monthly, category and merchant detail using refunds, transfers and unknown buckets                 | Displayed cent totals equal scoped contributing records; transfer legs excluded; empty group never means all accounts.                    |
| Completed-month reports | Use 3/6/12 months across year/leap boundaries and partial/gap fixtures                                                              | Current partial month excluded from completed comparisons; eligible averages and gaps disclosed.                                          |
| Import preservation     | Upload CSV with empty purpose/populated booking text; correct mapping, resolve issue/duplicate, commit, assign and preview rollback | Existing invariants hold; useful description retained; rollback impact explicit and confirmed.                                            |
| Contract calendar       | Create/edit a month-end recurrence; review suggestions; inspect planned costs and calendar versus observed payments                 | One recurrence interpretation; no duplication or classification of plans as paid actuals.                                                 |
| Reserve                 | Mark eligible Tagesgeld, save positive target, reload; test zero/negative target, unknown and stale balances                        | Valid target persists, invalid target rejects, missing source coverage visible, no fabricated balance rows.                               |
| Recorded wealth         | Record, retry same idempotency key, import new observations, reload history                                                         | One immutable original record; exact signed component sum, original timestamps and coverage retained.                                     |
| Demo isolation          | Buy/sell, reject insufficient funds/holdings, execute plan twice for one period, transfer, change scenario, reload/reset            | Atomic synthetic changes, no duplicate plan execution, no real mutation or broker/bank request; reset confirmed and demo-only.            |
| Settings                | Edit profile/groups, modules, locale/privacy, custom tones; reload and change password                                              | Documented persistence; deduplicated groups; complete translations/masking; contrast failures explained; existing session rules retained. |
| Storage/failure         | Block/corrupt storage, expire session, fail save, race report requests, repeat submit                                               | Clear recovery, drafts preserved, stale results discarded and no false save success.                                                      |
| Access boundaries       | Call new routes unauthenticated/CSRF-invalid; edit local roles                                                                      | Existing auth rejection, no private payload leak, local roles never grant access.                                                         |
| Accessibility           | Complete journeys by keyboard; inspect labels, focus, tooltips, reduced motion and touch                                            | Focus visible/restored, modal behavior correct, meaningful accessible names and no unmasked amounts in privacy mode.                      |
| Migration preservation  | Apply additive migration to populated disposable pre-feature database                                                               | Every previous field/record preserved; new constraints and previous-version read compatibility checked.                                   |

## Evidence to Attach

Use the route/view checklist in `contracts/ui.md`, matching screenshots for three screen families, exact financial reconciliation results, migration preservation results, API schema/OpenAPI consistency, and demo isolation assertions. Record actual command exit codes and separate pre-existing failures. Run existing feature-wide CI gates after scoped checks; no deployment or production migration is part of this guide.

## Focused Visual Refinement Checks

Use [contracts/visual-design.md](contracts/visual-design.md) as the detailed acceptance contract. T045/T047 results are recorded separately in validation; these are actual implementation checks, not claims inherited from planning.

| Dimension | Validation                                                                                                                                       | Expected evidence                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Depth     | Compare canvas, cards, selected controls, sticky navigation and an open dialog in light/dark mode                                                | Clear layer hierarchy; shadow-free ordinary tiles; readable overlays and unobscured focus.                                                         |
| Spacing   | Compare reference and implementation gutters, column gaps, tile padding, headings and compact rows at three screen families and breakpoint pairs | Recorded computed values and intentional deviations; no clipping with long text or large amounts.                                                  |
| Contrast  | Measure text, essential controls/focus and chart marks in supported themes, including composited colors and custom tones                         | At least 4.5:1 normal text, 3:1 large text and essential non-text indicators; signs, keys and state markers remain meaningful without color alone. |
| Tiles     | Inspect relevant variants through default, hover, focus, pressed, selected, disabled, loading, empty and error states                            | Consistent label/value/context hierarchy, accessible semantics, stable geometry, truthful missing/error states.                                    |
| Animation | Record hover, theme change and dialog entry/exit with normal and reduced motion                                                                  | No tile/row displacement; restrained property-specific feedback; no decorative animation under reduced motion; usable focus throughout.            |

Use settled screenshots for layout comparisons and separate recordings/interaction assertions for transition behavior. Do not claim a passing screenshot proves animation or contrast compliance.

## Scoped Concept Checks

```powershell
pnpm test:e2e tests/e2e/concept-fixture.spec.ts
pnpm test:e2e --project=concept-390
pnpm test:e2e --project=concept-768
pnpm test:e2e --project=concept-1440
```

Use the verified Node 24.22.1 executable on the process PATH. The concept fixture smoke checks actual login/accounts on each isolated project; subsequent feature tests add acceptance rather than treating fixture reachability as a visual pass.

The previous-application compatibility test needs Git and tar. It rebuilds immutable feature base `1f8d113bfa9294707bcd3b6ea6a3a03e8e12ec62` with the unchanged pinned lockfile. Shallow CI checkouts fetch only that exact commit with their existing read-only origin credentials. No live household database, bank, broker or production image is involved.

The former account-payment/spending-limit startup blocker was resolved by the user's explicit request to make the repository public. Required Linux jobs now execute normally. Verify the exact current review head before treating CI as passed; a prior deployment's green checks, local static operation checks or a pending run are not substitute evidence. Repository visibility and runtime verification are separate from merge/deployment approval.
