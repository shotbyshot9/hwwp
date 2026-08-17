import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  describeSaveState,
  explainSaveState,
  type SaveState,
} from '../src/storage/storage-backend.ts';

/**
 * 이 표시를 고친 이유: 로컬에서 연 문서가 "변경됨" 이라고만 떠서, 사용자가 저장된
 * 줄 알고 창을 닫는 일이 생길 수 있었다. 상태 보고가 아니라 할 일을 적어야 한다.
 */
test('자동 저장할 곳이 없으면 할 일을 알려 준다', () => {
  const text = describeSaveState({ kind: 'unsaved' });
  assert.match(text, /Ctrl\+S/);
  // "변경됨" 은 곧 저장될 것처럼 읽힌다 — 이 상태에서는 쓰면 안 된다.
  assert.doesNotMatch(text, /변경됨/);
});

test('저장할 곳이 없는 것과 연결이 끊긴 것은 다른 말을 한다', () => {
  const unsaved = describeSaveState({ kind: 'unsaved' });
  const offline = describeSaveState({ kind: 'offline' });
  assert.notEqual(unsaved, offline);
  // 드라이브를 한 번도 연결하지 않은 사람에게 "오프라인" 은 거짓말이다.
  assert.doesNotMatch(unsaved, /오프라인/);
  // 반대로 연결이 끊긴 것은 기다리면 되는 일이라 직접 저장하라고 하지 않는다.
  assert.doesNotMatch(offline, /Ctrl\+S/);
});

test('드라이브 저장과 로컬 저장을 구분해 보여 준다', () => {
  const at = 1;
  assert.match(describeSaveState({ kind: 'saved', at, where: 'drive' }), /드라이브/);
  assert.doesNotMatch(describeSaveState({ kind: 'saved', at, where: 'local' }), /드라이브/);
});

test('모든 상태에 툴팁 설명이 있다 (idle 만 예외)', () => {
  const states: SaveState[] = [
    { kind: 'idle' },
    { kind: 'dirty' },
    { kind: 'saving' },
    { kind: 'saved', at: 1, where: 'drive' },
    { kind: 'saved', at: 1, where: 'local' },
    { kind: 'unsaved' },
    { kind: 'offline' },
    { kind: 'error', message: '권한 없음' },
  ];
  for (const s of states) {
    const text = explainSaveState(s);
    if (s.kind === 'idle') assert.equal(text, '');
    else assert.ok(text.length > 0, `${s.kind} 설명 없음`);
  }
});

test('저장할 곳이 없다는 설명은 복구본이 있다는 사실까지 알려 준다', () => {
  // 이게 없으면 "자동 저장 안 됨" 이 실제보다 무섭게 읽힌다 — 복구본은 늘 쌓인다.
  assert.match(explainSaveState({ kind: 'unsaved' }), /복구본/);
});

/**
 * 로컬에서 연 문서가 드라이브에 처음 올라가는 순간을 알리는 배선.
 * 끊어지면 사용자는 자기 글이 어디로 갔는지 모른 채, 나중에 디스크의 원본을 열고
 * "고친 게 없다" 고 놀라게 된다.
 */
test('저장소에 처음 만들 때만 onCreated 가 불린다', () => {
  const source = readFileSync(new URL('../src/storage/autosave-controller.ts', import.meta.url), 'utf8');
  assert.match(source, /const creating = this\.ref === null;/);
  assert.match(source, /if \(creating\) this\.deps\.onCreated\?\.\(outcome\.ref\);/);
});

test('알림은 로컬에서 연 문서에만 뜬다', () => {
  const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(source, /onCreated: \(ref\) => \{[\s\S]{0,120}if \(docOrigin !== 'local'\) return;/);
  // 원본이 그대로라는 것을 반드시 말해야 한다 — 그게 이 알림의 핵심이다.
  assert.match(source, /원본 파일은 그대로 둡니다/);
  // 드라이브에서 연 문서는 애초에 새로 만들어지지 않으므로 알릴 일이 없다.
  assert.match(source, /docOrigin = 'drive';/);
});
