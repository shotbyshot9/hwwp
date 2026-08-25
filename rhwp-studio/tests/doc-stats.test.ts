import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  countControls,
  countText,
  documentStatistics,
  manuscriptPageCount,
} from '../src/core/document-stats.ts';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n');

/** 문단 목록과 개체 목록을 엔진처럼 보이게 감싼다 */
function fakeDoc(sections: string[][], controls: unknown[] = []) {
  return {
    getSectionCount: () => sections.length,
    getParagraphCount: (sec: number) => sections[sec].length,
    getParagraphLength: (sec: number, para: number) => sections[sec][para].length,
    getTextRange: (sec: number, para: number, start: number, end: number) =>
      sections[sec][para].slice(start, end),
    getControls: () => JSON.stringify(controls),
  };
}

test('공백을 넣은 셈과 뺀 셈이 다르다', () => {
  const s = countText('가 나 다');
  assert.equal(s.chars, 5);
  assert.equal(s.charsNoSpace, 3);
  assert.equal(s.words, 3);
});

test('한자만 골라 센다', () => {
  // 한글·가나·문장부호는 빼야 한다. "CJK 면 다" 로 잡으면 히라가나까지 들어온다.
  const s = countText('대한민국 大韓民國 ひらがな, 漢字');
  assert.equal(s.hanja, 6, `한자를 ${s.hanja}개로 셌다`);
});

test('빈 글은 0 이다', () => {
  const s = countText('');
  assert.deepEqual([s.chars, s.charsNoSpace, s.hanja, s.words], [0, 0, 0, 0]);
});

/**
 * 작가가 이 화면에서 먼저 찾는 숫자다. 청탁도 계약도 매수로 하기 때문에
 * 글자수보다 이 값을 본다. 한글과 같은 셈이어야 한다 — 공백 포함 글자수 ÷ 200.
 */
test('원고지 매수는 공백 포함 200자를 한 장으로 센다', () => {
  assert.equal(manuscriptPageCount(0), 0);
  assert.equal(manuscriptPageCount(200), 1);
  assert.equal(manuscriptPageCount(100), 0.5);
  assert.equal(manuscriptPageCount(2460), 12.3);
  // 소수 한 자리까지만 — 12.34 장 같은 숫자는 아무도 안 쓴다.
  assert.equal(manuscriptPageCount(2461), 12.3);
});

test('표·그림·글상자를 갈라 센다', () => {
  // 그리기 개체는 ctrlId 가 전부 'gso' 라 그것만으로는 못 가른다.
  // 엔진이 한글 실측에 맞춰 붙인 이름(userDesc)을 함께 본다.
  const counted = countControls({
    getControls: () => JSON.stringify([
      { ctrlId: 'tbl', userDesc: '표' },
      { ctrlId: 'tbl', userDesc: '표' },
      { ctrlId: 'gso', userDesc: '그림' },
      { ctrlId: 'gso', userDesc: '글상자' },
      { ctrlId: 'gso', userDesc: '사각형' },
      { ctrlId: 'secd', userDesc: '구역 정의' },
    ]),
  });
  assert.deepEqual(counted, { tables: 2, pictures: 1, textBoxes: 1 });
});

test('개체 목록을 못 읽어도 글자 통계는 나온다', () => {
  // 개체 하나 때문에 화면 전체가 비면 안 된다.
  const counted = countControls({ getControls: () => '깨진 JSON' });
  assert.deepEqual(counted, { tables: 0, pictures: 0, textBoxes: 0 });
});

test('문단을 이어 붙일 때 낱말이 뭉치지 않는다', () => {
  // 세 낱말 + 세 낱말 = 여섯. 줄바꿈 없이 붙이면 "끝" 과 "시작" 이 "끝시작" 한 낱말이
  // 되어 다섯으로 세어진다 — 그게 이 시험이 막는 것이다.
  const stats = documentStatistics(fakeDoc([['첫 문단 끝', '시작 둘째 문단']]), 1);
  assert.equal(stats.words, 6);
  assert.equal(stats.paragraphs, 2);
});

test('구역이 여럿이면 문단을 모두 더한다', () => {
  const stats = documentStatistics(fakeDoc([['가', '나'], ['다']]), 3);
  assert.equal(stats.paragraphs, 3);
  assert.equal(stats.pages, 3);
});

/**
 * 한글에는 「줄」이 있는데 여기에는 없다. 엔진이 조판할 때 줄을 나눠 두지만
 * (`line_segs`) 그 개수를 밖으로 꺼내는 통로가 아직 없다.
 *
 * 없는 것을 아무 말 없이 빼면 "왜 없지" 를 겪는다. 없다고 적어 둔다.
 */
test('셀 수 없는 것을 셀 수 있는 척하지 않는다', () => {
  const dialog = readFileSync(new URL('../src/ui/doc-stats-dialog.ts', import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n');
  assert.match(dialog, /줄 수는 아직 셀 수 없습니다/);
  // 본문만 센다는 것도 밝힌다 — 각주를 넣은 사람이 숫자를 믿을 수 있어야 한다.
  assert.match(dialog, /표 칸·머리말·꼬리말·각주 안의 글자는 빠집니다/);

  const stats = documentStatistics(fakeDoc([['가나다']]), 1);
  assert.ok(!('lines' in stats), '줄 수를 슬쩍 넣었다');
});

/**
 * 「마지막 저장한 사람」은 이름을 파일에 적는 일이다. hwwp 는 이름을 물어본 적이 없고,
 * 개인정보를 받지 않는다는 것이 이 제품의 약속이다. 넣지 않는다.
 */
test('사람 이름을 파일에 적는 항목은 넣지 않는다', () => {
  const dialog = readFileSync(new URL('../src/ui/doc-stats-dialog.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(dialog, /저장한 사람/);
  assert.doesNotMatch(dialog, /작성자/);
});

/**
 * 정적 메뉴 항목의 이름은 **HTML 에 적힌 글자**가 화면에 나온다. 커맨드 쪽 `label` 은
 * 안 나온다.
 *
 * 한 번 이걸 놓쳤다. 「사용법 문서 열기」를 「처음 화면 다시 열기」로 바꾸면서
 * `main.ts` 의 label 만 고치고 HTML 을 안 고쳤다. 시험은 main.ts 만 봤기 때문에
 * 통과했고, 화면에는 옛 이름이 그대로 남아 사용법 안내가 거짓이 됐다.
 *
 * 그래서 **화면에 나오는 글자**를 본다.
 */
test('메뉴에 보이는 이름이 안내와 맞다', () => {
  const label = (cmd: string) =>
    html.match(new RegExp(`data-cmd="${cmd}"><span class="md-label">([^<]*)<`))?.[1] ?? null;

  assert.equal(label('file:doc-stats'), '문서 통계');
  assert.equal(label('tool:welcome-doc'), '처음 화면 다시 열기');
  assert.equal(label('tool:help'), '사용법');

  // 사용법 안내가 가리키는 이름과 메뉴에 보이는 이름이 같아야 한다.
  const guide = readFileSync(new URL('../src/core/usage-guide.ts', import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n');
  assert.match(guide, /도구 → 처음 화면 다시 열기/);
  assert.doesNotMatch(html, /사용법 문서 열기/, '옛 이름이 메뉴에 남아 있다');
});

test('문서 통계가 도구 메뉴에서 열린다', () => {
  const file = readFileSync(new URL('../src/command/commands/file.ts', import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n');
  assert.match(file, /id: 'file:doc-stats'/);
  // 문서가 없으면 셀 것도 없다.
  assert.match(file, /canExecute: \(ctx\) => ctx\.hasDocument/);
  // 선택 영역은 커서를 밖으로 꺼내지 않고 글만 받아 온다.
  assert.match(file, /getInputHandler\(\)\?\.getSelectedText\(\)/);
});

/**
 * 빈 문서는 모두 0 이어야 한다.
 *
 * 처음에는 문단을 하나의 긴 글로 이어 붙이면서 사이에 줄바꿈을 넣었는데, 그 줄바꿈이
 * **글자로 세어졌다.** 아무것도 안 쓴 문서가 "1 자" 로 나왔다 — 빈 문단 하나에
 * 줄바꿈 하나.
 */
test('빈 문서는 모두 0 이다', () => {
  const stats = documentStatistics(fakeDoc([['']]), 1);
  assert.equal(stats.chars, 0, `빈 문서를 ${stats.chars}자로 셌다`);
  assert.equal(stats.charsNoSpace, 0);
  assert.equal(stats.words, 0);
  assert.equal(stats.manuscriptPages, 0);
  // 빈 문서에도 문단은 늘 하나 있다. 그대로 세면 "문단 1 개" 가 된다 — 한글은 0 이다.
  assert.equal(stats.paragraphs, 0, `빈 문서를 문단 ${stats.paragraphs}개로 셌다`);
});

test('문단 사이를 띄우는 빈 줄은 문단이 아니다', () => {
  // 원고에서 문단 사이를 빈 줄로 띄우는 사람이 많다. 그것까지 세면 문단 수가 두 배가 된다.
  const stats = documentStatistics(fakeDoc([['첫 문단', '', '둘째 문단', '   ']]), 1);
  assert.equal(stats.paragraphs, 2);
});

test('문단을 이어도 글자수에 줄바꿈이 끼지 않는다', () => {
  const stats = documentStatistics(fakeDoc([['가나', '다라']]), 1);
  assert.equal(stats.chars, 4, '문단 사이 줄바꿈이 글자로 세어졌다');
  // 그러면서도 낱말은 뭉치지 않아야 한다.
  assert.equal(stats.words, 2);
});

test('원고지 매수 뒤에 단위를 띄어 쓴다', () => {
  // 다른 줄은 "1,234 자" 처럼 띄우는데 여기만 "12.3장" 이면 눈에 걸린다.
  const dialog = readFileSync(new URL('../src/ui/doc-stats-dialog.ts', import.meta.url), 'utf8');
  assert.match(dialog, /row\.decimal \? ' 장'/);
});

/**
 * 문서 통계는 **파일 메뉴**에 둔다.
 *
 * 한글이 그렇기도 하지만, 무엇보다 이것은 *이 문서에 대한 값*이다. 도구 메뉴에 있는
 * 것들(환경 설정·사용법·제품 정보)은 hwwp 자체에 대한 것이라 성격이 다르다.
 * 파일 메뉴에는 이미 편집 용지가 있어 문서 속성이 앉는 자리이기도 하다.
 */
test('문서 통계는 파일 메뉴에 있다', () => {
  const fileMenu = html.slice(
    html.indexOf('data-menu="file"'),
    html.indexOf('data-menu="edit"'),
  );
  assert.match(fileMenu, /data-cmd="file:doc-stats"/, '파일 메뉴에 없다');

  const toolMenu = html.slice(html.indexOf('data-cmd="tool:options"'));
  assert.doesNotMatch(toolMenu, /doc-stats/, '도구 메뉴에 아직 남아 있다');

  // 명령 이름도 메뉴와 맞춘다 — 파일 메뉴에 `tool:` 이 있으면 나중에 헷갈린다.
  const tool = readFileSync(new URL('../src/command/commands/tool.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(tool, /doc-stats/, '명령이 아직 tool.ts 에 있다');
});

/**
 * 한글과 같은 Ctrl+Q,I. 두 벌 누르기는 이미 있는 구조(Ctrl+M,? · Ctrl+G,?)를 그대로 쓴다.
 */
test('한글과 같은 Ctrl+Q,I 로 열린다', () => {
  const kb = readFileSync(
    new URL('../src/engine/input-handler-keyboard.ts', import.meta.url), 'utf8',
  ).replace(/\r\n/g, '\n');

  // 첫 벌 — Ctrl+Q 를 누르면 다음 키를 기다린다.
  assert.match(kb, /e\.key === 'q' \|\| e\.key === 'Q' \|\| e\.key === 'ㅂ'/);
  assert.match(kb, /this\._pendingChordQ = true/);

  // 둘째 벌 — I 면 문서 통계.
  assert.match(kb, /const chordMapQ: Record<string, string> = \{/);
  const map = kb.match(/const chordMapQ[\s\S]*?\n\};/)?.[0] ?? '';
  assert.match(map, /i: 'file:doc-stats'/);
  // 한글 자판에서 I 는 'ㅑ' 로 온다. 없으면 정작 글 쓰는 중에 안 듣는다.
  assert.match(map, /ㅑ: 'file:doc-stats'/);

  // 기다리던 것을 실제로 받아 처리하는 자리.
  assert.match(kb, /if \(this\._pendingChordQ\) \{/);
  assert.match(kb, /const cmdId = chordMapQ\[key\];/);

  // 메뉴에 적은 단축키와 같아야 한다.
  assert.match(html, /data-cmd="file:doc-stats"[\s\S]{0,120}?Ctrl\+Q,I/);
});

/**
 * 표 안의 글자는 아직 못 센다. 엔진에 그 글을 꺼내는 통로가 없다 —
 * `getCellParagraphCount`·`getCellParagraphLength` 는 있어도 글자를 주는 것은 없다.
 *
 * 그런데 **표 개수는 센다.** 표가 4개라고 알려 주면서 그 안의 글자는 빼고 세면,
 * 사용자는 그 숫자가 전부인 줄 안다. 원고 분량은 청탁과 계약이 걸린 숫자라
 * 모르는 채로 적게 세는 것이 가장 나쁘다. 그래서 빠진다는 것을 화면에 적어 둔다.
 */
test('표 안의 글자가 빠진다는 것을 밝힌다', () => {
  const dialog = readFileSync(new URL('../src/ui/doc-stats-dialog.ts', import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n');
  assert.match(dialog, /표 칸[^]{0,40}빠집니다/, '표가 빠진다는 말이 없다');

  // 표 개수는 세면서 안의 글자는 안 센다 — 그 어긋남이 이 문구가 필요한 이유다.
  const stats = documentStatistics(
    fakeDoc([['본문']], [{ ctrlId: 'tbl', userDesc: '표' }]),
    1,
  );
  assert.equal(stats.tables, 1, '표 개수는 세야 한다');
  assert.equal(stats.chars, 2, '본문 글자만 세야 한다');
});
