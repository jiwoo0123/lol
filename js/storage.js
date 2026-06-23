/**
 * Firestore 기반 유저 저장소 (실시간 동기화)
 */
var UserStorage = (function () {
  var COLLECTION = 'users';
  var usersCache = [];
  var unsubscribe = null;
  var lastError = '';

  function setLastError(err) {
    if (!err) {
      lastError = '';
      return;
    }
    lastError = FirebaseApp.formatError(err);
    document.dispatchEvent(new CustomEvent('lol-firestore-error', { detail: lastError }));
  }

  function compareBySortOrder(a, b) {
    var ao = a.sortOrder != null ? a.sortOrder : 999999;
    var bo = b.sortOrder != null ? b.sortOrder : 999999;
    if (ao !== bo) return ao - bo;
    return (a.registeredAt || '').localeCompare(b.registeredAt || '');
  }

  function parseAccounts(data) {
    if (Array.isArray(data.accounts)) {
      var list = [];
      for (var i = 0; i < data.accounts.length; i++) {
        var item = (data.accounts[i] || '').trim();
        if (item) list.push(item.slice(0, 64));
      }
      return list.slice(0, 10);
    }
    if (data.memo && String(data.memo).trim()) {
      return [String(data.memo).trim().slice(0, 200)];
    }
    return [];
  }

  function docToUser(doc) {
    var data = doc.data() || {};
    return {
      id: doc.id,
      nickname: data.nickname || '',
      accounts: parseAccounts(data),
      sortOrder: data.sortOrder != null ? data.sortOrder : null,
      registeredAt: data.registeredAt || ''
    };
  }

  function emitUpdated() {
    document.dispatchEvent(new CustomEvent('lol-users-updated'));
  }

  function applySnapshot(snapshot) {
    usersCache = [];
    snapshot.forEach(function (doc) {
      usersCache.push(docToUser(doc));
    });
    usersCache.sort(compareBySortOrder);
    emitUpdated();
  }

  function usersRef() {
    return FirebaseApp.getDb().collection(COLLECTION);
  }

  function generateId() {
    return 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  return {
    init: function () {
      return FirebaseApp.init().then(function () {
        return new Promise(function (resolve, reject) {
          if (unsubscribe) unsubscribe();
          var settled = false;

          unsubscribe = usersRef().onSnapshot(
            function (snapshot) {
              setLastError(null);
              applySnapshot(snapshot);
              if (!settled) {
                settled = true;
                resolve();
              }
            },
            function (err) {
              setLastError(err);
              if (!settled) {
                settled = true;
                reject(err);
              }
            }
          );
        });
      });
    },

    getAll: function () {
      return usersCache.slice().sort(compareBySortOrder);
    },

    findByNickname: function (nickname) {
      var lower = nickname.toLowerCase();
      var all = this.getAll();
      for (var i = 0; i < all.length; i++) {
        if (all[i].nickname.toLowerCase() === lower) {
          return all[i];
        }
      }
      return null;
    },

    add: function (userData) {
      var nickname = (userData.nickname || '').trim().slice(0, 32);
      if (!nickname) {
        return Promise.reject(new Error('별명을 입력하세요.'));
      }

      var existing = this.findByNickname(nickname);
      if (existing) {
        return Promise.reject(new Error('이미 등록된 플레이어입니다: ' + nickname));
      }

      var all = this.getAll();
      var nextOrder = all.length;
      for (var n = 0; n < all.length; n++) {
        if (all[n].sortOrder != null && all[n].sortOrder >= nextOrder) {
          nextOrder = all[n].sortOrder + 1;
        }
      }

      var id = generateId();
      var now = new Date().toISOString();
      var accounts = Array.isArray(userData.accounts) ? userData.accounts : [];
      var user = {
        id: id,
        nickname: nickname,
        accounts: accounts,
        sortOrder: nextOrder,
        registeredAt: now
      };

      return usersRef().doc(id).set({
        nickname: nickname,
        accounts: accounts,
        sortOrder: nextOrder,
        registeredAt: now
      }).then(function () {
        return user;
      }).catch(function (err) {
        setLastError(err);
        return Promise.reject(new Error(FirebaseApp.formatError(err)));
      });
    },

    reorder: function (orderedIds) {
      var batch = FirebaseApp.getDb().batch();
      for (var i = 0; i < orderedIds.length; i++) {
        batch.update(usersRef().doc(orderedIds[i]), { sortOrder: i });
      }
      return batch.commit();
    },

    remove: function (id) {
      return usersRef().doc(id).delete().then(function () { return true; });
    },

    updateAccounts: function (id, accounts) {
      var list = [];
      if (Array.isArray(accounts)) {
        for (var i = 0; i < accounts.length; i++) {
          var item = (accounts[i] || '').trim();
          if (item) list.push(item.slice(0, 64));
        }
      }
      list = list.slice(0, 10);

      var payload = {
        accounts: list,
        memo: firebase.firestore.FieldValue.delete()
      };

      return usersRef().doc(id).update(payload).catch(function (err) {
        setLastError(err);
        return Promise.reject(new Error(FirebaseApp.formatError(err)));
      });
    },

    updateNickname: function (id, nickname) {
      nickname = (nickname || '').trim();
      if (!nickname) {
        return Promise.reject(new Error('별명을 입력하세요.'));
      }

      var existing = this.findByNickname(nickname);
      if (existing && existing.id !== id) {
        return Promise.reject(new Error('이미 등록된 별명입니다: ' + nickname));
      }

      return usersRef().doc(id).update({ nickname: nickname }).catch(function (err) {
        setLastError(err);
        return Promise.reject(new Error(FirebaseApp.formatError(err)));
      });
    },

    clear: function () {
      var all = this.getAll();
      if (all.length === 0) return Promise.resolve();
      var batch = FirebaseApp.getDb().batch();
      for (var i = 0; i < all.length; i++) {
        batch.delete(usersRef().doc(all[i].id));
      }
      return batch.commit();
    },

    reload: function () {
      return FirebaseApp.init().then(function () {
        return usersRef().get().then(function (snapshot) {
          applySnapshot(snapshot);
          return true;
        });
      });
    },

    canWrite: function () {
      return FirebaseApp.isReady() && !lastError;
    },

    getLastError: function () {
      return lastError;
    }
  };
})();
