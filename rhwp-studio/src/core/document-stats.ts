/**
 * 문서 분량 집계 — 단어수·글자수.
 *
 * 배명훈 모드 바닥글과 일반 편집 화면의 상태 표시줄이 같은 값을 보여야 하므로 여기
 * 한 군데서만 센다. 두 곳에서 따로 세면 같은 문서를 두 숫자로 말하게 된다.
 */

/** 집계에 필요한 만큼만 추린 엔진 인터페이스 — 시험에서 가짜를 끼우기 쉽게 좁혀 둔다. */
export interface DocumentStatsSource {
  getSectionCount(): number;
  getParagraphCount(sectionIndex: number): number;
  getParagraphLength(sectionIndex: number, paragraphIndex: number): number;
  getTextRange(sectionIndex: number, paragraphIndex: number, start: number, end: number): string;
}

export interface DocumentStats {
  words: number;
  chars: number;
}

/**
 * 문서 전체의 단어수·글자수를 센다.
 *
 * 본문 문단만 센다 — 표 셀·머리말/꼬리말·각주는 제외한다. Writer's Homeground 의
 * 바닥글 집계를 옮긴 것이라 "지금 쓰고 있는 글의 분량"이 기준이다.
 *
 * 문서를 통째로 훑으므로 글자를 칠 때마다 부르면 안 된다. 부르는 쪽에서 뜸을 들인다.
 */
export function countDocument(source: DocumentStatsSource): DocumentStats {
  let chars = 0;
  let words = 0;
  const sections = source.getSectionCount();
  for (let sec = 0; sec < sections; sec++) {
    const paraCount = source.getParagraphCount(sec);
    for (let para = 0; para < paraCount; para++) {
      const len = source.getParagraphLength(sec, para);
      if (len <= 0) continue;
      const text = source.getTextRange(sec, para, 0, len);
      chars += text.length;
      const trimmed = text.trim();
      if (trimmed) words += trimmed.split(/\s+/).length;
    }
  }
  return { words, chars };
}

/**
 * 문서 통계 — 한글의 「파일 → 문서 정보 → 문서 통계」에 해당한다.
 *
 * 상태 표시줄의 `countDocument` 와 달리 한 번 열어 보는 값이라, 문서를 훑는 비용을
 * 더 써도 된다.
 *
 * **작성 날짜·마지막 저장한 사람은 없다.** HWP 파일의 요약 정보에 있는 값인데 hwwp 는
 * 읽지도 쓰지도 않는다. 특히 "저장한 사람" 은 이름을 파일에 적는 일이라, 개인정보를
 * 받지 않는다는 이 제품의 약속과 어긋난다.
 */
/**
 * 문서 글 전체를 주는 표면.
 *
 * `DocumentStatsSource` 는 본문 문단만 훑는다. 서식 문서는 내용이 대부분 표 칸 안에
 * 있어서 그것만 세면 분량이 한참 적게 나온다 — 실제로 출품신청서를 열었을 때 겪었다.
 */
export interface FullTextSource {
  /** 본문 + 표 칸 + 글상자. 문단마다 `\r\n` 이 붙는다 */
  getTextFileUnicode(): string;
  /** 본문 문단 하나의 줄 시작 자리들. 개수가 곧 줄 수 */
  getLineStarts(listId: number, paraInList: number): number[];
  /** 표 칸·글상자 문단의 줄 정보 */
  getLineInfoInCell(
    sec: number, parentPara: number, controlIdx: number,
    cellIdx: number, cellParaIdx: number, charOffset: number,
  ): { lineCount: number };
  /** 표 칸의 문단 수. 없는 칸이면 0 */
  getCellParagraphCount(sec: number, parentPara: number, controlIdx: number, cellIdx: number): number;
}

/** 본문 리스트 번호 */
const ROOT_LIST_ID = 0;

/**
 * 한 표에서 훑어 볼 칸 수의 상한.
 *
 * 칸 수를 알려 주는 함수가 따로 없어 0 번부터 올려 가며 문단 수를 묻는다. 0 이 나오면
 * 거기서 멈추지만, 병합 때문에 중간이 비는 표가 있어 바로 끊지 않는다. 그렇다고
 * 끝없이 물으면 안 되므로 상한을 둔다 — 한글 표의 최대 칸 수보다 넉넉하다.
 */
const MAX_CELLS_PER_TABLE = 4096;

/** 빈 칸이 이만큼 잇따르면 그 표는 끝난 것으로 본다 */
const EMPTY_CELL_TOLERANCE = 8;

export interface DocumentStatistics {
  /** 글자 (공백 포함) */
  chars: number;
  /** 글자 (공백 제외) */
  charsNoSpace: number;
  /** 그 가운데 한자 */
  hanja: number;
  /** 낱말 */
  words: number;
  /** 문단 */
  paragraphs: number;
  /** 줄. 조판 결과라 화면이 그려진 뒤에만 맞다 */
  lines: number;
  /** 쪽 */
  pages: number;
  /** 원고지 매수 (200자 기준) */
  manuscriptPages: number;
  /** 표 */
  tables: number;
  /** 그림 */
  pictures: number;
  /** 글상자 */
  textBoxes: number;
}

/**
 * 한자인가.
 *
 * CJK 통합 한자와 그 확장 A, 그리고 호환 한자까지 본다. 한글·가나·문장부호는 빼야
 * 하므로 "CJK 면 다" 로 잡으면 안 된다.
 */
function isHanja(code: number): boolean {
  return (code >= 0x4e00 && code <= 0x9fff)      // CJK 통합 한자
    || (code >= 0x3400 && code <= 0x4dbf)        // 확장 A
    || (code >= 0xf900 && code <= 0xfaff);       // 호환 한자
}

/** 글 한 덩어리에서 셀 수 있는 것들 */
export function countText(text: string): {
  chars: number; charsNoSpace: number; hanja: number; words: number;
} {
  let charsNoSpace = 0;
  let hanja = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (!/\s/.test(ch)) charsNoSpace += 1;
    if (isHanja(code)) hanja += 1;
  }
  const trimmed = text.trim();
  return {
    chars: text.length,
    charsNoSpace,
    hanja,
    words: trimmed ? trimmed.split(/\s+/).length : 0,
  };
}

/**
 * 원고지 매수 (200자 기준).
 *
 * 한글과 같은 셈이다 — 공백을 포함한 글자수를 200 으로 나눈다. 작가에게는 이 숫자가
 * 글자수보다 중요하다. 청탁도 계약도 매수로 하기 때문이다.
 */
export function manuscriptPageCount(charsWithSpaces: number): number {
  return Math.round((charsWithSpaces / 200) * 10) / 10;
}

/** 개체 개수를 세기 위한 최소 표면 */
export interface ControlSource {
  /** `[{ctrlId, userDesc, ...}]` 꼴의 JSON */
  getControls(): string;
}

/** 표·그림·글상자를 센다 */
export function countControls(source: ControlSource): {
  tables: number; pictures: number; textBoxes: number;
} {
  let tables = 0;
  let pictures = 0;
  let textBoxes = 0;
  try {
    const items = JSON.parse(source.getControls()) as Array<{ ctrlId?: string; userDesc?: string }>;
    for (const item of items) {
      if (item.ctrlId === 'tbl') tables += 1;
      // 그리기 개체는 갈래가 여럿이라 ctrlId 만으로는 못 가른다. 한글이 부르는 이름을
      // 그대로 쓴다 — 엔진이 이미 실측에 맞춰 붙여 둔 이름이다.
      else if (item.userDesc === '그림') pictures += 1;
      else if (item.userDesc === '글상자') textBoxes += 1;
    }
  } catch {
    // 개체 목록을 못 읽어도 글자 통계는 보여 줘야 한다.
  }
  return { tables, pictures, textBoxes };
}

/**
 * 문서 전체 통계.
 *
 * 세는 범위는 **본문과 표 칸과 글상자** 다 — 글자든 줄이든 같다. 한 화면의 두 숫자가
 * 서로 다른 문서를 말하면 안 된다.
 *
 * 머리말·꼬리말·각주는 뺀다. 읽을 수는 있지만(`getHeaderFooter`·`getFootnoteInfo`)
 * 원고 분량이 아니다 — 머리말은 대개 쪽 번호나 제목이 매 쪽 되풀이되는 것이라,
 * 넣으면 원고지 매수가 실제 원고보다 부풀어 오른다.
 */
export function documentStatistics(
  source: DocumentStatsSource & ControlSource & Partial<FullTextSource>,
  pages: number,
): DocumentStatistics {
  const full = source.getTextFileUnicode?.() ?? null;
  if (full !== null) return fromFullText(full, source, pages);
  return fromBodyOnly(source, pages);
}

/**
 * 문서 글 전체에서 센다.
 *
 * 문단과 리스트 항목마다 `\r\n` 이 붙어 오므로 줄로 갈라 센다. 그 줄바꿈은 사람이 친
 * 글자가 아니므로 글자수에 넣지 않는다 — 넣으면 빈 문서가 "1 자" 로 나오던 것과 같은
 * 종류의 거짓이 된다.
 */
function fromFullText(
  full: string,
  source: DocumentStatsSource & ControlSource & Partial<FullTextSource>,
  pages: number,
): DocumentStatistics {
  const paras = full.split(/\r\n|\n/);
  const counted = countText(paras.join(''));
  counted.words = countText(paras.join('\n')).words;
  return {
    ...counted,
    paragraphs: paras.filter((p) => p.trim().length > 0).length,
    lines: countAllLines(source),
    pages,
    manuscriptPages: manuscriptPageCount(counted.chars),
    ...countControls(source),
  };
}


/**
 * 줄 수를 더한다 — 본문과 표 칸과 글상자를 모두.
 *
 * 글자를 표 칸까지 세면서 줄만 본문에서 멈추면, 한 화면의 두 숫자가 서로 다른 문서를
 * 말하게 된다.
 *
 * **리스트 번호로 찾지 않는다.** `getLineStarts(listId, …)` 는 본문이 아닌 번호를 주면
 * 부를 때마다 문서를 통째로 훑는다(`collect_fields_and_lists`). 표가 많은 문서에서는
 * 그것만으로 화면이 굳는다 — 393쪽짜리 편람으로 확인했다.
 *
 * 대신 색인으로 바로 찾는 `getLineInfoInCell` 을 쓴다. 이쪽은 구역·문단·컨트롤·칸을
 * 그대로 짚어 들어가므로 문서 크기와 무관하다.
 *
 * 조판이 끝나야 줄 정보가 있다. 아직이면 문단마다 한 줄로 친다 — 0 줄짜리 문단은 없다.
 */
function countAllLines(
  source: DocumentStatsSource & ControlSource & Partial<FullTextSource>,
): number {
  const { getLineStarts, getLineInfoInCell, getCellParagraphCount } = source;
  if (!getLineStarts) return 0;

  // 본문 — 문단 수를 이미 알고 있으므로 존재를 물을 필요가 없다.
  let lines = 0;
  let bodyPara = 0;
  const sections = source.getSectionCount();
  const paraCounts: number[] = [];
  for (let sec = 0; sec < sections; sec++) {
    const count = source.getParagraphCount(sec);
    paraCounts.push(count);
    for (let para = 0; para < count; para++) {
      lines += Math.max(1, getLineStarts.call(source, ROOT_LIST_ID, bodyPara).length);
      bodyPara += 1;
    }
  }

  if (!getLineInfoInCell || !getCellParagraphCount) return lines;

  /*
   * 표와 글상자.
   *
   * `getControls` 가 주는 `para` 는 **구역을 가로질러 이어 센 본문 문단 번호**다.
   * 색인으로 찾는 함수들은 (구역, 그 구역 안 문단) 을 받으므로 되돌려 놓아야 한다.
   */
  const toSectionPara = (paraInBody: number): [number, number] | null => {
    let remaining = paraInBody;
    for (let sec = 0; sec < paraCounts.length; sec++) {
      if (remaining < paraCounts[sec]) return [sec, remaining];
      remaining -= paraCounts[sec];
    }
    return null;
  };

  let controls: Array<{ ctrlId?: string; list?: number; para?: number; controlIndex?: number }>;
  try {
    controls = JSON.parse(source.getControls());
  } catch {
    return lines;
  }

  for (const ctrl of controls) {
    // 본문에 놓인 것만 짚을 수 있다 — 표 안의 표는 경로가 따로 필요하다.
    if (ctrl.list !== ROOT_LIST_ID) continue;
    if (ctrl.ctrlId !== 'tbl' && ctrl.ctrlId !== 'gso') continue;
    const at = toSectionPara(ctrl.para ?? -1);
    if (!at || ctrl.controlIndex === undefined) continue;
    const [sec, para] = at;

    /*
     * 없는 칸을 물으면 엔진이 예외를 던진다 — 값을 돌려주지 않는다.
     *
     * 글상자는 0 번 칸 하나뿐이라 1 번을 묻는 순간 그렇게 된다. 통계 하나 보려다
     * 창이 아예 안 뜨는 일이 실제로 났다. 여기서 막고 "그 칸은 없다" 로 친다.
     */
    const cellParas = (cell: number): number => {
      try {
        return getCellParagraphCount.call(source, sec, para, ctrl.controlIndex!, cell);
      } catch {
        return 0;
      }
    };
    const cellLines = (cell: number, cellPara: number): number => {
      try {
        const info = getLineInfoInCell.call(source, sec, para, ctrl.controlIndex!, cell, cellPara, 0);
        return Math.max(1, info?.lineCount ?? 0);
      } catch {
        return 0;
      }
    };

    let emptyRun = 0;
    for (let cell = 0; cell < MAX_CELLS_PER_TABLE; cell++) {
      const count = cellParas(cell);
      if (count <= 0) {
        emptyRun += 1;
        if (emptyRun >= EMPTY_CELL_TOLERANCE) break;
        continue;
      }
      emptyRun = 0;
      for (let cp = 0; cp < count; cp++) lines += cellLines(cell, cp);
    }
  }
  return lines;
}

/** 문서 글 전체를 못 받을 때 — 본문 문단만 센다 */
function fromBodyOnly(
  source: DocumentStatsSource & ControlSource,
  pages: number,
): DocumentStatistics {
  /*
   * 문단을 낱낱이 모은다. 하나의 긴 글로 이어 붙이지 않는다.
   *
   * 이어 붙이면 사이에 넣은 줄바꿈이 **글자로 세어진다.** 빈 문서가 "1 자" 로 나오던
   * 것이 그 때문이었다 — 빈 문단 하나에 줄바꿈 하나.
   *
   * 그렇다고 줄바꿈 없이 붙이면 앞 문단의 끝 낱말과 뒤 문단의 첫 낱말이 하나로 뭉친다.
   * 그래서 글자는 문단마다 세고, 낱말만 줄바꿈으로 이어 센다.
   */
  const paras: string[] = [];
  const sections = source.getSectionCount();
  for (let sec = 0; sec < sections; sec++) {
    const paraCount = source.getParagraphCount(sec);
    for (let para = 0; para < paraCount; para++) {
      const len = source.getParagraphLength(sec, para);
      paras.push(len > 0 ? source.getTextRange(sec, para, 0, len) : '');
    }
  }

  /*
   * 빈 문단은 문단 수에 넣지 않는다.
   *
   * 빈 문서에도 문단 하나가 늘 있어서, 그대로 세면 아무것도 안 쓴 문서가 "문단 1 개" 가
   * 된다. 한글은 이때 0 을 보인다. 문단 사이를 띄우는 빈 줄도 마찬가지로 빼는 것이 맞다 —
   * 사람이 "문단" 이라고 부르는 것은 내용이 있는 덩어리다.
   */
  const paragraphs = paras.filter((p) => p.trim().length > 0).length;

  const counted = countText(paras.join(''));
  // 낱말만 줄바꿈으로 이어 세어 문단 경계에서 뭉치지 않게 한다.
  counted.words = countText(paras.join('\n')).words;
  const controls = countControls(source);
  return {
    ...counted,
    paragraphs,
    // 줄 수는 조판 결과라 본문만 훑는 이 길에서는 알 수 없다.
    lines: 0,
    pages,
    manuscriptPages: manuscriptPageCount(counted.chars),
    ...controls,
  };
}
