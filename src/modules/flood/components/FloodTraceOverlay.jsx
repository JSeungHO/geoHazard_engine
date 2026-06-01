import { useEffect } from 'react'
import { scenarioShowsFloodTrace } from '../constants/floodTraceData'
import { loadFloodTraceOverlay, removeFloodTraceOverlay } from '../utils/floodTraceOverlay'

/**
 * 서울시 2022 침수흔적 GeoJSON — gangnam_2022 시나리오에서 시뮬레이션과 비교용 overlay.
 */
export default function FloodTraceOverlay({ viewerRef, activeScenarioId }) {
  const visible = scenarioShowsFloodTrace(activeScenarioId)

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed?.()) return undefined

    if (!visible) {
      removeFloodTraceOverlay(viewer)
      return undefined
    }

    let cancelled = false
    const loadForScenario = activeScenarioId

    loadFloodTraceOverlay(viewer)
      .then(() => {
        if (cancelled || !scenarioShowsFloodTrace(loadForScenario)) {
          removeFloodTraceOverlay(viewer)
          return
        }
        viewer.scene.requestRender()
      })
      .catch((error) => {
        console.error('[FloodTraceOverlay] failed to load trace GeoJSON:', error)
      })

    return () => {
      cancelled = true
      if (!viewer.isDestroyed?.()) {
        removeFloodTraceOverlay(viewer)
      }
    }
  }, [viewerRef, visible, activeScenarioId])

  return null
}
