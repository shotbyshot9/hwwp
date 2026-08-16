import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * 화면 보정 계산은 userSettings(localStorage) 에 기대므로 모듈을 그대로 부를 수
 * 없다. 계산 자체는 단순한 비례식이라, 여기서는 그 식과 배선을 고정한다.
 */

const CSS_PX_PER_MM = 96 / 25.4;

function toRenderZoom(userZoom: number, pxPerMm: number): number {
  return userZoom * (pxPerMm / CSS_PX_PER_MM);
}

function toUserZoom(renderZoom: number, pxPerMm: number): number {
  return renderZoom / (pxPerMm / CSS_PX_PER_MM);
}

test('보정 전에는 지금과 똑같이 동작한다', () => {
  assert.equal(toRenderZoom(1, CSS_PX_PER_MM), 1);
  assert.equal(toUserZoom(1, CSS_PX_PER_MM), 1);
});

test('촘촘한 화면에서는 100% 가 더 크게 그려진다', () => {
  // 141dpi 노트북 — CSS 가정(96dpi)보다 1.47 배 촘촘하다.
  const pxPerMm = 141 / 25.4;
  const render = toRenderZoom(1, pxPerMm);
  assert.ok(Math.abs(render - 141 / 96) < 1e-9, `${render}`);
  // A4 210mm 가 화면에서 실제 210mm 로 나온다.
  const a4WidthCssPx = 210 * CSS_PX_PER_MM;
  const drawnPx = a4WidthCssPx * render;
  assert.ok(Math.abs(drawnPx / pxPerMm - 210) < 1e-6, `${drawnPx / pxPerMm}mm`);
});

test('사용자에게 보이는 배율은 실물 대비 비율로 되돌아온다', () => {
  const pxPerMm = 141 / 25.4;
  const render = toRenderZoom(1, pxPerMm);
  assert.ok(Math.abs(toUserZoom(render, pxPerMm) - 1) < 1e-9);
  // 쪽 맞춤처럼 렌더 배율이 직접 정해지는 경우도 실물 대비로 환산된다.
  assert.ok(toUserZoom(1.0, pxPerMm) < 1, '보정된 화면에서 렌더 1.0 은 실물보다 작다');
});

test('배율 커맨드와 상태 표시줄이 보정을 실제로 거친다', () => {
  const view = readFileSync(new URL('../src/command/commands/view.ts', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

  // 고정 배율(100% 등)은 렌더 배율로 환산해서 넘겨야 한다.
  assert.match(view, /setZoom\(toRenderZoom\(pct \/ 100\)\)/);
  // 상태 표시줄은 반대로 되돌려 보여야 한다.
  assert.match(main, /toUserZoom\(zoom as number\)/);
});
