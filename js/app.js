(function () {
  var els = {
    nickname: document.getElementById('nickname'),
    registerBtn: document.getElementById('registerBtn'),
    registerStatus: document.getElementById('registerStatus'),
    reloadBtn: document.getElementById('reloadBtn'),
    fileSyncStatus: document.getElementById('fileSyncStatus'),
    clearBtn: document.getElementById('clearBtn'),
    playerList: document.getElementById('playerList'),
    playerCount: document.getElementById('playerCount'),
    searchInput: document.getElementById('searchInput')
  };

  function showStatus(message, type) {
    els.registerStatus.hidden = false;
    els.registerStatus.textContent = message;
    els.registerStatus.className = 'status status--' + type;
  }

  function hideStatus() {
    els.registerStatus.hidden = true;
  }

  function updateFileSyncStatus() {
    if (UserStorage.canWrite()) {
      els.fileSyncStatus.textContent = '저장소: Firebase (실시간 동기화 · 등록/삭제 즉시 반영)';
      els.fileSyncStatus.className = 'file-sync-status file-sync-status--connected';
    } else if (FirebaseApp.isConfigured()) {
      els.fileSyncStatus.textContent = '저장소: Firebase 연결 중...';
      els.fileSyncStatus.className = 'file-sync-status';
    } else {
      els.fileSyncStatus.textContent = 'Firebase 설정 필요: js/firebase-config.js';
      els.fileSyncStatus.className = 'file-sync-status file-sync-status--warn';
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

  function renderPlayerList(filter) {
    var users = UserStorage.getAll();
    var keyword = (filter || '').toLowerCase().trim();
    var canReorder = !keyword;

    if (keyword) {
      users = users.filter(function (u) {
        return PlayerUi.formatDisplayName(u).toLowerCase().indexOf(keyword) >= 0;
      });
    }

    els.playerCount.textContent = '등록 ' + UserStorage.getAll().length + '명';

    if (users.length === 0) {
      var emptyMsg = keyword ? '검색 결과가 없습니다.' : '등록된 플레이어가 없습니다.';
      if (!keyword && UserStorage.getAll().length === 0 && !UserStorage.canWrite()) {
        emptyMsg += ' Firebase 설정을 확인하세요.';
      }
      els.playerList.innerHTML = '<p class="empty">' + emptyMsg + '</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      var dragHandle = canReorder
        ? '<span class="player-card__drag-handle" draggable="true" data-id="' + u.id + '" title="드래그하여 순서 변경">⋮⋮</span>'
        : '';
      html +=
        '<div class="player-card' + (canReorder ? ' player-card--sortable' : '') + '" data-id="' + u.id + '">' +
          dragHandle +
          PlayerUi.renderAvatar(u, 'player-card__icon') +
          '<div class="player-card__info">' +
            '<div class="player-card__name">' + PlayerUi.renderNameHtml(u) + '</div>' +
            '<div class="player-card__meta">등록 ' + formatDate(u.registeredAt) + '</div>' +
          '</div>' +
          '<div class="player-card__actions">' +
            '<button type="button" class="player-card__delete" data-id="' + u.id + '">삭제</button>' +
          '</div>' +
        '</div>';
    }
    els.playerList.innerHTML = html;
    els.playerList.classList.toggle('player-list--sortable', canReorder);

    var deleteBtns = els.playerList.querySelectorAll('.player-card__delete');
    for (var j = 0; j < deleteBtns.length; j++) {
      deleteBtns[j].addEventListener('click', onDeletePlayer);
    }

    if (canReorder) {
      bindDragReorder();
    }
  }

  var dragState = { id: null };

  function getOrderedIdsFromDom() {
    var cards = els.playerList.querySelectorAll('.player-card[data-id]');
    var ids = [];
    for (var i = 0; i < cards.length; i++) {
      ids.push(cards[i].getAttribute('data-id'));
    }
    return ids;
  }

  function clearDropTargets() {
    var targets = els.playerList.querySelectorAll('.player-card--drop-target');
    for (var i = 0; i < targets.length; i++) {
      targets[i].classList.remove('player-card--drop-target');
    }
  }

  function bindDragReorder() {
    var handles = els.playerList.querySelectorAll('.player-card__drag-handle');
    var cards = els.playerList.querySelectorAll('.player-card[data-id]');

    for (var h = 0; h < handles.length; h++) {
      handles[h].addEventListener('dragstart', onDragStart);
      handles[h].addEventListener('dragend', onDragEnd);
    }

    for (var c = 0; c < cards.length; c++) {
      cards[c].addEventListener('dragover', onDragOver);
      cards[c].addEventListener('dragleave', onDragLeave);
      cards[c].addEventListener('drop', onDrop);
    }
  }

  function onDragStart(e) {
    dragState.id = e.currentTarget.getAttribute('data-id');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragState.id);
    var card = e.currentTarget.closest('.player-card');
    if (card) card.classList.add('player-card--dragging');
  }

  function onDragEnd(e) {
    dragState.id = null;
    var card = e.currentTarget.closest('.player-card');
    if (card) card.classList.remove('player-card--dragging');
    clearDropTargets();
  }

  function onDragOver(e) {
    if (!dragState.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    clearDropTargets();
    var card = e.currentTarget;
    if (card.getAttribute('data-id') !== dragState.id) {
      card.classList.add('player-card--drop-target');
    }
  }

  function onDragLeave(e) {
    e.currentTarget.classList.remove('player-card--drop-target');
  }

  function onDrop(e) {
    e.preventDefault();
    var draggedId = dragState.id;
    var targetCard = e.currentTarget;
    var targetId = targetCard.getAttribute('data-id');
    clearDropTargets();

    if (!draggedId || !targetId || draggedId === targetId) return;

    var ids = getOrderedIdsFromDom();
    var fromIdx = ids.indexOf(draggedId);
    var toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;

    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedId);

    UserStorage.reorder(ids)
      .then(function () {
        renderPlayerList(els.searchInput.value);
      })
      .catch(function (err) {
        showStatus(err.message, 'error');
      });
  }

  function onDeletePlayer(e) {
    var id = e.currentTarget.getAttribute('data-id');
    var users = UserStorage.getAll();
    var target = null;
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === id) {
        target = users[i];
        break;
      }
    }
    if (!target) return;

    if (!confirm(PlayerUi.formatDisplayName(target) + ' 플레이어를 삭제할까요?')) return;

    UserStorage.remove(id)
      .then(function () {
        renderPlayerList(els.searchInput.value);
        updateFileSyncStatus();
      })
      .catch(function (err) {
        showStatus(err.message, 'error');
      });
  }

  function onRegister() {
    hideStatus();

    var parsed;
    try {
      parsed = PlayerUi.normalizeNickname(els.nickname.value);
    } catch (e) {
      showStatus(e.message, 'error');
      return;
    }

    els.registerBtn.disabled = true;

    UserStorage.add({ nickname: parsed })
      .then(function (player) {
        els.nickname.value = '';
        showStatus(PlayerUi.formatDisplayName(player) + ' 등록 완료!', 'success');
        renderPlayerList(els.searchInput.value);
        updateFileSyncStatus();
      })
      .catch(function (err) {
        showStatus(err.message, 'error');
      })
      .finally(function () {
        els.registerBtn.disabled = false;
      });
  }

  function onReload() {
    UserStorage.reload()
      .then(function () {
        renderPlayerList(els.searchInput.value);
        updateFileSyncStatus();
        showStatus('Firebase에서 데이터를 다시 불러왔습니다.', 'success');
      })
      .catch(function (err) {
        showStatus(err.message, 'error');
      });
  }

  function onClear() {
    if (!confirm('등록된 모든 플레이어 데이터를 삭제할까요?')) return;
    UserStorage.clear()
      .then(function () {
        renderPlayerList();
        updateFileSyncStatus();
        hideStatus();
      })
      .catch(function (err) {
        showStatus(err.message, 'error');
      });
  }

  els.registerBtn.addEventListener('click', onRegister);
  els.reloadBtn.addEventListener('click', onReload);
  els.nickname.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onRegister();
    }
  });
  els.clearBtn.addEventListener('click', onClear);
  els.searchInput.addEventListener('input', function () {
    renderPlayerList(els.searchInput.value);
  });

  document.addEventListener('lol-users-updated', function () {
    renderPlayerList(els.searchInput.value);
    updateFileSyncStatus();
  });

  UserStorage.init().then(function () {
    renderPlayerList();
    updateFileSyncStatus();
  }).catch(function () {
    renderPlayerList();
    updateFileSyncStatus();
  });
})();
