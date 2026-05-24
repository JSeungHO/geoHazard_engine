import {
  Cartesian3,
  ClassificationType,
  Color,
  HeightReference,
  PolygonHierarchy,
} from 'cesium'

export const RUNUP_ENTITY_PREFIX = 'tsunami-runup-'

/** Entity polygon용 — 커스텀 Material은 Entity에서 무시될 수 있음 */
const RUNUP_WATER_COLOR = Color.fromBytes(28, 142, 192, 238)
const RUNUP_OCEAN_COLOR = Color.fromBytes(22, 118, 178, 215)

/** 실제 파고(m) → 화면 수벽 높이 */
const VISUAL_WALL_SCALE = 2.4
const MIN_VISUAL_WALL_M = 6
/** 바다 구간 고정 수면 (타원체 기준 m) */
const SEA_SURFACE_M = 2

const quantize = (value, step) => Math.round(value / step) * step

const dedupeCorners = (corners) => {
  if (corners.length < 2) return corners

  const unique = [corners[0]]
  for (let i = 1; i < corners.length; i += 1) {
    const prev = unique[unique.length - 1]
    const cur = corners[i]
    if (
      Math.abs(prev.lat - cur.lat) > 1e-9
      || Math.abs(prev.lon - cur.lon) > 1e-9
    ) {
      unique.push(cur)
    }
  }

  const first = unique[0]
  const last = unique[unique.length - 1]
  if (
    unique.length > 2
    && Math.abs(first.lat - last.lat) < 1e-9
    && Math.abs(first.lon - last.lon) < 1e-9
  ) {
    unique.pop()
  }

  return unique.length >= 3 ? unique : corners
}

/** @param {object} site */
export function getRunupStateKey(site) {
  const cornerKey = (site.corners ?? [])
    .map((corner) => `${corner.lat.toFixed(4)},${corner.lon.toFixed(4)}`)
    .join(';')

  const mask = site.surgeMask ?? {}

  return [
    site.mode ?? 'corridor',
    quantize(site.extrudedHeight, 0.4),
    quantize(mask.progress ?? site.spread ?? 0, 0.04),
    cornerKey,
  ].join('|')
}

const getExtrusionM = (site) => {
  const waveM = site.extrudedHeight ?? 1
  if (site.mode === 'shore') {
    return Math.max(waveM * 0.95, 2.5)
  }
  if (site.reached) {
    return Math.max(waveM * 1.1, 4)
  }
  return Math.max(waveM * VISUAL_WALL_SCALE, MIN_VISUAL_WALL_M)
}

/** @param {import('cesium').Viewer} viewer @param {string} siteId */
const removeRunupEntity = (viewer, siteId) => {
  const entity = viewer.entities.getById(`${RUNUP_ENTITY_PREFIX}${siteId}`)
  if (entity) viewer.entities.remove(entity)
}

/**
 * 지형 추종 Entity — 육지 침수·연안 wedge (도시 뷰에서도 보임)
 * @param {import('cesium').Viewer} viewer
 * @param {object} site
 */
export function createRunupEntity(viewer, site) {
  const corners = dedupeCorners(site.corners ?? [])
  if (corners.length < 3) return null

  const entityId = `${RUNUP_ENTITY_PREFIX}${site.id}`
  removeRunupEntity(viewer, site.id)

  const positions = Cartesian3.fromDegreesArray(
    corners.flatMap((corner) => [corner.lon, corner.lat])
  )
  const extrusionM = getExtrusionM(site)
  const useTerrainFollow = site.mode === 'shore' || site.reached

  if (useTerrainFollow) {
    return viewer.entities.add({
      id: entityId,
      polygon: {
        hierarchy: new PolygonHierarchy(positions),
        material: RUNUP_WATER_COLOR,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        extrudedHeight: extrusionM,
        extrudedHeightReference: HeightReference.RELATIVE_TO_GROUND,
        classificationType: ClassificationType.BOTH,
        closeTop: true,
        closeBottom: false,
      },
    })
  }

  // 바다 접근 구간 — 고정 수면 높이 slab
  return viewer.entities.add({
    id: entityId,
    polygon: {
      hierarchy: new PolygonHierarchy(positions),
      material: RUNUP_OCEAN_COLOR,
      height: SEA_SURFACE_M,
      extrudedHeight: SEA_SURFACE_M + extrusionM,
      perPositionHeight: false,
      closeTop: true,
      closeBottom: false,
    },
  })
}

/** 연안 run-up — site별 Entity polygon, 변경 시에만 교체 */
export class TsunamiRunupPrimitiveLayer {
  /** @param {import('cesium').Viewer} viewer */
  constructor(viewer) {
    this.viewer = viewer
    /** @type {Map<string, { key: string }>} */
    this.sites = new Map()
  }

  /** @param {Array<object>} runupSites */
  sync(runupSites) {
    if (!this.viewer || this.viewer.isDestroyed?.()) return

    if (runupSites.length === 0) {
      this.clear()
      return
    }

    const activeIds = new Set(runupSites.map((site) => site.id))

    for (const [id] of this.sites) {
      if (activeIds.has(id)) continue
      removeRunupEntity(this.viewer, id)
      this.sites.delete(id)
    }

    for (const site of runupSites) {
      const key = getRunupStateKey(site)
      if (this.sites.get(site.id)?.key === key) continue

      removeRunupEntity(this.viewer, site.id)
      const entity = createRunupEntity(this.viewer, site)
      if (!entity) continue

      this.sites.set(site.id, { key })
    }

    this.viewer.scene.requestRender()
  }

  clear() {
    if (!this.viewer || this.viewer.isDestroyed?.()) {
      this.sites.clear()
      return
    }

    for (const [id] of this.sites) {
      removeRunupEntity(this.viewer, id)
    }
    this.sites.clear()
    this.viewer.scene.requestRender()
  }
}
