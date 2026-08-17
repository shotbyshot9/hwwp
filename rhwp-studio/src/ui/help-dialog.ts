/**
 * 사용법 대화상자 (도구 → 사용법).
 *
 * hwwp 에는 설명 없이는 알기 어려운 동작이 몇 있다 — 저장 버튼이 없는 이유,
 * 드라이브에 넣어 둔 문서가 목록에 없는 이유, 배율 100% 가 작게 보이는 이유.
 * 그때마다 사용자가 헤매지 않도록 한자리에 모은다.
 *
 * 내용은 실제 동작만 적는다. 여기 적힌 것이 곧 계약이므로, 기능을 바꾸면 이
 * 파일도 함께 고쳐야 한다.
 */

import { ModalDialog } from './dialog';

interface HelpSection {
  title: string;
  /** 문단. 각 줄이 한 문단이 된다 */
  paragraphs?: string[];
  /** 「용어 — 설명」 목록 */
  items?: [string, string][];
}

const SECTIONS: HelpSection[] = [
  {
    title: '저장 버튼이 없습니다',
    paragraphs: [
      'hwwp 는 구글 드라이브에 자동으로 저장합니다. 글 쓰기를 멈추면 2초 뒤, '
      + '쉬지 않고 쓰는 중에도 30초마다 저장합니다.',
      '제목 줄 오른쪽 「구글 드라이브 연결」을 한 번 누르면, 드라이브에 hwwp 폴더가 '
      + '생기고 그 안에 문서가 쌓입니다. 저장 상태는 문서 이름 옆에 글자로 보입니다.',
      '연결하지 않으면 문서 이름 옆에 「자동 저장 안 됨 · Ctrl+S」 라고 뜹니다. '
      + '이때는 Ctrl+S 로 직접 저장하세요. 그래도 복구본은 이 브라우저에 계속 쌓이므로, '
      + '실수로 창을 닫아도 다음에 열 때 되살릴 수 있습니다.',
    ],
  },
  {
    title: '내 컴퓨터의 문서를 열면 어디에 저장되나',
    paragraphs: [
      '파일을 열기만 할 때는 아무 일도 일어나지 않습니다. 읽기만 하면 드라이브에 '
      + '올라가지 않습니다.',
      '한 글자라도 고치면 그때 드라이브의 hwwp 폴더에 사본이 만들어지고, 그 뒤로는 '
      + '거기에 저장됩니다. 올라가는 순간 화면 아래에 알려 드립니다.',
      '내 컴퓨터의 원본 파일은 건드리지 않고 그대로 둡니다. 즉 이어지는 작업은 '
      + '드라이브 쪽에 쌓이므로, 나중에 컴퓨터의 원본을 다시 열면 고치기 전 상태입니다. '
      + '고친 내용을 컴퓨터 파일로도 받으려면 「파일 → 다른 이름으로 저장」을 쓰세요.',
    ],
  },
  {
    title: '문서 이름 바꾸기',
    paragraphs: [
      '제목 줄의 이름을 눌러 그 자리에서 고칩니다. Enter 로 확정, Esc 로 취소합니다.',
      '이름을 정하지 않으면 「새 문서」가 되고, 같은 이름이 이미 있으면 '
      + '「새 문서(1)」처럼 번호가 붙습니다.',
    ],
  },
  {
    title: '드라이브에서 문서 열기',
    paragraphs: [
      '「파일 → 구글 드라이브에서 열기…」를 누르면 hwwp 로 저장한 문서가 최근 순으로 나옵니다.',
      '다른 곳에서 만들어 드라이브에 넣은 문서는 이 목록에 나오지 않습니다. '
      + 'hwwp 가 드라이브 전체를 들여다보지 않고 자기가 만든 파일만 다루기 때문입니다. '
      + '그런 문서는 대화상자 아래 「드라이브에서 찾아보기…」로 찾아서 열 수 있습니다.',
      '찾아보기로 연 문서는 원래 있던 자리에서 그대로 갱신됩니다. hwwp 폴더에 사본이 '
      + '생기지 않습니다.',
    ],
  },
  {
    title: '배명훈 모드',
    paragraphs: [
      '「보기 → 배명훈 모드」 또는 Alt+Shift+F. 나가기는 Esc 입니다.',
      '메뉴와 도구 모음이 사라지고 글만 남습니다. 캐럿은 화면 위쪽에 머물러 '
      + '줄이 바뀌어도 시선이 흘러내리지 않습니다.',
      '문장부호를 찍을 때마다 환호와 폭죽이 터집니다. 쉬지 않고 이어 쓸수록 커지고, '
      + '2초 이상 멈추면 처음부터 다시 쌓입니다. 문장부호 없이 50자를 넘기면 큰 축포가 터집니다.',
      '더 자주 응원받고 싶으면 머리글 오른쪽의 「x1」 단추를 누르세요. '
      + 'x1 → x2 → x3 → x5 → x10 → MAX 로 돌아갑니다. 한국 소설의 한 문장이 대략 60타라 '
      + 'x1 은 한 문장에 한 번 꼴이고, x2 는 30타, x3 는 20타, x5 는 12타, x10 은 6타마다, '
      + 'MAX 는 치는 족족 환호합니다. 어느 단계에서든 문장부호 응원은 그대로 남습니다.',
      '배명훈 모드는 테마와 배율을 따로 가집니다 — 들어가면 어둡게 130% 로 바뀌고 '
      + '나오면 원래 화면으로 돌아옵니다. 「보기 → 배명훈 모드 설정」에서 바꿉니다.',
    ],
  },
  {
    title: '배율 100% 가 작게 보인다면',
    paragraphs: [
      '「보기 → 배율 → 화면 보정…」을 한 번 해 주세요.',
      '브라우저는 화면의 실제 크기를 알 수 없어, 기본값으로는 문서가 실물보다 작게 '
      + '나올 수 있습니다. 화면에 나온 막대를 신용카드 긴 변에 맞추면, 그때부터 '
      + '배율 100% 가 실제 종이 크기와 같아집니다.',
      '한 번만 하면 되고, 브라우저에 기억됩니다.',
    ],
  },
  {
    title: '자주 쓰는 단축키',
    items: [
      ['Alt+Shift+F', '배명훈 모드 (나가기는 Esc)'],
      ['Alt+N', '새 문서'],
      ['Ctrl+O', '내 컴퓨터에서 열기'],
      ['Ctrl+Z / Ctrl+Y', '되돌리기 / 다시 실행'],
      ['Ctrl+F', '찾기'],
      ['Ctrl+B / I / U', '진하게 / 기울임 / 밑줄'],
      ['F7', '편집 용지'],
      ['Ctrl+P', '인쇄'],
    ],
  },
];

export class HelpDialog extends ModalDialog {
  constructor() {
    super('hwwp 사용법', 560);
  }

  protected createBody(): HTMLElement {
    const body = document.createElement('div');
    body.className = 'help-body';

    for (const section of SECTIONS) {
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
