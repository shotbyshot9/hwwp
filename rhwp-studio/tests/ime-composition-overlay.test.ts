import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const caretRenderer = readFileSync(
  new URL('../src/engine/caret-renderer.ts', import.meta.url),
  'utf8',
);
const inputHandler = readFileSync(
  new URL('../src/engine/input-handler.ts', import.meta.url),
  'utf8',
);

/**
 * 한글을 치는 동안 글자가 심장박동처럼 작아졌다 커졌다 하던 결함을 막는다.
 *
 * 조합 중인 글자는 두 겹으로 그려진다 — 조합 텍스트를 문서에 바로 넣어 배치를 보여
 * 주므로 canvas 에 한 번, 그 위에 검은 상자 오버레이로 한 번. 오버레이가 깜빡이면
 * 0.5초마다 아래 canvas 글자가 드러나고, 두 글자의 크기가 다르면 그 차이가 눈에
 * 띈다. 옛 코드는 둘 다 틀렸다.
 */
test('조합 오버레이는 깜빡이지 않는다', () => {
  const show = caretRenderer.slice(
    caretRenderer.indexOf('showComposition('),
    caretRenderer.indexOf('hideComposition()'),
  );
  assert.doesNotMatch(show, /this\.startBlink\(\)/, '조합 중인 글자는 캐럿이 아니다');
  assert.match(show, /this\.stopBlink\(\)/);
});

test('깜빡임 타이머는 캐럿만 건드린다', () => {
  const blink = caretRenderer.slice(
    caretRenderer.indexOf('private startBlink()'),
    caretRenderer.indexOf('private stopBlink()'),
  );
  assert.doesNotMatch(blink, /compEl/, '타이머가 조합 오버레이를 대상으로 삼으면 안 된다');
  assert.match(blink, /this\.caretEl\.style\.opacity/);
});

test('조합 오버레이 글자 크기는 줄 높이가 아니라 실제 글자 크기에서 온다', () => {
  // 줄 높이는 글자 크기와 다르다. 어림값(줄높이 × 0.85)은 10pt 에서 15% 작게 나왔다.
  assert.match(caretRenderer, /const PX_PER_PT = 96 \/ 72;/);
  assert.match(caretRenderer, /function compositionFontSize\(lineHeight: number, fontSizePt\?: number\)/);
  assert.match(caretRenderer, /return fontSizePt \* PX_PER_PT;/);
  assert.match(caretRenderer, /compositionFontSize\(box\.h, fontSizePt\)/);
  // 어림값은 실제 크기를 못 읽었을 때만 쓴다.
  assert.match(caretRenderer, /return lineHeight \* 0\.85;/);
});

test('호출부가 커서 자리의 글자 크기를 넘긴다', () => {
  // fontSize 는 HWPUNIT 이라 100으로 나눠야 pt 가 된다. 이 환산을 빠뜨리면 오버레이가
  // 100배 커진다.
  assert.match(inputHandler, /fontSizePt = props\.fontSize \/ 100/);
  assert.match(
    inputHandler,
    /showComposition\(startRect, charWidth, zoom, text, fontFamily, fontSizePt\)/,
  );
});

test('조합이 끝나면 캐럿이 되살아난다', () => {
  const hide = caretRenderer.slice(
    caretRenderer.indexOf('hideComposition(): void'),
    caretRenderer.indexOf('private clampCaretRect'),
  );
  assert.match(hide, /this\.caretEl\.style\.display = 'block'/);
  assert.match(hide, /this\.startBlink\(\)/);
});

/**
 * 줄 끝에서 글자가 두 번 보이던 결함을 막는다.
 *
 * 조합 오버레이의 자리는 `getCursorRect(조합 시작 오프셋)` 으로 잡고, 너비는
 * `현재 커서 x - 시작 x` 로 잰다. 이 셈은 두 자리가 같은 줄에 있을 때만 맞는다.
 *
 * 조합 중인 글자가 줄 끝을 넘어가면 엔진은 그 글자를 새 줄 앞머리에 놓는데, 조합 시작
 * 오프셋의 커서 자리는 여전히 앞 줄 끝으로 풀린다. 그러면 너비가 음수가 되어
 * `Math.max(charWidth, rect.height * 0.6)` 의 어림값으로 떨어지고, 검은 상자는 앞 줄
 * 오른쪽 끝(여백 바깥)에 그려진다. 같은 글자가 canvas 의 새 줄 앞머리에도 그려져 있으니
 * **한 글자가 두 줄에 걸쳐 두 번 보인다.** 사용자 눈에는 치지도 않은 글자가 생긴 것이다.
 *
 * 14pt 처럼 글자가 크면 줄 끝에 더 자주 닿아 눈에 띄었을 뿐, 크기와 무관한 결함이다.
 */
test('줄을 넘어간 조합 글자에는 오버레이를 그리지 않는다', () => {
  assert.match(
    inputHandler,
    /function compositionWrapped\(start: CursorRect, end: CursorRect\): boolean/,
    '줄바꿈 판정이 없다',
  );

  const wrapped = inputHandler.slice(
    inputHandler.indexOf('function compositionWrapped'),
    inputHandler.indexOf('function availableDropWidthPx'),
  );
  // 쪽이 바뀌어도 줄이 바뀐 것이다.
  assert.match(wrapped, /start\.pageIndex !== end\.pageIndex/);
  // y 가 달라지면 다른 줄이다. 부동소수라 정확히 같기를 기대하면 안 된다.
  assert.match(wrapped, /Math\.abs\(start\.y - end\.y\) > 0\.5/);
  // 끝이 시작보다 왼쪽인 것은 같은 줄에서는 있을 수 없다 — 너비가 음수가 되는 바로 그 경우다.
  assert.match(wrapped, /end\.x < start\.x/);
});

test('줄을 넘어가면 상자 대신 보통 캐럿으로 돌아간다', () => {
  const branch = inputHandler.slice(
    inputHandler.indexOf('if (compositionWrapped(startRect, rect))'),
    inputHandler.indexOf('this.caret.showComposition('),
  );
  assert.ok(branch.length > 0, '줄바꿈 갈래를 찾지 못했다');
  // 그리지 않는 것으로 끝내면 안 된다 — 조합 중에는 캐럿도 숨겨져 있으므로
  // 되살리지 않으면 커서가 사라진 것처럼 보인다.
  assert.match(branch, /this\.caret\.hideComposition\(\)/);
  assert.match(branch, /this\.caret\.update\(caretRect, zoom\)/);
});

test('오버레이는 같은 줄일 때만 그린다', () => {
  // showComposition 이 판정 밖으로 새어 나가면 결함이 그대로 돌아온다.
  const calls = inputHandler.match(/this\.caret\.showComposition\(/g) ?? [];
  assert.equal(calls.length, 1, 'showComposition 호출은 한 곳이어야 판정을 우회할 수 없다');
  const before = inputHandler.slice(0, inputHandler.indexOf('this.caret.showComposition('));
  assert.match(
    before,
    /if \(compositionWrapped\(startRect, rect\)\)/,
    'showComposition 이 줄바꿈 판정 뒤에 있지 않다',
  );
});
