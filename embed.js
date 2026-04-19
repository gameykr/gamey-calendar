/*!
 * Gamey Calendar Embed Widget v1.0
 * Script-based embed for gamey.kr main page
 * Usage:
 *   <div id="gamey-calendar-embed"></div>
 *   <script src="https://calendar.gamey.kr/embed.js" async></script>
 */
(function () {
  'use strict';

  /* ------------ \uC124\uC815 ------------ */
  var TARGET_ID  = 'gamey-calendar-embed';
  var CAL_URL    = 'https://calendar.gamey.kr';
  var CACHE_KEY  = 'gameycal_embed_v1';
  var CACHE_TTL  = 30 * 60 * 1000;        // 30\uBD84
  var LOOKAHEAD  = 60;                    // \uBA70\uCE60 \uC774\uD6C4\uAE4C\uC9C0 \uC870\uD68C
  var SHOW_MAX   = 4;                     // \uB178\uCD9C \uCE74\uB4DC \uC218

  /* Cloudflare Scrape Shield \uC6B0\uD68C\uB97C \uC704\uD574 \uBB38\uC790\uC5F4 \uBD84\uD560 */
  var API_KEY = 'AIzaSy' + 'AaiSdUHdN0HoWv8wHHcMUru9mmm9JG3NQ';
  var CALS = {
    '\uCD9C\uC2DC':   'gameykr' + '2014' + '@' + 'gmail.com',
    '\uD14C\uC2A4\uD2B8': 'f2880cff5e99faebaf4d5184738db9414935f9468e61e0bb10bcec8d586ec9c5' + '@group.calendar.google.com',
    '\uC608\uC57D':   'd5fccae3b724970effa9b7882a51e81bbbaefa3b6b572159d8f683e32d42f40c' + '@group.calendar.google.com',
    '\uAE30\uB85D':   'e4f85cc2ea47dde5db3dc375623fbc187a9965fd935d8eb0e51cd2f3df284567' + '@group.calendar.google.com',
    '\uD589\uC0AC':   'f72981731cc97bd97de58680a9ea4efe1aa9054e4c7fbac4680b87b5917e5fed' + '@group.calendar.google.com'
  };
  var COLOR = {
    '\uCD9C\uC2DC':   '#ff2e6c',  /* neon pink */
    '\uD14C\uC2A4\uD2B8': '#b14bff',  /* neon purple */
    '\uC608\uC57D':   '#ffb020',  /* neon amber */
    '\uAE30\uB85D':   '#39ff9a',  /* neon green */
    '\uD589\uC0AC':   '#00e5ff'   /* neon cyan */
  };
  var DAYS = ['\uC77C', '\uC6D4', '\uD654', '\uC218', '\uBAA9', '\uAE08', '\uD1A0'];

  /* ------------ DOM \uC900\uBE44 ------------ */
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* ------------ \uC720\uD2F8 ------------ */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function parseTitle(summary) {
    if (!summary) return '';
    // \uAC8C\uC784\uBA85(\uC601\uC5B4\uBCD1\uAE30)[PC/NS] -> \uD50C\uB7AB\uD3FC \uB300\uAD04\uD638\uB9CC \uC81C\uAC70
    var s = summary.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
    // \uC601\uC5B4\uBCD1\uAE30 \uAD04\uD638\uB294 \uB0A8\uACA8\uB450\uB418 \uB108\uBB34 \uAE38\uBA74 \uC81C\uAC70
    return s;
  }

  function parsePlatforms(summary) {
    if (!summary) return [];
    var m = summary.match(/\[([^\]]+)\]\s*$/);
    if (!m) return [];
    return m[1].split(/[\/,\s]+/).map(function (x) {
      x = x.toUpperCase();
      if (x === 'PC') return 'PC';
      if (/^PS/.test(x) || x === '\uD50C\uC2A4') return 'PS';
      if (/^(XB|XS|XBOX)/.test(x)) return 'XB';
      if (/^(NS|NSW|SWITCH|\uB2CC\uD150\uB3C4)/.test(x)) return 'NS';
      if (/^(MO|MOBILE|\uBAA8\uBC14\uC77C|AOS|IOS|\uC548\uB4DC\uB85C\uC774\uB4DC)/.test(x)) return 'MO';
      return x;
    }).filter(Boolean);
  }

  function fmtDate(ds) {
    var d = new Date(ds);
    return {
      month: d.getMonth() + 1,
      day:   d.getDate(),
      dow:   DAYS[d.getDay()]
    };
  }

  function kstStartOfToday() {
    var now = new Date();
    var kst = new Date(now.getTime() + 9 * 3600000);
    var y = kst.getUTCFullYear(), m = kst.getUTCMonth(), d = kst.getUTCDate();
    return new Date(Date.UTC(y, m, d) - 9 * 3600000);
  }

  /* ------------ \uB370\uC774\uD130 \uB85C\uB4DC ------------ */
  function loadFromCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.ts || Date.now() - obj.ts > CACHE_TTL) return null;
      return obj.events || null;
    } catch (e) { return null; }
  }

  function saveCache(events) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), events: events }));
    } catch (e) { /* \uC6A9\uB7C9 \uCD08\uACFC \uB4F1 \uBB34\uC2DC */ }
  }

  function fetchEvents() {
    var now = new Date();
    var later = new Date(Date.now() + LOOKAHEAD * 86400000);
    var tMin = now.toISOString();
    var tMax = later.toISOString();

    var keys = Object.keys(CALS);
    var tasks = keys.map(function (k) {
      var id  = encodeURIComponent(CALS[k]);
      var url = 'https://www.googleapis.com/calendar/v3/calendars/' + id +
                '/events?key=' + API_KEY +
                '&timeMin=' + encodeURIComponent(tMin) +
                '&timeMax=' + encodeURIComponent(tMax) +
                '&singleEvents=true&orderBy=startTime&maxResults=20';
      return fetch(url)
        .then(function (r) { return r.ok ? r.json() : { items: [] }; })
        .then(function (j) { return { cat: k, items: j.items || [] }; })
        .catch(function () { return { cat: k, items: [] }; });
    });

    return Promise.all(tasks).then(function (results) {
      var all = [];
      var todayMs = kstStartOfToday().getTime();
      results.forEach(function (r) {
        r.items.forEach(function (it) {
          var s = it.start && (it.start.dateTime || it.start.date);
          if (!s) return;
          if (new Date(s).getTime() < todayMs) return;
          all.push({
            cat:   r.cat,
            date:  s,
            title: parseTitle(it.summary || ''),
            plats: parsePlatforms(it.summary || '')
          });
        });
      });
      all.sort(function (a, b) { return a.date.localeCompare(b.date); });
      return all.slice(0, SHOW_MAX);
    });
  }

  /* ------------ \uB80C\uB354 ------------ */
  var CSS = [
    ':host { all: initial; display: block; font-family: "Noto Sans KR", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif; color: #e6eaf5; }',
    '* { box-sizing: border-box; }',
    /* \uCEE8\ud14c\uc774\ub108: \ub525 \ube14\ub799 + \ub124\uc628 \uae00\ub85c\uc6b0 \ud14c\ub450\ub9ac */
    '.gcw { position: relative; background: radial-gradient(ellipse at top left, #1a1033 0%, #0a0a1a 50%, #050510 100%); border-radius: 12px; overflow: hidden; box-shadow: 0 0 0 1px rgba(255, 46, 108, 0.25), 0 0 30px rgba(255, 46, 108, 0.12), 0 0 60px rgba(0, 229, 255, 0.08), 0 10px 40px rgba(0, 0, 0, 0.4); }',
    /* \ube44\ubc00 \uadf8\ub9ac\ub4dc \ub178\uc774\uc988 \ubc30\uacbd */
    '.gcw::before { content:""; position:absolute; inset:0; background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px); background-size: 24px 24px; pointer-events: none; z-index: 0; }',
    /* \uc0c1\ub2e8 \ub124\uc628 \uc2a4\uce94\ub77c\uc778 */
    '.gcw::after { content:""; position:absolute; top:0; left:0; right:0; height:1px; background: linear-gradient(90deg, transparent, #ff2e6c 20%, #00e5ff 80%, transparent); opacity:.8; z-index:1; }',
    /* \ud5e4\ub354 */
    '.gcw-head { position:relative; z-index:2; display:flex; align-items:center; justify-content:space-between; padding: 11px 14px; border-bottom: 1px solid rgba(255,46,108,0.15); background: linear-gradient(180deg, rgba(255,46,108,0.08), transparent); }',
    '.gcw-brand { display:flex; align-items:center; gap: 9px; font-weight: 800; font-size: 13px; letter-spacing: 0.02em; color: #fff; text-decoration:none; }',
    /* \ub85c\uace0 \uc774\ubbf8\uc9c0 */
    '.gcw-brand-img { width: 22px; height: 22px; border-radius: 5px; object-fit: cover; box-shadow: 0 0 12px rgba(255,46,108,0.5), 0 0 4px rgba(255,46,108,0.8); background: #1a0818; flex-shrink:0; }',
    '.gcw-brand-txt { background: linear-gradient(135deg, #ff2e6c, #00e5ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: 0.08em; text-transform: uppercase; font-size: 12px; font-weight: 900; }',
    '.gcw-brand-sub { font-size: 10px; font-weight: 600; color: #6b7280; letter-spacing: 0.05em; text-transform: uppercase; }',
    /* \ub354\ubcf4\uae30 \ubc84\ud2bc */
    '.gcw-more { display:inline-flex; align-items:center; gap:4px; font-size: 11px; color: #00e5ff; font-weight: 800; text-decoration: none; padding: 5px 10px; border: 1px solid rgba(0,229,255,0.4); border-radius: 4px; transition: all .2s; text-transform: uppercase; letter-spacing: 0.05em; background: rgba(0,229,255,0.06); }',
    '.gcw-more:hover { background: rgba(0,229,255,0.18); border-color: #00e5ff; box-shadow: 0 0 12px rgba(0,229,255,0.5); }',
    '.gcw-more svg { width: 10px; height: 10px; }',
    /* \uadf8\ub9ac\ub4dc */
    '.gcw-grid { position:relative; z-index:2; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: rgba(255,46,108,0.12); }',
    /* \uce74\ub4dc */
    '.gcw-card { background: rgba(8, 8, 18, 0.9); padding: 11px 12px 10px; text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 7px; min-height: 104px; transition: all .25s ease; cursor: pointer; position: relative; overflow: hidden; }',
    '.gcw-card::before { content:""; position:absolute; left:0; top:0; bottom:0; width:3px; background: var(--cat-color, #9ca3af); box-shadow: 0 0 8px var(--cat-color, transparent); }',
    '.gcw-card::after { content:""; position:absolute; inset:0; background: radial-gradient(ellipse at left center, var(--cat-glow, transparent) 0%, transparent 60%); opacity: 0; transition: opacity .25s; pointer-events:none; }',
    '.gcw-card:hover { background: rgba(20, 12, 30, 0.95); transform: translateY(-1px); }',
    '.gcw-card:hover::after { opacity: 1; }',
    '.gcw-card:hover::before { width:4px; }',
    /* \uce74\ub4dc \uc0c1\ub2e8: \uce74\ud14c\uace0\ub9ac \ubc30\uc9c0 + \ub0a0\uc9dc */
    '.gcw-top { display:flex; align-items:center; gap: 6px; position:relative; z-index:1; }',
    '.gcw-cat { font-size: 9px; font-weight: 900; color: var(--cat-color); padding: 2px 6px; border-radius: 2px; background: var(--cat-bg); border: 1px solid var(--cat-border); letter-spacing: 0.08em; text-transform: uppercase; text-shadow: 0 0 4px var(--cat-color); }',
    '.gcw-date { font-size: 10px; color: #9ca3b8; font-weight: 700; letter-spacing: 0.02em; }',
    '.gcw-date-d { color: #fff; font-weight: 900; font-size: 11px; }',
    /* \uc81c\ubaa9 */
    '.gcw-title { font-size: 12px; font-weight: 700; line-height: 1.35; color: #f1f3fa; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: keep-all; position:relative; z-index:1; letter-spacing: -0.01em; }',
    '.gcw-card:hover .gcw-title { color: #fff; }',
    /* \ud50c\ub7ab\ud3fc \ubc30\uc9c0 */
    '.gcw-plats { display:flex; gap: 4px; flex-wrap: wrap; margin-top: auto; position:relative; z-index:1; }',
    '.gcw-plat { font-size: 9px; color: #b8c0d4; background: rgba(255,255,255,0.05); padding: 1px 5px; border-radius: 2px; font-weight: 700; letter-spacing: 0.05em; border: 1px solid rgba(255,255,255,0.08); }',
    /* \ube48/\ub85c\ub529 \uc0c1\ud0dc */
    '.gcw-empty { padding: 34px 14px; text-align:center; color: #6b7280; font-size: 12px; position:relative; z-index:2; }',
    '.gcw-skel { position:relative; z-index:2; padding: 12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }',
    '.gcw-skel-item { height: 80px; background: linear-gradient(90deg, rgba(255,46,108,0.04) 25%, rgba(0,229,255,0.08) 50%, rgba(255,46,108,0.04) 75%); background-size: 200% 100%; border-radius: 4px; animation: gcw-shimmer 1.4s infinite; border: 1px solid rgba(255,46,108,0.1); }',
    '@keyframes gcw-shimmer { 0%{background-position:200% 0;} 100%{background-position:-200% 0;} }',
    /* \ubaa8\ubc14\uc77c */
    '@media (max-width: 640px) {',
    '  .gcw-grid { grid-template-columns: repeat(2, 1fr); }',
    '  .gcw-skel { grid-template-columns: repeat(2, 1fr); }',
    '  .gcw-brand-sub { display:none; }',
    '  .gcw-more { padding: 4px 8px; font-size: 10px; }',
    '}'
  ].join('\n');

  function hexToRgba(hex, a) {
    var h = hex.replace('#', '');
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function buildSkeleton() {
    var sk = '';
    for (var i = 0; i < SHOW_MAX; i++) sk += '<div class="gcw-skel-item"></div>';
    return '<div class="gcw-skel">' + sk + '</div>';
  }

  function buildBody(events) {
    if (!events || !events.length) {
      return '<div class="gcw-empty">\uC608\uC815\uB41C \uC77C\uC815\uC774 \uC5C6\uC2B5\uB2C8\uB2E4</div>';
    }
    var cards = events.map(function (ev) {
      var d = fmtDate(ev.date);
      var color = COLOR[ev.cat] || '#9ca3af';
      var bg = hexToRgba(color, 0.12);
      var border = hexToRgba(color, 0.4);
      var glow = hexToRgba(color, 0.15);
      var plats = (ev.plats || []).slice(0, 3).map(function (p) {
        return '<span class="gcw-plat">' + esc(p) + '</span>';
      }).join('');
      return (
        '<a class="gcw-card" href="' + CAL_URL + '" target="_blank" rel="noopener" ' +
        'style="--cat-color:' + color + ';--cat-bg:' + bg + ';--cat-border:' + border + ';--cat-glow:' + glow + '">' +
          '<div class="gcw-top">' +
            '<span class="gcw-cat">' + esc(ev.cat) + '</span>' +
            '<span class="gcw-date"><span class="gcw-date-d">' + d.month + '/' + d.day + '</span> (' + d.dow + ')</span>' +
          '</div>' +
          '<div class="gcw-title">' + esc(ev.title) + '</div>' +
          (plats ? '<div class="gcw-plats">' + plats + '</div>' : '') +
        '</a>'
      );
    }).join('');
    return '<div class="gcw-grid">' + cards + '</div>';
  }

  function buildHTML(inner) {
    return (
      '<div class="gcw">' +
        '<div class="gcw-head">' +
          '<a class="gcw-brand" href="' + CAL_URL + '" target="_blank" rel="noopener">' +
            '<img class="gcw-brand-img" src="' + CAL_URL + '/logo.webp" alt="GAMEY" loading="lazy">' +
            '<span class="gcw-brand-txt">Gamey Calendar</span>' +
            '<span class="gcw-brand-sub">\u2022 \uB2E4\uAC00\uC624\uB294 \uC77C\uC815</span>' +
          '</a>' +
          '<a class="gcw-more" href="' + CAL_URL + '" target="_blank" rel="noopener">' +
            '\uC804\uCCB4\uBCF4\uAE30' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 6l6 6-6 6"/></svg>' +
          '</a>' +
        '</div>' +
        inner +
      '</div>'
    );
  }

  /* ------------ \uBD80\uD305 ------------ */
  function boot() {
    var host = document.getElementById(TARGET_ID);
    if (!host) return;

    // Shadow DOM (\uC9C0\uC6D0 \uC548 \uB418\uBA74 \uC77C\uBC18 div \uD3F4\uBC31)
    var root = host.shadowRoot || (host.attachShadow ? host.attachShadow({ mode: 'open' }) : host);
    if (root !== host) {
      root.innerHTML = '';
      var style = document.createElement('style');
      style.textContent = CSS;
      root.appendChild(style);
      var wrap = document.createElement('div');
      wrap.innerHTML = buildHTML(buildSkeleton());
      root.appendChild(wrap);
    } else {
      // Shadow DOM \uBBF8\uC9C0\uC6D0 \uD3F4\uBC31: scoped prefix \uC0AC\uC6A9 (\uBD80\uBAA8 CSS \uAC04\uC12D \uAC00\uB2A5\uC131 \uC874\uC7AC)
      host.innerHTML = '<style>' + CSS.replace(/:host/g, '.gcw-host') + '</style>' +
                       '<div class="gcw-host">' + buildHTML(buildSkeleton()) + '</div>';
    }

    function apply(events) {
      var container = root.querySelector('.gcw');
      if (!container) return;
      // head\uB294 \uC720\uC9C0\uD558\uACE0 body\uB9CC \uAD50\uCCB4
      var head = container.querySelector('.gcw-head');
      container.innerHTML = '';
      if (head) container.appendChild(head);
      var bodyDiv = document.createElement('div');
      bodyDiv.innerHTML = buildBody(events);
      while (bodyDiv.firstChild) container.appendChild(bodyDiv.firstChild);
    }

    // \uCE90\uC2DC \uC6B0\uC120 -> \uBC31\uADF8\uB77C\uC6B4\uB4DC \uB9AC\uD504\uB808\uC2DC
    var cached = loadFromCache();
    if (cached) apply(cached);

    fetchEvents().then(function (events) {
      saveCache(events);
      apply(events);
    }).catch(function () {
      if (!cached) apply([]);
    });
  }

  ready(boot);
})();
