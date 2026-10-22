# CleanFrame for LG webOS

> **Credit.** This is a port of [CleanFrame](https://github.com/nthnclrk/CleanFrame) by **Nathan Clark**, who designed and built the original interface, its glass materials and remote navigation for Samsung The Frame. This fork adapts his work to LG webOS TVs. It is an independent project and is not endorsed by Nathan Clark. **If you own a Samsung TV, use [the original CleanFrame](https://github.com/nthnclrk/CleanFrame).**

A quieter home screen for LG webOS TVs: your apps, a photograph and the time, with an interface made for the TV remote.

![CleanFrame browser preview using the bundled Manrope font](docs/images/cleanframe-dock.jpg)

This fork targets LG webOS only. It is developed and tested on one TV, a 2020 LG NANO86 on webOS 5 (Chromium 68), without root. Other models and webOS versions may work but have not been checked. **Use it at your own risk** and expect to test the result on your own TV.

## Try the interface

You need Node.js 22+ and Python 3.10+ to run the browser preview.

```sh
git clone https://github.com/yhamil04/CleanFrame.git
cd CleanFrame
npm ci
npm run dev:public
```

Open [localhost:4795/home/](http://localhost:4795/home/). Use the arrow keys, Enter and Escape, or click the controls. Launching apps and opening LG screens requires a TV; the preview reports that limitation when you select them.

The public preview uses the included Manrope, Geist and Newsreader fonts.

## What you can change

- Choose a List or Dock layout, with icons, names or both, for apps and Home controls separately.
- Use a photograph, light or dark background, with a 12-hour or 24-hour clock and an optional date (for example "Tue 21 Oct").
- Adjust typography, focus style and glass materials in Settings.
- Choose and reorder up to nine Home apps; open other installed apps and the TV's inputs from All apps.
- Open Live TV, LG Home and TV settings from CleanFrame.
- Picture mode: LG TVs have no Art Mode, so CleanFrame can show the wallpaper full screen with only a quiet clock. Start it from Settings → Picture, with 0 on Home, or after 5, 15 or 30 minutes idle on Home; any key or pointer movement returns to Home.
- Give the TV's inputs familiar names (PlayStation, Apple TV, Set-top box and other presets) from All apps → Inputs → Rename.
- Screen shift, for OLED care, moves the Home clock, controls and apps by a few pixels every 30 minutes, keeping the glass aligned.
- Use the Magic Remote pointer, wheel and remote shortcuts: number keys 1–9 open Home apps, the colour keys open All apps, Live TV, Apps on Home and Settings, and Channel Up/Down page through lists.
- Select from fifteen wallpapers, with optional rotation. Preferences are saved on the TV.
- Add your own photos as wallpapers with `npm run wallpapers:add -- <folder>`. They stay in the ignored `.local/wallpapers/` and are never committed; see [Your own photos](app/assets/wallpapers/README.md#your-own-photos).

The glass and blur are rendered ahead of time. The TV loads the finished images and uses transforms and opacity for focus feedback.

## Put it on an LG TV

[docs/webos.md](docs/webos.md) covers building, installing and the limits. In short:

1. Install the webOS CLI (`ares`), enable Developer Mode on the TV with the LG Developer Mode app, and register the TV as an ares device.
2. Set your own app ID in the git-ignored `.local/webos.json`, for example `{"id": "com.<yourname>.cleanframe", "vendor": "<your name>"}`.
3. Run `npm run webos:package`, then `npm run webos:install` and `npm run webos:launch`.

Without root, CleanFrame is an app you open from the LG app bar. It does not replace LG's Home: the remote's Home button and Back inside other apps still go to LG's own Home, and CleanFrame cannot start itself at power-on. With **Home Auto Launch** off and **Quick Start+** on, the TV resumes CleanFrame if it was open when you turned the TV off. The quickest way back is LG's **Quick Access**: open CleanFrame, press and hold a number key (1–8) and confirm. Holding that key then opens CleanFrame from Live TV or any app.

A Developer Mode session lasts about 50 hours. Press Extend in the Developer Mode app before it expires, or the TV removes developer apps. See the [TV status](docs/tv-status.md) record for what has been confirmed on the reference TV.

## Use a coding agent

Open this repo in a local coding agent and give it a bounded change:

```text
Read AGENTS.md, docs/development.md and docs/interaction-behaviour.md.
Help me adapt CleanFrame for LG webOS. Start with the public-font browser preview.
My first change is: <describe one change>.
Preserve remote navigation, saved preferences and the ES5 runtime.
Run the source checks and relevant browser checks. Show the result.
This task is browser-only: do not connect to a TV or install a package.
```

See [working with an agent](docs/for-agents.md) for the TV install prompt. An agent needs local computer access for TV work; a hosted chat cannot reach your TV merely by reading this repo.

## Develop and check

```sh
npm run check
npx playwright install chromium
CLEANFRAME_PUBLIC_FONTS=1 npm run check:browser
npm run check:public
```

`check` validates syntax, ES5 compatibility of the TV scripts, the webOS manifest and bundled resources. The browser checks use isolated Chromium profiles, a mock webOS service bridge and a loopback preview; they never contact a TV. `check:public` looks for private files, credentials and personal identifiers. `npm run webos:stage` writes the public-font app folder without the webOS CLI.

| Location | Purpose |
| --- | --- |
| `app/` | The webOS app: `appinfo.json`, UI and runtime assets |
| `scripts/` | Preview, validation, asset generation and webOS packaging |
| [webOS](docs/webos.md) / [TV status](docs/tv-status.md) | Installing on an LG TV, limits and the reference TV record |
| [Development](docs/development.md) / [testing](docs/testing.md) | Runtime map, preferences, checks and device boundaries |
| [Interaction behaviour](docs/interaction-behaviour.md) | How Home, Settings, All apps and the editor respond to the remote |
| [Assets](docs/assets.md) / [third-party notices](THIRD_PARTY_NOTICES.md) | Rendering recipes, font separation and asset provenance |
| [Asset sources](docs/asset-sources.md) | Photo credits and verification of the bundled third-party assets |
| `.local/`, `dist/` | Ignored private setup (including `.local/webos.json`), generated files and packages |

## Contribute

Fixes and improvements for LG webOS are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before a larger change. Reports should include TV model, webOS and firmware version and the observed result, with private identifiers removed. Changes for Samsung TVs belong in [the original CleanFrame](https://github.com/nthnclrk/CleanFrame).

## Licence and credits

CleanFrame was created by [Nathan Clark](https://github.com/nthnclrk/CleanFrame), who designed and built the original interface, glass materials and remote navigation. This LG webOS port builds on his work. The code and documentation use the [MIT licence](LICENSE), which keeps his copyright notice alongside that of the fork's contributors.

Fonts, photographs and logos retain their own terms; read [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Wallpapers are Unsplash photographs credited in [asset sources](docs/asset-sources.md). The public app uses Manrope, Geist and Newsreader under the SIL Open Font License; optional paid Pangram fonts are excluded from Git and from the webOS package.

CleanFrame for LG webOS is an independent project. It has no affiliation with LG Electronics, Samsung or any streaming service. Brand marks identify services and remain their owners' trademarks.
