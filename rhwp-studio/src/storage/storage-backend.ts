/**
 * 문서 저장소 경계.
 *
 * WHP 는 "어디에 저장하는가"를 사용자에게 묻지 않는다. 드라이브가 연결돼 있으면
 * 드라이브에, 아니면 로컬에 저장하고, 화면에는 저장 상태만 보여 준다.
 * 그 갈아 끼움을 여기 인터페이스 하나로 가둔다.
 *
 * 기존 `command/file-system-access.ts` 의 File System Access 경로가 로컬 구현이고,
 * 구글 드라이브 구현이 그 형제로 붙는다.
 */

/** 저장소 종류 */
export type StorageKind = 'local' | 'drive';

/** 저장소에 있는 문서 하나를 가리키는 값 */
export interface StoredDocRef {
  /** 저장소 안에서의 식별자. 드라이브는 fileId, 로컬은 핸들 키 */
  id: string;
  /** 확장자를 포함한 파일명 */
  name: string;
  /** 마지막 수정 시각(ms). 모르면 생략 */
  modifiedAt?: number;
}

/** 저장 결과 */
export interface SaveOutcome {
  ref: StoredDocRef;
  /** 이 저장으로 이름이 바뀌었으면 그 이름 (중복 회피로 번호가 붙은 경우) */
  renamedTo?: string;
}

/**
 * 문서 저장소.
 *
 * 구현은 실패를 예외로 던진다. 호출부(자동 저장기)가 재시도·백오프를 맡는다.
 */
export interface StorageBackend {
  readonly kind: StorageKind;

  /** 지금 이 저장소를 쓸 수 있는가 (드라이브는 연결·토큰 유효 여부) */
  isReady(): boolean;

  /**
   * 저장소가 관리하는 문서 목록.
   * 이름 중복 회피(`새 문서(1)`)에 쓰이므로 이름은 빠짐없이 나와야 한다.
   */
  list(): Promise<StoredDocRef[]>;

  /** 문서 내용을 읽는다 */
  read(ref: StoredDocRef): Promise<{ name: string; bytes: Uint8Array }>;

  /**
   * 새 문서를 만든다.
   * 같은 이름이 있으면 구현이 `uniqueDocName` 으로 피해서 만들고 `renamedTo` 로 알린다.
   */
  create(name: string, blob: Blob): Promise<SaveOutcome>;

  /** 이미 있는 문서를 덮어쓴다 */
  update(ref: StoredDocRef, blob: Blob): Promise<SaveOutcome>;

  /** 이름을 바꾼다. 중복이면 구현이 번호를 붙이고 `renamedTo` 로 알린다 */
  rename(ref: StoredDocRef, name: string): Promise<SaveOutcome>;
}

/** 자동 저장 상태 — 제목 줄에 글자로 보여 준다 */
export type SaveState =
  | { kind: 'idle' }
  | { kind: 'dirty' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number; where: StorageKind }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

/** 저장 상태를 사람이 읽는 한 줄로 바꾼다 */
export function describeSaveState(state: SaveState): string {
  switch (state.kind) {
    case 'idle':
      return '';
    case 'dirty':
      return '변경됨';
    case 'saving':
      return '저장 중…';
    case 'saved':
      return state.where === 'drive' ? '드라이브에 저장됨' : '저장됨';
    case 'offline':
      return '오프라인 — 변경분 보관 중';
    case 'error':
      return `저장 실패 — ${state.message}`;
  }
}
