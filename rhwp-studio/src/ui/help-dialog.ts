/**
 * 사용법 대화상자 (도구 → 사용법).
 *
 * hwwp 에는 설명 없이는 알기 어려운 동작이 몇 있다 — 저장 버튼이 없는 이유,
 * 내 컴퓨터 문서를 고치면 드라이브로 올라가는 이유, 배율 100% 가 작게 보이는 이유.
 * 그때마다 사용자가 헤매지 않도록 한자리에 모은다.
 *
 * **내용은 여기 없다.** `core/usage-guide.ts` 가 하나뿐인 원본이고, 첫 실행에 열리는
 * 사용법 문서도 같은 것을 읽는다. 예전에는 양쪽이 각자 문장을 갖고 있어서 계속
 * 어긋났다 — 이 화면은 그 원본을 문단과 표로 그리기만 한다.
 */

import { ModalDialog } from './dialog';
import { USAGE_SECTIONS } from '@/core/usage-guide.ts';

export class HelpDialog extends ModalDialog {
  constructor() {
    super('hwwp 사용법', 560);
  }

  protected createBody(): HTMLElement {
    const body = document.createElement('div');
    body.className = 'help-body';

    for (const section of USAGE_SECTIONS) {
      const heading = document.createElement('h3');
      heading.className = 'help-heading';
      heading.textContent = section.title;
      body.appendChild(heading);

      for (const text of section.paragraphs ?? []) {
        const p = document.createElement('p');
        p.className = 'help-para';
        p.textContent = text;
        body.appendChild(p);
      }

      if (section.items) {
        const table = document.createElement('table');
        table.className = 'help-keys';
        for (const [key, desc] of section.items) {
          const tr = document.createElement('tr');
          const th = document.createElement('td');
          th.className = 'help-key';
          th.textContent = key;
          const td = document.createElement('td');
          td.textContent = desc;
          tr.append(th, td);
          table.appendChild(tr);
        }
        body.appendChild(table);
      }
    }

    return body;
  }

  protected onConfirm(): void {
    // 읽기 전용 — 확인 동작 없음
  }

  override show(): void {
    super.show();
    // 읽기만 하는 화면이라 확인/취소 대신 닫기 하나만 둔다.
    const footer = this.dialog.querySelector('.dialog-footer');
    if (footer) {
      footer.replaceChildren();
      const close = document.createElement('button');
      close.className = 'dialog-btn dialog-btn-primary';
      close.textContent = '닫기';
      close.addEventListener('click', () => this.hide());
      footer.appendChild(close);
    }
  }
}
