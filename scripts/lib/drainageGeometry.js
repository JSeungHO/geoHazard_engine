/**
 * OSM 도로망 → 추정 배수망 형상 (맨홀 노드 · 관로 링크 · 빗물받이 · 집수 면적)
 *
 * 실제 하수관로 위치 자료는 공개되지 않아, 우수관이 도로 아래에 매설된다는 일반 원칙에 따라
 * 도로 중심선을 관로 경로로 가정한다. 고도·흐름 방향·관경은 실행 시 지형 고도로 정한다
 * (src/utils/drainageNetworkBuilder.js).
 */

/** 맨홀 최대 간격 (m) — 하수도시설기준의 관경별 최대 간격(600 mm 이하 75 m)보다 촘촘하게 가정 */
export const MANHOLE_SPACING_M = 50

/** 빗물받이 간격 (m) — 도로 한쪽 기준 */
export const INLET_SPACING_M = 25

/** 도로 등급별 빗물받이 설치 측면 수 */
export const INLET_SIDES = {
  trunk: 2,
  primary: 2,
  secondary: 2,
  tertiary: 2,
  unclassified: 1,
  residential: 1,
  living_street: 1,
}

export const DRAINAGE_ROAD_CLASSES = Object.keys(INLET_SIDES)

const EARTH_RADIUS_M = 6_371_000
const toRad = (d) => (d * Math.PI) / 180

/** 두 [lon, lat] 사이 거리 (m) */
export function distanceM(a, b) {
  const dLat = toRad(b[1] - a[1])
  const dLon = toRad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

/** bbox 면적 (m²) */
export function bboxAreaM2(bbox) {
  const width = distanceM([bbox.west, (bbox.south + bbox.north) / 2], [bbox.east, (bbox.south + bbox.north) / 2])
  const height = distanceM([bbox.west, bbox.south], [bbox.west, bbox.north])
  return width * height
}

const keyOf = ([lon, lat]) => `${lon.toFixed(7)},${lat.toFixed(7)}`

const inBBox = ([lon, lat], b) => lon >= b.west && lon <= b.east && lat >= b.south && lat <= b.north

/** 폴리라인을 누적 거리 d 지점에서 보간 */
function pointAt(coords, cumulative, d) {
  let i = 1
  while (i < cumulative.length - 1 && cumulative[i] < d) i++
  const segLen = cumulative[i] - cumulative[i - 1] || 1
  const t = (d - cumulative[i - 1]) / segLen
  const a = coords[i - 1]
  const b = coords[i]
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

/**
 * @typedef {{ id: string|number, highway: string, coords: [number, number][] }} RoadWay
 * @typedef {{ id: string, lon: number, lat: number, inletCount: number, catchmentAreaM2: number, roadLengthM: number }} GeomNode
 * @typedef {{ id: string, a: string, b: string, lengthM: number, roadClass: string }} GeomLink
 */

/**
 * @param {RoadWay[]} ways
 * @param {{ west: number, south: number, east: number, north: number }} bbox
 * @returns {{ nodes: GeomNode[], links: GeomLink[], totalRoadLengthM: number, areaM2: number }}
 */
export function buildDrainageGeometry(ways, bbox) {
  const roads = ways
    .filter((w) => INLET_SIDES[w.highway] != null)
    .map((w) => ({ ...w, coords: w.coords.filter((c) => inBBox(c, bbox)) }))
    .filter((w) => w.coords.length >= 2)

  // 1) 교차점 탐지 — 두 개 이상의 도로가 공유하거나 도로 끝점인 좌표
  const usage = new Map()
  for (const road of roads) {
    road.coords.forEach((c, i) => {
      const k = keyOf(c)
      const isEnd = i === 0 || i === road.coords.length - 1
      usage.set(k, (usage.get(k) ?? 0) + (isEnd ? 2 : 1))
    })
  }
  const isVertex = (c) => (usage.get(keyOf(c)) ?? 0) >= 2

  /** @type {Map<string, GeomNode>} */
  const nodes = new Map()
  const links = []
  let interpolated = 0

  const nodeAt = (c, forcedKey) => {
    const k = forcedKey ?? keyOf(c)
    if (!nodes.has(k)) {
      nodes.set(k, { id: `n${nodes.size}`, lon: c[0], lat: c[1], inletCount: 0, catchmentAreaM2: 0, roadLengthM: 0 })
    }
    return nodes.get(k)
  }

  const addLink = (a, b, lengthM, road) => {
    if (a === b || lengthM < 0.5) return
    links.push({ id: `l${links.length}`, a: a.id, b: b.id, lengthM, roadClass: road.highway })
    const inlets = (lengthM / INLET_SPACING_M) * INLET_SIDES[road.highway]
    for (const n of [a, b]) {
      n.inletCount += inlets / 2
      n.roadLengthM += lengthM / 2
    }
  }

  // 2) 교차점 사이 구간을 맨홀 간격으로 분할
  for (const road of roads) {
    let start = 0
    for (let i = 1; i < road.coords.length; i++) {
      if (!isVertex(road.coords[i]) && i !== road.coords.length - 1) continue
      const part = road.coords.slice(start, i + 1)
      const cumulative = [0]
      for (let j = 1; j < part.length; j++) cumulative.push(cumulative[j - 1] + distanceM(part[j - 1], part[j]))
      const total = cumulative[cumulative.length - 1]
      const pieces = Math.max(1, Math.ceil(total / MANHOLE_SPACING_M))

      let prev = nodeAt(part[0])
      for (let p = 1; p <= pieces; p++) {
        const next = p === pieces
          ? nodeAt(part[part.length - 1])
          : nodeAt(pointAt(part, cumulative, (total * p) / pieces), `i${interpolated++}`)
        addLink(prev, next, total / pieces, road)
        prev = next
      }
      start = i
    }
  }

  // 3) 집수 면적 — 대상 영역 면적을 노드별 인접 도로 길이 비율로 배분
  const areaM2 = bboxAreaM2(bbox)
  const totalRoadLengthM = links.reduce((sum, l) => sum + l.lengthM, 0)
  const nodeList = [...nodes.values()]
  for (const n of nodeList) {
    n.catchmentAreaM2 = totalRoadLengthM > 0 ? (areaM2 * n.roadLengthM) / totalRoadLengthM : 0
    n.inletCount = Math.max(1, Math.round(n.inletCount))
  }

  return { nodes: nodeList, links, totalRoadLengthM, areaM2 }
}

/** Overpass `out geom` 응답 → RoadWay[] */
export function waysFromOverpass(json) {
  return (json.elements ?? [])
    .filter((el) => el.type === 'way' && el.geometry && el.tags?.highway)
    .map((el) => ({ id: el.id, highway: el.tags.highway, coords: el.geometry.map((g) => [g.lon, g.lat]) }))
}
