/**
 * Firestore 기반 유저 저장소 (실시간 동기화)
 */
var UserStorage = (function () {
  var COLLECTION = 'users';
  var usersCache = [];
  var unsubscribe = null;
  var loadSource = '';

  function compareBySortOrder(a, b) {
    var ao = a.sortOrder != null ? a.sortOrder : 999999;
    var bo = b.sortOrder != null ? b.sortOrder : 999999;
    if (ao !== bo) return ao - bo;
    return (a.registeredAt || '').localeCompare(b.registeredAt || '');
  }

  function docToUser(doc) {
    var data = doc.data() || {};
    return {
      id: doc.id,
      nickname: data.nickname || '',
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

  function normalizeSortOrders() {
    var users = UserStorage.getAll();
    if (users.length === 0) return Promise.resolve(false);

    var batch = FirebaseApp.getDb().batch();
    var changed = false;
    for (var i = 0; i < users.length; i++) {
      if (users[i].sortOrder !== i) {
        changed = true;
        batch.update(usersRef().doc(users[i].id), { sortOrder: i });
      }
    }
    if (!changed) return Promise.resolve(false);
    return batch.commit().then(function () { return true; });
  }

  return {
    init: function () {
      return FirebaseApp.init().then(function () {
        return new Promise(function (resolve, reject) {
          if (unsubscribe) unsubscribe();
          var settled = false;

          unsubscribe = usersRef().onSnapshot(
            function (snapshot) {
              applySnapshot(snapshot);
              loadSource = 'firebase';
              if (!settled) {
                settled = true;
                resolve({ source: 'firebase', name: 'Firebase' });
              }
            },
            function (err) {
              loadSource = 'error';
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

    normalizeSortOrders: normalizeSortOrders,

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
      var nickname = (userData.nickname || '').trim();
      if (!nickname) {
        return Promise.reject(new Error('닉네임을 입력하세요.'));
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
      var user = {
        id: id,
        nickname: nickname,
        sortOrder: nextOrder,
        registeredAt: now
      };

      return usersRef().doc(id).set({
        nickname: nickname,
        sortOrder: nextOrder,
        registeredAt: now
      }).then(function () {
        return user;
      });
    },

    moveUser: function (id, delta) {
      var users = this.getAll();
      var idx = -1;
      for (var i = 0; i < users.length; i++) {
        if (users[i].id === id) {
          idx = i;
          break;
        }
      }
      if (idx < 0) return Promise.resolve(false);

      var newIdx = idx + delta;
      if (newIdx < 0 || newIdx >= users.length) return Promise.resolve(false);

      var ordered = users.map(function (u) { return u.id; });
      var temp = ordered[idx];
      ordered[idx] = ordered[newIdx];
      ordered[newIdx] = temp;

      return this.reorder(ordered).then(function () { return true; });
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
      return FirebaseApp.isReady();
    }
  };
})();
