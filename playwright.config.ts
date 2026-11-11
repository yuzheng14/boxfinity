import { defineConfig } from '@playwright/test';

const port = Number(process.env.BOXFINITY_E2E_PORT ?? 4318);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('BOXFINITY_E2E_PORT must be an integer between 1024 and 65535');
}
const baseURL = `http://127.0.0.1:${port}/boxfinity/`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    viewport: { width: 1440, height: 960 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
