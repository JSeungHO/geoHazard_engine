import { haversineDistanceM } from '../../../physics/TsunamiWaveModel'

/** @typedef {{ id: string, label: string, lat: number, lon: number, region: 'east' | 'south' | 'west', shoreOffset?: { northM?: number, eastM?: number } }} CoastalImpactPoint */

/** 한국 연안 피해 참조 지점 — 교육용 */
export const COASTAL_IMPACT_POINTS = [
  { id: 'gangneung', label: '강릉', lat: 37.752, lon: 128.876, region: 'east', shoreOffset: { northM: 180, eastM: 2100 } },
  { id: 'donghae', label: '동해', lat: 37.524, lon: 129.114, region: 'east' },
  { id: 'pohang', label: '포항', lat: 36.032, lon: 129.365, region: 'east', shoreOffset: { northM: -900, eastM: 1400 } },
  { id: 'ulsan', label: '울산', lat: 35.538, lon: 129.311, region: 'east', shoreOffset: { northM: -1100, eastM: 950 } },
  { id: 'busan', label: '부산', lat: 35.180, lon: 129.075, region: 'south' },
  { id: 'geoje', label: '거제', lat: 34.880, lon: 128.621, region: 'south' },
  { id: 'yeosu', label: '여수', lat: 34.760, lon: 127.662, region: 'south' },
  { id: 'mokpo', label: '목포', lat: 34.812, lon: 126.392, region: 'west' },
  { id: 'gunsan', label: '군산', lat: 35.968, lon: 126.737, region: 'west' },
  { id: 'incheon', label: '인천', lat: 37.456, lon: 126.705, region: 'west' },
  { id: 'taean', label: '태안', lat: 36.746, lon: 126.297, region: 'west' },
]

/** 쓰나미 모듈 기본 조망 (동해 연안) */
export const TSUNAMI_DEFAULT_VIEW = {
  lat: 36.3,
  lon: 129.2,
  cameraHeight: 650_000,
  cameraOrientation: {
    heading: 0,
    pitch: -1.22,
    roll: 0,
  },
}

/** 연안 침수 zone 반경 (약 2 km) */
export const COASTAL_FLOOD_HALF_SIZE_DEG = 0.018

/** @param {number} lat @param {number} lon @param {number} [halfSizeDeg] @param {number} [spreadFactor] */
export function getCoastalFloodBounds(
  lat,
  lon,
  halfSizeDeg = COASTAL_FLOOD_HALF_SIZE_DEG,
  spreadFactor = 1
) {
  const half = halfSizeDeg * (0.45 + 0.55 * Math.min(Math.max(spreadFactor, 0), 1))
  return {
    west: lon - half,
    south: lat - half,
    east: lon + half,
    north: lat + half,
    centerLon: lon,
    centerLat: lat,
    halfLon: half,
    halfLat: half,
  }
}

/**
 * 연안 침수 타원 마스크 — 사각 bounds 안에서 원/타원 형태로만 물을 렌더.
 * @param {number} waveHeightM
 * @param {'east' | 'south' | 'west' | undefined} region
 * @param {number} [spreadFactor]
 */
export function getCoastalFloodMask(waveHeightM = 5, region, spreadFactor = 1) {
  const spread = Math.min(Math.max(spreadFactor, 0), 1)
  const radius = Math.min(0.4 + waveHeightM * 0.007, 0.47) * (0.4 + 0.6 * spread)
  const feather = 0.11

  // 해안 방향으로 중심을 살짝 이동해 육지 쪽으로 밀물이 퍼지는 느낌
  if (region === 'east') {
    return { centerU: 0.54, centerV: 0.5, radiusU: radius, radiusV: radius * 0.78, feather }
  }
  if (region === 'west') {
    return { centerU: 0.46, centerV: 0.5, radiusU: radius, radiusV: radius * 0.78, feather }
  }
  if (region === 'south') {
    return { centerU: 0.5, centerV: 0.54, radiusU: radius * 0.88, radiusV: radius * 0.72, feather }
  }

  return { centerU: 0.5, centerV: 0.5, radiusU: radius, radiusV: radius * 0.85, feather }
}

const PRESET_REGION = {
  east_sea: 'east',
  yellow_sea: 'west',
  japan_west: 'south',
}

/**
 * @param {{ id?: string, lat: number, lon: number }} epicenter
 * @returns {CoastalImpactPoint[]}
 */
export function getImpactPointsForEpicenter(epicenter) {
  const region = PRESET_REGION[epicenter.id]
  if (region) {
    return COASTAL_IMPACT_POINTS.filter((point) => point.region === region)
  }

  return COASTAL_IMPACT_POINTS.map((point) => ({
    point,
    dist: haversineDistanceM(epicenter.lat, epicenter.lon, point.lat, point.lon),
  }))
    .filter(({ dist }) => dist <= 700_000)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 8)
    .map(({ point }) => point)
}
