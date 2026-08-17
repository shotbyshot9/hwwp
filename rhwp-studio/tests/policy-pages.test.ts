import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const privacy = readFileSync(new URL('../public/privacy.html', import.meta.url), 'utf8');
const terms = readFileSync(new URL('../public/terms.html', import.meta.url), 'utf8');
const driveAuth = readFileSync(new URL('../src/storage/drive-auth.ts', import.meta.url), 'utf8');
const driveConfig = readFileSync(new URL('../src/storage/drive-config.ts', import.meta.url), 'utf8');

/**
 * 개인정보처리방침은 지키지 못할 약속을 하면 안 된다. 여기 적힌 문장이 코드와
 * 어긋나는 순간 그것은 거짓 고지다. 그래서 주장마다 근거를 코드에서 확인한다.
 */
test('토큰을 저장하지 않는다는 주장이 코드와 맞다', () => {
  assert.match(privacy, /브라우저 메모리에만/);
  // 저장한다면 거짓말이 된다.
  assert.doesNotMatch(driveAuth, /localStorage|sessionStorage/);
});

test('추적하지 않는다는 주장이 코드와 맞다', () => {
  assert.match(privacy, /분석 도구, 광고 추적기, 오류 수집기를 일절 넣지 않았습니다/);
});

test('drive.file 범위만 쓴다는 주장이 코드와 맞다', () => {
  assert.match(privacy, /drive\.file/);
  assert.match(driveConfig, /auth\/drive\.file'/);
  // 전체 drive 범위를 쓰기 시작하면 이 방침은 통째로 거짓이 된다.
  assert.doesNotMatch(driveConfig, /auth\/drive'/);
});

test('브라우저에 저장하는 것을 빠짐없이 밝힌다', () => {
  for (const key of ['rhwp-settings', 'rhwpStudioAutosave', 'rhwpStudioRecent', 'whp-welcome-shown']) {
    assert.match(privacy, new RegExp(key), `${key} 가 방침에 없다`);
  }
});

test('외부로 나가는 곳을 빠짐없이 밝힌다', () => {
  for (const host of ['accounts.google.com', 'apis.google.com', 'googleapis.com', 'cdn.jsdelivr.net']) {
    assert.match(privacy, new RegExp(host.replace(/\./g, '\\.')), `${host} 가 방침에 없다`);
  }
  assert.match(privacy, /Cloudflare/);
});

test('약관은 HWP 편집의 실제 위험을 감추지 않는다', () => {
  // "있는 그대로" 만 적고 넘어가면 사용자가 무엇을 조심해야 할지 모른다.
  assert.match(terms, /원본과 다르게\s*\n?\s*표시하거나 저장할 수 있습니다/);
  assert.match(terms, /오래 매달린 원고는 별도로 복사해 두세요/);
  assert.match(terms, /한글과컴퓨터와 아무런 관련이 없으며/);
});

test('두 문서가 서로를 가리키고 앱으로 돌아갈 수 있다', () => {
  assert.match(privacy, /href="\/terms\.html"/);
  assert.match(terms, /href="\/privacy\.html"/);
  for (const page of [privacy, terms]) {
    assert.match(page, /href="\/"/);
    assert.match(page, /href="\/LICENSE\.txt"/);
  }
});

test('제품 정보에서 두 문서로 갈 수 있다', () => {
  const about = readFileSync(new URL('../src/ui/about-dialog.ts', import.meta.url), 'utf8');
  assert.match(about, /makeLicenseLink\('privacy\.html', '개인정보처리방침'\)/);
  assert.match(about, /makeLicenseLink\('terms\.html', '서비스 약관'\)/);
});
