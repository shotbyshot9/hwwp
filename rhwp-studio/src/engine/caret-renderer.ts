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
    const h = box.h * zoom;
    const left = pageLeft + box.x * zoom;
    const top = pageOffset + box.y * zoom;

    this.compEl.style.left = `${left}px`;
    this.compEl.style.top = `${top}px`;
    this.compEl.style.width = `${w}px`;
    this.compEl.style.height = `${h}px`;
    // 조합 글자는 아래 canvas 에도 같은 글자가 그려져 있다(조합 텍스트를 문서에 바로
    // 넣어 배치를 보여 주기 때문이다). 두 글자의 크기가 다르면 오버레이가 사라질 때마다
    // 크기가 튄다. 줄 높이(box.h)는 글자 크기보다 크므로 어림값으로 쓰면 반드시 어긋난다.
    this.compEl.style.fontSize = `${compositionFontSize(box.h, fontSizePt) * zoom}px`;
    this.compEl.style.fontFamily = fontFamily || 'sans-serif';
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
