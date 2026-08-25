/**
 * 저장소 자동 저장기.
 *
 * 사용자가 "저장"을 누르지 않아도 글이 남게 한다. 이 파일이 지키는 규칙은 넷이다.
 *
 * 1. 입력이 멈추면 저장한다(디바운스). 다만 계속 쓰는 동안에도 최대 간격을 넘기지
 *    않는다 — 쉬지 않고 30분을 쓰면 한 번도 저장되지 않는 일이 없도록.
 * 2. 바뀐 것이 없으면 올리지 않는다. HWP 는 수 MB 라 헛된 업로드가 비싸다.
 *    판단은 앱이 이미 유지하는 dirty 플래그로 한다 — wasm 의 documentDigest 는
 *    로드 시점에만 계산돼 편집 후에도 그대로라 지문으로 쓸 수 없다.
 * 3. 저장 중에 또 요청이 오면 큐에 하나만 남긴다 — 요청을 쌓지 않고 합친다.
 * 4. 실패해도 사용자를 붙잡지 않는다. 지수 백오프로 물러났다가 다시 시도하고,
 *    그동안 변경분은 기존 복구용 자동저장(IndexedDB)에 남아 있다.
 */

import type { SaveState, StorageBackend, StoredDocRef } from './storage-backend.ts';

/** 입력이 멈춘 뒤 저장까지 기다릴 시간 */
export const AUTOSAVE_DEBOUNCE_MS = 2000;

/** 계속 쓰는 중에도 이 간격을 넘기면 강제로 저장한다 */
export const AUTOSAVE_MAX_WAIT_MS = 30_000;

/** 실패 후 재시도 간격 (지수 백오프) */
const RETRY_BASE_MS = 3000;
const RETRY_MAX_MS = 60_000;

export interface AutosaveDeps {
  /** 지금 쓸 저장소. 연결 전이면 null */
  getBackend: () => StorageBackend | null;
  /** 현재 문서를 바이트로 만든다 */
  serialize: () => Blob;
  /** 저장할 파일 이름 (확장자 포함) */
  getFileName: () => string;
  /** 저장소가 이름을 바꿨을 때 (중복 회피) 알린다 */
  onRenamed: (name: string) => void;
  /** 상태 변화 통지 (제목 줄 표시용) */
  onState: (state: SaveState) => void;
  /**
   * 이 문서가 저장소에 **처음 만들어졌을 때** 한 번 불린다 (덮어쓰기는 제외).
   *
   * 로컬에서 연 문서를 고치면 그 순간 드라이브에 새 파일이 생기는데, 아무 말도
   * 없으면 사용자는 자기 글이 어디로 갔는지 모른다. 나중에 디스크의 원본을 다시
   * 열고 "고친 게 없다" 고 놀라게 된다. 그 순간을 알릴 수 있게 뚫어 둔 자리다.
   */
  onCreated?: (ref: StoredDocRef) => void;
}

/**
 * 다음 저장까지 기다릴 시간을 정한다.
 *
 * 마지막 입력에서 `debounce` 만큼 쉬면 저장하되, 첫 변경으로부터 `maxWait` 를
 * 넘기지는 않는다. 순수 함수로 빼 두어 타이머 동작을 테스트로 고정한다.
 *
 * @param now            지금 시각
 * @param lastChangeAt   마지막 변경 시각
 * @param firstChangeAt  이번 묶음의 첫 변경 시각
 */
export function nextSaveDelay(
  now: number,
  lastChangeAt: number,
  firstChangeAt: number,
  debounce = AUTOSAVE_DEBOUNCE_MS,
  maxWait = AUTOSAVE_MAX_WAIT_MS,
): number {
  const byIdle = lastChangeAt + debounce - now;
  const byDeadline = firstChangeAt + maxWait - now;
  return Math.max(0, Math.min(byIdle, byDeadline));
}

/** 재시도 대기 시간 (지수 백오프, 상한 있음) */
export function retryDelay(attempt: number): number {
  return Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1), RETRY_MAX_MS);
}

export class AutosaveController {
  private deps: AutosaveDeps;
  /** 지금 문서가 저장소에서 어떤 파일인지. 아직 없으면 null → 처음 저장에서 만든다 */
  private ref: StoredDocRef | null = null;
  /** 마지막 저장 뒤로 문서가 바뀌었는가 */
  private dirty = false;

  private timer: number | null = null;
  private firstChangeAt = 0;
  private lastChangeAt = 0;
  private saving = false;
  /** 저장 중에 또 바뀌었는가 — 끝나면 한 번 더 돈다 */
  private pending = false;
  private failures = 0;
  private stopped = false;

  constructor(deps: AutosaveDeps) {
    this.deps = deps;
    window.addEventListener('online', () => this.schedule());
  }

  /** 새 문서를 열었을 때 — 저장소 참조와 지문을 초기화한다 */
  attach(ref: StoredDocRef | null): void {
    this.ref = ref;
    this.dirty = false;
    this.failures = 0;
    this.cancelTimer();
    this.deps.onState(ref ? { kind: 'saved', at: Date.now(), where: 'drive' } : { kind: 'idle' });
  }

  /** 지금 문서가 저장소에서 가리키는 파일 */
  getRef(): StoredDocRef | null {
    return this.ref;
  }

  /** 문서가 바뀌었다고 알린다 */
  markChanged(): void {
    if (this.stopped) return;
    const now = Date.now();
    if (this.timer === null && !this.saving) this.firstChangeAt = now;
    this.lastChangeAt = now;
    this.dirty = true;
    // 저장할 곳이 없으면 "변경됨" 이라고 하지 않는다 — 곧 저장될 것처럼 읽힌다.
    this.deps.onState(this.deps.getBackend() ? { kind: 'dirty' } : { kind: 'unsaved' });
    this.schedule();
  }

  /** 지금 바로 저장한다 (Ctrl+S 처럼 명시적 저장) */
  async flush(): Promise<void> {
    this.cancelTimer();
    await this.save();
  }

  /**
   * 저장을 다시 시도한다.
   *
   * 저장소가 준비되지 않아 건너뛴 변경이 남아 있을 때 부른다 — 드라이브를 방금
   * 연결했거나 네트워크가 돌아온 순간. 바뀐 게 없으면 아무 일도 하지 않는다.
   */
  retryIfPending(): void {
    if (this.stopped || !this.dirty) return;
    this.schedule();
  }

  dispose(): void {
    this.stopped = true;
    this.cancelTimer();
  }

  private schedule(): void {
    if (this.stopped || this.saving) return;
    const delay = nextSaveDelay(Date.now(), this.lastChangeAt, this.firstChangeAt);
    this.cancelTimer();
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.save();
    }, delay);
  }

  private cancelTimer(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }

  /**
   * 제목 줄에서 바꾼 이름을 저장소에도 반영한다.
   *
   * 저장은 지금까지 **내용만** 올렸다(`update`). 그래서 드라이브에 한 번 올라간 문서는
   * 앱에서 이름을 아무리 바꿔도 드라이브 쪽 이름이 그대로였다 — 나중에 드라이브에서
   * 찾으면 옛 이름으로 있어서 어느 것이 무엇인지 알 수 없다.
   *
   * 저장할 때마다 "지금 이름" 과 "저장소에 있는 이름" 을 견줘 다르면 맞춘다. 이름을
   * 바꾼 순간을 따로 붙잡지 않고 저장 때 맞추는 이유는, 그 사이 오프라인이었거나
   * 저장이 실패했거나 여러 번 고쳐 썼어도 결국 마지막 이름 하나로 수렴하기 때문이다.
   *
   * 내용보다 이름을 먼저 보낸다. 이름 변경이 실패하면 `save` 의 catch 로 넘어가 내용도
   * 다시 시도되므로, 이름만 바뀌고 내용은 옛것인 상태로 남지 않는다.
   */
  private async reconcileName(backend: StorageBackend): Promise<void> {
    const ref = this.ref;
    if (!ref) return;
    const wanted = this.deps.getFileName();
    if (!wanted || wanted === ref.name) return;

    const outcome = await backend.rename(ref, wanted);
    this.ref = outcome.ref;
    // 같은 이름이 이미 있어 번호가 붙었으면 제목 줄도 그 이름으로 맞춘다.
    if (outcome.renamedTo) this.deps.onRenamed(outcome.renamedTo);
  }

  private async save(): Promise<void> {
    if (this.stopped) return;
    if (this.saving) {
      // 저장 중이면 요청을 쌓지 않고 "한 번 더" 표시만 남긴다.
      this.pending = true;
      return;
    }

    const backend = this.deps.getBackend();
    // 저장소가 없는 것과 있는데 지금 못 쓰는 것은 사용자가 할 일이 다르다.
    // 앞은 직접 저장해야 하고, 뒤는 기다리면 된다.
    if (!backend) {
      this.deps.onState({ kind: 'unsaved' });
      return;
    }
    if (!backend.isReady()) {
      this.deps.onState({ kind: 'offline' });
      return;
    }

    if (!this.dirty) {
      // 커서만 움직였다 — 올릴 이유가 없다.
      this.deps.onState({ kind: 'saved', at: Date.now(), where: backend.kind });
      return;
    }

    this.saving = true;
    this.deps.onState({ kind: 'saving' });
    // 직렬화 시점 이후의 변경은 다음 저장 몫이다 — 여기서 내려야 그 사이 입력을 놓치지 않는다.
    this.dirty = false;

    try {
      const blob = this.deps.serialize();
      const creating = this.ref === null;
      if (!creating) await this.reconcileName(backend);
      const outcome = creating
        ? await backend.create(this.deps.getFileName(), blob)
        : await backend.update(this.ref!, blob);

      this.ref = outcome.ref;
      this.failures = 0;
      if (outcome.renamedTo) this.deps.onRenamed(outcome.renamedTo);
      // 이름 변경 통지 뒤에 알린다 — 알림 문구가 최종 이름을 써야 하기 때문이다.
      if (creating) this.deps.onCreated?.(outcome.ref);
      this.deps.onState({ kind: 'saved', at: Date.now(), where: backend.kind });
    } catch (error) {
      // 실패했으니 다시 올려야 한다 — 그 사이 들어온 변경도 함께 간다.
      this.dirty = true;
      this.failures += 1;
      const message = error instanceof Error ? error.message : String(error);
      this.deps.onState(
        navigator.onLine === false
          ? { kind: 'offline' }
          : { kind: 'error', message },
      );
      // 물러났다가 다시 시도한다. 변경분은 복구용 자동저장에 남아 있어 유실되지 않는다.
      this.cancelTimer();
      this.timer = window.setTimeout(() => {
        this.timer = null;
        void this.save();
      }, retryDelay(this.failures));
    } finally {
      this.saving = false;
      if (this.pending) {
        this.pending = false;
        this.schedule();
      }
    }
  }
}
