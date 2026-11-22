# UI Contract: Ledger Shell and Workboard-Inspired Tables

## Shell and Finance Overview

- Desktop provides persistent navigation and a centered content column with a compact page heading, period/scope controls, summary strip, and focused panels. Narrow layouts stack summaries and give keyboard-accessible access to the same destinations.
- Primary destinations are Overview, Transactions, Accounts, Analysis, Contracts, Imports, and Settings. Provide clear access from relevant destinations to category management, bank connections, notifications, reserves, and wealth. Keep supported deep links or redirect them with their relevant selection.
- Overview pairs booked income/expenses and their selected period with recorded balances and their observation coverage. Label unavailable observations explicitly. Provide drill-down links into the matching date and account scope. Each screen retains German and English copy, selected theme, and masking.

## Tables and Editing

- Each list presents a page title, relevant action, filtering/search controls, sort indicators, rows and pagination. Use the pinned release's Querry Kit controls. Keep the canonical query state in the route for shareable drill-downs and back/forward navigation. Persist device-level presentation settings independently of financial query state.
- Changing filter/sort resets the page. Edits refresh the affected page and relevant summaries. If the current page no longer exists, reload the last available page. Ignore stale responses after a filter, scope, or navigation change.
- Distinguish initial loading, retained results during refresh, unfiltered empty, filtered empty, and failed requests with accessible feedback and a working retry. Preserve unsaved input on revisitable errors and return focus to the row or its nearest stable target when closing details.
- Use semantic table and form controls, accessible labels, visible focus, escape behavior, and keyboard actions. Preserve masking in text, charts, tooltips, and accessible labels from first paint. Restrict horizontal scrolling to an explicitly bounded region when a table requires it.
