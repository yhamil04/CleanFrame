/* webOS TV application manager calls through PalmServiceBridge. No Mac server, network address or credentials. */
(function () {
  'use strict';
  // Default Home apps, verified on the UK reference TV. Names and order live in main.js.
  var IDS = { netflix: 'netflix', youtube: 'youtube.leanback.v4', primevideo: 'amazon', disneyplus: 'com.disney.disneyplus-prod' };
  var NAMES = { netflix: 'Netflix', youtube: 'YouTube', primevideo: 'Prime Video', disneyplus: 'Disney+' };
  // Other launch points with a bundled mark. Pathé and BBC iPlayer have no freely licensed mark, so they keep initials.
  var EXTRA_BRANDS = { 'com.apple.appletv': 'appletv', 'com.apple.applemusic': 'applemusic', 'spotify-beehive': 'spotify',
    'io.strem.tv': 'stremio', 'com.wbd.hbomax': 'hbomax', 'viaplay-lg': 'viaplay', 'com.fvp.itv': 'itvx', 'tv.twitch.tv.starshot.lg': 'twitch' };
  // When the launch-point list is denied, All apps offers these and the Home apps, if installed. An app
  // installed later appears automatically only if its ID is listed here. Stremio, HBO Max, Pathé,
  // Viaplay, Apple TV and Apple Music were verified on the reference TV; BBC iPlayer, ITVX and Spotify
  // use the usual UK IDs but were not installed there.
  var MORE = [['com.apple.appletv', 'Apple TV'], ['com.apple.applemusic', 'Apple Music'], ['io.strem.tv', 'Stremio'], ['com.wbd.hbomax', 'HBO Max'],
    ['pathe', 'Pathé'], ['viaplay-lg', 'Viaplay'], ['bbc.iplayer.3.0', 'BBC iPlayer'], ['com.fvp.itv', 'ITVX'],
    ['spotify-beehive', 'Spotify'], ['tv.twitch.tv.starshot.lg', 'Twitch'], ['com.webos.app.browser', 'Web Browser'],
    ['com.webos.app.photovideo', 'Photo & Video'], ['com.webos.app.music', 'Music'], ['com.webos.app.livetv', 'Live TV'],
    ['com.webos.app.hdmi1', 'HDMI 1'], ['com.webos.app.hdmi2', 'HDMI 2'], ['com.webos.app.hdmi3', 'HDMI 3'], ['com.webos.app.hdmi4', 'HDMI 4']];
  // TV tuner and external inputs are listed apart from apps.
  var INPUT = /^com\.webos\.app\.(?:livetv|hdmi\d|externalinput\.[a-z0-9]+)$/;
  var HOME = 'com.webos.app.home', SETTINGS = 'com.palm.app.settings', LIVE_TV = 'com.webos.app.livetv';
  // Inputs use CleanFrame's own drawn glyphs: an antenna for the tuner, a port for HDMI and other inputs.
  function inputBrand(id) { return id === LIVE_TV ? 'input-tv' : 'input-hdmi'; }
  // System launch points that are not apps a viewer would put on Home.
  var INTERNAL = /^com\.webos\.app\.(?:home|discovery|customersupport|membership|softwareupdate|notificationcenter|voice|tvhotkey|channelsetting|scheduler)$/;
  var SERVICE = 'luna://com.webos.applicationManager/', pending = [], api;
  // The last good catalogue is reused for the session, so reopening All apps or the Home editor
  // does not repeat about 20 getAppLoadStatus calls on webOS 5. Errors are never kept.
  var CACHE_MS = 10 * 60 * 1000, cached = null, cachedAt = 0, cachedSource = '';
  function self() {
    // PalmSystem.identifier is "<appId> <processId>"; it keeps the self-filter in step with appinfo.json.
    var id = window.PalmSystem && window.PalmSystem.identifier;
    return typeof id === 'string' && id ? id.split(' ')[0] : 'com.example.cleanframe';
  }
  function available() { return !!window.PalmServiceBridge; }
  function unavailable(done) {
    done({ message: 'Open CleanFrame on the TV to use this control.', detail: 'The web preview cannot control the TV.' });
  }
  function failure(err) {
    return { message: 'The TV could not open this screen.', detail: err && (err.errorText || err.message || err.name) || 'Try again, or press the remote’s Home button to return to CleanFrame.' };
  }
  function bounded(done) {
    var finished = false, timer = setTimeout(function () { finish({ message: 'The TV did not respond. Please try again.' }); }, 8000);
    function finish(err, value) { if (finished) return; finished = true; clearTimeout(timer); done(err, value); }
    return finish;
  }
  function call(method, params, done) {
    if (!available()) { unavailable(done); return; }
    var finish = bounded(done), bridge;
    try {
      // Keep each bridge referenced until it answers; a collected bridge drops its callback.
      bridge = new window.PalmServiceBridge(); pending.push(bridge);
      bridge.onservicecallback = function (text) {
        var reply;
        pending.splice(pending.indexOf(bridge), 1);
        try { reply = JSON.parse(text); } catch (e) { reply = { returnValue: false, errorText: 'Unreadable reply' }; }
        if (!reply || reply.returnValue === false) finish(failure(reply));
        else finish(null, reply);
      };
      bridge.call(SERVICE + method, JSON.stringify(params || {}));
    } catch (err) { finish(failure(err)); }
  }
  function launchApp(id, done) { call('launch', { id: id }, function (err) { done(err || null); }); }
  function launch(brand, done) {
    if (!IDS[brand]) { done({message: 'This app has no launch target.'}); return; }
    launchApp(IDS[brand], done);
  }
  function art(done) { done({ message: 'Art Mode is not available on this TV.' }); }
  function home(done) { launchApp(HOME, done); }
  function settings(done) { launchApp(SETTINGS, done); }
  function liveTv(done) { launchApp(LIVE_TV, done); }
  function known() {
    var map = {};
    Object.keys(IDS).forEach(function (brand) { map[IDS[brand]] = brand; });
    return map;
  }
  function rank(brand) { return brand && IDS[brand] ? Object.keys(IDS).indexOf(brand) : 30; }
  // Non-system apps may be denied the launch-point list, but may ask whether an app exists.
  // Offer the installed candidates; if that check also fails, offer them all and let launch report.
  function fixedList(done) {
    var list = Object.keys(IDS).map(function (brand) { return { appId: IDS[brand], name: NAMES[brand], brand: brand, icon: '', kind: 'app', rank: rank(brand) }; })
      .concat(MORE.map(function (m) {
        var input = INPUT.test(m[0]);
        return { appId: m[0], name: m[1], brand: input ? inputBrand(m[0]) : EXTRA_BRANDS[m[0]] || '', icon: '', kind: input ? 'input' : 'app', rank: 30 };
      }));
    var left = list.length, keep = [], answered = true;
    list.forEach(function (entry, i) {
      call('getAppLoadStatus', { appId: entry.appId }, function (err, reply) {
        keep[i] = err || reply.exist !== false;
        if (err) answered = false;
        if (--left) return;
        // answered is false when any check failed; that list is shown but not cached.
        done(list.filter(function (entry, i) { return keep[i]; }).sort(function (a, b) { return a.rank - b.rank || a.name.toLowerCase().localeCompare(b.name.toLowerCase()); }), answered);
      });
    });
  }
  // Callers receive a copy, so changing an entry cannot alter the cached catalogue.
  function copy(list) {
    return list.map(function (e) { return { appId: e.appId, name: e.name, brand: e.brand, icon: e.icon, kind: e.kind, rank: e.rank }; });
  }
  function remember(source, list, keep, done) {
    api.source = source;
    if (keep) { cached = list; cachedAt = Date.now(); cachedSource = source; }
    done(null, copy(list));
  }
  // options.fresh skips the session cache, for example from Try again.
  function apps(done, options) {
    if (!available()) { unavailable(done); return; }
    if (cached && !(options && options.fresh) && Date.now() - cachedAt < CACHE_MS) { api.source = cachedSource; done(null, copy(cached)); return; }
    call('listLaunchPoints', {}, function (err, reply) {
      var map = known(), me = self(), seen = {}, result = [];
      if (err && !/denied|permission|not allowed|unknown method/i.test(err.detail || '')) { done(err); return; }
      if (err || !reply.launchPoints || !reply.launchPoints.length) { fixedList(function (list, answered) { remember('fixed', list, answered, done); }); return; }
      reply.launchPoints.forEach(function (p) {
        var id = p && p.id, input = INPUT.test(id || ''), brand = map[id] || EXTRA_BRANDS[id] || (input ? inputBrand(id) : '');
        if (!id || !p.title || id === me || seen[id] || INTERNAL.test(id)) return;
        seen[id] = true;
        result.push({ appId: id, name: p.title, brand: brand, icon: p.icon || '', kind: input ? 'input' : 'app', rank: map[id] ? rank(brand) : 30 });
      });
      result.sort(function (a, b) { return a.rank - b.rank || a.name.toLowerCase().localeCompare(b.name.toLowerCase()); });
      remember('launchPoints', result, true, done);
    });
  }
  // source records whether apps() read the TV's launch points or used the fixed list, including from the cache.
  api = window.FrameDevice = { launch: launch, launchApp: launchApp, art: art, home: home, settings: settings, liveTv: liveTv, apps: apps, source: '' };
}());
