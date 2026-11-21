# Implementation plan: Concept parity corrections

**Feature**: 003-concept-parity. **Specification**: [spec.md](spec.md). **Workspace**: existing checkout. Preserve the owner’s pending acceptance findings.

## Technical context

Use the existing Nuxt/Vue client, Nuxt UI, Playwright fixtures and CSS tokens. Reuse existing authenticated read endpoints and contract calendars. No dependency, database, production or access changes. Preserve URL filters and direct destinations while restoring primary in-place interactions. Match presentation with comparable synthetic states and report real-data limitations.

## Constitution check

The constitution is an unfilled template. Follow existing project rules, exact amounts, demo isolation, accessibility and documented authorization. The proposed changes stay within the client and existing contracts.

## Implementation sequence

1. Restore shared header, navigation, compact month controls, overview preview and tile states.
2. Restore compact transactions and accounts composition with existing edit/filter functions.
3. Restore the analytics hierarchy, data previews and details, contracts and More.
4. Run a direct rendered comparison, keyboard/touch/motion checks and affected functional checks. Keep deployment and owner acceptance separate.

## Design outputs

[Research](research.md) · [Data model](data-model.md) · [UI contract](contracts/ui.md) · [Validation guide](quickstart.md).

## Post-design gate

Use existing typed read models. A missing observation stays unknown. Use existing dialogs, responsive breakpoints and financial formatting. Do not report parity without the direct comparison.
