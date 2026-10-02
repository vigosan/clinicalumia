import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  globalSetup: "./warm-up.ts",
  snapshotPathTemplate:
    "{testDir}/{testFilePath}-snapshots/{arg}{-snapshotSuffix}{ext}",
  use: { baseURL: "http://localhost:3001", trace: "retain-on-failure" },
  projects: [
    {
      name: "main",
      testIgnore: ["admin-config.spec.ts", "access-quota.spec.ts"],
    },
    {
      name: "clinic-settings",
      testMatch: "admin-config.spec.ts",
      dependencies: ["main"],
    },
    {
      name: "access-quota",
      testMatch: "access-quota.spec.ts",
      dependencies: ["clinic-settings"],
    },
  ],
  webServer: [
    {
      command: "pnpm --filter web dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      cwd: "..",
    },
    {
      command: "pnpm --filter dashboard dev",
      url: "http://localhost:3001/login",
      reuseExistingServer: true,
      cwd: "..",
    },
    {
      command: "pnpm --filter admin dev",
      url: "http://localhost:3002/login",
      reuseExistingServer: true,
      cwd: "..",
    },
  ],
});
