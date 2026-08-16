import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolvePageScreenLeft } from '../src/view/ruler-geometry.ts';

/**
 * 눈금자가 실제 편집 용지와 같은 자리를 가리키는지 고정한다.
 *
 * 아래 두 표본은 브라우저에서 실측한 값이다 (1280px 창, A4 용지).
 * 캔버스 실측 위치 = `canvas.getBoundingClientRect().left - hRuler.left`.
 */

test('콘텐츠가 컨테이너보다 좁으면 margin:0 auto 가운데 정렬만큼 밀린다', () => {
  // 100% 배율 실측: 컨테이너 1245, 콘텐츠 834, 용지 794, scrollLeft 0 → 실제 용지 왼쪽 226px
  const pageLeftInContent = (834 - 794) / 2; // 20
  const actual = resolvePageScreenLeft(pageLeftInContent, 1245, 834, 0);
  assert.ok(
    Math.abs(actual - 225.5) < 0.5,
    `가운데 정렬 보정이 빠졌다: ${actual} (실측 226 근처여야 한다)`,
  );
});

test('보정을 빼먹으면 실제 용지와 5cm 넘게 어긋난다 (회귀 방지)', () => {
  // 보정 없이 계산하면 20px 이 나왔다 — 실측 226px 과 206px 차이.
  const withoutCentering = (834 - 794) / 2 - 0;
  const withCentering = resolvePageScreenLeft((834 - 794) / 2, 1245, 834, 0);
  assert.ok(
    withCentering - withoutCentering > 200,
    '가운데 정렬 보정량이 사라졌다',
  );
});

test('콘텐츠가 컨테이너보다 넓으면 정렬이 없고 scrollX 만 반영한다', () => {
  // 200% 배율 실측: 컨테이너 1245, 콘텐츠 2107, 용지 1588, scrollLeft 424 → 실제 용지 왼쪽 -164px
  const pageLeftInContent = (2107 - 1588) / 2; // 259.5
  const actual = resolvePageScreenLeft(pageLeftInContent, 1245, 2107, 424);
  assert.ok(
    Math.abs(actual - -164.5) < 0.5,
    `넓은 콘텐츠에서 어긋났다: ${actual} (실측 -164 근처여야 한다)`,
  );
});

test('가로 눈금자가 이 헬퍼를 실제로 쓴다', () => {
  const source = readFileSync(new URL('../src/view/ruler.ts', import.meta.url), 'utf8');
  assert.match(source, /resolvePageScreenLeft\(/);
  // 용지 범위를 용지 밖과 구분해 칠하는지 (본문만 칠하면 종이 경계가 안 보인다)
  assert.match(source, /bgOutside/);
  assert.match(source, /palette\.edge/);
});
