import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const engine = readFileSync(new URL('../src/engine/input-handler.ts', import.meta.url), 'utf8');
const keys = readFileSync(new URL('../src/engine/input-handler-keyboard.ts', import.meta.url), 'utf8');

/** Tab 분기만 떼어 본다 */
function tabBranch(): string {
  const start = keys.indexOf("case 'Tab': {");
  const end = keys.indexOf("case 'Insert': {", start);
  assert.ok(start > 0 && end > start);
  return keys.slice(start, end);
}

/** Enter 분기만 떼어 본다 */
function enterBranch(): string {
  const start = keys.indexOf("case 'Enter': {");
  const end = keys.indexOf("case 'ArrowLeft':", start);
  assert.ok(start > 0 && end > start);
  return keys.slice(start, end);
}

/**
 * Tab 으로 하위 수준으로 내려가는 것은 워드프로세서의 기본 문법인데 없었다.
 * Tab 이 언제나 탭 문자를 넣어서, 목록 안에서 눌러도 수준이 바뀌지 않았다.
 */
test('목록 문단의 맨 앞에서 Tab 은 수준을 내린다', () => {
  const tab = tabBranch();
  assert.match(tab, /charOffset === 0 && this\.changeListLevel\(1\)/);
  // 순서가 중요하다 — 탭 문자 삽입보다 앞에 있어야 한다.
  assert.ok(
    tab.indexOf('changeListLevel(1)') < tab.indexOf('InsertTabCommand'),
    '수준 변경이 탭 문자 삽입보다 뒤에 있으면 영원히 닿지 않는다',
  );
});

test('글 중간에서 누른 Tab 은 그대로 탭 문자다', () => {
  // charOffset 조건이 없으면 목록 안에서는 탭 문자를 아예 넣을 수 없게 된다.
  assert.match(tabBranch(), /charOffset === 0/);
});

test('Shift+Tab 은 목록에서 상위 수준으로, 목록이 아니면 내어쓰기', () => {
  const tab = tabBranch();
  assert.match(tab, /if \(this\.changeListLevel\(-1\)\) break;\s*\n\s*this\.applyHangingIndentAtCursor\(\)/);
});

/**
 * "번호를 그만 매기려면 빈 줄에서 Enter 를 한 번 더" 는 어느 워드프로세서에나 있는
 * 문법인데 없었다 — 빈 항목에서 Enter 를 쳐도 번호만 붙은 빈 줄이 계속 늘었다.
 */
test('빈 목록 항목에서 Enter 는 문단을 나누지 않고 목록을 끝낸다', () => {
  const enter = enterBranch();
  assert.match(enter, /\} else if \(this\.endListIfEmpty\(\)\) \{/);
  assert.ok(
    enter.indexOf('endListIfEmpty') < enter.indexOf('SplitParagraphCommand'),
    '목록 종료가 문단 나누기보다 뒤에 있으면 영원히 닿지 않는다',
  );
});

test('수준은 1~7 을 넘지 않는다', () => {
  assert.match(engine, /if \(next < 0 \|\| next > 6\) return true;/);
  // 끝에 닿았을 때 false 를 돌려주면 Tab 이 갑자기 탭 문자를 넣기 시작한다.
  assert.match(engine, /끝에 닿으면 탭 문자를 넣지 않고/);
});

test('하위 수준에서는 한 번에 하나씩 빠져나온다', () => {
  // 3수준에서 곧바로 목록을 벗어나면 중간 단계를 건너뛰는 셈이다.
  assert.match(engine, /if \(level > 0\) \{[\s\S]{0,200}paraLevel: level - 1/);
});

test('표 안에서는 두 동작 모두 비켜선다', () => {
  // 셀 문단은 좌표가 따로이고 Tab 이 이미 다음 셀 이동이라는 뜻을 갖는다.
  const both = engine.match(/(changeListLevel|endListIfEmpty)\(([^)]*)\): boolean \{\s*\n\s*if \(this\.cursor\.isInCell\(\)\) return false;/g) ?? [];
  assert.equal(both.length, 2, '두 메서드 모두 셀에서 먼저 빠져나와야 한다');
});

test('목록이 아니면 false 를 돌려 원래 동작에 맡긴다', () => {
  const guards = engine.match(/if \(!props\.headType \|\| props\.headType === 'None'\) return false;/g) ?? [];
  assert.equal(guards.length, 2);
});
