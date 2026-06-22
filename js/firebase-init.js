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
      initError = 'Firebase 설정이 필요합니다. js/firebase-config.js 를 확인하세요.';
      return Promise.reject(new Error(initError));
    }
    if (typeof firebase === 'undefined') {
      initError = 'Firebase SDK를 불러오지 못했습니다.';
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
      initError = e.message || 'Firebase 초기화 실패';
      return Promise.reject(e);
    }
  }

  function getDb() {
    return db;
  }

  function isReady() {
    return ready;
  }

  function getInitError() {
    return initError;
  }

  function formatError(err) {
    var code = err && err.code ? err.code : '';
    var msg = err && err.message ? err.message : String(err || '알 수 없는 오류');

    if (code === 'permission-denied') {
      return 'Firestore 권한 거부: 규칙 탭에서 read/write 허용 후 게시하세요.';
    }
    if (code === 'not-found' || msg.indexOf('does not exist') >= 0) {
      return 'Firestore DB 없음: Firebase 콘솔 → Firestore Database → 데이터베이스 만들기';
    }
    if (code === 'unavailable') {
      return 'Firestore 연결 실패: 네트워크 또는 API 키 제한을 확인하세요.';
    }
    return msg;
  }

  return {
    init: init,
    getDb: getDb,
    isReady: isReady,
    isConfigured: isConfigured,
    getInitError: getInitError,
    formatError: formatError
  };
})();
