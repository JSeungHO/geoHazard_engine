import { describe, expect, it } from 'vitest'
import { WaterWaveEngine } from './WaterWaveEngine'

describe('WaterWaveEngine', () => {
  it('step updates interior cell heights', () => {
    const engine = new WaterWaveEngine(8)
    engine.addDisturbance(0.5, 0.5, 0.4, 2)
    const centerBefore = engine.heights[4 * 8 + 4]

    engine.step(1 / 60)

    expect(engine.heights[4 * 8 + 4]).not.toBe(centerBefore)
  })

  it('addDisturbance raises height near center', () => {
    const engine = new WaterWaveEngine(16)
    engine.addDisturbance(0.5, 0.5, 0.2, 1.5)

    const center = engine.heights[8 * 16 + 8]
    const corner = engine.heights[0]

    expect(center).toBeGreaterThan(corner)
  })

  it('boundary cells are damped after step', () => {
    const engine = new WaterWaveEngine(8)
    const res = engine.resolution
    const top = 4
    engine.heights[top] = 2.5
    engine.velocities[top] = 1.2

    engine.step(1 / 60)

    expect(Math.abs(engine.heights[top])).toBeLessThan(2.5)
    expect(Math.abs(engine.velocities[top])).toBeLessThan(1.2)
    expect(top).toBeLessThan(res)
  })

  it('addRainImpacts does nothing when intensity is zero', () => {
    const engine = new WaterWaveEngine(8)
    const before = Float32Array.from(engine.heights)

    engine.addRainImpacts(0, 0.1)

    expect(Array.from(engine.heights)).toEqual(Array.from(before))
  })

  it('addDisturbance with small radius only affects nearby cells', () => {
    const engine = new WaterWaveEngine(16)
    engine.addDisturbance(0.5, 0.5, 0.035, 1.0)

    expect(engine.heights[0]).toBe(0)
    expect(engine.heights[8 * 16 + 8]).toBeGreaterThan(0)
  })
})
