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
 * 처음 오는 사람은 MAX 로 시작한다.
 *
 * x1 은 문장부호를 찍을 때 — 대략 60타에 한 번이다. 배명훈 모드를 처음 켠 사람에게는
 * 한참 쳐도 아무 일이 없는 것처럼 느껴진다. 이 모드가 이 제품의 핵심이므로, 무엇인지
 * 한 번은 제대로 겪어 본 뒤에 남길지 말지 고르게 한다. 부담스러우면 배속 단추 한 번으로
 * 내리고 그 값은 저장된다.
 */
test('배명훈 모드 기본 배속은 MAX 다', () => {
  const settings = readFileSync(
    new URL('../src/core/user-settings.ts', import.meta.url),
    'utf8',
  ).replace(/\r\n/g, '\n');
  const focus = settings.slice(
    settings.indexOf('    focus: {'),
    settings.indexOf('    autosave: {'),
  );
  assert.ok(focus.length > 0, '기본 설정의 focus 를 찾지 못했다');
  assert.match(focus, /cheerRate: 'max',/);
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
