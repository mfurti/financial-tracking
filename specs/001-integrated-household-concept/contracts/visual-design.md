# Visual Design Contract

**Refinement requested**: Depth, spacing, contrast, tiles, and animation.
**Status**: Implemented acceptance contract. Source captures, computed geometry, palette checks and interaction recordings are recorded in [validation.md](../validation.md), including the T045 review.

## Reference and Interpretation

Use the final integrated HTML cascade, including `.T` and `.INTEGRATED` rules. Earlier experimental variants contain hover translations and shadows that later rules explicitly remove. Do not copy an early rule and accidentally reintroduce it. The source inventory and fingerprints are in [ui.md](ui.md).

The following dimensions are an explicit review priority across the existing feature scope. Reference-derived measurements are starting requirements; verify computed styles at each representative viewport before implementation. Values identified as proposed are implementation design choices, not measurements claimed from screenshots.

## 1. Depth and Surface Hierarchy

| Layer                        | Treatment                                                                                 | Acceptance                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas                       | Theme canvas color and spacious section separation                                        | Content surfaces remain identifiable in both brightness modes.                                                                                    |
| Content surface              | Theme card color, restrained border, rounded corners; ordinary tiles have no shadow       | Avoid arbitrary gradients, glass effects, heavy elevation, or nested card containers that dilute the reference hierarchy.                         |
| Controls and selected states | Semantic soft/accent surfaces, visible focus and state markers                            | Hover, focus, selection, and disabled state have distinct meanings; selected state survives pointer exit.                                         |
| Sticky navigation            | Opaque theme-aware surface above scrolling content                                        | Scrolled content never reduces label readability or obscures the focused item.                                                                    |
| Dialog / sheet               | Separate overlay layer with a dark backdrop; reference backdrop `#0e1424b8` and 5 px blur | Background content is visually subordinate and inert; backdrop contrast is checked per theme. Blur is an enhancement with a solid-color fallback. |

Reference dialog geometry: 18 px radius, 25 px padding, width `min(500px, 100% - 28px)`, bounded viewport height and internal scrolling. Specialized analysis dialogs may use their own reference dimensions. Preserve meaningful overlay stacking through the existing component system; do not solve depth with arbitrary escalating z-index values.

Depth comes primarily from surface tone, boundaries, layering, and spacing. Keep tiles and financial rows stationary and shadow-free on hover, as required by the final concept.

## 2. Spacing and Density

| Element                 | Reference-derived starting value                                    | Responsive behavior                                                                                                  |
| ----------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Main content            | Maximum 1480 px; 24 px top, 32 px horizontal, 125 px bottom padding | At <=700 px use 17 px horizontal gutters; account for fixed navigation and device safe areas without double-padding. |
| Overview grid           | 22 px column gap; 23 px vertical gap within a column                | Preserve overview composition from `ui.md`; avoid retaining fixed widths that cause overflow.                        |
| Analysis hub            | 24 px gap; desktop 1:2 column proportions                           | Single hub column on tablet/phone as in the final composition.                                                       |
| Feature grid            | 16 px gap; three / two / one columns                                | Desktop / tablet / phone respectively.                                                                               |
| Section heading         | 30 px above, 15 px below; 15 px between heading/action              | Wrap heading and action deliberately when space is limited.                                                          |
| Feature tile            | 20 px vertical and 22 px horizontal padding; 18 px internal gap     | Phone padding 18 px; content may increase tile height.                                                               |
| Compact account card    | 18 px vertical, 20 px horizontal padding; 16 px radius              | Preserve balance wrapping and independent controls without overlapping hit areas.                                    |
| Compact transaction row | Final desktop rule: minimum 56 px, padding 8 px 12 px               | Reconcile narrower mobile rules through computed-style inspection rather than assume desktop padding overrides them. |

Implement named shared tokens for gutters, grid gaps, inset spacing, radii, and motion. Keep meaningful reference values such as 17, 22, and 23 px rather than rounding the design indiscriminately onto a new scale. Separate section spacing from tile padding. Do not achieve uniform card heights by clipping data, labels, or focus rings.

## 3. Contrast and Readability

- Use semantic canvas, card, text, muted text, border, accent, financial-positive, financial-negative, and focus colors from the existing theme system. Validate final blended/composited colors, including `color-mix`, rather than only the base palette values.
- Normal text: at least 4.5:1. Large text: at least 3:1. Essential control boundaries, focus indicators, and informative chart marks: at least 3:1 against adjacent surfaces. Decorative separators need not be promoted to essential control outlines.
- Small contextual text remains readable. Reference tiles use 11–12 px context labels, but insufficient contrast or unusable mobile text must be corrected and recorded as an intentional accessibility adaptation.
- Positive/negative values retain signs or explicit labels; chart series have text keys and equivalent values. Selected items use a marker, outline, or label in addition to color. Disabled controls expose disabled semantics, not opacity alone.
- Existing supported light/dark themes and custom tones receive contrast checks. Use full visual review for default light, default dark, high contrast, and representative Ayu variants; investigate any palette-specific failures.
- Focus must remain visible on tiles, nested controls, dialogs, and near clipped or scrollable boundaries. Preserve the reference 2 px focus outline with 3–4 px offset, subject to contrast verification.

## 4. Tile Composition and State Matrix

| Variant              | Reference geometry and hierarchy                                                                                             | Interaction                                                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature tile         | 22 px radius; desktop minimum height 145 px; phone final narrow rule minimum 136 px; label 12 px, value 25 px, context 11 px | Whole surface is one semantic link/button where it has a single action. Graphic may highlight on hover; surface does not jump or gain a shadow.                                       |
| Insight tile         | 22 px radius; desktop minimum height 142 px; narrow layouts may use 129 px; value 26 px / 24 px in narrow rules              | Preserve label/value/context order and keyboard focus. Do not merge all variants into one forced height.                                                                              |
| Compact account tile | 16 px radius; balance approximately 28 px in final rules                                                                     | Preserve the existing reference's whole-card destination without placing nested buttons inside a link/button. Any independent action needs its own valid hit area and focus behavior. |
| Compact statistic    | Financial value first, supporting label second                                                                               | An interactive statistic needs button/link semantics, focus, and the same navigation result by keyboard.                                                                              |

All variants share theme tokens and alignment rules. Values can wrap safely, paired label/value rows stay aligned, and decorative graphics never squeeze the main amount out of view. Show a chevron only when it communicates navigation.

Define applicable states explicitly:

- **Default**: readable hierarchy and stable geometry.
- **Hover**: subtle graphic/icon or control color feedback; no tile/row translation or scale.
- **Focus**: visible outline independent of hover, retained during keyboard operation.
- **Pressed**: immediate color/border feedback without moving content.
- **Selected**: persistent semantic and visual marker, separate from temporary hover.
- **Disabled**: exposed unavailable state; no actionable appearance or dead click target.
- **Loading**: reserved geometry and accessible busy state; no misleading old financial value.
- **Empty**: truthful empty message with an appropriate next action.
- **Error**: concise explanation and retry; failure is not rendered as a zero balance.

## 5. Animation and Feedback

| Interaction                       | Motion rule                                                                   | Timing / verification                                                                                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Icons, miniature charts, controls | Transition only the relevant color, background, border or filter properties   | Reference transitions are approximately 180 ms; avoid `transition: all`.                                                                              |
| Financial rows and tiles          | No transform, translation, scale, elevation, or full-row animated highlight   | Bounding rectangles remain unchanged throughout hover/press. Final reference financial rows explicitly disable row transitions.                       |
| Dialog / sheet entry and exit     | Proposed restrained opacity transition; no large movement or spring overshoot | Proposed 160–220 ms, using the existing component transition system; immediately usable controls and correct focus timing.                            |
| Theme switch                      | Preserve the reference's intentional appearance transition where supported    | Theme state commits immediately; unsupported transitions use a direct change. Never animate through unreadable financial foreground/background pairs. |
| Charts and loading                | Avoid replaying decorative animation on every filter or refresh               | Data state remains correct; any optional animation must not delay exact labels or retry controls.                                                     |

Apply hover-only effects under `(hover: hover)` so touch does not retain a false hover state. Under `prefers-reduced-motion: reduce`, remove decorative transitions, animation, theme reveals, and smooth scrolling; keep immediate state changes, loading indicators with a static alternative, focus, and all actions available. Do not flash or continuously pulse financial values.

## Visual Acceptance Evidence

1. Capture the source and implementation with identical viewport, zoom, locale, theme, and comparable synthetic content. Review overview, analyses, account cards, contracts, settings, and one open dialog at 390, 768, and 1440 px.
2. Record five separate review outcomes: depth, spacing, contrast, tiles, and animation. For geometry differences, attach computed gutter/gap/padding/radius values and the relevant reference selector.
3. Check 360 px and breakpoint pairs 700/701 and 1100/1101 px; include long German labels, English labels, large signed amounts, missing values, and loading/error states.
4. Measure applicable contrast ratios per supported palette/tone and verify signs, keys, selected markers, keyboard focus, and custom-color rejection.
5. Record pointer/keyboard interactions and theme/dialog transitions under normal and reduced motion. Stable screenshots verify geometry, not animation timing.
6. Wait for animations to settle for screenshot comparisons; separately inspect transition start/intermediate/end states. Add focused browser assertions for essential geometry stability, focus and reduced-motion behavior rather than brittle tests that merely repeat CSS declarations.

These checks are required implementation evidence. The T045 review records actual results separately from the reference-derived requirements above; differing financial observations are not a pixel-comparison failure.
