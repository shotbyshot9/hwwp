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

const virtualScroll = readFileSync(
  new URL('../src/view/virtual-scroll.ts', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

/**
 * 쪽이 넘어갈 때 화면이 그 쪽을 보여 주지 않던 결함을 막는다.
 *
 * 신고: 쪽 마지막 줄에서 엔터를 치면 다음 쪽이 생기기는 하는데 **화면이 문서 맨 위로
 * 올라간다.** 거기서 글자를 치면 그제야 새 쪽이 보인다. 붙여넣기가 쪽을 넘길 때도
 * 붙인 자리가 화면 밖에 남는다.
 *
 * 쪽 목록 갱신은 비동기다. 편집 직후 캐럿은 이미 새 쪽에 있지만 화면은 그 쪽을 모르고,
 * `getPageOffset` 은 모르는 쪽에 **0** 을 돌려준다. 그 0 이 "캐럿이 문서 맨 위" 로 읽혀
 * 화면이 맨 위로 튀었다.
 */
test('모르는 쪽으로는 스크롤하지 않는다', () => {
  const scroll = inputHandler.slice(
    inputHandler.indexOf('private scrollCaretIntoView('),
    inputHandler.indexOf('/** 문서 로딩 후 저장된 캐럿 위치에'),
  );
  assert.ok(scroll.length > 0, 'scrollCaretIntoView 를 찾지 못했다');
  assert.match(
    scroll,
    /if \(!this\.virtualScroll\.hasPageOffset\(rect\.pageIndex\)\) return;/,
    '모르는 쪽의 0 을 문서 맨 위로 읽으면 화면이 튄다',
  );
  // 판정은 실제 조회보다 앞서야 한다(주석이 아니라 코드 순서로 본다).
  assert.ok(
    scroll.indexOf("hasPageOffset(rect.pageIndex)) return;")
      < scroll.indexOf("const pageOffset = this.virtualScroll.getPageOffset("),
    "가드가 조회보다 뒤에 있으면 0 을 그대로 쓴다",
  );
});

test('모른다는 것을 물을 수 있어야 한다', () => {
  // getPageOffset 은 모르는 쪽에도 0 을 준다. 그 값만으로는 "맨 위" 와 구별할 수 없다.
  assert.match(virtualScroll, /getPageOffset\(pageIdx: number\): number \{\n\s*return this\.pageOffsets\[pageIdx\] \?\? 0;/);
  assert.match(virtualScroll, /hasPageOffset\(pageIdx: number\): boolean \{\n\s*return this\.pageOffsets\[pageIdx\] !== undefined;/);
});

test('화면이 쪽을 다 만든 뒤에는 캐럿을 따라간다', () => {
  /*
   * 편집 직후에는 스크롤을 미룬다(화면이 새 쪽을 모르므로). 그러니 여기서 따라가지
   * 않으면 아무도 따라가지 않는다 — 새 쪽은 생겼는데 보던 자리에 머문다.
   *
   * `scrollCaretIntoView` 는 캐럿이 화면 밖일 때만 움직이므로, 확대·축소처럼 캐럿이
   * 이미 보이는 화면 변화에서는 아무 일도 하지 않는다.
   */
  const handler = inputHandler.slice(
    inputHandler.indexOf("eventBus.on('document-view-changed'"),
    inputHandler.indexOf("eventBus.on('table-object-selection-changed'"),
  );
  assert.ok(handler.length > 0, 'document-view-changed 처리기를 찾지 못했다');
  assert.match(handler, /this\.updateCaret\(\);/, '스크롤을 건너뛰면 화면이 안 따라간다');
  assert.doesNotMatch(handler, /this\.updateCaret\(true\)/);
});

const canvasView = readFileSync(
  new URL('../src/view/canvas-view.ts', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

/**
 * 쪽 수가 바뀌었을 때 화면이 캐럿을 따라가게 하는 신호.
 *
 * 처음에는 `document-view-changed` 에 얹었는데, 그 신호는 **확대·축소 같은 보기 명령에서만
 * 나온다.** 편집으로 쪽이 늘어날 때는 아무도 보내지 않아 처리기가 아예 안 불렸다 — 그래서
 * 고쳤다고 했는데도 화면이 새 쪽을 따라가지 않았다.
 *
 * 쪽 목록을 실제로 다시 만드는 자리(`refreshPages`)에서 쪽 수가 달라졌을 때만 알린다.
 */
test('쪽 수가 바뀌면 화면이 알린다', () => {
  const refresh = canvasView.slice(
    canvasView.indexOf('refreshPages(): void {'),
    canvasView.indexOf('/** 텍스트 입력처럼 좁은 변경은'),
  );
  assert.ok(refresh.length > 0, 'refreshPages 를 찾지 못했다');
  assert.match(refresh, /const previousPageCount = this\.pages\.length;/);
  assert.match(
    refresh,
    /if \(this\.pages\.length !== previousPageCount\) \{\n\s*this\.eventBus\.emit\('document-page-count-changed', this\.pages\.length\);/,
    '쪽 수가 그대로면 알리지 않는다 — 매 입력마다 스크롤이 움직이면 안 된다',
  );
  // 쪽 자리를 다시 계산한 뒤에 알려야 받는 쪽이 새 자리를 볼 수 있다.
  assert.ok(
    refresh.indexOf('this.recalcLayout();') < refresh.indexOf('document-page-count-changed'),
  );
});

test('그 신호를 받아 캐럿을 화면에 들인다', () => {
  const handler = inputHandler.slice(
    inputHandler.indexOf("eventBus.on('document-page-count-changed'"),
    inputHandler.indexOf("eventBus.on('document-view-changed'"),
  );
  assert.ok(handler.length > 0, 'document-page-count-changed 처리기가 없다');
  assert.match(handler, /this\.cursor\.updateRect\(\);/, '캐럿 좌표를 다시 계산해야 한다');
  assert.match(handler, /this\.updateCaret\(\);/, '스크롤을 건너뛰면 화면이 안 따라간다');
  assert.doesNotMatch(handler, /this\.updateCaret\(true\)/);
});

const selectionRenderer = readFileSync(
  new URL('../src/engine/selection-renderer.ts', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

/**
 * 선택 영역에 진한 선이 생기던 것을 막는다.
 *
 * 상자마다 반투명으로 칠하면 상자가 겹치는 자리가 두 번 칠해져 진한 선이 생긴다. 줄과
 * 줄이 맞닿는 자리, 한 줄이 여러 조각으로 나뉘는 자리 모두에서다. 좌표를 픽셀 격자에
 * 맞춰 겹침을 없애 보았지만 화면 전체에 확대(`--ui-scale`)가 걸려 있어 맞춰 둔 정수
 * 좌표가 다시 소수가 된다 — 좌표로는 막을 수 없다.
 *
 * 그래서 상자는 **불투명**하게 칠하고 투명도는 겹에 한 번만 준다. 겹쳐도 같은 색이라
 * 진해지지 않고, 합성할 때 한 번 투명해지므로 농도는 그대로다.
 */
test('선택 상자는 불투명하게 칠하고 투명도는 겹에 준다', () => {
  // 색은 앱의 글자색을 옅게 깐 따뜻한 중성색이다. 파랑이 아닌 이유는 그 파일 주석에.
  assert.match(selectionRenderer, /const SELECTION_FILL = 'rgb\(87,80,74\)';/);
  assert.match(selectionRenderer, /const SELECTION_OPACITY = '0\.22';/);
  // 상자 색에 알파가 있으면 겹치는 자리가 다시 진해진다.
  assert.doesNotMatch(selectionRenderer, /background:rgba\(/);
  assert.match(selectionRenderer, /background:\$\{SELECTION_FILL\}/);
  assert.match(selectionRenderer, /opacity:\$\{SELECTION_OPACITY\};/);
});

const keyboard = readFileSync(
  new URL('../src/engine/input-handler-keyboard.ts', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

/**
 * 모두 선택(Ctrl+A)은 화면을 옮기지 않는다.
 *
 * 모두 선택은 캐럿을 문서 끝으로 보낸다. 캐럿을 따라가면 보던 자리를 잃고 문서 맨 아래로
 * 끌려간다 — 복사하려고 눌렀을 뿐인데 읽던 자리가 사라진다. 다른 워드프로세서도 이때는
 * 화면을 옮기지 않는다.
 */
test('모두 선택은 화면을 그대로 둔다', () => {
  const fn = keyboard.slice(
    keyboard.indexOf('export function handleSelectAll'),
    keyboard.indexOf('export function onCopy'),
  );
  assert.ok(fn.length > 0, 'handleSelectAll 을 찾지 못했다');
  assert.match(fn, /this\.updateCaret\(true\);/, '스크롤을 건너뛰어야 한다');
  assert.doesNotMatch(fn, /this\.updateCaret\(\);/);
});
