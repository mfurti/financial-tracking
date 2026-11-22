# Research: Rebuild the Household Ledger

## Querry Kit and runtime compatibility

**Decision**: Use published `@querry-kit/nest@1.1.2`, `@querry-kit/nuxt@0.2.10`, and `@querry-kit/nuxt-ui@3.3.10` on Node 24. Resolve peer dependencies in the consuming packages and keep the lockfile frozen in CI. Use the Nest core and Zod entry points and the UI release's `QTableToolbar` and `QTablePagination` defaults.

**Rationale**: Registry metadata for these three versions permits Node 24. NestJS 11.2.8, Swagger 11.4.8, and Zod 4.6.7 match the Nest peers. Nuxt 4.6.4 and Nuxt UI 4.12.0 satisfy the UI peer ranges. The existing lock resolves Vue 3.5.45, Vue Router 5.4.0, and VueUse core 14.4.0. Verify matching VueUse router and any other required peers under the repository's runtime. Metadata and source exports were inspected. Install, integration, and build tests remain implementation gates.

**Alternatives considered**: The latest registry versions checked (Nest 2.1.1, Nuxt 1.1.1, Nuxt UI 4.2.0) require Node 26.13.0 and a runtime change across package metadata, CI, and all container stages. Workboard's sibling checkout links suit library development. Published versions support a reproducible application install.

- [Nest release documentation](https://github.com/querry-kit/nest/blob/c706314c2981a8f23f0b2819c039c504be148385/README.md)
- [Nuxt release documentation](https://github.com/querry-kit/nuxt/blob/7756834bc4ffaef51f1a3519c4d8d283a7b074e1/README.md)
- [Nuxt UI release documentation](https://github.com/querry-kit/nuxt-ui/blob/e15f92f8d0241f7a9242bc431de4346a2eed45e0/README.md)

## Layout and navigation

**Decision**: Use Workboard's compact page heading, summary strip, and focused content panel, with its toolbar/table/pagination rhythm. On narrow screens stack summaries and keep navigation, scope filters, and row actions reachable. Give the ledger original typography, labels, and navigation. Apply Finanzfluss cues to period/account scoping, income and expense summaries, and drill-downs.

**Rationale**: These choices support the existing month-first workflow and make the reference layout recognizable through composition and interaction. The supplied `/user` URL exposed a JavaScript shell to the web reader. Public Copilot dashboard and budget documentation supplied the financial interaction references.

**Alternatives considered**: Preserve the existing navigation and card styling alone, which would leave the requested layout rebuild incomplete. Replicate unrelated investment and subscription screens, which would expand the product scope.

- [Workboard reference revision](https://github.com/querry-kit/querry-kit/tree/a0a69356815d36da7703d291d78a5f9c0e5710a2/examples/workboard)
- [Finanzfluss dashboard](https://www.finanzfluss.de/copilot/hilfe/dashboard/)
- [Finanzfluss budget and transactions](https://www.finanzfluss.de/copilot/hilfe/budget/)

## Query integration and domain boundaries

**Decision**: Start with a parallel, protected transaction table read using `ResourceQuery` and shared strict Zod query/response schemas. Use separate, explicit endpoints for Querry Kit page queries during the transition. Keep the existing cursor route and write schemas stable while callers transition. Enforce bounded field, filter, and ordering allowlists and a server-owned scope before counting and selecting rows. Client setup uses Querry Kit resource APIs under the same-origin proxy with existing Zod response validation and normalized errors.

**Rationale**: A new Querry Kit table needs page metadata, while the current transaction route returns a cursor. Shared business scope and mapping preserve classification and totals. The generic Zod parsing in the pinned library leaves domain-specific Prisma-shaped values open, so the app must define their accepted subset. The library transport leaves session/auth policy to the application.

**Alternatives considered**: Change the cursor response in place, which breaks existing callers. Run all finance actions through generic resources, which obscures transaction and recovery invariants. Keep all querying through bespoke composables, which would provide superficial library adoption.

## Existing data, cleanup, and engineering standards

**Decision**: Reuse the existing database and migration history. Preserve invariants with restored-data reconciliation, domain tests, and OpenAPI/client/runtime checks. Remove dead code and plans with traceable replacement or retirement evidence. Apply existing coding standards to the new files. Record effective Vue attribute grouping in the canonical guidelines when updating them for Querry Kit.

**Rationale**: The application already has nine ordered Prisma migrations and specialized backup/recovery validation. Main at `740f210` includes PR #19. At planning, PR #16 contained in-flight deployment verification and PR #20 proposed budgets, splits, and forecasts. The initial checkout also held unrelated local work. The approved detached worktree isolates the plan. ESLint effective rules and Prettier were checked on representative Vue, API and contract files. ESLint enforces script/template/style and attribute ordering. Its default grouping differs from the prose in `docs/coding-guidelines.md`; formatting uses Prettier and JSDoc coverage is manual.

**Alternatives considered**: Reset the data model, which would introduce avoidable migration and recovery risk. Delete old concept folders as a group, which would remove current references and evidence. Adopt the skill's default Vue block or whitespace policy, which conflicts with intentional project rules.
