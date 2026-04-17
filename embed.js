/*!
 * Gamey Calendar Embed Widget v1.0
 * Script-based embed for gamey.kr main page
 * Usage:
 *   <div id="gamey-calendar-embed"></div>
 *   <script src="https://calendar.gamey.kr/embed.js" async></script>
 */
(function () {
  'use strict';

  /* ──────────── 설정 ──────────── */
  var TARGET_ID  = 'gamey-calendar-embed';
  var CAL_URL    = 'https://calendar.gamey.kr';
  var CACHE_KEY  = 'gameycal_embed_v1';
  var CACHE_TTL  = 30 * 60 * 1000;        // 30분
  var LOOKAHEAD  = 60;                    // 며칠 이후까지 조회
  var SHOW_MAX   = 4;                     // 노출 카드 수

  /* Cloudflare Scrape Shield 우회를 위해 문자열 분할 */
  var API_KEY = 'AIzaSy' + 'AaiSdUHdN0HoWv8wHHcMUru9mmm9JG3NQ';
  var CALS = {
    '출시':   'gameykr' + '2014' + '@' + 'gmail.com',
    '테스트': 'f2880cff5e99faebaf4d5184738db9414935f9468e61e0bb10bcec8d586ec9c5' + '@group.calendar.google.com',
    '예약':   'd5fccae3b724970effa9b7882a51e81bbbaefa3b6b572159d8f683e32d42f40c' + '@group.calendar.google.com',
    '기록':   'e4f85cc2ea47dde5db3dc375623fbc187a9965fd935d8eb0e51cd2f3df284567' + '@group.calendar.google.com',
    '행사':   'f72981731cc97bd97de58680a9ea4efe1aa9054e4c7fbac4680b87b5917e5fed' + '@group.calendar.google.com'
  };
  var COLOR = {
    '출시':   '#e11d48',
    '테스트': '#7c3aed',
    '예약':   '#d97706',
    '기록':   '#059669',
    '행사':   '#2563eb'
  };
  var DAYS = ['일', '월', '화', '수', '목', '금', '토'];

  /* ──────────── DOM 준비 ──────────── */
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* ──────────── 유틸 ──────────── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function parseTitle(summary) {
    if (!summary) return '';
    // 게임명(영어병기)[PC/NS] → 플랫폼 대괄호만 제거
    var s = summary.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
    // 영어병기 괄호는 남겨두되 너무 길면 제거
    return s;
  }

  function parsePlatforms(summary) {
    if (!summary) return [];
    var m = summary.match(/\[([^\]]+)\]\s*$/);
    if (!m) return [];
    return m[1].split(/[\/,\s]+/).map(function (x) {
      x = x.toUpperCase();
      if (x === 'PC') return 'PC';
      if (/^PS/.test(x) || x === '플스') return 'PS';
      if (/^(XB|XS|XBOX)/.test(x)) return 'XB';
      if (/^(NS|NSW|SWITCH|닌텐도)/.test(x)) return 'NS';
      if (/^(MO|MOBILE|모바일|AOS|IOS|안드로이드)/.test(x)) return 'MO';
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

  /* ──────────── 데이터 로드 ──────────── */
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
    } catch (e) { /* 용량 초과 등 무시 */ }
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

  /* ──────────── 렌더 ──────────── */
  var CSS = [
    ':host { all: initial; display: block; font-family: "Noto Sans KR", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif; color: #1a1e2a; }',
    '* { box-sizing: border-box; }',
    '.gcw { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }',
    '.gcw-head { display:flex; align-items:center; justify-content:space-between; padding: 10px 14px; border-bottom: 1px solid #eef0f4; background: #fafbfc; }',
    '.gcw-brand { display:flex; align-items:center; gap: 8px; font-weight: 800; font-size: 13px; letter-spacing: -0.02em; color: #111827; }',
    '.gcw-brand-ico { width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #ff6b35, #e11d48); border-radius: 4px; color: #fff; font-size: 11px; font-weight: 900; }',
    '.gcw-brand-sub { font-size: 11px; font-weight: 500; color: #6b7280; margin-left: 2px; }',
    '.gcw-more { display:inline-flex; align-items:center; gap:3px; font-size: 11px; color: #2563eb; font-weight: 700; text-decoration: none; padding: 4px 8px; border-radius: 5px; transition: background .15s; }',
    '.gcw-more:hover { background: #eff6ff; }',
    '.gcw-more svg { width: 10px; height: 10px; }',
    '.gcw-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #eef0f4; }',
    '.gcw-card { background: #fff; padding: 10px 11px; text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 6px; min-height: 96px; transition: background .15s; cursor: pointer; position: relative; overflow: hidden; }',
    '.gcw-card:hover { background: #f8fafc; }',
    '.gcw-card::before { content:""; position:absolute; left:0; top:0; bottom:0; width:3px; background: var(--cat-color, #9ca3af); }',
    '.gcw-top { display:flex; align-items:center; gap: 5px; }',
    '.gcw-cat { font-size: 10px; font-weight: 800; color: var(--cat-color); padding: 2px 5px; border-radius: 3px; background: var(--cat-bg); letter-spacing: -0.02em; }',
    '.gcw-date { font-size: 11px; color: #6b7280; font-weight: 700; }',
    '.gcw-date-d { color: #111827; }',
    '.gcw-title { font-size: 12px; font-weight: 600; line-height: 1.35; color: #1f2937; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: keep-all; }',
    '.gcw-plats { display:flex; gap: 3px; flex-wrap: wrap; margin-top: auto; }',
    '.gcw-plat { font-size: 9px; color: #64748b; background: #f1f5f9; padding: 1px 4px; border-radius: 2px; font-weight: 600; }',
    '.gcw-empty { padding: 28px 14px; text-align:center; color: #9ca3af; font-size: 12px; }',
    '.gcw-skel { padding: 12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; }',
    '.gcw-skel-item { height: 72px; background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%); background-size: 200% 100%; border-radius: 4px; animation: gcw-shimmer 1.2s infinite; }',
    '@keyframes gcw-shimmer { 0%{background-position:200% 0;} 100%{background-position:-200% 0;} }',
    /* 모바일 */
    '@media (max-width: 640px) {',
    '  .gcw-grid { grid-template-columns: repeat(2, 1fr); }',
    '  .gcw-skel { grid-template-columns: repeat(2, 1fr); }',
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
      return '<div class="gcw-empty">예정된 일정이 없습니다</div>';
    }
    var cards = events.map(function (ev) {
      var d = fmtDate(ev.date);
      var color = COLOR[ev.cat] || '#9ca3af';
      var bg = hexToRgba(color, 0.1);
      var plats = (ev.plats || []).slice(0, 3).map(function (p) {
        return '<span class="gcw-plat">' + esc(p) + '</span>';
      }).join('');
      return (
        '<a class="gcw-card" href="' + CAL_URL + '" target="_blank" rel="noopener" ' +
        'style="--cat-color:' + color + ';--cat-bg:' + bg + '">' +
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
          '<a class="gcw-brand" href="' + CAL_URL + '" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">' +
            '<span class="gcw-brand-ico">G</span>' +
            '<span>게임와이 캘린더</span>' +
            '<span class="gcw-brand-sub">· 다가오는 일정</span>' +
          '</a>' +
          '<a class="gcw-more" href="' + CAL_URL + '" target="_blank" rel="noopener">' +
            '4월 전체 보기' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 6l6 6-6 6"/></svg>' +
          '</a>' +
        '</div>' +
        inner +
      '</div>'
    );
  }

  /* ──────────── 부팅 ──────────── */
  function boot() {
    var host = document.getElementById(TARGET_ID);
    if (!host) return;

    // Shadow DOM (지원 안 되면 일반 div 폴백)
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
      // Shadow DOM 미지원 폴백: scoped prefix 사용 (부모 CSS 간섭 가능성 존재)
      host.innerHTML = '<style>' + CSS.replace(/:host/g, '.gcw-host') + '</style>' +
                       '<div class="gcw-host">' + buildHTML(buildSkeleton()) + '</div>';
    }

    function apply(events) {
      var container = root.querySelector('.gcw');
      if (!container) return;
      // head는 유지하고 body만 교체
      var head = container.querySelector('.gcw-head');
      container.innerHTML = '';
      if (head) container.appendChild(head);
      var bodyDiv = document.createElement('div');
      bodyDiv.innerHTML = buildBody(events);
      while (bodyDiv.firstChild) container.appendChild(bodyDiv.firstChild);
    }

    // 캐시 우선 → 백그라운드 리프레시
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
