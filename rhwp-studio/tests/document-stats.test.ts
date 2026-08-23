import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { countDocument, type DocumentStatsSource } from '../src/core/document-stats.ts';

/** 문단 목록을 엔진처럼 보이게 감싼다. */
function fakeDoc(sections: string[][]): DocumentStatsSource {
  return {
    getSectionCount: () => sections.length,
    getParagraphCount: (sec) => sections[sec].length,
    getParagraphLength: (sec, para) => sections[sec][para].length,
    getTextRange: (sec, para, start, end) => sections[sec][para].slice(start, end),
  };
}

test('빈 문서는 0 이다', () => {
  assert.deepEqual(countDocument(fakeDoc([[]])), { words: 0, chars: 0 });
  assert.deepEqual(countDocument(fakeDoc([['']])), { words: 0, chars: 0 });
});

test('글자수는 공백을 포함하고 단어는 공백으로 가른다', () => {
  const stats = countDocument(fakeDoc([['소설을 쓰는 사람']]));
  assert.equal(stats.chars, 9);
  assert.equal(stats.words, 3);
});

test('빈 줄은 단어를 늘리지 않는다', () => {
  // 문단 사이를 빈 줄로 띄우는 원고에서 단어수가 부풀지 않아야 한다.
  const stats = countDocument(fakeDoc([['첫 문단', '   ', '', '끝 문단']]));
  assert.equal(stats.words, 4);
});

test('구역이 여럿이면 모두 더한다', () => {
  const stats = countDocument(fakeDoc([['가나 다라'], ['마바']]));
  assert.equal(stats.words, 3);
  assert.equal(stats.chars, 7);
});

/**
 * 두 화면이 같은 숫자를 말해야 한다.
 *
 * 배명훈 모드 바닥글과 일반 편집 화면의 상태 표시줄은 같은 문서를 센다. 셈을 두 군데
 * 두면 언젠가 갈려서, 모드를 바꿀 때마다 분량이 달라 보인다.
 */
test('배명훈 모드와 상태 표시줄이 같은 셈을 쓴다', () => {
  const focus = readFileSync(new URL('../src/command/commands/focus.ts', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(focus, /countDocument\(services\.wasm\)/);
  assert.match(main, /countDocument\(wasm\)/);
  // 예전 셈이 남아 있으면 갈린다.
  assert.doesNotMatch(focus, /getParagraphLength/);
});

/**
 * 문서를 통째로 훑는 셈이라 글자마다 부르면 긴 원고에서 걸린다.
 * 뜸을 들이는 장치가 사라지면 타이핑이 무거워진다 — 눈으로는 "왠지 느리다" 로만 보인다.
 */
test('상태 표시줄 집계는 뜸을 들인다', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n');
  assert.match(main, /const COUNT_DEBOUNCE_MS = \d+;/);
  assert.match(main, /function scheduleDocumentCount\(\): void \{[\s\S]*?setTimeout\(/);
  // 고칠 때마다 부르는 것은 예약 쪽이어야 한다.
  assert.match(main, /'document-mutated'[\s\S]{0,200}?scheduleDocumentCount\(\)/);
  assert.match(main, /'document-changed'[\s\S]{0,200}?scheduleDocumentCount\(\)/);
  // 문서를 연 직후에는 기다리지 않고 바로 센다.
  assert.match(main, /renderDocumentCount\(\);/);
});

test('상태 표시줄에 분량 자리가 있다', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="sb-count"/);
  const responsive = readFileSync(
    new URL('../src/styles/responsive.css', import.meta.url),
    'utf8',
  );
  // 좁은 화면에서는 접는다 — 줌 단추를 밀어내면 손해가 더 크다.
  assert.match(responsive, /#sb-count \{ display: none; \}/);
});
