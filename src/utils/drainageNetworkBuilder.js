/**
 * 추정 배수망 형상 + 지면 고도 → DrainageNetworkModel 입력
 *
 * 1. 방류구: 대상 영역 경계 부근에서 지면이 가장 낮은 노드 (반포천 방향 저지대)
 * 2. 흐름 방향: 방류구에서 시작하는 최단 경로 트리(Dijkstra). 오르막으로 흐르는 구간에는
 *    가중치를 크게 주어 가능한 한 지형을 따라 내려가도록 한다 → 수지상(나뭇가지형) 우수관망
 * 3. 관경: 상류 집수 면적을 누적해 합리식 설계 유량 Q = C·I·A 를 만관으로 흘릴 수 있는
 *    최소 표준 관경 선택
 * 4. 관저고: 지면 − 흙덮이 − 관경, 하류로 갈수록 최소 경사 이상 낮아지도록 보정
 *
 * 상세 가정: docs/model.md §1.5
 */
import { DEFAULT_COVER_DEPTH_M, fullPipeCapacity } from '../physics/DrainageNetworkModel.js'

/** 표준 원형관 관경 (m) — 우수관 일반 규격 */
export const STANDARD_DIAMETERS_M = [0.45, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.35, 1.5, 1.65, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0]

/** 관로 최소 경사 — 자정 유속 확보 */
export const MIN_SLOPE = 0.003

export const BUILDER_DEFAULTS = {
  /** 관로 설계 강우 강도 (mm/h) — 과거 서울시 우수관 10년 빈도 설계 수준으로 가정 */
  designRainMmH: 75,
  runoffCoefficient: 0.85,
  /** 방류구 수 */
  outfallCount: 2,
  /** 오르막 흐름 1 m당 추가 가중 거리 (m) */
  uphillPenaltyM: 200,
}

class MinHeap {
  constructor() { this.items = [] }
  push(item) {
    const a = this.items
    a.push(item)
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p][0] <= a[i][0]) break
      ;[a[p], a[i]] = [a[i], a[p]]
      i = p
    }
  }
  pop() {
    const a = this.items
    const top = a[0]
    const last = a.pop()
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < a.length && a[l][0] < a[m][0]) m = l
        if (r < a.length && a[r][0] < a[m][0]) m = r
        if (m === i) break
        ;[a[m], a[i]] = [a[i], a[m]]
        i = m
      }
    }
    return top
  }
  get size() { return this.items.length }
}

/** 설계 유량을 만관으로 흘릴 수 있는 최소 표준 관경 */
export function sizePipe(designFlowM3s, slope) {
  for (const d of STANDARD_DIAMETERS_M) if (fullPipeCapacity(d, slope) >= designFlowM3s) return d
  return STANDARD_DIAMETERS_M[STANDARD_DIAMETERS_M.length - 1]
}

/**
 * @param {{ nodes: Array<{id:string, lon:number, lat:number, inletCount:number, catchmentAreaM2:number}>,
 *           links: Array<{id:string, a:string, b:string, lengthM:number}>,
 *           meta?: { bbox?: {west:number,south:number,east:number,north:number} } }} geometry
 * @param {ArrayLike<number>} groundElevations geometry.nodes 순서의 지면 표고 (m)
 * @param {Partial<typeof BUILDER_DEFAULTS>} [options]
 */
export function buildDrainageNetwork(geometry, groundElevations, options = {}) {
  const opts = { ...BUILDER_DEFAULTS, ...options }
  const n = geometry.nodes.length
  const index = new Map(geometry.nodes.map((node, i) => [node.id, i]))
  const ground = Float64Array.from(groundElevations)

  // 인접 리스트
  const adj = Array.from({ length: n }, () => [])
  geometry.links.forEach((link) => {
    const a = index.get(link.a)
    const b = index.get(link.b)
    adj[a].push([b, link])
    adj[b].push([a, link])
  })

  // 1) 방류구 — 경계 10% 띠 안의 노드 중 최저 지면 (연결 요소마다 최소 1개)
  const bbox = geometry.meta?.bbox
  const nearEdge = (node) => {
    if (!bbox) return true
    const mx = (bbox.east - bbox.west) * 0.1
    const my = (bbox.north - bbox.south) * 0.1
    return node.lon < bbox.west + mx || node.lon > bbox.east - mx || node.lat < bbox.south + my || node.lat > bbox.north - my
  }
  const component = new Int32Array(n).fill(-1)
  let components = 0
  for (let s = 0; s < n; s++) {
    if (component[s] >= 0) continue
    const stack = [s]
    component[s] = components
    while (stack.length) {
      const u = stack.pop()
      for (const [v] of adj[u]) if (component[v] < 0) { component[v] = components; stack.push(v) }
    }
    components++
  }
  const outfalls = new Set()
  for (let c = 0; c < components; c++) {
    const members = [...Array(n).keys()].filter((i) => component[i] === c)
    const edge = members.filter((i) => nearEdge(geometry.nodes[i]))
    const pool = (edge.length ? edge : members).sort((x, y) => ground[x] - ground[y])
    const count = c === 0 || members.length > 50 ? opts.outfallCount : 1
    pool.slice(0, count).forEach((i) => outfalls.add(i))
  }

  // 2) 흐름 트리 — 방류구에서 역방향 Dijkstra
  const dist = new Float64Array(n).fill(Infinity)
  const downstream = new Int32Array(n).fill(-1)
  const downLink = new Array(n).fill(null)
  const heap = new MinHeap()
  for (const o of outfalls) { dist[o] = 0; heap.push([0, o]) }
  while (heap.size) {
    const [d, v] = heap.pop()
    if (d > dist[v]) continue
    for (const [u, link] of adj[v]) {
      // u → v 로 흐른다고 할 때의 비용 (v가 더 높으면 오르막)
      const uphill = Math.max(0, ground[v] - ground[u])
      const cost = d + link.lengthM + uphill * opts.uphillPenaltyM
      if (cost < dist[u]) {
        dist[u] = cost
        downstream[u] = v
        downLink[u] = link
        heap.push([cost, u])
      }
    }
  }

  // 3) 상류 → 하류 순서 (방류구까지 거리 내림차순)로 집수 면적 누적·관경 설계
  const order = [...Array(n).keys()].filter((i) => Number.isFinite(dist[i])).sort((a, b) => dist[b] - dist[a])
  const upstreamArea = Float64Array.from(geometry.nodes, (node) => node.catchmentAreaM2)
  const designSlope = new Float64Array(n)
  const diameter = new Float64Array(n)
  for (const u of order) {
    const v = downstream[u]
    if (v < 0) continue
    const link = downLink[u]
    designSlope[u] = Math.max(MIN_SLOPE, (ground[u] - ground[v]) / link.lengthM)
    const q = (opts.runoffCoefficient * (opts.designRainMmH / 1000 / 3600)) * upstreamArea[u]
    diameter[u] = sizePipe(q, designSlope[u])
    upstreamArea[v] += upstreamArea[u]
  }
  // 하류 관경이 상류보다 작아지지 않도록 (order는 상류 → 하류 순)
  for (const u of order) {
    const v = downstream[u]
    if (v >= 0 && downstream[v] >= 0) diameter[v] = Math.max(diameter[v], diameter[u])
  }

  // 4) 관저고 — 상류부터 내려가며 최소 경사 확보
  const maxD = new Float64Array(n)
  for (let u = 0; u < n; u++) {
    if (downstream[u] >= 0) {
      maxD[u] = Math.max(maxD[u], diameter[u])
      maxD[downstream[u]] = Math.max(maxD[downstream[u]], diameter[u])
    }
  }
  const invert = Float64Array.from(ground, (g, i) => g - DEFAULT_COVER_DEPTH_M - (maxD[i] || 0.6))
  for (const u of order) {
    const v = downstream[u]
    if (v < 0) continue
    invert[v] = Math.min(invert[v], invert[u] - MIN_SLOPE * downLink[u].lengthM)
  }

  const nodes = geometry.nodes
    .map((node, i) => ({
      id: node.id,
      lon: node.lon,
      lat: node.lat,
      groundElevM: ground[i],
      invertElevM: invert[i],
      catchmentAreaM2: node.catchmentAreaM2,
      upstreamAreaM2: upstreamArea[i],
      inletCount: node.inletCount,
      isOutfall: outfalls.has(i),
    }))
    .filter((_, i) => Number.isFinite(dist[i]))

  const links = []
  for (let u = 0; u < n; u++) {
    const v = downstream[u]
    if (v < 0) continue
    links.push({
      id: downLink[u].id,
      from: geometry.nodes[u].id,
      to: geometry.nodes[v].id,
      lengthM: downLink[u].lengthM,
      diameterM: diameter[u],
      roadClass: downLink[u].roadClass,
    })
  }

  return { nodes, links, outfallIds: [...outfalls].map((i) => geometry.nodes[i].id) }
}
