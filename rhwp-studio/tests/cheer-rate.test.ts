import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CHEER_RATES,
  charsPerCheer,
  cheerRateGain,
  cheerRateLabel,
  describeCheerRate,
  nextCheerRate,
  normalizeCheerRate,
  strokesPerCheer,
} from '../src/focus/cheer-rate.ts';

test('배속마다 정해진 타수에서 응원한다', () => {
  // 기준: 한국 소설의 한 문장 ≈ 60타. 배속은 그 간격을 나눈다.
  assert.equal(strokesPerCheer(1), 60);
  assert.equal(strokesPerCheer(2), 30);
  assert.equal(strokesPerCheer(3), 20);
  assert.equal(strokesPerCheer(5), 12);
  assert.equal(strokesPerCheer(10), 6);
  assert.equal(strokesPerCheer('max'), 1);
});

test('편집 엔진은 타가 아니라 글자를 주므로 두 타를 한 글자로 환산한다', () => {
  assert.equal(charsPerCheer(1), 30);
  assert.equal(charsPerCheer(2), 15);
  assert.equal(charsPerCheer(3), 10);
  assert.equal(charsPerCheer(5), 6);
  assert.equal(charsPerCheer(10), 3);
  // MAX 는 글자 하나마다 — 반올림에 기대지 않고 못박는다.
  assert.equal(charsPerCheer('max'), 1);
});

test('버튼은 x1 부터 MAX 까지 돌고 처음으로 돌아온다', () => {
  assert.deepEqual(CHEER_RATES, [1, 2, 3, 5, 10, 'max']);
  assert.equal(nextCheerRate(1), 2);
  assert.equal(nextCheerRate(2), 3);
  assert.equal(nextCheerRate(3), 5);
  assert.equal(nextCheerRate(5), 10);
  assert.equal(nextCheerRate(10), 'max');
  assert.equal(nextCheerRate('max'), 1);
});

test('여섯 단계를 밟으면 제자리로 온다', () => {
  let rate = CHEER_RATES[0];
  for (let i = 0; i < CHEER_RATES.length; i++) rate = nextCheerRate(rate);
  assert.equal(rate, CHEER_RATES[0]);
});

test('버튼에 찍히는 이름', () => {
  assert.deepEqual(CHEER_RATES.map(cheerRateLabel), ['x1', 'x2', 'x3', 'x5', 'x10', 'MAX']);
  assert.equal(describeCheerRate(3), '20타마다 환호');
  assert.equal(describeCheerRate('max'), '모든 타마다 환호');
});

test('잦아질수록 한 번의 소리를 줄이되 들리지 않을 만큼은 아니다', () => {
  assert.equal(cheerRateGain(1), 1);
  // 배속이 올라갈수록 단조 감소해야 한다 — 뒤집히면 빠를수록 시끄러워진다.
  const gains = CHEER_RATES.map(cheerRateGain);
  for (let i = 1; i < gains.length; i++) {
    assert.ok(gains[i] <= gains[i - 1], `${CHEER_RATES[i]} 가 앞 단계보다 크다`);
  }
  for (const g of gains) assert.ok(g >= 0.45 && g <= 1, `배율이 범위를 벗어남: ${g}`);
});

test('저장값이 망가져도 x1 으로 떨어진다', () => {
  assert.equal(normalizeCheerRate(4), 1);
  assert.equal(normalizeCheerRate('MAX'), 1);
  assert.equal(normalizeCheerRate(undefined), 1);
  assert.equal(normalizeCheerRate(null, 3), 3);
  assert.equal(normalizeCheerRate('max'), 'max');
  assert.equal(normalizeCheerRate(10), 10);
});

/**
 * 배속을 올려도 문장부호 응원은 남아야 한다는 것이 이 기능의 전제다.
 * 조건이 `&&` 로 바뀌면 문장부호 응원이 배속 문턱에 갇힌다.
 */
test('응원은 문장 끝 "또는" 배속 문턱에서 터진다', () => {
  const source = readFileSync(new URL('../src/focus/cheer-engine.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(!sentenceEnded && !pacedOut\) return;/);
  assert.match(source, /charsSinceBurst >= charsPerCheer\(settings\.cheerRate\)/);
});

/** 축포가 한 문장에 여러 번 터지면 배속을 올릴수록 화면이 폭죽으로 덮인다 */
test('축포는 한 문장에 한 번만 터진다', () => {
  const source = readFileSync(new URL('../src/focus/cheer-engine.ts', import.meta.url), 'utf8');
  assert.match(source, /charsSinceSentence > LONG_RUN_CHARS && !this\.longRunFired/);
});

/**
 * 처음 오는 사람은 x1 로 시작한다.
 *
 * 한때 MAX 였다. 처음 켠 사람이 "한참 쳐도 아무 일이 없다" 고 느끼지 않게 하려던 것이고,
 * 그때는 첫 문서에 안내가 없었으니 맞는 판단이었다. 지금은 첫 문서가 "마침표까지 찍어
 * 보세요" 라고 직접 시키므로, 무딘 방법 대신 정확한 방법이 생겼다.
 *
 * 그리고 MAX 는 값을 치른다.
 *
 *   · 글자 하나마다 터지므로 **문장을 끝냈다는 사건이 묻힌다.** 원작의 감동은 문장을
 *     완성하면 박수가 나온다는 것인데, 모든 것에 박수가 나오면 아무것도 박수받지 못한다.
 *     문장 끝 응원에 볼륨 보정도 없다 — 중간 응원과 크기가 같다.
 *   · 자주 터지는 만큼 소리를 줄이므로(`cheerRateGain`) 한 번의 응원이 x1 의 45% 다.
 *   · 올라갈 자리가 없어 첫 문서의 "단추를 눌러 보세요" 가 성립하지 않는다.
 *   · 화면이 한순간도 비지 않아 목표 달성 축포마저 묻힌다.
 *
 * x1 은 30자마다, 그리고 문장부호를 찍을 때마다다. 첫 마침표에서 바로 겪고, 문장부호
 * 없이 이어 써도 50자에서 축포가 따로 터지므로 빈틈도 없다.
 */
test('배명훈 모드 기본 배속은 x1 이다', () => {
  const settings = readFileSync(
    new URL('../src/core/user-settings.ts', import.meta.url),
    'utf8',
  ).replace(/\r\n/g, '\n');
  const focus = settings.slice(
    settings.indexOf('    focus: {'),
    settings.indexOf('    autosave: {'),
  );
  assert.ok(focus.length > 0, '기본 설정의 focus 를 찾지 못했다');
  assert.match(focus, /cheerRate: 1,/);
});

/**
 * 첫 문서가 배속 단추를 이름으로 가리킨다. 기본값이 바뀌면 그 이름도 바뀌므로,
 * 둘이 어긋나면 "없는 단추를 누르라" 는 거짓 안내가 된다. 실제로 한 번 그랬다 —
 * 기본값이 MAX 인데 문서는 「x1」 을 누르라고 하고 있었고, MAX 에서 누르면 오히려
 * 가장 드물어지는 x1 로 한 바퀴 돌았다.
 */
test('첫 문서가 가리키는 배속 단추 이름이 기본값과 맞다', () => {
  const settings = readFileSync(
    new URL('../src/core/user-settings.ts', import.meta.url),
    'utf8',
  ).replace(/\r\n/g, '\n');
  const welcome = readFileSync(
    new URL('../src/core/welcome-document.ts', import.meta.url),
    'utf8',
  ).replace(/\r\n/g, '\n');

  const raw = settings.match(/cheerRate: ('max'|\d+),/)?.[1] ?? '';
  const rate = raw === "'max'" ? 'max' : Number(raw);
  const label = cheerRateLabel(rate as Parameters<typeof cheerRateLabel>[0]);

  assert.ok(
    welcome.includes(`「${label}」`),
    `첫 문서가 「${label}」 를 가리키지 않는다 — 기본값과 어긋났다`,
  );
  // 기본값에서 단추를 누르면 실제로 잦아져야 한다. 한 바퀴 돌면 안 된다.
  assert.notEqual(rate, 'max', 'MAX 가 기본값이면 단추를 눌러도 잦아지지 않는다');
});

test('저장된 배속이 있으면 기본값이 덮지 않는다', () => {
  // 이미 쓰던 사람이 x1 로 내려 두었으면 그대로여야 한다. 기본값은 저장된 설정이
  // 없을 때만 쓰인다.
  const settings = readFileSync(
    new URL('../src/core/user-settings.ts', import.meta.url),
    'utf8',
  ).replace(/\r\n/g, '\n');
  assert.match(
    settings,
    /cheerRate: normalizeCheerRate\(focus\.cheerRate, defaults\.focus\.cheerRate\)/,
    '저장값을 먼저 보고 없을 때만 기본값을 써야 한다',
  );
});
