import { haversineDistanceM } from '../../../physics/TsunamiWaveModel'
import { getCoastalSurgeBasis, getCoastalSurgeLayout } from '../constants/coastalSurgeLayout'

export const MIN_RUNUP_HEIGHT_M = 0.25
export const MIN_APPROACH_PROGRESS = 0.05

const METERS_PER_DEG_LAT = 111_320
const FAN_SEGMENTS = 8
const MAX_INLAND_BASE_M = 1200

const clamp01 = (value) => Math.min(Math.max(value, 0), 1)

const offsetByMeters = (lat, lon, northM, eastM) => {
  const cosLat = Math.cos((lat * Math.PI) / 180)
  return {
    lat: lat + northM / METERS_PER_DEG_LAT,
    lon: lon + eastM / (METERS_PER_DEG_LAT * Math.max(cosLat, 0.2)),
  }
}

const buildSurgeMaskFromCorners = (corners, seaPoint, inlandPoint, progress, waveHeightM) => {
  const padRatio = 0.06
  const lons = corners.map((c) => c.lon)
  const lats = corners.map((c) => c.lat)
  const lonSpan = Math.max(...lons) - Math.min(...lons)
  const latSpan = Math.max(...lats) - Math.min(...lats)
  const padLon = lonSpan * padRatio + 0.0008
  const padLat = latSpan * padRatio + 0.0008
  const west = Math.min(...lons) - padLon
  const east = Math.max(...lons) + padLon
  const south = Math.min(...lats) - padLat
  const north = Math.max(...lats) + padLat

  const toUV = (lat, lon) => ({
    u: (lon - west) / (east - west),
    v: (lat - south) / (north - south),
  })

  const seaUV = toUV(seaPoint.lat, seaPoint.lon)
  const inlandUV = toUV(inlandPoint.lat, inlandPoint.lon)

  return {
    type: 'surge',
    seaU: seaUV.u,
    seaV: seaUV.v,
    inlandU: inlandUV.u,
    inlandV: inlandUV.v,
    progress: clamp01(progress),
    crossRadius: 0.32 + Math.min(waveHeightM * 0.007, 0.16),
    feather: 0.055,
    bounds: { west, south, east, north },
  }
}

/**
 * 진원→연안 방향으로 전진하는 파면 corridor (진원에서 육지까지 한 줄기).
 */
export function buildInboundWaveCorridor(
  site,
  epicenter,
  ringRadiusM,
  spreadFactor,
  waveHeightM,
  reached
) {
  const spread = clamp01(spreadFactor)
  const {
    shorePoint,
    inlandNorth,
    inlandEast,
    crossNorth,
    crossEast,
  } = getCoastalSurgeBasis(site, epicenter)

  const distToCity = haversineDistanceM(epicenter.lat, epicenter.lon, site.lat, site.lon)
  const approach = distToCity > 0 ? Math.min(ringRadiusM / distToCity, 1.05) : 0

  const maxInlandM = MAX_INLAND_BASE_M + waveHeightM * 130
  const inlandReachM = reached ? maxInlandM * (0.04 + 0.96 * spread) : 0
  const bandLengthM = Math.min(32_000 + waveHeightM * 850, distToCity * 0.55)
  const crossHalfM = (700 + waveHeightM * 110) * (0.4 + 0.6 * Math.min(approach, 1))

  let frontM = Math.min(ringRadiusM, distToCity + inlandReachM)
  if (!reached) {
    frontM = Math.max(ringRadiusM * 0.88, ringRadiusM - 2000)
    frontM = Math.min(frontM, distToCity * 0.97)
  }
  const backM = Math.max(frontM - bandLengthM, ringRadiusM * 0.35, 0)

  const fromEpicenter = (alongM, crossM) => offsetByMeters(
    epicenter.lat,
    epicenter.lon,
    inlandNorth * alongM + crossNorth * crossM,
    inlandEast * alongM + crossEast * crossM
  )

  const corners = []

  for (let i = 0; i <= FAN_SEGMENTS; i += 1) {
    const u = (i / FAN_SEGMENTS) * 2 - 1
    const tailBow = 1 + 0.14 * (1 - u * u)
    corners.push(fromEpicenter(backM * tailBow, crossHalfM * u * 0.9))
  }

  for (let i = FAN_SEGMENTS; i >= 0; i -= 1) {
    const u = (i / FAN_SEGMENTS) * 2 - 1
    const frontCurve = 1 - 0.38 * u * u
    corners.push(fromEpicenter(frontM * frontCurve, crossHalfM * u * 0.68))
  }

  const seaPoint = fromEpicenter(backM, 0)
  const inlandPoint = fromEpicenter(frontM, 0)
  const shaderProgress = reached ? 0.08 + 0.92 * spread : Math.min(approach, 1) * 0.88

  return {
    id: site.id,
    corners,
    extrudedHeight: waveHeightM,
    posLat: shorePoint.lat,
    posLon: shorePoint.lon,
    spread,
    approach,
    reached,
    surgeMask: buildSurgeMaskFromCorners(corners, seaPoint, inlandPoint, shaderProgress, waveHeightM),
  }
}

/** @deprecated buildInboundWaveCorridor 사용 */
export const buildSurgeFan = buildInboundWaveCorridor
export const buildSurgeQuad = buildInboundWaveCorridor

/** 해안 wedge — 도시/해변 뷰에서 침수가 보이도록 shorePoint 기준 */
export function buildCoastalSurgeSite(site, epicenter, spreadFactor, waveHeightM, reached) {
  const layout = getCoastalSurgeLayout(site, epicenter, spreadFactor, waveHeightM)

  return {
    id: `${site.id}-shore`,
    corners: layout.corners,
    extrudedHeight: waveHeightM,
    posLat: layout.shorePoint.lat,
    posLon: layout.shorePoint.lon,
    spread: spreadFactor,
    reached,
    mode: 'shore',
    surgeMask: { ...layout.mask, bounds: layout.bounds },
  }
}

/**
 * @param {object} summary
 * @param {{ lat: number, lon: number }} epicenter
 */
export function buildRunupSites(summary, epicenter) {
  if (!summary || !epicenter) return []

  return summary.impacts.flatMap((impact) => {
    const heightM = impact.reached ? impact.waveHeightM : impact.travelWaveHeightM
    const progress = impact.approachProgress ?? 0
    if (progress < MIN_APPROACH_PROGRESS || heightM < MIN_RUNUP_HEIGHT_M * 0.45) {
      return []
    }

    const spread = impact.reached
      ? (impact.spreadFactor ?? 0)
      : progress * 0.4

    const corridor = buildInboundWaveCorridor(
      impact,
      epicenter,
      summary.ringRadiusM,
      spread,
      heightM,
      impact.reached
    )
    corridor.mode = 'corridor'

    const sites = [corridor]

    if (progress > 0.18 || impact.reached) {
      const shoreSpread = impact.reached
        ? Math.max(spread, 0.35)
        : Math.max(progress * 0.85, 0.2)
      sites.push(buildCoastalSurgeSite(
        impact,
        epicenter,
        shoreSpread,
        heightM,
        impact.reached
      ))
    }

    return sites
  })
}
