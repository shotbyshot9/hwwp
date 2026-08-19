import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const notices = readFileSync(
  new URL('../public/THIRD_PARTY_NOTICES.txt', import.meta.url),
  'utf8',
);
const aboutDialog = readFileSync(new URL('../src/ui/about-dialog.ts', import.meta.url), 'utf8');
const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

/**
 * MIT 도 Apache-2.0 도 ISC 도 "저작권 고지와 허가 문구를 사본에 함께 남길 것" 을
 * 요구한다. 사본은 배포물이고, 웹앱 사용자는 저장소를 받지 않는다. 그러므로 이 파일이
 * 배포물 안에 있고 앱에서 닿을 수 있어야 그 요구가 이행된다.
 *
 * 예전에는 제품 정보가 크레이트 16개를 "이름 | 라이선스" 표로 보여 주는 것이 전부였다.
 * 그것은 고지가 아니라 목록이고, 게다가 실제 119개 중 16개였다.
 */
test('고지 전문이 실제 저작권 표시를 담고 있다', () => {
  // "quick-xml | MIT" 같은 줄만 있던 시절에는 이 수가 1이었다.
  const copyrights = notices.match(/Copyright/g)?.length ?? 0;
  assert.ok(copyrights > 100, `저작권 표시가 너무 적다: ${copyrights}`);
  assert.match(notices, /Permission is hereby granted/, 'MIT 허가 문구가 없다');
  assert.match(notices, /Apache License/, 'Apache-2.0 원문이 없다');
});

test('제품 정보가 말하는 패키지 수와 실제 고지가 일치한다', () => {
  // 대화상자에 적힌 숫자가 굳어 버리면 의존성이 바뀔 때 조용히 거짓말이 된다.
  const header = notices.match(/Rust 크레이트 (\d+)개 · npm 패키지 (\d+)개/);
  assert.ok(header, '고지 머리말에서 패키지 수를 읽지 못했다');
  const [, crates, npm] = header;
  assert.match(
    aboutDialog,
    new RegExp(`Rust 크레이트 ${crates}개와 npm 패키지 ${npm}개`),
    `제품 정보의 패키지 수가 고지와 다르다 (고지: ${crates}/${npm}). `
      + 'npm run notices 를 다시 돌리고 about-dialog.ts 의 숫자를 맞춰라',
  );
});

test('앱에서 고지로 닿는 길이 있다', () => {
  assert.match(aboutDialog, /makeLicenseLink\('THIRD_PARTY_NOTICES\.txt', '서드파티 고지'\)/);
  assert.match(aboutDialog, /makeLicenseLink\('LICENSE\.txt', 'MIT'\)/);
  assert.match(aboutDialog, /makeLicenseLink\('THIRD_PARTY_LICENSES\.txt', '서드파티 목록'\)/);
  // 표를 되살리면 다시 "일부만 보여 주는 목록" 이 된다.
  assert.doesNotMatch(aboutDialog, /about-license-table/);
});

test('고지는 손이 아니라 기계가 만든다', () => {
  assert.ok(
    existsSync(new URL('../scripts/gen-notices.mjs', import.meta.url)),
    '생성기가 없으면 이 파일은 곧 실제 의존성과 어긋난다',
  );
  assert.equal(packageJson.scripts.notices, 'node scripts/gen-notices.mjs');
  assert.match(notices, /rhwp-studio\/scripts\/gen-notices\.mjs/, '고지에 출처가 적혀 있어야 한다');
});

test('고지 전문은 미리 받지 않는다', () => {
  // 380KB 짜리 읽을거리다. 서비스 워커가 첫 방문에 통째로 받을 이유가 없다.
  assert.match(viteConfig, /globIgnores: \['fonts\/\*\*', 'THIRD_PARTY_NOTICES\.txt'\]/);
});
