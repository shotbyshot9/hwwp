import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DOCUMENT_COLOR_PRESETS,
  HIGHLIGHT_COLOR_PRESETS,
  TEXT_COLOR_PRESETS,
  parseColorInput,
} from '../src/ui/color-menu.ts';

const toolbar = readFileSync(new URL('../src/ui/toolbar.ts', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

/**
 * 두 색 고르기가 서로 반대로 잘못돼 있었다. 글자색은 누르면 OS 색상환이 바로 떠서
 * 천육백만 색 중에 고르라고 했고, 형광펜은 스워치 마흔두 개를 깔았다.
 */
test('글자색은 색상환이 아니라 프리셋으로 연다', () => {
  assert.doesNotMatch(indexHtml, /id="text-color-picker"/, 'OS 색상환 입력칸이 남아 있다');
  assert.doesNotMatch(toolbar, /colorPicker/);
  assert.match(indexHtml, /id="text-color-palette"/);
  assert.match(toolbar, /presets: TEXT_COLOR_PRESETS/);
});

test('프리셋은 훑을 수 있는 개수로 둔다', () => {
  // 한 줄에 여섯이면 두 줄로 끝난다. 마흔둘은 "이 중에 뭘" 을 묻게 만든다.
  assert.equal(DOCUMENT_COLOR_PRESETS.length, 12);
  // 색만으로 알리지 않는다 — 이름이 있어야 title·aria-label 을 붙일 수 있다.
  for (const p of DOCUMENT_COLOR_PRESETS) {
    assert.match(p.value, /^#[0-9a-f]{6}$/, `${p.label} 의 값이 #rrggbb 가 아니다`);
    assert.ok(p.label.length > 0);
  }
});

test('글자색과 배경색은 같은 한 벌을 쓴다', () => {
  // 오피스가 「글꼴 색」과 「음영」에 같은 색판을 내미는 방식이다. 배경만 따로 밝은 색
  // 여섯을 갖고 있던 시절에는 어두운 배경이 하나도 없어서, "배경을 깔고 흰 글자를
  // 얹는" 흔한 짜임을 아예 만들 수 없었다.
  assert.equal(TEXT_COLOR_PRESETS, DOCUMENT_COLOR_PRESETS);
  assert.equal(HIGHLIGHT_COLOR_PRESETS, DOCUMENT_COLOR_PRESETS);
});

/** 두 색의 명암 대비. WCAG 계산식 그대로다. */
function contrast(a: string, b: string): number {
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = (hex: string) => {
    const [r, g, b2] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b2);
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('배경으로 쓰는 모든 색에 검정이든 흰색이든 한쪽은 읽힌다', () => {
  /*
   * 예전 규칙은 "형광펜은 밝아야 한다" 였다. 그건 검은 글자를 전제한 것이라 흰 글자를
   * 쓰는 순간 틀린다. 지금 규칙은 밝기가 아니라 **짝** 이다 — 어떤 배경이든 위에 얹을
   * 글자색이 하나는 있어야 한다.
   */
  for (const p of DOCUMENT_COLOR_PRESETS) {
    const onBlack = contrast(p.value, '#000000');
    const onWhite = contrast(p.value, '#ffffff');
    assert.ok(
      onBlack >= 4.5 || onWhite >= 4.5,
      `${p.label}(${p.value}) 배경에는 검은 글자도 흰 글자도 읽히지 않는다 `
        + `(검정 ${onBlack.toFixed(1)}, 흰색 ${onWhite.toFixed(1)})`,
    );
  }
});

test('어두운 배경이 적어도 셋은 있다', () => {
  // 「배경 + 흰 글자」 를 만들려면 흰 글자가 읽히는 어두운 배경이 있어야 한다.
  const dark = DOCUMENT_COLOR_PRESETS.filter((p) => contrast(p.value, '#ffffff') >= 4.5);
  assert.ok(dark.length >= 3, `어두운 배경이 ${dark.length}개뿐이다`);
});

test('직접 입력은 사람이 적는 여러 꼴을 받는다', () => {
  assert.equal(parseColorInput('#FF0000'), '#ff0000');
  assert.equal(parseColorInput('ff0000'), '#ff0000');
  assert.equal(parseColorInput('#f00'), '#ff0000');
  assert.equal(parseColorInput('  #00FF80  '), '#00ff80');
  // 색을 값으로 말하는 사람은 보통 이 꼴로 적는다.
  assert.equal(parseColorInput('255,0,0'), '#ff0000');
  assert.equal(parseColorInput('18, 52, 86'), '#123456');
  assert.equal(parseColorInput('0 0 0'), '#000000');
});

test('읽을 수 없는 값은 색으로 만들지 않는다', () => {
  // 아무 색이나 돌려주면 사용자가 적은 것과 다른 색이 조용히 적용된다.
  for (const bad of ['', '  ', 'zzz', '#12345', '#1234567', '256,0,0', '1,2', '1,2,3,4', 'red']) {
    assert.equal(parseColorInput(bad), null, `${JSON.stringify(bad)} 가 색으로 읽혔다`);
  }
});

test('두 고르기가 같은 메뉴를 쓴다', () => {
  // 하나는 색상환, 하나는 스워치 마흔둘이던 시절로 돌아가지 않게 한 곳으로 모았다.
  assert.match(toolbar, /private bindColorDropdown\(opts: \{/);
  assert.equal(toolbar.match(/this\.bindColorDropdown\(\{/g)?.length, 2);
  assert.doesNotMatch(toolbar, /const PALETTE = \[/, '스워치 표가 되살아났다');
});

test('형광펜에만 색 없음이 있다', () => {
  // 글자는 언제나 어떤 색으로든 그려진다 — 되돌리는 것은 검정을 고르는 일이다.
  const highlight = toolbar.slice(
    toolbar.indexOf('setupHighlightPicker'),
    toolbar.indexOf('private bindColorDropdown'),
  );
  assert.match(highlight, /clear: \{ label: '색 없음'/);
  const textColor = toolbar.slice(
    toolbar.indexOf('private setupColorPicker'),
    toolbar.indexOf('setupHighlightPicker'),
  );
  assert.doesNotMatch(textColor, /clear:/);
});

test('드롭다운은 한 번에 하나만 열린다', () => {
  /*
   * 글자색을 열어 둔 채 배경색을 누르면 둘이 겹쳐 떠 있었다.
   *
   * 드롭다운은 저마다 document 의 mousedown 을 듣고 "내 안이 아니면 닫는다" 로 스스로를
   * 닫는데, 여는 단추가 stopPropagation() 을 부르고 있어서 **다른** 드롭다운의 그
   * 처리기가 아예 불리지 않았다. 단추는 자기 드롭다운 안에 있으므로 전파를 열어 두어도
   * 자기가 방금 연 것을 곧바로 닫지는 않는다.
   */
  const toggles = [
    toolbar.slice(toolbar.indexOf('opts.button.addEventListener'), toolbar.indexOf('document.addEventListener', toolbar.indexOf('opts.button.addEventListener'))),
    toolbar.slice(toolbar.indexOf('this.charfxBtn.addEventListener'), toolbar.indexOf('this.charfxMenu.addEventListener')),
  ];
  for (const toggle of toggles) {
    assert.ok(toggle.length > 0, '토글 단추 처리기를 찾지 못했다');
    assert.doesNotMatch(toggle, /stopPropagation/, '여는 단추가 전파를 막으면 다른 메뉴가 안 닫힌다');
  }
  // 닫는 쪽은 그대로 있어야 한다.
  assert.equal(toolbar.match(/document\.addEventListener\('mousedown'/g)?.length, 3);
});
