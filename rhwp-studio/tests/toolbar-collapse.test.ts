/*
 * 툴바 접기 — 메뉴에 들어가지 않고 접을 수 있는가.
 *
 * 노트북에서 쓰는 사람이 "툴바 압박이 쫌 있습니다. 툴바 숨기는 기능이 있는데 제가 못
 * 찾은 걸 수도?" 라고 했다. 기능은 보기 → 도구 상자 → 기본 / 서식 에 있었지만 세 겹
 * 안이라 못 찾고, 접어도 새로고침하면 되돌아왔다.
 *
 * 여기서 지키는 것은 셋이다 — 단추가 제목 줄에 있을 것, Ctrl+F1 이 같은 명령으로 갈
 * 것, 접힘이 설정에 저장될 것.
 *
 * 커맨드 정의는 `@/ui` 별칭을 타고 들어가 node --test 로는 못 불러온다. 그래서 소스를
 * 읽어 확인한다. 개행은 맞춰 둔다 — 작업 사본이 CRLF 가 되면 글자 그대로 찾는 검사가
 * 어긋난다.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { defaultShortcuts, matchShortcut } from '../src/command/shortcut-map.ts';

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

const html = read('index.html');
const viewCommands = read('src/command/commands/view.ts');
const visibility = read('src/ui/toolbar-visibility.ts');
const settings = read('src/core/user-settings.ts');
const main = read('src/main.ts');

test('제목 줄에 툴바 접기 단추가 있다', () => {
  const at = html.indexOf('id="tbar-toolbar-toggle"');
  assert.ok(at > 0, '접기 단추가 index.html 에 없다');

  // 제목 줄 안에 있어야 한다 — 툴바 안에 두면 접는 순간 같이 사라진다.
  const titleBarAt = html.indexOf('<div id="title-bar">');
  const iconToolbarAt = html.indexOf('<div id="icon-toolbar">');
  assert.ok(titleBarAt > 0 && iconToolbarAt > titleBarAt);
  assert.ok(
    at > titleBarAt && at < iconToolbarAt,
    '접기 단추가 제목 줄 밖에 있다 — 접으면 같이 사라진다',
  );

  const tag = html.slice(at - 200, at + 400);
  assert.match(tag, /data-cmd="view:toggle-toolbars"/);
  // 아이콘만 있는 단추라 이름이 없으면 화면 낭독기에 아무것도 들리지 않는다.
  assert.match(tag, /aria-label="툴바 감추기"/);
  assert.match(tag, /title="툴바 감추기 \(Ctrl\+F1\)"/);
});

test('Ctrl+F1 이 툴바 접기로 간다', () => {
  const e = {
    key: 'F1',
    code: 'F1',
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
  } as KeyboardEvent;
  assert.equal(matchShortcut(e, defaultShortcuts, 'windows'), 'view:toggle-toolbars');
});

test('맨 F1 은 툴바를 건드리지 않는다', () => {
  // 브라우저 도움말 키다. 수식어 없이 가로채면 남의 키를 뺏는 셈이 된다.
  const e = {
    key: 'F1',
    code: 'F1',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
  } as KeyboardEvent;
  assert.equal(matchShortcut(e, defaultShortcuts, 'windows'), null);
});

test('접힘을 설정에 저장한다', () => {
  // 저장하지 않으면 새로고침마다 다시 접어야 해서 접는 기능 자체가 쓸모없어진다.
  assert.match(settings, /showBasicToolbar: boolean;/);
  assert.match(settings, /showFormatToolbar: boolean;/);
  assert.match(settings, /setToolbarVisibility\(basic: boolean, format: boolean\): void/);
  // 처음 오는 사람에게는 둘 다 보인다.
  assert.match(settings, /showBasicToolbar: true,/);
  assert.match(settings, /showFormatToolbar: true,/);
  // 예전 설정 파일에 없는 값이므로 기본값으로 메워야 한다.
  assert.match(settings, /showBasicToolbar: normalizeBoolean\(/);
  assert.match(settings, /showFormatToolbar: normalizeBoolean\(/);
});

test('시작할 때 저장해 둔 상태를 되살린다', () => {
  assert.match(main, /applyToolbarVisibility\(\);/);
  assert.match(main, /#tbar-toolbar-toggle\[data-cmd\]/);
});

test('메뉴와 단추가 같은 상태를 본다', () => {
  // 예전에는 명령 안의 클로저 변수가 상태를 들고 있어, 단추로 접은 것을 메뉴가 몰랐다.
  assert.ok(
    !/let visible: boolean \| null = null;/.test(viewCommands),
    '도구 상자 켜짐 상태가 아직 커맨드 안에 남아 있다',
  );
  assert.match(viewCommands, /toggleToolbar\('basic'\)/);
  assert.match(viewCommands, /toggleToolbar\('format'\)/);
  assert.match(viewCommands, /id: 'view:toggle-toolbars'/);
  assert.match(viewCommands, /toggleAllToolbars\(\)/);
});

test('하나만 보이는 상태에서는 접는 쪽으로 간다', () => {
  // 접으려고 눌렀는데 더 펴지면 단추가 고장 난 것으로 읽힌다.
  assert.match(visibility, /const next = !anyToolbarVisible\(\);/);
  assert.match(
    visibility,
    /return isToolbarVisible\('basic'\) \|\| isToolbarVisible\('format'\);/,
  );
});

test('접힌 동안 단추의 이름과 방향이 바뀐다', () => {
  // 화살표가 한 방향으로 굳어 있으면 지금 접힌 것인지 펴진 것인지 알 수 없다.
  assert.match(visibility, /is-collapsed/);
  assert.match(visibility, /shown \? '툴바 감추기' : '툴바 보이기'/);
  const css = read('src/styles/title-bar.css');
  assert.match(css, /\.tbar-toolbar-toggle\.is-collapsed \.tbar-toolbar-toggle-up \{/);
  assert.match(css, /\.tbar-toolbar-toggle\.is-collapsed \.tbar-toolbar-toggle-down \{/);
});

test('그림만 보고 무엇을 접는지 알 수 있다', () => {
  /*
   * 화살표 하나만 두면 "맨 위로" 로 읽힌다. 창 테두리와 그 안의 툴바 줄이 함께 있어야
   * 접는 대상이 그림에 남는다.
   */
  const at = html.indexOf('id="tbar-toolbar-toggle"');
  const svg = html.slice(at, html.indexOf('</button>', at));
  assert.match(svg, /<rect x="3" y="4" width="18" height="16"/, '창 테두리가 없다');
  assert.match(svg, /<path d="M3 9\.5h18"\/>/, '툴바 줄이 없다');
  // 위·아래 화살표를 둘 다 넣어 두고 CSS 가 하나만 보인다. 그림째 뒤집으면
  // 툴바 줄이 창 아래로 내려가 다른 물건이 된다.
  assert.match(svg, /class="tbar-toolbar-toggle-up"/);
  assert.match(svg, /class="tbar-toolbar-toggle-down"/);
});
