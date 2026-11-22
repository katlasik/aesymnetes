import { expect, test } from '@playwright/test';
import { answerMissingPiece, clickSquare, expectNoHorizontalScroll, nextButton, POSITIONS, prepare } from './support';

test('a full session: right answers, a wrong piece, a wrong square, then the summary', async ({ page }) => {
  const { errors } = await prepare(page);
  await page.goto('/exercises/missing-piece');
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Start', exact: true }).click();

  // 1: right square, right piece.
  await expect(page.getByRole('progressbar', { name: 'Position 1 of 5' })).toBeAttached();
  await answerMissingPiece(page);
  await expect(page.getByRole('status')).toHaveText('Correct: the white pawn on e2.');
  await nextButton(page).click();

  // 2: right square, wrong piece.
  await answerMissingPiece(page, 'white knight');
  await expect(page.getByRole('status')).toHaveText(
    'Right square, wrong piece. It was the white pawn on e2, not the white knight.',
  );
  await nextButton(page).click();

  // 3: a wrong square first, then the right one.
  await page.clock.fastForward(3000);
  await expect(page.getByText('2 tries left.')).toBeVisible();
  await clickSquare(page, 'a1');
  await expect(page.getByText('Not that square. 1 try left.')).toBeVisible();
  await clickSquare(page, 'e2');
  const picker = page.getByRole('dialog', { name: 'Yes, e2. Which piece was it?' });
  await picker.getByRole('button', { name: 'white pawn', exact: true }).click();
  await picker.getByRole('button', { name: 'Confirm piece' }).click();
  await expect(page.getByRole('status')).toHaveText('Correct: the white pawn on e2.');

  // The result moves on by itself after a few seconds.
  await page.clock.fastForward(4000);
  await expect(page.getByRole('progressbar', { name: 'Position 4 of 5' })).toBeAttached();

  // 4: the time to find the square runs out, so the square is shown.
  await page.clock.fastForward(3000);
  await expect(page.getByText('One piece is gone. Click the square it stood on.')).toBeVisible();
  await page.clock.fastForward(5000);
  const revealed = page.getByRole('dialog', { name: "Time's up. The piece stood on e2. Which piece was it?" });
  await revealed.getByRole('button', { name: 'white pawn', exact: true }).click();
  await revealed.getByRole('button', { name: 'Confirm piece' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Right piece, but you missed the square. It was the white pawn on e2.',
  );
  await nextButton(page).click();

  // 5
  await answerMissingPiece(page);
  await expect(nextButton(page)).toHaveText(/^See summary/);
  await nextButton(page).click();

  await expect(page.getByLabel('Correct positions')).toHaveText('3/5');
  const rows = page.locator('.ex-rounds tbody tr');
  await expect(rows).toHaveCount(5);
  await expect(rows.locator('td:last-child')).toHaveText(['Correct', 'Wrong', 'Correct', 'Wrong', 'Correct']);
  await expect(rows.first()).toContainText('white pawn, e2');
  await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a failed load says so and can be retried', async ({ page }) => {
  await prepare(page);
  await page.route('**/positions.json', (route) => route.fulfill({ status: 500 }));
  await page.goto('/exercises/missing-piece');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('The positions did not load. Check your connection, then try again.');

  await page.unroute('**/positions.json');
  await page.route('**/positions.json', (route) => route.fulfill({ json: POSITIONS }));
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('timer', { name: 'Seconds left to memorise' })).toBeVisible();
});

test('settings are kept between visits', async ({ page }) => {
  await prepare(page);
  await page.goto('/exercises/missing-piece');
  await expect(page.getByRole('button', { name: 'Settings: Custom' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings: Custom' }).click();
  const drawer = page.getByRole('dialog', { name: 'Settings' });
  await drawer.getByText('Hard', { exact: true }).click();
  await drawer.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: 'Settings: Hard' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Settings: Hard' })).toBeVisible();
});
