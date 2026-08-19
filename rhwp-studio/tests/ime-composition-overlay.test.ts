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
