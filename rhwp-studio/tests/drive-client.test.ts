import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMultipartBody,
  describeDriveError,
  mimeTypeForName,
  quoteQueryValue,
} from '../src/storage/drive-client.ts';
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

test('Drive API 미사용 오류를 손쓸 수 있는 안내로 바꾼다', () => {
  // 실제로 받은 응답 (프로젝트에서 Drive API 를 켜지 않은 경우)
  const body = JSON.stringify({
    error: {
      code: 403,
      message: 'Google Drive API has not been used in project 18457187610 before or it is disabled.',
    },
  });
  assert.equal(describeDriveError(403, body), 'Google Cloud 프로젝트에서 Drive API 가 켜져 있지 않습니다');
});

test('상태 코드별로 사람이 읽을 안내를 고른다', () => {
  assert.match(describeDriveError(401, '{}'), /인증이 만료/);
  assert.match(describeDriveError(404, '{}'), /찾을 수 없습니다/);
  assert.match(describeDriveError(500, '{}'), /일시적으로 응답하지 않습니다/);
  assert.match(
    describeDriveError(403, JSON.stringify({ error: { message: 'Rate Limit Exceeded' } })),
    /요청이 너무 잦습니다/,
  );
  assert.match(
    describeDriveError(403, JSON.stringify({ error: { message: 'Insufficient Permission' } })),
    /권한이 부족합니다/,
  );
});

test('알 수 없는 오류는 원문 메시지를 짧게 보여 준다', () => {
  assert.equal(describeDriveError(400, JSON.stringify({ error: { message: '이상한 오류' } })), '이상한 오류');
  // JSON 이 아니면 상태 코드만이라도 알린다
  assert.equal(describeDriveError(418, ''), '요청 실패 (418)');
});

test('내용 타입이 비어 있으면 octet-stream 으로 적는다', async () => {
  const { body } = buildMultipartBody({ name: 'x' }, new Blob([new Uint8Array([0])]), 'B');
  const text = await body.text();
  assert.ok(text.includes('Content-Type: application/octet-stream'));
});
