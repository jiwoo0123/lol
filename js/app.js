(function () {

  var els = {

    nickname: document.getElementById('nickname'),

    memo: document.getElementById('memo'),

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

    var userErr = UserStorage.getLastError && UserStorage.getLastError();

    if (userErr) {

      els.fileSyncStatus.hidden = false;

      els.fileSyncStatus.textContent = userErr;

      els.fileSyncStatus.className = 'file-sync-status file-sync-status--warn';

      return;

    }

    if (UserStorage.canWrite()) {

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



  function formatDate(iso) {

    if (!iso) return '-';

    try {

      return new Date(iso).toLocaleString('ko-KR');

    } catch (e) {

      return iso;

    }

  }



  function getUserById(id) {

    var users = UserStorage.getAll();

    for (var i = 0; i < users.length; i++) {

      if (users[i].id === id) return users[i];

    }

    return null;

  }



  function bindNicknameEditors(users) {
    var inputs = els.playerList.querySelectorAll('.player-card__nickname-input');
    for (var i = 0; i < inputs.length; i++) {
      var id = inputs[i].getAttribute('data-id');
      var user = null;
      for (var u = 0; u < users.length; u++) {
        if (users[u].id === id) {
          user = users[u];
          break;
        }
      }
      if (!user) continue;
      inputs[i].value = user.nickname || '';
      inputs[i].addEventListener('blur', onNicknameBlur);
      inputs[i].addEventListener('keydown', onNicknameKeydown);
    }
  }

  function saveNicknameInput(input) {
    var id = input.getAttribute('data-id');
    var target = getUserById(id);
    if (!target) return;

    var nickname;
    try {
      nickname = PlayerUi.normalizeNickname(input.value);
    } catch (e) {
      input.value = target.nickname || '';
      showStatus(e.message, 'error');
      return;
    }

    if (nickname === target.nickname) return;

    UserStorage.updateNickname(id, nickname)
      .catch(function (err) {
        input.value = target.nickname || '';
        showStatus(err.message, 'error');
      });
  }

  function onNicknameBlur(e) {
    saveNicknameInput(e.currentTarget);
  }

  function onNicknameKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }

  function renderAccountsEditor(user) {

    var accounts = PlayerUi.getAccounts(user);

    var rowCount = Math.max(accounts.length, 1);

    var rowsHtml = '';



    for (var i = 0; i < rowCount; i++) {

      rowsHtml +=

        '<div class="player-accounts__row">' +

          '<input type="text" class="player-accounts__input" data-id="' + user.id + '" placeholder="닉#태그" maxlength="64" autocomplete="off">' +

          '<button type="button" class="player-accounts__remove" data-id="' + user.id + '" title="삭제">✕</button>' +

        '</div>';

    }



    var atMax = accounts.length >= PlayerUi.ACCOUNTS_MAX;

    return (

      '<div class="player-accounts" data-id="' + user.id + '">' +

        '<div class="player-accounts__label">계정</div>' +

        '<div class="player-accounts__list">' + rowsHtml + '</div>' +

        '<button type="button" class="btn btn--ghost btn--sm player-accounts__add" data-id="' + user.id + '"' +

          (atMax ? ' disabled title="최대 ' + PlayerUi.ACCOUNTS_MAX + '개"' : '') + '>+ 계정 추가</button>' +

      '</div>'

    );

  }



  function bindAccountsEditors(users) {

    var containers = els.playerList.querySelectorAll('.player-accounts');

    for (var c = 0; c < containers.length; c++) {

      var container = containers[c];

      var id = container.getAttribute('data-id');

      var user = null;

      for (var u = 0; u < users.length; u++) {

        if (users[u].id === id) {

          user = users[u];

          break;

        }

      }

      if (!user) continue;



      var accounts = PlayerUi.getAccounts(user);

      var inputs = container.querySelectorAll('.player-accounts__input');

      for (var i = 0; i < inputs.length; i++) {

        inputs[i].value = accounts[i] || '';

        inputs[i].addEventListener('blur', onAccountsBlur);

        inputs[i].addEventListener('keydown', onAccountsKeydown);

      }



      var addBtn = container.querySelector('.player-accounts__add');

      if (addBtn) addBtn.addEventListener('click', onAccountsAdd);



      var removeBtns = container.querySelectorAll('.player-accounts__remove');

      for (var r = 0; r < removeBtns.length; r++) {

        removeBtns[r].addEventListener('click', onAccountsRemove);

      }

    }

  }



  function collectAccountsFromContainer(container) {

    var inputs = container.querySelectorAll('.player-accounts__input');

    var list = [];

    for (var i = 0; i < inputs.length; i++) {

      list.push(inputs[i].value);

    }

    return PlayerUi.normalizeAccounts(list);

  }



  function saveAccountsContainer(container) {

    var id = container.getAttribute('data-id');

    var target = getUserById(id);

    if (!target) return;



    var accounts = collectAccountsFromContainer(container);

    if (PlayerUi.accountsEqual(accounts, PlayerUi.getAccounts(target))) return;



    UserStorage.updateAccounts(id, accounts)

      .catch(function (err) {

        bindAccountsEditors([target]);

        showStatus(err.message, 'error');

      });

  }



  function onAccountsBlur(e) {

    var container = e.currentTarget.closest('.player-accounts');

    if (container) saveAccountsContainer(container);

  }



  function onAccountsKeydown(e) {

    if (e.key === 'Enter') {

      e.preventDefault();

      e.currentTarget.blur();

    }

  }



  function onAccountsAdd(e) {

    var container = e.currentTarget.closest('.player-accounts');

    if (!container) return;



    var list = container.querySelector('.player-accounts__list');

    var id = container.getAttribute('data-id');

    var row =

      '<div class="player-accounts__row">' +

        '<input type="text" class="player-accounts__input" data-id="' + id + '" placeholder="닉#태그" maxlength="64" autocomplete="off">' +

        '<button type="button" class="player-accounts__remove" data-id="' + id + '" title="삭제">✕</button>' +

      '</div>';

    list.insertAdjacentHTML('beforeend', row);



    var newInput = list.lastElementChild.querySelector('.player-accounts__input');

    var newRemove = list.lastElementChild.querySelector('.player-accounts__remove');

    newInput.addEventListener('blur', onAccountsBlur);

    newInput.addEventListener('keydown', onAccountsKeydown);

    newRemove.addEventListener('click', onAccountsRemove);

    newInput.focus();



    var count = container.querySelectorAll('.player-accounts__input').length;

    if (count >= PlayerUi.ACCOUNTS_MAX) {

      e.currentTarget.disabled = true;

      e.currentTarget.title = '최대 ' + PlayerUi.ACCOUNTS_MAX + '개';

    }

  }



  function onAccountsRemove(e) {

    var container = e.currentTarget.closest('.player-accounts');

    if (!container) return;



    var row = e.currentTarget.closest('.player-accounts__row');

    if (!row) return;



    var rows = container.querySelectorAll('.player-accounts__row');

    if (rows.length <= 1) {

      row.querySelector('.player-accounts__input').value = '';

      saveAccountsContainer(container);

      return;

    }



    row.remove();



    var addBtn = container.querySelector('.player-accounts__add');

    if (addBtn) {

      addBtn.disabled = false;

      addBtn.removeAttribute('title');

    }



    saveAccountsContainer(container);

  }



  function renderPlayerList(filter) {

    var users = UserStorage.getAll();

    var keyword = (filter || '').toLowerCase().trim();

    var canReorder = !keyword;



    if (keyword) {

      users = users.filter(function (u) {

        return PlayerUi.matchesKeyword(u, keyword);

      });

    }



    els.playerCount.textContent = '등록 ' + UserStorage.getAll().length + '명';



    if (users.length === 0) {

      var emptyMsg = keyword ? '검색 결과가 없습니다.' : '등록된 플레이어가 없습니다.';

      if (!keyword && UserStorage.getAll().length === 0 && !UserStorage.canWrite()) {

        emptyMsg += ' 잠시 후 다시 시도해 주세요.';

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

            '<input type="text" class="player-card__nickname-input" data-id="' + u.id + '" placeholder="별명" maxlength="32" autocomplete="off">' +

            renderAccountsEditor(u) +

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



    bindNicknameEditors(users);

    bindAccountsEditors(users);



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

    var target = getUserById(id);

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



    var accounts = PlayerUi.normalizeAccounts(els.memo.value ? [els.memo.value] : []);

    els.registerBtn.disabled = true;



    UserStorage.add({

      nickname: parsed,

      accounts: accounts

    })

      .then(function (player) {

        els.nickname.value = '';

        els.memo.value = '';

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

        showStatus('목록을 다시 불러왔습니다.', 'success');

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



  function isEditingPlayerCard() {

    var active = document.activeElement;

    if (!active || !active.closest) return false;

    return active.closest('.player-accounts') || active.classList.contains('player-card__nickname-input');

  }



  els.registerBtn.addEventListener('click', onRegister);

  els.reloadBtn.addEventListener('click', onReload);

  els.nickname.addEventListener('keydown', function (e) {

    if (e.key === 'Enter') {

      e.preventDefault();

      onRegister();

    }

  });

  els.memo.addEventListener('keydown', function (e) {

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

    if (isEditingPlayerCard()) {

      updateFileSyncStatus();

      return;

    }

    renderPlayerList(els.searchInput.value);

    updateFileSyncStatus();

  });



  UserStorage.init().then(function () {

    renderPlayerList();

    updateFileSyncStatus();

  }).catch(function (err) {

    renderPlayerList();

    updateFileSyncStatus();

    showStatus(FirebaseApp.formatError(err), 'error');

  });



  document.addEventListener('lol-firestore-error', function () {

    updateFileSyncStatus();

  });

})();

