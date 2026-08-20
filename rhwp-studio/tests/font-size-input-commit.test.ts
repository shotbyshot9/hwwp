import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const toolbar = readFileSync(new URL('../src/ui/toolbar.ts', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n');

/**
 * 크기 칸에 적은 값이 사라지던 결함을 막는다.
 *
 * 신고: "폰트 크기를 바꾸고 본문에 입력하려고 하면 10pt 로 되돌아가 있다."
 *
 * 크기 칸은 Enter 로만 확정했다. 그런데 크기를 적고 그대로 본문을 눌러 글을 쓰는 것이
 * 보통이라, 그 경로에서는 적은 값이 아무 일도 못 하고 사라졌다. 칸은 잠시 새 값을 보여
 * 주다가 커서 자리의 서식을 다시 읽는 순간(`updateFromProps`) 옛 값으로 돌아가서, 눈에는
 * "바꿨는데 되돌아간다" 로 보였다. 아무 오류도 남지 않는 무언 실패였다.
 */
test('크기 칸은 포커스를 잃을 때도 확정한다', () => {
  assert.match(
    toolbar,
    /this\.fontSize\.addEventListener\('blur', \(\) => this\.commitFontSizeInput\(\)\)/,
    'Enter 만 받으면 적고 본문으로 넘어가는 흔한 경로에서 값이 사라진다',
  );
});

test('Enter 도 여전히 확정한다', () => {
  const keydown = toolbar.slice(
    toolbar.indexOf("this.fontSize.addEventListener('keydown'"),
    toolbar.indexOf("this.fontSize.addEventListener('blur'"),
  );
  assert.ok(keydown.length > 0, 'keydown 처리기를 찾지 못했다');
  assert.match(keydown, /if \(e\.key === 'Enter'\)/);
  assert.match(keydown, /this\.commitFontSizeInput\(\)/);
});

test('Esc 는 확정하지 않고 되돌린다', () => {
  // 적다가 그만두는 길이 없으면, 잘못 적은 값이 blur 로 그대로 걸린다.
  const keydown = toolbar.slice(
    toolbar.indexOf("this.fontSize.addEventListener('keydown'"),
    toolbar.indexOf("this.fontSize.addEventListener('blur'"),
  );
  assert.match(keydown, /if \(e\.key === 'Escape'\)/);
  assert.match(keydown, /this\.fontSize\.value = this\.lastFontSizePt\.toFixed\(1\)/);
});

test('읽을 수 없는 값은 걸지 않고 마지막 값으로 되돌린다', () => {
  const commit = toolbar.slice(
    toolbar.indexOf('private commitFontSizeInput()'),
    toolbar.indexOf('private applyFontSizePt('),
  );
  assert.ok(commit.length > 0, 'commitFontSizeInput 을 찾지 못했다');
  assert.match(commit, /if \(isNaN\(pt\) \|\| pt <= 0\)/);
  assert.match(commit, /this\.fontSize\.value = this\.lastFontSizePt\.toFixed\(1\)/);
  // 값이 그대로면 아무 일도 하지 않는다 — 칸을 눌렀다 그냥 나가는 것만으로 서식이
  // 예약되면, 다음 입력에 사용자가 고른 적 없는 크기가 걸린다.
  assert.match(commit, /if \(clamped === this\.lastFontSizePt\)/);
});

test('증감 단추와 칸 확정이 같은 적용 경로를 쓴다', () => {
  // 적용 경로가 갈라져 있으면 한쪽만 고쳐지고 다른 쪽은 옛 동작으로 남는다.
  const applies = toolbar.match(/this\.applyFontSizePt\(/g) ?? [];
  assert.equal(applies.length, 3, '증감 단추 둘과 칸 확정 하나가 같은 경로를 써야 한다');
  const emits = toolbar.match(/emit\('format-char', \{ fontSize:/g) ?? [];
  assert.equal(emits.length, 1, 'format-char 를 내보내는 곳은 applyFontSizePt 하나여야 한다');
});

test('문서에서 크기를 다시 읽을 때 기준값도 같이 맞춘다', () => {
  /*
   * `lastFontSizePt` 는 "정말 바뀌었는가" 의 기준이다. 커서를 옮겨 그 자리의 크기를
   * 칸에 다시 그릴 때 이 값을 안 맞추면 옛 값이 기준으로 남는다. 그러면 옮겨 간 자리의
   * 크기와 같은 값을 적어 넣어도 바뀐 것으로 보고 서식을 예약해, 고른 적 없는 크기가
   * 다음 입력에 걸린다.
   */
  const refresh = toolbar.slice(
    toolbar.indexOf('if (props.fontSize !== undefined) {'),
  ).slice(0, 220);
  assert.match(refresh, /this\.fontSize\.value = pt\.toFixed\(1\)/);
  assert.match(refresh, /this\.lastFontSizePt = pt/);
});
