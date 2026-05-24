import { describe, expect, it } from 'vitest'
import { buildFloodBodyGeometry } from './floodWaterMesh.js'
import { getLocationDefaultFloodBounds } from '../locations/gangnam.js'

const makeTerrainGrid = (resolution, baseHeight = 10) => {
  const heights = new Float32Array(resolution * resolution)
  heights.fill(baseHeight)
  return {
    heights,
    resolution,
    minHeight: baseHeight,
    maxHeight: baseHeight,
    validCount: heights.length,
  }
}

describe('buildFloodBodyGeometry', () => {
  it('builds geometry for flooded cells without throwing', () => {
    const bounds = getLocationDefaultFloodBounds()
    const terrainGrid = makeTerrainGrid(56, 10)

    expect(() => buildFloodBodyGeometry(bounds, terrainGrid, 3.5)).not.toThrow()

    const geometry = buildFloodBodyGeometry(bounds, terrainGrid, 3.5)
    expect(geometry).not.toBeNull()
    expect(geometry.indices.length).toBeGreaterThan(0)
  })

  it('handles fully flooded 28x28 body grid (집중호우 수위)', () => {
    const bounds = getLocationDefaultFloodBounds()
    const terrainGrid = makeTerrainGrid(28, 10)

    const geometry = buildFloodBodyGeometry(bounds, terrainGrid, 3.5)
    expect(geometry).not.toBeNull()
    expect(geometry.indices.length).toBeGreaterThan(0)
  })
})
