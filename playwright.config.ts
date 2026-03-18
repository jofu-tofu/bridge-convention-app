import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  retries: process.env.CI ? 2 : 0,
  webServer: {
    command: "npm run dev",
    port: 1420,
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://localhost:1420",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 14"] },
    },
    {
      name: "tablet",
      use: { ...devices["iPad Mini"] },
    },
  ],
});
