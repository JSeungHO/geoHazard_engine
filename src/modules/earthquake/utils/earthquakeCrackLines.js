/**
 * earthquakeCrackLines.js — 지표 균열 라인 Entity (교육용)
 * 참조: earthquake-plan.md Phase 4
 */

import {
  Cartesian3,
  Color,
} from 'cesium'

const CRACK_PREFIX = 'eq-crack-'
const CRACK_COUNT = 7
const MIN_MMI = 6

/** 진앙에서 방사형 균열 end point (degrees) */
export function buildCrackEndpoints(epicenter, maxMMI, lengthKm = null) {
  const len = lengthKm ?? Math.min(35, 8 + maxMMI * 2.5)
  const lenDeg = len / 111

  return Array.from({ length: CRACK_COUNT }, (_, i) => {
    const angle = (i / CRACK_COUNT) * Math.PI * 2 + 0.15
    return {
      id: `${CRACK_PREFIX}${i}`,
      endLat: epicenter.lat + Math.sin(angle) * lenDeg,
      endLon: epicenter.lon + Math.cos(angle) * lenDeg * 1.15,
    }
  })
}

function removeCrackLines(viewer) {
  viewer.entities.values
    .filter((e) => String(e.id).startsWith(CRACK_PREFIX))
    .forEach((e) => viewer.entities.remove(e))
}

/**
 * @param {import('cesium').Viewer} viewer
 * @param {{ lat: number, lon: number }} epicenter
 * @param {{ maxMMI: number, sRadiusM: number, type?: string }} options
 * @param {{ visible?: boolean }} [cache]
 */
export function syncCrackLines(viewer, epicenter, options = {}, cache = {}) {
  if (!viewer || viewer.isDestroyed?.()) return

  const { maxMMI = 0, sRadiusM = 0, type = 'main' } = options
  const shouldShow = type === 'main' && maxMMI >= MIN_MMI && sRadiusM > 20_000

  if (!shouldShow) {
    if (cache.visible) {
      removeCrackLines(viewer)
      cache.visible = false
    }
    return
  }

  if (cache.visible && cache.maxMMI === maxMMI) return

  removeCrackLines(viewer)

  const endpoints = buildCrackEndpoints(epicenter, maxMMI)
  const alpha = Math.min(0.85, 0.45 + (maxMMI - MIN_MMI) * 0.08)

  endpoints.forEach(({ id, endLat, endLon }) => {
    viewer.entities.add({
      id,
      polyline: {
        positions: Cartesian3.fromDegreesArray([
          epicenter.lon, epicenter.lat,
          endLon, endLat,
        ]),
        width: 2.5,
        material: Color.fromCssColorString('#3d2817').withAlpha(alpha),
        clampToGround: true,
      },
    })
  })

  cache.visible = true
  cache.maxMMI = maxMMI
}

export function clearCrackLines(viewer, cache = {}) {
  if (!viewer || viewer.isDestroyed?.()) return
  removeCrackLines(viewer)
  cache.visible = false
  cache.maxMMI = 0
}
