# Feature Specification: Integrated Household Deployment

**Feature Branch**: 15-deploy-integrated-household-finance-workspace, linked to [deployment issue #15](https://github.com/mfurti/financial-tracking/issues/15).
**Created**: 2026-11-21
**Status**: Plan accepted for task generation by explicit speckit-tasks invocation; no implementation or deployment authorized.
**Input**: User description: "deployment", following the completed integrated household concept.
**Related delivery**: [Integrated feature](../001-integrated-household-concept/spec.md), issue #13, merged PR #14.

## User Scenarios & Testing

### User Story 1 - Recover existing household records (Priority: P1)

As the owner, I can approve an upgrade with a verified recovery route that preserves my actual financial records and existing access.

**Independent Test**: Restore a fresh encrypted archive into an isolated empty environment; compare all original application records and fields before and after the proposed upgrade.

**Acceptance Scenarios**:

1. **Given** an existing populated installation, **When** recovery is rehearsed, **Then** every original application table and field is accounted for without exposing private records in evidence.
2. **Given** recovery fails or original records differ unexpectedly, **When** readiness is evaluated, **Then** the production upgrade remains blocked.
3. **Given** the prior application has not been tested with the upgraded data structure, **When** rollback is planned, **Then** binary-only rollback is unavailable until compatibility is established; isolated restore remains the recovery route.

### User Story 2 - Upgrade the existing installation (Priority: P1)

As the owner, I can approve a specific tested release and maintenance window, retaining existing accounts, imports, categories, contracts, credentials, backups and network access controls.

**Independent Test**: Rehearse the ordered update and failure stops using the exact candidate and a restored copy before authorizing production changes.

**Acceptance Scenarios**:

1. **Given** a release is unfinished or cannot be matched to its published images, **When** readiness is evaluated, **Then** no production change begins.
2. **Given** imports or synchronizations are still committing, **When** maintenance is prepared, **Then** the operator waits or aborts the deployment rather than interrupting the commit.
3. **Given** writers are paused and recovery is proven, **When** the approved upgrade runs, **Then** only reviewed pending migrations execute and existing financial records remain unchanged.
4. **Given** migration or preservation verification fails, **When** execution stops, **Then** access stays paused and existing storage is retained.

### User Story 3 - Verify delivery and obtain owner acceptance (Priority: P2)

As the owner, I can distinguish deployment health, verified data preservation and my own acceptance of the new interface.

**Independent Test**: Complete the deployment evidence record and inspect representative screens through the existing private HTTPS address.

**Acceptance Scenarios**:

1. **Given** the upgrade is healthy, **When** technical acceptance runs, **Then** authentication, existing financial views, new interface destinations and access restrictions are verified without a real bank operation.
2. **Given** technical checks pass, **When** the delivery is reported, **Then** the actual release, recovery evidence and remaining personal acceptance are recorded separately.
3. **Given** an incident occurs after new writes resumed, **When** recovery is considered, **Then** restoring an earlier archive is not treated as lossless; new writes require preservation/reconciliation and a specific recovery decision.

### Edge Cases

- Live production differs from the last documented revision or has additional pending migrations.
- The release archive expired, publication failed, image labels disagree, or pulls fail.
- The private recovery identity, registry access, free storage or agreed maintenance window is unavailable.
- An archive is valid but empty, incomplete, stale, or missing records present at the write pause.
- An older table has a composite key, no id column, nullable fields or large signed exact amounts.
- Migration fails after partially changing the schema, or application readiness never becomes healthy.
- Shared networks/IP allocation changed, HTTPS is unavailable, or direct LAN access is unexpectedly allowed.
- The actual previous production image is incompatible with the new schema.
- The owner has already made new writes before a later recovery decision.

## Requirements

### Functional Requirements

- **FR-D001**: Select one immutable candidate and prove its complete required verification and successful publication before production execution.
- **FR-D002**: Record actual target revision, pending upgrade steps, running components, configuration identity and recovery images without disclosing secrets.
- **FR-D003**: Obtain explicit production approval for the candidate, target, data migrations, write pause, recovery route and maintenance window.
- **FR-D004**: Drain committing work and stop all ordinary application writers before the final pre-update archive and migration.
- **FR-D005**: Verify a fresh encrypted populated archive and isolated recovery covering every actual pre-migration application table and original field, including exact amounts and original credentials.
- **FR-D006**: Apply only reviewed pending upgrades and preserve existing financial records, identities, relationships, singleton ownership, secrets and backup recipients.
- **FR-D007**: Preserve the existing production storage, address, hostname and access restrictions; do not recreate shared networks or build source on the server.
- **FR-D008**: Keep access paused on migration/preservation/readiness failure; select recovery by actual schema compatibility rather than reversing the schema automatically.
- **FR-D009**: Validate internal readiness and preservation before reopening external application access; then verify private HTTPS, login, representative old/new views and direct-access denial.
- **FR-D010**: Record a successful encrypted post-update archive and verify continued persistence without a shared-host reboot.
- **FR-D011**: Record technical acceptance and personal owner acceptance separately, with observed outcomes and evidence limits.
- **FR-D012**: Require preservation/reconciliation of post-resume writes before any older-archive recovery; never overwrite the active database as a shortcut.

### Key Entities

- **Release candidate**: Tested revision, published image identities and matching release package.
- **Target baseline**: Actual running release, configuration and schema state.
- **Recovery checkpoint**: Encrypted archive, protected configuration and verified restoration results.
- **Deployment record**: Approval, ordered state transitions, measured timings and observed checks.
- **Owner acceptance**: Human confirmation of the deployed user experience.

## Success Criteria

### Measurable Outcomes

- **SC-D001**: All required candidate verification/publication gates pass before production changes.
- **SC-D002**: Every original application table and original field is included in preservation comparison; zero unexplained differences.
- **SC-D003**: A populated pre-update archive is restored successfully in isolation and recovery duration is measured.
- **SC-D004**: All listed health, access, financial-preservation and representative interface checks have actual outcomes; no unsupported bank/role/reboot acceptance is claimed.
- **SC-D005**: The deployment record identifies the actual running candidate, successful post-update backup and reopening time.
- **SC-D006**: Actual downtime is recorded against the owner-approved window; no unmeasured recovery-time promise is made.

## Assumptions

- This is an upgrade of the existing household installation, not first-user provisioning or a new hosting platform.
- The merged integrated candidate is selected initially; later revisions require renewed candidate verification and scope review.
- Host details in existing documentation are discovery inputs, not a claim that the live target was inspected during planning.
- Missing execution credentials, backup identity and maintenance-window values are preflight inputs, not permission to expose secrets or act.
- Existing project/deployment rules govern this follow-up. The constitution is still an unratified template.
- New business features, registry visibility/credential changes, shared-host reboot, router changes and real bank login are outside scope.
