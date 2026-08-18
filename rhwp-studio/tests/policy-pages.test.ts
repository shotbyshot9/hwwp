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

/**
 * 링크는 `.html` 없는 주소로 건다.
 *
 * Cloudflare Workers 정적 자산은 `/privacy.html` 을 `/privacy` 로 307 넘긴다. 굳이
 * 넘어가는 주소를 적어 두면 누를 때마다 왕복이 한 번씩 는다.
 */
test('두 문서가 서로를 가리키고 앱으로 돌아갈 수 있다', () => {
  assert.match(privacy, /href="\/terms"/);
  assert.match(terms, /href="\/privacy"/);
  for (const page of [privacy, terms]) {
    assert.match(page, /href="\/"/);
    assert.match(page, /href="\/LICENSE\.txt"/);
    assert.doesNotMatch(page, /href="\/(privacy|terms)\.html"/);
  }
});

test('제품 정보에서 두 문서로 갈 수 있다', () => {
  const about = readFileSync(new URL('../src/ui/about-dialog.ts', import.meta.url), 'utf8');
  assert.match(about, /makeLicenseLink\('privacy', '개인정보처리방침'\)/);
  assert.match(about, /makeLicenseLink\('terms', '서비스 약관'\)/);
});

/**
 * 함초롬체는 저장소에 없고 눈누(jsdelivr) CDN 에서 불러 쓴다. 파일을 배포하지 않으므로
 * 재배포는 아니지만, 권리자를 밝히는 데 드는 비용이 0 이라 제품 정보에 남긴다.
 */
test('제품 정보에 함초롬체 권리자를 밝힌다', () => {
  const about = readFileSync(new URL('../src/ui/about-dialog.ts', import.meta.url), 'utf8');
  assert.match(about, /함초롬체 © 주식회사 한글과컴퓨터/);
  // 조건도 함께 적어야 고지가 제 일을 한다.
  assert.match(about, /비상업적 이용 조건으로 사용/);
});

test('만든 사람 표기는 앱과 정책 문서에서 같다', () => {
  // 제품 정보에서는 한글 이름 옆에 트위터를 붙이고, 정책 문서에서는 메일을 붙인다.
  // 이름 자체는 세 곳에서 같아야 한다 — 다르면 같은 사람인지 알 수 없다.
  const about = readFileSync(new URL('../src/ui/about-dialog.ts', import.meta.url), 'utf8');
  assert.match(about, /만든 사람: 류지원/);
  assert.match(about, /twitter\.com\/shotbyshot/);
  assert.match(about, /© 2026 hwwp — 류지원/);
  assert.doesNotMatch(about, /Jiwon Ryu/);
  for (const page of ['privacy.html', 'terms.html']) {
    const html = readFileSync(new URL(`../public/${page}`, import.meta.url), 'utf8');
    assert.match(html, /만든 사람 — 류지원/, `${page} 의 이름 표기가 다르다`);
  }
  // 저작권 고지와 패키지 메타데이터도 같은 이름을 쓴다. LICENSE 는 영문 문서지만
  // 저작권자 이름은 표기 언어를 따라가지 않는다 — 사람이 하나면 이름도 하나다.
  for (const path of ['../../LICENSE', '../../HWWP.md', '../package.json']) {
    const text = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /Jiwon Ryu/, `${path} 에 옛 표기가 남아 있다`);
    assert.match(text, /류지원/, `${path} 에 이름이 없다`);
  }
});
