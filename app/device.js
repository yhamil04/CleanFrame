/* webOS TV application manager calls through PalmServiceBridge. No Mac server, network address or credentials. */
(function () {
  'use strict';
  // Default Home apps, verified on the UK reference TV. Names and order live in main.js.
  var IDS = { netflix: 'netflix', youtube: 'youtube.leanback.v4', primevideo: 'amazon', disneyplus: 'com.disney.disneyplus-prod' };
  var NAMES = { netflix: 'Netflix', youtube: 'YouTube', primevideo: 'Prime Video', disneyplus: 'Disney+' };
  // Other launch points with a bundled mark.
  var EXTRA_BRANDS = { 'com.apple.appletv': 'appletv', 'com.apple.applemusic': 'applemusic', 'spotify-beehive': 'spotify',
    'io.strem.tv': 'stremio', 'com.wbd.hbomax': 'hbomax' };
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
  var HOME = 'com.webos.app.home', SETTINGS = 'com.palm.app.settings';
  // System launch points that are not apps a viewer would put on Home.
  var INTERNAL = /^com\.webos\.app\.(?:home|discovery|customersupport|membership|softwareupdate|notificationcenter|voice|tvhotkey|channelsetting|scheduler)$/;
  var SERVICE = 'luna://com.webos.applicationManager/', pending = [], api;
  function self() {
    // PalmSystem.identifier is "<appId> <processId>"; it keeps the self-filter in step with appinfo.json.
    var id = window.PalmSystem && window.PalmSystem.identifier;
    return typeof id === 'string' && id ? id.split(' ')[0] : 'com.yhamil.cleanframe';
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
      .concat(MORE.map(function (m) { return { appId: m[0], name: m[1], brand: EXTRA_BRANDS[m[0]] || '', icon: '', kind: INPUT.test(m[0]) ? 'input' : 'app', rank: 30 }; }));
    var left = list.length, keep = [];
    list.forEach(function (entry, i) {
      call('getAppLoadStatus', { appId: entry.appId }, function (err, reply) {
        keep[i] = err || reply.exist !== false;
        if (--left) return;
        done(list.filter(function (entry, i) { return keep[i]; }).sort(function (a, b) { return a.rank - b.rank || a.name.toLowerCase().localeCompare(b.name.toLowerCase()); }));
      });
    });
  }
  function apps(done) {
    if (!available()) { unavailable(done); return; }
    call('listLaunchPoints', {}, function (err, reply) {
      var map = known(), me = self(), seen = {}, result = [];
      if (err && !/denied|permission|not allowed|unknown method/i.test(err.detail || '')) { done(err); return; }
      if (err || !reply.launchPoints || !reply.launchPoints.length) { api.source = 'fixed'; fixedList(function (list) { done(null, list); }); return; }
      api.source = 'launchPoints';
      reply.launchPoints.forEach(function (p) {
        var id = p && p.id, brand = map[id] || EXTRA_BRANDS[id] || '';
        if (!id || !p.title || id === me || seen[id] || INTERNAL.test(id)) return;
        seen[id] = true;
        result.push({ appId: id, name: p.title, brand: brand, icon: p.icon || '', kind: INPUT.test(id) ? 'input' : 'app', rank: map[id] ? rank(brand) : 30 });
      });
      result.sort(function (a, b) { return a.rank - b.rank || a.name.toLowerCase().localeCompare(b.name.toLowerCase()); });
      done(null, result);
    });
  }
  // source records whether apps() read the TV's launch points or used the fixed list.
  api = window.FrameDevice = { launch: launch, launchApp: launchApp, art: art, home: home, settings: settings, apps: apps, source: '' };
}());
