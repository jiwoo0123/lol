/**
 * Firestore 기반 전적 저장소 (실시간 동기화)
 */
var MatchHistory = (function () {
  var COLLECTION = 'matches';
  var matchesCache = [];
  var unsubscribe = null;
  var loadSource = '';
  var lastError = '';

  function setLastError(err) {
    if (!err) {
      lastError = '';
      return;
    }
    lastError = FirebaseApp.formatError(err);
    document.dispatchEvent(new CustomEvent('lol-firestore-error', { detail: lastError }));
  }

  function getTeamPlayerIds(team) {
    if (!team) return [];
    var ids = [];
    if (team.captainId) ids.push(team.captainId);
    var members = team.memberIds || [];
    for (var i = 0; i < members.length; i++) {
      if (ids.indexOf(members[i]) < 0) ids.push(members[i]);
    }
    return ids;
  }

  function userSideInMatch(match, userId) {
    var blueIds = getTeamPlayerIds(match.teams.blue);
    if (blueIds.indexOf(userId) >= 0) return 'blue';
    var redIds = getTeamPlayerIds(match.teams.red);
    if (redIds.indexOf(userId) >= 0) return 'red';
    return null;
  }

  function sortNewest(list) {
    return list.slice().sort(function (a, b) {
      return (b.recordedAt || '').localeCompare(a.recordedAt || '');
    });
  }

  function docToMatch(doc) {
    var data = doc.data() || {};
    var teams = data.teams || {};
    return {
      id: doc.id,
      recordedAt: data.recordedAt || '',
      winnerSide: data.winnerSide === 'red' ? 'red' : 'blue',
      teams: {
        blue: {
          captainId: (teams.blue && teams.blue.captainId) || '',
          memberIds: (teams.blue && teams.blue.memberIds) ? teams.blue.memberIds.slice() : []
        },
        red: {
          captainId: (teams.red && teams.red.captainId) || '',
          memberIds: (teams.red && teams.red.memberIds) ? teams.red.memberIds.slice() : []
        }
      }
    };
  }

  function emitUpdated() {
    document.dispatchEvent(new CustomEvent('lol-matches-updated'));
  }

  function applySnapshot(snapshot) {
    matchesCache = [];
    snapshot.forEach(function (doc) {
      matchesCache.push(docToMatch(doc));
    });
    matchesCache = sortNewest(matchesCache);
    emitUpdated();
  }

  function matchesRef() {
    return FirebaseApp.getDb().collection(COLLECTION);
  }

  function generateId() {
    return 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  return {
    init: function () {
      return FirebaseApp.init().then(function () {
        return new Promise(function (resolve, reject) {
          if (unsubscribe) unsubscribe();
          var settled = false;

          unsubscribe = matchesRef().onSnapshot(
            function (snapshot) {
              setLastError(null);
              applySnapshot(snapshot);
              loadSource = 'firebase';
              if (!settled) {
                settled = true;
                resolve({ source: 'firebase', name: 'Firebase' });
              }
            },
            function (err) {
              loadSource = 'error';
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
      return sortNewest(matchesCache);
    },

    getByUserId: function (userId) {
      if (!userId) return this.getAll();
      var filtered = [];
      for (var i = 0; i < matchesCache.length; i++) {
        if (userSideInMatch(matchesCache[i], userId)) {
          filtered.push(matchesCache[i]);
        }
      }
      return sortNewest(filtered);
    },

    add: function (record) {
      var id = generateId();
      var now = new Date().toISOString();
      var winnerSide = record.winnerSide === 'red' ? 'red' : 'blue';
      var entry = {
        id: id,
        recordedAt: now,
        winnerSide: winnerSide,
        teams: record.teams
      };

      return matchesRef().doc(id).set({
        recordedAt: now,
        winnerSide: winnerSide,
        teams: record.teams
      }).then(function () {
        return entry;
      }).catch(function (err) {
        setLastError(err);
        return Promise.reject(new Error(FirebaseApp.formatError(err)));
      });
    },

    remove: function (id) {
      return matchesRef().doc(id).delete().then(function () { return true; });
    },

    getUserRecord: function (userId) {
      var matches = this.getByUserId(userId);
      var wins = 0;
      var losses = 0;
      for (var i = 0; i < matches.length; i++) {
        var side = userSideInMatch(matches[i], userId);
        if (!side) continue;
        if (matches[i].winnerSide === side) wins++;
        else losses++;
      }
      return { wins: wins, losses: losses, total: wins + losses };
    },

    getOpponentStats: function (userId) {
      var matches = this.getByUserId(userId);
      var stats = {};

      for (var i = 0; i < matches.length; i++) {
        var match = matches[i];
        var mySide = userSideInMatch(match, userId);
        if (!mySide) continue;

        var oppSide = mySide === 'blue' ? 'red' : 'blue';
        var oppIds = getTeamPlayerIds(match.teams[oppSide]);
        var iWon = match.winnerSide === mySide;

        for (var j = 0; j < oppIds.length; j++) {
          var oppId = oppIds[j];
          if (oppId === userId) continue;
          if (!stats[oppId]) stats[oppId] = { wins: 0, losses: 0 };
          if (iWon) stats[oppId].wins++;
          else stats[oppId].losses++;
        }
      }

      return stats;
    },

    reload: function () {
      return FirebaseApp.init().then(function () {
        return matchesRef().get().then(function (snapshot) {
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
    },

    userSideInMatch: userSideInMatch,
    getTeamPlayerIds: getTeamPlayerIds
  };
})();
