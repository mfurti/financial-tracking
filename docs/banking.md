# Bank integration

Status: adapter implemented; **live Sparkasse Bodensee compatibility is not proven**. No product ID or real bank login has been provided. CSV remains usable independently.

Register your own FinTS application product ID and confirm the official HTTPS endpoint for Sparkasse Bodensee (BLZ 69050001) with the bank. Configure `FINTS_PRODUCT_ID` and `FINTS_BANK_URL` on the server; never put PIN/TAN in environment variables or source files. Only this bank code is supported by the initial adapter.

The adapter uses a dedicated Node worker. lib-fints 1.5.3 can print raw decoder responses even with debugging disabled; worker stdout/stderr are drained without forwarding or persistence. Requests are restricted to the configured HTTPS URL, redirects are rejected, network calls time out after 30 seconds, and the worker is terminated after ten minutes or cancellation. PIN/TAN exist only in worker memory. A restart requires a new run.

Supported integration target: account discovery, booked EUR balances/transactions, textual TAN and banking-app approval. Photo/flicker challenge rendering is not supported and returns a clear BANK_UNSUPPORTED error. Bank wait intervals/poll limits are enforced. No pending data is inferred. The library returns numeric monetary fields; conversion rejects values outside safe cent precision and fractional-cent values before BIGINT persistence.

Before declaring live support: verify official endpoint, application product ID, login, available TAN method/media, account list, balance, complete transaction history, approval continuation, cancellation, and negative cases. Record only sanitized outcomes. Reference-less bank observations require review on repeated/overlapping imports rather than unsafe automatic matching.

CSV accepts UTF-8/BOM or Windows-1252 decoded by the upload client, semicolon/comma delimiters, German signed amounts, and German/ISO dates. Limits are 10 MiB and 50,000 data rows. Mapping is explicit; invalid rows need explicit partial-import approval. Raw uploaded files are not retained; normalized preview rows are staged until commit/cancel.

Sources: [bank PSD2 information](https://www.sparkasse-bodensee.de/de/home/aktionen/psd2.html), [lib-fints](https://github.com/robocode13/lib-fints). LGPL-2.1-or-later applies to lib-fints; retain the dependency's license in distributed images and provide its upstream source link.
