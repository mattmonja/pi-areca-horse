/**
 * ARECA galloping-horse splash and dancing-Ditto spinner for pi.
 *
 * Plays the ASCII gallop cycle from github.com/mattmonja/areca (7 Muybridge
 * frames) as an optional splash screen — Rosé Pine palette, light "signal
 * degradation" glitch — then hands off to the normal pi UI. While pi works,
 * the four poses from Tenor's dancing-Ditto GIF animate as compact, full-color
 * pixel art, with a compact Braille variant available too. Replay the previews
 * with /horse, /ditto, and /ditto-braille, or switch the working indicator with
 * /spinner ditto-pixel|ditto-braille|horse-braille. Animation data lives in horse.json, ditto.json,
 * and ditto-braille.json next to this file.
 *
 * Distributed as the pi-areca-horse Pi package. Local auto-discovered copies
 * can be edited and hot-reloaded with /reload.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// ─── Tunables ─────────────────────────────────────────────────────────────
const FRAME_MS = 90; // ms per gallop frame (lower = faster stride)
const DURATION_MS = 3000; // auto-dismiss after this; set 0 to wait for a keypress
const GLITCH = 0.1; // 0..1 areca signal-degradation intensity (0 disables it)
const SHOW_ON_STARTUP = false; // keep startup clear; /horse replays the splash
const DITTO_SPLASH_DURATION_MS = 4000; // /ditto auto-dismisses after this
const WORKING_HORSE_WIDTH = 14; // terminal columns for pi's working indicator
const WORKING_HORSE_HEIGHT = 4; // terminal rows for pi's working indicator
const WORKING_HORSE_INK_THRESHOLD = 0.15; // suppress downsampling noise

// Rosé Pine (Moon), as [r, g, b, xterm-256 fallback].
const HORSE_COLOR = [234, 154, 151, 174]; // --rose  #ea9a97 (the horse)
const BRAND_COLOR = [235, 111, 146, 168]; // --love  #eb6f92 (the wordmark)
const HINT_COLOR = [110, 106, 134, 60]; // --muted #6e6a86 (the hint)
const BRAND = "A R E C A   T E C H   L T D.";
// ────────────────────────────────────────────────────────────────────────────

type HorseData = { frames: string[]; similar: Record<string, string[]> };
type PixelColor = [red: number, green: number, blue: number, xterm: number];
type DittoData = {
	source: string;
	width: number;
	height: number;
	intervalMs: number;
	palette: Record<"p" | "d" | "w", PixelColor>;
	frames: string[][];
};
type DittoBrailleData = {
	source: string;
	width: number;
	height: number;
	intervalMs: number;
	frames: string[];
};

const extensionDir = dirname(fileURLToPath(import.meta.url));
const data: HorseData = JSON.parse(readFileSync(join(extensionDir, "horse.json"), "utf8")) as HorseData;
const dittoData: DittoData = JSON.parse(
	readFileSync(join(extensionDir, "ditto.json"), "utf8"),
) as DittoData;
const dittoBrailleData: DittoBrailleData = JSON.parse(
	readFileSync(join(extensionDir, "ditto-braille.json"), "utf8"),
) as DittoBrailleData;

// Crop every frame to the shared ink bounding box so the horse centres
// accurately regardless of terminal size (drops the dead margin around it).
const CROPPED: string[][] = (() => {
	let top = Number.POSITIVE_INFINITY;
	let bot = -1;
	let left = Number.POSITIVE_INFINITY;
	let right = -1;
	for (const frame of data.frames) {
		const rows = frame.split("\n");
		for (let y = 0; y < rows.length; y++) {
			const row = rows[y];
			for (let x = 0; x < row.length; x++) {
				if (row[x] && row[x] !== " ") {
					if (y < top) top = y;
					if (y > bot) bot = y;
					if (x < left) left = x;
					if (x > right) right = x;
				}
			}
		}
	}
	const width = right - left + 1;
	return data.frames.map((frame) => {
		const rows = frame.split("\n");
		const out: string[] = [];
		for (let y = top; y <= bot; y++) {
			out.push((rows[y] ?? "").slice(left, right + 1).padEnd(width, " "));
		}
		return out;
	});
})();

const ART_W = CROPPED[0][0].length;
const ART_H = CROPPED[0].length;

const TRUECOLOR = /truecolor|24bit/i.test(process.env.COLORTERM ?? "");

function paint(color: number[], text: string): string {
	const open = TRUECOLOR ? `\x1b[38;2;${color[0]};${color[1]};${color[2]}m` : `\x1b[38;5;${color[3]}m`;
	return `${open}${text}\x1b[39m`;
}

const RESET_CELL = "\x1b[39;49m";

function foreground(color: PixelColor): string {
	return TRUECOLOR
		? `\x1b[38;2;${color[0]};${color[1]};${color[2]}m`
		: `\x1b[38;5;${color[3]}m`;
}

function background(color: PixelColor): string {
	return TRUECOLOR
		? `\x1b[48;2;${color[0]};${color[1]};${color[2]}m`
		: `\x1b[48;5;${color[3]}m`;
}

function dittoColor(code: string): PixelColor | undefined {
	if (code !== "p" && code !== "d" && code !== "w") return undefined;
	return dittoData.palette[code];
}

// Pair two source-pixel rows into terminal half blocks. Unlike the monochrome
// horse raster, this retains Ditto's purple body, charcoal face, and highlight.
function miniDitto(rows: string[]): string {
	const out: string[] = [];
	for (let y = 0; y < dittoData.height; y += 2) {
		let line = "";
		for (let x = 0; x < dittoData.width; x++) {
			const topCode = rows[y]?.[x] ?? ".";
			const bottomCode = rows[y + 1]?.[x] ?? ".";
			const top = dittoColor(topCode);
			const bottom = dittoColor(bottomCode);

			if (!top && !bottom) {
				line += " ";
			} else if (top && !bottom) {
				line += `${foreground(top)}▀${RESET_CELL}`;
			} else if (!top && bottom) {
				line += `${foreground(bottom)}▄${RESET_CELL}`;
			} else if (topCode === bottomCode) {
				line += `${foreground(top!)}█${RESET_CELL}`;
			} else {
				line += `${foreground(top!)}${background(bottom!)}▀${RESET_CELL}`;
			}
		}
		out.push(line);
	}
	return out.join("\n");
}

const WORKING_DITTO_FRAMES = dittoData.frames.map(miniDitto);
const WORKING_DITTO_BRAILLE_FRAMES = dittoBrailleData.frames.map((frame) =>
	frame
		.split("\n")
		.map((line) => paint(dittoData.palette.p, line))
		.join("\n"),
);

// Convert a full-size ASCII frame into a compact Braille raster. Each Braille
// cell carries a 2x4 dot grid, retaining enough detail for the gait to read at
// four terminal rows without copying or hand-redrawing the source animation.
const BRAILLE_BITS = [
	[0x01, 0x08],
	[0x02, 0x10],
	[0x04, 0x20],
	[0x40, 0x80],
] as const;

function miniHorse(rows: string[]): string {
	const pixelW = WORKING_HORSE_WIDTH * 2;
	const pixelH = WORKING_HORSE_HEIGHT * 4;
	const pixels: boolean[][] = [];

	for (let py = 0; py < pixelH; py++) {
		const sourceTop = (py * ART_H) / pixelH;
		const sourceBottom = ((py + 1) * ART_H) / pixelH;
		const pixelRow: boolean[] = [];
		for (let px = 0; px < pixelW; px++) {
			const sourceLeft = (px * ART_W) / pixelW;
			const sourceRight = ((px + 1) * ART_W) / pixelW;
			let inkArea = 0;
			let totalArea = 0;

			for (let sy = Math.floor(sourceTop); sy < Math.ceil(sourceBottom) && sy < ART_H; sy++) {
				const overlapY = Math.max(0, Math.min(sourceBottom, sy + 1) - Math.max(sourceTop, sy));
				for (let sx = Math.floor(sourceLeft); sx < Math.ceil(sourceRight) && sx < ART_W; sx++) {
					const overlapX = Math.max(0, Math.min(sourceRight, sx + 1) - Math.max(sourceLeft, sx));
					const area = overlapX * overlapY;
					totalArea += area;
					if (rows[sy]?.[sx] && rows[sy][sx] !== " ") inkArea += area;
				}
			}
			pixelRow.push(inkArea > totalArea * WORKING_HORSE_INK_THRESHOLD);
		}
		pixels.push(pixelRow);
	}

	const out: string[] = [];
	for (let cellY = 0; cellY < WORKING_HORSE_HEIGHT; cellY++) {
		let line = "";
		for (let cellX = 0; cellX < WORKING_HORSE_WIDTH; cellX++) {
			let bits = 0;
			for (let dotY = 0; dotY < 4; dotY++) {
				for (let dotX = 0; dotX < 2; dotX++) {
					if (pixels[cellY * 4 + dotY][cellX * 2 + dotX]) bits |= BRAILLE_BITS[dotY][dotX];
				}
			}
			line += bits === 0 ? " " : String.fromCodePoint(0x2800 + bits);
		}
		// Pi resets terminal styling after every rendered line, so color each
		// line independently instead of wrapping the whole multiline frame.
		out.push(paint(HORSE_COLOR, line));
	}
	return out.join("\n");
}

const WORKING_HORSE_FRAMES = CROPPED.map(miniHorse);

function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

// areca-style glitch: swap ink glyphs for visual look-alikes (FUZZ/NOISE) with
// an occasional one-column row shift (JITTER). Kept subtle so the horse reads.
function glitch(rows: string[]): string[] {
	if (GLITCH <= 0) return rows;
	const subRate = GLITCH * 0.5;
	const jitterRate = GLITCH * 0.3;
	return rows.map((row) => {
		let out = "";
		for (const ch of row) {
			const alts = data.similar[ch];
			out += ch !== " " && alts && Math.random() < subRate ? pick(alts) : ch;
		}
		if (Math.random() < jitterRate) {
			out = Math.random() < 0.5 ? ` ${out.slice(0, -1)}` : `${out.slice(1)} `;
		}
		return out;
	});
}

function centre(text: string, width: number, color: number[]): string {
	const clipped = text.length > width ? text.slice(0, width) : text;
	const pad = Math.max(0, Math.floor((width - clipped.length) / 2));
	return " ".repeat(pad) + paint(color, clipped);
}

function renderSplash(frame: number, width: number): string[] {
	const termRows = process.stdout.rows && process.stdout.rows > 0 ? process.stdout.rows : 30;
	const availH = Math.max(ART_H, termRows) - 4; // leave room for a gap + brand + hint
	// Fit to the terminal — never upscale; nearest-neighbour downscale when small.
	const scale = Math.min(1, width / ART_W, availH / ART_H);
	let rows = glitch(CROPPED[frame]);
	let tw = ART_W;
	let th = ART_H;
	if (scale < 1) {
		tw = Math.max(1, Math.floor(ART_W * scale));
		th = Math.max(1, Math.floor(ART_H * scale));
		const sampled: string[] = [];
		for (let y = 0; y < th; y++) {
			const sy = Math.min(ART_H - 1, Math.floor((y * ART_H) / th));
			let line = "";
			for (let x = 0; x < tw; x++) {
				line += rows[sy][Math.min(ART_W - 1, Math.floor((x * ART_W) / tw))] ?? " ";
			}
			sampled.push(line);
		}
		rows = sampled;
	}
	const leftPad = Math.max(0, Math.floor((width - tw) / 2));
	const topPad = Math.max(0, Math.floor((availH - th) / 2));
	const out: string[] = [];
	for (let i = 0; i < topPad; i++) out.push("");
	for (const row of rows) {
		const content = row.length > width - leftPad ? row.slice(0, width - leftPad) : row;
		out.push(" ".repeat(leftPad) + paint(HORSE_COLOR, content));
	}
	out.push("");
	out.push(centre(BRAND, width, BRAND_COLOR));
	out.push(centre(DURATION_MS > 0 ? "press any key to skip" : "press any key", width, HINT_COLOR));
	return out;
}

class HorseSplash {
	private readonly tui: { requestRender: () => void };
	private readonly finish: () => void;
	private frame = 0;
	private ticker: ReturnType<typeof setInterval> | null = null;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private closed = false;

	constructor(tui: { requestRender: () => void }, done: () => void) {
		this.tui = tui;
		this.finish = () => {
			if (this.closed) return;
			this.closed = true;
			this.dispose();
			done();
		};
		this.ticker = setInterval(() => {
			this.frame = (this.frame + 1) % CROPPED.length;
			this.tui.requestRender();
		}, FRAME_MS);
		if (DURATION_MS > 0) this.timer = setTimeout(this.finish, DURATION_MS);
		this.tui.requestRender();
	}

	handleInput(_data: string): void {
		this.finish(); // any key skips the splash
	}

	invalidate(): void {}

	render(width: number): string[] {
		return renderSplash(this.frame, width);
	}

	dispose(): void {
		if (this.ticker) clearInterval(this.ticker);
		if (this.timer) clearTimeout(this.timer);
		this.ticker = null;
		this.timer = null;
	}
}

async function play(ctx: ExtensionContext): Promise<void> {
	if (ctx.mode !== "tui") return; // no splash in print/json/rpc modes
	await ctx.ui.custom<void>((tui, _theme, _keybindings, done) => new HorseSplash(tui, () => done(undefined)));
}

function renderDittoPixelRow(row: string, pixelWidth: number): string {
	let out = "";
	for (const code of row) {
		const color = dittoColor(code);
		out += color ? `${background(color)}${" ".repeat(pixelWidth)}${RESET_CELL}` : " ".repeat(pixelWidth);
	}
	return out;
}

function renderDittoSplash(frame: number, width: number): string[] {
	const termRows = process.stdout.rows && process.stdout.rows > 0 ? process.stdout.rows : 30;
	const maxArtHeight = Math.max(1, termRows - 3);
	const artHeight = Math.min(dittoData.height, maxArtHeight);
	const pixelWidth = width >= dittoData.width * 2 ? 2 : 1;
	const visiblePixels = Math.min(dittoData.width, Math.floor(width / pixelWidth));
	const artWidth = visiblePixels * pixelWidth;
	const leftPad = Math.max(0, Math.floor((width - artWidth) / 2));
	const topPad = Math.max(0, Math.floor((termRows - artHeight - 3) / 2));
	const rows = dittoData.frames[frame];
	const out: string[] = [];

	for (let i = 0; i < topPad; i++) out.push("");
	for (let y = 0; y < artHeight; y++) {
		const sourceY = Math.min(dittoData.height - 1, Math.floor((y * dittoData.height) / artHeight));
		out.push(" ".repeat(leftPad) + renderDittoPixelRow(rows[sourceY].slice(0, visiblePixels), pixelWidth));
	}
	out.push("");
	out.push(centre("D A N C I N G   D I T T O", width, dittoData.palette.p));
	out.push(centre("press any key to skip", width, HINT_COLOR));
	return out;
}

class DittoSplash {
	private readonly tui: { requestRender: () => void };
	private readonly finish: () => void;
	private frame = 0;
	private ticker: ReturnType<typeof setInterval> | null = null;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private closed = false;

	constructor(tui: { requestRender: () => void }, done: () => void) {
		this.tui = tui;
		this.finish = () => {
			if (this.closed) return;
			this.closed = true;
			this.dispose();
			done();
		};
		this.ticker = setInterval(() => {
			this.frame = (this.frame + 1) % dittoData.frames.length;
			this.tui.requestRender();
		}, dittoData.intervalMs);
		this.timer = setTimeout(this.finish, DITTO_SPLASH_DURATION_MS);
		this.tui.requestRender();
	}

	handleInput(_data: string): void {
		this.finish();
	}

	invalidate(): void {}

	render(width: number): string[] {
		return renderDittoSplash(this.frame, width);
	}

	dispose(): void {
		if (this.ticker) clearInterval(this.ticker);
		if (this.timer) clearTimeout(this.timer);
		this.ticker = null;
		this.timer = null;
	}
}

async function playDitto(ctx: ExtensionContext): Promise<void> {
	if (ctx.mode !== "tui") return;
	await ctx.ui.custom<void>((tui, _theme, _keybindings, done) => new DittoSplash(tui, () => done(undefined)));
}

function renderDittoBrailleSplash(frame: number, width: number): string[] {
	const termRows = process.stdout.rows && process.stdout.rows > 0 ? process.stdout.rows : 30;
	const rows = dittoBrailleData.frames[frame].split("\n");
	const topPad = Math.max(0, Math.floor((termRows - rows.length - 3) / 2));
	const out: string[] = [];

	for (let i = 0; i < topPad; i++) out.push("");
	for (const row of rows) {
		const clipped = row.length > width ? row.slice(0, width) : row;
		const leftPad = Math.max(0, Math.floor((width - clipped.length) / 2));
		out.push(" ".repeat(leftPad) + paint(dittoData.palette.p, clipped));
	}
	out.push("");
	out.push(centre("B R A I L L E   D I T T O", width, dittoData.palette.p));
	out.push(centre("press any key to skip", width, HINT_COLOR));
	return out;
}

class DittoBrailleSplash {
	private readonly tui: { requestRender: () => void };
	private readonly finish: () => void;
	private frame = 0;
	private ticker: ReturnType<typeof setInterval> | null = null;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private closed = false;

	constructor(tui: { requestRender: () => void }, done: () => void) {
		this.tui = tui;
		this.finish = () => {
			if (this.closed) return;
			this.closed = true;
			this.dispose();
			done();
		};
		this.ticker = setInterval(() => {
			this.frame = (this.frame + 1) % dittoBrailleData.frames.length;
			this.tui.requestRender();
		}, dittoBrailleData.intervalMs);
		this.timer = setTimeout(this.finish, DITTO_SPLASH_DURATION_MS);
		this.tui.requestRender();
	}

	handleInput(_data: string): void {
		this.finish();
	}

	invalidate(): void {}

	render(width: number): string[] {
		return renderDittoBrailleSplash(this.frame, width);
	}

	dispose(): void {
		if (this.ticker) clearInterval(this.ticker);
		if (this.timer) clearTimeout(this.timer);
		this.ticker = null;
		this.timer = null;
	}
}

async function playDittoBraille(ctx: ExtensionContext): Promise<void> {
	if (ctx.mode !== "tui") return;
	await ctx.ui.custom<void>(
		(tui, _theme, _keybindings, done) => new DittoBrailleSplash(tui, () => done(undefined)),
	);
}

export default function (pi: ExtensionAPI) {
	let workingAnimation: "ditto" | "braille" | "horse" = "ditto";

	const applyWorkingAnimation = (ctx: ExtensionContext) => {
		if (ctx.mode !== "tui") return;
		ctx.ui.setWorkingMessage("");
		if (workingAnimation === "ditto") {
			ctx.ui.setWorkingIndicator({ frames: WORKING_DITTO_FRAMES, intervalMs: dittoData.intervalMs });
		} else if (workingAnimation === "braille") {
			ctx.ui.setWorkingIndicator({
				frames: WORKING_DITTO_BRAILLE_FRAMES,
				intervalMs: dittoBrailleData.intervalMs,
			});
		} else {
			ctx.ui.setWorkingIndicator({ frames: WORKING_HORSE_FRAMES, intervalMs: FRAME_MS });
		}
	};

	pi.on("session_start", async (event, ctx) => {
		applyWorkingAnimation(ctx);
		if (!SHOW_ON_STARTUP || event.reason !== "startup") return; // launch only
		try {
			await play(ctx);
		} catch {
			// A splash must never block or break startup.
		}
	});

	pi.registerCommand("horse", {
		description: "Replay the ARECA galloping-horse splash",
		handler: async (_args, ctx) => {
			await play(ctx);
		},
	});

	pi.registerCommand("ditto", {
		description: "Replay the pixel-art Ditto animation and use it as the working spinner",
		handler: async (args, ctx) => {
			const variant = args.trim().toLowerCase();
			if (variant === "braille") {
				workingAnimation = "braille";
				applyWorkingAnimation(ctx);
				await playDittoBraille(ctx);
				return;
			}
			if (variant && variant !== "pixel") {
				ctx.ui.notify("Usage: /ditto [pixel|braille]", "error");
				return;
			}
			workingAnimation = "ditto";
			applyWorkingAnimation(ctx);
			await playDitto(ctx);
		},
	});

	pi.registerCommand("ditto-braille", {
		description: "Replay the Braille Ditto animation and use it as the working spinner",
		handler: async (_args, ctx) => {
			workingAnimation = "braille";
			applyWorkingAnimation(ctx);
			await playDittoBraille(ctx);
		},
	});

	pi.registerCommand("spinner", {
		description: "Choose the working indicator: /spinner ditto-pixel|ditto-braille|horse-braille",
		handler: async (args, ctx) => {
			const requested = args.trim().toLowerCase();
			const names: Record<typeof workingAnimation, string> = {
				ditto: "ditto-pixel",
				braille: "ditto-braille",
				horse: "horse-braille",
			};
			if (!requested) {
				ctx.ui.notify(`Current spinner: ${names[workingAnimation]}`, "info");
				return;
			}
			const choices: Record<string, typeof workingAnimation> = {
				"ditto-pixel": "ditto",
				"ditto-braille": "braille",
				"horse-braille": "horse",
			};
			const choice = choices[requested];
			if (!choice) {
				ctx.ui.notify("Usage: /spinner ditto-pixel|ditto-braille|horse-braille", "error");
				return;
			}
			workingAnimation = choice;
			applyWorkingAnimation(ctx);
			ctx.ui.notify(`Spinner set to ${requested}`, "info");
		},
	});
}
