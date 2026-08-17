import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const toolbarCss = readFileSync(new URL('../src/styles/toolbar.css', import.meta.url), 'utf8');
const viewCmd = readFileSync(new URL('../src/command/commands/view.ts', import.meta.url), 'utf8');

/**
 * 조판부호·문단부호·격자 등 열넷이 `.active` 를 받고 있었는데 toolbar.css 에 그 규칙이
 * 없어서 화면에 아무 변화가 없었다. 편집기에는 표시가 나오는데 버튼은 그대로라, 켠
 * 것인지 아닌지 버튼만 봐서는 알 수 없었다.
 */
test('켜진 도구 모음 토글에 눌린 표시가 있다', () => {
  assert.match(toolbarCss, /\.tb-btn\.active \{/);
  // 배경만 바꾸면 hover 와 구별되지 않는다 — 테두리로 한 겹 더 구분한다.
  assert.match(toolbarCss, /\.tb-btn\.active \{[^}]*background:[^}]*border-color:[^}]*\}/s);
});

test('켜진 상태에서 가리켜도 켜진 것으로 보인다', () => {
  // 이 규칙이 없으면 .tb-btn:hover 가 켜짐 배경을 덮어써 켠 채로 가리키면 꺼진 듯 보인다.
  assert.match(toolbarCss, /\.tb-btn\.active:hover \{/);
});

/** 색만으로 알리면 색을 구별하기 어려운 사람에게는 알 길이 없다. */
test('버튼에 aria-pressed 를 붙인다', () => {
  assert.match(viewCmd, /if \(el\.tagName === 'BUTTON'\) el\.setAttribute\('aria-pressed', String\(on\)\)/);
});

test('메뉴 항목과 도구 모음 버튼을 같은 자리에서 맞춘다', () => {
  // 같은 data-cmd 가 양쪽에 있으므로 선택자 하나로 둘 다 잡아야 어긋나지 않는다.
  assert.match(viewCmd, /function markToggleState\(cmd: string, on: boolean\)/);
  assert.match(viewCmd, /markToggleState\('view:ctrl-mark', showControlCodes\)/);
  assert.match(viewCmd, /markToggleState\('view:para-mark', showParagraphMarks\)/);
});
