/**
 * 배포용 GeoJSON 속성 정리.
 * QGIS 레이어 병합 시 생기는 `path`(작업자 로컬 파일 경로 — 개인 이름 포함 가능)와
 * `layer` 속성은 공개 데이터에 포함하지 않는다.
 */
export const STRIPPED_PROPERTIES = ['path', 'layer']

/** @param {import('geojson').Feature} feature */
export function sanitizeFeature(feature) {
  const properties = { ...(feature.properties ?? {}) }
  for (const key of STRIPPED_PROPERTIES) delete properties[key]
  return { ...feature, properties }
}
