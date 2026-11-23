/* "Vandaag in de shop": today's skins, pickaxes, gliders and back blings with their V-Bucks price.
   data/shop.json is written by build.ps1 from /v2/shop (never fetched from the API in the browser). */
(function () {
  'use strict';

  var $date = document.getElementById('shop-date');
  var $stale = document.getElementById('stale');
  var $count = document.getElementById('count');
  var $grid = document.getElementById('grid');
  var esc = FN.escapeHtml;

  var shop = null, seasons = null, type = '';

  Promise.all([FN.loadSeasons(), FN.getJson('data/shop.json')]).then(function (res) {
    seasons = res[0];
    shop = res[1];
    $date.textContent = 'Item shop van ' + FN.formatDate(shop.date);
    var age = FN.daysBetween(shop.date, FN.todayUtc());
    if (age > 0) {
      $stale.textContent = 'Let op: dit is de shop van ' + FN.formatDate(shop.date) +
        '. De shop van vandaag verschijnt na de dagelijkse update (rond 00:15 UTC).';
      $stale.hidden = false;
    }
    render();
  }).catch(function (err) {
    console.error(err);
    $date.textContent = 'De item shop kon niet geladen worden.';
  });

  FN.bindTypeButtons(document.querySelector('.type-buttons'), function (t) { type = t; render(); });

  function priceHtml(it) {
    var html = '<div class="card-extra">';
    html += '<span class="vbucks">' + FN.formatNumber(it.price) + '</span>';
    if (it.regular > it.price) html += '<span class="strike">' + FN.formatNumber(it.regular) + '</span>';
    if (it.bundle) {
      html += '<span class="chip">Bundel</span>';
      // Only name the bundle when it isn't simply named after this item.
      if (it.bundleName && it.bundleName.toLowerCase() !== it.n.toLowerCase()) html += '<span class="sub" title="' + esc(it.bundleName) + '">' + esc(it.bundleName) + '</span>';
    }
    return html + '</div>';
  }

  function render() {
    var list = shop.items.filter(function (it) { return !type || it.t === type; });
    $count.textContent = list.length === 1 ? '1 item' : FN.formatNumber(list.length) + ' items';
    if (!list.length) {
      $grid.innerHTML = '<p class="empty">Geen items van dit type in de shop vandaag.</p>';
      return;
    }
    $grid.innerHTML = list.map(function (it) { return FN.cardHtml(it, seasons, priceHtml(it)); }).join('');
  }
})();
