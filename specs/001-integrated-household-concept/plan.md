# Implementation Plan: Integrated Household Finance Concept

**Branch**: `13-implement-integrated-household-finance-concept` | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)
**Input**: `specs/001-integrated-household-concept/spec.md`
**Issue**: [#13](https://github.com/mfurti/financial-tracking/issues/13), related to [#3](https://github.com/mfurti/financial-tracking/issues/3). Issue, linked branch and a separate planning-only commit/push were explicitly approved. The user subsequently approved the documented project rules as this feature's governance baseline and authorized speckit-implement for all 48 tasks. Merge and deployment remain separate decisions.
**Status**: Source implementation, full local acceptance and Linux verification/container/restore acceptance are delivered; proof and task handover are recorded in tasks.md and validation.md. The user requested public repository visibility, resolving the former CI startup blocker. Current PR checks remain authoritative for every subsequent review head. Existing project rules remain the explicitly accepted governance baseline; the constitution template is not ratified. Merge/deployment remain separate.

## Summary

Translate the 39-view integrated concept into the existing Nuxt application. Preserve real ledger/import/contract workflows, introduce the concept's responsive composition and analytics modules, and isolate synthetic investment and role demonstrations. Extend existing shared contracts and API services only for missing persistent household functionality. Do not embed the standalone HTML or its compiled dependencies.

**Review refinement, 2026-11-18**: Prioritize visual fidelity in five explicit dimensions: depth, spacing, contrast, tiles, and animation. The user's refinement adds visual acceptance requirements; it does not approve task generation or remove the existing functional scope. The detailed design is [contracts/visual-design.md](contracts/visual-design.md).

## Technical Context

**Language/Version**: Strict TypeScript 5.9, Vue 3.5, Node >=24.22.1 <25; pnpm 11.25.0.
**Primary Dependencies**: Existing Nuxt 4.6.4, Nuxt UI 4.12.0, Tailwind 4, TanStack Charts 1.5.0, NestJS 11/Fastify 5, Zod 4.6.7, Prisma 7.10.1. No dependency upgrade planned.
**Storage**: PostgreSQL for real records, profile, groups, reserve goal, recorded wealth and notification acknowledgements. Versioned browser-local synthetic state for investment/role demonstrations. Preserve existing device-local appearance keys; extend device preferences for locale, privacy and analysis tiles.
**Testing**: Vitest, disposable PostgreSQL harness, Playwright, ESLint, Prettier, Nuxt/TypeScript checks, Prisma validation and existing CI.
**Target Platform**: Existing browser application and self-hosted API; desktop, tablet and touch phone. Preserve existing same-origin proxy, cookie session and CSRF handling.
**Project Type**: pnpm workspace web application with shared transport contracts.
**Performance Goals**: Preserve server-side bounded analytics windows (maximum 36 months), existing transaction pagination, and scoped queries; avoid per-card full-ledger fetches. No invented production latency baseline. Compare interactive responsiveness against the current application using the same synthetic dataset.
**Constraints**: BIGINT integer cents internally, decimal strings on the wire; no float arithmetic for real money. Berlin calendar dates. Single owner/shared ledger. No real data in demo storage/logs, no live broker, no new bank connector. Preserve all historical financial records.
**Scale/Scope**: One owner; 39 concept views, five viewport widths, two languages, existing 18 theme families plus custom appearance. Reuse existing financial features rather than replace their services.

## Constitution Check

_GATE: Check before Phase 0 and after Phase 1._

`.specify/memory/constitution.md` contains only template tokens, including `[PROJECT_NAME]`, `[PRINCIPLE_1_NAME]`, and `[GOVERNANCE_RULES]`. It is not a ratified project constitution. Constitutional compliance cannot be evaluated or reported as passed. No constitution has been silently written or ratified.

| Gate                                           | Before research                   | After design                       | Evidence / disposition                                                                                              |
| ---------------------------------------------- | --------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Governance baseline available                  | Constitution template unavailable | RESOLVED by explicit user decision | Existing documented project rules accepted for this feature; no constitution ratification claimed.                  |
| Preserve documented coding conventions         | Design conforms                   | Design conforms                    | `docs/coding-guidelines.md`; existing lint/format/type/CI configuration. Runtime checks remain implementation work. |
| Preserve exact financial and history semantics | Design conforms                   | Design conforms                    | Integer cents, shared Zod contracts, additive schema changes, immutable snapshot components.                        |
| Preserve auth/credential boundaries            | Design conforms                   | Design conforms                    | Existing owner singleton, cookie session/CSRF; local roles isolated.                                                |
| Reuse stack and constrain scope                | Design conforms                   | Design conforms                    | No HTML embedding, broker service, multi-user migration, dependency migration, or new delivery infrastructure.      |

**Resolution**: The user explicitly selected “Projektregeln verwenden und speckit-implement starten” after reviewing issue #13 and planning commit 0ae88ae. Use docs/coding-guidelines.md, the approved specification/contracts/tasks, and existing executable checks as the feature governance baseline. Preserve the constitution and reviewer-owned checklist markers unchanged; their old open marker is superseded for execution by this specific user decision.

## Project Structure

### Documentation (this feature)

```text
specs/001-integrated-household-concept/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  tasks.md
  contracts/
    ui.md
    api.md
    visual-design.md
  checklists/
    requirements.md
```

`tasks.md` was generated by the subsequently requested task-generation phase. `.specify/feature.json` points to this directory and is ignored machine-local context.

### Source Code (repository root)

```text
apps/web/app/
  layouts/default.vue
  assets/main.css
  components/                  # Reuse form, date, month, chart, contract and appearance controls
  composables/                 # Shared selection/preferences and isolated demo state
  utils/                       # Exact formatting, privacy, translation and demo validation
  pages/                       # Existing routes plus scoped additions in contracts/ui.md
apps/web/server/               # Preserve existing API proxy/access boundary
apps/api/src/
  analytics.ts                 # Extend scoped merchant and review reporting
  ledger*.ts                   # Preserve transaction/account/transfer rules
  contracts*.ts                # Reuse recurrence and payment rules
  controller.ts                # Reuse session/password operations
  workspace*.ts                # Proposed profile/group/goal/snapshot/acknowledgement services
apps/api/prisma/
  schema.prisma
  migrations/                  # Additive migration, no history rewrite
packages/contracts/src/index.ts
scripts/e2e-server.ts           # Add synthetic feature fixtures
playwright.config.ts           # Add tablet/boundary coverage
 tests/                        # Existing unit/integration tests and new scoped cases
 tests/e2e/                    # Reuse existing journeys and add concept-specific acceptance
```

**Structure Decision**: Retain current workspace boundaries. Domain services own financial calculations; web components consume validated reports. Demo-only calculations and persistence remain isolated under web utilities/composables.

## Design and Delivery Sequence

1. Reconcile existing R1/I2/I3 work from `docs/todo.md` and usability plans against the new specification. Capture reference screenshots and the 39-view matrix before replacing layouts.
2. Establish shared visual tokens and representative overview, analysis-tile, account-card, and dialog compositions. Review depth, spacing, contrast, tiles, and motion against `contracts/visual-design.md` before propagating the design. Then build shared shell, responsive composition, localization, masking, and loading/error patterns. Preserve existing financial routes and accountless operation.
3. Apply compact overview, transaction/account/import/classification screens; validate the existing journeys before adding new domain behavior.
4. Extend shared schemas and analytics service for category/merchant detail and monthly review; reuse exact scope and transfer exclusion. Add configurable 3/6/12-completed-month analysis modules.
5. Add additive workspace persistence and API contracts for profile/groups, reserve goal, immutable recorded wealth, and acknowledgement state. Validate migration preservation in a disposable populated database.
6. Adapt contract list/detail/edit/review and calendar using existing schedule rules and planned-versus-actual semantics.
7. Add versioned synthetic investment and role demonstrations, including reload, order validation, scenario changes, and confirmed demo-only reset.
8. Complete settings, contrast-validated custom appearance, notification links, all view mappings, responsive/keyboard checks, and feature-wide regression proof.

This is delivery sequencing for plan review, not a generated task list. Later tasks must be coherent validated increments with stable IDs and the repository's required commit boundaries.

## Validation Strategy

Use [quickstart.md](quickstart.md) for commands and acceptance scenarios. Static/design validation applies now; application checks, migrations, screenshots, and behavioral regressions apply after implementation. Require API contract consistency, migration preservation, Vue accessibility/responsive/localization checks, exact financial reconciliation, and demo isolation evidence. Preserve existing checks rather than weaken tests to accept changed markup.

Treat the five visual dimensions as separate acceptance checks, not a generic screenshot approval. Record computed spacing/radius/state values against the final reference cascade, contrast measurements for supported themes, and motion checks under normal and reduced-motion preferences. Use stable screenshots for geometry and short interaction recordings for animation. No visual dimension is considered verified merely because navigation and financial tests pass.

## Complexity Tracking

| Issue                         | Why it exists                                                                  | Treatment                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Missing ratified constitution | Spec Kit was installed with template governance                                | Explicit project-rules baseline approved; no implied ratification.        |
| New workspace persistence     | Prototype browser state is unsuitable for durable real household goals/history | Small additive records; existing balances/import runs are not repurposed. |
| Local synthetic simulation    | Concept includes interactive demo investing and roles                          | One versioned demo store; no broker backend or authorization changes.     |
