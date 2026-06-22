/**
 * 플레이어 표시 (닉네임 · 계정 메모)
 */
var PlayerUi = (function () {
  var MEMO_MAX = 200;

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

  function normalizeMemo(input) {
    return (input || '').trim().slice(0, MEMO_MAX);
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

  function renderMemoMeta(user, extraClass) {
    if (!user || !user.memo) return '';
    var cls = 'player-card__meta player-card__memo-display' + (extraClass ? ' ' + extraClass : '');
    return '<div class="' + cls + '">' + escapeHtml(user.memo) + '</div>';
  }

  function compareBySortOrder(a, b) {
    var ao = a.sortOrder != null ? a.sortOrder : 999999;
    var bo = b.sortOrder != null ? b.sortOrder : 999999;
    if (ao !== bo) return ao - bo;
    return (a.registeredAt || '').localeCompare(b.registeredAt || '');
  }

  return {
    normalizeNickname: normalizeNickname,
    normalizeMemo: normalizeMemo,
    formatDisplayName: formatDisplayName,
    renderNameHtml: renderNameHtml,
    renderMemoMeta: renderMemoMeta,
    renderAvatar: renderAvatar,
    escapeHtml: escapeHtml,
    compareBySortOrder: compareBySortOrder
  };
})();
