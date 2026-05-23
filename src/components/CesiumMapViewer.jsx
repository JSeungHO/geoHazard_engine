import { memo, useRef, useCallback, useEffect } from 'react'
import { Viewer, CameraFlyTo } from 'resium'
import { Terrain, Cartesian3, Math as CesiumMath } from 'cesium'
import { GANGNAM_LAT, GANGNAM_LON, GANGNAM_CAMERA_HEIGHT } from '../constants/gangnam'

const GANGNAM_DESTINATION = Cartesian3.fromDegrees(
  GANGNAM_LON,
  GANGNAM_LAT,
  GANGNAM_CAMERA_HEIGHT
)

const GANGNAM_ORIENTATION = {
  heading: CesiumMath.toRadians(15),
  pitch: CesiumMath.toRadians(-45),
  roll: 0,
}

const resizeViewer = (viewer) => {
  if (!viewer || viewer.isDestroyed?.()) return
  viewer.resize()
  viewer.scene.requestRender()
}

/**
 * Cesium Viewer는 이 컴포넌트에서 단 한 번만 마운트된다.
 * viewer 인스턴스는 부모의 viewerRef에 저장한다 (PROJECT_PLAN.md).
 */
function CesiumMapViewer({ viewerRef, mapContainerRef, onViewerReady }) {
  const resiumRef = useRef(null)
  const readyNotifiedRef = useRef(false)

  const attachViewer = useCallback(() => {
    const viewer = resiumRef.current?.cesiumElement
    if (!viewer || viewer.isDestroyed?.()) return null

    viewerRef.current = viewer
    const scene = viewer.scene
    scene.globe.depthTestAgainstTerrain = true
    scene.globe.enableLighting = true
    scene.globe.dynamicAtmosphereLighting = true
    scene.globe.showGroundAtmosphere = true
    scene.skyAtmosphere.show = true
    scene.sun.show = true
    scene.sun.glowFactor = 1.15
    scene.light.intensity = 2.0
    scene.fog.enabled = false
    return viewer
  }, [viewerRef])

  useEffect(() => {
    let cancelled = false
    let frameId = 0

    const tryNotify = () => {
      if (cancelled || readyNotifiedRef.current) return false
      const viewer = attachViewer()
      if (!viewer) return false

      readyNotifiedRef.current = true
      resizeViewer(viewer)
      onViewerReady?.()

      requestAnimationFrame(() => {
        if (!cancelled) resizeViewer(viewerRef.current)
      })

      return true
    }

    if (tryNotify()) return undefined

    const poll = () => {
      if (tryNotify() || cancelled) return
      frameId = requestAnimationFrame(poll)
    }
    poll()

    return () => {
      cancelled = true
      cancelAnimationFrame(frameId)
    }
  }, [attachViewer, onViewerReady, viewerRef])

  useEffect(() => {
    const container = mapContainerRef?.current
    if (!container) return undefined

    let resizeObserver = null
    let frameId = 0

    const bindResize = () => {
      const viewer = viewerRef.current
      if (!viewer || viewer.isDestroyed?.()) return false

      resizeViewer(viewer)
      return true
    }

    resizeObserver = new ResizeObserver(() => {
      bindResize()
    })
    resizeObserver.observe(container)

    if (!bindResize()) {
      const poll = () => {
        if (bindResize()) return
        frameId = requestAnimationFrame(poll)
      }
      poll()
    }

    return () => {
      cancelAnimationFrame(frameId)
      resizeObserver?.disconnect()
    }
  }, [mapContainerRef, viewerRef])

  return (
    <Viewer
      ref={resiumRef}
      className="cesium-map-viewer"
      style={{ width: '100%', height: '100%' }}
      terrain={Terrain.fromWorldTerrain({ requestVertexNormals: true })}
      shouldAnimate
      animation={false}
      timeline={false}
      infoBox={false}
      selectionIndicator={false}
      geocoder={false}
      homeButton={false}
      sceneModePicker={false}
      navigationHelpButton={false}
      baseLayerPicker={false}
    >
      <CameraFlyTo
        once
        duration={0}
        destination={GANGNAM_DESTINATION}
        orientation={GANGNAM_ORIENTATION}
      />
    </Viewer>
  )
}

export default memo(CesiumMapViewer)
