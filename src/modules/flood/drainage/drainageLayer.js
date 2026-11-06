/**
 * 배수망 Cesium 레이어 — 관로(PolylineCollection) · 맨홀(PointPrimitiveCollection)
 * 지면 고도를 이미 샘플링했으므로 지면 + 오프셋 높이에 직접 배치한다(clampToGround 미사용, 수천 개 갱신 비용 절감).
 */
import {
  Cartesian3,
  Cartographic,
  Color,
  Material,
  NearFarScalar,
  PointPrimitiveCollection,
  PolylineCollection,
  sampleTerrainMostDetailed,
} from 'cesium'
import { levelColor, linkLevel, linkWidthPx, nodeLevel, nodeSizePx } from './drainageStyle'

export const DRAINAGE_NETWORK_URL = '/data/gangnam-drainage-network.json'

/** 도로면 위로 띄우는 높이 (m) — 지형 메시와 z-fighting 방지 */
const SURFACE_OFFSET_M = 1.2

const COLORS = {}
const colorFor = (level) => (COLORS[level] ??= Color.fromCssColorString(levelColor(level)))

/** @returns {Promise<object|null>} 배수망 형상 JSON, 파일이 없으면 null */
export async function loadDrainageGeometry(url = DRAINAGE_NETWORK_URL) {
  const res = await fetch(url)
  if (!res.ok) return null
  const type = res.headers.get('content-type') ?? ''
  if (!type.includes('json')) return null // SPA fallback(index.html) 방지
  return res.json()
}

/**
 * Viewer의 지형이 실제 지형 공급자로 바뀔 때까지 대기.
 * Viewer는 처음에 평평한 EllipsoidTerrainProvider로 시작하고 Cesium World Terrain은 비동기로 붙는다.
 * 타일 가용성(availability)이 없는 공급자로는 sampleTerrainMostDetailed를 쓸 수 없다.
 */
export function waitForTerrainProvider(viewer, timeoutMs = 20_000) {
  const ready = () => Boolean(viewer.terrainProvider?.availability)
  if (ready()) return Promise.resolve(viewer.terrainProvider)

  return new Promise((resolve, reject) => {
    const started = performance.now()
    const id = window.setInterval(() => {
      if (viewer.isDestroyed?.()) {
        window.clearInterval(id)
        reject(new Error('viewer destroyed'))
      } else if (ready()) {
        window.clearInterval(id)
        resolve(viewer.terrainProvider)
      } else if (performance.now() - started > timeoutMs) {
        window.clearInterval(id)
        reject(new Error('지형 데이터가 준비되지 않았습니다 (Cesium Ion 토큰·네트워크 확인)'))
      }
    }, 200)
  })
}

/**
 * 노드 지면 고도 샘플링 (Cesium World Terrain 최고 해상도)
 * @returns {Promise<Float64Array>}
 */
export async function sampleGroundElevations(viewer, nodes, batchSize = 400) {
  const terrainProvider = await waitForTerrainProvider(viewer)
  const out = new Float64Array(nodes.length)
  for (let start = 0; start < nodes.length; start += batchSize) {
    const batch = nodes.slice(start, start + batchSize).map((n) => Cartographic.fromDegrees(n.lon, n.lat))
    const sampled = await sampleTerrainMostDetailed(terrainProvider, batch)
    sampled.forEach((c, i) => {
      out[start + i] = Number.isFinite(c.height) ? c.height : NaN
    })
  }
  // 샘플 실패 노드는 이웃 평균 대신 전체 중앙값으로 채움
  const valid = [...out].filter(Number.isFinite).sort((a, b) => a - b)
  const median = valid.length ? valid[valid.length >> 1] : 0
  for (let i = 0; i < out.length; i++) if (!Number.isFinite(out[i])) out[i] = median
  return out
}

/**
 * @param {import('cesium').Viewer} viewer
 * @param {{ nodes: Array, links: Array }} network buildDrainageNetwork 결과
 */
export function createDrainageLayer(viewer, network) {
  const lines = new PolylineCollection()
  const points = new PointPrimitiveCollection()
  const positionOf = new Map(
    network.nodes.map((n) => [n.id, Cartesian3.fromDegrees(n.lon, n.lat, n.groundElevM + SURFACE_OFFSET_M)]),
  )

  const linkPrims = network.links.map((link) =>
    lines.add({
      positions: [positionOf.get(link.from), positionOf.get(link.to)],
      width: linkWidthPx(link.diameterM),
      material: Material.fromType('Color', { color: colorFor('empty') }),
    }),
  )

  const scale = new NearFarScalar(200, 1.4, 4000, 0.5)
  const nodePrims = network.nodes.map((node) =>
    points.add({
      position: positionOf.get(node.id),
      pixelSize: node.isOutfall ? 10 : nodeSizePx('empty'),
      color: node.isOutfall ? Color.WHITE : colorFor('empty'),
      outlineColor: node.isOutfall ? colorFor('flowing') : Color.fromCssColorString('#0b0e12'),
      outlineWidth: node.isOutfall ? 3 : 1,
      scaleByDistance: scale,
    }),
  )

  viewer.scene.primitives.add(lines)
  viewer.scene.primitives.add(points)

  const linkLevels = new Array(linkPrims.length).fill('empty')
  const nodeLevels = new Array(nodePrims.length).fill('empty')

  return {
    /** @param {import('../../../physics/DrainageNetworkModel').DrainageNetworkModel} model */
    update(model) {
      let changed = false
      for (let k = 0; k < linkPrims.length; k++) {
        const level = linkLevel(model.getLinkState(k))
        if (level !== linkLevels[k]) {
          linkLevels[k] = level
          linkPrims[k].material.uniforms.color = colorFor(level)
          changed = true
        }
      }
      for (let i = 0; i < nodePrims.length; i++) {
        if (model.nodes[i].isOutfall) continue
        const level = nodeLevel(model.getNodeState(i))
        if (level !== nodeLevels[i]) {
          nodeLevels[i] = level
          nodePrims[i].color = colorFor(level)
          nodePrims[i].pixelSize = nodeSizePx(level)
          changed = true
        }
      }
      return changed
    },
    setVisible(visible) {
      lines.show = visible
      points.show = visible
    },
    destroy() {
      if (viewer.isDestroyed?.()) return
      viewer.scene.primitives.remove(lines)
      viewer.scene.primitives.remove(points)
    },
  }
}
