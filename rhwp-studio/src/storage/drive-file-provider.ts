/**
 * 드라이브에서 문서 바이트를 가져오는 공용 통로.
 *
 * 문서 비교처럼 "파일을 하나 더 골라야 하는" 화면이 드라이브에도 닿아야 하는데,
 * 그 화면들은 인증·백엔드·피커를 알지 못한다. main.ts 가 한 번 등록해 두면
 * 필요한 곳에서 이 통로로만 부른다.
 *
 * 등록 전(드라이브 연동이 없는 빌드·확장 등)에는 null 이므로, 호출부는 그때
 * 드라이브 버튼을 감추면 된다.
 */

export interface DriveFilePayload {
  bytes: Uint8Array;
  fileName: string;
}

/** 사용자가 드라이브에서 문서를 고르게 하고 그 내용을 돌려준다. 취소하면 null */
export type DriveFileProvider = () => Promise<DriveFilePayload | null>;

let provider: DriveFileProvider | null = null;

export function setDriveFileProvider(next: DriveFileProvider | null): void {
  provider = next;
}

export function getDriveFileProvider(): DriveFileProvider | null {
  return provider;
}
