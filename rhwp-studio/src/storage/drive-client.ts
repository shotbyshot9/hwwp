/**
 * 구글 드라이브 REST v3 클라이언트.
 *
 * 인증 방식은 모르고 토큰만 받아 쓴다 — 웹앱(GIS)이든 확장(chrome.identity)이든
 * 이 파일은 그대로다.
 *
 * 범위가 `drive.file` 이라 **앱이 만든 파일과 폴더만** 보인다. WHP 폴더와 그 안의
 * 문서는 전부 앱이 만든 것이므로 목록·읽기·쓰기가 모두 된다. 반대로 사용자가
 * 드라이브에 직접 올려 둔 hwp 는 보이지 않는다 — 그건 피커를 거쳐야 한다.
 */

// 확장자를 명시한다 — Node 의 ESM 해석기가 확장자 없는 상대 경로를 찾지 못해
// 이 모듈을 단위 테스트에서 불러올 수 없다 (save-target.ts 와 같은 관례).
import { DRIVE_API, DRIVE_FOLDER_NAME, DRIVE_UPLOAD_API } from './drive-config.ts';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

/** 드라이브가 돌려주는 파일 한 건 */
export interface DriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
}

/** 토큰을 제공하는 쪽 (DriveAuth.getValidToken) */
export type TokenProvider = () => Promise<string | null>;

/**
 * 드라이브 호출이 실패했을 때 던지는 오류.
 *
 * 생성자 파라미터 프로퍼티(`readonly status`)를 쓰지 않는다 — Node 의 타입
 * 스트리핑이 지우지 못하는 문법이라 이 모듈을 테스트에서 불러올 수 없게 된다.
 */
export class DriveError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'DriveError';
    this.status = status;
  }
}

/** 문서 확장자에 맞는 MIME 타입. 드라이브가 파일을 분류하는 데 쓴다. */
export function mimeTypeForName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.hwpx')) return 'application/hwp+zip';
  if (lower.endsWith('.hml')) return 'application/xml';
  return 'application/x-hwp';
}

/**
 * 드라이브 `q` 문자열에 들어갈 값을 감싼다.
 *
 * 이름에 작은따옴표가 들어가면 질의가 깨지므로 역슬래시로 escape 한다.
 * (`파일'이름.hwp` 같은 이름이 실제로 들어온다.)
 */
export function quoteQueryValue(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * 멀티파트 업로드 본문을 만든다.
 *
 * 드라이브는 메타데이터와 내용을 한 요청에 보낼 때 `multipart/related` 를 받는다.
 * 경계 문자열은 본문에 나타나면 안 되므로 충분히 긴 무작위 값을 쓴다.
 */
export function buildMultipartBody(
  metadata: Record<string, unknown>,
  content: Blob,
  boundary: string,
): { body: Blob; contentType: string } {
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${content.type || 'application/octet-stream'}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  return {
    body: new Blob([head, content, tail]),
    contentType: `multipart/related; boundary=${boundary}`,
  };
}

function randomBoundary(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `whp${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export class DriveClient {
  /** 확보한 WHP 폴더 id. 한 세션에 한 번만 찾는다 */
  private folderId: string | null = null;
  private folderLookup: Promise<string> | null = null;
  private getToken: TokenProvider;

  constructor(getToken: TokenProvider) {
    this.getToken = getToken;
  }

  /** 세션 사이에 폴더 id 를 잊게 한다 (계정이 바뀌었을 때) */
  reset(): void {
    this.folderId = null;
    this.folderLookup = null;
  }

  private async authorized(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.getToken();
    if (!token) throw new DriveError('구글 드라이브에 연결되어 있지 않습니다');

    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(url, { ...init, headers });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new DriveError(
        `드라이브 요청 실패 (${response.status}) ${detail.slice(0, 200)}`,
        response.status,
      );
    }
    return response;
  }

  /**
   * WHP 폴더를 확보한다. 없으면 만든다.
   *
   * 같은 이름의 폴더가 여러 개 나오면 가장 먼저 만들어진 것을 쓴다 — 다른 탭이
   * 동시에 만들었을 때 문서가 두 폴더로 갈리는 것을 막는다.
   */
  async ensureFolder(): Promise<string> {
    if (this.folderId) return this.folderId;
    if (this.folderLookup) return this.folderLookup;

    this.folderLookup = (async () => {
      const q = [
        `mimeType=${quoteQueryValue(FOLDER_MIME)}`,
        `name=${quoteQueryValue(DRIVE_FOLDER_NAME)}`,
        'trashed=false',
      ].join(' and ');
      const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,createdTime)&orderBy=createdTime`;
      const found = await this.authorized(url).then((r) => r.json()) as { files?: DriveFile[] };

      const existing = found.files?.[0];
      if (existing) {
        this.folderId = existing.id;
        return existing.id;
      }

      const created = await this.authorized(`${DRIVE_API}/files?fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: FOLDER_MIME }),
      }).then((r) => r.json()) as { id: string };

      this.folderId = created.id;
      return created.id;
    })().finally(() => {
      this.folderLookup = null;
    });

    return this.folderLookup;
  }

  /** WHP 폴더 안의 문서 목록 (최근 수정 순) */
  async listDocs(): Promise<DriveFile[]> {
    const folderId = await this.ensureFolder();
    const q = `${quoteQueryValue(folderId)} in parents and trashed=false`;
    const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=200`;
    const result = await this.authorized(url).then((r) => r.json()) as { files?: DriveFile[] };
    return result.files ?? [];
  }

  /** 파일 내용을 내려받는다 */
  async download(fileId: string): Promise<Uint8Array> {
    const response = await this.authorized(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`);
    return new Uint8Array(await response.arrayBuffer());
  }

  /** WHP 폴더에 새 문서를 만든다 */
  async createDoc(name: string, content: Blob): Promise<DriveFile> {
    const folderId = await this.ensureFolder();
    const { body, contentType } = buildMultipartBody(
      { name, parents: [folderId], mimeType: mimeTypeForName(name) },
      content,
      randomBoundary(),
    );
    return await this.authorized(
      `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,modifiedTime`,
      { method: 'POST', headers: { 'Content-Type': contentType }, body },
    ).then((r) => r.json()) as DriveFile;
  }

  /** 이미 있는 문서를 덮어쓴다 */
  async updateDoc(fileId: string, content: Blob): Promise<DriveFile> {
    return await this.authorized(
      `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,name,modifiedTime`,
      { method: 'PATCH', headers: { 'Content-Type': content.type || 'application/octet-stream' }, body: content },
    ).then((r) => r.json()) as DriveFile;
  }

  /** 이름만 바꾼다 */
  async renameDoc(fileId: string, name: string): Promise<DriveFile> {
    return await this.authorized(
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,name,modifiedTime`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      },
    ).then((r) => r.json()) as DriveFile;
  }
}
