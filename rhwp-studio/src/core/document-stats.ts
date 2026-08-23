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
