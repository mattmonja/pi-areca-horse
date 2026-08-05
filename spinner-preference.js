import { readFileSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";

export const DEFAULT_SPINNER = "horse-braille";

const VALID_SPINNERS = new Set(["ditto-pixel", "ditto-braille", "horse-braille"]);

export function isSpinnerPreference(value) {
	return typeof value === "string" && VALID_SPINNERS.has(value);
}

export function parseSpinnerPreference(contents) {
	try {
		const config = JSON.parse(contents);
		return isSpinnerPreference(config?.spinner) ? config.spinner : DEFAULT_SPINNER;
	} catch {
		return DEFAULT_SPINNER;
	}
}

export function loadSpinnerPreference(configPath) {
	try {
		return parseSpinnerPreference(readFileSync(configPath, "utf8"));
	} catch {
		return DEFAULT_SPINNER;
	}
}

export async function saveSpinnerPreference(configPath, spinner) {
	if (!isSpinnerPreference(spinner)) {
		throw new TypeError(`Unknown spinner preference: ${spinner}`);
	}

	await mkdir(dirname(configPath), { recursive: true });
	const temporaryPath = `${configPath}.${process.pid}.${randomUUID()}.tmp`;
	try {
		await writeFile(temporaryPath, `${JSON.stringify({ spinner }, null, 2)}\n`, {
			encoding: "utf8",
			mode: 0o600,
			flag: "wx",
		});
		await rename(temporaryPath, configPath);
	} finally {
		await rm(temporaryPath, { force: true });
	}
}
