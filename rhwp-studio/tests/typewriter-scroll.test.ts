import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * 타자기 스크롤이 사용자의 스크롤을 빼앗지 않는지 고정한다.
 *
 * focus-mode.ts 는 DOM 에 기대므로 그대로 불러올 수 없다. 판단식은 같은 규칙을
 * 여기 옮겨 검증하고, 실제 코드가 그 헬퍼를 쓰는지는 소스로 확인한다.
 */

const FOLLOW_MS = 1500;

function shouldFollowCaret(
  caretDocY: number,
  lastCaretDocY: number | null,
  now: number,
  followUntil: number,
): boolean {
  if (lastCaretDocY === null) return true;
  if (Math.abs(caretDocY - lastCaretDocY) > 1) return true;
  return now < followUntil;
}

test('첫 점검에서는 캐럿 자리를 한 번 잡는다', () => {
  assert.equal(shouldFollowCaret(500, null, 1000, 0), true);
});

test('캐럿이 그대로면 사용자의 스크롤을 건드리지 않는다', () => {
  // 읽으려고 스크롤한 상황 — 캐럿의 문서 내 높이는 스크롤과 무관하므로 그대로다.
  const now = 100_000;
  assert.equal(shouldFollowCaret(500, 500, now, now - 1), false);
  // 렌더 오차 수준의 미세 변화도 "안 움직였다" 로 본다.
  assert.equal(shouldFollowCaret(500.4, 500, now, now - 1), false);
});

test('캐럿이 옮겨가면 따라간다', () => {
  const now = 100_000;
  // 줄이 바뀌었다 — 쓰는 중이므로 시선을 붙잡는다.
  assert.equal(shouldFollowCaret(530, 500, now, now - 1), true);
  assert.equal(shouldFollowCaret(470, 500, now, now - 1), true);
});

test('같은 줄에서 타이핑 중이면 위치가 안 변해도 따라간다', () => {
  const now = 100_000;
  // 한 줄 안에서 글자를 이어 치면 caretDocY 가 그대로다 — 시간 창으로 판별한다.
  assert.equal(shouldFollowCaret(500, 500, now, now + FOLLOW_MS), true);
});

test('쓰기를 멈추고 시간이 지나면 스크롤을 사용자에게 돌려준다', () => {
  const typedAt = 100_000;
  const followUntil = typedAt + FOLLOW_MS;
  // 창 안 — 아직 따라간다
  assert.equal(shouldFollowCaret(500, 500, typedAt + 1000, followUntil), true);
  // 창 밖 — 이제 읽는 중이다
  assert.equal(shouldFollowCaret(500, 500, typedAt + FOLLOW_MS + 1, followUntil), false);
});

test('focus-mode 가 이 판단식을 실제로 쓰고, 화면 밖 조건을 쓰지 않는다', () => {
  const source = readFileSync(new URL('../src/focus/focus-mode.ts', import.meta.url), 'utf8');
  assert.match(source, /shouldFollowCaret\(/);
  // "화면 밖이면 되돌린다" 를 되살리면 스크롤로 멀어지는 순간 항상 걸려
  // 읽으려는 스크롤을 그대로 되돌린다 — 이 회귀를 막는다.
  assert.doesNotMatch(source, /offScreen/);
});
