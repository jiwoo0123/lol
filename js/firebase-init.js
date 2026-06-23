/**
 * Firebase / Firestore 초기화
 */
var FirebaseApp = (function () {
  var db = null;
  var ready = false;
  var initError = '';

  function isConfigured() {
    return typeof firebaseConfig !== 'undefined' &&
      firebaseConfig.apiKey &&
      firebaseConfig.apiKey !== 'YOUR_API_KEY' &&
      firebaseConfig.projectId &&
      firebaseConfig.projectId !== 'YOUR_PROJECT_ID';
  }

  function init() {
    if (ready) return Promise.resolve();
    if (!isConfigured()) {
      initError = '서비스를 시작할 수 없습니다.';
      return Promise.reject(new Error(initError));
    }
    if (typeof firebase === 'undefined') {
      initError = '연결 모듈을 불러오지 못했습니다.';
      return Promise.reject(new Error(initError));
    }

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.firestore();
      ready = true;
      initError = '';
      return Promise.resolve();
    } catch (e) {
      initError = e.message || '서비스 연결에 실패했습니다.';
      return Promise.reject(e);
    }
  }

  function getDb() {
    return db;
  }

  function isReady() {
    return ready;
  }

  function formatError(err) {
    var code = err && err.code ? err.code : '';
    var msg = err && err.message ? err.message : String(err || '알 수 없는 오류');

    if (code === 'permission-denied') {
      return '저장 권한이 없습니다. 잠시 후 다시 시도해 주세요.';
    }
    if (code === 'not-found' || msg.indexOf('does not exist') >= 0) {
      return '서버에 연결할 수 없습니다.';
    }
    if (code === 'unavailable') {
      return '네트워크 연결을 확인해 주세요.';
    }
    return msg;
  }

  return {
    init: init,
    getDb: getDb,
    isReady: isReady,
    isConfigured: isConfigured,
    formatError: formatError
  };
})();
