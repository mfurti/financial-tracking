# Household ledger

Private, single-user household bookkeeping. NestJS/Fastify, Nuxt UI, PostgreSQL/Prisma, and shared Zod contracts.

## Development

Requires Node 24.22.1+, pnpm 11.25.0, and PostgreSQL 17+. Copy `.env.example` to `.env` and provide a disposable/local database. Never use production credentials for tests.

```sh
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @financial-tracking/contracts build
pnpm db:migrate
pnpm --filter api admin:create
pnpm --filter api dev
pnpm --filter web dev
```

Load environment variables in the invoking shell (for example `node --env-file=.env`); pnpm commands do not implicitly load the root `.env`. The development origin defaults to `http://localhost:3000`. Production requires private HTTPS access.

See [plan](docs/plan.md), [checklist](docs/todo.md), and [coding guidelines](docs/coding-guidelines.md). External bank compatibility is a separate acceptance gate; CI uses synthetic data only.
