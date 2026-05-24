import { describe, it, expect } from 'vitest'
import {
  EarthquakeWaveModel,
  haversineDistanceM,
  getMMILabel,
  getMMIEmoji,
  getShakeParams,
  getMMIExposureFactor,
  estimateAffectedPopulation,
  P_WAVE_SPEED,
  S_WAVE_SPEED,
} from './EarthquakeWaveModel'

const GYEONGJU = { lat: 35.76, lon: 129.19 }
const SEOUL = { lat: 37.566, lon: 126.978 }
const BUSAN = { lat: 35.180, lon: 129.075 }

function makeModel(overrides = {}) {
  return new EarthquakeWaveModel({
    epicenter: GYEONGJU,
    depthKm: 15,
    magnitude: 5.8,
    timeScale: 50,
    maxPropagationKm: 800,
    ...overrides,
  })
}

// ─── haversineDistanceM ──────────────────────────────────────────

describe('haversineDistanceM', () => {
  it('같은 지점 → 0', () => {
    expect(haversineDistanceM(35.76, 129.19, 35.76, 129.19)).toBe(0)
  })

  it('경주→서울 약 280 km 범위', () => {
    // 실측: 경주(35.76°N, 129.19°E) ~ 서울(37.57°N, 126.98°E) ≈ 281 km
    const dist = haversineDistanceM(GYEONGJU.lat, GYEONGJU.lon, SEOUL.lat, SEOUL.lon)
    expect(dist).toBeGreaterThan(250_000)
    expect(dist).toBeLessThan(320_000)
  })

  it('경주→부산 약 60~80 km 범위', () => {
    const dist = haversineDistanceM(GYEONGJU.lat, GYEONGJU.lon, BUSAN.lat, BUSAN.lon)
    expect(dist).toBeGreaterThan(50_000)
    expect(dist).toBeLessThan(100_000)
  })
})

// ─── 파면 반경 ───────────────────────────────────────────────────

describe('getPWaveRadius / getSWaveRadius', () => {
  const model = makeModel()

  it('elapsed=0 → 반경 0', () => {
    expect(model.getPWaveRadius(0)).toBe(0)
    expect(model.getSWaveRadius(0)).toBe(0)
  })

  it('1초 경과 → P파 반경이 S파 반경보다 크다', () => {
    const pR = model.getPWaveRadius(1000)
    const sR = model.getSWaveRadius(1000)
    expect(pR).toBeGreaterThan(sR)
  })

  it('P파 속도 비율 검증 — P:S ≈ 6000:3500', () => {
    const pR = model.getPWaveRadius(1000)
    const sR = model.getSWaveRadius(1000)
    const ratio = pR / sR
    expect(ratio).toBeCloseTo(P_WAVE_SPEED / S_WAVE_SPEED, 2)
  })

  it('최대 전파 거리 캡 — 충분한 시간 경과 후 maxPropagationM 이하', () => {
    const model800 = makeModel({ maxPropagationKm: 800 })
    const veryLong = model800.getPWaveRadius(1_000_000)
    expect(veryLong).toBe(800_000)
  })
})

// ─── 도달 시간 ───────────────────────────────────────────────────

describe('getPWaveArrivalMs / getSWaveArrivalMs', () => {
  const model = makeModel()

  it('진앙 자체 도달 시간 ≈ 0 (깊이로 인한 약간의 양수값)', () => {
    const pArr = model.getPWaveArrivalMs(GYEONGJU.lat, GYEONGJU.lon)
    expect(pArr).toBeGreaterThanOrEqual(0)
    expect(pArr).toBeLessThan(100)  // 배속 50×이므로 매우 빠름
  })

  it('S파 도달이 P파 도달보다 늦다', () => {
    const pArr = model.getPWaveArrivalMs(SEOUL.lat, SEOUL.lon)
    const sArr = model.getSWaveArrivalMs(SEOUL.lat, SEOUL.lon)
    expect(sArr).toBeGreaterThan(pArr)
  })

  it('최대 전파 거리 밖 → Infinity', () => {
    const farModel = makeModel({ maxPropagationKm: 10 })  // 10 km 이상 차단
    const arr = farModel.getPWaveArrivalMs(SEOUL.lat, SEOUL.lon)
    expect(arr).toBe(Infinity)
  })
})

// ─── MMI / PGA ──────────────────────────────────────────────────

describe('getMMI / getPGA', () => {
  const model = makeModel()

  it('진앙 근처 MMI > 멀리 떨어진 지점 MMI', () => {
    const mmiNear = model.getMMI(BUSAN.lat, BUSAN.lon)
    const mmiFar = model.getMMI(SEOUL.lat, SEOUL.lon)
    expect(mmiNear).toBeGreaterThan(mmiFar)
  })

  it('MMI 범위 1~12', () => {
    const mmi = model.getMMI(SEOUL.lat, SEOUL.lon)
    expect(mmi).toBeGreaterThanOrEqual(1)
    expect(mmi).toBeLessThanOrEqual(12)
  })

  it('규모 클수록 같은 지점의 PGA가 높다', () => {
    const m6 = makeModel({ magnitude: 6.0 })
    const m7 = makeModel({ magnitude: 7.0 })
    expect(m7.getPGA(SEOUL.lat, SEOUL.lon)).toBeGreaterThan(m6.getPGA(SEOUL.lat, SEOUL.lon))
  })

  it('깊이가 깊을수록 진앙 근처 MMI 낮아진다', () => {
    const shallow = makeModel({ depthKm: 5 })
    const deep = makeModel({ depthKm: 30 })
    const mmiShallow = shallow.getMMI(BUSAN.lat, BUSAN.lon)
    const mmiDeep = deep.getMMI(BUSAN.lat, BUSAN.lon)
    expect(mmiShallow).toBeGreaterThan(mmiDeep)
  })
})

// ─── getShakeIntensity ───────────────────────────────────────────

describe('getShakeIntensity', () => {
  it('0.0~1.0 범위', () => {
    const model = makeModel()
    const intensity = model.getShakeIntensity(BUSAN.lat, BUSAN.lon)
    expect(intensity).toBeGreaterThanOrEqual(0.0)
    expect(intensity).toBeLessThanOrEqual(1.0)
  })

  it('가까울수록 강도가 높다', () => {
    const model = makeModel()
    const near = model.getShakeIntensity(BUSAN.lat, BUSAN.lon)
    const far = model.getShakeIntensity(SEOUL.lat, SEOUL.lon)
    expect(near).toBeGreaterThan(far)
  })
})

// ─── getImpactSummary ────────────────────────────────────────────

describe('getImpactSummary', () => {
  const cities = [
    { id: 'busan', label: '부산', ...BUSAN },
    { id: 'seoul', label: '서울', ...SEOUL },
  ]
  const model = makeModel()

  it('elapsed=0 → 어떤 도시도 도달되지 않음', () => {
    const summary = model.getImpactSummary(0, cities)
    expect(summary.affectedCount).toBe(0)
    expect(summary.cities.every((c) => !c.pWaveReached)).toBe(true)
  })

  it('충분한 시간 경과 → 두 도시 모두 S파 도달', () => {
    const totalMs = model.getTotalDurationMs()
    const summary = model.getImpactSummary(totalMs, cities)
    expect(summary.affectedCount).toBe(2)
  })

  it('maxMMI는 S파 도달 도시 중 가장 높은 값', () => {
    const totalMs = model.getTotalDurationMs()
    const summary = model.getImpactSummary(totalMs, cities)
    const expected = Math.max(...summary.cities.map((c) => c.mmi))
    expect(summary.maxMMI).toBeCloseTo(expected, 5)
  })

  it('firstPArrivalMs ≤ firstSArrivalMs', () => {
    const summary = model.getImpactSummary(0, cities)
    expect(summary.firstPArrivalMs).toBeLessThanOrEqual(summary.firstSArrivalMs)
  })

  it('pWaveRadiusKm = pWaveRadiusM / 1000', () => {
    const summary = model.getImpactSummary(1000, cities)
    expect(summary.pWaveRadiusKm).toBeCloseTo(summary.pWaveRadiusM / 1000, 5)
  })

  it('estimatedAreaKm2 = π × S파 반경²', () => {
    const summary = model.getImpactSummary(5000, cities)
    expect(summary.estimatedAreaKm2).toBeCloseTo(
      Math.PI * summary.sWaveRadiusKm ** 2,
      5,
    )
  })

  it('elapsed=0 → 추정 인구·면적 0', () => {
    const summary = model.getImpactSummary(0, cities)
    expect(summary.estimatedAffectedPopulation).toBe(0)
    expect(summary.estimatedAreaKm2).toBe(0)
  })
})

// ─── getTotalDurationMs ──────────────────────────────────────────

describe('getTotalDurationMs', () => {
  it('S파 maxPropagation 도달 시간과 일치', () => {
    const model = makeModel({ maxPropagationKm: 800, timeScale: 50 })
    const expected = (800_000 / (S_WAVE_SPEED * 50)) * 1000
    expect(model.getTotalDurationMs()).toBeCloseTo(expected, 1)
  })

  it('isSimulationComplete — totalDuration 경과 시 true', () => {
    const model = makeModel()
    expect(model.isSimulationComplete(model.getTotalDurationMs())).toBe(true)
    expect(model.isSimulationComplete(model.getTotalDurationMs() - 1)).toBe(false)
  })
})

// ─── 헬퍼 유틸 ──────────────────────────────────────────────────

describe('getMMILabel', () => {
  it('MMI 1 → I', () => expect(getMMILabel(1)).toBe('I'))
  it('MMI 7 → VII', () => expect(getMMILabel(7)).toBe('VII'))
  it('MMI 12 → XII', () => expect(getMMILabel(12)).toBe('XII'))
  it('소수점 반올림 — 6.6 → VII', () => expect(getMMILabel(6.6)).toBe('VII'))
})

describe('getMMIEmoji', () => {
  it('MMI 1~3 → ⚪', () => expect(getMMIEmoji(2)).toBe('⚪'))
  it('MMI 4~5 → 🟡', () => expect(getMMIEmoji(5)).toBe('🟡'))
  it('MMI 6~7 → 🟠', () => expect(getMMIEmoji(6)).toBe('🟠'))
  it('MMI 8+ → 🔴', () => expect(getMMIEmoji(9)).toBe('🔴'))
})

describe('getMMIExposureFactor / estimateAffectedPopulation', () => {
  it('MMI 7+ → 가중치 1.0', () => {
    expect(getMMIExposureFactor(7)).toBe(1.0)
  })

  it('S파 미도달 도시는 인구 집계 제외', () => {
    const pop = estimateAffectedPopulation([
      { sWaveReached: false, mmi: 8, population: 1_000_000 },
      { sWaveReached: true, mmi: 7, population: 500_000 },
    ])
    expect(pop).toBe(500_000)
  })

  it('MMI에 따라 인구 가중', () => {
    const pop = estimateAffectedPopulation([
      { sWaveReached: true, mmi: 4, population: 1_000_000 },
    ])
    expect(pop).toBe(200_000)
  })
})

describe('getShakeParams', () => {
  it('MMI 8+ → intensity 1.0, duration 5000', () => {
    const p = getShakeParams(8)
    expect(p.intensity).toBe(1.0)
    expect(p.durationMs).toBe(5_000)
  })
  it('MMI 5 → intensity 0.3, duration 2000', () => {
    const p = getShakeParams(5)
    expect(p.intensity).toBe(0.3)
    expect(p.durationMs).toBe(2_000)
  })
})

// ─── depthKm 최소값 클램프 ───────────────────────────────────────

describe('depthKm 최소 1 클램프', () => {
  it('depthKm=0 → 1로 클램프', () => {
    const model = makeModel({ depthKm: 0 })
    expect(model.depthKm).toBe(1)
  })

  it('hypoDistance가 epicentral 이상이어야 함 (depth 기여)', () => {
    const model = makeModel()
    const hypo = model.hypoDistance(BUSAN.lat, BUSAN.lon)
    const epi = model.distanceTo(BUSAN.lat, BUSAN.lon)
    expect(hypo).toBeGreaterThanOrEqual(epi)
  })
})
