import type { CursorRect } from '@/core/types';
import { VirtualScroll } from '@/view/virtual-scroll';

/** pt → 문서 좌표 px (문서 좌표는 96dpi 기준이다) */
const PX_PER_PT = 96 / 72;

/**
 * 조합 오버레이의 글자 크기(문서 좌표 px).
 *
 * 실제 글자 크기를 알면 그것을 쓴다 — 그래야 아래 canvas 글자와 정확히 겹친다.
 * 못 읽었을 때만 줄 높이에서 어림한다.
 */
function compositionFontSize(lineHeight: number, fontSizePt?: number): number {
  if (typeof fontSizePt === 'number' && Number.isFinite(fontSizePt) && fontSizePt > 0) {
    return fontSizePt * PX_PER_PT;
  }
  return lineHeight * 0.85;
}

/**
 * 캐럿 위에서 글자 기준선까지의 거리(글꼴 크기 대비).
 *
 * 엔진이 캐럿 위를 이 규칙으로 잡는다 — `캐럿 위 = 줄 위 + 기준선 - 글꼴크기 × 0.8`
 * (`src/document_core/queries/cursor_rect.rs`). 뒤집으면 **기준선은 캐럿 위에서
 * 글꼴크기 × 0.8 아래**다. 오버레이 글자를 canvas 글자와 겹치려면 이 값을 그대로 써야
 * 한다. 이 상수가 엔진과 어긋나면 조합 중인 글자만 위아래로 어긋나 보인다.
 */
const CARET_TOP_TO_BASELINE = 0.8;

/** 글꼴의 위·아래 폭(px). 브라우저가 실제로 그릴 자리를 재서 얻는다. */
interface FontVerticalMetrics {
  ascent: number;
  descent: number;
}

const fontMetricsCache = new Map<string, FontVerticalMetrics>();
let metricsCanvas: CanvasRenderingContext2D | null = null;

/**
 * 글꼴의 ascent/descent 를 잰다.
 *
 * CSS 는 줄 상자 안에서 글자를 제 나름대로 가운데 맞춤한다. 그 결과 기준선이 어디에
 * 놓이는지는 글꼴마다 다르므로, 원하는 자리에 기준선을 놓으려면 실제 값을 알아야 한다.
 * 어림값을 쓰면 글꼴을 바꿀 때마다 조금씩 어긋난다.
 *
 * 못 재는 환경(구형 브라우저)에서는 null 을 돌려주고 부르는 쪽이 옛 방식으로 물러난다.
 */
function measureFontVerticalMetrics(fontFamily: string, fontSizePx: number): FontVerticalMetrics | null {
  if (!(fontSizePx > 0)) return null;
  const key = `${fontSizePx}|${fontFamily}`;
  const cached = fontMetricsCache.get(key);
  if (cached) return cached;
  try {
    if (!metricsCanvas) {
      metricsCanvas = document.createElement('canvas').getContext('2d');
    }
    if (!metricsCanvas) return null;
    metricsCanvas.font = `${fontSizePx}px ${fontFamily}`;
    // 한글 한 글자로 잰다 — 라틴 문자만으로는 한글 글꼴의 위아래 폭이 안 나온다.
    const m = metricsCanvas.measureText('가');
    const ascent = m.fontBoundingBoxAscent;
    const descent = m.fontBoundingBoxDescent;
    if (!Number.isFinite(ascent) || !Number.isFinite(descent) || ascent <= 0) return null;
    const metrics = { ascent, descent };
    fontMetricsCache.set(key, metrics);
    return metrics;
  } catch {
    return null;
  }
}

/** Canvas 위에 깜박이는 캐럿을 렌더링한다 */
export class CaretRenderer {
  private caretEl: HTMLDivElement;
  private blinkTimer: number | null = null;
  private visible = false;
  private currentRect: CursorRect | null = null;

  // IME 조합 오버레이
  private compEl: HTMLDivElement;
  private isCompMode = false;

  constructor(
    private container: HTMLElement,
    private virtualScroll: VirtualScroll,
  ) {
    this.caretEl = document.createElement('div');
    this.caretEl.className = 'caret';
    this.caretEl.style.cssText =
      'position:absolute;width:2px;background:#000;pointer-events:none;z-index:10;display:none;';

    // IME 조합 오버레이 (블랙박스 + 흰색 글자)
    this.compEl = document.createElement('div');
    this.compEl.className = 'caret-composition';
    this.compEl.style.cssText =
      'position:absolute;background:#000;color:#fff;pointer-events:none;z-index:10;display:none;' +
      'line-height:1;overflow:hidden;white-space:pre;text-align:center;box-sizing:border-box;';

    // scroll-content 안에 배치 (스크롤과 함께 이동)
    const scrollContent = container.querySelector('#scroll-content');
    if (scrollContent) {
      scrollContent.appendChild(this.caretEl);
      scrollContent.appendChild(this.compEl);
    } else {
      container.appendChild(this.caretEl);
      container.appendChild(this.compEl);
    }
  }

  /** 캐럿을 표시한다 */
  show(rect: CursorRect, zoom: number): void {
    this.ensureAttached();
    this.currentRect = rect;
    this.updatePosition(zoom);
    this.caretEl.style.display = 'block';
    this.startBlink();
  }

  /** 캐럿을 숨긴다 */
  hide(): void {
    this.stopBlink();
    this.caretEl.style.display = 'none';
    this.compEl.style.display = 'none';
    this.isCompMode = false;
    this.currentRect = null;
  }

  /** 줌/스크롤 변경 시 위치를 갱신한다 */
  updatePosition(zoom: number): void {
    if (!this.currentRect) return;
    const { pageIndex } = this.currentRect;
    const { x, y, height } = this.clampCaretRect(this.currentRect, zoom);
    const pageOffset = this.virtualScroll.getPageOffset(pageIndex);
    const pageLeft = this.calcPageLeft(pageIndex);

    this.caretEl.style.left = `${pageLeft + x * zoom}px`;
    this.caretEl.style.top = `${pageOffset + y * zoom}px`;
    this.caretEl.style.height = `${height * zoom}px`;
  }

  /** 새 CursorRect로 갱신한다 (깜박임 리셋) */
  update(rect: CursorRect, zoom: number): void {
    this.ensureAttached();
    this.currentRect = rect;
    this.updatePosition(zoom);
    // 조합 모드가 아닐 때만 일반 캐럿 표시
    if (!this.isCompMode) {
      this.caretEl.style.display = 'block';
      this.caretEl.style.opacity = '1';
      this.visible = true;
      this.startBlink();
    }
  }

  /** 드래그 중 캐럿 위치를 갱신한다 (기존 깜박임 타이머 유지) */
  updateLive(rect: CursorRect, zoom: number): void {
    this.ensureAttached();
    this.currentRect = rect;
    this.updatePosition(zoom);
    if (!this.isCompMode) {
      this.caretEl.style.display = 'block';
      this.caretEl.style.opacity = '1';
      this.visible = true;
      if (this.blinkTimer === null) {
        this.startBlink();
      }
    }
  }

  /**
   * IME 조합 오버레이를 표시한다.
   *
   * `fontSizePt` 는 조합 중인 자리의 실제 글자 크기다(pt). 넘어오지 않으면 줄 높이에서
   * 어림한다 — 어림값은 실제보다 크게 나오므로 아래 canvas 글자와 어긋난다.
   */
  showComposition(
    startRect: CursorRect,
    charWidth: number,
    zoom: number,
    text: string,
    fontFamily: string,
    fontSizePt?: number,
  ): void {
    this.ensureAttached();
    this.isCompMode = true;

    // 일반 캐럿 숨기기
    this.caretEl.style.display = 'none';

    const { pageIndex } = startRect;
    const box = this.clampCompositionBox(startRect, charWidth);
    const pageOffset = this.virtualScroll.getPageOffset(pageIndex);
    const pageLeft = this.calcPageLeft(pageIndex);

    // 블랙박스 위치/크기
    const w = box.w * zoom;
    const left = pageLeft + box.x * zoom;
    // 조합 글자는 아래 canvas 에도 같은 글자가 그려져 있다(조합 텍스트를 문서에 바로
    // 넣어 배치를 보여 주기 때문이다). 두 글자의 크기가 다르면 오버레이가 사라질 때마다
    // 크기가 튄다. 줄 높이(box.h)는 글자 크기보다 크므로 어림값으로 쓰면 반드시 어긋난다.
    const fontPx = compositionFontSize(box.h, fontSizePt);
    const family = fontFamily || 'sans-serif';
    /*
     * 기준선을 canvas 글자에 맞춘다.
     *
     * 예전에는 상자 높이를 그대로 줄 높이로 주고 CSS 에 가운데 맞춤을 맡겼다. 그러면
     * 기준선이 글꼴 metrics 에 따라 제멋대로 놓여, 조합 중인 글자만 아래로 처져 보였다 —
     * 다 치고 나면 canvas 글자로 바뀌면서 제자리로 올라갔다.
     *
     * 이제 기준선 자리를 직접 정한다. 상자 위에서 `글꼴크기 × 0.8` 아래가 기준선이고,
     * 줄 높이를 글꼴의 실제 위아래 폭(ascent+descent)으로 주면 기준선이 정확히
     * ascent 만큼 내려온 자리에 놓인다. 그래서 상자를 그만큼 위로 올려 잡는다.
     *
     * 상자 높이도 글꼴의 위아래 폭으로 맞춘다. 글꼴에 따라 ascent 가 0.8 을 넘는데,
     * 옛 높이(글꼴 크기)를 그대로 두면 글자 윗부분이 상자 밖으로 나가 잘렸다
     * (상자는 `overflow: hidden` 이다).
     */
    // metrics 는 **화면에 실제로 그려지는 크기**로 잰다. 브라우저는 이 값을 정수로
    // 반올림하므로, 확대 전 크기로 재서 zoom 을 곱하면 그만큼 어긋난다.
    const metrics = measureFontVerticalMetrics(family, fontPx * zoom);
    const baselineY = pageOffset + (box.y + fontPx * CARET_TOP_TO_BASELINE) * zoom;
    const h = metrics ? metrics.ascent + metrics.descent : box.h * zoom;
    const top = metrics ? baselineY - metrics.ascent : pageOffset + box.y * zoom;

    this.compEl.style.left = `${left}px`;
    this.compEl.style.top = `${top}px`;
    this.compEl.style.width = `${w}px`;
    this.compEl.style.height = `${h}px`;
    this.compEl.style.fontSize = `${fontPx * zoom}px`;
    this.compEl.style.fontFamily = family;
    this.compEl.style.lineHeight = `${h}px`;
    this.compEl.textContent = text;
    this.compEl.style.display = 'block';
    this.compEl.style.opacity = '1';
    this.visible = true;
    // 조합 중인 글자는 캐럿이 아니다.
    //
    // 예전에는 여기서 깜빡임 타이머를 걸었다. 그러면 오버레이가 0.5초마다 사라졌다
    // 나타나면서 아래 canvas 글자와 번갈아 보이고, 두 글자의 크기가 달라 글자가
    // 심장박동처럼 커졌다 작아졌다 했다. 깜빡여야 하는 것은 "여기에 쓸 수 있다"는
    // 신호이지 이미 쓰고 있는 글자가 아니다.
    this.stopBlink();
  }

  /** IME 조합 오버레이를 숨기고 일반 캐럿으로 복귀한다 */
  hideComposition(): void {
    if (!this.isCompMode) return;
    this.isCompMode = false;
    this.compEl.style.display = 'none';
    // 조합이 끝나면 깜빡이는 캐럿으로 돌아온다. showComposition 이 캐럿을 숨기고
    // 타이머도 멈춰 두므로, 여기서 되살리지 않으면 다음 update 가 올 때까지 캐럿이
    // 없는 순간이 생긴다.
    if (this.currentRect) {
      this.caretEl.style.display = 'block';
      this.startBlink();
    }
  }

  /** 셀 bbox가 있는 캐럿은 DOM 선 폭까지 셀 안에 남도록 보정한다. */
  private clampCaretRect(rect: CursorRect, zoom: number): { x: number; y: number; height: number } {
    const bounds = rect.cellBounds;
    if (!bounds) return rect;

    const caretWidth = 2 / Math.max(zoom, 0.01);
    const height = Math.min(rect.height, Math.max(0, bounds.h));
    const maxX = Math.max(bounds.x, bounds.x + bounds.w - caretWidth);
    const maxY = Math.max(bounds.y, bounds.y + bounds.h - height);
    return {
      x: Math.min(Math.max(rect.x, bounds.x), maxX),
      y: Math.min(Math.max(rect.y, bounds.y), maxY),
      height,
    };
  }

  /** IME 조합창은 Canvas clip을 받지 않으므로 셀 가시 bbox로 별도 제한한다. */
  private clampCompositionBox(
    rect: CursorRect,
    charWidth: number,
  ): { x: number; y: number; w: number; h: number } {
    let x = rect.x;
    let y = rect.y;
    let w = Math.max(charWidth, rect.height * 0.6);
    let h = rect.height;
    const bounds = rect.cellBounds;
    if (!bounds) return { x, y, w, h };

    w = Math.min(w, Math.max(0, bounds.w));
    h = Math.min(h, Math.max(0, bounds.h));
    const maxX = Math.max(bounds.x, bounds.x + bounds.w - w);
    const maxY = Math.max(bounds.y, bounds.y + bounds.h - h);
    x = Math.min(Math.max(x, bounds.x), maxX);
    y = Math.min(Math.max(y, bounds.y), maxY);
    return { x, y, w, h };
  }

  /** 페이지의 화면 X 좌표를 계산한다 (그리드/단일 열 공통) */
  private calcPageLeft(pageIndex: number): number {
    const gridLeft = this.virtualScroll.getPageLeft(pageIndex);
    if (gridLeft >= 0) return gridLeft;
    // 단일 열: CSS 중앙 정렬 보정
    const scrollContent = this.container.querySelector('#scroll-content');
    const contentWidth = scrollContent?.clientWidth ?? 0;
    const pageDisplayWidth = this.virtualScroll.getPageWidth(pageIndex);
    return (contentWidth - pageDisplayWidth) / 2;
  }

  /** 캐럿 엘리먼트가 DOM에 없으면 재부착한다 (loadDocument 후 컨테이너 교체 대응) */
  private ensureAttached(): void {
    const scrollContent = this.container.querySelector('#scroll-content');
    if (this.caretEl.parentElement && this.compEl.parentElement) return;
    if (scrollContent) {
      if (!this.caretEl.parentElement) scrollContent.appendChild(this.caretEl);
      if (!this.compEl.parentElement) scrollContent.appendChild(this.compEl);
    }
  }

  /** 깜빡이는 것은 캐럿뿐이다 — 조합 오버레이는 대상이 아니다. */
  private startBlink(): void {
    this.stopBlink();
    this.visible = true;
    this.caretEl.style.opacity = '1';
    this.blinkTimer = window.setInterval(() => {
      this.visible = !this.visible;
      this.caretEl.style.opacity = this.visible ? '1' : '0';
    }, 500);
  }

  private stopBlink(): void {
    if (this.blinkTimer !== null) {
      clearInterval(this.blinkTimer);
      this.blinkTimer = null;
    }
  }

  dispose(): void {
    this.stopBlink();
    this.caretEl.remove();
    this.compEl.remove();
  }
}
