import { useEffect, useRef } from 'react'
import { DrainageNetworkModel } from '../../../physics/DrainageNetworkModel'
import { FLOOD_TIME_SCALE } from '../../../physics/UrbanPondingModel'
import { buildDrainageNetwork } from '../../../utils/drainageNetworkBuilder'
import { createDrainageLayer, loadDrainageGeometry, sampleGroundElevations } from './drainageLayer'

const TICK_MS = 100
const SUMMARY_INTERVAL_MS = 300

const getViewer = (viewerRef) => {
  const viewer = viewerRef.current
  if (!viewer || viewer.isDestroyed?.()) return null
  return viewer
}

/**
 * 추정 배수망 시뮬레이션 + 지도 표시. 렌더 결과는 없다(Cesium 프리미티브만 관리).
 *
 * @param {{
 *   viewerRef: import('react').RefObject<import('cesium').Viewer>,
 *   visible: boolean,
 *   rainfallMmH: number,
 *   inletClogging: number,
 *   designRainMmH: number,
 *   epoch: number,
 *   onStatusChange?: (status: { state: 'loading'|'sampling'|'ready'|'unavailable'|'error', message?: string, meta?: object }) => void,
 *   onSummaryChange?: (summary: object) => void,
 * }} props
 */
export default function DrainageNetworkLayer({
  viewerRef,
  visible,
  rainfallMmH,
  inletClogging,
  designRainMmH,
  epoch,
  onStatusChange,
  onSummaryChange,
}) {
  const cacheRef = useRef({ geometry: null, elevations: null })
  const modelRef = useRef(null)
  const layerRef = useRef(null)
  const liveRef = useRef({ rainfallMmH, visible, onStatusChange, onSummaryChange })

  useEffect(() => {
    liveRef.current = { rainfallMmH, visible, onStatusChange, onSummaryChange }
  }, [rainfallMmH, visible, onStatusChange, onSummaryChange])

  // 형상 로드 → 지면 고도 샘플링(1회 캐시) → 관망 구성 → 레이어 생성
  useEffect(() => {
    const viewer = getViewer(viewerRef)
    if (!viewer) return undefined
    let cancelled = false
    const report = (s) => !cancelled && liveRef.current.onStatusChange?.(s)

    const setup = async () => {
      const cache = cacheRef.current
      if (!cache.geometry) {
        report({ state: 'loading' })
        cache.geometry = await loadDrainageGeometry()
        if (!cache.geometry) {
          report({ state: 'unavailable', message: '배수망 데이터가 없습니다 (npm run data:drainage)' })
          return
        }
      }
      if (!cache.elevations) {
        report({ state: 'sampling' })
        cache.elevations = await sampleGroundElevations(viewer, cache.geometry.nodes)
      }
      if (cancelled || viewer.isDestroyed?.()) return

      const network = buildDrainageNetwork(cache.geometry, cache.elevations, { designRainMmH })
      modelRef.current = new DrainageNetworkModel(network, { inletClogging })
      layerRef.current?.destroy()
      layerRef.current = createDrainageLayer(viewer, network)
      layerRef.current.setVisible(liveRef.current.visible)
      viewer.scene.requestRender()
      report({
        state: 'ready',
        meta: {
          manholes: network.nodes.filter((n) => !n.isOutfall).length,
          links: network.links.length,
          outfalls: network.outfallIds.length,
          maxDiameterM: Math.max(...network.links.map((l) => l.diameterM)),
          attribution: cache.geometry.meta?.attribution,
        },
      })
      liveRef.current.onSummaryChange?.(modelRef.current.getSummary())
    }

    setup().catch((err) => {
      console.error('[DrainageNetworkLayer]', err)
      report({ state: 'error', message: '배수망을 불러오지 못했습니다' })
    })

    return () => {
      cancelled = true
      layerRef.current?.destroy()
      layerRef.current = null
      modelRef.current = null
    }
    // inletClogging은 아래 effect에서 모델에 직접 반영 — 관망 재구성 불필요
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerRef, designRainMmH, epoch])

  useEffect(() => {
    if (modelRef.current) modelRef.current.params.inletClogging = inletClogging
  }, [inletClogging])

  useEffect(() => {
    layerRef.current?.setVisible(visible)
    getViewer(viewerRef)?.scene.requestRender()
  }, [visible, viewerRef])

  // 시뮬레이션 루프 — 실제 경과 시간 × 배속으로 적분
  useEffect(() => {
    let last = performance.now()
    let lastSummary = 0
    const id = window.setInterval(() => {
      const now = performance.now()
      const realSeconds = Math.min((now - last) / 1000, 1)
      last = now
      const model = modelRef.current
      if (!model) return

      model.step(liveRef.current.rainfallMmH, realSeconds * FLOOD_TIME_SCALE, 5)
      if (liveRef.current.visible && layerRef.current?.update(model)) {
        getViewer(viewerRef)?.scene.requestRender()
      }
      if (now - lastSummary >= SUMMARY_INTERVAL_MS) {
        lastSummary = now
        liveRef.current.onSummaryChange?.(model.getSummary())
      }
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [viewerRef])

  return null
}
