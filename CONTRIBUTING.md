# Contributing to CleanFrame for LG webOS

This fork ports [CleanFrame](https://github.com/nthnclrk/CleanFrame), created by Nathan Clark, to LG webOS TVs. The interface, glass materials and remote navigation are his work. This fork is LG webOS only: **changes for Samsung The Frame or Tizen belong in [the original repository](https://github.com/nthnclrk/CleanFrame)**, not here.

The port is developed on one TV (a 2020 LG NANO86, webOS 5, not rooted). Contributions should keep the remote experience simple and state what has actually been tested.

## Start in the browser

Use the README's public-font setup. Keep changes in `app/` and the maintained tools in `scripts/`. Develop interface changes in the browser.

```sh
npm ci
npm run dev:public
npm run check
npx playwright install chromium
CLEANFRAME_PUBLIC_FONTS=1 npm run check:browser
npm run check:public
```

Keep runtime JavaScript ES5-compatible; `npm run check` rejects newer syntax in the TV scripts. The reference TV's engine is Chromium 68, so avoid newer CSS such as flex `gap` and `inset`. Use the existing focus, panel and preference logic. A new CSS/DOM or Luna service API needs evidence from a webOS TV before it becomes a compatibility claim. Keep new dependencies in development tooling unless the runtime need is clear.

## Propose a change

For a bug, describe the trigger, expected result and actual result. Include the browser and viewport, or the TV model, webOS version and firmware version. For a new feature, explain the task it helps someone complete from the sofa. Open an issue before changing the app model or introducing a new service dependency.

A pull request should explain the resulting behaviour, the checks run and any untested TV result. Include a public-font screenshot for visual changes. Check both List and Dock, single focus, panel Back behaviour and saved-preference recovery when relevant. The TV remote remains the final check for remote feel; browser throttling is only a comparison.

New app IDs for All apps (the fixed list in `app/device.js`) should say where the ID was verified, for example `getAppLoadStatus` returning `exist: true` on a named model and region.

## TV work and privacy

Use your own app ID in the ignored `.local/webos.json` and your own Developer Mode session. Each TV owner decides whether and when to permit installs, launches or settings changes. This project does not cover rooting.

Keep passwords, keys, TV addresses, serial numbers, device identifiers and personal app IDs out of issues, screenshots and PRs. `npm run check:public` flags common cases. Report security issues through GitHub's private vulnerability reporting if enabled; do not attach credentials to a public issue.

## Assets and licences

The code is MIT, under both Nathan Clark's original copyright and the fork's contributors; contributions use the same licence. Keep upstream asset licences and source records intact. Add only assets you have permission to redistribute, and explain any required attribution or separate terms. Personal paid fonts stay under `.local/`; the app must work without them and the webOS package never includes them. Review `THIRD_PARTY_NOTICES.md` before adding or replacing a logo, photograph or font.
