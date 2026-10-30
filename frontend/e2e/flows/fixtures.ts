import { test as base, expect } from "@playwright/test";

// Every flow fails on console errors or uncaught exceptions: a passing flow means a clean console.
// Chrome also logs failed (4xx/5xx) resource loads as console errors, so broken requests fail too.
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(err.message));
      await use(errors);
      expect(errors, "console errors during the flow").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
