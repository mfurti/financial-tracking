# Personal finance tracker: initial implementation plan

Historical baseline for issue #1, delivered through merged PR #2. The current agreed expansion plan is [ausbauplan.md](ausbauplan.md), with the executable checklist in [todo.md](todo.md). Where requirements differ, the expansion plan takes precedence. Its approval currently covers planning/documentation only; no expansion implementation or deployment is authorized.

## Implementation precedence

The user-provided detailed specification supplements this plan. Shared Zod contracts remain binding instead of class-validator or a generated competing client. Follow the newer specification for PostgreSQL BIGINT cents serialized as decimal strings, cursor pagination, CSV limits, sessions, synchronization leases, staging, and transfer linking. Vue uses the specification's script/template/style block order. Task IDs below remain stable; the specification's FinTS feasibility T1 maps to this plan's T2.

## Product and acceptance criteria

Build a private, single-user household ledger with account balances, searchable transactions, categories, and monthly income/expense comparisons. The responsive interface uses German labels and formatting. Version 1 supports EUR only.

Run on a Linux server using Docker Compose. Access is restricted to the home network or VPN, with HTTPS and an application login. There is no public registration.

Version 1 is accepted when the user can import their transactions, categorize them, inspect accurate monthly totals, and restore the application from a backup. FinTS availability must be demonstrated separately; CSV functionality does not count as proof of live bank access.

Excluded from version 1: payments, transfers initiated through the app, investment portfolios, budgets, savings goals, forecasts, multiple users, public hosting, and scheduled bank synchronization.

## Architecture

Use a pnpm workspace with three packages:

| Location             | Responsibility                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `apps/api`           | NestJS with Fastify; authentication, authorization, imports, reporting, bank integration, and Prisma persistence |
| `apps/web`           | Nuxt with Nuxt UI; forms, dashboards, transactions, and bank authorization interactions                          |
| `packages/contracts` | `@financial-tracking/contracts`: shared Zod schemas and inferred TypeScript types                                |

Use PostgreSQL and Prisma migrations. Pin mutually compatible supported dependency versions and the package manager during project setup; commit the lockfile. No particular dependency version has been installed or validated yet.

### Shared contracts

- Zod schemas are the source of truth for API request bodies, parameters, queries, responses, pagination, and errors.
- Derive TypeScript types from schemas. Keep the contracts package independent of NestJS, Nuxt, Prisma, browser globals, and Node-only APIs. It must be safe to import in the browser without side effects.
- Use `nestjs-zod` for request validation, response serialization, and OpenAPI generation. Nest-specific DTO adapters belong in the API package.
- Reuse the schemas for frontend forms and runtime response validation in a small typed `$fetch` wrapper. Do not generate a second competing set of API types.
- Keep Prisma records and FinTS protocol types internal. Map them explicitly to public response schemas.
- Use PostgreSQL BIGINT cent amounts serialized as decimal integer strings, `YYYY-MM-DD` booking/value dates, and ISO-8601 timestamps with a timezone. EUR is the only accepted currency in version 1.
- Return field paths for validation errors without echoing submitted secrets. Bound request bodies, pagination, search inputs, and upload sizes.

### API surface

Expose REST resources under `/api/v1` for sessions, accounts, transactions, categories, monthly summaries, and import/synchronization runs. Runs support status inspection, authorization continuation, and cancellation. Define concrete route contracts in T1 before implementing their consumers.

Authenticate all financial endpoints. Use an administratively provisioned account, Argon2id password hashing, server-side sessions, secure HttpOnly cookies, CSRF protection, and login rate limiting. A VPN does not replace application authentication.

## Sparkasse Bodensee integration

Target institution: Sparkasse Bodensee, BLZ `69050001`. Confirm its official FinTS endpoint rather than deriving one from another Sparkasse's address.

Prefer `lib-fints` in the NestJS backend behind an internal `BankConnector` interface. The library documents account balances, transaction downloads, and decoupled TAN approval, but does not list Sparkasse Bodensee among its tested institutions. Treat compatibility as an unproven integration dependency.

Register an application-specific FinTS product ID. Verify supported account operations and the user's available TAN method before committing to live synchronization. Never reuse an unrelated application's product ID.

The default flow is user-initiated refresh with PIN entry for each run. Hold PIN/TAN only temporarily in backend memory; never persist them in PostgreSQL, local/session storage, request logs, error reports, or backups. Clear browser form values after submission and release backend references at completion, cancellation, expiry, or failure. Do not claim guaranteed memory zeroization in JavaScript.

Represent running, authorization-required, successful, failed, and cancelled states. Respect bank-provided polling intervals and timeouts. Permit one active run per bank connection. Do not automatically retry an incorrect PIN. A process restart ends in-memory authorization state and requires a new run.

Persist only the bank metadata needed for subsequent runs, after reviewing it for credentials and sensitive transient data. Display the last successful refresh per account. Preserve existing account data on failure; commit each account's imported data atomically only after its fetch completes. Make partial completion across accounts visible.

Provide a Sparkasse CSV fallback with preview, column mapping, validation errors, and explicit confirmation before import. If FinTS is incompatible, finish the CSV-based ledger and record the exact live-integration blocker. Do not silently introduce a paid Open Banking provider, another language service, or a custom FinTS protocol implementation.

Direct PSD2 integration is outside version 1: the bank describes that interface for authorized third-party services. No continuous real-time feed or unattended refresh is promised.

## Data and reporting

Model bank connections, accounts, timestamped balance snapshots, transactions, categories, and import runs. Store booking date separately from value date. Preserve source identifiers and import provenance for reconciliation.

Prefer stable bank references for deduplication, scoped to the account. Without an unambiguous identifier, present possible duplicates for review. Equal dates, amounts, and descriptions alone must not silently collapse genuine repeated purchases. Handle overlap between CSV and FinTS through the same import pipeline.

Preserve user-assigned categories and transfer classifications on reimport. Mark transfers between the user's own accounts and exclude them from income/expense totals. Keep pending transactions separate from booked transactions and exclude them from monthly totals. Do not derive an authoritative current balance from potentially incomplete transaction history.

Provide a monthly dashboard, transaction search with pagination and account/date/category filters, and category management. Include loading, empty, error, authorization, and cancellation states. Use booking dates for monthly reporting, German display formatting, and Europe/Berlin for user-facing times.

## Delivery sequence

| Task | Depends on | Deliverable and completion condition                                                                                                      |
| ---- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | None       | Workspace, contracts, persistence, authentication, and local Docker foundation; both applications can consume the built contracts package |
| T2   | T1         | FinTS compatibility proof or a documented blocker with a working CSV fallback                                                             |
| T3   | T2         | Durable import pipeline, reconciliation, categories, and correct monthly reporting                                                        |
| T4   | T3         | Complete responsive German interface and end-to-end user flows                                                                            |
| T5   | T4         | Required CI checks, production deployment, verified backup restoration, and operating documentation                                       |

Each task includes its relevant tests and documentation and ends with its own coherent commit. Add CI checks as tools and packages are introduced; T5 consolidates the final acceptance gate. Keep implementation within the approved feature scope.

The detailed execution checklist is in [todo.md](todo.md). Future implementation must follow the applicable task-record and implementation-approval workflow. This documentation commit does not authorize implementation, issue creation, deployment, or bank login.

## Verification and operations

- Contracts: valid/invalid payloads, amount/date bounds, pagination, secret-free errors, and agreement between runtime responses, frontend consumers, and generated OpenAPI.
- Imports: repeat runs, overlapping periods, real identical-looking transactions, CSV/FinTS overlap, invalid CSV rows, and German numeric formats.
- Banking: authorization required/pending/rejected, timeout, incorrect PIN, concurrent attempts, cancellation, restart, and per-account partial failure. Use sanitized fixtures in CI and a separate interactive real-account acceptance check.
- Reports: month boundaries, refunds, transfers, pending transactions, preserved categories, and cent-exact sums.
- Security/UI: unauthorized access, expired sessions, logout, CSRF, login limits, secret-free logs, and Playwright desktop/mobile flows.
- Quality: lint, format check, strict typecheck, unit/integration tests, and production builds. Document Vue ordering and JSDoc/TSDoc conventions; verify shared-package build order and browser compatibility.
- Operations: expose only the HTTPS reverse proxy on the intended private interface; keep PostgreSQL and the API internal. Use persistent volumes, daily encrypted backups with seven-day retention, separately managed backup keys, and documented migration/update procedures. Verify a fresh install and backup restoration before product use.

## Research references

These references support the integration direction, not a completed compatibility test:

- [Sparkasse Bodensee PSD2 information](https://www.sparkasse-bodensee.de/de/home/aktionen/psd2.html)
- [lib-fints documentation and product registration requirement](https://github.com/robocode13/lib-fints)
- [nestjs-zod validation, serialization, and OpenAPI integration](https://github.com/BenLorantfy/nestjs-zod)
- [Zod parsing and inferred types](https://zod.dev/basics)
