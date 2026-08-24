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

/*
 * 예전에는 "분석 도구를 일절 넣지 않았습니다" 라고 적혀 있었고 이 시험이 그 문장을 지켰다.
 * 그런데 Cloudflare 대시보드에서 Web Analytics 를 켜자 **코드를 건드리지 않았는데도**
 * 방문 집계 스크립트가 hwwp.kr 페이지에 자동으로 실렸다. 나흘 동안 방침이 거짓이었다.
 *
 * 그래서 지키는 대상을 바꾼다. "아무것도 안 센다" 가 아니라 **무엇을 세고 무엇은 안 하는지**를
 * 지킨다 — 쿠키를 심지 않고, 사람을 식별하지 않고, 사이트를 넘나들며 따라다니지 않는다는 것.
 * 이 세 가지가 사용자가 실제로 걱정하는 바다.
 */
test('무엇을 세는지 밝히고, 하지 않는 것을 못 박는다', () => {
  assert.match(privacy, /Cloudflare Web Analytics/, '집계 도구를 밝히지 않았다');
  assert.match(privacy, /쿠키를 심지 않고, 여러분을 식별하지 않으며, 여러 사이트에 걸쳐 따라다니지 않습니다/);
  assert.match(privacy, /광고 추적기·오류 수집기.*넣지 않았습니다/);
  // 문서 내용은 집계에 들어가지 않는다 — 이 제품에서 가장 중요한 약속이다.
  assert.match(privacy, /쓰신 글이나 연 파일은 이 집계에 들어가지 않습니다/);
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
  const hosts = [
    'accounts.google.com',
    'apis.google.com',
    'googleapis.com',
    'cdn.jsdelivr.net',
    // 브라우저가 실제로 받아오는 집계 스크립트. Cloudflare 가 자동으로 끼워 넣으므로
    // 저장소 코드만 봐서는 드러나지 않는다 — 그래서 여기 적어 둔다.
    'static.cloudflareinsights.com',
  ];
  for (const host of hosts) {
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

test('만든 사람 표기와 연락처가 앱과 정책 문서에서 같다', () => {
  // 이름도 연락처도 세 곳에서 같아야 한다 — 다르면 같은 사람인지 알 수 없고, 어디로
  // 연락해야 하는지도 헷갈린다. 예전에는 앱은 트위터, 정책 문서는 메일이라 갈렸다.
  const about = readFileSync(new URL('../src/ui/about-dialog.ts', import.meta.url), 'utf8');
  assert.match(about, /만든 사람: 류지원/);
  assert.match(about, /twitter\.com\/shotbyshot/);
  assert.match(about, /© 2026 hwwp — 류지원/);
  assert.doesNotMatch(about, /Jiwon Ryu/);
  for (const page of ['privacy.html', 'terms.html']) {
    const html = readFileSync(new URL(`../public/${page}`, import.meta.url), 'utf8');
    assert.match(html, /만든 사람 — 류지원/, `${page} 의 이름 표기가 다르다`);
    assert.match(html, /twitter\.com\/shotbyshot/, `${page} 의 연락처가 앱과 다르다`);
    // 메일 주소는 더 쓰지 않는다. 한 곳에만 남으면 어디로 연락할지 헷갈린다.
    assert.doesNotMatch(html, /mailto:/, `${page} 에 옛 연락처가 남아 있다`);
  }
  // 저작권 고지와 패키지 메타데이터도 같은 이름을 쓴다. LICENSE 는 영문 문서지만
  // 저작권자 이름은 표기 언어를 따라가지 않는다 — 사람이 하나면 이름도 하나다.
  for (const path of ['../../LICENSE', '../../HWWP.md', '../package.json']) {
    const text = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /Jiwon Ryu/, `${path} 에 옛 표기가 남아 있다`);
    assert.match(text, /류지원/, `${path} 에 이름이 없다`);
  }
});

test('드라이브 권한 설명이 실제 범위와 어긋나지 않는다', () => {
  /*
   * `drive.file` 은 "앱이 만든 파일만" 이 아니다. 사용자가 피커로 직접 고른 파일에도
   * 그 한 건에 한해 접근이 열린다 — 밖에서 올린 hwp 를 여는 길이 바로 이것이다.
   *
   * "앱이 만든 파일만 본다" 고 적으면 실제보다 좁게 말하는 것이 되고, 그건 지킬 수 없는
   * 약속이 아니라 **하지 않은 약속을 한 것처럼 보이게 하는 거짓 안심**이다. 방침 문서에서
   * 특히 위험하다.
   */
  const claims = [
    ['privacy.html', privacy],
    ['README.md', readFileSync(new URL('../../README.md', import.meta.url), 'utf8')],
    ['README_EN.md', readFileSync(new URL('../../README_EN.md', import.meta.url), 'utf8')],
  ] as const;

  for (const [name, text] of claims) {
    if (!text.includes('drive.file')) continue;
    const picker = /피커|파일 선택 창|file picker|picked themselves/.test(text);
    assert.ok(picker, `${name} 이 drive.file 을 말하면서 사용자가 고른 파일을 빠뜨렸다`);
  }

  // 코드도 같은 사실을 적고 있어야 한다.
  const config = readFileSync(
    new URL('../src/storage/drive-config.ts', import.meta.url),
    'utf8',
  );
  assert.match(config, /사용자가 피커로 고른 파일/);
  assert.match(config, /auth\/drive\.file/);
});

/**
 * 방침이 저장소 코드만으로는 지켜지지 않는다 — 이번에 그것을 겪었다.
 *
 * Cloudflare 대시보드에서 Web Analytics 를 켜자 **코드를 한 줄도 안 고쳤는데** 집계
 * 스크립트가 hwwp.kr 페이지에 자동으로 실렸다. 그동안 방침에는 "분석 도구를 일절 넣지
 * 않았습니다" 가 그대로 있었다. 나흘 동안 거짓이었고, 저장소를 아무리 들여다봐도 알 수
 * 없었다.
 *
 * 그래서 **배포된 사이트가 실제로 부르는 곳**을 방침이 담고 있는지 본다. 새 스크립트가
 * 자동으로 끼워지면 이 시험이 아니라 사람이 알아채야 하므로, 최소한 알려진 것들은 여기
 * 적어 두고 빠지면 걸리게 한다.
 */
test('배포본이 부르는 외부 스크립트가 방침에 다 있다', () => {
  // 2026-08 hwwp.kr 실측: 페이지가 부른 외부 스크립트는 이 하나뿐이다.
  // (나머지는 전부 hwwp.kr 자기 자신에서 온다.)
  const externalScriptHosts = ['static.cloudflareinsights.com'];
  for (const host of externalScriptHosts) {
    assert.match(
      privacy,
      new RegExp(host.replace(/\./g, '\.')),
      `${host} 가 방침에 없다 — 브라우저는 이미 부르고 있다`,
    );
  }
});

/**
 * 방침이 "코드로 확인하실 수 있습니다" 라고 말한다면, **hwwp 의 코드**를 가리켜야 한다.
 *
 * 한동안 그 문장은 rhwp 만 가리키고 있었다. rhwp 는 문서를 읽고 그리는 엔진이라
 * 토큰을 어디 두는지, 어떤 권한을 쓰는지, 무엇을 저장하는지는 거기 없다 — 그건 전부
 * hwwp 쪽 코드다. 확인하라고 해 놓고 확인할 수 없는 곳을 가리킨 셈이었다.
 */
test('코드로 확인하라면서 hwwp 저장소를 가리킨다', () => {
  assert.match(privacy, /github\.com\/shotbyshot9\/hwwp/, 'hwwp 저장소를 가리키지 않는다');
  assert.match(privacy, /직접 확인하실 수 있습니다/);
  // 그 링크가 실제로 hwwp 저장소를 가리켜야 한다 — 문장만 있고 링크가 rhwp 면 그대로다.
  assert.match(
    privacy,
    /href="https:\/\/github\.com\/shotbyshot9\/hwwp"[^>]*>hwwp 의 코드<\/a>/,
    '"코드" 링크가 hwwp 저장소로 걸려 있지 않다',
  );
  // 엔진 출처도 함께 밝힌다 — MIT 고지이자 사실 관계다.
  assert.match(privacy, /github\.com\/edwardkim\/rhwp/);
});
