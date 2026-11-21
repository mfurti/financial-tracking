# Operator Rehearsal Results

**Scope**: Approved preparation task T008. Tests used uniquely owned isolated resources and explicitly empty recovery databases. They did not perform production maintenance.
**Result**: All seven scenarios passed. Exact operational bindings, archive identities and measured durations remain in the protected local rehearsal record and approval packet.

## Observed scenarios

| Scenario                         | Required behavior                                                                                  | Observed result                                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Unavailable immutable image      | Staging fails before application startup                                                           | Blocked; test web remained stopped                                                                                                         |
| Missing secret                   | One-shot startup fails without changing original data                                              | Blocked; original-field comparison passed; test web remained stopped                                                                       |
| Candidate migration failure      | Failure is recorded, original data/storage retained, access paused                                 | Actual image migrator failed under a controlled isolated DDL trigger; failed journal state observed; original application fields preserved |
| Unexpected original-field change | Complete preservation gate rejects startup                                                         | A deliberately altered isolated credential field produced only a sanitized failure code; test web remained stopped                         |
| API readiness failure            | External web is not started                                                                        | Dependency-free internal startup failed its readiness bound; test web remained stopped                                                     |
| Recovery after failure           | Use a newly empty target with compatible previous images                                           | Independent restore recovered the original schema and the actual previous application image became ready                                   |
| Successful controlled update     | Explicit migration, preservation, internal readiness, backup and external readiness occur in order | Passed; dependency-free starts created no canonical migrator rerun; encrypted post-update archive authenticated                            |

## Method and bounds

The same reviewed Compose command shapes were used: explicit one-shot migration followed by --no-deps readiness-bound API/backup and then web startup. The complete comparator and reviewed migration/default gates verified the successful upgrade before application startup.

Faults were deliberately introduced only into isolated fixture configuration or copied data. A migration-trigger failure exercised an actual unsuccessful candidate image migration, including its failed journal state; it was not relabelled as a successful atomic rollback. No failed target was restored over: the recovery test used a different explicitly empty database.

Each scenario had a separately restored original baseline. One-use restore identities/plaintext stayed in isolated tmpfs; the original private identity remained on the administrative machine. No private row or original credential value was emitted. The production application retained its running images and remained healthy.

Timing samples for restores, migration/startup and the complete run were measured and retained privately. They are not an outage guarantee or permission to extend a maintenance window. Cold image pulls and final quiescent production checkpoint remain execution preflight concerns.

## Cleanup and evidence limits

After proof and encrypted outputs were retained off-host, every labeled task-owned container, private clone database volume, isolated network, temporary synthetic TLS key and owned runtime directory was removed with explicit identity/path checks. Original production services, storage, secrets, private identity and backup archives were not removed.

This proves preparation/recovery/stop behavior. It does not prove a final paused checkpoint, production upgrade, live-bank interoperability or personal owner acceptance. G2 is still unapproved.
