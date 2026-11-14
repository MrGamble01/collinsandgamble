import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  timeout: 30000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: "node tests/static-server.js",
    url: "http://127.0.0.1:4173/roster",
    reuseExistingServer: !process.env.CI,
  },
});
