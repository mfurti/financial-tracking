import { expect, type Locator, type Page } from '@playwright/test';

/** Choose through the visible Nuxt UI popup rather than manipulating a hidden form value. */
export async function choose(page: Page, field: Locator, choice: string | { index: number }) {
  await field.click();
  const options = page.getByRole('option');
  const option =
    typeof choice === 'string' ? page.getByRole('option', { name: choice, exact: true }) : options.nth(choice.index);
  await expect(option).toBeVisible();
  await option.click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
}
