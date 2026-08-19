import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const inputHandler = readFileSync(
  new URL('../src/engine/input-handler.ts', import.meta.url),
  'utf8',
);
const formatCmd = readFileSync(
  new URL('../src/command/commands/format.ts', import.meta.url),
  'utf8',
);
const keyboard = readFileSync(
  new URL('../src/engine/input-handler-keyboard.ts', import.meta.url),
  'utf8',
);
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

/**
 * 수준 단추는 문단번호·글머리표 단추 바로 옆에 있는데 목록에는 듣지 않았다. 개요
 * 스타일만 알아서, 옆 단추로 만든 목록에서 누르면 "개요 스타일이 아닙니다" 라는 안내만
 * 떴다. 반대로 목록 수준을 바꾸는 길은 Tab·Shift+Tab 뿐이라 단추가 아예 없었다.
 */
test('수준 단추는 목록과 개요를 함께 다룬다', () => {
  assert.match(inputHandler, /changeParagraphLevel\(delta: number\): OutlineLevelResult \{/);
  // 목록을 먼저 본다. 목록이 아니면 changeListLevel 이 false 를 돌려주므로 개요로 넘어간다.
  const method = inputHandler.slice(
    inputHandler.indexOf('changeParagraphLevel(delta: number)'),
    inputHandler.indexOf('changeOutlineLevel(delta: number)'),
  );
  assert.match(method, /if \(this\.changeListLevel\(delta\)\) return 'changed';/);
  assert.match(method, /return this\.changeOutlineLevel\(delta\);/);
});

test('두 명령이 모두 갈라주는 쪽을 부른다', () => {
  assert.match(formatCmd, /changeParagraphLevel\(-1\), '증가'/);
  assert.match(formatCmd, /changeParagraphLevel\(1\), '감소'/);
  // 개요만 부르면 목록에서 다시 먹통이 된다.
  assert.doesNotMatch(formatCmd, /getInputHandler\(\)\?\.changeOutlineLevel\(/);
});

test('상위·하위 방향이 단추와 Tab 에서 같다', () => {
  // -1 이 상위다. Shift+Tab 도 -1 을 쓴다 — 두 길이 어긋나면 같은 일을 하는 두 조작이
  // 반대로 움직인다.
  assert.match(formatCmd, /id: 'format:level-increase'/);
  assert.match(formatCmd, /changeParagraphLevel\(-1\)/);
  assert.match(keyboard, /if \(this\.changeListLevel\(-1\)\) break;/);
  assert.match(keyboard, /this\.changeListLevel\(1\)/);
});

test('단추 이름이 화면에서 벌어지는 일과 맞는다', () => {
  // "증가" 가 숫자로는 감소다(개요 2 → 개요 1). 단추에는 상위·하위로 적는다.
  assert.match(indexHtml, /id="tb-level-up"[^>]*>[\s\S]*?상위<br\/>수준/);
  assert.match(indexHtml, /id="tb-level-down"[^>]*>[\s\S]*?하위<br\/>수준/);
  // 메뉴와 툴팁은 HWP 용어를 유지한다.
  assert.match(indexHtml, /data-cmd="format:level-increase"[^>]*>[\s\S]*?한 수준 증가/);
  assert.match(indexHtml, /title="한 수준 증가 — 목록·개요를 상위 수준으로 \(Shift\+Tab\)"/);
  assert.match(indexHtml, /title="한 수준 감소 — 목록·개요를 하위 수준으로 \(Tab\)"/);
});

test('바꿀 수준이 없을 때 안내가 두 길을 모두 알려준다', () => {
  assert.match(formatCmd, /이 문단에는 바꿀 수준이 없습니다/);
  assert.match(formatCmd, /문단 번호나 글머리표를 넣거나/);
  assert.doesNotMatch(formatCmd, /이 문단은 개요 스타일이 아니라/);
});
