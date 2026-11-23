/* Favorieten: all favorited items (localStorage), newest favorite first. */
(function () {
  'use strict';

  var $count = document.getElementById('count');
  var $grid = document.getElementById('grid');
  document.getElementById('no-storage').hidden = FN.favs.storageOk();

  var EMPTY = '<p class="empty-box">Nog geen favorieten. Klik op een ♥ om er een toe te voegen.</p>';

  Promise.all([FN.loadSeasons(), FN.getJson('data/items.json')]).then(function (res) {
    var seasons = res[0];
    var byId = {};
    res[1].forEach(function (it) { byId[it.id] = it; });
    // Ids that no longer exist in the data are skipped.
    var list = FN.favs.list().map(function (id) { return byId[id]; }).filter(Boolean);
    $grid.innerHTML = list.length ? list.map(function (it) { return FN.cardHtml(it, seasons); }).join('') : EMPTY;
    updateCount();
  }).catch(function (err) {
    console.error(err);
    $count.textContent = 'Kon de items niet laden. Probeer de pagina te vernieuwen.';
  });

  // Un-hearting a card here removes it from the page right away.
  document.addEventListener('favchange', function (e) {
    if (e.detail.on) return;
    var btn = $grid.querySelector('.heart[data-fav="' + CSS.escape(e.detail.id) + '"]');
    if (btn) btn.closest('.card').remove();
    if (!$grid.querySelector('.card')) $grid.innerHTML = EMPTY;
    updateCount();
  });

  function updateCount() {
    var n = $grid.querySelectorAll('.card').length;
    $count.textContent = n === 1 ? '1 favoriet' : FN.formatNumber(n) + ' favorieten';
  }
})();
