import { describe, expect, it } from 'vitest'
import { getFloodBaselineHeight, getFloodWaterSurfaceHeight, terrainGridChanged } from './terrainHeight'

const makeGrid = (heights, resolution = 2) => {
  const minHeight = Math.min(...heights.filter(Number.isFinite))
  const maxHeight = Math.max(...heights.filter(Number.isFinite))
  return {
    heights: new Float32Array(heights),
    resolution,
    minHeight,
    maxHeight,
    validCount: heights.filter(Number.isFinite).length,
  }
}

describe('getFloodBaselineHeight', () => {
  it('returns grid minHeight', () => {
    const grid = makeGrid([12, 18, 20, 25])
    expect(getFloodBaselineHeight(grid)).toBe(12)
  })

  it('returns 0 for empty grid', () => {
    expect(getFloodBaselineHeight(null)).toBe(0)
    expect(getFloodBaselineHeight({ heights: [], validCount: 0 })).toBe(0)
  })
})

describe('getFloodWaterSurfaceHeight', () => {
  it('adds flood depth to baseline', () => {
    const grid = makeGrid([10, 15, 20, 30])
    expect(getFloodWaterSurfaceHeight(grid, 3)).toBe(13)
  })

  it('ignores negative depth', () => {
    const grid = makeGrid([10, 15, 20, 30])
    expect(getFloodWaterSurfaceHeight(grid, -2)).toBe(10)
  })
})

describe('terrainGridChanged', () => {
  it('returns false when min/max match within epsilon', () => {
    const a = makeGrid([10, 12, 14, 16])
    const b = makeGrid([10, 12, 14, 16])
    expect(terrainGridChanged(a, b)).toBe(false)
  })

  it('returns true when minHeight differs beyond epsilon', () => {
    const a = makeGrid([10, 12, 14, 16])
    const b = makeGrid([10.2, 12, 14, 16])
    expect(terrainGridChanged(a, b)).toBe(true)
  })
})
