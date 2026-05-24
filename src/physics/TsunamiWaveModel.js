const EARTH_RADIUS_M = 6_371_000

/** 도달 후 파고 상승 시간 (실제 ms) */
const COASTAL_RAMP_MS = 14_000

/** 도달 후 연안 침수 반경 확대 시간 (실제 ms) */
const COASTAL_SPREAD_MS = 22_000

const easeOutCubic = (t) => 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 3

/** @param {number} elapsedMs @param {number} arrivalMs @param {number} durationMs */
export function getProgressAfterArrival(elapsedMs, arrivalMs, durationMs) {
  if (!Number.isFinite(arrivalMs) || elapsedMs <= arrivalMs) return 0
  return easeOutCubic((elapsedMs - arrivalMs) / durationMs)
}

/** 두 위경도 사이 거리 (미터) — Haversine */
export function haversineDistanceM(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

export class TsunamiWaveModel {
  /**
   * @param {object} opts
   * @param {{ lat: number, lon: number }} opts.epicenter
   * @param {number} [opts.waveSpeed] 기본 파속 m/s
   * @param {number} [opts.timeScale] 배속
   * @param {number} [opts.maxWaveHeight] 연안 최대 파고 m
   * @param {number} [opts.maxPropagationKm] 파면 최대 전파 거리 km
   */
  constructor(opts) {
    this.epicenter = opts.epicenter
    this.waveSpeed = opts.waveSpeed
    this.timeScale = opts.timeScale
    this.maxWaveHeight = opts.maxWaveHeight
    this.maxPropagationKm = opts.maxPropagationKm
  }

  get effectiveSpeed() {
    return this.waveSpeed * this.timeScale
  }

  get maxPropagationM() {
    return this.maxPropagationKm * 1000
  }

  /** 경과 실제 ms → ring 반경 (m), 최대 전파 거리 캡 */
  getRingRadius(elapsedMs) {
    const raw = this.effectiveSpeed * (elapsedMs / 1000)
    return Math.min(raw, this.maxPropagationM)
  }

  /** 진원 → 대상 지점까지 거리 (m) */
  distanceTo(lat, lon) {
    return haversineDistanceM(this.epicenter.lat, this.epicenter.lon, lat, lon)
  }

  /** 대상 지점 wave 도달 예상 시간 (실제 ms) */
  getArrivalMs(lat, lon) {
    const dist = this.distanceTo(lat, lon)
    if (dist > this.maxPropagationM) return Infinity
    return (dist / this.effectiveSpeed) * 1000
  }

  /** 거리 기반 피크 파고 — 가까울수록 높음 (교육용 단순 감쇠) */
  getPeakWaveHeightAtDistance(distanceM) {
    if (distanceM > this.maxPropagationM) return 0
    const ratio = 1 - distanceM / this.maxPropagationM
    return this.maxWaveHeight * (0.25 + 0.75 * ratio)
  }

  /**
   * 진원에서 연안으로 접근 중인 파면 높이 — shallow-water shoaling (가까울수록 커짐)
   */
  getTravelWaveHeight(ringRadiusM, targetLat, targetLon) {
    const distanceM = this.distanceTo(targetLat, targetLon)
    if (distanceM <= 0 || ringRadiusM <= 0 || ringRadiusM >= distanceM) return 0

    const approach = ringRadiusM / distanceM
    if (approach < 0.08) return 0

    const peak = this.getPeakWaveHeightAtDistance(distanceM)
    const shoaling = easeOutCubic(Math.min(approach / 0.95, 1))
    return peak * (0.18 + 0.82 * shoaling)
  }

  getApproachProgress(ringRadiusM, targetLat, targetLon) {
    const distanceM = this.distanceTo(targetLat, targetLon)
    if (distanceM <= 0) return 0
    return Math.min(ringRadiusM / distanceM, 1)
  }

  /**
   * 경과 ms + 연안 좌표 → 현재 파고 m (도달 후 점진 상승)
   */
  getCoastalWaveHeight(elapsedMs, targetLat, targetLon) {
    const arrivalMs = this.getArrivalMs(targetLat, targetLon)
    if (!Number.isFinite(arrivalMs) || elapsedMs < arrivalMs) return 0

    const distanceM = this.distanceTo(targetLat, targetLon)
    const peak = this.getPeakWaveHeightAtDistance(distanceM)
    const ramp = getProgressAfterArrival(elapsedMs, arrivalMs, COASTAL_RAMP_MS)
    return peak * ramp
  }

  /**
   * 연안 피해 반경 확산 (0.3→1.0) — 도달 후 남은 시간 동안 점점 넓어짐
   */
  getCoastalSpreadFactor(elapsedMs, targetLat, targetLon) {
    const arrivalMs = this.getArrivalMs(targetLat, targetLon)
    if (!Number.isFinite(arrivalMs) || elapsedMs < arrivalMs) return 0

    const spread = getProgressAfterArrival(elapsedMs, arrivalMs, COASTAL_SPREAD_MS)
    return 0.3 + 0.7 * spread
  }

  /** @deprecated 연안 피해 모델 — getCoastalWaveHeight 사용 */
  getWaterLevel(elapsedMs, targetLat, targetLon) {
    return this.getCoastalWaveHeight(elapsedMs, targetLat, targetLon)
  }

  /**
   * 연안 참조 지점별 피해 상태 + 전체 요약
   * @param {number} elapsedMs
   * @param {Array<{ id: string, label: string, lat: number, lon: number }>} points
   */
  getImpactSummary(elapsedMs, points) {
    const ringRadiusM = this.getRingRadius(elapsedMs)
    const impacts = points.map((point) => {
      const distanceM = this.distanceTo(point.lat, point.lon)
      const arrivalMs = this.getArrivalMs(point.lat, point.lon)
      const approachProgress = this.getApproachProgress(ringRadiusM, point.lat, point.lon)
      const reached = Number.isFinite(arrivalMs) && elapsedMs >= arrivalMs
      const travelWaveHeightM = reached
        ? 0
        : this.getTravelWaveHeight(ringRadiusM, point.lat, point.lon)
      const waveHeightM = reached
        ? this.getCoastalWaveHeight(elapsedMs, point.lat, point.lon)
        : 0
      const spreadFactor = reached
        ? this.getCoastalSpreadFactor(elapsedMs, point.lat, point.lon)
        : 0

      return {
        ...point,
        distanceM,
        distanceKm: distanceM / 1000,
        arrivalMs: Number.isFinite(arrivalMs) ? arrivalMs : null,
        approachProgress,
        reached,
        travelWaveHeightM,
        waveHeightM,
        spreadFactor,
      }
    })

    const affected = impacts.filter((item) => item.reached && item.waveHeightM >= 0.3)
    const finiteArrivals = impacts
      .map((item) => item.arrivalMs)
      .filter((ms) => ms != null)

    return {
      ringRadiusM,
      ringRadiusKm: ringRadiusM / 1000,
      affectedCount: affected.length,
      totalCoastalPoints: points.length,
      maxWaveHeightM: Math.max(0, ...impacts.map((item) => item.waveHeightM)),
      estimatedAreaKm2: Math.PI * (ringRadiusM / 1000) ** 2,
      firstArrivalMs: finiteArrivals.length > 0 ? Math.min(...finiteArrivals) : null,
      impacts,
    }
  }

  /** 시뮬 종료 시점 (ms) — 최대 전파 거리 도달 */
  getTotalDurationMs() {
    return (this.maxPropagationM / this.effectiveSpeed) * 1000
  }

  isSimulationComplete(elapsedMs) {
    return elapsedMs >= this.getTotalDurationMs()
  }
}
