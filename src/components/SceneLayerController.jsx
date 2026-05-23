import { useEffect, useRef } from 'react'
import { SCENE_LAYER_DEFS } from '../constants/sceneLayers'
import { SCENE_LAYER_RUNTIME } from '../scene/sceneLayerRuntime'

const getViewer = (viewerRef) => {
  const viewer = viewerRef.current
  if (!viewer || viewer.isDestroyed?.()) return null
  return viewer
}

/**
 * viewerRef + 레이어 가시성 state → Cesium 객체 로드/표시.
 * 레이어 추가 시 sceneLayers.js + sceneLayerRuntime.js 만 확장.
 */
export default function SceneLayerController({ viewerRef, layerVisibility }) {
  const instancesRef = useRef({})
  const loadingRef = useRef(new Set())

  useEffect(() => {
    const viewer = getViewer(viewerRef)
    if (!viewer) return undefined

    let cancelled = false

    const syncAll = async () => {
      for (const layer of SCENE_LAYER_DEFS) {
        const runtime = SCENE_LAYER_RUNTIME[layer.id]
        if (!runtime) continue

        const visible = layerVisibility[layer.id]
        const existing = instancesRef.current[layer.id]

        if (existing) {
          runtime.setVisible(existing, visible)
          continue
        }

        if (!visible || loadingRef.current.has(layer.id)) continue

        loadingRef.current.add(layer.id)

        try {
          const instance = await runtime.load(viewer)
          if (cancelled || viewer.isDestroyed?.()) {
            runtime.destroy(viewer, instance)
            continue
          }

          instancesRef.current[layer.id] = instance
          runtime.setVisible(instance, visible)
        } catch (error) {
          console.error(`[SceneLayerController] ${layer.id} load failed:`, error)
        } finally {
          loadingRef.current.delete(layer.id)
        }
      }

      if (!cancelled && !viewer.isDestroyed?.()) {
        viewer.scene.requestRender()
      }
    }

    syncAll()

    return () => {
      cancelled = true
    }
  }, [viewerRef, layerVisibility])

  useEffect(() => {
    return () => {
      const viewer = getViewer(viewerRef)
      if (!viewer) return

      SCENE_LAYER_DEFS.forEach((layer) => {
        const instance = instancesRef.current[layer.id]
        if (!instance) return

        const runtime = SCENE_LAYER_RUNTIME[layer.id]
        runtime?.destroy(viewer, instance)
        delete instancesRef.current[layer.id]
      })
      loadingRef.current.clear()
    }
  }, [viewerRef])

  return null
}
