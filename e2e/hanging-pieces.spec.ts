import { expect, test } from '@playwright/test';
import { answerHangingPieces, clickSquare, expectNoHorizontalScroll, HANGING_PIECES_SETTINGS, nextButton, prepare } from './support';

test('a full session: found, a wrong pick, time running out, then the summary', async ({ page }) => {
  const { errors } = await prepare(page);
  await page.goto('/exercises/hanging-pieces');
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Start', exact: true }).click();

  // 1: the hanging knight.
  await expect(page.getByText('Click every hanging piece, of both colours. There is at least one. White to move.')).toBeVisible();
  await answerHangingPieces(page);
  await nextButton(page).click();

  // 2: a piece that is not hanging. Clicking it twice unpicks it; once more picks it again.
  await clickSquare(page, 'h2');
  await expect(page.getByText('1 piece picked.')).toBeVisible();
  await clickSquare(page, 'h2');
  await expect(page.getByText('0 pieces picked.')).toBeVisible();
  await clickSquare(page, 'h2');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('You found 0 of 1, and 1 pick was not hanging.');
  await nextButton(page).click();

  // 3: time runs out.
  await expect(page.getByRole('timer', { name: 'Seconds left' })).toHaveText(String(HANGING_PIECES_SETTINGS.seconds));
  await page.clock.fastForward(HANGING_PIECES_SETTINGS.seconds * 1000);
  await expect(page.getByRole('status')).toHaveText("Time's up. You found 0 of 1.");
  await nextButton(page).click();

  // 4 and 5
  await answerHangingPieces(page);
  await nextButton(page).click();
  await answerHangingPieces(page);
  await expect(nextButton(page)).toHaveText(/^See summary/);
  await nextButton(page).click();

  await expect(page.getByLabel('Correct positions')).toHaveText('3/5');
  await expect(page.locator('.ex-rounds tbody tr td:last-child')).toHaveText([
    'Correct',
    'Wrong',
    'Wrong',
    'Correct',
    'Correct',
  ]);
  expect(errors).toEqual([]);
});
