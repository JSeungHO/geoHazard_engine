import { Cartesian3, Math as CesiumMath } from 'cesium'

/** 강남역 기준 좌표 — 카메라·침수 fallback·flyTo 단일 소스 */
export const FLOOD_HALF_SIZE_DEG = 0.005

export const GANGNAM = {
  id: 'gangnam',
  label: '강남역',
  lat: 37.4975,
  lon: 127.0267,
  cameraHeight: 300,
  cameraOrientation: {
    heading: CesiumMath.toRadians(15),
    pitch: CesiumMath.toRadians(-45),
    roll: 0,
  },
  floodHalfSizeDeg: FLOOD_HALF_SIZE_DEG,
}

export const DEFAULT_LOCATION = GANGNAM

/** @deprecated locations/gangnam 사용 — 하위 호환 */
export const GANGNAM_LAT = GANGNAM.lat
export const GANGNAM_LON = GANGNAM.lon
export const GANGNAM_CAMERA_HEIGHT = GANGNAM.cameraHeight
export const GANGNAM_CAMERA_ORIENTATION = GANGNAM.cameraOrientation

export function getLocationCameraDestination(location = DEFAULT_LOCATION) {
  return Cartesian3.fromDegrees(location.lon, location.lat, location.cameraHeight)
}

export function getLocationDefaultFloodBounds(location = DEFAULT_LOCATION) {
  const half = location.floodHalfSizeDeg
  return {
    west: location.lon - half,
    south: location.lat - half,
    east: location.lon + half,
    north: location.lat + half,
    centerLon: location.lon,
    centerLat: location.lat,
    halfLon: half,
    halfLat: half,
  }
}

export function flyToLocation(viewer, location = DEFAULT_LOCATION) {
  if (!viewer || viewer.isDestroyed?.()) return

  viewer.camera.flyTo({
    destination: getLocationCameraDestination(location),
    orientation: location.cameraOrientation,
    duration: 0,
  })
}

export function flyToGangnam(viewer) {
  flyToLocation(viewer, GANGNAM)
}
