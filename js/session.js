/**
 * 내전 세션 — localStorage (참가자 · 팀 구성)
 */
var SessionStorage = (function () {
  var KEY = 'lol_inhouse_session';

  function emptySession() {
    return {
      participantIds: [],
      captainIds: [],
      teamAssignments: {},
      teamSides: {}
    };
  }

  function normalize(data) {
    if (!data || !Array.isArray(data.participantIds)) {
      return emptySession();
    }
    if (!Array.isArray(data.captainIds)) {
      data.captainIds = [];
    }
    if (!data.teamAssignments || typeof data.teamAssignments !== 'object') {
      data.teamAssignments = {};
    }
    if (!data.teamSides || typeof data.teamSides !== 'object') {
      data.teamSides = {};
    }
    return data;
  }

  function loadRaw() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) {
        return emptySession();
      }
      return normalize(JSON.parse(raw));
    } catch (e) {
      return emptySession();
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function isParticipant(data, userId) {
    return data.participantIds.indexOf(userId) >= 0;
  }

  function cleanTeams(data) {
    var participantSet = {};
    for (var i = 0; i < data.participantIds.length; i++) {
      participantSet[data.participantIds[i]] = true;
    }

    var captains = [];
    for (var c = 0; c < data.captainIds.length; c++) {
      if (participantSet[data.captainIds[c]]) {
        captains.push(data.captainIds[c]);
      }
    }
    data.captainIds = captains;

    var captainSet = {};
    for (var k = 0; k < captains.length; k++) {
      captainSet[captains[k]] = true;
    }

    var assignments = data.teamAssignments;
    var nextAssignments = {};
    for (var userId in assignments) {
      if (!Object.prototype.hasOwnProperty.call(assignments, userId)) continue;
      var captainId = assignments[userId];
      if (
        participantSet[userId] &&
        !captainSet[userId] &&
        captainSet[captainId]
      ) {
        nextAssignments[userId] = captainId;
      }
    }
    data.teamAssignments = nextAssignments;

    var sides = data.teamSides || {};
    var nextSides = {};
    for (var s = 0; s < captains.length; s++) {
      var capId = captains[s];
      nextSides[capId] = sides[capId] === 'red' ? 'red' : 'blue';
    }
    data.teamSides = nextSides;
  }

  return {

    getParticipantIds: function () {
      return loadRaw().participantIds.slice();
    },

    getCaptainIds: function () {
      return loadRaw().captainIds.slice();
    },

    getTeamAssignments: function () {
      var data = loadRaw();
      var copy = {};
      for (var key in data.teamAssignments) {
        if (Object.prototype.hasOwnProperty.call(data.teamAssignments, key)) {
          copy[key] = data.teamAssignments[key];
        }
      }
      return copy;
    },

    getTeamSide: function (captainId) {
      var data = loadRaw();
      return data.teamSides && data.teamSides[captainId] === 'red' ? 'red' : 'blue';
    },

    getTeamMemberIds: function (captainId) {
      var data = loadRaw();
      var members = [];
      for (var userId in data.teamAssignments) {
        if (
          Object.prototype.hasOwnProperty.call(data.teamAssignments, userId) &&
          data.teamAssignments[userId] === captainId
        ) {
          members.push(userId);
        }
      }
      return members;
    },

    getUnassignedIds: function () {
      var data = loadRaw();
      var captainSet = {};
      for (var i = 0; i < data.captainIds.length; i++) {
        captainSet[data.captainIds[i]] = true;
      }

      var unassigned = [];
      for (var j = 0; j < data.participantIds.length; j++) {
        var id = data.participantIds[j];
        if (captainSet[id]) continue;
        if (data.teamAssignments[id]) continue;
        unassigned.push(id);
      }
      return unassigned;
    },

    has: function (userId) {
      return loadRaw().participantIds.indexOf(userId) >= 0;
    },

    isCaptain: function (userId) {
      return loadRaw().captainIds.indexOf(userId) >= 0;
    },

    add: function (userId) {
      var data = loadRaw();
      if (data.participantIds.indexOf(userId) >= 0) {
        return false;
      }
      data.participantIds.push(userId);
      save(data);
      return true;
    },

    remove: function (userId) {
      var data = loadRaw();
      var idx = data.participantIds.indexOf(userId);
      if (idx < 0) {
        return false;
      }
      data.participantIds.splice(idx, 1);

      var captainIdx = data.captainIds.indexOf(userId);
      if (captainIdx >= 0) {
        data.captainIds.splice(captainIdx, 1);
      }

      delete data.teamAssignments[userId];
      for (var memberId in data.teamAssignments) {
        if (
          Object.prototype.hasOwnProperty.call(data.teamAssignments, memberId) &&
          data.teamAssignments[memberId] === userId
        ) {
          delete data.teamAssignments[memberId];
        }
      }
      if (data.teamSides) delete data.teamSides[userId];

      cleanTeams(data);
      save(data);
      return true;
    },

    toggleCaptain: function (userId) {
      var data = loadRaw();
      if (!isParticipant(data, userId)) {
        return false;
      }

      var idx = data.captainIds.indexOf(userId);
      if (idx >= 0) {
        data.captainIds.splice(idx, 1);
        for (var memberId in data.teamAssignments) {
          if (
            Object.prototype.hasOwnProperty.call(data.teamAssignments, memberId) &&
            data.teamAssignments[memberId] === userId
          ) {
            delete data.teamAssignments[memberId];
          }
        }
        delete data.teamAssignments[userId];
        if (data.teamSides) delete data.teamSides[userId];
      } else {
        data.captainIds.push(userId);
        delete data.teamAssignments[userId];
        if (!data.teamSides) data.teamSides = {};
        data.teamSides[userId] = 'blue';
      }

      cleanTeams(data);
      save(data);
      return true;
    },

    assignToTeam: function (userId, captainId) {
      var data = loadRaw();
      if (!isParticipant(data, userId)) {
        return false;
      }
      if (data.captainIds.indexOf(userId) >= 0) {
        return false;
      }

      if (!captainId) {
        delete data.teamAssignments[userId];
        save(data);
        return true;
      }

      if (data.captainIds.indexOf(captainId) < 0) {
        return false;
      }

      data.teamAssignments[userId] = captainId;
      save(data);
      return true;
    },

    clearTeams: function () {
      var data = loadRaw();
      data.captainIds = [];
      data.teamAssignments = {};
      data.teamSides = {};
      save(data);
    },

    toggleTeamSide: function (captainId) {
      var data = loadRaw();
      if (data.captainIds.indexOf(captainId) < 0) {
        return false;
      }
      if (!data.teamSides) data.teamSides = {};
      var current = data.teamSides[captainId] === 'red' ? 'red' : 'blue';
      data.teamSides[captainId] = current === 'blue' ? 'red' : 'blue';
      save(data);
      return true;
    },

    clear: function () {
      save(emptySession());
    },

    pruneMissing: function (validIds) {
      var valid = {};
      for (var i = 0; i < validIds.length; i++) {
        valid[validIds[i]] = true;
      }
      var data = loadRaw();
      var nextParticipants = [];
      for (var j = 0; j < data.participantIds.length; j++) {
        if (valid[data.participantIds[j]]) {
          nextParticipants.push(data.participantIds[j]);
        }
      }
      data.participantIds = nextParticipants;
      cleanTeams(data);
      save(data);
    }
  };
})();
