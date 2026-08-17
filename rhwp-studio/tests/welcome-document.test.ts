import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  WELCOME_DOC_NAME,
  WELCOME_LINE_COUNT,
  fillWelcomeDocument,
} from '../src/core/welcome-document.ts';

/**
 * 소스에서 문장을 찾는다.
 *
 * 안내 문구는 줄 길이를 맞추려고 `'앞부분 ' + '뒷부분'` 으로 쪼개 적는다. 그대로
 * 검사하면 이어붙임 자리에서 문장이 끊겨 못 찾으므로, 붙여 놓고 본다.
 */
function readJoined(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8').replace(/'\s*\+\s*'/g, '');
}

const welcomeSource = readJoined('../src/core/welcome-document.ts');
const helpSource = readJoined('../src/ui/help-dialog.ts');

test('문서 이름과 줄 수', () => {
  assert.equal(WELCOME_DOC_NAME, 'hwwp 사용법.hwp');
  assert.ok(WELCOME_LINE_COUNT > 20, '내용이 너무 짧다');
});

test('줄마다 글을 넣고 마지막 줄만 문단을 쪼개지 않는다', () => {
  const inserts: string[] = [];
  let splits = 0;
  fillWelcomeDocument({
    insertText: (_s, _p, _c, text) => { inserts.push(text); },
    splitParagraph: () => { splits += 1; },
  });
  // 빈 줄(사이 띄우기)은 insertText 를 부르지 않는다.
  assert.ok(inserts.length > 0);
  assert.equal(splits, WELCOME_LINE_COUNT - 1);
});

/**
 * 이 문서는 배명훈 모드 **안에서** 열린다. 읽는 사람은 이미 그 안에 있으므로
 * "들어가려면 Alt+Shift+F" 라고 쓰면 앞뒤가 맞지 않는다. 한 번 그렇게 되어 있었다.
 */
test('이미 배명훈 모드 안이라는 전제로 쓰여 있다', () => {
  assert.match(welcomeSource, /지금 보고 계신 이 화면이 배명훈 모드입니다/);
  // 나가는 법을 먼저 알려 주고, 들어오는 법은 그다음이다.
  const exitAt = welcomeSource.indexOf('Esc 를 누르면 보통 편집 화면으로 나갑니다');
  const enterAt = welcomeSource.indexOf('Alt+Shift+F');
  assert.ok(exitAt > 0 && enterAt > 0 && exitAt < enterAt, '나가는 법이 먼저 나와야 한다');
});

test('로컬 파일을 고치면 어디에 저장되는지 설명한다', () => {
  for (const [name, source] of [['사용법 문서', welcomeSource], ['사용법 대화상자', helpSource]] as const) {
    // 셋 다 있어야 한 사람이 안심하고 쓸 수 있다:
    // 열기만 하면 안 올라간다 / 고치면 올라간다 / 원본은 그대로다.
    assert.match(source, /읽기만 하면 드라이브에 올라가지 않습니다/, `${name}: 열기만 할 때`);
    assert.match(source, /한 글자라도 고치면/, `${name}: 편집하면`);
    assert.match(source, /원본 파일은 건드리지 않고 그대로 둡니다/, `${name}: 원본 보존`);
    // 가장 놀랄 만한 결과 — 나중에 원본을 열면 옛날 내용이다.
    assert.match(source, /고치기 전 상태입니다/, `${name}: 원본이 낡는다는 사실`);
  }
});

test('드라이브를 연결하지 않았을 때 할 일을 알려 준다', () => {
  for (const source of [welcomeSource, helpSource]) {
    assert.match(source, /자동 저장 안 됨 · Ctrl\+S/);
    // 복구본이 있다는 것을 함께 말해야 실제보다 무섭게 읽히지 않는다.
    assert.match(source, /복구본/);
  }
});

test('응원 배속을 안내한다', () => {
  assert.match(welcomeSource, /x2 → x3 → x5 → x10 → MAX/);
  assert.match(welcomeSource, /60타/);
});

test('다시 여는 법을 알려 준다', () => {
  // 첫 실행에만 뜨는 문서라, 이 줄이 없으면 두 번 다시 못 본다.
  assert.match(welcomeSource, /도구 → 사용법 문서 열기/);
});
