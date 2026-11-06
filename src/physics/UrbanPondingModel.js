/**
 * UrbanPondingModel.js
 * 도시 저지대 담수(ponding) 집중형 모델 — 교육용
 *
 * 저지대(강남역 일대처럼 주변보다 낮은 분지)를 하나의 저류조로 보고,
 * 상류 집수 유역에서 들어오는 유출량과 하수관로 배수능의 차이만큼 수위가 변한다고 가정한다.
 *
 *   유입 강도  q_in  = C · i                     (합리식, mm/h)
 *   초과 강도  q_ex  = q_in − D                  (D: 유효 배수능, mm/h)
 *   수위 변화  dh/dt = q_ex · R / 1000           (m/h, R: 집수비 = 유역 면적 / 담수 면적)
 *
 * q_ex < 0 이면 남은 배수 여유만큼 담수가 빠진다.
 * 상세 가정·출처·보정 근거: docs/model.md §1
 */

/** 기본 파라미터 */
export const PONDING_DEFAULTS = {
  /** 유출계수 C — 상업·업무지역 합리식 일반 범위 0.70~0.95의 중간값 */
  runoffCoefficient: 0.85,
  /**
   * 유효 배수능 D (mm/h) — 하수관로·빗물받이가 실제로 처리하는 강우 강도.
   * 서울시 방재성능목표(2022년 이전 95 mm/h)보다 낮게 작동한 사례
   * (2012년 개선 공사 후에도 55.5 mm/h에 침수)를 근거로 50 mm/h로 가정.
   */
  drainageCapacityMmH: 50,
  /**
   * 집수비 R — 2022.8.8 강남역 사례로 보정:
   * 첨두 강우 116 mm/h가 1시간 지속될 때 최저 지점 침수심이 실측 최대 1.8 m가 되도록
   *   R = 1800 / (0.85 × 116 − 50) ≈ 37
   */
  catchmentRatio: 37,
}

/** 시뮬레이션 배속 — 실제 1초에 60초(1분) 진행 */
export const FLOOD_TIME_SCALE = 60

/** 수위 상한 (m) — 도시 침수 표현 범위 */
export const MAX_PONDING_DEPTH_M = 5

/**
 * 담수 수위 변화율 (m/h). 양수면 상승, 음수면 배수.
 * @param {number} rainfallMmH 강우 강도 (mm/h)
 * @param {Partial<typeof PONDING_DEFAULTS>} [params]
 */
export function getPondingRateMPerHour(rainfallMmH, params = {}) {
  const { runoffCoefficient, drainageCapacityMmH, catchmentRatio } = { ...PONDING_DEFAULTS, ...params }
  const inflow = runoffCoefficient * Math.max(0, rainfallMmH)
  return ((inflow - drainageCapacityMmH) * catchmentRatio) / 1000
}

/**
 * 수위 적분 1스텝.
 * @param {number} depthM 현재 담수 수위 (m)
 * @param {number} rainfallMmH 강우 강도 (mm/h)
 * @param {number} simSeconds 진행할 시뮬레이션 시간 (s)
 * @param {Partial<typeof PONDING_DEFAULTS>} [params]
 * @returns {number} 다음 수위 (m, 0 ~ MAX_PONDING_DEPTH_M)
 */
export function stepPondingDepth(depthM, rainfallMmH, simSeconds, params = {}) {
  const rate = getPondingRateMPerHour(rainfallMmH, params)
  const next = depthM + (rate * simSeconds) / 3600
  return Math.max(0, Math.min(MAX_PONDING_DEPTH_M, next))
}

/** 침수가 시작되는 최소 강우 강도 (mm/h) = D / C */
export function getFloodingThresholdMmH(params = {}) {
  const { runoffCoefficient, drainageCapacityMmH } = { ...PONDING_DEFAULTS, ...params }
  return drainageCapacityMmH / runoffCoefficient
}
