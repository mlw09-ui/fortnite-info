/* Home page: live search + type buttons + chapter/season/sort filters. */
(function () {
  'use strict';

  var MAX_RESULTS = 60;
  var FEATURED_COUNT = 18;

  var $q = document.getElementById('q');
  var $chapter = document.getElementById('chapter');
  var $season = document.getElementById('season');
  var $sort = document.getElementById('sort');
  var $reset = document.getElementById('reset');
  var $count = document.getElementById('count');
  var $grid = document.getElementById('grid');
  var $more = document.getElementById('more');
  var typeButtons = Array.prototype.slice.call(document.querySelectorAll('.type-buttons .pill'));

  var items = [];
  var seasons = [];
  var featured = null;
  var state = { q: '', type: '', ch: '', s: '', sort: 'best' };

  $q.focus(); // backup for browsers that ignore autofocus

  Promise.all([FN.loadSeasons(), FN.getJson('data/items.json')]).then(function (res) {
    seasons = res[0];
    items = res[1];
    items.forEach(function (it) {
      it.lower = it.n.toLowerCase();
      var s = it.si >= 0 ? seasons[it.si] : null;
      it.season = s;
      // Release key for "newest/oldest": first shop date, else the start of the introduction season.
      it.rel = it.d || (s ? s.start : '');
    });
    fillChapters();
    readUrl();
    render();
  }).catch(function (err) {
    console.error(err);
    $count.textContent = 'Kon de items niet laden. Probeer de pagina te vernieuwen.';
  });

  // ---------- filters ----------

  function fillChapters() {
    var chapters = [];
    seasons.forEach(function (s) { if (chapters.indexOf(s.chapter) < 0) chapters.push(s.chapter); });
    chapters.sort(function (a, b) { return Number(a) - Number(b); });
    chapters.forEach(function (c) {
      $chapter.appendChild(new Option('Chapter ' + c, c));
    });
  }

  function fillSeasons() {
    $season.innerHTML = '';
    if (!state.ch) {
      $season.appendChild(new Option('Kies eerst een chapter', ''));
      $season.disabled = true;
      return;
    }
    $season.disabled = false;
    $season.appendChild(new Option('Alle seizoenen', ''));
    seasons.forEach(function (s, i) {
      if (s.chapter === state.ch) $season.appendChild(new Option(s.label + ' — ' + s.name, String(i)));
    });
  }

  function readUrl() {
    var p = new URLSearchParams(location.search);
    state.q = p.get('q') || '';
    state.type = p.get('type') || '';
    state.ch = p.get('ch') || '';
    state.s = p.get('s') || '';
    state.sort = p.get('sort') || 'best';
    if (!$chapter.querySelector('option[value="' + CSS.escape(state.ch) + '"]')) state.ch = '';
    syncControls();
  }

  function syncControls() {
    $q.value = state.q;
    typeButtons.forEach(function (b) { b.classList.toggle('active', b.dataset.type === state.type); });
    $chapter.value = state.ch;
    fillSeasons();
    $season.value = state.s;
    if ($season.value !== state.s) state.s = '';
    $sort.value = state.sort;
    if ($sort.value !== state.sort) { state.sort = 'best'; $sort.value = 'best'; }
  }

  function writeUrl() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.type) p.set('type', state.type);
    if (state.ch) p.set('ch', state.ch);
    if (state.s) p.set('s', state.s);
    if (state.sort !== 'best') p.set('sort', state.sort);
    var qs = p.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  }

  function update() {
    writeUrl();
    render();
  }

  $q.addEventListener('input', function () { state.q = $q.value; update(); });

  typeButtons.forEach(function (b) {
    b.addEventListener('click', function () {
      state.type = b.dataset.type;
      typeButtons.forEach(function (x) { x.classList.toggle('active', x === b); });
      update();
    });
  });

  $chapter.addEventListener('change', function () {
    state.ch = $chapter.value;
    state.s = ''; // changing chapter resets the season
    fillSeasons();
    update();
  });

  $season.addEventListener('change', function () { state.s = $season.value; update(); });
  $sort.addEventListener('change', function () { state.sort = $sort.value; update(); });

  $reset.addEventListener('click', function () {
    state.type = ''; state.ch = ''; state.s = ''; state.sort = 'best';
    syncControls();
    update();
    $q.focus();
  });

  // ---------- search ----------

  function hasFilters() {
    return !!(state.type || state.ch || state.s || state.sort !== 'best');
  }

  function byName(a, b) { return a.n.localeCompare(b.n, 'en', { sensitivity: 'base' }); }

  function compareRelease(a, b) {
    // Items without any date go last in both directions.
    if (!a.rel && !b.rel) return byName(a, b);
    if (!a.rel) return 1;
    if (!b.rel) return -1;
    if (a.si !== b.si) return a.si - b.si;
    return a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : byName(a, b);
  }

  function search() {
    var q = state.q.trim().toLowerCase();
    var seasonIdx = state.s === '' ? -1 : Number(state.s);
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (state.type && it.t !== state.type) continue;
      if (state.ch && (!it.season || it.season.chapter !== state.ch)) continue;
      if (seasonIdx >= 0 && it.si !== seasonIdx) continue;
      if (q) {
        var pos = it.lower.indexOf(q);
        if (pos < 0) continue;
        it.match = pos === 0 ? 0 : 1; // starts with → first, contains → after
      } else {
        it.match = 0;
      }
      out.push(it);
    }

    var cmp;
    switch (state.sort) {
      case 'az': cmp = byName; break;
      case 'za': cmp = function (a, b) { return byName(b, a); }; break;
      case 'new': cmp = function (a, b) {
        if (!a.rel || !b.rel) return compareRelease(a, b);
        return compareRelease(b, a);
      }; break;
      case 'old': cmp = compareRelease; break;
      case 'rarity': cmp = function (a, b) {
        return FN.rarityRank(b.r) - FN.rarityRank(a.r) || byName(a, b);
      }; break;
      default: cmp = function (a, b) { return a.match - b.match || byName(a, b); };
    }
    out.sort(cmp);
    return out;
  }

  function pickFeatured() {
    if (featured) return featured;
    var pool = items.filter(function (it) { return it.season && FN.rarityRank(it.r) >= 4; });
    featured = [];
    while (featured.length < FEATURED_COUNT && pool.length) {
      featured.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return featured;
  }

  // ---------- render ----------

  function render() {
    var list, total;
    if (!state.q.trim() && !hasFilters()) {
      list = pickFeatured();
      $count.textContent = 'Uitgelicht — begin met typen om te zoeken';
      $more.hidden = true;
    } else {
      var results = search();
      total = results.length;
      list = results.slice(0, MAX_RESULTS);
      $count.textContent = total === 1 ? '1 resultaat' : FN.formatNumber(total) + ' resultaten';
      if (total > MAX_RESULTS) {
        $more.textContent = 'en ' + FN.formatNumber(total - MAX_RESULTS) + ' meer — typ verder om te verfijnen';
        $more.hidden = false;
      } else {
        $more.hidden = true;
      }
    }

    if (!list.length) {
      $grid.innerHTML = '<p class="empty">Niks gevonden met deze filters.</p>';
      return;
    }
    $grid.innerHTML = list.map(cardHtml).join('');
  }

  function cardHtml(it) {
    return FN.cardHtml(it, seasons);
  }
})();
