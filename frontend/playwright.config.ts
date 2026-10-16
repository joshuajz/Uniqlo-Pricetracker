import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:5180', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    env: {
      VITE_PUBLIC_POSTHOG_KEY: 'phc_browser_test',
      VITE_PUBLIC_POSTHOG_REVERSE_PROXY: 'http://127.0.0.1:5180/analytics',
      VITE_PUBLIC_POSTHOG_HOST: 'http://127.0.0.1:5180/analytics',
    },
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 5180 --strictPort',
    url: 'http://127.0.0.1:5180', reuseExistingServer: false,
  },
})
