# Using the household ledger

This guide covers the ledger rebuild in [issue #21](https://github.com/mfurti/financial-tracking/issues/21). See [project status](status.md) for production history.

## Overview and navigation

The monthly balance is income minus expenses for the selected booking month, not an available bank balance or forecast. Booked transactions without an account count globally; pending transactions and own transfers do not. Positive refunds remain income. All monetary calculations use exact cents.

Previous/next, the month picker and This month retain the selected month in the URL. Choose an account, a saved group or all accounts. Select Income or Expenses to open the corresponding booked transactions and keep the selected month and scope. Desktop uses a header navigation with direct links to Imports and Settings. Narrow screens use bottom navigation and More for secondary destinations. The Contracts page links to the calendar.

Bank balances are separate dated observations. Missing is not zero; observations older than 48 hours are marked stale. Imported transaction sums cannot reconstruct a reliable bank balance.

## Importing a CSV

Use Upload CSV or Import CSV and the visible file-selection area, or drop a file onto it. Fully valid files process automatically without requiring an account or bank connection. Several booking months open the last imported month while retaining every actual booking date. Import options can choose an existing account or override the detected format.

Required columns are booking date, signed amount and transaction text. Optional columns preserve source details/references. Bank references must identify one transaction; mandate/customer references usually do not. Missing currency defaults to EUR, without conversion. Nonempty explicitly mapped purpose/alternative text columns can supply the booking text; all-empty mapped text still requires a decision.

Supported dates include DD.MM.YYYY, YYYY-MM-DD and Sparkasse short years such as 07.11.26. Short years mean 2000–2099; use four digits for older dates. Impossible dates reject. Negative amounts are expenses.

Automatic decoding recognizes UTF-8 and marked UTF-16, with Windows-1252 fallback. Check umlauts because legacy single-byte encodings can be ambiguous. File format explicitly supports UTF-8, Windows-1252/ANSI, ISO-8859-15/Latin-9 and UTF-16 LE/BE, plus semicolon/comma/tab delimiters. Changing it rereads the selected file. Ambiguous headings remain your choice.

Only genuine format, mapping, invalid-row or duplicate exceptions interrupt the automatic path. Invalid rows are grouped with expandable details. Confirm explicitly before importing only valid rows; missing text is never fabricated. Duplicate review compares source fields and offered candidates before retaining existing data, accepting incoming data, keeping separate transactions or skipping a new row.

A lost commit response checks the same import instead of duplicating it. Leaving an uncommitted preview cancels it; late responses cannot navigate away from a newer page. History currently lists the latest 100 runs; historical paging remains open in [todo.md](todo.md).

## Lists and details

Transactions, Accounts and Contracts load one page at a time. Use the filter bar, column sort controls and page navigation to narrow a list. The URL preserves the applied filters, sort and page for reloads and bookmarks. Open a row for details. The contract calendar includes all planned payments in its applied scope.

## Assignment, categories and transfers

The Without account filter finds accountless imports. Select transactions and a target account, then compare date, amount, text, source, references, status and category before confirming. Existing/incoming values can survive a merge; Keep separate retains both transactions, and Skip leaves the source unassigned. Conflicting manual categories require a choice. Changed comparisons require a fresh preview; identical retries cannot count a transaction twice.

Link own transfers by selecting the two transaction rows. Transfers remain in history but not income/expense reports. Resolve conflicting existing payment/transfer links explicitly before merging sources. Browsing or filtering never changes imported amounts.

Uncategorised means included but not assigned. Category maintenance can add, rename, deactivate or delete categories without deleting transactions. Templates reuse suitable existing categories and preserve your names.

Rules match a complete counterparty or a deliberate literal text fragment, case-insensitively. Direction can restrict income/expenses; smaller priority numbers win. Contradictory equal-priority matches remain unresolved. Rules apply to new imports; reapplying to existing transactions requires confirmation. Manual categories, including deliberately empty choices, remain protected. Removing a rule does not rewrite old transactions.

Set Fixed, Variable or Automatic/unclassified on one or several transactions. Confirmed contract payments automatically count as fixed; otherwise unclassified stays unclassified. Amounts never change.

## Analysis and account groups

Analyses starts with twelve closed months. Choose three/six/twelve months or an inclusive range up to 36 calendar months. Account, saved account-group and category scopes survive reload and carry into contributing transaction pages. Accountless scope is separate. Empty groups remain empty; deleted groups fail instead of showing global totals. Inactive group members retain historical transactions.

Averages include fully selected past months with relevant bookings. Income-only months contribute zero expenses; empty months do not contribute. Current/future/partial months can affect actual totals while being excluded from the average, with reasons shown. No eligible month means not calculable. Trend requires the last eligible month and its immediately preceding eligible calendar month; it never skips a gap. A zero base has no percentage, while the cent difference remains available. Rounding occurs only at the final display boundary.

Category, fixed/variable, merchant and monthly detail links retain exact scopes. Merchants use exact trimmed source names and an explicit unknown bucket. Equivalent tables preserve exact values independently of approximate chart geometry.

Customise selects/orders six modules and bar/ring charts on this device. Cancel preserves saved choices. Recorded wealth, reserve and contract-cost modules explicitly retain global/source/planned scope independently of transaction filters. Imported account/category/merchant/contract names retain their spelling when language changes.

## Contracts and calendar

Two or more matching recurring payments can suggest a contract. Review amount, rhythm and first due date, then Confirm and continue, Later for this review, or Not a contract to dismiss the pattern. Hidden proposals can be restored. Same-pattern payments do not undo dismissal; changed amounts/rhythms can create a new proposal. Swipes/previous/next only navigate; dirty changes require a decision. A lost save response can be safely retried.

Confirmed contracts can link an unambiguous real payment with the same amount/counterparty within five days of its due date. Optional account scope narrows matching. Ambiguity stays open; missing attribution does not prove nonpayment. Future revisions start on an existing future due date. Historical rules/links remain. Month-end anchors survive short months, contract end is inclusive, and a cancellation deadline sends no cancellation.

Manual assignment compares a real expense to a due occurrence, requiring extra confirmation for discrepancies. One payment per occurrence and one contract per transaction are supported; split/combined payments are not. Unlink preserves the booking and blocks immediate automatic relinking, while later explicit assignment remains possible. Contract deletion preserves transactions/manual categories.

Cost analysis prorates forecasts: an annual EUR 120 averages EUR 10/month. The calendar separately shows the planned EUR 120 in its due month, with monthly totals, effective revisions and linked observed payments. Plans never create bookings or increase actual spending. Account/group scope applies; unbound contracts contribute only globally.

## Reserve and recorded wealth

Explicitly designate active EUR accounts for the reserve and save a positive target. Only latest BOOKED observations contribute. AVAILABLE never substitutes; missing/stale/negative sources remain visible. The default EUR 3,000 target is not a bank balance.

Wealth separates current observations, explicitly recorded immutable snapshots and the synthetic demo. Review coverage/timestamps before recording. Retrying a lost response returns the same frozen record. Later imports/account changes cannot rewrite captured labels, amounts or observation dates. Entirely unknown sources remain labelled unknown despite a mathematical known-component sum of zero. Earlier wealth history is never invented.

## Synthetic investments and local roles

Demo cash, securities, whole-share orders, transfers, scenario prices, activity and savings plans use synthetic device data. They never write real financial records or contact brokers/banks. Plans execute only for an explicitly selected month; repeated execution of the same period is safe. Unknown securities, insufficient cash/holdings and invalid quantities reject atomically.

Settings → Local demo roles edits display entries only. Owner/viewer labels create no users, invitations or permissions. Confirmed demo reset clears portfolio, plans, activity/history and roles together, preserving real records and independent preferences. Corrupt/unsupported/conflicting storage needs explicit recovery. Visible memory-only operation lasts for the session and can be lost on reload.

## Settings and notifications

Profile/contact metadata and named account groups persist on the server. Contact email changes neither login nor recovery identity. Removing a group removes memberships, not financial records. Password change verifies the current password and revokes every real session. Password/PIN/TAN fields clear after attempts.

Language (Deutsch/English), amount masking, modules/chart style, notification-kind filters and appearance belong to this device. Money/dates follow German or British English conventions without floating-point monetary rounding. Masking replaces financial text and accessible chart information from first render; it is presentation, not an access boundary.

Appearance offers 23 preset tiles from 18 families, six explicit Ayu variants, paired custom colors and system/light/dark brightness. The circular control preserves family/Ayu borders. Invalid custom contrast cannot replace a working palette. Reduced motion removes decorative transitions; tiles stay stationary. See [appearance.md](appearance.md). Blocked/quota-limited storage shows a session-only notice; reload can restore the last durable choices.

Notifications link unresolved import issues and confirmed planned occurrences from today through the next 30 Berlin calendar days. Booked links suppress due events; pending links do not prove payment. Mark read saves only a receipt; it never resolves imports or changes contracts/payments. Revised sources can become unread. Removed sources/stale acknowledgements require reload. Device filters only change visibility. There is no email/push delivery.

## Recovery and access

Import history → Undo import previews removable import-owned transactions/identities. Other-source/uncertain ownership is protected. Explicitly choose whether to keep linked bookings or remove eligible import-owned bookings and links; removing links needs extra confirmation. Annotations belonging to removed bookings are removed with them. Contracts/opposite transfer entries survive. Retained rows are not reverted to earlier values. Refresh changed previews before confirming; retained sources remain duplicate-protected on reupload.

Date/month controls support keyboard entry, selection and clearing. Searchable lists support Escape. Help, Skip to content and modal focus are keyboard-accessible. Ordinary drafts survive failed saves; sensitive inputs clear. Expired/revoked sessions require sign-in. Dedicated field feedback for legacy revision/payment forms and richer proposal evidence remain in [todo.md](todo.md).

CSV is independent of FinTS. Real banking still requires your own registration, an officially confirmed endpoint and separately approved supervised testing. Synthetic tests do not establish live compatibility. See [banking.md](banking.md) and [fints-registration.md](fints-registration.md).
