import { describe, expect, it } from 'vitest'
import { STANDARD_DIAMETERS_M, buildDrainageNetwork, sizePipe } from './drainageNetworkBuilder.js'
import { DrainageNetworkModel, fullPipeCapacity } from '../physics/DrainageNetworkModel.js'

/**
 * 5×5 격자 도로망 (간격 50 m). 서쪽(x=0)으로 갈수록 낮아지는 지형.
 * 노드 id: g{x}{y}
 */
function gridGeometry() {
  const nodes = []
  const links = []
  for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 5; y++) {
      nodes.push({ id: `g${x}${y}`, lon: 127 + x * 0.00057, lat: 37.5 + y * 0.00045, inletCount: 4, catchmentAreaM2: 2500 })
      if (x > 0) links.push({ id: `h${x}${y}`, a: `g${x - 1}${y}`, b: `g${x}${y}`, lengthM: 50 })
      if (y > 0) links.push({ id: `v${x}${y}`, a: `g${x}${y - 1}`, b: `g${x}${y}`, lengthM: 50 })
    }
  }
  return { nodes, links, meta: { bbox: { west: 127, south: 37.5, east: 127.0023, north: 37.5018 } } }
}

const elevationsFor = (geom) => geom.nodes.map((n) => 20 + (n.lon - 127) * 20_000) // 서→동 상승

describe('buildDrainageNetwork', () => {
  const geom = gridGeometry()
  const net = buildDrainageNetwork(geom, elevationsFor(geom), { outfallCount: 1 })

  it('방류구는 가장 낮은 서쪽 경계에 놓인다', () => {
    expect(net.outfallIds).toHaveLength(1)
    expect(net.outfallIds[0].startsWith('g0')).toBe(true)
  })

  it('수지상(트리): 방류구를 뺀 모든 노드가 하류 링크를 정확히 하나 갖는다', () => {
    const downCount = new Map()
    for (const l of net.links) downCount.set(l.from, (downCount.get(l.from) ?? 0) + 1)
    for (const node of net.nodes) {
      expect(downCount.get(node.id) ?? 0).toBe(node.isOutfall ? 0 : 1)
    }
    expect(net.links).toHaveLength(net.nodes.length - 1)
  })

  it('하류로 갈수록 관저고가 낮아진다 (최소 경사 이상)', () => {
    const byId = new Map(net.nodes.map((n) => [n.id, n]))
    for (const l of net.links) {
      const slope = (byId.get(l.from).invertElevM - byId.get(l.to).invertElevM) / l.lengthM
      expect(slope).toBeGreaterThanOrEqual(0.003 - 1e-9)
    }
  })

  it('하류 관경은 상류 관경 이상이며 방류구 쪽 관이 가장 크다', () => {
    const outLinks = net.links.filter((l) => net.outfallIds.includes(l.to))
    const maxD = Math.max(...net.links.map((l) => l.diameterM))
    expect(Math.max(...outLinks.map((l) => l.diameterM))).toBe(maxD)
    const downOf = new Map(net.links.map((l) => [l.from, l]))
    for (const l of net.links) {
      const next = downOf.get(l.to)
      if (next) expect(next.diameterM).toBeGreaterThanOrEqual(l.diameterM)
    }
  })

  it('설계 강우 이하에서는 넘치지 않고, 2배 강우에서는 역류가 생긴다', () => {
    const run = (rain) => {
      const model = new DrainageNetworkModel(net)
      for (let t = 0; t < 3600; t += 10) model.step(rain, 10)
      return model.getSummary()
    }
    expect(run(40).overflowingManholes).toBe(0)
    expect(run(150).surfaceVolumeM3).toBeGreaterThan(0)
  })
})

describe('sizePipe', () => {
  it('설계 유량을 감당하는 최소 표준 관경', () => {
    const d = sizePipe(1.0, 0.005)
    expect(fullPipeCapacity(d, 0.005)).toBeGreaterThanOrEqual(1.0)
    const idx = STANDARD_DIAMETERS_M.indexOf(d)
    if (idx > 0) expect(fullPipeCapacity(STANDARD_DIAMETERS_M[idx - 1], 0.005)).toBeLessThan(1.0)
  })
})
