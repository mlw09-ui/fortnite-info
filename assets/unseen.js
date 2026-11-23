/* "Langst niet gezien": items with a shopHistory, longest time since their last shop appearance first. */
(function () {
  'use strict';

  var PAGE = 60;

  var $count = document.getElementById('count');
  var $grid = document.getElementById('grid');
  var $more = document.getElementById('more');

  var all = [], seasons = null, type = '', list = [], shown = 0, today = FN.todayUtc();

  Promise.all([FN.loadSeasons(), FN.getJson('data/items.json')]).then(function (res) {
    seasons = res[0];
    // Only shop items: battle pass / event items never come back.
    all = res[1].filter(function (it) { return it.l; });
    all.sort(function (a, b) {
      return a.l < b.l ? -1 : a.l > b.l ? 1 : a.n.localeCompare(b.n, 'en', { sensitivity: 'base' });
    });
    render();
  }).catch(function (err) {
    console.error(err);
    $count.textContent = 'Kon de items niet laden. Probeer de pagina te vernieuwen.';
  });

  FN.bindTypeButtons(document.querySelector('.type-buttons'), function (t) { type = t; render(); });
  $more.addEventListener('click', function () { showMore(); });

  function extraHtml(it) {
    var days = FN.daysBetween(it.l, today);
    var label = days <= 0 ? 'Vandaag in de shop' : days === 1 ? '1 dag niet gezien' : FN.formatNumber(days) + ' dagen niet gezien';
    return '<div class="card-extra"><span>' + label + '</span>' +
      '<span class="sub when">' + FN.escapeHtml(FN.dateWithSeason(seasons, it.l)) + '</span></div>';
  }

  function render() {
    list = all.filter(function (it) { return !type || it.t === type; });
    $count.textContent = FN.formatNumber(list.length) + (list.length === 1 ? ' item' : ' items');
    $grid.innerHTML = '';
    shown = 0;
    if (!list.length) $grid.innerHTML = '<p class="empty">Geen items gevonden.</p>';
    showMore();
  }

  function showMore() {
    var next = list.slice(shown, shown + PAGE);
    $grid.insertAdjacentHTML('beforeend', next.map(function (it) { return FN.cardHtml(it, seasons, extraHtml(it)); }).join(''));
    shown += next.length;
    var left = list.length - shown;
    $more.hidden = left <= 0;
    $more.textContent = 'Toon meer (nog ' + FN.formatNumber(left) + ')';
  }
})();
