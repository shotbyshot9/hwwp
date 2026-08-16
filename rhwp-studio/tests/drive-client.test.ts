import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMultipartBody, mimeTypeForName, quoteQueryValue } from '../src/storage/drive-client.ts';
import { isTokenUsable, nextRefreshDelay } from '../src/storage/drive-auth.ts';

const MARGIN = 5 * 60 * 1000;

test('만료 5분 전에 미리 갱신하도록 예약한다', () => {
  const now = 1_000_000;
  // 1시간짜리 토큰이면 55분 뒤에 깨어난다.
  assert.equal(nextRefreshDelay(now + 3600_000, now, MARGIN), 3600_000 - MARGIN);
});

test('이미 만료가 임박했으면 즉시 갱신한다', () => {
  const now = 1_000_000;
  assert.equal(nextRefreshDelay(now + 60_000, now, MARGIN), 0);
  assert.equal(nextRefreshDelay(now - 10_000, now, MARGIN), 0);
});

test('여유 시간 안에 든 토큰은 쓰지 않는다', () => {
  const now = 1_000_000;
  assert.equal(isTokenUsable(now + 3600_000, now, MARGIN), true);
  // 만료 4분 전 — 저장 도중에 죽을 수 있으므로 미리 갈아 끼운다.
  assert.equal(isTokenUsable(now + 4 * 60 * 1000, now, MARGIN), false);
  assert.equal(isTokenUsable(now - 1, now, MARGIN), false);
});

test('확장자에 맞는 MIME 타입을 고른다', () => {
  assert.equal(mimeTypeForName('보고서.hwp'), 'application/x-hwp');
  assert.equal(mimeTypeForName('보고서.HWPX'), 'application/hwp+zip');
  assert.equal(mimeTypeForName('보고서.hml'), 'application/xml');
  // 확장자를 모르면 hwp 로 본다 — WHP 의 기본 저장 형식이다.
  assert.equal(mimeTypeForName('이름없음'), 'application/x-hwp');
});

test('질의 값의 작은따옴표를 escape 한다', () => {
  assert.equal(quoteQueryValue('보고서.hwp'), "'보고서.hwp'");
  // 이스케이프하지 않으면 q 문자열이 조기 종료돼 질의가 깨진다.
  assert.equal(quoteQueryValue("파일'이름.hwp"), "'파일\\'이름.hwp'");
  assert.equal(quoteQueryValue('back\\slash'), "'back\\\\slash'");
});

test('멀티파트 본문이 드라이브 규약대로 조립된다', async () => {
  const content = new Blob([new Uint8Array([1, 2, 3])], { type: 'application/x-hwp' });
  const { body, contentType } = buildMultipartBody(
    { name: '새 문서.hwp', parents: ['folder-1'] },
    content,
    'BOUND',
  );

  assert.equal(contentType, 'multipart/related; boundary=BOUND');

  const text = await body.text();
  assert.ok(text.startsWith('--BOUND\r\n'), '경계로 시작해야 한다');
  assert.ok(text.includes('Content-Type: application/json; charset=UTF-8'), '메타데이터 파트 헤더');
  assert.ok(text.includes('"name":"새 문서.hwp"'), '메타데이터에 이름이 실린다');
  assert.ok(text.includes('"parents":["folder-1"]'), '부모 폴더가 실린다');
  assert.ok(text.includes('Content-Type: application/x-hwp'), '내용 파트 헤더');
  assert.ok(text.endsWith('\r\n--BOUND--'), '닫는 경계로 끝나야 한다');
});

test('내용 타입이 비어 있으면 octet-stream 으로 적는다', async () => {
  const { body } = buildMultipartBody({ name: 'x' }, new Blob([new Uint8Array([0])]), 'B');
  const text = await body.text();
  assert.ok(text.includes('Content-Type: application/octet-stream'));
});
