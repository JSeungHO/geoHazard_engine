import { describe, expect, it } from 'vitest'
import { getRunupStateKey } from './tsunamiRunupPrimitives'
import { buildInboundWaveCorridor, buildRunupSites } from './tsunamiRunupSites'
import { haversineDistanceM } from '../../../physics/TsunamiWaveModel'

const EAST_SEA = { lat: 36.5, lon: 129.5 }
const POHANG = {
  id: 'pohang',
  label: '포항',
  lat: 36.032,
  lon: 129.365,
  region: 'east',
  shoreOffset: { northM: -900, eastM: 1400 },
}

describe('getRunupStateKey', () => {
  it('quantizes nearby values to the same key', () => {
    const base = {
      corners: Array.from({ length: 8 }, (_, i) => ({
        lat: 36.03 + i * 0.001,
        lon: 129.36 + i * 0.001,
      })),
      extrudedHeight: 5.1,
      surgeMask: { progress: 0.42, seaU: 0.2, inlandU: 0.8 },
    }
    expect(getRunupStateKey(base)).toBe(getRunupStateKey({
      ...base,
      extrudedHeight: 5.2,
    }))
  })
})

describe('buildInboundWaveCorridor', () => {
  const distToPohang = haversineDistanceM(EAST_SEA.lat, EAST_SEA.lon, POHANG.lat, POHANG.lon)

  it('uses a curved corridor with more than four corners', () => {
    const corridor = buildInboundWaveCorridor(POHANG, EAST_SEA, distToPohang * 0.5, 0.3, 6, false)
    expect(corridor.corners.length).toBeGreaterThan(6)
  })

  it('advances the wave front as ring radius grows before coast arrival', () => {
    const early = buildInboundWaveCorridor(POHANG, EAST_SEA, distToPohang * 0.45, 0.2, 6, false)
    const late = buildInboundWaveCorridor(POHANG, EAST_SEA, distToPohang * 0.85, 0.2, 6, false)

    const frontLon = (corridor) => {
      const mid = corridor.corners[Math.floor(corridor.corners.length / 2)]
      return mid.lon
    }

    expect(frontLon(late)).not.toBeCloseTo(frontLon(early), 2)
  })

  it('extends from epicenter toward the coastal site', () => {
    const corridor = buildInboundWaveCorridor(POHANG, EAST_SEA, distToPohang * 0.7, 0.5, 6, false)
    const distFromEpicenter = haversineDistanceM(
      EAST_SEA.lat,
      EAST_SEA.lon,
      corridor.corners[0].lat,
      corridor.corners[0].lon
    )
    expect(distFromEpicenter).toBeLessThan(distToPohang * 0.75)
    expect(distFromEpicenter).toBeGreaterThan(1000)
  })

  it('includes surgeMask UVs for shader uniforms', () => {
    const corridor = buildInboundWaveCorridor(POHANG, EAST_SEA, distToPohang * 0.6, 0.5, 8, false)
    expect(corridor.surgeMask?.type).toBe('surge')
    expect(corridor.surgeMask?.bounds?.west).toBeLessThan(corridor.surgeMask?.bounds?.east)
  })
})

describe('buildRunupSites', () => {
  it('returns inbound corridors while wave is approaching', () => {
    const summary = {
      ringRadiusM: 40_000,
      impacts: [{
        ...POHANG,
        reached: false,
        approachProgress: 0.55,
        travelWaveHeightM: 4.2,
        waveHeightM: 0,
        spreadFactor: 0,
      }],
    }
    const sites = buildRunupSites(summary, EAST_SEA)
    expect(sites.length).toBeGreaterThanOrEqual(1)
    expect(sites.some((site) => site.id === 'pohang')).toBe(true)
    expect(sites.some((site) => site.mode === 'shore')).toBe(true)
    expect(sites[0].reached).toBe(false)
  })

  it('returns surge corridors for reached impacts', () => {
    const summary = {
      ringRadiusM: 80_000,
      impacts: [{
        ...POHANG,
        reached: true,
        approachProgress: 1,
        travelWaveHeightM: 0,
        waveHeightM: 6,
        spreadFactor: 0.4,
      }],
    }
    const sites = buildRunupSites(summary, EAST_SEA)
    expect(sites.length).toBeGreaterThanOrEqual(1)
    expect(sites.some((site) => site.id === 'pohang')).toBe(true)
    expect(sites.some((site) => site.mode === 'shore')).toBe(true)
  })
})
