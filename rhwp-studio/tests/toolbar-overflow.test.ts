import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const overflow = readFileSync(
  new URL('../src/view/toolbar-overflow.ts', import.meta.url),
  'utf8',
);
const toolbarCss = readFileSync(
  new URL('../src/styles/toolbar.css', import.meta.url),
  'utf8',
);
const styleBarCss = readFileSync(
  new URL('../src/styles/style-bar.css', import.meta.url),
  'utf8',
);
const mainTs = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

/**
 * 두 도구 모음이 폭이 모자라면 두 줄로 접혔다. 접히는 순간 높이가 두 배가 되는데,
 * 하필 세로가 짧은 화면에서 접힌다. 1280×720 에서 크롬이 화면의 63% 를 먹고 글 쓸
 * 자리가 270px 밖에 남지 않았다.
 */
test('도구 모음은 접히지 않는다', () => {
  assert.match(toolbarCss, /#icon-toolbar \{[^}]*flex-wrap: nowrap;/s);
  assert.match(styleBarCss, /#style-bar \{[^}]*flex-wrap: nowrap;/s);
  assert.doesNotMatch(toolbarCss, /#icon-toolbar \{[^}]*flex-wrap: wrap;/s);
  assert.doesNotMatch(styleBarCss, /#style-bar \{[^}]*flex-wrap: wrap;/s);
});

test('넘치는 것은 » 안으로 보낸다', () => {
  assert.match(mainTs, /installToolbarOverflow\('#icon-toolbar'\)/);
  assert.match(mainTs, /installToolbarOverflow\('#style-bar'\)/);
  assert.match(toolbarCss, /\.tb-overflow-panel \{/);
  // 넘치는 것이 없으면 단추 자체가 보이지 않아야 한다.
  assert.match(toolbarCss, /\.tb-overflow \{[^}]*display: none;/s);
  assert.match(toolbarCss, /\.tb-overflow\.tb-overflow-active \{[^}]*display: flex;/s);
});

test('옮기는 단위는 버튼이 아니라 그룹이다', () => {
  // 그룹 가운데가 잘리면 남은 쪽이 무슨 무리인지 알 수 없다.
  assert.match(overflow, /\[\.\.\.host\.children\]/);
  assert.doesNotMatch(overflow, /querySelectorAll\('\.tb-btn'\)/);
});

test('스스로 옮긴 것에 다시 반응하지 않는다', () => {
  // layout() 이 DOM 을 옮기는데 그 변화를 MutationObserver 가 다시 잡으면 무한히 돈다.
  assert.match(overflow, /private applying = false;/);
  assert.match(overflow, /if \(this\.applying\) return;/);
  assert.match(overflow, /this\.applying = true;/);
  assert.match(overflow, /\} finally \{\s*\n\s*this\.applying = false;/);
});

test('모드 전환으로 그룹이 감춰져도 다시 계산한다', () => {
  // 머리말·주석 모드는 style.display 만 바꾼다. 바깥 치수가 그대로라 ResizeObserver 는
  // 울지 않는다.
  assert.match(overflow, /attributeFilter: \['style'\]/);
  assert.match(overflow, /subtree: true/);
});

test('리본 그룹 캡션은 걷어내고 입력칸 이름은 낭독기에 남긴다', () => {
  assert.doesNotMatch(indexHtml, /sb-ribbon-label/);
  // label 을 지우면 선택 상자가 이름을 잃는다. 화면에서만 감춘다.
  assert.match(styleBarCss, /\.sb-field-ribbon-group \.sb-field-label \{[^}]*clip-path: inset\(50%\);/s);
  assert.match(indexHtml, /<label class="sb-field-label" for="font-name">글꼴<\/label>/);
});
