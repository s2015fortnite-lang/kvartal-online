import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/online-game.spec.ts',
  timeout: 60000,
  outputDir: 'test-results/online',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  },
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:3000/health',
    reuseExistingServer: !process.env.CI,
    env: { DATA_DIR: 'test-results/online-server-data' },
  },
});
