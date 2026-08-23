import test from 'node:test';
import assert from 'node:assert/strict';

import { boldFamilyName, resolveCanvasKitFontPlan } from '../src/core/font-loader.ts';

/** 이 url 로 끝나는 source 하나를 찾는다 — 굵은 짝이 함께 실리므로 순서에 기대지 않는다. */
function sourceEndingWith(
  plan: ReturnType<typeof resolveCanvasKitFontPlan>,
  suffix: string,
): { url: string; aliases: string[] } {
  const found = plan.sources.filter(source => source.url.endsWith(suffix));
  assert.equal(found.length, 1, `${suffix} source 가 하나여야 한다 (실제 ${found.length})`);
  return found[0];
}

test('CanvasKit font plan groups document aliases that share one bundled face', () => {
  const plan = resolveCanvasKitFontPlan(
    ['HY그래픽', 'Noto Sans KR'],
    { localFontBaseUrl: 'vscode-resource://extension/fonts/' },
  );

  assert.deepEqual(plan.unavailableFonts, []);
  const regular = sourceEndingWith(plan, 'NotoSansKR-Regular.woff2');
  assert.equal(regular.url, 'vscode-resource://extension/fonts/NotoSansKR-Regular.woff2');
  assert.ok(regular.aliases.includes('HY그래픽'));
  assert.ok(regular.aliases.includes('Noto Sans KR'));
});

/**
 * 굵은 짝은 이름을 따로 갖는다.
 *
 * CanvasKit 은 CSS 의 `font-weight` 서술자를 모르고 이름 하나에 얼굴 하나로만 typeface 를
 * 찾는다. 그래서 굵은 파일을 부를 이름이 따로 필요하고, 그 이름이 계획에 실려야 렌더러가
 * 진하게일 때 진짜 굵은 글꼴을 물 수 있다. 이게 빠지면 조용히 부풀리기(가짜 볼드)로
 * 되돌아간다 — 화면은 나오되 흐릿해진다.
 */
test('CanvasKit font plan carries the real bold face under its own alias', () => {
  const plan = resolveCanvasKitFontPlan(
    ['HY그래픽', 'Noto Sans KR'],
    { localFontBaseUrl: 'vscode-resource://extension/fonts/' },
  );

  const bold = sourceEndingWith(plan, 'NotoSansKR-Bold.woff2');
  assert.ok(bold.aliases.includes(boldFamilyName('HY그래픽')));
  assert.ok(bold.aliases.includes(boldFamilyName('Noto Sans KR')));
  // 굵은 이름과 보통 이름은 절대 겹치면 안 된다 — 겹치면 보통 글이 굵게 나온다.
  const regular = sourceEndingWith(plan, 'NotoSansKR-Regular.woff2');
  for (const alias of bold.aliases) {
    assert.ok(!regular.aliases.includes(alias), `${alias} 가 보통 얼굴에도 걸려 있다`);
  }
});

test('CanvasKit font plan follows the existing Hanyang Jung Gothic substitution', () => {
  const plan = resolveCanvasKitFontPlan(['한양중고딕']);

  assert.deepEqual(plan.unavailableFonts, []);
  const regular = sourceEndingWith(plan, 'NotoSansKR-Regular.woff2');
  assert.ok(regular.aliases.includes('한양중고딕'));
  assert.ok(regular.aliases.includes('HY중고딕'));

  // 대체를 거쳐 온 이름도 굵은 짝을 얻어야 한다. 렌더러는 문서가 부른 이름으로 찾는다.
  const bold = sourceEndingWith(plan, 'NotoSansKR-Bold.woff2');
  assert.ok(bold.aliases.includes(boldFamilyName('한양중고딕')));
  assert.ok(bold.aliases.includes(boldFamilyName('HY중고딕')));
});

/**
 * 굵은 짝이 없거나 이 배포 표면에 파일이 없으면 **문서는 그대로 열려야 한다.**
 * 굵기는 부풀리기로 떨어질 뿐이고, 그것이 문서를 못 여는 사유가 되면 안 된다.
 */
test('CanvasKit font plan never blocks a document over a missing bold face', () => {
  const plan = resolveCanvasKitFontPlan(
    ['Noto Sans KR'],
    { availableLocalFiles: new Set(['NotoSansKR-Regular.woff2']) },
  );

  assert.deepEqual(plan.unavailableFonts, []);
  assert.equal(plan.sources.length, 1);
  assert.match(plan.sources[0].url, /NotoSansKR-Regular\.woff2$/);
});

test('CanvasKit font plan fails closed for unavailable surface fonts', () => {
  const offline = resolveCanvasKitFontPlan(
    ['함초롬바탕', 'Times New Roman'],
    { disableExternalWebFonts: true },
  );
  assert.deepEqual(offline.sources, []);
  assert.deepEqual(offline.unavailableFonts, ['함초롬바탕', 'Times New Roman']);

  const extension = resolveCanvasKitFontPlan(
    ['한컴 윤고딕 230', 'Noto Sans KR'],
    {
      localFontBaseUrl: 'vscode-resource://extension/fonts',
      availableLocalFiles: new Set(['NotoSansKR-Regular.woff2']),
    },
  );
  assert.deepEqual(extension.unavailableFonts, ['한컴 윤고딕 230']);
  assert.equal(extension.sources.length, 1);
});
