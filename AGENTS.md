# CleanFrame for LG webOS

This repository is an LG webOS port of Nathan Clark's [CleanFrame](https://github.com/nthnclrk/CleanFrame). It is LG webOS only; Samsung/Tizen work belongs upstream.

`app/` is the webOS app (`appinfo.json`, UI and runtime assets). Read `docs/development.md` and `docs/interaction-behaviour.md` before app changes, and `docs/webos.md` before packaging or TV work. For a new contributor or someone else's TV, also read `docs/for-agents.md`.

## Runtime rules

- The reference TV runs webOS 5 with Chromium 68. Use simple HTML, CSS and ES5 JavaScript in `app/`. `npm run check` parses the runtime scripts as ES5. Node tooling can use modern JavaScript.
- Avoid CSS newer than Chromium 68: no flex `gap`, no `inset`, and no reliance on `:focus-visible`. Use sibling margins and explicit offsets instead.
- Keep device calls in `app/device.js` (the `FrameDevice` adapter over `PalmServiceBridge`); keep interaction in `app/main.js`.
- Preserve remote focus/navigation, preference migrations (`cleanframe.home.v1`) and cached rendering. Read `docs/assets.md` before changing images, glass geometry or icon sizing; keep live blur and pixel analysis off the TV animation path.

## Checks

Run `npm run check` for app changes. For interaction changes, run the browser preview and `CLEANFRAME_PUBLIC_FONTS=1 npm run check:browser`; contributors must not need proprietary fonts. Run `npm run check:public` before publishing anything. Follow `CONTRIBUTING.md` and retain third-party notices.

## TV access

Repository and browser tasks do not authorise TV access. `npm run webos:install`, `webos:launch`, `webos:inspect` and any `ares-*` command reach the TV; run them only in an explicit device task, announce each install or launch to the TV's owner first, and confirm visible results with the owner. Read `docs/tv-status.md` before making compatibility claims. Do not attempt rooting or changes to LG's Home or startup.

## Identity and private material

The tracked app ID is the generic `com.example.cleanframe`. Each owner sets their own reverse-domain ID and vendor in the ignored `.local/webos.json`; `scripts/webos.py` applies it when packaging, installing, launching and inspecting. Keep an existing installation's ID stable, or the TV treats it as a different app.

Keep proprietary fonts, keys, passwords, TV addresses, device identifiers, personal app IDs (`.local/webos.json`), personal wallpapers (`.local/wallpapers/`) and generated packages in ignored `.local/` or `dist/`. Never commit paid font binaries or publish a package containing them. Public-code licensing does not replace the terms in `THIRD_PARTY_NOTICES.md`.

## Git

Use the contributor's own authenticated GitHub account. Preserve shared or uncommitted work. Use reversible deletion; never reset, force-push or rewrite history without explicit authority. Publication and visibility changes require a separate instruction.
