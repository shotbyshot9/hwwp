import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const toolbar = readFileSync(new URL('../src/ui/toolbar.ts', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n');

/**
 * 툴바에서 고르는 글자 크기는 char-shape-dialog 와 같은 범위(1~4096pt)여야 한다.
 * 대화상자가 100~409600 HWPUNIT 으로 받는 것과 같은 범위다.
 *
 * 예전에는 죔이 세 군데(칸 확정·▲·▼)에 흩어져 있었고 이 시험도 그 자리들을 글자 그대로
 * 못 박았다. 지금은 셋 다 applyFontSizePt 한 곳으로 들어가므로 거기서만 확인한다 —
 * 죔이 한 곳이면 새 진입점이 생겨도 빠뜨릴 자리가 없다.
 */
test('글자 크기는 1~4096pt 로 죈다', () => {
  const apply = toolbar.slice(
    toolbar.indexOf('private applyFontSizePt('),
    toolbar.indexOf('private applyFontSizePt(') + 400,
  );
  assert.ok(apply.length > 0, 'applyFontSizePt 를 찾지 못했다');
  assert.match(apply, /const clamped = Math\.min\(4096, Math\.max\(1, pt\)\);/);
});

test('크기를 거는 길이 하나뿐이라 죔을 우회할 수 없다', () => {
  // 어느 한 곳이라도 직접 format-char 를 내보내면 그 경로만 죔 없이 지나간다.
  const emits = toolbar.match(/emit\('format-char', \{ fontSize:/g) ?? [];
  assert.equal(emits.length, 1, 'fontSize 를 내보내는 곳은 applyFontSizePt 하나여야 한다');
  const applies = toolbar.match(/this\.applyFontSizePt\(/g) ?? [];
  assert.equal(applies.length, 3, '칸 확정 하나와 증감 단추 둘이 그 길을 쓴다');
});

test('증감 단추는 1pt 씩 움직인다', () => {
  assert.match(toolbar, /this\.applyFontSizePt\(\(parseFloat\(this\.fontSize\.value\) \|\| 10\) \+ 1\)/);
  assert.match(toolbar, /this\.applyFontSizePt\(\(parseFloat\(this\.fontSize\.value\) \|\| 10\) - 1\)/);
});
