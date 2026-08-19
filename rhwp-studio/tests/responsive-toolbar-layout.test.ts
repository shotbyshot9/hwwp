import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const toolbar = readFileSync(new URL('../src/styles/toolbar.css', import.meta.url), 'utf8');
const styleBar = readFileSync(new URL('../src/styles/style-bar.css', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../src/styles/responsive.css', import.meta.url), 'utf8');

/*
 * 예전에는 폭이 모자라면 줄을 늘려 접었다. 그러면 도구 상자 높이가 60px 에서 125px 로
 * 두 배가 되는데, 접힘은 하필 세로가 짧은 화면에서 일어난다 — 1280×720 에서 크롬이
 * 화면의 63% 를 먹고 글 쓸 자리가 270px 밖에 남지 않았다.
 *
 * 이제 접지 않고 넘치는 그룹만 `»` 로 보낸다. 지키려던 것 둘은 그대로다 — 가로
 * 스크롤을 만들지 않는 것과, 그룹을 반으로 자르지 않는 것.
 */
test('icon toolbar keeps one row and sends overflow to the menu', () => {
  assert.match(toolbar, /#icon-toolbar\s*\{[^}]*flex-wrap:\s*nowrap;/s);
  assert.match(toolbar, /#icon-toolbar\s*\{[^}]*height:\s*auto;/s);
  assert.match(toolbar, /#icon-toolbar\s*\{[^}]*min-height:\s*56px;/s);
  assert.match(toolbar, /\.tb-group\s*\{[^}]*flex-shrink:\s*0;/s);
  // 가로 스크롤은 예나 지금이나 답이 아니다.
  assert.doesNotMatch(toolbar, /#icon-toolbar\s*\{[^}]*overflow-x:\s*auto;/s);
});

test('constrained layouts hide top-level separators and do not scroll the toolbar', () => {
  assert.match(
    responsive,
    /@media\s*\(max-width:\s*1279px\)[\s\S]*?#icon-toolbar\s*>\s*\.tb-sep,\s*#style-bar\s*>\s*\.sb-sep\s*\{[^}]*display:\s*none;/,
  );
  assert.match(
    responsive,
    /@media\s*\(max-width:\s*1023px\)[\s\S]*?#icon-toolbar\s*\{[^}]*min-height:\s*40px;/,
  );

  const mobileToolbar = responsive.match(
    /@media\s*\(max-width:\s*767px\)[\s\S]*?#icon-toolbar\s*\{([^}]*)\}/,
  );
  assert.ok(mobileToolbar);
  assert.doesNotMatch(mobileToolbar[1], /overflow-x:\s*auto/);
  assert.doesNotMatch(mobileToolbar[1], /-webkit-overflow-scrolling/);
});

test('style ribbon keeps one row and sends overflow to the menu', () => {
  assert.match(styleBar, /#style-bar\s*\{[^}]*flex-wrap:\s*nowrap;/s);
  assert.match(styleBar, /#style-bar\s*\{[^}]*height:\s*auto;/s);
  // 캡션을 걷어내 한 줄이 낮아졌다(68 → 44).
  assert.match(styleBar, /#style-bar\s*\{[^}]*min-height:\s*44px;/s);
  assert.match(styleBar, /#style-bar\s*\{[^}]*overflow:\s*visible;/s);

  assert.match(
    responsive,
    /@media\s*\(max-width:\s*1279px\)[\s\S]*?#icon-toolbar\s*>\s*\.tb-sep,\s*#style-bar\s*>\s*\.sb-sep\s*\{[^}]*display:\s*none;/,
  );

  const responsiveStyleBarRules = [...responsive.matchAll(/#style-bar\s*\{([^}]*)\}/g)];
  assert.ok(responsiveStyleBarRules.some((rule) => /min-height:\s*40px/.test(rule[1])));
  for (const rule of responsiveStyleBarRules) {
    assert.doesNotMatch(rule[1], /^\s*height:\s*40px/m);
    assert.doesNotMatch(rule[1], /overflow-x:\s*auto/);
  }
});

test('tablet style ribbon uses compact field and command tracks instead of tall wrapped groups', () => {
  const tabletStart = responsive.indexOf('@media (min-width: 768px) and (max-width: 1023px)');
  const mobileStart = responsive.indexOf('/* ─── 모바일', tabletStart);
  assert.ok(tabletStart >= 0);
  assert.ok(mobileStart > tabletStart);
  const tabletRibbon = responsive.slice(tabletStart, mobileStart);
  assert.match(
    tabletRibbon,
    /#style-bar\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*max-content max-content;/s,
  );
  assert.match(
    tabletRibbon,
    /\.sb-field-ribbon-group\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/s,
  );
  assert.match(tabletRibbon, /\.sb-ribbon-group\s*\{[^}]*min-height:\s*0;/s);
  assert.match(tabletRibbon, /\.sb-ribbon-label\s*\{[^}]*display:\s*none;/s);
  assert.match(
    tabletRibbon,
    /\.sb-paragraph-band\s*\{[^}]*grid-column:\s*2;/s,
  );
});
