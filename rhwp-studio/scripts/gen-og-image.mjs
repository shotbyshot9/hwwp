/**
 * 링크 미리보기 그림(`public/og.png`)을 만든다.
 *
 * 누가 hwwp.kr 을 트위터나 카카오톡에 붙였을 때 뜨는 1200×630 카드다. 이것이 없으면
 * 주소만 덜렁 나오고, 받는 사람은 무엇인지 몰라 누르지 않는다.
 *
 * 손으로 만든 png 를 저장소에 넣지 않고 스크립트로 만드는 이유: 제품 이름이나 한 줄
 * 소개가 바뀌면 그림도 함께 바뀌어야 하는데, 손으로 만든 그림은 반드시 어긋난다.
 *
 * 그리는 도구는 CanvasKit(Skia) 이다. 이 제품이 이미 쓰는 엔진이라 따로 의존성을
 * 늘리지 않는다. 글꼴은 저장소가 가진 Noto Sans KR(OFL) 을 쓴다 — 시스템 글꼴을
 * 쓰면 만드는 사람 컴퓨터에 따라 결과가 달라진다.
 *
 *   node scripts/gen-og-image.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import CanvasKitInit from 'canvaskit-wasm';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');

const W = 1200;
const H = 630;

/* hwwp 의 색. 정책 문서·앱과 같은 값을 쓴다. */
const PAPER = '#f8f6f2';
const INK = '#2e241f';
const MUTED = '#6b5f57';
const AMBER = '#f59f0a';

const TITLE = 'hwwp';
const TAGLINE = '브라우저에서 바로 쓰는 HWP 워드프로세서';
const LINES = [
  '설치도 가입도 없이 HWP·HWPX 를 열고 편집합니다.',
  '글을 쓰면 응원해 주는 배명훈 모드가 있습니다.',
];
const FOOT = 'hwwp.kr · 무료 · 오픈소스';

const ck = await CanvasKitInit({
  locateFile: (f) => resolve(here, '..', 'node_modules', 'canvaskit-wasm', 'bin', f),
});

const surface = ck.MakeSurface(W, H);
if (!surface) throw new Error('CanvasKit surface 를 만들지 못했습니다');
const canvas = surface.getCanvas();

const paint = (hex) => {
  const p = new ck.Paint();
  p.setColor(ck.parseColorString(hex));
  p.setAntiAlias(true);
  return p;
};

canvas.clear(ck.parseColorString(PAPER));

/*
 * 왼쪽 세로 호박색 띠.
 *
 * 정책 문서의 `.lead` 가 왼쪽에 3px 호박색 선을 두는 것과 같은 규칙이다. 로고를 크게
 * 넣는 대신 이 띠 하나로 브랜드를 잡는다 — 미리보기 카드는 작게 뜨므로 요소가 적을수록
 * 알아보기 쉽다.
 */
canvas.drawRect(ck.XYWHRect(0, 0, 14, H), paint(AMBER));

const face = ck.Typeface.MakeFreeTypeFaceFromData(
  readFileSync(resolve(repo, 'ttfs', 'opensource', 'NotoSansKR-Regular.ttf')).buffer,
);
if (!face) throw new Error('글꼴을 읽지 못했습니다');

/** 글자를 그리고, 그 줄의 폭을 돌려준다 */
function text(str, x, y, size, color, { bold = false } = {}) {
  const font = new ck.Font(face, size);
  font.setSubpixel(true);
  // Noto Sans KR Regular 하나뿐이라 굵은 자리는 부풀려 쓴다. 카드에서는 큰 글자
  // 하나뿐이라 이 정도 부풀리기가 눈에 거슬리지 않는다.
  if (bold) font.setEmbolden?.(true);
  const p = paint(color);
  canvas.drawText(str, x, y, p, font);
  const width = font.getGlyphWidths(font.getGlyphIDs(str)).reduce((a, b) => a + b, 0);
  font.delete();
  p.delete();
  return width;
}

const LEFT = 88;

text(TITLE, LEFT, 246, 132, INK, { bold: true });
text(TAGLINE, LEFT, 318, 38, INK);

// 제목과 본문 사이 가로 선 — 정책 문서의 절 구분선과 같은 몫이다.
canvas.drawRect(ck.XYWHRect(LEFT, 366, 190, 3), paint(AMBER));

LINES.forEach((line, i) => text(line, LEFT, 434 + i * 46, 29, MUTED));

text(FOOT, LEFT, H - 72, 26, MUTED);

/*
 * 오른쪽에 제품 아이콘.
 *
 * 글만 왼쪽에 몰아 두면 오른쪽이 텅 비어 무언가 안 불러와진 것처럼 보인다. 카드는
 * 타임라인에서 작게 뜨므로 알아보는 표식이 하나 있는 편이 낫다.
 */
const iconBytes = readFileSync(resolve(here, '..', 'public', 'icons', 'icon-512.png'));
const icon = ck.MakeImageFromEncoded(iconBytes.buffer.slice(
  iconBytes.byteOffset,
  iconBytes.byteOffset + iconBytes.byteLength,
));
if (icon) {
  const size = 300;
  const x = W - size - 96;
  const y = (H - size) / 2;
  const smooth = { filter: ck.FilterMode.Linear, mipmap: ck.MipmapMode.Linear };
  canvas.drawImageRectOptions(
    icon,
    ck.XYWHRect(0, 0, icon.width(), icon.height()),
    ck.XYWHRect(x, y, size, size),
    smooth.filter,
    smooth.mipmap,
    null,
  );
  icon.delete();
} else {
  console.warn('아이콘을 읽지 못해 글자만 넣었습니다');
}

const image = surface.makeImageSnapshot();
const bytes = image.encodeToBytes(ck.ImageFormat.PNG, 100);
if (!bytes) throw new Error('PNG 로 만들지 못했습니다');

const out = resolve(here, '..', 'public', 'og.png');
writeFileSync(out, Buffer.from(bytes));

image.delete();
surface.delete();
face.delete();

console.log(`og.png 를 만들었습니다: ${out} (${W}×${H}, ${Math.round(bytes.length / 1024)}KB)`);
