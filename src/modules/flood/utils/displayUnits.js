/** 강우 슬라이더 최대값 (mm/h) — 2022.8.8 서울 최대 시우량 141.5 mm/h(동작구)를 포함하는 범위 */
export const RAINFALL_MAX_MMH = 150

/** 강우 강도(mm/h) → 강수 파티클·수면 파문 연출 강도(0~100) */
export const rainfallToVisualPercent = (rainfallMmH) =>
  Math.max(0, Math.min(100, (rainfallMmH / RAINFALL_MAX_MMH) * 100))

/**
 * 침수 깊이 → 인체 기준 비교 문구 (성인 평균 신체 치수 기준 근사)
 * 참고값: 2022.8.8 강남역 일대 침수흔적도 침수심 0.2~1.8 m
 */
export const waterLevelHint = (meters) => {
  const depth = Number(meters)
  if (depth <= 0) return '침수 없음'
  if (depth < 0.2) return '발목 높이 이하'
  if (depth < 0.5) return '무릎 아래 — 차량 하부 침수 시작'
  if (depth < 1.0) return '무릎~허리 높이 — 보행·차량 통행 위험'
  if (depth < 1.7) return '허리~가슴 높이 — 성인도 고립 위험'
  return '성인 키 이상'
}
