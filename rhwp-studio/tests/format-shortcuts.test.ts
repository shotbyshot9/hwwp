import test from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';

import { defaultShortcuts, matchShortcut } from '../src/command/shortcut-map.ts';

/*
 * 커맨드 정의는 `@/ui` 별칭을 타고 들어가 node --test 로는 못 불러온다. 그래서 표시
 * 문구는 소스에서 읽는다. 개행은 맞춰 둔다 — 작업 사본이 CRLF 가 되면 글자 그대로 찾는
 * 검사가 어긋난다.
 */
function commandSource(file: string): string {
  return readFileSync(new URL(`../src/command/commands/${file}`, import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n');
}

/** `id: '<커맨드>'` 바로 뒤에 붙은 `shortcutLabel` 을 읽는다. */
function shortcutLabelOf(source: string, id: string): string | null {
  const at = source.indexOf(`id: '${id}',`);
  if (at < 0) return null;
  const window = source.slice(at, at + 400);
  const end = window.indexOf("id: '", 5);
  const scoped = end > 0 ? window.slice(0, end) : window;
  return scoped.match(/shortcutLabel: '([^']+)'/)?.[1] ?? null;
}

type Mods = { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean };

function press(key: string, code: string, mods: Mods = {}): KeyboardEvent {
  return {
    key,
    code,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...mods,
  } as unknown as KeyboardEvent;
}

/**
 * Ctrl+B / I / U 는 자판이 한글일 때도 들어야 한다.
 *
 * 예전에는 글자(`e.key`)로만 맞췄다. 한글 자판에서 Ctrl+B 는 'ㅠ' 로 오므로 셋 다 아무
 * 일도 하지 않았다 — 정작 글을 쓰는 도중, 그러니까 쓸 일이 있는 유일한 상황에서 안 들었다.
 *
 * 그래서 물리 키 코드로도 맞춘다. 자모를 하나씩 적어 두는 것보다 낫다: 자판 배열이
 * 무엇이든 KeyB 는 KeyB 다.
 */
test('진하게·기울임·밑줄은 자판이 한글이어도 듣는다', () => {
  const cases: Array<[string, string, string]> = [
    ['b', 'ㅠ', 'format:bold'],
    ['i', 'ㅑ', 'format:italic'],
    ['u', 'ㅕ', 'format:underline'],
  ];
  for (const [latin, jamo, id] of cases) {
    const code = `Key${latin.toUpperCase()}`;
    assert.equal(matchShortcut(press(latin, code, { ctrlKey: true }), defaultShortcuts), id);
    assert.equal(
      matchShortcut(press(jamo, code, { ctrlKey: true }), defaultShortcuts),
      id,
      `한글 자판에서 Ctrl+${latin.toUpperCase()} 가 듣지 않는다`,
    );
  }
});

test('그냥 b·i·u 를 치는 것은 서식이 아니다', () => {
  // 물리 키로도 맞추게 됐으니, 수식어 없는 타이핑이 서식으로 새지 않는지 확인한다.
  for (const [latin, jamo] of [['b', 'ㅠ'], ['i', 'ㅑ'], ['u', 'ㅕ']]) {
    const code = `Key${latin.toUpperCase()}`;
    assert.equal(matchShortcut(press(latin, code), defaultShortcuts), null);
    assert.equal(matchShortcut(press(jamo, code), defaultShortcuts), null);
  }
});

test('새로 붙인 단축키가 제 커맨드를 부른다', () => {
  const cases: Array<[KeyboardEvent, string]> = [
    [press('x', 'KeyX', { ctrlKey: true, shiftKey: true }), 'format:strikethrough'],
    [press('p', 'KeyP', { altKey: true, shiftKey: true }), 'format:superscript'],
    [press('ㅔ', 'KeyP', { altKey: true, shiftKey: true }), 'format:superscript'],
    [press('b', 'KeyB', { altKey: true, shiftKey: true }), 'format:subscript'],
    [press('ㅠ', 'KeyB', { altKey: true, shiftKey: true }), 'format:subscript'],
    [press('f', 'KeyF', { ctrlKey: true, altKey: true }), 'insert:footnote'],
  ];
  for (const [event, id] of cases) {
    assert.equal(matchShortcut(event, defaultShortcuts), id, `${event.code} → ${id} 가 아니다`);
  }
});

/**
 * 새 단축키가 이미 쓰던 것을 빼앗지 않았는지 본다.
 *
 * 특히 Ctrl+Alt+F(각주)는 Alt+Shift+F(배명훈 모드) 와 Ctrl+F(찾기) 사이에 끼어 있고,
 * Alt+Shift+B(아래 첨자) 는 Ctrl+B 와 물리 키가 같다.
 */
test('새 단축키가 기존 단축키를 빼앗지 않는다', () => {
  const untouched: Array<[KeyboardEvent, string]> = [
    [press('f', 'KeyF', { ctrlKey: true }), 'edit:find'],
    [press('f', 'KeyF', { altKey: true, shiftKey: true }), 'focus:toggle'],
    [press('b', 'KeyB', { ctrlKey: true }), 'format:bold'],
    [press('p', 'KeyP', { ctrlKey: true }), 'file:print'],
    [press('x', 'KeyX', { ctrlKey: true }), null as unknown as string],
  ];
  for (const [event, id] of untouched) {
    assert.equal(matchShortcut(event, defaultShortcuts), id);
  }
});

/**
 * 메뉴에 적힌 키와 실제로 듣는 키가 같아야 한다. 다르면 안내가 거짓말이 된다.
 */
test('메뉴 표시와 실제 단축키가 어긋나지 않는다', () => {
  const format = commandSource('format.ts');
  const insert = commandSource('insert.ts');
  const expected: Array<[string, string, string, KeyboardEvent]> = [
    ['format:strikethrough', format, 'Ctrl+Shift+X', press('x', 'KeyX', { ctrlKey: true, shiftKey: true })],
    ['format:superscript', format, 'Alt+Shift+P', press('p', 'KeyP', { altKey: true, shiftKey: true })],
    ['format:subscript', format, 'Alt+Shift+B', press('b', 'KeyB', { altKey: true, shiftKey: true })],
    ['insert:footnote', insert, 'Ctrl+Alt+F', press('f', 'KeyF', { ctrlKey: true, altKey: true })],
    ['format:bold', format, 'Ctrl+B', press('b', 'KeyB', { ctrlKey: true })],
  ];
  for (const [id, source, label, event] of expected) {
    assert.equal(shortcutLabelOf(source, id), label, `${id} 의 표시가 다르다`);
    assert.equal(matchShortcut(event, defaultShortcuts), id, `${label} 이 ${id} 를 부르지 않는다`);
  }
});

/**
 * 사용법 안내도 같은 키를 말해야 한다. 여기가 어긋나면 처음 쓰는 사람이 안 듣는 키를
 * 배운다 — 안내가 틀리면 없느니만 못하다.
 */
test('사용법 안내가 실제 단축키와 같다', () => {
  const guide = readFileSync(new URL('../src/core/usage-guide.ts', import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n');
  for (const line of ['Ctrl+Shift+X', 'Alt+Shift+P / B', 'Ctrl+Alt+F']) {
    assert.ok(guide.includes(`'${line}'`), `사용법에 ${line} 이 없다`);
  }
});
