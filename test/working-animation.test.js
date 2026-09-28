import assert from "node:assert/strict";
import test from "node:test";

import { createWorkingAnimation, WORKING_WIDGET_KEY } from "../working-animation.js";

const horse = { frames: ["head\nbody\nlegs\nfeet", "HEAD\nBODY\nLEGS\nFEET"], intervalMs: 90 };
const ditto = { frames: ["ditto\ndance"], intervalMs: 150 };

function setup(t, { idle = true } = {}) {
	t.mock.timers.enable({ apis: ["setInterval"] });
	const widgets = new Map();
	const placements = [];
	const visibility = [];
	const widths = [];
	let renders = 0;
	const tui = { requestRender() { renders++; } };
	const ctx = {
		mode: "tui",
		isIdle: () => idle,
		ui: {
			setWorkingVisible(value) { visibility.push(value); },
			setWidget(key, factory, options) {
				widgets.get(key)?.dispose?.();
				widgets.delete(key);
				if (factory) {
					widgets.set(key, factory(tui));
					placements.push(options.placement);
				}
			},
		},
	};
	const indicator = createWorkingAnimation((line, width, ellipsis) => {
		widths.push({ width, ellipsis });
		return line.slice(0, width);
	});
	t.after(() => indicator.dispose());
	return { ctx, indicator, widgets, placements, visibility, widths, renders: () => renders };
}

test("idle initialization hides the native indicator without creating an animation", (t) => {
	const { ctx, indicator, widgets, visibility, renders } = setup(t);
	indicator.initialize(ctx, horse);
	assert.deepEqual(visibility, [false]);
	assert.equal(widgets.size, 0);
	t.mock.timers.tick(900);
	assert.equal(renders(), 0);
});

test("working horse renders every row above the editor and advances frames", (t) => {
	const { ctx, indicator, widgets, placements, renders } = setup(t);
	indicator.start(ctx, horse);
	const widget = widgets.get(WORKING_WIDGET_KEY);
	assert.deepEqual(placements, ["aboveEditor"]);
	assert.deepEqual(widget.render(20), ["head", "body", "legs", "feet"]);
	t.mock.timers.tick(90);
	assert.equal(renders(), 1);
	assert.deepEqual(widget.render(20), ["HEAD", "BODY", "LEGS", "FEET"]);
	t.mock.timers.tick(90);
	assert.deepEqual(widget.render(20), ["head", "body", "legs", "feet"]);
});

test("narrow renders truncate each row without dropping rows or adding ellipses", (t) => {
	const { ctx, indicator, widgets, widths } = setup(t);
	indicator.start(ctx, horse);
	const widget = widgets.get(WORKING_WIDGET_KEY);
	assert.deepEqual(widget.render(2), ["he", "bo", "le", "fe"]);
	assert.deepEqual(widths, Array(4).fill({ width: 2, ellipsis: "" }));
	assert.deepEqual(widget.render(0), []);
	assert.deepEqual(widget.render(-1), []);
});

test("changing spinners replaces the widget and stops the previous timer", (t) => {
	const { ctx, indicator, widgets, renders } = setup(t);
	indicator.start(ctx, horse);
	const previous = widgets.get(WORKING_WIDGET_KEY);
	indicator.configure(ctx, ditto);
	assert.notEqual(widgets.get(WORKING_WIDGET_KEY), previous);
	assert.deepEqual(widgets.get(WORKING_WIDGET_KEY).render(20), ["ditto", "dance"]);
	t.mock.timers.tick(90);
	assert.equal(renders(), 0);
	t.mock.timers.tick(60);
	assert.equal(renders(), 1);
	previous.dispose(); // Repeated cleanup must be harmless.
});

test("settling removes only this extension's widget and stops its timer", (t) => {
	const { ctx, indicator, widgets, renders } = setup(t);
	const unrelated = { render: () => ["another extension"] };
	widgets.set("another-extension", unrelated);
	indicator.start(ctx, horse);
	indicator.stop();
	indicator.stop();
	assert.equal(widgets.has(WORKING_WIDGET_KEY), false);
	assert.equal(widgets.get("another-extension"), unrelated);
	t.mock.timers.tick(900);
	assert.equal(renders(), 0);
});

test("initialization during existing work starts the horse and replaces previous state", (t) => {
	const { ctx, indicator, widgets, renders } = setup(t, { idle: false });
	indicator.initialize(ctx, horse);
	assert.equal(widgets.get(WORKING_WIDGET_KEY).render(20).length, 4);
	indicator.initialize(ctx, horse);
	t.mock.timers.tick(90);
	assert.equal(renders(), 1);
	indicator.initialize({ ...ctx, isIdle: () => true }, horse);
	assert.equal(widgets.size, 0);
});

test("shutdown removes the widget, stops rendering, and restores the native indicator", (t) => {
	const { ctx, indicator, widgets, visibility, renders } = setup(t);
	indicator.start(ctx, horse);
	indicator.dispose();
	indicator.dispose();
	assert.equal(widgets.size, 0);
	assert.deepEqual(visibility, [false, true]);
	t.mock.timers.tick(900);
	assert.equal(renders(), 0);
});

test("non-interactive modes do not touch UI or start a timer", (t) => {
	const { indicator, renders } = setup(t);
	for (const mode of ["print", "json", "rpc"]) {
		const ctx = { mode };
		indicator.initialize(ctx, horse);
		indicator.start(ctx, horse);
		indicator.configure(ctx, ditto);
		indicator.stop();
		indicator.dispose();
	}
	t.mock.timers.tick(900);
	assert.equal(renders(), 0);
});
