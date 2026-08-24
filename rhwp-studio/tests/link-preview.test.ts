import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';

/**
 * 링크 미리보기.
 *
 * 알리는 일은 결국 링크가 사람 손을 거쳐 옮겨 다니는 일이다. 그런데 hwwp.kr 을
 * 트위터나 카카오톡에 붙이면 **주소만 덜렁** 나오고 있었다. 받는 사람은 이게 무엇인지
 * 알 수 없으니 누르지 않는다 — 그 앞의 모든 노력이 여기서 새어 나갔다.
 *
 * 이 시험이 지키는 것은 "태그가 있다" 가 아니라 **"가리키는 것이 실제로 있다"** 이다.
 * og:image 가 없는 파일을 가리키면 미리보기는 조용히 빈 카드로 뜬다. 태그만 보면
 * 멀쩡해 보이는 종류의 고장이라 눈으로는 알아채기 어렵다.
 */

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n');

function meta(attr: 'property' | 'name', key: string): string | null {
  const re = new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`);
  return html.match(re)?.[1] ?? null;
}

test('제목이 제품 이름 하나로 끝나지 않는다', () => {
  // 예전 제목은 "hwwp" 한 단어였다. 검색 결과에도 그대로 나오므로,
  // 무엇인지 모르는 사람은 누를 이유를 찾지 못한다.
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
  assert.ok(title.length > 10, `제목이 너무 짧다: "${title}"`);
  assert.match(title, /hwwp/, '제품 이름이 빠졌다');
  assert.match(title, /HWP/, '무엇을 하는 물건인지 제목에 없다');
});

test('미리보기에 필요한 태그가 다 있다', () => {
  for (const key of ['og:type', 'og:url', 'og:title', 'og:description', 'og:image']) {
    assert.ok(meta('property', key), `${key} 가 없다`);
  }
  // 트위터에서 큰 그림 카드로 뜨려면 이 줄이 있어야 한다. 없으면 작은 카드가 된다.
  assert.equal(meta('name', 'twitter:card'), 'summary_large_image');
  // 검색 결과에 나오는 문장.
  assert.ok((meta('name', 'description') ?? '').length > 30, '설명이 너무 짧다');
});

/**
 * 여기가 이 시험의 핵심이다. 가리키는 그림이 실제로 배포에 실려야 한다.
 */
test('og:image 가 가리키는 파일이 실제로 있다', () => {
  const url = meta('property', 'og:image') ?? '';
  assert.match(url, /^https:\/\/hwwp\.kr\//, '미리보기 그림은 절대 주소여야 한다');

  const path = url.replace('https://hwwp.kr/', '');
  const file = new URL(`../public/${path}`, import.meta.url);
  assert.ok(existsSync(file), `og:image 가 없는 파일을 가리킨다: public/${path}`);

  // 빈 파일이나 깨진 파일이면 미리보기가 조용히 비어 뜬다.
  assert.ok(statSync(file).size > 5000, '그림이 너무 작다 — 깨졌을 수 있다');
  // PNG 서명 확인.
  const head = readFileSync(file).subarray(0, 8);
  assert.deepEqual([...head], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'PNG 이 아니다');
});

test('밝힌 크기가 실제 그림과 맞다', () => {
  // 카카오톡·트위터는 이 값을 믿고 자리를 잡는다. 어긋나면 잘리거나 늘어난다.
  const w = Number(meta('property', 'og:image:width'));
  const h = Number(meta('property', 'og:image:height'));

  const png = readFileSync(new URL('../public/og.png', import.meta.url));
  // PNG IHDR: 16바이트째부터 폭·높이가 빅엔디언 4바이트씩.
  assert.equal(png.readUInt32BE(16), w, '밝힌 폭이 실제와 다르다');
  assert.equal(png.readUInt32BE(20), h, '밝힌 높이가 실제와 다르다');
  // 권장 비율(1.91:1) 에서 크게 벗어나면 잘린다.
  assert.equal(w, 1200);
  assert.equal(h, 630);
});

/**
 * 그림을 손으로 만들어 넣으면 제품 이름이나 한 줄 소개가 바뀔 때 반드시 어긋난다.
 * 스크립트로 만들어 두면 다시 돌리기만 하면 된다.
 */
test('그림을 다시 만들 수 있는 길이 남아 있다', () => {
  const script = new URL('../scripts/gen-og-image.mjs', import.meta.url);
  assert.ok(existsSync(script), '그림 만드는 스크립트가 없다');

  const source = readFileSync(script, 'utf8').replace(/\r\n/g, '\n');
  // 카드에 적은 말이 실제 설명과 같은 뿌리에서 나와야 한다.
  assert.match(source, /브라우저에서 바로 쓰는 HWP 워드프로세서/);
  assert.match(source, /배명훈 모드/);
  // 시스템 글꼴을 쓰면 만드는 사람 컴퓨터에 따라 결과가 달라진다.
  assert.match(source, /ttfs.*opensource.*NotoSansKR/s, '저장소가 가진 글꼴을 써야 한다');
});

test('미리보기 문구와 제목이 서로 어긋나지 않는다', () => {
  // 셋이 다른 말을 하면 어디서 봤느냐에 따라 다른 제품처럼 보인다.
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
  assert.equal(meta('property', 'og:title'), title);
  const ogDesc = meta('property', 'og:description') ?? '';
  const desc = meta('name', 'description') ?? '';
  for (const key of ['HWP', '배명훈 모드']) {
    assert.ok(ogDesc.includes(key), `og:description 에 "${key}" 가 없다`);
    assert.ok(desc.includes(key), `description 에 "${key}" 가 없다`);
  }
});
