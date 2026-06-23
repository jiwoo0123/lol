(function () {
  var els = {
    historyHeaderTitle: document.getElementById('historyHeaderTitle'),
    historyHeaderSub: document.getElementById('historyHeaderSub'),
    historyRecordSummary: document.getElementById('historyRecordSummary'),
    matchFileSyncStatus: document.getElementById('matchFileSyncStatus'),
    reloadMatchBtn: document.getElementById('reloadMatchBtn'),
    playerSearchInput: document.getElementById('playerSearchInput'),
    playerSuggestList: document.getElementById('playerSuggestList'),
    playerAutocomplete: document.getElementById('playerAutocomplete'),
    clearPlayerBtn: document.getElementById('clearPlayerBtn'),
    dateFrom: document.getElementById('dateFrom'),
    dateTo: document.getElementById('dateTo'),
    dateFromText: document.getElementById('dateFromText'),
    dateToText: document.getElementById('dateToText'),
    clearDateBtn: document.getElementById('clearDateBtn'),
    personalStats: document.getElementById('personalStats'),
    statsWins: document.getElementById('statsWins'),
    statsLosses: document.getElementById('statsLosses'),
    statsWinRate: document.getElementById('statsWinRate'),
    statsTotal: document.getElementById('statsTotal'),
    dateFilterHint: document.getElementById('dateFilterHint'),
    historyTitle: document.getElementById('historyTitle'),
    matchList: document.getElementById('matchList')
  };

  var filterUserId = '';
  var suggestActiveIndex = -1;
  var suggestItems = [];

  function getUserById(id) {
    var users = UserStorage.getAll();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === id) return users[i];
    }
    return null;
  }

  function getSortedUsers() {
    var users = UserStorage.getAll().slice();
    users.sort(PlayerUi.compareBySortOrder);
    return users;
  }

  function findUserByNickname(text) {
    var keyword = (text || '').trim().toLowerCase();
    if (!keyword) return null;

    var users = getSortedUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].nickname.toLowerCase() === keyword) {
        return users[i];
      }
    }
    return null;
  }

  function filterUsers(keyword) {
    var users = getSortedUsers();
    var kw = (keyword || '').trim().toLowerCase();
    if (!kw) return [];

    var matched = [];
    for (var i = 0; i < users.length; i++) {
      if (PlayerUi.matchesKeyword(users[i], kw)) {
        matched.push(users[i]);
      }
    }
    return matched;
  }

  function parseQueryParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      userId: params.get('userId') || '',
      dateFrom: params.get('from') || '',
      dateTo: params.get('to') || ''
    };
  }

  function syncUrl() {
    var params = new URLSearchParams();
    if (filterUserId) params.set('userId', filterUserId);
    if (els.dateFrom.value) params.set('from', els.dateFrom.value);
    if (els.dateTo.value) params.set('to', els.dateTo.value);

    var query = params.toString();
    var url = query ? 'history.html?' + query : 'history.html';
    window.history.replaceState(null, '', url);
  }

  function updateClearPlayerBtn() {
    els.clearPlayerBtn.hidden = !filterUserId;
  }

  function syncPlayerInputFromFilter() {
    if (filterUserId) {
      var user = getUserById(filterUserId);
      els.playerSearchInput.value = user ? user.nickname : '';
    } else {
      els.playerSearchInput.value = '';
    }
    updateClearPlayerBtn();
  }

  function hideSuggest() {
    els.playerSuggestList.hidden = true;
    els.playerSearchInput.setAttribute('aria-expanded', 'false');
    suggestActiveIndex = -1;
    suggestItems = [];
  }

  function showSuggest() {
    els.playerSuggestList.hidden = false;
    els.playerSearchInput.setAttribute('aria-expanded', 'true');
  }

  function renderSuggestList(keyword) {
    suggestItems = filterUsers(keyword);
    suggestActiveIndex = suggestItems.length > 0 ? 0 : -1;

    if (!keyword.trim()) {
      hideSuggest();
      return;
    }

    if (suggestItems.length === 0) {
      els.playerSuggestList.innerHTML =
        '<li class="autocomplete__empty">일치하는 플레이어가 없습니다.</li>';
      showSuggest();
      return;
    }

    var html = '';
    for (var i = 0; i < suggestItems.length; i++) {
      var user = suggestItems[i];
      var activeClass = i === suggestActiveIndex ? ' autocomplete__item--active' : '';
      var accounts = PlayerUi.getAccounts(user);
      var accountsHtml = accounts.length
        ? '<div class="autocomplete__accounts">' + PlayerUi.escapeHtml(accounts.join(' · ')) + '</div>'
        : '';
      html +=
        '<li class="autocomplete__item' + activeClass + '" role="option" data-id="' + user.id + '" data-index="' + i + '">' +
          PlayerUi.renderAvatar(user, 'autocomplete__icon') +
          '<div class="autocomplete__text">' +
            '<div class="autocomplete__name">' + highlightMatch(user.nickname, keyword) + '</div>' +
            accountsHtml +
          '</div>' +
        '</li>';
    }

    els.playerSuggestList.innerHTML = html;
    showSuggest();
    bindSuggestItemEvents();
  }

  function highlightMatch(nickname, keyword) {
    var kw = keyword.trim();
    if (!kw) return PlayerUi.escapeHtml(nickname);

    var lower = nickname.toLowerCase();
    var kwLower = kw.toLowerCase();
    var idx = lower.indexOf(kwLower);
    if (idx < 0) return PlayerUi.escapeHtml(nickname);

    var before = nickname.slice(0, idx);
    var match = nickname.slice(idx, idx + kw.length);
    var after = nickname.slice(idx + kw.length);
    return PlayerUi.escapeHtml(before) +
      '<strong>' + PlayerUi.escapeHtml(match) + '</strong>' +
      PlayerUi.escapeHtml(after);
  }

  function updateSuggestActiveItem() {
    var items = els.playerSuggestList.querySelectorAll('.autocomplete__item[data-id]');
    for (var i = 0; i < items.length; i++) {
      if (i === suggestActiveIndex) {
        items[i].classList.add('autocomplete__item--active');
        items[i].scrollIntoView({ block: 'nearest' });
      } else {
        items[i].classList.remove('autocomplete__item--active');
      }
    }
  }

  function bindSuggestItemEvents() {
    var items = els.playerSuggestList.querySelectorAll('.autocomplete__item[data-id]');
    for (var i = 0; i < items.length; i++) {
      items[i].addEventListener('mousedown', function (e) {
        e.preventDefault();
      });
      items[i].addEventListener('click', onSuggestItemClick);
    }
  }

  function selectUser(user) {
    if (!user) return;
    filterUserId = user.id;
    els.playerSearchInput.value = user.nickname;
    hideSuggest();
    updateClearPlayerBtn();
    onSearchChange();
  }

  function clearPlayerFilter() {
    filterUserId = '';
    els.playerSearchInput.value = '';
    hideSuggest();
    updateClearPlayerBtn();
    onSearchChange();
  }

  function onSuggestItemClick(e) {
    var id = e.currentTarget.getAttribute('data-id');
    var user = getUserById(id);
    selectUser(user);
  }

  function onPlayerInput() {
    var keyword = els.playerSearchInput.value;
    if (!keyword.trim()) {
      if (filterUserId) {
        filterUserId = '';
        updateClearPlayerBtn();
        onSearchChange();
      }
      hideSuggest();
      return;
    }

    if (filterUserId) {
      var current = getUserById(filterUserId);
      if (!current || current.nickname !== keyword) {
        filterUserId = '';
        updateClearPlayerBtn();
      }
    }

    renderSuggestList(keyword);
  }

  function onPlayerFocus() {
    var keyword = els.playerSearchInput.value.trim();
    if (keyword) {
      renderSuggestList(keyword);
    }
  }

  function onPlayerBlur() {
    setTimeout(function () {
      hideSuggest();

      var text = els.playerSearchInput.value.trim();
      if (!text) {
        if (filterUserId) {
          clearPlayerFilter();
        }
        return;
      }

      var user = findUserByNickname(text);
      if (user) {
        if (user.id !== filterUserId) {
          selectUser(user);
        }
        return;
      }

      if (filterUserId) {
        var current = getUserById(filterUserId);
        els.playerSearchInput.value = current ? current.nickname : '';
      } else {
        els.playerSearchInput.value = '';
      }
    }, 150);
  }

  function onPlayerKeydown(e) {
    if (els.playerSuggestList.hidden) {
      if (e.key === 'ArrowDown' && els.playerSearchInput.value.trim()) {
        renderSuggestList(els.playerSearchInput.value);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestItems.length === 0) return;
      suggestActiveIndex = Math.min(suggestActiveIndex + 1, suggestItems.length - 1);
      updateSuggestActiveItem();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestItems.length === 0) return;
      suggestActiveIndex = Math.max(suggestActiveIndex - 1, 0);
      updateSuggestActiveItem();
    } else if (e.key === 'Enter') {
      if (suggestActiveIndex >= 0 && suggestItems[suggestActiveIndex]) {
        e.preventDefault();
        selectUser(suggestItems[suggestActiveIndex]);
      } else {
        var user = findUserByNickname(els.playerSearchInput.value);
        if (user) {
          e.preventDefault();
          selectUser(user);
        }
      }
    } else if (e.key === 'Escape') {
      hideSuggest();
    }
  }

  function updateMatchFileSyncStatus() {
    var err = (MatchHistory.getLastError && MatchHistory.getLastError()) ||
      (UserStorage.getLastError && UserStorage.getLastError());
    if (err) {
      els.matchFileSyncStatus.hidden = false;
      els.matchFileSyncStatus.textContent = err;
      els.matchFileSyncStatus.className = 'file-sync-status file-sync-status--warn';
      return;
    }
    if (MatchHistory.canWrite()) {
      els.matchFileSyncStatus.hidden = true;
      return;
    }
    if (FirebaseApp.isConfigured()) {
      els.matchFileSyncStatus.hidden = false;
      els.matchFileSyncStatus.textContent = '불러오는 중...';
      els.matchFileSyncStatus.className = 'file-sync-status';
    } else {
      els.matchFileSyncStatus.hidden = false;
      els.matchFileSyncStatus.textContent = '연결할 수 없습니다.';
      els.matchFileSyncStatus.className = 'file-sync-status file-sync-status--warn';
    }
  }

  function formatDate(iso) {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleString('ko-KR');
    } catch (e) {
      return iso;
    }
  }

  function formatDateLabel(value) {
    if (!value) return '';
    try {
      return new Date(value + 'T00:00:00').toLocaleDateString('ko-KR');
    } catch (e) {
      return value;
    }
  }

  function updateDateDisplay(inputEl, textEl) {
    if (!textEl) return;
    if (inputEl.value) {
      textEl.textContent = formatDateLabel(inputEl.value);
      textEl.classList.remove('date-picker__display--empty');
    } else {
      textEl.textContent = '날짜 선택';
      textEl.classList.add('date-picker__display--empty');
    }
  }

  function updateAllDateDisplays() {
    updateDateDisplay(els.dateFrom, els.dateFromText);
    updateDateDisplay(els.dateTo, els.dateToText);
  }

  function formatWinRate(wins, losses) {
    var total = wins + losses;
    if (total === 0) return '—';
    return Math.round((wins / total) * 100) + '%';
  }

  function matchInDateRange(match) {
    var from = els.dateFrom.value;
    var to = els.dateTo.value;
    if (!from && !to) return true;
    if (!match.recordedAt) return false;

    var recorded = new Date(match.recordedAt);
    if (isNaN(recorded.getTime())) return false;

    if (from) {
      var fromDate = new Date(from + 'T00:00:00');
      if (recorded < fromDate) return false;
    }
    if (to) {
      var toDate = new Date(to + 'T23:59:59.999');
      if (recorded > toDate) return false;
    }
    return true;
  }

  function getBaseMatches() {
    return filterUserId
      ? MatchHistory.getByUserId(filterUserId)
      : MatchHistory.getAll();
  }

  function getFilteredMatches() {
    var matches = getBaseMatches();
    var filtered = [];
    for (var i = 0; i < matches.length; i++) {
      if (matchInDateRange(matches[i])) {
        filtered.push(matches[i]);
      }
    }
    return filtered;
  }

  function calcUserRecord(matches, userId) {
    var wins = 0;
    var losses = 0;
    for (var i = 0; i < matches.length; i++) {
      var side = MatchHistory.userSideInMatch(matches[i], userId);
      if (!side) continue;
      if (matches[i].winnerSide === side) wins++;
      else losses++;
    }
    return { wins: wins, losses: losses, total: wins + losses };
  }

  function hasDateFilter() {
    return !!(els.dateFrom.value || els.dateTo.value);
  }

  function renderDateFilterHint() {
    if (!hasDateFilter()) {
      els.dateFilterHint.hidden = true;
      els.dateFilterHint.textContent = '';
      return;
    }

    var parts = [];
    if (els.dateFrom.value && els.dateTo.value) {
      parts.push(formatDateLabel(els.dateFrom.value) + ' ~ ' + formatDateLabel(els.dateTo.value));
    } else if (els.dateFrom.value) {
      parts.push(formatDateLabel(els.dateFrom.value) + ' 이후');
    } else {
      parts.push(formatDateLabel(els.dateTo.value) + ' 이전');
    }

    els.dateFilterHint.textContent = '기간: ' + parts.join(' ') + ' · 아래 목록과 전적에 반영됩니다.';
    els.dateFilterHint.hidden = false;
  }

  function renderPersonalStats(record) {
    if (!filterUserId) {
      els.personalStats.hidden = true;
      return;
    }

    els.personalStats.hidden = false;
    els.statsWins.textContent = String(record.wins);
    els.statsLosses.textContent = String(record.losses);
    els.statsWinRate.textContent = formatWinRate(record.wins, record.losses);
    els.statsTotal.textContent = String(record.total);
  }

  function formatTeamRosterHtml(team) {
    var ids = MatchHistory.getTeamPlayerIds(team);
    if (ids.length === 0) return '(없음)';

    var html = '';
    for (var i = 0; i < ids.length; i++) {
      if (i > 0) html += '<span class="record-player-sep">, </span>';

      var user = getUserById(ids[i]);
      if (!user) {
        html += '?';
        continue;
      }

      var activeClass = user.id === filterUserId ? ' record-player-link--active' : '';
      html +=
        '<button type="button" class="record-player-link' + activeClass + '" data-id="' + user.id + '" title="' +
          PlayerUi.escapeHtml(user.nickname) + ' 전적 보기">' +
          PlayerUi.escapeHtml(user.nickname) +
        '</button>';
    }
    return html;
  }

  function getSideLabel(side) {
    return side === 'red' ? '레드팀' : '블루팀';
  }

  function renderHeader(matches) {
    if (filterUserId) {
      var user = getUserById(filterUserId);
      var nickname = user ? user.nickname : '플레이어';
      var record = calcUserRecord(matches, filterUserId);
      var winRate = formatWinRate(record.wins, record.losses);

      els.historyHeaderTitle.textContent = nickname;
      els.historyHeaderSub.textContent = hasDateFilter() ? '개인 전적 · 기간 필터' : '개인 전적';
      els.historyRecordSummary.textContent =
        record.wins + '승 ' + record.losses + '패 · ' + winRate;
      els.historyTitle.textContent = nickname + ' · 경기 목록 (' + matches.length + ')';
      renderPersonalStats(record);
    } else {
      els.historyHeaderTitle.textContent = '전적';
      els.historyHeaderSub.textContent = hasDateFilter() ? '내전 경기 기록 · 기간 필터' : '내전 경기 기록';
      els.historyRecordSummary.textContent = '총 ' + matches.length + '경기';
      els.historyTitle.textContent = '전체 경기 목록 (' + matches.length + ')';
      renderPersonalStats({ wins: 0, losses: 0, total: 0 });
    }
    updateClearPlayerBtn();
  }

  function renderMatchList() {
    renderDateFilterHint();

    var matches = getFilteredMatches();
    renderHeader(matches);

    if (matches.length === 0) {
      var emptyMsg = filterUserId ? '조건에 맞는 경기 기록이 없습니다.' : '기록된 경기가 없습니다.';
      if (hasDateFilter()) {
        emptyMsg = filterUserId
          ? '선택한 기간에 참가한 경기가 없습니다.'
          : '선택한 기간에 기록된 경기가 없습니다.';
      }
      els.matchList.innerHTML = '<p class="empty">' + emptyMsg + '</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < matches.length; i++) {
      var match = matches[i];
      var winnerLabel = getSideLabel(match.winnerSide);
      var loserSide = match.winnerSide === 'red' ? 'blue' : 'red';

      var resultText = '';
      var resultClass = '';
      if (filterUserId) {
        var mySide = MatchHistory.userSideInMatch(match, filterUserId);
        var iWon = mySide === match.winnerSide;
        resultText = iWon ? '승리' : '패배';
        resultClass = iWon ? 'record-card--win' : 'record-card--lose';
      } else {
        resultText = winnerLabel + ' 승';
        resultClass = match.winnerSide === 'blue' ? 'record-card--win' : 'record-card--lose';
      }

      html +=
        '<div class="record-card ' + resultClass + '" data-id="' + match.id + '">' +
          '<div class="record-card__head">' +
            '<span class="record-card__result">' + resultText + '</span>' +
            '<span class="record-card__date">' + formatDate(match.recordedAt) + '</span>' +
            '<button type="button" class="btn btn--ghost btn--sm record-delete" data-id="' + match.id + '" title="전적 삭제">삭제</button>' +
          '</div>' +
          '<div class="record-card__teams">' +
            '<div class="record-card__team record-card__team--blue">' +
              '<span class="record-card__team-label">블루</span> ' +
              formatTeamRosterHtml(match.teams.blue) +
              (match.winnerSide === 'blue' ? ' <span class="record-card__win-badge">승</span>' : '') +
            '</div>' +
            '<div class="record-card__team record-card__team--red">' +
              '<span class="record-card__team-label">레드</span> ' +
              formatTeamRosterHtml(match.teams.red) +
              (match.winnerSide === 'red' ? ' <span class="record-card__win-badge">승</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="record-card__vs">승: ' + winnerLabel + ' · 패: ' + getSideLabel(loserSide) + '</div>' +
        '</div>';
    }

    els.matchList.innerHTML = html;

    var deleteBtns = els.matchList.querySelectorAll('.record-delete');
    for (var j = 0; j < deleteBtns.length; j++) {
      deleteBtns[j].addEventListener('click', onDeleteMatch);
    }

    var playerLinks = els.matchList.querySelectorAll('.record-player-link');
    for (var k = 0; k < playerLinks.length; k++) {
      playerLinks[k].addEventListener('click', onMatchPlayerClick);
    }
  }

  function onMatchPlayerClick(e) {
    e.stopPropagation();
    var id = e.currentTarget.getAttribute('data-id');
    var user = getUserById(id);
    if (!user) return;
    selectUser(user);
    if (els.playerSearchInput) {
      els.playerSearchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function onDeleteMatch(e) {
    e.stopPropagation();
    var id = e.currentTarget.getAttribute('data-id');
    if (!confirm('이 경기 전적을 삭제할까요?')) return;

    MatchHistory.remove(id)
      .then(function () {
        renderMatchList();
        updateMatchFileSyncStatus();
      })
      .catch(function (err) {
        alert(err.message);
      });
  }

  function onSearchChange() {
    syncUrl();
    renderMatchList();
  }

  function onDateChange() {
    if (els.dateFrom.value && els.dateTo.value && els.dateFrom.value > els.dateTo.value) {
      alert('시작일이 종료일보다 늦을 수 없습니다.');
      els.dateTo.value = els.dateFrom.value;
    }
    updateAllDateDisplays();
    onSearchChange();
  }

  function onClearDate() {
    els.dateFrom.value = '';
    els.dateTo.value = '';
    updateAllDateDisplays();
    onSearchChange();
  }

  function onReloadMatch() {
    Promise.all([UserStorage.reload(), MatchHistory.reload()])
      .then(function () {
        syncPlayerInputFromFilter();
        updateMatchFileSyncStatus();
        renderMatchList();
      })
      .catch(function (err) {
        alert(err.message);
      });
  }

  els.reloadMatchBtn.addEventListener('click', onReloadMatch);
  els.playerSearchInput.addEventListener('input', onPlayerInput);
  els.playerSearchInput.addEventListener('focus', onPlayerFocus);
  els.playerSearchInput.addEventListener('blur', onPlayerBlur);
  els.playerSearchInput.addEventListener('keydown', onPlayerKeydown);
  els.clearPlayerBtn.addEventListener('click', clearPlayerFilter);
  els.dateFrom.addEventListener('change', onDateChange);
  els.dateTo.addEventListener('change', onDateChange);
  els.clearDateBtn.addEventListener('click', onClearDate);

  document.addEventListener('lol-users-updated', function () {
    syncPlayerInputFromFilter();
    renderMatchList();
  });
  document.addEventListener('lol-matches-updated', function () {
    updateMatchFileSyncStatus();
    renderMatchList();
  });

  var query = parseQueryParams();
  filterUserId = query.userId;
  els.dateFrom.value = query.dateFrom;
  els.dateTo.value = query.dateTo;
  updateAllDateDisplays();

  Promise.all([
    UserStorage.init(),
    MatchHistory.init()
  ]).then(function () {
    syncPlayerInputFromFilter();
    updateMatchFileSyncStatus();
    renderMatchList();
  }).catch(function () {
    syncPlayerInputFromFilter();
    updateMatchFileSyncStatus();
    renderMatchList();
  });
})();
