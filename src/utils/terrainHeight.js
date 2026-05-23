import { Cartographic, sampleTerrainMostDetailed } from 'cesium'
import { lonLatFromUV } from './floodViewBounds'

/** @typedef {import('./floodViewBounds').FloodBounds} FloodBounds */

/**
 * @typedef {object} TerrainHeightGrid
 * @property {Float32Array} heights
 * @property {number} resolution
 * @property {number} minHeight
 * @property {number} maxHeight
 * @property {number} validCount
 */

const gridStats = (heights) => {
  let minHeight = Infinity
  let maxHeight = -Infinity
  let validCount = 0

  for (let i = 0; i < heights.length; i++) {
    const h = heights[i]
    if (!Number.isFinite(h)) continue
    validCount += 1
    minHeight = Math.min(minHeight, h)
    maxHeight = Math.max(maxHeight, h)
  }

  if (validCount === 0) {
    return { minHeight: NaN, maxHeight: NaN, validCount: 0 }
  }

  return { minHeight, maxHeight, validCount }
}

/** @returns {TerrainHeightGrid} */
export function sampleTerrainHeightGrid(viewer, bounds, resolution) {
  const heights = new Float32Array(resolution * resolution)
  const globe = viewer.scene.globe

  for (let j = 0; j < resolution; j++) {
    for (let i = 0; i < resolution; i++) {
      const u = i / (resolution - 1)
      const v = j / (resolution - 1)
      const { lon, lat } = lonLatFromUV(bounds, u, v)
      const carto = Cartographic.fromDegrees(lon, lat)
      const sampled = globe.getHeight(carto)
      heights[j * resolution + i] = sampled ?? NaN
    }
  }

  const stats = gridStats(heights)

  return {
    heights,
    resolution,
    ...stats,
  }
}

/** 타일 로드 후 고정밀 지형 고도 재샘플 */
export async function refineTerrainHeightGrid(viewer, bounds, resolution) {
  if (!viewer || viewer.isDestroyed?.()) return null

  const terrainProvider = viewer.terrainProvider
  if (!terrainProvider) return null

  const cartographics = []
  for (let j = 0; j < resolution; j++) {
    for (let i = 0; i < resolution; i++) {
      const u = i / (resolution - 1)
      const v = j / (resolution - 1)
      const { lon, lat } = lonLatFromUV(bounds, u, v)
      cartographics.push(Cartographic.fromDegrees(lon, lat))
    }
  }

  try {
    const sampled = await sampleTerrainMostDetailed(terrainProvider, cartographics)
    const heights = new Float32Array(resolution * resolution)

    for (let i = 0; i < sampled.length; i++) {
      const h = sampled[i]?.height
      heights[i] = Number.isFinite(h) ? h : NaN
    }

    const stats = gridStats(heights)
    if (stats.validCount === 0) return null

    return {
      heights,
      resolution,
      ...stats,
    }
  } catch {
    return null
  }
}

/** @param {TerrainHeightGrid | null | undefined} grid */
export function getTerrainHeightAtCell(grid, resolution, i, j, fallback = 0) {
  if (!grid?.heights || grid.resolution !== resolution) return fallback
  const h = grid.heights[j * resolution + i]
  return Number.isFinite(h) ? h : fallback
}

/** 뷰 내 최저 지형 표고 — 침수는 여기서부터 채워짐 */
export function getFloodBaselineHeight(terrainGrid) {
  if (!terrainGrid?.heights?.length || terrainGrid.validCount === 0) return 0
  return Number.isFinite(terrainGrid.minHeight) ? terrainGrid.minHeight : 0
}

/** 저지대 기준 침수 깊이(m) → 절대 수면 고도(m) */
export function getFloodWaterSurfaceHeight(terrainGrid, floodDepthMeters) {
  return getFloodBaselineHeight(terrainGrid) + Math.max(0, floodDepthMeters)
}

/** 뷰 중심 지형 표고 (m). */
export function getTerrainHeightAtBounds(viewer, bounds) {
  const grid = sampleTerrainHeightGrid(viewer, bounds, 3)
  if (grid.validCount === 0) return 0
  const mid = Math.floor(grid.resolution / 2)
  return getTerrainHeightAtCell(grid, grid.resolution, mid, mid, 0)
}

/** UI 침수 깊이(m) → 타원체 절대 수면 고도(m) at center */
export function toAbsoluteWaterLevel(terrainBase, floodDepth) {
  return terrainBase + Math.max(0, floodDepth)
}

/** 저해상도 → 고해상도 보간 업샘플 */
export function upsampleTerrainGrid(srcGrid, targetRes) {
  const srcRes = srcGrid.resolution
  if (srcRes === targetRes) return srcGrid

  const heights = new Float32Array(targetRes * targetRes)

  for (let j = 0; j < targetRes; j++) {
    for (let i = 0; i < targetRes; i++) {
      const u = i / (targetRes - 1)
      const v = j / (targetRes - 1)
      const fu = u * (srcRes - 1)
      const fv = v * (srcRes - 1)
      const i0 = Math.floor(fu)
      const j0 = Math.floor(fv)
      const i1 = Math.min(srcRes - 1, i0 + 1)
      const j1 = Math.min(srcRes - 1, j0 + 1)
      const tx = fu - i0
      const ty = fv - j0
      const h00 = srcGrid.heights[j0 * srcRes + i0]
      const h10 = srcGrid.heights[j0 * srcRes + i1]
      const h01 = srcGrid.heights[j1 * srcRes + i0]
      const h11 = srcGrid.heights[j1 * srcRes + i1]
      const corners = [h00, h10, h01, h11].filter(Number.isFinite)
      if (corners.length === 0) {
        heights[j * targetRes + i] = NaN
      } else if (corners.length < 4) {
        heights[j * targetRes + i] = Math.min(...corners)
      } else {
        heights[j * targetRes + i] =
          h00 * (1 - tx) * (1 - ty) +
          h10 * tx * (1 - ty) +
          h01 * (1 - tx) * ty +
          h11 * tx * ty
      }
    }
  }

  const stats = gridStats(heights)
  return { heights, resolution: targetRes, ...stats }
}

/** UI 프리즈 방지 — 청크 단위로 양보하며 지형 샘플 */
export async function sampleTerrainHeightGridAsync(viewer, bounds, resolution) {
  if (!viewer || viewer.isDestroyed?.()) return null

  const heights = new Float32Array(resolution * resolution)
  const globe = viewer.scene.globe
  const chunkSize = 96

  for (let start = 0; start < heights.length; start += chunkSize) {
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    if (!viewer || viewer.isDestroyed?.()) return null

    const end = Math.min(start + chunkSize, heights.length)
    for (let linear = start; linear < end; linear++) {
      const j = Math.floor(linear / resolution)
      const i = linear % resolution
      const u = i / (resolution - 1)
      const v = j / (resolution - 1)
      const { lon, lat } = lonLatFromUV(bounds, u, v)
      const carto = Cartographic.fromDegrees(lon, lat)
      heights[linear] = globe.getHeight(carto) ?? NaN
    }
  }

  const stats = gridStats(heights)
  if (stats.validCount === 0) return null

  return { heights, resolution, ...stats }
}

/** @param {TerrainHeightGrid | null | undefined} a @param {TerrainHeightGrid | null | undefined} b */
export function terrainGridChanged(a, b, epsilon = 0.05) {
  if (!a || !b) return true
  if (a.resolution !== b.resolution || a.heights.length !== b.heights.length) return true

  for (let i = 0; i < a.heights.length; i++) {
    if (Math.abs(a.heights[i] - b.heights[i]) > epsilon) return true
  }

  return false
}
