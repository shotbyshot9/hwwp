import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const viewCmd = readFileSync(new URL('../src/command/commands/view.ts', import.meta.url), 'utf8');

/** view:ctrl-mark 커맨드 본문만 떼어 본다 (view:para-mark 와 섞이지 않게) */
function ctrlMarkBody(): string {
  const start = viewCmd.indexOf("id: 'view:ctrl-mark'");
  const end = viewCmd.indexOf("id: 'view:para-mark'");
  assert.ok(start > 0 && end > start, '두 커맨드를 찾지 못했다');
  return viewCmd.slice(start, end);
}

/**
 * 조판부호를 켜면 문단부호 버튼에도 불이 들어왔다. 두 깃발을 함께 켰기 때문이다.
 *
 * 함께 켤 이유가 없었다 — 렌더러가 이미 둘을 OR 로 묶으므로(paint/builder.rs 의
 * `show_paragraph_marks || show_control_codes`) 조판부호만 켜도 문단 표시는 나온다.
 * 두 번째 깃발은 화면에 아무 영향이 없고 UI 상태만 어긋나게 했다.
 */
test('조판부호가 문단부호 깃발을 건드리지 않는다', () => {
  const body = ctrlMarkBody();
  assert.doesNotMatch(body, /setShowParagraphMarks/);
  assert.match(body, /services\.wasm\.setShowControlCodes\(next\)/);
});

test('조판부호를 눌러도 문단부호의 켜짐 표시는 그대로 둔다', () => {
  // syncTextMarkMenu(next, next) 였다 — 두 번째 인자에 자기 값을 넣어 문단부호까지 켰다.
  assert.match(ctrlMarkBody(), /syncTextMarkMenu\(next, ctx\.showParagraphMarks\)/);
});

test('조판부호를 끌 때 사용자가 켜 둔 문단부호를 함께 끄지 않는다', () => {
  // 같은 결합 때문에 끄는 쪽에서도 조용히 함께 꺼졌다. 위 두 단언이 그것도 막는다.
  const body = ctrlMarkBody();
  assert.doesNotMatch(body, /userSettings\.setShowParagraphMarks/);
});

test('문단부호는 자기 깃발만 만진다', () => {
  const start = viewCmd.indexOf("id: 'view:para-mark'");
  const body = viewCmd.slice(start, start + 900);
  assert.match(body, /services\.wasm\.setShowParagraphMarks\(next\)/);
  assert.doesNotMatch(body, /setShowControlCodes/);
});
