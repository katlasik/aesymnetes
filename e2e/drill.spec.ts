import { expect, test, type Page } from '@playwright/test';
import {
  answerHangingPieces,
  answerMissingPiece,
  answerRepeatMoves,
  clickSquare,
  expectNoHorizontalScroll,
  nextButton,
  prepare,
} from './support';

/** The intro popup before each exercise. */
const intro = (page: Page, name: string) => page.getByRole('dialog', { name });

/** Closes the intro popup early with "Start now". */
async function startNow(page: Page, name: string) {
  const popup = intro(page, name);
  await popup.getByRole('button', { name: 'Start now' }).click();
  await expect(popup).toBeHidden();
}

test('home starts the drill', async ({ page }) => {
  await page.goto('/');
  await expectNoHorizontalScroll(page);
  await expect(page.getByRole('heading', { name: 'Aesymnetes' })).toBeVisible();
  await page.getByRole('link', { name: 'Start drill' }).click();
  await expect(page).toHaveURL(/\/drill$/);
  await expect(intro(page, 'Missing piece')).toBeVisible();
});

test('the exercises in a row, then the results', async ({ page }) => {
  const { errors } = await prepare(page);
  await page.goto('/drill');
  await expectNoHorizontalScroll(page);

  // 1. Missing piece: the popup counts down from 5 and starts the exercise by itself.
  const first = intro(page, 'Missing piece');
  await expect(first).toBeVisible();
  await expect(first.getByRole('timer')).toHaveText('5');
  await expect(page.getByText('Exercise 1 of 4')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toHaveCount(0);
  await page.clock.fastForward(2000);
  await expect(first.getByRole('timer')).toHaveText('3');
  await page.clock.fastForward(3000);
  await expect(first).toBeHidden();

  for (let i = 0; i < 5; i++) {
    await answerMissingPiece(page);
    await nextButton(page).click();
  }
  await expect(page.getByLabel('Correct positions')).toHaveText('5/5');
  await expect(page.getByRole('button', { name: 'Play again' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next exercise' }).click();

  // 2. Repeat the moves, from here on started early with "Start now".
  await expect(page.getByText('Exercise 2 of 4')).toBeVisible();
  await startNow(page, 'Repeat the moves');
  for (let i = 0; i < 5; i++) {
    await answerRepeatMoves(page);
    await nextButton(page).click();
  }
  await page.getByRole('button', { name: 'Next exercise' }).click();

  // 3. Find the square
  await expect(page.getByText('Exercise 3 of 4')).toBeVisible();
  await startNow(page, 'Find the square');
  const square = (await page.getByLabel('Square to find').textContent())!;
  await clickSquare(page, square);
  await expect(page.getByText('1 right')).toBeVisible();
  await page.clock.fastForward(30_000);
  await page.getByRole('button', { name: 'Next exercise' }).click();

  // 4. Hanging pieces, the last one.
  await expect(page.getByText('Exercise 4 of 4')).toBeVisible();
  await startNow(page, 'Hanging pieces');
  for (let i = 0; i < 5; i++) {
    await answerHangingPieces(page);
    await nextButton(page).click();
  }
  await page.getByRole('button', { name: 'Finish drill' }).click();

  // Results
  await expect(page.getByRole('heading', { name: 'Drill complete' })).toBeVisible();
  await expect(page.locator('.drill-done tr')).toHaveText([
    'Missing piece5/5 correct',
    'Repeat the moves5/5 correct',
    'Find the square1 square found, 0 wrong',
    'Hanging pieces5/5 correct',
  ]);
  await expect(page.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');

  await page.getByRole('button', { name: 'Drill again' }).click();
  await expect(intro(page, 'Missing piece')).toBeVisible();
  await expect(page.getByText('Exercise 1 of 4')).toBeVisible();
  expect(errors).toEqual([]);
});
