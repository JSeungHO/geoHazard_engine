/**
 * DrainageNetworkModel.js
 * 우수 배수망(빗물받이 → 맨홀 → 관로 → 방류구) 집중형 수리 모델 — 교육용
 *
 * 각 맨홀(노드)은 저류조, 관로(링크)는 두 노드의 수두차로 흐르는 통로로 본다.
 *
 *   유입     Q_rain  = C · i · A_catch                         (노드별 집수 면적)
 *   포획     Q_inlet = min(지표 유량, 빗물받이 용량 × (1 − 막힘률))
 *   관로     Q       = Q_full · √(ΔH / (S·L))  (ΔH: 상·하류 수두차, Q_full: Manning 만관 유량)
 *   저류     dV/dt   = Σ유입 − Σ유출,  수위 h = f(V)
 *   역류     h > 지면 − 관저고 → 초과분이 맨홀에서 지표로 넘침 (surcharge)
 *
 * 노드 저류 면적: 관로가 비어 있을 때는 맨홀 단면 + 연결 관로 절반의 평면 면적,
 * 관정(管頂) 위로는 맨홀 단면만 남아 수위가 급격히 오른다 — 만관 시 수위 급상승을 표현.
 *
 * 상세 가정·한계: docs/model.md §1.5
 */

/** 관로 조도계수 n — 콘크리트·흄관 일반값 */
export const MANNING_N = 0.013

/** 맨홀 단면적 (m²) — 지름 약 1.2 m 원형 맨홀 */
export const MANHOLE_AREA_M2 = 1.1

/** 관저 흙덮이 (m) — 지면에서 관 상단까지 (하수도 설계기준 최소 1 m 내외) */
export const DEFAULT_COVER_DEPTH_M = 1.2

/** 빗물받이 1개 포획 용량 (m³/s) — 격자형 빗물받이 일반 처리량 근사 */
export const INLET_CAPACITY_M3S = 0.02

/** 지표 담수 면적 비율 — 노드 집수 면적 중 물이 고이는 도로·저지대 비율 */
export const PONDING_AREA_FRACTION = 0.25

const SQRT_EPS = 0.01

/**
 * 원형관 만관 유량 (m³/s) — Manning 식
 * @param {number} diameterM
 * @param {number} slope 경사 (m/m)
 */
export function fullPipeCapacity(diameterM, slope, n = MANNING_N) {
  const area = (Math.PI * diameterM ** 2) / 4
  const hydraulicRadius = diameterM / 4
  return (area * hydraulicRadius ** (2 / 3) * Math.sqrt(Math.max(slope, 1e-4))) / n
}

/**
 * 원형관 부분 수심 유량비 Q/Q_full 근사 (y/D 0~1).
 * 실제 곡선은 y/D≈0.94에서 최대 1.07이지만, 단순화를 위해 단조 증가 곡선 사용.
 */
export function partialFlowRatio(depthRatio) {
  const r = Math.max(0, Math.min(1, depthRatio))
  return r ** 1.6 * (3 - 2 * r) ** 0.2
}

/**
 * @typedef {object} DrainageNodeDef
 * @property {string} id
 * @property {number} groundElevM   지면 표고 (m)
 * @property {number} [invertElevM] 관저고 (m). 생략 시 지면 − 흙덮이 − 최대 연결 관경
 * @property {number} catchmentAreaM2 노드로 모이는 집수 면적 (m²)
 * @property {number} inletCount     빗물받이 개수
 * @property {boolean} [isOutfall]   방류구 (수위 고정)
 * @property {number} [lon]
 * @property {number} [lat]
 *
 * @typedef {object} DrainageLinkDef
 * @property {string} id
 * @property {string} from 상류 노드 id
 * @property {string} to   하류 노드 id
 * @property {number} lengthM
 * @property {number} diameterM
 */

/**
 * @typedef {object} DrainageParams
 * @property {number} runoffCoefficient 유출계수 C
 * @property {number} inletClogging     빗물받이 막힘률 0~1
 * @property {number} outfallStageM     방류구(하천) 수위 — 관저고 기준 (m)
 */
export const DRAINAGE_DEFAULTS = {
  runoffCoefficient: 0.85,
  inletClogging: 0.3,
  outfallStageM: 0,
}

export class DrainageNetworkModel {
  /**
   * @param {{ nodes: DrainageNodeDef[], links: DrainageLinkDef[] }} network
   * @param {Partial<DrainageParams>} [params]
   */
  constructor(network, params = {}) {
    this.params = { ...DRAINAGE_DEFAULTS, ...params }
    this.nodes = network.nodes.map((n) => ({ ...n }))
    this.links = network.links.map((l) => ({ ...l }))
    this.nodeIndex = new Map(this.nodes.map((n, i) => [n.id, i]))

    // 노드별 최대 연결 관경 → 관저고·관정 높이
    const maxDiameter = new Float64Array(this.nodes.length)
    const pipePlanArea = new Float64Array(this.nodes.length)
    for (const link of this.links) {
      const a = this.nodeIndex.get(link.from)
      const b = this.nodeIndex.get(link.to)
      if (a == null || b == null) throw new Error(`link ${link.id}: unknown node`)
      link.fromIdx = a
      link.toIdx = b
      maxDiameter[a] = Math.max(maxDiameter[a], link.diameterM)
      maxDiameter[b] = Math.max(maxDiameter[b], link.diameterM)
      pipePlanArea[a] += 0.5 * link.lengthM * link.diameterM
      pipePlanArea[b] += 0.5 * link.lengthM * link.diameterM
    }

    this.nodes.forEach((node, i) => {
      node.crownDepthM = maxDiameter[i] || 0.6
      node.invertElevM ??= node.groundElevM - DEFAULT_COVER_DEPTH_M - node.crownDepthM
      node.maxDepthM = node.groundElevM - node.invertElevM
      node.pipeStorageAreaM2 = pipePlanArea[i]
      node.pondingAreaM2 = Math.max(50, node.catchmentAreaM2 * PONDING_AREA_FRACTION)
    })

    for (const link of this.links) {
      const up = this.nodes[link.fromIdx]
      const down = this.nodes[link.toIdx]
      link.slope = Math.max(1e-4, (up.invertElevM - down.invertElevM) / link.lengthM)
      link.capacityM3s = fullPipeCapacity(link.diameterM, link.slope)
      // ΔH = S·L 일 때 Q = Q_full 이 되도록 하는 전달 계수
      link.conveyance = link.capacityM3s / Math.sqrt(link.slope * link.lengthM)
    }

    this.reset()
  }

  reset() {
    const n = this.nodes.length
    this.nodeVolume = new Float64Array(n) // 관·맨홀 내 저류량 (m³)
    this.surfaceVolume = new Float64Array(n) // 지표 담수량 (m³)
    this.nodeDepth = new Float64Array(n) // 관저 기준 수위 (m)
    this.overflowRate = new Float64Array(n) // 맨홀 역류 유량 (m³/s)
    this.linkFlow = new Float64Array(this.links.length) // (m³/s)
    this.totalOutflowM3 = 0
    this.totalRainM3 = 0
    this.elapsedS = 0
  }

  /** 노드 저류량 → 관저 기준 수위 */
  depthFromVolume(i, volume) {
    const node = this.nodes[i]
    const lowerArea = MANHOLE_AREA_M2 + node.pipeStorageAreaM2
    const lowerVolume = lowerArea * node.crownDepthM
    if (volume <= lowerVolume) return volume / lowerArea
    return node.crownDepthM + (volume - lowerVolume) / MANHOLE_AREA_M2
  }

  /** 관저 기준 수위 → 노드 저류량 */
  volumeFromDepth(i, depth) {
    const node = this.nodes[i]
    const lowerArea = MANHOLE_AREA_M2 + node.pipeStorageAreaM2
    if (depth <= node.crownDepthM) return depth * lowerArea
    return lowerArea * node.crownDepthM + (depth - node.crownDepthM) * MANHOLE_AREA_M2
  }

  /** 수위 1 m 변화에 필요한 저류량 (현재 수위에서의 저류 면적) */
  storageArea(i) {
    const node = this.nodes[i]
    return this.nodeDepth[i] < node.crownDepthM
      ? MANHOLE_AREA_M2 + node.pipeStorageAreaM2
      : MANHOLE_AREA_M2
  }

  head(i) {
    const node = this.nodes[i]
    if (node.isOutfall) return node.invertElevM + this.params.outfallStageM
    return node.invertElevM + this.nodeDepth[i]
  }

  /**
   * 시뮬레이션 진행.
   * @param {number} rainfallMmH 강우 강도 (mm/h)
   * @param {number} simSeconds 진행 시간 (s)
   * @param {number} [maxSubstepS=2] 안정성을 위한 최대 내부 스텝 (s)
   */
  step(rainfallMmH, simSeconds, maxSubstepS = 2) {
    const steps = Math.max(1, Math.ceil(simSeconds / maxSubstepS))
    const dt = simSeconds / steps
    for (let s = 0; s < steps; s++) this.#substep(rainfallMmH, dt)
  }

  #substep(rainfallMmH, dt) {
    const { runoffCoefficient, inletClogging } = this.params
    const rainMs = Math.max(0, rainfallMmH) / 1000 / 3600
    const nodes = this.nodes
    const inflow = new Float64Array(nodes.length)

    // 1) 강우 → 지표, 지표 → 빗물받이
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const rainVolume = runoffCoefficient * rainMs * node.catchmentAreaM2 * dt
      this.totalRainM3 += rainVolume
      this.surfaceVolume[i] += rainVolume
      if (node.isOutfall) continue

      const inletCapacity = node.inletCount * INLET_CAPACITY_M3S * (1 - inletClogging)
      // 맨홀이 지면까지 차 있으면 빗물받이로 들어갈 수 없다
      const room = this.volumeFromDepth(i, node.maxDepthM) - this.nodeVolume[i]
      const captured = Math.max(0, Math.min(this.surfaceVolume[i], inletCapacity * dt, room))
      this.surfaceVolume[i] -= captured
      inflow[i] += captured
    }

    // 2) 관로 흐름 — 수두차 구동, 만관 통수능·가용 저류량으로 제한
    for (let k = 0; k < this.links.length; k++) {
      const link = this.links[k]
      const a = link.fromIdx
      const b = link.toIdx
      const dH = this.head(a) - this.head(b)
      const up = dH >= 0 ? a : b
      const absH = Math.abs(dH)

      // 수두차 구동 유량 (ΔH→0 근처는 선형화해 수치 진동 방지)
      let q = link.conveyance * (absH / Math.sqrt(Math.max(absH, SQRT_EPS)))
      // 자유수면 흐름: 상류 수심이 관경보다 낮으면 부분 수심 유량을 넘을 수 없다
      const upDepth = nodes[up].isOutfall ? this.params.outfallStageM : this.nodeDepth[up]
      if (upDepth < link.diameterM) {
        q = Math.min(q, link.capacityM3s * partialFlowRatio(upDepth / link.diameterM))
      }
      // 한 스텝에 수두차를 뒤집지 않도록 제한 (양 노드 수위 균형점까지만)
      const areaA = nodes[a].isOutfall ? 1e9 : this.storageArea(a)
      const areaB = nodes[b].isOutfall ? 1e9 : this.storageArea(b)
      const equalize = (absH * areaA * areaB) / (areaA + areaB) / dt
      // 상류 저류량 이상은 보낼 수 없음
      const available = nodes[up].isOutfall ? Infinity : this.nodeVolume[up] / dt
      q = Math.max(0, Math.min(q, equalize, available))

      const signed = dH >= 0 ? q : -q
      this.linkFlow[k] = signed
      inflow[a] -= signed * dt
      inflow[b] += signed * dt
    }

    // 3) 저류 갱신·역류
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      if (node.isOutfall) {
        this.totalOutflowM3 += Math.max(0, inflow[i])
        this.overflowRate[i] = 0
        continue
      }
      let volume = Math.max(0, this.nodeVolume[i] + inflow[i])
      const maxVolume = this.volumeFromDepth(i, node.maxDepthM)
      let overflow = 0
      if (volume > maxVolume) {
        overflow = volume - maxVolume
        volume = maxVolume
        this.surfaceVolume[i] += overflow
      }
      this.overflowRate[i] = overflow / dt
      this.nodeVolume[i] = volume
      this.nodeDepth[i] = this.depthFromVolume(i, volume)
    }

    this.elapsedS += dt
  }

  // ─── 조회 ────────────────────────────────────────────────────

  /** 노드 상태 — 수위비(관저~지면), 역류 여부, 지표 담수심 */
  getNodeState(i) {
    const node = this.nodes[i]
    return {
      id: node.id,
      depthM: this.nodeDepth[i],
      fillRatio: node.isOutfall ? 0 : Math.min(1, this.nodeDepth[i] / node.maxDepthM),
      surcharged: !node.isOutfall && this.nodeDepth[i] >= node.crownDepthM,
      overflowing: this.overflowRate[i] > 1e-4,
      overflowRateM3s: this.overflowRate[i],
      surfaceDepthM: this.surfaceVolume[i] / node.pondingAreaM2,
    }
  }

  /** 관로 상태 — 충수율(관경 대비 수심), 유량비, 만관 여부 */
  getLinkState(k) {
    const link = this.links[k]
    const depthUp = this.nodeDepth[link.fromIdx]
    const depthDown = this.nodes[link.toIdx].isOutfall ? this.params.outfallStageM : this.nodeDepth[link.toIdx]
    const meanDepth = (depthUp + depthDown) / 2
    return {
      id: link.id,
      fillRatio: Math.min(1, meanDepth / link.diameterM),
      flowRatio: Math.abs(this.linkFlow[k]) / link.capacityM3s,
      flowM3s: this.linkFlow[k],
      surcharged: depthUp >= link.diameterM && depthDown >= link.diameterM,
    }
  }

  /** 전체 요약 */
  getSummary() {
    let surcharged = 0
    let overflowing = 0
    let surface = 0
    let stored = 0
    let overflowRate = 0
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.nodes[i].isOutfall) continue
      const st = this.getNodeState(i)
      if (st.surcharged) surcharged += 1
      if (st.overflowing) overflowing += 1
      overflowRate += st.overflowRateM3s
      surface += this.surfaceVolume[i]
      stored += this.nodeVolume[i]
    }
    let fullLinks = 0
    for (let k = 0; k < this.links.length; k++) if (this.getLinkState(k).surcharged) fullLinks += 1
    const manholes = this.nodes.filter((n) => !n.isOutfall).length
    return {
      manholeCount: manholes,
      linkCount: this.links.length,
      surchargedManholes: surcharged,
      overflowingManholes: overflowing,
      fullLinks,
      overflowRateM3s: overflowRate,
      surfaceVolumeM3: surface,
      pipeVolumeM3: stored,
      outflowM3: this.totalOutflowM3,
      rainM3: this.totalRainM3,
    }
  }
}
