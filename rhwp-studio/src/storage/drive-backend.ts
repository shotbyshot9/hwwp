/**
 * 구글 드라이브 저장소 구현.
 *
 * `StorageBackend` 의 계약을 드라이브 REST 위에 얹는다. 이름 중복 회피는 여기서
 * 한다 — 드라이브는 같은 폴더에 같은 이름 파일을 여러 개 허용하므로, 막지 않으면
 * "새 문서" 가 여러 개 쌓인다.
 */

import type { DriveClient, DriveFile } from './drive-client.ts';
import { uniqueDocName } from './doc-name.ts';
import type { SaveOutcome, StorageBackend, StoredDocRef } from './storage-backend.ts';

function toRef(file: DriveFile): StoredDocRef {
  return {
    id: file.id,
    name: file.name,
    modifiedAt: file.modifiedTime ? Date.parse(file.modifiedTime) : undefined,
  };
}

export class DriveBackend implements StorageBackend {
  readonly kind = 'drive' as const;

  private client: DriveClient;
  private ready: () => boolean;

  constructor(client: DriveClient, ready: () => boolean) {
    this.client = client;
    this.ready = ready;
  }

  isReady(): boolean {
    return this.ready();
  }

  async list(): Promise<StoredDocRef[]> {
    return (await this.client.listDocs()).map(toRef);
  }

  async read(ref: StoredDocRef): Promise<{ name: string; bytes: Uint8Array }> {
    return { name: ref.name, bytes: await this.client.download(ref.id) };
  }

  async create(name: string, blob: Blob): Promise<SaveOutcome> {
    const unique = await this.resolveName(name);
    const created = await this.client.createDoc(unique, blob);
    return {
      ref: toRef(created),
      renamedTo: unique === name ? undefined : unique,
    };
  }

  async update(ref: StoredDocRef, blob: Blob): Promise<SaveOutcome> {
    return { ref: toRef(await this.client.updateDoc(ref.id, blob)) };
  }

  async rename(ref: StoredDocRef, name: string): Promise<SaveOutcome> {
    // 자기 자신은 중복 후보에서 뺀다 — 그러지 않으면 이름을 그대로 두는 저장에도
    // 번호가 붙어 "보고서" 가 "보고서(1)" 로 밀린다.
    const unique = await this.resolveName(name, ref.id);
    const renamed = await this.client.renameDoc(ref.id, unique);
    return {
      ref: toRef(renamed),
      renamedTo: unique === name ? undefined : unique,
    };
  }

  /**
   * 폴더에 이미 있는 이름을 피한 이름을 고른다.
   *
   * 목록 조회와 생성 사이에 다른 탭이 같은 이름을 만들면 중복이 남을 수 있다.
   * 드라이브에 "이름 유일" 제약이 없어 원천 차단은 불가능하다 — 흔치 않은 경합이라
   * 여기서는 감수하고, 다음 목록 조회에서 사용자가 보게 된다.
   */
  private async resolveName(desired: string, excludeId?: string): Promise<string> {
    const taken = (await this.client.listDocs())
      .filter((file) => file.id !== excludeId)
      .map((file) => file.name);
    return uniqueDocName(desired, taken);
  }
}
