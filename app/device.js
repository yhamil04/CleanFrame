/* webOS TV application manager calls through PalmServiceBridge. No Mac server, network address or credentials. */
(function () {
  'use strict';
  // UK webOS app IDs for the default Home apps. Names and order live in main.js.
  var IDS = {
    netflix: 'netflix', youtube: 'youtube.leanback.v4', primevideo: 'amazon',
    disneyplus: 'com.disney.disneyplus-prod', bbciplayer: 'bbc.iplayer.3.0', itvx: 'com.fvp.itv',
    appletv: 'com.apple.appletv', spotify: 'spotify-beehive'
  };
  var NAMES = {
    netflix: 'Netflix', youtube: 'YouTube', primevideo: 'Prime Video', disneyplus: 'Disney+',
    bbciplayer: 'BBC iPlayer', itvx: 'ITVX', appletv: 'Apple TV', spotify: 'Spotify'
  };
  // Other launch points with a bundled mark.
  var EXTRA_BRANDS = {};
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
  // Non-system apps may be denied the launch-point list. Offer the known UK apps instead;
  // launching one that is not installed reports the TV's own error. Other failures can be retried.
  function fixedList() {
    return Object.keys(IDS).map(function (brand) { return { appId: IDS[brand], name: NAMES[brand], brand: brand, icon: '', rank: rank(brand) }; });
  }
  function apps(done) {
    if (!available()) { unavailable(done); return; }
    call('listLaunchPoints', {}, function (err, reply) {
      var map = known(), me = self(), seen = {}, result = [];
      if (err && !/denied|permission|not allowed|unknown method/i.test(err.detail || '')) { done(err); return; }
      if (err || !reply.launchPoints || !reply.launchPoints.length) { api.source = 'fixed'; done(null, fixedList()); return; }
      api.source = 'launchPoints';
      reply.launchPoints.forEach(function (p) {
        var id = p && p.id, brand = map[id] || EXTRA_BRANDS[id] || '';
        if (!id || !p.title || id === me || seen[id] || INTERNAL.test(id)) return;
        seen[id] = true;
        result.push({ appId: id, name: p.title, brand: brand, icon: p.icon || '', rank: map[id] ? rank(brand) : 30 });
      });
      result.sort(function (a, b) { return a.rank - b.rank || a.name.toLowerCase().localeCompare(b.name.toLowerCase()); });
      done(null, result);
    });
  }
  // source records whether apps() read the TV's launch points or used the fixed list.
  api = window.FrameDevice = { launch: launch, launchApp: launchApp, art: art, home: home, settings: settings, apps: apps, source: '' };
}());
