/**
 * 플레이어 표시 (닉네임만)
 */
var PlayerUi = (function () {
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function normalizeNickname(input) {
    var trimmed = (input || '').trim();
    if (!trimmed) {
      throw new Error('닉네임을 입력하세요.');
    }
    return trimmed;
  }

  function formatDisplayName(user) {
    return user && user.nickname ? user.nickname : '';
  }

  function renderNameHtml(user) {
    return escapeHtml(formatDisplayName(user));
  }

  function avatarLetter(user) {
    var name = formatDisplayName(user);
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  function renderAvatar(user, extraClass) {
    var cls = 'player-avatar' + (extraClass ? ' ' + extraClass : '');
    return '<span class="' + cls + '" aria-hidden="true">' + escapeHtml(avatarLetter(user)) + '</span>';
  }

  function compareBySortOrder(a, b) {
    var ao = a.sortOrder != null ? a.sortOrder : 999999;
    var bo = b.sortOrder != null ? b.sortOrder : 999999;
    if (ao !== bo) return ao - bo;
    return (a.registeredAt || '').localeCompare(b.registeredAt || '');
  }

  return {
    normalizeNickname: normalizeNickname,
    formatDisplayName: formatDisplayName,
    renderNameHtml: renderNameHtml,
    renderAvatar: renderAvatar,
    escapeHtml: escapeHtml,
    compareBySortOrder: compareBySortOrder
  };
})();
