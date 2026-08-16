import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTOSAVE_DEBOUNCE_MS,
  AUTOSAVE_MAX_WAIT_MS,
  nextSaveDelay,
  retryDelay,
} from '../src/storage/autosave-controller.ts';
import { uniqueDocName } from '../src/storage/doc-name.ts';

test('입력이 멈추면 디바운스만큼 기다렸다 저장한다', () => {
  const now = 100_000;
  // 방금 입력했다 → 2초 뒤
  assert.equal(nextSaveDelay(now, now, now), AUTOSAVE_DEBOUNCE_MS);
});

test('계속 쓰는 동안에도 최대 간격을 넘기지 않는다', () => {
  const first = 100_000;
  // 29초째 계속 입력 중 — 디바운스대로면 2초 더 기다리지만 마감이 1초 남았다.
  const now = first + 29_000;
  assert.equal(nextSaveDelay(now, now, first), 1000);
});

test('최대 간격이 이미 지났으면 즉시 저장한다', () => {
  const first = 100_000;
  const now = first + AUTOSAVE_MAX_WAIT_MS + 5000;
  assert.equal(nextSaveDelay(now, now, first), 0);
});

test('입력이 멎은 지 오래면 즉시 저장한다', () => {
  const now = 100_000;
  assert.equal(nextSaveDelay(now, now - AUTOSAVE_DEBOUNCE_MS - 1, now - 5000), 0);
});

test('재시도는 지수로 늘고 상한에서 멈춘다', () => {
  assert.equal(retryDelay(1), 3000);
  assert.equal(retryDelay(2), 6000);
  assert.equal(retryDelay(3), 12_000);
  // 상한 60초를 넘지 않는다 — 무한정 멀어지면 복구가 안 된다.
  assert.equal(retryDelay(10), 60_000);
  assert.equal(retryDelay(100), 60_000);
});

test('이름 중복 회피가 저장소 목록과 맞물린다', () => {
  // 드라이브 WHP 폴더에 이미 있는 이름들
  const taken = ['새 문서.hwp', '새 문서(1).hwp', '보고서.hwp'];
  assert.equal(uniqueDocName('새 문서.hwp', taken), '새 문서(2).hwp');
  assert.equal(uniqueDocName('보고서.hwp', taken), '보고서(1).hwp');
  assert.equal(uniqueDocName('초안.hwp', taken), '초안.hwp');
});

test('이름을 그대로 두는 저장은 자기 자신 때문에 번호가 붙지 않아야 한다', () => {
  // DriveBackend.rename 이 자기 id 를 목록에서 빼는 이유 — 뺀 목록으로는 그대로 통과한다.
  const takenExcludingSelf = ['다른 문서.hwp'];
  assert.equal(uniqueDocName('보고서.hwp', takenExcludingSelf), '보고서.hwp');
  // 빼지 않으면 이렇게 밀린다.
  assert.equal(uniqueDocName('보고서.hwp', ['보고서.hwp', '다른 문서.hwp']), '보고서(1).hwp');
});
