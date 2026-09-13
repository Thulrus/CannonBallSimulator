interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  growth: number
  gravity: number
  drag: number
  color: [number, number, number]
  kind: 'spark' | 'smoke' | 'flash'
}

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo)

/**
 * Screen-space particle effects: muzzle flash and smoke on firing, a dust puff on
 * impact. Purely decorative — it runs on wall-clock time, independent of the
 * simulation's playback rate, so a 30× Paris Gun replay still gets a readable puff.
 */
export class ParticleSystem {
  private particles: Particle[] = []

  get alive() {
    return this.particles.length > 0
  }

  clear() {
    this.particles = []
  }

  emitMuzzle(x: number, y: number, angle: number) {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.16,
      maxLife: 0.16,
      size: 26,
      growth: 60,
      gravity: 0,
      drag: 0,
      color: [255, 214, 140],
      kind: 'flash',
    })
    for (let i = 0; i < 34; i++) {
      const a = angle + rand(-0.38, 0.38)
      const speed = rand(90, 340)
      const life = rand(0.12, 0.42)
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life,
        maxLife: life,
        size: rand(1, 2.4),
        growth: -2,
        gravity: 140,
        drag: 2.5,
        color: Math.random() < 0.5 ? [255, 236, 180] : [255, 150, 50],
        kind: 'spark',
      })
    }
    for (let i = 0; i < 18; i++) {
      const a = angle + rand(-0.7, 0.7)
      const speed = rand(18, 110)
      const life = rand(0.9, 2.2)
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 8,
        life,
        maxLife: life,
        size: rand(3, 7),
        growth: rand(10, 20),
        gravity: -14,
        drag: 1.8,
        color: [150, 155, 168],
        kind: 'smoke',
      })
    }
  }

  emitImpact(x: number, y: number) {
    for (let i = 0; i < 30; i++) {
      const a = -Math.PI / 2 + rand(-1.1, 1.1)
      const speed = rand(40, 190)
      const life = rand(0.35, 0.9)
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life,
        maxLife: life,
        size: rand(1.2, 2.8),
        growth: -1,
        gravity: 420,
        drag: 1,
        color: Math.random() < 0.5 ? [196, 160, 110] : [140, 110, 76],
        kind: 'spark',
      })
    }
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI / 2 + rand(-1.3, 1.3)
      const speed = rand(10, 60)
      const life = rand(1, 2.4)
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life,
        maxLife: life,
        size: rand(4, 8),
        growth: rand(8, 16),
        gravity: -6,
        drag: 1.5,
        color: [120, 104, 84],
        kind: 'smoke',
      })
    }
  }

  update(dt: number) {
    if (dt <= 0) return
    for (const p of this.particles) {
      p.life -= dt
      p.vx *= Math.exp(-p.drag * dt)
      p.vy = p.vy * Math.exp(-p.drag * dt) + p.gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.size = Math.max(p.size + p.growth * dt, 0.2)
    }
    this.particles = this.particles.filter((p) => p.life > 0)
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save()
    for (const p of this.particles) {
      const t = p.life / p.maxLife
      const [r, g, b] = p.color
      if (p.kind === 'flash') {
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size)
        grad.addColorStop(0, `rgba(255,250,230,${0.95 * t})`)
        grad.addColorStop(0.35, `rgba(${r},${g},${b},${0.6 * t})`)
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.globalCompositeOperation = 'lighter'
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      } else if (p.kind === 'spark') {
        ctx.globalCompositeOperation = 'lighter'
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, t * 1.4)})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = `rgba(${r},${g},${b},${0.22 * t})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()
  }
}
