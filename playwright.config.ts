import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  retries: process.env.CI ? 2 : 0,
  outputDir: ".artifacts/playwright/test-results",
  reporter: [
    ["html", { outputFolder: ".artifacts/playwright/report", open: "never" }],
  ],
  webServer: [
    {
      command: "cargo run -p bridge-api --features dev-tools",
      url: "http://localhost:3001/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        DATABASE_URL: "sqlite:///tmp/bridge-api-e2e.db",
        STRIPE_WEBHOOK_SECRET: "whsec_e2e_test_secret",
        STRIPE_SECRET_KEY: "sk_test_unused",
        STRIPE_PRICE_ID_MONTHLY: "price_monthly_test",
        BILLING_SUCCESS_URL: "http://localhost:1420/billing/success",
        BILLING_CANCEL_URL: "http://localhost:1420/billing/cancel",
        BASE_URL: "http://localhost:1420",
      },
    },
    {
      command: "npm run dev",
      port: 1420,
      reuseExistingServer: true,
    },
  ],
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
      testMatch: /responsive-layout\.spec\.ts/,
      use: {
        ...devices["iPhone 14"],
        browserName: "chromium",
        launchOptions: {
          env: {
            // WPE WebKit needs Mesa EGL on systems with NVIDIA drivers
            __EGL_VENDOR_LIBRARY_FILENAMES:
              "/usr/share/glvnd/egl_vendor.d/50_mesa.json",
            LIBGL_ALWAYS_SOFTWARE: "1",
          },
        },
      },
    },
    {
      name: "tablet",
      testMatch: /responsive-layout\.spec\.ts/,
      use: {
        ...devices["iPad Mini"],
        browserName: "chromium",
        launchOptions: {
          env: {
            __EGL_VENDOR_LIBRARY_FILENAMES:
              "/usr/share/glvnd/egl_vendor.d/50_mesa.json",
            LIBGL_ALWAYS_SOFTWARE: "1",
          },
        },
      },
    },
  ],
});
