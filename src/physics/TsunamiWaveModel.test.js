import { describe, expect, it } from 'vitest'
import { TsunamiWaveModel, haversineDistanceM } from './TsunamiWaveModel'
import { DEFAULT_TSUNAMI_OPTIONS } from '../modules/tsunami/constants/tsunamiPresets'

const EAST_SEA = { lat: 36.5, lon: 129.5 }
const POHANG = { id: 'pohang', label: '포항', lat: 36.032, lon: 129.365 }

const createModel = (overrides = {}) =>
  new TsunamiWaveModel({
    epicenter: EAST_SEA,
    ...DEFAULT_TSUNAMI_OPTIONS,
    ...overrides,
  })

describe('haversineDistanceM', () => {
  it('returns plausible distance from East Sea epicenter to Pohang coast', () => {
    const distance = haversineDistanceM(EAST_SEA.lat, EAST_SEA.lon, POHANG.lat, POHANG.lon)
    expect(distance).toBeGreaterThan(50_000)
    expect(distance).toBeLessThan(120_000)
  })
})

describe('TsunamiWaveModel', () => {
  it('getRingRadius(0) is zero', () => {
    const model = createModel()
    expect(model.getRingRadius(0)).toBe(0)
  })

  it('getRingRadius caps at maxPropagationKm', () => {
    const model = createModel({ maxPropagationKm: 100 })
    expect(model.getRingRadius(999_999_999)).toBe(100_000)
  })

  it('getCoastalWaveHeight is zero before arrival at coast', () => {
    const model = createModel()
    expect(model.getCoastalWaveHeight(0, POHANG.lat, POHANG.lon)).toBe(0)
  })

  it('getCoastalWaveHeight rises gradually after wave reaches coast', () => {
    const model = createModel()
    const arrivalMs = model.getArrivalMs(POHANG.lat, POHANG.lon)
    const early = model.getCoastalWaveHeight(arrivalMs + 1000, POHANG.lat, POHANG.lon)
    const later = model.getCoastalWaveHeight(arrivalMs + 10_000, POHANG.lat, POHANG.lon)
    expect(early).toBeGreaterThan(0)
    expect(later).toBeGreaterThan(early)
  })

  it('getTravelWaveHeight grows as the ring approaches the coast', () => {
    const model = createModel()
    const distanceM = model.distanceTo(POHANG.lat, POHANG.lon)
    const early = model.getTravelWaveHeight(distanceM * 0.35, POHANG.lat, POHANG.lon)
    const later = model.getTravelWaveHeight(distanceM * 0.85, POHANG.lat, POHANG.lon)
    expect(early).toBeGreaterThan(0)
    expect(later).toBeGreaterThan(early)
  })

  it('getImpactSummary includes approach progress before arrival', () => {
    const model = createModel()
    const arrivalMs = model.getArrivalMs(POHANG.lat, POHANG.lon)
    const summary = model.getImpactSummary(arrivalMs * 0.5, [POHANG])
    expect(summary.impacts[0].approachProgress).toBeGreaterThan(0.2)
    expect(summary.impacts[0].travelWaveHeightM).toBeGreaterThan(0)
    expect(summary.impacts[0].reached).toBe(false)
  })

  it('getCoastalSpreadFactor widens over time after arrival', () => {
    const model = createModel()
    const arrivalMs = model.getArrivalMs(POHANG.lat, POHANG.lon)
    const early = model.getCoastalSpreadFactor(arrivalMs + 1000, POHANG.lat, POHANG.lon)
    const later = model.getCoastalSpreadFactor(arrivalMs + 15_000, POHANG.lat, POHANG.lon)
    expect(early).toBeGreaterThan(0.3)
    expect(later).toBeGreaterThan(early)
    expect(later).toBeLessThanOrEqual(1)
  })

  it('getImpactSummary reports affected coastal points', () => {
    const model = createModel()
    const arrivalMs = model.getArrivalMs(POHANG.lat, POHANG.lon)
    const summary = model.getImpactSummary(arrivalMs + 15_000, [POHANG])
    expect(summary.affectedCount).toBe(1)
    expect(summary.maxWaveHeightM).toBeGreaterThan(0)
    expect(summary.impacts[0].spreadFactor).toBeGreaterThan(0.3)
  })

  it('getTotalDurationMs matches propagation limit', () => {
    const model = createModel({ maxPropagationKm: 500, waveSpeed: 200, timeScale: 100 })
    expect(model.getTotalDurationMs()).toBe(25_000)
  })
})
