import {
  Cartesian2,
  Cartographic,
  Math as CesiumMath,
  Rectangle,
} from 'cesium'
import { getLocationDefaultFloodBounds, FLOOD_HALF_SIZE_DEG } from '../locations/gangnam'

/** @typedef {{ west: number, south: number, east: number, north: number, centerLon: number, centerLat: number, halfLon: number, halfLat: number }} FloodBounds */

export { FLOOD_HALF_SIZE_DEG }

export const getDefaultFloodBounds = getLocationDefaultFloodBounds

/** pitch(rad) <= 이 값이면 화면 전체에 침수·강수 표시 (더 아래를 보면 포함) */
export const FLOOD_PITCH_FULL_SCREEN = -0.5894654192726403

/** pitch → 0 (수평)일 때 화면 위에서 잘라낼 최대 비율 — 하단만 남김 */
const FLOOD_PITCH_HORIZONTAL_CROP_START = 2 / 3

const clamp01 = (value) => Math.min(1, Math.max(0, value))

/**
 * 카메라 pitch → 화면 세로 샘플 시작 비율 (0=위, 1=아래).
 * pitch가 높아질수록(수평에 가까울수록) 위쪽부터 범위를 줄인다.
 */
export const getFloodBandStartForPitch = (pitch) => {
  if (pitch <= FLOOD_PITCH_FULL_SCREEN) return 0

  const t = clamp01((pitch - FLOOD_PITCH_FULL_SCREEN) / (0 - FLOOD_PITCH_FULL_SCREEN))
  return t * FLOOD_PITCH_HORIZONTAL_CROP_START
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

const pickGroundFromScreen = (viewer, point) => {
  const ray = viewer.camera.getPickRay(point)
  if (!ray) return null

  const cartesian = viewer.scene.globe.pick(ray, viewer.scene)
  if (!cartesian) return null

  const cartographic = Cartographic.fromCartesian(cartesian)
  return {
    lon: CesiumMath.toDegrees(cartographic.longitude),
    lat: CesiumMath.toDegrees(cartographic.latitude),
  }
}

/** 화면 세로 구간 [yStartFrac, yEndFrac]을 지표에 투영한 bounds (0=위, 1=아래) */
const computeRectangleFromCanvasBand = (viewer, yStartFrac, yEndFrac) => {
  const { canvas } = viewer.scene
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (width <= 0 || height <= 0) return null

  const yStart = height * yStartFrac
  const yEnd = height * yEndFrac
  const yMid = (yStart + yEnd) / 2

  const samplePoints = [
    new Cartesian2(0, yEnd),
    new Cartesian2(width, yEnd),
    new Cartesian2(width, yStart),
    new Cartesian2(0, yStart),
    new Cartesian2(width / 2, yMid),
    new Cartesian2(width / 4, yEnd),
    new Cartesian2((3 * width) / 4, yEnd),
  ]

  let west = Infinity
  let east = -Infinity
  let south = Infinity
  let north = -Infinity
  let count = 0

  for (const point of samplePoints) {
    const ground = pickGroundFromScreen(viewer, point)
    if (!ground) continue

    west = Math.min(west, ground.lon)
    east = Math.max(east, ground.lon)
    south = Math.min(south, ground.lat)
    north = Math.max(north, ground.lat)
    count += 1
  }

  if (count < 3) return null

  return cartographicsFromRectangle(Rectangle.fromDegrees(west, south, east, north))
}

const computeRectangleFromCanvas = (viewer) =>
  computeRectangleFromCanvasBand(viewer, 0, 1)

/** pitch에 따라 화면 세로 구간을 정해 지표 bounds 계산 */
export const getViewFloodBounds = (viewer) => {
  if (!viewer || viewer.isDestroyed?.()) return getDefaultFloodBounds()

  const yStart = getFloodBandStartForPitch(viewer.camera.pitch)
  const band = computeRectangleFromCanvasBand(viewer, yStart, 1)
  if (band) return band

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

/** 강수 emitter 중심 — pitch 밴드 세로 중앙(화면 좌표)을 지표에 투영 */
export const getRainEmitterPosition = (viewer, bounds) => {
  const { canvas } = viewer.scene
  const width = canvas.clientWidth
  const height = canvas.clientHeight

  if (width > 0 && height > 0) {
    const yStart = getFloodBandStartForPitch(viewer.camera.pitch)
    const yCenter = (height * (yStart + 1)) / 2
    const ground = pickGroundFromScreen(viewer, new Cartesian2(width / 2, yCenter))
    if (ground) {
      return { lon: ground.lon, lat: ground.lat }
    }
  }

  return { lon: bounds.centerLon, lat: bounds.centerLat }
}

/**
 * pitch·카메라 이동 시 view bounds 갱신 (침수·강수 공통).
 * @param {import('cesium').Viewer} viewer
 * @param {(bounds: FloodBounds) => void} onBoundsChange
 * @param {{ debounceMs?: number }} [options]
 */
export const addViewFloodBoundsListener = (viewer, onBoundsChange, options = {}) => {
  const { debounceMs = 0 } = options
  if (!viewer || viewer.isDestroyed?.()) return () => {}

  let lastBandStart = getFloodBandStartForPitch(viewer.camera.pitch)
  let debounceId = null

  const emit = () => {
    if (viewer.isDestroyed?.()) return
    onBoundsChange(getViewFloodBounds(viewer))
  }

  const scheduleEmit = () => {
    if (debounceMs <= 0) {
      emit()
      return
    }
    if (debounceId != null) window.clearTimeout(debounceId)
    debounceId = window.setTimeout(emit, debounceMs)
  }

  const onPitchOrViewChange = () => {
    const bandStart = getFloodBandStartForPitch(viewer.camera.pitch)
    if (Math.abs(bandStart - lastBandStart) < 0.008) return
    lastBandStart = bandStart
    scheduleEmit()
  }

  emit()

  const removeChanged = viewer.camera.changed.addEventListener(onPitchOrViewChange)
  const removeMoveEnd = viewer.camera.moveEnd.addEventListener(emit)

  return () => {
    if (debounceId != null) window.clearTimeout(debounceId)
    removeChanged?.()
    removeMoveEnd?.()
  }
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
