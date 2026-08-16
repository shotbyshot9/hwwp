/**
 * 화면 보정 — "배율 100% = 용지 실물 크기" 를 성립시킨다.
 *
 * 브라우저는 화면의 물리적 크기를 알 수 없다. CSS 픽셀은 96dpi 를 가정한 논리
 * 단위라, 141dpi 노트북에서 A4(210mm)를 794 CSS px 로 그리면 실제로는 14cm 남짓
 * 으로 작게 나온다. 설치형 워드프로세서가 OS 가 알려 주는 화면 DPI 로 이 보정을
 * 하는 것을, 웹앱에서는 사용자가 한 번 재 주는 수밖에 없다.
 *
 * 그래서 값 하나만 기억한다 — 1mm 가 화면에서 몇 CSS px 인가.
 * 보정 전에는 CSS 기본값(96dpi)을 쓴다. 즉 보정하지 않아도 지금과 똑같이 동작한다.
 */

import { userSettings } from './user-settings.ts';

/** CSS 규격상의 1mm (96dpi 가정). 보정하지 않았을 때의 기본값 */
export const CSS_PX_PER_MM = 96 / 25.4;

/** 보정값이 벗어날 수 없는 범위 — 잘못 잰 값이 문서를 못 쓰게 만들지 않도록 */
const MIN_PX_PER_MM = CSS_PX_PER_MM * 0.5;
const MAX_PX_PER_MM = CSS_PX_PER_MM * 4;

/** 신용카드 긴 변(ISO/IEC 7810 ID-1). 누구나 가지고 있어 자로 삼기 좋다 */
export const CREDIT_CARD_WIDTH_MM = 85.6;

export function clampPxPerMm(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return CSS_PX_PER_MM;
  return Math.min(MAX_PX_PER_MM, Math.max(MIN_PX_PER_MM, value));
}

/** 지금 쓰는 1mm 당 CSS px. 보정 전이면 CSS 기본값 */
export function getPxPerMm(): number {
  const stored = userSettings.getViewSettings().pxPerMm;
  return stored ? clampPxPerMm(stored) : CSS_PX_PER_MM;
}

/** 사용자가 잰 값을 저장한다. 0 이나 null 이면 보정을 지운다 */
export function setPxPerMm(value: number | null): void {
  userSettings.setPxPerMm(value ? clampPxPerMm(value) : null);
}

/** 보정한 적이 있는가 */
export function isCalibrated(): boolean {
  return !!userSettings.getViewSettings().pxPerMm;
}

/**
 * 사용자가 고른 배율(1.0 = 100%)을 실제 렌더 배율로 바꾼다.
 *
 * 문서 크기는 96dpi 기준 px 로 들어오므로, 화면이 그보다 촘촘하면 그만큼 키워야
 * 종이와 1:1 이 된다.
 */
export function toRenderZoom(userZoom: number): number {
  return userZoom * (getPxPerMm() / CSS_PX_PER_MM);
}

/** 렌더 배율을 사용자에게 보여 줄 배율로 되돌린다 */
export function toUserZoom(renderZoom: number): number {
  return renderZoom / (getPxPerMm() / CSS_PX_PER_MM);
}

/** 화면 해상도(dpi) 환산 — 보정 화면에서 참고로 보여 준다 */
export function estimatedDpi(pxPerMm: number = getPxPerMm()): number {
  return Math.round(pxPerMm * 25.4);
}
