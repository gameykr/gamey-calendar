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

  /* HTML \uD0DC\uADF8 \uC81C\uAC70 (Google Calendar \uC124\uBA85\uC774 <p> <br>\uB85C \uB098\uC634) */
  function stripHtml(str) {
    if (!str) return '';
    return str
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  }

  /* description\uC5D0\uC11C "\uC774\uBBF8\uC9C0:URL" \uC0AC\uC2B5 \uCD94\uCD9C */
  function parseImage(desc) {
    if (!desc) return '';
    var text = stripHtml(desc);
    var m = text.match(/\uC774\uBBF8\uC9C0\s*[:\uFF1A]\s*(\S+)/);
    if (m && /^https?:\/\//i.test(m[1])) return m[1];
    return '';
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
            plats: parsePlatforms(it.summary || ''),
            img:   parseImage(it.description || '')
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
    /* \uCEE8\ud14c\uc774\ub108 */
    '.gcw { position: relative; background: radial-gradient(ellipse at top left, #1a1033 0%, #0a0a1a 50%, #050510 100%); border-radius: 12px; overflow: hidden; box-shadow: 0 0 0 1px rgba(255, 46, 108, 0.25), 0 0 30px rgba(255, 46, 108, 0.12), 0 0 60px rgba(0, 229, 255, 0.08), 0 10px 40px rgba(0, 0, 0, 0.4); }',
    '.gcw::before { content:""; position:absolute; inset:0; background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px); background-size: 24px 24px; pointer-events: none; z-index: 0; }',
    '.gcw::after { content:""; position:absolute; top:0; left:0; right:0; height:1px; background: linear-gradient(90deg, transparent, #ff2e6c 20%, #00e5ff 80%, transparent); opacity:.8; z-index:1; }',
    /* \ud5e4\ub354 */
    '.gcw-head { position:relative; z-index:2; display:flex; align-items:center; justify-content:space-between; padding: 11px 14px; border-bottom: 1px solid rgba(255,46,108,0.15); background: linear-gradient(180deg, rgba(255,46,108,0.08), transparent); }',
    '.gcw-brand { display:flex; align-items:center; gap: 9px; font-weight: 800; font-size: 13px; text-decoration:none; color: #fff; }',
    '.gcw-brand-img { width: 22px; height: 22px; border-radius: 5px; object-fit: cover; box-shadow: 0 0 12px rgba(255,46,108,0.5), 0 0 4px rgba(255,46,108,0.8); background: #1a0818; flex-shrink:0; }',
    '.gcw-brand-txt { background: linear-gradient(135deg, #ff2e6c, #00e5ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: 0.08em; text-transform: uppercase; font-size: 12px; font-weight: 900; }',
    '.gcw-brand-sub { font-size: 10px; font-weight: 600; color: #6b7280; letter-spacing: 0.05em; text-transform: uppercase; }',
    '.gcw-more { display:inline-flex; align-items:center; gap:4px; font-size: 11px; color: #00e5ff; font-weight: 800; text-decoration: none; padding: 5px 10px; border: 1px solid rgba(0,229,255,0.4); border-radius: 4px; transition: all .2s; text-transform: uppercase; letter-spacing: 0.05em; background: rgba(0,229,255,0.06); }',
    '.gcw-more:hover { background: rgba(0,229,255,0.18); border-color: #00e5ff; box-shadow: 0 0 12px rgba(0,229,255,0.5); }',
    '.gcw-more svg { width: 10px; height: 10px; }',
    /* \uadf8\ub9ac\ub4dc - 4\uce74\ub4dc */
    '.gcw-grid { position:relative; z-index:2; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: rgba(255,46,108,0.15); padding: 1px; }',
    /* \uc378\ub124\uc77c \uce74\ub4dc */
    '.gcw-card { position: relative; display: block; aspect-ratio: 3 / 4; background: #0a0a15; text-decoration: none; color: inherit; overflow: hidden; cursor: pointer; transition: transform .25s ease; }',
    '.gcw-card:hover { transform: translateY(-2px); z-index: 5; }',
    /* \uc774\ubbf8\uc9c0 */
    '.gcw-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; transition: transform .4s ease, filter .25s; filter: saturate(1.05); }',
    '.gcw-card:hover .gcw-img { transform: scale(1.08); filter: saturate(1.2) brightness(1.08); }',
    /* \uc774\ubbf8\uc9c0 \ub300\uccb4 \ud3f4\ubc31 */
    '.gcw-img-fallback { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background: linear-gradient(135deg, var(--cat-color, #6b7280) 0%, rgba(0,0,0,0.6) 100%); font-size: 40px; font-weight: 900; color: rgba(255,255,255,0.35); letter-spacing: 0.1em; }',
    '.gcw-img-fallback span { text-shadow: 0 0 20px var(--cat-color); }',
    /* \uadf8\ub77c\ub370\uc774\uc158 \uc624\ubc84\ub808\uc774 (\ud558\ub2e8 \ud14d\uc2a4\ud2b8 \uac00\ub3c5\uc131) */
    '.gcw-overlay { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.2) 40%, rgba(5,5,16,0.95) 100%); }',
    /* \uc0c1\ub2e8 \ub808\uc774\ube14 (\uce74\ud14c\uace0\ub9ac + \ub0a0\uc9dc) */
    '.gcw-tag { position: absolute; top: 8px; left: 8px; right: 8px; display: flex; align-items: center; justify-content: space-between; z-index: 2; gap: 6px; }',
    '.gcw-cat { font-size: 9px; font-weight: 900; color: #fff; padding: 3px 7px; border-radius: 2px; background: var(--cat-color); letter-spacing: 0.1em; text-transform: uppercase; box-shadow: 0 0 10px var(--cat-color), 0 2px 4px rgba(0,0,0,0.5); }',
    '.gcw-date { font-size: 10px; color: #fff; font-weight: 800; padding: 3px 6px; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); border-radius: 2px; letter-spacing: 0.02em; border: 1px solid rgba(255,255,255,0.1); }',
    '.gcw-date strong { font-size: 11px; color: var(--cat-color); text-shadow: 0 0 6px var(--cat-color); }',
    /* \ud558\ub2e8 \uc815\ubcf4 */
    '.gcw-info { position: absolute; left: 0; right: 0; bottom: 0; padding: 10px 12px 12px; z-index: 2; }',
    '.gcw-title { font-size: 12.5px; font-weight: 800; line-height: 1.3; color: #fff; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: keep-all; letter-spacing: -0.01em; margin-bottom: 6px; text-shadow: 0 1px 4px rgba(0,0,0,0.8); }',
    '.gcw-plats { display:flex; gap: 3px; flex-wrap: wrap; }',
    '.gcw-plat { font-size: 8.5px; color: #e6eaf5; background: rgba(255,255,255,0.15); padding: 1px 5px; border-radius: 2px; font-weight: 800; letter-spacing: 0.05em; backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.1); }',
    /* \ud638\ubc84 \uc2dc \ud558\ub2e8 \ub124\uc628 \ubc14 */
    '.gcw-card::after { content:""; position:absolute; left:0; right:0; bottom:0; height:2px; background: var(--cat-color); box-shadow: 0 0 10px var(--cat-color); transform: scaleX(0); transform-origin: left; transition: transform .3s ease; z-index: 3; }',
    '.gcw-card:hover::after { transform: scaleX(1); }',
    /* \ube48/\ub85c\ub529 */
    '.gcw-empty { padding: 40px 14px; text-align:center; color: #6b7280; font-size: 12px; position:relative; z-index:2; }',
    '.gcw-skel { position:relative; z-index:2; padding: 1px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: rgba(255,46,108,0.15); }',
    '.gcw-skel-item { aspect-ratio: 3/4; background: linear-gradient(135deg, rgba(255,46,108,0.08) 0%, rgba(0,229,255,0.08) 100%); background-size: 200% 200%; animation: gcw-shimmer 1.8s infinite; }',
    '@keyframes gcw-shimmer { 0%{background-position:0% 0%;} 50%{background-position:100% 100%;} 100%{background-position:0% 0%;} }',
    /* \ubaa8\ubc14\uc77c */
    '@media (max-width: 640px) {',
    '  .gcw-grid { grid-template-columns: repeat(2, 1fr); }',
    '  .gcw-skel { grid-template-columns: repeat(2, 1fr); }',
    '  .gcw-brand-sub { display:none; }',
    '  .gcw-more { padding: 4px 8px; font-size: 10px; }',
    '  .gcw-card { aspect-ratio: 4 / 3; }',
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
      var plats = (ev.plats || []).slice(0, 3).map(function (p) {
        return '<span class="gcw-plat">' + esc(p) + '</span>';
      }).join('');
      /* \uC774\uBBF8\uC9C0 \uC788\uC73C\uBA74 <img>, \uC5C6\uC73C\uBA74 \uCE74\uD14C\uACE0\uB9AC \uC0C9 \uADF8\uB77C\uB370\uC774\uC158 \uD3F4\uBC31 */
      var imgHtml = ev.img
        ? '<img class="gcw-img" src="' + esc(ev.img) + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
          '<div class="gcw-img-fallback" style="display:none"><span>' + esc(ev.cat) + '</span></div>'
        : '<div class="gcw-img-fallback"><span>' + esc(ev.cat) + '</span></div>';
      return (
        '<a class="gcw-card" href="' + CAL_URL + '" target="_blank" rel="noopener" ' +
        'style="--cat-color:' + color + '">' +
          imgHtml +
          '<div class="gcw-overlay"></div>' +
          '<div class="gcw-tag">' +
            '<span class="gcw-cat">' + esc(ev.cat) + '</span>' +
            '<span class="gcw-date"><strong>' + d.month + '.' + String(d.day).padStart(2,'0') + '</strong> ' + d.dow + '</span>' +
          '</div>' +
          '<div class="gcw-info">' +
            '<div class="gcw-title">' + esc(ev.title) + '</div>' +
            (plats ? '<div class="gcw-plats">' + plats + '</div>' : '') +
          '</div>' +
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
