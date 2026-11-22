# API Contract: Querry Kit Resource Reads

## Endpoints and Compatibility

| Endpoint                       | Purpose                                          | Compatibility                                                                                      |
| ------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| GET /api/v1/transactions/table | First Querry Kit read for the transaction screen | Existing GET /api/v1/transactions retains its Zod cursor input and `{ items, nextCursor }` output. |
| GET /api/v1/accounts/table     | Account table after the transaction slice        | Existing account list/detail and balance reads retain their response shapes.                       |
| GET /api/v1/contracts/table    | Contract table after the transaction slice       | Existing contract list/detail, calendar, analysis, and payment requests retain their shapes.       |

Update runtime validation, OpenAPI, shared contracts, and consuming clients in the same slice. Legacy routes may be retired after identifying all callers and accounting for their migration or published compatibility. Existing writes and domain-specific analytics, imports, synchronization, and recovery use their current contracts during the rebuild.

## Request

- Requests use the existing authenticated same-origin `/api/v1` proxy. Preserve permission, session expiry and normalized application errors. Existing mutations retain origin checks and the session-bound CSRF token.
- Accept Querry Kit's documented page, sorting/filter and field query serialization through the selected client release. Reject malformed shapes and undeclared filters, operators, relation paths and projections. Keep generic grouping and arbitrary includes outside the supported query surface.
- Default to page 1 and 25 rows with a maximum of 100. Transaction default ordering is booked date descending with ID as the stable tie-breaker. Explicit sorting adds an ID tie-breaker.
- Transaction v1 filters are text search, inclusive booked-date range, account scope including accountless entries, and category. Use the existing meaning of drill-down filters such as flow and scope when mapping an Overview link. Exact operator and field names are declared in shared Zod schemas and documented in OpenAPI. Keep search text bounded under the existing application policy.
- Validate scope and filters before querying, then intersect client filters with server-owned visibility rules before reading or counting rows. Clamp the requested range only at the client after receiving complete counts. A page beyond the end can return empty items with valid counts.

## Response

- Return Querry Kit's `{ items, meta }` page envelope. The metadata includes `page`, `perPage`, `itemCount`, `pageCount`, `hasPrevPage`, and `hasNextPage`.
- Each row returns the entity's stable ID and only public fields permitted by the declared projection. For transaction tables these fields cover what the list displays and opens, including booked date, integer cents string, currency, public transaction label, and permitted account/category summaries.
- Keep permitted lookup fields consistent between filter definitions, sort definitions, data projection, public schemas, and the web table. Invalid query input returns the existing safe 400 envelope. Missing/expired authentication returns 401 and denied permission returns 403 without row data or counts.
- Cover valid selection, known-invalid selections and filters, scope before counts, exact cents and dates, deterministic pagination, and unchanged legacy behavior in API tests. Verify serialization roundtrips through the actual pinned client before expanding rollout.
