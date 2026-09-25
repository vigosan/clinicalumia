import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  use: { baseURL: "http://localhost:3001" },
  webServer: {
    command: "pnpm --filter dashboard dev",
    url: "http://localhost:3001/login",
    reuseExistingServer: true,
    cwd: "..",
  },
});
