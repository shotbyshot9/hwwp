/**
 * 첫 실행에 띄우는 사용법 문서.
 *
 * 도구 → 사용법 대화상자와 같은 내용을 **실제 문서**로 만든다. 읽고 닫으면
 * 끝나는 안내와 달리, 문서라서 그 위에 바로 글을 써 볼 수 있다 — 문장부호를
 * 찍으면 환호가 터지는 것도 여기서 처음 겪게 된다.
 *
 * 내용을 고칠 때는 `ui/help-dialog.ts` 도 함께 본다. 둘이 어긋나면 안 된다.
 */

/** 문단 하나가 한 줄이다. 빈 문자열은 빈 문단(사이 띄우기). */
const WELCOME_LINES: string[] = [
  'WHP — Writer\'s Homeground Processor',
  '',
  '작가를 위한 워드프로세서입니다. 이 문서를 지우고 그대로 쓰기 시작하셔도 됩니다.',
  '',
  '저장 버튼이 없습니다',
  '구글 드라이브에 자동으로 저장합니다. 쓰기를 멈추면 2초 뒤, 쉬지 않고 쓰는 중에도 30초마다 저장합니다.',
  '제목 줄 오른쪽의 「구글 드라이브 연결」을 한 번 누르면 드라이브에 hwwp 폴더가 생기고 그 안에 문서가 쌓입니다.',
  '연결하지 않아도 글은 쓸 수 있습니다. 변경분은 브라우저에 보관되고 연결하는 순간 올라갑니다.',
  '',
  '문서 이름 바꾸기',
  '제목 줄의 이름을 눌러 그 자리에서 고칩니다. Enter 로 확정, Esc 로 취소합니다.',
  '',
  '배명훈 모드',
  'Alt+Shift+F 를 누르면 메뉴가 사라지고 글만 남습니다. 나가기는 Esc 입니다.',
  '지금 이 문서에 한 문장 써 보세요. 문장부호를 찍을 때마다 환호와 박수가 터집니다.',
  '쉬지 않고 이어 쓸수록 커지고, 2초 이상 멈추면 처음부터 다시 쌓입니다.',
  '',
  '문서가 작게 보인다면',
  '보기 → 배율 → 화면 보정 을 한 번 해 주세요. 화면에 나온 막대를 신용카드 긴 변에 맞추면',
  '배율 100% 가 실제 종이 크기와 같아집니다. 한 번만 하면 이 브라우저에 기억됩니다.',
  '',
  '더 자세한 설명은 도구 → 사용법 에 있습니다.',
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
