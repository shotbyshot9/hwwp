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
 * **줄 수는 없다.** 엔진이 조판할 때 줄을 나눠 두지만(`line_segs`) 그 개수를 밖으로
 * 꺼내는 통로가 아직 없다. 있는 척하느니 빼는 편이 낫다.
 *
 * **작성 날짜·마지막 저장한 사람도 없다.** HWP 파일의 요약 정보에 있는 값인데 hwwp 는
 * 읽지도 쓰지도 않는다. 특히 "저장한 사람" 은 이름을 파일에 적는 일이라, 개인정보를
 * 받지 않는다는 이 제품의 약속과 어긋난다.
 */
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

/** 문서 전체 통계 */
export function documentStatistics(
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
    pages,
    manuscriptPages: manuscriptPageCount(counted.chars),
    ...controls,
  };
}
