// Production UI checks. Mock only the webOS PalmServiceBridge boundary; never contact a TV.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openPreview, root } from './browser.mjs';

const KEY = 'cleanframe.home.v1';
// The tracked app ID; the adapter filters its own launch point by it.
const APP_ID = JSON.parse(readFileSync(new URL('../app/appinfo.json', import.meta.url), 'utf8')).id;
const PRIMARY = ['netflix', 'youtube', 'primevideo', 'disneyplus'];
const IDS = ['netflix', 'youtube.leanback.v4', 'amazon', 'com.disney.disneyplus-prod'];
const NAMES = ['Netflix', 'YouTube', 'Prime Video', 'Disney+'];
const EXTRA = 'com.example.familyapp', EXTRA2 = 'com.example.morningnews', BROWSER = 'com.webos.app.browser';
const UNSAFE_NAME = 'Family <img src=x onerror="window.__catalogXss=1"> & TV';
// Installed apps that the adapter also knows as fallback candidates.
const KNOWN_EXTRAS = [['com.apple.appletv', 'Apple TV'], ['spotify-beehive', 'Spotify'], ['com.apple.applemusic', 'Apple Music'], ['tv.twitch.tv.starshot.lg', 'Twitch'], [BROWSER, 'Web Browser']];
const CATALOG = IDS.map((id, i) => ({ id, name: NAMES[i], show: true, iconPath: '' })).concat(KNOWN_EXTRAS.map(([id, name]) => ({ id, name, show: true, iconPath: '' }))).concat([
  { id: EXTRA, name: UNSAFE_NAME, show: true, iconPath: '' },
  { id: EXTRA2, name: 'Morning News', show: true, iconPath: '' },
  { id: APP_ID, name: 'CleanFrame', show: true },
  { id: 'com.webos.app.discovery', name: 'LG Content Store', show: true },
  { id: 'netflix', name: 'Netflix', show: true }
]);
const walls = JSON.parse(readFileSync(root + 'app/assets/wallpapers/SOURCES.json', 'utf8'));
const out = root + '.local/qa/';
mkdirSync(out, { recursive: true });
const sourceFiles = ['app/main.js', 'app/device.js', 'app/index.html', 'app/style.css', 'app/appinfo.json', 'app/assets/wallpapers/SOURCES.json', 'app/assets/wallpapers/catalog.js', 'app/assets/adaptive-ink.js', 'app/assets/icons/metrics.js'];
const hashes = () => Object.fromEntries(sourceFiles.map(f => [f, createHash('sha256').update(readFileSync(root + f)).digest('hex')]));
const report = { scope: 'Production UI in Chromium; mock webOS service bridge only; no TV contacted.', sourceBefore: hashes(), checks: [], failures: [], pageErrors: [], expectedNetworkFailures: [] };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const baseline = (patch = {}) => ({ dock: PRIMARY.slice(), wallpaper: walls[0].id, mode: 'fixed', lastApp: 'netflix', theme: 'shore', ...patch });
let preview, current, section = '';

function check(name, pass, detail) {
  const result = { section, name, passed: !!pass, ...(pass ? {} : { detail }) };
  report.checks.push(result);
  if (!pass) { report.failures.push(result); throw Error(name + (detail ? ': ' + JSON.stringify(detail).slice(0, 500) : '')); }
}
async function run(name, fn) {
  if (process.env.CHECK_SECTION && !name.toLowerCase().includes(process.env.CHECK_SECTION.toLowerCase())) return;
  section = name;
  try { await fn(); console.log(name + ': passed'); }
  catch (error) { if (!report.failures.some(f => f.section === name)) report.failures.push({ section: name, error: error.stack }); console.error(name + ': ' + error.message); }
  finally { await closePage(); }
}
async function closePage() { if (current) { current.__closing = true; await current.close(); current = null; } }

// Production still calls its unmodified device.js adapter.
function installHarness({ seed, legacy, mock, catalog, appId, minuteMs, catalogFailure, noFontAPI, storageFailure }) {
  if (!sessionStorage.getItem('__cleanframe_seeded')) {
    if (seed !== undefined) localStorage.setItem('cleanframe.home.v1', typeof seed === 'string' ? seed : JSON.stringify(seed));
    if (legacy !== undefined) localStorage.setItem('cleanframe.shore.v1', typeof legacy === 'string' ? legacy : JSON.stringify(legacy));
    sessionStorage.setItem('__cleanframe_seeded', '1');
  }
  window.ShoreQA = { minuteMs };
  window.__failWrites = !!storageFailure;
  window.__storageAttempts = 0;
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    if (key === 'cleanframe.home.v1') window.__storageAttempts++;
    if (window.__failWrites && key === 'cleanframe.home.v1') throw new DOMException('QA storage failure', 'QuotaExceededError');
    return set.call(this, key, value);
  };
  window.__setHidden = value => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value ? 'hidden' : 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  };
  if (noFontAPI) Object.defineProperty(document, 'fonts', { configurable: true, value: undefined });
  if (!mock) return;
  window.__tv = { catalog, catalogFailure: !!catalogFailure, catalogDenied: false, launchFailure: false, holdCatalog: false, pending: [], calls: [], catalogCalls: 0, appsOptions: [] };
  // Record the options each catalogue request passes to the unmodified adapter.
  let device;
  Object.defineProperty(window, 'FrameDevice', { configurable: true, get: () => device, set: value => {
    const apps = value.apps;
    value.apps = function (done, options) { window.__tv.appsOptions.push(options || null); return apps.call(this, done, options); };
    device = value;
  } });
  // webOS application manager over PalmServiceBridge: listLaunchPoints and launch.
  const reply = (bridge, value) => setTimeout(() => bridge.onservicecallback(JSON.stringify(value)), 0);
  const points = list => ({ returnValue: true, launchPoints: list.map(a => ({ id: a.id, title: a.name, icon: a.iconPath || '' })) });
  window.PalmSystem = { identifier: appId + ' 1001' };
  window.PalmServiceBridge = function () {};
  window.PalmServiceBridge.prototype.call = function (uri, body) {
    const tv = window.__tv, bridge = this, method = uri.split('/').pop(), params = JSON.parse(body);
    if (method === 'listLaunchPoints') {
      tv.catalogCalls++;
      const ok = list => reply(bridge, points(list)), fail = err => reply(bridge, { returnValue: false, errorCode: -1, errorText: err.message });
      const finish = () => tv.catalogFailure ? fail({ message: tv.catalogDenied ? 'Denied method call "listLaunchPoints"' : 'Catalogue unavailable for QA' }) : ok(tv.catalog.map(a => ({ ...a })));
      if (tv.holdCatalog) tv.pending.push({ ok: list => ok(list), fail }); else finish();
    } else if (method === 'getAppLoadStatus') {
      reply(bridge, { returnValue: true, exist: tv.catalog.some(a => a.id === params.appId) });
    } else if (method === 'launch') {
      tv.calls.push({ method: 'launch', id: params.id });
      reply(bridge, tv.launchFailure ? { returnValue: false, errorCode: -101, errorText: 'App unavailable for QA' } : { returnValue: true, processId: '1' });
    } else reply(bridge, { returnValue: false, errorText: 'Unknown method' });
  };
}
async function page(options = {}) {
  current = await preview.browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const owner = current;
  current.setDefaultTimeout(10000);
  const expected = [];
  current.__expectedFailures = expected;
  current.on('pageerror', error => report.pageErrors.push({ section, error: error.message }));
  current.on('response', response => { if (response.status() >= 400 && !expected.some(s => response.url().includes(s))) report.pageErrors.push({ section, status: response.status(), url: response.url() }); });
  current.on('requestfailed', request => {
    if (owner.__closing) return;
    const failure = { section, url: request.url(), error: request.failure()?.errorText };
    if (expected.some(s => request.url().includes(s))) report.expectedNetworkFailures.push(failure);
    else if (failure.error !== 'net::ERR_ABORTED') report.pageErrors.push(failure);
  });
  await current.addInitScript(installHarness, { mock: true, catalog: CATALOG, appId: APP_ID, minuteMs: 60000, seed: baseline(), ...options });
  await current.goto(preview.baseURL + '/home/');
  await ready();
  await current.waitForLoadState('networkidle');
  return current;
}
const state = () => current.evaluate(() => ShoreQA.state());
const stored = () => current.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
const call = (method, ...args) => current.evaluate(([m, a]) => ShoreQA[m](...a), [method, args]);
const ready = () => current.waitForFunction(() => window.ShoreQA && typeof ShoreQA.ready === 'function' && ShoreQA.ready(), null, { timeout: 15000 });
const nav = (...keys) => call('nav', keys);
async function act(action) { const result = await call('activate', action); if (result === null || result === false) throw Error('Action unavailable: ' + action); return result; }
async function scene(name) { await call('scene', name); await current.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); }
async function look(patch) { await call('look', patch); await ready(); }
async function group(name) {
  await scene('settings'); await act('settings.group.' + name);
  await current.waitForFunction(expected => ShoreQA.state().settingsGroup === expected, name);
}
const settingsSnapshot = () => current.evaluate(() => {
  const s = ShoreQA.state();
  const rendered = [...document.getElementById('stage').classList].filter(c => /^(bg|l|a|u|f|m|font)-/.test(c)).sort();
  return { stored: localStorage.getItem('cleanframe.home.v1'), committed: s.committed, shown: s.shown, rendered, writes: s.writes, storageAttempts: window.__storageAttempts };
});
const choice = (axis, value) => act('choice.' + axis + '.' + value);
const radios = () => current.evaluate(() => [...document.querySelectorAll('#stage [role="radio"]')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(e => ({ action: e.getAttribute('data-action'), checked: e.getAttribute('aria-checked'), disabled: e.getAttribute('aria-disabled') === 'true', focused: e.classList.contains('is-focus'), text: e.textContent.trim() })));
async function focusedChoice() {
  const action = (await state()).focusAction;
  return (await radios()).find(r => r.action === action);
}
async function unselectedChoice() {
  for (const direction of ['right', 'right', 'down', 'left', 'left', 'down', 'right', 'right', 'down']) {
    await nav(direction);
    const radio = await focusedChoice();
    if (radio && radio.checked === 'false' && !radio.disabled) return radio;
  }
  throw Error('Remote could not reach an unselected choice');
}
async function walkEnabledChoices() {
  const visited = [];
  for (const direction of ['down', 'down', 'right', 'right', 'up', 'left', 'left', 'down', 'down', 'up', 'up']) {
    await nav(direction);
    const focus = await current.evaluate(() => {
      const action = ShoreQA.state().focusAction;
      const el = [...document.querySelectorAll('#stage [data-action]')].find(e => e.getAttribute('data-action') === action && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
      return { action, exists: !!el, disabled: el?.getAttribute('aria-disabled') === 'true', count: ShoreQA.where().focusCount };
    });
    visited.push(focus.action);
    if (!focus.exists || focus.disabled || focus.count !== 1) throw Error('Remote ' + direction + ' focused an unavailable choice: ' + JSON.stringify(focus));
  }
  return visited;
}
async function wallpaper() {
  await group('background'); await act('background.wallpaper');
  await current.waitForFunction(() => ShoreQA.state().view === 'wallpaper' && ShoreQA.state().settingsGroup === 'wallpaper');
}
const wallpaperSettled = id => current.waitForFunction(expected => !ShoreQA.state().pending && ShoreQA.state().shown.wall === expected, id);
const wallpaperRowVisible = id => current.waitForFunction(expected => {
  const list = document.querySelector('.wallpaper-list'), row = document.querySelector('[data-action="wallpaper.choose.' + expected + '"]');
  if (!list || !row || getComputedStyle(row).visibility === 'hidden') return false;
  const bounds = list.getBoundingClientRect(), r = row.getBoundingClientRect();
  return r.top >= bounds.top - 1 && r.bottom <= bounds.bottom + 1;
}, id);
const wallpaperSaved = () => current.evaluate(() => {
  const s = ShoreQA.state(), bg = document.getElementById('sheetBg'), veil = document.querySelector('.sheet-veil');
  const bgStyle = getComputedStyle(bg), veilStyle = getComputedStyle(veil);
  return { stored: localStorage.getItem('cleanframe.home.v1'), committed: s.committed, writes: s.writes, attempts: window.__storageAttempts,
    backdrop: { src: bg.currentSrc || bg.src, opacity: bgStyle.opacity, filter: bgStyle.filter, veil: veilStyle.background, veilOpacity: veilStyle.opacity } };
});
const wallpaperApplied = () => current.locator('.wallpaper-choice[aria-checked="true"]').evaluateAll(elements => elements.map(e => e.getAttribute('data-action')));
const wallpaperBundle = () => current.evaluate(() => Object.fromEntries(['photo', 'matImg', 'phFieldImg', 'phFieldImgAlt', 'utFieldImg', 'utFieldImgAlt'].map(id => [id, document.getElementById(id).currentSrc || document.getElementById(id).src])));
const previewFrame = () => current.evaluate(() => {
  const e = document.getElementById('scene'), r = e.getBoundingClientRect(), css = getComputedStyle(e);
  return { x: r.x, y: r.y, width: r.width, height: r.height, radius: css.borderRadius, transform: css.transform };
});
const wallpaperListGeometry = () => current.evaluate(() => {
  const list = document.querySelector('.wallpaper-list'), bounds = list.getBoundingClientRect(), rows = [...list.querySelectorAll('.wallpaper-choice')];
  const fullyVisible = [], partlyVisible = [], clippedParts = [];
  rows.forEach(row => {
    const r = row.getBoundingClientRect(), action = row.getAttribute('data-action');
    const visible = getComputedStyle(row).visibility !== 'hidden';
    if (visible && r.bottom > bounds.top + 1 && r.top < bounds.bottom - 1) partlyVisible.push(action);
    if (visible && r.top >= bounds.top - 1 && r.bottom <= bounds.bottom + 1) fullyVisible.push(action);
    const parts = [...row.querySelectorAll('.setting-name, .setting-tick svg')].map(e => e.getBoundingClientRect());
    if (parts.some(p => p.x < r.x - 1 || p.right > r.right + 1 || p.y < r.y - 1 || p.bottom > r.bottom + 1)) clippedParts.push(action);
    const name = row.querySelector('.setting-name'), tick = row.querySelector('.setting-tick svg');
    if (name && tick && name.getBoundingClientRect().right > tick.getBoundingClientRect().left + 1) clippedParts.push(action);
  });
  return { fullyVisible, partlyVisible, clippedParts, focus: ShoreQA.state().focusAction, bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }, top: ShoreQA.state().wallpaperPicker.top };
});
async function editor() { await scene('settings'); await act('settings.editor'); await current.waitForFunction(() => document.querySelector('[data-action^="editor.move."]')); await current.waitForFunction(() => !ShoreQA.state().catalog.loading); }
async function remove(id) { await act('editor.move.' + id); await nav('back', 'right', 'ok'); }
async function library() { await scene('home'); await act('util.apps'); await current.waitForFunction(() => !ShoreQA.state().catalog.loading); }
async function noLiveFilters() {
  return current.evaluate(() => [...document.querySelectorAll('#stage, #stage *')].filter(e => e.getClientRects().length).map(e => {
    const s = getComputedStyle(e); return { tag: e.tagName, cls: e.className, filter: s.filter, backdrop: s.backdropFilter || s.webkitBackdropFilter || 'none' };
  }).filter(s => /blur|url\(/.test(s.filter) || s.backdrop !== 'none'));
}

try {
  preview = await openPreview();
  await run('Legacy preference migration', async () => {
    for (const theme of ['list', 'shore', 'grid']) {
      await page({ seed: baseline({ theme, dock: ['youtube', 'netflix'], wallpaper: walls[1].id, lastApp: 'youtube', mode: '15' }) });
      const s = await state();
      check(theme + ' preserves order, wallpaper and rotation', same(s.dock, ['youtube', 'netflix']) && s.wallpaper === walls[1].id && s.mode === '15' && s.lastApp === 'youtube', s);
      check(theme + ' maps to intended two-layout appearance', s.look.layout === (theme === 'list' ? 'list' : 'dock') && s.look.bg === (theme === 'list' ? 'dark' : 'photo'), s.look);
      await closePage();
    }
    await page({ seed: undefined, legacy: baseline({ theme: 'list', dock: ['netflix'], lastApp: 'netflix' }) });
    check('Old shore key is read', (await state()).dock.length === 1 && (await state()).look.layout === 'list');
    await look({ controls: 'text' });
    check('Next completed edit writes stable home key', (await stored()).dock[0] === 'netflix');
    await current.reload(); await ready();
    check('Migrated preferences survive reload', (await state()).look.controls === 'text' && (await state()).dock[0] === 'netflix');
  });
  await run('Invalid preferences and saved native pins', async () => {
    await page({ seed: '{broken', legacy: baseline({ dock: ['netflix'], lastApp: 'netflix' }) });
    check('Malformed primary recovers valid legacy key', same((await state()).dock, ['netflix']));
    await closePage();
    await page({ seed: { dock: [], wallpaper: 'missing', mode: 'constructor', theme: 'constructor' } });
    const s = await state();
    check('Invalid values recover usable bounded Home', s.dock.length >= 1 && s.dock.length <= 9 && walls.some(w => w.id === s.wallpaper) && ['fixed', 'open', '5', '15', '60'].includes(s.mode), s);
    await closePage();
    await page({ seed: baseline({ dock: [EXTRA, 'netflix'], lastApp: EXTRA }), catalogFailure: true });
    await library();
    check('Discovery failure preserves saved native pin', (await state()).dock.includes(EXTRA));
  });
  await run('Startup fallbacks remain usable', async () => {
    await page({ noFontAPI: true });
    check('Missing font-loading API has usable baseline Home', (await state()).look.font === 'manrope' && (await call('where')).focusCount === 1);
    await closePage();
    await page({ seed: baseline({ mode: 'open' }), storageFailure: true });
    check('Failed open-mode write retains prior photo', (await state()).wallpaper === walls[0].id && (await stored()).wallpaper === walls[0].id);
  });
  await run('Real catalogue and native launch boundary', async () => {
    await page(); await library();
    const names = await current.locator('[data-action^="apps.open."] .label').allTextContents();
    check('Launch points exclude system screens, self and duplicates', names.length === 11 && names.filter(n => n === 'Netflix').length === 1 && !names.includes('CleanFrame') && !names.includes('LG Content Store'), names);
    check('Installed names stay text, including HTML punctuation', names.includes(UNSAFE_NAME) && !(await current.evaluate(() => window.__catalogXss)));
    check('Exploration fixtures do not appear', !names.includes('Plex') && !names.includes('Jellyfin'));
    await act('apps.open.' + BROWSER); await current.waitForFunction(() => __tv.calls.length > 0);
    check('Installed app launches its webOS ID', (await current.evaluate(() => __tv.calls.at(-1))).id === BROWSER);
    await current.evaluate(() => window.dispatchEvent(new Event('focus')));
    await scene('home'); await act('home.app.netflix'); await current.waitForFunction(() => __tv.calls.length === 2);
    check('Primary app keeps verified target', (await current.evaluate(() => __tv.calls.at(-1))).id === IDS[PRIMARY.indexOf('netflix')]);
    await current.evaluate(() => window.dispatchEvent(new Event('focus')));
    check('Home controls are Live TV, All apps and Settings', same((await call('actions')).filter(a => a.startsWith('util.')), ['util.tv', 'util.apps', 'util.settings']));
    await act('util.tv'); await current.waitForFunction(() => __tv.calls.length === 3);
    check('Live TV opens the webOS tuner app', (await current.evaluate(() => __tv.calls.at(-1))).id === 'com.webos.app.livetv');
    await current.evaluate(() => window.dispatchEvent(new Event('focus'))); await group('tv'); await act('tv.home');
    await current.waitForFunction(() => __tv.calls.length === 4);
    check('LG Home opens the webOS home app', (await current.evaluate(() => __tv.calls.at(-1))).id === 'com.webos.app.home');
    await current.evaluate(() => window.dispatchEvent(new Event('focus'))); await group('tv'); await act('tv.settings');
    await current.waitForFunction(() => __tv.calls.length === 5);
    check('TV settings opens the webOS settings app', (await current.evaluate(() => __tv.calls.at(-1))).id === 'com.palm.app.settings');
    await current.evaluate(() => window.dispatchEvent(new Event('focus')));
    await scene('home'); await nav('back'); await nav('right', 'ok');
    await current.waitForFunction(() => __tv.calls.length === 6);
    check('Leave Home opens LG Home', (await current.evaluate(() => __tv.calls.at(-1))).id === 'com.webos.app.home');
    await current.evaluate(() => { window.dispatchEvent(new Event('focus')); __tv.launchFailure = true; });
    await scene('home'); await act('home.app.netflix'); await current.waitForFunction(() => ShoreQA.where().view === 'message');
    check('Launch failure is shown', /could not|unavailable|try again/i.test(await current.locator('#stage').innerText()));
  });
  await run('Catalogue failure and retry', async () => {
    await page({ catalogFailure: true }); await library();
    check('Catalogue failure leaves Home intact', same((await state()).dock, PRIMARY));
    await current.evaluate(() => { __tv.catalogFailure = false; }); await act('apps.retry');
    await current.waitForSelector('[data-action="apps.open.' + EXTRA + '"]');
    check('Retry displays real installed names', (await current.locator('[data-action^="apps.open."]').count()) === 11);
  });
  await run('Denied launch-point list uses the known apps', async () => {
    await page({ catalogFailure: true });
    await current.evaluate(() => { __tv.catalogDenied = true; }); await library();
    const names = await current.locator('[data-action^="apps.open."] .label').allTextContents();
    check('Denial lists the installed known apps without an error', same(names.slice().sort(), NAMES.concat(KNOWN_EXTRAS.map(e => e[1])).sort()) && !(await state()).catalog.error, names);
    check('Denial keeps saved Home', same((await state()).dock, PRIMARY));
  });
  await run('Inputs are listed apart from apps', async () => {
    await page({ catalog: CATALOG.concat([{ id: 'com.webos.app.hdmi1', name: 'HDMI 1', show: true }, { id: 'com.webos.app.livetv', name: 'Live TV', show: true }]) });
    await library();
    const appNames = await current.locator('[data-action^="apps.open."] .label').allTextContents();
    check('All apps leaves out the tuner and inputs', appNames.length === 11 && !appNames.includes('HDMI 1') && !appNames.includes('Live TV'), appNames);
    await nav('up');
    check('Up from the first row reaches the current page tab', (await state()).focusAction === 'apps.all', (await state()).focusAction);
    check('Tabs show the open page', same(await current.locator('.s-head .btn').evaluateAll(b => b.map(e => e.getAttribute('data-action') + (e.classList.contains('is-current') ? '*' : ''))), ['apps.all*', 'apps.inputs', 'apps.editor']));
    await nav('right', 'ok');
    const inputNames = await current.locator('[data-action^="apps.open."] .label').allTextContents();
    check('Inputs tab lists only the tuner and inputs', same(inputNames, ['HDMI 1', 'Live TV']) && (await current.locator('.s-title').innerText()) === 'Inputs' && (await state()).focusAction === 'apps.inputs', inputNames);
    await nav('left', 'ok');
    check('All apps tab returns in place', (await current.locator('.s-title').innerText()) === 'All apps' && (await call('where')).view === 'apps');
    await nav('right', 'ok', 'down', 'ok'); await current.waitForFunction(() => __tv.calls.length > 0);
    check('An input opens through its webOS ID', (await current.evaluate(() => __tv.calls.at(-1))).id === 'com.webos.app.hdmi1');
    await current.evaluate(() => window.dispatchEvent(new Event('focus')));
    await nav('back');
    check('Back returns from Inputs to All apps', (await current.locator('.s-title').innerText()) === 'All apps' && (await call('where')).focusCount === 1);
    await nav('back');
    check('Back from All apps returns Home', (await call('where')).view === 'home');
    await editor();
    const other = await current.evaluate(() => [...document.querySelectorAll('[data-action^="editor.add."]')].map(e => e.getAttribute('data-action').slice(11)));
    check('Apps on Home lists inputs after apps', same(other.slice(-2), ['com.webos.app.hdmi1', 'com.webos.app.livetv']), other);
  });
  await run('Native icon and failed-image fallback', async () => {
    await page({ catalog: CATALOG.map(a => a.id === EXTRA ? { ...a, iconPath: '/home/assets/icons/netflix.svg' } : a) });
    await library();
    await current.waitForFunction(id => { const row = document.querySelector('[data-action="apps.open.' + id + '"]'); const img = row && row.querySelector('img'); return img && img.complete && img.naturalWidth > 0; }, EXTRA);
    check('Unbranded installed app uses its native icon', await current.evaluate(id => { const img = document.querySelector('[data-action="apps.open.' + id + '"] img'); return img && getComputedStyle(img).display !== 'none' && img.parentNode.classList.contains('has-native-icon'); }, EXTRA));
    await closePage();
    // The adapter keeps the catalogue for the session, so a changed icon needs a fresh page.
    await page({ catalog: CATALOG.map(a => a.id === EXTRA ? { ...a, iconPath: '/home/assets/icons/missing-native-icon.png' } : a) });
    current.__expectedFailures.push('/missing-native-icon.png');
    await library();
    await current.waitForFunction(id => { const img = document.querySelector('[data-action="apps.open.' + id + '"] img'); return img && img.src.includes('/missing-native-icon.png') && img.complete; }, EXTRA);
    const fallback = await current.evaluate(id => {
      const row = document.querySelector('[data-action="apps.open.' + id + '"]'), mark = row.querySelector('.native-icon'), img = mark && mark.querySelector('img');
      return { html: row.innerHTML, src: img && img.src, imageDisplay: img && getComputedStyle(img).display, initialsVisibility: mark && getComputedStyle(mark.firstChild).visibility, complete: img && img.complete, width: img && img.naturalWidth, text: row.textContent };
    }, EXTRA);
    check('Failed native icon leaves readable initials and app name', fallback.imageDisplay === 'none' && fallback.initialsVisibility === 'visible' && fallback.text.includes('Family'), fallback);
  });
  await run('Catalogue response after closing and reopening', async () => {
    await page();
    await current.evaluate(() => { __tv.holdCatalog = true; });
    await act('util.apps'); await nav('back'); await act('util.apps');
    const count = await current.evaluate(() => __tv.pending.length);
    check('Concurrent catalogue entry is coalesced', count === 1, count);
    await current.evaluate(() => { __tv.holdCatalog = false; __tv.pending.shift().ok(__tv.catalog); });
    await current.waitForFunction(() => !ShoreQA.state().catalog.loading);
    check('Delayed catalogue safely fills reopened view', (await call('where')).view === 'apps' && (await state()).catalog.ids.includes(EXTRA) && (await call('where')).focusCount === 1);
  });
  await run('Immediate edits, undo, move cancellation and limits', async () => {
    await page(); await editor();
    const start = (await state()).dock;
    await remove('netflix');
    check('Remove persists membership and keeps installation', !(await stored()).dock.includes('netflix') && (await current.evaluate(() => __tv.catalog.some(a => a.id === 'netflix'))));
    check('Focus follows removal into addable apps', (await state()).focusAction === 'editor.add.netflix', (await state()).focusAction);
    await nav('ok'); check('Second OK restores same position', same((await stored()).dock, start));
    await remove('netflix'); await act('editor.undo'); check('Undo persists previous membership', same((await stored()).dock, start));
    await act('editor.move.netflix'); await nav('down'); check('Unfinished move does not write', same((await stored()).dock, start));
    await nav('back'); check('Back cancels unfinished move', same((await state()).dock, start));
    await act('editor.move.netflix'); await nav('down', 'ok');
    const moved = start.slice(), at = moved.indexOf('netflix'); [moved[at], moved[at + 1]] = [moved[at + 1], moved[at]];
    check('Placed move persists immediately', same((await stored()).dock, moved));
    for (const [id] of KNOWN_EXTRAS.slice(0, 8 - PRIMARY.length)) await act('editor.add.' + id);
    await act('editor.add.' + EXTRA2); check('Ninth app can be added', (await state()).dock.length === 9 && (await state()).dock.includes(EXTRA2));
    await act('editor.add.' + EXTRA); check('Nine-app cap prevents addition', (await state()).dock.length === 9 && !(await state()).dock.includes(EXTRA));
    await remove(EXTRA2); await act('editor.add.' + EXTRA);
    check('Native app can be pinned with stable ID', (await stored()).dock.includes(EXTRA) && (await state()).dock.length === 9);
    check('Native pin retains readable metadata for failed discovery', (await stored()).appRecords.some(a => a.id === EXTRA && a.name === UNSAFE_NAME));
    await current.reload(); await ready(); check('Native pin survives reload', (await state()).dock.includes(EXTRA));
    await editor(); const ids = (await state()).dock;
    for (const id of ids.slice(1)) await remove(id);
    await remove(ids[0]); check('Last Home app cannot be removed', same((await state()).dock, [ids[0]]) && same((await stored()).dock, [ids[0]]));
    check('Editor has no Save action', !(await current.locator('#stage').innerText()).match(/\bSave\b/));
  });
  await run('Actual storage failures are atomic', async () => {
    await page(); await editor(); const before = await stored();
    await current.evaluate(() => { window.__failWrites = true; }); await remove('netflix');
    check('Failed removal changes neither committed state nor storage', same((await state()).dock, before.dock) && same(await stored(), before));
    check('Failed write gives visible feedback', /not saved|couldn.t save|tries again/i.test(await current.locator('#stage').innerText()));
    await current.evaluate(() => { window.__failWrites = false; }); await nav('ok');
    check('Retry commits through same action', !(await stored()).dock.includes('netflix'));
    await scene('home'); const old = await state(), oldStored = await stored();
    await current.evaluate(() => { window.__failWrites = true; }); await call('look', { bg: old.look.bg === 'light' ? 'dark' : 'light' });
    await current.waitForFunction(() => !ShoreQA.state().pending);
    check('Failed appearance write keeps display and preferences', (await state()).look.bg === old.look.bg && same(await stored(), oldStored));
  });
  await run('Appearance axes, fonts, scaling and matching materials', async () => {
    await page();
    for (const bg of ['dark', 'light', 'photo']) for (const layout of ['list', 'dock']) for (const focus of ['type', 'glass']) {
      await look({ bg, layout, focus }); const s = await state();
      check('Independent axes ' + [bg, layout, focus].join('/'), s.look.bg === bg && s.look.layout === layout && s.look.focus === focus && s.shown.bg === bg, s.look);
    }
    for (const axis of ['apps', 'controls']) for (const value of ['icons', 'both', 'text']) { await look({ [axis]: value }); check(axis + ' ' + value + ' persists', (await state()).look[axis] === value); }
    await look({ bg: 'photo', layout: 'dock', focus: 'glass', apps: 'both', controls: 'icons' });
    for (const material of ['soft', 'frost', 'tint']) { await look({ material }); check(material + ' matches displayed bundle', (await state()).shown.material === material && (await state()).look.material === material); }
    const fonts = (await state()).fonts.available; check('Font catalogue includes default', fonts.includes('manrope'));
    for (const font of fonts) {
      await look({ font }); check('Font ' + font + ' settles', (await state()).look.font === font && (await state()).shown.font === font);
      if (font === 'newsreader') {
        for (const layout of ['list', 'dock']) for (const controls of ['icons', 'both', 'text']) {
          await look({ layout, controls });
          const wrong = await current.evaluate(() => [...document.querySelectorAll('.home .clock, .home .u, .home .u-label, .home .ph-name, .home .tile .label, .home .app-focus-name, .home .util-focus-label, .home .wall-keep')].filter(e => !/Newsreader/.test(getComputedStyle(e).fontFamily)).map(e => ({ cls: e.className, font: getComputedStyle(e).fontFamily })));
          check('Newsreader covers Home text ' + layout + '/' + controls, wrong.length === 0, wrong);
        }
      }
    }
    await look({ font: 'manrope' });
    for (const wall of walls) { await look({ wall: wall.id }); check('Wallpaper ' + wall.id + ' has matching bundle', (await state()).shown.wall === wall.id && (await state()).wallpaper === wall.id); }
    for (const layout of ['list', 'dock']) for (const width of [1920, 1280]) {
      await current.setViewportSize({ width, height: width * 9 / 16 }); await look({ layout });
      await current.waitForFunction(w => Math.abs(document.getElementById('stage').getBoundingClientRect().width - w) < 1, width);
      const g = await current.evaluate(() => { const b = document.getElementById('stage').getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, focus: ShoreQA.where().focusCount }; });
      check(layout + ' fits ' + width + ' with one focus', Math.abs(g.x) < 1 && Math.abs(g.y) < 1 && Math.abs(g.width - width) < 1 && Math.abs(g.height - width * 9 / 16) < 1 && g.focus === 1, g);
      await current.screenshot({ path: out + 'production-' + layout + '-' + width + '.jpg', quality: 90 });
    }
    check('No live blur/backdrop filters', (await noLiveFilters()).length === 0, await noLiveFilters());
    check('No prototype lab controls in production', await current.evaluate(() => !document.querySelector('[data-lab], #lab, #side') && !document.querySelector('script[src*="prototype"]')));
    const before = (await state()).look; await current.reload(); await ready(); check('Appearance survives reload', same((await state()).look, before));
  });
  await run('Settings overview and visible choices', async () => {
    await page(); await scene('settings');
    const expected = ['settings.group.background', 'settings.group.layout', 'settings.group.typography', 'settings.group.focus', 'settings.group.clock', 'settings.group.picture', 'settings.editor', 'settings.group.tv'];
    check('Overview has all eight settings groups', same((await call('actions')).filter(a => a.startsWith('settings.')), expected), await call('actions'));
    await nav('right'); check('Right moves to the second column at the same row', (await state()).focusAction === 'settings.group.clock');
    await nav('down'); check('Down moves within the second column', (await state()).focusAction === 'settings.group.picture');
    await nav('left'); check('Left returns to the first column at the same row', (await state()).focusAction === 'settings.group.layout');
    await nav('down', 'down', 'down'); check('Down stops at the end of a column', (await state()).focusAction === 'settings.group.focus');
    await nav('right', 'down', 'down'); check('The second column ends at LG TV', (await state()).focusAction === 'settings.group.tv' && (await call('where')).focusCount === 1);
    const specs = {
      background: { bg: ['dark', 'light', 'photo'] },
      layout: { layout: ['list', 'dock'], apps: ['icons', 'both', 'text'], controls: ['icons', 'both', 'text'] },
      typography: { font: (await state()).fonts.available },
      focus: { focus: ['type', 'glass'], material: ['soft', 'frost', 'tint'] }
    };
    for (const [name, axes] of Object.entries(specs)) {
      await group(name);
      const options = await radios(), committed = (await state()).committed;
      for (const [axis, values] of Object.entries(axes)) {
        const rows = options.filter(r => r.action?.startsWith('choice.' + axis + '.'));
        check(name + ' shows every ' + axis + ' choice together', same(rows.map(r => r.action).sort(), values.map(v => 'choice.' + axis + '.' + v).sort()), rows);
        check(axis + ' checked state identifies only the applied choice', same(rows.filter(r => r.checked === 'true').map(r => r.action), ['choice.' + axis + '.' + committed[axis]]), rows);
      }
      check(name + ' detail has no persistent category rail', !(await call('actions')).some(a => a.startsWith('settings.group.')));
      await nav('back');
      check(name + ' Back restores overview category focus', (await state()).view === 'settings' && (await state()).focusAction === 'settings.group.' + name, await call('where'));
    }
    await group('background');
    const backgroundActions = await call('actions');
    check('Photo tools are reachable from Background', backgroundActions.includes('background.wallpaper') && backgroundActions.includes('background.rotation'), backgroundActions);
    await act('background.rotation');
    const rotationRows = await radios();
    check('All five rotation modes are visible together', same(rotationRows.map(r => r.action).sort(), ['fixed', 'open', '5', '15', '60'].map(v => 'rotation.' + v).sort()), rotationRows);
    await nav('back');
    check('Rotation Back restores its Background row', (await state()).settingsGroup === 'background' && (await state()).focusAction === 'background.rotation', await call('where'));
    await group('tv');
    const tvActions = await call('actions');
    check('LG TV group shows both native actions', tvActions.includes('tv.home') && tvActions.includes('tv.settings'));
  });
  await run('Settings focus never changes the applied Home', async () => {
    await page();
    for (const name of ['background', 'layout', 'typography', 'focus', 'clock', 'picture', 'tv']) {
      await group(name); const before = await settingsSnapshot();
      const visited = new Set();
      for (const direction of ['right', 'right', 'down', 'left', 'left', 'down', 'right', 'right', 'down', 'left', 'up', 'up', 'up', 'right']) {
        await nav(direction); visited.add((await state()).focusAction);
        const after = await settingsSnapshot();
        if (!same(after, before)) throw Error(name + ' navigation changed committed state, Home preview or storage: ' + JSON.stringify({ before, after }));
        if ((await call('where')).focusCount !== 1) throw Error(name + ' navigation did not keep one focus');
      }
      check(name + ' arrows browse choices without preview or storage writes', visited.size > 1, [...visited]);
      const firstRadio = (await radios())[0];
      if (firstRadio) {
        await current.locator('[data-action="' + firstRadio.action + '"]').hover();
        check(name + ' pointer hover does not apply a choice', same(await settingsSnapshot(), before));
      }
      await nav('back');
      check(name + ' Back cancels the unconfirmed choice', same(await settingsSnapshot(), before) && (await state()).focusAction === 'settings.group.' + name);
    }
    check('Browsing LG TV does not launch a native app', (await current.evaluate(() => __tv.calls.length)) === 0);
    await group('background'); await act('background.rotation'); const before = await settingsSnapshot();
    await nav('down', 'down', 'up', 'right', 'left');
    check('Rotation arrows do not save a mode', same(await settingsSnapshot(), before));
    await nav('back'); check('Unconfirmed Rotation choice is cancelled', same(await settingsSnapshot(), before) && (await state()).settingsGroup === 'background');
  });
  await run('Settings on-screen Back preserves choice focus', async () => {
    await page(); await group('layout'); const before = await settingsSnapshot();
    const candidate = await unselectedChoice();
    await act('settings.back');
    check('On-screen Back returns to the matching overview category', (await state()).view === 'settings' && (await state()).focusAction === 'settings.group.layout');
    check('On-screen Back keeps unconfirmed choice unapplied', same(await settingsSnapshot(), before));
    await act('settings.group.layout');
    check('Reopening restores the last real choice after on-screen Back', (await state()).focusAction === candidate.action, { expected: candidate.action, actual: (await state()).focusAction });
    await nav('back'); await act('settings.group.layout');
    check('Physical Back also preserves the last real choice', (await state()).focusAction === candidate.action);
  });
  await run('Settings OK applies explicit choices atomically', async () => {
    await page();
    const specs = [
      ['background', 'bg', ['dark', 'light', 'photo']],
      ['layout', 'layout', ['list', 'dock']],
      ['layout', 'apps', ['icons', 'text', 'both']],
      ['layout', 'controls', ['text', 'both', 'icons']],
      ['typography', 'font', (await state()).fonts.available],
      ['focus', 'focus', ['type', 'glass']],
      ['focus', 'material', ['frost', 'tint', 'soft']]
    ];
    for (const [name, axis, values] of specs) {
      await group(name);
      const selected = await settingsSnapshot(); await choice(axis, selected.committed[axis]); await ready();
      check(axis + ' OK on applied choice does not write again', same(await settingsSnapshot(), selected));
      for (const value of values) {
        const before = await settingsSnapshot(); await choice(axis, value); await ready();
        const after = await settingsSnapshot(), rows = await radios();
        const expectedWrites = before.writes + (before.committed[axis] === value ? 0 : 1);
        const untouched = { ...after.committed, [axis]: before.committed[axis] };
        const prefix = { bg: 'bg', layout: 'l', apps: 'a', controls: 'u', focus: 'f', material: 'm', font: 'font' }[axis];
        const shown = !Object.hasOwn(after.shown, axis) || after.shown[axis] === value;
        check(axis + ' OK applies ' + value + ' once', after.committed[axis] === value && shown && after.rendered.includes(prefix + '-' + value) && same(untouched, before.committed) && expectedWrites === after.writes && after.storageAttempts - before.storageAttempts === expectedWrites - before.writes && rows.some(r => r.action === 'choice.' + axis + '.' + value && r.checked === 'true'), { before, after, rows });
      }
      const applied = await settingsSnapshot(); await nav('back');
      check(axis + ' applied choice survives Back', same(await settingsSnapshot(), applied) && (await state()).focusAction === 'settings.group.' + name);
    }
    await group('background'); await act('background.rotation');
    const selected = await settingsSnapshot(); await act('rotation.' + selected.committed.mode);
    check('Rotation OK on applied mode does not write again', same(await settingsSnapshot(), selected));
    for (const value of ['open', '5', '15', '60', 'fixed']) {
      const before = await settingsSnapshot(); await act('rotation.' + value);
      check('Rotation OK applies ' + value + ' once', (await state()).mode === value && (await stored()).mode === value && (await state()).writes === before.writes + 1 && (await radios()).some(r => r.action === 'rotation.' + value && r.checked === 'true'));
    }
    await group('layout'); const before = await settingsSnapshot(), candidate = await unselectedChoice();
    const [, axis, value] = candidate.action.split('.');
    await current.keyboard.down('Enter'); await current.keyboard.down('Enter'); await ready();
    check('Held physical OK applies the focused choice once', (await state()).committed[axis] === value && (await state()).writes === before.writes + 1);
    await current.keyboard.up('Enter');
    await current.keyboard.down('Escape'); await current.keyboard.down('Escape');
    check('Held physical Back closes one settings layer', (await state()).view === 'settings' && (await state()).focusAction === 'settings.group.layout');
    await current.keyboard.up('Escape');
  });
  await run('Settings inactive Material retains its choice', async () => {
    await page(); await look({ material: 'tint' });
    for (const patch of [{ bg: 'dark' }, { bg: 'light' }, { bg: 'photo', layout: 'list', focus: 'type' }]) {
      await look(patch); await group('focus'); const before = await settingsSnapshot();
      const materials = (await radios()).filter(r => r.action.startsWith('choice.material.'));
      check('Material stays visible but inactive for ' + JSON.stringify(patch), materials.length === 3 && materials.every(r => r.disabled) && materials.some(r => r.action === 'choice.material.tint' && r.checked === 'true'), materials);
      const focusBefore = (await state()).focusAction;
      await current.locator('[data-action="choice.material.frost"]').click({ force: true });
      check('Inactive Material ignores pointer focus and application', same(await settingsSnapshot(), before) && (await state()).focusAction === focusBefore);
      await walkEnabledChoices();
      check('Remote navigation skips inactive Material', same(await settingsSnapshot(), before));
      const reason = await current.locator('.setting-reason:visible').allTextContents();
      check('Inactive Material has a visible explanation', reason.some(text => /material/i.test(text) && text.length > 20), reason);
    }
    await look({ bg: 'photo', layout: 'dock', focus: 'glass' }); await group('focus');
    const materials = (await radios()).filter(r => r.action.startsWith('choice.material.'));
    check('Applicable Material restores the remembered selection', materials.every(r => !r.disabled) && materials.some(r => r.action === 'choice.material.tint' && r.checked === 'true'));
  });
  await run('Settings inactive photo tools retain wallpaper preferences', async () => {
    await page();
    for (const bg of ['dark', 'light']) {
      await look({ bg }); await group('background'); const before = await settingsSnapshot();
      for (const action of ['background.wallpaper', 'background.rotation']) {
        check(bg + ' marks ' + action + ' inactive', await current.locator('[data-action="' + action + '"]').getAttribute('aria-disabled') === 'true');
        const focusBefore = (await state()).focusAction;
        await current.locator('[data-action="' + action + '"]').click({ force: true });
        check('Inactive ' + action + ' ignores pointer focus and keeps preferences', same(await settingsSnapshot(), before) && (await state()).settingsGroup === 'background' && (await state()).focusAction === focusBefore);
      }
      await walkEnabledChoices();
      check(bg + ' remote navigation skips inactive photo tools', same(await settingsSnapshot(), before));
      const reason = await current.locator('.setting-reason:visible').allTextContents();
      check(bg + ' explains how to enable photo tools', reason.some(text => /photo/i.test(text) && /wallpaper|rotation/i.test(text)), reason);
    }
  });
  await run('Settings normalises remembered inactive focus', async () => {
    await page(); await group('focus'); await choice('material', 'tint'); await ready();
    await nav('back'); await act('settings.group.background'); await choice('bg', 'dark'); await ready();
    await nav('back'); await act('settings.group.focus');
    const focus = await focusedChoice();
    check('Inactive remembered Material returns to an enabled focus choice', focus && !focus.disabled && focus.action.startsWith('choice.focus.'), focus);
    check('Changing Background preserves remembered Material', (await state()).look.material === 'tint');
    await look({ bg: 'photo' }); await group('background'); await act('background.rotation'); await act('rotation.fixed');
    await look({ bg: 'dark' }); const before = await settingsSnapshot();
    check('All-inactive Rotation restores its enabled Back action', (await state()).focusAction === 'settings.back');
    const visited = await walkEnabledChoices();
    check('All-inactive Rotation traps focus on its enabled Back action', visited.every(a => a === 'settings.back') && same(await settingsSnapshot(), before), visited);
    await current.locator('[data-action="rotation.5"]').click({ force: true });
    check('Inactive Rotation ignores pointer clicks', (await state()).focusAction === 'settings.back' && same(await settingsSnapshot(), before));
    await nav('back');
    const returned = await focusedChoice();
    check('Rotation Back skips its now-inactive Background row', (await state()).settingsGroup === 'background' && returned && !returned.disabled && returned.action.startsWith('choice.bg.'), returned);
  });
  await run('Settings Back cancels pending assets and late callbacks', async () => {
    await page(); await group('focus'); const before = await settingsSnapshot();
    const held = [], pattern = '**/*-field-frost.jpg';
    let releaseImages;
    const blocked = new Promise(resolve => { releaseImages = resolve; });
    await current.route(pattern, async route => { held.push(route.request().url()); await blocked; await route.continue(); });
    try {
      await choice('material', 'frost'); await current.waitForFunction(() => !!ShoreQA.state().pending);
      check('Pending choice keeps the committed Home and storage', same(await settingsSnapshot(), before));
      await nav('back'); await ready();
      check('Back cancels pending choice and restores category focus', same(await settingsSnapshot(), before) && (await state()).view === 'settings' && (await state()).focusAction === 'settings.group.focus');
      releaseImages();
      await current.waitForLoadState('networkidle');
      check('Late image completion cannot commit a cancelled choice', held.length > 0 && same(await settingsSnapshot(), before) && !(await state()).pending);
    } finally { releaseImages(); await current.unroute(pattern); }
  });
  await run('Settings Back cancels a delayed font choice', async () => {
    await page(); await group('typography'); const before = await settingsSnapshot();
    const held = [], pattern = '**/fonts/newsreader/*';
    let releaseFont;
    const blocked = new Promise(resolve => { releaseFont = resolve; });
    await current.route(pattern, async route => { held.push(route.request().url()); await blocked; await route.continue(); });
    try {
      await choice('font', 'newsreader'); await current.waitForFunction(() => !!ShoreQA.state().pending);
      check('Loading a font keeps applied typography and its checked choice', same(await settingsSnapshot(), before) && (await radios()).some(r => r.action === 'choice.font.manrope' && r.checked === 'true'));
      await nav('back'); await ready();
      check('Back cancels the font choice and restores Typography focus', same(await settingsSnapshot(), before) && (await state()).focusAction === 'settings.group.typography');
      releaseFont(); await current.waitForLoadState('networkidle');
      check('Late font completion cannot apply the cancelled choice', held.length > 0 && same(await settingsSnapshot(), before) && !(await state()).pending);
      await group('typography'); await choice('font', 'newsreader'); await ready();
      check('Cancelled font remains available for a fresh explicit apply', (await state()).look.font === 'newsreader' && (await state()).shown.font === 'newsreader' && (await state()).writes === before.writes + 1);
    } finally { releaseFont(); await current.unroute(pattern); }
  });
  await run('Settings choice failure and explicit retry', async () => {
    await page(); await group('focus'); const original = await settingsSnapshot();
    current.__expectedFailures.push('-field-frost.jpg');
    await current.route('**/*-field-frost.jpg', route => route.abort('failed'));
    await choice('material', 'frost'); await current.waitForFunction(() => !ShoreQA.state().pending);
    check('Failed image keeps the applied radio and Home', same(await settingsSnapshot(), original) && (await radios()).some(r => r.action === 'choice.material.soft' && r.checked === 'true'));
    check('Failed explicit choice exposes Retry', (await call('actions')).includes('settings.retry'));
    await current.unroute('**/*-field-frost.jpg'); await act('settings.retry'); await ready();
    check('Retry applies the same failed choice', (await state()).look.material === 'frost' && (await state()).shown.material === 'frost' && (await state()).writes === original.writes + 1);
    await group('background'); const before = await settingsSnapshot();
    await current.evaluate(() => { __failWrites = true; }); await choice('bg', 'light');
    await current.waitForFunction(() => !ShoreQA.state().pending);
    const failed = await settingsSnapshot();
    check('Failed choice write keeps the committed radio and preview', same(failed.committed, before.committed) && same(failed.shown, before.shown) && failed.stored === before.stored && failed.writes === before.writes && (await radios()).some(r => r.action === 'choice.bg.photo' && r.checked === 'true'));
    await current.evaluate(() => { __failWrites = false; }); await act('settings.retry'); await ready();
    check('Storage Retry applies once through the explicit choice', (await state()).look.bg === 'light' && (await state()).shown.bg === 'light' && (await state()).writes === before.writes + 1);
  });
  await run('Settings choices fit both target viewports', async () => {
    await page();
    for (const width of [1920, 1280]) {
      await current.setViewportSize({ width, height: width * 9 / 16 });
      await current.waitForFunction(w => Math.abs(document.getElementById('stage').getBoundingClientRect().width - w) < 1, width);
      for (const name of ['background', 'layout', 'typography', 'focus', 'clock', 'picture', 'tv', 'rotation']) {
        await group(name === 'rotation' ? 'background' : name);
        if (name === 'rotation') await act('background.rotation');
        const geometry = await current.evaluate(() => {
          const stage = document.getElementById('stage').getBoundingClientRect();
          const actions = ShoreQA.actions();
          return [...document.querySelectorAll('#stage [data-action]')].filter(e => actions.includes(e.getAttribute('data-action')) && e.getClientRects().length).map(e => {
            const r = e.getBoundingClientRect();
            const parts = [...e.querySelectorAll('.setting-name, .setting-tick svg')].map(part => part.getBoundingClientRect());
            const partsFit = parts.every(p => p.x >= r.x - 1 && p.y >= r.y - 1 && p.right <= r.right + 1 && p.bottom <= r.bottom + 1);
            const name = e.querySelector('.setting-name'), tick = e.querySelector('.setting-tick svg');
            const noOverlap = !name || !tick || name.getBoundingClientRect().right <= tick.getBoundingClientRect().left + 1;
            return { action: e.getAttribute('data-action'), inside: r.x >= stage.x - 1 && r.y >= stage.y - 1 && r.right <= stage.right + 1 && r.bottom <= stage.bottom + 1, fits: e.scrollWidth <= e.clientWidth + 1 && e.scrollHeight <= e.clientHeight + 1 && partsFit && noOverlap, width: r.width, height: r.height };
          });
        });
        check(name + ' choices fit ' + width + ' without clipping', geometry.length > 0 && geometry.every(g => g.inside && g.fits) && (await call('where')).focusCount === 1, geometry);
        await current.screenshot({ path: out + 'settings-' + name + '-' + width + '.jpg', quality: 90 });
      }
    }
    check('Settings retains pre-rendered materials without live blur', (await noLiveFilters()).length === 0, await noLiveFilters());
  });
  await run('Wallpaper failure, preview cancellation and lazy loading', async () => {
    await page();
    const resources = await current.evaluate(() => performance.getEntriesByType('resource').map(r => r.name));
    check('No wallpaper thumbnails loaded at startup', !resources.some(u => /-thumb\./.test(u)), resources.filter(u => /thumb/.test(u)));
    await wallpaper();
    const original = (await stored()).wallpaper;
    await nav('down'); await wallpaperSettled(walls[1].id);
    check('Preview leaves saved photo unchanged', (await stored()).wallpaper === original);
    await nav('back'); await ready(); check('Back restores committed photo', (await state()).shown.wall === original);
    check('Wallpaper Back returns to its Background row', (await state()).settingsGroup === 'background' && (await state()).focusAction === 'background.wallpaper');
    await scene('home'); const target = walls.find(w => w.id !== original && w.id !== walls[1].id).id;
    current.__expectedFailures.push('/' + target + '-');
    await current.route('**/*' + target + '-*.jpg', route => route.abort('failed'));
    const before = await stored(); await call('look', { wall: target });
    await current.waitForFunction(() => !ShoreQA.state().pending, null, { timeout: 15000 });
    check('Failed load keeps saved and displayed photo', same(await stored(), before) && (await state()).shown.wall === original);
    await current.unroute('**/*' + target + '-*.jpg'); await look({ wall: target });
    check('Material can recover after failure', (await state()).shown.wall === target);
  });
  await run('Wallpaper child keeps the Settings frame at both sizes', async () => {
    await page();
    for (const width of [1920, 1280]) for (const layout of ['list', 'dock']) {
      await scene('home'); await look({ layout });
      await current.setViewportSize({ width, height: width * 9 / 16 });
      await current.waitForFunction(w => Math.abs(document.getElementById('stage').getBoundingClientRect().width - w) < 1, width);
      await group('background'); const frame = await previewFrame(), before = await wallpaperSaved();
      await act('background.wallpaper');
      await current.waitForFunction(() => ShoreQA.state().view === 'wallpaper');
      const names = await current.locator('.wallpaper-choice .setting-name').allTextContents();
      check(layout + ' Wallpaper shows all fifteen named choices at ' + width, same(names, walls.map(w => w.name)), names);
      check('Wallpaper entry keeps the existing Home frame ' + layout + '/' + width, same(await previewFrame(), frame));
      const first = await wallpaperListGeometry();
      check('Wallpaper list shows about six rows with contained labels ' + layout + '/' + width, first.fullyVisible.length >= 5 && first.fullyVisible.length <= 6 && first.partlyVisible.length <= 7 && first.clippedParts.length === 0 && first.fullyVisible.includes(first.focus) && (await call('where')).focusCount === 1, first);
      await nav('down', 'down'); await wallpaperSettled(walls[2].id);
      check('Browsing preserves saved photo and Settings backdrop ' + layout + '/' + width, same(await wallpaperSaved(), before));
      check('Browsing stays in the same right Home frame ' + layout + '/' + width, same(await previewFrame(), frame));
      check('Applied tick stays separate from preview focus ' + layout + '/' + width, same(await wallpaperApplied(), ['wallpaper.choose.' + before.committed.wall]) && (await state()).focusAction === 'wallpaper.choose.' + walls[2].id && (await state()).shown.wall === walls[2].id && (await call('where')).focusCount === 1);
      await current.screenshot({ path: out + 'wallpaper-' + layout + '-' + width + '.jpg', quality: 90 });
      await nav('back'); await ready();
      check('Wallpaper Back restores its Background row ' + layout + '/' + width, (await state()).settingsGroup === 'background' && (await state()).focusAction === 'background.wallpaper' && (await state()).shown.wall === before.committed.wall && same(await previewFrame(), frame));
    }
  });
  await run('Wallpaper applies in place and Back keeps the latest applied photo', async () => {
    await page(); await wallpaper(); const before = await wallpaperSaved();
    check('Applied wallpaper omits the redundant Apply hint', !/apply.*photo/i.test(await current.locator('#appearanceDesc').innerText()));
    await nav('down'); await wallpaperSettled(walls[1].id);
    check('A browsed photo is not saved by focus', same(await wallpaperSaved(), before));
    check('Unsaved preview explains the OK action', /apply.*photo/i.test(await current.locator('#appearanceDesc').innerText()));
    await nav('ok'); await ready();
    const applied = await wallpaperSaved();
    check('OK applies once while staying inside Wallpaper', (await state()).view === 'wallpaper' && applied.committed.wall === walls[1].id && applied.writes === before.writes + 1 && applied.attempts === before.attempts + 1 && same(await wallpaperApplied(), ['wallpaper.choose.' + walls[1].id]));
    check('Successful apply clears its redundant Apply hint', !/apply.*photo/i.test(await current.locator('#appearanceDesc').innerText()));
    check('Applied photo updates the committed Settings backdrop', applied.backdrop.src.includes('/' + walls[1].id + '-panel.jpg'));
    await nav('ok'); await current.keyboard.down('Enter'); await current.keyboard.down('Enter'); await current.keyboard.up('Enter');
    check('Repeated OK on the applied photo is a no-op', same(await wallpaperSaved(), applied));
    await nav('down'); await wallpaperSettled(walls[2].id); await nav('back'); await ready();
    check('Back after apply restores the latest applied photo', (await state()).shown.wall === walls[1].id && same(await wallpaperSaved(), applied) && (await state()).focusAction === 'background.wallpaper');
    await act('background.wallpaper');
    check('Reopening starts at the applied photo', (await state()).focusAction === 'wallpaper.choose.' + walls[1].id && (await state()).wallpaperPicker.candidate === walls[1].id);
    await current.locator('[data-action="wallpaper.choose.' + walls[3].id + '"]').hover();
    check('Pointer hover focuses a photo without applying it', (await state()).focusAction === 'wallpaper.choose.' + walls[3].id && same(await wallpaperSaved(), applied) && (await call('where')).focusCount === 1);
    await wallpaperSettled(walls[3].id);
    check('A settled pointer hover previews like remote focus and saves nothing', same(await wallpaperSaved(), applied) && same(await wallpaperApplied(), ['wallpaper.choose.' + walls[1].id]));
    await current.locator('[data-action="wallpaper.choose.' + walls[3].id + '"]').click(); await ready();
    check('A pointer row click applies that photo once', (await state()).committed.wall === walls[3].id && (await state()).writes === applied.writes + 1 && (await state()).view === 'wallpaper');
    await act('wallpaper.back'); await ready();
    check('On-screen Wallpaper Back restores Background focus', (await state()).settingsGroup === 'background' && (await state()).focusAction === 'background.wallpaper' && (await state()).shown.wall === walls[3].id);
  });
  await run('Wallpaper navigation is bounded and scrolls the catalogue', async () => {
    await page(); await wallpaper(); const before = await wallpaperSaved();
    await nav('up');
    check('Up from the first wallpaper reaches Back without wrapping', (await state()).focusAction === 'wallpaper.back' && (await state()).shown.wall === walls[0].id);
    check('Back still shows its return hint', /background|return/i.test(await current.locator('#appearanceDesc').innerText()));
    await nav('down');
    check('Down from Back restores the current candidate', (await state()).focusAction === 'wallpaper.choose.' + walls[0].id);
    await nav(...Array(walls.length - 1).fill('down')); await wallpaperSettled(walls.at(-1).id); await wallpaperRowVisible(walls.at(-1).id);
    const end = await wallpaperListGeometry();
    check('Last wallpaper scrolls fully into view', end.fullyVisible.includes('wallpaper.choose.' + walls.at(-1).id) && end.top > 0 && end.clippedParts.length === 0, end);
    await nav('down', 'down');
    check('Down at the catalogue end does not wrap', (await state()).focusAction === 'wallpaper.choose.' + walls.at(-1).id && same(await wallpaperSaved(), before));
    await nav('left'); check('Left from a scrolled row reaches Back', (await state()).focusAction === 'wallpaper.back');
    await nav('right'); check('Right from Back restores the scrolled candidate', (await state()).focusAction === 'wallpaper.choose.' + walls.at(-1).id);
    const top = (await state()).wallpaperPicker.top;
    await nav(...Array(walls.length - 1 - top).fill('up')); await wallpaperSettled(walls[top].id);
    await nav('up'); await wallpaperSettled(walls[top - 1].id);
    check('Up from a scrolled top row continues the catalogue', (await state()).focusAction === 'wallpaper.choose.' + walls[top - 1].id && (await state()).view === 'wallpaper');
    await nav(...Array(top - 1).fill('up')); await wallpaperSettled(walls[0].id); await wallpaperRowVisible(walls[0].id);
    const start = await wallpaperListGeometry();
    check('Returning to the first wallpaper resets scrolling', start.top === 0 && start.fullyVisible.includes('wallpaper.choose.' + walls[0].id), start);
    await nav('up', 'up');
    check('Repeated Up stops at Back with no preference writes', (await state()).focusAction === 'wallpaper.back' && same(await wallpaperSaved(), before));
  });
  await run('Wallpaper rapid browsing debounces work and OK is never lost', async () => {
    await page(); await wallpaper(); const before = await wallpaperSaved();
    const immediate = await current.evaluate(() => {
      const at = performance.now(); ShoreQA.nav('down', 'down', 'down');
      return { at, action: ShoreQA.state().focusAction, shown: ShoreQA.state().shown.wall };
    });
    check('Rapid browsing updates row focus before loading the preview', immediate.action === 'wallpaper.choose.' + walls[3].id && immediate.shown === walls[0].id, immediate);
    await wallpaperSettled(walls[3].id);
    const resources = await current.evaluate(() => performance.getEntriesByType('resource').map(r => ({ name: r.name, start: r.startTime })));
    const latest = resources.find(r => r.name.endsWith('/wallpapers/' + walls[3].id + '.jpg'));
    check('Preview work waits for focus to settle', latest && latest.start - immediate.at >= 100, { delay: latest && latest.start - immediate.at });
    check('Fast skipped rows do not load their full wallpaper bundles', !resources.some(r => [walls[1].id, walls[2].id].some(id => r.name.endsWith('/wallpapers/' + id + '.jpg') || r.name.includes('/materials/' + id + '-'))));
    check('Debounced preview never saves from focus', same(await wallpaperSaved(), before));
    await nav('down', 'ok');
    await current.waitForFunction(id => ShoreQA.state().committed.wall === id && !ShoreQA.state().pending, walls[4].id);
    check('OK during focus debounce applies the current candidate once', (await state()).writes === before.writes + 1 && (await state()).shown.wall === walls[4].id && (await state()).view === 'wallpaper');
  });
  await run('Wallpaper newer previews cancel older queued applies', async () => {
    await page(); await wallpaper(); const before = await wallpaperSaved();
    const first = walls[1].id, latest = walls[2].id, pattern = '**/wallpapers/' + first + '.jpg', held = [];
    let release;
    const blocked = new Promise(resolve => { release = resolve; });
    await current.route(pattern, async route => { held.push(route.request().url()); await blocked; await route.continue(); });
    try {
      await nav('down'); await current.waitForFunction(id => ShoreQA.state().pending && ShoreQA.state().pending.target.wall === id, first);
      await nav('ok'); check('OK while loading records one explicit apply request', !!(await state()).wallpaperPicker.applyPending && same(await wallpaperSaved(), before));
      await nav('down'); await wallpaperSettled(latest);
      check('Browsing away cancels the queued apply', !(await state()).wallpaperPicker.applyPending && same(await wallpaperSaved(), before));
      check('Latest preview installs a matching photo and material bundle', Object.values(await wallpaperBundle()).every(src => src.includes('/' + latest)), await wallpaperBundle());
      release(); await current.waitForLoadState('networkidle');
      check('Older completion cannot overwrite or apply the latest preview', held.length > 0 && (await state()).shown.wall === latest && Object.values(await wallpaperBundle()).every(src => src.includes('/' + latest)) && same(await wallpaperSaved(), before));
      await nav('back'); await ready();
      check('Back restores the complete committed bundle after rapid browsing', Object.values(await wallpaperBundle()).every(src => src.includes('/' + before.committed.wall)));
    } finally { release(); await current.unroute(pattern); }
  });
  await run('Wallpaper Back cancels loading and queued applies', async () => {
    await page(); await wallpaper();
    await current.locator('[data-action="wallpaper.choose.' + walls[1].id + '"]').click(); await ready();
    const applied = await wallpaperSaved();
    for (const [index, back] of [[2, 'remote'], [3, 'pointer']]) {
      if ((await state()).view !== 'wallpaper') await act('background.wallpaper');
      const target = walls[index].id, pattern = '**/wallpapers/' + target + '.jpg', held = [];
      let release;
      const blocked = new Promise(resolve => { release = resolve; });
      await current.route(pattern, async route => { held.push(route.request().url()); await blocked; await route.continue(); });
      try {
        await act('wallpaper.choose.' + target);
        await current.waitForFunction(() => !!ShoreQA.state().pending && !!ShoreQA.state().wallpaperPicker.applyPending);
        if (back === 'remote') await nav('back'); else await current.locator('[data-action="wallpaper.back"]').click();
        await ready();
        check(back + ' Back cancels pending apply and returns to Wallpaper row', (await state()).focusAction === 'background.wallpaper' && (await state()).shown.wall === applied.committed.wall && same(await wallpaperSaved(), applied));
        release(); await current.waitForLoadState('networkidle');
        check(back + ' Back ignores late completion and keeps latest applied photo', held.length > 0 && (await state()).shown.wall === applied.committed.wall && same(await wallpaperSaved(), applied));
      } finally { release(); await current.unroute(pattern); }
    }
  });
  await run('Wallpaper preview failure restores committed photo and retries preview only', async () => {
    await page(); await wallpaper(); const before = await wallpaperSaved();
    await nav('down'); await wallpaperSettled(walls[1].id);
    const target = walls[2].id, pattern = '**/wallpapers/' + target + '.jpg';
    current.__expectedFailures.push('/wallpapers/' + target + '.jpg');
    await current.route(pattern, route => route.abort('failed'));
    await nav('down'); await current.waitForFunction(() => ShoreQA.actions().includes('wallpaper.retry'));
    check('Failed browse restores the committed frame rather than another unsaved preview', (await state()).shown.wall === before.committed.wall && same(await wallpaperSaved(), before) && same(await wallpaperApplied(), ['wallpaper.choose.' + before.committed.wall]));
    check('Failed candidate remains identified for retry', (await state()).wallpaperPicker.candidate === target && /couldn.t|failed|try again/i.test(await current.locator('#appearance').innerText()));
    await current.unroute(pattern); await act('wallpaper.retry'); await wallpaperSettled(target);
    check('Retrying a failed browse does not authorise a save', same(await wallpaperSaved(), before) && !(await state()).wallpaperPicker.applyPending);
    check('Successful preview Retry returns focus to its candidate', (await state()).focusAction === 'wallpaper.choose.' + target);
    await nav('ok'); await ready();
    check('Explicit OK can apply the recovered preview', (await state()).committed.wall === target && (await state()).writes === before.writes + 1);
  });
  await run('Wallpaper explicit apply and storage failures preserve applied state', async () => {
    await page(); await wallpaper(); const before = await wallpaperSaved();
    const target = walls[2].id, pattern = '**/wallpapers/' + target + '.jpg';
    current.__expectedFailures.push('/wallpapers/' + target + '.jpg');
    await current.route(pattern, route => route.abort('failed'));
    await act('wallpaper.choose.' + target); await current.waitForFunction(() => ShoreQA.actions().includes('wallpaper.retry'));
    check('Failed explicit apply changes no committed photo, tick or storage', same(await wallpaperSaved(), before) && same(await wallpaperApplied(), ['wallpaper.choose.' + before.committed.wall]));
    await current.unroute(pattern); await act('wallpaper.retry'); await ready();
    check('Retry preserves explicit apply intent and stays in the picker', (await state()).committed.wall === target && (await state()).writes === before.writes + 1 && (await state()).view === 'wallpaper');
    const applied = await wallpaperSaved(), requests = [];
    current.on('request', request => { if (request.url().endsWith('/wallpapers/' + walls[3].id + '.jpg') || request.url().includes('/materials/' + walls[3].id + '-')) requests.push(request.url()); });
    await nav('down'); await wallpaperSettled(walls[3].id);
    const loadedRequests = requests.length;
    await current.evaluate(() => { __failWrites = true; }); await nav('ok');
    await current.waitForFunction(() => ShoreQA.actions().includes('wallpaper.retry'));
    const failed = await wallpaperSaved();
    check('Failed wallpaper save preserves applied photo, tick and backdrop', failed.stored === applied.stored && same(failed.committed, applied.committed) && same(failed.backdrop, applied.backdrop) && failed.writes === applied.writes && same(await wallpaperApplied(), ['wallpaper.choose.' + target]));
    check('Storage failure restores the committed frame and names the failed candidate', (await state()).shown.wall === target && Object.values(await wallpaperBundle()).every(src => src.includes('/' + target)) && (await state()).wallpaperPicker.candidate === walls[3].id && (await current.locator('#appearance').innerText()).includes(walls[3].name));
    await current.evaluate(() => { __failWrites = false; }); await act('wallpaper.retry'); await ready();
    check('Storage Retry applies the candidate exactly once', (await state()).committed.wall === walls[3].id && (await state()).writes === applied.writes + 1 && (await state()).view === 'wallpaper');
    check('Storage Retry reuses the already-loaded wallpaper bundle', loadedRequests > 0 && requests.length === loadedRequests, requests);
  });
  await run('Wallpaper thumbnails fail without breaking the list or full photo', async () => {
    await page(); const target = walls[5], pattern = '**/wallpapers/' + target.id + '-thumb.jpg';
    current.__expectedFailures.push('/wallpapers/' + target.id + '-thumb.jpg');
    await current.route(pattern, route => route.abort('failed'));
    await wallpaper();
    await current.waitForFunction(id => {
      const slot = document.querySelector('[data-action="wallpaper.choose.' + id + '"] .wallpaper-thumb');
      return slot && slot.classList.contains('is-missing');
    }, target.id);
    await nav(...Array(5).fill('down')); await wallpaperSettled(target.id);
    const fallback = await current.evaluate(id => {
      const row = document.querySelector('[data-action="wallpaper.choose.' + id + '"]'), slot = row.querySelector('.wallpaper-thumb'), img = slot.querySelector('img');
      const r = row.getBoundingClientRect(), b = slot.getBoundingClientRect();
      return { name: row.textContent, slotVisible: getComputedStyle(slot).display !== 'none' && b.width > 0 && b.height > 0,
        ratio: b.width / b.height, inside: b.left >= r.left && b.right <= r.right && b.top >= r.top && b.bottom <= r.bottom,
        imageHidden: !img || getComputedStyle(img).display === 'none' || getComputedStyle(img).visibility === 'hidden' };
    }, target.id);
    check('Broken thumbnail keeps its named 16:9 slot without a broken image glyph', fallback.name.includes(target.name) && fallback.slotVisible && fallback.inside && Math.abs(fallback.ratio - 16 / 9) < 0.05 && fallback.imageHidden, fallback);
    await nav('ok'); await ready();
    check('A missing thumbnail does not prevent applying its full photo', (await state()).committed.wall === target.id && Object.values(await wallpaperBundle()).every(src => src.includes('/' + target.id)));
  });
  await run('Physical-key repeats and Back hierarchy', async () => {
    await page(); await editor(); await remove('netflix');
    await current.keyboard.down('Enter'); await current.keyboard.down('Enter');
    check('Held OK restores once without removing again', (await state()).dock.includes('netflix') && (await state()).dock.length === PRIMARY.length);
    await current.keyboard.up('Enter');
    await current.keyboard.down('Escape'); await current.keyboard.down('Escape');
    check('Held Back closes one layer only', (await call('where')).view === 'settings' && (await state()).focusAction === 'settings.editor');
    await current.keyboard.up('Escape'); await current.keyboard.press('Escape');
    check('Released Back reaches Home', (await call('where')).view === 'home');
  });
  await run('Rotation pauses and warm return', async () => {
    await page({ minuteMs: 120 });
    await group('background'); await act('background.rotation'); await act('rotation.5'); await scene('home');
    const first = (await state()).wallpaper;
    await current.waitForFunction(id => ShoreQA.state().wallpaper !== id, first, { timeout: 4000 });
    check('Timed rotation advances on photo Home', (await state()).mode === '5');
    await scene('settings'); const paused = (await state()).wallpaper; await current.waitForTimeout(850);
    check('Rotation pauses in settings', (await state()).wallpaper === paused);
    await scene('home'); await current.evaluate(() => __setHidden(true)); const hidden = (await state()).wallpaper; await current.waitForTimeout(850);
    check('Rotation pauses when hidden', (await state()).wallpaper === hidden);
    await current.evaluate(() => __setHidden(false));
    await current.waitForFunction(id => ShoreQA.state().wallpaper !== id, hidden, { timeout: 4000 });
    await look({ bg: 'dark' }); const flat = (await state()).wallpaper; await current.waitForTimeout(850);
    check('Flat background retains photo without rotation', (await state()).wallpaper === flat);
    await look({ bg: 'photo', layout: 'list' }); const photoList = (await state()).wallpaper;
    await current.waitForFunction(id => ShoreQA.state().wallpaper !== id, photoList, { timeout: 4000 });
    check('Photo List rotates too', (await state()).look.layout === 'list');
    await current.evaluate(() => { __setHidden(true); document.getElementById('stage').blur(); __setHidden(false); window.dispatchEvent(new Event('focus')); });
    const focus = (await state()).focusAction; await current.keyboard.press('ArrowDown');
    check('Warm return restores remote focus', (await state()).focusAction !== focus && (await call('where')).focusCount === 1);
    const clock = await current.locator('#caption .clock').textContent();
    check('Live 12-hour clock has no AM/PM', /^\s*\d{1,2}:\d{2}\s*$/.test(clock), clock);
  });
  await run('Open rotation and browser fallback', async () => {
    await page({ seed: baseline({ mode: 'open' }) }); check('Open mode advances at cold start', (await state()).wallpaper === walls[1].id);
    const first = (await state()).wallpaper;
    await current.evaluate(() => window.dispatchEvent(new Event('focus')));
    check('Window focus alone does not repeat open rotation', (await state()).wallpaper === first);
    await current.reload(); await ready(); check('Next cold start advances again', (await state()).wallpaper === walls[2].id);
    await closePage();
    await page({ mock: false }); await act('home.app.netflix'); await current.waitForFunction(() => ShoreQA.where().view === 'message');
    check('Browser launch honestly requires TV', /TV/.test(await current.locator('#stage').innerText()));
    await nav('back'); await library();
    check('Browser All Apps has no installed fixtures', /TV/.test(await current.locator('#stage').innerText()) && !(await current.locator('[data-action^="apps.open."]').count()));
  });
  await run('Return to the running launcher advances open rotation', async () => {
    await page({ seed: baseline({ mode: 'open' }) });
    const cold = await state();
    check('Open mode advances once at cold start', cold.wallpaper === walls[1].id, cold.wallpaper);
    await current.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('webOSRelaunch')); });
    check('Focus or relaunch without being hidden does not advance', (await state()).wallpaper === walls[1].id && (await state()).writes === cold.writes);
    await current.evaluate(() => { __setHidden(true); document.dispatchEvent(new Event('webOSRelaunch')); __setHidden(false); document.dispatchEvent(new Event('webOSRelaunch')); });
    await ready();
    const back = await state();
    check('Showing the launcher after it was hidden advances exactly once', back.wallpaper === walls[2].id && back.shown.wall === walls[2].id && (await stored()).wallpaper === walls[2].id && back.writes === cold.writes + 1, { wallpaper: back.wallpaper, writes: back.writes });
    const target = walls[3].id;
    current.__expectedFailures.push('/' + target + '-', '/wallpapers/' + target + '.jpg');
    await current.route('**/*' + target + '*.jpg', route => route.abort('failed'));
    await current.evaluate(() => { __setHidden(true); __setHidden(false); });
    await current.waitForFunction(() => !ShoreQA.state().pending);
    check('A photo that fails to load keeps the shown and saved photo', (await state()).shown.wall === walls[2].id && (await stored()).wallpaper === walls[2].id);
    await current.unroute('**/*' + target + '*.jpg');
    await group('background'); await act('background.rotation'); await act('rotation.fixed'); await scene('home');
    await current.evaluate(() => { __setHidden(true); __setHidden(false); }); await ready();
    check('Fixed mode does not advance on return', (await state()).wallpaper === walls[2].id);
    await group('background'); await act('background.rotation'); await act('rotation.open'); await look({ bg: 'dark' }); await scene('home');
    await current.evaluate(() => { __setHidden(true); __setHidden(false); }); await ready();
    check('A flat background does not advance on return', (await state()).wallpaper === walls[2].id);
  });
  await run('Last Home app is saved after a successful launch', async () => {
    await page();
    await current.evaluate(() => { __tv.launchFailure = true; });
    await act('home.app.youtube'); await current.waitForFunction(() => ShoreQA.where().view === 'message');
    check('A failed launch keeps the saved last app', (await stored()).lastApp === 'netflix' && (await state()).selected === 'youtube');
    await nav('back'); await current.evaluate(() => { window.dispatchEvent(new Event('focus')); __tv.launchFailure = false; });
    await act('home.app.youtube'); await current.waitForFunction(() => __tv.calls.length === 2);
    await current.waitForFunction(() => JSON.parse(localStorage.getItem('cleanframe.home.v1')).lastApp === 'youtube');
    check('A successful launch saves the last app', (await state()).lastApp === 'youtube');
    await current.evaluate(() => window.dispatchEvent(new Event('focus')));
    await current.reload(); await ready();
    check('The launched app is selected after a restart', (await state()).selected === 'youtube');
  });
  await run('Catalogue Try again asks for a fresh list', async () => {
    await page({ catalogFailure: true }); await library();
    check('Opening All apps may use the session catalogue', !(await current.evaluate(() => __tv.appsOptions.at(-1)))?.fresh);
    await current.evaluate(() => { __tv.catalogFailure = false; }); await act('apps.retry');
    await current.waitForSelector('[data-action="apps.open.' + EXTRA + '"]');
    check('Try again bypasses the session catalogue', (await current.evaluate(() => __tv.appsOptions.at(-1)))?.fresh === true);
    await nav('back'); await library();
    check('Reopening All apps does not force a fresh list', !(await current.evaluate(() => __tv.appsOptions.at(-1)))?.fresh);
  });
  await run('Magic Remote pointer moves focus without OK', async () => {
    await page(); const before = await stored();
    const hover = async action => { await current.locator('[data-action="' + action + '"] >> visible=true').hover(); return call('where'); };
    let where = await hover('home.app.primevideo');
    check('Dock tile hover selects the app', where.focusAction === 'home.app.primevideo' && (await state()).selected === 'primevideo' && where.focusCount === 1, where);
    where = await hover('util.settings');
    check('Home control hover focuses the control', where.focusAction === 'util.settings' && where.focusCount === 1, where);
    const mutations = await current.evaluate(() => new Promise(resolve => {
      const stage = document.getElementById('stage'), el = stage.querySelector('[data-action="util.settings"]'), r = el.getBoundingClientRect();
      let count = 0; const observer = new MutationObserver(list => { count += list.length; });
      observer.observe(stage, { subtree: true, attributes: true, childList: true, characterData: true });
      el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, screenX: r.left + 3, screenY: r.top + 3, clientX: r.left + 3, clientY: r.top + 3 }));
      requestAnimationFrame(() => { observer.disconnect(); resolve(count); });
    }));
    check('Moving within the focused control does not re-render', mutations === 0, mutations);
    await current.keyboard.press('ArrowDown');
    check('Remote keys continue from pointer focus', (await state()).focusAction === 'home.app.primevideo');
    await current.keyboard.press('ArrowRight');
    check('A resting pointer does not take focus back from the remote', (await state()).focusAction === 'home.app.disneyplus' && (await call('where')).focusCount === 1);
    await look({ layout: 'list' }); where = await hover('home.app.youtube');
    check('List row hover selects the app', where.focusAction === 'home.app.youtube' && (await state()).selected === 'youtube' && where.focusCount === 1, where);
    check('Hover neither launches nor saves', (await current.evaluate(() => __tv.calls.length)) === 0 && (await stored()).lastApp === before.lastApp);
    await library();
    where = await hover('apps.open.' + BROWSER);
    check('All apps tile hover focuses the tile', where.focusAction === 'apps.open.' + BROWSER && where.focusCount === 1, where);
    where = await hover('apps.editor');
    check('All apps tab hover focuses the tab without opening it', where.focusAction === 'apps.editor' && where.view === 'apps' && where.focusCount === 1, where);
    await editor();
    where = await hover('editor.remove.youtube');
    check('Editor Remove hover focuses without removing', where.focusAction === 'editor.remove.youtube' && (await state()).dock.includes('youtube') && where.focusCount === 1, where);
    where = await hover('editor.done');
    check('Editor header hover focuses Done', where.focusAction === 'editor.done' && where.view === 'editor', where);
    await act('editor.move.netflix'); where = await hover('editor.move.youtube');
    check('Hover is ignored while an app is lifted', where.focusAction === 'editor.move.netflix' && (await state()).draft?.id === 'netflix', where);
    await nav('back');
    await scene('settings'); where = await hover('settings.group.layout');
    check('Settings row hover focuses the group', where.focusAction === 'settings.group.layout' && where.view === 'settings', where);
    await group('layout'); const snapshot = await settingsSnapshot(); const radio = (await radios()).find(r => r.checked === 'false' && !r.disabled);
    where = await hover(radio.action);
    check('Appearance choice hover focuses without applying', where.focusAction === radio.action && same(await settingsSnapshot(), snapshot) && where.focusCount === 1, where);
    await scene('home'); await nav('back'); where = await hover('message.tvhome');
    check('Message button hover focuses without opening', where.focusAction === 'message.tvhome' && where.view === 'message' && (await current.evaluate(() => __tv.calls.length)) === 0, where);
    await current.locator('[data-action="message.stay"]').click();
    check('A pointer click still activates', (await call('where')).view === 'home');
  });
  await run('Wheel steps through the focused list', async () => {
    await page();
    const wheel = (deltaY, times = 1) => current.evaluate(([d, n]) => { for (let i = 0; i < n; i++) document.getElementById('stage').dispatchEvent(new WheelEvent('wheel', { deltaY: d, bubbles: true, cancelable: true })); }, [deltaY, times]);
    await wheel(120, 6);
    check('A wheel flick moves the Dock one app', (await state()).selected === 'youtube', (await state()).selected);
    await current.waitForTimeout(160); await wheel(-120);
    check('Wheel up moves back along the Dock', (await state()).selected === 'netflix');
    await look({ layout: 'list' }); await current.waitForTimeout(160); await wheel(120);
    check('Wheel down moves down the List', (await state()).selected === 'youtube');
    // On a first visit the catalogue is still loading, so focus starts on the page tab.
    await library(); if ((await call('where')).zone === 'head') await nav('down');
    await current.waitForTimeout(160); await wheel(120);
    const tiles = await current.evaluate(() => [...document.querySelectorAll('[data-action^="apps.open."]')].map(e => e.getAttribute('data-action')));
    check('Wheel down moves down a row in All apps', (await call('where')).focusAction === tiles[5] && (await call('where')).focusCount === 1, { where: await call('where'), tiles });
  });
  await run('Remote Channel, number and colour keys', async () => {
    const nine = PRIMARY.concat(['com.apple.appletv', 'com.apple.applemusic', 'tv.twitch.tv.starshot.lg', BROWSER, EXTRA]);
    await page({ seed: baseline({ dock: nine }) });
    await current.keyboard.press('PageDown');
    check('Channel Down moves five Home apps', (await state()).selected === nine[5], (await state()).selected);
    await current.keyboard.press('PageDown');
    check('Channel Down stops at the last Home app', (await state()).selected === nine[8]);
    await current.keyboard.press('PageUp'); await current.keyboard.press('PageUp');
    check('Channel Up stops at the first Home app', (await state()).selected === nine[0] && (await call('where')).zone === 'apps');
    await look({ layout: 'list' }); await current.keyboard.press('PageDown');
    check('Channel Down pages the List too', (await state()).selected === nine[5]);
    await closePage();
    const key = code => current.evaluate(c => { const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true }); Object.defineProperty(e, 'keyCode', { get: () => c }); document.dispatchEvent(e); document.dispatchEvent(Object.defineProperty(new KeyboardEvent('keyup', { bubbles: true }), 'keyCode', { get: () => c })); }, code);
    const settle = () => current.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page();
    await current.keyboard.press('Digit3'); await current.waitForFunction(() => __tv.calls.length === 1);
    check('Number 3 focuses and opens the third Home app', (await current.evaluate(() => __tv.calls[0].id)) === IDS[2] && (await state()).selected === PRIMARY[2] && (await call('where')).zone === 'apps');
    await settle(); await key(98); await current.waitForFunction(() => __tv.calls.length === 2);
    check('Number pad keys open Home apps too', (await current.evaluate(() => __tv.calls[1].id)) === IDS[1]);
    await settle(); await current.keyboard.press('Digit9'); await current.waitForTimeout(100);
    check('A number without a Home app does nothing', (await current.evaluate(() => __tv.calls.length)) === 2 && (await state()).selected === PRIMARY[1]);
    await current.keyboard.down('Digit1'); await current.waitForFunction(() => __tv.calls.length === 3); await settle();
    await current.keyboard.down('Digit1'); await current.waitForTimeout(100); await current.keyboard.up('Digit1');
    check('A held number key opens once', (await current.evaluate(() => __tv.calls.length)) === 3);
    await settle(); await key(403);
    check('Red opens All apps', (await call('where')).view === 'apps');
    await key(406); await key(49);
    check('Colour and number keys are ignored in panels', (await call('where')).view === 'apps' && (await current.evaluate(() => __tv.calls.length)) === 3);
    await key(10009);
    check('Tizen Back (10009) is not a webOS key', (await call('where')).view === 'apps');
    await key(461);
    check('LG Back (461) closes the panel', (await call('where')).view === 'home');
    await key(404); await current.waitForFunction(() => __tv.calls.length === 4);
    check('Green opens Live TV', (await current.evaluate(() => __tv.calls.at(-1).id)) === 'com.webos.app.livetv');
    await settle(); await key(405);
    check('Yellow opens Apps on Home', (await call('where')).view === 'editor');
    await key(461); await key(406);
    check('Blue opens Settings', (await call('where')).view === 'settings');
    await library(); await current.keyboard.press('PageDown');
    const tiles = await current.evaluate(() => [...document.querySelectorAll('[data-action^="apps.open."]')].map(e => e.getAttribute('data-action')));
    const rowsDown = Math.min(3, Math.ceil(tiles.length / 5) - 1);
    check('Channel Down moves up to three rows in All apps', rowsDown > 0 && (await state()).focusAction === tiles[Math.min(rowsDown * 5, tiles.length - 1)], { focus: (await state()).focusAction, tiles });
    await current.keyboard.press('PageUp');
    check('Channel Up stops at the first row in All apps', (await state()).focusAction === tiles[0] && (await call('where')).zone === 'grid');
    await editor(); await nav('right', 'right');
    const others = await current.evaluate(() => [...document.querySelectorAll('[data-action^="editor.add."]')].map(e => e.getAttribute('data-action')));
    await current.keyboard.press('PageDown');
    check('Channel Down pages the editor list', (await state()).focusAction === others[Math.min(others.length - 1, 9)], { focus: (await state()).focusAction, others });
    await current.keyboard.press('PageUp');
    check('Channel Up stops at the first editor row', (await state()).focusAction === others[0] && (await call('where')).zone === 'other');
    await wallpaper(); await current.keyboard.press('PageDown'); await wallpaperSettled(walls[6].id);
    check('Channel Down pages the wallpaper list', (await state()).focusAction === 'wallpaper.choose.' + walls[6].id && (await state()).committed.wall === walls[0].id);
    await current.keyboard.press('PageUp'); await wallpaperSettled(walls[0].id);
    check('Channel Up returns to the first wallpaper', (await state()).focusAction === 'wallpaper.choose.' + walls[0].id);
  });
  await run('New preferences default safely and old preferences load unchanged', async () => {
    const legacy = baseline({ dock: ['youtube', 'netflix'], wallpaper: walls[3].id, lastApp: 'youtube', mode: '15' });
    await page({ seed: legacy });
    let s = await state();
    check('Legacy preferences keep their fields', same(s.dock, ['youtube', 'netflix']) && s.wallpaper === walls[3].id && s.mode === '15' && s.lastApp === 'youtube', s);
    check('Legacy preferences get the new defaults', s.clock === '12' && s.date === 'off' && s.idle === 'off' && s.shift === 'off' && same(s.inputNames, {}), s);
    check('Defaults are written with the next save', (await stored()).clock === '12' && same((await stored()).inputNames, {}));
    await closePage();
    // A 0.6.1 save: version 2 with an appearance object and no new fields.
    const look = { bg: 'dark', wall: walls[2].id, layout: 'list', apps: 'text', font: 'manrope', controls: 'icons', focus: 'type', material: 'frost' };
    const old = { bg: look.bg, wall: look.wall, layout: look.layout, apps: look.apps, font: look.font, controls: look.controls, focus: look.focus, material: look.material,
      home: ['primevideo', 'netflix'], recent: ['youtube'], lastApp: 'primevideo', mode: '60', version: 2, look, dock: ['primevideo', 'netflix'], wallpaper: walls[2].id, theme: 'list', appRecords: [] };
    await page({ seed: old });
    s = await state();
    check('A 0.6.1 save loads identically', same(s.look, look) && same(s.home, old.home) && same(s.recent, old.recent) && s.lastApp === old.lastApp && s.mode === old.mode, s);
    check('A 0.6.1 save gets the new defaults', s.clock === '12' && s.date === 'off' && s.idle === 'off' && s.shift === 'off' && same(s.inputNames, {}));
    check('Defaults leave the 12-hour clock without a date', /^\s*\d{1,2}:\d{2}\s*$/.test(await current.locator('#caption .clock').textContent()) && !(await current.locator('#caption .clock-date').count()));
    await closePage();
    await page({ seed: baseline({ clock: '25', date: 1, idle: '7', shift: 'yes', inputNames: { 'com.webos.app.hdmi1': 'Hacker <b>', 'com.webos.app.hdmi2': 'Xbox', 'bad id!': 'PC', ['__proto__']: 'PC', constructor: 'PC' } }) });
    s = await state();
    check('Invalid new values fall back to defaults', s.clock === '12' && s.date === 'off' && s.idle === 'off' && s.shift === 'off', s);
    check('Only preset input names for safe IDs survive', same(s.inputNames, { 'com.webos.app.hdmi2': 'Xbox' }) && same((await stored()).inputNames, { 'com.webos.app.hdmi2': 'Xbox' }), s.inputNames);
    await closePage();
    await page({ seed: baseline({ clock: '24', date: 'on', idle: '15', shift: 'on', inputNames: ['Xbox'] }) });
    s = await state();
    check('Valid new values load', s.clock === '24' && s.date === 'on' && s.idle === '15' && s.shift === 'on' && same(s.inputNames, {}), s);
  });
  await run('Clock format and date', async () => {
    const expected = () => current.evaluate(() => { const d = new Date(), h = d.getHours(), m = d.getMinutes(); return { h24: (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m, date: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ' ' + d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] }; });
    await page({ seed: baseline({ dock: [EXTRA, 'netflix'], lastApp: EXTRA, appRecords: [{ id: EXTRA, appId: EXTRA, name: UNSAFE_NAME + ' and More', brand: '', icon: '' }] }) });
    await group('clock');
    check('Clock group opens on the applied format', (await state()).focusAction === 'choice.clock.12');
    await act('choice.clock.24');
    let e = await expected(), clock = (await current.locator('#caption .clock').textContent()).trim();
    check('24-hour clock is zero-padded', /^\d{2}:\d{2}$/.test(clock) && (clock === e.h24 || clock.slice(0, 2) === e.h24.slice(0, 2)), { clock, e });
    check('24-hour format is saved', (await stored()).clock === '24');
    await act('choice.date.on');
    e = await expected();
    check('Date line reads like Tue 21 Oct', (await current.locator('#caption .clock-date').textContent()) === e.date, await current.locator('#caption .clock-date').textContent());
    check('Date is saved', (await stored()).date === 'on');
    await nav('back');
    check('Overview summarises the clock', /24-hour, with date/.test(await current.locator('[data-action="settings.group.clock"]').innerText()) && (await state()).focusAction === 'settings.group.clock');
    await act('settings.group.clock');
    check('Clock group restores its last choice', (await state()).focusAction === 'choice.date.on');
    const caption = () => current.evaluate(() => {
      const st = document.getElementById('stage').getBoundingClientRect(), k = st.width / 1920, box = e => { const r = e.getBoundingClientRect(); return { top: (r.top - st.top) / k, bottom: (r.bottom - st.top) / k, left: (r.left - st.left) / k, right: (r.right - st.left) / k }; };
      const q = s => document.querySelector('#caption ' + s), digits = document.querySelectorAll('#caption .clock-digit').length;
      return { clock: box(q('.clock')), date: box(q('.clock-date')), full: q('.full-name') ? box(q('.full-name')) : null, digits, cell: getComputedStyle(document.getElementById('home')).getPropertyValue('--font-clock-digit').trim() };
    });
    for (const font of (await state()).fonts.available) for (const layout of ['list', 'dock']) {
      await scene('home'); await look({ font, layout });
      const g = await caption();
      check('Clock and date stack without overlap ' + font + '/' + layout, g.clock.bottom <= g.date.top + 1 && (!g.full || g.date.bottom <= g.full.top + 1) && (g.cell === '0.00px' ? g.digits === 0 : g.digits === 4), g);
      if (layout === 'list') check('List full name stays above the first row with a date ' + font, g.full && g.full.bottom <= 221, g);
    }
    await current.reload(); await ready();
    check('Clock options survive reload', (await state()).clock === '24' && (await current.locator('#caption .clock-date').count()) === 1);
  });
  await run('Picture mode starts and returns', async () => {
    await page();
    const pictureShown = () => current.evaluate(() => ({ view: ShoreQA.state().view, home: getComputedStyle(document.getElementById('home')).visibility, caption: getComputedStyle(document.getElementById('caption')).visibility,
      bg: getComputedStyle(document.getElementById('bg')).display, photo: document.getElementById('photo').getAttribute('src') || '', focus: ShoreQA.where().focusCount, sheet: document.getElementById('sheet').hidden }));
    await nav('right'); const homeFocus = (await state()).focusAction, sel = (await state()).selected;
    await group('picture');
    check('Picture group opens on Start now', (await state()).focusAction === 'picture.start');
    await act('picture.start');
    let p = await pictureShown();
    check('Start now shows the photo alone with the clock', p.view === 'picture' && p.home === 'hidden' && p.caption === 'visible' && p.bg === 'block' && p.photo.includes(walls[0].id) && p.focus === 0 && p.sheet, p);
    await nav('right');
    check('Any key returns to Home with the previous focus and does not act', (await call('where')).view === 'home' && (await state()).focusAction === homeFocus && (await state()).selected === sel, await call('where'));
    await scene('settings');
    check('Settings remembers the Picture group', (await state()).focusAction === 'settings.group.picture');
    await scene('home');
    await current.keyboard.press('Digit0');
    check('Key 0 starts Picture mode on Home', (await state()).view === 'picture');
    await current.keyboard.down('ArrowRight'); await current.keyboard.down('ArrowRight');
    check('A held key wakes once and its repeats do nothing', (await state()).view === 'home' && (await state()).selected === sel);
    await current.keyboard.up('ArrowRight');
    await current.keyboard.down('Digit0'); await current.keyboard.down('Digit0');
    check('A held 0 stays in Picture mode', (await state()).view === 'picture');
    await current.keyboard.up('Digit0'); await current.keyboard.press('Enter');
    check('OK in Picture mode returns without launching', (await state()).view === 'home' && (await current.evaluate(() => __tv.calls.length)) === 0);
    await current.keyboard.press('Digit0'); await current.waitForTimeout(600);
    await current.mouse.move(400, 300); await current.mouse.move(420, 320);
    check('Pointer movement returns to Home', (await state()).view === 'home');
    await current.keyboard.press('Digit0'); await current.mouse.click(960, 800);
    check('A click returns to Home without opening anything', (await state()).view === 'home' && (await current.evaluate(() => __tv.calls.length)) === 0);
    await act('util.apps'); await current.keyboard.press('Digit0');
    check('Key 0 is ignored in panels', (await state()).view === 'apps');
    await scene('home'); await current.keyboard.press('Digit0'); await current.evaluate(() => { __setHidden(true); __setHidden(false); });
    check('Hiding CleanFrame ends Picture mode', (await state()).view === 'home');
    await look({ bg: 'dark' }); await current.keyboard.press('Digit0'); await ready();
    p = await pictureShown();
    check('A flat background still shows the photo in Picture mode', p.view === 'picture' && p.bg === 'block' && p.photo.includes((await state()).wallpaper) && (await state()).shown.bg === 'dark', p);
    check('Picture mode uses no live blur', (await noLiveFilters()).length === 0);
    await current.screenshot({ path: out + 'picture-dark-1920.jpg', quality: 90 });
    await nav('back');
    check('Back returns from Picture mode to flat Home', (await state()).view === 'home' && (await call('where')).focusCount === 1);
  });
  await run('Picture mode starts after idle time on Home only', async () => {
    await page({ minuteMs: 100, seed: baseline({ idle: '5' }) });
    await current.waitForFunction(() => ShoreQA.state().view === 'picture', null, { timeout: 4000 });
    check('Idle Home starts Picture mode after the chosen time', (await call('where')).focusCount === 0);
    await nav('down');
    check('A key after idle start returns Home', (await state()).view === 'home' && (await state()).idleTimer.armed);
    for (let i = 0; i < 8; i++) { await current.mouse.move(300 + i * 40, 300); await current.waitForTimeout(120); }
    check('Pointer movement keeps Home awake', (await state()).view === 'home');
    await current.waitForFunction(() => ShoreQA.state().view === 'picture', null, { timeout: 4000 });
    await nav('back'); await scene('settings'); await current.waitForTimeout(900);
    check('The idle timer does not run outside Home', (await state()).view === 'settings' && !(await state()).idleTimer.armed);
    await group('picture'); await act('choice.idle.off'); await scene('home'); await current.waitForTimeout(900);
    check('Idle Off never starts Picture mode', (await state()).view === 'home' && (await stored()).idle === 'off');
    await current.evaluate(() => __setHidden(true));
    check('The idle timer stops while CleanFrame is hidden', !(await state()).idleTimer.armed);
  });
  await run('Picture mode rotation and crossfade', async () => {
    await page({ minuteMs: 100, seed: baseline({ mode: '5' }) });
    const first = (await state()).wallpaper;
    await current.keyboard.press('Digit0');
    check('Rotation counts Picture mode time', (await state()).rotation.active && (await state()).view === 'picture');
    await current.waitForFunction(id => ShoreQA.state().wallpaper !== id, first, { timeout: 5000 });
    const next = (await state()).wallpaper;
    check('Picture mode advances the wallpaper on the rotation interval', next === walls[1].id && (await state()).view === 'picture' && (await stored()).wallpaper === next);
    check('The old photo crossfades out over the new one', await current.evaluate(() => !!document.querySelector('.photo-out')) && (await current.locator('#photo').getAttribute('src')).includes(next));
    const loaded = await current.evaluate(id => [...new Set(performance.getEntriesByType('resource').map(r => new URL(r.name).pathname).filter(u => u.includes('/' + id)))], next);
    check('Rotation loads only the existing bundle images', loaded.length > 0 && loaded.every(u => new RegExp('/wallpapers/' + next + '(-panel)?\\.jpg$|/materials/' + next + '-').test(u)), loaded);
    await nav('back'); await look({ bg: 'light' });
    const flat = (await state()).wallpaper;
    await current.keyboard.press('Digit0');
    await current.waitForFunction(id => ShoreQA.state().wallpaper !== id, flat, { timeout: 5000 }); await ready();
    check('Picture mode rotates on a flat background too', (await current.locator('#photo').getAttribute('src')).includes((await state()).wallpaper) && (await state()).look.bg === 'light');
    await nav('back'); await closePage();
    await page({ minuteMs: 100, seed: baseline({ mode: 'fixed' }) });
    await current.keyboard.press('Digit0'); await current.waitForTimeout(900);
    check('Fixed keeps one photo in Picture mode', (await state()).wallpaper === walls[0].id && (await state()).view === 'picture');
  });
  await run('Input names', async () => {
    const HDMI1 = 'com.webos.app.hdmi1', HDMI2 = 'com.webos.app.hdmi2', LIVE = 'com.webos.app.livetv';
    const inputsCatalog = CATALOG.concat([{ id: HDMI1, name: 'HDMI 1', show: true }, { id: HDMI2, name: 'HDMI 2', show: true }, { id: LIVE, name: 'Live TV', show: true }]);
    const gridNames = () => current.locator('[data-action^="apps.open."] .label').allTextContents();
    await page({ catalog: inputsCatalog }); await library();
    check('All apps has no Rename action', !(await call('actions')).includes('apps.rename'));
    await act('apps.inputs'); await nav('down', 'right', 'up');
    check('Inputs page offers Rename next to its tab', same((await call('actions')).filter(a => /^apps\.(all|inputs|rename|editor)$/.test(a)), ['apps.all', 'apps.inputs', 'apps.rename', 'apps.editor']) && (await state()).focusAction === 'apps.inputs');
    await nav('right', 'ok');
    check('Rename opens on the last focused input', (await state()).view === 'rename' && (await state()).rename.input === HDMI2 && (await state()).focusAction === 'rename.input.' + HDMI2 && (await call('where')).focusCount === 1, (await state()).rename);
    await nav('right');
    check('Right reaches the names at the applied choice', (await state()).focusAction === 'rename.name.0');
    const before = (await state()).writes;
    await nav('right', 'ok');
    check('OK saves a preset name', same((await stored()).inputNames, { [HDMI2]: 'PlayStation' }) && (await state()).writes === before + 1);
    await nav('ok');
    check('OK on the applied name does not write again', (await state()).writes === before + 1);
    check('The input list shows the new and original names', (await current.locator('[data-action="rename.input.' + HDMI2 + '"]').innerText()).replace(/\s+/g, ' ').includes('PlayStation HDMI 2'));
    await nav('back');
    check('Back returns from names to inputs', (await state()).focusAction === 'rename.input.' + HDMI2);
    await nav('back');
    check('Back returns to Inputs on the renamed input', (await state()).view === 'apps' && (await state()).focusAction === 'apps.open.' + HDMI2 && same(await gridNames(), ['HDMI 1', 'PlayStation', 'Live TV']), await gridNames());
    check('A renamed input keeps its bundled glyph', (await current.locator('[data-action="apps.open.' + HDMI2 + '"] [data-mark]').getAttribute('data-mark')) === 'input-hdmi');
    await nav('ok'); await current.waitForFunction(() => __tv.calls.length === 1);
    check('Grid OK still launches the input', (await current.evaluate(() => __tv.calls[0].id)) === HDMI2);
    await current.evaluate(() => window.dispatchEvent(new Event('focus')));
    await editor(); await act('editor.add.' + HDMI2);
    check('The editor uses the new name', (await current.locator('[data-action="editor.move.' + HDMI2 + '"]').innerText()).includes('PlayStation'));
    await scene('home');
    check('Home uses the new name', (await current.locator('[data-action="home.app.' + HDMI2 + '"]').getAttribute('aria-label')) === 'PlayStation' && (await current.locator('[data-action="home.app.' + HDMI2 + '"]').innerText()).includes('PlayStation'));
    await current.evaluate(() => { __tv.launchFailure = true; }); await act('home.app.' + HDMI2);
    await current.waitForFunction(() => ShoreQA.where().view === 'message');
    check('The launch error title uses the new name', (await current.locator('.msg-title').innerText()) === 'PlayStation');
    await current.evaluate(() => { window.dispatchEvent(new Event('focus')); __tv.launchFailure = false; });
    await current.reload(); await ready(); await library(); await act('apps.inputs');
    check('Input names survive reload', same(await gridNames(), ['HDMI 1', 'PlayStation', 'Live TV']));
    await act('apps.rename');
    await current.locator('[data-action="rename.name.2"]').hover();
    check('Pointer hover focuses a name without saving it', (await state()).focusAction === 'rename.name.2' && (await stored()).inputNames[HDMI1] === undefined);
    await current.evaluate(() => { __failWrites = true; }); await nav('ok');
    check('A failed save keeps the name and says so', same((await stored()).inputNames, { [HDMI2]: 'PlayStation' }) && /couldn.t save/i.test(await current.locator('.s-sub').innerText()));
    await current.evaluate(() => { __failWrites = false; }); await nav('ok');
    check('OK retries the failed save', (await stored()).inputNames[HDMI1] === 'Xbox');
    await nav('back', 'down');
    await nav('right'); await current.locator('[data-action="rename.name.0"]').click();
    check('Original name removes the saved name', same((await stored()).inputNames, { [HDMI1]: 'Xbox' }));
    await act('rename.done');
    check('Done returns to Inputs', (await state()).view === 'apps' && same(await gridNames(), ['Xbox', 'HDMI 2', 'Live TV']), await gridNames());
  });
  await run('Screen shift keeps the glass registered', async () => {
    await page({ minuteMs: 60 });
    const registration = () => current.evaluate(() => {
      const st = document.getElementById('stage').getBoundingClientRect(), k = st.width / 1920;
      return [...document.querySelectorAll('.ph-plate.is-current .ph-field-img, #matImg')].filter(e => e.getClientRects().length && getComputedStyle(e.closest('.ph-plate, .dock')).display !== 'none').map(e => { const r = e.getBoundingClientRect(); return { id: e.id, dx: (r.left - st.left) / k, dy: (r.top - st.top) / k }; });
    });
    // The test cycle is 1.8 s, so read the position and the current offset together.
    const homeBox = () => current.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(), r = document.getElementById('home').getBoundingClientRect(), k = st.width / 1920, s = ShoreQA.state().screenShift; return { x: (r.left - st.left) / k, y: (r.top - st.top) / k, shift: [s.x, s.y] }; });
    check('Screen shift is off by default', !(await state()).screenShift.on && (await state()).screenShift.transform === '');
    await group('clock'); await act('choice.shift.on');
    let s = (await state()).screenShift;
    check('Screen shift moves Home with one small transform', s.on && /^translate\(/.test(s.transform) && Math.hypot(s.x, s.y) > 0 && Math.hypot(s.x, s.y) <= 4 && (await stored()).shift === 'on', s);
    await scene('home'); await nav('up');
    let box = await homeBox(), reg = await registration();
    check('Dock, controls and clock move by the shift', Math.abs(box.x - box.shift[0]) < .6 && Math.abs(box.y - box.shift[1]) < .6, box);
    check('Dock material and the control lens stay registered to the photo', reg.length === 2 && reg.every(r => Math.abs(r.dx) < .6 && Math.abs(r.dy) < .6), reg);
    await nav('down'); await look({ layout: 'list', focus: 'glass' });
    reg = await registration();
    check('The List plate stays registered to the photo', reg.length === 1 && reg.every(r => Math.abs(r.dx) < .6 && Math.abs(r.dy) < .6), reg);
    await current.waitForFunction(old => { const s = ShoreQA.state().screenShift; return s.x !== old.x || s.y !== old.y; }, s, { timeout: 4000 });
    const moved = (await state()).screenShift; reg = await registration();
    check('The offset changes on the fixed cycle', Math.hypot(moved.x, moved.y) <= 4 && reg.every(r => Math.abs(r.dx) < .6 && Math.abs(r.dy) < .6), { moved, reg });
    await current.keyboard.press('Digit0');
    box = await homeBox();
    check('Picture mode clock shifts too', (await state()).view === 'picture' && Math.hypot(box.shift[0], box.shift[1]) > 0 && Math.abs(box.x - box.shift[0]) < .6 && Math.abs(box.y - box.shift[1]) < .6, box);
    await nav('back'); await group('clock'); await act('choice.shift.off'); await scene('home');
    box = await homeBox(); reg = await registration();
    check('Turning screen shift off restores the original position', !(await state()).screenShift.on && (await state()).screenShift.transform === '' && Math.abs(box.x) < .1 && Math.abs(box.y) < .1 && reg.every(r => Math.abs(r.dx) < .6 && Math.abs(r.dy) < .6), { box, reg });
  });
  section = 'Run integrity';
  report.sourceAfter = hashes();
  check('No unexpected browser/resource failures', report.pageErrors.length === 0, report.pageErrors);
  check('Sources stayed stable during run', same(report.sourceBefore, report.sourceAfter));
} catch (error) { report.failures.push({ section, error: error.stack }); }
finally {
  await closePage();
  if (preview) await preview.close();
  report.finishedAt = new Date().toISOString();
  writeFileSync(out + 'checks.json', JSON.stringify(report, null, 2) + '\n');
}
console.log(report.checks.filter(c => c.passed).length + ' checks passed; ' + report.failures.length + ' failure(s). Report: .local/qa/checks.json');
if (report.failures.length) process.exitCode = 1;
