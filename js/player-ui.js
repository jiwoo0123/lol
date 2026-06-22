/**
 * 플레이어 표시 (별명 · 계정 목록)
 */
var PlayerUi = (function () {
  var ACCOUNT_MAX = 64;
  var ACCOUNTS_MAX = 10;

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

  function normalizeAccount(input) {
    return (input || '').trim().slice(0, ACCOUNT_MAX);
  }

  function normalizeAccounts(list) {
    var raw = [];
    if (Array.isArray(list)) {
      raw = list;
    } else if (typeof list === 'string' && list.trim()) {
      raw = list.split(/[\n,]+/);
    }

    var seen = {};
    var result = [];
    for (var i = 0; i < raw.length; i++) {
      var acc = normalizeAccount(raw[i]);
      if (!acc) continue;
      var key = acc.toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;
      result.push(acc);
      if (result.length >= ACCOUNTS_MAX) break;
    }
    return result;
  }

  function getAccounts(user) {
    if (!user) return [];
    if (Array.isArray(user.accounts)) return user.accounts.slice();
    if (user.memo && user.memo.trim()) return normalizeAccounts([user.memo]);
    return [];
  }

  function accountsEqual(a, b) {
    var left = normalizeAccounts(a);
    var right = normalizeAccounts(b);
    if (left.length !== right.length) return false;
    for (var i = 0; i < left.length; i++) {
      if (left[i] !== right[i]) return false;
    }
    return true;
  }

  function matchesKeyword(user, keyword) {
    var kw = (keyword || '').toLowerCase().trim();
    if (!kw) return true;
    if (formatDisplayName(user).toLowerCase().indexOf(kw) >= 0) return true;
    var accounts = getAccounts(user);
    for (var i = 0; i < accounts.length; i++) {
      if (accounts[i].toLowerCase().indexOf(kw) >= 0) return true;
    }
    return false;
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

  function renderAccountsMeta(user, extraClass) {
    var accounts = getAccounts(user);
    if (accounts.length === 0) return '';
    var cls = 'player-card__accounts' + (extraClass ? ' ' + extraClass : '');
    var html = '<div class="' + cls + '">';
    for (var i = 0; i < accounts.length; i++) {
      html += '<span class="account-tag">' + escapeHtml(accounts[i]) + '</span>';
    }
    html += '</div>';
    return html;
  }

  function compareBySortOrder(a, b) {
    var ao = a.sortOrder != null ? a.sortOrder : 999999;
    var bo = b.sortOrder != null ? b.sortOrder : 999999;
    if (ao !== bo) return ao - bo;
    return (a.registeredAt || '').localeCompare(b.registeredAt || '');
  }

  return {
    normalizeNickname: normalizeNickname,
    normalizeAccount: normalizeAccount,
    normalizeAccounts: normalizeAccounts,
    getAccounts: getAccounts,
    accountsEqual: accountsEqual,
    matchesKeyword: matchesKeyword,
    formatDisplayName: formatDisplayName,
    renderNameHtml: renderNameHtml,
    renderAccountsMeta: renderAccountsMeta,
    renderAvatar: renderAvatar,
    escapeHtml: escapeHtml,
    compareBySortOrder: compareBySortOrder,
    ACCOUNTS_MAX: ACCOUNTS_MAX
  };
})();
