import { expect, test } from '@playwright/test';
import { clickSquare, expectNoHorizontalScroll, prepare } from './support';

test('counts right and wrong clicks for 30 seconds and keeps the best', async ({ page }) => {
  const { errors } = await prepare(page);
  await page.goto('/exercises/find-square');
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Start', exact: true }).click();

  const target = page.getByLabel('Square to find');
  await expect(page.getByRole('timer', { name: 'Seconds left' })).toHaveText('30');

  for (let i = 0; i < 2; i++) {
    const square = (await target.textContent())!;
    await clickSquare(page, square);
    await expect(target).not.toHaveText(square);
  }
  await expect(page.getByText('2 right')).toBeVisible();

  const square = (await target.textContent())!;
  await clickSquare(page, square === 'a1' ? 'h8' : 'a1');
  await expect(page.getByText('1 wrong')).toBeVisible();

  await page.clock.fastForward(30_000);
  await expect(page.getByLabel('Squares found')).toHaveText('2');
  await expect(page.getByText('squares found in 30 seconds, 1 wrong. Your best so far.')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Your best is 2.')).toBeVisible();
  expect(errors).toEqual([]);
});
