import { describe, expect, it } from 'vitest'
import {
  MANHOLE_SPACING_M,
  buildDrainageGeometry,
  distanceM,
  waysFromOverpass,
} from './lib/drainageGeometry.js'

// 위도 37.5°에서 경도 0.001° ≈ 88.4 m, 위도 0.001° ≈ 111.2 m
const BBOX = { west: 127.0, south: 37.5, east: 127.01, north: 37.51 }

/** 십자 교차로: 동서 도로(primary)와 남북 도로(residential)가 중앙에서 만남 */
const CROSS = [
  { id: 1, highway: 'primary', coords: [[127.001, 37.505], [127.005, 37.505], [127.009, 37.505]] },
  { id: 2, highway: 'residential', coords: [[127.005, 37.501], [127.005, 37.505], [127.005, 37.509]] },
  { id: 3, highway: 'footway', coords: [[127.002, 37.502], [127.003, 37.503]] },
]

describe('buildDrainageGeometry', () => {
  const geom = buildDrainageGeometry(CROSS, BBOX)

  it('보도(footway)는 배수망에서 제외', () => {
    const totalCross = distanceM([127.001, 37.505], [127.009, 37.505]) + distanceM([127.005, 37.501], [127.005, 37.509])
    expect(geom.totalRoadLengthM).toBeCloseTo(totalCross, 0)
  })

  it('교차점은 하나의 맨홀로 공유된다', () => {
    const center = geom.nodes.filter((n) => Math.abs(n.lon - 127.005) < 1e-9 && Math.abs(n.lat - 37.505) < 1e-9)
    expect(center).toHaveLength(1)
    const degree = geom.links.filter((l) => l.a === center[0].id || l.b === center[0].id).length
    expect(degree).toBe(4)
  })

  it('맨홀 간격은 기준 이하', () => {
    for (const link of geom.links) expect(link.lengthM).toBeLessThanOrEqual(MANHOLE_SPACING_M + 1e-6)
  })

  it('링크가 없는 고립 노드가 없다', () => {
    const used = new Set(geom.links.flatMap((l) => [l.a, l.b]))
    for (const n of geom.nodes) expect(used.has(n.id)).toBe(true)
  })

  it('집수 면적 합 = 대상 영역 면적', () => {
    const sum = geom.nodes.reduce((s, n) => s + n.catchmentAreaM2, 0)
    expect(sum).toBeCloseTo(geom.areaM2, 0)
  })

  it('양측 도로(primary)에 빗물받이가 더 많이 배정된다', () => {
    const inletsOn = (cls) => {
      const ids = new Set(geom.links.filter((l) => l.roadClass === cls).flatMap((l) => [l.a, l.b]))
      return geom.nodes.filter((n) => ids.has(n.id) && !(n.lon === 127.005 && n.lat === 37.505))
        .reduce((s, n) => s + n.inletCount, 0)
    }
    expect(inletsOn('primary')).toBeGreaterThan(inletsOn('residential'))
  })

  it('영역 밖 좌표는 잘라낸다', () => {
    const outside = buildDrainageGeometry([{ id: 9, highway: 'primary', coords: [[126.9, 37.4], [126.91, 37.41]] }], BBOX)
    expect(outside.links).toHaveLength(0)
  })
})

describe('waysFromOverpass', () => {
  it('way 요소의 geometry를 [lon, lat]로 변환', () => {
    const ways = waysFromOverpass({
      elements: [
        { type: 'way', id: 5, tags: { highway: 'primary' }, geometry: [{ lat: 37.5, lon: 127 }, { lat: 37.51, lon: 127.01 }] },
        { type: 'node', id: 6 },
      ],
    })
    expect(ways).toEqual([{ id: 5, highway: 'primary', coords: [[127, 37.5], [127.01, 37.51]] }])
  })
})
