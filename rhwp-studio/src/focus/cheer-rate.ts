/**
 * 배명훈 모드 응원 배속.
 *
 * 원래는 문장부호를 찍을 때만 응원했다. 한국 소설의 한 문장은 평균 30~40자이고
 * 한 글자는 평균 두 타이므로, 한 문장은 대략 60~80타다 — 즉 기본 상태의 응원은
 * "60타에 한 번" 꼴이라 드문드문 터지는 느낌이 들었다.
 *
 * 그래서 배속을 둔다. x2 는 30타, x3 는 20타, x5 는 12타, x10 은 6타마다 터지고
 * MAX 는 모든 타에 터진다. 어느 배속에서든 문장부호를 찍으면 응원하는 건 그대로다.
 *
 * 이 파일은 순수 계산만 담는다 — 설정·오디오·DOM 을 모르므로 그냥 테스트할 수 있다.
 */

/** 응원 배속. 숫자는 배수, `max` 는 모든 타. */
export type FocusCheerRate = 1 | 2 | 3 | 5 | 10 | 'max';

/** 버튼을 누를 때 도는 순서. 마지막(MAX) 다음은 처음(x1)으로 돌아온다. */
export const CHEER_RATES: readonly FocusCheerRate[] = [1, 2, 3, 5, 10, 'max'];

/** 한국 소설의 평균 문장 ≈ 30~40자, 한 글자 ≈ 2타 → 한 문장 ≈ 60~80타 */
export const STROKES_PER_SENTENCE = 60;

/** 한 글자를 치는 데 드는 평균 타수 (한글 기준: 초성+중성, 받침까지면 셋) */
export const STROKES_PER_CHAR = 2;

/** 이 배속에서 응원 하나가 터지기까지의 타수 */
export function strokesPerCheer(rate: FocusCheerRate): number {
  if (rate === 'max') return 1;
  return STROKES_PER_SENTENCE / rate;
}

/**
 * 이 배속에서 응원 하나가 터지기까지의 글자수.
 *
 * 편집 엔진이 알려주는 것은 확정된 "글자" 이지 "타" 가 아니므로, 타수를 글자수로
 * 환산해서 센다. MAX 는 글자 하나마다다.
 */
export function charsPerCheer(rate: FocusCheerRate): number {
  if (rate === 'max') return 1;
  return Math.max(1, Math.round(strokesPerCheer(rate) / STROKES_PER_CHAR));
}

/** 다음 배속 (순환) */
export function nextCheerRate(rate: FocusCheerRate): FocusCheerRate {
  const i = CHEER_RATES.indexOf(rate);
  return CHEER_RATES[(i + 1) % CHEER_RATES.length] ?? 1;
}

/** 버튼에 찍는 짧은 이름 */
export function cheerRateLabel(rate: FocusCheerRate): string {
  return rate === 'max' ? 'MAX' : `x${rate}`;
}

/** 사람이 읽는 설명 (툴팁용) */
export function describeCheerRate(rate: FocusCheerRate): string {
  return rate === 'max' ? '모든 타마다 환호' : `${strokesPerCheer(rate)}타마다 환호`;
}

/**
 * 응원이 잦아질수록 한 번의 소리를 낮춘다.
 *
 * 같은 크기로 열 배 자주 터지면 응원이 아니라 소음이 된다. 기준(x1)의 글자수에
 * 대한 제곱근으로 줄이되, 들리지 않을 만큼 작아지지는 않게 바닥을 둔다.
 */
export function cheerRateGain(rate: FocusCheerRate): number {
  const base = charsPerCheer(1);
  return Math.min(1, Math.max(0.45, Math.sqrt(charsPerCheer(rate) / base)));
}

/** 저장된 값이 망가졌을 때를 대비한 정규화 */
export function normalizeCheerRate(value: unknown, fallback: FocusCheerRate = 1): FocusCheerRate {
  return CHEER_RATES.includes(value as FocusCheerRate) ? (value as FocusCheerRate) : fallback;
}
