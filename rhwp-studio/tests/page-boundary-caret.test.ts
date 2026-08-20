import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const inputHandler = readFileSync(
  new URL('../src/engine/input-handler.ts', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

const cursor = readFileSync(new URL('../src/engine/cursor.ts', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n');

/**
 * 쪽 경계에서 캐럿이 옛 배치에 남던 결함을 막는다.
 *
 * 신고 둘:
 *  - 쪽 마지막 줄에서 엔터를 치면 새 쪽이 나오고 캐럿이 거기 서야 하는데, 아무 반응이
 *    없다가 글자를 치면 그때 쪽과 캐럿이 함께 나타났다.
 *  - 넘어간 쪽에서 Backspace 로 앞 쪽에 돌아오면 쪽은 사라지는데 캐럿만 그 아래 남았다.
 *
 * 둘 다 한 가지에서 온다. `cursor.getRect()` 는 **캐시를 돌려준다**. 엔터로 문단을
 * 나누거나 Backspace 로 합치는 편집은 쪽 수를 바꿀 수 있는데, 편집 뒤 갱신 경로가 그
 * 캐시를 다시 계산하지 않고 그대로 그렸다 — 방금 사라진 배치의 좌표다.
 */
test('getRect 는 캐시다 — 이 시험의 전제', () => {
  // 이 전제가 깨지면(즉 getRect 가 매번 새로 계산하면) 아래 계약은 필요 없어진다.
  const getRect = cursor.slice(cursor.indexOf('getRect(): CursorRect | null {'), cursor.indexOf('private static sameFocusedCellPosition'));
  assert.ok(getRect.length > 0, 'getRect 를 찾지 못했다');
  assert.match(getRect, /return this\.rect \? \{ \.\.\.this\.rect \} : null;/);
});

test('전체 갱신은 캐럿을 그리기 전에 좌표를 다시 계산한다', () => {
  const afterEdit = inputHandler.slice(
    inputHandler.indexOf('private afterEdit(flushDeferredPagination = true): void {'),
    inputHandler.indexOf('/** 셀 내부 단일 텍스트 편집 후 처리'),
  );
  assert.ok(afterEdit.length > 0, 'afterEdit 를 찾지 못했다');
  assert.match(afterEdit, /this\.cursor\.updateRect\(\);/, '좌표를 다시 계산하지 않는다');
  // 순서가 뒤집히면 다시 옛 좌표로 그린다.
  assert.ok(
    afterEdit.indexOf('this.cursor.updateRect();') < afterEdit.indexOf('this.updateCaret();'),
    'updateRect 는 updateCaret 보다 먼저여야 한다',
  );
});

test('엔터·Backspace 는 전체 갱신 경로로 간다', () => {
  /*
   * 쪽 수를 바꿀 수 있는 편집이 쪽 단위 부분 갱신으로 새면, 새 쪽이 화면에 아예 안 생긴다.
   * 부분 갱신 대상은 같은 문단 안의 짧은 넣기·지우기로 한정돼 있어야 한다.
   */
  const invalidation = readFileSync(
    new URL('../src/engine/input-edit-invalidation.ts', import.meta.url),
    'utf8',
  ).replace(/\r\n/g, '\n');
  assert.match(
    invalidation,
    /const PAGE_LOCAL_TEXT_COMMANDS = new Set\(\['insertText', 'deleteText'\]\);/,
    '문단을 나누고 합치는 명령이 부분 갱신 목록에 들어가면 안 된다',
  );
});

test('화면이 쪽을 다시 만든 뒤에도 좌표를 다시 계산한다', () => {
  /*
   * 편집 직후에는 화면이 아직 새 쪽을 모른다 — 쪽 목록 갱신은 비동기다. 그래서 캐럿이
   * 제 자리를 찾는 것은 실질적으로 이 처리기다. 여기서 캐시를 그대로 쓰면, 새 쪽은
   * 생겼는데 캐럿만 옛 자리에 남는다.
   */
  const handler = inputHandler.slice(
    inputHandler.indexOf("eventBus.on('document-view-changed'"),
    inputHandler.indexOf("eventBus.on('table-object-selection-changed'"),
  );
  assert.ok(handler.length > 0, 'document-view-changed 처리기를 찾지 못했다');
  assert.match(handler, /this\.cursor\.updateRect\(\);/);
  assert.ok(
    handler.indexOf('this.cursor.updateRect();') < handler.indexOf('this.updateCaret('),
    'updateRect 는 updateCaret 보다 먼저여야 한다',
  );
});
