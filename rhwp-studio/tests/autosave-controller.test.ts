import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTOSAVE_DEBOUNCE_MS,
  AUTOSAVE_MAX_WAIT_MS,
  AutosaveController,
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
  // 드라이브 hwwp 폴더에 이미 있는 이름들
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

/**
 * `AutosaveController` 는 `window` 를 만진다 — 생성자에서 온라인 복귀를 듣고, 저장
 * 예약에 타이머를 쓴다. 노드에는 `window` 가 없으므로 이 파일에서 한 번 세워 둔다.
 *
 * 타이머는 즉시 실행한다. 아래 시험들은 `flush()` 로 직접 저장을 부르므로 실제 시간을
 * 기다릴 이유가 없다.
 */
(globalThis as Record<string, unknown>).window = {
  addEventListener() { /* 온라인 복귀는 이 시험에서 안 쓴다 */ },
  setTimeout: (fn: () => void) => { fn(); return 0; },
  clearTimeout() { /* 무시 */ },
};

/**
 * 제목 줄에서 바꾼 이름이 저장소에도 가야 한다.
 *
 * 저장은 지금까지 **내용만** 올렸다(`update`). 그래서 드라이브에 한 번 올라간 문서는
 * 앱에서 이름을 아무리 바꿔도 드라이브 쪽 이름이 그대로였다 — 나중에 드라이브에서
 * 찾으면 옛 이름으로 있어서 어느 것이 무엇인지 알 수 없다. 실제 사용에서 나온 신고다.
 *
 * `rename` 은 인터페이스에도 있고 구현도 돼 있었는데 **부르는 곳이 없었다.** 이런 종류는
 * 화면상 아무 문제가 없어 보이므로(제목 줄은 멀쩡히 바뀐다) 시험으로 묶어 둔다.
 */
test('이름을 바꾸면 저장할 때 저장소 이름도 바뀐다', async () => {
  const calls: string[] = [];
  let fileName = '보고서.hwp';
  const controller = new AutosaveController({
    getBackend: () => ({
      kind: 'drive' as const,
      isReady: () => true,
      list: async () => [],
      read: async () => ({ name: fileName, bytes: new Uint8Array() }),
      create: async () => { throw new Error('이미 있는 문서다'); },
      update: async (ref) => { calls.push(`update:${ref.name}`); return { ref }; },
      rename: async (ref, name) => {
        calls.push(`rename:${ref.name}→${name}`);
        return { ref: { ...ref, name } };
      },
    }),
    serialize: () => new Blob(),
    getFileName: () => fileName,
    onState: () => { /* 무시 */ },
    onRenamed: (name) => { fileName = name; },
  });

  controller.attach({ id: 'f1', name: '보고서.hwp' });
  fileName = '최종본.hwp';          // 제목 줄에서 고침
  controller.markChanged();
  await controller.flush();

  assert.deepEqual(calls, ['rename:보고서.hwp→최종본.hwp', 'update:최종본.hwp']);
});

test('이름이 그대로면 쓸데없이 이름을 바꾸지 않는다', async () => {
  const calls: string[] = [];
  const controller = new AutosaveController({
    getBackend: () => ({
      kind: 'drive' as const,
      isReady: () => true,
      list: async () => [],
      read: async () => ({ name: '보고서.hwp', bytes: new Uint8Array() }),
      create: async () => { throw new Error('이미 있는 문서다'); },
      update: async (ref) => { calls.push('update'); return { ref }; },
      rename: async (ref) => { calls.push('rename'); return { ref }; },
    }),
    serialize: () => new Blob(),
    getFileName: () => '보고서.hwp',
    onState: () => { /* 무시 */ },
    onRenamed: () => { /* 무시 */ },
  });

  controller.attach({ id: 'f1', name: '보고서.hwp' });
  controller.markChanged();
  await controller.flush();

  // 저장할 때마다 이름을 바꾸면 드라이브 호출이 두 배가 된다.
  assert.deepEqual(calls, ['update']);
});

test('같은 이름이 이미 있으면 번호 붙은 이름을 제목 줄에 되돌려 준다', async () => {
  let shown = '';
  const controller = new AutosaveController({
    getBackend: () => ({
      kind: 'drive' as const,
      isReady: () => true,
      list: async () => [],
      read: async () => ({ name: '', bytes: new Uint8Array() }),
      create: async () => { throw new Error('이미 있는 문서다'); },
      update: async (ref) => ({ ref }),
      // 드라이브에 이미 "최종본.hwp" 가 있어 번호가 붙은 상황
      rename: async (ref) => ({
        ref: { ...ref, name: '최종본(1).hwp' },
        renamedTo: '최종본(1).hwp',
      }),
    }),
    serialize: () => new Blob(),
    getFileName: () => '최종본.hwp',
    onState: () => { /* 무시 */ },
    onRenamed: (name) => { shown = name; },
  });

  controller.attach({ id: 'f1', name: '보고서.hwp' });
  controller.markChanged();
  await controller.flush();

  // 제목 줄이 실제 저장된 이름과 달라지면 다음 저장에서 또 이름을 바꾸려 든다.
  assert.equal(shown, '최종본(1).hwp');
});
