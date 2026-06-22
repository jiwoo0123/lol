(function () {
  var els = {
    participantCount: document.getElementById('participantCount'),
    participantSectionCount: document.getElementById('participantSectionCount'),
    participantList: document.getElementById('participantList'),
    clearParticipantsBtn: document.getElementById('clearParticipantsBtn'),
    teamSection: document.getElementById('teamSection'),
    teamBoard: document.getElementById('teamBoard'),
    unassignedSection: document.getElementById('unassignedSection'),
    unassignedCount: document.getElementById('unassignedCount'),
    unassignedList: document.getElementById('unassignedList'),
    clearTeamsBtn: document.getElementById('clearTeamsBtn'),
    recordSection: document.getElementById('recordSection'),
    recordHint: document.getElementById('recordHint'),
    recordBlueWin: document.getElementById('recordBlueWin'),
    recordRedWin: document.getElementById('recordRedWin'),
    recordStatus: document.getElementById('recordStatus'),
    playerPool: document.getElementById('playerPool'),
    poolCount: document.getElementById('poolCount'),
    searchInput: document.getElementById('searchInput'),
    fileSyncStatus: document.getElementById('fileSyncStatus')
  };

  function getDisplayName(user) {
    return PlayerUi.formatDisplayName(user);
  }

  function getTeamSideLabel(captainId) {
    return SessionStorage.getTeamSide(captainId) === 'red' ? '레드팀' : '블루팀';
  }

  function getTeamSidePanelClass(captainId) {
    return SessionStorage.getTeamSide(captainId) === 'red' ? 'team-panel--red' : 'team-panel--blue';
  }

  function updateFileSyncStatus() {
    var err = (UserStorage.getLastError && UserStorage.getLastError()) ||
      (MatchHistory.getLastError && MatchHistory.getLastError());
    if (err) {
      els.fileSyncStatus.hidden = false;
      els.fileSyncStatus.textContent = err;
      els.fileSyncStatus.className = 'file-sync-status file-sync-status--warn';
      return;
    }
    if (UserStorage.canWrite() && MatchHistory.canWrite()) {
      els.fileSyncStatus.hidden = true;
      return;
    }
    if (FirebaseApp.isConfigured()) {
      els.fileSyncStatus.hidden = false;
      els.fileSyncStatus.textContent = '불러오는 중...';
      els.fileSyncStatus.className = 'file-sync-status';
    } else {
      els.fileSyncStatus.hidden = false;
      els.fileSyncStatus.textContent = '연결할 수 없습니다.';
      els.fileSyncStatus.className = 'file-sync-status file-sync-status--warn';
    }
  }

  function showRecordStatus(message, type) {
    if (!els.recordStatus) return;
    els.recordStatus.hidden = false;
    els.recordStatus.textContent = message;
    els.recordStatus.className = 'status status--' + type;
  }

  function hideRecordStatus() {
    if (els.recordStatus) els.recordStatus.hidden = true;
  }

  function buildMatchSetup() {
    var captains = usersFromIds(SessionStorage.getCaptainIds());
    var blueCaptain = null;
    var redCaptain = null;

    for (var i = 0; i < captains.length; i++) {
      var side = SessionStorage.getTeamSide(captains[i].id);
      if (side === 'blue') {
        if (blueCaptain) return { error: '블루팀 팀장이 2명 이상입니다.' };
        blueCaptain = captains[i];
      } else {
        if (redCaptain) return { error: '레드팀 팀장이 2명 이상입니다.' };
        redCaptain = captains[i];
      }
    }

    if (!blueCaptain || !redCaptain) {
      return { error: '블루팀·레드팀 팀장을 각각 1명씩 지정하세요.' };
    }

    var unassigned = SessionStorage.getUnassignedIds();
    if (unassigned.length > 0) {
      return { error: '미배정 참가자 ' + unassigned.length + '명이 있습니다. 모두 팀에 넣어주세요.' };
    }

    function buildTeam(captain) {
      return {
        captainId: captain.id,
        memberIds: SessionStorage.getTeamMemberIds(captain.id)
      };
    }

    return {
      teams: {
        blue: buildTeam(blueCaptain),
        red: buildTeam(redCaptain)
      }
    };
  }

  function renderRecordSection() {
    if (!els.recordSection) return;

    var setup = buildMatchSetup();
    var hasCaptains = SessionStorage.getCaptainIds().length > 0;

    els.recordSection.hidden = !hasCaptains;

    if (!hasCaptains) return;

    if (setup.error) {
      els.recordHint.textContent = setup.error;
      els.recordBlueWin.disabled = true;
      els.recordRedWin.disabled = true;
    } else {
      els.recordHint.textContent = '승리한 팀을 누르면 전적에 기록됩니다.';
      els.recordBlueWin.disabled = false;
      els.recordRedWin.disabled = false;
    }
  }

  function onRecordWin(winnerSide) {
    hideRecordStatus();
    var setup = buildMatchSetup();
    if (setup.error) {
      showRecordStatus(setup.error, 'error');
      return;
    }

    var label = winnerSide === 'red' ? '레드팀' : '블루팀';
    if (!confirm(label + ' 승리로 기록할까요?')) return;

    els.recordBlueWin.disabled = true;
    els.recordRedWin.disabled = true;

    MatchHistory.add({
      winnerSide: winnerSide,
      teams: setup.teams
    }).then(function () {
      showRecordStatus(label + ' 승리 경기가 기록되었습니다.', 'success');
      updateFileSyncStatus();
      renderRecordSection();
    }).catch(function (err) {
      showRecordStatus(err.message, 'error');
      renderRecordSection();
    });
  }

  function getUserById(id) {
    var users = UserStorage.getAll();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === id) return users[i];
    }
    return null;
  }

  function sortIdsByUserOrder(ids) {
    var orderMap = {};
    var all = UserStorage.getAll();
    for (var i = 0; i < all.length; i++) {
      orderMap[all[i].id] = i;
    }
    return ids.slice().sort(function (a, b) {
      var ao = orderMap[a] != null ? orderMap[a] : 999999;
      var bo = orderMap[b] != null ? orderMap[b] : 999999;
      return ao - bo;
    });
  }

  function usersFromIds(ids) {
    var sortedIds = sortIdsByUserOrder(ids);
    var users = [];
    for (var i = 0; i < sortedIds.length; i++) {
      var user = getUserById(sortedIds[i]);
      if (user) users.push(user);
    }
    return users;
  }

  function renderMiniPlayer(user, options) {
    options = options || {};
    var badge = '';
    if (options.captain) {
      badge = '<span class="team-captain-badge">팀장</span>';
    }

    return (
      '<div class="team-player' + (options.captain ? ' team-player--captain' : '') + '" data-id="' + user.id + '">' +
        PlayerUi.renderAvatar(user, 'team-player__icon') +
        '<div class="team-player__info">' +
          '<div class="team-player__name">' + PlayerUi.escapeHtml(user.nickname) + badge + '</div>' +
        '</div>' +
        (options.action || '') +
      '</div>'
    );
  }

  function renderParticipantCard(user) {
    var isCaptain = SessionStorage.isCaptain(user.id);
    var assignment = SessionStorage.getTeamAssignments()[user.id];
    var teamHint = '';

    if (isCaptain) {
      var captainSide = SessionStorage.getTeamSide(user.id);
      var sideClass = captainSide === 'red' ? 'team-hint--red' : 'team-hint--blue';
      teamHint = ' · <span class="team-hint team-hint--captain ' + sideClass + '">' +
        getTeamSideLabel(user.id) + ' 팀장</span>';
    } else if (assignment) {
      var memberSide = SessionStorage.getTeamSide(assignment);
      var memberSideClass = memberSide === 'red' ? 'team-hint--red' : 'team-hint--blue';
      teamHint = ' · <span class="team-hint ' + memberSideClass + '">' +
        PlayerUi.escapeHtml(getTeamSideLabel(assignment)) + '</span>';
    }

    return (
      '<div class="player-card player-card--participant" data-id="' + user.id + '">' +
        '<div class="player-card__main player-card--clickable" data-id="' + user.id + '" title="개인 전적 보기">' +
          PlayerUi.renderAvatar(user, 'player-card__icon') +
          '<div class="player-card__info">' +
            '<div class="player-card__name">' + PlayerUi.renderNameHtml(user) + '</div>' +
            '<div class="player-card__meta">참가 중' + teamHint + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="player-card__actions">' +
          '<button type="button" class="btn btn--sm captain-toggle' + (isCaptain ? ' captain-toggle--active' : '') + '" data-id="' + user.id + '" title="팀장 지정/해제">팀장</button>' +
          '<button type="button" class="btn btn--ghost btn--sm participant-remove" data-id="' + user.id + '" title="참가 취소">✕</button>' +
        '</div>' +
      '</div>'
    );
  }

  function renderPoolCard(user, isParticipant) {
    var action = isParticipant
      ? '<span class="participant-badge">참가 중</span>'
      : '<button type="button" class="btn btn--primary btn--sm pool-add" data-id="' + user.id + '">+ 참가</button>';

    return (
      '<div class="player-card player-card--pool' + (isParticipant ? ' player-card--in-session' : '') + '" data-id="' + user.id + '">' +
        PlayerUi.renderAvatar(user, 'player-card__icon') +
        '<div class="player-card__info">' +
          '<div class="player-card__name">' + PlayerUi.renderNameHtml(user) + '</div>' +
        '</div>' +
        '<div class="player-card__actions">' + action + '</div>' +
      '</div>'
    );
  }

  function buildTeamSelect(userId, selectedCaptainId) {
    var captains = usersFromIds(SessionStorage.getCaptainIds());
    var html = '<select class="team-assign-select" data-id="' + userId + '">';
    html += '<option value="">미배정</option>';
    for (var i = 0; i < captains.length; i++) {
      var captain = captains[i];
      var selected = captain.id === selectedCaptainId ? ' selected' : '';
      html += '<option value="' + captain.id + '"' + selected + '>' +
        PlayerUi.escapeHtml(getTeamSideLabel(captain.id) + ' · ' + getDisplayName(captain)) + '</option>';
    }
    html += '</select>';
    return html;
  }

  function bindParticipantEvents() {
    var removeBtns = els.participantList.querySelectorAll('.participant-remove');
    for (var i = 0; i < removeBtns.length; i++) {
      removeBtns[i].addEventListener('click', onRemoveParticipant);
    }

    var captainBtns = els.participantList.querySelectorAll('.captain-toggle');
    for (var j = 0; j < captainBtns.length; j++) {
      captainBtns[j].addEventListener('click', onToggleCaptain);
    }

    var historyLinks = els.participantList.querySelectorAll('.player-card__main');
    for (var k = 0; k < historyLinks.length; k++) {
      historyLinks[k].addEventListener('click', onOpenHistory);
    }
  }

  function onOpenHistory(e) {
    var id = e.currentTarget.getAttribute('data-id');
    if (!getUserById(id)) return;
    window.location.href = 'history.html?userId=' + encodeURIComponent(id);
  }

  function bindPoolEvents() {
    var addBtns = els.playerPool.querySelectorAll('.pool-add');
    for (var i = 0; i < addBtns.length; i++) {
      addBtns[i].addEventListener('click', onAddParticipant);
    }
  }

  function bindTeamEvents() {
    var selects = els.unassignedList.querySelectorAll('.team-assign-select');
    for (var i = 0; i < selects.length; i++) {
      selects[i].addEventListener('change', onAssignTeam);
    }

    var removeMemberBtns = els.teamBoard.querySelectorAll('.team-member-remove');
    for (var j = 0; j < removeMemberBtns.length; j++) {
      removeMemberBtns[j].addEventListener('click', onRemoveFromTeam);
    }

    var sideToggles = els.teamBoard.querySelectorAll('.team-side-toggle');
    for (var s = 0; s < sideToggles.length; s++) {
      sideToggles[s].addEventListener('click', onToggleTeamSide);
    }
  }

  function renderParticipants() {
    var users = usersFromIds(SessionStorage.getParticipantIds());

    var countLabel = users.length + '명 참가';
    els.participantCount.textContent = users.length + '명';
    if (els.participantSectionCount) {
      els.participantSectionCount.textContent = countLabel;
    }
    els.clearParticipantsBtn.disabled = users.length === 0;

    if (users.length === 0) {
      els.participantList.innerHTML =
        '<p class="empty empty--compact">아래 등록 플레이어에서 <strong>+ 참가</strong>를 눌러 참가자를 추가하세요.</p>';
      return;
    }

    var html = '';
    for (var j = 0; j < users.length; j++) {
      html += renderParticipantCard(users[j]);
    }
    els.participantList.innerHTML = html;
    bindParticipantEvents();
  }

  function renderTeamBoard() {
    var captainIds = SessionStorage.getCaptainIds();
    var hasParticipants = SessionStorage.getParticipantIds().length > 0;

    els.teamSection.hidden = !hasParticipants;

    if (!hasParticipants) {
      els.teamBoard.innerHTML = '';
      els.unassignedSection.hidden = true;
      return;
    }

    if (captainIds.length === 0) {
      els.teamBoard.innerHTML =
        '<p class="empty empty--compact">참가자 목록에서 <strong>팀장</strong> 버튼을 눌러 팀장을 지정하세요.</p>';
      els.unassignedSection.hidden = true;
      return;
    }

    var captains = usersFromIds(captainIds);
    var boardHtml = '';
    for (var t = 0; t < captains.length; t++) {
      var captain = captains[t];
      var captainId = captain.id;
      var side = SessionStorage.getTeamSide(captainId);
      var sideLabel = getTeamSideLabel(captainId);
      var panelClass = getTeamSidePanelClass(captainId);
      var members = usersFromIds(SessionStorage.getTeamMemberIds(captainId));
      var membersHtml = '';

      membersHtml += renderMiniPlayer(captain, { captain: true });

      for (var m = 0; m < members.length; m++) {
        var member = members[m];
        var removeBtn =
          '<button type="button" class="btn btn--ghost btn--sm team-member-remove" data-id="' + member.id + '" title="팀에서 빼기">✕</button>';
        membersHtml += renderMiniPlayer(member, { action: removeBtn });
      }

      var teamSize = 1 + members.length;
      boardHtml +=
        '<div class="team-panel ' + panelClass + '">' +
          '<div class="team-panel__header">' +
            '<button type="button" class="team-side-toggle team-side-toggle--' + side + '" data-id="' + captainId + '" title="클릭하여 블루/레드 전환">' +
              sideLabel +
            '</button>' +
            '<span class="team-panel__count">' + teamSize + '명 · ' + PlayerUi.escapeHtml(captain.nickname) + '</span>' +
          '</div>' +
          '<div class="team-panel__members">' + membersHtml + '</div>' +
        '</div>';
    }

    els.teamBoard.innerHTML = boardHtml;

    var unassignedUsers = usersFromIds(SessionStorage.getUnassignedIds());
    els.unassignedSection.hidden = unassignedUsers.length === 0;
    els.unassignedCount.textContent = unassignedUsers.length + '명';

    if (unassignedUsers.length === 0) {
      els.unassignedList.innerHTML = '';
    } else {
      var unassignedHtml = '';
      for (var u = 0; u < unassignedUsers.length; u++) {
        var unassignedUser = unassignedUsers[u];
        unassignedHtml +=
          '<div class="team-unassigned__row">' +
            renderMiniPlayer(unassignedUser) +
            buildTeamSelect(unassignedUser.id, '') +
          '</div>';
      }
      els.unassignedList.innerHTML = unassignedHtml;
    }

    bindTeamEvents();
    renderRecordSection();
  }

  function renderPlayerPool(filter) {
    var allUsers = UserStorage.getAll();
    var keyword = (filter || '').toLowerCase().trim();
    var users = allUsers;

    if (keyword) {
      users = users.filter(function (u) {
        var full = PlayerUi.formatDisplayName(u).toLowerCase();
        return full.indexOf(keyword) >= 0;
      });
    }

    var participantSet = {};
    var participantIds = SessionStorage.getParticipantIds();
    for (var p = 0; p < participantIds.length; p++) {
      participantSet[participantIds[p]] = true;
    }

    users.sort(function (a, b) {
      var aJoined = participantSet[a.id] ? 1 : 0;
      var bJoined = participantSet[b.id] ? 1 : 0;
      if (aJoined !== bJoined) return aJoined - bJoined;
      return PlayerUi.compareBySortOrder(a, b);
    });

    els.poolCount.textContent = '등록 ' + allUsers.length + '명';

    if (users.length === 0) {
      var emptyMsg = keyword ? '검색 결과가 없습니다.' : '등록된 플레이어가 없습니다.';
      if (!keyword && allUsers.length === 0) {
        emptyMsg += ' <a href="users.html">유저 등록</a>에서 추가하세요.';
      }
      els.playerPool.innerHTML = '<p class="empty empty--compact">' + emptyMsg + '</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < users.length; i++) {
      html += renderPoolCard(users[i], !!participantSet[users[i].id]);
    }
    els.playerPool.innerHTML = html;
    bindPoolEvents();
  }

  function refresh() {
    var allIds = UserStorage.getAll().map(function (u) { return u.id; });
    SessionStorage.pruneMissing(allIds);
    renderParticipants();
    renderTeamBoard();
    renderRecordSection();
    renderPlayerPool(els.searchInput.value);
  }

  function onAddParticipant(e) {
    var id = e.currentTarget.getAttribute('data-id');
    if (!getUserById(id)) return;
    SessionStorage.add(id);
    refresh();
  }

  function onRemoveParticipant(e) {
    e.stopPropagation();
    var id = e.currentTarget.getAttribute('data-id');
    SessionStorage.remove(id);
    refresh();
  }

  function onToggleCaptain(e) {
    e.stopPropagation();
    var id = e.currentTarget.getAttribute('data-id');
    SessionStorage.toggleCaptain(id);
    refresh();
  }

  function onToggleTeamSide(e) {
    var id = e.currentTarget.getAttribute('data-id');
    SessionStorage.toggleTeamSide(id);
    refresh();
  }

  function onAssignTeam(e) {
    var userId = e.currentTarget.getAttribute('data-id');
    var captainId = e.currentTarget.value;
    SessionStorage.assignToTeam(userId, captainId);
    refresh();
  }

  function onRemoveFromTeam(e) {
    var userId = e.currentTarget.getAttribute('data-id');
    SessionStorage.assignToTeam(userId, '');
    refresh();
  }

  function onClearParticipants() {
    if (!SessionStorage.getParticipantIds().length) return;
    if (!confirm('참가자 목록과 팀 구성을 모두 비울까요?')) return;
    SessionStorage.clear();
    refresh();
  }

  function onClearTeams() {
    if (!SessionStorage.getCaptainIds().length && !Object.keys(SessionStorage.getTeamAssignments()).length) {
      return;
    }
    if (!confirm('팀장 지정과 팀 배치를 초기화할까요? (참가자는 유지)')) return;
    SessionStorage.clearTeams();
    refresh();
  }

  els.clearParticipantsBtn.addEventListener('click', onClearParticipants);
  els.clearTeamsBtn.addEventListener('click', onClearTeams);
  if (els.recordBlueWin) {
    els.recordBlueWin.addEventListener('click', function () { onRecordWin('blue'); });
  }
  if (els.recordRedWin) {
    els.recordRedWin.addEventListener('click', function () { onRecordWin('red'); });
  }
  els.searchInput.addEventListener('input', function () {
    renderPlayerPool(els.searchInput.value);
  });

  document.addEventListener('lol-users-updated', function () {
    refresh();
    updateFileSyncStatus();
  });
  document.addEventListener('lol-matches-updated', function () {
    updateFileSyncStatus();
  });

  Promise.all([
    UserStorage.init(),
    MatchHistory.init()
  ]).then(function () {
    updateFileSyncStatus();
    refresh();
  }).catch(function () {
    updateFileSyncStatus();
    refresh();
  });
})();
