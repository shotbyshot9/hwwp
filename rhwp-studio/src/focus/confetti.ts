/**
 * 배명훈 모드 폭죽 렌더러.
 *
 * 화면 좌·우 가장자리에서 안쪽으로 색종이를 쏘는 "양쪽 대포" 방식이다.
 * 외부 라이브러리 없이 전용 캔버스 하나와 requestAnimationFrame 루프만 쓴다.
 * 캔버스는 첫 발사 때 만들고 입자가 모두 사라지면 루프를 멈춘다(상시 rAF 금지).
 */

const COLORS = [
  '#F59E0B', '#FBBF24', '#FCD34D',
  '#EF4444', '#F97316', '#FB923C',
  '#10B981', '#34D399', '#6EE7B7',
  '#3B82F6', '#60A5FA', '#93C5FD',
  '#8B5CF6', '#A78BFA', '#C4B5FD',
  '#EC4899', '#F472B6', '#FBCFE8',
  '#14B8A6', '#2DD4BF', '#5EEAD4',
];

/**
 * 목표 달성 전용 색 — 금빛 계열.
 *
 * 응원 배속을 MAX 로 두면 글자마다 폭죽이 터져 화면이 늘 색종이로 차 있다. 거기에
 * 같은 색종이를 더 뿌리면 그냥 묻힌다. 색과 크기를 바꿔야 **다른 것**으로 보인다.
 */
const GOLD_COLORS = [
  '#FFD700', '#FFC83D', '#FFB302', '#F59E0B',
  '#FFE9A8', '#FFF4D1', '#E8A317', '#FFDF7E',
];

/** 입자 상한 — 오래 타이핑해도 프레임이 무너지지 않게 막는다. */
const MAX_PARTICLES = 900;

/**
 * 목표 달성 직전에 화면을 비워 두는 시간(ms).
 *
 * 짧으면 못 알아채고, 길면 반응이 굼떠 보인다. 계속 터지던 화면이 "어" 하고 멎었다가
 * 터지는 정도가 이 언저리다.
 */
const SILENT_BEAT_MS = 260;

function pickColor(style?: SpawnStyle): string {
  const palette = style?.gold ? GOLD_COLORS : COLORS;
  return palette[Math.floor(Math.random() * palette.length)];
}

/** 입자 모양을 바꾸는 값. 목표 달성 축포만 기본값에서 벗어난다. */
interface SpawnStyle {
  /** 금빛 팔레트를 쓴다 */
  gold?: boolean;
  /** 크기 배수. 1 이 평소 색종이(5~10px) */
  sizeScale?: number;
  /** 수명 배수. 크면 더 오래 떠 있는다 */
  lifeScale?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 남은 수명(프레임). 0이 되면 제거 */
  life: number;
  /** 최초 수명 — 알파 페이드 계산용 */
  maxLife: number;
  color: string;
  /** 사각형 폭(px). 높이는 wobble로 변형된다 */
  size: number;
  rot: number;
  rotSpeed: number;
  circle: boolean;
}

export class ConfettiLayer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private particles: Particle[] = [];
  private rafId: number | null = null;
  private resizeBound = () => this.resize();

  /** 좌·우 가장자리에서 한 발씩. scale=1 이 기본 세기 */
  fireEdgeBurst(scale = 1): void {
    const count = Math.round(20 * scale);
    const y = 0.3 + Math.random() * 0.4;
    this.spawn('left', count, y, 45 * scale, 55);
    this.spawn('right', count, y, 45 * scale, 55);
    this.start();
  }

  /** 장문 연속 입력 축포. 세 갈래로 크게 터진다 */
  fireCelebration(): void {
    [0.25, 0.5, 0.75].forEach((y, i) => {
      window.setTimeout(() => {
        this.spawn('left', 40, y, 52, 70);
        this.spawn('right', 40, y, 52, 70);
        this.start();
      }, i * 100);
    });
  }

  /**
   * 목표 달성 축포.
   *
   * 지금까지 목표 달성은 장문 축포(`fireCelebration`)를 그대로 썼다. 그런데 장문 축포는
   * 문장부호 없이 50자만 이어 써도 터지므로 한 세션에 수십 번 나온다. 목표 달성은
   * 많아야 하루 한 번인데 같은 그림이면 아무 일도 아닌 것처럼 보인다.
   *
   * 그래서 이것만의 그림을 따로 둔다 — **아래에서 솟는 분수**를 더하고, 1.4초에 걸쳐
   * 여섯 번 터뜨린다. 좌우 대포만 쓰는 다른 축포와 한눈에 구별된다.
   */
  fireGoalCelebration(): void {
    /*
     * 먼저 화면을 비운다.
     *
     * 이게 이 효과에서 가장 중요한 부분이다. 배속을 MAX 로 두면 글자마다 폭죽이 터져
     * 화면이 한순간도 비지 않는다. 그 상태에서는 무엇을 더 뿌려도 배경과 섞여 묻힌다.
     *
     * 그래서 반대로 간다 — 다 지우고 잠깐 아무것도 없는 순간을 만든다. 계속 터지던
     * 화면이 갑자기 조용해지는 것이 사람 눈에는 가장 크게 걸린다.
     */
    this.clear();

    const GOLD: SpawnStyle = { gold: true, sizeScale: 2.2, lifeScale: 1.5 };
    const waves: Array<{ at: number; run: () => void }> = [
      // 정적 뒤 첫 발 — 금빛 큰 조각으로 크게 연다.
      { at: SILENT_BEAT_MS, run: () => { this.spawnCannons(55, 0.55, GOLD); this.spawnFountains(45, GOLD); } },
      { at: SILENT_BEAT_MS + 200, run: () => this.spawnCannons(45, 0.3, GOLD) },
      { at: SILENT_BEAT_MS + 420, run: () => this.spawnFountains(45, GOLD) },
      // 뒤로 가면서 평소 색종이를 섞어 화려하게 흩는다.
      { at: SILENT_BEAT_MS + 660, run: () => this.spawnCannons(45, 0.7) },
      { at: SILENT_BEAT_MS + 900, run: () => this.spawnFountains(40, GOLD) },
      { at: SILENT_BEAT_MS + 1200, run: () => { this.spawnCannons(40, 0.45); this.spawnFountains(40); } },
    ];
    for (const wave of waves) {
      window.setTimeout(() => {
        wave.run();
        this.start();
      }, wave.at);
    }
  }

  /**
   * 떠 있는 입자를 모두 지운다. 캔버스는 남긴다.
   *
   * `dispose` 와 다르다 — 저쪽은 캔버스까지 떼어내고 배명훈 모드를 나갈 때 쓴다.
   */
  clear(): void {
    this.particles = [];
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }

  /** 좌우 대포 한 쌍 */
  private spawnCannons(count: number, yRatio: number, style?: SpawnStyle): void {
    this.spawn('left', count, yRatio, 58, 75, style);
    this.spawn('right', count, yRatio, 58, 75, style);
  }

  /** 화면 아래에서 솟아오르는 분수 두 줄기. 목표 달성에만 쓴다. */
  private spawnFountains(count: number, style?: SpawnStyle): void {
    this.spawnUp(0.25, count, style);
    this.spawnUp(0.75, count, style);
  }

  /** 입자를 즉시 모두 제거하고 캔버스를 떼어낸다 */
  dispose(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.particles = [];
    window.removeEventListener('resize', this.resizeBound);
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
  }

  private spawn(
    side: 'left' | 'right',
    count: number,
    yRatio: number,
    velocity: number,
    spreadDeg: number,
    style?: SpawnStyle,
  ): void {
    const canvas = this.ensureCanvas();
    const originX = side === 'left' ? 0 : canvas.clientWidth;
    const originY = canvas.clientHeight * yRatio;
    // 왼쪽 대포는 오른쪽 위(-60°), 오른쪽 대포는 왼쪽 위(-120°)를 향한다.
    const baseAngle = side === 'left' ? -Math.PI / 3 : (-Math.PI * 2) / 3;
    const spread = (spreadDeg * Math.PI) / 180;
    const drift = side === 'left' ? 0.06 : -0.06;

    const room = MAX_PARTICLES - this.particles.length;
    const n = Math.min(count, Math.max(0, room));
    for (let i = 0; i < n; i++) {
      const angle = baseAngle + (Math.random() - 0.5) * spread;
      const speed = velocity * (0.5 + Math.random() * 0.5);
      const life = (90 + Math.random() * 60) * (style?.lifeScale ?? 1);
      this.particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed * 0.35 + drift,
        vy: Math.sin(angle) * speed * 0.35,
        life,
        maxLife: life,
        color: pickColor(style),
        size: (5 + Math.random() * 5) * (style?.sizeScale ?? 1),
        rot: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 0.3,
        circle: Math.random() < 0.35,
      });
    }
  }

  /**
   * 화면 아래 한 지점에서 위로 쏘아 올린다.
   *
   * `spawn` 은 좌·우 가장자리 대포 전용이라 각도가 안쪽 위로 고정돼 있다. 분수는
   * 곧게 위를 향하고 좌우로 퍼지므로 따로 만든다.
   */
  private spawnUp(xRatio: number, count: number, style?: SpawnStyle): void {
    const canvas = this.ensureCanvas();
    const originX = canvas.clientWidth * xRatio;
    const originY = canvas.clientHeight;

    const room = MAX_PARTICLES - this.particles.length;
    const n = Math.min(count, Math.max(0, room));
    for (let i = 0; i < n; i++) {
      // 곧게 위(-90°)를 향하고 좌우로 ±25° 퍼진다.
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * ((50 * Math.PI) / 180);
      const speed = 78 * (0.6 + Math.random() * 0.4);
      // 위로 던진 것은 되떨어지는 데 시간이 걸린다 — 대포보다 조금 길게 산다.
      const life = (110 + Math.random() * 70) * (style?.lifeScale ?? 1);
      this.particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed * 0.35,
        vy: Math.sin(angle) * speed * 0.35,
        life,
        maxLife: life,
        color: pickColor(style),
        size: (5 + Math.random() * 5) * (style?.sizeScale ?? 1),
        rot: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 0.3,
        circle: Math.random() < 0.35,
      });
    }
  }

  private ensureCanvas(): HTMLCanvasElement {
    if (this.canvas) return this.canvas;
    const canvas = document.createElement('canvas');
    canvas.className = 'fm-confetti';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', this.resizeBound);
    return canvas;
  }

  private resize(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private start(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => this.tick());
  }

  private tick(): void {
    this.rafId = null;
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.vy += 0.28;          // 중력
      p.vx *= 0.985;         // 공기 저항
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.rotSpeed;
      p.life -= 1;
      if (p.life <= 0 || p.y > canvas.clientHeight + 40) continue;

      ctx.globalAlpha = Math.min(1, p.life / (p.maxLife * 0.4));
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.circle) {
        ctx.beginPath();
        // 회전에 따라 납작해지며 뒤집히는 느낌을 준다.
        ctx.ellipse(0, 0, p.size / 2, (p.size / 2) * Math.abs(Math.cos(p.rot)), 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * Math.abs(Math.cos(p.rot)));
      }
      ctx.restore();
      alive.push(p);
    }
    ctx.globalAlpha = 1;
    this.particles = alive;

    if (this.particles.length > 0) {
      this.start();
    }
  }
}
