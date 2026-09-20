import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration
 *
 * Runs against the local Vite dev server (port 5173) which must be started
 * before running E2E tests, or use `webServer` below to auto-start it.
 *
 * The backend server must also be running on port 5000.
 *
 * Run:
 *   npm run test:e2e          — headless
 *   npm run test:e2e:ui       — interactive UI mode
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.js',

  // Maximum time a single test can run
  timeout: 60_000,

  // Retries on CI to handle flakiness
  retries: process.env.CI ? 2 : 0,

  // Run tests sequentially — the E2E suite shares state (seeded DB, cookies)
  workers: 1,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    // Frontend base URL
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',

    // Record traces on first retry to aid debugging
    trace: 'on-first-retry',

    // Record screenshots on failure
    screenshot: 'only-on-failure',

    // Persist cookies between page navigations in same test
    storageState: undefined,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
  ],

  // Auto-start the Vite dev server if not already running
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
