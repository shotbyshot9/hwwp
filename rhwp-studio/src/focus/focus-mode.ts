/**
 * 배명훈 모드 (focus mode).
 *
 * 배명훈 소설 속 워드프로세서에서 출발한 Writer's Homeground 를 hwwp 로 옮긴 것이다.
 * 화면 구성도 그 웹서비스를 따른다 — 따뜻한 무채색 배경, 위쪽에 제목과 토글 세 개가
 * 놓인 얇은 머리글, 아래쪽에 단어·글자·시간을 세는 바닥글, 그 사이는 글만 남는다.
 *
 * 두 겹으로 되어 있다.
 *
 * 1. 선(禪) 화면 — 메뉴바·도구상자·서식바·눈금자·상태바를 걷어내고 hwwp 자체 머리글과
 *    바닥글로 갈아 끼운다. 타자기 스크롤을 켜면 캐럿이 화면 위쪽 40% 에 머문다.
 * 2. 응원 레이어 — 문장부호를 찍을 때마다 박수와 폭죽이 터진다. `CheerEngine` 담당.
 *
 * 편집 엔진은 건드리지 않는다. 확정 입력은 eventBus 의 `text-inserted` 로만 받고,
 * 화면 상태는 body 의 `fm-active` 클래스로만 바꾼다.
 */

import type { EventBus } from '@/core/event-bus';
import { userSettings } from '@/core/user-settings';
import { applyTheme, getThemeMode } from '@/core/theme';
import { toRenderZoom } from '@/core/display-calibration.ts';
import type { ThemeMode } from '@/core/user-settings';
import { CheerEngine } from './cheer-engine';
import { cheerRateLabel, describeCheerRate, nextCheerRate } from './cheer-rate.ts';

/** 캐럿을 붙잡아 둘 화면 높이 비율 (0=최상단, 1=최하단) */
const TYPEWRITER_ANCHOR = 0.4;

/** 이 픽셀 이상 어긋났을 때만 스크롤을 보정한다 (미세 떨림 방지) */
const TYPEWRITER_TOLERANCE_PX = 8;

/** 타자기 스크롤 점검 주기(ms) */
const TYPEWRITER_INTERVAL_MS = 80;

/** 마지막 입력 뒤 이 시간 동안만 캐럿을 따라간다 */
export const TYPEWRITER_FOLLOW_MS = 1500;

/**
 * 지금 캐럿을 따라가야 하는가.
 *
 * 타자기 스크롤은 "쓰는 동안 시선을 붙잡는" 장치지 "스크롤을 못 하게 막는" 장치가
 * 아니다. 주기마다 무조건 되돌리면 앞 문단을 다시 읽으려고 스크롤한 순간 튕겨
 * 돌아와 읽을 수가 없다.
 *
 * 두 가지 중 하나면 따라간다.
 *  - 캐럿이 문서 안에서 옮겨갔다 (`caretDocY` 는 스크롤과 무관한 값이다)
 *  - 방금 글을 썼다 (같은 줄에서 타이핑하면 caretDocY 가 안 변해 위치만으로는 모른다)
 *
 * "캐럿이 화면 밖이면 따라간다" 는 조건을 쓰면 안 된다 — 스크롤해서 멀어지는
 * 순간 캐럿이 화면 밖이 되므로 언제나 걸려, 읽으려는 스크롤을 그대로 되돌린다.
 */
export function shouldFollowCaret(
  caretDocY: number,
  lastCaretDocY: number | null,
  now: number,
  followUntil: number,
): boolean {
  if (lastCaretDocY === null) return true;          // 첫 점검 — 한 번 자리를 잡는다
  if (Math.abs(caretDocY - lastCaretDocY) > 1) return true;
  return now < followUntil;
}

/** 문서 전체를 다시 세기까지 기다리는 시간(ms). 타이핑 중 전수 집계를 피한다. */
const COUNT_DEBOUNCE_MS = 400;

/** 배명훈 모드가 바깥에서 받아야 하는 것들 */
export interface FocusModeDeps {
  eventBus: EventBus;
  /** 편집 입력(숨은 textarea)에 포커스를 되돌린다 */
  focusEditor: () => void;
  /** 문서 전체의 단어수·글자수 */
  getDocumentStats: () => { words: number; chars: number };
  /** 현재 화면 배율 (1 = 100%). 뷰포트가 없으면 null */
  getZoom: () => number | null;
  /** 화면 배율 지정 (1 = 100%) */
  setZoom: (zoom: number) => void;
  /**
   * 용지가 창 폭에 꼭 맞는 렌더 배율. 문서가 없으면 null.
   * 설정 배율이 이보다 크면 가로 스크롤이 생기므로 여기서 멈춘다.
   */
  getFitWidthZoom: () => number | null;
}

const ICONS = {
  quill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20s2-8 8-12 8-4 8-4-1 5-3 9-6 6-9 6H4z"/><path d="M4 20l5-5"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
  sparkleOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M3 3l18 18"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>',
  volume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14"/></svg>',
  volumeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  words: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V5h16v2M9 19h6M12 5v14"/></svg>',
  chars: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19l6-14 6 14M7 14h6"/><path d="M18 19h2"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
};

export class FocusMode {
  private active = false;
  private cheer = new CheerEngine();
  private overlay: HTMLElement | null = null;

  private wordsEl: HTMLElement | null = null;
  private charsEl: HTMLElement | null = null;
  private elapsedEl: HTMLElement | null = null;
  private goalWrapEl: HTMLElement | null = null;
  private goalFillEl: HTMLElement | null = null;
  private goalTextEl: HTMLElement | null = null;
  private confettiBtn: HTMLButtonElement | null = null;
  private soundBtn: HTMLButtonElement | null = null;
  private themeBtn: HTMLButtonElement | null = null;
  private rateBtn: HTMLButtonElement | null = null;

  private startedAt = 0;
  private sessionChars = 0;
  private goalReached = false;
  private docStats = { words: 0, chars: 0 };

  /** 진입 직전의 일반 화면 상태 — 나갈 때 그대로 되돌린다 */
  private savedZoom: number | null = null;
  private savedThemeMode: ThemeMode | null = null;

  /** 직전에 본 캐럿의 문서 내 높이 — 캐럿이 옮겨갔는지 판별한다 */
  private lastCaretDocY: number | null = null;
  /**
   * 이 시각까지는 캐럿을 따라간다.
   *
   * 글을 쓰는 동안에만 시선을 붙잡고, 멈추고 읽는 동안에는 스크롤을 사용자에게
   * 돌려준다. 같은 줄 안에서 타이핑하면 캐럿의 문서 내 높이가 안 바뀌므로,
   * 위치 변화만으로는 "쓰는 중" 을 알 수 없어 시간 창을 함께 둔다.
   */
  private followCaretUntil = 0;

  private tickTimer: number | null = null;
  private typewriterTimer: number | null = null;
  private countTimer: number | null = null;
  private unsubscribe: (() => void) | null = null;
  private keydownBound = (e: KeyboardEvent) => this.onKeyDown(e);

  constructor(private deps: FocusModeDeps) {}

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

    // 일반 화면의 배율·테마를 기억해 두고 배명훈 모드 전용 값으로 갈아 끼운다.
    // 두 화면의 설정은 서로 건드리지 않는다 — 나갈 때 그대로 되돌린다.
    this.savedZoom = this.deps.getZoom();
    this.savedThemeMode = getThemeMode();
    const settings = userSettings.getFocusSettings();
    this.applyZoom(settings.zoomPercent);
    // applyTheme 은 화면에만 적용하고 저장하지 않는다(setThemeMode 와 다르다).
    // 덕분에 일반 화면의 테마 설정이 배명훈 모드 때문에 바뀌지 않는다.
    applyTheme(settings.theme);

    document.body.classList.add('fm-active');
    this.buildOverlay();
    this.syncMenuState();

    // 진입 자체가 사용자 제스처이므로 여기서 오디오 잠금을 푼다.
    this.cheer.unlock();

    this.unsubscribe = this.deps.eventBus.on('text-inserted', (...args: unknown[]) => {
      const text = typeof args[0] === 'string' ? args[0] : '';
      this.onTextInserted(text);
    });

    document.addEventListener('keydown', this.keydownBound, true);
    this.tickTimer = window.setInterval(() => this.renderStats(), 1000);
    this.startTypewriter();
    this.recountDocument();
    this.renderStats();

    // 레이아웃이 바뀌었으니 뷰포트·캐럿을 다시 잡게 한다.
    this.deps.eventBus.emit('document-view-changed');
    window.dispatchEvent(new Event('resize'));

    // 메뉴 클릭으로 들어오면 포커스가 메뉴로 넘어가 있다 — 편집 입력으로 되돌린다.
    // 이게 없으면 배명훈 모드에서 키보드 입력이 문서에 닿지 않는다.
    this.restoreEditorFocus();
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
    if (this.countTimer !== null) window.clearTimeout(this.countTimer);
    this.countTimer = null;
    this.stopTypewriter();

    this.cheer.dispose();
    this.cheer = new CheerEngine();

    this.overlay?.remove();
    this.overlay = null;
    document.documentElement.style.removeProperty('--fm-header-h');
    document.documentElement.style.removeProperty('--fm-footer-h');
    this.wordsEl = null;
    this.charsEl = null;
    this.elapsedEl = null;
    this.goalWrapEl = null;
    this.goalFillEl = null;
    this.goalTextEl = null;
    this.confettiBtn = null;
    this.soundBtn = null;
    this.themeBtn = null;
    this.rateBtn = null;

    // 일반 화면의 배율·테마를 되돌린다.
    if (this.savedThemeMode) applyTheme(this.savedThemeMode);
    if (this.savedZoom !== null) this.deps.setZoom(this.savedZoom);
    this.savedThemeMode = null;
    this.savedZoom = null;

    this.syncMenuState();
    this.deps.eventBus.emit('document-view-changed');
    window.dispatchEvent(new Event('resize'));
    this.restoreEditorFocus();
  }

  /** 설정 변경 후 화면을 즉시 반영한다 */
  refresh(): void {
    if (!this.active) return;
    const settings = userSettings.getFocusSettings();
    applyTheme(settings.theme);
    this.applyZoom(settings.zoomPercent);
    this.syncToggleButtons();
    this.renderStats();
    this.startTypewriter();
  }

  /**
   * 설정 배율을 적용하되 창을 넘지 않게 한다.
   *
   * 200% 는 A4 를 1800px 넘게 그리는데 노트북 창은 대개 그보다 좁다. 그대로 두면
   * 글을 읽으려고 가로로 스크롤해야 한다 — 글쓰기 화면에서 가장 방해되는 동작이다.
   * 창에 안 들어가면 폭 맞춤에서 멈춘다.
   */
  private applyZoom(zoomPercent: number): void {
    const wanted = toRenderZoom(zoomPercent / 100);
    const fitWidth = this.deps.getFitWidthZoom();
    this.deps.setZoom(fitWidth === null ? wanted : Math.min(wanted, fitWidth));
  }

  // ─── 입력 ────────────────────────────────────────────

  private onTextInserted(text: string): void {
    if (!this.active || !text) return;
    // 쓰는 동안에는 캐럿을 따라간다. 멈추면 스크롤은 사용자 몫으로 돌아간다.
    this.followCaretUntil = Date.now() + TYPEWRITER_FOLLOW_MS;
    this.sessionChars += text.length;
    this.cheer.noteInserted(text);
    this.scheduleRecount();
    this.renderStats();
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
    }
  }

  /**
   * 편집 입력으로 포커스를 되돌린다.
   * 머리글 버튼은 클릭 즉시 포커스를 가져가므로 누를 때마다 불러야 한다.
   */
  private restoreEditorFocus(): void {
    this.deps.focusEditor();
    // 크롬을 숨기고 다시 그리는 과정에서 포커스가 다시 빠질 수 있어 한 번 더 잡는다.
    // rAF 를 쓰면 안 된다 — 탭이 화면에 그려지지 않을 때 콜백이 실행되지 않아
    // 포커스 복원이 통째로 건너뛰어진다. 타이머는 그런 상황에서도 돈다.
    window.setTimeout(() => this.deps.focusEditor(), 0);
  }

  // ─── 화면 ────────────────────────────────────────────

  private buildOverlay(): void {
    const overlay = document.createElement('div');
    overlay.id = 'focus-mode';
    overlay.className = 'fm-overlay';

    const header = this.buildHeader();
    const footer = this.buildFooter();
    overlay.append(header, footer);
    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.syncToggleButtons();

    // 머리글·바닥글 높이는 글꼴 설정에 따라 달라지므로 실측해서 넘긴다.
    // 편집 영역이 이만큼 위아래를 비워야 문서가 크롬 뒤로 숨지 않는다.
    const root = document.documentElement;
    root.style.setProperty('--fm-header-h', `${header.offsetHeight}px`);
    root.style.setProperty('--fm-footer-h', `${footer.offsetHeight}px`);
  }

  private buildHeader(): HTMLElement {
    const header = document.createElement('header');
    header.className = 'fm-header';

    const brand = document.createElement('div');
    brand.className = 'fm-brand';

    const mark = document.createElement('div');
    mark.className = 'fm-brand-mark';
    mark.innerHTML = ICONS.quill;

    const text = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'fm-brand-title';
    title.textContent = '배명훈 모드';
    const sub = document.createElement('div');
    sub.className = 'fm-brand-sub';
    // 이름의 유래를 화면에 남겨 둔다 — 이 모드가 어디서 왔는지가 곧 제품의 뿌리다.
    // 한 문장으로 끝맺는다. "…에서" 로 끊으면 말이 잘린 것처럼 읽힌다.
    sub.textContent = '배명훈 〈홈, 어웨이〉의 환호하는 에디터에서 영감을 받았습니다';
    text.append(title, sub);
    brand.append(mark, text);

    const actions = document.createElement('div');
    actions.className = 'fm-actions';

    this.confettiBtn = this.makeIconButton(actions, () => {
      const next = !userSettings.getFocusSettings().confetti;
      userSettings.updateFocusSettings({ confetti: next });
      this.syncToggleButtons();
    });
    this.themeBtn = this.makeIconButton(actions, () => {
      // 배명훈 모드 전용 테마만 바꾼다. 일반 편집 화면의 테마 설정은 건드리지 않는다.
      const next = userSettings.getFocusSettings().theme === 'dark' ? 'light' : 'dark';
      userSettings.updateFocusSettings({ theme: next });
      applyTheme(next);
      this.deps.eventBus.emit('document-view-changed');
      this.syncToggleButtons();
    });
    this.soundBtn = this.makeIconButton(actions, () => {
      const next = !userSettings.getFocusSettings().sound;
      userSettings.updateFocusSettings({ sound: next });
      this.syncToggleButtons();
    });
    // 다른 버튼과 달리 켜고 끄는 것이 아니라 단계를 돌린다:
    // x1 → x2 → x3 → x5 → x10 → MAX → x1.
    this.rateBtn = this.makeIconButton(actions, () => {
      const next = nextCheerRate(userSettings.getFocusSettings().cheerRate);
      userSettings.updateFocusSettings({ cheerRate: next });
      this.syncToggleButtons();
    });
    this.rateBtn.classList.add('fm-rate-btn');

    const exit = this.makeIconButton(actions, () => this.exit());
    exit.classList.add('fm-icon-btn-exit');
    exit.innerHTML = ICONS.close;
    exit.title = '배명훈 모드 나가기 (Esc)';
    exit.setAttribute('aria-label', '배명훈 모드 나가기');

    header.append(brand, actions);
    return header;
  }

  private buildFooter(): HTMLElement {
    const footer = document.createElement('footer');
    footer.className = 'fm-footer';

    const stats = document.createElement('div');
    stats.className = 'fm-stats';
    this.wordsEl = this.makeStat(stats, ICONS.words, '단어');
    this.charsEl = this.makeStat(stats, ICONS.chars, '자');
    this.elapsedEl = this.makeStat(stats, ICONS.clock, '');

    const goalWrap = document.createElement('div');
    goalWrap.className = 'fm-goal';
    const goalBar = document.createElement('div');
    goalBar.className = 'fm-goal-bar';
    const goalFill = document.createElement('div');
    goalFill.className = 'fm-goal-fill';
    goalBar.appendChild(goalFill);
    const goalText = document.createElement('span');
    goalText.className = 'fm-goal-text';
    goalWrap.append(goalText, goalBar);

    footer.append(stats, goalWrap);
    this.goalWrapEl = goalWrap;
    this.goalFillEl = goalFill;
    this.goalTextEl = goalText;
    return footer;
  }

  private makeIconButton(parent: HTMLElement, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fm-icon-btn';
    btn.addEventListener('click', () => {
      onClick();
      // 버튼이 가져간 포커스를 문서로 돌려준다 (누른 뒤 바로 이어 쓸 수 있게).
      this.restoreEditorFocus();
    });
    parent.appendChild(btn);
    return btn;
  }

  private makeStat(parent: HTMLElement, icon: string, unit: string): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'fm-stat';
    const iconEl = document.createElement('span');
    iconEl.className = 'fm-stat-icon';
    iconEl.innerHTML = icon;
    const value = document.createElement('span');
    value.className = 'fm-stat-value';
    value.textContent = '0';
    wrap.append(iconEl, value);
    if (unit) {
      const unitEl = document.createElement('span');
      unitEl.className = 'fm-stat-unit';
      unitEl.textContent = unit;
      wrap.appendChild(unitEl);
    }
    parent.appendChild(wrap);
    return value;
  }

  private syncToggleButtons(): void {
    const s = userSettings.getFocusSettings();
    if (this.confettiBtn) {
      this.confettiBtn.innerHTML = s.confetti ? ICONS.sparkle : ICONS.sparkleOff;
      this.confettiBtn.title = s.confetti ? '폭죽 효과 끄기' : '폭죽 효과 켜기';
      this.confettiBtn.setAttribute('aria-label', this.confettiBtn.title);
      this.confettiBtn.classList.toggle('fm-icon-btn-off', !s.confetti);
    }
    if (this.soundBtn) {
      this.soundBtn.innerHTML = s.sound ? ICONS.volume : ICONS.volumeOff;
      this.soundBtn.title = s.sound ? '박수 효과음 끄기' : '박수 효과음 켜기';
      this.soundBtn.setAttribute('aria-label', this.soundBtn.title);
      this.soundBtn.classList.toggle('fm-icon-btn-off', !s.sound);
    }
    if (this.rateBtn) {
      const label = cheerRateLabel(s.cheerRate);
      this.rateBtn.textContent = label;
      // 글자수에 따라 크기를 줄여 'MAX' 도 같은 버튼 안에 들어가게 한다.
      this.rateBtn.dataset.len = String(label.length);
      this.rateBtn.title = `응원 배속 ${label} — ${describeCheerRate(s.cheerRate)} (눌러서 다음 단계)`;
      this.rateBtn.setAttribute('aria-label', this.rateBtn.title);
      this.rateBtn.classList.toggle('fm-rate-btn-boost', s.cheerRate !== 1);
      this.rateBtn.classList.toggle('fm-rate-btn-max', s.cheerRate === 'max');
    }
    if (this.themeBtn) {
      const dark = s.theme === 'dark';
      this.themeBtn.innerHTML = dark ? ICONS.sun : ICONS.moon;
      this.themeBtn.title = dark ? '배명훈 모드 밝게' : '배명훈 모드 어둡게';
      this.themeBtn.setAttribute('aria-label', this.themeBtn.title);
    }
  }

  /** 문서 전체 집계는 비싸므로 입력이 잠잠해진 뒤 한 번만 돌린다 */
  private scheduleRecount(): void {
    if (this.countTimer !== null) window.clearTimeout(this.countTimer);
    this.countTimer = window.setTimeout(() => {
      this.countTimer = null;
      this.recountDocument();
      this.renderStats();
    }, COUNT_DEBOUNCE_MS);
  }

  private recountDocument(): void {
    try {
      this.docStats = this.deps.getDocumentStats();
    } catch {
      // 문서가 아직 준비되지 않았거나 집계에 실패하면 직전 값을 유지한다.
    }
  }

  private renderStats(): void {
    if (!this.active) return;
    if (this.wordsEl) this.wordsEl.textContent = this.docStats.words.toLocaleString('ko-KR');
    if (this.charsEl) this.charsEl.textContent = this.docStats.chars.toLocaleString('ko-KR');
    if (this.elapsedEl) {
      const seconds = Math.floor((Date.now() - this.startedAt) / 1000);
      const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
      const ss = String(seconds % 60).padStart(2, '0');
      this.elapsedEl.textContent = `${mm}:${ss}`;
    }

    const goal = userSettings.getFocusSettings().goalChars;
    if (this.goalWrapEl) this.goalWrapEl.style.display = goal > 0 ? '' : 'none';
    if (goal > 0) {
      const ratio = Math.min(1, this.sessionChars / goal);
      if (this.goalFillEl) this.goalFillEl.style.width = `${(ratio * 100).toFixed(1)}%`;
      if (this.goalTextEl) {
        this.goalTextEl.textContent = `${this.sessionChars.toLocaleString('ko-KR')} / ${goal.toLocaleString('ko-KR')}자`;
      }
    }
  }

  private syncMenuState(): void {
    document.querySelectorAll('[data-cmd="focus:toggle"]').forEach((el) => {
      el.classList.toggle('active', this.active);
    });
  }

  // ─── 타자기 스크롤 ────────────────────────────────────

  private startTypewriter(): void {
    this.stopTypewriter();
    // 새로 시작할 때는 캐럿 위치를 모른다 — 첫 점검에서 한 번 자리를 잡는다.
    this.lastCaretDocY = null;
    if (!userSettings.getFocusSettings().typewriter) return;
    this.typewriterTimer = window.setInterval(() => this.syncTypewriter(), TYPEWRITER_INTERVAL_MS);
  }

  private stopTypewriter(): void {
    if (this.typewriterTimer !== null) window.clearInterval(this.typewriterTimer);
    this.typewriterTimer = null;
  }

  /**
   * 캐럿이 움직였을 때만 화면 고정 지점으로 되돌린다.
   *
   * 예전에는 주기마다 무조건 되돌렸는데, 그러면 앞 문단을 다시 읽으려고 스크롤한
   * 순간 80ms 안에 캐럿 자리로 튕겨 돌아와 아예 읽을 수가 없었다. 타자기 스크롤은
   * "쓰는 동안 시선을 붙잡는" 장치지 "스크롤을 못 하게 막는" 장치가 아니다.
   *
   * 캐럿이 문서 안에서 차지하는 위치(`#scroll-content` 기준)는 스크롤과 무관하므로,
   * 그 값이 그대로면 사용자가 스크롤한 것이고 바뀌었으면 캐럿이 옮겨간 것이다.
   * 다만 캐럿이 화면 밖으로 나간 채로 글을 이어 쓰면 자기가 쓰는 곳이 안 보이므로,
   * 그때는 되돌린다.
   */
  private syncTypewriter(): void {
    const container = document.getElementById('scroll-container');
    const content = container?.querySelector<HTMLElement>('#scroll-content');
    if (!container || !content) return;
    const caret = container.querySelector<HTMLElement>('.caret, .caret-composition');
    if (!caret || caret.offsetParent === null) return;

    const caretRect = caret.getBoundingClientRect();
    if (caretRect.height === 0) return;

    // 문서 안에서의 캐럿 높이 — 스크롤해도 변하지 않는다.
    const caretDocY = caretRect.top - content.getBoundingClientRect().top;
    const containerRect = container.getBoundingClientRect();
    const caretViewY = caretRect.top - containerRect.top;

    const follow = shouldFollowCaret(caretDocY, this.lastCaretDocY, Date.now(), this.followCaretUntil);
    this.lastCaretDocY = caretDocY;
    // 캐럿이 그대로고 방금 쓴 것도 아니면 사용자가 읽으려고 스크롤한 것이다 — 건드리지 않는다.
    if (!follow) return;

    const delta = caretViewY - container.clientHeight * TYPEWRITER_ANCHOR;
    if (Math.abs(delta) < TYPEWRITER_TOLERANCE_PX) return;

    const next = Math.max(0, Math.min(container.scrollTop + delta, container.scrollHeight - container.clientHeight));
    container.scrollTop = next;
  }
}
