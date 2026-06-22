/**
 * ACS (acs.leagueoflegends.com) · 사설/커스텀 전적
 * id_token: leagueoflegends.com 로그인 쿠키
 */
var AcsApi = (function () {
  var ACS_BASE = 'https://acs.leagueoflegends.com/v1';
  var CORS_PROXY = 'https://corsproxy.io/?';
  var QUEUE_CUSTOM = 0;
  var REQUEST_TIMEOUT_MS = 12000;
  var GAME_REGION = 'KR1';
  var HISTORY_REGION = 'KR';

  var championMap = null;
  var championMapPromise = null;

  function loadChampionMap() {
    if (championMap) {
      return Promise.resolve(championMap);
    }
    if (championMapPromise) {
      return championMapPromise;
    }
    championMapPromise = fetch('https://ddragon.leagueoflegends.com/cdn/14.24.1/data/ko_KR/champion.json')
      .then(function (res) { return res.json(); })
      .then(function (json) {
        championMap = {};
        var data = json.data || {};
        for (var key in data) {
          if (Object.prototype.hasOwnProperty.call(data, key)) {
            championMap[data[key].key] = data[key].name;
          }
        }
        return championMap;
      })
      .catch(function () {
        championMap = {};
        return championMap;
      });
    return championMapPromise;
  }

  function getChampionName(championId) {
    if (!championMap || !championId) return '챔피언 ' + (championId || '?');
    return championMap[String(championId)] || ('챔피언 ' + championId);
  }

  function parseIdToken(raw) {
    raw = (raw || '').trim();
    if (!raw) return '';

    if (raw.indexOf('id_token=') >= 0) {
      var parts = raw.split(';');
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i].trim();
        if (p.indexOf('id_token=') === 0) {
          return decodeURIComponent(p.slice(9));
        }
      }
    }

    if (raw.indexOf('=') < 0) {
      return raw;
    }
    return raw;
  }

  function parsePvpnetId(raw) {
    raw = (raw || '').trim();
    if (!raw) return '';

    if (raw.indexOf('PVPNET_ID_KR=') >= 0) {
      var parts = raw.split(';');
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i].trim();
        if (p.indexOf('PVPNET_ID_KR=') === 0) {
          return p.slice(14);
        }
      }
    }

    if (/^\d+$/.test(raw)) {
      return raw;
    }
    return '';
  }

  function acsFetch(path, idToken) {
    var url = ACS_BASE + path;
    var token = parseIdToken(idToken);
    if (!token) {
      return Promise.reject(new Error('id_token이 필요합니다. leagueoflegends.com 로그인 후 쿠키에서 복사하세요.'));
    }

    var proxyUrl = CORS_PROXY + encodeURIComponent(url);
    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    return fetch(proxyUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Cookie: 'id_token=' + token
      },
      signal: controller.signal
    }).then(function (response) {
      return response.text().then(function (text) {
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error('ACS 인증 실패. id_token이 만료되었을 수 있습니다. 쿠키에서 다시 복사하세요.');
          }
          throw new Error('ACS 오류 (' + response.status + ')');
        }
        try {
          return JSON.parse(text);
        } catch (e) {
          throw new Error('ACS 응답을 읽을 수 없습니다.');
        }
      });
    }).catch(function (err) {
      if (err.name === 'AbortError') {
        throw new Error('ACS 요청 시간 초과');
      }
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        throw new Error('ACS 호출 실패 (CORS/네트워크). 인터넷 연결을 확인하세요.');
      }
      throw err;
    }).finally(function () {
      clearTimeout(timer);
    });
  }

  function resolveAccountId(gameName, idToken, pvpnetIdHint) {
    var direct = parsePvpnetId(pvpnetIdHint);
    if (direct) {
      return Promise.resolve(direct);
    }

    var name = encodeURIComponent(gameName);
    return acsFetch('/players?name=' + name + '&region=' + GAME_REGION, idToken)
      .then(function (json) {
        if (json && json.accountId) {
          return String(json.accountId);
        }
        if (json && json.summonerId) {
          return String(json.summonerId);
        }
        throw new Error('플레이어 계정 ID를 찾지 못했습니다. PVPNET_ID_KR을 직접 입력해 보세요.');
      });
  }

  function fetchPrivateHistory(accountId, idToken, begIndex, endIndex) {
    var path =
      '/stats/player_history/' + HISTORY_REGION + '/' + accountId +
      '?begIndex=' + begIndex + '&endIndex=' + endIndex + '&queue=' + QUEUE_CUSTOM;

    return acsFetch(path, idToken).then(function (json) {
      var games = Array.isArray(json) ? json : (json && json.games) || [];
      return games.filter(function (g) {
        return g.queueId === QUEUE_CUSTOM || g.queueId === undefined;
      });
    });
  }

  function fetchGameDetail(gameId, idToken) {
    return acsFetch('/stats/game/' + GAME_REGION + '/' + gameId, idToken);
  }

  function findParticipant(game, gameName, tagLine) {
    var identities = game.participantIdentities || [];
    var targetName = (gameName + '#' + tagLine).toLowerCase();
    var targetGame = gameName.toLowerCase();

    for (var i = 0; i < identities.length; i++) {
      var p = identities[i].player || {};
      var name = (p.summonerName || p.gameName || '').toLowerCase();
      var riotId = name;
      if (p.tagLine) {
        riotId = (p.gameName || name) + '#' + p.tagLine;
        riotId = riotId.toLowerCase();
      }
      if (riotId === targetName || name === targetGame || name.indexOf(targetGame) === 0) {
        return identities[i].participantId;
      }
    }
    return null;
  }

  function summarizeGame(game, participantId) {
    var participant = null;
    var parts = game.participants || [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].participantId === participantId) {
        participant = parts[i];
        break;
      }
    }

    var stats = participant && participant.stats ? participant.stats : {};
    var teamId = participant ? participant.teamId : 0;
    var won = !!stats.win;

    return {
      gameId: game.gameId,
      gameCreation: game.gameCreation,
      gameDuration: game.gameDuration,
      queueId: game.queueId,
      championId: participant ? participant.championId : 0,
      kills: stats.kills || 0,
      deaths: stats.deaths || 0,
      assists: stats.assists || 0,
      win: won,
      teamId: teamId
    };
  }

  return {
    QUEUE_CUSTOM: QUEUE_CUSTOM,
    parseIdToken: parseIdToken,
    parsePvpnetId: parsePvpnetId,
    loadChampionMap: loadChampionMap,
    getChampionName: getChampionName,
    resolveAccountId: resolveAccountId,
    fetchPrivateHistory: fetchPrivateHistory,
    fetchGameDetail: fetchGameDetail,
    findParticipant: findParticipant,
    summarizeGame: summarizeGame
  };
})();
