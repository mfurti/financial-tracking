# Deployment Execution Record

## Current authority

Preparation tasks T001–T009 and the concretely approved production execution T010–T015 are authorized. The concrete operator proposal is prepared and held locally with its exact target, candidate/previous images, migration chain, protected recovery records and proposed window.

**State**: reopened.
**G2 response**: received; the owner submitted “Ja” to the concrete production proposal, conditional on successful current CI and fresh preflight.
**Production mutation**: approved migration and web reopening complete.
**Owner acceptance**: pending.

This public record deliberately omits confidential operational bindings. The operator supplies the protected local manifest and proposal directly for the owner's review; source approval or a public progress update does not grant production authority.

## Readiness evidence

- Selected application publication/integrity and read-only baseline discovery passed.
- Complete preservation and migration-history/default gates passed their source tests and protected recovery probes.
- The actual previous-image recovery route and the candidate container path were rehearsed independently.
- All seven controlled success/failure scenarios passed. Owned temporary recovery resources were removed.
- Exact timing samples, protected archive/configuration identities and immutable image bindings are in the local proposal, not this public issue.
- Current required checks for the selected application/tooling identities must remain successful; any identity or migration drift blocks execution.

## Approved execution boundaries

The proposal covers the normal ordered maintenance: approved writer pause, fresh final encrypted checkpoint with actual-archive verification, only reviewed pending migration, pre-start preservation/internal readiness and backup checks, then controlled reopening and read-only technical acceptance.

The owner accepted the concrete window. Current required checks and fresh read-only target/configuration checks passed before the approved write pause. Normal production credentials are never reset for acceptance; an existing authenticated owner session or interactive owner login is required where applicable.

On failure, keep access paused or use the approved pre-migration abort. A recovery/cutover beyond the concrete approved packet requires a decision based on actual state; never guess compatibility or overwrite an active database. After resumed writes, preserve/reconcile new data before an older-checkpoint recovery.

## Execution milestones

| Milestone                                               | Current outcome                     |
| ------------------------------------------------------- | ----------------------------------- |
| G2 concrete proposal/window response                    | Approved; prerequisite gates passed |
| T010 drain/pause/final checkpoint                       | Passed                              |
| T011 reviewed migration and original-field preservation | Passed                              |
| T012 internal readiness and completed encrypted backup  | Passed                              |
| T013 external reopening/write boundary                  | Passed after controlled reopening   |
| T014 authenticated workflow checks                      | Not started                         |
| T015 runtime/persistence/access/backup checks           | Passed                              |
| T016 owner experience acceptance                        | Pending actual observation          |

Only actual outcomes may replace these states. T009 completes proposal preparation; its external approval response belongs to G2 before T010, not an automatic implementation result.

## T010 — Observed execution

The approved write pause and drain completed. PostgreSQL and its original volume remained running. A fresh quiescent encrypted checkpoint was copied off-host and authenticated. This actual archive was restored into a newly empty isolated target; every original field and original migration-ledger record matched the paused source. The reviewed candidate upgrade passed on that restored input. Protected configuration equality and recovery material were retained. No production migration has run at this boundary.

## T011 — Observed execution

Only the approved immutable image assignments were changed atomically; other configuration, secrets and topology were preserved. The matching one-shot migrator completed only the reviewed pending chain. Before API startup, every original application field and original ledger record matched the paused baseline. All expected additive tables, reviewed checksums/status and sole approved initial default were verified; no financial or historical metadata was fabricated.

## T012 — Observed execution

The candidate API and backup services started with dependency traversal disabled while external web remained stopped. Internal health and actual immutable image identities passed. A newly completed encrypted post-update archive was copied off-host and authenticated; the original persistent database remained in use.

## T013 — Reopening attempt

The candidate web container became healthy and the reverse proxy logged HTTP 200 for the login page. The operator also required a German text match. The combined check failed and the operator stopped web again. The exact reason the check failed remains unverified. The reverse proxy logged only the login-page GET during the brief reopening. The proposed next check verifies the login form over HTTPS in either supported locale and confirms direct-address denial. The subsequent reopening is recorded below.

## T013 — Controlled reopening

The owner approved a second controlled start of the web container. Web became healthy and ordinary write access resumed. Fresh Chromium contexts received HTTP 200 over private HTTPS and rendered the localized login heading, both credential fields and the submit button in German and English. Direct LAN access returned HTTP 403. The elapsed time from the first pause to final reopening remained within the approved window. The protected execution record holds both write boundaries and their measured times. The first reopening attempt remains documented above. No owner credentials were submitted as part of these checks.

## T015 — Running deployment checks

All four services were healthy, and the three application containers matched the approved immutable images and revision. PostgreSQL retained the original persistent volume. API and PostgreSQL exposed no host ports. The trusted-proxy configuration, private HTTPS, direct-address denial and retained authenticated post-update backup were verified. Temporary resources created for the isolated final restore were removed. Authenticated read-only workflows and owner acceptance remain open.
