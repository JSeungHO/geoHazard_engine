/** 강수 슬라이더 % → 대략적 mm/h (교육용 근사) */
export const rainIntensityToMmPerHour = (intensity) =>
  Math.round(intensity * 1.8)

/** 저지대 대비 침수 깊이 → 참고 문구 */
export const waterLevelHint = (meters) => {
  const depth = Number(meters)
  if (depth <= 0) return '저지대 기준 침수 없음'
  const subwayNote = depth >= 5 ? ' (지하철 1층 수준)' : ''
  return `저지대 대비 +${depth.toFixed(1)} m${subwayNote}`
}
