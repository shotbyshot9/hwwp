/**
 * 집중 작업 모드 (focus mode).
 *
 * 배명훈 소설 속 워드프로세서에서 출발한 Writer's Homeground 의 착상을 whp 로 옮긴 것이다.
 * 두 겹으로 되어 있다.
 *
 * 1. 선(禪) 화면 — 메뉴바·도구상자·서식바·눈금자·상태바를 걷어내고 본문만 남긴다.
 *    타자기 스크롤을 켜면 캐럿이 화면 위쪽 40% 지점에 머물러 시선이 흔들리지 않는다.
 * 2. 응원 레이어 — 문장부호를 찍을 때마다 박수와 폭죽이 터진다. `CheerEngine` 담당.
 *
 * 이 모듈은 편집 엔진을 건드리지 않는다. 확정 입력은 eventBus 의 `text-inserted`
 * 이벤트로만 받고, 화면 상태는 body 의 `fm-active` 클래스로만 바꾼다.
 */

import type { EventBus } from '@/core/event-bus';
import { userSettings } from '@/core/user-settings';
import { CheerEngine } from './cheer-engine';

/** 캐럿을 붙잡아 둘 화면 높이 비율 (0=최상단, 1=최하단) */
const TYPEWRITER_ANCHOR = 0.4;

/** 이 픽셀 이상 어긋났을 때만 스크롤을 보정한다 (미세 떨림 방지) */
const TYPEWRITER_TOLERANCE_PX = 8;

/** 타자기 스크롤 점검 주기(ms) */
const TYPEWRITER_INTERVAL_MS = 80;

/** HUD 가 저절로 흐려지기까지의 무입력 시간(ms) */
const HUD_IDLE_MS = 2500;

export class FocusMode {
  private active = false;
  private cheer = new CheerEngine();
  private overlay: HTMLElement | null = null;
  private elapsedEl: HTMLElement | null = null;
  private charsEl: HTMLElement | null = null;
  private streakEl: HTMLElement | null = null;
  private goalWrapEl: HTMLElement | null = null;
  private goalBarEl: HTMLElement | null = null;
  private goalTextEl: HTMLElement | null = null;

  private startedAt = 0;
  private sessionChars = 0;
  private goalReached = false;

  private tickTimer: number | null = null;
  private typewriterTimer: number | null = null;
  private hudIdleTimer: number | null = null;
  private unsubscribe: (() => void) | null = null;
  private keydownBound = (e: KeyboardEvent) => this.onKeyDown(e);

  constructor(private eventBus: EventBus) {}

  isActive(): boolean {
    return this.active;
  }

  toggle(): void {
    if (this.active) this.exit();
    else this.enter();
  }

  enter(): void {
    if (this.active) return;
    this.active = true;
    this.startedAt = Date.now();
    this.sessionChars = 0;
    this.goalReached = false;

    document.body.classList.add('fm-active');
    this.buildOverlay();
    this.syncMenuState();

    // 진입 자체가 사용자 제스처이므로 여기서 오디오 잠금을 푼다.
    this.cheer.unlock();

    this.unsubscribe = this.eventBus.on('text-inserted', (...args: unknown[]) => {
      const text = typeof args[0] === 'string' ? args[0] : '';
      this.onTextInserted(text);
    });

    document.addEventListener('keydown', this.keydownBound, true);
    this.tickTimer = window.setInterval(() => this.renderStats(), 1000);
    this.startTypewriter();
    this.renderStats();
    this.wakeHud();

    // 레이아웃이 바뀌었으니 뷰포트·캐럿을 다시 잡게 한다.
    this.eventBus.emit('document-view-changed');
    window.dispatchEvent(new Event('resize'));
  }

  exit(): void {
    if (!this.active) return;
    this.active = false;

    document.body.classList.remove('fm-active');
    document.removeEventListener('keydown', this.keydownBound, true);
    this.unsubscribe?.();
    this.unsubscribe = null;

    if (this.tickTimer !== null) window.clearInterval(this.tickTimer);
    this.tickTimer = null;
    this.stopTypewriter();
    if (this.hudIdleTimer !== null) window.clearTimeout(this.hudIdleTimer);
    this.hudIdleTimer = null;

    this.cheer.dispose();
    this.cheer = new CheerEngine();

    this.overlay?.remove();
    this.overlay = null;
    this.elapsedEl = null;
    this.charsEl = null;
    this.streakEl = null;
    this.goalWrapEl = null;
    this.goalBarEl = null;
    this.goalTextEl = null;

    this.syncMenuState();
    this.eventBus.emit('document-view-changed');
    window.dispatchEvent(new Event('resize'));
  }

  /** 설정 변경 후 HUD 를 즉시 반영한다 */
  refresh(): void {
    if (!this.active) return;
    this.renderStats();
    this.startTypewriter();
  }

  // ─── 입력 ────────────────────────────────────────────

  private onTextInserted(text: string): void {
    if (!this.active || !text) return;
    this.sessionChars += text.length;
    this.cheer.noteInserted(text);
    this.renderStats();
    this.wakeHud();
    this.checkGoal();
  }

  private checkGoal(): void {
    const goal = userSettings.getFocusSettings().goalChars;
    if (goal <= 0 || this.goalReached || this.sessionChars < goal) return;
    this.goalReached = true;
    this.cheer.celebrate();
    this.overlay?.classList.add('fm-goal-reached');
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.active) return;
    // IME 조합 중 Esc 는 조합 취소용이므로 가로채지 않는다.
    if (e.key === 'Escape' && !e.isComposing) {
      e.preventDefault();
      e.stopPropagation();
      this.exit();
      return;
    }
    this.wakeHud();
  }

  // ─── 화면 ────────────────────────────────────────────

  private buildOverlay(): void {
    const overlay = document.createElement('div');
    overlay.id = 'focus-mode';
    overlay.className = 'fm-overlay';

    const hud = document.createElement('div');
    hud.className = 'fm-hud';

    const chars = this.makeStat(hud, '글자');
    const elapsed = this.makeStat(hud, '시간');
    const streak = this.makeStat(hud, '연속');

    const goalWrap = document.createElement('div');
    goalWrap.className = 'fm-goal';
    const goalBar = document.createElement('div');
    goalBar.className = 'fm-goal-bar';
    const goalFill = document.createElement('div');
    goalFill.className = 'fm-goal-fill';
    goalBar.appendChild(goalFill);
    const goalText = document.createElement('span');
    goalText.className = 'fm-goal-text';
    goalWrap.append(goalBar, goalText);
    hud.appendChild(goalWrap);

    const exit = document.createElement('button');
    exit.type = 'button';
    exit.className = 'fm-exit';
    exit.textContent = '집중 모드 나가기 (Esc)';
    exit.addEventListener('click', () => this.exit());

    overlay.append(hud, exit);
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.charsEl = chars;
    this.elapsedEl = elapsed;
    this.streakEl = streak;
    this.goalWrapEl = goalWrap;
    this.goalBarEl = goalFill;
    this.goalTextEl = goalText;
  }

  private makeStat(parent: HTMLElement, label: string): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'fm-stat';
    const value = document.createElement('span');
    value.className = 'fm-stat-value';
    value.textContent = '0';
    const caption = document.createElement('span');
    caption.className = 'fm-stat-label';
    caption.textContent = label;
    wrap.append(value, caption);
    parent.appendChild(wrap);
    return value;
  }

  private renderStats(): void {
    if (!this.active) return;
    if (this.charsEl) this.charsEl.textContent = this.sessionChars.toLocaleString('ko-KR');
    if (this.elapsedEl) {
      const seconds = Math.floor((Date.now() - this.startedAt) / 1000);
      const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
      const ss = String(seconds % 60).padStart(2, '0');
      this.elapsedEl.textContent = `${mm}:${ss}`;
    }
    if (this.streakEl) this.streakEl.textContent = String(this.cheer.getStreak());

    const goal = userSettings.getFocusSettings().goalChars;
    if (this.goalWrapEl) this.goalWrapEl.style.display = goal > 0 ? '' : 'none';
    if (goal > 0) {
      const ratio = Math.min(1, this.sessionChars / goal);
      if (this.goalBarEl) this.goalBarEl.style.width = `${(ratio * 100).toFixed(1)}%`;
      if (this.goalTextEl) {
        this.goalTextEl.textContent = `목표 ${goal.toLocaleString('ko-KR')}자 · ${Math.round(ratio * 100)}%`;
      }
    }
  }

  /** 입력이 있으면 HUD 를 잠깐 또렷하게 보여주고, 조용해지면 다시 흐린다 */
  private wakeHud(): void {
    const overlay = this.overlay;
    if (!overlay) return;
    overlay.classList.add('fm-hud-awake');
    if (this.hudIdleTimer !== null) window.clearTimeout(this.hudIdleTimer);
    this.hudIdleTimer = window.setTimeout(() => {
      overlay.classList.remove('fm-hud-awake');
    }, HUD_IDLE_MS);
  }

  private syncMenuState(): void {
    document.querySelectorAll('[data-cmd="focus:toggle"]').forEach((el) => {
      el.classList.toggle('active', this.active);
    });
  }

  // ─── 타자기 스크롤 ────────────────────────────────────

  private startTypewriter(): void {
    this.stopTypewriter();
    if (!userSettings.getFocusSettings().typewriter) return;
    this.typewriterTimer = window.setInterval(() => this.syncTypewriter(), TYPEWRITER_INTERVAL_MS);
  }

  private stopTypewriter(): void {
    if (this.typewriterTimer !== null) window.clearInterval(this.typewriterTimer);
    this.typewriterTimer = null;
  }

  /**
   * 캐럿이 화면 고정 지점에서 벗어나면 그만큼 스크롤을 밀어 되돌린다.
   * 캐럿은 `#scroll-content` 안에 절대배치된 `.caret` DOM 이므로
   * 렌더러(canvas)를 건드리지 않고 화면 좌표만 비교하면 된다.
   */
  private syncTypewriter(): void {
    const container = document.getElementById('scroll-container');
    if (!container) return;
    const caret = container.querySelector<HTMLElement>('.caret, .caret-composition');
    if (!caret || caret.offsetParent === null) return;

    const caretRect = caret.getBoundingClientRect();
    if (caretRect.height === 0) return;
    const containerRect = container.getBoundingClientRect();
    const caretY = caretRect.top - containerRect.top;
    const delta = caretY - container.clientHeight * TYPEWRITER_ANCHOR;
    if (Math.abs(delta) < TYPEWRITER_TOLERANCE_PX) return;

    const next = Math.max(0, Math.min(container.scrollTop + delta, container.scrollHeight - container.clientHeight));
    container.scrollTop = next;
  }
}
