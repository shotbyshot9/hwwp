import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultShortcuts, matchShortcut } from '../src/command/shortcut-map.ts';

const keys = readFileSync(new URL('../src/engine/input-handler-keyboard.ts', import.meta.url), 'utf8');

/** 브라우저 없이 keydown 을 흉내 낸다 */
function ev(init: Partial<KeyboardEvent> & { key: string }): KeyboardEvent {
  return {
    key: init.key,
    code: init.code ?? '',
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    shiftKey: init.shiftKey ?? false,
    altKey: init.altKey ?? false,
  } as KeyboardEvent;
}

/**
 * 본문에 p 를 쓸 수 없던 버그.
 *
 * 단축키 표에 수식어 없는 `p`(개체 속성)가 있는데, 키 처리기가 실행 가능 여부를 보기
 * 전에 preventDefault 를 먼저 했다. 개체를 고르지 않은 상태에서는 개체 속성이 열리지도
 * 않으면서 글자도 찍히지 않았다. 대문자 P 는 shift 때문에 표에 안 걸려 멀쩡했고,
 * 그래서 원인이 더 감춰졌다.
 */
test('수식어 없는 단축키는 실행 가능할 때만 키를 가로챈다', () => {
  const start = keys.indexOf('    default: {');
  const branch = keys.slice(start, start + 1400);
  assert.match(branch, /if \(cmdId && this\.dispatcher\.isEnabled\(cmdId\)\) \{\s*\n\s*e\.preventDefault\(\);/);
  // dispatch 의 반환값으로 판단하면 커맨드가 예외로 죽었을 때 그 글자가 본문에 샌다.
  assert.doesNotMatch(branch, /if \(this\.dispatcher\.dispatch\(cmdId\)\)/);
});

test('수식어 없는 단축키 목록을 못박는다', () => {
  const bare = defaultShortcuts.filter(([d]) => !d.ctrl && !d.alt && !d.shift);
  const names = bare.map(([d]) => d.key).sort();
  // 여기에 인쇄 가능한 글자가 늘어나면 그 글자를 본문에 못 쓰게 될 위험이 생긴다.
  assert.deepEqual(names, ['f6', 'f7', 'p', 'ㅔ']);
});

test('p 는 shift 없이만 표에 걸린다 — 대문자가 멀쩡했던 이유', () => {
  assert.equal(matchShortcut(ev({ key: 'p', code: 'KeyP' }), defaultShortcuts), 'format:object-properties');
  assert.equal(matchShortcut(ev({ key: 'P', code: 'KeyP', shiftKey: true }), defaultShortcuts), null);
});

/**
 * code 로도 매칭하므로 한글 자판의 같은 물리 키까지 걸린다. 제보는 'p' 뿐이었지만
 * 실제로는 물리 P 키가 한글 입력에서도 죽어 있었다.
 */
test('code 매칭 때문에 물리 P 키가 자판과 무관하게 걸린다', () => {
  for (const k of ['ㅔ', 'ㅁ', 'ㅊ', 'ㅍ']) {
    assert.equal(
      matchShortcut(ev({ key: k, code: 'KeyP' }), defaultShortcuts),
      'format:object-properties',
      `${k} 가 물리 P 키에서 표에 걸리지 않는다`,
    );
  }
});

test('평범한 글자는 표에 걸리지 않는다', () => {
  for (const k of 'abcdefghijklmnoqrstuvwxyz'.split('')) {
    assert.equal(matchShortcut(ev({ key: k, code: 'Key' + k.toUpperCase() }), defaultShortcuts), null, `${k} 가 걸린다`);
  }
});
