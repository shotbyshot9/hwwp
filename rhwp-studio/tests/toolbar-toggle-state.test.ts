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

/** 색·모양만으로 알리면 그것을 못 보는 사람에게는 알 길이 없다. */
test('켜짐을 화면 낭독기에도 알린다', () => {
  // 도구 모음은 button 이라 aria-pressed, 메뉴 항목은 div 라 menuitemcheckbox 다.
  assert.match(viewCmd, /el\.setAttribute\('aria-pressed', String\(on\)\)/);
  assert.match(viewCmd, /setAttribute\('role', 'menuitemcheckbox'\)/);
  assert.match(viewCmd, /el\.setAttribute\('aria-checked', String\(on\)\)/);
  // 테마 고르기처럼 이미 역할이 적힌 항목을 덮어쓰면 라디오가 체크박스로 바뀐다.
  assert.match(viewCmd, /if \(!el\.hasAttribute\('role'\)\)/);
});

test('메뉴 항목과 도구 모음 버튼을 같은 자리에서 맞춘다', () => {
  // 같은 data-cmd 가 양쪽에 있으므로 선택자 하나로 둘 다 잡아야 어긋나지 않는다.
  assert.match(viewCmd, /export function markToggleState\(cmd: string, on: boolean\)/);
  assert.match(viewCmd, /markToggleState\('view:ctrl-mark', showControlCodes\)/);
  assert.match(viewCmd, /markToggleState\('view:para-mark', showParagraphMarks\)/);
  // 예전에는 명령마다 querySelectorAll 루프를 따로 돌려서, 새 토글을 넣을 때마다
  // aria 를 빠뜨릴 자리가 하나씩 늘었다. 전부 이 함수를 지나가게 모았다.
  assert.doesNotMatch(
    viewCmd,
    /querySelectorAll\('\[data-cmd="view:[^"]+"\]'\)\.forEach/,
    '토글 상태를 markToggleState 밖에서 직접 칠하는 곳이 남아 있다',
  );
});

/** 메뉴의 왼쪽 칸은 아이콘이 아니라 상태를 위한 자리다. */
test('메뉴는 켜짐을 체크로, 가리킴을 배경으로 알린다', () => {
  const menuCss = readFileSync(new URL('../src/styles/menu-bar.css', import.meta.url), 'utf8');
  assert.match(menuCss, /\.md-item\.active::before \{[^}]*content: '✓';/s);
  // 둘이 같은 배경색을 쓰면 켜 둔 항목도 커서를 옮기는 순간 켜졌는지 알 수 없다.
  assert.doesNotMatch(menuCss, /\.md-item\.active \{[^}]*background:/s);
  assert.match(menuCss, /\.md-item:hover \{[^}]*background: var\(--ui-hover\);/s);
});
