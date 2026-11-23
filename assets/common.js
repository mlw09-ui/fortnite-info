/* Shared helpers for every page. Plain script, exposes window.FN. */
(function () {
  'use strict';

  var SHARDS = 128; // must match $SHARDS in build.ps1

  var MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  var MONTHS_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

  var TYPE_NAMES = { outfit: 'Skin', pickaxe: 'Pickaxe', glider: 'Glider', backpack: 'Back Bling' };

  var RARITY_COLORS = {
    common: '#7f8590',
    uncommon: '#3d8f2e',
    rare: '#2f72c4',
    epic: '#8b44c7',
    legendary: '#d0721f',
    mythic: '#c9a227'
  };

  // Higher = rarer. Series (Icon, Marvel, …) sit between legendary and epic.
  var RARITY_RANK = { mythic: 7, legendary: 6, epic: 4, rare: 3, uncommon: 2, common: 1 };

  function rarityRank(r) {
    if (r in RARITY_RANK) return RARITY_RANK[r];
    return 5; // any series rarity
  }

  function getJson(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error(url + ': ' + res.status);
      return res.json();
    });
  }

  var seasonsPromise = null;
  function loadSeasons() {
    if (!seasonsPromise) seasonsPromise = getJson('seasons.json').then(function (j) { return j.seasons; });
    return seasonsPromise;
  }

  function shardOf(id) {
    var sum = 0;
    for (var i = 0; i < id.length; i++) sum += id.charCodeAt(i);
    return sum % SHARDS;
  }

  // 'yyyy-mm-dd' -> '14 maart 2024'
  function formatDate(day) {
    var p = day.split('-');
    return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1] + ' ' + p[0];
  }

  function formatMonth(day) {
    var p = day.split('-');
    return MONTHS_SHORT[Number(p[1]) - 1] + ' ' + p[0];
  }

  // Last season whose start <= day.
  function seasonForDate(seasons, day) {
    var found = null;
    for (var i = 0; i < seasons.length; i++) {
      if (seasons[i].start <= day) found = seasons[i];
    }
    return found;
  }

  // '14 maart 2024 · Chapter 5 Season 2'
  function dateWithSeason(seasons, day) {
    var s = seasonForDate(seasons, day);
    return formatDate(day) + (s ? ' · ' + s.label : '');
  }

  // Short tag for cards: C5 S2, C4 OG, C2 Remix, C6 M1, C7 Mini
  function seasonShort(s) {
    if (!s) return '';
    var season = String(s.season);
    var part;
    if (/^\d+$/.test(season) || season === 'X') part = 'S' + season;
    else if (/^Mini \d+$/.test(season)) part = 'M' + season.slice(5);
    else part = season;
    return 'C' + s.chapter + ' ' + part;
  }

  function todayUtc() {
    return new Date().toISOString().slice(0, 10);
  }

  function daysBetween(fromDay, toDay) {
    return Math.round((Date.parse(toDay + 'T00:00:00Z') - Date.parse(fromDay + 'T00:00:00Z')) / 86400000);
  }

  function formatNumber(n) {
    return n.toLocaleString('nl-NL');
  }

  // API colors are RRGGBBAA.
  function apiColor(c) {
    return c ? '#' + c.slice(0, 6) : null;
  }

  function cardColor(rarity, seriesColor) {
    return apiColor(seriesColor) || RARITY_COLORS[rarity] || RARITY_COLORS.common;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function typeName(t) {
    return TYPE_NAMES[t] || t;
  }

  function itemUrl(id) {
    return 'item.html?id=' + encodeURIComponent(id);
  }

  // ---------- favorites (localStorage, no accounts) ----------
  // Every read/write is wrapped in try/catch: when storage is blocked the hearts still work for this page view.
  var FAV_KEY = 'sitename-favorites';
  var favMemory = null;

  function readFavs() {
    if (favMemory) return favMemory;
    var list = [];
    try {
      var raw = window.localStorage.getItem(FAV_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) list = parsed.filter(function (x) { return typeof x === 'string'; });
    } catch (e) { /* storage unavailable or corrupt: start empty */ }
    favMemory = list;
    return list;
  }

  var favStorageOk = (function () {
    try {
      var k = FAV_KEY + '-test';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();

  function writeFavs(list) {
    favMemory = list;
    try { window.localStorage.setItem(FAV_KEY, JSON.stringify(list)); } catch (e) { /* keep in memory only */ }
  }

  var favs = {
    list: function () { return readFavs().slice(); },
    has: function (id) { return readFavs().indexOf(id) >= 0; },
    storageOk: function () { return favStorageOk; },
    toggle: function (id) {
      var list = readFavs().slice();
      var i = list.indexOf(id);
      if (i >= 0) list.splice(i, 1); else list.unshift(id); // newest favorite first
      writeFavs(list);
      var on = i < 0;
      syncHearts(id, on);
      document.dispatchEvent(new CustomEvent('favchange', { detail: { id: id, on: on } }));
      return on;
    }
  };

  // Another tab changed the favorites.
  window.addEventListener('storage', function (e) {
    if (e.key !== FAV_KEY) return;
    favMemory = null;
    Array.prototype.forEach.call(document.querySelectorAll('.heart[data-fav]'), function (b) {
      setHeart(b, favs.has(b.dataset.fav));
    });
  });

  var HEART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>';

  function setHeart(btn, on) {
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Verwijderen uit favorieten' : 'Toevoegen aan favorieten');
    btn.title = on ? 'Verwijderen uit favorieten' : 'Toevoegen aan favorieten';
  }

  function syncHearts(id, on) {
    Array.prototype.forEach.call(document.querySelectorAll('.heart[data-fav]'), function (b) {
      if (b.dataset.fav === id) setHeart(b, on);
    });
  }

  function heartHtml(id, extraClass) {
    var on = favs.has(id);
    var label = on ? 'Verwijderen uit favorieten' : 'Toevoegen aan favorieten';
    return '<button type="button" class="heart' + (extraClass ? ' ' + extraClass : '') + (on ? ' on' : '') + '" data-fav="' + escapeHtml(id) + '"' +
      ' aria-pressed="' + on + '" aria-label="' + label + '" title="' + label + '">' + HEART_SVG + '</button>';
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.heart[data-fav]');
    if (!btn) return;
    e.preventDefault();
    favs.toggle(btn.dataset.fav);
  });

  // ---------- item card ----------
  // it: an entry from data/items.json (id, n, t, r, rd, sc, si, i). seasons: from seasons.json.
  // extraHtml: optional extra line(s) under the type, e.g. a price or "X dagen niet gezien".
  function cardHtml(it, seasons, extraHtml) {
    var season = it.si >= 0 && seasons ? seasons[it.si] : null;
    var tag = seasonShort(season);
    return '<div class="card" style="--c:' + cardColor(it.r, it.sc) + '">' +
      '<a class="card-link" href="' + itemUrl(it.id) + '">' +
        '<div class="card-img">' +
          (tag ? '<span class="tag">' + tag + '</span>' : '') +
          '<img loading="lazy" decoding="async" src="' + escapeHtml(it.i) + '" alt="" onerror="this.remove()">' +
        '</div>' +
        '<div class="card-body">' +
          '<div class="card-name">' + escapeHtml(it.n) + '</div>' +
          '<div class="card-meta">' + typeName(it.t) + ' · ' + escapeHtml(it.rd) + '</div>' +
          (extraHtml || '') +
        '</div>' +
      '</a>' +
      heartHtml(it.id, 'heart-card') +
    '</div>';
  }

  // Type filter buttons (Alles / Skins / …) shared by several pages.
  function bindTypeButtons(container, onChange) {
    var buttons = Array.prototype.slice.call(container.querySelectorAll('.pill'));
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        buttons.forEach(function (x) { x.classList.toggle('active', x === b); });
        onChange(b.dataset.type);
      });
    });
  }

  window.FN = {
    getJson: getJson,
    loadSeasons: loadSeasons,
    shardOf: shardOf,
    formatDate: formatDate,
    formatMonth: formatMonth,
    seasonForDate: seasonForDate,
    dateWithSeason: dateWithSeason,
    seasonShort: seasonShort,
    todayUtc: todayUtc,
    daysBetween: daysBetween,
    formatNumber: formatNumber,
    apiColor: apiColor,
    cardColor: cardColor,
    escapeHtml: escapeHtml,
    typeName: typeName,
    itemUrl: itemUrl,
    rarityRank: rarityRank,
    favs: favs,
    heartHtml: heartHtml,
    cardHtml: cardHtml,
    bindTypeButtons: bindTypeButtons,
    RARITY_COLORS: RARITY_COLORS
  };
})();
