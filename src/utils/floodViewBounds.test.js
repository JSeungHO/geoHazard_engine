import { describe, expect, it } from 'vitest'
import {
  FLOOD_PITCH_FULL_SCREEN,
  boundsChanged,
  getDefaultFloodBounds,
  getFloodBandStartForPitch,
} from './floodViewBounds'

describe('getFloodBandStartForPitch', () => {
  it('returns 0 for oblique downward pitch', () => {
    expect(getFloodBandStartForPitch(FLOOD_PITCH_FULL_SCREEN - 0.1)).toBe(0)
  })

  it('returns 2/3 at horizontal pitch', () => {
    expect(getFloodBandStartForPitch(0)).toBeCloseTo(2 / 3, 5)
  })

  it('interpolates between full screen and horizontal crop', () => {
    const midPitch = FLOOD_PITCH_FULL_SCREEN / 2
    const start = getFloodBandStartForPitch(midPitch)
    expect(start).toBeGreaterThan(0)
    expect(start).toBeLessThan(2 / 3)
  })
})

describe('boundsChanged', () => {
  const base = { west: 127, south: 37, east: 127.01, north: 37.01 }

  it('returns false for identical bounds', () => {
    expect(boundsChanged(base, { ...base })).toBe(false)
  })

  it('returns true when west differs', () => {
    expect(boundsChanged(base, { ...base, west: base.west + 0.001 })).toBe(true)
  })

  it('returns true when either bound is missing', () => {
    expect(boundsChanged(null, base)).toBe(true)
    expect(boundsChanged(base, null)).toBe(true)
  })
})

describe('getDefaultFloodBounds', () => {
  it('centers on gangnam coordinates', () => {
    const bounds = getDefaultFloodBounds()
    expect(bounds.centerLat).toBeCloseTo(37.4975, 4)
    expect(bounds.centerLon).toBeCloseTo(127.0267, 4)
    expect(bounds.east - bounds.west).toBeCloseTo(0.01, 4)
  })
})
