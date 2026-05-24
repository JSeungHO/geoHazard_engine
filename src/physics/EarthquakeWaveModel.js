/**
 * EarthquakeWaveModel.js
 * 지진파(P파·S파) 전파 + MMI 진도 계산 — 교육용 결정론적 모델
 * 참조: earthquake-plan.md §3
 */

const EARTH_RADIUS_M = 6_371_000

/** P파 전파 속도 (m/s) — 지각 모델 */
export const P_WAVE_SPEED = 6_000
/** S파 전파 속도 (m/s) — 지각 모델 */
export const S_WAVE_SPEED = 3_500

/**
 * 간소화 GMPE 계수 (Atkinson & Boore 2003 + USGS ShakeMap MMI-PGA 보정)
 *
 * PGA 항 (C1~C4): Atkinson & Boore 2003 기반, PGA 단위 g
 *   ln(PGA_g) = C1 + C2·M - C3·ln(R_hypo_km) - C4·R_hypo_km
 *
 * MMI 항 (C5~C6): Worden et al. 2012 스타일 (cm/s²→g 단위 변환 적용)
 *   MMI = C5 + C6·ln(PGA_g)
 *
 * 교육용 검증: 경주(2016) M5.8 부산(~67km) → MMI≈4, 서울(~281km) → MMI≈1
 *              포항(2017) M5.4 포항 시내(~5km) → MMI≈7
 */
const C1 = 0.04
const C2 = 0.61
const C3 = 1.66
const C4 = 0.0059
const C5 = 7.58   // USGS ShakeMap 보정값 (원 3.23 → 한반도 거리 스케일 조정)
const C6 = 0.955  // 원 1.51 → USGS Worden et al. 2012 기반

/** MMI 진도 → 색상 매핑 */
export const MMI_COLORS = {
  1: '#FFFFFF',
  2: '#FFFFFF',
  3: '#A9F5A9',
  4: '#8DD9F5',
  5: '#FFF87A',
  6: '#FFC700',
  7: '#FF8C00',
  8: '#FF4500',
  9: '#CC0000',
  10: '#CC0000',
  11: '#CC0000',
  12: '#CC0000',
}

/** MMI 진도 → 이모지 마커 */
export function getMMIEmoji(mmi) {
  const clamped = Math.round(Math.max(1, Math.min(12, mmi)))
  if (clamped <= 3) return '⚪'
  if (clamped <= 5) return '🟡'
  if (clamped <= 7) return '🟠'
  return '🔴'
}

/** MMI 숫자 → 로마자 라벨 */
export function getMMILabel(mmi) {
  const labels = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
  const idx = Math.round(Math.max(1, Math.min(12, mmi)))
  return labels[idx] ?? 'XII'
}

/** MMI 기반 노출 인구 가중치 (교육용 근사) */
export function getMMIExposureFactor(mmi) {
  if (mmi >= 7) return 1.0
  if (mmi >= 6) return 0.75
  if (mmi >= 5) return 0.45
  if (mmi >= 4) return 0.2
  return 0.05
}

/** S파 도달 도시 배열 → 추정 영향 인구 */
export function estimateAffectedPopulation(cities) {
  return cities.reduce((sum, city) => {
    if (!city.sWaveReached) return sum
    const pop = city.population ?? 0
    return sum + pop * getMMIExposureFactor(city.mmi)
  }, 0)
}

/** MMI 기반 카메라 쉐이크 강도·지속 시간 테이블 */
export function getShakeParams(mmi) {
  if (mmi >= 8) return { intensity: 1.0, durationMs: 5_000 }
  if (mmi >= 7) return { intensity: 0.7, durationMs: 4_000 }
  if (mmi >= 6) return { intensity: 0.5, durationMs: 3_000 }
  if (mmi >= 5) return { intensity: 0.3, durationMs: 2_000 }
  return { intensity: 0.1, durationMs: 1_000 }
}

/** 두 위경도 거리 (m) — Haversine */
export function haversineDistanceM(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

export class EarthquakeWaveModel {
  /**
   * @param {object} opts
   * @param {{ lat: number, lon: number }} opts.epicenter   진앙(지표)
   * @param {number} [opts.depthKm=10]                     진원 깊이 (km, 최소 1)
   * @param {number} [opts.magnitude=6.0]                  Mw 규모
   * @param {number} [opts.timeScale=50]                   배속 — 실제 1초 = 시뮬 50초
   * @param {number} [opts.maxPropagationKm=800]           최대 전파 거리 (km)
   */
  constructor({
    epicenter,
    depthKm = 10,
    magnitude = 6.0,
    timeScale = 50,
    maxPropagationKm = 800,
  }) {
    this.epicenter = epicenter
    this.depthKm = Math.max(1, depthKm)
    this.magnitude = magnitude
    this.timeScale = timeScale
    this.maxPropagationKm = maxPropagationKm
  }

  get maxPropagationM() {
    return this.maxPropagationKm * 1000
  }

  /** 유효 P파 속도 (배속 적용, m/s) */
  get effectivePSpeed() {
    return P_WAVE_SPEED * this.timeScale
  }

  /** 유효 S파 속도 (배속 적용, m/s) */
  get effectiveSSpeed() {
    return S_WAVE_SPEED * this.timeScale
  }

  // ─── 파면 반경 ─────────────────────────────────────────────────

  /** 경과 실제 ms → P파 ring 반경 (m) */
  getPWaveRadius(elapsedMs) {
    const raw = this.effectivePSpeed * (elapsedMs / 1000)
    return Math.min(raw, this.maxPropagationM)
  }

  /** 경과 실제 ms → S파 ring 반경 (m) */
  getSWaveRadius(elapsedMs) {
    const raw = this.effectiveSSpeed * (elapsedMs / 1000)
    return Math.min(raw, this.maxPropagationM)
  }

  // ─── 도달 시간 ─────────────────────────────────────────────────

  /** 진앙 → 대상 지점 epicentral 거리 (m) */
  distanceTo(lat, lon) {
    return haversineDistanceM(this.epicenter.lat, this.epicenter.lon, lat, lon)
  }

  /** 하이포 거리 (m) — epicentral² + depth² 의 합성 */
  hypoDistance(lat, lon) {
    const epicentralM = this.distanceTo(lat, lon)
    const depthM = this.depthKm * 1000
    return Math.sqrt(epicentralM ** 2 + depthM ** 2)
  }

  /** 지점까지 P파 도달 실제 ms (최대 전파 거리 초과 시 Infinity) */
  getPWaveArrivalMs(lat, lon) {
    const dist = this.distanceTo(lat, lon)
    if (dist > this.maxPropagationM) return Infinity
    return (dist / this.effectivePSpeed) * 1000
  }

  /** 지점까지 S파 도달 실제 ms (최대 전파 거리 초과 시 Infinity) */
  getSWaveArrivalMs(lat, lon) {
    const dist = this.distanceTo(lat, lon)
    if (dist > this.maxPropagationM) return Infinity
    return (dist / this.effectiveSSpeed) * 1000
  }

  // ─── MMI 계산 ──────────────────────────────────────────────────

  /**
   * Peak Ground Acceleration (g) — 간소화 GMPE
   * ln(PGA) = C1 + C2·M - C3·ln(R_hypo) - C4·R_hypo  (R_hypo in km)
   */
  getPGA(lat, lon) {
    const R_km = this.hypoDistance(lat, lon) / 1000
    const R_safe = Math.max(R_km, 1)
    const lnPGA = C1 + C2 * this.magnitude - C3 * Math.log(R_safe) - C4 * R_safe
    return Math.exp(lnPGA)
  }

  /**
   * MMI (수정 머캘리 진도, 1~12)
   * MMI = C5 + C6·ln(PGA)
   */
  getMMI(lat, lon) {
    const pga = this.getPGA(lat, lon)
    const mmi = C5 + C6 * Math.log(pga)
    return Math.max(1, Math.min(12, mmi))
  }

  /**
   * 카메라 쉐이크 강도 0.0~1.0 (S파 도달 기준 MMI → 0~1 선형 매핑)
   * MMI ≤ 4 → 0.05, MMI ≥ 9 → 1.0
   */
  getShakeIntensity(cameraLat, cameraLon) {
    const mmi = this.getMMI(cameraLat, cameraLon)
    return Math.max(0.05, Math.min(1.0, (mmi - 1) / 8))
  }

  // ─── 도시 피해 요약 ────────────────────────────────────────────

  /**
   * 경과 ms + 도시 배열 → 도시별 도달 상태 + 전체 요약
   * @param {number} elapsedMs
   * @param {Array<{id:string, label:string, lat:number, lon:number}>} cities
   * @returns {{ pWaveRadiusM, sWaveRadiusM, cities: Array, affectedCount, maxMMI, firstPArrivalMs, firstSArrivalMs }}
   */
  getImpactSummary(elapsedMs, cities) {
    const pRadius = this.getPWaveRadius(elapsedMs)
    const sRadius = this.getSWaveRadius(elapsedMs)

    const cityResults = cities.map((city) => {
      const distM = this.distanceTo(city.lat, city.lon)
      const pArrivalMs = this.getPWaveArrivalMs(city.lat, city.lon)
      const sArrivalMs = this.getSWaveArrivalMs(city.lat, city.lon)
      const mmi = this.getMMI(city.lat, city.lon)

      const pWaveReached = Number.isFinite(pArrivalMs) && elapsedMs >= pArrivalMs
      const sWaveReached = Number.isFinite(sArrivalMs) && elapsedMs >= sArrivalMs

      // S파 도달 전이면 ETA (시뮬 시간 기준 남은 실제 ms)
      const etaMs = !sWaveReached && Number.isFinite(sArrivalMs)
        ? Math.max(0, sArrivalMs - elapsedMs)
        : null

      return {
        ...city,
        distanceM: distM,
        distanceKm: distM / 1000,
        pArrivalMs: Number.isFinite(pArrivalMs) ? pArrivalMs : null,
        sArrivalMs: Number.isFinite(sArrivalMs) ? sArrivalMs : null,
        pWaveReached,
        sWaveReached,
        mmi,
        mmiLabel: getMMILabel(mmi),
        mmiEmoji: getMMIEmoji(mmi),
        etaMs,
      }
    })

    const reachedCities = cityResults.filter((c) => c.sWaveReached)
    const maxMMI = reachedCities.length > 0
      ? Math.max(...reachedCities.map((c) => c.mmi))
      : 0
    const strongShakeCount = reachedCities.filter((c) => c.mmi >= 6).length
    const sRadiusKm = sRadius / 1000

    const pArrivals = cityResults.map((c) => c.pArrivalMs).filter((ms) => ms != null)
    const sArrivals = cityResults.map((c) => c.sArrivalMs).filter((ms) => ms != null)

    return {
      pWaveRadiusM: pRadius,
      pWaveRadiusKm: pRadius / 1000,
      sWaveRadiusM: sRadius,
      sWaveRadiusKm: sRadiusKm,
      cities: cityResults,
      affectedCount: reachedCities.length,
      totalCities: cities.length,
      strongShakeCount,
      maxMMI,
      maxMMILabel: maxMMI > 0 ? getMMILabel(maxMMI) : '—',
      estimatedAreaKm2: Math.PI * sRadiusKm ** 2,
      estimatedAffectedPopulation: estimateAffectedPopulation(cityResults),
      firstPArrivalMs: pArrivals.length > 0 ? Math.min(...pArrivals) : null,
      firstSArrivalMs: sArrivals.length > 0 ? Math.min(...sArrivals) : null,
    }
  }

  // ─── 시뮬레이션 제어 ───────────────────────────────────────────

  /** 총 시뮬레이션 시간 (ms) — S파가 maxPropagation 도달까지 */
  getTotalDurationMs() {
    return (this.maxPropagationM / this.effectiveSSpeed) * 1000
  }

  /** 시뮬레이션 완료 여부 */
  isSimulationComplete(elapsedMs) {
    return elapsedMs >= this.getTotalDurationMs()
  }
}
