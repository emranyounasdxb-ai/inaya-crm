import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  globalTeardown: "./tests/e2e/teardown.mjs",
  timeout: 30000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4311",
    viewport: { width: 1440, height: 1000 },
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node --env-file=.env.local scripts/e2e-server.mjs",
    url: "http://127.0.0.1:4311/api/health",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
