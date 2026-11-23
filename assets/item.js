/* Item page: details, release, last availability, last price, variants. */
(function () {
  'use strict';

  var $main = document.getElementById('item');
  var id = new URLSearchParams(location.search).get('id');

  // "Terug": go back to the search results if we came from this site, else to the home page.
  document.getElementById('back').addEventListener('click', function (e) {
    if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });

  if (!id) { notFound(); return; }

  Promise.all([
    FN.loadSeasons(),
    FN.getJson('data/detail/' + FN.shardOf(id) + '.json'),
    FN.getJson('data/prices.json').catch(function () { return {}; })
  ]).then(function (res) {
    var item = res[1][id];
    if (!item) { notFound(); return; }
    render(item, res[0], res[2][id] || []);
  }).catch(function (err) {
    console.error(err);
    $main.innerHTML = '<p class="loading">Kon dit item niet laden. Probeer de pagina te vernieuwen.</p>';
  });

  function notFound() {
    document.title = 'Item niet gevonden — fortnite-info';
    $main.innerHTML = '<p class="loading">Dit item bestaat niet (meer). <a href="index.html">Terug naar zoeken</a></p>';
  }

  var esc = FN.escapeHtml;

  var ICONS = {
    calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    shop: '<svg viewBox="0 0 24 24"><path d="M4 9h16l-1 11H5z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/></svg>',
    repeat: '<svg viewBox="0 0 24 24"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
    vbucks: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 8l3.5 8 3.5-8"/></svg>'
  };

  function infoBox(icon, label, main, sub) {
    return '<div class="info-box">' +
      '<span class="info-icon" aria-hidden="true">' + ICONS[icon] + '</span>' +
      '<div><div class="info-label">' + label + '</div>' +
      '<div class="info-main">' + main + '</div>' +
      (sub ? '<div class="info-sub">' + sub + '</div>' : '') +
      '</div></div>';
  }

  function render(item, seasons, prices) {
    document.title = item.name + ' — fortnite-info';

    var shopDates = item.shopHistory || [];
    var introSeason = item.intro >= 0 ? seasons[item.intro] : null;
    var color = FN.cardColor(item.rarity, item.series && item.series.colors[0]);
    var bgImage = item.series && item.series.image ? 'url(' + item.series.image + ')' : 'none';

    // 1. Uitgekomen in
    var released;
    if (shopDates.length) {
      released = esc(FN.dateWithSeason(seasons, shopDates[0]));
    } else if (introSeason) {
      var end = introSeason.end ? FN.formatMonth(introSeason.end) : 'nu';
      released = esc(introSeason.label) + ' <span class="muted">(' + FN.formatMonth(introSeason.start) + ' – ' + end + ')</span>';
    } else {
      released = 'Onbekend';
    }

    // 2. Laatst verkrijgbaar + 3. In de shop
    var lastBox, countBox = '';
    if (shopDates.length) {
      var last = shopDates[shopDates.length - 1];
      var ago = FN.daysBetween(last, FN.todayUtc());
      var agoText = ago <= 0 ? 'Vandaag in de shop' : ago === 1 ? '1 dag geleden' : FN.formatNumber(ago) + ' dagen geleden';
      lastBox = infoBox('shop', 'Laatst verkrijgbaar', esc(FN.dateWithSeason(seasons, last)), agoText);
      countBox = infoBox('repeat', 'In de shop', shopDates.length === 1 ? '1 keer' : FN.formatNumber(shopDates.length) + ' keer');
    } else {
      lastBox = infoBox('shop', 'Laatst verkrijgbaar', 'Nooit in de item shop', 'Battle pass / event / anders');
    }

    // 4. Laatste prijs (section 3c)
    var priceMain, priceSub = '';
    if (!shopDates.length && !prices.length) {
      priceMain = 'Niet te koop';
      priceSub = 'Battle pass / event';
    } else {
      var single = null, bundle = null;
      for (var i = prices.length - 1; i >= 0; i--) {
        if (!prices[i].bundle && !single) single = prices[i];
        if (prices[i].bundle && !bundle) bundle = prices[i];
      }
      if (single) {
        priceMain = FN.formatNumber(single.price) + ' V-Bucks';
        priceSub = 'Los gekocht, op ' + FN.formatDate(single.date);
      } else if (bundle) {
        priceMain = FN.formatNumber(bundle.price) + ' V-Bucks <span class="muted">(in bundel)</span>';
        priceSub = (bundle.bundleName ? 'In bundel “' + esc(bundle.bundleName) + '”, ' : 'In een bundel, ') + 'op ' + FN.formatDate(bundle.date);
      } else {
        priceMain = 'Prijs nog onbekend';
        priceSub = 'We houden prijzen bij vanaf de lancering van deze site.';
      }
    }

    // 5. Varianten — style images from the API are small icons, so they never replace the main render.
    // Tiles and the preview show each icon at its natural size at most (never upscaled).
    var variants = [];
    (item.variants || []).forEach(function (ch) {
      (ch.options || []).forEach(function (o) {
        variants.push({ name: o.name || '?', image: o.image, channel: ch.channel });
      });
    });
    var hasVariants = variants.length > 0;

    var variantsHtml = hasVariants
      ? '<div class="variants" style="--c:' + color + '">' +
          '<figure class="variant-preview" aria-live="polite">' +
            '<div class="variant-preview-img"><img id="variant-preview-img" src="' + esc(variants[0].image) + '" alt=""></div>' +
            '<figcaption id="variant-preview-name">' + esc(variants[0].name) + '</figcaption>' +
          '</figure>' +
          '<div class="variant-row">' + variants.map(function (v, idx) {
            return '<button type="button" class="variant' + (idx === 0 ? ' active' : '') + '" data-idx="' + idx + '" aria-pressed="' + (idx === 0) + '" title="' + esc(v.channel ? v.channel + ': ' + v.name : v.name) + '">' +
              '<span class="variant-img"><img loading="lazy" src="' + esc(v.image) + '" alt="" onerror="this.remove()"></span>' +
              '<span class="variant-name">' + esc(v.name) + '</span></button>';
          }).join('') + '</div>' +
        '</div>'
      : '<p class="muted">Geen varianten</p>';

    // Uit dezelfde set — hidden when the item has no set or is the only item in it.
    var setItems = item.setItems || [];
    var setHtml = item.set && setItems.length
      ? '<section class="item-section">' +
          '<h2 class="section-title">Uit dezelfde set</h2>' +
          '<p class="page-sub">' + esc(item.set) + ' · ' + (setItems.length === 1 ? '1 ander item' : setItems.length + ' andere items') + '</p>' +
          '<div class="grid">' + setItems.map(function (c) { return FN.cardHtml(c, seasons); }).join('') + '</div>' +
        '</section>'
      : '';

    // 6. Bekijk in 3D — the in-game showcase video, only when the API has one.
    var videoHtml = item.video
      ? '<section class="item-section">' +
          '<h2 class="section-title">Bekijk in 3D</h2>' +
          '<div class="video-wrap">' +
            '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(item.video) + '?rel=0" ' +
              'title="' + esc(item.name) + ' in 3D" loading="lazy" ' +
              'allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen ' +
              'referrerpolicy="strict-origin-when-cross-origin"></iframe>' +
          '</div>' +
        '</section>'
      : '';

    $main.innerHTML =
      '<section class="item-top">' +
        '<div class="item-visual" style="--c:' + color + ';--series-bg:' + bgImage + '">' +
          '<img id="big-img" src="' + esc(item.image) + '" alt="' + esc(item.name) + '">' +
        '</div>' +
        '<div class="item-info">' +
          '<div class="badges">' +
            '<span class="badge" style="background:' + color + '">' + esc(item.rarityName) + '</span>' +
            '<span class="badge badge-dark">' + FN.typeName(item.type) + '</span>' +
          '</div>' +
          '<div class="name-row">' +
            '<h1 class="item-name">' + esc(item.name) + '</h1>' +
            FN.heartHtml(item.id, 'heart-big') +
          '</div>' +
          '<p class="item-desc">' + esc(item.description || '') + '</p>' +
          '<div class="info-list">' +
            infoBox('calendar', 'Uitgekomen in', released) +
            lastBox +
            countBox +
            infoBox('vbucks', 'Laatste prijs', priceMain, priceSub) +
          '</div>' +
        '</div>' +
      '</section>' +
      '<section class="item-section">' +
        '<h2 class="section-title">Varianten</h2>' +
        variantsHtml +
      '</section>' +
      setHtml +
      videoHtml;

    if (hasVariants) {
      var $preview = document.getElementById('variant-preview-img');
      var $previewName = document.getElementById('variant-preview-name');
      var buttons = $main.querySelectorAll('.variant');
      Array.prototype.forEach.call(buttons, function (b) {
        b.addEventListener('click', function () {
          var v = variants[Number(b.dataset.idx)];
          $preview.src = v.image || '';
          $previewName.textContent = v.name;
          Array.prototype.forEach.call(buttons, function (x) {
            x.classList.toggle('active', x === b);
            x.setAttribute('aria-pressed', String(x === b));
          });
        });
      });
    }
  }
})();
