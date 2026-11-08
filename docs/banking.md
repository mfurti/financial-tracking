# Bank integration

> **Documentation update, 2026-11-08:** Real compatibility remains open as E1/E2 in [todo.md](todo.md). See [status.md](status.md) for delivered source and [user-guide.md](user-guide.md) for current behavior.

Status: adapter implemented; **live Sparkasse Bodensee compatibility is not proven**. No product ID or real bank login has been provided. CSV remains usable independently.

The user has not applied for a product registration yet. Follow the German step-by-step [registration guide](fints-registration.md), researched against the official FinTS registration/FAQ pages on 2026-11-07. No registration or bank-support message has been sent on the user's behalf. The official bank endpoint remains unconfirmed.

Register your own FinTS application product ID and confirm the official HTTPS endpoint for Sparkasse Bodensee (BLZ 69050001) with the bank. Configure `FINTS_PRODUCT_ID` and `FINTS_BANK_URL` on the server; never put PIN/TAN in environment variables or source files. Only this bank code is supported by the initial adapter.

The adapter uses a dedicated Node worker. lib-fints 1.5.3 can print raw decoder responses even with debugging disabled; worker stdout/stderr are drained without forwarding or persistence. Requests are restricted to the configured HTTPS URL, redirects are rejected, network calls time out after 30 seconds, and the worker is terminated after ten minutes or cancellation. PIN/TAN exist only in worker memory. A restart requires a new run.

Supported integration target: account discovery, booked EUR balances/transactions, textual TAN and banking-app approval. Photo/flicker challenge rendering is not supported and returns a clear BANK_UNSUPPORTED error. Bank wait intervals/poll limits are enforced. No pending data is inferred. The library returns numeric monetary fields; conversion rejects values outside safe cent precision and fractional-cent values before BIGINT persistence.

The authenticated setup endpoint reports missing product/endpoint configuration without returning their values. The UI disables PIN submission until configuration exists. Offered methods and required media are selected explicitly; unsupported or missing bank media remain an actionable limitation. App approval is checked only on explicit confirmation, at the bank's minimum interval and maximum attempt count. An expired run requires a new manual refresh; an incorrect PIN is never automatically retried.

Initial queries default to the previous 90 days; successful account cursors use a 14-day overlap on refresh. Optional from/to dates are available in the UI. Actual bank history limits, complete account coverage and the supported authorization methods remain unverified until the accompanied live test. Only booked EUR data is requested; no pending balance/transaction or complete lifetime history is inferred.

Every manual run discovers protocol parameters afresh. Raw BPD/UPD, decoder output and bank protocol messages are not cached in the database. Worker output accepts empty protocol metadata only; normalized account/transaction observations retain their source provenance. Known PIN and submitted TAN strings are redacted from bank-provided free text inside the worker, and its transient references are cleared on completion.

Synthetic acceptance covers successful method/media/app continuation through real PostgreSQL/import services, wrong PIN, unavailable bank, expiry, cancellation, concurrency/restart recovery, bank waits/poll limits, safe malformed output and worker termination. Browser fixtures cover method/media/TAN/app states, pending approval, rejection, expiry and cancellation on desktop/mobile. These are deliberately separate from real endpoint/library/bank compatibility proof.

Before declaring live support: verify official endpoint, application product ID, login, available TAN method/media, account list, balance, complete transaction history, approval continuation, cancellation, and negative cases. Record only sanitized outcomes. Reference-less bank observations require review on repeated/overlapping imports rather than unsafe automatic matching.

CSV supports UTF-8/BOM, Windows-1252, Latin-9 and UTF-16 LE/BE decoded by the upload client; semicolon/comma/tab delimiters, German signed amounts, German/ISO dates and Sparkasse short years (2000–2099). Recognized valid files map and import automatically without a required account. Unknown columns and invalid rows require explicit choices/partial-import approval. Limits are currently fixed at 10 MiB and 50,000 data rows. Raw uploaded files are not retained; normalized preview rows are staged until commit/cancel. Separate debit/credit columns, CSV source balances and configurable limits remain C1–C3; actual-file acceptance remains E5 in todo.md.

Sources: [bank PSD2 information](https://www.sparkasse-bodensee.de/de/home/aktionen/psd2.html), [lib-fints](https://github.com/robocode13/lib-fints). LGPL-2.1-or-later applies to lib-fints; retain the dependency's license in distributed images and provide its upstream source link.
