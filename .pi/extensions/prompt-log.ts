/**
 * Appends every prompt typed into pi to PROMPTS.md at the project root,
 * so the AI usage log can be shipped with the task submission.
 *
 * Prompts injected by other extensions (source "extension") are skipped;
 * only what a human typed (interactive or RPC) is recorded.
 */

import { appendFile, access } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const LOG_FILE = "PROMPTS.md";
const HEADER = "# Prompt Log\n\nEvery prompt sent to the AI coding agent while building this project, in order.\n";

// Fence longer than any backtick run inside the prompt so code blocks in it can't close ours.
function fence(text: string): string {
	const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
	return "`".repeat(Math.max(3, longest + 1));
}

function timestamp(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export default function (pi: ExtensionAPI) {
	pi.on("input", async (event, ctx) => {
		const text = event.text.trim();
		if (event.source === "extension" || !text) return { action: "continue" };

		const file = join(ctx.cwd, LOG_FILE);
		const exists = await access(file).then(() => true, () => false);
		const marker = fence(text);
		const entry = `\n## ${timestamp(new Date())}\n\n${marker}text\n${text}\n${marker}\n`;

		try {
			await appendFile(file, (exists ? "" : HEADER) + entry, "utf8");
		} catch (err) {
			ctx.ui.notify(`prompt-log: could not write ${LOG_FILE}: ${(err as Error).message}`, "warning");
		}
		return { action: "continue" };
	});
}
