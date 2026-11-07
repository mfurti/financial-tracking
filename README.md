# Household ledger

Private, single-user household bookkeeping. NestJS/Fastify, Nuxt UI, PostgreSQL/Prisma, and shared Zod contracts.

## Development

Requires Node 24.22.1+, pnpm 11.25.0, and PostgreSQL 17+. Copy `.env.example` to `.env` and provide a disposable/local database. Never use production credentials for tests.

```sh
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @financial-tracking/contracts build
pnpm db:migrate
pnpm --filter api build
pnpm --filter api admin:create
pnpm --filter api dev
pnpm --filter web dev
```

Load environment variables in the invoking shell (for example `node --env-file=.env`); pnpm commands do not implicitly load the root `.env`. The development origin defaults to `http://localhost:3000`. Production requires private HTTPS access.

Run `pnpm --filter api dev:compile` in another terminal for incremental API recompilation. `api dev` runs the compiled API with Node's watcher. The web server's internal destination is configured by NUXT_API_INTERNAL_URL.

See [expansion plan](docs/ausbauplan.md), [binding user plan](docs/HAUSHALTSBUCH_CODEX_PLAN.md), [checklist](docs/todo.md), [coding guidelines](docs/coding-guidelines.md), [API contracts](docs/api.md), [deployment](docs/deployment.md), [recovery](docs/recovery.md), and [banking prerequisites](docs/banking.md). External bank compatibility is a separate acceptance gate; CI uses synthetic data only. Production uses only a deployment bundle and registry images; source and builds stay off the server.
