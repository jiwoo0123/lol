# LoL 내전 관리

친구들끼리 하는 리그 오브 레전드 내전을 위한 간단한 웹 앱입니다.  
플레이어 등록, 파티 구성, 전적 기록·조회를 브라우저에서 할 수 있습니다.

## 기능

- **유저 등록** — 닉네임 등록, 순서 변경, 삭제
- **파티** — 참가자 모집, 팀장·팀 배치, 블루/레드, 승리팀 기록
- **전적** — 개인/전체 검색, 기간 필터, 승률, 경기 삭제

데이터는 **Firebase Firestore**에 저장되며, 여러 기기에서 실시간으로 공유됩니다.

## 사용 페이지

| 파일 | 설명 |
|------|------|
| `party.html` | 파티 · 팀 나누기 (메인) |
| `users.html` | 플레이어 등록 |
| `history.html` | 전적 조회 |

`index.html`은 `party.html`로 이동합니다.

## 설정

### 1. Firebase

1. [Firebase Console](https://console.firebase.google.com/)에서 프로젝트 생성
2. **Firestore Database** 활성화
3. 웹 앱 추가 후 설정값을 `js/firebase-config.js`에 입력  
   (`firebase-config.example.js` 참고)
4. Firestore 규칙에 `firestore.rules` 내용 적용

### 2. 로컬 실행

HTML 파일을 브라우저로 열거나, 간단한 정적 서버로 실행합니다.

```bash
npx serve .
```

### 3. GitHub Pages (선택)

저장소 push 후 **Settings → Pages → main / root** 로 배포합니다.

## 기술

- HTML / CSS / JavaScript (빌드 없음)
- Firebase Firestore
- 파티 구성만 `localStorage` (세션)
