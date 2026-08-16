/**
 * 구글 드라이브 인증.
 *
 * 액세스 토큰 수명(약 1시간)은 구글이 고정한 값이라 늘릴 수 없다. 대신 **만료 전에
 * 미리 조용히 갈아 끼워** 사용자가 만료를 느끼지 못하게 한다. 만료를 감지한 뒤에
 * 갱신하면 그 순간 돌던 자동 저장이 한 번 실패한다.
 *
 * 인증 방식은 플랫폼마다 다르다 — 웹앱은 GIS 스크립트를 불러 쓰지만, 크롬 확장은
 * MV3 CSP(`script-src 'self'`)가 원격 스크립트를 막아 `chrome.identity` 를 써야 한다.
 * 그래서 `DriveAuth` 인터페이스로 갈라 두고, 드라이브 클라이언트는 토큰만 받아 쓴다.
 */

// 확장자를 명시한다 — Node 의 ESM 해석기가 확장자 없는 상대 경로를 찾지 못해
// 이 모듈을 단위 테스트에서 불러올 수 없다 (save-target.ts 와 같은 관례).
import {
  DRIVE_SCOPE,
  GIS_SCRIPT_URL,
  GOOGLE_CLIENT_ID,
  TOKEN_REFRESH_MARGIN_MS,
} from './drive-config.ts';

/** 플랫폼에 상관없이 드라이브 클라이언트가 기대하는 인증 표면 */
export interface DriveAuth {
  isConnected(): boolean;
  /** 연결된 계정 메일. 모르면 null */
  getAccountEmail(): string | null;
  /** 사용자 제스처 안에서 불러야 한다 (팝업이 뜬다) */
  connect(): Promise<boolean>;
  disconnect(): void;
  /** 유효한 토큰. 만료가 가까우면 조용히 갱신한다. 실패하면 null */
  getValidToken(): Promise<string | null>;
  /** 연결 상태가 바뀔 때 알림. 해제 함수를 돌려준다 */
  onChange(listener: () => void): () => void;
}

/**
 * 다음 갱신까지 기다릴 시간(ms).
 *
 * 만료 `margin` 전에 깨어난다. 이미 지났으면 0 — 즉시 갱신한다.
 * 순수 함수로 빼 두어 타이머 동작을 눈으로 확인하지 않고 테스트로 고정한다.
 */
export function nextRefreshDelay(expiresAt: number, now: number, margin = TOKEN_REFRESH_MARGIN_MS): number {
  return Math.max(0, expiresAt - margin - now);
}

/** 지금 토큰을 그대로 써도 되는가 */
export function isTokenUsable(expiresAt: number, now: number, margin = TOKEN_REFRESH_MARGIN_MS): boolean {
  return expiresAt - margin > now;
}

interface TokenResponse {
  access_token?: string;
  /** 초 단위 */
  expires_in?: number;
  error?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: unknown) => void;
  }): TokenClient;
  revoke(token: string, done: () => void): void;
}

function googleOAuth2(): GoogleOAuth2 | null {
  const google = (window as unknown as { google?: { accounts?: { oauth2?: GoogleOAuth2 } } }).google;
  return google?.accounts?.oauth2 ?? null;
}

let gisLoading: Promise<boolean> | null = null;

/** GIS 스크립트를 한 번만 불러온다 */
function loadGis(): Promise<boolean> {
  if (googleOAuth2()) return Promise.resolve(true);
  if (gisLoading) return gisLoading;

  gisLoading = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(googleOAuth2() != null), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(googleOAuth2() != null);
    script.onerror = () => {
      console.warn('[drive] 구글 인증 스크립트를 불러오지 못했습니다');
      resolve(false);
    };
    document.head.appendChild(script);
  });
  return gisLoading;
}

/** 웹앱용 구현 (Google Identity Services) */
export class GisDriveAuth implements DriveAuth {
  private token: string | null = null;
  private expiresAt = 0;
  private email: string | null = null;
  private client: TokenClient | null = null;
  private refreshTimer: number | null = null;
  /** 진행 중인 갱신. 자동 저장이 겹쳐 들어와도 요청은 하나만 나가게 한다 */
  private inFlight: Promise<string | null> | null = null;
  private listeners = new Set<() => void>();
  private clientId: string;

  // 생성자 파라미터 프로퍼티는 쓰지 않는다 — Node 의 타입 스트리핑이 지우지 못해
  // 이 모듈을 테스트에서 불러올 수 없게 된다.
  constructor(clientId: string = GOOGLE_CLIENT_ID) {
    this.clientId = clientId;
    document.addEventListener('visibilitychange', () => {
      // 탭이 잠들어 있는 동안 타이머가 밀릴 수 있다 — 돌아오면 남은 시간을 다시 본다.
      if (document.visibilityState === 'visible' && this.token) this.scheduleRefresh();
    });
  }

  isConnected(): boolean {
    return this.token !== null;
  }

  getAccountEmail(): string | null {
    return this.email;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async connect(): Promise<boolean> {
    const token = await this.requestToken('consent');
    if (token) void this.fetchEmail(token);
    return token !== null;
  }

  disconnect(): void {
    const token = this.token;
    this.clearToken();
    if (token) googleOAuth2()?.revoke(token, () => { /* 취소 완료 */ });
    this.notify();
  }

  async getValidToken(): Promise<string | null> {
    if (this.token && isTokenUsable(this.expiresAt, Date.now())) return this.token;
    // 만료가 가까우면 동의 화면 없이 조용히 새로 받는다.
    return this.requestToken('');
  }

  /**
   * 토큰 요청. `prompt` 가 빈 문자열이면 화면 없이 갱신을 시도한다.
   * 같은 순간 여러 저장이 겹쳐도 요청은 하나만 나간다.
   */
  private requestToken(prompt: '' | 'consent'): Promise<string | null> {
    if (this.inFlight) return this.inFlight;

    this.inFlight = (async () => {
      const ready = await loadGis();
      const oauth2 = googleOAuth2();
      if (!ready || !oauth2) return null;

      return new Promise<string | null>((resolve) => {
        let settled = false;
        const finish = (value: string | null) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };

        this.client = oauth2.initTokenClient({
          client_id: this.clientId,
          scope: DRIVE_SCOPE,
          callback: (response) => {
            if (!response.access_token) {
              finish(null);
              return;
            }
            this.token = response.access_token;
            // 응답의 실제 수명을 쓴다. 1시간으로 넘겨짚으면 예상보다 일찍 401 이 난다.
            const lifetimeMs = (response.expires_in ?? 3600) * 1000;
            this.expiresAt = Date.now() + lifetimeMs;
            this.scheduleRefresh();
            this.notify();
            finish(this.token);
          },
          error_callback: (error) => {
            console.warn('[drive] 토큰 요청 실패:', error);
            finish(null);
          },
        });
        this.client.requestAccessToken({ prompt });
      });
    })().finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
  }

  /** 만료 전에 미리 깨어나도록 예약한다 */
  private scheduleRefresh(): void {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    const delay = nextRefreshDelay(this.expiresAt, Date.now());
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      void this.requestToken('').then((token) => {
        if (!token) {
          // 조용한 갱신이 막히는 경우가 있다 — 사파리 ITP·서드파티 쿠키 차단·구글 로그아웃.
          // 여기서 사용자를 붙잡지 않는다. 저장은 로컬 복구본에 쌓이고, 다음 저장에서 다시 시도한다.
          console.info('[drive] 무음 갱신 실패 — 다음 저장에서 재시도합니다');
          this.clearToken();
          this.notify();
        }
      });
    }, delay);
  }

  private clearToken(): void {
    this.token = null;
    this.expiresAt = 0;
    this.email = null;
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }

  private async fetchEmail(token: string): Promise<void> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const info = await response.json() as { email?: string };
      this.email = info.email ?? null;
      this.notify();
    } catch {
      // 메일 주소는 화면 표시용일 뿐이라 실패해도 연동은 계속된다.
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
