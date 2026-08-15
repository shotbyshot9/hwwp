/**
 * 집중 작업 모드 응원 엔진.
 *
 * 문장부호를 하나 찍을 때마다 박수와 폭죽으로 응원한다. 쉬지 않고 이어 쓸수록
 * 반응이 커지고(스트릭), 2초 이상 멈추면 처음부터 다시 쌓인다.
 *
 * 효과음은 Writer's Homeground 가 쓰던 환호·박수 음원 15개(`/sounds/sfx-01~15.mp3`)를
 * 그대로 가져와 쓴다. 직전에 난 소리는 연속으로 고르지 않는다.
 * 음원을 못 불러오면 WebAudio 합성 박수로 물러난다(오프라인·자산 누락 대비).
 */

import { userSettings, type FocusCheerLevel, type FocusSettings } from '@/core/user-settings';
import { ConfettiLayer } from './confetti';

/** 응원을 촉발하는 문장부호(한중일 전각 포함) */
const TRIGGERS = ['.', '!', '?', ',', ';', ':', '。', '！', '？', '，', '、', '…'];

/** 스트릭이 끊기는 무입력 시간(ms) */
const STREAK_IDLE_MS = 2000;

/** 문장부호 없이 이 글자수를 넘기고 찍으면 큰 축포가 터진다 */
const LONG_RUN_CHARS = 50;

/** 이 횟수 이상 연속으로 응원이 터지면 음성 칭찬이 붙기 시작한다 */
const PRAISE_STREAK = 20;

/** 음성 칭찬 최소 간격(ms) */
const PRAISE_COOLDOWN_MS = 5000;

/** 폭죽 최소 간격(ms) — 빠른 타이핑에서 화면이 뭉개지지 않게 한다 */
const BURST_THROTTLE_MS = 250;

/** 환호·박수 음원 개수 (`/sounds/sfx-01.mp3` ~ `sfx-15.mp3`) */
const SFX_COUNT = 15;

const sfxUrl = (n: number) => `/sounds/sfx-${String(n).padStart(2, '0')}.mp3`;

const PRAISE: Record<string, string[]> = {
  ko: ['대단해!', '멋져!', '잘했어!', '최고야!', '화이팅!', '굉장해!'],
  en: ['Great!', 'Amazing!', 'Fantastic!', 'Keep going!', 'Brilliant!', 'Wonderful!'],
  ja: ['すごい!', '素晴らしい!', 'いいね!', '最高!', 'がんばれ!'],
  zh: ['太棒了!', '厉害!', '继续加油!', '精彩!'],
  es: ['¡Genial!', '¡Increíble!', '¡Fantástico!', '¡Sigue así!'],
  fr: ['Génial!', 'Incroyable!', 'Fantastique!', 'Continue!'],
  de: ['Großartig!', 'Unglaublich!', 'Fantastisch!', 'Weiter so!'],
  it: ['Fantastico!', 'Incredibile!', 'Magnifico!'],
  pt: ['Ótimo!', 'Incrível!', 'Fantástico!'],
  ru: ['Отлично!', 'Невероятно!', 'Фантастика!'],
};

const PRAISE_LANGS = Object.keys(PRAISE);

const BCP47: Record<string, string> = { ko: 'ko-KR', ja: 'ja-JP', zh: 'zh-CN' };

/** 강도별 배율: [소리, 폭죽 크기, 칭찬 확률] */
const LEVEL_GAIN: Record<FocusCheerLevel, { sound: number; confetti: number; praise: number }> = {
  quiet: { sound: 0, confetti: 0.4, praise: 0 },
  normal: { sound: 1, confetti: 1, praise: 0.3 },
  festival: { sound: 1.25, confetti: 1.6, praise: 0.6 },
};

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class CheerEngine {
  private confetti = new ConfettiLayer();
  private audio: AudioContext | null = null;
  /** 박수 합성용 화이트노이즈 버퍼 (음원 폴백에서만 쓴다) */
  private noise: AudioBuffer | null = null;

  /** 미리 받아 둔 환호 음원. 재생은 여기서 복제해 쓴다 */
  private sfx: HTMLAudioElement[] = [];
  /** 한 번이라도 재생 가능해진 음원이 있는가 */
  private sfxReady = false;
  /** 직전에 고른 음원 번호 — 같은 소리가 연달아 나지 않게 한다 */
  private lastSfx = -1;

  private lastInputAt = 0;
  private lastBurstAt = 0;
  private lastPraiseAt = 0;
  /** 스트릭 중 터진 응원 횟수 */
  private burstCount = 0;
  /** 마지막 응원 이후 입력된 글자수 */
  private charsSinceBurst = 0;

  /**
   * 오디오 잠금 해제. 브라우저는 사용자 제스처 없이 소리를 못 내므로
   * 집중 모드에 들어가는 순간(메뉴 클릭·단축키)에 한 번 호출한다.
   */
  unlock(): void {
    const ctx = this.ensureAudio();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => { /* 자동재생 정책 거부 — 다음 제스처에서 재시도 */ });
    }
    this.preloadSfx();
  }

  /** 환호 음원을 미리 받아 둔다. 첫 응원에서 끊기지 않게 진입 시 호출한다. */
  private preloadSfx(): void {
    if (this.sfx.length > 0) return;
    for (let i = 1; i <= SFX_COUNT; i++) {
      const el = new Audio();
      el.preload = 'auto';
      el.addEventListener('canplaythrough', () => { this.sfxReady = true; }, { once: true });
      el.addEventListener('error', () => {
        console.warn(`[focus] 응원 음원을 불러오지 못했습니다: ${sfxUrl(i)}`);
      }, { once: true });
      el.src = sfxUrl(i);
      el.load();
      this.sfx.push(el);
    }
  }

  /**
   * 문서에 확정 입력된 텍스트를 알린다.
   * IME 조합 중간 상태가 아니라 "확정된" 텍스트만 넘겨야 한다.
   */
  noteInserted(text: string): void {
    if (!text) return;
    const settings = userSettings.getFocusSettings();

    const now = Date.now();
    if (now - this.lastInputAt > STREAK_IDLE_MS) {
      this.burstCount = 0;
      this.charsSinceBurst = 0;
    }
    this.lastInputAt = now;
    this.charsSinceBurst += text.length;

    if (!TRIGGERS.some((t) => text.includes(t))) return;

    this.burstCount += 1;
    const longRun = this.charsSinceBurst > LONG_RUN_CHARS;
    const volume = this.currentVolume();
    this.charsSinceBurst = 0;

    this.burst(settings, volume, longRun, now);
  }

  /** 세션 목표 달성 등 명시적 축하 */
  celebrate(): void {
    const settings = userSettings.getFocusSettings();
    const gain = LEVEL_GAIN[settings.cheerLevel];
    if (settings.confetti && !prefersReducedMotion()) {
      this.confetti.fireCelebration();
    }
    if (settings.sound && gain.sound > 0) {
      this.playCheer(0.9 * gain.sound, true);
      this.playChime(0.9 * gain.sound);
    }
  }

  dispose(): void {
    this.confetti.dispose();
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    void this.audio?.close().catch(() => { /* 이미 닫힘 */ });
    this.audio = null;
    this.noise = null;
    for (const el of this.sfx) {
      el.pause();
      el.removeAttribute('src');
    }
    this.sfx = [];
    this.sfxReady = false;
    this.lastSfx = -1;
    this.burstCount = 0;
    this.charsSinceBurst = 0;
  }

  /** 현재 스트릭 길이 (연속 응원 횟수) */
  getStreak(): number {
    return this.burstCount;
  }

  private burst(settings: FocusSettings, volume: number, longRun: boolean, now: number): void {
    const gain = LEVEL_GAIN[settings.cheerLevel];

    if (settings.confetti && !prefersReducedMotion() && now - this.lastBurstAt >= BURST_THROTTLE_MS) {
      this.lastBurstAt = now;
      if (longRun) this.confetti.fireCelebration();
      else this.confetti.fireEdgeBurst(gain.confetti);
    }

    if (settings.sound && gain.sound > 0) {
      this.playCheer(volume * gain.sound, longRun);
      if (longRun) this.playChime(volume * gain.sound);
    }

    if (
      settings.praise
      && gain.praise > 0
      && this.burstCount > PRAISE_STREAK
      && now - this.lastPraiseAt > PRAISE_COOLDOWN_MS
      && Math.random() < gain.praise
    ) {
      this.lastPraiseAt = now;
      this.speakPraise(Math.min(0.8, volume));
    }
  }

  /**
   * 볼륨 = 기본값 + 글자수 보너스 + 스트릭 보너스.
   * 쉬지 않고 길게 쓸수록 박수 소리가 커진다.
   */
  private currentVolume(): number {
    const base = 0.35;
    const byChars = Math.min(this.charsSinceBurst / 100, 1) * 0.3;
    const byStreak = Math.min(this.burstCount / 10, 1) * 0.3;
    return Math.min(base + byChars + byStreak, 0.9);
  }

  private ensureAudio(): AudioContext | null {
    if (this.audio) return this.audio;
    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.audio = new Ctor();
    } catch {
      return null;
    }
    return this.audio;
  }

  /** 1초짜리 화이트노이즈 — 박수 한 번은 여기서 잘라 쓴다 */
  private ensureNoise(ctx: AudioContext): AudioBuffer {
    if (this.noise) return this.noise;
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
    return buffer;
  }

  /**
   * 환호 한 번. 받아 둔 음원 중 직전과 겹치지 않는 것을 골라 튼다.
   * 음원을 못 쓰면 합성 박수로 물러난다.
   */
  private playCheer(volume: number, big: boolean): void {
    if (!this.sfxReady) {
      this.playApplause(volume, big);
      return;
    }
    let index = Math.floor(Math.random() * SFX_COUNT);
    if (index === this.lastSfx) index = (index + 1) % SFX_COUNT;
    this.lastSfx = index;

    const source = this.sfx[index];
    if (!source?.src) {
      this.playApplause(volume, big);
      return;
    }
    // 원본 엘리먼트를 그대로 쓰면 빠르게 이어 칠 때 앞 소리가 끊긴다 — 복제해서 겹쳐 튼다.
    const el = new Audio(source.src);
    el.volume = Math.min(Math.max(volume, 0), 1);
    void el.play().catch(() => {
      // 자동재생 정책에 막히면 합성 박수로 대신한다.
      this.playApplause(volume, big);
    });
  }

  /**
   * 합성 박수 (음원 폴백). 대역통과한 노이즈를 짧은 감쇠 포락선으로 여러 번 겹쳐
   * 손뼉이 흩어져 터지는 소리를 만든다.
   */
  private playApplause(volume: number, big: boolean): void {
    const ctx = this.ensureAudio();
    if (!ctx || ctx.state === 'closed') return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => { /* 다음 기회에 */ });

    const noise = this.ensureNoise(ctx);
    const claps = big ? 26 : 14;
    const spread = big ? 0.75 : 0.42;
    const t0 = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.value = Math.min(volume, 0.9);
    master.connect(ctx.destination);

    for (let i = 0; i < claps; i++) {
      // 앞쪽에 몰아치고 뒤로 흩어지도록 제곱 분포로 시작 시각을 뽑는다.
      const at = t0 + Math.random() ** 2 * spread;
      const dur = 0.05 + Math.random() * 0.05;

      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.playbackRate.value = 0.8 + Math.random() * 0.5;

      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 1200 + Math.random() * 1800;
      band.Q.value = 0.8 + Math.random();

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, at);
      env.gain.exponentialRampToValueAtTime(0.35 + Math.random() * 0.3, at + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, at + dur);

      src.connect(band);
      band.connect(env);
      env.connect(master);
      src.start(at, Math.random() * 0.5, dur);
      src.stop(at + dur + 0.02);
    }

    // 손뼉 무리가 만드는 낮은 웅성거림
    const body = ctx.createBufferSource();
    body.buffer = noise;
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = 'bandpass';
    bodyFilter.frequency.value = 700;
    bodyFilter.Q.value = 0.6;
    const bodyEnv = ctx.createGain();
    const bodyDur = spread + 0.25;
    bodyEnv.gain.setValueAtTime(0.0001, t0);
    bodyEnv.gain.exponentialRampToValueAtTime(0.12, t0 + 0.06);
    bodyEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + bodyDur);
    body.connect(bodyFilter);
    bodyFilter.connect(bodyEnv);
    bodyEnv.connect(master);
    body.start(t0, 0, bodyDur);
    body.stop(t0 + bodyDur + 0.02);
  }

  /** 장문 연속 입력·목표 달성에 얹는 상승 차임 */
  private playChime(volume: number): void {
    const ctx = this.ensureAudio();
    if (!ctx || ctx.state === 'closed') return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, t0);
    osc.frequency.exponentialRampToValueAtTime(800, t0 + 0.3);
    env.gain.setValueAtTime(Math.min(volume * 0.4, 0.36), t0);
    env.gain.exponentialRampToValueAtTime(0.01, t0 + 0.4);
    osc.connect(env);
    env.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.4);
  }

  /** 무작위 언어로 짧게 칭찬한다 (원본 Writer's Homeground 의 다국어 응원 계승) */
  private speakPraise(volume: number): void {
    if (typeof speechSynthesis === 'undefined') return;
    const lang = PRAISE_LANGS[Math.floor(Math.random() * PRAISE_LANGS.length)];
    const phrases = PRAISE[lang];
    const utter = new SpeechSynthesisUtterance(phrases[Math.floor(Math.random() * phrases.length)]);
    const target = BCP47[lang] ?? lang;
    const voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith(target));
    if (voice) utter.voice = voice;
    utter.lang = target;
    utter.rate = 1.2;
    utter.pitch = 1.1;
    utter.volume = volume;
    speechSynthesis.speak(utter);
  }
}
