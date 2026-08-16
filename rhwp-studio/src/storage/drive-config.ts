/**
 * 구글 드라이브 연동 설정.
 *
 * 여기 있는 값은 모두 **공개되는 값**이다. 클라이언트 ID 는 브라우저가 구글에
 * 그대로 실어 보내는 식별자라 소스에 있어도 무방하다.
 *
 * 반대로 **클라이언트 보안 비밀번호(client_secret)는 이 저장소에 절대 두지 않는다.**
 * 브라우저 전용 토큰 흐름에서는 쓰이지 않으며, 번들에 들어가면 누구나 꺼내 볼 수 있다.
 * 구글 콘솔에서 내려받은 `client_secret_*.json` 은 `.gitignore` 로 막아 두었다.
 */

/** 배포처마다 클라이언트를 바꿔 끼울 수 있게 환경변수를 먼저 본다 */
const ENV_CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID as string | undefined;

/**
 * 기본 OAuth 클라이언트 ID (프로젝트 `whprocessor`, 웹 애플리케이션 유형).
 *
 * 크롬 확장으로 낼 때는 확장 ID 기반 클라이언트가 따로 필요하다 —
 * 확장은 MV3 CSP 가 원격 스크립트를 막아 GIS 를 못 불러오므로 인증 어댑터도 달라진다.
 */
export const GOOGLE_CLIENT_ID = (ENV_CLIENT_ID?.trim() || '')
  || '18457187610-jdpmb97j55uattc49g1rppnou70ig7jn.apps.googleusercontent.com';

/**
 * 요청 범위.
 *
 * `drive.file` 은 "이 앱이 만든 파일 + 사용자가 피커로 고른 파일"에만 닿는다.
 * WHP 폴더와 그 안의 문서는 앱이 만든 것이라 전부 다룰 수 있다.
 * 전체 `drive` 범위는 제한된 범위로 분류돼 공개 배포에 보안 심사가 붙으므로 쓰지 않는다.
 */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** 드라이브 안에 만들 작업 폴더 이름 */
export const DRIVE_FOLDER_NAME = 'WHP';

/** 구글 아이덴티티 서비스 스크립트 (웹앱 전용 — 확장에서는 CSP 가 막는다) */
export const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

/** Google Picker 를 띄우는 데 쓰는 gapi 로더 */
export const GAPI_SCRIPT_URL = 'https://apis.google.com/js/api.js';

/**
 * Picker 전용 API 키.
 *
 * 클라이언트 ID 와 마찬가지로 브라우저에 노출되는 공개 값이다. 실질 방어선은
 * 콘솔의 키 제한(HTTP 리퍼러 + Google Picker API 한정)이다.
 * 드라이브 읽기·쓰기는 이 키가 아니라 OAuth 토큰으로 한다 — 키는 피커 창을
 * 띄우는 데만 쓰인다.
 */
const ENV_API_KEY = import.meta.env?.VITE_GOOGLE_API_KEY as string | undefined;

export const GOOGLE_API_KEY = (ENV_API_KEY?.trim() || '')
  || 'AIzaSyCc61dyYbLWgObLZ7o2m018qtiV_2ZVE_I';

/**
 * Cloud 프로젝트 번호.
 *
 * 피커가 "어느 앱의 선택인가"를 알아야 고른 파일에 `drive.file` 권한을 넘겨준다.
 * 이게 빠지면 피커는 정상으로 보이지만 뒤이은 Drive 호출이 404 로 떨어진다 —
 * Drive 는 권한 없는 파일의 존재를 숨기려고 403 대신 404 를 돌려주기 때문이다.
 *
 * 클라이언트 ID 앞머리가 곧 프로젝트 번호라 거기서 뽑는다. 둘을 따로 적어 두면
 * 클라이언트를 바꿀 때 한쪽만 고쳐 어긋난다.
 */
export const GOOGLE_PROJECT_NUMBER = GOOGLE_CLIENT_ID.split('-')[0];

/** Drive REST v3 기본 주소 */
export const DRIVE_API = 'https://www.googleapis.com/drive/v3';
export const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

/**
 * 토큰을 만료 몇 밀리초 전에 미리 갈아 끼울지.
 *
 * 구글 액세스 토큰 수명은 약 1시간으로 고정이라 늘릴 수 없다. 대신 만료 전에
 * 조용히 새로 받아 사용자가 만료를 느끼지 못하게 한다. 만료를 감지한 뒤에
 * 갱신하면 그 순간의 저장이 한 번 실패한다.
 */
export const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
