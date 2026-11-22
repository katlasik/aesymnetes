import { expect, test } from '@playwright/test';
import { answerRepeatMoves, expectNoHorizontalScroll, nextButton, playMove, prepare } from './support';

test('a full session: replayed moves are graded, then the summary', async ({ page }) => {
  const { errors } = await prepare(page);
  await page.goto('/exercises/repeat-moves');
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Start', exact: true }).click();

  // 1: both moves right.
  await answerRepeatMoves(page);
  await nextButton(page).click();

  // 2: White plays the wrong move.
  await expect(page.getByText('Play the moves again. White to move.')).toBeVisible();
  await playMove(page, 'd2d4');
  await expect(page.getByRole('status')).toHaveText('Wrong at move 1 of 2. The move was e4, not d4.');
  await nextButton(page).click();

  // 3: Black plays the wrong move.
  await expect(page.getByText('Play the moves again. White to move.')).toBeVisible();
  await playMove(page, 'e2e4');
  await expect(page.getByText('Play the moves again. Black to move.')).toBeVisible();
  await playMove(page, 'c7c5');
  await expect(page.getByRole('status')).toHaveText('Wrong at move 2 of 2. The move was e5, not c5.');
  await nextButton(page).click();

  // 4 and 5
  await answerRepeatMoves(page);
  await nextButton(page).click();
  await answerRepeatMoves(page);
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
