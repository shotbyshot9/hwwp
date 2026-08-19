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
test('데스크톱에서는 접지 않는다', () => {
  assert.match(toolbarCss, /@media \(min-width: 1280px\)[\s\S]*?flex-wrap: nowrap;/);
  // 1280px 아래는 손대지 않는다. 서식 바는 767px 아래에서 통째로 세로가 되는데,
  // 거기에 "한 줄에 넣고 나머지는 넘김" 을 얹으면 두 번째 칸부터 전부 넘침으로 들어간다.
  assert.match(overflow, /const DESKTOP_MIN_WIDTH = 1280;/);
  assert.match(overflow, /if \(window\.innerWidth < DESKTOP_MIN_WIDTH\)/);
  assert.match(styleBarCss, /#style-bar \{[^}]*flex-wrap: wrap;/s);
});

test('폭 재기는 확대 배율에 오염되지 않는다', () => {
  // 앱 크롬에는 --ui-scale 만큼 CSS zoom 이 걸려 있다. getBoundingClientRect() 는
  // 확대된 픽셀을, clientWidth 는 확대 전 픽셀을 준다. 섞으면 오른쪽이 훤히 비어
  // 있는데도 넘침 단추가 뜬다.
  assert.match(overflow, /const width = item\.offsetWidth;/);
  assert.doesNotMatch(overflow, /getBoundingClientRect\(\)\.width/);
});

test('프레임이 오지 않아도 다시 계산한다', () => {
  // 탭이 가려져 requestAnimationFrame 이 멈추면 "이미 예약했다" 빗장이 영영 안 풀려
  // 창을 넓혀도 넘침 메뉴가 그대로 남는다.
  assert.match(overflow, /this\.timer = window\.setTimeout\(run, 120\);/);
  assert.doesNotMatch(overflow, /if \(this\.frame !== null\) return;/);
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

test('메뉴바는 제목 줄과 한 줄을 쓴다', () => {
  const titleBarCss = readFileSync(
    new URL('../src/styles/title-bar.css', import.meta.url),
    'utf8',
  );
  const menuBarCss = readFileSync(
    new URL('../src/styles/menu-bar.css', import.meta.url),
    'utf8',
  );
  // 제목 줄 66px + 메뉴바 36px 이 각자 한 줄을 쓰고 있었다. 합치면 그만큼이 편집
  // 영역으로 간다.
  const titleBar = indexHtml.slice(
    indexHtml.indexOf('<div id="title-bar">'),
    indexHtml.indexOf('<div id="icon-toolbar"'),
  );
  assert.ok(titleBar.includes('<nav id="menu-bar"'), '메뉴바가 제목 줄 안에 있어야 한다');
  // 줄을 따로 차지하지 않으므로 자기 바탕과 아래 선, 고정 높이는 버린다.
  assert.doesNotMatch(menuBarCss, /#menu-bar \{[^}]*border-bottom:/s);
  assert.doesNotMatch(menuBarCss, /#menu-bar \{[^}]*height: 28px;/s);
  // 폭이 좁으면 메뉴가 제 줄로 내려가야 한다 — 모바일 햄버거 규칙이 그대로 살아 있다.
  assert.match(titleBarCss, /#title-bar \{[^}]*flex-wrap: wrap;/s);
});

test('제목은 메뉴 위에, 로고는 둘의 왼쪽에 선다', () => {
  const titleBarCss = readFileSync(
    new URL('../src/styles/title-bar.css', import.meta.url),
    'utf8',
  );
  // 한 줄에 나란히 놓으면 "새 문서 ......... 파일 편집 보기" 가 되어 제목과 메뉴가
  // 아무 관계 없는 두 물건처럼 멀어진다. 구글 독스처럼 쌓아야 한 덩어리로 읽힌다.
  const brandIndex = indexHtml.indexOf('class="tbar-brand"');
  const stackIndex = indexHtml.indexOf('class="tbar-stack"');
  const titleIndex = indexHtml.indexOf('id="tbar-title"');
  const menuIndex = indexHtml.indexOf('id="menu-bar"');
  assert.ok(brandIndex >= 0 && brandIndex < stackIndex, '로고가 쌓은 덩어리보다 앞에 온다');
  assert.ok(stackIndex < titleIndex && titleIndex < menuIndex, '제목이 메뉴보다 앞에 온다');
  assert.match(titleBarCss, /\.tbar-stack \{[^}]*flex-direction: column;/s);
  // 두 줄의 높이를 로고가 감당한다.
  assert.match(titleBarCss, /\.tbar-brand \{[^}]*width: 40px;/s);
});

test('제목 덩어리가 연결 단추를 오른쪽 끝으로 밀지 않는다', () => {
  const titleBarCss = readFileSync(
    new URL('../src/styles/title-bar.css', import.meta.url),
    'utf8',
  );
  // .tbar-spacer 주석이 적어 둔 결정이다 — flex:1 로 단추를 화면 끝까지 밀면 시선이
  // 닿지 않아 못 찾는다. 제목과 메뉴를 쌓으면서 그 덩어리에 flex:1 을 주면 같은 일이
  // 다시 벌어진다.
  assert.match(titleBarCss, /\.tbar-stack \{[^}]*flex: 0 1 auto;/s);
  assert.doesNotMatch(titleBarCss, /\.tbar-stack \{[^}]*flex: 1 1 auto;/s);
  assert.match(titleBarCss, /\.tbar-spacer \{[^}]*flex: 0 0 28px;/s);
});
