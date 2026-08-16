/**
 * 구글 드라이브에서 문서 열기 대화상자.
 *
 * WHP 폴더 안의 문서만 보여 준다 — `drive.file` 범위라 앱이 만든 파일에만 닿고,
 * 그게 곧 이 제품이 관리하는 문서의 전부다.
 */

import { ModalDialog } from './dialog';
import type { StoredDocRef } from '@/storage/storage-backend.ts';

export interface DriveOpenDialogDeps {
  /** WHP 폴더의 문서 목록 */
  list: () => Promise<StoredDocRef[]>;
  /** 사용자가 문서를 골랐을 때 */
  onPick: (ref: StoredDocRef) => void;
}

function formatModified(at?: number): string {
  if (!at) return '';
  const date = new Date(at);
  const now = Date.now();
  const diffMin = Math.floor((now - at) / 60000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)}시간 전`;
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export class DriveOpenDialog extends ModalDialog {
  private deps: DriveOpenDialogDeps;
  private listEl!: HTMLElement;

  constructor(deps: DriveOpenDialogDeps) {
    super('구글 드라이브에서 열기', 460);
    this.deps = deps;
  }

  protected createBody(): HTMLElement {
    const body = document.createElement('div');
    body.className = 'drv-body';

    const hint = document.createElement('div');
    hint.className = 'drv-hint';
    hint.textContent = '드라이브의 WHP 폴더에 있는 문서입니다.';
    body.appendChild(hint);

    this.listEl = document.createElement('div');
    this.listEl.className = 'drv-list';
    body.appendChild(this.listEl);

    return body;
  }

  override show(): void {
    super.show();
    // 확인/취소 대신 새로고침·닫기를 둔다 — 고르는 순간 열리므로 확인 단계가 없다.
    const footer = this.dialog.querySelector('.dialog-footer');
    if (footer) {
      footer.replaceChildren();

      const refresh = document.createElement('button');
      refresh.className = 'dialog-btn';
      refresh.textContent = '새로 고침';
      refresh.addEventListener('click', () => void this.reload());

      const close = document.createElement('button');
      close.className = 'dialog-btn dialog-btn-primary';
      close.textContent = '닫기';
      close.addEventListener('click', () => this.hide());

      footer.append(refresh, close);
    }
    void this.reload();
  }

  protected onConfirm(): void {
    // 목록에서 고르는 순간 열린다 — 확인 동작 없음
  }

  private async reload(): Promise<void> {
    this.renderMessage('불러오는 중…');
    try {
      const docs = await this.deps.list();
      if (docs.length === 0) {
        this.renderMessage('WHP 폴더에 문서가 없습니다. 새 문서를 만들어 쓰면 여기에 쌓입니다.');
        return;
      }
      this.renderList(docs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.renderMessage(`목록을 불러오지 못했습니다 — ${message}`);
    }
  }

  private renderMessage(text: string): void {
    this.listEl.replaceChildren();
    const empty = document.createElement('div');
    empty.className = 'drv-empty';
    empty.textContent = text;
    this.listEl.appendChild(empty);
  }

  private renderList(docs: StoredDocRef[]): void {
    this.listEl.replaceChildren();
    for (const doc of docs) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'drv-item';

      const name = document.createElement('span');
      name.className = 'drv-item-name';
      name.textContent = doc.name;

      const when = document.createElement('span');
      when.className = 'drv-item-when';
      when.textContent = formatModified(doc.modifiedAt);

      item.append(name, when);
      item.addEventListener('click', () => {
        this.hide();
        this.deps.onPick(doc);
      });
      this.listEl.appendChild(item);
    }
  }
}
