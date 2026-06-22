/**
 * 사이트 공통 메뉴 — 항목 추가/수정은 MENU_ITEMS 만 편집
 */
var SiteNav = (function () {
  var MENU_ITEMS = [
    { id: 'party', label: '파티', href: 'party.html' },
    { id: 'users', label: '유저 등록', href: 'users.html' },
    { id: 'history', label: '전적', href: 'history.html' }
  ];

  function render(container) {
    if (!container) return;

    var current = container.getAttribute('data-page') || '';
    var html = '';

    for (var i = 0; i < MENU_ITEMS.length; i++) {
      var item = MENU_ITEMS[i];
      var active = item.id === current ? ' nav__link--active' : '';
      html += '<a href="' + item.href + '" class="nav__link' + active + '">' + item.label + '</a>';
    }

    container.className = 'nav';
    container.innerHTML = html;
  }

  function init() {
    var container = document.getElementById('site-nav');
    render(container);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    MENU_ITEMS: MENU_ITEMS,
    render: render
  };
})();
