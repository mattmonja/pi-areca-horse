import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
	DEFAULT_SPINNER,
	loadSpinnerPreference,
	parseSpinnerPreference,
	saveSpinnerPreference,
} from "../spinner-preference.js";

const choices = ["ditto-pixel", "ditto-braille", "horse-braille"];

test("the horse is the default when no preference exists", () => {
	assert.equal(DEFAULT_SPINNER, "horse-braille");
	assert.equal(loadSpinnerPreference(join(tmpdir(), `missing-spinner-${process.pid}.json`)), DEFAULT_SPINNER);
});

test("all supported spinner choices round-trip through the config format", () => {
	for (const spinner of choices) {
		assert.equal(parseSpinnerPreference(JSON.stringify({ spinner })), spinner);
	}
});

test("malformed and unknown preferences safely fall back to the horse", () => {
	for (const contents of ["not json", "{}", '{"spinner":"unknown"}', "null"]) {
		assert.equal(parseSpinnerPreference(contents), DEFAULT_SPINNER);
	}
});

test("a saved preference survives a fresh load", async (t) => {
	const directory = await mkdtemp(join(tmpdir(), "pi-areca-horse-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const configPath = join(directory, "nested", "config.json");

	await saveSpinnerPreference(configPath, "ditto-braille");

	assert.equal(loadSpinnerPreference(configPath), "ditto-braille");
	assert.deepEqual(JSON.parse(await readFile(configPath, "utf8")), { spinner: "ditto-braille" });
});

test("saving rejects unknown spinner names without replacing the existing preference", async (t) => {
	const directory = await mkdtemp(join(tmpdir(), "pi-areca-horse-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const configPath = join(directory, "config.json");
	await writeFile(configPath, '{"spinner":"horse-braille"}\n');

	await assert.rejects(saveSpinnerPreference(configPath, "unknown"), /Unknown spinner preference/);
	assert.equal(loadSpinnerPreference(configPath), "horse-braille");
});
