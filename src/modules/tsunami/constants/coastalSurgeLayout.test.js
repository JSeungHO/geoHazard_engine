import { describe, expect, it } from 'vitest'
import { floodMaskWeight } from '../../../utils/floodWaterMesh'
import { getCoastalSurgeLayout } from './coastalSurgeLayout'

const EAST_SEA = { lat: 36.5, lon: 129.5 }
const POHANG = { id: 'pohang', label: '포항', lat: 36.032, lon: 129.365, region: 'east' }

describe('getCoastalSurgeLayout', () => {
  it('anchors flood zone toward epicenter, not arbitrary east', () => {
    const early = getCoastalSurgeLayout(POHANG, EAST_SEA, 0.2, 8)
    const late = getCoastalSurgeLayout(POHANG, EAST_SEA, 0.9, 8)

    expect(early.seaAnchor.lat).toBeGreaterThan(POHANG.lat)
    expect(early.seaAnchor.lon).toBeGreaterThan(POHANG.lon)
    expect(early.shorePoint.lat).toBeGreaterThan(POHANG.lat - 0.05)
    expect(early.mask.type).toBe('surge')
    expect(early.mask.progress).toBeLessThan(late.mask.progress)
  })

  it('surge mask is wet near sea and dry far inland at early spread', () => {
    const { bounds, mask } = getCoastalSurgeLayout(POHANG, EAST_SEA, 0.15, 8)
    const west = bounds.west
    const south = bounds.south
    const east = bounds.east
    const north = bounds.north

    const seaWeight = floodMaskWeight(mask.seaU, mask.seaV, mask)
    const inlandWeight = floodMaskWeight(mask.inlandU, mask.inlandV, mask)

    expect(seaWeight).toBeGreaterThan(0.2)
    expect(inlandWeight).toBe(0)
  })
})
