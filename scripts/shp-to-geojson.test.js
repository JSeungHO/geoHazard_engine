import { describe, expect, it } from 'vitest'
import { bboxAroundPoint, bboxIntersects, featureBBox, featureInBBox } from './lib/bbox.js'
import { reprojectCoord, reprojectFeature } from './lib/reproject.js'

describe('reproject', () => {
  it('EPSG:5179 강남역 부근 좌표를 WGS84로 변환', () => {
    // KGD2002 unified meters — 강남역 근사 (역 좌표 역산 샘플)
    const [lon, lat] = reprojectCoord([959_500, 1_944_500])
    expect(lon).toBeGreaterThan(126.9)
    expect(lon).toBeLessThan(127.2)
    expect(lat).toBeGreaterThan(37.4)
    expect(lat).toBeLessThan(37.6)
  })

  it('Polygon feature reprojects rings', () => {
    const feature = reprojectFeature({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[[959_000, 1_944_000], [960_000, 1_944_000], [960_000, 1_945_000], [959_000, 1_945_000], [959_000, 1_944_000]]],
      },
    })
    const [lon, lat] = feature.geometry.coordinates[0][0]
    expect(typeof lon).toBe('number')
    expect(typeof lat).toBe('number')
    expect(lon).toBeLessThan(128)
    expect(lat).toBeGreaterThan(37)
  })
})

describe('bbox', () => {
  it('featureInBBox detects intersection', () => {
    const feature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Point',
        coordinates: [127.03, 37.5],
      },
    }
    const box = bboxAroundPoint(127.0267, 37.4975, 0.01)
    expect(featureInBBox(feature, box)).toBe(true)
    expect(bboxIntersects(featureBBox(feature), box)).toBe(true)
  })

  it('feature outside bbox is excluded', () => {
    const feature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Point',
        coordinates: [126.8, 37.5],
      },
    }
    const box = bboxAroundPoint(127.0267, 37.4975, 0.01)
    expect(featureInBBox(feature, box)).toBe(false)
  })
})
