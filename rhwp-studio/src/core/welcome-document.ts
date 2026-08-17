/**
 * 첫 실행에 띄우는 사용법 문서.
 *
 * 도구 → 사용법 대화상자와 **같은 원본**(`core/usage-guide.ts`)을 실제 문서로 만든다.
 * 읽고 닫으면 끝나는 안내와 달리, 문서라서 그 위에 바로 글을 써 볼 수 있다 —
 * 문장부호를 찍으면 환호가 터지는 것도 여기서 처음 겪게 된다.
 *
 * 내용은 여기서 고치지 않는다. `usage-guide.ts` 를 고치면 대화상자와 함께 바뀐다.
 */

import { usageAsLines } from './usage-guide.ts';

/**
 * 문서에 들어갈 줄 목록. 문단 하나가 한 줄이고, 빈 문자열은 빈 문단이다.
 *
 * 머리말 넉 줄만 여기서 붙이고 본문은 `usage-guide.ts` 원본을 편 것이다.
 * 대화상자와 문서가 어긋나지 않는 이유가 이것이다 — 고칠 곳이 하나뿐이다.
 */
const WELCOME_LINES: string[] = [
  'hwwp — Homeground of Writer Word Processor',
  '',
  '원고를 완성하고 싶은 작가를 위한 HWP 편집기입니다. 이 문서를 지우고 그대로 쓰기 시작하셔도 됩니다.',
  '',
  ...usageAsLines(),
];

/** 문서에 글을 넣기 위해 필요한 최소 표면 */
export interface WelcomeDocumentWriter {
  insertText(sec: number, para: number, charOffset: number, text: string): unknown;
  splitParagraph(sec: number, para: number, charOffset: number): unknown;
}

/**
 * 빈 문서에 사용법 내용을 채운다.
 *
 * 빈 문서는 문단 하나로 시작하므로, 줄마다 글을 넣고 마지막 줄이 아니면 문단을
 * 쪼개 다음 줄 자리를 만든다.
 */
export function fillWelcomeDocument(writer: WelcomeDocumentWriter): void {
  WELCOME_LINES.forEach((line, index) => {
    if (line) writer.insertText(0, index, 0, line);
    if (index < WELCOME_LINES.length - 1) {
      writer.splitParagraph(0, index, line.length);
    }
  });
}

/** 첫 실행에 만드는 문서의 이름 */
export const WELCOME_DOC_NAME = 'hwwp 사용법.hwp';

/** 줄 수 — 테스트가 문단 수를 확인할 때 쓴다 */
export const WELCOME_LINE_COUNT = WELCOME_LINES.length;
