# pi-areca-horse

Animated horse and Ditto splash/working indicators for [Pi](https://github.com/earendil-works/pi-mono).

## Features

- On-demand seven-frame ASCII horse splash (`/horse`)
- Three selectable working indicators:
  - compact full-color dancing Ditto pixel art
  - compact dancing Ditto Braille art
  - the original compact Braille horse
- Large pixel-art and Braille Ditto previews
- Rosé Pine-inspired colors and subtle signal-degradation effects
- Automatic scaling for smaller terminals
- No runtime dependencies

## Install

Follow the repository's default branch:

```bash
pi install git:github.com/mattmonja/pi-areca-horse
```

To try it for one session without installing:

```bash
pi -e git:github.com/mattmonja/pi-areca-horse
```

Pi packages execute with your user permissions. Review third-party extension source before installing it.

## Usage

The startup splash is disabled by default, and the pixel-art Ditto is the default working indicator. Replay the horse splash on demand:

```text
/horse
```

Preview and select a Ditto variant:

```text
/ditto
/ditto pixel
/ditto braille
/ditto-braille
```

Switch the working indicator without opening a preview:

```text
/spinner ditto-pixel
/spinner ditto-braille
/spinner horse-braille
```

Run `/spinner` without an argument to show the current selection.

The extension does nothing in print, JSON, or RPC modes.

## Customize

The constants near the top of [`index.ts`](./index.ts) control animation speed, duration, glitch intensity, startup behavior, working-indicator size, colors, and branding.

After changing an auto-discovered local copy, run `/reload` in Pi. For an installed Git package, fork the repository or install a local checkout before customizing it.

## Artwork

The full-size horse frames are the seven-pose Muybridge animation used by [mattmonja/areca](https://github.com/mattmonja/areca). The extension crops and downsamples those frames into the compact Braille horse at runtime.

The Ditto indicators are terminal-friendly derivatives of the four-frame [dancing Ditto GIF on Tenor](https://media.tenor.com/sQQ4ikAjQngAAAAi/dancing-ditto-ditto.gif). `ditto.json` stores quantized pixel-art frames, while `ditto-braille.json` stores a compact Braille silhouette that preserves Ditto's face and movement.
