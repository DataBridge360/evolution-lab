type Particle = {
  x: number; y: number;
  originalX: number; originalY: number;
  color: string;
  opacity: number; originalAlpha: number;
  velocityX: number; velocityY: number;
  speed: number;
  shouldFadeQuickly: boolean;
};

type TextBoundaries = { left: number; right: number; width: number };
type AnimationState = "fadingIn" | "static" | "vaporizing";

export interface VapourTextConfig {
  texts: string[];
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  /** Solid color, e.g. "rgb(30,30,30)" */
  color?: string;
  /** Horizontal gradient [from, to] — overrides color when set */
  gradient?: [string, string];
  spread?: number;
  density?: number;
  vaporizeDuration?: number;
  fadeInDuration?: number;
  /** Pass Infinity to stay static forever after appearing */
  staticDuration?: number;
  direction?: "left-to-right" | "right-to-left";
  alignment?: "left" | "center" | "right";
  /** ms delay before the animation starts */
  startDelay?: number;
}

export class VapourTextAnimation {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private textBoundaries: TextBoundaries | null = null;
  private state: AnimationState = "fadingIn";
  private currentTextIndex = 0;
  private vaporizeProgress = 0;
  private fadeOpacity = 0;
  private frameId: number | null = null;
  private lastTime = 0;
  private cfg: Required<VapourTextConfig>;
  readonly dpr: number;
  private staticTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(canvas: HTMLCanvasElement, config: VapourTextConfig) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.dpr = Math.min(window.devicePixelRatio * 1.5, 3);
    this.cfg = {
      texts: config.texts,
      fontFamily: config.fontFamily ?? "Plus Jakarta Sans, sans-serif",
      fontSize: config.fontSize ?? 80,
      fontWeight: config.fontWeight ?? 800,
      color: config.color ?? "rgb(30,30,30)",
      gradient: config.gradient ?? (undefined as unknown as [string, string]),
      spread: config.spread ?? 5,
      density: config.density ?? 5,
      vaporizeDuration: config.vaporizeDuration ?? 2000,
      fadeInDuration: config.fadeInDuration ?? 1200,
      staticDuration: config.staticDuration ?? Infinity,
      direction: config.direction ?? "left-to-right",
      alignment: config.alignment ?? "left",
      startDelay: config.startDelay ?? 0,
    };

    this.buildParticles();

    const start = () => {
      this.lastTime = performance.now();
      this.frameId = requestAnimationFrame(this.tick);
    };

    if (this.cfg.startDelay > 0) {
      setTimeout(start, this.cfg.startDelay);
    } else {
      start();
    }
  }

  private buildParticles() {
    const { canvas, ctx, dpr, cfg } = this;
    if (!canvas.width || !canvas.height) return;

    const fontSize = cfg.fontSize * dpr;
    const font = `${cfg.fontWeight} ${fontSize}px ${cfg.fontFamily}`;
    const cx = cfg.alignment === "center" ? canvas.width / 2
             : cfg.alignment === "right"  ? canvas.width : 0;
    const cy = canvas.height / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = font;
    ctx.textAlign = cfg.alignment as CanvasTextAlign;
    ctx.textBaseline = "middle";

    if (cfg.gradient) {
      const g = ctx.createLinearGradient(0, 0, canvas.width, 0);
      g.addColorStop(0, cfg.gradient[0]);
      g.addColorStop(1, cfg.gradient[1]);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = this.parseColor(cfg.color);
    }

    ctx.fillText(cfg.texts[this.currentTextIndex], cx, cy);

    const metrics = ctx.measureText(cfg.texts[this.currentTextIndex]);
    const tw = metrics.width;
    const tl = cfg.alignment === "center" ? cx - tw / 2
             : cfg.alignment === "right"  ? cx - tw : cx;
    this.textBoundaries = { left: tl, right: tl + tw, width: tw };

    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const sr = Math.max(1, Math.round(dpr));
    this.particles = [];

    for (let y = 0; y < canvas.height; y += sr) {
      for (let x = 0; x < canvas.width; x += sr) {
        const i = (y * canvas.width + x) * 4;
        if (data[i + 3] > 0) {
          const oa = (data[i + 3] / 255) * (sr / dpr);
          this.particles.push({
            x, y, originalX: x, originalY: y,
            color: `rgba(${data[i]},${data[i+1]},${data[i+2]},${oa})`,
            opacity: this.state === "fadingIn" ? 0 : oa,
            originalAlpha: oa,
            velocityX: 0, velocityY: 0, speed: 0,
            shouldFadeQuickly: false,
          });
        }
      }
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  private tick = (now: number) => {
    if (this.lastTime === 0) this.lastTime = now;
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.update(dt);
    this.frameId = requestAnimationFrame(this.tick);
  };

  private update(dt: number) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this.state === "fadingIn") {
      this.fadeOpacity = Math.min(1, this.fadeOpacity + dt * 1000 / this.cfg.fadeInDuration);
      this.renderFadeIn();
      if (this.fadeOpacity >= 1) {
        this.particles.forEach(p => { p.opacity = p.originalAlpha; });
        this.state = "static";
        if (isFinite(this.cfg.staticDuration)) {
          this.staticTimer = setTimeout(() => {
            this.state = "vaporizing";
            this.vaporizeProgress = 0;
          }, this.cfg.staticDuration);
        }
      }
    } else if (this.state === "static") {
      this.renderParticles();
    } else {
      this.vaporizeProgress += dt * 100 / (this.cfg.vaporizeDuration / 1000);
      const tb = this.textBoundaries;
      if (tb) {
        const prog = Math.min(100, this.vaporizeProgress);
        const vx = this.cfg.direction === "left-to-right"
          ? tb.left + tb.width * prog / 100
          : tb.right - tb.width * prog / 100;
        const done = this.updateVapor(vx, dt);
        this.renderParticles();
        if (this.vaporizeProgress >= 100 && done) {
          this.currentTextIndex = (this.currentTextIndex + 1) % this.cfg.texts.length;
          this.fadeOpacity = 0;
          this.buildParticles();
          this.state = "fadingIn";
        }
      }
    }
  }

  private updateVapor(vx: number, dt: number): boolean {
    const SPREAD = this.calcSpread(this.cfg.fontSize) * this.cfg.spread;
    const density = Math.min(Math.max(0.3 + (this.cfg.density / 10) * 0.7, 0.3), 1);
    let allDone = true;

    this.particles.forEach(p => {
      const reached = this.cfg.direction === "left-to-right"
        ? p.originalX <= vx : p.originalX >= vx;
      if (reached) {
        if (p.speed === 0) {
          p.shouldFadeQuickly = Math.random() > density;
          const angle = Math.random() * Math.PI * 2;
          p.speed = (Math.random() + 0.5) * SPREAD;
          p.velocityX = Math.cos(angle) * p.speed;
          p.velocityY = Math.sin(angle) * p.speed;
        }
        if (p.shouldFadeQuickly) {
          p.opacity = Math.max(0, p.opacity - dt);
        } else {
          const dx = p.originalX - p.x;
          const dy = p.originalY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const damp = Math.max(0.95, 1 - dist / (100 * SPREAD));
          p.velocityX = (p.velocityX + (Math.random() - 0.5) * SPREAD * 3 + dx * 0.002) * damp;
          p.velocityY = (p.velocityY + (Math.random() - 0.5) * SPREAD * 3 + dy * 0.002) * damp;
          const maxV = SPREAD * 2;
          const cv = Math.hypot(p.velocityX, p.velocityY);
          if (cv > maxV) { p.velocityX *= maxV / cv; p.velocityY *= maxV / cv; }
          p.x += p.velocityX * dt * 20;
          p.y += p.velocityY * dt * 10;
          p.opacity = Math.max(0, p.opacity - dt * 0.25 * (2000 / this.cfg.vaporizeDuration));
        }
        if (p.opacity > 0.01) allDone = false;
      } else { allDone = false; }
    });
    return allDone;
  }

  private renderParticles() {
    const { ctx, dpr } = this;
    ctx.save(); ctx.scale(dpr, dpr);
    this.particles.forEach(p => {
      if (p.opacity > 0) {
        ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${p.opacity})`);
        ctx.fillRect(p.x / dpr, p.y / dpr, 1, 1);
      }
    });
    ctx.restore();
  }

  private renderFadeIn() {
    const { ctx, dpr } = this;
    ctx.save(); ctx.scale(dpr, dpr);
    this.particles.forEach(p => {
      const op = this.fadeOpacity * p.originalAlpha;
      ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${op})`);
      ctx.fillRect(p.x / dpr, p.y / dpr, 1, 1);
    });
    ctx.restore();
  }

  private calcSpread(size: number) {
    const pts = [{ s: 20, v: 0.2 }, { s: 50, v: 0.5 }, { s: 100, v: 1.5 }];
    if (size <= pts[0].s) return pts[0].v;
    if (size >= pts[pts.length - 1].s) return pts[pts.length - 1].v;
    let i = 0;
    while (i < pts.length - 1 && pts[i + 1].s < size) i++;
    return pts[i].v + (size - pts[i].s) * (pts[i + 1].v - pts[i].v) / (pts[i + 1].s - pts[i].s);
  }

  private parseColor(color: string) {
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    return m ? `rgba(${m[1]},${m[2]},${m[3]},${m[4] ?? 1})` : "rgba(30,30,30,1)";
  }

  destroy() {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    if (this.staticTimer) clearTimeout(this.staticTimer);
  }
}

/**
 * Sizes a canvas to match its parent, then creates a VapourTextAnimation.
 * Returns null if the parent has no dimensions yet.
 */
export function createVapour(
  canvasId: string,
  config: VapourTextConfig
): VapourTextAnimation | null {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas?.parentElement) return null;

  const { width, height } = canvas.parentElement.getBoundingClientRect();
  if (!width || !height) return null;

  const dpr = Math.min(window.devicePixelRatio * 1.5, 3);
  canvas.style.width  = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width  = Math.floor(width  * dpr);
  canvas.height = Math.floor(height * dpr);

  return new VapourTextAnimation(canvas, config);
}
