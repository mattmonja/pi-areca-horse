export const WORKING_WIDGET_KEY = "pi-areca-horse/working";

class WorkingAnimation {
	constructor(tui, animation, truncateLine) {
		this.frames = animation.frames.map((frame) => frame.split("\n"));
		this.frame = 0;
		this.truncateLine = truncateLine;
		this.ticker = setInterval(() => {
			this.frame = (this.frame + 1) % this.frames.length;
			tui.requestRender();
		}, animation.intervalMs);
		this.ticker.unref?.();
	}

	render(width) {
		if (width <= 0) return [];
		return this.frames[this.frame].map((line) => this.truncateLine(line, width, ""));
	}

	invalidate() {}

	dispose() {
		if (this.ticker === null) return;
		clearInterval(this.ticker);
		this.ticker = null;
	}
}

/** Owns only this extension's widget; Pi disposes it when replaced or removed. */
export function createWorkingAnimation(truncateLine) {
	let ui;
	let active = false;

	const clear = () => ui?.setWidget(WORKING_WIDGET_KEY, undefined);
	const configure = (ctx, animation) => {
		if (ctx.mode !== "tui") return;
		ui = ctx.ui;
		// Pi 0.87 renders its native working indicator inside a one-line border.
		ui.setWorkingVisible(false);
		if (!active) return;
		ui.setWidget(
			WORKING_WIDGET_KEY,
			(tui) => new WorkingAnimation(tui, animation, truncateLine),
			{ placement: "aboveEditor" },
		);
	};

	return {
		configure,
		initialize(ctx, animation) {
			clear();
			ui = undefined;
			active = ctx.mode === "tui" && !ctx.isIdle();
			configure(ctx, animation);
		},
		start(ctx, animation) {
			active = true;
			configure(ctx, animation);
		},
		stop() {
			active = false;
			clear();
		},
		dispose() {
			active = false;
			clear();
			ui?.setWorkingVisible(true);
			ui = undefined;
		},
	};
}
