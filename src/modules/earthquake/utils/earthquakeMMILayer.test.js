import { describe, it, expect } from 'vitest'
import { EarthquakeWaveModel } from '../../../physics/EarthquakeWaveModel'
import {
  computeMMIBounds,
  getMMIRefreshKey,
  mmiToRgba,
  buildMMICanvas,
} from './earthquakeMMILayer'

const GYEONGJU = { lat: 35.76, lon: 129.19 }
const hasDocument = typeof document !== 'undefined'

function makeModel() {
  return new EarthquakeWaveModel({
    epicenter: GYEONGJU,
    depthKm: 15,
    magnitude: 5.8,
    timeScale: 50,
    maxPropagationKm: 800,
  })
}

describe('computeMMIBounds', () => {
  it('진앙을 중심으로 west < east, south < north', () => {
    const b = computeMMIBounds(GYEONGJU, 800)
    expect(b.west).toBeLessThan(GYEONGJU.lon)
    expect(b.east).toBeGreaterThan(GYEONGJU.lon)
    expect(b.south).toBeLessThan(GYEONGJU.lat)
    expect(b.north).toBeGreaterThan(GYEONGJU.lat)
  })
})

describe('getMMIRefreshKey', () => {
  it('같은 bucket이면 동일 키', () => {
    const a = getMMIRefreshKey(3, 120_000)
    const b = getMMIRefreshKey(3, 149_000)
    expect(a).toBe(b)
  })

  it('affectedCount 변화 시 다른 키', () => {
    const a = getMMIRefreshKey(3, 120_000)
    const b = getMMIRefreshKey(4, 120_000)
    expect(a).not.toBe(b)
  })

  it('S파 반경 50 km bucket 넘으면 다른 키', () => {
    const a = getMMIRefreshKey(3, 49_000)
    const b = getMMIRefreshKey(3, 51_000)
    expect(a).not.toBe(b)
  })
})

describe('mmiToRgba', () => {
  it('MMI 1은 낮은 alpha', () => {
    const low = mmiToRgba(1)
    const high = mmiToRgba(9)
    expect(high.a).toBeGreaterThan(low.a)
  })

  it('RGB 범위 0~255', () => {
    const c = mmiToRgba(6)
    expect(c.r).toBeGreaterThanOrEqual(0)
    expect(c.r).toBeLessThanOrEqual(255)
    expect(c.a).toBeGreaterThan(0)
  })
})

describe.skipIf(!hasDocument)('buildMMICanvas', () => {
  it('S파 미도달(elapsed=0) → 전부 투명', () => {
    const model = makeModel()
    const bounds = computeMMIBounds(GYEONGJU, 800)
    const canvas = buildMMICanvas(model, 0, bounds, 32, 32)
    const ctx = canvas.getContext('2d')
    const { data } = ctx.getImageData(0, 0, 32, 32)

    let opaque = 0
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) opaque++
    }
    expect(opaque).toBe(0)
  })

  it('충분한 elapsed → 진앙 근처 픽셀에 색상', () => {
    const model = makeModel()
    const bounds = computeMMIBounds(GYEONGJU, 800)
    const elapsed = model.getTotalDurationMs() * 0.3
    const canvas = buildMMICanvas(model, elapsed, bounds, 64, 64)
    const ctx = canvas.getContext('2d')
    const { data } = ctx.getImageData(32, 32, 1, 1)

    expect(data[3]).toBeGreaterThan(0)
  })
})
