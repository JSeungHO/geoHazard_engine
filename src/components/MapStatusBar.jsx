import { useEffect, useState } from 'react'
import {
  Cartographic,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from 'cesium'
import './MapStatusBar.css'

const formatCoord = (value, positiveSuffix, negativeSuffix) => {
  const abs = Math.abs(value).toFixed(5)
  const suffix = value >= 0 ? positiveSuffix : negativeSuffix
  return `${abs}° ${suffix}`
}

const formatMeters = (value) => {
  if (value == null || Number.isNaN(value)) return '—'
  if (Math.abs(value) >= 10_000) return `${(value / 1000).toFixed(1)} km`
  return `${value.toFixed(1)} m`
}

const getViewer = (viewerRef) => {
  const viewer = viewerRef.current
  if (!viewer || viewer.isDestroyed?.()) return null
  return viewer
}

/**
 * 지도 하단 상태 바 — 커서 좌표·고도와 모듈 상태 표시.
 * @param {{ status?: { label: string, value?: string, tone?: 'neutral' | 'accent' | 'warning' | 'danger' } | null }} props
 */
export default function MapStatusBar({ viewerRef, isActive = false, status = null }) {
  const [mouseLat, setMouseLat] = useState(null)
  const [mouseLon, setMouseLon] = useState(null)
  const [elevation, setElevation] = useState(null)
  const [cameraHeight, setCameraHeight] = useState(null)

  useEffect(() => {
    if (!isActive) return undefined

    const viewer = getViewer(viewerRef)
    if (!viewer) return undefined

    const updateCameraHeight = () => {
      setCameraHeight(viewer.camera.positionCartographic.height)
    }

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas)

    handler.setInputAction((movement) => {
      updateCameraHeight()

      const ray = viewer.camera.getPickRay(movement.endPosition)
      if (!ray) {
        setMouseLat(null)
        setMouseLon(null)
        setElevation(null)
        return
      }

      const cartesian = viewer.scene.globe.pick(ray, viewer.scene)
      if (!cartesian) {
        setMouseLat(null)
        setMouseLon(null)
        setElevation(null)
        return
      }

      const cartographic = Cartographic.fromCartesian(cartesian)
      setMouseLat(CesiumMath.toDegrees(cartographic.latitude))
      setMouseLon(CesiumMath.toDegrees(cartographic.longitude))
      setElevation(cartographic.height)
    }, ScreenSpaceEventType.MOUSE_MOVE)

    viewer.camera.changed.addEventListener(updateCameraHeight)
    updateCameraHeight()

    return () => {
      if (!handler.isDestroyed()) handler.destroy()
      if (!viewer.isDestroyed?.()) {
        viewer.camera.changed.removeEventListener(updateCameraHeight)
      }
    }
  }, [viewerRef, isActive])

  const hasMouse = mouseLat != null && mouseLon != null

  return (
    <div className="map-status-bar" role="status">
      <div className="map-status-bar__item">
        <span className="map-status-bar__label">위도</span>
        <span className="map-status-bar__value">{hasMouse ? formatCoord(mouseLat, 'N', 'S') : '—'}</span>
      </div>
      <div className="map-status-bar__item">
        <span className="map-status-bar__label">경도</span>
        <span className="map-status-bar__value">{hasMouse ? formatCoord(mouseLon, 'E', 'W') : '—'}</span>
      </div>
      <div className="map-status-bar__item">
        <span className="map-status-bar__label">지표고</span>
        <span className="map-status-bar__value">{formatMeters(elevation)}</span>
      </div>
      <div className="map-status-bar__item">
        <span className="map-status-bar__label">카메라</span>
        <span className="map-status-bar__value">{formatMeters(cameraHeight)}</span>
      </div>
      {status && (
        <div className={`map-status-bar__status map-status-bar__status--${status.tone ?? 'neutral'}`}>
          <span className="map-status-bar__dot" aria-hidden="true" />
          <span>{status.label}</span>
          {status.value && <span className="map-status-bar__value">{status.value}</span>}
        </div>
      )}
    </div>
  )
}
