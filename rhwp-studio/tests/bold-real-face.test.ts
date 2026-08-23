import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * 진하게는 **진짜 굵은 글꼴 파일**로 그린다.
 *
 * 무엇이 문제였나. `@font-face` 는 굵기 서술자가 없으면 400(normal) 이다. 예전에는 모든
 * 글꼴이 그렇게 등록돼 있어서, 캔버스가 `font: bold 14px "나눔명조"` 를 요청하면 브라우저는
 * 400 짝밖에 못 찾고 **가짜 볼드**를 만들었다 — 획을 프로그램이 부풀리는 것이라 ㅁ·ㅇ·ㅂ 의
 * 속공간이 메워지고 가장자리가 회색으로 번진다. 획이 빽빽한 한글에서 특히 심하다.
 *
 * 굵은 파일은 이미 저장소에 있었다. 짝이 지어지지 않았을 뿐이다.
 *
 * 이 시험이 지키는 것은 "가짜 볼드로 되돌아가지 않는다" 이다. 굵은 짝의 700 서술자가
 * 빠지거나 파일 이름이 어긋나면 화면은 그대로 나오되 조용히 흐릿해진다 — 눈으로만 보면
 * 알아채기 어려운 종류의 되돌아감이라 시험으로 걸어 둔다.
 */

const loader = readFileSync(new URL('../src/core/font-loader.ts', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n');

/** `BOLD_FONT_LIST` 안의 { name, file } 짝을 걷는다. */
function boldEntries(): Array<{ name: string; file: string }> {
  const block = loader.match(/const BOLD_FONT_LIST: FontEntry\[\] = \[([\s\S]*?)\n\];/);
  assert.ok(block, 'BOLD_FONT_LIST 를 찾지 못했다');
  const entries: Array<{ name: string; file: string }> = [];
  for (const line of block[1].split('\n')) {
    const m = line.match(/\{\s*name:\s*'([^']+)',\s*file:\s*([^,]+),/);
    if (m) entries.push({ name: m[1], file: m[2].trim() });
  }
  assert.ok(entries.length >= 20, `굵은 짝이 너무 적다: ${entries.length}`);
  return entries;
}

test('굵은 짝은 모두 700 으로 등록된다', () => {
  const block = loader.match(/const BOLD_FONT_LIST: FontEntry\[\] = \[([\s\S]*?)\n\];/)![1];
  const rows = block.split('\n').filter(line => line.includes('name:'));
  for (const row of rows) {
    assert.match(row, /weight: '700'/, `700 이 없는 굵은 짝: ${row.trim()}`);
  }
});

test('굵은 짝이 가리키는 글꼴 파일이 실제로 있다', () => {
  const shipped = new Set(readdirSync(new URL('../../assets/fonts/', import.meta.url)));
  for (const { name, file } of boldEntries()) {
    // CDN 상수(함초롬바탕 등)는 이름으로 들어오므로 로컬 파일 검사에서 뺀다.
    const m = file.match(/^'fonts\/(.+)'$/);
    if (!m) {
      assert.match(file, /^CDN_/, `알 수 없는 파일 지정: ${name} → ${file}`);
      continue;
    }
    assert.ok(shipped.has(m[1]), `${name} 의 굵은 파일이 없다: ${m[1]}`);
  }
});

test('굵은 짝의 이름은 보통 글꼴 목록에 실제로 있는 이름이다', () => {
  // 이름이 어긋나면 브라우저는 그 700 얼굴을 아무 데도 못 붙인다 — 조용히 가짜 볼드로
  // 돌아가고, 대신 쓰지도 않는 글꼴 파일을 내려받는다.
  const regularBlock = loader.match(/const FONT_LIST: FontEntry\[\] = \[([\s\S]*?)\n\];/);
  assert.ok(regularBlock, 'FONT_LIST 를 찾지 못했다');
  const regularNames = new Set(
    [...regularBlock[1].matchAll(/\{\s*name:\s*'([^']+)'/g)].map(m => m[1]),
  );
  for (const { name } of boldEntries()) {
    assert.ok(regularNames.has(name), `보통 글꼴 목록에 없는 이름: ${name}`);
  }
});

test('굵은 짝의 @font-face 에 font-weight 가 실린다', () => {
  // 등록 문자열을 만드는 자리. 여기서 서술자가 빠지면 목록에 700 을 적어 둬도 소용없다.
  assert.match(loader, /f\.weight \? ` font-weight: \$\{f\.weight\};` : ''/);
  assert.match(loader, /font-display: swap;\$\{wt\}/);
});

test('FontFace 로 심을 때도 굵기를 함께 넘긴다', () => {
  // `new FontFace(name, src)` 는 서술자가 없으면 400 이다. 여기서 굵기를 빠뜨리면
  // CSS 쪽만 맞고 실제 로드된 얼굴은 400 이 되어 다시 가짜 볼드가 된다.
  assert.match(loader, /entry\.weight \? \{ weight: entry\.weight \} : undefined/);
});

test('렌더러는 진짜 굵은 얼굴을 물었을 때 부풀리지 않는다', () => {
  const renderer = readFileSync(
    new URL('../src/view/canvaskit-renderer.ts', import.meta.url),
    'utf8',
  ).replace(/\r\n/g, '\n');

  // 굵은 이름으로 먼저 찾는다.
  assert.match(renderer, /this\.findPreparedTypeface\(boldFamilyName\(requestedFontFamily\)\)/);
  // 진짜 굵은 얼굴이면 부풀리기를 끈다 — 겹치면 지나치게 굵어진다.
  assert.match(renderer, /setEmbolden\?\.\(style\.bold === true && !realBoldFace\)/);
  assert.match(renderer, /adjustFont\(font, boldTypeface !== null\)/);
});
