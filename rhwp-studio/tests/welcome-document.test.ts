import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  WELCOME_DOC_NAME,
  WELCOME_LINE_COUNT,
  fillWelcomeDocument,
} from '../src/core/welcome-document.ts';
import { USAGE_SECTIONS, usageAsLines } from '../src/core/usage-guide.ts';

/** 절의 모든 글을 한 덩어리로 — 문장이 어느 문단에 있든 찾을 수 있게 */
const usageText = USAGE_SECTIONS
  .flatMap((s) => [s.title, ...(s.paragraphs ?? []), ...(s.items ?? []).flat()])
  .join('\n');

test('문서 이름과 줄 수', () => {
  assert.equal(WELCOME_DOC_NAME, 'hwwp 사용법.hwp');
  assert.ok(WELCOME_LINE_COUNT > 30, '내용이 너무 짧다');
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
 * 이 저장소의 오래된 버릇: 대화상자와 문서가 각자 문장을 갖고 있다가 어긋났다.
 * 원본이 하나라는 것을 배선으로 고정한다 — 주석으로는 못 막았다.
 */
test('대화상자와 문서가 같은 원본을 읽는다', () => {
  const help = readFileSync(new URL('../src/ui/help-dialog.ts', import.meta.url), 'utf8');
  const welcome = readFileSync(new URL('../src/core/welcome-document.ts', import.meta.url), 'utf8');

  assert.match(help, /import \{ USAGE_SECTIONS \} from '@\/core\/usage-guide\.ts'/);
  assert.match(help, /for \(const section of USAGE_SECTIONS\)/);
  assert.match(welcome, /\.\.\.usageAsLines\(\)/);

  // 어느 쪽에도 자기만의 안내 문장이 남아 있으면 안 된다.
  assert.doesNotMatch(help, /const SECTIONS/);
  assert.doesNotMatch(welcome, /드라이브/, '문서 쪽에 안내 문장이 다시 박혔다');
});

test('문서에는 원본의 모든 절이 들어간다', () => {
  const lines = usageAsLines();
  for (const section of USAGE_SECTIONS) {
    assert.ok(lines.includes(section.title), `절이 빠졌다: ${section.title}`);
  }
  // 단축키는 표를 만들 수 없으니 「키 — 뜻」 한 줄로 편다.
  assert.ok(lines.some((l) => l.startsWith('Alt+Shift+F — ')));
});

/**
 * 대화상자는 아무 화면에서나 열 수 있고, 문서는 배명훈 모드 안에서 열린다.
 * "지금 이 화면은…" 같은 말은 한쪽에서 반드시 거짓이 된다. 한 번 그렇게 되어 있었다.
 */
test('읽는 사람이 어디에 있는지 가정하지 않는다', () => {
  assert.doesNotMatch(usageText, /지금 보고 계신/);
  assert.doesNotMatch(usageText, /지금 이 화면/);
  assert.match(usageText, /켜면 바로 배명훈 모드로 들어갑니다/);
});

test('로컬 파일을 고치면 어디에 저장되는지 설명한다', () => {
  // 셋 다 있어야 안심하고 쓸 수 있다:
  // 열기만 하면 안 올라간다 / 고치면 올라간다 / 내 컴퓨터 원본은 그대로다.
  assert.match(usageText, /읽기만 하면 드라이브에 올라가지 않습니다/);
  assert.match(usageText, /한 글자라도 고치면/);
  assert.match(usageText, /원본 파일은 건드리지 않고 그대로 둡니다/);
  // 가장 놀랄 만한 결과 — 나중에 원본을 열면 옛날 내용이다.
  assert.match(usageText, /고치기 전 상태입니다/);
});

/**
 * 사용법 문서는 배명훈 모드 안에서 열린다. 그 화면에는 메뉴바도 제목 줄도 없다.
 * "제목 줄 오른쪽 버튼을 누르세요" 만 적어 두면 읽는 사람은 찾다가 못 찾는다.
 */
test('메뉴와 제목 줄이 배명훈 모드에는 없다는 것을 먼저 말한다', () => {
  assert.match(usageText, /배명훈 모드는 쓰기만 하는 자리입니다/);
  assert.match(usageText, /Esc 로 나간 편집 화면에서 합니다/);
  // 드라이브 연결도 어디서 하는지 짚어 준다.
  assert.match(usageText, /배명훈 모드라면 Esc 로 나간 뒤, 제목 줄 오른쪽/);
});

test('드라이브를 연결하지 않았을 때 할 일을 알려 준다', () => {
  assert.match(usageText, /자동 저장 안 됨 · Ctrl\+S/);
  // 복구본이 있다는 것을 함께 말해야 실제보다 무섭게 읽히지 않는다.
  assert.match(usageText, /복구본/);
});

test('응원 배속을 안내한다', () => {
  assert.match(usageText, /x2 → x3 → x5 → x10 → MAX/);
  assert.match(usageText, /60타/);
});

test('다시 보는 법을 두 갈래 다 알려 준다', () => {
  // 첫 실행에만 뜨는 문서라, 이 안내가 없으면 두 번 다시 못 본다.
  assert.match(usageText, /도구 → 사용법」을 누르면 이 안내가 그대로 다시 나옵니다/);
  assert.match(usageText, /도구 → 사용법 문서 열기」를 고르면 같은 내용이 문서로 열립니다/);
  // 새 탭에서 열린다는 것을 말해 줘야 "쓰던 문서 어디 갔지" 를 겪지 않는다.
  assert.match(usageText, /새 탭에서 열리므로 쓰던 문서는 그 자리에 그대로 있습니다/);
});
