import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const styleDir = new URL('../src/styles/', import.meta.url);
const cssFiles = readdirSync(styleDir).filter((f) => f.endsWith('.css'));
const allCss = cssFiles
  .map((f) => readFileSync(new URL(f, styleDir), 'utf8'))
  .join('\n');
const toolbarCss = readFileSync(new URL('toolbar.css', styleDir), 'utf8');
const menuBarCss = readFileSync(new URL('menu-bar.css', styleDir), 'utf8');
const baseCss = readFileSync(new URL('base.css', styleDir), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('한컴 SVG 스프라이트는 저장소에서 사라졌다', () => {
  // 아이콘은 미술저작물이라 "파일 형식 호환" 이라는 명분이 닿지 않는다. 좌표로 잘라 쓰던
  // 스프라이트 두 장(밝은판·어두운판)을 Lucide 개별 SVG 로 갈아 끼웠다.
  assert.equal(
    existsSync(new URL('../public/images/', import.meta.url)),
    false,
    'public/images 는 스프라이트만 담고 있었으므로 통째로 없어야 한다',
  );
  assert.doesNotMatch(allCss, /--ui-icon-sprite-url/);
  assert.doesNotMatch(allCss, /icon_small_ko/);
  assert.doesNotMatch(indexHtml, /icon_small_ko/);
  assert.doesNotMatch(allCss, /background-position:\s*calc\(-40px/);
});

test('CSS 가 가리키는 아이콘 파일이 모두 실제로 있다', () => {
  const referenced = [...allCss.matchAll(/\/icons\/ui\/([a-z0-9-]+\.svg)/g)].map((m) => m[1]);
  assert.ok(referenced.length >= 24, `아이콘 참조가 너무 적다: ${referenced.length}`);
  for (const name of new Set(referenced)) {
    assert.ok(
      existsSync(new URL(`../public/icons/ui/${name}`, import.meta.url)),
      `참조만 있고 파일이 없다: ${name}`,
    );
  }
});

test('아이콘은 마스크 + currentColor 라서 테마별 두 번째 파일이 필요 없다', () => {
  assert.match(toolbarCss, /background-color: currentColor;/, '아이콘은 글자색을 따라가야 한다');
  assert.match(toolbarCss, /mask: var\(--icon-url,/, '아이콘은 --icon-url 을 마스크로 써야 한다');
  // 어두운 테마가 아이콘 파일을 따로 지정하지 않는다는 것이 이 방식의 요점이다.
  assert.doesNotMatch(baseCss, /icons\/ui/);
});

test('메뉴 드롭다운은 아이콘을 쓰지 않는다', () => {
  // 244행 중 41행(17%)만 그림이 있었다. 일부만 아이콘인 목록은 규칙이 아니라 미완성으로
  // 읽히고, 그림에 왼쪽 칸을 뺏긴 탓에 켜짐 표시가 배경색을 호버와 나눠 쓰게 됐다.
  // 아이콘은 도구 상자가 맡고, 메뉴의 왼쪽 칸은 상태로 돌려줬다.
  assert.doesNotMatch(menuBarCss, /--icon-url/);
  assert.doesNotMatch(indexHtml, /md-icon/);
  assert.doesNotMatch(
    readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'),
    /'md-icon'/,
    '최근 문서 메뉴가 아이콘 칸을 다시 만들고 있다',
  );
});

test('--icon-url 이 없는 칸은 비워진다', () => {
  // 대비값이 없으면 마스크가 none 이 되고 currentColor 배경이 그대로 드러나 글자색
  // 네모가 찍힌다. 지금은 도구 상자의 모든 칸이 그림을 갖고 있지만, 그림 없는 버튼이
  // 하나 들어오는 순간 되살아나는 함정이라 대비값을 남겨 둔다.
  assert.match(toolbarCss, /mask: var\(--icon-url, linear-gradient\(transparent, transparent\)\)/);
});

test('조판·문단 부호도 같은 아이콘 체계를 쓰되 색만 표시색으로 둔다', () => {
  // 이 둘만 글꼴 글자(¶·↵)로 그리고 있었다. 획 굵기가 나머지와 달랐고 serif 가
  // OS 마다 다른 글꼴로 잡혀 모양이 기기마다 달라졌다. Lucide 의 pilcrow·
  // corner-down-left 로 옮겨 같은 방식·같은 획으로 맞췄다.
  assert.doesNotMatch(toolbarCss, /content: '¶'/, '글자로 그리던 방식이 남아 있다');
  assert.doesNotMatch(toolbarCss, /content: '↵'/);
  assert.match(toolbarCss, /\.icon-ctrl-mark \{ --icon-url: url\("\/icons\/ui\/ctrl-mark\.svg"\); \}/);
  assert.match(toolbarCss, /\.icon-para-mark \{ --icon-url: url\("\/icons\/ui\/para-mark\.svg"\); \}/);
  // 색은 예외다. 나머지는 글자색을 따라가지만 이 둘은 렌더러가 용지에 그리는 색과
  // 같아야 "켜면 무엇이 나오는지" 를 미리 보여준다.
  assert.match(
    toolbarCss,
    /\.icon-ctrl-mark,\s*\n\.icon-para-mark \{\s*\n\s*background-color: var\(--mark-color\);/,
  );
});

test('상태 바 줌 아이콘도 같은 체계를 쓴다', () => {
  const statusBarCss = readFileSync(new URL('status-bar.css', styleDir), 'utf8');
  for (const cls of ['zoom-out', 'zoom-in', 'zoom-fit-width', 'zoom-fit']) {
    assert.match(
      statusBarCss,
      new RegExp(`\\.icon-${cls}\\s+\\{ --icon-url: url\\("/icons/ui/${cls}\\.svg"\\); \\}`),
      `.icon-${cls} 가 스프라이트 좌표에 남아 있다`,
    );
  }
});

test('아이콘 획은 UI 선 굵기와 한 가족이다', () => {
  // Lucide 기본값 2 는 24px 로 그릴 때를 전제한다. 우리는 18px(도구 모음)·16px(메뉴)로
  // 줄여 그리므로 실효 굵기가 1.5·1.33px 이 되어 옆의 1px 테두리보다 굵었다. 1.75 로
  // 낮추면 1.31·1.17px — 같은 계열로 읽힌다.
  const dir = new URL('../public/icons/ui/', import.meta.url);
  const svgs = readdirSync(dir).filter((f) => f.endsWith('.svg'));
  assert.ok(svgs.length >= 24);
  for (const f of svgs) {
    const body = readFileSync(new URL(f, dir), 'utf8');
    assert.match(body, /stroke-width="1\.75"/, `${f} 의 획 굵기가 다르다`);
  }
});

test('모서리 반지름은 세 값뿐이다', () => {
  // 토큰이 3·5·7px 이던 시절에도 CSS 에 2·3·4·6·8·10·12·999px 가 박혀 있어 실제로는
  // 여덟 종류가 돌아다녔다. 새 규칙은 토큰만 쓴다.
  for (const f of cssFiles) {
    const css = readFileSync(new URL(f, styleDir), 'utf8');
    for (const decl of css.match(/border-radius:[^;]+/g) ?? []) {
      assert.doesNotMatch(decl, /[0-9]+px/, `${f} 에 하드코딩된 반지름이 있다: ${decl}`);
    }
  }
  assert.match(readFileSync(new URL('base.css', styleDir), 'utf8'), /--radius-control: 4px;/);
  assert.match(readFileSync(new URL('base.css', styleDir), 'utf8'), /--radius-container: 8px;/);
});

test('그림자는 위에서 아래로만 떨어진다', () => {
  // 오른쪽 아래로 흐르는 그림자는 광원이 왼쪽 위에 있다고 가정하던 시절의 관습이다.
  const base = readFileSync(new URL('base.css', styleDir), 'utf8');
  for (const decl of base.match(/--shadow-[a-z]+:[^;]+/g) ?? []) {
    assert.match(decl, /:\s*0 /, `그림자에 가로 오프셋이 남아 있다: ${decl}`);
  }
});

test('도구 모음 배경은 단색이다', () => {
  const toolbar = readFileSync(new URL('toolbar.css', styleDir), 'utf8');
  assert.doesNotMatch(toolbar, /linear-gradient\(to bottom/);
  assert.match(toolbar, /background: var\(--ui-toolbar-bg\);/);
});
