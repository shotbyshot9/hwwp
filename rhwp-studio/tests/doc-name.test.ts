import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DOC_TITLE,
  displayTitle,
  sanitizeDocTitle,
  splitExtension,
  uniqueDocName,
} from '../src/storage/doc-name.ts';

test('확장자를 몸통과 갈라낸다', () => {
  assert.deepEqual(splitExtension('보고서.hwp'), { base: '보고서', extension: '.hwp' });
  assert.deepEqual(splitExtension('보고서.HWPX'), { base: '보고서', extension: '.HWPX' });
  assert.deepEqual(splitExtension('확장자없음'), { base: '확장자없음', extension: '' });
  // 문서 확장자가 아니면 몸통으로 남긴다 — 이름에 점이 있는 경우를 지키기 위해서다.
  assert.deepEqual(splitExtension('2026.1분기.보고'), { base: '2026.1분기.보고', extension: '' });
});

test('빈 제목은 기본 제목이 된다', () => {
  assert.equal(sanitizeDocTitle(''), DEFAULT_DOC_TITLE);
  assert.equal(sanitizeDocTitle('   '), DEFAULT_DOC_TITLE);
  assert.equal(sanitizeDocTitle('///'), DEFAULT_DOC_TITLE);
});

test('파일 이름에 못 쓰는 문자만 걷어내고 공백은 지킨다', () => {
  assert.equal(sanitizeDocTitle('보고서/최종*판'), '보고서최종판');
  // 공백은 이름의 일부다 — "새 문서" 가 "새문서" 가 되면 안 된다.
  assert.equal(sanitizeDocTitle('새 문서'), '새 문서');
  assert.equal(sanitizeDocTitle('1분기 - 초안'), '1분기 - 초안');
  assert.equal(sanitizeDocTitle('  앞뒤 공백  '), '앞뒤 공백');
  assert.equal(sanitizeDocTitle('.숨김'), '숨김');
});

test('빈 저장소에서는 원하는 이름을 그대로 쓴다', () => {
  assert.equal(uniqueDocName('새 문서.hwp', []), '새 문서.hwp');
});

test('같은 이름이 있으면 번호를 붙여 올린다', () => {
  const taken = ['새 문서.hwp'];
  assert.equal(uniqueDocName('새 문서.hwp', taken), '새 문서(1).hwp');

  const taken2 = ['새 문서.hwp', '새 문서(1).hwp', '새 문서(2).hwp'];
  assert.equal(uniqueDocName('새 문서.hwp', taken2), '새 문서(3).hwp');
});

test('중간이 비어 있으면 그 번호를 재사용한다', () => {
  const taken = ['새 문서.hwp', '새 문서(2).hwp'];
  assert.equal(uniqueDocName('새 문서.hwp', taken), '새 문서(1).hwp');
});

test('이미 번호가 붙은 이름은 꼬리를 물지 않는다', () => {
  const taken = ['새 문서.hwp', '새 문서(1).hwp'];
  // "새 문서(1)(1).hwp" 가 아니라 "새 문서(2).hwp" 여야 한다.
  assert.equal(uniqueDocName('새 문서(1).hwp', taken), '새 문서(2).hwp');
});

test('대소문자가 달라도 같은 이름으로 본다', () => {
  assert.equal(uniqueDocName('Report.hwp', ['report.HWP']), 'Report(1).hwp');
});

test('확장자가 다르면 다른 이름이다', () => {
  assert.equal(uniqueDocName('보고서.hwpx', ['보고서.hwp']), '보고서.hwpx');
});

test('제목 줄에는 확장자를 감춘다', () => {
  assert.equal(displayTitle('새 문서.hwp'), '새 문서');
  assert.equal(displayTitle('보고서(2).hwpx'), '보고서(2)');
  assert.equal(displayTitle(''), DEFAULT_DOC_TITLE);
});
