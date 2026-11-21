import { test, expect, conceptFixtureLabels, conceptViewports } from './fixtures.js';

test('isolated concept fixture keeps long account labels and unknown balances reachable', /** Smoke the dedicated real app/server fixture at every concept viewport before visual feature work. */ async ({
  page,
}, info) => {
  const profile = conceptViewports.find(
    /** Check actual project ownership rather than a shared concept server. */ (item) =>
      item.name === info.project.name,
  );
  expect(profile).toBeDefined();
  expect(info.project.use.baseURL).toBe(`http://localhost:${profile!.webPort}`);
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Login has its own heading; wait for completed authenticated navigation before leaving the page. */ (url) =>
      url.pathname === '/',
  );
  await expect(page.locator('#main-content')).toBeVisible();
  await page.goto('/accounts');
  await expect(page.getByText(conceptFixtureLabels.checking, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(conceptFixtureLabels.missing, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(conceptFixtureLabels.liability, { exact: true }).first()).toBeVisible();
});
