import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/style-bar.css', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../src/styles/responsive.css', import.meta.url), 'utf8');

const buttonMarkup = (id: string): string => {
  const match = html.match(new RegExp(`<button[^>]*id="${id}"[\\s\\S]*?<\\/button>`));
  assert.ok(match, `missing #${id}`);
  return match[0];
};

test('style toolbar uses ordered field and command groups', () => {
  const fields = html.indexOf('class="sb-field-grid"');
  const characters = html.indexOf('class="sb-command-band sb-character-band"');
  const paragraphs = html.indexOf('class="sb-command-band sb-paragraph-band"');

  assert.ok(fields >= 0);
  assert.ok(fields < characters);
  assert.ok(characters < paragraphs);
  assert.match(html, /class="sb-command-group sb-character-group"/);
  assert.match(html, /class="sb-command-group sb-color-group"/);
  assert.match(html, /class="sb-command-group sb-align-group"/);

  const fieldGrid = html.slice(fields, characters);
  for (const id of ['style-name', 'font-lang', 'font-name', 'font-size', 'linespacing-select']) {
    assert.match(fieldGrid, new RegExp(`id="${id}"`));
  }
});

test('style toolbar shows its default before a document is loaded', () => {
  assert.match(
    html,
    /<select id="style-name"[^>]*>\s*<option value="0">바탕글<\/option>\s*<\/select>/,
  );
});

test('desktop formatting surface keeps its group structure', () => {
  // 묶음 자체는 그대로다 — 함께 쓰이는 것들이 붙어 있어야 손이 한 자리에서 끝난다.
  assert.match(html, /class="sb-ribbon-group sb-field-ribbon-group"/);
  assert.match(html, /class="sb-ribbon-group sb-character-ribbon-group"/);
  assert.match(html, /class="sb-ribbon-group sb-color-ribbon-group"/);
  assert.match(html, /class="sb-ribbon-group sb-paragraph-ribbon-group"/);

  // 다만 묶음마다 붙어 있던 캡션(글꼴 및 간격·글자 모양·색·문단)은 걷어냈다. 바로
  // 아래 상자가 이미 "바탕글"·"함초롬바탕" 이라고 말하고 있었고, 접힌 줄마다 19px 를
  // 먹었다. 1280×720 에서 크롬이 화면의 63% 를 차지하던 원인의 한 갈래다.
  for (const label of ['글꼴 및 간격', '글자 모양', '색', '문단']) {
    assert.doesNotMatch(html, new RegExp(`<span class="sb-ribbon-label">${label}<\\/span>`));
  }
  assert.doesNotMatch(styles, /\.sb-ribbon-label\s*\{/);

  assert.match(styles, /#style-bar\s*\{[^}]*align-items:\s*stretch;/s);
  assert.match(styles, /\.sb-ribbon-group\s*\{[^}]*flex-direction:\s*column;/s);
  assert.match(
    styles,
    /\.sb-field-ribbon-group \.sb-field\s*\{[^}]*flex-direction:\s*column;/s,
  );
});

test('only real menus retain dropdown affordances', () => {
  const strike = buttonMarkup('btn-strike');
  assert.doesNotMatch(strike, /sb-has-arrow|sb-dd/);
  assert.match(strike, /sb-strike/);

  for (const id of ['btn-charfx', 'btn-text-color', 'btn-highlight']) {
    const button = buttonMarkup(id);
    assert.match(button, /sb-has-arrow/);
    assert.match(button, /sb-dd/);
  }
  assert.match(buttonMarkup('btn-charfx'), /sb-effect-icon/);
  assert.match(buttonMarkup('btn-text-color'), /sb-color-visual/);
  assert.match(buttonMarkup('btn-highlight'), /sb-highlight-visual/);
});

test('mobile ribbon is compact without hiding command glyphs', () => {
  assert.match(responsive, /#style-bar\s*\{[^}]*flex-direction:\s*column;/s);
  assert.match(
    responsive,
    /\.sb-field-grid\s*\{[^}]*grid-template-columns:\s*68px 54px minmax\(96px,\s*1fr\) 72px 72px;/s,
  );
  assert.match(responsive, /#style-bar \.sb-btn\s*\{[^}]*width:\s*29px;[^}]*height:\s*29px;/s);
  assert.match(responsive, /#style-bar \.sb-has-arrow\s*\{[^}]*width:\s*38px;/s);
  assert.doesNotMatch(responsive, /\.sb-ga\s*\{\s*display:\s*none;/);
});

test('mobile font size field uses one cohesive control shell', () => {
  assert.match(
    responsive,
    /\.sb-field-grid \.sb-size-group\s*\{[^}]*border:\s*1px solid var\(--ui-border-light\);[^}]*border-radius:\s*var\(--radius-sm\);[^}]*overflow:\s*hidden;/s,
  );
  assert.match(
    responsive,
    /\.sb-field-grid \.sb-size\s*\{[^}]*height:\s*100%;[^}]*border:\s*0;[^}]*border-radius:\s*0;/s,
  );
  assert.match(
    responsive,
    /\.sb-field-grid \.sb-size-unit\s*\{[^}]*height:\s*100%;[^}]*border:\s*0;[^}]*border-left:\s*1px solid var\(--ui-border-light\);/s,
  );
  assert.match(
    responsive,
    /\.sb-field-grid \.sb-size-arrows\s*\{[^}]*height:\s*100%;[^}]*border-left:\s*1px solid var\(--ui-border-light\);/s,
  );
  assert.match(
    responsive,
    /\.sb-field-grid \.sb-size-arrows \.sb-arrow\s*\{[^}]*height:\s*50%;[^}]*border:\s*0;[^}]*border-radius:\s*0;/s,
  );
  assert.match(
    responsive,
    /\.sb-field-grid \.sb-size-arrows \.sb-arrow \+ \.sb-arrow\s*\{[^}]*border-top:\s*1px solid var\(--ui-border-light\);/s,
  );
  assert.match(
    responsive,
    /#style-bar #btn-size-up,\s*#style-bar #btn-size-down\s*\{[^}]*border-radius:\s*0;/s,
  );
});

test('font size unit shares the input surface instead of the spinner surface', () => {
  assert.match(
    styles,
    /\.sb-size-unit\s*\{[^}]*background:\s*var\(--color-surface\);/s,
  );
  assert.doesNotMatch(
    styles,
    /\.sb-size-unit\s*\{[^}]*background:\s*var\(--ui-surface-muted\);/s,
  );
});

test('alignment icons use the shared theme-aware mask contract', () => {
  assert.match(styles, /\.sb-align\s*\{[^}]*background-color:\s*currentColor;[^}]*mask/s);
  for (const name of ['left', 'center', 'right', 'justify', 'distribute', 'split']) {
    assert.match(styles, new RegExp(`\\.sb-al-${name}\\s*\\{[^}]*--sb-align-icon:`));
  }
  assert.doesNotMatch(
    styles,
    /\.sb-al-(?:left|center|right|justify|distribute|split)\s*\{[^}]*background-image:/s,
  );
});

test('글자 서식 견본은 모두 같은 글자를 쓴다', () => {
  /*
   * 밑줄만 「간」이었다. rhwp 초기 커밋부터 그랬고 이유가 적힌 곳은 없었다 — 의도가
   * 아니라 어긋난 것이다.
   *
   * 이런 견본에서 글자는 상수여야 한다. 효과만 달라져야 눈이 "무엇이 바뀌는지" 를
   * 집어낼 수 있는데, 글자까지 다르면 밑줄 때문인지 받침 때문인지 구별되지 않는다.
   */
  const samples = [...html.matchAll(/class="sb-ga[^"]*"[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.ok(samples.length >= 5, `견본을 찾지 못했다: ${samples.length}`);
  for (const sample of samples) {
    assert.equal(sample, '가', `견본 글자가 다르다: ${sample}`);
  }
});
