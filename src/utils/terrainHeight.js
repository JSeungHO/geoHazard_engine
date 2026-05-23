import { Cartographic } from 'cesium'

/** @typedef {import('./floodViewBounds').FloodBounds} FloodBounds */

/** 뷰 중심 지형 표고 (m, WGS84). 타일 미로드 시 0. */
export function getTerrainHeightAtBounds(viewer, bounds) {
  if (!viewer || viewer.isDestroyed?.()) return 0

  const carto = Cartographic.fromDegrees(bounds.centerLon, bounds.centerLat)
  const height = viewer.scene.globe.getHeight(carto)

  return height ?? 0
}

/** UI 침수 깊이(m) → 타원체 절대 수면 고도(m) */
export function toAbsoluteWaterLevel(terrainBase, floodDepth) {
  return terrainBase + Math.max(0, floodDepth)
}
