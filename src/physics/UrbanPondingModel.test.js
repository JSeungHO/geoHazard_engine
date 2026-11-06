import { describe, expect, it } from 'vitest'
import {
  MAX_PONDING_DEPTH_M,
  PONDING_DEFAULTS,
  getFloodingThresholdMmH,
  getPondingRateMPerHour,
  stepPondingDepth,
} from './UrbanPondingModel.js'

/** 2022.8.8 강남역: 첨두 116 mm/h, 침수흔적도 실측 최대 침수심 1.8 m */
const GANGNAM_2022_PEAK_MMH = 116
const GANGNAM_2022_MAX_DEPTH_M = 1.8

describe('UrbanPondingModel', () => {
  it('침수 임계 강우 = 배수능 / 유출계수', () => {
    expect(getFloodingThresholdMmH()).toBeCloseTo(50 / 0.85, 6)
  })

  it('임계 미만 강우에서는 수위가 오르지 않는다', () => {
    expect(getPondingRateMPerHour(40)).toBeLessThan(0)
    expect(stepPondingDepth(0, 40, 3600)).toBe(0)
  })

  it('보정 사례: 116 mm/h 1시간 → 실측 최대 침수심 1.8 m (±5%)', () => {
    const depth = stepPondingDepth(0, GANGNAM_2022_PEAK_MMH, 3600)
    expect(depth).toBeGreaterThan(GANGNAM_2022_MAX_DEPTH_M * 0.95)
    expect(depth).toBeLessThan(GANGNAM_2022_MAX_DEPTH_M * 1.05)
  })

  it('작은 스텝으로 적분해도 같은 결과', () => {
    let depth = 0
    for (let i = 0; i < 3600; i++) depth = stepPondingDepth(depth, GANGNAM_2022_PEAK_MMH, 1)
    expect(depth).toBeCloseTo(stepPondingDepth(0, GANGNAM_2022_PEAK_MMH, 3600), 6)
  })

  it('강우가 그치면 배수능만큼 수위가 내려간다', () => {
    const rate = getPondingRateMPerHour(0)
    expect(rate).toBeCloseTo((-PONDING_DEFAULTS.drainageCapacityMmH * PONDING_DEFAULTS.catchmentRatio) / 1000, 6)
    expect(stepPondingDepth(1, 0, 3600)).toBe(0)
  })

  it('수위는 0 ~ 상한 사이로 제한', () => {
    expect(stepPondingDepth(MAX_PONDING_DEPTH_M, 150, 3600)).toBe(MAX_PONDING_DEPTH_M)
    expect(stepPondingDepth(0.1, 0, 3600)).toBe(0)
  })

  it('배수능이 크면 같은 강우에도 덜 잠긴다', () => {
    const low = stepPondingDepth(0, 100, 3600, { drainageCapacityMmH: 40 })
    const high = stepPondingDepth(0, 100, 3600, { drainageCapacityMmH: 70 })
    expect(high).toBeLessThan(low)
  })
})
