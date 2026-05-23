import { Cartesian3, Math as CesiumMath } from 'cesium'
import { GANGNAM_LAT, GANGNAM_LON, GANGNAM_CAMERA_HEIGHT } from '../constants/gangnam'

export const GANGNAM_CAMERA_ORIENTATION = {
  heading: CesiumMath.toRadians(15),
  pitch: CesiumMath.toRadians(-45),
  roll: 0,
}

export function getGangnamCameraDestination() {
  return Cartesian3.fromDegrees(GANGNAM_LON, GANGNAM_LAT, GANGNAM_CAMERA_HEIGHT)
}

export function flyToGangnam(viewer) {
  if (!viewer || viewer.isDestroyed?.()) return

  viewer.camera.flyTo({
    destination: getGangnamCameraDestination(),
    orientation: GANGNAM_CAMERA_ORIENTATION,
    duration: 0,
  })
}
