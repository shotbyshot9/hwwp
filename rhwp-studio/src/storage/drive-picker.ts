/**
 * 구글 드라이브 파일 선택기 (Google Picker).
 *
 * `drive.file` 범위는 앱이 만든 파일에만 닿는다. 밖에서 만들어 드라이브에 올린
 * 문서는 목록에 잡히지 않는데, 피커로 고른 파일은 그 한 건에 한해 접근이 열린다.
 * 덕분에 범위를 전체 `drive` 로 넓히지 않고도(= 구글 보안 심사를 받지 않고도)
 * 드라이브 아무 곳의 hwp 를 열 수 있다.
 *
 * 웹앱 전용이다 — 크롬 확장은 MV3 CSP 가 원격 스크립트를 막아 gapi 를 못 불러온다.
 */

import { GAPI_SCRIPT_URL, GOOGLE_API_KEY, GOOGLE_PROJECT_NUMBER } from './drive-config.ts';

/** 피커가 돌려주는 파일 한 건 */
export interface PickedFile {
  id: string;
  name: string;
}

interface PickerDocument {
  id: string;
  name: string;
  mimeType?: string;
}

interface PickerResponse {
  action: string;
  docs?: PickerDocument[];
}

interface PickerBuilderLike {
  setDeveloperKey(key: string): PickerBuilderLike;
  setOAuthToken(token: string): PickerBuilderLike;
  setAppId(appId: string): PickerBuilderLike;
  addView(view: unknown): PickerBuilderLike;
  setCallback(cb: (data: PickerResponse) => void): PickerBuilderLike;
  setTitle(title: string): PickerBuilderLike;
  build(): { setVisible(visible: boolean): void };
}

interface DocsViewLike {
  setIncludeFolders(on: boolean): DocsViewLike;
  setSelectFolderEnabled(on: boolean): DocsViewLike;
}

interface GooglePicker {
  PickerBuilder: new () => PickerBuilderLike;
  DocsView: new (viewId?: unknown) => DocsViewLike;
  ViewId: { DOCS: unknown };
  Action: { PICKED: string; CANCEL: string };
}

interface GapiLike {
  load(name: string, callback: () => void): void;
}

function gapi(): GapiLike | null {
  return (window as unknown as { gapi?: GapiLike }).gapi ?? null;
}

function picker(): GooglePicker | null {
  return (window as unknown as { google?: { picker?: GooglePicker } }).google?.picker ?? null;
}

let gapiLoading: Promise<boolean> | null = null;

/** gapi 로더와 picker 모듈을 한 번만 불러온다 */
async function loadPicker(): Promise<boolean> {
  if (picker()) return true;
  if (gapiLoading) return gapiLoading;

  gapiLoading = (async () => {
    if (!gapi()) {
      const ok = await new Promise<boolean>((resolve) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${GAPI_SCRIPT_URL}"]`);
        if (existing) {
          existing.addEventListener('load', () => resolve(true), { once: true });
          existing.addEventListener('error', () => resolve(false), { once: true });
          return;
        }
        const script = document.createElement('script');
        script.src = GAPI_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      });
      if (!ok || !gapi()) {
        console.warn('[drive] 피커 스크립트를 불러오지 못했습니다');
        return false;
      }
    }
    // gapi 본체가 떠도 picker 모듈은 따로 불러와야 한다.
    await new Promise<void>((resolve) => gapi()!.load('picker', resolve));
    return picker() != null;
  })().finally(() => {
    gapiLoading = null;
  });

  return gapiLoading;
}

/**
 * 피커를 띄우고 사용자가 고른 파일을 돌려준다.
 * 취소하면 null. 사용자 제스처 안에서 불러야 팝업이 막히지 않는다.
 *
 * @param accessToken 지금 유효한 OAuth 토큰
 */
export async function pickDriveFile(accessToken: string): Promise<PickedFile | null> {
  const ready = await loadPicker();
  const api = picker();
  if (!ready || !api) return null;

  return new Promise<PickedFile | null>((resolve) => {
    // MIME 으로 거르지 않는다 — 드라이브가 hwp 를 application/x-hwp,
    // application/haansofthwp, application/octet-stream 등 제각각으로 저장해
    // 필터를 걸면 멀쩡한 문서가 목록에서 사라진다. 고른 뒤 확장자로 판단한다.
    const view = new api.DocsView(api.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);

    new api.PickerBuilder()
      .setDeveloperKey(GOOGLE_API_KEY)
      .setOAuthToken(accessToken)
      // 앱 ID 가 있어야 고른 파일에 drive.file 권한이 넘어온다.
      // 빠뜨리면 피커는 정상으로 보이는데 뒤이은 다운로드가 404 로 떨어진다.
      .setAppId(GOOGLE_PROJECT_NUMBER)
      .setTitle('WHP 에서 열 문서를 고르세요')
      .addView(view)
      .setCallback((data) => {
        if (data.action === api.Action.PICKED) {
          const doc = data.docs?.[0];
          resolve(doc ? { id: doc.id, name: doc.name } : null);
        } else if (data.action === api.Action.CANCEL) {
          resolve(null);
        }
      })
      .build()
      .setVisible(true);
  });
}
