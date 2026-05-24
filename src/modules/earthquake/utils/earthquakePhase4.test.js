import { describe, it, expect } from 'vitest'
import { buildCrackEndpoints } from './earthquakeCrackLines'
import { isLiquefactionProne } from './earthquakeLiquefactionLayer'

const EPICENTER = { lat: 35.76, lon: 129.19 }

describe('buildCrackEndpoints', () => {
  it('7개 end point', () => {
    expect(buildCrackEndpoints(EPICENTER, 7)).toHaveLength(7)
  })

  it('MMI 높을수록 긴 균열', () => {
    const low = buildCrackEndpoints(EPICENTER, 6)
    const high = buildCrackEndpoints(EPICENTER, 9)
    const lowDist = Math.hypot(low[0].endLat - EPICENTER.lat, low[0].endLon - EPICENTER.lon)
    const highDist = Math.hypot(high[0].endLat - EPICENTER.lat, high[0].endLon - EPICENTER.lon)
    expect(highDist).toBeGreaterThan(lowDist)
  })
})

describe('isLiquefactionProne', () => {
  it('낙동강 하구 근처 → true', () => {
    expect(isLiquefactionProne(35.95, 128.95)).toBe(true)
  })

  it('내륙 고원 → false', () => {
    expect(isLiquefactionProne(36.8, 127.2)).toBe(false)
  })
})
