/**
 * 문서 통계 대화상자 (파일 → 문서 정보).
 *
 * 한글의 「문서 정보 → 문서 통계」에 해당한다. 트위터에서 이 기능을 넣어 달라는
 * 요청을 받고 만들었다.
 *
 * 작가에게 가장 중요한 줄은 **원고지 매수**다. 청탁도 계약도 매수로 하기 때문에,
 * 글자수보다 이 숫자를 먼저 본다. 그래서 표에서 눈에 띄게 둔다.
 *
 * 셈은 여기서 하지 않는다 — `core/document-stats.ts` 가 한다. 상태 표시줄·배명훈 모드
 * 바닥글과 같은 원본을 써야 같은 문서를 두 숫자로 말하지 않는다.
 */

import { ModalDialog } from './dialog';
import {
  countText,
  documentStatistics,
  manuscriptPageCount,
  type ControlSource,
  type DocumentStatsSource,
} from '@/core/document-stats.ts';

/** 표에 넣을 한 줄 */
interface Row {
  label: string;
  whole: number;
  selected: number | null;
  /** 소수 한 자리로 보일 것인가 (원고지 매수) */
  decimal?: boolean;
  /** 굵게 — 작가가 먼저 보는 줄 */
  emphasis?: boolean;
}

export interface DocStatsDeps {
  source: DocumentStatsSource & ControlSource;
  /** 문서 전체 쪽수 */
  pages: number;
  /** 지금 선택한 글. 선택이 없으면 null */
  selectedText: string | null;
}

export class DocStatsDialog extends ModalDialog {
  private deps: DocStatsDeps;

  constructor(deps: DocStatsDeps) {
    super('문서 통계', 520);
    this.deps = deps;
  }

  protected createBody(): HTMLElement {
    const body = document.createElement('div');
    body.className = 'docstats-body';

    const whole = documentStatistics(this.deps.source, this.deps.pages);
    const sel = this.deps.selectedText !== null ? countText(this.deps.selectedText) : null;

    const rows: Row[] = [
      { label: '글자 (공백 포함)', whole: whole.chars, selected: sel?.chars ?? null },
      { label: '글자 (공백 제외)', whole: whole.charsNoSpace, selected: sel?.charsNoSpace ?? null },
      { label: '글자에 포함된 한자', whole: whole.hanja, selected: sel?.hanja ?? null },
      { label: '낱말', whole: whole.words, selected: sel?.words ?? null },
      { label: '줄', whole: whole.lines, selected: null },
      { label: '문단', whole: whole.paragraphs, selected: null },
      { label: '쪽', whole: whole.pages, selected: null },
      {
        label: '원고지 (200자 기준)',
        whole: whole.manuscriptPages,
        selected: sel ? manuscriptPageCount(sel.chars) : null,
        decimal: true,
        emphasis: true,
      },
      { label: '표', whole: whole.tables, selected: null },
      { label: '그림', whole: whole.pictures, selected: null },
      { label: '글상자', whole: whole.textBoxes, selected: null },
    ];

    body.appendChild(this.buildTable(rows, sel !== null));

    /*
     * 어디까지 세는지 밝힌다.
     *
     * 항목마다 범위가 다르다. 글자·낱말·문단은 표 칸과 글상자 안까지 세지만, 줄 수는
     * 본문만 센다(표 칸의 리스트 번호를 밖에서 알아낼 길이 아직 없다). 머리말·꼬리말·
     * 각주는 어느 쪽에도 안 들어간다.
     *
     * 아무 말 없으면 사용자는 숫자를 그대로 믿는다. 원고 분량은 청탁과 계약이 걸린
     * 숫자다. 모르는 채로 어긋나는 것보다 범위를 알고 쓰는 편이 낫다.
     */
    const note = document.createElement('p');
    note.className = 'docstats-note';
    note.textContent =
      '본문과 표·글상자 안의 글을 셉니다. 머리말·꼬리말·각주는 원고 분량이 아니므로 세지 않습니다.';
    body.appendChild(note);

    return body;
  }

  private buildTable(rows: Row[], hasSelection: boolean): HTMLElement {
    const table = document.createElement('table');
    table.className = 'docstats-table';

    const head = document.createElement('tr');
    for (const text of ['통계 이름', '문서 전체', '현재 선택 영역']) {
      const th = document.createElement('th');
      th.textContent = text;
      head.appendChild(th);
    }
    table.appendChild(head);

    for (const row of rows) {
      const tr = document.createElement('tr');
      if (row.emphasis) tr.className = 'docstats-emphasis';

      const name = document.createElement('td');
      name.textContent = row.label;
      tr.appendChild(name);

      tr.appendChild(this.valueCell(row.whole, row));
      // 선택이 없으면 빈 칸, 선택이 있어도 셀 수 없는 항목(문단·쪽·개체)은 가운데 점.
      tr.appendChild(
        row.selected === null
          ? this.emptyCell(hasSelection ? '·' : '')
          : this.valueCell(row.selected, row),
      );

      table.appendChild(tr);
    }
    return table;
  }

  private valueCell(value: number, row: Row): HTMLElement {
    const td = document.createElement('td');
    td.className = 'docstats-value';
    const unit = row.decimal ? ' 장' : suffixFor(row.label);
    td.textContent = row.decimal
      ? `${value.toFixed(1)}${unit}`
      : `${value.toLocaleString('ko-KR')}${unit}`;
    return td;
  }

  private emptyCell(text: string): HTMLElement {
    const td = document.createElement('td');
    td.className = 'docstats-value docstats-empty';
    td.textContent = text;
    return td;
  }

  protected onConfirm(): void {
    // 보기만 하는 화면 — 확인 동작 없음
  }

  override show(): void {
    super.show();
    // 고칠 것이 없으므로 「닫기」 하나로 바꾼다. 「확인/취소」는 무언가 정하는 화면의 것이다.
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

/** 항목마다 뒤에 붙는 단위. 한글이 쓰는 것과 같다. */
function suffixFor(label: string): string {
  if (label.startsWith('글자')) return ' 자';
  if (label === '낱말') return ' 개';
  if (label === '문단') return ' 개';
  if (label === '줄') return ' 줄';
  if (label === '쪽') return ' 쪽';
  return ' 개';
}
