import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  WELCOME_DOC_NAME,
  WELCOME_LINE_COUNT,
  fillWelcomeDocument,
} from '../src/core/welcome-document.ts';
import { USAGE_SECTIONS } from '../src/core/usage-guide.ts';

/** 절의 모든 글을 한 덩어리로 — 문장이 어느 문단에 있든 찾을 수 있게 */
const usageText = USAGE_SECTIONS
  .flatMap((s) => [s.title, ...(s.paragraphs ?? []), ...(s.items ?? []).flat()])
  .join('\n');

const welcomeSource = readFileSync(
  new URL('../src/core/welcome-document.ts', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

/** 첫 문서에 실제로 들어가는 줄 */
function welcomeLines(): string[] {
  const lines: string[] = [];
  fillWelcomeDocument({
    insertText: (_s, _p, _c, text) => { lines.push(text); },
    splitParagraph: () => { /* 자리만 만든다 */ },
  });
  return lines;
}

/**
 * 첫 문서는 **짧아야 한다.**
 *
 * 예전에는 사용법 전문을 그대로 폈다 — 66줄 2,911자. 처음 온 사람이 그걸 읽고 시작할
 * 리가 없고, 정작 급한 "나가기는 Esc" 는 아홉째 줄에 묻혀 있었다.
 *
 * 길이가 다시 늘어나는 것은 한 줄씩 조용히 일어난다. 그래서 숫자로 못을 박아 둔다.
 */
test('첫 문서는 짧다', () => {
  assert.equal(WELCOME_DOC_NAME, 'hwwp 시작하기.hwp');
  assert.ok(WELCOME_LINE_COUNT <= 20, `줄이 ${WELCOME_LINE_COUNT}개로 늘었다`);

  const chars = welcomeLines().join('').length;
  assert.ok(chars < 400, `글자가 ${chars}자로 늘었다 — 다시 아무도 안 읽는 문서가 된다`);
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
 * 읽는 문서가 아니라 **채우는 문서**다.
 *
 * 이 제품은 이미 가장 좋은 설명을 갖고 있다 — 글을 치면 박수가 터진다. 문장으로
 * 설명하는 것보다 한 번 겪게 하는 것이 빠르다. 그래서 해 보라고 시키고 빈 줄을 준다.
 */
test('읽으라고 하지 않고 해 보라고 한다', () => {
  const lines = welcomeLines();
  const asks = lines.filter((l) => /보세요/.test(l));
  assert.ok(asks.length >= 3, `해 보라는 줄이 ${asks.length}개뿐이다`);

  // 쓸 자리가 있어야 한다 — 빈 줄이 글이 있는 줄만큼은 되어야 한다.
  const blanks = WELCOME_LINE_COUNT - lines.length;
  assert.ok(blanks >= lines.length, `빈 줄이 ${blanks}개뿐이라 쓸 자리가 없다`);
});

/**
 * 가장 급한 것은 나가는 길이다. 메뉴도 도구 모음도 없는 화면에서 나가는 법을 모르면
 * 사람은 탭을 닫는다. 첫 화면 안에 있어야 한다.
 */
test('나가는 길을 맨 앞에서 알려 준다', () => {
  const lines = welcomeLines();
  const escAt = lines.findIndex((l) => l.includes('Esc'));
  assert.ok(escAt >= 0, 'Esc 안내가 없다');
  assert.ok(escAt <= 1, `Esc 안내가 ${escAt + 1}번째 글줄이라 화면 밖으로 밀린다`);
});

/**
 * 전문을 지운 것이 아니라 옮긴 것이다. 어디로 갔는지 말해 주지 않으면 그냥 잃은 것이 된다.
 */
test('나머지 사용법이 어디 있는지 가리킨다', () => {
  const lines = welcomeLines();
  assert.ok(
    lines.some((l) => l.includes('도구') && l.includes('사용법')),
    '전문이 어디 있는지 알려 주지 않는다',
  );
});

/**
 * 첫 문서가 사용법 전문을 더 이상 펴지 않는다. 되돌아가면 예전 문제가 그대로 돌아온다.
 */
test('첫 문서는 사용법 전문을 펴지 않는다', () => {
  assert.doesNotMatch(welcomeSource, /usageAsLines/, '전문을 다시 펴고 있다');
});

/**
 * 사용법 전문은 대화상자에 그대로 있다. 이쪽이 없어지면 안내가 통째로 사라진다.
 */
test('사용법 전문은 대화상자에 그대로 있다', () => {
  const help = readFileSync(new URL('../src/ui/help-dialog.ts', import.meta.url), 'utf8');
  assert.match(help, /import \{ USAGE_SECTIONS \} from '@\/core\/usage-guide\.ts'/);
  assert.match(help, /for \(const section of USAGE_SECTIONS\)/);
  assert.doesNotMatch(help, /const SECTIONS/, '대화상자가 자기 문장을 따로 갖고 있다');
});

test('사용법에는 원본의 모든 절이 들어간다', () => {
  for (const section of USAGE_SECTIONS) {
    assert.ok(usageText.includes(section.title), `절이 빠졌다: ${section.title}`);
  }
});

/**
 * 대화상자는 아무 화면에서나 열 수 있다. "지금 이 화면은…" 같은 말은 어디선가 반드시
 * 거짓이 된다. 한 번 그렇게 되어 있었다.
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

test('메뉴와 제목 줄이 배명훈 모드에는 없다는 것을 먼저 말한다', () => {
  assert.match(usageText, /배명훈 모드는 쓰기만 하는 자리입니다/);
  assert.match(usageText, /Esc 로 나간 편집 화면에서 합니다/);
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

/**
 * 첫 문서가 짧아졌으므로 안내가 무엇을 다시 열어 주는지도 달라졌다. 메뉴 이름과
 * 실제로 열리는 것이 어긋나면 안내가 거짓이 된다.
 */
test('다시 보는 법이 실제 메뉴와 맞다', () => {
  assert.match(usageText, /도구 → 사용법」을 누르면 이 안내가 그대로 다시 나옵니다/);
  assert.match(usageText, /도구 → 처음 화면 다시 열기」를 고르면/);
  // 짧은 연습 문서라는 것을 밝혀야 "같은 내용인 줄 알았는데" 가 없다.
  assert.match(usageText, /이 안내와 같은 내용은 아니고/);
  assert.match(usageText, /새 탭에서 열리므로 쓰던 문서는 그 자리에 그대로 있습니다/);

  // 메뉴 이름이 실제 코드와 같아야 한다.
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /label: '처음 화면 다시 열기'/);
  assert.doesNotMatch(usageText, /사용법 문서 열기/, '없어진 메뉴 이름이 안내에 남아 있다');
});

/**
 * 나가기 옆 `Esc` 이름표 — 처음 온 사람에게만, 한 번 나가 보면 끝.
 * 튜토리얼이 아니라 이름표라, 누를 것도 닫을 것도 없어야 한다.
 */
test('나가기 이름표는 처음 한 번만 보인다', () => {
  const focus = readFileSync(new URL('../src/focus/focus-mode.ts', import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n');
  const settings = readFileSync(new URL('../src/core/user-settings.ts', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/styles/focus-mode.css', import.meta.url), 'utf8');

  assert.match(settings, /exitHintSeen: boolean;/);
  assert.match(settings, /exitHintSeen: false,/, '기본값이 켜져 있어야 처음 온 사람이 본다');
  assert.match(focus, /if \(!userSettings\.getFocusSettings\(\)\.exitHintSeen\)/);
  // 한 번 나가 보면 끈다.
  assert.match(focus, /exitHintSeen: true/);
  assert.match(css, /\.fm-exit-hint \{/);

  // 단추가 아니다 — 누르는 것으로 오해되면 안 된다.
  const hintCss = css.match(/\.fm-exit-hint \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(hintCss, /pointer-events: none/);
});
