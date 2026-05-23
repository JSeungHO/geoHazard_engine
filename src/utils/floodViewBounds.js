import {
  Cartesian2,
  Cartographic,
  Math as CesiumMath,
  Rectangle,
} from 'cesium'
import { GANGNAM_LAT, GANGNAM_LON } from '../constants/gangnam'

/** @typedef {{ west: number, south: number, east: number, north: number, centerLon: number, centerLat: number, halfLon: number, halfLat: number }} FloodBounds */

export const FLOOD_HALF_SIZE_DEG = 0.005

export const getDefaultFloodBounds = () => {
  const west = GANGNAM_LON - FLOOD_HALF_SIZE_DEG
  const east = GANGNAM_LON + FLOOD_HALF_SIZE_DEG
  const south = GANGNAM_LAT - FLOOD_HALF_SIZE_DEG
  const north = GANGNAM_LAT + FLOOD_HALF_SIZE_DEG

  return {
    west,
    south,
    east,
    north,
    centerLon: GANGNAM_LON,
    centerLat: GANGNAM_LAT,
    halfLon: FLOOD_HALF_SIZE_DEG,
    halfLat: FLOOD_HALF_SIZE_DEG,
  }
}

const cartographicsFromRectangle = (rect) => {
  const west = CesiumMath.toDegrees(rect.west)
  const east = CesiumMath.toDegrees(rect.east)
  const south = CesiumMath.toDegrees(rect.south)
  const north = CesiumMath.toDegrees(rect.north)

  return {
    west,
    south,
    east,
    north,
    centerLon: (west + east) / 2,
    centerLat: (south + north) / 2,
    halfLon: (east - west) / 2,
    halfLat: (north - south) / 2,
  }
}

const computeRectangleFromCanvas = (viewer) => {
  const { canvas, globe, camera } = viewer.scene
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (width <= 0 || height <= 0) return null

  const samplePoints = [
    new Cartesian2(0, height),
    new Cartesian2(width, height),
    new Cartesian2(width, 0),
    new Cartesian2(0, 0),
    new Cartesian2(width / 2, height / 2),
  ]

  let west = Infinity
  let east = -Infinity
  let south = Infinity
  let north = -Infinity
  let count = 0

  for (const point of samplePoints) {
    const ray = camera.getPickRay(point)
    if (!ray) continue

    const cartesian = globe.pick(ray, viewer.scene)
    if (!cartesian) continue

    const cartographic = Cartographic.fromCartesian(cartesian)
    const lon = CesiumMath.toDegrees(cartographic.longitude)
    const lat = CesiumMath.toDegrees(cartographic.latitude)

    west = Math.min(west, lon)
    east = Math.max(east, lon)
    south = Math.min(south, lat)
    north = Math.max(north, lat)
    count += 1
  }

  if (count < 3) return null

  return cartographicsFromRectangle(Rectangle.fromDegrees(west, south, east, north))
}

/** 현재 카메라가 보는 지표 범위 */
export const getViewFloodBounds = (viewer) => {
  if (!viewer || viewer.isDestroyed?.()) return getDefaultFloodBounds()

  const ellipsoid = viewer.scene.globe.ellipsoid
  const viewRect = viewer.camera.computeViewRectangle(ellipsoid)

  if (viewRect) {
    return cartographicsFromRectangle(viewRect)
  }

  return computeRectangleFromCanvas(viewer) ?? getDefaultFloodBounds()
}

const BOUNDS_EPSILON = 1e-6

export const boundsChanged = (prev, next) => {
  if (!prev || !next) return true

  return (
    Math.abs(prev.west - next.west) > BOUNDS_EPSILON ||
    Math.abs(prev.east - next.east) > BOUNDS_EPSILON ||
    Math.abs(prev.south - next.south) > BOUNDS_EPSILON ||
    Math.abs(prev.north - next.north) > BOUNDS_EPSILON
  )
}

export const lonLatFromUV = (bounds, u, v) => ({
  lon: bounds.west + (bounds.east - bounds.west) * u,
  lat: bounds.south + (bounds.north - bounds.south) * v,
})

export const boundsToDegreesArray = (bounds) => [
  bounds.west,
  bounds.south,
  bounds.east,
  bounds.south,
  bounds.east,
  bounds.north,
  bounds.west,
  bounds.north,
]
