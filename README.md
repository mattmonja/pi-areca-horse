# pi-areca-horse

A galloping-horse splash screen and compact working indicator for [Pi](https://github.com/earendil-works/pi-mono).

## Features

- Animated seven-frame ASCII horse on interactive startup
- Compact Braille horse while Pi is working
- Rosé Pine-inspired colors and subtle signal-degradation effects
- Automatic scaling for smaller terminals
- `/horse` command to replay the splash screen
- No runtime dependencies

## Install

Install the tagged release from GitHub:

```bash
pi install git:github.com/mattmonja/pi-areca-horse@v1.0.0
```

Or follow the repository's default branch:

```bash
pi install git:github.com/mattmonja/pi-areca-horse
```

To try it for one session without installing:

```bash
pi -e git:github.com/mattmonja/pi-areca-horse@v1.0.0
```

Pi packages execute with your user permissions. Review third-party extension source before installing it.

## Usage

The splash plays automatically when Pi starts in interactive mode. While the agent is working, Pi's normal indicator is replaced with the compact animated horse.

Replay the full animation at any time:

```text
/horse
```

The extension does nothing in print, JSON, or RPC modes.

## Customize

The constants near the top of [`index.ts`](./index.ts) control animation speed, duration, glitch intensity, startup behavior, working-indicator size, colors, and branding.

After changing an auto-discovered local copy, run `/reload` in Pi. For an installed Git package, fork the repository or install a local checkout before customizing it.

## Artwork

The full-size frames are the seven-pose Muybridge horse animation used by [mattmonja/areca](https://github.com/mattmonja/areca). The extension crops and downsamples those frames into the compact Braille working indicator at runtime.
