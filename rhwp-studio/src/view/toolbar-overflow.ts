/**
 * 도구 상자를 한 줄로 유지하고, 넘치는 것은 `»` 안으로 보낸다.
 *
 * 예전에는 `flex-wrap: wrap` 이라 폭이 모자라면 두 줄로 접혔다. 접히는 순간 도구
 * 상자 높이가 60px 에서 125px 로 **두 배**가 됐고, 1280 폭에서 이미 접혔다. 화면
 * 세로가 짧을수록 글 쓸 자리가 줄어드는데, 접힘은 하필 그런 화면에서 일어난다.
 *
 * 구글 독스가 도구 모음을 절대 접지 않는 것도 같은 이유다. 자리가 모자라면 줄을
 * 늘리는 게 아니라 뒤쪽을 넘침 메뉴로 보낸다. 높이는 무슨 일이 있어도 한 줄이다.
 *
 * 옮기는 단위는 버튼이 아니라 `.tb-group` 이다. 그룹은 함께 쓰이는 것들의 묶음이라
 * 가운데가 잘리면 남은 쪽이 무슨 무리인지 알 수 없게 된다.
 */

/** 넘침 단추가 스스로 차지하는 폭 — 자리를 계산할 때 미리 빼 둔다 */
const OVERFLOW_BUTTON_WIDTH = 34;

export class ToolbarOverflow {
  private readonly host: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly panel: HTMLElement;
  private readonly wrap: HTMLElement;
  /** 처음 순서. 되돌릴 때 이 순서대로 다시 꽂는다. */
  private readonly items: HTMLElement[];
  private observer: ResizeObserver | null = null;
  private mutations: MutationObserver | null = null;
  private frame: number | null = null;
  /** layout() 이 스스로 일으킨 DOM 변화에 다시 반응하지 않도록 막는 빗장 */
  private applying = false;

  constructor(host: HTMLElement) {
    this.host = host;
    this.items = [...host.children].filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    );

    this.wrap = document.createElement('div');
    this.wrap.className = 'tb-overflow';

    this.button = document.createElement('button');
    this.button.className = 'tb-btn tb-overflow-btn';
    this.button.type = 'button';
    this.button.title = '나머지 도구';
    this.button.setAttribute('aria-label', '나머지 도구');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.textContent = '»';

    this.panel = document.createElement('div');
    this.panel.className = 'tb-overflow-panel';

    this.wrap.append(this.button, this.panel);
    host.appendChild(this.wrap);

    this.button.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.toggle();
    });
    // 밖을 누르면 닫는다. 도구를 고른 뒤에도 닫는다 — 명령은 한 번 쓰고 끝이다.
    document.addEventListener('mousedown', (e) => {
      if (!this.wrap.contains(e.target as Node)) this.close();
    });
    this.panel.addEventListener('mouseup', () => this.close());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });

    this.observe();
  }

  private observe(): void {
    this.layout();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', () => this.schedule());
    } else {
      this.observer = new ResizeObserver(() => this.schedule());
      this.observer.observe(this.host);
    }

    // 머리말·주석·그림 모드가 도구 그룹을 style.display 로 감췄다 보였다 한다. 그때
    // 도구 상자의 바깥 치수는 그대로여서 ResizeObserver 가 울지 않는데, 안에서 자리를
    // 차지하는 폭은 달라진다. 그래서 자식의 style 변화도 따로 본다.
    if (typeof MutationObserver !== 'undefined') {
      this.mutations = new MutationObserver(() => {
        if (this.applying) return;
        this.schedule();
      });
      this.mutations.observe(this.host, {
        attributes: true,
        attributeFilter: ['style'],
        subtree: true,
      });
    }
  }

  private schedule(): void {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.layout();
    });
  }

  /**
   * 앞에서부터 들어가는 만큼만 줄에 두고 나머지를 패널로 보낸다.
   *
   * 매번 전부 되돌린 뒤 다시 계산한다. 폭이 늘었을 때 되돌아오는 경로를 따로 두면
   * 두 경로가 어긋나 항목이 양쪽에 다 없거나 다 있는 상태가 생긴다.
   */
  private layout(): void {
    this.applying = true;
    try {
      this.applyLayout();
    } finally {
      this.applying = false;
    }
  }

  private applyLayout(): void {
    for (const item of this.items) this.host.insertBefore(item, this.wrap);
    this.wrap.classList.remove('tb-overflow-active');

    const style = getComputedStyle(this.host);
    const available = this.host.clientWidth
      - parseFloat(style.paddingLeft || '0')
      - parseFloat(style.paddingRight || '0');
    if (available <= 0) return;

    let used = 0;
    let moved = false;
    for (const item of this.items) {
      const width = item.getBoundingClientRect().width;
      // 넘침 단추가 생길 자리를 남겨 둔다 — 마지막 하나가 딱 맞아 들어간 뒤 단추가
      // 밀려나 결국 접히는 것을 막는다.
      const budget = moved ? available - OVERFLOW_BUTTON_WIDTH : available;
      if (!moved && used + width <= budget) {
        used += width;
        continue;
      }
      if (!moved) {
        moved = true;
        // 처음 넘친 항목부터는 앞의 판정을 다시 하지 않는다. 순서를 지켜야
        // 되돌아올 때 원래 자리로 간다.
      }
      this.panel.appendChild(item);
    }

    this.wrap.classList.toggle('tb-overflow-active', moved);
    if (!moved) this.close();
  }

  private toggle(): void {
    if (this.wrap.classList.contains('open')) this.close();
    else this.open();
  }

  private open(): void {
    this.wrap.classList.add('open');
    this.button.setAttribute('aria-expanded', 'true');
  }

  private close(): void {
    this.wrap.classList.remove('open');
    this.button.setAttribute('aria-expanded', 'false');
  }

  dispose(): void {
    this.observer?.disconnect();
    this.mutations?.disconnect();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
  }
}

/** 도구 상자에 넘침 처리를 붙인다. 요소가 없으면 아무 일도 하지 않는다. */
export function installToolbarOverflow(selector: string): ToolbarOverflow | null {
  const host = document.querySelector<HTMLElement>(selector);
  if (!host) return null;
  return new ToolbarOverflow(host);
}
