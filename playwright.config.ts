import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    // HTML report gives side-by-side diff viewer for screenshot failures:
    //   expected | actual | diff + interactive slider
    // Open with: npx playwright show-report
    ["html", { open: "never" }],
  ],
  webServer: {
    command: "npm run dev",
    port: 1420,
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://localhost:1420",
    screenshot: "only-on-failure",
  },
  // Defaults for toHaveScreenshot() — applies to all projects.
  expect: {
    toHaveScreenshot: {
      // Allow small anti-aliasing / sub-pixel differences across runs.
      maxDiffPixelRatio: 0.01,
      // Animations must settle before capture.
      animations: "disabled",
    },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 14"],
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
      use: {
        ...devices["iPad Mini"],
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
