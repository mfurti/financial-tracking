import { test, expect } from './fixtures.js';

test('theme and dialog feedback preserve geometry, immediate focus and reduced-motion operation', /** Observe live animation keyframes rather than inferring motion from settled screenshots. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(/** Finish login before entering the real settings journey. */ (url) => url.pathname === '/');
  await page.goto('/settings');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const tile = page.locator('.finance-tile--account');
  await tile.scrollIntoViewIfNeeded();
  const before = await tile.boundingBox();
  await tile.hover();
  expect(await tile.boundingBox()).toEqual(before);
  const toggle = page.getByRole('button', { name: 'Dunkelmodus', exact: true });
  await toggle.click();
  const themeFeedback = await toggle.locator('svg').evaluate(
    /** Record the icon's declared feedback timing, without changing financial values. */ (element) => ({
      duration: getComputedStyle(element).transitionDuration,
      properties: getComputedStyle(element).transitionProperty,
    }),
  );
  expect(themeFeedback.duration).toBe('0.18s');
  expect(themeFeedback.properties).not.toMatch(/all|transform/);
  const trigger = page.getByRole('button', { name: 'Zugang & Datensicherung', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Benutzer- und App-Informationen', exact: true });
  await expect(dialog).toBeVisible();
  const motion = await dialog.evaluate(
    /** Preserve live opacity keyframes, durations and focused ownership for review. */ (element) => ({
      animations: element.getAnimations().map(
        /** Read the browser's active transition effect. */ (animation) => ({
          timing: animation.effect!.getTiming(),
          frames: (animation.effect as KeyframeEffect).getKeyframes(),
        }),
      ),
      focusInside: element.contains(document.activeElement),
    }),
  );
  expect(motion.focusInside).toBe(true);
  expect(motion.animations.length).toBeGreaterThan(0);
  for (const animation of motion.animations) {
    expect(Number(animation.timing.duration)).toBeGreaterThanOrEqual(160);
    expect(Number(animation.timing.duration)).toBeLessThanOrEqual(220);
    expect(
      animation.frames.every(/** Dialog entry must not scale or translate its content. */ (frame) => !frame.transform),
    ).toBe(true);
    expect(
      animation.frames.map(
        /** Verify a real opacity transition rather than a no-op animation. */ (frame) => frame.opacity,
      ),
    ).toEqual(['0', '1']);
  }
  await test
    .info()
    .attach('dialog-motion.json', { body: JSON.stringify(motion, null, 2), contentType: 'application/json' });
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toggle.click();
  await expect(page.locator('html')).not.toHaveClass(/theme-transition/);
  await expect(toggle.locator('svg')).toHaveCSS('transition-duration', '0s');
  await trigger.click();
  await expect(dialog).toBeVisible();
  expect(
    await dialog.evaluate(
      /** Reduced motion must remove active decorative effects completely. */ (element) =>
        element.getAnimations().length,
    ),
  ).toBe(0);
  await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
  await page.screenshot({ path: `.local/concept-motion-${info.project.name}.png` });
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});
