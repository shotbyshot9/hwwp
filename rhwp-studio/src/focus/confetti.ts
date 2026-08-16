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

/** 입자 상한 — 오래 타이핑해도 프레임이 무너지지 않게 막는다. */
const MAX_PARTICLES = 900;

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

  /** 목표 달성·장문 연속 입력 축포. 세 갈래로 크게 터진다 */
  fireCelebration(): void {
    [0.25, 0.5, 0.75].forEach((y, i) => {
      window.setTimeout(() => {
        this.spawn('left', 40, y, 52, 70);
        this.spawn('right', 40, y, 52, 70);
        this.start();
      }, i * 100);
    });
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
      const life = 90 + Math.random() * 60;
      this.particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed * 0.35 + drift,
        vy: Math.sin(angle) * speed * 0.35,
        life,
        maxLife: life,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 5 + Math.random() * 5,
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
