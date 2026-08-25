/**
 * 배명훈 모드를 보여 주는 소개 그림(`public/og-focus.png`)을 만든다.
 *
 * `og.png` 는 "이게 무엇인가"(브라우저에서 쓰는 HWP 편집기)를 말한다. 이 그림은
 * "왜 다른가"를 말한다 — 글을 쓰면 응원해 준다는 것. 글로 백 줄 설명하는 것보다
 * 한 장이 빠르다.
 *
 * 트위터·스레드 글에 붙이거나 README 안에 넣는 용도다.
 *
 * **화면 사진이 아니라 그린 그림이다.** 배명훈 모드의 실제 색과 배치를 그대로 따르되
 * (`styles/focus-mode.css` 의 어두운 테마 값), 폭죽은 한 장면으로 굳혀 그린다.
 * 실제 화면을 찍은 것처럼 보이게 하려고 없는 기능을 넣지 않는다.
 *
 *   node scripts/gen-focus-image.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import CanvasKitInit from 'canvaskit-wasm';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');

const W = 1200;
const H = 630;

/* 배명훈 모드 어두운 테마 — focus-mode.css 와 같은 값 */
const BG = '#0c0a09';
const FG = '#f0ece6';
const MUTED = '#9d917b';
const BORDER = '#332c29';
const AMBER = '#f59f0a';

/* 폭죽 색 — confetti.ts 의 팔레트에서 골랐다 */
const CONFETTI = [
  '#F59E0B', '#FBBF24', '#FCD34D', '#EF4444', '#F97316',
  '#10B981', '#34D399', '#3B82F6', '#60A5FA', '#8B5CF6',
  '#A78BFA', '#EC4899', '#F472B6', '#14B8A6', '#2DD4BF',
];

/*
 * 쓰는 중인 문장. 마지막 줄이 마침표로 끝나고, 그 순간 폭죽이 터진다 —
 * 이 제품에서 가장 중요한 한 장면이다.
 */
const WRITING = [
  '그는 오래 미뤄 둔 문장을 마침내 적었다.',
  '창밖에는 아직 아무 일도 일어나지 않았지만,',
  '방 안에서는 박수 소리가 났다.',
];

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

const face = ck.Typeface.MakeFreeTypeFaceFromData(
  readFileSync(resolve(repo, 'ttfs', 'opensource', 'NotoSansKR-Regular.ttf')).buffer,
);
if (!face) throw new Error('글꼴을 읽지 못했습니다');

function text(str, x, y, size, color) {
  const font = new ck.Font(face, size);
  font.setSubpixel(true);
  const p = paint(color);
  canvas.drawText(str, x, y, p, font);
  font.delete();
  p.delete();
}

canvas.clear(ck.parseColorString(BG));

/* ── 머리글 ── 실제 화면처럼 깃펜 표식과 모드 이름, 배속 단추 ── */
const HEADER_H = 62;
// 바닥글이 시작하는 높이. 폭죽이 넘지 않을 아래 한계이기도 해서 위에서 정한다.
const FOOTER_Y = H - 74;
canvas.drawRect(ck.XYWHRect(0, HEADER_H, W, 1), paint(BORDER));
// 깃펜 자리를 대신하는 작은 호박색 마름모
canvas.save();
canvas.translate(46, 31);
canvas.rotate(45, 0, 0);
canvas.drawRect(ck.XYWHRect(-7, -7, 14, 14), paint(AMBER));
canvas.restore();
text('배명훈 모드', 68, 39, 20, FG);
text('x1', W - 148, 39, 18, MUTED);
text('Esc', W - 96, 39, 16, MUTED);

/* ── 본문 ── 쓰고 있는 문장. 마지막 줄 끝에 캐럿 ── */
const LEFT = 150;
const BODY_SIZE = 34;
const BODY_TOP = 232;

/** 글자 폭을 실제로 재서 돌려준다 — 캐럿 자리와 폭죽 피할 범위를 여기서 정한다 */
function measure(str, size) {
  const font = new ck.Font(face, size);
  const w = font.getGlyphWidths(font.getGlyphIDs(str)).reduce((a, b) => a + b, 0);
  font.delete();
  return w;
}

WRITING.forEach((line, i) => text(line, LEFT, BODY_TOP + i * 62, BODY_SIZE, FG));

// 캐럿은 마지막 줄이 실제로 끝나는 자리에 둔다. 눈대중으로 박아 두면 글을 고칠 때마다
// 어긋난다.
const lastWidth = measure(WRITING[WRITING.length - 1], BODY_SIZE);
canvas.drawRect(
  ck.XYWHRect(LEFT + lastWidth + 8, BODY_TOP + (WRITING.length - 1) * 62 - 30, 3, 42),
  paint(FG),
);

/*
 * 글자가 놓인 자리. 폭죽은 여기를 피한다.
 *
 * 폭죽이 글자를 덮으면 읽을 수가 없다. 실제 화면에서는 폭죽이 움직이며 지나가므로
 * 잠깐 겹쳐도 괜찮지만, 한 장으로 굳힌 그림에서는 그대로 남는다.
 */
const bodyWidth = Math.max(...WRITING.map((line) => measure(line, BODY_SIZE)));
const TEXT_BOX = {
  x0: LEFT - 30,
  x1: LEFT + bodyWidth + 40,
  y0: BODY_TOP - 46,
  y1: BODY_TOP + (WRITING.length - 1) * 62 + 22,
};

/* ── 폭죽 ── 좌우에서 안쪽 위로. 한 장면으로 굳혀 그린다 ── */
let seed = 20260825;
const rand = () => {
  // 돌릴 때마다 같은 그림이 나와야 한다 — Math.random 을 쓰면 커밋마다 달라진다.
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

function burst(originX, originY, dir, count) {
  for (let i = 0; i < count; i++) {
    const angle = (-60 + (rand() - 0.5) * 70) * (Math.PI / 180);
    const dist = 90 + rand() * 320;
    const x = originX + Math.cos(angle) * dist * dir;
    // 위로 솟았다 중력에 눌리는 궤적을 대충 흉내 낸다
    const t = dist / 400;
    const y = originY + Math.sin(angle) * dist + t * t * 190;
    if (x < 8 || x > W - 8 || y < HEADER_H + 8 || y > FOOTER_Y - 8) continue;
    // 글자 위에는 얹지 않는다.
    if (x > TEXT_BOX.x0 && x < TEXT_BOX.x1 && y > TEXT_BOX.y0 && y < TEXT_BOX.y1) continue;
    const size = 7 + rand() * 11;
    const color = CONFETTI[Math.floor(rand() * CONFETTI.length)];
    canvas.save();
    canvas.translate(x, y);
    canvas.rotate(rand() * 360, 0, 0);
    // 회전에 따라 납작해 보이게 — 실제 폭죽이 뒤집히며 떨어지는 모습
    canvas.drawRect(ck.XYWHRect(-size / 2, -size / 2, size, size * (0.35 + rand() * 0.65)), paint(color));
    canvas.restore();
  }
}

// 위아래로 나눠 쏘아 화면을 고르게 채운다. 한 높이에서만 쏘면 아래가 텅 빈다.
burst(0, 250, 1, 55);
burst(W, 250, -1, 55);
burst(0, 430, 1, 45);
burst(W, 430, -1, 45);

/* ── 바닥글 ── 단어·글자·시간과 목표 진행바 ── */
canvas.drawRect(ck.XYWHRect(0, FOOTER_Y, W, 1), paint(BORDER));
text('단어 128', 46, FOOTER_Y + 44, 18, MUTED);
text('글자 412', 168, FOOTER_Y + 44, 18, MUTED);
text('24:16', 290, FOOTER_Y + 44, 18, MUTED);

// 목표 진행바 — 오른쪽. 실제 화면도 space-between 이라 여기에 붙는다.
text('412 / 1,000자', W - 366, FOOTER_Y + 44, 18, MUTED);
const barX = W - 226;
const barW = 180;
canvas.drawRRect(ck.RRectXY(ck.XYWHRect(barX, FOOTER_Y + 33, barW, 6), 3, 3), paint(BORDER));
canvas.drawRRect(
  ck.RRectXY(ck.XYWHRect(barX, FOOTER_Y + 33, barW * 0.412, 6), 3, 3),
  paint(AMBER),
);

const image = surface.makeImageSnapshot();
const bytes = image.encodeToBytes(ck.ImageFormat.PNG, 100);
if (!bytes) throw new Error('PNG 로 만들지 못했습니다');

const out = resolve(here, '..', 'public', 'og-focus.png');
writeFileSync(out, Buffer.from(bytes));

image.delete();
surface.delete();
face.delete();

console.log(`og-focus.png 를 만들었습니다: ${out} (${W}×${H}, ${Math.round(bytes.length / 1024)}KB)`);
