import { defineConfig, devices } from '@playwright/test';

// Runs against the static build, served by `astro preview`, on its own port so it never
// collides with a running `npm run dev`.
const PORT = 4329;

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'tmp/playwright/results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'tmp/playwright/report', open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1200, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // `--ignore-lock` keeps preview in the foreground (Astro backgrounds it when an AI agent runs
    // it) and out of the lock file, so Playwright owns the server and stops it afterwards.
    command: `npm run build && npx astro preview --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
