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
export default function SceneLayerController({ viewerRef, layerVisibility, instancesRef: externalInstancesRef }) {
  const internalInstancesRef = useRef({})
  const layerInstancesRef = externalInstancesRef ?? internalInstancesRef
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
        const existing = layerInstancesRef.current[layer.id]

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

          layerInstancesRef.current[layer.id] = instance
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
  }, [viewerRef, layerVisibility, layerInstancesRef])

  useEffect(() => {
    // ref가 가리키는 객체는 컴포넌트 수명 동안 바뀌지 않으므로 effect 시작 시점에 고정한다.
    const instances = layerInstancesRef.current
    const loading = loadingRef.current

    return () => {
      const viewer = getViewer(viewerRef)
      if (!viewer) return

      SCENE_LAYER_DEFS.forEach((layer) => {
        const instance = instances[layer.id]
        if (!instance) return

        const runtime = SCENE_LAYER_RUNTIME[layer.id]
        runtime?.destroy(viewer, instance)
        delete instances[layer.id]
      })
      loading.clear()
    }
  }, [viewerRef, layerInstancesRef])

  return null
}
