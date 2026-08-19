import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HIGHLIGHT_COLOR_PRESETS,
  TEXT_COLOR_PRESETS,
  parseColorInput,
} from '../src/ui/color-menu.ts';

const toolbar = readFileSync(new URL('../src/ui/toolbar.ts', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

/**
 * 두 색 고르기가 서로 반대로 잘못돼 있었다. 글자색은 누르면 OS 색상환이 바로 떠서
 * 천육백만 색 중에 고르라고 했고, 형광펜은 스워치 마흔두 개를 깔았다.
 */
test('글자색은 색상환이 아니라 프리셋으로 연다', () => {
  assert.doesNotMatch(indexHtml, /id="text-color-picker"/, 'OS 색상환 입력칸이 남아 있다');
  assert.doesNotMatch(toolbar, /colorPicker/);
  assert.match(indexHtml, /id="text-color-palette"/);
  assert.match(toolbar, /presets: TEXT_COLOR_PRESETS/);
});

test('프리셋은 훑을 수 있는 개수로 둔다', () => {
  // 한 줄에 여섯이면 두 줄로 끝난다. 마흔둘은 "이 중에 뭘" 을 묻게 만든다.
  assert.equal(TEXT_COLOR_PRESETS.length, 12);
  assert.equal(HIGHLIGHT_COLOR_PRESETS.length, 6);
  // 색만으로 알리지 않는다 — 이름이 있어야 title·aria-label 을 붙일 수 있다.
  for (const p of [...TEXT_COLOR_PRESETS, ...HIGHLIGHT_COLOR_PRESETS]) {
    assert.match(p.value, /^#[0-9a-f]{6}$/, `${p.label} 의 값이 #rrggbb 가 아니다`);
    assert.ok(p.label.length > 0);
  }
});

test('형광펜 프리셋에 어두운 색을 넣지 않는다', () => {
  // 형광펜은 글자를 덮는 색이라 어두우면 글자가 읽히지 않는다. 예전 마흔두 색에는
  // #000000 도 있었다.
  for (const p of HIGHLIGHT_COLOR_PRESETS) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(p.value.slice(i, i + 2), 16));
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    assert.ok(luminance > 0.5, `${p.label}(${p.value}) 은 형광펜으로 쓰기에 어둡다`);
  }
});

test('직접 입력은 사람이 적는 여러 꼴을 받는다', () => {
  assert.equal(parseColorInput('#FF0000'), '#ff0000');
  assert.equal(parseColorInput('ff0000'), '#ff0000');
  assert.equal(parseColorInput('#f00'), '#ff0000');
  assert.equal(parseColorInput('  #00FF80  '), '#00ff80');
  // 색을 값으로 말하는 사람은 보통 이 꼴로 적는다.
  assert.equal(parseColorInput('255,0,0'), '#ff0000');
  assert.equal(parseColorInput('18, 52, 86'), '#123456');
  assert.equal(parseColorInput('0 0 0'), '#000000');
});

test('읽을 수 없는 값은 색으로 만들지 않는다', () => {
  // 아무 색이나 돌려주면 사용자가 적은 것과 다른 색이 조용히 적용된다.
  for (const bad of ['', '  ', 'zzz', '#12345', '#1234567', '256,0,0', '1,2', '1,2,3,4', 'red']) {
    assert.equal(parseColorInput(bad), null, `${JSON.stringify(bad)} 가 색으로 읽혔다`);
  }
});

test('두 고르기가 같은 메뉴를 쓴다', () => {
  // 하나는 색상환, 하나는 스워치 마흔둘이던 시절로 돌아가지 않게 한 곳으로 모았다.
  assert.match(toolbar, /private bindColorDropdown\(opts: \{/);
  assert.equal(toolbar.match(/this\.bindColorDropdown\(\{/g)?.length, 2);
  assert.doesNotMatch(toolbar, /const PALETTE = \[/, '스워치 표가 되살아났다');
});

test('형광펜에만 색 없음이 있다', () => {
  // 글자는 언제나 어떤 색으로든 그려진다 — 되돌리는 것은 검정을 고르는 일이다.
  const highlight = toolbar.slice(
    toolbar.indexOf('setupHighlightPicker'),
    toolbar.indexOf('private bindColorDropdown'),
  );
  assert.match(highlight, /clear: \{ label: '색 없음'/);
  const textColor = toolbar.slice(
    toolbar.indexOf('private setupColorPicker'),
    toolbar.indexOf('setupHighlightPicker'),
  );
  assert.doesNotMatch(textColor, /clear:/);
});
