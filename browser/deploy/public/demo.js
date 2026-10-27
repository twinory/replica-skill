/* Husk demo. No dependencies, no network calls, no tracking. */

(function () {
  'use strict';

  var SITES = {
    video: {
      name: 'Video',
      host: 'm.video.example',
      color: '#8ea9ff',
      glyph: '\u25B6',
      title: 'Video',
      blurb: 'Stand-in for a video site. Mobile layout already has app style navigation.'
    },
    music: {
      name: 'Music',
      host: 'music.example',
      color: '#39d98a',
      glyph: '\u266A',
      title: 'Music',
      blurb: 'Stand-in for a music service. Shows the DRM handoff.'
    },
    forum: {
      name: 'Forum',
      host: 'forum.example',
      color: '#ff9f6b',
      glyph: '\u2261',
      title: 'Forum',
      blurb: 'Stand-in for a community site with promoted posts.'
    },
    news: {
      name: 'News',
      host: 'news.example',
      color: '#c9a0ff',
      glyph: 'N',
      title: 'News',
      blurb: 'Stand-in for a publisher with banner ads.'
    }
  };

  var state = {
    view: 'home',
    site: 'video',
    appMode: false,
    shields: true,
    loading: false,
    progress: 0,
    sheet: null,
    os: 'ios',
    tabs: []
  };

  var el = {
    phone: document.getElementById('phone'),
    screen: document.getElementById('screen'),
    homeView: document.getElementById('homeView'),
    siteView: document.getElementById('siteView'),
    chrome: document.getElementById('chrome'),
    handle: document.getElementById('handle'),
    appchip: document.getElementById('appchip'),
    sheet: document.getElementById('sheet'),
    sheetBody: document.getElementById('sheetBody'),
    toast: document.getElementById('toast'),
    clock: document.getElementById('clock'),
    statusicons: document.getElementById('statusicons'),
    notch: document.getElementById('notch')
  };

  /* ------------------------------------------------------------------ util */

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var toastTimer = null;
  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.toast.classList.remove('show');
    }, 2400);
  }

  function clock() {
    var now = new Date();
    var h = now.getHours() % 12;
    if (h === 0) { h = 12; }
    var m = String(now.getMinutes()).padStart(2, '0');
    el.clock.textContent = h + ':' + m;
  }

  /* ------------------------------------------------------------------ views */

  function renderHome() {
    var apps = ['video', 'music', 'forum', 'news'];
    var tiles = apps.map(function (key) {
      var site = SITES[key];
      return (
        '<div class="apptile" data-open="' + key + '" role="button" tabindex="0">' +
          '<div class="glyph" style="background:' + site.color + '1f;color:' + site.color + ';border-color:' + site.color + '38">' + site.glyph + '</div>' +
          '<span>' + esc(site.name) + '</span>' +
        '</div>'
      );
    }).join('');

    var recent = [
      { key: 'video', title: 'A weekend build, no voiceover', sub: 'm.video.example' },
      { key: 'music', title: 'Late shift playlist', sub: 'music.example' },
      { key: 'forum', title: 'Show us your setup, October', sub: 'forum.example' }
    ].map(function (row) {
      var site = SITES[row.key];
      return (
        '<div class="recentrow" data-open="' + row.key + '" role="button" tabindex="0">' +
          '<div class="g" style="background:' + site.color + '1f;color:' + site.color + '">' + site.glyph + '</div>' +
          '<div class="t"><b>' + esc(row.title) + '</b><span>' + esc(row.sub) + '</span></div>' +
        '</div>'
      );
    }).join('');

    el.homeView.innerHTML =
      '<div class="home">' +
        '<div class="brand"><span class="mark">V</span><span class="name">Husk</span></div>' +
        '<div class="searchpill" id="fakesearch">' +
          '<span>\u2315</span><span>Search or enter address</span>' +
          '<span class="shield">' + (state.shields ? '\u25C6 Shields on' : '\u25C7 Shields off') + '</span>' +
        '</div>' +
        '<div class="sectionhead"><b>Open as an app</b></div>' +
        '<div class="appgrid">' + tiles + '</div>' +
        '<div class="sectionhead"><b>Recent</b><span class="more">Clear</span></div>' +
        '<div class="recent">' + recent + '</div>' +
      '</div>';
  }

  function adSlot(label, sub) {
    return (
      '<div class="ad">' +
        '<div class="thumb">\u25A0</div>' +
        '<div class="copy"><b>' + esc(label) + '</b><span>' + esc(sub) + '</span></div>' +
        '<div class="tag">AD</div>' +
      '</div>'
    );
  }

  function renderVideo() {
    var cards = [
      { t: 'Building a browser shell in a weekend', c: 'Field Notes', v: '18K views · 2 days ago', len: '12:04' },
      { t: 'Why every phone has two engines', c: 'Under the Hood', v: '94K views · 1 week ago', len: '21:37' },
      { t: 'The quiet software movement', c: 'Slow Web', v: '7.4K views · 3 days ago', len: '08:12' }
    ].map(function (v) {
      return (
        '<div class="vcard">' +
          '<div class="vthumb">\u25B6<span class="len">' + v.len + '</span></div>' +
          '<div class="vmeta"><div class="av"></div><div><b>' + esc(v.t) + '</b>' +
          '<span>' + esc(v.c) + ' · ' + esc(v.v) + '</span></div></div>' +
        '</div>'
      );
    }).join('');

    return (
      '<div class="sitehead">' +
        '<div class="logo" style="background:#8ea9ff22;color:#8ea9ff">\u25B6</div>' +
        '<b>Video</b>' +
        '<div class="sp"><span>\u2315</span><span>\u2934</span><span>\u22EE</span></div>' +
      '</div>' +
      '<div class="chips">' +
        '<span class="chip on">All</span><span class="chip">Music</span>' +
        '<span class="chip">Live</span><span class="chip">Gaming</span><span class="chip">News</span>' +
      '</div>' +
      adSlot('Stop scrolling. Start shipping.', 'video ad network · 6 requests blocked') +
      adSlot('One weird trick for deep work', 'sponsored · removed by cosmetic filter') +
      cards +
      '<div class="bottomnav">' +
        '<div class="on"><i>\u2302</i>Home</div>' +
        '<div><i>\u25A6</i>Shorts</div>' +
        '<div><i>\u25F4</i>Subscriptions</div>' +
        '<div><i>\u25CB</i>You</div>' +
      '</div>'
    );
  }

  function renderMusic() {
    var tracks = [
      { t: 'Neon harbour', a: 'Sable', l: '3:41' },
      { t: 'Half light', a: 'Sable', l: '4:02' },
      { t: 'Cable car', a: 'Mono Lake', l: '2:58' },
      { t: 'Slow channel', a: 'Mono Lake', l: '5:11' }
    ].map(function (t) {
      return (
        '<div class="track"><div class="art"></div><div><b>' + esc(t.t) + '</b>' +
        '<span>' + esc(t.a) + '</span></div><span class="len">' + t.l + '</span></div>'
      );
    }).join('');

    var drm = state.os === 'ios' && !state.appMode
      ? '<div class="drm"><b>Playback would fail here.</b><br>The web player streams DRM protected audio. ' +
        'iOS does not give apps Widevine, so Husk offers the real app instead of a black screen. ' +
        'On Android this usually plays.</div>'
      : '';

    return (
      '<div class="sitehead">' +
        '<div class="logo" style="background:#39d98a22;color:#39d98a">\u266A</div>' +
        '<b>Music</b>' +
        '<div class="sp"><span>\u2315</span><span>\u22EE</span></div>' +
      '</div>' +
      '<div style="padding:8px 12px 0">' +
        '<div style="height:132px;border-radius:16px;background:linear-gradient(140deg,#22402f,#101a15);display:grid;place-items:center;font-size:34px;color:#7fe3ae">\u266B</div>' +
        '<div style="margin:12px 0 4px;font-size:17px;font-weight:700;letter-spacing:-0.02em">Late shift</div>' +
        '<div style="font-size:12px;color:var(--dim)">Playlist · 4 tracks</div>' +
      '</div>' +
      drm +
      adSlot('Upgrade to Premium', 'audio ad slot · blocked') +
      '<div class="tracklist">' + tracks + '</div>' +
      '<div class="player"><div class="art"></div><div><b>Neon harbour</b><span>Sable</span></div><div class="ctl">\u23F8</div></div>'
    );
  }

  function renderForum() {
    var threads = [
      { t: 'Show us your setup, October edition', m: '412 comments · 3h' },
      { t: 'A browser that blocks before paint', m: '88 comments · 6h' },
      { t: 'What did you ship this week?', m: '203 comments · 9h' },
      { t: 'Reading list for engine nerds', m: '57 comments · 1d' }
    ].map(function (row) {
      return (
        '<div style="padding:11px 14px;border-bottom:1px solid rgba(255,255,255,0.05)">' +
          '<div style="font-size:13.5px;font-weight:600">' + esc(row.t) + '</div>' +
          '<div style="font-size:11px;color:var(--dim);margin-top:3px">' + esc(row.m) + '</div>' +
        '</div>'
      );
    }).join('');

    return (
      '<div class="sitehead">' +
        '<div class="logo" style="background:#ff9f6b22;color:#ff9f6b">\u2261</div>' +
        '<b>Forum</b>' +
        '<div class="sp"><span>\u2315</span><span>\u22EE</span></div>' +
      '</div>' +
      adSlot('Promoted: try the other browser', 'promoted post · wrapper removed') +
      threads
    );
  }

  function renderNews() {
    return (
      '<div class="sitehead">' +
        '<div class="logo" style="background:#c9a0ff22;color:#c9a0ff">N</div>' +
        '<b>News</b>' +
        '<div class="sp"><span>\u2315</span><span>\u22EE</span></div>' +
      '</div>' +
      adSlot('Subscribe for 1 rupee a week', 'meter ad · blocked') +
      '<div style="padding:14px">' +
        '<div style="font-size:18px;font-weight:750;letter-spacing:-0.02em;line-height:1.25">The quiet return of software that does less</div>' +
        '<div style="font-size:11.5px;color:var(--dim);margin:7px 0 12px">Tech · 6 min read</div>' +
        '<div style="font-size:13px;color:#c3cbd8;line-height:1.6">A generation of apps grew by adding. A smaller ' +
        'group is growing by removing, and the ones that remove well are winning the same users back.</div>' +
      '</div>' +
      adSlot('Banner: 300x250', 'display slot · hidden, space reclaimed') +
      '<div style="padding:0 14px 20px;font-size:13px;color:#c3cbd8;line-height:1.6">' +
        'The rest of the article would be here. The point of the demo is the two transitions, not the words.' +
      '</div>'
    );
  }

  function renderSite() {
    var html = '';
    if (state.site === 'video') { html = renderVideo(); }
    if (state.site === 'music') { html = renderMusic(); }
    if (state.site === 'forum') { html = renderForum(); }
    if (state.site === 'news') { html = renderNews(); }
    el.siteView.innerHTML = html;
  }

  function renderChrome() {
    var site = SITES[state.site];
    var host = state.view === 'home' ? 'Search or enter address' : 'https://' + site.host;
    var shieldClass = state.shields ? 'iconbtn shield-on' : 'iconbtn';
    var shieldGlyph = state.shields ? '\u25C6' : '\u25C7';
    var count = state.tabs.length || 1;

    el.chrome.innerHTML =
      '<div class="progress"><i id="bar" style="width:' + (state.loading ? state.progress : (state.view === 'home' ? 0 : 100)) + '%"></i></div>' +
      '<div class="chromerow">' +
        '<button class="' + shieldClass + '" id="shieldBtn" title="Shields for this site">' + shieldGlyph + '</button>' +
        '<div class="urlbar">' +
          '<span class="lock">' + (state.view === 'home' ? '\u2315' : '\u25A0') + '</span>' +
          '<span class="u">' + esc(host) + '</span>' +
        '</div>' +
        '<button class="iconbtn" id="reloadBtn" title="Reload">\u21BB</button>' +
        '<div class="tabcount" id="tabsBtn" title="Tabs">' + count + '</div>' +
        '<button class="iconbtn" id="menuBtn" title="Menu">\u22EE</button>' +
      '</div>';

    document.getElementById('shieldBtn').addEventListener('click', function () {
      state.shields = !state.shields;
      applyShields();
      renderAll();
      toast(state.shields ? 'Shields on. Requests blocked before the page loads.' : 'Shields off for this site.');
    });

    document.getElementById('reloadBtn').addEventListener('click', simulateLoad);
    document.getElementById('tabsBtn').addEventListener('click', function () { openSheet('tabs'); });
    document.getElementById('menuBtn').addEventListener('click', function () { openSheet('menu'); });
  }

  function applyShields() {
    if (state.shields) {
      el.phone.classList.add('shielded');
    } else {
      el.phone.classList.remove('shielded');
    }
  }

  function applyAppMode() {
    if (state.appMode) {
      el.phone.classList.add('inapp');
      el.chrome.classList.add('gone');
      el.handle.classList.add('show');
      el.appchip.hidden = true;
    } else {
      el.phone.classList.remove('inapp');
      el.chrome.classList.remove('gone');
      el.handle.classList.remove('show');
      el.appchip.hidden = true;
    }
  }

  function renderAll() {
    renderHome();
    renderChrome();
    if (state.view === 'site') {
      el.homeView.classList.add('hidden');
      el.siteView.classList.remove('hidden');
      renderSite();
    } else {
      el.siteView.classList.add('hidden');
      el.homeView.classList.remove('hidden');
    }
    applyShields();
    applyAppMode();
    bindTiles();
  }

  function bindTiles() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-open]'), function (node) {
      function go() { openSite(node.getAttribute('data-open')); }
      node.addEventListener('click', go);
      node.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); go(); }
      });
    });
    var fake = document.getElementById('fakesearch');
    if (fake) {
      fake.addEventListener('click', function () {
        toast('The demo cannot browse the real web. Type in the app.');
      });
    }
  }

  function openSite(key) {
    state.view = 'site';
    state.site = key;
    state.appMode = false;
    var exists = state.tabs.some(function (t) { return t.key === key; });
    if (!exists) {
      state.tabs.push({ key: key, title: SITES[key].title });
    }
    renderAll();
    simulateLoad();
  }

  var loadTimer = null;
  function simulateLoad() {
    state.loading = true;
    state.progress = 0;
    el.appchip.hidden = true;
    renderChrome();
    clearInterval(loadTimer);
    loadTimer = setInterval(function () {
      state.progress += 12 + Math.random() * 18;
      if (state.progress >= 100) {
        state.progress = 100;
        state.loading = false;
        clearInterval(loadTimer);
        renderChrome();
        if (state.view === 'site' && !state.appMode) {
          el.appchip.hidden = false;
        }
      } else {
        var bar = document.getElementById('bar');
        if (bar) { bar.style.width = state.progress + '%'; }
      }
    }, 130);
  }

  /* ----------------------------------------------------------------- sheets */

  function openSheet(kind) {
    state.sheet = kind;
    var body = '';

    if (kind === 'tabs') {
      var cards = state.tabs.map(function (tab, index) {
        var site = SITES[tab.key];
        return (
          '<div class="tabcard' + (tab.key === state.site && state.view === 'site' ? ' active' : '') + '" data-tab="' + index + '">' +
            '<div class="x" data-close="' + index + '">\u2715</div>' +
            '<div class="host">' + esc(site.host) + '</div>' +
            '<b>' + esc(tab.title) + '</b>' +
          '</div>'
        );
      }).join('');
      body =
        '<h4>Tabs</h4>' +
        '<div class="tabgrid">' + (cards || '<div class="small">No open tabs</div>') + '</div>' +
        '<div class="sheetrow" id="newTab"><span class="ic">+</span> New tab</div>';
    }

    if (kind === 'menu') {
      body =
        '<h4>' + esc(state.view === 'site' ? SITES[state.site].name : 'Husk') + '</h4>' +
        '<div class="sheetrow" data-act="appmode"><span class="ic">\u2922</span><div>App view' +
          '<div class="sub">Full screen, no browser chrome, remembered for this site</div></div>' +
          '<span class="right">' + (state.appMode ? 'On' : 'Off') + '</span></div>' +
        '<div class="sheetrow" data-act="shields"><span class="ic">\u25C6</span><div>Shields' +
          '<div class="sub">' + (state.shields ? '6 requests blocked on this page' : 'Off for this site') + '</div></div>' +
          '<span class="right">' + (state.shields ? 'On' : 'Off') + '</span></div>' +
        '<div class="sheetrow" data-act="copy"><span class="ic">\u29C9</span> Copy link</div>' +
        '<div class="sheetrow" data-act="settings"><span class="ic">\u2699</span> Settings</div>' +
        '<div class="sheetrow" data-act="limits"><span class="ic">!</span> What this app cannot do</div>';
    }

    if (kind === 'shields') {
      body =
        '<h4>Shields for ' + esc(state.view === 'site' ? SITES[state.site].host : 'this site') + '</h4>' +
        '<div class="sheetrow" data-act="shields"><span class="ic">\u25C6</span> Ads and trackers' +
          '<span class="right">' + (state.shields ? 'On' : 'Off') + '</span></div>' +
        '<div class="sheetrow"><span class="ic">\u25A3</span> Element hiding<span class="right">On</span></div>' +
        '<div class="sheetrow"><span class="ic">\u26A0</span><div>Something broken?<div class="sub">Turn shields off for this site only</div></div></div>';
    }

    el.sheetBody.innerHTML = body;
    el.sheet.classList.add('open');

    Array.prototype.forEach.call(el.sheetBody.querySelectorAll('[data-act]'), function (node) {
      node.addEventListener('click', function () {
        var act = node.getAttribute('data-act');
        if (act === 'appmode') { toggleAppMode(); }
        if (act === 'shields') {
          state.shields = !state.shields;
          applyShields();
          renderAll();
          toast(state.shields ? 'Shields on' : 'Shields off for this site');
        }
        if (act === 'copy') { toast('Link copied'); }
        if (act === 'settings') { toast('Settings live in the app.'); }
        if (act === 'limits') { window.location.href = '/limits.html'; return; }
        closeSheet();
      });
    });

    Array.prototype.forEach.call(el.sheetBody.querySelectorAll('[data-tab]'), function (node) {
      node.addEventListener('click', function () {
        var index = Number(node.getAttribute('data-tab'));
        var tab = state.tabs[index];
        if (!tab) { return; }
        state.view = 'site';
        state.site = tab.key;
        state.appMode = false;
        renderAll();
        closeSheet();
      });
    });

    Array.prototype.forEach.call(el.sheetBody.querySelectorAll('[data-close]'), function (node) {
      node.addEventListener('click', function (event) {
        event.stopPropagation();
        var index = Number(node.getAttribute('data-close'));
        state.tabs.splice(index, 1);
        if (state.tabs.length === 0) {
          state.view = 'home';
        }
        renderAll();
        openSheet('tabs');
      });
    });

    var newTab = document.getElementById('newTab');
    if (newTab) {
      newTab.addEventListener('click', function () {
        state.view = 'home';
        state.appMode = false;
        renderAll();
        closeSheet();
      });
    }
  }

  function closeSheet() {
    state.sheet = null;
    el.sheet.classList.remove('open');
  }

  function toggleAppMode() {
    if (state.view !== 'site') {
      toast('Open a site first.');
      return;
    }
    state.appMode = !state.appMode;
    applyAppMode();
    renderSite();
    toast(state.appMode ? 'App view. Tap the bar at the top edge to come back.' : 'Browser back.');
  }

  /* ------------------------------------------------------------------ wiring */

  el.appchip.addEventListener('click', function () { toggleAppMode(); });
  el.handle.addEventListener('click', function () { toggleAppMode(); });

  el.screen.addEventListener('click', function (event) {
    if (state.sheet && !el.sheet.contains(event.target) && !event.target.closest('#sheet')) {
      closeSheet();
    }
  });

  Array.prototype.forEach.call(document.querySelectorAll('.oswitch button'), function (button) {
    button.addEventListener('click', function () {
      state.os = button.getAttribute('data-os');
      Array.prototype.forEach.call(document.querySelectorAll('.oswitch button'), function (other) {
        other.classList.toggle('on', other === button);
      });
      el.phone.setAttribute('data-os', state.os);
      el.notch.style.borderRadius = state.os === 'ios' ? '999px' : '999px';
      el.notch.style.width = state.os === 'ios' ? '86px' : '14px';
      el.notch.style.height = state.os === 'ios' ? '20px' : '14px';
      el.statusicons.textContent = state.os === 'ios' ? '\u25AE\u25AE\u25AE' : '\u25AE\u25AE\u25AE';
      renderSite();
      toast(state.os === 'ios' ? 'WKMWebView: the engine Safari uses, minus the browser.' : 'Android WebView: the Chromium engine, plus content blockers.');
    });
  });

  clock();
  setInterval(clock, 30000);
  state.tabs.push({ key: 'video', title: 'Video' });
  renderAll();
})();
