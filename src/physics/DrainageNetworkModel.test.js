import { describe, expect, it } from 'vitest'
import {
  DrainageNetworkModel,
  fullPipeCapacity,
  partialFlowRatio,
} from './DrainageNetworkModel.js'

/**
 * 테스트용 직선 배수망: M1 → M2 → M3 → M4 → OUT
 * 지면은 하류로 갈수록 낮아지고(경사 0.5%), M3이 가장 큰 집수 면적을 갖는다.
 */
function chainNetwork({ diameterM = 0.8, catchment = 20_000, inlets = 12 } = {}) {
  const ids = ['M1', 'M2', 'M3', 'M4']
  const nodes = ids.map((id, i) => ({
    id,
    groundElevM: 30 - i * 0.5,
    catchmentAreaM2: id === 'M3' ? catchment * 2 : catchment,
    inletCount: inlets,
  }))
  nodes.push({ id: 'OUT', groundElevM: 26, invertElevM: 23, catchmentAreaM2: 0, inletCount: 0, isOutfall: true })
  const links = [
    { id: 'L1', from: 'M1', to: 'M2', lengthM: 100, diameterM },
    { id: 'L2', from: 'M2', to: 'M3', lengthM: 100, diameterM },
    { id: 'L3', from: 'M3', to: 'M4', lengthM: 100, diameterM },
    { id: 'L4', from: 'M4', to: 'OUT', lengthM: 100, diameterM: diameterM * 1.25 },
  ]
  return { nodes, links }
}

const run = (model, rain, seconds) => {
  for (let t = 0; t < seconds; t += 10) model.step(rain, 10)
  return model.getSummary()
}

const massError = (model) => {
  const s = model.getSummary()
  return Math.abs(s.rainM3 - (s.surfaceVolumeM3 + s.pipeVolumeM3 + s.outflowM3)) / Math.max(1, s.rainM3)
}

describe('관로 수리 공식', () => {
  it('Manning 만관 유량: D 1 m, S 0.5% → 약 1.69 m³/s', () => {
    expect(fullPipeCapacity(1, 0.005)).toBeCloseTo(1.695, 2)
  })

  it('부분 수심 유량비는 0→1 단조 증가', () => {
    expect(partialFlowRatio(0)).toBe(0)
    expect(partialFlowRatio(1)).toBeCloseTo(1, 6)
    let prev = 0
    for (let r = 0.05; r <= 1; r += 0.05) {
      const v = partialFlowRatio(r)
      expect(v).toBeGreaterThan(prev)
      prev = v
    }
  })
})

describe('DrainageNetworkModel', () => {
  it('약한 비: 만관·역류 없이 방류구로 배수', () => {
    const model = new DrainageNetworkModel(chainNetwork({ diameterM: 1.2 }))
    const s = run(model, 20, 3600)
    expect(s.surchargedManholes).toBe(0)
    expect(s.overflowingManholes).toBe(0)
    expect(s.outflowM3).toBeGreaterThan(0)
  })

  it('물질 수지 보존 (강우 = 지표 + 관내 + 방류)', () => {
    const model = new DrainageNetworkModel(chainNetwork({ diameterM: 0.6 }))
    run(model, 116, 3600)
    expect(massError(model)).toBeLessThan(1e-6)
  })

  it('관경이 작으면 집중호우에 만관 후 맨홀 역류', () => {
    const model = new DrainageNetworkModel(chainNetwork({ diameterM: 0.4 }))
    const s = run(model, 116, 3600)
    expect(s.surchargedManholes).toBeGreaterThan(0)
    expect(s.overflowingManholes).toBeGreaterThan(0)
    expect(s.surfaceVolumeM3).toBeGreaterThan(0)
  })

  it('하류가 막히면(방류구 고수위) 상류까지 수위가 오른다 — 배수 영향', () => {
    const free = new DrainageNetworkModel(chainNetwork({ diameterM: 0.8 }))
    // 방류구 수위 = 관저 23 m + 5 m = 28 m (M4 지면 28.5 m 직전) — 하천 고수위 상황
    const backwater = new DrainageNetworkModel(chainNetwork({ diameterM: 0.8 }), { outfallStageM: 5 })
    run(free, 60, 1800)
    run(backwater, 60, 1800)
    for (const id of ['M4', 'M3']) {
      const i = free.nodeIndex.get(id)
      expect(backwater.nodeDepth[i]).toBeGreaterThan(free.nodeDepth[i])
    }
  })

  it('빗물받이 막힘률이 높을수록 지표에 남는 물이 많다', () => {
    const clean = new DrainageNetworkModel(chainNetwork({ inlets: 4 }), { inletClogging: 0 })
    const clogged = new DrainageNetworkModel(chainNetwork({ inlets: 4 }), { inletClogging: 0.8 })
    run(clean, 80, 1800)
    run(clogged, 80, 1800)
    expect(clogged.getSummary().surfaceVolumeM3).toBeGreaterThan(clean.getSummary().surfaceVolumeM3)
  })

  it('비가 그치면 관내 저류와 지표 담수가 빠진다', () => {
    const model = new DrainageNetworkModel(chainNetwork({ diameterM: 0.5 }))
    run(model, 116, 1800)
    const peak = model.getSummary()
    run(model, 0, 7200)
    const after = model.getSummary()
    expect(after.pipeVolumeM3 + after.surfaceVolumeM3).toBeLessThan(peak.pipeVolumeM3 + peak.surfaceVolumeM3)
    expect(after.overflowingManholes).toBe(0)
  })

  it('수치 안정성: 수위가 음수가 되거나 지면을 넘지 않는다', () => {
    const model = new DrainageNetworkModel(chainNetwork({ diameterM: 0.4 }))
    for (let t = 0; t < 3600; t += 30) {
      model.step(150, 30)
      model.nodes.forEach((node, i) => {
        if (node.isOutfall) return
        expect(model.nodeDepth[i]).toBeGreaterThanOrEqual(0)
        expect(model.nodeDepth[i]).toBeLessThanOrEqual(node.maxDepthM + 1e-9)
      })
    }
  })
})
