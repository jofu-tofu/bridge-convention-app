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
