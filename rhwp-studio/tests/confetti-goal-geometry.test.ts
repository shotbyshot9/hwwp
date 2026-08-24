import test from 'node:test';
import assert from 'node:assert/strict';

import { ConfettiLayer } from '../src/focus/confetti.ts';

/**
 * 목표 달성 폭죽의 좌표를 실제로 계산해 본다.
 *
 * 브라우저 창을 띄워 눈으로 보는 것이 가장 좋지만, 개발 환경에서 창이 화면에 표시되지
 * 않으면 뷰포트가 0이라 폭죽이 한 점에 몰려 아무것도 확인할 수 없다. 그래서 캔버스를
 * 가짜로 끼워 넣고 입자 좌표와 속도를 직접 읽는다.
 *
 * 지키려는 것은 하나다 — **목표 달성 폭죽은 아래에서 위로 솟는 줄기가 있어야 한다.**
 * 그것이 좌우 대포만 쓰는 다른 축포와 구별되는 유일한 표시다. 이게 사라지면 화면은
 * 멀쩡히 나오되 목표 달성이 다시 평범한 축포로 되돌아간다.
 */

const W = 1200;
const H = 800;

interface Particle { x: number; y: number; vx: number; vy: number }

/** ConfettiLayer 가 쓰는 DOM 을 최소한으로 흉내 낸다. */
function withFakeDom<T>(run: () => T): T {
  const g = globalThis as Record<string, unknown>;
  const saved = {
    document: g.document, window: g.window,
    requestAnimationFrame: g.requestAnimationFrame,
    cancelAnimationFrame: g.cancelAnimationFrame,
  };

  const canvas = {
    className: '', width: 0, height: 0,
    style: {} as Record<string, string>,
    clientWidth: W, clientHeight: H,
    setAttribute() { /* 무시 */ },
    getContext: () => ({ setTransform() { /* 무시 */ }, clearRect() { /* 무시 */ } }),
    remove() { /* 무시 */ },
  };

  const fakeWindow = {
    innerWidth: W, innerHeight: H, devicePixelRatio: 1,
    addEventListener() { /* 무시 */ },
    removeEventListener() { /* 무시 */ },
    // 폭죽은 파동을 setTimeout 으로 흩뿌린다. 시험에서는 즉시 실행해 한 번에 모은다.
    setTimeout: (fn: () => void) => { fn(); return 0; },
  };

  g.document = { createElement: () => canvas, body: { appendChild() { /* 무시 */ } } };
  g.window = fakeWindow;
  // rAF 는 돌리지 않는다 — 입자를 만든 직후 상태만 보면 되고, 돌리면 중력이 섞인다.
  g.requestAnimationFrame = () => 0;
  g.cancelAnimationFrame = () => { /* 무시 */ };

  try {
    return run();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete g[key];
      else g[key] = value;
    }
  }
}

function particlesOf(layer: ConfettiLayer): Particle[] {
  return (layer as unknown as { particles: Particle[] }).particles;
}

test('목표 폭죽에는 아래에서 위로 솟는 줄기가 있다', () => {
  withFakeDom(() => {
    const layer = new ConfettiLayer();
    layer.fireGoalCelebration();
    const parts = particlesOf(layer);

    // 화면 바닥에서 출발해 위로 올라가는 입자 (캔버스 좌표는 아래가 +y 라 vy < 0 이 위)
    const rising = parts.filter(p => p.y >= H - 1 && p.vy < 0);
    assert.ok(rising.length >= 100, `아래에서 솟는 입자가 ${rising.length}개뿐이다`);

    // 두 줄기가 화면 좌우 1/4, 3/4 지점에서 올라온다.
    const xs = new Set(rising.map(p => Math.round(p.x)));
    assert.ok(xs.has(Math.round(W * 0.25)), '왼쪽 분수가 없다');
    assert.ok(xs.has(Math.round(W * 0.75)), '오른쪽 분수가 없다');
  });
});

test('장문 축포에는 그 줄기가 없다', () => {
  withFakeDom(() => {
    const layer = new ConfettiLayer();
    layer.fireCelebration();
    const rising = particlesOf(layer).filter(p => p.y >= H - 1 && p.vy < 0);
    assert.equal(rising.length, 0, '장문 축포에도 분수가 생기면 구별이 사라진다');
  });
});

test('목표 폭죽이 장문 축포보다 확실히 크다', () => {
  const count = (fire: (l: ConfettiLayer) => void) => withFakeDom(() => {
    const layer = new ConfettiLayer();
    fire(layer);
    return particlesOf(layer).length;
  });

  const longRun = count(l => l.fireCelebration());
  const goal = count(l => l.fireGoalCelebration());
  // "조금 더 큰" 정도로는 사람이 구별하지 못한다. 두 배 넘게 차이 나야 한다.
  assert.ok(goal > longRun * 2, `목표 ${goal}개 vs 장문 ${longRun}개 — 차이가 작다`);
});

/**
 * 배속을 MAX 로 두면 글자마다 폭죽이 터져 화면이 한순간도 비지 않는다. 그 상태에서는
 * 무엇을 더 뿌려도 배경과 섞여 묻힌다 — 실제로 "MAX 로 쓰면 화려해 보이지 않는다" 는
 * 지적이 여기서 나왔다.
 *
 * 그래서 목표 축포는 **먼저 화면을 비운다.** 계속 터지던 것이 갑자기 멎는 순간이
 * 이 효과에서 가장 크게 걸리는 부분이라, 이게 사라지면 다시 묻힌다.
 */
test('목표 축포는 화면을 비우고 시작한다', () => {
  withFakeDom(() => {
    const layer = new ConfettiLayer();
    // 배속 MAX 로 한참 쓴 상태를 흉내 낸다 — 화면이 색종이로 가득하다.
    for (let i = 0; i < 20; i++) layer.fireEdgeBurst(2);
    const before = particlesOf(layer).length;
    assert.ok(before > 400, `사전 조건이 안 만들어졌다: ${before}개`);

    layer.fireGoalCelebration();
    const after = particlesOf(layer);

    // 남아 있던 평범한 색종이는 사라지고 새 축포만 있어야 한다.
    assert.ok(after.length < before, `비우지 않았다: ${before} → ${after.length}`);
    // 그리고 새로 뿌린 것에는 금빛 큰 조각이 섞여 있다.
    assert.ok(after.some(p => p.size > 12), '큰 조각이 없다 — 평소 색종이와 구별이 안 된다');
  });
});

test('아무리 크게 터져도 입자 상한을 넘지 않는다', () => {
  withFakeDom(() => {
    const layer = new ConfettiLayer();
    for (let i = 0; i < 20; i++) layer.fireEdgeBurst(2);
    layer.fireGoalCelebration();
    // MAX_PARTICLES 는 900. 넘기면 오래 쓴 사람일수록 프레임이 무너진다.
    assert.ok(particlesOf(layer).length <= 900, `입자가 ${particlesOf(layer).length}개다`);
  });
});

/**
 * 금빛과 큰 크기는 "더 많이" 대신 "다르게" 를 만드는 장치다.
 * 색과 크기가 평소와 같아지면 배속이 높은 사람에게는 아무 일도 없는 것과 같다.
 */
test('목표 축포에는 금빛 큰 조각이 섞인다', () => {
  const goldish = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return r > 200 && g > 140 && b < 160;   // 금빛: 빨강·초록 높고 파랑 낮음
  };

  const goalGold = withFakeDom(() => {
    const layer = new ConfettiLayer();
    layer.fireGoalCelebration();
    const parts = particlesOf(layer);
    return {
      gold: parts.filter(p => goldish(p.color)).length,
      big: parts.filter(p => p.size > 12).length,
      total: parts.length,
    };
  });

  assert.ok(goalGold.gold / goalGold.total > 0.4, `금빛이 ${goalGold.gold}/${goalGold.total} 뿐이다`);
  assert.ok(goalGold.big > 200, `큰 조각이 ${goalGold.big}개뿐이다`);

  // 평소 응원에는 큰 조각이 없어야 한다 — 있으면 구별이 사라진다.
  const normalBig = withFakeDom(() => {
    const layer = new ConfettiLayer();
    for (let i = 0; i < 10; i++) layer.fireEdgeBurst();
    layer.fireCelebration();
    return particlesOf(layer).filter(p => p.size > 12).length;
  });
  assert.equal(normalBig, 0, '평소 응원에도 큰 조각이 들어갔다');
});

test('좌우 대포도 함께 터진다', () => {
  withFakeDom(() => {
    const layer = new ConfettiLayer();
    layer.fireGoalCelebration();
    const parts = particlesOf(layer);
    assert.ok(parts.some(p => p.x === 0), '왼쪽 대포가 없다');
    assert.ok(parts.some(p => p.x === W), '오른쪽 대포가 없다');
  });
});
