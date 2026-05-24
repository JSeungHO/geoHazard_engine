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
  return `${abs}°${suffix}`
}

const formatMeters = (value) => {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value.toFixed(1)} m`
}

const getViewer = (viewerRef) => {
  const viewer = viewerRef.current
  if (!viewer || viewer.isDestroyed?.()) return null
  return viewer
}

export default function MapStatusBar({ viewerRef, isActive = false, waterLevel = 0, levelLabel = '침수' }) {
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
    <div className="map-status-bar">
      <div className="map-status-bar__item">
        <span className="map-status-bar__label">경위도</span>
        <span className="map-status-bar__value">
          {hasMouse
            ? `${formatCoord(mouseLat, 'N', 'S')}, ${formatCoord(mouseLon, 'E', 'W')}`
            : '—'}
        </span>
      </div>
      <div className="map-status-bar__item">
        <span className="map-status-bar__label">카메라 고도</span>
        <span className="map-status-bar__value map-status-bar__value--primary">
          {formatMeters(cameraHeight)}
        </span>
      </div>
      <div className="map-status-bar__item">
        <span className="map-status-bar__label">지표 고도</span>
        <span className="map-status-bar__value map-status-bar__value--danger">
          {formatMeters(elevation)}
        </span>
      </div>
      {waterLevel > 0 && (
        <div className="map-status-bar__item map-status-bar__item--flood">
          <span className="map-status-bar__label">{levelLabel}</span>
          <span className="map-status-bar__value map-status-bar__value--danger">
            💧 {Number(waterLevel).toFixed(2)} m
          </span>
        </div>
      )}
    </div>
  )
}
