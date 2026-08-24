/**
 * 첫 실행에 띄우는 문서.
 *
 * 예전에는 사용법 전문(`usage-guide.ts`)을 그대로 폈다. 66줄 2,911자였고, 가장 급한
 * "나가기는 Esc" 가 아홉째 줄에 묻혀 있었다. 처음 온 사람이 그걸 읽고 시작할 리가 없다.
 *
 * 그래서 **읽는 문서를 채우는 문서로 바꾼다.** 빈 줄을 두고 한 번 해 보라고만 한다.
 * 이 제품은 이미 가장 좋은 설명을 가지고 있다 — 글을 치면 박수가 터진다. 그것을 겪게
 * 하는 것이 문장으로 설명하는 것보다 빠르다.
 *
 * 사용법 전문은 없어지지 않는다. **도구 → 사용법**에 그대로 있고(`tool:help`),
 * 이 문서 마지막 줄이 거기를 가리킨다.
 */

/**
 * 문서에 들어갈 줄 목록. 문단 하나가 한 줄이고, 빈 문자열은 빈 문단이다.
 *
 * 짧게 유지한다. 길어지는 순간 다시 아무도 안 읽는 문서가 된다. 설명하고 싶은 것이
 * 생기면 `usage-guide.ts` 에 넣는다 — 그쪽은 찾아온 사람이 보는 자리다.
 */
const WELCOME_LINES: string[] = [
  'hwwp',
  '',
  '지금은 배명훈 모드입니다. 글만 남는 화면이고, 나가기는 Esc 입니다.',
  '',
  '아래 빈 줄에 아무 문장이나 써 보세요. 마침표까지 찍어 보세요.',
  '',
  '',
  '방금 무슨 일이 있었는지 보셨나요? 오른쪽 아래에 진행바가 차오르고 있습니다. 50자를 채우면 어떻게 되는지 보세요.',
  '',
  '',
  '오른쪽 위 「x1」 단추를 눌러 보세요. 누를수록 응원이 잦아집니다.',
  '',
  '',
  '이 문서는 지우고 그대로 쓰기 시작하셔도 됩니다. 저장할 자리와 나머지 사용법은 Esc 로 나가서 도구 → 사용법 에 있습니다.',
];

/** 문서에 글을 넣기 위해 필요한 최소 표면 */
export interface WelcomeDocumentWriter {
  insertText(sec: number, para: number, charOffset: number, text: string): unknown;
  splitParagraph(sec: number, para: number, charOffset: number): unknown;
}

/**
 * 빈 문서에 첫 실행 내용을 채운다.
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

/** 문서가 몇 줄인지 — 짧게 유지되는지 시험에서 본다 */
export const WELCOME_LINE_COUNT = WELCOME_LINES.length;

/** 첫 실행에 만드는 문서의 이름 */
export const WELCOME_DOC_NAME = 'hwwp 시작하기.hwp';
