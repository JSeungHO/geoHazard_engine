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

/**
 * Cesium Viewer는 이 컴포넌트에서 단 한 번만 마운트된다.
 * viewer 인스턴스는 부모의 viewerRef에 저장한다 (PROJECT_PLAN.md).
 */
function CesiumMapViewer({ viewerRef, onViewerReady }) {
  const resiumRef = useRef(null)
  const readyNotifiedRef = useRef(false)

  const attachViewer = useCallback(() => {
    const viewer = resiumRef.current?.cesiumElement
    if (!viewer || viewer.isDestroyed?.()) return null

    viewerRef.current = viewer
    viewer.scene.globe.depthTestAgainstTerrain = true
    viewer.scene.globe.enableLighting = true
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
      onViewerReady?.()
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
  }, [attachViewer, onViewerReady])

  return (
    <Viewer
      full
      ref={resiumRef}
      terrain={Terrain.fromWorldTerrain({ requestVertexNormals: true })}
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
