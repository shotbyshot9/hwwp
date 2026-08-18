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
  assert.ok(referenced.length >= 33, `아이콘 참조가 너무 적다: ${referenced.length}`);
  for (const name of new Set(referenced)) {
    assert.ok(
      existsSync(new URL(`../public/icons/ui/${name}`, import.meta.url)),
      `참조만 있고 파일이 없다: ${name}`,
    );
  }
});

test('아이콘은 마스크 + currentColor 라서 테마별 두 번째 파일이 필요 없다', () => {
  for (const [label, css] of [['tb-sprite', toolbarCss], ['md-icon', menuBarCss]] as const) {
    assert.match(css, /background-color: currentColor;/, `${label} 는 글자색을 따라가야 한다`);
    assert.match(css, /mask: var\(--icon-url,/, `${label} 는 --icon-url 을 마스크로 써야 한다`);
  }
  // 어두운 테마가 아이콘 파일을 따로 지정하지 않는다는 것이 이 방식의 요점이다.
  assert.doesNotMatch(baseCss, /icons\/ui/);
});

test('--icon-url 이 없는 칸은 비워진다', () => {
  // 아이콘을 쓰지 않는 메뉴 항목이 121칸 있다. 대비값이 없으면 마스크가 none 이 되고
  // currentColor 배경이 그대로 드러나 글자색 네모가 찍힌다.
  for (const css of [toolbarCss, menuBarCss]) {
    assert.match(css, /mask: var\(--icon-url, linear-gradient\(transparent, transparent\)\)/);
  }
});

test('글자로 그리는 조판·문단 부호는 마스크를 끈다', () => {
  // 마스크는 ::before 까지 가린다. 이 둘은 SVG 가 아니라 ¶·↵ 글자로 그리므로 마스크를
  // 꺼야 글자가 보인다.
  for (const cls of ['icon-ctrl-mark', 'icon-para-mark']) {
    const rule = toolbarCss.slice(
      toolbarCss.indexOf(`.${cls} {`),
      toolbarCss.indexOf(`.${cls}::before`),
    );
    assert.match(rule, /mask: none;/, `.${cls} 는 마스크를 꺼야 한다`);
    assert.match(rule, /background-color: transparent;/, `.${cls} 는 배경을 비워야 한다`);
  }
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
