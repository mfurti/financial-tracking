# API contracts

Base: `/api/v1`. JSON over the same HTTPS origin; single-user cookie sessions. Zod operation contracts in `@financial-tracking/contracts` define inputs, responses, pagination, errors, and the OpenAPI inventory. Nest DTO adapters stay in the API. The frontend imports schemas/types directly and validates responses rather than maintaining generated duplicate types.

All implemented operations are checked against the inventory at application startup. A global response interceptor validates/strips controller results. OpenAPI 3.1 is generated from those schemas, with registered paths, success/error statuses, query/path inputs, cookie auth, and CSRF headers. Custom Zod refinements (for example date ordering and BIGINT bounds) are enforced at runtime even where JSON Schema cannot express them.

Run `DATABASE_URL=<local-url> node apps/api/dist/export-openapi.js` after building to write `openapi.json`; optionally set OPENAPI_OUTPUT to a destination. Export does not execute startup recovery. No unauthenticated Swagger route is exposed.

- Authentication: POST `/auth/login`, GET `/auth/session`, POST `/auth/logout`, POST `/auth/password`. Login requires the configured Origin; authenticated writes also require X-CSRF-Token. Password change requires the old password and revokes every session.
- Ledger: accounts, balances, transactions, bulk category assignment, categories, transfer linking/unlinking, monthly analytics, and bank connections.
- Imports: CSV preview/commit, recent history, individual run status, unresolved issues, explicit duplicate decisions, manual bank start, challenge continuation, cancellation.
- Amounts: decimal integer-cent strings backed by PostgreSQL BIGINT. Dates: YYYY-MM-DD; timestamps: UTC ISO-8601. Unknown balances are absent, never synthesized as zero.
- Transaction pages: cursor sorted by bookingDate/id descending; default 50, maximum 100. History and issue lists are bounded to 100 and 1,000 respectively; resolve displayed review entries and reload for subsequent entries.
- CSV preview response samples the first twenty valid rows; all accepted normalized rows are staged in PostgreSQL. Invalid rows require explicit partial-import consent. Completed/ambiguous review data is independent of the original upload, which is not retained.
- Added account PATCH bankConnectionId for explicit reassignment of an IBAN-bearing CSV account to a FinTS connection. Bank import refuses silent cross-connection IBAN duplication.

The application is a new v1 contract; no historical client compatibility is claimed. No multi-tenant/role model exists in this single-user private application. All financial endpoints require authentication; UI visibility is not an access boundary.
