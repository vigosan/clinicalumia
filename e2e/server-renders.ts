import type { Page } from "@playwright/test";

export function recordServerRenders(page: Page): string[] {
  const urls: string[] = [];
  page.on("request", (request) => {
    const headers = request.headers();
    if (headers.rsc === "1" && !headers["next-router-prefetch"]) {
      urls.push(request.url());
    }
  });
  return urls;
}

export async function slowDownServerActions(page: Page, ms: number) {
  await page.route("**/*", async (route) => {
    if (route.request().headers()["next-action"]) {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
    await route.fallback();
  });
}
