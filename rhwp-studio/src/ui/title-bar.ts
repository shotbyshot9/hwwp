/**
 * 제목 줄 (`#title-bar`, 접두어 `tbar-`).
 *
 * 구글 독스처럼 문서 이름을 그 자리에서 고치고, 저장 상태를 글자로 보여 주고,
 * 저장소(구글 드라이브) 연결을 여기서 건다. 사용자가 "어디에 저장할까"를 고르는
 * 대신 "지금 저장됐나"만 보게 하려는 설계다.
 */

import type { EventBus } from '@/core/event-bus';
import { DEFAULT_DOC_TITLE, displayTitle, sanitizeDocTitle, splitExtension } from '@/storage/doc-name.ts';
import { describeSaveState, type SaveState } from '@/storage/storage-backend.ts';
import type { DriveAuth } from '@/storage/drive-auth.ts';

export interface TitleBarDeps {
  eventBus: EventBus;
  /** 현재 문서 파일명 (확장자 포함) */
  getFileName: () => string;
  /** 문서 파일명 변경. 확장자는 유지한다 */
  setFileName: (fileName: string) => void;
  /** 저장소 인증. 없으면 연결 버튼을 감춘다 */
  auth?: DriveAuth;
}

export class TitleBar {
  private titleEl: HTMLInputElement;
  private stateEl: HTMLElement;
  private driveBtn: HTMLButtonElement;
  private driveLabel: HTMLElement;
  private deps: TitleBarDeps;
  private state: SaveState = { kind: 'idle' };
  private connecting = false;

  constructor(deps: TitleBarDeps) {
    this.deps = deps;
    this.titleEl = document.getElementById('tbar-title') as HTMLInputElement;
    this.stateEl = document.getElementById('tbar-save-state')!;
    this.driveBtn = document.getElementById('tbar-drive') as HTMLButtonElement;
    this.driveLabel = this.driveBtn.querySelector('.tbar-drive-label')!;

    this.setupTitleEditing();
    this.setupDriveButton();

    // 문서가 바뀌면 제목을 다시 읽는다.
    deps.eventBus.on('document-changed', () => this.syncTitle());
    deps.eventBus.on('create-new-document', () => this.syncTitle());

    deps.auth?.onChange(() => this.renderDrive());

    this.syncTitle();
    this.renderDrive();
    this.renderState();
  }

  /** 저장 상태를 갱신한다 */
  setSaveState(state: SaveState): void {
    this.state = state;
    this.renderState();
  }

  /** 문서 이름을 바깥에서 바꿨을 때 (열기·이름 충돌 회피 등) */
  syncTitle(): void {
    const fileName = this.deps.getFileName();
    // 문서가 없으면 이름을 고칠 대상도 없다.
    this.titleEl.disabled = fileName === '';
    // 사용자가 지금 고치는 중이면 덮어쓰지 않는다.
    if (document.activeElement === this.titleEl) return;
    this.titleEl.value = displayTitle(fileName);
    this.resizeTitle();
  }

  private setupTitleEditing(): void {
    // 입력 폭을 글자 수에 맞춘다 — 고정 폭이면 긴 제목이 잘리고 짧은 제목은 허전하다.
    this.titleEl.addEventListener('input', () => this.resizeTitle());

    this.titleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.titleEl.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.syncTitle();
        this.titleEl.blur();
      }
    });

    this.titleEl.addEventListener('focus', () => this.titleEl.select());
    this.titleEl.addEventListener('blur', () => this.commitTitle());
  }

  private commitTitle(): void {
    const current = this.deps.getFileName();
    if (!current) return;   // 문서 없음 — 고칠 대상이 없다
    const typed = sanitizeDocTitle(this.titleEl.value);
    const { extension } = splitExtension(current);
    const next = `${typed}${extension || '.hwp'}`;

    if (next === current) {
      this.syncTitle();
      return;
    }
    this.deps.setFileName(next);
    this.titleEl.value = typed;
    this.resizeTitle();
    this.deps.eventBus.emit('document-renamed', next);
  }

  private resizeTitle(): void {
    const text = this.titleEl.value || DEFAULT_DOC_TITLE;
    // 한글은 폭이 넓어 글자 수만으로는 모자란다 — 대략치로 잡고 상한을 둔다.
    // 최소 폭은 CSS(min-width)가 정한다 — 짧은 제목에서 입력칸으로 보이지 않던 문제.
    const width = Math.min(text.length + 2, 40);
    this.titleEl.style.width = `${width}ch`;
  }

  private setupDriveButton(): void {
    const auth = this.deps.auth;
    if (!auth) {
      this.driveBtn.style.display = 'none';
      return;
    }
    this.driveBtn.addEventListener('click', async () => {
      if (this.connecting) return;
      if (auth.isConnected()) {
        auth.disconnect();
        return;
      }
      this.connecting = true;
      this.renderDrive();
      try {
        // 팝업이 뜬다 — 반드시 사용자 클릭 안에서 불려야 브라우저가 막지 않는다.
        await auth.connect();
      } finally {
        this.connecting = false;
        this.renderDrive();
      }
    });
  }

  private renderDrive(): void {
    const auth = this.deps.auth;
    if (!auth) return;
    if (this.connecting) {
      this.driveLabel.textContent = '연결 중…';
      this.driveBtn.classList.remove('tbar-drive-on');
      this.driveBtn.title = '';
      return;
    }
    if (auth.isConnected()) {
      const email = auth.getAccountEmail();
      this.driveLabel.textContent = email ?? '드라이브 연결됨';
      this.driveBtn.classList.add('tbar-drive-on');
      this.driveBtn.title = '눌러서 연결 해제';
    } else {
      this.driveLabel.textContent = '구글 드라이브 연결';
      this.driveBtn.classList.remove('tbar-drive-on');
      this.driveBtn.title = 'WHP 폴더에 자동 저장합니다';
    }
  }

  private renderState(): void {
    const text = describeSaveState(this.state);
    this.stateEl.textContent = text ? `· ${text}` : '';
    this.stateEl.classList.toggle('tbar-save-error', this.state.kind === 'error');
  }
}
