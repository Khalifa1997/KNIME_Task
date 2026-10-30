#!/usr/bin/env node
// Records one PR evidence flow and lists (or attaches) its video and screenshots.
// Usage: node scripts/pr-evidence.mjs <flow-name> [--pr <number>]
import { execFileSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const flow = args[0];
const pr = args.includes("--pr") ? args[args.indexOf("--pr") + 1] : undefined;
if (!flow || !/^[a-z0-9-]+$/.test(flow) || (pr !== undefined && !/^\d+$/.test(pr))) {
  console.error("usage: node scripts/pr-evidence.mjs <flow-name> [--pr <number>]");
  process.exit(1);
}

// Windows needs a shell to resolve npx/gh; every argument is validated above or generated here.
const run = (cmd, cmdArgs) =>
  process.platform === "win32"
    ? execFileSync([cmd, ...cmdArgs].join(" "), { stdio: "inherit", shell: true })
    : execFileSync(cmd, cmdArgs, { stdio: "inherit" });

// Each run starts clean, so rerunning never mixes in stale captures.
const out = join("test-results", "pr-evidence", flow);
rmSync(out, { recursive: true, force: true });

// A failing flow throws here: no evidence for a change that doesn't work.
run("npx", [
  "playwright", "test",
  "--config", "playwright.evidence.config.ts",
  `e2e/flows/${flow}.flow.ts`,
  "--output", out,
]);

const assets = readdirSync(out, { recursive: true })
  .filter((f) => /\.(webm|png)$/.test(f))
  .map((f) => join(out, f).replaceAll("\\", "/"))
  .sort();

console.log(assets.join("\n"));
if (pr) run("gh", ["pr", "edit", pr, ...assets.flatMap((a) => ["--attach", a])]);
