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

/**
 * CSS 규격상의 1mm (96dpi 가정).
 *
 * 문서 좌표가 이 기준으로 들어오므로 배율 환산의 분모다. 화면의 실제 밀도가
 * 아니라 "문서 px 의 정의" 라는 점에 주의 — 여기를 바꾸면 배율 의미가 통째로 어긋난다.
 */
export const CSS_PX_PER_MM = 96 / 25.4;

/**
 * 보정하지 않았을 때 쓰는 추정 밀도 (112dpi).
 *
 * 요즘 흔한 화면의 **CSS 기준** 밀도를 어림한 값이다. 패널의 물리 dpi 가 아니라
 * OS 배율까지 반영된 값이라는 게 중요하다 — 브라우저의 CSS 픽셀은 OS 배율만큼
 * 이미 커져 있다.
 *
 *   15.6" 1080p, 배율 100%   → 141
 *   14"   1080p, 배율 125%   → 113
 *   27"   1440p, 배율 100%   → 109
 *   13.3" 맥북,  dPR 2       → 113
 *   24"   1080p, 배율 100%   →  92
 *
 * 대략 92~141 에 걸쳐 있고 가운데가 110 언저리라 112 로 잡았다. 어디까지나 추정이라
 * 정확히 맞추려면 화면 보정을 해야 한다 — 96 을 그대로 쓰면 대부분의 화면에서
 * 문서가 실물보다 작게 나오므로, 안 맞더라도 이쪽이 덜 틀린다.
 */
export const DEFAULT_PX_PER_MM = 112 / 25.4;

/** 보정값이 벗어날 수 없는 범위 — 잘못 잰 값이 문서를 못 쓰게 만들지 않도록 */
const MIN_PX_PER_MM = CSS_PX_PER_MM * 0.5;
const MAX_PX_PER_MM = CSS_PX_PER_MM * 4;

/** 신용카드 긴 변(ISO/IEC 7810 ID-1). 누구나 가지고 있어 자로 삼기 좋다 */
export const CREDIT_CARD_WIDTH_MM = 85.6;

export function clampPxPerMm(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return CSS_PX_PER_MM;
  return Math.min(MAX_PX_PER_MM, Math.max(MIN_PX_PER_MM, value));
}

/** 지금 쓰는 1mm 당 CSS px. 보정 전이면 추정 기본값 */
export function getPxPerMm(): number {
  const stored = userSettings.getViewSettings().pxPerMm;
  return stored ? clampPxPerMm(stored) : DEFAULT_PX_PER_MM;
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
