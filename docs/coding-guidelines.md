# Coding guidelines

- Node 26, pnpm workspaces, strict TypeScript. Two-space indentation, single quotes, semicolons, trailing commas, 120-column print width, LF endings.
- Shared Zod schemas define transport validation and inferred types. Prisma stays inside the API. Monetary values use BIGINT cents internally and decimal strings on the wire; never use floating-point arithmetic for money.
- Every handwritten function/method/helper/callback and exported type needs an accurate JSDoc purpose comment. Describe units, rejection behavior, permissions, or ownership when non-obvious. Review documentation coverage and meaning manually; the linter does not prove complete documentation.
- Vue follows the user specification's intentional script/template/style order. Within script: imports, props/emits, composables, state, computed, methods, then lifecycle. Use typed props/emits and shared Nuxt UI components.
- Vue attribute order starts with definitions, list rendering, conditionals and render modifiers, followed by global attributes, identity and slot attributes, models, other directives, grouped bound/static/boolean attributes, events and content. Preserve spread precedence. ESLint enforces block/attribute ordering; Prettier owns whitespace. This project deliberately uses Prettier's tag/content layout rather than a second conflicting Vue whitespace formatter.
- Keep controllers thin and business logic in services. Validate external input and public output. No `any`, production `console.log`, financial payload logging, or PIN/TAN persistence.
- Canonical configuration: `eslint.config.mjs`, `.prettierrc.json`, `tsconfig.base.json`, package-specific TypeScript configuration. Exclude generated Prisma/Nuxt/vendor/build files.

## Checks

From the repository root: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`. Prisma generation uses `pnpm db:generate`; migrations use `pnpm db:migrate` against the explicitly selected database. Fix commands (`pnpm format`) are separate from non-mutating checks. Each implementation task requires its relevant checks and its own commit.
