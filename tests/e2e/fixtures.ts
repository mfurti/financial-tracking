import { test as base, expect } from '@playwright/test';
export { conceptFixtureLabels } from '../../scripts/concept-fixtures.js';
export { conceptViewports } from '../../scripts/concept-viewports.js';

/** Attach geometry on failure so Linux/mobile regressions are diagnosable without forcing clicks. */
export const test = base.extend({
  page: /** Retain the real browser fixture and inspect only synthetic test-page layout after an actual failure. */ async (
    { page },
    use,
    info,
  ) => {
    await use(page);
    if (info.status === info.expectedStatus || page.isClosed()) return;
    const layout = await page.evaluate(
      /** Record dimensions and CSS ownership, never input values or booking text. */ () => ({
        viewport: {
          inner: innerWidth,
          client: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
          visual: visualViewport?.width,
          scale: visualViewport?.scale,
          ratio: devicePixelRatio,
        },
        overflow: [...document.querySelectorAll('body *')]
          .map(
            /** Locate actual overflow owners, including native fieldset minimums. */ (element) => {
              const box = element.getBoundingClientRect(),
                css = getComputedStyle(element);
              return {
                tag: element.tagName,
                class: element.getAttribute('class'),
                left: box.left,
                right: box.right,
                width: box.width,
                minWidth: css.minWidth,
                position: css.position,
                overflow: css.overflowX,
              };
            },
          )
          .filter(
            /** Hidden navigation/popovers do not establish document overflow. */ (box) =>
              box.width > 0 && box.right > document.documentElement.clientWidth + 1 && box.position !== 'fixed',
          )
          .slice(0, 16),
      }),
    );
    await info.attach('layout', {
      body: JSON.stringify({ configured: page.viewportSize(), ...layout }, null, 2),
      contentType: 'application/json',
    });
    console.info(`Layout diagnostics: ${JSON.stringify({ configured: page.viewportSize(), ...layout })}`);
  },
});
export { expect };
