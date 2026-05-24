/** 해안선 기준 오프셋 (도시 중심 → 진원 방향/바다, 미터) */
export const COAST_FROM_CITY_M = 3200
/** 해안선에서 바다쪽 sea edge (미터) */
export const SEA_OFFSHORE_DISTANCE_M = 1800

const METERS_PER_DEG_LAT = 111_320

const clamp01 = (value) => Math.min(Math.max(value, 0), 1)

const offsetByMeters = (lat, lon, northM, eastM) => {
  const cosLat = Math.cos((lat * Math.PI) / 180)
  return {
    lat: lat + northM / METERS_PER_DEG_LAT,
    lon: lon + eastM / (METERS_PER_DEG_LAT * Math.max(cosLat, 0.2)),
  }
}

const normalize2 = (north, east) => {
  const len = Math.hypot(north, east) || 1
  return { north: north / len, east: east / len }
}

/**
 * 진원→연안 파면 진행 방향 (바다=진원 쪽, 육지=연안 쪽).
 * @param {{ lat: number, lon: number, shoreOffset?: { northM?: number, eastM?: number } }} site
 * @param {{ lat: number, lon: number }} epicenter
 */
export function getCoastalSurgeBasis(site, epicenter) {
  const toSiteLat = site.lat - epicenter.lat
  const toSiteLon = site.lon - epicenter.lon
  const len = Math.hypot(toSiteLat, toSiteLon) || 1

  const inland = normalize2(toSiteLat / len, toSiteLon / len)
  const cross = normalize2(-inland.east, inland.north)

  const shoreOffset = site.shoreOffset ?? {}
  const shorePoint = offsetByMeters(
    site.lat,
    site.lon,
    -inland.north * COAST_FROM_CITY_M + (shoreOffset.northM ?? 0),
    -inland.east * COAST_FROM_CITY_M + (shoreOffset.eastM ?? 0)
  )

  return {
    shorePoint,
    inlandNorth: inland.north,
    inlandEast: inland.east,
    crossNorth: cross.north,
    crossEast: cross.east,
  }
}

const toUV = (lat, lon, west, south, east, north) => ({
  u: (lon - west) / (east - west),
  v: (lat - south) / (north - south),
})

/**
 * surge wedge UV 마스크 (진원→연안 축).
 */
export function getCoastalSurgeLayout(site, epicenter, spreadFactor = 1, waveHeightM = 5) {
  const {
    shorePoint,
    inlandNorth,
    inlandEast,
    crossNorth,
    crossEast,
  } = getCoastalSurgeBasis(site, epicenter)

  const spread = clamp01(spreadFactor)
  const inlandReachM = (1200 + waveHeightM * 130) * (0.08 + 0.92 * spread)
  const seaReachM = SEA_OFFSHORE_DISTANCE_M
  const crossReachM = 900 + waveHeightM * 18

  const sample = (inlandM, crossM) => offsetByMeters(
    shorePoint.lat,
    shorePoint.lon,
    inlandNorth * inlandM + crossNorth * crossM,
    inlandEast * inlandM + crossEast * crossM
  )

  const points = [
    sample(inlandReachM, 0),
    sample(inlandReachM, crossReachM),
    sample(inlandReachM, -crossReachM),
    sample(0, 0),
    sample(0, crossReachM),
    sample(0, -crossReachM),
    sample(-seaReachM, 0),
  ]

  const pad = crossReachM * 0.25
  const west = Math.min(...points.map((p) => p.lon)) - pad / (METERS_PER_DEG_LAT * 0.75)
  const east = Math.max(...points.map((p) => p.lon)) + pad / (METERS_PER_DEG_LAT * 0.75)
  const south = Math.min(...points.map((p) => p.lat)) - pad / METERS_PER_DEG_LAT
  const north = Math.max(...points.map((p) => p.lat)) + pad / METERS_PER_DEG_LAT

  const seaPoint = sample(-seaReachM, 0)
  const inlandPoint = sample(inlandReachM, 0)
  const seaUV = toUV(seaPoint.lat, seaPoint.lon, west, south, east, north)
  const inlandUV = toUV(inlandPoint.lat, inlandPoint.lon, west, south, east, north)

  return {
    bounds: {
      west,
      south,
      east,
      north,
      centerLon: (west + east) / 2,
      centerLat: (south + north) / 2,
      halfLon: (east - west) / 2,
      halfLat: (north - south) / 2,
    },
    corners: points,
    mask: {
      type: 'surge',
      seaU: seaUV.u,
      seaV: seaUV.v,
      inlandU: inlandUV.u,
      inlandV: inlandUV.v,
      progress: 0.06 + 0.94 * spread,
      crossRadius: 0.34 + Math.min(waveHeightM * 0.006, 0.14),
      feather: 0.055,
    },
    seaAnchor: seaPoint,
    inlandFront: inlandPoint,
    shorePoint,
  }
}

/** @param {{ lat: number, lon: number, region?: string }} site @param {{ lat: number, lon: number }} epicenter */
export function getSeaAnchor(site, epicenter) {
  const { shorePoint, inlandNorth, inlandEast } = getCoastalSurgeBasis(site, epicenter)
  return offsetByMeters(
    shorePoint.lat,
    shorePoint.lon,
    -inlandNorth * SEA_OFFSHORE_DISTANCE_M,
    -inlandEast * SEA_OFFSHORE_DISTANCE_M
  )
}

/**
 * 해안에서 바다를 바라보는 카메라 (실제 쓰나미 영상 POV — 해안가에서 거대 파면 접근).
 * lookAt = 바다 쪽, 카메라는 육지(heading) 방향에 배치됨.
 * @param {{ lat: number, lon: number }} site
 * @param {{ lat: number, lon: number }} epicenter
 */
export function getCoastalWaveCamera(site, epicenter) {
  const { shorePoint, inlandNorth, inlandEast } = getCoastalSurgeBasis(site, epicenter)
  const lookAt = offsetByMeters(
    shorePoint.lat,
    shorePoint.lon,
    -inlandNorth * 2800,
    -inlandEast * 2800
  )
  const headingDeg = ((Math.atan2(inlandEast, inlandNorth) * 180) / Math.PI + 360) % 360

  return {
    lat: lookAt.lat,
    lon: lookAt.lon,
    headingDeg,
    pitchDeg: -9,
    range: 2400,
  }
}
