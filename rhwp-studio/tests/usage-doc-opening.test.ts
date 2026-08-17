import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

/**
 * 「도구 → 사용법 문서 열기」가 쓰던 문서를 밀어내던 문제.
 *
 * 저장은 돼 있으니 글이 사라지지는 않지만 쓰던 자리와 스크롤을 잃는다. 드라이브에
 * 자동 저장된 뒤라면 "저장하지 않은 변경" 이 없어서 경고조차 뜨지 않고 화면이 그냥
 * 바뀐다 — 사용자가 가장 당황하는 종류의 동작이다.
 */
test('문서가 열려 있으면 사용법은 새 탭에서 연다', () => {
  assert.match(main, /if \(wasm\.pageCount > 0 && wasm\.fileName !== WELCOME_DOC_NAME\)/);
  assert.match(main, /window\.open\(url, '_blank', 'noopener'\)/);
});

test('사용법 문서를 보는 중이면 새 탭을 또 열지 않는다', () => {
  // 조건에 fileName 비교가 있어야 한다 — 없으면 사용법에서 사용법을 열 때마다 탭이 는다.
  assert.match(main, /wasm\.fileName !== WELCOME_DOC_NAME/);
});

test('새 탭이 막히면 이 탭에서 열되 그 사실을 알린다', () => {
  assert.match(main, /const opened = window\.open\([\s\S]{0,60}\n\s*if \(opened\) return;/);
  assert.match(main, /새 탭이 브라우저에 막혔습니다/);
  // 막혔을 때도 저장하지 않은 변경 확인은 거친다.
  assert.match(main, /if \(!await canReplaceCurrentDocument\(\)\) return;/);
});

test('문서가 없으면 새 탭 없이 이 탭에서 연다', () => {
  // 빈 화면에서 새 탭을 여는 것은 쓸데없다 — pageCount 조건이 그것을 막는다.
  assert.match(main, /wasm\.pageCount > 0 &&/);
});

test('새 탭은 시작 문서 대신 사용법을 연다', () => {
  assert.match(main, /function wantsUsageDoc\(\)/);
  assert.match(main, /if \(wantsUsageDoc\(\)\) \{\s*\n\s*await openWelcomeDocument\(\);/);
});

test('사용법을 연 뒤에는 주소에서 표를 지운다', () => {
  // 이 탭에서 이어 쓰다가 새로고침했을 때 사용법이 다시 열리면
  // 방금 없앤 그 놀람이 되살아난다.
  assert.match(main, /url\.searchParams\.delete\(USAGE_DOC_PARAM\)/);
  assert.match(main, /window\.history\.replaceState/);
});
