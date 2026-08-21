import type { SelectionRect } from '@/core/types';
import { VirtualScroll } from '@/view/virtual-scroll';

/**
 * 선택 칠. 상자 하나하나는 **불투명**하게 칠하고, 투명도는 겹 전체에 한 번만 준다.
 *
 * 상자마다 반투명으로 칠하면 상자가 겹치는 자리가 두 번 칠해져 **진한 선**이 생긴다.
 * 줄과 줄이 맞닿는 자리, 한 줄이 여러 조각으로 나뉘는 자리 모두에서 그렇다. 좌표를 픽셀
 * 격자에 맞춰 겹침을 없애 보았지만, 화면 전체에 확대(`--ui-scale`)가 걸려 있어 맞춰 놓은
 * 정수 좌표가 다시 소수가 된다 — 좌표로는 막을 수 없다.
 *
 * 불투명하게 칠하면 겹쳐도 같은 색이라 진해지지 않는다. 투명도는 겹(layer)에 한 번 걸어
 * 합성할 때 적용되므로 결과는 지금과 같은 농도다.
 */
/*
 * 색은 앱의 글자색(`--ui-text-secondary`, #57504a)을 옅게 깐 **따뜻한 중성색**이다.
 * 파랑이 아닌 이유가 셋 있다.
 *
 * 1. hwwp 화면에는 파란색이 없다. 바탕(#faf9f7)·테두리(#ddd8d1)·글자(#57504a)·
 *    강조색(#b45309)이 전부 따뜻한 계열이라, 파란 선택만 다른 앱에서 떼어 붙인 것처럼
 *    뜬다.
 * 2. 그렇다고 강조색(호박빛)을 쓸 수는 없다. **형광펜과 구분이 안 된다** — 워드프로세서에서
 *    "선택했다" 와 "형광펜을 칠했다" 를 헷갈리게 만들면 안 된다.
 * 3. 중성색은 아래 글자색을 왜곡하지 않는다. 파랑을 덮으면 빨강이 탁해지고 보라가 뭉갠다.
 *    선택은 글을 가리는 것이 아니라 범위를 표시하는 것이므로 아래 정보를 살리는 쪽이 맞다.
 *
 * "회색이면 비활성처럼 보인다" 는 걱정은 **파란 앱**에서 회색이 나올 때 생긴다. 대비할
 * 활성 파랑이 없는 화면에서는 그렇게 읽히지 않는다. 게다가 이 칠은 줄 높이를 꽉 채우는
 * 블록이라, 글자에 딱 붙는 형광펜과 모양부터 다르다.
 */
const SELECTION_FILL = 'rgb(87,80,74)';
const SELECTION_OPACITY = '0.22';

/** 선택 영역을 반투명 사각형으로 렌더링한다 */
export class SelectionRenderer {
  private layer: HTMLDivElement;
  private highlights: HTMLDivElement[] = [];
  private activeCount = 0;
  private lastSignature = '';

  constructor(
    private container: HTMLElement,
    private virtualScroll: VirtualScroll,
  ) {
    this.layer = document.createElement('div');
    this.layer.className = 'selection-layer';
    this.layer.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;'
      + `opacity:${SELECTION_OPACITY};`;
    const scrollContent = container.querySelector('#scroll-content');
    if (scrollContent) {
      scrollContent.appendChild(this.layer);
    }
  }

  /** 선택 사각형을 렌더링한다 */
  render(rects: SelectionRect[], zoom: number): void {
    this.ensureAttached();

    const scrollContent = this.container.querySelector('#scroll-content');
    if (!scrollContent || rects.length === 0) {
      this.clear();
      return;
    }

    const contentWidth = scrollContent?.clientWidth ?? 0;
    const layouts: string[] = [];

    for (const rect of rects) {
      const pageOffset = this.virtualScroll.getPageOffset(rect.pageIndex);
      const pageDisplayWidth = this.virtualScroll.getPageWidth(rect.pageIndex);
      const pageLeft = (contentWidth - pageDisplayWidth) / 2;
      layouts.push([
        pageLeft + rect.x * zoom,
        pageOffset + rect.y * zoom,
        rect.width * zoom,
        rect.height * zoom,
      ].map(v => v.toFixed(2)).join(','));
    }

    const signature = layouts.join('|');
    if (signature === this.lastSignature) return;

    for (let i = 0; i < layouts.length; i++) {
      const div = this.ensureHighlight(i);
      const [left, top, width, height] = layouts[i].split(',');

      div.style.left = `${left}px`;
      div.style.top = `${top}px`;
      div.style.width = `${width}px`;
      div.style.height = `${height}px`;
      div.style.display = 'block';
    }

    for (let i = layouts.length; i < this.activeCount; i++) {
      this.highlights[i].style.display = 'none';
    }
    this.activeCount = layouts.length;
    this.lastSignature = signature;
  }

  /** 모든 하이라이트를 제거한다 */
  clear(): void {
    if (this.activeCount === 0 && this.lastSignature === '') return;
    for (let i = 0; i < this.activeCount; i++) {
      this.highlights[i].style.display = 'none';
    }
    this.activeCount = 0;
    this.lastSignature = '';
  }

  /** 레이어가 DOM에 없으면 재부착한다 (loadDocument 후 컨테이너 교체 대응) */
  private ensureAttached(): void {
    if (this.layer.parentElement) return;
    const scrollContent = this.container.querySelector('#scroll-content');
    if (scrollContent) {
      scrollContent.appendChild(this.layer);
    }
  }

  private ensureHighlight(index: number): HTMLDivElement {
    let div = this.highlights[index];
    if (!div) {
      div = document.createElement('div');
      div.className = 'selection-highlight';
      div.style.cssText =
        `position:absolute;background:${SELECTION_FILL};pointer-events:none;display:none;`;
      this.layer.appendChild(div);
      this.highlights[index] = div;
    }
    return div;
  }

  dispose(): void {
    this.clear();
    this.layer.remove();
  }
}
