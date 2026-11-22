# Implementation Plan: Rebuild the Household Ledger

**Planning base**: `main` at `740f210` | **Feature context**: `004-rebuild-household-ledger` | **Date**: 2026-11-22

**Spec**: [spec.md](spec.md) | **Issue-linked branch**: `21-rebuild-the-household-ledger-with-querry-kit` ([#21](https://github.com/mfurti/financial-tracking/issues/21))

## Summary

Rebuild the navigation, overview, and resource screens around a Workboard-inspired page structure. Reorganize API controllers by domain as each screen moves to the new contract. Querry Kit owns general-purpose list queries and table interaction. Finance calculations, imports, authorization, and writes remain in domain services with shared runtime validation. Roll out one complete data-to-screen slice at a time, starting with Transactions.

## Technical Context

| Area                  | Decision                                                                                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Languages and runtime | Strict TypeScript, Vue SFCs, Node 24.22.1, pnpm 11.25.0                                                                                                                                                                |
| Core stack            | Existing Nuxt 4/Nuxt UI 4, NestJS 11/Fastify, Prisma 7/PostgreSQL 17, shared Zod 4                                                                                                                                     |
| Querry Kit            | Pin Nest 1.1.2, Nuxt 0.2.10, and Nuxt UI 3.3.10. Verify frozen install and actual API and web builds under Node 24 before wiring product screens.                                                                      |
| Tests                 | Existing Vitest, disposable PostgreSQL, Playwright Chromium, and Docker operations checks                                                                                                                              |
| Deployment            | Existing private, same-origin deployment and containers. Existing database remains the system of record.                                                                                                               |
| Query performance     | Server-side paging capped at 100 rows per request. Test against 10,000 seeded transactions and compare query plans and timings with the existing read path. Use the existing CI-scale PostgreSQL setup for comparison. |
| Scope                 | Shipped household ledger, existing private owner access, desktop and narrow web layouts, German and English.                                                                                                           |

## Constitution Check

The installed constitution is an unratified template with no concrete principles. The repo README, coding guidelines, existing contracts, and CI define the applicable project checks.

| Gate                               | Pre-design | Post-design                                                                                                                                                                              |
| ---------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preserve live data and exact money | Required   | Existing schema, migrations, IDs, cents, and dates are the baseline. Restore and reconciliation are acceptance gates.                                                                    |
| Maintain access and API boundaries | Required   | Same-origin session/CSRF stays in place. New query handlers enforce permission, strict query shapes, scope, and output fields. Existing consumers keep their contract during transition. |
| Follow executable coding standards | Required   | Retain the existing toolchain, intentional Vue block order, strict types, and manual JSDoc review. Clarify the documented attribute grouping against effective ESLint.                   |
| Preserve operability               | Required   | Carry forward installation, backed-up restore and operations coverage. Run existing CI checks before cleanup can be accepted.                                                            |

## Project Structure

```text
apps/api/src/                 domain modules, existing services and Querry Kit resource reads
apps/api/prisma/              existing schema and migration history
apps/web/app/                 shared shell and domain screens with Nuxt UI and Querry Kit
apps/web/server/api/          existing same-origin proxy
packages/contracts/src/       shared query, response, error and command contracts
tests/                        domain, database, integration and browser checks
docs/                         current user, API, coding, deployment and recovery documentation
specs/004-rebuild-household-ledger/
  spec.md
  plan.md
  research.md
  data-model.md
  contracts/
  quickstart.md
```

**Structure decision**: Keep the two application packages and shared contracts. Group Nest controllers and their query adapters as domain modules when replacing existing routes and screens. A domain owns its finance invariants and commands. Introduce shared infrastructure only when multiple resource implementations need it.

## Design and Cutover

1. Inventory supported journeys, public routes, deployed data compatibility, and current documentation ownership. Recheck GitHub PRs #16 and #20 and the actual base revision before implementation. Include changes that have landed in the selected base.
2. Prove package compatibility in the pinned runtime and assemble the new shell. Preserve the same-origin transport, session handling, locale, privacy, and settings. Implement a real transaction read through Querry Kit as the first end-to-end check.
3. Deliver Overview to Transactions with a shared period/account scope, safe paginated reads, URL-synchronized filters, and the current edit and classification flows. Keep legacy cursor requests working while migrating internal clients.
4. Rebuild Accounts, Contracts, Imports, Analysis and Settings. Apply Querry Kit list patterns to Accounts and Contracts after the transaction slice. Keep aggregates, historical snapshots, CSV, bank interactions, and stateful actions on their domain contracts.
5. Compare restored records and domain behavior, run the full gates, then remove replaced components and unused interfaces after checking imports, routes, runtime registration, tests, and published callers. Treat integration or deployment branches separately.
6. Remove superseded documents only after preserving any live requirements or recovery evidence and updating references. Keep the new Spec Kit artifacts as the active rebuild plan.

## Cleanup Candidates

| Candidates                                                                                                                                                                  | Required evidence before removal                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/plan.md`, `docs/initial-implementation-checklist.md`, `docs/ausbauplan.md`, `docs/HAUSHALTSBUCH_CODEX_PLAN.md`, `docs/haushaltsbuch-implementierungsspezifikation.md` | Port remaining supported requirements to the active spec or user/ops documentation. Update README and cross-links.                                                                      |
| `docs/finanzfluss-umsetzungsplan.md`, `docs/vertragsanalyse-usability-plan.md`, old checklists, and historical design variants                                              | Preserve active acceptance evidence and durable user documentation. Remove stale visual/concept fixtures only when replacement tests cover their obligations.                           |
| Replaced UI components, query wrappers and CSS                                                                                                                              | Check source, Nuxt auto-imports/routes, build, and browser flows. Delete obsolete code in the slice that removes its last consumer.                                                     |
| Earlier Spec Kit plans and concept/reference tooling                                                                                                                        | Check the active branch and every script reference, including `scripts/capture-concept-reference.mjs`. Retain migration, backup, deployment, and recovery assets with active consumers. |

## Validation References

- [Research and tradeoffs](research.md)
- [Domain and compatibility model](data-model.md)
- [API and UI contracts](contracts/)
- [Quickstart and validation guide](quickstart.md)
