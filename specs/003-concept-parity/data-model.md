# Presentation models

- **Overview**: active Berlin month, existing income/expense/balance amounts, at most five recent bookings.
- **Transaction list**: month or existing explicit date range, advanced filters, selection and cursor; date groups are derived from loaded ordered records.
- **Dialog context**: active dialog, trigger, current effective filter/group scope; opening and closing preserve underlying route and focus.
- **Chart preview**: existing exact aggregates form labeled series. Missing observations produce an empty state; geometry may use bounded ratios.
- **Account and contract summaries**: derived from existing observed balance and forecast responses. Preserve unknowns, current filter scope and plan labels.

These are derived presentation states. There are no schema or storage changes.
