/**
 * 2D 파동(ripple tank) 물리 시뮬레이션.
 * 격자 각 셀의 높이·속도를 갱신해 수면 출렁임을 계산한다.
 */
export class WaterWaveEngine {
  constructor(resolution = 40) {
    this.resolution = resolution
    const count = resolution * resolution
    this.heights = new Float32Array(count)
    this.velocities = new Float32Array(count)
    this.damping = 0.994
    this.stiffness = 0.16
    this.timeScale = 0.32
    this.maxAmplitude = 4.2
  }

  step(deltaSeconds = 1 / 60) {
    const { resolution: res, heights, velocities, damping, stiffness, timeScale } = this
    const dt = Math.min(deltaSeconds * 60 * timeScale, 0.75)
    const accelerations = this._accelerations ?? new Float32Array(heights.length)
    this._accelerations = accelerations

    for (let y = 1; y < res - 1; y++) {
      for (let x = 1; x < res - 1; x++) {
        const i = y * res + x
        const laplacian =
          heights[i - 1] +
          heights[i + 1] +
          heights[i - res] +
          heights[i + res] -
          4 * heights[i]
        accelerations[i] = laplacian * stiffness
      }
    }

    for (let y = 1; y < res - 1; y++) {
      for (let x = 1; x < res - 1; x++) {
        const i = y * res + x
        velocities[i] = (velocities[i] + accelerations[i] * dt) * damping
        heights[i] += velocities[i] * dt
        heights[i] = Math.max(-this.maxAmplitude, Math.min(this.maxAmplitude, heights[i]))
      }
    }

    this._dampBoundary(res, heights, velocities)
  }

  /** 경계 셀 흡수 — 고정 0 경계에서의 반사 아티팩트 완화 */
  _dampBoundary(res, heights, velocities) {
    const edgeDamping = 0.82
    const heightAbsorb = 0.88

    for (let x = 0; x < res; x++) {
      const top = x
      const bottom = (res - 1) * res + x
      velocities[top] *= edgeDamping
      heights[top] *= heightAbsorb
      velocities[bottom] *= edgeDamping
      heights[bottom] *= heightAbsorb
    }

    for (let y = 0; y < res; y++) {
      const left = y * res
      const right = y * res + (res - 1)
      velocities[left] *= edgeDamping
      heights[left] *= heightAbsorb
      velocities[right] *= edgeDamping
      heights[right] *= heightAbsorb
    }
  }

  /** u,v: 0~1 정규화 좌표, radiusNorm: 격자 비율 반경 */
  addDisturbance(u, v, radiusNorm, magnitude) {
    const res = this.resolution
    const cx = u * (res - 1)
    const cy = v * (res - 1)
    const r = Math.max(1, radiusNorm * res)
    const r2 = r * r

    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const dx = x - cx
        const dy = y - cy
        const d2 = dx * dx + dy * dy
        if (d2 > r2) continue

        const falloff = 1 - Math.sqrt(d2) / r
        const i = y * res + x
        this.heights[i] += magnitude * falloff
        this.velocities[i] += magnitude * falloff * 0.12
      }
    }
  }

  /** 강수량에 따라 무작위 물방울 충격 */
  addRainImpacts(intensity, strength = 0.1) {
    if (intensity <= 0) return
    const drops = Math.max(1, Math.floor(intensity / 25))
    for (let n = 0; n < drops; n++) {
      this.addDisturbance(Math.random(), Math.random(), 0.035, strength * (intensity / 100))
    }
  }
}
